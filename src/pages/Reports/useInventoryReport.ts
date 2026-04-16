import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

export type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';
export type ReportMode = 'summary' | 'performance';

export interface InventoryRow {
    id: string;
    name: string;
    category?: string;

    // Performance Mode Fields
    openingStock?: number;
    qtyIn?: number;
    qtyOut?: number;
    closingStock?: number;
    revenue?: number;
    costOfSales?: number;
    profit?: number;

    // Summary Mode Fields
    currentStock: number;
    costPrice: number;
    salePrice: number;
    totalCostValue: number;
    totalRetailValue: number;
}

export const useInventoryReport = (mode: ReportMode, range: DateRange, customStartStr?: string, customEndStr?: string) => {
    const { activeBranchId, activeBranch } = useAuth();
    const [data, setData] = useState<InventoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [totals, setTotals] = useState({
        totalCostValue: 0,
        totalRetailValue: 0,
        totalIn: 0,
        totalOut: 0,
        totalRevenue: 0,
        totalProfit: 0
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Items
                const allItemsQuery = activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId);
                const allItems = await (allItemsQuery as any).filter((i: any) => !i.deletedAt).toArray();

                const baseRows: InventoryRow[] = allItems.map((item: any) => ({
                    id: item.id!,
                    name: item.name,
                    category: 'General',
                    currentStock: item.stock || 0,
                    costPrice: item.purchasePrice || 0,
                    salePrice: item.salePrice || 0,
                    totalCostValue: (item.stock || 0) * (item.purchasePrice || 0),
                    totalRetailValue: (item.stock || 0) * (item.salePrice || 0)
                }));

                if (mode === 'summary') {
                    const totalCost = baseRows.reduce((sum: any, r: any) => sum + r.totalCostValue, 0);
                    const totalRetail = baseRows.reduce((sum: any, r: any) => sum + r.totalRetailValue, 0);
                    setData(baseRows);
                    setTotals({ totalCostValue: totalCost, totalRetailValue: totalRetail, totalIn: 0, totalOut: 0, totalRevenue: 0, totalProfit: 0 });
                } else {
                    const now = new Date();
                    let start: Date = startOfDay(now);
                    let end: Date = endOfDay(now);

                    const safeCustomStart = customStartStr ? new Date(customStartStr) : undefined;
                    const safeCustomEnd = customEndStr ? new Date(customEndStr) : undefined;

                    if (range === 'custom' && safeCustomStart && !isNaN(safeCustomStart.getTime()) && safeCustomEnd && !isNaN(safeCustomEnd.getTime())) {
                        start = safeCustomStart;
                        end = safeCustomEnd;
                    } else if (range !== 'custom') {
                        switch (range) {
                            case 'today': start = startOfDay(now); end = endOfDay(now); break;
                            case 'week': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); break;
                            case 'month': start = startOfMonth(now); end = endOfMonth(now); break;
                            case 'year': start = startOfYear(now); end = endOfYear(now); break;
                        }
                    }

                    // Fetch invoices from period start to now (need post-period data for opening stock calc)
                    const invoices = await db.invoices
                        .where('createdAt')
                        .between(start, new Date(), true, true)
                        .and((inv: any) => (activeBranch?.isMaster || inv.branchId === activeBranchId) && inv.status !== 'cancelled' && inv.status !== 'draft' && !inv.deletedAt)
                        .toArray();
                    const purchases = await db.purchases
                        .where('date')
                        .between(start, new Date(), true, true)
                        .and((pur: any) => (activeBranch?.isMaster || pur.branchId === activeBranchId) && pur.status !== 'cancelled' && !pur.deletedAt)
                        .toArray();

                    const postPeriodDelta = new Map<string, number>();
                    const itemStats = new Map<string, { in: number, out: number, rev: number, cost: number }>();

                    invoices.forEach((inv: any) => {
                        const isPost = inv.createdAt > end;
                        const isPeriod = inv.createdAt >= start && inv.createdAt <= end;
                        inv.items.forEach((item: any) => {
                            const multiplier = inv.type === 'return' ? -1 : 1;
                            const qty = item.quantity * multiplier;
                            if (isPost) postPeriodDelta.set(item.itemId, (postPeriodDelta.get(item.itemId) || 0) + qty);
                            if (isPeriod) {
                                const stats = itemStats.get(item.itemId) || { in: 0, out: 0, rev: 0, cost: 0 };
                                const netRev = (item.total - (item.taxAmount || 0)) * multiplier;
                                const costPrice = item.purchasePrice ?? item.cost ?? (allItems.find((i: any) => i.id === item.itemId)?.purchasePrice || 0);
                                stats.out += qty;
                                stats.rev += netRev;
                                stats.cost += (costPrice * qty);
                                itemStats.set(item.itemId, stats);
                            }
                        });
                    });

                    purchases.forEach((pur: any) => {
                        const isPost = pur.date > end;
                        const isPeriod = pur.date >= start && pur.date <= end;
                        if (pur.type === 'order') return;
                        const multiplier = pur.type === 'return' ? -1 : 1;
                        pur.items.forEach((item: any) => {
                            const qty = item.quantity * multiplier;
                            if (isPost) postPeriodDelta.set(item.itemId, (postPeriodDelta.get(item.itemId) || 0) - qty);
                            if (isPeriod) {
                                const stats = itemStats.get(item.itemId) || { in: 0, out: 0, rev: 0, cost: 0 };
                                stats.in += qty;
                                itemStats.set(item.itemId, stats);
                            }
                        });
                    });

                    let sumIn = 0, sumOut = 0, sumRev = 0, sumProfit = 0;
                    const finalRows = baseRows.map(row => {
                        const unwind = postPeriodDelta.get(row.id) || 0;
                        const closingStock = row.currentStock + unwind;
                        const stats = itemStats.get(row.id) || { in: 0, out: 0, rev: 0, cost: 0 };
                        const openingStock = closingStock - stats.in + stats.out;
                        const profit = stats.rev - stats.cost;
                        sumIn += stats.in; sumOut += stats.out; sumRev += stats.rev; sumProfit += profit;
                        return { ...row, openingStock, closingStock, qtyIn: stats.in, qtyOut: stats.out, revenue: stats.rev, costOfSales: stats.cost, profit };
                    });

                    setData(finalRows);
                    setTotals({ totalCostValue: 0, totalRetailValue: 0, totalIn: sumIn, totalOut: sumOut, totalRevenue: sumRev, totalProfit: sumProfit });
                }
            } catch (error) {
                console.error("Error fetching inventory report:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [mode, range, customStartStr, customEndStr, activeBranchId, activeBranch?.isMaster]);

    return { data, loading, totals };
};

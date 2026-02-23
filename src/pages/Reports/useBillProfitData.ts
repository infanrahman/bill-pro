import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';


export type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface BillProfitRow {
    id: number;
    invoiceNumber: string;
    date: Date;
    customerName: string;
    itemCount: number;
    netSales: number; // Excl Tax
    costAmount: number;
    profit: number;
    marginPercent: number;
}

export const useBillProfitData = (range: DateRange, customStart?: Date, customEnd?: Date) => {
    const [data, setData] = useState<BillProfitRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [totals, setTotals] = useState({
        sales: 0,
        cost: 0,
        profit: 0
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const now = new Date();
            let start: Date, end: Date;

            if (range === 'custom' && customStart && customEnd) {
                start = startOfDay(customStart);
                end = endOfDay(customEnd);
            } else {
                switch (range) {
                    case 'today':
                        start = startOfDay(now);
                        end = endOfDay(now);
                        break;
                    case 'week':
                        start = startOfWeek(now, { weekStartsOn: 1 });
                        end = endOfWeek(now, { weekStartsOn: 1 });
                        break;
                    case 'month':
                        start = startOfMonth(now);
                        end = endOfMonth(now);
                        break;
                    case 'year':
                        start = startOfYear(now);
                        end = endOfYear(now);
                        break;
                    default:
                        start = startOfDay(now);
                        end = endOfDay(now);
                }
            }

            try {
                // Fetch Invoices
                const invoices = await db.invoices
                    .where('createdAt')
                    .between(start, end, true, true)
                    .reverse()
                    .toArray();

                // Fetch Items for Cost
                const allItems = await db.items.toArray();
                const itemCostMap = new Map<number, number>();
                allItems.forEach(item => {
                    if (item.id) itemCostMap.set(item.id, item.purchasePrice || 0);
                });

                const validInvoices = invoices.filter(inv => inv.status !== 'cancelled' && inv.status !== 'draft');

                let totalSales = 0;
                let totalCost = 0;
                let totalProfit = 0;

                const rows: BillProfitRow[] = validInvoices.map(inv => {
                    const isReturn = inv.type === 'return';
                    const multiplier = isReturn ? -1 : 1;

                    // Calculate Cost
                    let invoiceCost = 0;
                    inv.items.forEach(item => {
                        const cost = itemCostMap.get(item.itemId) || 0;
                        invoiceCost += (cost * item.quantity);
                    });

                    // Net Sales = GrandTotal - TaxAmount
                    // We use grandTotal because subTotal logic varies (inclusive vs exclusive)
                    // But accurate Net is (Grand - Tax).
                    const netSales = (inv.grandTotal - (inv.taxAmount || 0));

                    const profit = (netSales - invoiceCost) * multiplier;
                    const finalNetSales = netSales * multiplier;
                    const finalCost = invoiceCost * multiplier;

                    // Margin
                    const margin = finalNetSales !== 0 ? (profit / finalNetSales) * 100 : 0;

                    totalSales += finalNetSales;
                    totalCost += finalCost;
                    totalProfit += profit;

                    return {
                        id: inv.id!,
                        invoiceNumber: inv.invoiceNumber,
                        date: inv.createdAt,
                        customerName: inv.customerName,
                        itemCount: inv.items.length,
                        netSales: finalNetSales,
                        costAmount: finalCost,
                        profit: profit,
                        marginPercent: margin
                    };
                });

                setData(rows);
                setTotals({
                    sales: totalSales,
                    cost: totalCost,
                    profit: totalProfit
                });

            } catch (error) {
                console.error("Error fetching bill profit data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [range, customStart, customEnd]);

    return { data, loading, totals };
};

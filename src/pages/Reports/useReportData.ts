import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, format } from 'date-fns';

export type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface ReportData {
    totalSales: number;
    totalExpenses: number;
    grossProfit: number; // New Field: Total Sale Profit
    netProfit: number;
    currentStockValue: number; // New Field: Current Inventory Value (Cost)
    salesCount: number;
    salesByDate: { date: string; amount: number }[];
    loading: boolean;
}

export const useReportData = (range: DateRange, customStart?: Date, customEnd?: Date) => {
    const [data, setData] = useState<ReportData>({
        totalSales: 0,
        totalExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
        currentStockValue: 0,
        salesCount: 0,
        salesByDate: [],
        loading: true
    });

    useEffect(() => {
        const fetchData = async () => {
            setData(prev => ({ ...prev, loading: true }));

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
                    .toArray();

                // Fetch Expenses
                const expenses = await db.expenses
                    .where('date')
                    .between(start, end, true, true)
                    .toArray();

                // Fetch ALL Items to get current purchase price (COGS Proxy)
                // In a perfect world, we'd have historical cost in InvoiceItem, but we don't.
                const allItems = await db.items.toArray();
                const itemCostMap = new Map<number, number>();
                allItems.forEach(item => {
                    if (item.id) itemCostMap.set(item.id, item.purchasePrice || 0);
                });

                // Calculate Totals
                let totalSales = 0;
                let totalCOGS = 0;

                invoices.forEach(inv => {
                    // Only count valid sales
                    if (inv.status === 'cancelled') return;

                    const isReturn = inv.type === 'return';
                    const multiplier = isReturn ? -1 : 1;

                    // Sales Sum
                    totalSales += (inv.grandTotal * multiplier);

                    // COGS Calculation
                    inv.items.forEach(item => {
                        const costPrice = itemCostMap.get(item.itemId) || 0;
                        totalCOGS += (costPrice * item.quantity * multiplier);
                    });
                });

                const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

                // Gross Profit (Total Sale Profit) = Sales - Cost of Goods Sold
                const grossProfit = totalSales - totalCOGS;

                // Net Profit = Gross Profit - Operating Expenses
                // Note: We deliberately exclude "Total Inventory Purchases" from expense here,
                // because that is Asset Acquisition, not Expense. The "Expense" happens via COGS when sold.
                const netProfit = grossProfit - totalExpenses;

                // Prepare Chart Data
                const days = eachDayOfInterval({ start, end });

                const salesByDate = days.map(day => {
                    const dayLabels = format(day, range === 'year' ? 'MMM' : 'dd MMM');
                    const dayStart = startOfDay(day);
                    const dayEnd = endOfDay(day);

                    const dailySales = invoices
                        .filter(inv => inv.createdAt >= dayStart && inv.createdAt <= dayEnd && inv.status !== 'cancelled')
                        .reduce((sum, inv) => {
                            if (inv.type === 'return') return sum - inv.grandTotal;
                            return sum + inv.grandTotal;
                        }, 0);

                    return {
                        date: dayLabels,
                        amount: dailySales
                    };
                });

                let chartData = salesByDate;
                if (range === 'year' || (range === 'custom' && days.length > 60)) {
                    const monthly: Record<string, number> = {};
                    invoices.forEach(inv => {
                        if (inv.status === 'cancelled') return;
                        const month = format(inv.createdAt, 'MMM yyyy');
                        const amount = inv.type === 'return' ? -inv.grandTotal : inv.grandTotal;
                        monthly[month] = (monthly[month] || 0) + amount;
                    });
                    const uniqueMonths = Array.from(new Set(days.map(d => format(d, 'MMM yyyy'))));
                    chartData = uniqueMonths.map(m => ({ date: m, amount: monthly[m] || 0 }));
                }

                setData({
                    totalSales,
                    totalExpenses,
                    grossProfit,
                    netProfit,
                    currentStockValue: allItems.reduce((sum, item) => sum + ((item.stock || 0) * (item.purchasePrice || 0)), 0),
                    salesCount: invoices.filter(i => i.status !== 'cancelled').length,
                    salesByDate: chartData,
                    loading: false
                });

            } catch (error) {
                console.error("Error fetching report data:", error);
                setData(prev => ({ ...prev, loading: false }));
            }
        };

        fetchData();
    }, [range, customStart, customEnd]);

    return data;
};

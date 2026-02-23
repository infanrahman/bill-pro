import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';
export type ReportMode = 'summary' | 'performance';

export interface InventoryRow {
    id: number;
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

export const useInventoryReport = (mode: ReportMode, range: DateRange, customStart?: Date, customEnd?: Date) => {
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
                const allItems = await db.items.toArray();

                // Base structure
                let rows: InventoryRow[] = allItems.map(item => ({
                    id: item.id!,
                    name: item.name,
                    category: 'General', // In simple schema, categories might be missing or stored elsewhere. Assuming simple string if exists.
                    currentStock: item.stock || 0,
                    costPrice: item.purchasePrice || 0,
                    salePrice: item.salePrice || 0,
                    totalCostValue: (item.stock || 0) * (item.purchasePrice || 0),
                    totalRetailValue: (item.stock || 0) * (item.salePrice || 0)
                }));

                if (mode === 'summary') {
                    // Summary Mode is simple: Just return the current state snapshot
                    const totalCost = rows.reduce((sum, r) => sum + r.totalCostValue, 0);
                    const totalRetail = rows.reduce((sum, r) => sum + r.totalRetailValue, 0);

                    setData(rows);
                    setTotals({
                        totalCostValue: totalCost,
                        totalRetailValue: totalRetail,
                        totalIn: 0,
                        totalOut: 0,
                        totalRevenue: 0,
                        totalProfit: 0
                    });
                } else {
                    // Performance Mode: Historical Back-Calculation
                    // Need Date Range
                    const now = new Date();
                    let start: Date, end: Date;

                    if (range === 'custom' && customStart && customEnd) {
                        start = startOfDay(customStart);
                        end = endOfDay(customEnd);
                    } else {
                        switch (range) {
                            case 'today': start = startOfDay(now); end = endOfDay(now); break;
                            case 'week': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); break;
                            case 'month': start = startOfMonth(now); end = endOfMonth(now); break;
                            case 'year': start = startOfYear(now); end = endOfYear(now); break;
                            default: start = startOfDay(now); end = endOfDay(now);
                        }
                    }

                    // Fetch Transactions
                    // We need ALL Invoices and Purchases to trace back stock, or at least from 'End Date' to 'Now'.
                    // Strategy: 
                    // 1. Get Transactions(Post-Period) -> From EndDate to NOW. Used to rewind Closing Stock.
                    // 2. Get Transactions(Period) -> From StartDate to EndDate. Used for In/Out stats.

                    // Optimization: Fetch ALL relevant transactions in one go if dataset is small, or split query.
                    // Since Dexie is local, fetching all valid invoices/purchases isn't terrible for <10k records.
                    // Let's being robust:

                    const invoices = await db.invoices.where('status').noneOf(['cancelled', 'draft']).toArray();
                    const purchases = await db.purchases.where('status').notEqual('cancelled').toArray(); // We filter types later or now

                    // Maps to hold item qty changes
                    // postPeriodDelta = Change in stock AFTER the report period (needed to unwind)
                    // periodIn = Qty bought during period
                    // periodOut = Qty sold during period

                    const postPeriodDelta = new Map<number, number>();
                    const periodInMap = new Map<number, number>();
                    const periodOutMap = new Map<number, number>();
                    const periodRevenueMap = new Map<number, number>();

                    // Process Invoices (Sales)
                    invoices.forEach(inv => {
                        const isPost = inv.createdAt > end;
                        const isPeriod = inv.createdAt >= start && inv.createdAt <= end;

                        if (!isPost && !isPeriod) return; // Pre-period transaction (irrelevant for Closing calc, implicit in Opening)

                        const multiplier = inv.type === 'return' ? -1 : 1; // Return adds to stock, Sale removes

                        inv.items.forEach(item => {
                            const qty = item.quantity * multiplier;

                            // Warning: Stock Direction
                            // Sale = Stock Decrease. 
                            // CurrentStock = ClosingStock - PostSale + PostReturn...
                            // Actually: ClosingStock(PeriodEnd) = CurrentStock + QtySold(Post) - QtyBot(Post)

                            if (isPost) {
                                // If I sold 5 items yesterday (post period), my current stock is 5 less.
                                // So ClosingStock was 5 higher.
                                // QtySold reduces stock. So "Unwind" means ADDING it back.
                                // Post Delta needs to track "Amount to ADD to Current to get Closing"
                                // Sale: Stock down. Unwind: Stock UP. (+qty)
                                // Return: Stock up. Unwind: Stock DOWN. (-qty)
                                const currentDelta = postPeriodDelta.get(item.itemId) || 0;
                                postPeriodDelta.set(item.itemId, currentDelta + qty);
                            }

                            if (isPeriod) {
                                // Stats for the period
                                if (inv.type === 'return') {
                                    // Treat return as negative Out? Or In? Usually Negative Out.
                                    const currentOut = periodOutMap.get(item.itemId) || 0;
                                    periodOutMap.set(item.itemId, currentOut - item.quantity);

                                    const currentRev = periodRevenueMap.get(item.itemId) || 0;
                                    periodRevenueMap.set(item.itemId, currentRev - item.total);
                                } else {
                                    const currentOut = periodOutMap.get(item.itemId) || 0;
                                    periodOutMap.set(item.itemId, currentOut + item.quantity);

                                    // Revenue logic: We need Item Total (Price * Qty)
                                    // Note: InvoiceItem.total usually includes tax/discounts depending on logic, verify.
                                    // Simplification: item.total
                                    const currentRev = periodRevenueMap.get(item.itemId) || 0;
                                    periodRevenueMap.set(item.itemId, currentRev + item.total);
                                }
                            }
                        });
                    });

                    // Process Purchases
                    purchases.forEach(pur => {
                        const purDate = pur.date; // or createdAt
                        const isPost = purDate > end;
                        const isPeriod = purDate >= start && purDate <= end;

                        if (!isPost && !isPeriod) return;
                        if (pur.type === 'order') return; // Exclude Orders, they don't affect stock until converted to Bill

                        // Purchase = Stock UP.
                        // Return = Stock DOWN.
                        // Unwind Post Purchase = Subtract.

                        const multiplier = pur.type === 'return' ? -1 : 1;

                        pur.items.forEach(item => {
                            const qty = item.quantity * multiplier;

                            if (isPost) {
                                // I bought 10. Current is 10 higher.
                                // Closing was 10 lower.
                                // Unwind: Subtract.
                                const currentDelta = postPeriodDelta.get(item.itemId) || 0;
                                postPeriodDelta.set(item.itemId, currentDelta - qty);
                            }

                            if (isPeriod) {
                                if (pur.type === 'return') {
                                    // Negative In
                                    const currentIn = periodInMap.get(item.itemId) || 0;
                                    periodInMap.set(item.itemId, currentIn - item.quantity);
                                } else {
                                    const currentIn = periodInMap.get(item.itemId) || 0;
                                    periodInMap.set(item.itemId, currentIn + item.quantity);
                                }
                            }
                        });
                    });

                    // Now Build Rows
                    let sumIn = 0;
                    let sumOut = 0;
                    let sumRev = 0;
                    let sumProfit = 0;

                    rows = rows.map(row => {
                        // 1. Calculate Closing Stock @ Period End
                        // Closing = Current + UnwindDelta
                        const unwind = postPeriodDelta.get(row.id) || 0;
                        const closingStock = row.currentStock + unwind;

                        // 2. Get Period Activity
                        const qtyIn = periodInMap.get(row.id) || 0;
                        const qtyOut = periodOutMap.get(row.id) || 0;
                        const revenue = periodRevenueMap.get(row.id) || 0;

                        // 3. Calculate Opening
                        // Closing = Opening + In - Out
                        // Opening = Closing - In + Out
                        const openingStock = closingStock - qtyIn + qtyOut;

                        // 4. Calculate Profit
                        // COGS = QtySold * CostPrice
                        // Profit = Revenue - COGS
                        // NOTE: Revenue might include tax if InvoiceItem.total is gross.
                        // Usually Profit/Loss reports excludes tax from Revenue or subtracts it. 
                        // Assuming item.total is what we want for now (Glossary: Profit on Sale).
                        // Cost Price: We use CURRENT Cost Price. Historical cost tracking is complex (FIFO/LIFO) and not in Schema.
                        const costOfSales = qtyOut * row.costPrice;
                        const profit = revenue - costOfSales;

                        sumIn += qtyIn;
                        sumOut += qtyOut;
                        sumRev += revenue;
                        sumProfit += profit;

                        return {
                            ...row,
                            openingStock,
                            closingStock,
                            qtyIn,
                            qtyOut,
                            revenue,
                            costOfSales,
                            profit
                        };
                    });

                    setData(rows);
                    setTotals({
                        totalCostValue: 0,
                        totalRetailValue: 0,
                        totalIn: sumIn,
                        totalOut: sumOut,
                        totalRevenue: sumRev,
                        totalProfit: sumProfit
                    });
                }

            } catch (error) {
                console.error("Error fetching inventory report:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [mode, range, customStart, customEnd]); // Re-run on these changes

    return { data, loading, totals };
};

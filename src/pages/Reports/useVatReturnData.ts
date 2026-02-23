import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type VatPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface VatSectionResult {
    amount: number;
    vat: number;
}

export interface VatReturnData {
    sales: {
        standard: VatSectionResult;
        zero: VatSectionResult;
        returnStandard: VatSectionResult;
        returnZero: VatSectionResult;
    };
    purchases: {
        standard: VatSectionResult;
        zero: VatSectionResult;
        returnStandard: VatSectionResult;
        returnZero: VatSectionResult;
    };
    net: {
        sales: VatSectionResult;
        purchases: VatSectionResult;
        vatPayable: number;
    };
}

export const useVatReturnData = (period: VatPeriod, customStart?: Date, customEnd?: Date) => {
    const [data, setData] = useState<VatReturnData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const now = new Date();
                let start: Date, end: Date;

                if (period === 'custom' && customStart && customEnd) {
                    start = startOfDay(customStart);
                    end = endOfDay(customEnd);
                } else {
                    switch (period) {
                        case 'daily': start = startOfDay(now); end = endOfDay(now); break;
                        case 'weekly': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); break;
                        case 'monthly': start = startOfMonth(now); end = endOfMonth(now); break;
                        case 'yearly': start = startOfYear(now); end = endOfYear(now); break;
                        default: start = startOfMonth(now); end = endOfMonth(now);
                    }
                }

                // Initialize Accumulators
                const sales = {
                    standard: { amount: 0, vat: 0 },
                    zero: { amount: 0, vat: 0 },
                    returnStandard: { amount: 0, vat: 0 },
                    returnZero: { amount: 0, vat: 0 }
                };
                const purchases = {
                    standard: { amount: 0, vat: 0 },
                    zero: { amount: 0, vat: 0 },
                    returnStandard: { amount: 0, vat: 0 },
                    returnZero: { amount: 0, vat: 0 }
                };

                // 1. Process Invoices (Sales)
                const invoices = await db.invoices
                    .where('createdAt').between(start, end, true, true)
                    .filter(i => i.status !== 'cancelled' && i.status !== 'draft')
                    .toArray();

                for (const inv of invoices) {
                    const isReturn = inv.type === 'return';

                    for (const item of inv.items) {
                        const amount = item.price * item.quantity;
                        // Tax Rate: Try item level, fallback to invoice level, fallback to 0
                        const rate = item.taxRate !== undefined ? item.taxRate : (inv.taxRate || 0);
                        const vat = amount * (rate / 100);

                        if (isReturn) {
                            if (rate > 0) {
                                sales.returnStandard.amount += amount;
                                sales.returnStandard.vat += vat;
                            } else {
                                sales.returnZero.amount += amount;
                                sales.returnZero.vat += vat;
                            }
                        } else {
                            if (rate > 0) {
                                sales.standard.amount += amount;
                                sales.standard.vat += vat;
                            } else {
                                sales.zero.amount += amount;
                                sales.zero.vat += vat;
                            }
                        }
                    }
                }

                // 2. Process Purchases
                const purchaseRecs = await db.purchases
                    .where('date').between(start, end, true, true)
                    .filter(p => p.status !== 'cancelled')
                    .toArray();

                // Pre-fetch all items to lookup tax rates for purchases
                // Optimization: Only fetch items referenced in purchases if needed, but for local DB, fetching all items map is fast enough usually.
                const allItems = await db.items.toArray();
                const itemMap = new Map<number, number>(); // Id -> TaxRate
                allItems.forEach(i => itemMap.set(i.id!, i.taxRate || 0));

                for (const pur of purchaseRecs) {
                    if (pur.type === 'order') continue; // Exclude Orders
                    const isReturn = pur.type === 'return';

                    for (const item of pur.items) {
                        const amount = item.cost * item.quantity;
                        // Lookup Tax Rate from Inventory Definition
                        const rate = itemMap.get(item.itemId) || 0;
                        const vat = amount * (rate / 100);

                        if (isReturn) {
                            if (rate > 0) {
                                purchases.returnStandard.amount += amount;
                                purchases.returnStandard.vat += vat;
                            } else {
                                purchases.returnZero.amount += amount;
                                purchases.returnZero.vat += vat;
                            }
                        } else {
                            if (rate > 0) {
                                purchases.standard.amount += amount;
                                purchases.standard.vat += vat;
                            } else {
                                purchases.zero.amount += amount;
                                purchases.zero.vat += vat;
                            }
                        }
                    }
                }

                // 3. Calculate Nets
                // Net Sales = (Std + Zero) - (RetStd + RetZero)
                // Net VAT = (Std.Vat) - (RetStd.Vat)  <-- Zero has noVAT

                const netSales = {
                    amount: (sales.standard.amount + sales.zero.amount) - (sales.returnStandard.amount + sales.returnZero.amount),
                    vat: (sales.standard.vat + sales.zero.vat) - (sales.returnStandard.vat + sales.returnZero.vat)
                };

                const netPurchases = {
                    amount: (purchases.standard.amount + purchases.zero.amount) - (purchases.returnStandard.amount + purchases.returnZero.amount),
                    vat: (purchases.standard.vat + purchases.zero.vat) - (purchases.returnStandard.vat + purchases.returnZero.vat)
                };

                const vatPayable = netSales.vat - netPurchases.vat;

                setData({
                    sales,
                    purchases,
                    net: {
                        sales: netSales,
                        purchases: netPurchases,
                        vatPayable
                    }
                });

            } catch (error) {
                console.error("Error calculating VAT return:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [period, customStart, customEnd]);

    return { data, loading };
};

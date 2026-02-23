import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfWeek, startOfMonth, startOfYear, format, startOfDay, endOfDay } from 'date-fns';

export type VatPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface VatDataRow {
    label: string;
    netSales: number;
    vatAmount: number;
    grossSales: number;
    date: Date;
}

export const useVatData = (period: VatPeriod, customStart?: Date, customEnd?: Date) => {
    const [data, setData] = useState<VatDataRow[]>([]);
    const [totals, setTotals] = useState({ netSales: 0, vatAmount: 0, grossSales: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all invoices (paid/completed/partial) - exclude cancelled/draft
                // For accurate VAT, we should probably look at completion date or create date. Using createdAt for now.
                let query = db.invoices
                    .where('status')
                    .noneOf(['cancelled', 'draft']);

                let allInvoices = await query.toArray();

                // Start / End filtering if Custom
                // Note: Dexie compound queries can be tricky with OR conditions (noneOf) + Range.
                // Fetching all valid status first then filtering in memory is safer for this scale.
                // Or if we had an index on createdAt, we could filter by date first.
                // Given the user wants "Custom Calendar", memory filter is acceptable for < 10k items.

                if (customStart && customEnd) {
                    const start = startOfDay(customStart);
                    const end = endOfDay(customEnd);
                    allInvoices = allInvoices.filter(inv => inv.createdAt >= start && inv.createdAt <= end);
                }

                // Sort by date descending
                allInvoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

                let groupedData: VatDataRow[] = [];
                let limit = 0;
                let dateFormat = '';

                // If custom dates are provided, we treat grouping as DAILY by default for the list
                // OR we could pass a 'grouping' param. For now, let's assume if custom dates -> Daily.
                const activePeriod = (customStart && customEnd) ? 'daily' : period;

                // Determine grouping strategy
                // For simplicity in this version, we'll just show the last X periods
                switch (activePeriod) {
                    case 'daily':
                        limit = (customStart && customEnd) ? 1000 : 30; // Show all if custom, else last 30
                        dateFormat = 'dd MMM yyyy';
                        break;
                    case 'weekly':
                        limit = 12; // Last 12 weeks
                        dateFormat = "'Week' w, yyyy";
                        break;
                    case 'monthly':
                        limit = 12; // Last 12 months
                        dateFormat = 'MMM yyyy';
                        break;
                    case 'yearly':
                        limit = 5; // Last 5 years
                        dateFormat = 'yyyy';
                        break;
                }

                // Grouping Logic
                const groups = new Map<string, VatDataRow>();

                allInvoices.forEach(inv => {
                    // Filter out very old data if needed, or just let the grouping handle it
                    // For now, process all and then slice? Or process dynamically.
                    // Let's use simple key generation based on period

                    let key = '';
                    let label = '';
                    const date = new Date(inv.createdAt);

                    if (activePeriod === 'daily') {
                        key = format(date, 'yyyy-MM-dd');
                        label = format(date, dateFormat);
                    } else if (activePeriod === 'weekly') {
                        key = format(startOfWeek(date), 'yyyy-MM-dd');
                        label = format(date, dateFormat);
                    } else if (activePeriod === 'monthly') {
                        key = format(startOfMonth(date), 'yyyy-MM');
                        label = format(date, dateFormat);
                    } else if (activePeriod === 'yearly') {
                        key = format(startOfYear(date), 'yyyy');
                        label = format(date, dateFormat);
                    }

                    if (!groups.has(key)) {
                        groups.set(key, {
                            label,
                            netSales: 0,
                            vatAmount: 0,
                            grossSales: 0,
                            date: date // Store one date for sorting
                        });
                    }

                    const group = groups.get(key)!;

                    // Tax Calculation
                    // Verify if taxAmount exists, if not calculate from items (legacy support)
                    const tax = inv.taxAmount || 0;
                    const total = inv.grandTotal || 0;
                    const sub = inv.subTotal || (total - tax);

                    group.netSales += sub;
                    group.vatAmount += tax;
                    group.grossSales += total;
                });

                // Convert to array and sort
                groupedData = Array.from(groups.values())
                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                    .slice(0, limit);

                setData(groupedData);

                // Calculate Totals (of the viewed data)
                const newTotals = groupedData.reduce((acc, curr) => ({
                    netSales: acc.netSales + curr.netSales,
                    vatAmount: acc.vatAmount + curr.vatAmount,
                    grossSales: acc.grossSales + curr.grossSales
                }), { netSales: 0, vatAmount: 0, grossSales: 0 });

                setTotals(newTotals);

            } catch (error) {
                console.error("Error fetching VAT data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [period, customStart, customEnd]);

    return { data, totals, loading };
};

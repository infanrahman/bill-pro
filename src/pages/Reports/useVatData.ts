import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
import { startOfWeek, startOfMonth, startOfYear, format, startOfDay, endOfDay } from 'date-fns';
import { calculateLineItem } from '../../utils/financials';

export type VatPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface VatDataRow {
 label: string;
 netSales: number;
 vatAmount: number;
 grossSales: number;
 date: Date;
}

export const useVatData = (period: VatPeriod, customStart?: Date, customEnd?: Date) => {
 const { activeBranchId, activeBranch } = useAuth();
 const [data, setData] = useState<VatDataRow[]>([]);
 const [totals, setTotals] = useState({ netSales: 0, vatAmount: 0, grossSales: 0 });
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchData = async () => {
 setLoading(true);
 try {
 // Calculate date boundaries based on period
 const now = new Date();
 let queryStart: Date | undefined;
 let queryEnd: Date | undefined;

 if (customStart && customEnd) {
 queryStart = startOfDay(customStart);
 queryEnd = endOfDay(customEnd);
 } else {
 // For non-custom periods, we still need boundaries to limit the query
 // but since grouping handles the display, we load a reasonable range
 switch (period) {
 case 'daily':
 // Last 30 days
 queryStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
 queryEnd = endOfDay(now);
 break;
 case 'weekly':
 // Last 12 weeks
 queryStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84);
 queryEnd = endOfDay(now);
 break;
 case 'monthly':
 // Last 12 months
 queryStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
 queryEnd = endOfDay(now);
 break;
 case 'yearly':
 // Last 5 years
 queryStart = new Date(now.getFullYear() - 5, 0, 1);
 queryEnd = endOfDay(now);
 break;
 }
 }

 // Use createdAt index for efficient date-scoped query
 let allInvoices;
 if (queryStart && queryEnd) {
 allInvoices = await db.invoices
 .where('createdAt')
 .between(queryStart, queryEnd, true, true)
 .and((inv: any) => (activeBranch?.isMaster || inv.branchId === activeBranchId) && inv.status !== 'cancelled' && inv.status !== 'draft' && !inv.deletedAt)
 .toArray();
 } else {
 // Fallback (shouldn't happen)
 const invoicesQuery = activeBranch?.isMaster ? db.invoices : db.invoices.where('branchId').equals(activeBranchId);
 allInvoices = await (invoicesQuery as any)
 .filter((inv: any) => inv.status !== 'cancelled' && inv.status !== 'draft' && !inv.deletedAt)
 .toArray();
 }

 // Sort by date descending
 allInvoices.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

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
 dateFormat ="'Week' w, yyyy";
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

 allInvoices.forEach((inv: any) => {
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
 const isReturn = inv.type === 'return';
 let invoiceTax = 0;
 let invoiceNet = 0;
 let invoiceGross = 0;

 if (inv.items && inv.items.length > 0) {
 inv.items.forEach((item: any) => {
 let itemTax = 0;
 let itemNet = 0;
 let itemGross = 0;

 // Priority: 1. Stored pre-calculated fields (best for consistency)
 // 2. Calculate fresh using the unified utility (best for legacy/fallback)
 if (item.taxAmount !== undefined && item.netAmount !== undefined) {
 itemTax = item.taxAmount;
 itemNet = item.netAmount;
 itemGross = item.total || (itemNet + itemTax);
 } else {
 const rate = item.taxRate !== undefined ? item.taxRate : (inv.taxRate || 0);
 const type = item.taxType || (inv.taxType === 'inclusive' ? 'inclusive' : 'exclusive');
 
 const totals = calculateLineItem({
 price: item.price || 0,
 quantity: item.quantity || 0,
 taxRate: rate,
 taxType: type === 'inclusive' ? 'inclusive' : 'exclusive',
 discount: 0,
 discountType: 'fixed'
 });
 
 itemTax = totals.taxAmount;
 itemNet = totals.taxableAmount;
 itemGross = totals.total;
 }

 invoiceTax += itemTax;
 invoiceNet += itemNet;
 invoiceGross += itemGross;
 });
 } else {
 // Fallback to header if items are missing
 invoiceTax = inv.taxAmount || 0;
 invoiceGross = inv.grandTotal || 0;
 invoiceNet = inv.netAmount || (invoiceGross - invoiceTax);
 }

 if (isReturn) {
 group.netSales -= invoiceNet;
 group.vatAmount -= invoiceTax;
 group.grossSales -= invoiceGross;
 } else {
 group.netSales += invoiceNet;
 group.vatAmount += invoiceTax;
 group.grossSales += invoiceGross;
 }
 });

 // Convert to array and sort
 groupedData = Array.from(groups.values())
 .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())
 .slice(0, limit);

 setData(groupedData);

 // Calculate Totals (of the viewed data)
 const newTotals = groupedData.reduce((acc: any, curr: any) => ({
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
 }, [period, customStart, customEnd, activeBranchId, activeBranch?.isMaster]);

 return { data, totals, loading };
};

import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';


export type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface BillProfitRow {
 id: string;
 invoiceNumber: string;
 date: Date;
 customerName: string;
 itemCount: number;
 netSales: number; // Excl Tax
 costAmount: number;
 profit: number;
 marginPercent: number;
}

export const useBillProfitData = (range: DateRange, customStartStr?: string, customEndStr?: string) => {
 const { activeBranchId, activeBranch } = useAuth();
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
 let start: Date = startOfDay(now);
 let end: Date = endOfDay(now);

 const customStart = customStartStr ? new Date(customStartStr) : undefined;
 const customEnd = customEndStr ? new Date(customEndStr) : undefined;

 // Safely parse custom dates
 const safeCustomStart = customStart && !isNaN(customStart.getTime()) ? customStart : undefined;
 const safeCustomEnd = customEnd && !isNaN(customEnd.getTime()) ? customEnd : undefined;

 if (range === 'custom') {
 if (safeCustomStart && safeCustomEnd) {
 if (safeCustomStart > safeCustomEnd) {
 start = startOfDay(safeCustomEnd);
 end = endOfDay(safeCustomStart);
 } else {
 start = startOfDay(safeCustomStart);
 end = endOfDay(safeCustomEnd);
 }
 } else if (safeCustomStart) {
 start = startOfDay(safeCustomStart);
 end = endOfDay(safeCustomStart);
 } else if (safeCustomEnd) {
 start = startOfDay(safeCustomEnd);
 end = endOfDay(safeCustomEnd);
 }
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
 }
 }

 try {
 // Fetch Items to get COGS
 const allItemsQuery = activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId);
 const allItems = await (allItemsQuery as any).filter((i: any) => !i.deletedAt).toArray();
 const itemCostMap = new Map<string, number>();
 allItems.forEach((item: any) => {
 if (item.id) itemCostMap.set(item.id, item.purchasePrice || 0);
 });

 // Fetch Invoices
 const invoices = await db.invoices
 .where('createdAt')
 .between(start, end, true, true)
 .and((inv: any) => (activeBranch?.isMaster || inv.branchId === activeBranchId) && !inv.deletedAt)
 .toArray();

 const validInvoices = invoices.filter((inv: any) => inv.status !== 'cancelled' && inv.status !== 'draft');

 let totalSales = 0;
 let totalCost = 0;
 let totalProfit = 0;

 const rows: BillProfitRow[] = validInvoices.map((inv: any) => {
 const isReturn = inv.type === 'return';
 const multiplier = isReturn ? -1 : 1;

 // Calculate Cost
 let invoiceCost = 0;
 inv.items.forEach((item: any) => {
 // Priority: 1. Item-level stored cost, 2. Item-level defined cost, 3. Inventory current cost
 const cost = item.purchasePrice !== undefined 
 ? item.purchasePrice 
 : (item.cost !== undefined ? item.cost : (itemCostMap.get(item.itemId) || 0));
 invoiceCost += (cost * item.quantity);
 });

 // Net Sales = GrandTotal - TaxAmount (Always accurate regardless of inclusive/exclusive)
 // Priority: 1. Stored netAmount 2. Calculated fallback
 const netSales = inv.netAmount !== undefined ? inv.netAmount : (inv.grandTotal - (inv.taxAmount || 0));

 const profit = (netSales - invoiceCost) * multiplier;
 const finalNetSales = netSales * multiplier;
 const finalCost = invoiceCost * multiplier;

 // Margin (M15 Fix: handle 0 sales or cost safely)
 const rawMargin = finalNetSales !== 0 ? (profit / finalNetSales) * 100 : 0;
 const margin = isNaN(rawMargin) || !isFinite(rawMargin) ? 0 : Math.round(rawMargin * 10) / 10;

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
 }, [range, customStartStr, customEndStr, activeBranchId, activeBranch?.isMaster]);

 return { data, loading, totals };
};

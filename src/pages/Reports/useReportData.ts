import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
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

export const useReportData = (range: DateRange, customStartStr?: string, customEndStr?: string) => {
 const { activeBranchId, activeBranch } = useAuth();
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
 let start: Date = startOfDay(now);
 let end: Date = endOfDay(now);

 // Safely parse custom dates from strings passed in
 const customStart = customStartStr ? new Date(customStartStr) : undefined;
 const customEnd = customEndStr ? new Date(customEndStr) : undefined;

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
 // Fetch Invoices
 const invoices = await db.invoices
 .where('createdAt')
 .between(start, end, true, true)
 .and((inv: any) => (activeBranch?.isMaster || inv.branchId === activeBranchId) && !inv.deletedAt)
 .toArray();

 // Fetch Expenses
 const expenses = await db.expenses
 .where('date')
 .between(start, end, true, true)
 .and((exp: any) => (activeBranch?.isMaster || exp.branchId === activeBranchId) && !exp.deletedAt)
 .toArray();

 // Fetch ALL Items to get current purchase price (COGS Proxy)
 const allItemsQuery = activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId);
 const allItems = await (allItemsQuery as any).filter((i: any) => !i.deletedAt).toArray();
 const itemCostMap = new Map<string, number>();
 allItems.forEach((item: any) => {
 if (item.id) itemCostMap.set(item.id, item.purchasePrice || 0);
 });

 // Calculate Totals
 let totalSales = 0;
 let totalCOGS = 0;

 invoices.forEach((inv: any) => {
 // Only count valid sales
 if (inv.status === 'cancelled') return;

 const isReturn = inv.type === 'return';
 const multiplier = isReturn ? -1 : 1;

 // Sales Sum (use grandTotal for revenue display)
 totalSales += (inv.grandTotal * multiplier);

 // COGS Calculation — prioritize line-item stored cost over current inventory price
 inv.items.forEach((item: any) => {
 const costPrice = item.purchasePrice !== undefined 
 ? item.purchasePrice 
 : (item.cost !== undefined ? item.cost : (itemCostMap.get(item.itemId) || 0));
 totalCOGS += (costPrice * item.quantity * multiplier);
 });
 });

 const totalExpenses = expenses.reduce((sum: any, exp: any) => sum + exp.amount, 0);

 // Gross Profit = Net Sales (excl. tax) - COGS
 // Using net sales (grandTotal - taxAmount) prevents tax from inflating profit figures
 const netSalesForProfit = invoices
 .filter((inv: any) => inv.status !== 'cancelled')
 .reduce((sum: number, inv: any) => {
 const multiplier = inv.type === 'return' ? -1 : 1;
 return sum + ((inv.grandTotal - (inv.taxAmount || 0)) * multiplier);
 }, 0);
 const grossProfit = netSalesForProfit - totalCOGS;

 // Net Profit = Gross Profit - Operating Expenses
 // Note: We deliberately exclude"Total Inventory Purchases"from expense here,
 // because that is Asset Acquisition, not Expense. The"Expense"happens via COGS when sold.
 const netProfit = grossProfit - totalExpenses;

 // Prepare Chart Data
 const days = eachDayOfInterval({ start, end });

 const salesByDate = days.map((day: any) => {
 const dayLabels = format(day, range === 'year' ? 'MMM' : 'dd MMM');
 const dayStart = startOfDay(day);
 const dayEnd = endOfDay(day);

 const dailySales = invoices
 .filter((inv: any) => inv.createdAt >= dayStart && inv.createdAt <= dayEnd && inv.status !== 'cancelled')
 .reduce((sum: any, inv: any) => {
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
 invoices.forEach((inv: any) => {
 if (inv.status === 'cancelled') return;
 const month = format(inv.createdAt, 'MMM yyyy');
 const amount = inv.type === 'return' ? -inv.grandTotal : inv.grandTotal;
 monthly[month] = (monthly[month] || 0) + amount;
 });
 const uniqueMonths = Array.from(new Set(days.map((d: any) => format(d, 'MMM yyyy'))));
 chartData = uniqueMonths.map((m: any) => ({ date: m, amount: monthly[m] || 0 }));
 }

 setData({
 totalSales,
 totalExpenses,
 grossProfit,
 netProfit,
 currentStockValue: allItems.reduce((sum: any, item: any) => sum + ((item.stock || 0) * (item.purchasePrice || 0)), 0),
 salesCount: invoices.filter((i: any) => i.status !== 'cancelled').length,
 salesByDate: chartData,
 loading: false
 });

 } catch (error) {
 console.error("Error fetching report data:", error);
 setData(prev => ({ ...prev, loading: false }));
 }
 };

 fetchData();
 }, [range, customStartStr, customEndStr, activeBranchId, activeBranch?.isMaster]);

 return data;
};

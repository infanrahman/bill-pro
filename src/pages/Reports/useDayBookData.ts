import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
import { startOfDay, endOfDay } from 'date-fns';

export interface DayBookItem {
 id: string;
 originalId?: string;
 date: Date;
 type: 'sale' | 'purchase' | 'expense' | 'receipt' | 'payment' | 'return' | 'contra' | 'other';
 description: string;
 moneyIn: number;
 moneyOut: number;
 mode: string;
 category?: string;
}

export interface DayBookSummary {
 totalIn: number;
 totalOut: number;
 balance: number;
 dailyProfit: number; // New Field
 cashInHand: number;
}

export const useDayBookData = (range: 'today' | 'custom', customStartStr?: string, customEndStr?: string) => {
 const { activeBranchId, activeBranch } = useAuth();
 const [transactions, setTransactions] = useState<DayBookItem[]>([]);
 const [summary, setSummary] = useState<DayBookSummary>({ totalIn: 0, totalOut: 0, balance: 0, dailyProfit: 0, cashInHand: 0 });
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchData = async () => {
 setLoading(true);
 try {
 let start: Date, end: Date;

 // Safely parse custom dates
 const safeCustomStartStr = customStartStr ? new Date(customStartStr) : undefined;
 const safeCustomEndStr = customEndStr ? new Date(customEndStr) : undefined;
 const safeCustomStart = safeCustomStartStr && !isNaN(safeCustomStartStr.getTime()) ? safeCustomStartStr : undefined;
 const safeCustomEnd = safeCustomEndStr && !isNaN(safeCustomEndStr.getTime()) ? safeCustomEndStr : undefined;

 if (range === 'custom') {
 if (safeCustomStart && safeCustomEnd) {
 start = safeCustomStart;
 end = safeCustomEnd;
 } else if (safeCustomStart) {
 start = safeCustomStart;
 end = endOfDay(safeCustomStart);
 } else if (safeCustomEnd) {
 start = startOfDay(safeCustomEnd);
 end = safeCustomEnd;
 } else {
 start = startOfDay(new Date());
 end = endOfDay(new Date());
 }
 } else {
 start = startOfDay(new Date());
 end = endOfDay(new Date());
 }

 // Fetch Items for Cost Calculation
 const allItemsQuery = activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId);
 const allItems = await (allItemsQuery as any).filter((i: any) => !i.deletedAt).toArray();
 const itemCostMap = new Map<string, number>();
 allItems.forEach((item: any) => {
 if (item.id) itemCostMap.set(item.id, item.purchasePrice || 0);
 });

 const dayBookItems: DayBookItem[] = [];
 let dailyGrossProfit = 0;
 let dailyExpenses = 0;

 // 1. Invoices
 const invoices = await db.invoices
 .where('createdAt')
 .between(start, end, true, true)
 .and((inv: any) => (activeBranch?.isMaster || inv.branchId === activeBranchId) && !inv.deletedAt)
 .toArray();

 invoices.forEach((inv: any) => {
 if (inv.status === 'cancelled') return;

 const isReturn = inv.type === 'return';
 const multiplier = isReturn ? -1 : 1;

 // Profit Calculation
 let invoiceCOGS = 0;
 inv.items.forEach((item: any) => {
 // Priority: Line-level stored cost, inventory current cost
 const costPrice = item.purchasePrice !== undefined 
 ? item.purchasePrice 
 : (item.cost !== undefined ? item.cost : (itemCostMap.get(item.itemId) || 0));
 invoiceCOGS += (costPrice * item.quantity);
 });

 // Sales Revenue = GrandTotal - TaxAmount (Net Sales)
 // Priority: 1. Stored netAmount 2. Calculated fallback
 const saleRevenue = inv.netAmount !== undefined ? inv.netAmount : (inv.grandTotal - (inv.taxAmount || 0));

 const invoiceProfit = (saleRevenue - invoiceCOGS) * multiplier;
 dailyGrossProfit += invoiceProfit;

 // Money Flow
 if (inv.type === 'return') {
 if (inv.paidAmount > 0) {
 dayBookItems.push({
 id:`inv-${inv.id}`,
 originalId: inv.id,
 date: inv.createdAt,
 type: 'return',
 description:`Return #${inv.invoiceNumber} - ${inv.customerName}`,
 moneyIn: 0,
 moneyOut: inv.paidAmount,
 mode: inv.paymentMode
 });
 }
 } else {
 if (inv.paidAmount > 0) {
 dayBookItems.push({
 id:`inv-${inv.id}`,
 originalId: inv.id,
 date: inv.createdAt,
 type: 'sale',
 description:`Sale #${inv.invoiceNumber} - ${inv.customerName}`,
 moneyIn: inv.paidAmount,
 moneyOut: 0,
 mode: inv.paymentMode
 });
 }
 }
 });

 // 2. Customer Payments
 const custPayments = await db.customerPayments
 .where('date')
 .between(start, end, true, true)
 .and((p: any) => (activeBranch?.isMaster || p.branchId === activeBranchId) && !p.deletedAt)
 .toArray();

 const customerIds = [...new Set(custPayments.map((p: any) => p.customerId))].filter(Boolean) as string[];
 const customers = await db.customers.where('id').anyOf(customerIds).and((c: any) => (activeBranch?.isMaster || c.branchId === activeBranchId) && !c.deletedAt).toArray();
 const custMap = new Map<string, string>(customers.map((c: any) => [c.id as string, c.name]));

 custPayments.forEach((pay: any) => {
 dayBookItems.push({
 id:`cpay-${pay.id}`,
 originalId: pay.id,
 date: pay.date,
 type: 'receipt',
 description:`Payment Received - ${custMap.get(pay.customerId) || 'Unknown'}`,
 moneyIn: pay.amount,
 moneyOut: 0,
 mode: pay.paymentMode
 });
 });

 // 3. Expenses
 const expenses = await db.expenses
 .where('date')
 .between(start, end, true, true)
 .and((exp: any) => (activeBranch?.isMaster || exp.branchId === activeBranchId) && !exp.deletedAt)
 .toArray();

 expenses.forEach((exp: any) => {
 dailyExpenses += exp.amount; // Add to expense total

 dayBookItems.push({
 id:`exp-${exp.id}`,
 originalId: exp.id,
 date: exp.date,
 type: 'expense',
 description:`${exp.category}: ${exp.description}`,
 moneyIn: 0,
 moneyOut: exp.amount,
 mode: 'cash'
 });
 });

 // 4. Purchases (Money Out - Asset Acquisition)
 const purchases = await db.purchases
 .where('date')
 .between(start, end, true, true)
 .and((pur: any) => (activeBranch?.isMaster || pur.branchId === activeBranchId) && !pur.deletedAt)
 .toArray();

 purchases.forEach((pur: any) => {
 if (pur.status === 'cancelled') return;
 if (pur.paidAmount && pur.paidAmount > 0) {
 dayBookItems.push({
 id:`pur-${pur.id}`,
 originalId: pur.id,
 date: pur.date,
 type: 'purchase',
 description:`Purchase #${pur.orderNumber} - ${pur.supplierName}`,
 moneyIn: 0,
 moneyOut: pur.paidAmount,
 mode: pur.paymentType || 'cash'
 });
 }
 });

 // 5. Purchase Payments
 if (db.purchasePayments) {
 const purPayments = await db.purchasePayments
 .where('date')
 .between(start, end, true, true)
 .and((p: any) => (activeBranch?.isMaster || p.branchId === activeBranchId) && !p.deletedAt)
 .toArray();

 const supplierIds = [...new Set(purPayments.map((p: any) => p.supplierId))].filter(Boolean) as string[];
 const suppliers = await db.suppliers.where('id').anyOf(supplierIds).and((s: any) => (activeBranch?.isMaster || s.branchId === activeBranchId) && !s.deletedAt).toArray();
 const supMap = new Map<string, string>(suppliers.map((s: any) => [s.id as string, s.name]));

 purPayments.forEach((pay: any) => {
 dayBookItems.push({
 id:`ppay-${pay.id}`,
 originalId: pay.id,
 date: pay.date,
 type: 'payment',
 description:`Supplier Payment - ${supMap.get(pay.supplierId) || 'Unknown'}`,
 moneyIn: 0,
 moneyOut: pay.amount,
 mode: pay.paymentMode
 });
 });
 }

 // 6. Cash Entries
 if (db.cashEntries) {
 const cashEntries = await db.cashEntries
 .where('date')
 .between(start, end, true, true)
 .and((e: any) => (activeBranch?.isMaster || e.branchId === activeBranchId) && !e.deletedAt)
 .toArray();

 cashEntries.forEach((entry: any) => {
 // Do not add Cash Book out to dailyExpenses, as they could be bank deposits or personal drawings.
 // Actual expenses are already counted from db.expenses.

 dayBookItems.push({
 id:`cash-${entry.id}`,
 originalId: entry.id,
 date: entry.date,
 type: entry.type === 'in' ? 'receipt' : 'expense',
 description:`Cash Entry: ${entry.category} - ${entry.description}`,
 moneyIn: entry.type === 'in' ? entry.amount : 0,
 moneyOut: entry.type === 'out' ? entry.amount : 0,
 mode: 'cash'
 });
 });
 }

 dayBookItems.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

 const totalIn = dayBookItems.reduce((sum: any, item: any) => sum + item.moneyIn, 0);
 const totalOut = dayBookItems.reduce((sum: any, item: any) => sum + item.moneyOut, 0);

 // Net Profit = Gross Profit (Sales - COGS) - Operating Expenses
 const dailyProfitSummaryValue = dailyGrossProfit - dailyExpenses;

 setTransactions(dayBookItems);
 setSummary({
 totalIn,
 totalOut,
 balance: totalIn - totalOut,
 dailyProfit: dailyProfitSummaryValue,
 cashInHand: 0
 });

 } catch (error) {
 console.error("Error fetching DayBook data:", error);
 } finally {
 setLoading(false);
 }
 };

 fetchData();
 }, [range, customStartStr, customEndStr, activeBranchId, activeBranch?.isMaster]);

 return { transactions, summary, loading };
};

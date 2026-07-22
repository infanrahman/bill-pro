import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
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

export const useVatReturnData = (period: VatPeriod, customStartStr?: string, customEndStr?: string) => {
 const { activeBranchId, activeBranch } = useAuth();
 const [data, setData] = useState<VatReturnData | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchData = async () => {
 setLoading(true);
 try {
 const now = new Date();
 let start: Date = startOfMonth(now);
 let end: Date = endOfMonth(now);

 const safeCustomStartStr = customStartStr ? new Date(customStartStr) : undefined;
 const safeCustomEndStr = customEndStr ? new Date(customEndStr) : undefined;

 const safeCustomStart = safeCustomStartStr && !isNaN(safeCustomStartStr.getTime()) ? safeCustomStartStr : undefined;
 const safeCustomEnd = safeCustomEndStr && !isNaN(safeCustomEndStr.getTime()) ? safeCustomEndStr : undefined;

 if (period === 'custom') {
 if (safeCustomStart && safeCustomEnd) {
 if (safeCustomStart > safeCustomEnd) {
 start = safeCustomEnd;
 end = safeCustomStart;
 } else {
 start = safeCustomStart;
 end = safeCustomEnd;
 }
 } else if (safeCustomStart) {
 start = safeCustomStart;
 end = endOfDay(safeCustomStart);
 } else if (safeCustomEnd) {
 start = startOfDay(safeCustomEnd);
 end = safeCustomEnd;
 }
 } else {
 switch (period) {
 case 'daily': start = startOfDay(now); end = endOfDay(now); break;
 case 'weekly': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); break;
 case 'monthly': start = startOfMonth(now); end = endOfMonth(now); break;
 case 'yearly': start = startOfYear(now); end = endOfYear(now); break;
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
 // RULE: Only include invoices that have taxed items (taxRate > 0)
 // RULE: Use the invoice grandTotal as the"amount", not per-item net
 const invoices = await db.invoices
 .where('createdAt').between(start, end, true, true)
 .and((inv: any) => (activeBranch?.isMaster || inv.branchId === activeBranchId) && inv.status !== 'cancelled' && inv.status !== 'draft' && !inv.deletedAt)
 .toArray();

 for (const inv of invoices) {
 const isReturn = inv.type === 'return';

 // Check if this invoice has ANY taxed items
 const hasTaxedItems = inv.items.some((item: any) => {
 const rate = item.taxRate !== undefined ? item.taxRate : (inv.taxRate || 0);
 return rate > 0;
 });

 if (hasTaxedItems) {
 // Taxed Invoice → Standard Rated
 // Use grandTotal as the amount and taxAmount for VAT
 const invoiceTotal = inv.grandTotal || 0;
 const invoiceVat = inv.taxAmount || 0;
 const netAmount = Math.round((invoiceTotal - invoiceVat) * 100) / 100;

 if (isReturn) {
 sales.returnStandard.amount += netAmount;
 sales.returnStandard.vat += Math.round(invoiceVat * 100) / 100;
 } else {
 sales.standard.amount += netAmount;
 sales.standard.vat += Math.round(invoiceVat * 100) / 100;
 }
 } else {
 // Zero-rated invoice (no tax on any item)
 const invoiceTotal = inv.grandTotal || 0;
 if (isReturn) {
 sales.returnZero.amount += invoiceTotal;
 } else {
 sales.zero.amount += invoiceTotal;
 }
 }
 }

 // 2. Process Purchases
 // RULE: Only include purchases where items have taxType === 'inclusive'
 // RULE: Skip items/purchases with taxType === 'exclusive' (no input VAT to claim)
 // RULE: Use the purchase bill totalAmount, not per-item cost
 const purchaseRecs = await db.purchases
 .where('date').between(start, end, true, true)
 .and((pur: any) => (activeBranch?.isMaster || pur.branchId === activeBranchId) && pur.status !== 'cancelled' && !pur.deletedAt)
 .toArray();

 for (const pur of purchaseRecs) {
 if (pur.type === 'order') continue; // Exclude Orders
 const isReturn = pur.type === 'return';

 // Check if purchase has inclusive-tax items 
 // (only inclusive items qualify for input VAT)
 const hasInclusiveItems = pur.items.some((item: any) => {
 const type = item.taxType || 'exclusive';
 const rate = item.taxRate !== undefined ? item.taxRate : 0;
 return type === 'inclusive' && rate > 0;
 });

 if (hasInclusiveItems) {
 // Use the total purchase bill amount
 const purchaseTotal = pur.totalAmount || 0;
 const purchaseVat = pur.taxAmount || 0;
 const netAmount = Math.round((purchaseTotal - purchaseVat) * 100) / 100;

 if (isReturn) {
 purchases.returnStandard.amount += netAmount;
 purchases.returnStandard.vat += Math.round(purchaseVat * 100) / 100;
 } else {
 purchases.standard.amount += netAmount;
 purchases.standard.vat += Math.round(purchaseVat * 100) / 100;
 }
 } else {
 // All items are exclusive or zero-rated → no input VAT claimable
 // Still record as zero-rated purchase for reporting completeness
 const purchaseTotal = pur.totalAmount || 0;
 if (isReturn) {
 purchases.returnZero.amount += purchaseTotal;
 } else {
 purchases.zero.amount += purchaseTotal;
 }
 }
 }

 // 3. Calculate Nets
 // Net Sales = (Std + Zero) - (RetStd + RetZero)
 // Net VAT = (Std.Vat) - (RetStd.Vat) <-- Zero has noVAT

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
 }, [period, customStartStr, customEndStr, activeBranchId, activeBranch?.isMaster]);

 return { data, loading };
};

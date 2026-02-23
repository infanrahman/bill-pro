import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { startOfDay, endOfDay } from 'date-fns';

export interface DayBookItem {
    id: string;
    originalId?: number;
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

export const useDayBookData = (selectedDate: Date) => {
    const [transactions, setTransactions] = useState<DayBookItem[]>([]);
    const [summary, setSummary] = useState<DayBookSummary>({ totalIn: 0, totalOut: 0, balance: 0, dailyProfit: 0, cashInHand: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const start = startOfDay(selectedDate);
                const end = endOfDay(selectedDate);

                // Fetch Items for Cost Calculation
                const allItems = await db.items.toArray();
                const itemCostMap = new Map<number, number>();
                allItems.forEach(item => {
                    if (item.id) itemCostMap.set(item.id, item.purchasePrice || 0);
                });

                const dayBookItems: DayBookItem[] = [];
                let dailyGrossProfit = 0;
                let dailyExpenses = 0;

                // 1. Invoices
                const invoices = await db.invoices
                    .where('createdAt')
                    .between(start, end, true, true)
                    .toArray();

                invoices.forEach(inv => {
                    if (inv.status === 'cancelled') return;

                    const isReturn = inv.type === 'return';
                    const multiplier = isReturn ? -1 : 1;

                    // Profit Calculation
                    // We calculate profit regardless of payment status (Accrual basis for profit, typically)
                    // If user wants Cash Basis profit, we'd only count paid invoices, but usually 'Daily Profit' implies 'Sales Profit Today'
                    let invoiceCOGS = 0;
                    inv.items.forEach(item => {
                        const costPrice = itemCostMap.get(item.itemId) || 0;
                        invoiceCOGS += (costPrice * item.quantity);
                    });

                    // Sales amount minus COGS
                    // Note: grandTotal might include Tax. Pure profit should be Net Sales - COGS.
                    // But for simplicity if we don't have separate Net Sales easily available without tax calc reverse:
                    // If taxAmount is known, use subTotal? 
                    // Let's use (inv.subTotal || inv.grandTotal) - invoiceCOGS?
                    // Safe bet: inv.grandTotal - taxAmount - invoiceCOGS.
                    const saleRevenue = inv.subTotal || inv.grandTotal; // subTotal is usually Ex Tax

                    const invoiceProfit = (saleRevenue - invoiceCOGS) * multiplier;
                    dailyGrossProfit += invoiceProfit;

                    // Money Flow
                    if (inv.type === 'return') {
                        if (inv.paidAmount > 0) {
                            dayBookItems.push({
                                id: `inv-${inv.id}`,
                                originalId: inv.id,
                                date: inv.createdAt,
                                type: 'return',
                                description: `Return #${inv.invoiceNumber} - ${inv.customerName}`,
                                moneyIn: 0,
                                moneyOut: inv.paidAmount,
                                mode: inv.paymentMode
                            });
                        }
                    } else {
                        if (inv.paidAmount > 0) {
                            dayBookItems.push({
                                id: `inv-${inv.id}`,
                                originalId: inv.id,
                                date: inv.createdAt,
                                type: 'sale',
                                description: `Sale #${inv.invoiceNumber} - ${inv.customerName}`,
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
                    .toArray();

                const customerIds = [...new Set(custPayments.map(p => p.customerId))];
                const customers = await db.customers.where('id').anyOf(customerIds).toArray();
                const custMap = new Map(customers.map(c => [c.id, c.name]));

                custPayments.forEach(pay => {
                    dayBookItems.push({
                        id: `cpay-${pay.id}`,
                        originalId: pay.id,
                        date: pay.date,
                        type: 'receipt',
                        description: `Payment Received - ${custMap.get(pay.customerId) || 'Unknown'}`,
                        moneyIn: pay.amount,
                        moneyOut: 0,
                        mode: pay.paymentMode
                    });
                });

                // 3. Expenses
                const expenses = await db.expenses
                    .where('date')
                    .between(start, end, true, true)
                    .toArray();

                expenses.forEach(exp => {
                    dailyExpenses += exp.amount; // Add to expense total

                    dayBookItems.push({
                        id: `exp-${exp.id}`,
                        originalId: exp.id,
                        date: exp.date,
                        type: 'expense',
                        description: `${exp.category}: ${exp.description}`,
                        moneyIn: 0,
                        moneyOut: exp.amount,
                        mode: 'cash'
                    });
                });

                // 4. Purchases (Money Out - Asset Acquisition, not Expense for Profit)
                const purchases = await db.purchases
                    .where('date')
                    .between(start, end, true, true)
                    .toArray();

                purchases.forEach(pur => {
                    if (pur.status === 'cancelled') return;
                    if (pur.paidAmount && pur.paidAmount > 0) {
                        dayBookItems.push({
                            id: `pur-${pur.id}`,
                            originalId: pur.id,
                            date: pur.date,
                            type: 'purchase',
                            description: `Purchase #${pur.orderNumber} - ${pur.supplierName}`,
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
                        .toArray();

                    const supplierIds = [...new Set(purPayments.map(p => p.supplierId))];
                    const suppliers = await db.suppliers.where('id').anyOf(supplierIds).toArray();
                    const supMap = new Map(suppliers.map(s => [s.id, s.name]));

                    purPayments.forEach(pay => {
                        dayBookItems.push({
                            id: `ppay-${pay.id}`,
                            originalId: pay.id,
                            date: pay.date,
                            type: 'payment',
                            description: `Supplier Payment - ${supMap.get(pay.supplierId) || 'Unknown'}`,
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
                        .toArray();

                    cashEntries.forEach(entry => {
                        // Cash entries 'out' might be expenses? 
                        // For now, let's assume they are NOT P&L expenses unless in Expenses table, 
                        // OR we treat 'out' as generic expense if category suggests?
                        // To be safe, let's NOT add to profit/loss unless user explicitly uses Expenses module.

                        dayBookItems.push({
                            id: `cash-${entry.id}`,
                            originalId: entry.id,
                            date: entry.date,
                            type: entry.type === 'in' ? 'receipt' : 'expense',
                            description: `Cash Entry: ${entry.category} - ${entry.description}`,
                            moneyIn: entry.type === 'in' ? entry.amount : 0,
                            moneyOut: entry.type === 'out' ? entry.amount : 0,
                            mode: 'cash'
                        });
                    });
                }

                dayBookItems.sort((a, b) => b.date.getTime() - a.date.getTime());

                const totalIn = dayBookItems.reduce((sum, item) => sum + item.moneyIn, 0);
                const totalOut = dayBookItems.reduce((sum, item) => sum + item.moneyOut, 0);

                // Net Profit = Gross Profit (Sales - COGS) - Operating Expenses
                const dailyProfit = dailyGrossProfit - dailyExpenses;

                setTransactions(dayBookItems);
                setSummary({
                    totalIn,
                    totalOut,
                    balance: totalIn - totalOut,
                    dailyProfit,
                    cashInHand: 0
                });

            } catch (error) {
                console.error("Error fetching DayBook data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedDate]);

    return { transactions, summary, loading };
};

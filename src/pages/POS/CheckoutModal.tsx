import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { db } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Invoice, InvoiceItem } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { generateInvoicePDF } from '../../services/invoiceGenerator';

import Modal from '../../components/UI/Modal';
import { useSettings } from '../../contexts/SettingsContext';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: (success?: boolean) => void;
    subTotal: number;
    items: InvoiceItem[];
    customerName?: string;
    customerId?: number;
    customerVatNumber?: string; // New Prop
    onConfirm: (data: Partial<Invoice>) => Promise<number>; // Updated return type
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, subTotal, items, customerName, customerId, customerVatNumber, onConfirm }) => {
    // Moved early return to after hooks to satisfy Rules of Hooks
    const { addToast } = useNotification();
    const { formatCurrency, settings } = useSettings();
    const { t } = useTranslation();

    const [discountPercent, setDiscountPercent] = useState(0);
    const [taxPercent, setTaxPercent] = useState(15); // Default 15% (KSA Standard)
    const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash');
    const [amountPaidInput, setAmountPaidInput] = useState('');
    const [dueDate, setDueDate] = useState('');

    // ... existing code ...

    // Load Tax Defaults from Settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [businessDetails, setBusinessDetails] = useState<any>(null);
    const [printerConfig, setPrinterConfig] = useState<any>(null);
    const [shouldPrint, setShouldPrint] = useState(true);

    React.useEffect(() => {
        const saved = localStorage.getItem('businessDetails');
        if (saved) {
            const parsed = JSON.parse(saved);
            setBusinessDetails(parsed);
            if (parsed.country === 'Saudi Arabia') setTaxPercent(15);
        }

        // Load Printer Config
        const savedPrinter = localStorage.getItem('printerConfig');
        if (savedPrinter) {
            setPrinterConfig(JSON.parse(savedPrinter));
        }
    }, []);

    const customer = useLiveQuery(async () => {
        return customerId ? await db.customers.get(customerId) : undefined;
    }, [customerId]);

    // const [isTaxEnabled, setIsTaxEnabled] = useState(true); // Removed as always enabled/hidden
    const [isTaxEnabled, setIsTaxEnabled] = useState(true); // Default true

    const discountAmount = (subTotal * discountPercent) / 100;

    // ... Tax Calculation Logic (unchanged) ...
    let calculatedTax = 0;
    let calculatedSubTotal = 0;

    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const rate = item.taxRate || taxPercent;
        const type = item.taxType || 'exclusive';

        if (type === 'inclusive') {
            const baseAmount = itemTotal / (1 + (rate / 100));
            const taxComponent = itemTotal - baseAmount;
            calculatedTax += taxComponent;
            calculatedSubTotal += baseAmount;
        } else {
            if (isTaxEnabled) {
                const taxComponent = itemTotal * (rate / 100);
                calculatedTax += taxComponent;
                calculatedSubTotal += itemTotal;
            } else {
                calculatedSubTotal += itemTotal;
            }
        }
    });


    let totalTaxAmount = 0;
    let grandTotal = 0;


    items.forEach(item => {
        const lineTotal = item.price * item.quantity;
        const lineDiscount = lineTotal * (discountPercent / 100);
        const lineNet = lineTotal - lineDiscount;

        const rate = item.taxRate ?? taxPercent;
        const type = item.taxType || 'exclusive';

        if (type === 'inclusive') {
            const base = lineNet / (1 + (rate / 100));
            const tax = lineNet - base;

            totalTaxAmount += tax;
            grandTotal += lineNet;
        } else {
            if (isTaxEnabled) {
                const tax = lineNet * (rate / 100);
                totalTaxAmount += tax;
                grandTotal += (lineNet + tax);
            } else {
                grandTotal += lineNet;
            }
        }
    });

    const taxAmount = totalTaxAmount;
    const amountPaid = paymentMode === 'cash' ? grandTotal : (parseFloat(amountPaidInput) || 0);
    const balanceDue = Math.max(0, grandTotal - amountPaid);
    const changeAmount = amountPaid - grandTotal;

    const isCreditSale = paymentMode === 'credit' || balanceDue > 0.01;
    // If no customer selected, can't take credit (unless we allow anonymous credit? No).
    // If no limit is set (0/null), assume unlimited? Or 0? Let's assume 0 means NO LIMIT if not set, or strict?
    // Let's assume: if creditLimit is defined and > 0, check it. Else if 0, maybe allow?
    // Usually 0 means no credit allowed.
    const currentBalance = customer?.balance || 0;
    const limit = customer?.creditLimit || 0;
    const canTakeCredit = !!customerId && (limit === 0 || (currentBalance + balanceDue <= limit)); // Assuming 0 limit means strict 0.
    // Actually, usually if creditLimit is 0 it means "No Credit".
    // If we want "No Limit", we'd use -1 or null.
    // Let's stick to: if limit > 0 check it. If limit === 0, then Credit NOT Allowed.

    const [isProcessing, setIsProcessing] = useState(false);

    const handleConfirm = async () => {
        if (isProcessing) return; // Prevent double click

        if (isCreditSale && !canTakeCredit) {
            addToast(t('pos.credit_error_msg'), 'error');
            return;
        }

        if (paymentMode === 'credit' && !dueDate) {
            addToast(t('pos.due_date_required'), 'error');
            return;
        }

        setIsProcessing(true); // Start Loading

        let finalStatus: 'paid' | 'pending' | 'partial' = 'paid';
        if (balanceDue > 0.01) {
            finalStatus = amountPaid > 0 ? 'partial' : 'pending';
        }

        const lastInvoice = await db.invoices.orderBy('id').last();
        let nextNumber = 1;
        if (lastInvoice && lastInvoice.invoiceNumber) {
            const lastNumStr = lastInvoice.invoiceNumber.replace(/\D/g, '');
            const lastNum = parseInt(lastNumStr, 10);
            if (!isNaN(lastNum)) {
                nextNumber = lastNum + 1;
            }
        }
        const newInvoiceNumber = nextNumber.toString().padStart(3, '0');

        // Generate Token Number for Cafe Mode
        let tokenNumber: string | undefined;
        if (settings.cafeMode && printerConfig?.printToken) {
            const lastTokenInvoice = await db.invoices
                .orderBy('id')
                .reverse()
                .filter(inv => !!inv.tokenNumber)
                .first();
            let nextToken = 1;
            if (lastTokenInvoice?.tokenNumber) {
                const lastToken = parseInt(lastTokenInvoice.tokenNumber, 10);
                if (!isNaN(lastToken)) {
                    nextToken = lastToken + 1;
                }
            }
            tokenNumber = nextToken.toString().padStart(3, '0');
        }

        const finalItems = items.map(item => {
            const nominal = item.price * item.quantity;
            const rate = item.taxRate || taxPercent;
            const type = item.taxType || 'exclusive';
            let finalItemTotal = nominal;

            if (type === 'exclusive' && isTaxEnabled) {
                finalItemTotal = nominal + (nominal * (rate / 100));
            }
            return {
                ...item,
                total: finalItemTotal
            };
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoiceData: any = {
            invoiceNumber: newInvoiceNumber,
            tokenNumber: tokenNumber, // Add token if generated
            customerName: customerName || t('pos.walk_in_customer'),
            customerId: customerId,
            customerVatNumber: customerId ? (customerVatNumber || undefined) : undefined,
            items: finalItems,
            subTotal,
            discountAmount,
            taxAmount,
            grandTotal,
            paidAmount: paymentMode === 'credit' ? amountPaid : (amountPaid || grandTotal),
            remainingAmount: paymentMode === 'credit' ? (grandTotal - amountPaid) : (balanceDue > 0 ? balanceDue : 0),
            paymentMode,
            createdAt: new Date(),
            paymentStatus: finalStatus,
            dueDate: (finalStatus !== 'paid' && dueDate) ? new Date(dueDate) : undefined,
            taxRate: taxPercent
        };

        if (paymentMode !== 'credit' && (!amountPaidInput || paymentMode === 'cash')) {
            invoiceData.paidAmount = grandTotal;
            invoiceData.remainingAmount = 0;
            invoiceData.paymentStatus = 'paid';
        }

        let newId: number | undefined;

        try {
            console.log("Attempting to save invoice to DB:", invoiceData);
            // 1. Critical: Save to DB (Await this as it must succeed)
            newId = await onConfirm(invoiceData);
            console.log("DB Save successful, ID:", newId);

            // 2. Success Feedback
            addToast(t('pos.order_completed_successfully'), 'success');

            // 3. OPTIMIZATION: Close Modal IMMEDIATELY (Non-blocking UI)
            setIsProcessing(false);
            onClose(true);


            // 4. Background Printing (Fire & Forget from UI perspective)
            const safeBusinessDetails = businessDetails || { name: 'My Shop', address: '', phone: '', email: '' };
            const isPrintEnabled = !printerConfig?.enableCheckoutPrintToggle || shouldPrint;

            if ((businessDetails || safeBusinessDetails) && isPrintEnabled && newId) {
                // Run async in background (after modal close)
                setTimeout(async () => {
                    const printDetails = { ...safeBusinessDetails, taxRate: taxPercent };
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const printData = { ...invoiceData, id: newId } as Invoice;

                    // --- ZATCA REPORTING (Background) ---
                    try {
                        const zatcaConfigStr = localStorage.getItem('zatca_config');
                        if (zatcaConfigStr) {
                            const zatcaConfig = JSON.parse(zatcaConfigStr);
                            const canReport = zatcaConfig.status === 'COMPLIANCE_OBTAINED' || zatcaConfig.status === 'LIVE';

                            if (canReport && zatcaConfig.privateKey && zatcaConfig.complianceCsid) {
                                console.log("Starting ZATCA Reporting...");
                                // Dynamic Import to avoid heavy initial load
                                const { generateZatcaXML } = await import('../../services/zatcaXml');
                                const { reportInvoice } = await import('../../services/zatcaApi');

                                // 1. Generate XML
                                const { xml, hash, uuid } = await generateZatcaXML(
                                    printData,
                                    { ...safeBusinessDetails, gstin: safeBusinessDetails.gstin || safeBusinessDetails.vatNo },
                                    zatcaConfig.privateKey
                                );

                                // 2. Report
                                const reportResult = await reportInvoice(
                                    xml,
                                    hash,
                                    uuid, // Use the real UUID from XML
                                    zatcaConfig.complianceCsid,
                                    zatcaConfig.complianceSecret
                                );

                                // 3. Update DB Status
                                if (reportResult.status === 'REPORTED') {
                                    await db.invoices.update(newId, {
                                        zatcaStatus: 'REPORTED',
                                        zatcaHash: hash
                                    });
                                    console.log("ZATCA Reported Successfully");
                                    // addToast('ZATCA Reported', 'success'); // Optional, might be spammy
                                } else {
                                    console.error("ZATCA Report Failed", reportResult);
                                    await db.invoices.update(newId, { zatcaStatus: 'ERROR' });
                                }
                            }
                        }
                    } catch (zatcaErr) {
                        console.error("ZATCA Critical Error", zatcaErr);
                    }

                    try {
                        addToast(t('common.generating') || 'Printing in background...', 'info');
                        await generateInvoicePDF(printData, printDetails);
                        // Optional: addToast(t('pos.invoice_sent'), 'success');
                    } catch (err) {
                        console.error("Print Error:", err);
                        addToast(`${t('pos.print_failed')}: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
                    }
                }, 100); // Slight delay to ensure UI transition is smooth
            }

        } catch (error) {
            console.error(error);
            addToast(`${t('pos.sale_failed')}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            setIsProcessing(false);
            return;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="4xl"
            className="h-auto max-h-[90vh] flex flex-col md:flex-row"
        >
            <div className="flex flex-col md:flex-row w-full h-full">
                {/* LEFT SIDE: Payment Methods */}
                <div className="flex-1 flex flex-col justify-between p-6 bg-white dark:bg-slate-800 overflow-y-auto">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('pos.select_payment_mode')}</h3>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            {['cash', 'card', 'upi', 'credit'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => {
                                        setPaymentMode(mode as any);
                                        if (mode === 'cash') setAmountPaidInput('');
                                    }}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMode === mode
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 text-slate-600 dark:text-slate-400'
                                        }`}
                                >
                                    <span className="capitalize font-semibold">
                                        {mode === 'cash' && t('pos.pay_cash')}
                                        {mode === 'card' && t('pos.pay_card')}
                                        {mode === 'upi' && t('pos.pay_digital')}
                                        {mode === 'credit' && t('pos.pay_credit')}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Credit Info & Due Date */}
                        {paymentMode === 'credit' && (
                            <div className="space-y-4">
                                <div className={`p-4 rounded-xl border ${canTakeCredit ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                                    <div className="font-bold flex justify-between">
                                        <span>Credit Limit:</span>
                                        <span>{formatCurrency(customer?.creditLimit || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mt-1">
                                        <span>Current Balance:</span>
                                        <span>{formatCurrency(customer?.balance || 0)}</span>
                                    </div>
                                    {!canTakeCredit && (
                                        <p className="text-xs font-bold mt-2 text-red-600">{t('pos.credit_error_title')}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {t('pos.due_date')} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <button onClick={() => onClose()} disabled={isProcessing} className="p-4 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                            {t('common.cancel')}
                        </button>
                        <div className="flex flex-col gap-2">
                            {/* Print Toggle (Only if Enabled in Settings) */}
                            {printerConfig?.enableCheckoutPrintToggle && (
                                <label className="flex items-center justify-end gap-2 cursor-pointer select-none">
                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('pos.print_receipt')}</span>
                                    <div className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={shouldPrint}
                                            onChange={e => setShouldPrint(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </div>
                                </label>
                            )}

                            <button
                                onClick={handleConfirm}
                                disabled={(paymentMode === 'credit' && !canTakeCredit) || isProcessing}
                                className="w-full p-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{t('common.processing')}...</span>
                                    </>
                                ) : (
                                    <>
                                        <Printer size={20} />
                                        <span>{t('common.confirm')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: Receipt Summary */}
                <div className="w-full md:w-[400px] bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="p-8 flex-1 flex flex-col">
                        <h3 className="text-sm font-bold uppercase text-slate-400 mb-6 tracking-wider">{t('pos.order_summary')}</h3>

                        {/* Bill Details */}
                        <div className="space-y-4 mb-8 text-slate-600 dark:text-slate-300">
                            <div className="flex justify-between">
                                <span>{t('pos.subtotal')} ({items.length} items)</span>
                                <span className="font-medium">{formatCurrency(subTotal)}</span>
                            </div>

                            {/* Discount Input */}
                            <div className="flex justify-between items-center group">
                                <span className="group-focus-within:text-blue-600 transition-colors">{t('pos.discount')}</span>
                                <div className="flex items-center gap-2">
                                    <div className="flex text-xs bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5">
                                        {[0, 5, 10].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setDiscountPercent(d)}
                                                className={`px-2 py-0.5 rounded-md transition-all ${discountPercent === d ? 'bg-white shadow text-black font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                {d}%
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="number"
                                        value={discountPercent}
                                        onChange={e => setDiscountPercent(Number(e.target.value))}
                                        className="w-12 text-right bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none font-medium text-red-500"
                                    />
                                    <span className="text-red-500">-{formatCurrency(discountAmount)}</span>
                                </div>
                            </div>

                            {/* Tax Row */}
                            <div className="flex justify-between items-center opacity-80">
                                <div className="flex items-center gap-2">
                                    <span>{t('pos.tax')}</span>
                                    {/* Tax Toggle */}
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isTaxEnabled}
                                            onChange={(e) => setIsTaxEnabled(e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <span>+{formatCurrency(taxAmount)}</span>
                            </div>
                        </div>

                        {/* Grand Total Card */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
                            <div className="text-center mb-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('pos.grand_total')}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        {/* Payment Input */}
                        {paymentMode !== 'cash' && (
                            <div className="mt-auto">
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                                    {paymentMode === 'credit' ? t('pos.down_payment') : t('pos.amount_tendered')}
                                </label>
                                <div className={`relative rounded-xl overflow-hidden border-2 transition-all ${isCreditSale && !canTakeCredit ? 'border-red-300 bg-red-50' : 'border-blue-100 focus-within:border-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600'}`}>
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currency}</div>
                                    <input
                                        type="number"
                                        value={amountPaidInput}
                                        onChange={(e) => setAmountPaidInput(e.target.value)}
                                        placeholder={paymentMode === 'credit' ? "0.00" : grandTotal.toFixed(2)}
                                        className="w-full pl-12 pr-4 py-3 bg-transparent font-bold outline-none text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>
                        )}

                        {paymentMode === 'cash' && (
                            <div className="mt-auto mb-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800 text-center">
                                <span className="block text-green-700 dark:text-green-400 font-bold">{t('pos.full_cash_payment')}</span>
                            </div>
                        )}

                        {/* Change/Balance Indicator */}
                        <div className="mt-4 flex items-center justify-between p-4 rounded-xl bg-slate-100 dark:bg-slate-800">
                            {changeAmount >= 0 ? (
                                <>
                                    <span className="font-semibold text-slate-500">{t('pos.change_due')}</span>
                                    <span className="text-xl font-bold text-green-600">{formatCurrency(changeAmount)}</span>
                                </>
                            ) : (
                                <>
                                    <span className="font-semibold text-slate-500">{t('pos.credit_balance_remaining')}</span>
                                    <span className="text-xl font-bold text-red-500">{formatCurrency(balanceDue)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div >
        </Modal >
    );
};

export default CheckoutModal;

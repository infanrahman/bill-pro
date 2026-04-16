import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, Smartphone, Clock, SplitSquareHorizontal, ChevronRight } from 'lucide-react';
import { db } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Invoice, InvoiceItem } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { generateInvoicePDF, generateKitchenTicketPDF } from '../../services/invoiceGenerator';

import Modal from '../../components/UI/Modal';
import { useSettings } from '../../contexts/SettingsContext';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: (success?: boolean) => void;
    subTotal: number;
    items: InvoiceItem[];
    customerName?: string;
    customerId?: string;
    customerVatNumber?: string; // New Prop
    notes?: string;
    orderType?: 'dine_in' | 'parcel' | 'pickup' | 'delivery';
    onConfirm: (data: Partial<Invoice>) => Promise<string>; // Updated return type
    invoiceNumber?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, subTotal, items, customerName, customerId, customerVatNumber, notes, orderType, onConfirm, invoiceNumber }) => {
    // Moved early return to after hooks to satisfy Rules of Hooks
    const { addToast } = useNotification();
    const { formatCurrency, settings } = useSettings();
    const { t } = useTranslation();

    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState(0);
    const [taxPercent, setTaxPercent] = useState(15); // Default 15% (KSA Standard)
    const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'credit' | 'split'>('cash');
    const [amountPaidInput, setAmountPaidInput] = useState('');
    const [splitCashInput, setSplitCashInput] = useState('');
    const [splitCardInput, setSplitCardInput] = useState('');
    const [dueDate, setDueDate] = useState('');
    

    // ... existing code ...

    // Load Tax Defaults from Settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [businessDetails, setBusinessDetails] = useState<any>(null);
    const [printerConfig, setPrinterConfig] = useState<any>(null);
    const [shouldPrint, setShouldPrint] = useState(true);

    // Reset state when modal opens to ensure a clean transaction every time
    React.useEffect(() => {
        if (isOpen) {
            setPaymentMode('cash');
            setAmountPaidInput('');
            setSplitCashInput('');
            setSplitCardInput('');
            setDiscountValue(0);
            setDiscountType('percentage');
            setDueDate('');
            setIsProcessing(false);
        }
    }, [isOpen, t]);

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



    // --- ZATCA Standard Calculations ---
    const effectiveDiscountPercent = discountType === 'percentage' 
        ? discountValue 
        : (subTotal > 0 ? (discountValue / subTotal) * 100 : 0);

    const discountAmount = discountType === 'percentage' 
        ? Math.round((subTotal * discountValue / 100) * 100) / 100
        : discountValue;

    let totalTaxAmount = 0;
    let totalGrandTotal = 0;
    let totalSubTotal = 0;

    const mappedItems = items.map((item: any) => {
        const lineTotal = Math.round((item.price * item.quantity) * 100) / 100;
        const lineDiscount = Math.round((lineTotal * (effectiveDiscountPercent / 100)) * 100) / 100;
        const lineNet = Math.round((lineTotal - lineDiscount) * 100) / 100;

        const rate = item.taxRate ?? taxPercent;
        const type = item.taxType || 'exclusive';

        let lineTax = 0;
        let lineFinal = 0;

        if (settings.applyTax) {
            if (type === 'inclusive') {
                const base = lineNet / (1 + (rate / 100));
                lineTax = Math.round((lineNet - base) * 100) / 100;
                lineFinal = lineNet;
            } else {
                lineTax = Math.round((lineNet * (rate / 100)) * 100) / 100;
                lineFinal = Math.round((lineNet + lineTax) * 100) / 100;
            }
        } else {
            lineTax = 0;
            lineFinal = lineNet;
        }

        totalSubTotal = Math.round((totalSubTotal + lineTotal) * 100) / 100;
        totalTaxAmount = Math.round((totalTaxAmount + lineTax) * 100) / 100;
        totalGrandTotal = Math.round((totalGrandTotal + lineFinal) * 100) / 100;

        return {
            ...item,
            taxRate: rate,
            taxType: type,
            taxAmount: lineTax,
            discountAmount: lineDiscount,
            netAmount: lineNet,
            total: lineFinal
        };
    });

    const taxAmount = totalTaxAmount;
    const grandTotal = totalGrandTotal;
    const subTotalSum = totalSubTotal; 
    
    let amountPaid = 0;
    if (paymentMode === 'split') {
        const cashValue = parseFloat(splitCashInput) || 0;
        const cardValue = parseFloat(splitCardInput) || 0;
        amountPaid = Math.round((cashValue + cardValue) * 100) / 100;
    } else if (paymentMode === 'credit') {
        amountPaid = Math.round((parseFloat(amountPaidInput) || 0) * 100) / 100;
    } else if (paymentMode === 'cash') {
        amountPaid = amountPaidInput ? Math.round((parseFloat(amountPaidInput) || 0) * 100) / 100 : grandTotal;
    } else {
        amountPaid = grandTotal;
    }

    const balanceDue = Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100);
    const changeAmount = Math.round(Math.max(0, amountPaid - grandTotal) * 100) / 100;

    const isCreditSale = paymentMode === 'credit' || balanceDue > 0.01;
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

        if (paymentMode === 'split') {
            const cardAmt = parseFloat(splitCardInput) || 0;
            const cashAmt = parseFloat(splitCashInput) || 0;
            if (cardAmt + cashAmt < grandTotal) {
                addToast(t('pos.insufficient_payment') || 'Split payment must cover the full amount', 'error');
                return;
            }
        }

        setIsProcessing(true); // Start Loading

        let finalStatus: 'paid' | 'pending' | 'partial' = 'paid';
        if (balanceDue > 0.01) {
            finalStatus = amountPaid > 0 ? 'partial' : 'pending';
        }

        // Use createdAt index (NOT id — UUIDs are not sequential!)
        const lastInvoice = await db.invoices.orderBy('createdAt').last();
        let nextNumber = 1;
        if (lastInvoice && lastInvoice.invoiceNumber) {
            // Extract only digits from the invoice number (handles "INV-003", "SO-123", "RET-5", etc.)
            const lastNumStr = lastInvoice.invoiceNumber.replace(/\D/g, '');
            const lastNum = parseInt(lastNumStr, 10);
            if (!isNaN(lastNum)) {
                nextNumber = lastNum + 1;
            }
        }
        const finalInvoiceNumber = invoiceNumber || nextNumber.toString().padStart(3, '0');

        // Generate Token Number for Cafe Mode (Daily Reset)
        let tokenNumber: string | undefined;
        const savedPrinterConfig = localStorage.getItem('printerConfig');
        const currentPrinterConfig = savedPrinterConfig ? JSON.parse(savedPrinterConfig) : printerConfig;

        if (settings.cafeMode && currentPrinterConfig?.printToken) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const lastTokenInvoice = await db.invoices
                .where('createdAt').above(startOfToday)
                .filter((inv: any) => !!inv.tokenNumber)
                .last();
            
            let nextToken = 1;
            if (lastTokenInvoice?.tokenNumber) {
                const lastToken = parseInt(lastTokenInvoice.tokenNumber, 10);
                if (!isNaN(lastToken)) {
                    nextToken = lastToken + 1;
                }
            }
            tokenNumber = nextToken.toString().padStart(3, '0');
        }

        const invoiceData: any = {
            invoiceNumber: finalInvoiceNumber,
            tokenNumber: tokenNumber, // Add token if generated
            customerName: customerName || t('pos.walk_in_customer'),
            customerId: customerId,
            customerVatNumber: customerId ? (customerVatNumber || undefined) : undefined,
            items: mappedItems, // Use the pre-calculated mapped items
            subTotal: subTotalSum, // Use strictly calculated sum
            discountAmount,
            taxAmount: taxAmount,
            grandTotal: grandTotal,
            paidAmount: Math.round(amountPaid * 100) / 100,
            remainingAmount: Math.round((paymentMode === 'credit' ? (grandTotal - amountPaid) : 0) * 100) / 100,
            paymentMode,
            createdAt: new Date(),
            paymentStatus: finalStatus,
            dueDate: (finalStatus !== 'paid' && dueDate) ? new Date(dueDate) : undefined,
            taxRate: taxPercent,
            notes: notes,
            orderType: orderType
        };

        try {
            console.log("DEBUG: Final Invoice Data Payload:", JSON.stringify(invoiceData, null, 2));
            let newId: string | undefined;
            // 1. Critical: Save to DB (Await this as it must succeed)
            newId = await onConfirm(invoiceData);
            // 2. Success Feedback (Close immediately and reset POS)
            addToast(t('pos.order_completed_successfully'), 'success');
            
            // Start background tasks before closing
            const safeBusinessDetails = businessDetails || { name: 'My Shop', address: '', phone: '', email: '' };
            const isPrintEnabled = !printerConfig?.enableCheckoutPrintToggle || shouldPrint;
            if ((businessDetails || safeBusinessDetails) && newId) {
                // Background tasks (Fire & Forget)
                const printDetails = { ...safeBusinessDetails, taxRate: taxPercent };
                const printDataForBg = { ...invoiceData, id: newId } as Invoice;
                setTimeout(async () => {
                    // --- PRINTING SEQUENCE (Sequential) ---
                    const executePrintingSequence = async () => {
                        try {
                            console.log("Starting POS printing sequence...");

                            // 1. Kitchen Ticket
                            const printerConfigStr = localStorage.getItem('printerConfig');
                            const config = printerConfigStr ? JSON.parse(printerConfigStr) : null;
                            const kConfig = config?.kitchen;
                            
                            if (kConfig && kConfig.enabled) {
                                console.log("Printing Kitchen Ticket...");
                                try {
                                    // printDataForBg is the invoice object
                                    await generateKitchenTicketPDF(printDataForBg);
                                    console.log("Kitchen Ticket Sent.");
                                    // 200ms safety delay for thermal hardware
                                    await new Promise(r => setTimeout(r, 200));
                                } catch (e) {
                                    console.error("Kitchen Print Error:", e);
                                }
                            }

                            // 2. Customer Receipt
                            if (isPrintEnabled) {
                                console.log("Printing Customer Receipt...");
                                try {
                                    // generateInvoicePDF expects (Invoice, BusinessDetails)
                                    await generateInvoicePDF(printDataForBg, printDetails);
                                    console.log("Customer Receipt Sent.");
                                } catch (e) {
                                    console.error("Customer Print Error:", e);
                                }
                            }
                        } catch (fatalPrintErr) {
                            console.error("Fatal Printing Sequence Error:", fatalPrintErr);
                        }
                    };

                    // Execute Printing
                    await executePrintingSequence();

                    // --- 3. ZATCA REPORTING (Background / Non-blocking) ---
                    // Run this last and in its own block so it never blocks the prints
                    (async () => {
                        try {
                            const zatcaConfigStr = localStorage.getItem('zatca_config');
                            if (zatcaConfigStr) {
                                const zatcaConfig = JSON.parse(zatcaConfigStr);
                                const isLive = zatcaConfig.status === 'LIVE';
                                const canReport = isLive || zatcaConfig.status === 'COMPLIANCE_OBTAINED';

                                // Pick the right credentials — production CSID first, compliance fallback
                                const activeCsid = isLive ? zatcaConfig.productionCsid : zatcaConfig.complianceCsid;
                                const activeSecret = isLive ? zatcaConfig.productionSecret : zatcaConfig.complianceSecret;
                                const env = zatcaConfig.environment || 'PRODUCTION';

                                if (canReport && zatcaConfig.privateKey && activeCsid) {
                                    const { generateZatcaXML } = await import('../../services/zatcaXml');
                                    const { reportInvoice } = await import('../../services/zatcaApi');

                                    const { xml, hash, uuid } = await generateZatcaXML(
                                        printDataForBg,
                                        { ...safeBusinessDetails, gstin: safeBusinessDetails.gstin || safeBusinessDetails.vatNo },
                                        zatcaConfig.privateKey
                                    );

                                    const reportResult = await reportInvoice(
                                        xml,
                                        hash,
                                        uuid,
                                        activeCsid,
                                        activeSecret,
                                        env
                                    );

                                    if (reportResult.status === 'REPORTED') {
                                        await db.invoices.update(newId!, {
                                            zatcaStatus: 'REPORTED',
                                            zatcaHash: hash
                                        });
                                    } else {
                                        await db.invoices.update(newId!, { zatcaStatus: 'ERROR' });
                                    }
                                }
                            }
                        } catch (zatcaErr) {
                            console.error("ZATCA Reporting Task Failed:", zatcaErr);
                        }
                    })();
                }, 100);
            }

            // Close modal and return to POS immediately
            onClose(true);
            setIsProcessing(false);

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
            onClose={() => onClose()}
            maxWidth="5xl"
            className="h-auto max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
        >
            <div className="flex flex-col md:flex-row w-full h-full">
                    {/* LEFT SIDE: Payment Methods (60%) */}
                    <div className="w-full md:w-[60%] flex flex-col p-8 bg-white dark:bg-slate-800 overflow-y-auto border-r border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{t('pos.select_payment_mode')}</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {[
                                { id: 'cash', icon: Banknote, label: t('pos.pay_cash') },
                                { id: 'card', icon: CreditCard, label: t('pos.pay_card') },
                                { id: 'upi', icon: Smartphone, label: t('pos.pay_digital', 'Online/UPI') },
                                { id: 'split', icon: SplitSquareHorizontal, label: t('pos.split_payment', 'Split') },
                                { id: 'credit', icon: Clock, label: t('pos.pay_credit') }
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => {
                                        setPaymentMode(mode.id as any);
                                        setAmountPaidInput('');
                                        setSplitCashInput('');
                                        setSplitCardInput('');
                                    }}
                                    className={`p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer select-none ${paymentMode === mode.id
                                        ? 'border-transparent bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-800 transform scale-[1.02]'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                        }`}
                                >
                                    <mode.icon size={32} className={paymentMode === mode.id ? 'text-white' : 'text-slate-400 dark:text-slate-500'} strokeWidth={paymentMode === mode.id ? 2.5 : 2} />
                                    <span className="font-bold tracking-wide">{mode.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Credit Info & Due Date */}
                        {paymentMode === 'credit' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className={`p-5 rounded-2xl border-2 ${canTakeCredit ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800'}`}>
                                    <div className="font-bold flex justify-between items-center mb-2">
                                        <span className="text-sm uppercase tracking-wider opacity-70">Credit Limit</span>
                                        <span className="text-xl">{formatCurrency(customer?.creditLimit || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-semibold">
                                        <span className="opacity-70">Current Balance</span>
                                        <span>{formatCurrency(customer?.balance || 0)}</span>
                                    </div>
                                    {!canTakeCredit && (
                                        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center">
                                            <p className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">{t('pos.credit_error_title')}</p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                        {t('pos.due_date')} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors font-semibold"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Split Payment Inputs */}
                        {paymentMode === 'split' && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                        Cash Amount
                                    </label>
                                    <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 focus-within:border-blue-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-700 transition-colors">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currency}</div>
                                        <input
                                            type="number"
                                            value={splitCashInput}
                                            onChange={(e) => setSplitCashInput(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-12 pr-4 py-4 bg-transparent font-bold outline-none text-slate-800 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                        Card Amount
                                    </label>
                                    <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 focus-within:border-blue-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-700 transition-colors">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currency}</div>
                                        <input
                                            type="number"
                                            value={splitCardInput}
                                            onChange={(e) => setSplitCardInput(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-12 pr-4 py-4 bg-transparent font-bold outline-none text-slate-800 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Payment Input (Card / UPI / Credit partials) */}
                        {paymentMode !== 'cash' && paymentMode !== 'split' && (
                            <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300 flex-1">
                                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                    {paymentMode === 'credit' ? t('pos.down_payment') : t('pos.amount_tendered')}
                                </label>
                                <div className={`relative rounded-xl overflow-hidden border-2 transition-colors ${isCreditSale && !canTakeCredit ? 'border-red-300 bg-red-50' : 'border-slate-200 focus-within:border-blue-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-700'}`}>
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currency}</div>
                                    <input
                                        type="number"
                                        value={amountPaidInput}
                                        onChange={(e) => setAmountPaidInput(e.target.value)}
                                        placeholder={paymentMode === 'credit' ? "0.00" : grandTotal.toFixed(2)}
                                        className="w-full pl-12 pr-4 py-4 bg-transparent font-bold outline-none text-slate-800 dark:text-white text-lg"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-auto pt-6 justify-between items-center border-t border-slate-100 dark:border-slate-700/50 hidden md:flex">
                             <button onClick={() => onClose()} disabled={isProcessing} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 uppercase tracking-wider text-sm">
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Receipt Summary (40%) */}
                    <div className="w-full md:w-[40%] bg-slate-50 dark:bg-slate-900 flex flex-col relative overflow-hidden">
                        {/* Decorative top pattern */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                        
                        <div className="p-8 flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest">{t('pos.order_summary')}</h3>
                                {orderType && (
                                    <span className="px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                                        {(orderType === 'dine_in') && '🍽️'}
                                        {(orderType === 'parcel') && '🥡'}
                                        {(orderType === 'pickup') && '🚶'}
                                        {(orderType === 'delivery') && '🚚'}
                                        {t(`pos.${orderType}`)}
                                    </span>
                                )}
                            </div>

                            {/* Bill Details */}
                            <div className="space-y-5 mb-8 text-slate-600 dark:text-slate-300 font-medium">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">{t('pos.subtotal')} ({items.length} items)</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(subTotal)}</span>
                                </div>

                                {/* Discount Input */}
                                <div className="flex justify-between items-center group">
                                    <span className="group-focus-within:text-blue-600 transition-colors text-slate-500">{t('pos.discount')}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="flex text-xs bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                                            <button
                                                onClick={() => setDiscountType('percentage')}
                                                className={`px-3 py-1 rounded-md transition-all ${discountType === 'percentage' ? 'bg-white shadow-sm text-black font-black' : 'text-slate-500 hover:text-slate-700 font-bold'}`}
                                            >
                                                %
                                            </button>
                                            <button
                                                onClick={() => setDiscountType('fixed')}
                                                className={`px-3 py-1 rounded-md transition-all ${discountType === 'fixed' ? 'bg-white shadow-sm text-black font-black' : 'text-slate-500 hover:text-slate-700 font-bold'}`}
                                            >
                                                Amt
                                            </button>
                                        </div>
                                        <div className="relative border-b-2 border-slate-300 focus-within:border-blue-500 pb-1 w-16">
                                            <input
                                                type="number"
                                                value={discountValue || ''}
                                                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                                min="0"
                                                className="w-full text-right bg-transparent outline-none font-bold text-slate-800 dark:text-white"
                                            />
                                        </div>
                                        <span className="text-red-500 font-bold w-20 text-right">-{formatCurrency(discountAmount)}</span>
                                    </div>
                                </div>

                                {/* Tax Row */}
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <span className="text-slate-500">{t('pos.tax')}</span>
                                    <span className="font-bold text-slate-800 dark:text-white">+{formatCurrency(taxAmount)}</span>
                                </div>
                            </div>

                            {/* Grand Total Card */}
                            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 p-7 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700 mb-8 relative overflow-hidden group/total">
                                <div className="absolute -right-4 -top-4 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl group-hover/total:bg-blue-500/20 transition-all duration-700"></div>
                                <div className="text-center mb-1 relative z-10">
                                    <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-[0.3em]">{t('pos.grand_total')}</span>
                                </div>
                                <div className="text-center relative z-10">
                                    <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>

                            {/* Change/Balance Indicator */}
                            <div className={`mt-auto mb-8 flex items-center justify-between p-5 rounded-2xl border-2 transition-colors ${changeAmount >= 0 ? 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800'}`}>
                                {changeAmount >= 0 ? (
                                    <>
                                        <span className="font-bold uppercase tracking-wider text-sm text-green-700 dark:text-green-500">{t('pos.change_due', 'Change Due')}</span>
                                        <span className="text-2xl font-black text-green-600">{formatCurrency(changeAmount)}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="font-bold uppercase tracking-wider text-sm text-red-700 dark:text-red-500">{t('pos.credit_balance_remaining', 'Balance Due')}</span>
                                        <span className="text-2xl font-black text-red-500">{formatCurrency(balanceDue)}</span>
                                    </>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="space-y-4">
                                {/* Print Toggle */}
                                {printerConfig?.enableCheckoutPrintToggle && (
                                    <label className="flex items-center justify-between cursor-pointer select-none px-2 mb-2 group">
                                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors">{t('pos.print_receipt')}</span>
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={shouldPrint}
                                                onChange={e => setShouldPrint(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </div>
                                    </label>
                                )}

                                <button
                                    onClick={handleConfirm}
                                    disabled={(paymentMode === 'credit' && !canTakeCredit) || isProcessing || (paymentMode === 'split' && ((parseFloat(splitCashInput)||0) + (parseFloat(splitCardInput)||0) < grandTotal))}
                                    className="w-full p-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 transform active:scale-95 transition-all group overflow-hidden relative"
                                >
                                    {/* Button Shine Effect */}
                                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                                    
                                    {isProcessing ? (
                                        <>
                                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span className="font-black text-xl tracking-wide">{t('common.processing')}...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-black text-xl tracking-wide">
                                                PAY {formatCurrency(
                                                    paymentMode === 'cash' ? grandTotal : 
                                                    paymentMode === 'credit' ? (parseFloat(amountPaidInput) || 0) :
                                                    paymentMode === 'split' ? ((parseFloat(splitCashInput)||0) + (parseFloat(splitCardInput)||0)) :
                                                    (parseFloat(amountPaidInput) || grandTotal)
                                                )}
                                            </span>
                                            <ChevronRight className="w-6 h-6 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                        </>
                                    )}
                                </button>

                                <button onClick={() => onClose()} disabled={isProcessing} className="w-full py-4 text-center font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 uppercase tracking-widest text-sm transition-colors md:hidden">
                                    {t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
        </Modal>
    );
};

export default CheckoutModal;

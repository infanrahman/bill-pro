import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, Smartphone, Clock, SplitSquareHorizontal, ChevronRight, XCircle, Receipt } from 'lucide-react';
import clsx from 'clsx';
import { db, getCurrentBranchId } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Invoice, InvoiceItem } from '../../services/db';
import { calculateLineItem, calculateDocumentTotals } from '../../utils/financials';
import { useNotification } from '../../contexts/NotificationContext';
import { generateInvoicePDF, generateKitchenTicketPDF } from '../../services/invoiceGenerator';

import Modal from '../../components/UI/Modal';
import { useSettings } from '../../contexts/SettingsContext';
import { messagingService } from '../../services/messagingService';

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
 showPayLater?: boolean;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, subTotal, items, customerName, customerId, customerVatNumber, notes, orderType, onConfirm, invoiceNumber, showPayLater }) => {
 // Moved early return to after hooks to satisfy Rules of Hooks
 const { addToast } = useNotification();
 const { formatCurrency, settings } = useSettings();
 const { t } = useTranslation();

 const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
 const [discountValue, setDiscountValue] = useState(0);
 const [taxPercent, setTaxPercent] = useState(15); // Default 15% (KSA Standard)
 const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'credit' | 'split' | 'pay_later'>('cash');
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
 // --- ZATCA Standard Calculations ---
 const financialResults = React.useMemo(() => {
 const lineResults = items.map(item => calculateLineItem({
 price: item.price,
 quantity: item.quantity,
 taxRate: item.taxRate ?? taxPercent,
 taxType: item.taxType || 'exclusive',
 discount: item.discountAmount || 0,
 discountType: 'fixed'
 }, settings.applyTax));

 return {
 lineResults,
 totals: calculateDocumentTotals(lineResults, discountValue, discountType, settings.applyTax)
 };
 }, [items, discountValue, discountType, taxPercent, settings.applyTax]);

 const { subTotal: subTotalSum, taxAmount, discountAmount, grandTotal } = financialResults.totals;

 const mappedItems = items.map((item: any, index: number) => {
 const lineFin = financialResults.lineResults[index];
 return {
 ...item,
 taxAmount: lineFin.taxAmount,
 netAmount: lineFin.taxableAmount,
 total: lineFin.total,
 discountAmount: lineFin.discountAmount,
 taxRate: item.taxRate ?? taxPercent,
 taxType: item.taxType || 'exclusive'
 };
 });

 
 let amountPaid = 0;
 if (paymentMode === 'split') {
 const cashValue = parseFloat(splitCashInput) || 0;
 const cardValue = parseFloat(splitCardInput) || 0;
 amountPaid = Math.round((cashValue + cardValue) * 100) / 100;
 } else if (paymentMode === 'credit') {
 amountPaid = Math.round((parseFloat(amountPaidInput) || 0) * 100) / 100;
 } else if (paymentMode === 'cash') {
 amountPaid = amountPaidInput ? Math.round((parseFloat(amountPaidInput) || 0) * 100) / 100 : grandTotal;
 } else if (paymentMode === 'pay_later') {
 amountPaid = 0; // Pay Later = no payment yet
 } else {
 amountPaid = grandTotal;
 }

 const isPayLater = paymentMode === 'pay_later';
 const balanceDue = isPayLater ? 0 : Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100);
 const changeAmount = isPayLater ? 0 : Math.round(Math.max(0, amountPaid - grandTotal) * 100) / 100;

 const isCreditSale = !isPayLater && (paymentMode === 'credit' || balanceDue > 0.01);
 const currentBalance = customer?.balance || 0;
 const limit = customer?.creditLimit;
 // H12 Fix: undefined/null limit = no credit limit set (allowed); limit === 0 = NO credit allowed; limit > 0 = enforce cap
 const canTakeCredit = !!customerId && (
   limit === undefined || limit === null ? true : (limit > 0 ? (currentBalance + balanceDue <= limit) : false)
 );

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
 // Extract only digits from the invoice number (handles"INV-003","SO-123","RET-5", etc.)
 const lastNumStr = lastInvoice.invoiceNumber.replace(/\D/g, '');
 const lastNum = parseInt(lastNumStr, 10);
 if (!isNaN(lastNum)) {
 nextNumber = lastNum + 1;
 }
 }
 
 // Prefix logic: SO- for orders, INV- for invoices
 let prefix = 'INV-';
 if (isPayLater) prefix = 'SO-';
 
 // If we are editing an Order but paying now (not as pay_later), we need a NEW INV- number.
 // If we are editing an Order and staying as pay_later (unlikely from UI but possible), we keep SO number.
 const shouldRegenerate = invoiceNumber && invoiceNumber.startsWith('SO-') && !isPayLater;
 const finalInvoiceNumber = (shouldRegenerate || !invoiceNumber) ? (prefix + nextNumber.toString().padStart(3, '0')) : invoiceNumber;

 // Generate Token Number for Cafe Mode (Daily Reset) or if Print Token is enabled
 let tokenNumber: string | undefined;
 const savedPrinterConfig = localStorage.getItem('printerConfig');
 const currentPrinterConfig = savedPrinterConfig ? JSON.parse(savedPrinterConfig) : printerConfig;

 if (settings.cafeMode || currentPrinterConfig?.printToken) {
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
 paidAmount: isPayLater ? 0 : Math.round(amountPaid * 100) / 100,
 remainingAmount: isPayLater ? grandTotal : Math.round(((paymentMode === 'credit' || balanceDue > 0.01) ? (grandTotal - amountPaid) : 0) * 100) / 100,
 paymentMode: isPayLater ? 'pay_later' : paymentMode,
 createdAt: new Date(),
 paymentStatus: isPayLater ? 'pending' : finalStatus,
 status: isPayLater ? 'pending' : finalStatus,
 type: isPayLater ? 'order' : 'invoice',
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
 addToast(isPayLater ? (t('sales.order_created', 'Order saved!')) : t('pos.order_completed_successfully'), 'success');
 
 // Start background tasks before closing
 const safeBusinessDetails = businessDetails || { name: 'My Shop', address: '', phone: '', email: '' };
 const isPrintEnabled = !printerConfig?.enableCheckoutPrintToggle || shouldPrint;
 // Skip printing and ZATCA for Pay Later orders
 if (!isPayLater && (businessDetails || safeBusinessDetails) && newId) {
 // Background tasks (Fire & Forget)
 const printDetails = { ...safeBusinessDetails, taxRate: taxPercent };
 const printDataForBg = { ...invoiceData, id: newId } as Invoice;
 setTimeout(async () => {
 // --- 1. PRE-CALCULATE ZATCA (Once for both printing and reporting) ---
 let precalculatedQR: string | undefined;
 let precalculatedXML: string | undefined;
 let precalculatedHash: string | undefined;
 let precalculatedUUID: string | undefined;

 try {
 const vatNumberRaw = safeBusinessDetails.gstin || safeBusinessDetails.vatNo || '';
 const vatNumber = vatNumberRaw.trim();
 if (vatNumber) {
 const zatcaConfig = (window.electron && window.electron.zatca)
 ? await window.electron.zatca.getConfig()
 : JSON.parse(localStorage.getItem('zatca_config') || 'null');

 if (zatcaConfig && zatcaConfig.privateKey) {
 const isLive = zatcaConfig.status === 'LIVE';
 const activeCsid = isLive ? zatcaConfig.productionCsid : zatcaConfig.complianceCsid;

 if (activeCsid) {
 const { generateZatcaXML } = await import('../../services/zatcaXml');
 const activeBranchId = getCurrentBranchId();
 const branch = await db.branches.get(activeBranchId);
 const currentPIH = branch?.lastInvoiceHash || 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';

 const result = await generateZatcaXML(
 printDataForBg,
 { ...safeBusinessDetails, gstin: vatNumber },
 zatcaConfig.privateKey,
 activeCsid,
 currentPIH,
 (branch?.invoiceCounter || 0) + 1
);
 
 precalculatedXML = result.xml;
 precalculatedHash = result.hash;
 precalculatedUUID = result.uuid;

 // Save XML locally for offline queueing
 await db.invoices.update(newId!, {
 zatcaXml: precalculatedXML,
 zatcaHash: precalculatedHash,
 zatcaStatus: 'PENDING'
 });

 // Convert TLV to QR DataURL early
 const QRCode = (await import('qrcode')).default;
 precalculatedQR = await QRCode.toDataURL(result.qr, { margin: 0 });
 console.log("ZATCA Pre-calculation complete.");
 }
 }
 }
 } catch (e) {
 console.error("ZATCA Pre-calculation failed:", e);
 addToast("ZATCA Error:"+ (e instanceof Error ? e.message : 'Pre-calculation failed'), 'error');
 }

 // --- 2. PRINTING SEQUENCE (Parallelized) ---
 const executePrintingSequence = async () => {
 console.log("Starting parallel printing sequence...");
 const printTasks: Promise<any>[] = [];

 // Kitchen Ticket
 const printerConfigStr = localStorage.getItem('printerConfig');
 const config = printerConfigStr ? JSON.parse(printerConfigStr) : null;
 const kConfig = config?.kitchen;
 
 if (kConfig && kConfig.enabled) {
 printTasks.push((async () => {
 try {
 console.log("Task: Printing Kitchen Ticket...");
 await generateKitchenTicketPDF(printDataForBg);
 console.log("Kitchen Ticket Sent.");
 } catch (e) { 
 console.error("Kitchen Print Error:", e); 
 addToast("Kitchen Print Error:"+ (e instanceof Error ? e.message : 'Unknown error'), 'error');
 }
 })());
 }

 // Customer Receipt
 if (isPrintEnabled) {
 printTasks.push((async () => {
 try {
 console.log("Task: Printing Customer Receipt...");
 await generateInvoicePDF(printDataForBg, printDetails, precalculatedQR);
 console.log("Customer Receipt Sent.");
 } catch (e) { 
 console.error("Customer Print Error:", e); 
 addToast("Customer Print Error:"+ (e instanceof Error ? e.message : 'Unknown error'), 'error');
 }
 })());
 }

 // Run all print tasks in parallel
 if (printTasks.length > 0) {
 await Promise.all(printTasks);
 console.log("All print jobs dispatched.");
 }
 };

 // Execute Printing
 await executePrintingSequence();

 // --- 3. ZATCA REPORTING (Background) ---
 if (precalculatedXML && precalculatedHash) {
 // C9 Fix: Always update the local ICV counter and PIH hash IMMEDIATELY when the
 // invoice is created, regardless of ZATCA reporting outcome. This keeps the
 // cryptographic chain intact for offline scenarios and prevents ICV gaps.
 try {
 const activeBranchIdForZatca = getCurrentBranchId();
 const branchForZatca = await db.branches.get(activeBranchIdForZatca);
 const nextICV = (branchForZatca?.invoiceCounter || 0) + 1;
 await db.branches.update(activeBranchIdForZatca, {
 lastInvoiceHash: precalculatedHash,
 invoiceCounter: nextICV
 });
 } catch (chainErr) {
 console.error('Failed to update ZATCA chain counters:', chainErr);
 }

 (async () => {
 try {
 const zatcaConfig = (window.electron && window.electron.zatca)
 ? await window.electron.zatca.getConfig()
 : JSON.parse(localStorage.getItem('zatca_config') || 'null');

 if (zatcaConfig) {
 const { reportInvoice } = await import('../../services/zatcaApi');
 const isLive = zatcaConfig.status === 'LIVE';
 const canReport = isLive || zatcaConfig.status === 'COMPLIANCE_OBTAINED';
 const activeCsid = isLive ? zatcaConfig.productionCsid : zatcaConfig.complianceCsid;
 const activeSecret = isLive ? zatcaConfig.productionSecret : zatcaConfig.complianceSecret;
 const env = zatcaConfig.environment || 'PRODUCTION';

 if (canReport && activeCsid) {
 const reportResult = await reportInvoice(
 precalculatedXML!,
 precalculatedHash!,
 precalculatedUUID!,
 activeCsid,
 activeSecret,
 env
);

 if (reportResult.status === 'REPORTED') {
 await db.invoices.update(newId!, {
 zatcaStatus: 'REPORTED'
 });
 } else {
 await db.invoices.update(newId!, { zatcaStatus: 'ERROR', zatcaError: JSON.stringify(reportResult) });
 }
 }
 }
 } catch (zatcaErr) {
 console.error("ZATCA Reporting Task Failed:", zatcaErr);
 addToast("Invoice saved locally. Will report to ZATCA when online.", 'info');
 }
 })();
 }

 // --- 4. WHATSAPP NOTIFICATION ---
 if (customerId && customerId !== '0') {
 try {
 const c = await db.customers.get(customerId);
 if (c) {
 await messagingService.sendThankYouMessage(printDataForBg, c);
 }
 } catch (err) {
 console.error("WhatsApp notification failed:", err);
 addToast("WhatsApp notification failed", 'error');
 }
 }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row w-full min-h-full relative">
        {/* Background Decorations */}
        <div className="absolute top-0 left-0 w-full h-full bg-slate-50 dark:bg-slate-900 -z-10"/>

 {/* LEFT SIDE: Payment Methods (60%) */}
 <div className="w-full md:w-[60%] flex flex-col p-4 md:p-10 md:overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200/50 dark:border-slate-700/50 relative z-10 shrink-0 md:shrink">
 <div className="flex justify-between items-center mb-6 md:mb-10">
 <div className="space-y-1">
 <h3 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight uppercase">{t('pos.select_payment_mode')}</h3>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.4em]">{t('pos.complete_transaction_to_print')}</p>
 </div>
 </div>
 
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
 {[
 { id: 'cash', icon: Banknote, label: t('pos.pay_cash'), color: 'emerald' },
 { id: 'card', icon: CreditCard, label: t('pos.pay_card'), color: 'blue' },
 { id: 'upi', icon: Smartphone, label: t('pos.pay_digital'), color: 'indigo' },
 { id: 'split', icon: SplitSquareHorizontal, label: t('pos.split_payment'), color: 'amber' },
 { id: 'credit', icon: Clock, label: t('pos.pay_credit'), color: 'rose' },
 ...(showPayLater !== false ? [{ id: 'pay_later', icon: Clock, label: t('pos.pay_later'), color: 'slate' }] : [])
 ].map((mode) => (
 <button type="button"
 key={mode.id}
 
 
 onClick={() => {
 setPaymentMode(mode.id as any);
 setAmountPaidInput('');
 setSplitCashInput('');
 setSplitCardInput('');
 }}
 className={clsx(
"p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 relative overflow-hidden group",
 paymentMode === mode.id
 ? 'bg-slate-800 dark:bg-slate-700 text-white border-transparent ring-4 ring-slate-900/20 dark:ring-white/20'
 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
)}
 >
 {paymentMode === mode.id && (
 <div className="absolute inset-0 to-indigo-600 pointer-events-none"/>
)}
 <div className="relative z-10">
 <mode.icon size={40} className={clsx("", paymentMode === mode.id ? 'text-white' : 'text-slate-600')} />
 </div>
 <span className="relative z-10 font-semibold text-[12px] uppercase tracking-wider">{mode.label}</span>
 {paymentMode === mode.id && <div className="absolute bottom-4 right-4 w-2 h-2 bg-white rounded-full 0_0_8px_white]"/>}
 </button>
))}
 </div>

 {/* Credit Info & Due Date */}
 {paymentMode === 'credit' && (
 <div className="space-y-6">
 <div className={clsx(
"p-6 rounded-2xl border-2", 
 canTakeCredit ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 ' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
)}>
 <div className="flex justify-between items-center mb-6">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-slate-900 dark:bg-white rounded-2xl text-slate-900 dark:text-white"><Clock size={24} /></div>
 <div>
 <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Credit Status</div>
 <div className="text-xl font-semibold text-slate-900 dark:text-white uppercase tracking-tight">Account Balance</div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{formatCurrency(customer?.balance || 0)}</div>
 <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Limit: {formatCurrency(customer?.creditLimit || 0)}</div>
 </div>
 </div>
 {!canTakeCredit && (
 <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center gap-3">
 <div className="w-2 h-2 bg-rose-500 rounded-full"/>
 <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">{t('pos.credit_error_title')}</p>
 </div>
)}
 </div>

 <div className="group/date">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-[0.4em] mb-3 ml-4">
 {t('pos.due_date')} <span className="text-rose-500">*</span>
 </label>
 <input
 type="date"
 value={dueDate}
 onChange={(e) => setDueDate(e.target.value)}
 className="w-full p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 font-semibold text-lg"
 required
 />
 </div>
 </div>
)}

 {/* Split Payment Inputs */}
 {paymentMode === 'split' && (
 <div className="grid grid-cols-2 gap-6">
 {[
 { id: 'cash', label: 'Cash Amount', value: splitCashInput, setter: setSplitCashInput, icon: Banknote },
 { id: 'card', label: 'Card Amount', value: splitCardInput, setter: setSplitCardInput, icon: CreditCard }
 ].map((s) => (
 <div key={s.id} className="space-y-3">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-[0.4em] ml-4">
 {s.label}
 </label>
 <div className="relative group/input">
 <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 font-semibold text-lg group-focus-within/input:text-slate-900 dark:group-focus-within/input:text-white">{settings.currency}</div>
 <input
 type="number"
 value={s.value}
 onChange={(e) => s.setter(e.target.value)}
 placeholder="0.00"
 className="w-full pl-20 pr-8 py-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-2xl outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 />
 </div>
 </div>
))}
 </div>
)}

 {/* Payment Input (Card / UPI / Credit partials) */}
 {paymentMode !== 'cash' && paymentMode !== 'split' && paymentMode !== 'pay_later' && (
 <div className="flex-1 space-y-3">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-[0.4em] ml-4">
 {paymentMode === 'credit' ? t('pos.down_payment') : t('pos.amount_tendered')}
 </label>
 <div className="relative group/input">
 <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 font-semibold text-lg group-focus-within/input:text-slate-900 dark:group-focus-within/input:text-white">{settings.currency}</div>
 <input
 type="number"
 value={amountPaidInput}
 onChange={(e) => setAmountPaidInput(e.target.value)}
 placeholder={paymentMode === 'credit' ?"0.00": grandTotal.toFixed(2)}
 className="w-full pl-20 pr-8 py-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl font-semibold text-4xl outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 />
 </div>
 </div>
)}

 {/* Removed Cancel button from here */}
 </div>

 {/* RIGHT SIDE: Receipt Summary (40%) */}
 <div className="w-full md:w-[40%] bg-slate-50 dark:bg-slate-950 flex flex-col relative z-10 min-h-0 shrink-0 md:shrink">
 {/* Summary Header Gradient */}
 <div className="absolute top-0 left-0 right-0 h-2 via-indigo-600"/>
 
 <div className="p-5 md:p-6 flex-1 flex flex-col min-h-0 overflow-y-auto">
 <div className="flex justify-between items-center mb-8 shrink-0">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center text-white">
 <Receipt size={20} />
 </div>
 <div>
 <h3 className="text-sm font-semibold dark:text-white uppercase tracking-wider">{t('pos.order_summary')}</h3>
 <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
 {new Date().toLocaleDateString()}
 </p>
 </div>
 </div>
 {orderType && (
 <span 
 
 
 className="px-4 py-1.5 bg-white dark:bg-slate-800 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-slate-100 dark:border-slate-700 flex items-center gap-2"
 >
 <span className="text-base">
 {settings.customOrderTypes?.[orderType]?.icon || (
 orderType === 'dine_in' ? '🍽️' :
 orderType === 'parcel' ? '🥡' :
 orderType === 'pickup' ? '🚶' : '🚚'
)}
 </span>
 {settings.customOrderTypes?.[orderType]?.label || t(`pos.${orderType}`)}
 </span>
)}
 </div>

 {/* Customer Details */}
 {customer && customer.id !== '0' && (
   <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-1 shrink-0">
     <div className="flex justify-between items-center">
       <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Customer</span>
       {customer.balance > 0 && (
         <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full">
           Balance: {formatCurrency(customer.balance)}
         </span>
       )}
     </div>
     <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">{customer.name}</span>
     {customer.phone && (
       <span className="text-xs text-slate-500 font-medium">{customer.phone}</span>
     )}
     {customerVatNumber && (
       <span className="text-xs text-slate-500 font-medium">VAT: {customerVatNumber}</span>
     )}
   </div>
 )}

 {/* Scrollable Items List */}
 <div className="flex-1 overflow-y-auto mb-8 pr-2 custom-scrollbar space-y-4">
 {items.map((item, idx) => (
 <div key={idx} className="flex justify-between items-center group/item">
 <div className="flex flex-col">
 <span className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1 group-hover/item:text-slate-900 dark:group-hover/item:text-white">{item.name}</span>
 <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
 {item.quantity} x {formatCurrency(item.price)}
 </span>
 </div>
 <span className="text-sm font-semibold text-slate-800 dark:text-white tracking-tight">
 {formatCurrency(item.price * item.quantity)}
 </span>
 </div>
))}
 {items.length === 0 && (
 <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
 <Receipt size={40} className="mb-2"/>
 <span className="text-[10px] font-semibold uppercase tracking-wider">No Items</span>
 </div>
)}
 </div>

 {/* Bill Details */}
 <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
 <div className="flex justify-between items-center">
 <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{t('pos.subtotal')} ({items.length} items)</span>
 <span className="text-lg font-semibold text-slate-800 dark:text-white tracking-tight">{formatCurrency(subTotal)}</span>
 </div>

 {/* Discount Input */}
 <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 group/disc">
 <div className="flex justify-between items-center mb-4">
 <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{t('pos.discount')}</span>
 <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
 {['percentage', 'fixed'].map((type) => (
 <button type="button"
 key={type}
 onClick={() => setDiscountType(type as any)}
 className={clsx(
"px-4 py-1.5 rounded-lg text-[10px] font-semibold",
 discountType === type 
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white ' 
 : 'text-slate-600'
)}
 >
 {type === 'percentage' ? '%' : 'AMT'}
 </button>
))}
 </div>
 </div>
 <div className="flex justify-between items-center">
 <div className="relative border-b-2 border-slate-200 dark:border-slate-700 focus-within:border-slate-900 dark:focus-within:border-white pb-1 w-24">
 <input
 type="number"
 value={discountValue || ''}
 onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
 placeholder="0"
 className="w-full text-left bg-transparent outline-none font-semibold text-2xl text-slate-800 dark:text-white"
 />
 </div>
 <div className="text-rose-500 font-semibold text-xl tracking-tight">-{formatCurrency(discountAmount)}</div>
 </div>
 </div>

 {/* Tax Row */}
 <div className="flex justify-between items-center pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
 <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{t('pos.tax')} (15%)</span>
 <span className="text-lg font-semibold text-slate-800 dark:text-white tracking-tight">+{formatCurrency(taxAmount)}</span>
 </div>
 </div>

 {/* Grand Total Card */}
 <div className="bg-slate-800 dark:bg-slate-700 p-5 rounded-2xl mb-3 shrink-0">
 <div className="flex items-center justify-between">
 <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">{t('pos.grand_total')}</span>
 <span 
 key={grandTotal}
 
 
 className="text-2xl md:text-3xl font-semibold text-white tracking-tight leading-none"
 >
 {formatCurrency(grandTotal)}
 </span>
 </div>
 </div>

 {/* Change/Balance Indicator */}
 <>
 <div 
 key={changeAmount >= 0 ? 'change' : 'balance'}
 
 
 
 className={clsx(
"mb-3 flex items-center justify-between p-4 rounded-2xl border shrink-0", 
 changeAmount >= 0 
 ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400' 
 : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:border-rose-800/50 dark:text-rose-400'
)}
 >
 <div className="flex flex-col">
 <span className="font-bold uppercase tracking-wider text-[9px] mb-0.5">
 {changeAmount >= 0 ? t('pos.change_due') : t('pos.credit_balance_remaining')}
 </span>
 <span className="text-xl font-semibold tracking-tight">
 {formatCurrency(Math.abs(changeAmount >= 0 ? changeAmount : balanceDue))}
 </span>
 </div>
 <div className={clsx(
"w-10 h-10 rounded-xl flex items-center justify-center",
 changeAmount >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'
)}>
 {changeAmount >= 0 ? <Banknote size={20} /> : <Clock size={20} />}
 </div>
 </div>
 </>

 {/* Actions */}
 <div className="space-y-3 mt-auto shrink-0">
 {/* Print Toggle */}
 {printerConfig?.enableCheckoutPrintToggle && (
 <label className="flex items-center justify-between cursor-pointer select-none px-1 py-1 group">
 <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 group-hover:text-slate-700 dark:group-hover:text-white">
 {t('pos.print_receipt')}
 </span>
 <div className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={shouldPrint}
 onChange={e => setShouldPrint(e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after: peer-checked:bg-slate-900 dark:peer-checked:bg-white"/>
 </div>
 </label>
)}

 <button type="button"
 
 
 onClick={handleConfirm}
 disabled={(paymentMode === 'credit' && !canTakeCredit) || isProcessing || (paymentMode === 'split' && ((parseFloat(splitCashInput)||0) + (parseFloat(splitCardInput)||0) < grandTotal))}
 className="w-full py-4 px-6 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base tracking-wide flex items-center justify-center gap-3"
 >
 {isProcessing ? (
 <>
 <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full"/>
 <span>{t('common.processing')}</span>
 </>
) : (
 <>
 <ChevronRight size={20} />
 <span>{paymentMode === 'pay_later' ? t('pos.pay_later') : t('pos.checkout')}</span>
 </>
)}
 </button>
 
 {/* Mobile Cancel Button */}
 <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-center">
   <button type="button"
     onClick={() => onClose()} 
     disabled={isProcessing} 
     className="py-3 px-6 rounded-xl font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 uppercase tracking-wider text-[10px] flex items-center gap-3 w-full justify-center"
   >
     <XCircle size={18} />
     {t('common.cancel')}
   </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
);
};

export default CheckoutModal;

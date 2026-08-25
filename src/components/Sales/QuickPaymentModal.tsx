import React, { useState, useEffect, useRef } from 'react';
import Modal from '../UI/Modal';
import { db, type Invoice, type InvoiceItem } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { generateInvoicePDF } from '../../services/invoiceGenerator';
import { Zap, ScanBarcode } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useKeyboard } from '../../contexts/KeyboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

interface QuickPaymentModalProps {
 isOpen: boolean;
 onClose: () => void;
}

type TaxOption = 'inclusive' | 'exclusive' | 'none';

const QuickPaymentModal: React.FC<QuickPaymentModalProps> = ({ isOpen, onClose }) => {
 const { t } = useTranslation();
 const { addToast } = useNotification();
 const { settings, formatCurrency } = useSettings();
 const { registerShortcut, unregisterShortcut } = useKeyboard();
 const { activeBranchId } = useAuth();
 const [isLoading, setIsLoading] = useState(false);

 // State
 // Updated Interface for Quantity Support
 interface QuickPayItem {
 id: number;
 itemId?: string;
 name: string;
 quantity: number;
 price: number;
 total: number;
 }
 const [items, setItems] = useState<QuickPayItem[]>([]);

 // Keypad / Input State
 const [itemName, setItemName] = useState('');
 const [amount, setAmount] = useState('');
 const [taxOption, setTaxOption] = useState<TaxOption>('exclusive');
 const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi'>('cash');

 // Refs for Focus Management
 const nameInputRef = useRef<HTMLInputElement>(null);
 const amountInputRef = useRef<HTMLInputElement>(null);
 const payButtonRef = useRef<HTMLButtonElement>(null);

 // Barcode Buffer
 const barcodeBuffer = useRef('');
 const lastKeyTime = useRef(0);

 // Auto-focus on Open
 useEffect(() => {
 if (isOpen) {
 setTimeout(() => {
 nameInputRef.current?.focus();
 }, 100);
 }
 }, [isOpen]);

 // Barcode Listener
 useEffect(() => {
 if (!isOpen) return;

 const handleKeyDown = async (e: KeyboardEvent) => {
  // M16 Fix: Ignore when user is typing in form inputs, textareas, or selects
  const target = e.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
  return;
  }

  const now = Date.now();

  // If time between keys is long, reset buffer (it's manual typing)
  if (now - lastKeyTime.current > 300) {
  barcodeBuffer.current = '';
  }
  lastKeyTime.current = now;

  if (e.key === 'Enter') {
  if (barcodeBuffer.current.length > 3) {
  // Start Search
  e.preventDefault();
  e.stopPropagation();
  const code = barcodeBuffer.current.trim();
  barcodeBuffer.current = ''; // Reset immediately
  await handleBarcodeScan(code);
  }
  // Else: normal Enter key, let input handlers deal with it
  } else if (e.key.length === 1) {
  barcodeBuffer.current += e.key;
  }
  };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [isOpen, items]); // Dependency on items needed for lookup in list

 const handleBarcodeScan = async (code: string) => {
 try {
 // 1. Search DB
 const item = await db.items.where('barcode').equals(code).first();

 if (item) {
 // 2. Check if already in list
 const existingIndex = items.findIndex(i => i.itemId === item.id);

 if (existingIndex >= 0) {
 // Increment Quantity
 const newItems = [...items];
 newItems[existingIndex].quantity += 1;
 newItems[existingIndex].total = newItems[existingIndex].quantity * newItems[existingIndex].price;
 setItems(newItems);
 addToast(t('pos.added_item', { name: item.name }), 'info');
 } else {
 // Add New
 const newItem: QuickPayItem = {
 id: Date.now(),
 itemId: item.id,
 name: item.name,
 quantity: 1,
 price: item.salePrice,
 total: item.salePrice
 };
 setItems(prev => [...prev, newItem]);
 addToast(t('pos.added_item', { name: item.name }), 'success');
 }

 // Clear inputs just in case
 setItemName('');
 setAmount('');
 nameInputRef.current?.focus(); // Keep focus for next scan
 } else {
 addToast(t('pos.item_not_found'), 'error');
 }
 } catch (error) {
 console.error(error);
 addToast('Barcode scan failed', 'error');
 }
 };

 // Register Pay Shortcut
 useEffect(() => {
 if (!isOpen) return;

 const payId = 'quick-pay-submit';
 registerShortcut({
 id: payId,
 keys: ['Control', 'Enter'],
 description: 'Print & Pay',
 action: () => handlePayAndPrint(),
 scope: 'quick-pay'
 });

 // F10 Alternative
 const payIdF10 = 'quick-pay-submit-f10';
 registerShortcut({
 id: payIdF10,
 keys: ['F10'],
 description: 'Print & Pay',
 action: () => handlePayAndPrint(),
 scope: 'quick-pay'
 });

 return () => {
 unregisterShortcut(payId);
 unregisterShortcut(payIdF10);
 };
 }, [isOpen, items, itemName, amount]);

 const handleAddItem = () => {
 const numAmount = parseFloat(amount);
 if (!numAmount || numAmount <= 0) {
 addToast(t('pos.enter_valid_amount'), 'error');
 return;
 }

 if (!itemName.trim()) {
 addToast(t('pos.enter_item_name'), 'error');
 return;
 }

 // Manual Entry always Quantity 1
 const newItem: QuickPayItem = {
 id: Date.now(),
 name: itemName,
 quantity: 1,
 price: numAmount,
 total: numAmount
 };

 setItems([...items, newItem]);
 setItemName('');
 setAmount('');

 // Return focus to Name for rapid entry
 nameInputRef.current?.focus();
 };

 const handleRemoveItem = (id: number) => {
 setItems(items.filter(i => i.id !== id));
 };

 // Calculate Totals based on List
 const calculateTotals = () => {
 const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');
 const taxRate = businessDetails.taxRate || 15;

 let subTotal = 0;
 let taxAmount = 0;
 let grandTotal = 0;

 // Sum via 'total' property
 const totalItemAmount = items.reduce((sum, item) => sum + item.total, 0);

 if (taxOption === 'none') {
 subTotal = totalItemAmount;
 taxAmount = 0;
 grandTotal = totalItemAmount;
 } else if (taxOption === 'exclusive') {
 subTotal = totalItemAmount;
 taxAmount = totalItemAmount * (taxRate / 100);
 grandTotal = subTotal + taxAmount;
 } else if (taxOption === 'inclusive') {
 grandTotal = totalItemAmount;
 const base = grandTotal / (1 + (taxRate / 100));
 subTotal = Number(base.toFixed(2));
 taxAmount = grandTotal - subTotal;
 }

 return { subTotal, taxAmount, grandTotal, taxRate };
 };

 const { taxAmount, grandTotal } = calculateTotals();

 const handlePayAndPrint = async () => {
 if (items.length === 0) {
 if (itemName && amount) {
 const numAmount = parseFloat(amount);
 if (numAmount > 0) {
 const newItem: QuickPayItem = {
 id: Date.now(),
 name: itemName,
 quantity: 1,
 price: numAmount,
 total: numAmount
 };
 await processPayment([...items, newItem]);
 return;
 }
 }
 addToast(t('pos.add_at_least_one'), 'error');
 return;
 }
 await processPayment(items);
 };

 // Split logic for reuse
 const processPayment = async (currentItems: QuickPayItem[]) => {
  if (isLoading) return; // H17 Fix: Guard against double execution
  setIsLoading(true);

  try {
  const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');
  const currentTaxRate = businessDetails.taxRate || 15;

  const totalItemAmount = currentItems.reduce((sum, item) => sum + item.total, 0);
  let pSubTotal = 0, pTaxAmount = 0, pGrandTotal = 0;

  if (taxOption === 'none') {
  pSubTotal = Math.round(totalItemAmount * 100) / 100;
  pTaxAmount = 0;
  pGrandTotal = pSubTotal;
  } else if (taxOption === 'exclusive') {
  pSubTotal = Math.round(totalItemAmount * 100) / 100;
  pTaxAmount = Math.round(totalItemAmount * (currentTaxRate / 100) * 100) / 100; // M17 Fix
  pGrandTotal = Math.round((pSubTotal + pTaxAmount) * 100) / 100;
  } else if (taxOption === 'inclusive') {
  pGrandTotal = Math.round(totalItemAmount * 100) / 100;
  const base = pGrandTotal / (1 + (currentTaxRate / 100));
  pSubTotal = Math.round(base * 100) / 100; // M17 Fix
  pTaxAmount = Math.round((pGrandTotal - pSubTotal) * 100) / 100;
  }

  // 1. Create Invoice Items
  const invoiceItems: InvoiceItem[] = currentItems.map(item => {
  return {
  itemId: item.itemId || '', // '' for manual items
  name: item.name,
  quantity: item.quantity,
  price: Math.round(item.price * 100) / 100,
  total: Math.round(item.total * 100) / 100,
  taxRate: taxOption === 'none' ? 0 : currentTaxRate,
  taxType: taxOption === 'inclusive' ? 'inclusive' : 'exclusive'
  };
  });

  // 2. Create Invoice Record
  const { createRecordMetadata } = await import('../../services/db');
  
  const invoice = {
  ...createRecordMetadata(),
  branchId: activeBranchId,
  // H16 Fix: Use timestamp + random entropy to prevent collisions
  invoiceNumber: `QP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
  customerName: 'Quick Sale',
  items: invoiceItems,
  subTotal: pSubTotal,
  taxAmount: pTaxAmount,
  discountAmount: 0,
  grandTotal: pGrandTotal,
  paidAmount: pGrandTotal,
  remainingAmount: 0,
  paymentMode: paymentMode as any,
  paymentStatus: 'paid',
  status: 'paid',
  type: 'invoice',
  createdAt: new Date(),
  taxRate: currentTaxRate
  } as Invoice;

 const id = await db.invoices.add(invoice);

 try {
 const robustDetails = {
 name: businessDetails.name || 'My Shop',
 address: businessDetails.address || '',
 phone: businessDetails.phone || '',
 email: businessDetails.email || '',
 gstin: businessDetails.gstin || businessDetails.vatNo || '',
 logoUrl: businessDetails.logoUrl || '',
 country: businessDetails.country || '',
 taxName: businessDetails.taxName || 'VAT',
 taxRate: currentTaxRate,
 crNo: businessDetails.crNo || '',
 pincode: businessDetails.pincode || '',
 vatNo: businessDetails.vatNo || ''
 };

 // Print in background (Non-blocking)
 generateInvoicePDF({ ...invoice, id }, robustDetails).catch(e => {
 console.error('Print failed:', e);
 addToast(t('pos.print_failed') || 'Print failed', 'error'); 
 });

 // Removed explicit success toast for print as per user request to reduce messages

 addToast(t('pos.payment_recorded_success') || 'Payment Recorded!', 'success');
 } catch (setupError) {
 console.error(setupError);
 addToast('Payment setup failed', 'error');
 }

 // 4. Reset & Close
 setItems([]);
 setItemName('');
 setAmount('');
 setTaxOption('exclusive');
 onClose();

 } catch (error) {
 console.error(error);
 addToast(t('pos.failed_record_payment'), 'error');
 } finally {
 setIsLoading(false);
 }
 };


 return (
 <Modal isOpen={isOpen} onClose={onClose} title={t('sales.quick_payment')}>
 <div className="space-y-4 p-4">

 {/* Input Area */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.item_description')}</label>
 <div className="flex gap-2">
 <input
 ref={nameInputRef}
 type="text"
 placeholder={t('common.placeholder_item')}
 value={itemName}
 onChange={e => setItemName(e.target.value)}
 onKeyDown={e => {
 if (e.key === 'Enter') {
 e.preventDefault();
 amountInputRef.current?.focus();
 }
 }}
 className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none"
 />
 {Capacitor.isNativePlatform() && settings?.scannerType !== 'hardware' && (
 <button
 type="button"
 onClick={async () => {
 try {
 await BarcodeScanner.requestPermissions();
 const result = await BarcodeScanner.scan();
 if (result.barcodes.length > 0) {
 const rawVal = result.barcodes[0].rawValue;
 if (rawVal) {
 await handleBarcodeScan(rawVal);
 }
 }
 } catch (err) {
 addToast('Camera scan failed', 'error');
 }
 }}
 className="bg-slate-800 dark:bg-slate-700 text-white px-3 py-2 rounded-lg"
 >
 <ScanBarcode size={20} />
 </button>
 )}
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.amount')}</label>
 <div className="flex gap-2">
 <div className="relative flex-1">
 <span className="absolute left-3 top-2 text-slate-700 dark:text-slate-300 font-bold">{settings?.currency || '$'}</span>
 <input
 ref={amountInputRef}
 type="number"
 step="0.01"
 placeholder={t('common.placeholder_amount')}
 value={amount}
 onChange={e => setAmount(e.target.value)}
 onKeyDown={e => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleAddItem(); // This resets state and focuses Name ref
 }
 }}
 className="w-full pl-8 pr-3 py-2 font-bold border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none"
 />
 </div>
 <button
 type="button"
 onClick={() => handleAddItem()}
 className="bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white px-4 py-2 rounded-lg font-bold"
 >
 {t('common.add')}
 </button>
 </div>
 </div>
 </div>

 {/* Items List */}
 {items.length > 0 && (
 <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
 <th className="text-left pb-2">{t('sales.items')}</th>
 <th className="text-center pb-2 w-20">{t('pos.qty')}</th>
 <th className="text-right pb-2 w-24">{t('pos.price')}</th>
 <th className="text-right pb-2 w-24">{t('sales.total')}</th>
 <th className="w-8 pb-2"></th>
 </tr>
 </thead>
 <tbody>
 {items.map((item) => (
 <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-700">
 <td className="py-2 dark:text-slate-200 font-medium">
 {item.name}
 {item.itemId && <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-1 py-0.5 rounded">DB</span>}
 </td>
 <td className="py-2 text-center text-slate-600 dark:text-slate-300">{item.quantity}</td>
 <td className="py-2 text-right text-slate-600 dark:text-slate-300 text-xs">
 {formatCurrency(item.price)}
 </td>
 <td className="py-2 text-right font-mono font-bold dark:text-slate-200">
 {formatCurrency(item.total)}
 </td>
 <td className="py-2 text-right">
 <button type="button"
 onClick={() => handleRemoveItem(item.id)}
 className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg"
 title="Remove"
 >
 &times;
 </button>
 </td>
 </tr>
))}
 </tbody>
 </table>
 </div>
)}

 <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>

 {/* Tax Option */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.vat_calculation')}</label>
 <div className="grid grid-cols-3 gap-2">
 {(['exclusive', 'inclusive', 'none'] as TaxOption[]).map(opt => (
 <button
 key={opt}
 type="button"
 onClick={() => setTaxOption(opt)}
 className={`px-2 py-2 text-xs font-medium rounded-lg border ${taxOption === opt
 ? 'bg-yellow-100 border-yellow-400 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
 }`}
 >
 {t(`settings.${opt}`)}
 </button>
))}
 </div>
 </div>

 {/* Payment Mode */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.payment_mode')}</label>
 <div className="grid grid-cols-3 gap-2">
 {['cash', 'card', 'upi'].map(mode => (
 <button
 key={mode}
 type="button"
 onClick={() => setPaymentMode(mode as any)}
 className={`px-2 py-2 text-xs font-medium rounded-lg border capitalize ${paymentMode === mode
 ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white '
 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
 }`}
 >
 {t(`payment.${mode}`)}
 </button>
))}
 </div>
 </div>

 {/* Summary & Action */}
 <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg flex justify-between items-center">
 <div className="text-sm">
 <div className="text-slate-700">{t('sales.total_items')}: {items.length}</div>
 <div className="font-bold text-lg dark:text-white">{t('sales.total')}: {formatCurrency(grandTotal)}</div>
 {taxAmount > 0 && <div className="text-xs text-slate-600">({t('sales.tax_included')}: {taxAmount.toFixed(2)})</div>}
 </div>
 <button type="button"
 ref={payButtonRef}
 onClick={handlePayAndPrint}
 disabled={isLoading || items.length === 0}
 title="Shortcut: Ctrl+Enter or F10"
 className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isLoading ? (
 <span>{t('common.processing')}...</span>
) : (
 <>
 <Zap size={20} className="fill-white"/> {t('sales.pay_print')}
 </>
)}
 </button>
 </div>

 </div>
 </Modal>
);
};

export default QuickPaymentModal;

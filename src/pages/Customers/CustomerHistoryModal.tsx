import React, { useState, useEffect } from 'react';
import { 
 FileText, Printer, Clock, CreditCard, Receipt, 
 Sparkles, TrendingUp, TrendingDown, History, Search,
 Filter, ChevronDown, Calendar, ArrowUpRight
} from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { db, type Invoice, type CustomerPayment } from '../../services/db';
import { generateInvoicePDF } from '../../services/invoiceGenerator';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useNotification } from '../../contexts/NotificationContext';

interface CustomerHistoryModalProps {
 customerId: string;
 onClose: () => void;
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({ customerId, onClose }) => {
 const { t } = useTranslation();
 const { settings, formatCurrency, formatDate } = useSettings();
 const { addToast } = useNotification();
 const [invoices, setInvoices] = useState<Invoice[]>([]);
 const [payments, setPayments] = useState<CustomerPayment[]>([]);
 const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'stats'>('invoices');
 const [loading, setLoading] = useState(true);
 const [customerName, setCustomerName] = useState('');
 const [balance, setBalance] = useState(0);
 const [searchQuery, setSearchQuery] = useState('');

 useEffect(() => {
 const loadHistory = async () => {
 try {
 const customer = await db.customers.get(customerId);
 setCustomerName(customer?.name || 'Customer');
 setBalance(customer?.balance || 0);

 const fetchedInvoices = await db.invoices.where('customerId').equals(customerId).toArray();
 const fetchedPayments = await db.customerPayments.where('customerId').equals(customerId).toArray();

 // Sort by date descending
 fetchedInvoices.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 fetchedPayments.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

 setInvoices(fetchedInvoices);
 setPayments(fetchedPayments);

 } catch (error) {
 console.error("Failed to load history", error);
 addToast("Failed to load customer history.","error");
 } finally {
 setLoading(false);
 }
 };
 loadHistory();
 }, [customerId]);

 const handlePrintInvoice = async (invoice: Invoice) => {
 const savedBusiness = localStorage.getItem('businessDetails');
 const business = savedBusiness ? JSON.parse(savedBusiness) : {};
 await generateInvoicePDF(invoice, business);
 };

 const totalInvoiced = React.useMemo(() => invoices.reduce((sum, i) => sum + i.grandTotal, 0), [invoices]);
 const totalPaid = React.useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);

 const filteredContent = React.useMemo(() => {
 if (activeTab === 'invoices') {
 return invoices.filter(inv => inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()));
 }
 if (activeTab === 'payments') {
 return payments.filter(p => p.note?.toLowerCase().includes(searchQuery.toLowerCase()) || p.paymentMode?.toLowerCase().includes(searchQuery.toLowerCase()));
 }
 return [];
 }, [activeTab, invoices, payments, searchQuery]);

 return (
 <Modal isOpen={true} onClose={onClose} title={t('customers.history_title', { name: customerName })} maxWidth="5xl">
 <div className="flex flex-col h-[80vh] overflow-hidden bg-slate-50 dark:bg-slate-950">
 {/* Stats Ribbon */}
 <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
 <div className="bg-indigo-500 dark:bg-indigo-500 border border-indigo-500/20 p-4 rounded-2xl flex items-center gap-4">
 <div className="p-3 bg-indigo-500 text-white rounded-xl">
 <TrendingUp size={18} />
 </div>
 <div>
 <p className="text-[9px] font-semibold text-indigo-500 uppercase tracking-wider">{t('customers.total_invoiced')}</p>
 <p className="text-lg font-semibold dark:text-white tracking-tight">{formatCurrency(totalInvoiced)}</p>
 </div>
 </div>
 
 <div className="bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4">
 <div className="p-3 bg-emerald-500 text-white rounded-xl">
 <TrendingDown size={18} />
 </div>
 <div>
 <p className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">{t('customers.total_paid')}</p>
 <p className="text-lg font-semibold dark:text-white tracking-tight">{formatCurrency(totalPaid)}</p>
 </div>
 </div>

 <div className={clsx(
"border p-4 rounded-2xl flex items-center gap-4",
 balance > 0 
 ?"bg-rose-500/10 border-rose-500/20"
 :"bg-slate-500 border-slate-500/20"
)}>
 <div className={clsx(
"p-3 text-white rounded-xl",
 balance > 0 ?"bg-rose-500":"bg-slate-500"
)}>
 <CreditCard size={18} />
 </div>
 <div>
 <p className={clsx(
"text-[9px] font-semibold uppercase tracking-wider",
 balance > 0 ?"text-rose-500":"text-slate-700"
)}>{t('customers.current_balance')}</p>
 <p className={clsx(
"text-lg font-semibold tracking-tight",
 balance > 0 ?"text-rose-500":"dark:text-white"
)}>{formatCurrency(balance)}</p>
 </div>
 </div>
 </div>

 {/* Tabs & Search Header */}
 <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
 <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl w-full md:w-auto">
 {[
 { id: 'invoices', label: t('customers.invoices'), icon: Receipt, count: invoices.length },
 { id: 'payments', label: t('customers.payments'), icon: CreditCard, count: payments.length },
 { id: 'stats', label: t('common.overview') || 'Overview', icon: Sparkles }
 ].map((tab) => (
 <button type="button"
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={clsx(
"flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-semibold uppercase tracking-wider",
 activeTab === tab.id 
 ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400' 
 : 'text-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
)}
 >
 <tab.icon size={14} />
 <span>{tab.label}</span>
 {tab.count !== undefined && (
 <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[8px]">{tab.count}</span>
)}
 </button>
))}
 </div>

 {activeTab !== 'stats' && (
 <div className="relative flex-1 md:max-w-xs group w-full">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500"size={14} />
 <input
 type="text"
 placeholder={t('common.search')}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 rounded-lg font-bold text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 dark:text-white"
 />
 </div>
)}
 </div>

 {/* Content Area */}
 <div className="flex-1 overflow-auto p-6 space-y-4">
 <>
 {loading ? (
 <div className="flex flex-col items-center justify-center h-full gap-4">
 <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"/>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('common.loading')}</p>
 </div>
) : activeTab === 'stats' ? (
 <div
 
 
 className="grid grid-cols-1 md:grid-cols-2 gap-6"
 >
 <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-white/50 dark:border-slate-700/30">
 <h4 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-6 flex items-center gap-2">
 <History size={14} className="text-indigo-500"/>
 {t('customers.history_summary') || 'Lifetime Activity'}
 </h4>
 <div className="space-y-6">
 <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
 <span className="text-xs font-bold text-slate-700">{t('customers.total_invoices') || 'Total Orders'}</span>
 <span className="text-lg font-semibold dark:text-white">{invoices.length}</span>
 </div>
 <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
 <span className="text-xs font-bold text-slate-700">{t('customers.total_payments') || 'Total Payments'}</span>
 <span className="text-lg font-semibold dark:text-white">{payments.length}</span>
 </div>
 </div>
 </div>
 </div>
) : (
 <div className="space-y-4">
 {filteredContent.map((item: any, idx) => {
 const isInvoice = activeTab === 'invoices';
 return (
 <div
 key={item.id}
 
 
 
 className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center justify-between group hover:border-indigo-500/30"
 >
 <div className="flex items-center gap-5">
 <div className={clsx(
"w-12 h-12 rounded-xl flex items-center justify-center",
 isInvoice ?"bg-indigo-500 text-indigo-600":"bg-emerald-500/10 text-emerald-600"
)}>
 {isInvoice ? <Receipt size={20} /> : <CreditCard size={20} />}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h5 className="font-semibold dark:text-white uppercase tracking-tight">
 {isInvoice ?`#${item.invoiceNumber}`: t('customers.payment_received') || 'Payment Received'}
 </h5>
 {isInvoice && (
 <span className={clsx(
"text-[7px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
 item.paymentStatus === 'paid' ?"bg-emerald-500/10 text-emerald-500":"bg-rose-500/10 text-rose-500"
)}>
 {item.paymentStatus}
 </span>
)}
 </div>
 <div className="flex items-center gap-3 mt-1">
 <p className="text-[9px] font-bold text-slate-600 flex items-center gap-1">
 <Calendar size={10} />
 {formatDate(isInvoice ? item.createdAt : item.date)}
 </p>
 {item.paymentMode && (
 <span className="text-[8px] font-semibold text-slate-600 uppercase bg-slate-100 dark:bg-slate-900 px-1.5 rounded">{item.paymentMode}</span>
)}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-6">
 <div className="text-right">
 <p className="text-[8px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{t('common.amount')}</p>
 <p className={clsx(
"text-lg font-semibold tracking-tight",
 isInvoice ?"text-slate-900 dark:text-white":"text-emerald-500"
)}>
 {isInvoice ? '' : '+'}{formatCurrency(isInvoice ? item.grandTotal : item.amount)}
 </p>
 </div>
 {isInvoice && (
 <button type="button"
 
 
 onClick={() => handlePrintInvoice(item)}
 className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-indigo-600 hover:bg-indigo-600 hover:text-white"
 >
 <Printer size={16} />
 </button>
)}
 </div>
 </div>
);
 })}

 {filteredContent.length === 0 && (
 <div className="py-20 text-center opacity-50">
 <History size={48} className="mx-auto mb-4 text-slate-300"/>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('common.no_results')}</p>
 </div>
)}
 </div>
)}
 </>
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
 <button type="button"
 className="flex items-center gap-2 text-rose-500 font-semibold text-[10px] uppercase tracking-wider hover:opacity-70"
 >
 <FileText size={16} />
 {t('customers.export_pdf')}
 </button>
 
 <button type="button"
 onClick={onClose}
 className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-semibold text-[10px] uppercase tracking-wider"
 >
 {t('common.close')}
 </button>
 </div>
 </div>
 </Modal>
);
};

export default CustomerHistoryModal;

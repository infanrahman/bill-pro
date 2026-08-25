import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
 ArrowLeft, Phone, Mail, MapPin, Building, FileText, 
 RotateCcw, CreditCard, Receipt, Clock, Sparkles, Filter,
 ChevronDown, Search, ArrowUpRight, TrendingDown, History
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotification } from '../../contexts/NotificationContext';
import clsx from 'clsx';
import Modal from '../../components/UI/Modal';

const SupplierDetails = () => {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const { t } = useTranslation();
 const { formatCurrency, formatDate } = useSettings();
 const { addToast } = useNotification();
 const supplierId = id!;

 const [searchQuery, setSearchQuery] = React.useState('');
 const [sortBy, setSortBy] = React.useState<string>('date_desc');
 const [activeTab, setActiveTab] = React.useState<'bills' | 'history'>('bills');
 const [selectedBill, setSelectedBill] = React.useState<any>(null);
 const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);

 // Payment Form State
 const [payAmount, setPayAmount] = React.useState('');
 const [payDate, setPayDate] = React.useState(new Date().toISOString().split('T')[0]);
 const [payMode, setPayMode] = React.useState('cash');
 const [payNote, setPayNote] = React.useState('');

 const supplier = useLiveQuery(() => db.suppliers.get(supplierId), [supplierId]);

 const purchases = useLiveQuery(() =>
 db.purchases.where('supplierId').equals(supplierId).reverse().sortBy('date'),
 [supplierId]);

 const payments = useLiveQuery(() =>
 db.purchasePayments.where('supplierId').equals(supplierId).reverse().sortBy('date'),
 [supplierId]);

 const history = React.useMemo(() => {
 return [...(purchases || []), ...(payments || [])];
 }, [purchases, payments]);

 const filteredHistory = React.useMemo(() => {
 let items = [...history];

 if (searchQuery) {
 const lower = searchQuery.toLowerCase();
 items = items.filter(item => {
 const isPayment = 'paymentMode' in item;
 if (isPayment) {
 return item.reference?.toLowerCase().includes(lower) || item.note?.toLowerCase().includes(lower);
 } else {
 return item.orderNumber?.toLowerCase().includes(lower) || item.notes?.toLowerCase().includes(lower);
 }
 });
 }

 items.sort((a: any, b: any) => {
 if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
 if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
 if (sortBy === 'amount_desc') {
 const amtA = 'amount' in a ? a.amount : a.totalAmount;
 const amtB = 'amount' in b ? b.amount : b.totalAmount;
 return amtB - amtA;
 }
 if (sortBy === 'amount_asc') {
 const amtA = 'amount' in a ? a.amount : a.totalAmount;
 const amtB = 'amount' in b ? b.amount : b.totalAmount;
 return amtA - amtB;
 }
 return 0;
 });

 return items;
 }, [history, searchQuery, sortBy]);

 const outstandingBills = React.useMemo(() => {
 return purchases?.filter((p: any) => !p.type || p.type === 'bill').filter((p: any) => {
 const paid = p.paidAmount || 0;
 return (p.totalAmount - paid) > 0.01;
 }) || [];
 }, [purchases]);

 const filteredBills = React.useMemo(() => {
 let bills = [...outstandingBills];

 if (searchQuery) {
 const lower = searchQuery.toLowerCase();
 bills = bills.filter(b => 
 b.orderNumber?.toLowerCase().includes(lower) || 
 b.notes?.toLowerCase().includes(lower)
);
 }

 bills.sort((a: any, b: any) => {
 if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
 if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
 if (sortBy === 'amount_desc') return b.totalAmount - a.totalAmount;
 if (sortBy === 'amount_asc') return a.totalAmount - b.totalAmount;
 if (sortBy === 'balance_desc') {
 const dueA = a.totalAmount - (a.paidAmount || 0);
 const dueB = b.totalAmount - (b.paidAmount || 0);
 return dueB - dueA;
 }
 if (sortBy === 'balance_asc') {
 const dueA = a.totalAmount - (a.paidAmount || 0);
 const dueB = b.totalAmount - (b.paidAmount || 0);
 return dueA - dueB;
 }
 return 0;
 });

 return bills;
 }, [outstandingBills, searchQuery, sortBy]);

 const handleOpenPayment = (bill: any) => {
 setSelectedBill(bill);
 const due = bill.totalAmount - (bill.paidAmount || 0);
 setPayAmount(due.toString());
 setPayDate(new Date().toISOString().split('T')[0]);
 setPayMode('cash');
 setPayNote('');
 setIsPaymentModalOpen(true);
 };

 const handleSavePayment = async () => {
 if (!selectedBill || !payAmount) return;
 const amount = parseFloat(payAmount);
 if (isNaN(amount) || amount <= 0) {
 addToast(t('pos.invalid_amount'), 'error');
 return;
 }

 try {
 await db.transaction('rw', [db.purchases, db.purchasePayments, db.suppliers], async () => {
 await db.purchasePayments.add({
 ...createRecordMetadata(),
 purchaseId: selectedBill.id,
 supplierId: supplierId,
 amount: amount,
 date: new Date(payDate),
 paymentMode: payMode as any,
 note: payNote,
 reference: selectedBill.orderNumber
 });

 const newPaid = (selectedBill.paidAmount || 0) + amount;
 const newStatus = newPaid >= selectedBill.totalAmount - 0.01 ? 'completed' : 'pending';

 await db.purchases.update(selectedBill.id, {
 ...updateRecordMetadata(),
 paidAmount: newPaid,
 status: newStatus
 });

 const currentSup = await db.suppliers.get(supplierId);
 if (currentSup) {
 await db.suppliers.update(supplierId, {
 ...updateRecordMetadata(),
 balance: currentSup.balance - amount
 });
 }
 });

 addToast(t('purchases.payment_recorded'), 'success');
 setIsPaymentModalOpen(false);
 } catch (e) {
 console.error(e);
 addToast(t('common.error'), 'error');
 }
 };

 if (!supplier) return (
 <div className="flex items-center justify-center h-96">
 <div className="w-12 h-12 border-4 border-slate-900 dark:border-white border-t-transparent rounded-full"/>
 </div>
);

 return (
 <div className="space-y-6 md:space-y-8 pb-10">
 {/* Header Bar */}
 <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden group">
 
 
 <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 md:gap-8 relative z-10">
 <div className="flex items-center gap-4 md:gap-6">
 <button type="button"
 
 
 onClick={() => navigate('/suppliers')}
 className="p-3 md:p-4 bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-600 hover:text-slate-900 dark:hover:text-white shrink-0"
 >
 <ArrowLeft size={24} className="w-5 h-5 md:w-6 md:h-6" />
 </button>
 <div>
 <h1 className="text-xl md:text-3xl font-semibold dark:text-white tracking-tight uppercase line-clamp-1">{supplier.name}</h1>
 <p className="text-slate-700 dark:text-slate-300 font-bold mt-1 text-[10px] uppercase tracking-wider flex items-center gap-2">
 <Building size={12} className="text-slate-900 dark:text-white"/>
 {t('suppliers.title')} / {t('common.details')}
 </p>
 </div>
 </div>

 <div className="bg-rose-500/10 dark:bg-rose-500/5 border border-rose-500/20 p-4 md:p-5 rounded-xl md:rounded-2xl flex items-center gap-4 md:gap-6 w-full md:w-auto">
 <div className="p-3 md:p-4 bg-rose-500 text-white rounded-xl md:rounded-2xl shrink-0">
 <TrendingDown size={24} className="w-5 h-5 md:w-6 md:h-6" />
 </div>
 <div>
 <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-1">{t('purchases.balance_due')}</p>
 <p className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
 {formatCurrency(supplier.balance)}
 </p>
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
 {/* Left Side: Contact Info */}
 <div className="lg:col-span-1 space-y-6">
 <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-white/50 dark:border-slate-700/30">
 <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-8 flex items-center gap-3">
 <Sparkles size={14} className="text-slate-900 dark:text-white"/>
 {t('common.contact_info')}
 </h3>
 
 <div className="space-y-6">
 {[
 { icon: Phone, label: t('suppliers.phone'), value: supplier.phone, color: 'blue' },
 { icon: Mail, label: t('suppliers.email'), value: supplier.email || '---', color: 'indigo' },
 { icon: Building, label: t('suppliers.tax_id'), value: supplier.taxNumber || '---', color: 'emerald' },
 { icon: MapPin, label: t('suppliers.location'), value: supplier.location || '---', color: 'rose' }
 ].map((info, i) => (
 <div key={i} className="group/info">
 <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-2 ml-1">{info.label}</p>
 <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 group-hover/info:border-slate-900/30 dark:group-hover/info:border-white/30">
 <info.icon size={16} className="text-slate-600 group-hover/info:text-slate-900 dark:group-hover/info:text-white"/>
 <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{info.value}</span>
 </div>
 </div>
))}
 </div>
 </div>
 </div>

 {/* Right Side: Bills & History */}
 <div className="lg:col-span-3 space-y-6">
 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
 <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl md:rounded-2xl w-full xl:w-auto overflow-x-auto custom-scrollbar">
 {[
 { id: 'bills', label: t('purchases.outstanding_bills'), icon: Receipt, count: outstandingBills.length },
 { id: 'history', label: t('common.history'), icon: History, count: history.length }
 ].map((tab) => (
 <button type="button"
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={clsx(
 "flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
 activeTab === tab.id 
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
 : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-200'
 )}
 >
 <tab.icon size={14} />
 <span>{tab.label}</span>
 <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[8px]">{tab.count}</span>
 </button>
 ))}
 </div>

 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full xl:w-auto">
 <div className="relative flex-1 group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white" size={16} />
 <input
 type="text"
 placeholder={t('common.search')}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-12 pr-4 py-2.5 md:py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-lg md:rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
 />
 </div>
 <div className="relative group shrink-0">
 <select 
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value)}
 className="w-full sm:w-auto appearance-none pl-10 pr-10 py-2.5 md:py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-lg md:rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white cursor-pointer"
 >
 <option value="date_desc">{t('common.date_desc')}</option>
 <option value="date_asc">{t('common.date_asc')}</option>
 <option value="amount_desc">{t('common.amount_desc')}</option>
 <option value="amount_asc">{t('common.amount_asc')}</option>
 </select>
 <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
 <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
 </div>
 </div>
 </div>

 {/* Content List */}
 <div className="space-y-4">
 <>
 {(activeTab === 'bills' ? filteredBills : filteredHistory).map((item: any, idx) => {
 const isPayment = 'paymentMode' in item;
 const isReturn = !isPayment && item.type === 'return';
 const due = !isPayment ? (item.totalAmount - (item.paidAmount || 0)) : 0;

 return (
 <div
 key={`${isPayment ? 'pay' : 'po'}-${item.id}`}
 
 
 
 className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-white/50 dark:border-slate-700/30 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-slate-900/30 dark:hover:border-white/30 group"
 >
 <div className="flex items-center gap-6 flex-1">
 <div className={clsx(
"w-14 h-14 rounded-2xl flex items-center justify-center",
 isPayment ?"bg-emerald-500/10 text-emerald-600": 
 isReturn ?"bg-amber-500/10 text-amber-600":"bg-slate-900 dark:bg-white text-white"
)}>
 {isPayment ? <CreditCard size={24} /> : isReturn ? <RotateCcw size={24} /> : <Receipt size={24} />}
 </div>
 <div>
 <div className="flex items-center gap-3">
 <h4 className="text-lg font-semibold dark:text-white tracking-tight uppercase">
 {isPayment ? t('purchases.payment') : item.orderNumber}
 </h4>
 <span className={clsx(
"text-[8px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
 isPayment ?"bg-emerald-500/10 text-emerald-500": 
 isReturn ?"bg-amber-500/10 text-amber-500":"bg-slate-900 dark:bg-white text-white"
)}>
 {isPayment ? item.paymentMode : isReturn ? t('purchases.return') : t('purchases.bill')}
 </span>
 </div>
 <div className="flex items-center gap-4 mt-1">
 <p className="text-[10px] font-bold text-slate-600 flex items-center gap-2">
 <Clock size={12} />
 {formatDate(item.date)}
 </p>
 {item.reference && (
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-tight bg-slate-100 dark:bg-slate-900 px-2 rounded">
 REF: {item.reference}
 </p>
)}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-10">
 <div className="text-right">
 <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{t('common.amount')}</p>
 <p className={clsx(
"text-xl font-semibold tracking-tight",
 isPayment || isReturn ? 'text-emerald-500' : 'text-rose-500'
)}>
 {(isPayment || isReturn) ? '-' : '+'}{formatCurrency(isPayment ? item.amount : item.totalAmount)}
 </p>
 </div>

 {activeTab === 'bills' && !isPayment && !isReturn && due > 0 && (
 <button type="button"
 
 
 onClick={() => handleOpenPayment(item)}
 className="px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-semibold text-[10px] uppercase tracking-wider"
 >
 {t('purchases.pay_now')}
 </button>
)}
 </div>
 </div>
);
 })}
 </>

 {(activeTab === 'bills' ? filteredBills : filteredHistory).length === 0 && (
 <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/50">
 <FileText size={64} strokeWidth={1} className="mx-auto mb-4 text-slate-300"/>
 <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{t('common.no_results')}</p>
 </div>
)}
 </div>
 </div>
 </div>

 {/* Payment Modal */}
 <Modal
 isOpen={isPaymentModalOpen}
 onClose={() => setIsPaymentModalOpen(false)}
 title={t('purchases.record_payment')}
 >
 <div className="p-8 space-y-6">
 <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
 <div className="flex justify-between items-center mb-4">
 <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('purchases.bill_no')}</span>
 <span className="text-sm font-semibold dark:text-white uppercase">{selectedBill?.orderNumber}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('purchases.balance_due')}</span>
 <span className="text-2xl font-semibold text-rose-500 tracking-tight">{formatCurrency(parseFloat(payAmount) || 0)}</span>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('common.amount')}</label>
 <div className="relative">
 <input
 type="number"
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-semibold text-xl dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 value={payAmount}
 onChange={e => setPayAmount(e.target.value)}
 autoFocus
 />
 </div>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('common.date')}</label>
 <input
 type="date"
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 value={payDate}
 onChange={e => setPayDate(e.target.value)}
 />
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('purchases.payment_mode')}</label>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {[
 { id: 'cash', label: t('pos.pay_cash') },
 { id: 'card', label: t('pos.pay_card') },
 { id: 'upi', label: t('pos.pay_digital') },
 { id: 'bank_transfer', label: t('pos.pay_bank') }
 ].map((m) => (
 <button type="button"
 key={m.id}
 onClick={() => setPayMode(m.id)}
 className={clsx(
"p-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider border",
 payMode === m.id 
 ? 'bg-slate-900 dark:bg-white border-transparent text-white ' 
 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
)}
 >
 {m.label}
 </button>
))}
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('common.notes')}</label>
 <textarea
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 rows={2}
 value={payNote}
 onChange={e => setPayNote(e.target.value)}
 placeholder={t('common.notes_placeholder')}
 />
 </div>

 <div className="flex gap-4 pt-4">
 <button type="button"
 onClick={() => setIsPaymentModalOpen(false)}
 className="flex-1 px-8 py-4 text-slate-600 hover:text-slate-900 dark:hover:text-white font-semibold text-xs uppercase tracking-wider"
 >
 {t('common.cancel')}
 </button>
 <button type="button"
 
 
 onClick={handleSavePayment}
 className="flex-1 px-8 py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-semibold text-xs uppercase tracking-wider"
 >
 {t('common.save')}
 </button>
 </div>
 </div>
 </Modal>
 </div>
);
};

export default SupplierDetails;

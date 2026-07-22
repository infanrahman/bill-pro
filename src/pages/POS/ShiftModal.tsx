import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Banknote, CreditCard, Smartphone, Clock, CheckCircle2 } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { useSettings } from '../../contexts/SettingsContext';
import { shiftService } from '../../services/shiftService';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../services/db';

interface ShiftModalProps {
 isOpen: boolean;
 mode: 'open' | 'close';
 onClose: (success?: boolean) => void;
}

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, mode, onClose }) => {
 const { t } = useTranslation();
 const { formatCurrency } = useSettings();
 const { user } = useAuth();
 const { addToast } = useNotification();

 const [floatAmount, setFloatAmount] = useState<string>('');
 const [actualCash, setActualCash] = useState<string>('');
 const [isProcessing, setIsProcessing] = useState(false);
 const [summary, setSummary] = useState<any>(null);

 const branchId = localStorage.getItem('currentBranchId') || '00000000-0000-0000-0000-000000000000';

 useEffect(() => {
 if (isOpen && mode === 'close' && user) {
 loadSummary();
 }
 }, [isOpen, mode]);

 const loadSummary = async () => {
 if (!user) return;
 const currentShift = await shiftService.getCurrentShift(user.id, branchId);
 if (currentShift) {
 const invoices = await db.invoices.where('shiftId').equals(currentShift.id).toArray();
 let cash = 0, card = 0, upi = 0, credit = 0;
 invoices.forEach(inv => {
 if (inv.paymentMode === 'cash') cash += inv.grandTotal;
 else if (inv.paymentMode === 'card') card += inv.grandTotal;
 else if (inv.paymentMode === 'upi') upi += inv.grandTotal;
 else if (inv.paymentMode === 'credit') credit += inv.grandTotal;
 });

 const cashEntries = await db.cashEntries
 .where('branchId').equals(currentShift.branchId)
 .filter(entry => entry.date >= currentShift.openTime && (!currentShift.closeTime || entry.date <= currentShift.closeTime))
 .toArray();

 let netCashEntries = 0;
 cashEntries.forEach(entry => {
 if (entry.type === 'in') netCashEntries += entry.amount;
 else netCashEntries -= entry.amount;
 });

 setSummary({
 shift: currentShift,
 cashSales: cash,
 cardSales: card,
 upiSales: upi,
 creditSales: credit,
 expectedTotal: currentShift.openingFloat + cash + netCashEntries
 });
 }
 };

 const handleOpenShift = async () => {
 if (!user) return;
 setIsProcessing(true);
 try {
 await shiftService.openShift(user.id, user.username, branchId, parseFloat(floatAmount) || 0);
 addToast(t('pos.shift_opened', { defaultValue: 'Shift opened successfully' }), 'success');
 onClose(true);
 } catch (error) {
 addToast(t('common.error'), 'error');
 } finally {
 setIsProcessing(false);
 }
 };

 const handleCloseShift = async () => {
 if (!summary?.shift) return;
 setIsProcessing(true);
 try {
 await shiftService.closeShift(summary.shift.id, parseFloat(actualCash) || 0);
 addToast(t('pos.shift_closed', { defaultValue: 'Shift closed successfully' }), 'success');
 onClose(true);
 } catch (error) {
 addToast(t('common.error'), 'error');
 } finally {
 setIsProcessing(false);
 }
 };

 return (
 <Modal 
 isOpen={isOpen} 
 onClose={() => mode === 'close' ? onClose() : null} // Prevent closing when opening shift (forced)
 title={mode === 'open' ? t('pos.open_shift', { defaultValue: 'Start New Shift' }) : t('pos.close_shift', { defaultValue: 'Close Working Shift' })}
 maxWidth="md"
 >
 <div className="p-6">
 {mode === 'open' ? (
 <div className="space-y-6">
 <div className="flex flex-col items-center text-center space-y-2 mb-4">
 <div className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-full">
 <Unlock size={32} />
 </div>
 <h3 className="text-lg font-bold dark:text-white">{t('pos.ready_to_sell', { defaultValue: 'Ready to start selling?' })}</h3>
 <p className="text-sm text-slate-700">{t('pos.enter_float_desc', { defaultValue: 'Please enter the starting cash amount in your drawer.' })}</p>
 </div>

 <div>
 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">{t('pos.opening_float', { defaultValue: 'Opening Float (Cash)' })}</label>
 <div className="relative">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">
 <Banknote size={20} />
 </div>
 <input 
 type="number"
 value={floatAmount}
 onChange={(e) => setFloatAmount(e.target.value)}
 placeholder="0.00"
 className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-xl font-bold dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:outline-none"
 autoFocus
 />
 </div>
 </div>

 <button type="button"
 onClick={handleOpenShift}
 disabled={isProcessing}
 className="w-full bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 group"
 >
 {t('pos.start_shift', { defaultValue: 'Start Shift' })}
 <CheckCircle2 size={20} className="group-"/>
 </button>
 </div>
) : (
 <div className="space-y-6">
 {summary && (
 <>
 <div className="grid grid-cols-2 gap-4">
 <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50">
 <p className="text-[10px] font-semibold uppercase text-slate-600 tracking-wider">{t('pos.opening_float')}</p>
 <p className="text-lg font-bold dark:text-white mt-1">{formatCurrency(summary.shift.openingFloat)}</p>
 </div>
 <div className="p-4 bg-green-50/50 dark:bg-green-900/10 rounded-2xl border border-green-100/50 dark:border-green-800/30">
 <p className="text-[10px] font-semibold uppercase text-green-600 dark:text-green-500 tracking-wider">{t('pos.cash_sales')}</p>
 <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1">+{formatCurrency(summary.cashSales)}</p>
 </div>
 </div>

 <div className="bg-white dark:bg-slate-800 rounded-3xl premium-shadow p-6 border border-slate-100 dark:border-slate-700">
 <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-4">{t('pos.shift_reconciliation', { defaultValue: 'Financial Reconciliation' })}</h4>
 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('pos.expected_cash', { defaultValue: 'Expected Cash in Drawer' })}</span>
 <span className="text-lg font-semibold dark:text-white">{formatCurrency(summary.expectedTotal)}</span>
 </div>

 <div>
 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">{t('pos.actual_cash', { defaultValue: 'Actual Cash Count' })}</label>
 <input 
 type="number"
 value={actualCash}
 onChange={(e) => setActualCash(e.target.value)}
 placeholder="Count the money in drawer..."
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-xl font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:outline-none"
 />
 </div>

 {actualCash && (
 <div className={`p-4 rounded-xl flex items-center justify-between ${parseFloat(actualCash) === summary.expectedTotal ? 'bg-green-50 text-green-700 dark:bg-green-900/20' : 'bg-red-50 text-red-700 dark:bg-red-900/20'}`}>
 <span className="text-xs font-bold uppercase">{t('pos.variance', { defaultValue: 'Variance' })}</span>
 <span className="font-semibold text-lg">
 {formatCurrency(parseFloat(actualCash) - summary.expectedTotal)}
 </span>
 </div>
)}
 </div>
 </div>

 <div className="space-y-4">
 <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">{t('pos.other_payments', { defaultValue: 'Other Payments' })}</h4>
 <div className="grid grid-cols-3 gap-3">
 <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
 <CreditCard size={14} className="text-slate-600 mb-1"/>
 <p className="text-[10px] font-bold text-slate-700 uppercase">{t('pos.card_sales')}</p>
 <p className="font-bold text-sm dark:text-white">{formatCurrency(summary.cardSales)}</p>
 </div>
 <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
 <Smartphone size={14} className="text-slate-600 mb-1"/>
 <p className="text-[10px] font-bold text-slate-700 uppercase">UPI/E-Wallet</p>
 <p className="font-bold text-sm dark:text-white">{formatCurrency(summary.upiSales)}</p>
 </div>
 <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
 <Clock size={14} className="text-slate-600 mb-1"/>
 <p className="text-[10px] font-bold text-slate-700 uppercase">{t('pos.credit_sales')}</p>
 <p className="font-bold text-sm dark:text-white">{formatCurrency(summary.creditSales)}</p>
 </div>
 </div>
 </div>

 <button type="button"
 onClick={handleCloseShift}
 disabled={isProcessing || !actualCash}
 className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-black text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2"
 >
 <Lock size={20} />
 {t('pos.finalize_close_shift', { defaultValue: 'Finalize & Close Shift' })}
 </button>
 </>
)}
 </div>
)}
 </div>
 </Modal>
);
};

export default ShiftModal;

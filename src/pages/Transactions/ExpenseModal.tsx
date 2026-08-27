import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/UI/Modal';
import { useSettings } from '../../contexts/SettingsContext';
import type { Expense } from '../../services/db';

interface ExpenseModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (data: Pick<Expense, 'description' | 'amount' | 'category' | 'notes'>) => void;
 editingExpense?: Expense | null;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onSave, editingExpense }) => {
 const { t } = useTranslation();
 const { settings } = useSettings();

 const [description, setDescription] = useState('');
 const [amount, setAmount] = useState('');
 const [category, setCategory] = useState('General');
 const [notes, setNotes] = useState('');

 useEffect(() => {
 if (isOpen) {
 setTimeout(() => {
 if (editingExpense) {
 setDescription(editingExpense.description);
 setAmount(editingExpense.amount.toString());
 setCategory(editingExpense.category);
 setNotes(editingExpense.notes || '');
 } else {
 setDescription('');
 setAmount('');
 setCategory('General');
 setNotes('');
 }
 }, 0);
 }
 }, [isOpen, editingExpense]);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!description || !amount) return;

 onSave({
 description,
 amount: parseFloat(amount),
 category,
 notes
 });
 onClose();
 };

 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 maxWidth="lg"
 className="md:rounded-2xl rounded-none h-full md:h-auto max-h-screen md:max-h-[90vh] w-full m-0 md:m-auto"
 >
 {/* Custom Header matching mockup */}
 <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-white dark:bg-slate-900 shrink-0">
 <button type="button" onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-900 dark:text-white"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
 </button>
 <h2 className="text-lg font-bold text-slate-900 dark:text-white">
 {editingExpense ? t('expenses.edit_expense', { defaultValue: 'Edit Expense' }) : t('expenses.add_expense', { defaultValue: 'Add Expense' })}
 </h2>
 </div>

 <form onSubmit={handleSubmit} className="p-5 space-y-5 bg-white dark:bg-slate-900 flex-1 overflow-y-auto">
 {/* Description */}
 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
 {t('expenses.description', { defaultValue: 'Description' })} <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={description}
 onChange={e => setDescription(e.target.value)}
 className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm transition-all"
 placeholder="Rent, Electricity, etc."
 required
 autoFocus
 />
 </div>

 {/* Amount */}
 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
 {t('expenses.amount', { defaultValue: 'Amount' })} ({settings.currency}) <span className="text-red-500">*</span>
 </label>
 <input
 type="number"
 step="0.01"
 value={amount}
 onChange={e => setAmount(e.target.value)}
 className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-sm transition-all"
 placeholder="0.00"
 required
 />
 </div>

 {/* Category */}
 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
 {t('expenses.category', { defaultValue: 'Category' })} <span className="text-red-500">*</span>
 </label>
 <select
 value={category}
 onChange={e => setCategory(e.target.value)}
 className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm transition-all appearance-none"
 >
 <option value="General">{t('expenses.cat_general', { defaultValue: 'General' })}</option>
 <option value="Rent">{t('expenses.cat_rent', { defaultValue: 'Rent' })}</option>
 <option value="Utilities">{t('expenses.cat_utilities', { defaultValue: 'Utilities' })}</option>
 <option value="Salary">{t('expenses.cat_salary', { defaultValue: 'Salary' })}</option>
 <option value="Maintenance">{t('expenses.cat_maintenance', { defaultValue: 'Maintenance' })}</option>
 <option value="Purchase">{t('expenses.cat_purchase', { defaultValue: 'Purchase' })}</option>
 </select>
 </div>

 {/* Notes */}
 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
 {t('expenses.notes', { defaultValue: 'Notes / Details' })}
 </label>
 <textarea
 value={notes}
 onChange={e => setNotes(e.target.value)}
 className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-28 resize-none text-sm transition-all"
 placeholder="Add notes..."
 />
 </div>

 {/* Actions */}
 <div className="flex gap-3 pt-6 pb-2">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 p-3.5 text-slate-700 dark:text-slate-300 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm"
 >
 {t('common.cancel', { defaultValue: 'Cancel' })}
 </button>
 <button
 type="submit"
 className="flex-1 p-3.5 bg-[#0f172a] hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-sm shadow-sm"
 >
 {editingExpense ? t('common.save', { defaultValue: 'Save Changes' }) : t('expenses.add_expense', { defaultValue: 'Add Expense' })}
 </button>
 </div>
 </form>
 </Modal>
 );
};

export default ExpenseModal;

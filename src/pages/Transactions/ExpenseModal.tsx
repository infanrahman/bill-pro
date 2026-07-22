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
 title={editingExpense ? t('expenses.edit_expense') : t('expenses.add_expense')}
 >
 <form onSubmit={handleSubmit} className="p-4 space-y-4">
 {/* Description */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
 {t('expenses.description')} *
 </label>
 <input
 type="text"
 value={description}
 onChange={e => setDescription(e.target.value)}
 className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none"
 placeholder={t('expenses.desc_placeholder')}
 required
 autoFocus
 />
 </div>

 {/* Amount */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
 {t('expenses.amount')} ({settings.currency}) *
 </label>
 <input
 type="number"
 step="0.01"
 value={amount}
 onChange={e => setAmount(e.target.value)}
 className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none font-bold"
 placeholder={t('common.placeholder_amount')}
 required
 />
 </div>

 {/* Category */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
 {t('expenses.category')}
 </label>
 <select
 value={category}
 onChange={e => setCategory(e.target.value)}
 className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none"
 >
 <option value="General">{t('expenses.cat_general')}</option>
 <option value="Rent">{t('expenses.cat_rent')}</option>
 <option value="Utilities">{t('expenses.cat_utilities')}</option>
 <option value="Salary">{t('expenses.cat_salary')}</option>
 <option value="Maintenance">{t('expenses.cat_maintenance')}</option>
 <option value="Purchase">{t('expenses.cat_purchase')}</option>
 </select>
 </div>

 {/* Notes */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
 {t('expenses.notes')}
 </label>
 <textarea
 value={notes}
 onChange={e => setNotes(e.target.value)}
 className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none h-24 resize-none"
 placeholder={t('common.placeholder_notes')}
 />
 </div>

 {/* Actions */}
 <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 p-3 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
 >
 {t('common.cancel')}
 </button>
 <button
 type="submit"
 className="flex-1 p-3 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white font-bold rounded-lg"
 >
 {editingExpense ? t('common.save') : t('expenses.add_expense')}
 </button>
 </div>
 </form>
 </Modal>
);
};

export default ExpenseModal;

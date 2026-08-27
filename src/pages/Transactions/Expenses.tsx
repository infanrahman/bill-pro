import React, { useState, useMemo } from 'react';
import { db, type Expense, softDeleteMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash, DollarSign, Edit, Search, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotification } from '../../contexts/NotificationContext';
import ExpenseModal from './ExpenseModal';
import ConfirmationModal from '../../components/UI/ConfirmationModal';

import { useAuth } from '../../contexts/AuthContext';
import { ShieldOff } from 'lucide-react';

interface ExpensesProps {
  embedded?: boolean;
}

const Expenses: React.FC<ExpensesProps> = ({ embedded = false }) => {
 const { t } = useTranslation();
 const { formatCurrency, formatDate, settings } = useSettings();
 const { addToast } = useNotification();
 const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();

 const permissionDenied = !hasPermission('expenses_view');

 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
 const [search, setSearch] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('All');

 const expenses = useLiveQuery(async () => {
 if (permissionDenied) return [];
 const baseQuery = activeBranch?.isMaster ? db.expenses.reverse() : db.expenses.where('branchId').equals(activeBranchId).reverse();
 const data = await baseQuery.sortBy('date');
 return data.filter((e: any) => !e.deletedAt);
 }, [activeBranchId, activeBranch?.isMaster, permissionDenied]);

 const filteredExpenses = useMemo(() => {
 if (!expenses) return [];
 return expenses.filter((exp: any) => {
 const matchesSearch = (exp.description || '').toLowerCase().includes(search.toLowerCase());
 const matchesCategory = categoryFilter === 'All' || exp.category === categoryFilter;
 return matchesSearch && matchesCategory;
 });
 }, [expenses, search, categoryFilter]);



 const handleSave = async (data: Pick<Expense, 'description' | 'amount' | 'category' | 'notes'>) => {
 try {
 const { createRecordMetadata, updateRecordMetadata } = await import('../../services/db');
 if (editingExpense && editingExpense.id) {
 await db.expenses.update(editingExpense.id, {
 ...data,
 ...updateRecordMetadata()
 });
 addToast(t('inventory.update_success'), 'success'); // Using generic success message
 } else {
 await db.expenses.add({
 ...createRecordMetadata(),
 ...data,
 branchId: activeBranchId || '',
 date: new Date()
 });
 addToast(t('inventory.save_success'), 'success');
 }
 } catch (error) {
 console.error(error);
 addToast(t('inventory.save_error'), 'error');
 }
 };

 const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

 const handleDeleteClick = (id: string) => {
 setExpenseToDelete(id);
 };

 const handleConfirmDelete = async () => {
 if (expenseToDelete) {
 await db.expenses.update(expenseToDelete, softDeleteMetadata());
 setExpenseToDelete(null);
 addToast(t('expenses.expense_deleted'), 'info');
 }
 };

 const openAddModal = () => {
 setEditingExpense(null);
 setIsModalOpen(true);
 };

 const openEditModal = (expense: Expense) => {
 setEditingExpense(expense);
 setIsModalOpen(true);
 };

 const totalStats = filteredExpenses?.reduce((acc: any, curr: any) => acc + (Number(curr.amount) || 0), 0) || 0;

 if (permissionDenied) {
 return (
 <div className="flex flex-col items-center justify-center h-screen text-center p-8">
 <ShieldOff size={48} className="text-slate-300 mb-4"/>
 <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
 <p className="text-slate-700">{t('expenses.access_denied_msg') ||"You do not have permission to view expenses."}</p>
 </div>
 );
 }

 return (
 <div className={embedded ? "space-y-4" : "space-y-6"}>

 {/* Header Area - Only show if not embedded OR redesign for mockup */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
 <div>
 <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('expenses.title')}</h1>
 <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Track and manage your business expenditures</p>
 </div>
 {hasPermission('expenses_add') && (
 <button type="button"
 onClick={openAddModal}
 className="bg-[#0f172a] hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 active:scale-95 transition-all shadow-sm"
 >
 <Plus size={16} strokeWidth={3} />
 {t('expenses.add_expense')}
 </button>
)}
 </div>

 {/* Stats Card (Mockup Style) */}
 <div className="bg-red-50/30 dark:bg-red-900/10 p-5 rounded-2xl border border-red-50 dark:border-red-900/30 flex items-center justify-between">
 <div>
 <p className="text-red-500 dark:text-red-400 font-bold uppercase text-[10px] tracking-wider mb-2">TOTAL EXPENSES</p>
 <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2 flex items-baseline gap-1">
 {formatCurrency(totalStats).replace(/[^0-9.,]/g, '')}
 <span className="text-red-500 text-lg font-bold">{settings.currency}</span>
 </h3>
 <p className="text-[11px] text-slate-500">
 {filteredExpenses.length} records found
 </p>
 </div>
 <div className="w-12 h-12 bg-red-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-red-500 shadow-sm border border-red-100 dark:border-red-900/50">
 <DollarSign size={24} strokeWidth={2.5} />
 </div>
 </div>

 {/* Filters */}
 <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"size={20} />
 <input
 type="text"
 placeholder={t('expenses.search_placeholder')}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
 />
 </div>
 <div className="flex items-center gap-2">
 <Filter className="text-slate-600"size={20} />
 <select
 value={categoryFilter}
 onChange={(e) => setCategoryFilter(e.target.value)}
 className="py-2 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 appearance-none min-w-[150px]"
 >
 <option value="All">{t('pos.all_categories')}</option>
 <option value="General">{t('expenses.cat_general')}</option>
 <option value="Rent">{t('expenses.cat_rent')}</option>
 <option value="Utilities">{t('expenses.cat_utilities')}</option>
 <option value="Salary">{t('expenses.cat_salary')}</option>
 <option value="Maintenance">{t('expenses.cat_maintenance')}</option>
 <option value="Purchase">{t('expenses.cat_purchase')}</option>
 </select>
 </div>
 </div>

 {/* Expenses List */}
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left whitespace-nowrap min-w-[700px]">
 <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
 <tr>
 <th className="p-4 font-semibold">{t('expenses.description')}</th>
 <th className="p-4 font-semibold">{t('expenses.category')}</th>
 <th className="p-4 font-semibold">{t('expenses.date')}</th>
 <th className="p-4 font-semibold">{t('expenses.amount')}</th>
 <th className="p-4 font-semibold text-right">{t('expenses.action')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
 {filteredExpenses.map((exp: any) => (
 <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 group">
 <td className="p-4">
 <div className="font-medium text-slate-800 dark:text-white text-sm">{exp.description}</div>
 {exp.notes && <div className="text-xs text-slate-700 mt-0.5 line-clamp-1">{exp.notes}</div>}
 </td>
 <td className="p-4">
 <span className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-600">
 {exp.category}
 </span>
 </td>
 <td className="p-4 text-slate-700 text-sm">{formatDate(exp.date)}</td>
 <td className="p-4 font-bold text-slate-800 dark:text-white text-sm">{formatCurrency(exp.amount)}</td>
 <td className="p-4">
 <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
 {hasPermission('expenses_edit') && (
 <button type="button"
 onClick={() => openEditModal(exp)}
 className="p-2 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
 title={t('common.edit')}
 >
 <Edit size={18} />
 </button>
)}
 {(isAdmin || hasPermission('expenses_delete')) && (
 <button type="button"
 onClick={() => handleDeleteClick(exp.id!)}
 className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
 title={t('common.delete')}
 >
 <Trash size={18} />
 </button>
)}
 </div>
 </td>
 </tr>
))}
 {filteredExpenses.length === 0 && (
 <tr>
 <td colSpan={5} className="p-12">
 <div className="flex flex-col items-center justify-center gap-4 py-8">
 <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
 <DollarSign className="text-slate-400"size={32} />
 </div>
 <div className="text-center">
 <h4 className="font-bold text-slate-900 dark:text-white mb-1">No expenses recorded.</h4>
 <p className="text-sm text-slate-500 mb-6">No expenses recorded yet.</p>
 </div>
 {hasPermission('expenses_add') && (
 <button type="button"
 onClick={openAddModal}
 className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
 >
 <Plus size={16} />
 {t('expenses.add_expense')}
 </button>
 )}
 </div>
 </td>
 </tr>
)}
 </tbody>
 </table>
 </div>
 </div>

 <ExpenseModal
 isOpen={isModalOpen}
 onClose={() => setIsModalOpen(false)}
 onSave={handleSave}
 editingExpense={editingExpense}
 />

 <ConfirmationModal
 isOpen={!!expenseToDelete}
 onClose={() => setExpenseToDelete(null)}
 onConfirm={handleConfirmDelete}
 title={t('expenses.delete_title')}
 message={t('expenses.delete_confirm')}
 confirmText={t('common.delete')}
 variant="danger"
 />
 </div>
);
};

export default Expenses;

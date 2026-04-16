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

const Expenses: React.FC = () => {
    const { t } = useTranslation();
    const { formatCurrency, formatDate } = useSettings();
    const { addToast } = useNotification();
    const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();

    if (!hasPermission('expenses_view')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('expenses.access_denied_msg') || "You do not have permission to view expenses."}</p>
            </div>
        );
    }

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');

    const expenses = useLiveQuery(async () => {
        const baseQuery = activeBranch?.isMaster ? db.expenses.reverse() : db.expenses.where('branchId').equals(activeBranchId).reverse();
        const data = await baseQuery.sortBy('date');
        return data.filter((e: any) => !e.deletedAt);
    }, [activeBranchId, activeBranch?.isMaster]);

    const filteredExpenses = useMemo(() => {
        if (!expenses) return [];
        return expenses.filter((exp: any) => {
            const matchesSearch = exp.description.toLowerCase().includes(search.toLowerCase());
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

    const totalStats = filteredExpenses?.reduce((acc: any, curr: any) => acc + curr.amount, 0) || 0;

    return (
        <div className="space-y-6">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white">{t('expenses.title')}</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Track and manage your business expenditures</p>
                </div>
                {hasPermission('expenses_add') && (
                    <button
                        onClick={openAddModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                    >
                        <Plus size={20} />
                        {t('expenses.add_expense')}
                    </button>
                )}
            </div>

            {/* Stats Card */}
            <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/10 dark:to-slate-800 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-red-500 dark:text-red-400 font-bold uppercase text-xs tracking-wider mb-1">{t('expenses.total_expenses')}</p>
                    <h3 className="text-4xl font-extrabold text-red-600 dark:text-red-400">{formatCurrency(totalStats)}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                        {t('expenses.records_found', { count: filteredExpenses.length })}
                    </p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl shadow-sm text-red-500">
                    <DollarSign size={32} strokeWidth={2.5} />
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder={t('expenses.search_placeholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="text-slate-400" size={20} />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="py-2 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none min-w-[150px]"
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
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
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
                                <tr key={exp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 group transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium text-slate-800 dark:text-white text-sm">{exp.description}</div>
                                        {exp.notes && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{exp.notes}</div>}
                                    </td>
                                    <td className="p-4">
                                        <span className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-600">
                                            {exp.category}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500 text-sm">{formatDate(exp.date)}</td>
                                    <td className="p-4 font-bold text-slate-800 dark:text-white text-sm">{formatCurrency(exp.amount)}</td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                                            {hasPermission('expenses_edit') && (
                                                <button
                                                    onClick={() => openEditModal(exp)}
                                                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                    title={t('common.edit')}
                                                >
                                                    <Edit size={18} />
                                                </button>
                                            )}
                                            {(isAdmin || hasPermission('expenses_delete')) && (
                                                <button
                                                    onClick={() => handleDeleteClick(exp.id!)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
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
                                    <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                                <DollarSign className="text-slate-300 dark:text-slate-600" size={32} />
                                            </div>
                                            <p className="font-medium text-sm">{t('expenses.no_expenses')}</p>
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

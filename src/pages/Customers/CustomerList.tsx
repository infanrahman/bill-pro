import React, { useState, useEffect } from 'react';
import { Plus, Users, Trash2, Wallet, ShieldOff } from 'lucide-react';
import { db, type Customer, softDeleteMetadata } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import CustomerForm from './CustomerForm';
import CustomerHistoryModal from './CustomerHistoryModal';
import CustomerPaymentModal from './CustomerPaymentModal';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import { useGridNavigation } from '../../hooks/useGridNavigation';
import Skeleton from '../../components/UI/Skeleton';
import EmptyState from '../../components/UI/EmptyState';

const CustomerList: React.FC = () => {
    const { t } = useTranslation();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState<Customer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
    const { addToast } = useNotification();
    const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();

    // Grid Nav
    const { getGridCellProps } = useGridNavigation({
        rows: customers.length,
        cols: 5 // Name, Phone, Spent, Balance, Actions
    });

    const fetchCustomers = React.useCallback(async () => {
        try {
            const baseQuery = activeBranch?.isMaster ? db.customers : db.customers.where('branchId').equals(activeBranchId);
            const data = await (baseQuery as any)
                .filter((c: any) => !c.deletedAt)
                .toArray();
            setCustomers(data);
        } catch (error) {
            console.error(error);
            addToast(t('customers.load_error'), 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, t, activeBranchId, activeBranch?.isMaster]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    if (!hasPermission('customers_view')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('customers.access_denied')}</h2>
                <p className="text-slate-500">{t('customers.access_denied_msg')}</p>
            </div>
        );
    }

    const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setCustomerToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if (customerToDelete) {
            try {
                await db.customers.update(customerToDelete, softDeleteMetadata());
                addToast(t('customers.delete_success'), 'success');
                fetchCustomers();
            } catch {
                addToast(t('customers.delete_error'), 'error');
            } finally {
                setCustomerToDelete(null);
            }
        }
    };



    const handleFormClose = () => {
        setShowForm(false);
        setEditingCustomer(undefined);
        fetchCustomers();
    };


    // Removed early loading return to show skeleton inside layout
    // if (loading) return <div className="p-6 dark:text-white">Loading customers...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
                    <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    {t('customers.title')}
                </h1>
                {hasPermission('customers_add') && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        <Plus className="w-4 h-4" />
                        {t('common.add')}
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 font-semibold">{t('customers.name')}</th>
                                <th className="p-4 font-semibold">{t('customers.phone')}</th>
                                <th className="p-4 font-semibold">{t('customers.total_spent')}</th>
                                <th className="p-4 font-semibold">{t('customers.credit_balance')}</th>
                                <th className="p-4 font-semibold text-right">{t('customers.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_: any, i: any) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4"><Skeleton width={120} height={20} /></td>
                                        <td className="p-4"><Skeleton width={100} height={20} /></td>
                                        <td className="p-4"><Skeleton width={80} height={20} /></td>
                                        <td className="p-4"><Skeleton width={80} height={20} /></td>
                                        <td className="p-4"><Skeleton width={100} height={20} /></td>
                                    </tr>
                                ))
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState
                                            title={t('customers.no_customers')}
                                            description={t('customers.no_customers_desc') || "No customers found. Add your first customer."}
                                            icon={Users}
                                            actionLabel={hasPermission('customers_manage') ? t('common.add') : undefined}
                                            onAction={() => setShowForm(true)}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                customers.map((customer: any, rowIndex: any) => (
                                    <tr key={customer.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td {...getGridCellProps(rowIndex, 0)} className="p-4 font-medium text-slate-900 dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-l-lg text-sm">{customer.name}</td>
                                        <td {...getGridCellProps(rowIndex, 1)} className="p-4 text-slate-600 dark:text-slate-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 font-mono text-xs">{customer.phone || '-'}</td>
                                        <td {...getGridCellProps(rowIndex, 2)} className="p-4 font-medium text-slate-700 dark:text-slate-300 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm">
                                            ${(customer.totalSpent || 0).toFixed(2)}
                                        </td>
                                        <td {...getGridCellProps(rowIndex, 3)} className="p-4 font-bold outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm">
                                            <span className={(customer.balance || 0) > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-500 dark:text-slate-400 font-normal'}>
                                                ${(customer.balance || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td {...getGridCellProps(rowIndex, 4)} className="p-4 flex justify-end gap-2 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-r-lg">
                                            {(customer.balance || 0) > 0 && hasPermission('customers_edit') && (
                                                <button
                                                    onClick={() => setShowPayment(customer)}
                                                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                                    title="Receive Payment"
                                                >
                                                    <Wallet size={18} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setShowHistory(customer.id!)}
                                                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                {t('customers.history')}
                                            </button>

                                            {isAdmin && (
                                                <button
                                                    onClick={() => customer.id && handleDeleteClick(customer.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title={t('common.delete')}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* History Modal */}
            {showHistory && (
                <CustomerHistoryModal
                    customerId={showHistory}
                    onClose={() => setShowHistory(null)}
                />
            )}

            {/* Payment Modal */}
            {showPayment && (
                <CustomerPaymentModal
                    customer={showPayment}
                    onClose={() => setShowPayment(null)}
                    onPaymentComplete={fetchCustomers}
                />
            )}

            {showForm && (
                <CustomerForm
                    key={editingCustomer?.id || 'new'}
                    customer={editingCustomer}
                    onClose={handleFormClose}
                    onSave={fetchCustomers}
                />
            )}

            <ConfirmationModal
                isOpen={!!customerToDelete}
                onClose={() => setCustomerToDelete(null)}
                onConfirm={handleConfirmDelete}
                title={t('common.delete_confirm_title') || "Delete Customer?"}
                message={t('customers.delete_confirm') || "Are you sure you want to delete this customer?"}
                confirmText={t('common.delete') || "Delete"}
                variant="danger"
            />
        </div>
    );
};

export default CustomerList;

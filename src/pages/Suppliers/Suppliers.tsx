import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Phone, Building, ShieldOff, Search } from 'lucide-react';
import { db, type Supplier, type SyncEntity, createRecordMetadata, updateRecordMetadata, softDeleteMetadata } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../../components/UI/Modal';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const Suppliers: React.FC = () => {
    const { t } = useTranslation();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const { addToast } = useNotification();
    const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();

    if (!hasPermission('suppliers_view')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('suppliers.access_denied')}</h2>
                <p className="text-slate-500">{t('suppliers.access_denied_msg')}</p>
            </div>
        );
    }

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [location, setLocation] = useState('');
    const [taxNumber, setTaxNumber] = useState('');

    const fetchSuppliers = async () => {
        try {
            const baseQuery = activeBranch?.isMaster ? db.suppliers : db.suppliers.where('branchId').equals(activeBranchId);
            const data = await (baseQuery as any)
                .filter((s: any) => !s.deletedAt)
                .toArray();
            setSuppliers(data);
        } catch (error) {
            console.error(error);
            addToast(t('suppliers.load_error'), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, [activeBranchId, activeBranch?.isMaster]);

    const resetForm = () => {
        setName('');
        setPhone('');
        setEmail('');
        setLocation('');
        setTaxNumber('');
        setEditingSupplier(null);
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setName(supplier.name);
        setPhone(supplier.phone);
        setEmail(supplier.email || '');
        setLocation(supplier.location || '');
        setTaxNumber(supplier.taxNumber || '');
        setIsModalOpen(true);
    };

    const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setSupplierToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if (supplierToDelete) {
            try {
                await db.suppliers.update(supplierToDelete, softDeleteMetadata());
                addToast(t('suppliers.delete_success'), 'success');
                fetchSuppliers();
            } catch {
                addToast(t('suppliers.delete_error'), 'error');
            } finally {
                setSupplierToDelete(null);
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone) {
            addToast(t('suppliers.validation_error'), 'error');
            return;
        }

        const supplierData: Omit<Supplier, keyof SyncEntity> = {
            name,
            phone,
            email,
            location,
            taxNumber,
            balance: editingSupplier ? editingSupplier.balance : 0
        };

        try {
            if (editingSupplier && editingSupplier.id) {
                await db.suppliers.update(editingSupplier.id, { ...supplierData, ...updateRecordMetadata() });
                addToast(t('suppliers.update_success'), 'success');
            } else {
                await db.suppliers.add({ ...supplierData, ...createRecordMetadata() });
                addToast(t('suppliers.add_success'), 'success');
            }
            setIsModalOpen(false);
            resetForm();
            fetchSuppliers();
        } catch (error) {
            addToast(t('suppliers.save_error'), 'error');
        }
    };

    if (loading) return <div className="p-6 dark:text-white">{t('common.loading')}</div>;

    const filteredSuppliers = suppliers.filter((supplier: any) =>
        !supplier.deletedAt && (
            supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            supplier.phone.includes(searchQuery) ||
            (supplier.taxNumber && supplier.taxNumber.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h1 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                    <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    {t('suppliers.title')}
                </h1>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('common.search') || 'Search suppliers...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                        />
                    </div>
                    {hasPermission('suppliers_add') && (
                        <button
                            onClick={() => { resetForm(); setIsModalOpen(true); }}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('common.add')}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map((supplier: any) => (
                    <div
                        key={supplier.id}
                        onClick={() => window.location.hash = `#/suppliers/${supplier.id}`}
                        className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors group cursor-pointer relative"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                                    {supplier.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold dark:text-white">{supplier.name}</h3>
                                    <p className="text-xs text-slate-500">{supplier.taxNumber ? `${t('suppliers.tax_id')}: ${supplier.taxNumber}` : t('suppliers.no_tax_id')}</p>
                                </div>
                            </div>
                            {(hasPermission('suppliers_edit') || isAdmin) && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 absolute top-4 right-4" onClick={e => e.stopPropagation()}>
                                    {hasPermission('suppliers_edit') && (
                                        <button onClick={() => handleEdit(supplier)} className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                            <Edit size={16} />
                                        </button>
                                    )}
                                    {(isAdmin || hasPermission('suppliers_delete')) && (
                                        <button onClick={() => handleDeleteClick(supplier.id!)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('purchases.balance_due')}</p>
                            <p className={`text-xl font-bold ${supplier.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(supplier.balance)}
                            </p>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 border-t border-dashed border-slate-200 dark:border-slate-700 pt-3">
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-slate-400" />
                                {supplier.phone}
                            </div>
                            {/* ... kept details ... */}
                        </div>
                    </div>
                ))}

                {suppliers.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <Building size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">{t('suppliers.no_suppliers')}</p>
                        <p className="text-sm">{t('suppliers.start_msg')}</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingSupplier ? t('common.edit') : t('common.add')}
            >
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.name')}</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.phone')}</label>
                            <input
                                type="tel"
                                required
                                className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.tax_vat')}</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                value={taxNumber}
                                onChange={e => setTaxNumber(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.email')}</label>
                        <input
                            type="email"
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.location')}</label>
                        <textarea
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            rows={3}
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                            {editingSupplier ? t('common.update') : t('common.save')}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={!!supplierToDelete}
                onClose={() => setSupplierToDelete(null)}
                onConfirm={handleConfirmDelete}
                title={t('suppliers.delete_title')}
                message={t('suppliers.delete_confirm')}
                confirmText={t('common.delete')}
                variant="danger"
            />
        </div>
    );
};

export default Suppliers;

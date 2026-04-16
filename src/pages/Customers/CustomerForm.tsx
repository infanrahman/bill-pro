import React, { useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { useNotification } from '../../contexts/NotificationContext';
import { db, type Customer, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import { useTranslation } from 'react-i18next';

interface CustomerFormProps {
    customer?: Customer;
    onClose: () => void;
    onSave: () => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onClose, onSave }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Customer>>(customer || {
        name: '',
        phone: '',
        email: '',
        address: '',
        totalSpent: 0,
        loyaltyPoints: 0
    });
    const { addToast } = useNotification();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (customer?.id) {
                await db.customers.update(customer.id, { ...formData, ...updateRecordMetadata() });
                addToast(t('customers.update_success'), 'success');
            } else {
                // Check duplicates by phone
                if (formData.phone) {
                    const existing = await db.customers.where('phone').equals(formData.phone).first();
                    if (existing) {
                        addToast(t('customers.exists_error'), 'warning');
                        // Optional: allow proceed or block? Let's block for now as phone is unique ident usually
                        return;
                    }
                }
                await db.customers.add({ ...formData, ...createRecordMetadata() } as Customer);
                addToast(t('customers.add_success'), 'success');
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            addToast(t('customers.save_error'), 'error');
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={customer ? t('common.edit') : t('common.add')} maxWidth="md">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('customers.name')}</label>
                    <input
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('customers.phone')}</label>
                    <input
                        type="tel"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('customers.email_optional')}</label>
                    <input
                        type="email"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('customers.vat_optional')}</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                        value={formData.vatNumber || ''}
                        onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('customers.address_optional')}</label>
                    <textarea
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                        rows={2}
                        value={formData.address || ''}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('customers.loyalty_points', { defaultValue: 'Loyalty Points' })}</label>
                    <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                        value={formData.loyaltyPoints || 0}
                        onChange={(e) => setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value) || 0 })}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 rounded-lg"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        {customer ? t('common.update') : t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CustomerForm;

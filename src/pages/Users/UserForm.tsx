import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../services/db';
import type { User } from '../../services/db';
import { useTranslation } from 'react-i18next';

interface UserFormProps {
    user?: User;
    onClose: () => void;
    onSave: () => void;
}

const AVAILABLE_PERMISSIONS = [
    { id: 'pos', label: 'users.perm_pos' },
    { id: 'inventory', label: 'users.perm_inventory' },
    { id: 'sales', label: 'users.perm_sales' },
    { id: 'reports', label: 'users.perm_reports' },
    { id: 'customers', label: 'users.perm_customers' },
    { id: 'expenses', label: 'users.perm_expenses' },
    { id: 'purchase', label: 'users.perm_purchase' },
    { id: 'backup', label: 'users.perm_backup' }
];

const UserForm: React.FC<UserFormProps> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<User>>({
        username: '',
        password: '',
        name: '',
        role: 'shopkeeper',
        permissions: []
    });
    const { addToast } = useNotification();

    useEffect(() => {
        if (user) {
            setFormData({
                ...user,
                permissions: user.permissions || []
            });
        }
    }, [user]);

    const togglePermission = (permId: string) => {
        setFormData(prev => {
            const currentPerms = prev.permissions || [];
            if (currentPerms.includes(permId)) {
                return { ...prev, permissions: currentPerms.filter((p: any) => p !== permId) };
            } else {
                return { ...prev, permissions: [...currentPerms, permId] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { createRecordMetadata, updateRecordMetadata } = await import('../../services/db');
            if (user?.id) {
                await db.users.update(user.id, {
                    ...formData,
                    ...updateRecordMetadata()
                });
                addToast(t('users.user_updated'), 'success');
            } else {
                const existing = await db.users.where('username').equals(formData.username!).first();
                if (existing) {
                    addToast(t('users.username_exists'), 'error');
                    return;
                }
                await db.users.add({
                    ...createRecordMetadata(),
                    ...formData
                } as User);
                addToast(t('users.user_created'), 'success');
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            console.error(error);
            addToast(t('users.save_failed'), 'error');
        }
    };

    const { t } = useTranslation();

    return (
        <Modal isOpen={true} onClose={onClose} title={user ? t('users.edit_user') : t('users.add_user')} maxWidth="md">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.full_name')}</label>
                    <input
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.username')}</label>
                    <input
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.password')}</label>
                    <input
                        type="password"
                        required={!user}
                        placeholder={user ? t('users.leave_blank_password') : ""}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.role')}</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'shopkeeper' })}
                    >
                        <option value="shopkeeper">{t('users.shopkeeper')}</option>
                        <option value="admin">{t('users.admin')}</option>
                    </select>
                </div>

                {formData.role === 'shopkeeper' && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-gray-700 mb-3">{t('users.permissions')}</label>
                        <div className="grid grid-cols-2 gap-3">
                            {AVAILABLE_PERMISSIONS.map((perm: any) => (
                                <div key={perm.id} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id={`perm-${perm.id}`}
                                        checked={formData.permissions?.includes(perm.id) || false}
                                        onChange={() => togglePermission(perm.id)}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`perm-${perm.id}`} className="text-sm text-gray-600 select-none cursor-pointer">
                                        {t(perm.label)}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        {user ? t('users.update_user') : t('users.create_user')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};


export default UserForm;

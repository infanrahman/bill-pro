import React, { useState, useEffect } from 'react';
import { db, type User } from '../../../services/db';
import { useAuth, PERMISSIONS } from '../../../contexts/AuthContext';
import Modal from '../../../components/UI/Modal';
import ConfirmationModal from '../../../components/UI/ConfirmationModal';
import { useNotification } from '../../../contexts/NotificationContext';
import { Plus, Edit2, Trash2, Shield, User as UserIcon, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const UserManagementTab: React.FC = () => {
    const { user: currentUser } = useAuth();
    const { addToast } = useNotification();
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    // const [isLoading, setIsLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<User>>({
        name: '',
        username: '',
        password: '',
        role: 'shopkeeper',
        permissions: []
    });

    const loadUsers = async () => {
        try {
            const allUsers = await db.users.toArray();
            setUsers(allUsers);
        } catch (error) {
            console.error("Failed to load users", error);
            addToast(t('users.load_error'), 'error');
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleOpenModal = (userToEdit?: User) => {
        if (userToEdit) {
            setEditingUser(userToEdit);
            setFormData({
                name: userToEdit.name,
                username: userToEdit.username,
                password: userToEdit.password,
                role: userToEdit.role,
                permissions: userToEdit.permissions || []
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                username: '',
                password: '',
                role: 'shopkeeper',
                permissions: []
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handlePermissionToggle = (permissionId: string) => {
        setFormData(prev => {
            const currentPermissions = prev.permissions || [];
            if (currentPermissions.includes(permissionId)) {
                return {
                    ...prev,
                    permissions: currentPermissions.filter(p => p !== permissionId)
                };
            } else {
                return {
                    ...prev,
                    permissions: [...currentPermissions, permissionId]
                };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.name || !formData.username || !formData.password) {
            addToast(t('users.fill_required'), 'error');
            return;
        }

        try {
            if (editingUser) {
                // Update
                if (editingUser.id === currentUser?.id && formData.role !== 'admin') {
                    addToast(t('users.cannot_demote_self'), 'error');
                    return;
                }

                await db.users.update(editingUser.id!, {
                    name: formData.name,
                    username: formData.username,
                    password: formData.password,
                    role: formData.role as 'admin' | 'shopkeeper',
                    permissions: formData.role === 'admin' ? [] : formData.permissions
                });
                addToast(t('users.update_success'), 'success');
            } else {
                // Create
                // Check username existence
                const existing = await db.users.where('username').equalsIgnoreCase(formData.username!).first();
                if (existing) {
                    addToast(t('users.username_exists'), 'error');
                    return;
                }

                await db.users.add({
                    name: formData.name!,
                    username: formData.username!,
                    password: formData.password!,
                    role: formData.role as 'admin' | 'shopkeeper',
                    permissions: formData.role === 'admin' ? [] : formData.permissions
                });
                addToast(t('users.create_success'), 'success');
            }
            handleCloseModal();
            loadUsers();
        } catch (error) {
            console.error(error);
            addToast(t('common.operation_failed'), 'error');
        }
    };

    const [userToDeleteState, setUserToDeleteState] = useState<User | null>(null);

    const handleDeleteClick = (user: User) => {
        if (user.id === currentUser?.id) {
            addToast(t('users.cannot_delete_self'), 'error');
            return;
        }
        setUserToDeleteState(user);
    };

    const handleConfirmDelete = async () => {
        if (!userToDeleteState) return;

        try {
            await db.users.delete(userToDeleteState.id!);
            addToast(t('users.delete_success'), 'success');
            loadUsers();
        } catch (error) {
            addToast(t('users.delete_error'), 'error');
        } finally {
            setUserToDeleteState(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('users.title')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('users.subtitle')}</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    {t('common.add')}
                </button>
            </div>

            {/* Users List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map(u => (
                    <div key={u.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'}`}>
                                        {u.role === 'admin' ? <Shield size={20} /> : <UserIcon size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white mb-0.5">{u.name}</h3>
                                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">{u.role === 'admin' ? t('users.admin') : t('users.shopkeeper')}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleOpenModal(u)}
                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>

                                    {currentUser?.role === 'admin' && ( // Only actual admins can delete users
                                        <button
                                            onClick={() => handleDeleteClick(u)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            disabled={u.id === currentUser?.id}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm text-slate-600 dark:text-slate-300">
                                    <span className="font-medium text-slate-500 dark:text-slate-500 block text-xs mb-1">{t('users.username')}</span>
                                    {u.username}
                                </div>
                                {u.role !== 'admin' && (
                                    <div className="mt-3">
                                        <span className="font-medium text-slate-500 dark:text-slate-500 block text-xs mb-2">{t('users.permissions')}</span>
                                        <div className="flex flex-wrap gap-2">
                                            {u.permissions?.length ? u.permissions.map(p => (
                                                <span key={p} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-md border border-slate-200 dark:border-slate-600">
                                                    {PERMISSIONS.find(perm => perm.id === p)?.label || p}
                                                </span>
                                            )) : <span className="text-xs text-slate-400 italic">{t('users.no_permissions')}</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                ))}
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingUser ? t('users.edit_user') : t('users.new_user')}
            >
                <div className="p-6 space-y-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('users.full_name')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t('users.name_placeholder')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('users.username')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    placeholder={t('users.username_placeholder')}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('users.password')}</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                placeholder={t('users.password_placeholder')}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('users.role')}</label>
                            <select
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'shopkeeper' })}
                            >
                                <option value="shopkeeper">{t('users.shopkeeper')}</option>
                                <option value="admin">{t('users.admin')}</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">{t('users.admin_note')}</p>
                        </div>

                        {/* Permissions Section - Only for non-admin */}
                        {formData.role !== 'admin' && (
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('users.permissions')}</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {PERMISSIONS.map(perm => {
                                        const isSelected = formData.permissions?.includes(perm.id);
                                        return (
                                            <div
                                                key={perm.id}
                                                onClick={() => handlePermissionToggle(perm.id)}
                                                className={`cursor-pointer px-3 py-2 rounded-lg border transition-all flex items-center justify-between ${isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                                    }`}
                                            >
                                                <span className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {perm.label}
                                                </span>
                                                {isSelected && <Check size={16} className="text-blue-600 dark:text-blue-400" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/30"
                            >
                                {editingUser ? t('common.save_changes') : t('common.create')}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={!!userToDeleteState}
                onClose={() => setUserToDeleteState(null)}
                onConfirm={handleConfirmDelete}
                title={t('users.delete_title')}
                message={t('users.delete_confirm', { name: userToDeleteState?.name })}
                confirmText={t('common.delete')}
                variant="danger"
            />
        </div >
    );
};

export default UserManagementTab;

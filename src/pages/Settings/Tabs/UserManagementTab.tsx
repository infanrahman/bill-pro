import React, { useState, useEffect } from 'react';
import { db, type User, softDeleteMetadata, createRecordMetadata } from '../../../services/db';
import { useAuth, PERMISSIONS } from '../../../contexts/AuthContext';
import Modal from '../../../components/UI/Modal';
import ConfirmationModal from '../../../components/UI/ConfirmationModal';
import { useNotification } from '../../../contexts/NotificationContext';
import { Plus, Edit2, Trash2, Shield, User as UserIcon } from 'lucide-react';
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
 const allUsers = await db.users
 .filter((u: any) => !u.deletedAt)
 .toArray();
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
 let newPermissions = [...currentPermissions];

 if (currentPermissions.includes(permissionId)) {
 // Remove
 newPermissions = newPermissions.filter((p: any) => p !== permissionId);
 
 // Logic: If disabling 'View', also disable associated CRUD permissions
 if (permissionId === 'inventory_view') newPermissions = newPermissions.filter((p: any) => !['inventory_add', 'inventory_edit', 'inventory_delete'].includes(p));
 if (permissionId === 'sales_view') newPermissions = newPermissions.filter((p: any) => !['sales_add', 'sales_edit', 'sales_delete'].includes(p));
 if (permissionId === 'purchases_view') newPermissions = newPermissions.filter((p: any) => !['purchases_add', 'purchases_edit', 'purchases_delete'].includes(p));
 if (permissionId === 'customers_view') newPermissions = newPermissions.filter((p: any) => !['customers_add', 'customers_edit', 'customers_delete'].includes(p));
 if (permissionId === 'suppliers_view') newPermissions = newPermissions.filter((p: any) => !['suppliers_add', 'suppliers_edit', 'suppliers_delete'].includes(p));
 if (permissionId === 'expenses_view') newPermissions = newPermissions.filter((p: any) => !['expenses_add', 'expenses_edit', 'expenses_delete'].includes(p));

 } else {
 // Add
 newPermissions.push(permissionId);
 
 // Logic: If enabling CRUD, implicitly enable 'View'
 if (['inventory_add', 'inventory_edit', 'inventory_delete'].includes(permissionId) && !newPermissions.includes('inventory_view')) newPermissions.push('inventory_view');
 if (['sales_add', 'sales_edit', 'sales_delete'].includes(permissionId) && !newPermissions.includes('sales_view')) newPermissions.push('sales_view');
 if (['purchases_add', 'purchases_edit', 'purchases_delete'].includes(permissionId) && !newPermissions.includes('purchases_view')) newPermissions.push('purchases_view');
 if (['customers_add', 'customers_edit', 'customers_delete'].includes(permissionId) && !newPermissions.includes('customers_view')) newPermissions.push('customers_view');
 if (['suppliers_add', 'suppliers_edit', 'suppliers_delete'].includes(permissionId) && !newPermissions.includes('suppliers_view')) newPermissions.push('suppliers_view');
 if (['expenses_add', 'expenses_edit', 'expenses_delete'].includes(permissionId) && !newPermissions.includes('expenses_view')) newPermissions.push('expenses_view');
 }

 return {
 ...prev,
 permissions: newPermissions
 };
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
 ...createRecordMetadata(),
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
 await db.users.update(userToDeleteState.id!, softDeleteMetadata());
 addToast(t('users.delete_success'), 'success');
 loadUsers();
 } catch (error) {
 addToast(t('users.delete_error'), 'error');
 } finally {
 setUserToDeleteState(null);
 }
 };

 const renderToggle = (id: string, label: string) => {
 const isSelected = formData.permissions?.includes(id);
 return (
 <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer"onClick={() => handlePermissionToggle(id)}>
 <span className={`text-sm font-medium select-none ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
 {label}
 </span>
 <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ease-in-out focus:outline-none ${isSelected ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-600'}`}>
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition ease-in-out ${isSelected ? 'translate-x-2' : '-translate-x-2'}`} />
 </div>
 </div>
);
 };

 const renderMiniToggle = (id: string, label: string) => {
 const isSelected = formData.permissions?.includes(id);
 return (
 <div
 className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer select-none ${
 isSelected
 ? 'bg-slate-900 dark:bg-white ring-1 ring-slate-900/20 dark:ring-white/20'
 : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
 }`}
 onClick={() => handlePermissionToggle(id)}
 >
 <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'text-slate-900 dark:text-white ' : 'text-slate-600 dark:text-slate-400'}`}>
 {label}
 </span>
 <div className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full ${
 isSelected ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
 }`}>
 <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow ${
 isSelected ? 'translate-x-3.5' : 'translate-x-0.5'
 }`} />
 </div>
 </div>
);
 };

 const renderCrudRow = (prefix: string) => (
 <div className="grid grid-cols-4 gap-1.5">
 {renderMiniToggle(`${prefix}_view`, 'View')}
 {renderMiniToggle(`${prefix}_add`, 'Add')}
 {renderMiniToggle(`${prefix}_edit`, 'Edit')}
 {renderMiniToggle(`${prefix}_delete`, 'Del')}
 </div>
);

 return (
 <div className="space-y-6 fade-in">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('users.title')}</h2>
 <p className="text-sm text-slate-700 dark:text-slate-300">{t('users.subtitle')}</p>
 </div>
 <button type="button"
 onClick={() => handleOpenModal()}
 className="flex items-center gap-2 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white px-4 py-2 rounded-lg"
 >
 <Plus size={18} />
 {t('common.add')}
 </button>
 </div>

 {/* Users List */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {users.map((u: any) => (
 <div key={u.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
 <div>
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3">
 <div className={`p-3 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white '}`}>
 {u.role === 'admin' ? <Shield size={20} /> : <UserIcon size={20} />}
 </div>
 <div>
 <h3 className="font-bold text-slate-800 dark:text-white mb-0.5">{u.name}</h3>
 <p className="text-xs text-slate-700 uppercase font-semibold tracking-wider">{u.role === 'admin' ? t('users.admin') : t('users.shopkeeper')}</p>
 </div>
 </div>
 <div className="flex gap-1">
 <button type="button"
 onClick={() => handleOpenModal(u)}
 className="p-2 text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
 >
 <Edit2 size={16} />
 </button>

 {currentUser?.role === 'admin' && ( // Only actual admins can delete users
 <button type="button"
 onClick={() => handleDeleteClick(u)}
 className="p-2 text-slate-600 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
 disabled={u.id === currentUser?.id}
 >
 <Trash2 size={16} />
 </button>
)}
 </div>
 </div>

 <div className="space-y-2">
 <div className="text-sm text-slate-600 dark:text-slate-300">
 <span className="font-medium text-slate-700 dark:text-slate-400 block text-xs mb-1">{t('users.username')}</span>
 {u.username}
 </div>
 {u.role !== 'admin' && (
 <div className="mt-3">
 <span className="font-medium text-slate-700 dark:text-slate-400 block text-xs mb-2">{t('users.permissions')}</span>
 <div className="flex flex-wrap gap-2">
 {u.permissions?.length ? u.permissions.map((p: any) => (
 <span key={p} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-md border border-slate-200 dark:border-slate-600">
 {PERMISSIONS.find(perm => perm.id === p)?.label || p}
 </span>
)) : <span className="text-xs text-slate-600 italic">{t('users.no_permissions')}</span>}
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
 <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('users.full_name')}</label>
 <input
 type="text"
 required
 className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:border-transparent outline-none"
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
 className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:border-transparent outline-none"
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
 className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:border-transparent outline-none"
 value={formData.password}
 onChange={e => setFormData({ ...formData, password: e.target.value })}
 placeholder={t('users.password_placeholder')}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('users.role')}</label>
 <select
 className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:border-transparent outline-none"
 value={formData.role}
 onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'shopkeeper' })}
 >
 <option value="shopkeeper">{t('users.shopkeeper')}</option>
 <option value="admin">{t('users.admin')}</option>
 </select>
 <p className="text-xs text-slate-700 mt-1">{t('users.admin_note')}</p>
 </div>

 {/* Permissions Section - Only for non-admin */}
 {formData.role !== 'admin' && (
 <div className="border-t border-slate-200 dark:border-slate-700 pt-5 mt-4">
 <label className="block text-base font-bold text-slate-800 dark:text-white mb-4">{t('users.permissions')}</label>
 <div className="space-y-4">
 
 {/* Core Operations */}
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Core Operations</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {renderToggle('pos_access', 'POS Terminal')}
 {renderToggle('reports_view', 'Reports & Analysis')}
 {renderToggle('cashbook_access', 'Cash Book')}
 </div>
 </div>

 {/* Inventory & Financials */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Inventory</h4>
 <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
 <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">Items</p>
 {renderCrudRow('inventory')}
 </div>
 </div>
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Sales</h4>
 <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
 <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">Invoices</p>
 {renderCrudRow('sales')}
 </div>
 </div>
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Purchases</h4>
 <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
 <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">Orders</p>
 {renderCrudRow('purchases')}
 </div>
 </div>
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Expenses</h4>
 <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
 <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">Records</p>
 {renderCrudRow('expenses')}
 </div>
 </div>
 </div>

 {/* People & Admin */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">People</h4>
 <div className="space-y-3">
 <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
 <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">Customers</p>
 {renderCrudRow('customers')}
 </div>
 <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
 <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">Suppliers</p>
 {renderCrudRow('suppliers')}
 </div>
 </div>
 </div>
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Administration</h4>
 <div className="space-y-3">
 {renderToggle('users_manage', 'User Management')}
 {renderToggle('settings_backup', 'Data Backups')}
 <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
 <span className="text-xs font-bold text-slate-700 uppercase mb-2 block">Settings Tabs</span>
 <div className="grid grid-cols-3 gap-1.5">
 {renderMiniToggle('settings_general', 'General')}
 {renderMiniToggle('settings_taxes', 'Taxes')}
 {renderMiniToggle('settings_invoice', 'Invoice')}
 {renderMiniToggle('settings_printers', 'Printers')}
 {renderMiniToggle('settings_backup', 'Backup')}
 </div>
 </div>
 </div>
 </div>
 </div>

 </div>
 </div>
)}

 <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
 <button
 type="button"
 onClick={handleCloseModal}
 className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
 >
 {t('common.cancel')}
 </button>
 <button
 type="submit"
 className="px-6 py-2 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white rounded-lg font-medium"
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

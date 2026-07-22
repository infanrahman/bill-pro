import React, { useState, useEffect } from 'react';
import { Plus, User as UserIcon, Trash2, Edit, ShieldOff } from 'lucide-react';
import { db, type User } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import UserForm from './UserForm';
import ConfirmationModal from '../../components/UI/ConfirmationModal';

const UserList: React.FC = () => {
 const [users, setUsers] = useState<User[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
 const { user: currentUser, hasPermission } = useAuth();
 const { addToast } = useNotification();
 const { t } = useTranslation();

 const fetchUsers = async () => {
 try {
 const data = await db.users.toArray();
 setUsers(data);
 } catch (error) {
 console.error(error);
 addToast('Failed to load users', 'error');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchUsers();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const [userToDelete, setUserToDelete] = useState<string | null>(null);

 const handleDeleteClick = (id: string) => {
 setUserToDelete(id);
 };

 const handleConfirmDelete = async () => {
 if (userToDelete) {
 try {
 await db.users.delete(userToDelete);
 addToast('User deleted successfully', 'success');
 fetchUsers();
 } catch (error) {
 addToast('Failed to delete user', 'error');
 } finally {
 setUserToDelete(null);
 }
 }
 };

 const handleEdit = (user: User) => {
 setEditingUser(user);
 setShowForm(true);
 };

 const handleFormClose = () => {
 setShowForm(false);
 setEditingUser(undefined);
 fetchUsers();
 };

 // Page Level Guard
 if (!hasPermission('users_manage')) {
 return (
 <div className="flex flex-col items-center justify-center h-screen text-center p-8">
 <div className="text-slate-300 mb-4">
 <ShieldOff size={48} />
 </div>
 <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
 <p className="text-slate-700">{t('common.access_denied_msg') ||"You don't have permission to manage users."}</p>
 </div>
);
 }

 if (loading) return <div className="p-6">{t('common.loading')}</div>;

 const userToDeleteObj = users.find(u => u.id === userToDelete);

 return (
 <div className="p-6 space-y-6">
 <div className="flex justify-between items-center">
 <h1 className="text-2xl font-bold flex items-center gap-2">
 <UserIcon className="w-8 h-8 text-indigo-600"/>
 {t('users.title')}
 </h1>
 <button type="button"
 onClick={() => setShowForm(true)}
 className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
 >
 <Plus className="w-4 h-4"/>
 {t('users.add_user')}
 </button>
 </div>

 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left whitespace-nowrap min-w-[600px]">
 <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
 <tr>
 <th className="p-4 font-semibold">{t('users.username')}</th>
 <th className="p-4 font-semibold">{t('users.full_name')}</th>
 <th className="p-4 font-semibold">{t('users.role')}</th>
 <th className="p-4 font-semibold text-right">{t('common.actions')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
 {users.map((userItem: any) => (
 <tr key={userItem.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 group">
 <td className="p-4 font-medium text-slate-900 dark:text-white text-sm">{userItem.username}</td>
 <td className="p-4 text-slate-600 dark:text-slate-300 text-sm">{userItem.name}</td>
 <td className="p-4">
 <span className={`px-2 py-1.5 rounded-md text-xs font-semibold ${userItem.role === 'admin'
 ? 'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800'
 : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 '
 }`}>
 {userItem.role === 'admin' ? t('users.admin') : t('users.shopkeeper')}
 </span>
 </td>
 <td className="p-4 flex justify-end gap-2">
 <button type="button"
 onClick={() => handleEdit(userItem)}
 className="p-2 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
 title={t('common.edit')}
 >
 <Edit size={18} />
 </button>
 {currentUser?.username !== userItem.username && (
 <button type="button"
 onClick={() => userItem.id && handleDeleteClick(userItem.id)}
 className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
 title={t('common.delete')}
 >
 <Trash2 size={18} />
 </button>
)}
 </td>
 </tr>
))}
 </tbody>
 </table>
 </div>
 </div>

 {showForm && (
 <UserForm
 user={editingUser}
 onClose={handleFormClose}
 onSave={fetchUsers}
 />
)}

 <ConfirmationModal
 isOpen={!!userToDelete}
 onClose={() => setUserToDelete(null)}
 onConfirm={handleConfirmDelete}
 title={t('common.delete_confirm_title') ||"Delete Confirmation"}
 message={t('users.delete_confirm', { name: userToDeleteObj?.name || 'User' })}
 confirmText={t('common.delete')}
 variant="danger"
 />
 </div>
);
};

export default UserList;

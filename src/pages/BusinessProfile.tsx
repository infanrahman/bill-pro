import React, { useState } from 'react';
import { Save, UserPlus, Trash2, ShieldOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNotification } from '../contexts/NotificationContext';
import { generateBackupData, restoreBackupData } from '../services/backupService';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../components/UI/ConfirmationModal';

interface BusinessDetails {
 name: string;
 address: string;
 phone: string;
 email: string;
 gstin: string;
 logoUrl?: string;
 country?: string;
 taxName?: string; // e.g. 'VAT', 'GST'
 vatNo?: string;
 crNo?: string;
}

const BusinessProfile: React.FC = () => {
 const { t } = useTranslation();
 const { isAdmin, user, hasPermission } = useAuth();
 const { addToast } = useNotification();

 const [details, setDetails] = useState<BusinessDetails>(() => {
 const saved = localStorage.getItem('businessDetails');
 return saved ? JSON.parse(saved) : {
 name: '', address: '', phone: '', email: '', gstin: '',
 };
 });

 // User Management State
 const [newUser, setNewUser] = useState({ username: '', password: '', name: '', canBackup: false });
 const users = useLiveQuery(() => db.users.where('role').equals('shopkeeper').toArray(), []);
 const currentUser = useLiveQuery(() => user?.id ? db.users.get(user.id) : undefined, [user?.id]);

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 setDetails({ ...details, [e.target.name]: e.target.value });
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 const sanitizedDetails = {
 ...details,
 name: (details.name || '').trim(),
 address: (details.address || '').trim(),
 phone: (details.phone || '').trim(),
 email: (details.email || '').trim(),
 gstin: (details.gstin || '').trim(),
 vatNo: (details.gstin || '').trim(),
 crNo: (details.crNo || '').trim(),
 };
 localStorage.setItem('businessDetails', JSON.stringify(sanitizedDetails));
 setDetails(sanitizedDetails);
 addToast(t('settings.details_saved'), 'success');
 };

 const handleAddUser = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
 const { createRecordMetadata } = await import('../services/db');
 await db.users.add({
 ...createRecordMetadata(),
 username: newUser.username,
 password: newUser.password,
 name: newUser.name,
 role: 'shopkeeper',
 permissions: newUser.canBackup ? ['pos', 'sales', 'backup'] : ['pos', 'sales']
 });
 setNewUser({ username: '', password: '', name: '', canBackup: false });
 addToast(t('settings.user_added'), 'success');
 } catch {
 addToast(t('settings.user_add_error'), 'error');
 }
 };

 // Modal States
 const [userToDelete, setUserToDelete] = useState<string | null>(null);
 const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

 if (!hasPermission('settings_manage')) {
 return (
 <div className="flex flex-col items-center justify-center h-screen text-center p-4 md:p-8">
 <ShieldOff size={48} className="text-slate-300 mb-4"/>
 <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
 <p className="text-slate-700">{t('settings.access_denied_msg') || 'You do not have permission to manage business settings.'}</p>
 </div>
 );
 }

 const handleDeleteUser = (id: string) => {
 setUserToDelete(id);
 };

 const handleConfirmDeleteUser = async () => {
 if (userToDelete) {
 await db.users.delete(userToDelete);
 addToast(t('settings.user_removed'), 'success');
 setUserToDelete(null);
 }
 };

 const handleBackup = async () => {
 try {
 const data = await generateBackupData();
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const electron = (window as any).electron;

 if (electron) {
 const success = await electron.saveBackup(data);
 if (success) {
 addToast(t('settings.backup_saved'), 'success');
 } else {
 addToast(t('settings.backup_failed'), 'error');
 }
 } else {
 // Browser Fallback
 const blob = new Blob([data], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download =`billing-backup-${new Date().toISOString().split('T')[0]}.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 addToast(t('settings.backup_downloaded'), 'success');
 }
 } catch (error) {
 console.error(error);
 addToast(t('settings.backup_failed'), 'error');
 }
 };

 const handleRestoreClick = () => {
 if (!isAdmin) return;
 setIsRestoreModalOpen(true);
 };

 const handleConfirmRestore = async () => {
 setIsRestoreModalOpen(false);

 try {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const electron = (window as any).electron;

 const processRestore = async (content: string) => {
 try {
 await restoreBackupData(content);
 addToast(t('settings.restore_success'), 'success');
 setTimeout(() => window.location.reload(), 2000);
 } catch {
 addToast(t('settings.restore_failed'), 'error');
 }
 };

 if (electron) {
 const content = await electron.readBackup();
 if (content) {
 await processRestore(content);
 }
 } else {
 // Browser Fallback
 const input = document.createElement('input');
 input.type = 'file';
 input.accept = '.json';
 input.onchange = (e) => {
 const file = (e.target as HTMLInputElement).files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onload = (e) => {
 const result = e.target?.result as string;
 if (result) processRestore(result);
 };
 reader.readAsText(file);
 }
 };
 input.click();
 }

 } catch (error) {
 console.error(error);
 addToast('Restore initiation failed', 'error');
 }
 };

 const showBackupControls = isAdmin || currentUser?.permissions?.includes('backup');

 const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => {
 const base64String = reader.result as string;
 // Basic size check (approx 500KB limit to avoid LS bloat)
 if (base64String.length > 700000) {
 addToast(t('settings.logo_too_large'), 'error');
 return;
 }
 setDetails(prev => ({ ...prev, logoUrl: base64String }));
 };
 reader.readAsDataURL(file);
 }
 };

 return (
 <div className="p-6 w-full mx-auto space-y-8 pb-20">
 <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('settings.title')}</h1>

 {/* Business Profile Section */}
 <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
 <h2 className="text-lg font-semibold mb-4 dark:text-white">{t('settings.profile_title')}</h2>
 <form onSubmit={handleSubmit} className="space-y-4">

 {/* Logo Upload */}
 <div className="flex items-center gap-4 mb-4">
 <div className="w-20 h-20 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900">
 {details.logoUrl ? (
 <img src={details.logoUrl} alt="Logo"className="w-full h-full object-contain"/>
) : (
 <span className="text-xs text-slate-600">{t('settings.no_logo')}</span>
)}
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.shop_logo')}</label>
 <input
 type="file"
 accept="image/*"
 onChange={handleLogoUpload}
 className="text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-900 dark:file:text-white hover:file:bg-slate-100 dark:hover:file:bg-slate-800"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.business_name')}</label>
 <input
 type="text"
 name="name"
 value={details.name}
 onChange={handleChange}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 required
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.phone')}</label>
 <input
 type="text"
 name="phone"
 value={details.phone}
 onChange={handleChange}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.address')}</label>
 <textarea
 name="address"
 value={details.address}
 onChange={handleChange}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 rows={2}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.country')}</label>
 <select
 name="country"
 value={details.country || 'India'}
 onChange={(e) => setDetails({ ...details, country: e.target.value })}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white"
 >
 <option value="India">India</option>
 <option value="Saudi Arabia">Saudi Arabia (KSA)</option>
 <option value="UAE">United Arab Emirates (UAE)</option>
 <option value="USA">United States</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.tax_name')}</label>
 <input
 type="text"
 name="taxName"
 value={details.taxName || ''}
 placeholder="VAT"
 onChange={handleChange}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.tax_reg_no')}</label>
 <input
 type="text"
 name="gstin"// Keeping internal name as 'gstin' for simplified ID mapping, but labeled as Tax Registration
 value={details.gstin}
 onChange={handleChange}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.cr_no')}</label>
 <input
 type="text"
 name="crNo"
 value={details.crNo || ''}
 onChange={handleChange}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.email')}</label>
 <input
 type="email"
 name="email"
 value={details.email}
 onChange={handleChange}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 />
 </div>
 </div>
 <button
 type="submit"
 className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white px-6 py-2 rounded-lg font-semibold"
 >
 <Save size={18} /> {t('settings.save_details')}
 </button>
 </form>
 </div>

 {/* Data Management Section */}
 {showBackupControls && (
 <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
 <h2 className="text-lg font-semibold mb-4 dark:text-white">{t('settings.data_management')}</h2>
 <p className="text-sm text-slate-700 mb-4">
 {t('settings.backup_desc')}
 {isAdmin &&"You can also restore data from a previous backup."}
 </p>

 <div className="flex flex-wrap gap-4">
 <button type="button"
 onClick={handleBackup}
 className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
 >
 <Save size={18} /> {t('settings.backup_now')}
 </button>

 {isAdmin && (
 <button type="button"
 onClick={handleRestoreClick}
 className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
 >
 <UserPlus size={18} /> {t('settings.import_data')}
 </button>
)}
 </div>
 </div>
)}

 {/* User Management Section (Admin Only) */}
 {isAdmin && (
 <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
 <h2 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2">
 <UserPlus size={20} /> {t('settings.user_management')}
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {/* Add User Form */}
 <form onSubmit={handleAddUser} className="space-y-4">
 <h3 className="text-sm font-medium text-slate-700 uppercase">{t('settings.add_shopkeeper')}</h3>
 <div>
 <input
 type="text"
 placeholder={t('settings.full_name')}
 value={newUser.name}
 onChange={e => setNewUser({ ...newUser, name: e.target.value })}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 required
 />
 </div>
 <div>
 <input
 type="text"
 placeholder={t('settings.username')}
 value={newUser.username}
 onChange={e => setNewUser({ ...newUser, username: e.target.value })}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 required
 />
 </div>
 <div>
 <input
 type="password"
 placeholder={t('settings.password')}
 value={newUser.password}
 onChange={e => setNewUser({ ...newUser, password: e.target.value })}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 required
 />
 </div>
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="canBackup"
 checked={newUser.canBackup}
 onChange={e => setNewUser({ ...newUser, canBackup: e.target.checked })}
 className="w-4 h-4 rounded border-slate-300 text-slate-900 dark:text-white focus:ring-slate-900/20 dark:focus:ring-white/20"
 aria-label={t('settings.allow_backup')}
 />
 <label htmlFor="canBackup"className="text-sm text-slate-700 dark:text-slate-300 select-none">
 {t('settings.allow_backup')}
 </label>
 </div>
 <button
 type="submit"
 className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium"
 >
 {t('settings.create_account')}
 </button>
 </form>

 {/* User List */}
 <div>
 <h3 className="text-sm font-medium text-slate-700 uppercase mb-3">{t('settings.existing_users')}</h3>
 <div className="space-y-2">
 {users?.map((user: any) => (
 <div key={user.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
 <div>
 <p className="font-medium dark:text-white">{user.name}</p>
 <div className="text-xs text-slate-700 flex flex-col gap-1">
 <span>{t('settings.username')}: <strong>{user.username}</strong></span>
 <span className={user.permissions?.includes('backup') ?"text-green-600":"text-slate-600"}>
 {t('settings.backup_access')}: {user.permissions?.includes('backup') ? t('settings.enabled') : t('settings.disabled')}
 </span>
 </div>
 </div>
 <button type="button"
 onClick={() => handleDeleteUser(user.id!)}
 className="text-red-500 hover:bg-red-50 p-2 rounded-md"
 title="Remove User"
 >
 <Trash2 size={16} />
 </button>
 </div>
))}
 {users?.length === 0 && (
 <p className="text-slate-600 text-sm italic">{t('settings.no_users')}</p>
)}
 </div>
 </div>
 </div>

 {/* Change Admin Password Section */}
 <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
 <h3 className="text-sm font-medium text-slate-700 uppercase mb-4">{t('settings.change_admin_pass')}</h3>
 <ChangeAdminPassword />
 </div>
 </div>
)}

 <ConfirmationModal
 isOpen={!!userToDelete}
 onClose={() => setUserToDelete(null)}
 onConfirm={handleConfirmDeleteUser}
 title={t('settings.delete_user_title') ||"Delete User?"}
 message={t('settings.delete_user_confirm') ||"Are you sure you want to delete this user?"}
 confirmText={t('common.delete') ||"Delete"}
 variant="danger"
 />

 <ConfirmationModal
 isOpen={isRestoreModalOpen}
 onClose={() => setIsRestoreModalOpen(false)}
 onConfirm={handleConfirmRestore}
 title={t('settings.restore_title') ||"Restore Data?"}
 message={t('settings.restore_warning') ||"Existing data will be overwritten. Proceed?"}
 confirmText={t('settings.continue') ||"Continue"}
 variant="warning"
 />
 </div>
);
};

const ChangeAdminPassword = () => {
 const { t } = useTranslation();
 const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
 const { addToast } = useNotification();

 const handleChangePassword = async (e: React.FormEvent) => {
 e.preventDefault();
 if (passwords.new !== passwords.confirm) {
 addToast(t('settings.pass_mismatch'), 'error');
 return;
 }

 const adminUser = await db.users.where('role').equals('admin').first();
 if (adminUser && adminUser.password === passwords.current) {
 await db.users.update(adminUser.id!, { password: passwords.new });
 addToast(t('settings.pass_updated'), 'success');
 setPasswords({ current: '', new: '', confirm: '' });
 } else {
 addToast(t('settings.incorrect_pass'), 'error');
 }
 };

 return (
 <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
 <div>
 <input
 type="password"
 placeholder={t('settings.current_pass')}
 value={passwords.current}
 onChange={e => setPasswords({ ...passwords, current: e.target.value })}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 required
 />
 </div>
 <div>
 <input
 type="password"
 placeholder={t('settings.new_pass')}
 value={passwords.new}
 onChange={e => setPasswords({ ...passwords, new: e.target.value })}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 required
 />
 </div>
 <div>
 <input
 type="password"
 placeholder={t('settings.confirm_pass')}
 value={passwords.confirm}
 onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
 className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
 required
 />
 </div>
 <button
 type="submit"
 className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
 >
 {t('settings.update_pass')}
 </button>
 </form>
);
};

export default BusinessProfile;

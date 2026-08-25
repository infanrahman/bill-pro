import React, { useRef, useState } from 'react';
import { Download, Upload, Database, AlertTriangle, CheckCircle, Clock, Folder, Play } from 'lucide-react';
import { generateBackupData, restoreBackupData } from '../../../services/backupService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../../../components/UI/ConfirmationModal';

import { useAuth } from '../../../contexts/AuthContext';

const DataBackupTab: React.FC = () => {
 const { addToast } = useNotification();
 const { t } = useTranslation();
 const { isAdmin } = useAuth();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [loading, setLoading] = useState(false);
 const [isResetModalOpen, setIsResetModalOpen] = useState(false);

 const [resetConfirmation, setResetConfirmation] = useState('');

 // Auto Backup State
 const [autoBackupEnabled, setAutoBackupEnabled] = useState(localStorage.getItem('autoBackupEnabled') === 'true');
 const [autoBackupPath, setAutoBackupPath] = useState(localStorage.getItem('autoBackupPath') || '');
 // Fix #15: read last backup time for display
 const [lastBackupTime, setLastBackupTime] = useState<number | null>(() => {
 const raw = localStorage.getItem('lastAutoBackupTime');
 return raw ? parseInt(raw) : null;
 });
 const [autoBackupLoading, setAutoBackupLoading] = useState(false);

 // Fix #9: Only enable auto-backup after a folder is successfully confirmed.
 // If the user cancels the folder picker, the toggle reverts to off.
 const handleToggleAutoBackup = async () => {
 const newState = !autoBackupEnabled;
 if (newState && !autoBackupPath) {
 // Must pick a folder first before enabling
 const chosen = await pickBackupFolder();
 if (!chosen) return; // user cancelled — do NOT enable
 }
 setAutoBackupEnabled(newState);
 localStorage.setItem('autoBackupEnabled', String(newState));
 };

 // Shared folder-picker logic — returns chosen path or null
 const pickBackupFolder = async (): Promise<string | null> => {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const electron = (window as any).electron;
 if (electron && electron.selectBackupFolder) {
 const chosen = await electron.selectBackupFolder();
 if (chosen) {
 setAutoBackupPath(chosen);
 localStorage.setItem('autoBackupPath', chosen);
 // Fix #12: reset last backup time so backup fires immediately for the new folder
 localStorage.removeItem('lastAutoBackupTime');
 setLastBackupTime(null);
 return chosen;
 }
 return null;
 } else {
 console.warn('Electron API not available');
 return null;
 }
 };

 const handleSelectBackupFolder = () => pickBackupFolder();

 // Fix #16:"Backup Now"— runs immediately to the auto backup folder
 const handleBackupNow = async () => {
 if (!autoBackupPath) {
 addToast(t('backup.no_folder_selected') || 'Please select a backup folder first.', 'error');
 return;
 }
 try {
 setAutoBackupLoading(true);
 const { generateBackupData } = await import('../../../services/backupService');
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const electron = (window as any).electron;
 if (!electron || !electron.saveAutoBackup) {
 addToast('Electron API not available.', 'error');
 return;
 }
 const data = await generateBackupData();
 const success = await electron.saveAutoBackup(autoBackupPath, data);
 if (success) {
 const now = Date.now();
 localStorage.setItem('lastAutoBackupTime', now.toString());
 setLastBackupTime(now);
 addToast(t('backup.success_backup') || 'Backup saved successfully.', 'success');
 } else {
 addToast(t('backup.failed_backup') || 'Backup failed.', 'error');
 }
 } catch (err) {
 console.error(err);
 addToast(t('backup.failed_backup') || 'Backup failed.', 'error');
 } finally {
 setAutoBackupLoading(false);
 }
 };

 // Fix #15: human-readable last backup timestamp
 const formatLastBackup = (ts: number | null): string => {
 if (!ts) return t('backup.never') || 'Never';
 const d = new Date(ts);
 return d.toLocaleString();
 };

 const handleBackup = async () => {
 try {
 setLoading(true);
 const data = await generateBackupData();
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const electron = (window as any).electron;
 if (electron && electron.saveBackup) {
 const success = await electron.saveBackup(data);
 if (success) {
 addToast(t('backup.success_backup'), 'success');
 } else {
 addToast(t('backup.failed_backup'), 'error');
 }
 } else {
 const blob = new Blob([data], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download =`myshop_backup_${new Date().toISOString().split('T')[0]}.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 addToast(t('backup.success_backup'), 'success');
 }
 } catch (error) {
 console.error('Backup failed:', error);
 addToast(t('backup.failed_backup'), 'error');
 } finally {
 setLoading(false);
 }
 };

 // Cloud Drive removed as per request

 const [pendingFile, setPendingFile] = useState<File | null>(null);
 const [pendingRestoreContent, setPendingRestoreContent] = useState<string | null>(null);

 const handleRestoreClick = async () => {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const electron = (window as any).electron;
 if (electron && electron.readBackup) {
 try {
 setLoading(true);
 const content = await electron.readBackup();
 if (content) {
 setPendingRestoreContent(content);
 }
 } catch (error) {
 console.error('File reading failed:', error);
 addToast(t('backup.failed_restore'), 'error');
 } finally {
 setLoading(false);
 }
 } else {
 fileInputRef.current?.click();
 }
 };

 const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (file) {
 setPendingFile(file);
 }
 if (fileInputRef.current) fileInputRef.current.value = '';
 };

  const handleConfirmRestore = async () => {
    if (!isAdmin) { // H28 Fix
      addToast(t('common.access_denied'), 'error');
      return;
    }
    if (!pendingFile && !pendingRestoreContent) return;

    try {
      setLoading(true);
      let text = '';
      if (pendingRestoreContent) {
        text = pendingRestoreContent;
      } else if (pendingFile) {
        text = await pendingFile.text();
      }
      await restoreBackupData(text);
      addToast(t('backup.success_restore'), 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Restore failed:', error);
      addToast(t('backup.failed_restore'), 'error');
    } finally {
      setLoading(false);
      setPendingFile(null);
      setPendingRestoreContent(null);
    }
  };

  const handleFactoryReset = async () => {
    if (!isAdmin) { // H28 Fix
      addToast(t('common.access_denied'), 'error');
      return;
    }
    if (resetConfirmation !== 'RESET') return;

 try {
 setLoading(true);
 const { resetApplicationData } = await import('../../../services/db');
 await resetApplicationData();
 addToast(t('backup.success_reset'), 'success');
 setTimeout(() => window.location.reload(), 1500);
 } catch (error) {
 console.error(error);
 addToast(t('backup.failed_reset'), 'error');
 setLoading(false);
 }
 };

 // Drive configuration removed

 return (
 <div className="space-y-6 fade-in slide-in-from-bottom-4">
 <div className="flex items-center gap-4 mb-6">
 <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 rounded-xl">
 <Database size={24} />
 </div>
 <div>
 <h2 className="text-xl font-bold dark:text-white">{t('backup.title')}</h2>
 <p className="text-slate-700">{t('backup.subtitle')}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Backup Card */}
 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500">
 <div className="flex flex-col h-full justify-between">
 <div>
 <div className="flex items-center gap-3 mb-4 text-indigo-600 dark:text-indigo-400">
 <Download size={24} />
 <h3 className="font-bold text-lg">{t('backup.export_title')}</h3>
 </div>
 <p className="text-slate-600 dark:text-slate-300 mb-6">
 {t('backup.export_desc')}
 </p>
 </div>
 <button type="button"
 onClick={handleBackup}
 disabled={loading}
 className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
 >
 {loading ? t('backup.processing') : t('backup.download_btn')}
 </button>
 </div>
 </div>

 {/* Restore Card */}
 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white group">
 <div className="flex flex-col h-full justify-between">
 <div>
 <div className="flex items-center gap-3 mb-4 text-slate-900 dark:text-white">
 <Upload size={24} />
 <h3 className="font-bold text-lg">{t('backup.import_title')}</h3>
 </div>
 <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-300 dark:border-slate-600 mb-6">
 <div className="flex gap-2">
 <AlertTriangle size={18} className="text-slate-900 dark:text-white shrink-0 mt-0.5"/>
 <p className="text-sm text-slate-900 dark:text-white font-medium">
 {t('backup.warning')}
 </p>
 </div>
 </div>
 </div>

 <input
 type="file"
 ref={fileInputRef}
 onChange={handleFileChange}
 accept=".json"
 className="hidden"
 />

 <button type="button"
 onClick={handleRestoreClick}
 disabled={loading}
 className="w-full py-3 bg-white border-2 border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-700 dark:text-white hover:border-slate-900 dark:hover:border-white hover:text-slate-900 dark:hover:text-white rounded-xl font-bold active:scale-[0.98] disabled:opacity-50"
 >
 {loading ? t('backup.restoring') : t('backup.restore_btn')}
 </button>
 </div>
 </div>



 </div>

 {/* Auto Backup Section */}
 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
 <Clock size={24} />
 <h3 className="font-bold text-lg">{t('backup.auto_backup_title') || 'Automatic Daily Backup'}</h3>
 </div>
 <div className="flex items-center">
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 className="sr-only peer"
 checked={autoBackupEnabled}
 onChange={handleToggleAutoBackup}
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-gray-600 peer-checked:bg-purple-600"></div>
 </label>
 </div>
 </div>

 <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
 {/* Left: description + last backup time */}
 <div className="flex-1">
 <p className="text-sm text-slate-600 dark:text-slate-300">
 {t('backup.auto_backup_desc') || 'Automatically save a backup of your data to a local folder every 24 hours.'}
 </p>
 {/* Fix #15: show last backup timestamp */}
 <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
 <CheckCircle size={12} className={lastBackupTime ? 'text-green-500' : 'text-slate-300'} />
 {t('backup.last_backup') || 'Last backup:'} <span className="font-medium">{formatLastBackup(lastBackupTime)}</span>
 </p>
 </div>

 {/* Right: folder path + controls */}
 <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
 <div className="flex-1 md:flex-initial px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-mono text-slate-700 overflow-hidden truncate max-w-[200px] border border-slate-200 dark:border-slate-600">
 {autoBackupPath || (t('backup.no_folder_selected') || 'No folder selected')}
 </div>

 {/* Change folder button */}
 <button type="button"
 onClick={handleSelectBackupFolder}
 className="p-2 bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg"
 title={t('backup.select_folder') || 'Select Folder'}
 >
 <Folder size={20} />
 </button>

 {/* Fix #16: Backup Now button */}
 <button type="button"
 onClick={handleBackupNow}
 disabled={autoBackupLoading || !autoBackupPath}
 className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg"
 title={t('backup.backup_now') || 'Backup Now'}
 >
 <Play size={14} />
 {autoBackupLoading ? '...' : (t('backup.backup_now') || 'Backup Now')}
 </button>
 </div>
 </div>
 </div>

 {/* Danger Zone */}
 {
 isAdmin && (
 <div className="border border-red-200 dark:border-red-900/50 rounded-2xl overflow-hidden">
 <div className="bg-red-50 dark:bg-red-900/10 p-4 border-b border-red-200 dark:border-red-900/50 flex items-center gap-3">
 <AlertTriangle className="text-red-600"size={24} />
 <h3 className="font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
 </div>
 <div className="p-6 bg-white dark:bg-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
  <div>
  <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{t('backup.factory_reset_title')}</h4>
  {(() => {
    const desc = t('backup.factory_reset_desc') || '';
    const parts = desc.split('. ');
    return (
      <p className="text-sm text-slate-700 max-w-xl">
        {parts[0]}{parts.length > 1 ? '.' : ''}
        {parts.length > 1 && <span className="font-semibold text-red-600"> {parts[1]}</span>}
      </p>
    );
  })()}
  </div>
 <button type="button"
 onClick={() => setIsResetModalOpen(true)}
 className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold dark: whitespace-nowrap"
 >
 {t('backup.factory_reset_btn')}
 </button>
 </div>
 </div>
)
 }

 <div className="p-6 bg-slate-50 dark:bg-slate-900/75 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700">
 <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
 <CheckCircle size={18} className="text-green-500"/> {t('backup.backup_contains')}
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600 dark:text-slate-300">
 <div className="flex items-center gap-2">• {t('backup.invoices_sales')}</div>
 <div className="flex items-center gap-2">• {t('backup.inventory_items')}</div>
 <div className="flex items-center gap-2">• {t('backup.customers_suppliers')}</div>
 <div className="flex items-center gap-2">• {t('backup.purchase_orders')}</div>
 <div className="flex items-center gap-2">• {t('backup.expenses')}</div>
 <div className="flex items-center gap-2">• {t('backup.settings_config')}</div>
 <div className="flex items-center gap-2">• {t('backup.user_accounts')}</div>
 <div className="flex items-center gap-2">• {t('backup.customer_payments')}</div>
 <div className="flex items-center gap-2">• {t('backup.cash_book')}</div>
 <div className="flex items-center gap-2">• {t('backup.purchase_payments')}</div>
 </div>
 </div>

 {/* Reset Confirmation Modal */}
 {
 isResetModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md">
 <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 fade-in zoom-in-95">
 <div className="text-center mb-6">
 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
 <AlertTriangle size={32} className="text-red-600"/>
 </div>
 <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
 {t('backup.reset_modal_title')}
 </h3>
 <p className="text-slate-700 text-sm">
 {t('backup.reset_modal_desc')}
 </p>
 </div>

 <div className="space-y-4">
 <div>
 <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
 {t('backup.type_to_confirm')}
 </label>
 <input
 type="text"
 value={resetConfirmation}
 onChange={(e) => setResetConfirmation(e.target.value)}
 className="w-full p-3 border border-red-300 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-100 font-mono text-center focus:ring-2 focus:ring-red-500 outline-none"
 placeholder="RESET"
 />
 </div>

 <div className="flex gap-3">
 <button type="button"
 onClick={() => {
 setIsResetModalOpen(false);
 setResetConfirmation('');
 }}
 className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-bold"
 >
 {t('users.cancel')}
 </button>
 <button type="button"
 onClick={handleFactoryReset}
 disabled={resetConfirmation !== 'RESET' || loading}
 className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {loading ? t('backup.resetting') : t('backup.confirm_reset')}
 </button>
 </div>
 </div>
 </div>
 </div>
)
 }

 <ConfirmationModal
 isOpen={!!pendingFile || !!pendingRestoreContent}
 onClose={() => {
 setPendingFile(null);
 setPendingRestoreContent(null);
 }}
 onConfirm={handleConfirmRestore}
 title={t('backup.import_title') ||"Restore Backup"}
 message={t('backup.warning') ||"Warning: This will replace all current data with the backup. This action cannot be undone."}
 confirmText={t('backup.restore_btn') ||"Restore"}
 variant="warning"
 />
 </div >
);
};

export default DataBackupTab;

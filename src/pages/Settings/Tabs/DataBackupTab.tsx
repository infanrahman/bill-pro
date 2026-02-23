import React, { useRef, useState } from 'react';
import { Download, Upload, Database, AlertTriangle, CheckCircle, Clock, Folder, Cloud } from 'lucide-react';
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

    const handleToggleAutoBackup = () => {
        const newState = !autoBackupEnabled;
        setAutoBackupEnabled(newState);
        localStorage.setItem('autoBackupEnabled', String(newState));
        if (newState && !autoBackupPath) {
            handleSelectBackupFolder();
        }
    };

    const handleSelectBackupFolder = async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const electron = (window as any).electron;
        if (electron && electron.selectBackupFolder) {
            const path = await electron.selectBackupFolder();
            if (path) {
                setAutoBackupPath(path);
                localStorage.setItem('autoBackupPath', path);
            }
        } else {
            console.warn('Electron API not available');
        }
    };

    const handleBackup = async () => {
        try {
            setLoading(true);
            const data = await generateBackupData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `myshop_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast(t('backup.success_backup'), 'success');
        } catch (error) {
            console.error('Backup failed:', error);
            addToast(t('backup.failed_backup'), 'error');
        } finally {
            setLoading(false);
        }
    };

    // Google Drive State
    const [isGdriveConnected, setIsGdriveConnected] = useState(false);

    React.useEffect(() => {
        // Check status on mount
        const checkStatus = async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const electron = (window as any).electron;
            if (electron && electron.googleDrive) {
                const status = await electron.googleDrive.getStatus();
                setIsGdriveConnected(status);
            }
        };
        checkStatus();
    }, []);

    const handleGdriveConnect = async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const electron = (window as any).electron;
        if (!electron) return;

        try {
            setLoading(true);
            const success = await electron.googleDrive.login();
            if (success) {
                setIsGdriveConnected(true);
                addToast('Connected to Google Drive', 'success');
            } else {
                addToast('Failed to connect', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('Connection failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGdriveDisconnect = async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const electron = (window as any).electron;
        if (!electron) return;

        await electron.googleDrive.logout();
        setIsGdriveConnected(false);
        addToast('Disconnected from Google Drive', 'info');
    };

    const [pendingFile, setPendingFile] = useState<File | null>(null);

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPendingFile(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmRestore = async () => {
        if (!pendingFile) return;

        try {
            setLoading(true);
            const text = await pendingFile.text();
            await restoreBackupData(text);
            addToast(t('backup.success_restore'), 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error('Restore failed:', error);
            addToast(t('backup.failed_restore'), 'error');
        } finally {
            setLoading(false);
            setPendingFile(null);
        }
    };

    const handleFactoryReset = async () => {
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

    // Google Drive Config State
    const [driveConfig, setDriveConfig] = useState({ clientId: '', clientSecret: '', redirectUri: 'http://localhost:3000/oauth2callback' });
    const [showConfig, setShowConfig] = useState(false);

    React.useEffect(() => {
        const loadConfig = async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const electron = (window as any).electron;
            if (electron && electron.googleDrive && isAdmin) {
                const config = await electron.googleDrive.getConfig();
                if (config) setDriveConfig(config);
            }
        };
        loadConfig();
    }, [isAdmin]);

    const handleSaveDriveConfig = async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const electron = (window as any).electron;
        if (electron && electron.googleDrive) {
            await electron.googleDrive.setConfig(driveConfig);
            addToast('Google Drive Settings Saved', 'success');
            setShowConfig(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl">
                    <Database size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold dark:text-white">{t('backup.title')}</h2>
                    <p className="text-slate-500">{t('backup.subtitle')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Backup Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-colors">
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-4 text-indigo-600 dark:text-indigo-400">
                                <Download size={24} />
                                <h3 className="font-bold text-lg">{t('backup.export_title')}</h3>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                {t('backup.export_desc')}
                            </p>
                        </div>
                        <button
                            onClick={handleBackup}
                            disabled={loading}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {loading ? t('backup.processing') : t('backup.download_btn')}
                        </button>
                    </div>
                </div>

                {/* Restore Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors group">
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-4 text-blue-600 dark:text-blue-400">
                                <Upload size={24} />
                                <h3 className="font-bold text-lg">{t('backup.import_title')}</h3>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 mb-6">
                                <div className="flex gap-2">
                                    <AlertTriangle size={18} className="text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
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

                        <button
                            onClick={handleRestoreClick}
                            disabled={loading}
                            className="w-full py-3 bg-white border-2 border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-700 dark:text-white hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? t('backup.restoring') : t('backup.restore_btn')}
                        </button>
                    </div>
                </div>



            </div>

            {/* Auto Backup Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
                        <Clock size={24} />
                        <h3 className="font-bold text-lg">{t('backup.auto_backup_title') || "Automatic Daily Backup"}</h3>
                    </div>
                    <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={autoBackupEnabled}
                                onChange={handleToggleAutoBackup}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 text-sm text-slate-600 dark:text-slate-400">
                        {t('backup.auto_backup_desc') || "Automatically save a backup of your data to a local folder every 24 hours."}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="flex-1 md:flex-initial px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-mono text-slate-500 overflow-hidden truncate max-w-[200px] border border-slate-200 dark:border-slate-600">
                            {autoBackupPath || (t('backup.no_folder_selected') || "No folder selected")}
                        </div>
                        <button
                            onClick={handleSelectBackupFolder}
                            className="p-2 bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg transition-colors"
                            title={t('backup.select_folder') || "Select Folder"}
                        >
                            <Folder size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Google Drive Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                        <Cloud size={24} />
                        <h3 className="font-bold text-lg">Google Drive Backup</h3>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                        >
                            {showConfig ? 'Hide Config' : 'Configure Keys'}
                        </button>
                    )}
                </div>

                {isAdmin && showConfig && (
                    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Admin Configuration</h4>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Client ID</label>
                            <input
                                type="text"
                                className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                value={driveConfig.clientId}
                                onChange={e => setDriveConfig({ ...driveConfig, clientId: e.target.value })}
                                placeholder="Enter Google Client ID"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Client Secret</label>
                            <input
                                type="password"
                                className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                value={driveConfig.clientSecret}
                                onChange={e => setDriveConfig({ ...driveConfig, clientSecret: e.target.value })}
                                placeholder="Enter Google Client Secret"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Redirect URI</label>
                            <input
                                type="text"
                                className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                value={driveConfig.redirectUri}
                                onChange={e => setDriveConfig({ ...driveConfig, redirectUri: e.target.value })}
                                placeholder="Default: http://localhost:3000/oauth2callback"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Must match 'Authorized redirect URI' in Google Console.</p>
                        </div>
                        <button
                            onClick={handleSaveDriveConfig}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                        >
                            Save Credentials
                        </button>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        {isGdriveConnected
                            ? "Connected. Your backups will be synced."
                            : "Connect your Google Account to enable cloud backups."}
                    </div>
                    <div>
                        {isGdriveConnected ? (
                            <button
                                onClick={handleGdriveDisconnect}
                                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-medium transition-colors"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <button
                                onClick={handleGdriveConnect}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-colors shadow-sm shadow-green-200 flex items-center gap-2"
                            >
                                <Cloud size={18} />
                                Connect Google Drive
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            {
                isAdmin && (
                    <div className="border border-red-200 dark:border-red-900/50 rounded-2xl overflow-hidden">
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 border-b border-red-200 dark:border-red-900/50 flex items-center gap-3">
                            <AlertTriangle className="text-red-600" size={24} />
                            <h3 className="font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{t('backup.factory_reset_title')}</h4>
                                <p className="text-sm text-slate-500 max-w-xl">
                                    {t('backup.factory_reset_desc').split('. ')[0]}.
                                    <span className="font-semibold text-red-600"> {t('backup.factory_reset_desc').split('. ')[1]}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setIsResetModalOpen(true)}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors shadow-sm shadow-red-200 dark:shadow-none whitespace-nowrap"
                            >
                                {t('backup.factory_reset_btn')}
                            </button>
                        </div>
                    </div>
                )
            }

            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-500" /> {t('backup.backup_contains')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600 dark:text-slate-400">
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle size={32} className="text-red-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    {t('backup.reset_modal_title')}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {t('backup.reset_modal_desc')}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
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
                                    <button
                                        onClick={() => {
                                            setIsResetModalOpen(false);
                                            setResetConfirmation('');
                                        }}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-bold transition-colors"
                                    >
                                        {t('users.cancel')}
                                    </button>
                                    <button
                                        onClick={handleFactoryReset}
                                        disabled={resetConfirmation !== 'RESET' || loading}
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                isOpen={!!pendingFile}
                onClose={() => setPendingFile(null)}
                onConfirm={handleConfirmRestore}
                title={t('backup.import_title') || "Restore Backup"}
                message={t('backup.warning') || "Warning: This will replace all current data with the backup. This action cannot be undone."}
                confirmText={t('backup.restore_btn') || "Restore"}
                variant="warning"
            />
        </div >
    );
};

export default DataBackupTab;

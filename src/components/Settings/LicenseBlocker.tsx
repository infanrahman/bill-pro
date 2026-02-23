import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Lock, RefreshCw, LogOut } from 'lucide-react';
import { useLicense } from '../../contexts/LicenseContext';
import { ActivationModal } from './LicenseComponents';

const LicenseBlocker: React.FC = () => {
    const { t } = useTranslation();
    const { status, machineId, checkStatus } = useLicense();
    const [showActivation, setShowActivation] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await checkStatus();
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    if (status === 'ok' || status === 'loading') return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="bg-red-600 p-6 text-center text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        <Lock size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold mb-1">{t('license.access_blocked', 'Access Blocked')}</h1>
                    <p className="text-red-100 font-medium">
                        {status === 'pirated'
                            ? t('license.pirated_msg', 'Your license key is invalid or has been revoked.')
                            : t('license.expired_msg', 'Your trial period has expired.')}
                    </p>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-slate-600 dark:text-slate-300">
                            {t('license.blocker_desc', 'To continue using the application, you must activate a valid license key.')}
                        </p>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('license.machine_id', 'Machine ID')}</span>
                        <code className="text-blue-600 dark:text-blue-400 font-mono font-bold select-all">{machineId}</code>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => setShowActivation(true)}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <ShieldAlert size={20} />
                            {t('license.activate_btn', 'Enter License Key')}
                        </button>

                        <div className="flex gap-3">
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="flex-1 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                                {t('common.refresh', 'Refresh')}
                            </button>
                            {window.electron && (
                                <button
                                    onClick={() => window.close()}
                                    className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut size={18} />
                                    {t('common.close', 'Exit App')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ActivationModal
                isOpen={showActivation}
                onClose={() => setShowActivation(false)}
                canClose={false} // Force strict mode if needed, though modal usually allows cancel. 
            // But here canceling just brings them back to blocker.
            />
        </div>
    );
};

export default LicenseBlocker;

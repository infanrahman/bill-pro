import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLicense } from '../../../contexts/LicenseContext';
import { ActivationModal } from '../../../components/Settings/LicenseComponents';
import { Shield, CheckCircle, AlertTriangle, Key } from 'lucide-react';
import { format } from 'date-fns';

const LicenseTab: React.FC = () => {
 const { t } = useTranslation();
 const { status, remainingDays, machineId, resetLicense } = useLicense();
 const [showActivationModel, setShowActivationModal] = useState(false);

 const handleReset = async () => {
 if (window.confirm(t('license.reset_confirm', 'Are you sure you want to reset the license? This will remove the current key and require re-activation.'))) {
 const success = await resetLicense();
 if (success) {
 // Success feedback handled by status change to 'expired' which triggers blocker
 }
 }
 };

 const getStatusColor = () => {
 if (status === 'ok') return 'text-green-500 bg-green-500/10 border-green-500/20';
 if (status === 'expired') return 'text-red-500 bg-red-500/10 border-red-500/20';
 if (status === 'pirated') return 'text-red-600 bg-red-600/10 border-red-600/20';
 return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'; // Trial (if implement 'trial' status explicitly) or loading
 };

 // Derived status text
 const statusText = status === 'ok' ? 'Active / PRO' : status === 'expired' ? 'Expired' : status === 'pirated' ? 'Restricted' : 'Trial Mode';

 return (
 <div className="space-y-6 fade-in slide-in-from-bottom-4">
 <div>
 <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
 <Shield className="w-6 h-6 text-slate-900 dark:text-white"/>
 {t('license.license_info', 'License Information')}
 </h2>
 <p className="text-slate-700 dark:text-slate-300 mt-1">
 {t('license.manage_desc', 'View your application license status and activation details.')}
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Status Card */}
 <div className={`p-6 rounded-xl border ${getStatusColor()} flex items-start gap-4`}>
 <div className="p-3 bg-white dark:bg-slate-900 rounded-full">
 {status === 'ok' ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
 </div>
 <div>
 <h3 className="font-bold text-lg">{t('license.status', 'Product Status')}</h3>
 <p className="text-2xl font-semibold mt-1 uppercase tracking-wider">{statusText}</p>
 {status !== 'ok' && (
 <p className="mt-2 text-sm opacity-90">
 {remainingDays} {t('license.days_remaining', 'days remaining')}
 </p>
)}
 {/* Expiry Date Display */}
 {(status === 'ok' || status === 'expired') && (
 <p className="mt-2 text-xs opacity-75">
 {t('license.expires_on', 'Expires on:')} {remainingDays > 3650 ? 'Never (Lifetime)' : format(new Date(Date.now() + remainingDays * 86400000), 'dd MMM yyyy')}
 </p>
)}
 </div>
 </div>

 {/* Machine Info Card */}
 <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
 <div>
 <div className="flex items-center gap-2 mb-2 text-slate-700 dark:text-slate-300">
 <Key size={18} />
 <span className="text-sm font-medium">{t('license.machine_id', 'Machine ID')}</span>
 </div>
 <code className="block bg-slate-100 dark:bg-slate-900 p-3 rounded-lg font-mono text-sm border border-slate-200 dark:border-slate-700 select-all text-slate-900 dark:text-white break-all">
 {machineId || 'Loading...'}
 </code>
 <p className="text-xs text-slate-600 mt-2">
 {t('license.share_id', 'Share this ID with support to recover your license.')}
 </p>
 </div>
 </div>
 </div>

 {/* Activation Section */}
 <div className="to-indigo-700 rounded-xl p-5 text-white">
 <div className="flex flex-col md:flex-row items-center justify-between gap-6">
 <div>
 <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
 <Shield className="w-5 h-5"/>
 {status === 'ok' ? t('license.pro_title', 'Billing PRO Active') : t('license.activate_title', 'Activate Full Version')}
 </h3>
 <p className="text-slate-700 dark:text-slate-300 text-sm max-w-xl">
 {status === 'ok'
 ? t('license.pro_desc', 'You are running the fully activated version. Thank you for your business!')
 : t('license.trial_desc', 'Unlock all features and remove time limits by activating your license key.')
 }
 </p>
 </div>

 {status !== 'ok' && (
 <button type="button"
 onClick={() => setShowActivationModal(true)}
 className="px-6 py-3 bg-white text-slate-900 dark:text-white font-bold rounded-lg shadow hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
 >
 {t('license.activate_now', 'Activate Now')}
 </button>
)}
 </div>
 </div>

 {/* Danger Zone / Reset */}
 <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
 <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
 {t('license.advanced_options', 'Advanced Options')}
 </h3>
 <button type="button"
 onClick={handleReset}
 className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium"
 >
 <AlertTriangle size={16} />
 {t('license.reset_license', 'Reset License')}
 </button>
 </div>

 <ActivationModal
 isOpen={showActivationModel}
 onClose={() => setShowActivationModal(false)}
 canClose={true}
 />
 </div>
);
};

export default LicenseTab;

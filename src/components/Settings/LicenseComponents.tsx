import React, { useState } from 'react';
import { X, Lock, CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import { useLicense } from '../../contexts/LicenseContext';
import { useTranslation } from 'react-i18next';

interface ActivationModalProps {
 isOpen: boolean;
 onClose: () => void;
 canClose?: boolean;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({ isOpen, onClose, canClose = true }) => {
 const { activate, machineId } = useLicense();
 const { t } = useTranslation();
 const [key, setKey] = useState('');
 const [error, setError] = useState('');
 const [success, setSuccess] = useState(false);
 const [loading, setLoading] = useState(false);
 const [copied, setCopied] = useState(false);

 if (!isOpen) return null;

 const handleCopy = () => {
 if (machineId) {
 navigator.clipboard.writeText(machineId);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setLoading(true);

 const isSuccess = await activate(key);
 setLoading(false);

 if (isSuccess) {
 setSuccess(true);
 setTimeout(() => {
 onClose();
 setSuccess(false);
 setKey('');
 }, 1500);
 } else {
 setError(t('license.invalid_key', 'Invalid license key. Please check and try again.'));
 }
 };

 return (
 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4">
 <div className="bg-slate-900/75 backdrop-blur-md border border-slate-700 rounded-xl w-full max-w-md overflow-hidden fade-in zoom-in">
 {/* Header */}
 <div className="to-slate-900 p-6 flex justify-between items-center border-b border-slate-800">
 <h2 className="text-xl font-bold text-white flex items-center gap-2">
 <Lock className="w-5 h-5 text-slate-700 dark:text-slate-300"/>
 {t('license.activate_title', 'Activate License')}
 </h2>
 {canClose && (
 <button type="button"onClick={onClose} className="text-slate-600 hover:text-white">
 <X className="w-5 h-5"/>
 </button>
)}
 </div>

 {/* Body */}
 <div className="p-6">
 {success ? (
 <div className="text-center py-8">
 <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/>
 <h3 className="text-xl font-bold text-white mb-2">{t('license.activated', 'Activated!')}</h3>
 <p className="text-slate-600">{t('license.thank_you', 'Thank you for your purchase.')}</p>
 </div>
) : (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-4">
 <div className="flex justify-between items-center mb-2">
 <p className="text-sm text-slate-600">{t('license.machine_id', 'Machine ID')}:</p>
 <button
 type="button"
 onClick={handleCopy}
 className="text-xs flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-600"
 >
 {copied ? <CheckCircle className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
 {copied ? 'Copied' : 'Copy'}
 </button>
 </div>
 <code className="block bg-slate-900/75 backdrop-blur-md p-3 rounded text-slate-700 dark:text-slate-300 font-mono text-sm break-all select-all border border-slate-800/50">
 {machineId || 'Loading...'}
 </code>
 <p className="text-xs text-slate-700 mt-2">
 {t('license.share_id', 'Share this ID with support to get your license key.')}
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-300 mb-1">
 {t('license.enter_key', 'License Key')}
 </label>
 <input
 type="text"
 value={key}
 onChange={(e) => setKey(e.target.value)}
 placeholder="PRO-XXXX-XXXX-XXXX"
 className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 font-mono tracking-wide"
 required
 />
 </div>

 {error && (
 <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50">
 <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
 <span>{error}</span>
 </div>
)}

 <button
 type="submit"
 disabled={loading || !key}
 className="w-full bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white font-bold py-3 rounded-lg hover: disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
 >
 {loading ? (
 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"/>
) : (
 t('license.activate_btn', 'Activate Now')
)}
 </button>
 </form>
)}
 </div>
 </div>
 </div>
);
};

export const TrialBanner: React.FC = () => {
 const { status, remainingDays } = useLicense();
 const [showModal, setShowModal] = useState(false);
 const { t } = useTranslation();

 // Don't show if active or loading
 if (status === 'ok' || status === 'loading') return null;

 // Determine colors
 const isUrgent = remainingDays <= 3;
 const bgColor = isUrgent ? 'bg-red-600' : 'bg-indigo-600';

 return (
 <>
 <div className={`${bgColor} text-white px-4 py-1.5 flex justify-between items-center text-sm font-medium relative z-50`}>
 <div className="flex items-center gap-2">
 <span className="bg-white px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
 {t('license.trial_mode', 'TRIAL MODE')}
 </span>
 <span>
 {remainingDays > 0
 ? t('license.days_left', '{{days}} days remaining in your trial.', { days: remainingDays })
 : t('license.expired_msg', 'Trial expired. Please activate.')
 }
 </span>
 </div>
 <button type="button"
 onClick={() => setShowModal(true)}
 className="bg-white text-indigo-900 hover:bg-indigo-50 px-3 py-1 rounded text-xs font-bold"
 >
 {t('license.activate_now', 'ACTIVATE NOW')}
 </button>
 </div>

 <ActivationModal
 isOpen={showModal}
 onClose={() => setShowModal(false)}
 canClose={status !== 'expired' && status !== 'pirated'}
 />
 </>
);
};

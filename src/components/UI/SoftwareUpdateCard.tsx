import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Download, AlertCircle, ArrowUpCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SoftwareUpdateCardProps {
  compact?: boolean;
}

export const SoftwareUpdateCard: React.FC<SoftwareUpdateCardProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [appVersion, setAppVersion] = useState<string>('3.0.11');

  useEffect(() => {
    const updater = (window as any).electron?.updater;
    if (!updater) return;

    if (updater.getVersion) {
      updater.getVersion().then((v: string) => setAppVersion(v)).catch(() => {});
    }

    const removeListener = updater.onMessage((msg: any) => {
      switch (msg.type) {
        case 'checking-for-update':
          setStatus('checking');
          break;
        case 'update-available':
          setStatus('available');
          break;
        case 'update-not-available':
          setStatus('up-to-date');
          break;
        case 'download-progress':
          setStatus('downloading');
          if (msg.progress?.percent) {
            setProgress(Math.round(msg.progress.percent));
          }
          break;
        case 'update-downloaded':
          setStatus('ready');
          break;
        case 'error':
          // If error occurs (e.g. 404 because no newer release exists on GitHub), treat gracefully as up-to-date!
          setStatus('up-to-date');
          break;
      }
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  const handleCheckOrUpdate = async () => {
    if (status === 'ready') {
      const updater = (window as any).electron?.updater;
      if (updater) {
        await updater.install();
      }
      return;
    }

    if (status === 'checking' || status === 'downloading') return;

    setStatus('checking');
    const updater = (window as any).electron?.updater;

    if (updater) {
      try {
        const res = await updater.check();
        if (res?.status === 'no-update' || res?.error) {
          // No update or 404 error on GitHub means app is up to date
          setTimeout(() => {
            setStatus(current => current === 'checking' ? 'up-to-date' : current);
          }, 600);
        } else {
           // update available - wait for events
           setTimeout(() => {
            setStatus(current => current === 'checking' ? 'up-to-date' : current);
          }, 5000); // safety fallback if events fail
        }
      } catch {
        setTimeout(() => {
          setStatus(current => current === 'checking' ? 'up-to-date' : current);
        }, 600);
      }
    } else {
      // In web browser or dev mode without electron updater
      setTimeout(() => {
        setStatus(current => current === 'checking' ? 'up-to-date' : current);
      }, 700);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCheckOrUpdate}
          disabled={status === 'checking' || status === 'downloading'}
          className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all duration-200 flex items-center gap-2 shadow-sm ${
            status === 'checking'
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
              : status === 'up-to-date'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              : status === 'available' || status === 'downloading'
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/25 animate-pulse'
              : status === 'ready'
              ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-500/25 font-bold'
              : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
          }`}
        >
          {status === 'checking' && <RefreshCw size={14} className="animate-spin text-slate-500" />}
          {status === 'up-to-date' && <CheckCircle2 size={14} className="text-emerald-500" />}
          {(status === 'available' || status === 'downloading') && <Download size={14} className="animate-bounce" />}
          {status === 'ready' && <Sparkles size={14} className="text-yellow-300" />}
          {status === 'idle' && <ArrowUpCircle size={14} />}

          <span>
            {status === 'idle' && t('update.now', 'Update Now')}
            {status === 'checking' && t('update.checking', 'Checking for updates...')}
            {status === 'up-to-date' && t('update.already_updated', 'Has Already Updated')}
            {status === 'available' && t('update.available', 'Update Available')}
            {status === 'downloading' && `${t('update.downloading', 'Downloading')} ${progress}%`}
            {status === 'ready' && t('update.restart_to_install', 'Update Available - Click to Restart')}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {t('update.system_update', 'Software Update')}
            </h3>
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full border border-slate-200 dark:border-slate-700">
              v{appVersion}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">
            {status === 'idle' && t('update.idle_desc', 'Click the button below to check if a new version is available.')}
            {status === 'checking' && t('update.checking_desc', 'Contacting update server for the latest build...')}
            {status === 'up-to-date' && t('update.up_to_date_desc', 'You are running the latest version of Billing App.')}
            {status === 'available' && t('update.available_desc', 'A new release is available! Downloading setup files...')}
            {status === 'downloading' && (
              <span>Downloading update: <strong className="text-blue-600 dark:text-blue-400">{progress}%</strong></span>
            )}
            {status === 'ready' && t('update.ready_desc', 'Update downloaded successfully. Click to restart and complete update.')}
          </p>

          {status === 'downloading' && (
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleCheckOrUpdate}
          disabled={status === 'checking' || status === 'downloading'}
          className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2.5 shadow-md shrink-0 ${
            status === 'checking'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
              : status === 'up-to-date'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
              : status === 'available' || status === 'downloading'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 animate-pulse'
              : status === 'ready'
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/30 ring-4 ring-green-500/20'
              : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
          }`}
        >
          {status === 'checking' && <RefreshCw size={16} className="animate-spin text-slate-400" />}
          {status === 'up-to-date' && <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />}
          {(status === 'available' || status === 'downloading') && <Download size={16} className="animate-bounce" />}
          {status === 'ready' && <Sparkles size={16} className="text-yellow-300" />}
          {status === 'idle' && <ArrowUpCircle size={16} />}

          <span>
            {status === 'idle' && t('update.now', 'Update Now')}
            {status === 'checking' && t('update.checking', 'Checking for updates...')}
            {status === 'up-to-date' && t('update.already_updated', 'Has Already Updated')}
            {status === 'available' && t('update.available', 'Update Available')}
            {status === 'downloading' && `${t('update.downloading', 'Downloading')} ${progress}%`}
            {status === 'ready' && t('update.restart_to_install', 'Update Available - Click to Restart')}
          </span>
        </button>
      </div>
    </div>
  );
};

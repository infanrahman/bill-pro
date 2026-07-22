import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const AutoUpdateBanner: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updater = (window as any).electron?.updater;
    if (!updater) return;

    const removeListener = updater.onMessage((msg: any) => {
      switch (msg.type) {
        case 'checking-for-update':
          setStatus('checking');
          break;
        case 'update-available':
          setStatus('available');
          setVisible(true);
          break;
        case 'update-not-available':
          setStatus('idle');
          break;
        case 'download-progress':
          setStatus('downloading');
          setVisible(true);
          if (msg.progress?.percent) {
            setProgress(Math.round(msg.progress.percent));
          }
          break;
        case 'update-downloaded':
          setStatus('ready');
          setVisible(true);
          break;
        case 'error':
          setStatus('error');
          setErrorMsg(msg.error);
          setVisible(true);
          break;
      }
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  const handleInstall = () => {
    const updater = (window as any).electron?.updater;
    if (updater) {
      updater.install();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-white dark:bg-gray-800 shadow-2xl rounded-lg p-4 max-w-sm border-l-4 border-blue-500 flex items-start gap-3">
      {status === 'available' && <Download className="w-6 h-6 text-blue-500 mt-1" />}
      {status === 'downloading' && <RefreshCw className="w-6 h-6 text-blue-500 mt-1 animate-spin" />}
      {status === 'ready' && <RefreshCw className="w-6 h-6 text-green-500 mt-1" />}
      {status === 'error' && <AlertCircle className="w-6 h-6 text-red-500 mt-1" />}

      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {status === 'available' && t('update.available', 'Update Available')}
          {status === 'downloading' && t('update.downloading', 'Downloading Update...')}
          {status === 'ready' && t('update.ready', 'Update Ready')}
          {status === 'error' && t('update.error', 'Update Error')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {status === 'available' && t('update.availableDesc', 'A new version is downloading in the background.')}
          {status === 'downloading' && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 dark:bg-gray-700">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          )}
          {status === 'ready' && t('update.readyDesc', 'Restart the application to apply the update.')}
          {status === 'error' && (errorMsg || t('update.errorDesc', 'An error occurred while updating.'))}
        </p>

        {status === 'ready' && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            {t('update.restart', 'Restart to Install')}
          </button>
        )}
      </div>

      <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

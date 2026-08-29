import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Server, Lock, Trash2, RefreshCw, CheckCircle2, Loader2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { SyncEngine } from '../../../services/syncEngine';
import { Capacitor } from '@capacitor/core';

export default function NetworkSyncTab() {
  const isMaster = !!window.electron;
  const hostInfo = SyncEngine.getHostInfo();

  // Master (PC) state
  const [hostPin, setHostPin] = useState('');

  // Client (Mobile) state
  const [connectionStatus, setConnectionStatus] = useState(SyncEngine.getConnectionStatus());
  const [isRetrying, setIsRetrying] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualUrl, setManualUrl] = useState(hostInfo.url);
  const [manualPin, setManualPin] = useState(hostInfo.pin);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    setLastSyncTime(localStorage.getItem('lastSyncTime'));
  }, []);

  useEffect(() => {
    if (isMaster) {
      window.electron?.sync.getPin().then((pin: string) => setHostPin(pin));
      return;
    }
    // Subscribe to live connection status
    const unsub = SyncEngine.onConnectionChange(s => setConnectionStatus(s));
    return unsub;
  }, [isMaster]);

  const handleRetryConnect = useCallback(async () => {
    setIsRetrying(true);
    setLatencyMs(null);
    try {
      if (hostInfo.url) {
        const { ok, latencyMs: ms } = await SyncEngine.testConnection();
        if (ok) {
          setLatencyMs(ms);
          SyncEngine.startClientSync(5000);
        } else {
          // Saved host is gone — run auto-discovery
          await SyncEngine.autoDiscoverAndConnect();
        }
      } else {
        await SyncEngine.autoDiscoverAndConnect();
      }
    } finally {
      setIsRetrying(false);
    }
  }, [hostInfo.url]);

  const handleForgetPC = () => {
    SyncEngine.stopClientSync();
    SyncEngine.setHostUrl('', '');
    setManualUrl('');
    setManualPin('');
    // Start fresh auto-discovery
    if (Capacitor.isNativePlatform()) {
      SyncEngine.autoDiscoverAndConnect();
    }
  };

  const handleManualConnect = () => {
    if (!manualUrl || !manualPin) return;
    SyncEngine.setHostUrl(manualUrl, manualPin);
    SyncEngine.stopClientSync();
    SyncEngine.startClientSync(5000);
  };

  if (isMaster) {
    return (
      <div className="p-6 md:p-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Network Sync Server</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This PC is acting as the sync server. Mobile devices on the same Wi-Fi will auto-connect.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-2xl flex items-center justify-center">
            <Server size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Master Server Active</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Broadcasting presence on local network. Mobile devices will detect and connect automatically.
            </p>
          </div>

          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 rounded-xl">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Fallback PIN Code</p>
            <p className="font-mono font-bold text-blue-600 dark:text-blue-400 text-4xl tracking-[0.3em]">
              {hostPin || '------'}
            </p>
            <p className="text-xs text-slate-400 mt-2">Only needed if auto-connect fails</p>
          </div>
        </div>
      </div>
    );
  }

  // --- CLIENT (MOBILE) VIEW ---
  const paired = !!hostInfo.url;

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-lg">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Connect to PC</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Auto-connects to the PC software on the same Wi-Fi. No setup required.
        </p>
      </div>

      {/* Live Status Card */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${
        connectionStatus === 'connected'
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
          : connectionStatus === 'connecting'
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
      }`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
          connectionStatus === 'connected' ? 'bg-emerald-100 dark:bg-emerald-900/50'
          : connectionStatus === 'connecting' ? 'bg-amber-100 dark:bg-amber-900/50'
          : 'bg-slate-100 dark:bg-slate-700'
        }`}>
          {connectionStatus === 'connected' && <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />}
          {connectionStatus === 'connecting' && <Loader2 size={24} className="text-amber-600 dark:text-amber-400 animate-spin" />}
          {connectionStatus === 'disconnected' && <WifiOff size={24} className="text-slate-500" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-white">
            {connectionStatus === 'connected' ? 'Connected to PC' :
             connectionStatus === 'connecting' ? 'Searching for PC...' :
             'Not Connected'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {connectionStatus === 'connected' && hostInfo.url
              ? `${hostInfo.url}${latencyMs != null ? ` · ${latencyMs}ms` : ''}`
              : connectionStatus === 'connecting'
              ? 'Scanning Wi-Fi for PC software...'
              : 'Make sure both devices are on the same Wi-Fi'}
          </p>
        </div>
      </div>

      {/* Last Sync */}
      {lastSyncTime && connectionStatus === 'connected' && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Clock size={12} />
          <span>Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleRetryConnect}
          disabled={isRetrying}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50 active:scale-[0.98]"
        >
          {isRetrying
            ? <><Loader2 size={16} className="animate-spin" /> Searching...</>
            : <><RefreshCw size={16} /> {paired ? 'Reconnect' : 'Search for PC'}</>
          }
        </button>

        {paired && (
          <button
            onClick={handleForgetPC}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 active:scale-[0.98] transition-transform"
          >
            <Trash2 size={16} /> Forget
          </button>
        )}
      </div>

      {/* Advanced / Manual Setup (collapsed) */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span>Advanced / Manual Setup</span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-3">
              Use this only if auto-connect doesn't work. Enter the PC's IP address and the PIN shown on the PC software.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Host URL</label>
              <input
                type="text"
                placeholder="e.g. http://192.168.1.15:4500"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                value={manualUrl}
                onChange={e => setManualUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">PIN</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="6-digit PIN"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:text-white tracking-widest"
                    value={manualPin}
                    onChange={e => setManualPin(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleManualConnect}
                  disabled={!manualUrl || !manualPin}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wifi, Save, Server, QrCode, HardDriveDownload, Search, Lock } from 'lucide-react';
import { SyncEngine } from '../../../services/syncEngine';
import { ZeroConf } from '@mhaberler/capacitor-zeroconf-nsd';

export default function NetworkSyncTab() {
  const { t } = useTranslation();
  const hostInfo = SyncEngine.getHostInfo();
  const [hostUrl, setHostUrl] = useState(hostInfo.url);
  const [syncPin, setSyncPin] = useState(hostInfo.pin);
  const [localIp, setLocalIp] = useState('');
  const [hostPin, setHostPin] = useState('');
  const [discoveredHosts, setDiscoveredHosts] = useState<{name: string, url: string}[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const isMaster = !!window.electron;

  useEffect(() => {
    if (isMaster) {
      setLocalIp('192.168.1.xxx');
      window.electron?.sync.getPin().then(pin => setHostPin(pin));
    }
  }, [isMaster]);

  const scanNetwork = async () => {
    if (isMaster) return;
    setIsScanning(true);
    setDiscoveredHosts([]);
    try {
        ZeroConf.addListener('discover', (result: any) => {
            if (result.action === 'resolved' && result.service.port === 4500) {
                const ipv4 = result.service.ipv4Addresses?.[0];
                if (ipv4) {
                    setDiscoveredHosts(prev => {
                        const url = `http://${ipv4}:4500`;
                        if (prev.find(p => p.url === url)) return prev;
                        return [...prev, { name: result.service.name, url }];
                    });
                }
            }
        });
        await ZeroConf.watch({ type: '_billingapp._tcp.', domain: 'local.' });
        setTimeout(async () => {
            await ZeroConf.unwatch({ type: '_billingapp._tcp.', domain: 'local.' });
            setIsScanning(false);
        }, 10000); // 10 second scan
    } catch (e) {
        console.error('Zeroconf error', e);
        setIsScanning(false);
    }
  };

  const saveHostUrl = () => {
    if (!hostUrl || !syncPin) {
        alert('Please enter both the Host URL and the 6-digit PIN');
        return;
    }
    SyncEngine.setHostUrl(hostUrl, syncPin);
    alert('Host paired successfully! Restarting sync engine...');
    SyncEngine.stopClientSync();
    SyncEngine.startClientSync(5000);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-300 h-full overflow-y-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Local Network Sync (Tablet Mode)</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sync data between the main PC and mobile tablets on the same Wi-Fi network.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        
        {isMaster ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl flex flex-col items-center text-center gap-4">
            <Server size={48} className="text-blue-500" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Master Server Active</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                This PC is broadcasting its presence on the network. Tablets can discover it automatically.
              </p>
            </div>
            
            <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-xl flex flex-col items-center gap-2">
              <span className="block text-xs font-bold text-slate-500 uppercase">Pairing PIN Code:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-4xl tracking-widest">{hostPin || '------'}</span>
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              Enter this PIN on your tablet to securely connect. (Server IP: {localIp}:4500)
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <Wifi className="text-slate-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Tablet Client Mode</h3>
                <p className="text-sm text-slate-500">Scan for the Host PC or enter its details manually.</p>
              </div>
            </div>

            <button
                onClick={scanNetwork}
                disabled={isScanning}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {isScanning ? (
                    <><Search size={18} className="animate-spin" /> Scanning Wi-Fi...</>
                ) : (
                    <><Search size={18} /> Scan for PC Software</>
                )}
            </button>

            {discoveredHosts.length > 0 && (
                <div className="space-y-2 mt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Discovered PCs</label>
                    {discoveredHosts.map(host => (
                        <div key={host.url} onClick={() => setHostUrl(host.url)} className="p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex justify-between items-center">
                            <span className="font-bold text-slate-900 dark:text-white">{host.name}</span>
                            <span className="text-xs text-emerald-600 font-mono bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded">{host.url}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Host URL</label>
                  <input
                    type="text"
                    placeholder="e.g. http://192.168.1.15:4500"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    value={hostUrl}
                    onChange={e => setHostUrl(e.target.value)}
                  />
              </div>
              
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pairing PIN</label>
                  <div className="flex gap-3">
                      <div className="relative flex-1">
                          <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit PIN"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 dark:text-white tracking-widest font-mono"
                            value={syncPin}
                            onChange={e => setSyncPin(e.target.value)}
                          />
                      </div>
                      <button
                        onClick={saveHostUrl}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
                      >
                        <Save size={18} /> Connect
                      </button>
                  </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">Sync Status</span>
                    {hostUrl ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Paired to {hostUrl}
                        </span>
                    ) : (
                        <span className="text-slate-400 font-bold">Not Paired</span>
                    )}
                </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

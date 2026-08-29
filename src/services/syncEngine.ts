import { db } from './db';
import type { SyncEntity } from './db';
import { Capacitor } from '@capacitor/core';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export class SyncEngine {
  private static syncInterval: any;
  private static isSyncing = false;
  private static hostUrl = localStorage.getItem('syncHostUrl') || '';
  private static syncPin = localStorage.getItem('syncPin') || '';
  private static _connectionStatus: ConnectionStatus = 'disconnected';
  private static _statusListeners: Array<(s: ConnectionStatus) => void> = [];
  private static _isDiscovering = false;

  static setHostUrl(url: string, pin: string) {
    this.hostUrl = url;
    this.syncPin = pin;
    localStorage.setItem('syncHostUrl', url);
    localStorage.setItem('syncPin', pin);
  }

  static getHostInfo() {
    return { url: this.hostUrl, pin: this.syncPin };
  }

  static getConnectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  static onConnectionChange(cb: (status: ConnectionStatus) => void): () => void {
    this._statusListeners.push(cb);
    // Return unsubscribe function
    return () => {
      this._statusListeners = this._statusListeners.filter(l => l !== cb);
    };
  }

  private static setStatus(s: ConnectionStatus) {
    if (this._connectionStatus === s) return;
    this._connectionStatus = s;
    this._statusListeners.forEach(cb => cb(s));
  }

  // ---------------------------------------------------------
  // TEST CONNECTION — ping the saved host
  // ---------------------------------------------------------
  static async testConnection(): Promise<{ ok: boolean; latencyMs: number }> {
    if (!this.hostUrl) return { ok: false, latencyMs: 0 };
    const start = Date.now();
    try {
      const res = await fetch(`${this.hostUrl}/api/sync/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        this.setStatus('connected');
        return { ok: true, latencyMs };
      }
      this.setStatus('disconnected');
      return { ok: false, latencyMs };
    } catch {
      this.setStatus('disconnected');
      return { ok: false, latencyMs: 0 };
    }
  }

  // ---------------------------------------------------------
  // AUTO DISCOVER & CONNECT — ZeroConf mDNS scan
  // ---------------------------------------------------------
  static async autoDiscoverAndConnect(): Promise<boolean> {
    if (window.electron) return false; // Only for mobile
    if (this._isDiscovering) return false;
    if (!Capacitor.isNativePlatform()) return false;

    this._isDiscovering = true;
    this.setStatus('connecting');

    try {
      // Dynamically import to avoid bundling issues on desktop
      const { ZeroConf } = await import('@mhaberler/capacitor-zeroconf-nsd');

      return await new Promise<boolean>((resolve) => {
        let found = false;
        let listenerHandle: { remove: () => Promise<void> } | null = null;

        const cleanup = async () => {
          try { await ZeroConf.unwatch({ type: '_billingapp._tcp.', domain: 'local.' }); } catch {}
          try { await listenerHandle?.remove(); } catch {}
          listenerHandle = null;
        };

        const timeout = setTimeout(async () => {
          if (!found) {
            await cleanup();
            this._isDiscovering = false;
            this.setStatus('disconnected');
            resolve(false);
          }
        }, 30000);

        ZeroConf.addListener('discover', async (result: any) => {
          if (found) return;
          if (result.action !== 'resolved') return;

          const ipv4 = result.service?.ipv4Addresses?.[0];
          const port = result.service?.port || 4500;
          // PIN is embedded in TXT record by the PC server
          const pin = result.service?.txtRecord?.pin || result.service?.txt?.pin || '';

          if (!ipv4) return;

          const url = `http://${ipv4}:${port}`;

          // Test that the host is actually reachable
          try {
            const res = await fetch(`${url}/api/sync/ping`, {
              signal: AbortSignal.timeout(3000),
            });
            if (!res.ok) return;
          } catch {
            return; // Not reachable, keep scanning
          }

          found = true;
          clearTimeout(timeout);

          // Save and start sync
          this.setHostUrl(url, pin);
          this.setStatus('connected');
          this.startClientSync(5000);

          await cleanup();
          this._isDiscovering = false;
          resolve(true);
        }).then(handle => { listenerHandle = handle; });

        ZeroConf.watch({ type: '_billingapp._tcp.', domain: 'local.' }).catch(async () => {
          clearTimeout(timeout);
          await cleanup();
          this._isDiscovering = false;
          this.setStatus('disconnected');
          resolve(false);
        });
      });
    } catch (e) {
      console.error('[SyncEngine] Auto-discovery failed:', e);
      this._isDiscovering = false;
      this.setStatus('disconnected');
      return false;
    }
  }

  // ---------------------------------------------------------
  // STARTUP — call this on app mount (mobile only)
  // ---------------------------------------------------------
  static async initMobileSync(): Promise<void> {
    if (window.electron) return;

    if (this.hostUrl) {
      // Already paired — test if still reachable
      this.setStatus('connecting');
      const { ok } = await this.testConnection();
      if (ok) {
        this.startClientSync(5000);
        return;
      }
      // Saved host is gone — try to rediscover
      console.warn('[SyncEngine] Saved host unreachable, re-discovering...');
    }

    // No host or host went away — run auto-discovery
    this.autoDiscoverAndConnect();
  }

  // ---------------------------------------------------------
  // MASTER MODE (Runs in Electron Renderer)
  // ---------------------------------------------------------
  static initMasterListeners() {
    if (!window.electron?.sync) return;

    console.log('[SyncEngine] Initializing Master Mode IPC Listeners');

    window.electron.sync.onPullRequest(async (payload: { reqId: string, payload: { lastSync: string } }) => {
      const { reqId, payload: requestData } = payload;
      try {
        const lastSyncTime = requestData.lastSync ? new Date(requestData.lastSync) : new Date(0);
        const data = await this.exportModifiedSince(lastSyncTime);
        window.electron!.sync.sendPullResponse(reqId, data);
      } catch (e: any) {
        window.electron!.sync.sendPullResponse(reqId, undefined, e.message);
      }
    });

    window.electron.sync.onPushRequest(async (payload: { reqId: string, payload: { changes: any } }) => {
      const { reqId, payload: requestData } = payload;
      try {
        await this.importChanges(requestData.changes);
        window.electron!.sync.sendPushResponse(reqId, { success: true, timestamp: new Date().toISOString() });
      } catch (e: any) {
        window.electron!.sync.sendPushResponse(reqId, undefined, e.message);
      }
    });
  }

  // ---------------------------------------------------------
  // CLIENT MODE (Runs in Browser / Mobile)
  // ---------------------------------------------------------
  static startClientSync(intervalMs: number = 5000) {
    if (window.electron) return;
    if (this.syncInterval) clearInterval(this.syncInterval);

    console.log(`[SyncEngine] Starting Client Mode Background Sync every ${intervalMs}ms`);
    this.syncInterval = setInterval(() => this.performClientSync(), intervalMs);
    setTimeout(() => this.performClientSync(), 1000);
  }

  static stopClientSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private static async performClientSync() {
    if (this.isSyncing || !this.hostUrl) return;
    this.isSyncing = true;

    try {
      const lastSync = localStorage.getItem('lastSyncTime') || new Date(0).toISOString();
      const currentSyncTime = new Date().toISOString();

      const pullRes = await fetch(`${this.hostUrl}/api/sync/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSync, pin: this.syncPin }),
        signal: AbortSignal.timeout(15000),
      });
      if (!pullRes.ok) throw new Error('Pull failed');
      const incomingChanges = await pullRes.json();

      if (Object.keys(incomingChanges).some(k => incomingChanges[k].length > 0)) {
        await this.importChanges(incomingChanges);
      }

      const lastPush = localStorage.getItem('lastPushTime') || new Date(0).toISOString();
      const outgoingChanges = await this.exportModifiedSince(new Date(lastPush));

      let hasChanges = false;
      for (const table in outgoingChanges) {
        if (outgoingChanges[table].length > 0) hasChanges = true;
      }

      if (hasChanges) {
        const pushRes = await fetch(`${this.hostUrl}/api/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: outgoingChanges, pin: this.syncPin }),
          signal: AbortSignal.timeout(15000),
        });
        if (!pushRes.ok) throw new Error('Push failed');
      }

      localStorage.setItem('lastSyncTime', currentSyncTime);
      localStorage.setItem('lastPushTime', currentSyncTime);
      this.setStatus('connected');
    } catch (e) {
      console.error('[SyncEngine] Sync Error:', e);
      this.setStatus('disconnected');
    } finally {
      this.isSyncing = false;
    }
  }

  // ---------------------------------------------------------
  // CORE DB HELPERS
  // ---------------------------------------------------------

  private static getSyncableTables() {
    return [
      'items', 'customers', 'invoices', 'expenses', 'purchases',
      'suppliers', 'customerPayments', 'purchasePayments',
      'cashEntries', 'cashParties', 'categories', 'heldBills'
    ];
  }

  static async exportModifiedSince(date: Date): Promise<any> {
    const changes: any = {};
    const tables = this.getSyncableTables();

    await db.transaction('r', tables.map(t => (db as any)[t]), async () => {
      for (const tableName of tables) {
        const table = (db as any)[tableName];
        const records = await table.filter((r: SyncEntity) => new Date(r.updatedAt) > date).toArray();
        changes[tableName] = records;
      }
    });

    return changes;
  }

  static async importChanges(changes: any): Promise<void> {
    const tables = Object.keys(changes).filter(t => this.getSyncableTables().includes(t));
    if (tables.length === 0) return;

    await db.transaction('rw', tables.map(t => (db as any)[t]), async () => {
      for (const tableName of tables) {
        const records: SyncEntity[] = changes[tableName];
        if (!records || records.length === 0) continue;

        const table = (db as any)[tableName];
        const existingRecords = await table.where('id').anyOf(records.map(r => r.id)).toArray();
        const existingMap = new Map(existingRecords.map((r: any) => [r.id, r]));

        const toPut = [];
        const newInvoicesToPrint: any[] = [];

        for (const record of records) {
          const existing = existingMap.get(record.id) as SyncEntity | undefined;
          if (!existing || new Date(record.updatedAt) > new Date(existing.updatedAt)) {
            toPut.push(record);

            if (window.electron) {
              const rec = record as any;
              if (!existing && tableName === 'invoices' && rec.items && rec.items.length > 0) {
                newInvoicesToPrint.push(rec);
              } else if (tableName === 'heldBills' && rec.cartItems && rec.cartItems.length > 0) {
                newInvoicesToPrint.push({
                  ...rec,
                  invoiceNumber: `TABLE: ${rec.name} ${existing ? '(UPDATE)' : ''}`,
                  items: rec.cartItems,
                  notes: rec.kitchenNote
                });
              }
            }
          }
        }

        if (toPut.length > 0) {
          await table.bulkPut(toPut);

          if (newInvoicesToPrint.length > 0) {
            setTimeout(async () => {
              try {
                const { generateKitchenTicketPDF } = await import('./invoiceGenerator');
                for (const inv of newInvoicesToPrint) {
                  console.log('[SyncEngine] Triggering Kitchen Print for incoming remote order:', inv.id);
                  await generateKitchenTicketPDF(inv as any);
                }
              } catch (e) {
                console.error('[SyncEngine] Remote Kitchen Print Failed', e);
              }
            }, 100);
          }
        }
      }
    });
  }
}

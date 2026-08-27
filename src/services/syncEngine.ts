import { db } from './db';
import type { SyncEntity } from './db';
import { liveQuery } from 'dexie';

export class SyncEngine {
  private static syncInterval: any;
  private static isSyncing = false;
  private static hostUrl = localStorage.getItem('syncHostUrl') || '';
  private static syncPin = localStorage.getItem('syncPin') || '';

  static setHostUrl(url: string, pin: string) {
    this.hostUrl = url;
    this.syncPin = pin;
    localStorage.setItem('syncHostUrl', url);
    localStorage.setItem('syncPin', pin);
  }

  static getHostInfo() {
    return { url: this.hostUrl, pin: this.syncPin };
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
  // CLIENT MODE (Runs in Browser / Tablet)
  // ---------------------------------------------------------
  static startClientSync(intervalMs: number = 5000) {
    if (window.electron) return; // Don't run client loop on the master PC
    if (this.syncInterval) clearInterval(this.syncInterval);

    console.log(`[SyncEngine] Starting Client Mode Background Sync every ${intervalMs}ms`);
    this.syncInterval = setInterval(() => this.performClientSync(), intervalMs);
    // Initial sync
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

      // 1. PULL changes from Server
      const pullRes = await fetch(`${this.hostUrl}/api/sync/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSync, pin: this.syncPin })
      });
      if (!pullRes.ok) throw new Error('Pull failed');
      const incomingChanges = await pullRes.json();
      
      if (Object.keys(incomingChanges).some(k => incomingChanges[k].length > 0)) {
        await this.importChanges(incomingChanges);
      }

      // 2. PUSH local changes to Server
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
            body: JSON.stringify({ changes: outgoingChanges, pin: this.syncPin })
        });
        if (!pushRes.ok) throw new Error('Push failed');
      }

      localStorage.setItem('lastSyncTime', currentSyncTime);
      localStorage.setItem('lastPushTime', currentSyncTime);

    } catch (e) {
      console.error('[SyncEngine] Sync Error:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  // ---------------------------------------------------------
  // CORE DB HELPERS
  // ---------------------------------------------------------
  
  private static getSyncableTables() {
      // Exclude tables like activityLogs, scaleLogs, etc if needed.
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
        // Fetch all records modified after the specified date
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
          // Conflict Resolution: Last Write Wins
          if (!existing || new Date(record.updatedAt) > new Date(existing.updatedAt)) {
            toPut.push(record);
            
            // Trigger Kitchen Print if this is a newly arrived order on the Master OR an updated table order
            if (window.electron) {
                const rec = record as any;
                if (!existing && tableName === 'invoices' && rec.items && rec.items.length > 0) {
                    newInvoicesToPrint.push(rec);
                } else if (tableName === 'heldBills' && rec.cartItems && rec.cartItems.length > 0) {
                    // Map HeldBill to Invoice format for the kitchen generator
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

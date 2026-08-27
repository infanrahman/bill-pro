import express from 'express';
import cors from 'cors';
import path from 'path';
import { Server } from 'http';
import { BrowserWindow, ipcMain, app } from 'electron';
import { randomUUID } from 'crypto';

export class SyncServer {
  private app: express.Express;
  private server: Server | null = null;
  private mainWindow: BrowserWindow | null = null;
  private bonjourService: any = null;
  private pairingPin: string = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit PIN
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();

  constructor() {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));

    // Let the PC React UI query the PIN
    ipcMain.handle('sync:get-pin', () => this.pairingPin);

    // Listen for renderer responses
    ipcMain.on('sync:pull:response', (event, { reqId, data, error }) => {
      const p = this.pendingRequests.get(reqId);
      if (p) {
        if (error) p.reject(new Error(error));
        else p.resolve(data);
        this.pendingRequests.delete(reqId);
      }
    });

    ipcMain.on('sync:push:response', (event, { reqId, data, error }) => {
      const p = this.pendingRequests.get(reqId);
      if (p) {
        if (error) p.reject(new Error(error));
        else p.resolve(data);
        this.pendingRequests.delete(reqId);
      }
    });

    // Tablets will hit this to fetch records updated after `lastSync`
    this.app.post('/api/sync/pull', async (req, res) => {
      if (req.body.pin !== this.pairingPin) return res.status(401).json({ error: 'Invalid PIN' });
      try {
        const data = await this.askRenderer('sync:pull:request', req.body);
        res.json(data);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Tablets will hit this to push their local offline records
    this.app.post('/api/sync/push', async (req, res) => {
      if (req.body.pin !== this.pairingPin) return res.status(401).json({ error: 'Invalid PIN' });
      try {
        const data = await this.askRenderer('sync:push:request', req.body);
        res.json(data);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/api/sync/ping', (req, res) => {
      res.json({ ok: true, timestamp: Date.now() });
    });

    // Serve static files from the Vite build so tablets can load the app natively over LAN
    // app.getAppPath() points to the root directory where resources are unpacked.
    // We assume dist is a sibling to dist-electron.
    const distPath = path.join(app.getAppPath(), 'dist');
    this.app.use(express.static(distPath));
    
    // Fallback for React Router (Single Page Application)
    this.app.use((req, res, next) => {
        if (req.method === 'GET' && !req.url.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        } else {
            next();
        }
    });
  }

  private askRenderer(channel: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.mainWindow) return reject(new Error('No main window linked to SyncServer'));
      const reqId = randomUUID();
      this.pendingRequests.set(reqId, { resolve, reject });
      this.mainWindow.webContents.send(channel, { reqId, payload });
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.get(reqId)?.reject(new Error('Sync request timed out waiting for Renderer DB'));
          this.pendingRequests.delete(reqId);
        }
      }, 30000);
    });
  }

  start(port: number, window: BrowserWindow) {
    this.mainWindow = window;
    if (this.server) return;
    this.server = this.app.listen(port, '0.0.0.0', () => {
      console.log(`[SyncServer] Running on port ${port}`);
    });
    
    // Start Bonjour broadcast
    try {
        const Bonjour = require('bonjour-service');
        const bonjour = new Bonjour.Bonjour();
        this.bonjourService = bonjour.publish({
            name: `BillingApp-Host`,
            type: 'billingapp',
            port: port,
            txt: { app: 'billing', version: '2.0' }
        });
        console.log('[SyncServer] Bonjour broadcast started as _billingapp._tcp');
    } catch(e) {
        console.error('[SyncServer] Bonjour failed to start', e);
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.bonjourService) {
        this.bonjourService.stop();
    }
  }
}

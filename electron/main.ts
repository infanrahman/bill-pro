import { app, BrowserWindow, ipcMain, dialog, WebContentsPrintOptions, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { autoUpdater } from 'electron-updater';
import { LicenseService } from './services/licenseService';
import { GoogleDriveService } from './services/googleDriveService';
import { ThermalPrinterService } from './services/thermalPrinterService';
import { ScaleDirectService } from './services/scaleDirectService';
import { ZatcaService } from './services/zatcaService';
import { AuthService } from './services/authService';

// Main Process Stability
process.on('uncaughtException', (error) => {
  console.error('CRITICAL: Uncaught Exception in Main Process:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('CRITICAL: Unhandled Rejection in Main Process:', reason);
});

const licenseService = new LicenseService();
const googleDriveService = new GoogleDriveService();
const thermalPrinterService = new ThermalPrinterService();
const zatcaService = new ZatcaService();
const authService = new AuthService();

// IPC Handlers
ipcMain.handle('license:get-status', async () => {
  try {
    console.log('[IPC] license:get-status invoked');
    const status = await licenseService.initialize();
    console.log('[IPC] license:get-status returned:', JSON.stringify(status));
    return status;
  } catch (error) {
    console.error('[IPC Error] license:get-status:', error);
    return { status: 'error', remainingDays: 0, machineId: '', loading: false };
  }
});

ipcMain.handle('license:activate', async (_, key: string) => {
  try {
    console.log('[IPC] license:activate invoked with key length:', key ? key.length : 0);
    console.log('[IPC] Key start:', key ? key.substring(0, 40) : 'none');
    const result = await licenseService.activate(key);
    console.log('[IPC] license:activate returned:', result);
    return result;
  } catch (error) {
    console.error('[IPC Error] license:activate:', error);
    return false;
  }
});

ipcMain.handle('license:reset', async () => {
  try {
    console.log('[IPC] license:reset invoked');
    return await licenseService.reset();
  } catch (error) {
    console.error('[IPC Error] license:reset:', error);
    return false;
  }
});

// Auth / Session IPC
ipcMain.handle('auth:sign-token', async (_, payload: string) => {
  try {
    return await authService.signToken(payload);
  } catch (error) {
    console.error('[IPC Error] auth:sign-token:', error);
    return null;
  }
});

ipcMain.handle('auth:verify-token', async (_, token: string) => {
  try {
    return await authService.verifyToken(token);
  } catch (error) {
    console.error('[IPC Error] auth:verify-token:', error);
    return null;
  }
});

ipcMain.handle('backup-data', async (_, data: string) => {
  try {
    const documentsPath = app.getPath('documents');
    const backupDir = path.join(documentsPath, 'BillingApp_Backups');

    // Ensure directory exists
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json`;
    const filePath = path.join(backupDir, filename);

    await fs.writeFile(filePath, data, 'utf-8');
    return true;
  } catch (error) {
    console.error('Backup failed:', error);
    return false;
  }
});

// Google Drive IPC
ipcMain.handle('google-drive:login', async () => {
  try {
    return await googleDriveService.authenticate();
  } catch (error) {
    console.error('[IPC Error] google-drive:login:', error);
    return false;
  }
});

ipcMain.handle('google-drive:logout', async () => {
  try {
    return await googleDriveService.logout();
  } catch (error) {
    console.error('[IPC Error] google-drive:logout:', error);
    return false;
  }
});

ipcMain.handle('google-drive:status', async () => {
  try {
    return await googleDriveService.checkconnection();
  } catch (error) {
    console.error('[IPC Error] google-drive:status:', error);
    return false;
  }
});

ipcMain.handle('google-drive:upload', async (_, { filename, content }) => {
  try {
    return await googleDriveService.uploadFile(filename, content);
  } catch (error) {
    console.error('[IPC Error] google-drive:upload:', error);
    return false;
  }
});

ipcMain.handle('google-drive:set-config', async (_, config) => {
  try {
    await googleDriveService.saveConfig(config);
    return true;
  } catch (error) {
    console.error('[IPC Error] google-drive:set-config:', error);
    return false;
  }
});

ipcMain.handle('google-drive:get-config', async () => {
  try {
    return await googleDriveService.getConfig();
  } catch (error) {
    console.error('[IPC Error] google-drive:get-config:', error);
    return null;
  }
});

// ZATCA Secure Storage IPC
ipcMain.handle('zatca:get-config', async () => {
  try {
    return await zatcaService.getConfig();
  } catch (error) {
    console.error('[IPC Error] zatca:get-config:', error);
    return null;
  }
});

ipcMain.handle('zatca:save-config', async (_, config) => {
  try {
    return await zatcaService.saveConfig(config);
  } catch (error) {
    console.error('[IPC Error] zatca:save-config:', error);
    return false;
  }
});

ipcMain.handle('zatca:generate-csr', async (_, options) => {
  try {
    return await zatcaService.generateCSR(options);
  } catch (error) {
    console.error('[IPC Error] zatca:generate-csr:', error);
    return null;
  }
});

ipcMain.handle('zatca:sign-hash', async (_, { hashBase64, privateKeyPem }) => {
  try {
    return zatcaService.signHash(hashBase64, privateKeyPem);
  } catch (error) {
    console.error('[IPC Error] zatca:sign-hash:', error);
    return null;
  }
});

ipcMain.handle('zatca:sign-invoice-xml', async (_, { unsignedXml, certificatePem, privateKeyPem }) => {
  try {
    return await zatcaService.signInvoiceXml(unsignedXml, certificatePem, privateKeyPem);
  } catch (error) {
    console.error('[IPC Error] zatca:sign-invoice-xml:', error);
    return null;
  }
});

import { net as electronNet } from 'electron';
ipcMain.handle('zatca:request', async (_, { url, method, headers, body }) => {
  try {
    const fetchImpl = electronNet.fetch || globalThis.fetch;
    const response = await fetchImpl(url, {
      method,
      headers,
      body
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text: text
    };
  } catch (error: any) {
    console.error('ZATCA Proxy Request Error:', error);
    throw error;
  }
});

ipcMain.handle('restore-data', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const content = await fs.readFile(result.filePaths[0], 'utf-8');
    return content;
  } catch (error) {
    console.error('Restore failed:', error);
    return null;
  }
});

// Auto Backup Handlers
ipcMain.handle('select-backup-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-backup-file', async (_, { folderPath, data, filename }) => {
  try {
    // Fix #5: Sanitize filename — strip any directory traversal components
    const safeName = path.basename(
      filename || `AutoBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );

    // Fix #5: Resolve full path and confirm it stays inside the chosen folder
    const resolvedFolder = path.resolve(folderPath);
    const fullPath = path.join(resolvedFolder, safeName);
    if (!fullPath.startsWith(resolvedFolder + path.sep) && fullPath !== resolvedFolder) {
      throw new Error('Path traversal detected — backup aborted.');
    }

    await fs.writeFile(fullPath, data, 'utf-8');

    // Fix #11: Rotate old backups — keep only the 30 most recent AutoBackup_*.json files
    try {
      const MAX_BACKUPS = 30;
      const entries = await fs.readdir(resolvedFolder);
      const autoBackups = entries
        .filter(f => f.startsWith('AutoBackup_') && f.endsWith('.json'))
        .sort(); // ISO timestamp names sort correctly by date

      if (autoBackups.length > MAX_BACKUPS) {
        const toDelete = autoBackups.slice(0, autoBackups.length - MAX_BACKUPS);
        for (const old of toDelete) {
          await fs.unlink(path.join(resolvedFolder, old)).catch(() => { /* ignore */ });
        }
        console.log(`Auto Backup: Rotated ${toDelete.length} old backup(s).`);
      }
    } catch (rotateErr) {
      console.warn('Auto Backup: Rotation check failed (non-fatal):', rotateErr);
    }

    return true;
  } catch (error) {
    console.error('Auto Backup Failed:', error);
    return false;
  }
});

// Get Printers Handler
ipcMain.handle('get-printers', async (event) => {
  try {
    const wins = BrowserWindow.getAllWindows();
    const mainWin = wins.find(w => w.isVisible() && !w.isDestroyed()) || wins[0];
    if (!mainWin) {
      // Fallback if no window found (rare)
      return [];
    }
    const printers = await mainWin.webContents.getPrintersAsync();
    console.log('Main Process: Printers found:', printers.map(p => p.name));
    return printers.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Main Process: Failed to get printers:', error);
    return [];
  }
});

// Thermal Printer Handler
ipcMain.handle('print-thermal-raw', async (_, { data, printerName }) => {
  return await thermalPrinterService.printReceipt(data, printerName);
});

ipcMain.handle('printer:open-drawer', async (_, { printerName }) => {
  return await thermalPrinterService.openCashDrawer(printerName);
});

// Unified Print Handler
ipcMain.handle('print', async (_, content: string, options: { printerName?: string; silent?: boolean; copies?: number; pageSize?: string; landscape?: boolean, margins?: any } = {}) => {
  const { printerName, silent = true, copies = 1, pageSize = 'A4', landscape = false, margins = { marginType: 'printableArea' } } = options;
  console.log('Main Process: Print requested. Options:', JSON.stringify({ printerName, silent, copies, pageSize, landscape }, null, 2));
  console.log('Main Process: Content Length:', content ? content.length : 0);
  if (!content || content.length < 50) {
    console.error("Main Process: WARNING - Content appears empty!");
  }

  let printWin: BrowserWindow | null = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    // Load Content via File (More Reliable than Data URI)
    const tempPath = path.join(app.getPath('temp'), `print_job_${Date.now()}.html`);
    await fs.writeFile(tempPath, content);
    console.log('Main Process: Saved print content to:', tempPath);

    // FIX: Setup listener BEFORE loading to avoid race condition
    console.log('Main Process: Waiting for did-finish-load...');
    const loadPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn("Main Process: Load timeout hit, proceeding anyway...");
        resolve();
      }, 5000); // 5s Safety Timeout

      printWin!.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        resolve();
      });

      printWin!.webContents.once('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout);
        console.error(`Main Process: Failed to load URL: ${errorCode} ${errorDescription}`);
        // Resolve anyway to try printing what we have, or reject?
        // Resolve to attempt print (best effort)
        resolve();
      });
    });

    // Trigger Load
    await printWin.loadFile(tempPath);

    // Wait for completion
    await loadPromise;
    
    // Add a small delay to ensure Base64 images (barcodes/QR) are fully rendered
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Main Process: Content loaded successfully.');

    // Configure Print Options
    const printOptions: WebContentsPrintOptions = {
      silent: silent,
      printBackground: true,
      color: true,
      margins: margins,
      landscape: landscape,
      pagesPerSheet: 1,
      collate: false,
      copies: copies,
      header: ' ',
      footer: ' '
    };

    // Handle Page Size & Normalization
    if (pageSize === '80mm') {
      (printOptions as any).pageSize = { width: 80000, height: 297000 };
    } else {
      // Electron requires proper casing for standard sizes (e.g. 'A4', 'Letter', 'Legal')
      // Map common lowercase inputs to correct standard strings
      const standardSizes: Record<string, string> = {
        'a4': 'A4',
        'a3': 'A3',
        'a5': 'A5',
        'letter': 'Letter',
        'legal': 'Legal',
        'tabloid': 'Tabloid'
      };

      const normalizedSize = typeof pageSize === 'string'
        ? (standardSizes[pageSize.toLowerCase()] || pageSize)
        : pageSize;

      console.log(`Main Process: Normalized pageSize '${pageSize}' -> '${normalizedSize}'`);
      (printOptions as any).pageSize = normalizedSize;
    }

    // Printer Selection Logic
    if (printerName) {
      console.log(`Main Process: Looking for printer: "${printerName}"`);
      const printers = await printWin.webContents.getPrintersAsync();
      console.log('Main Process: Available printers:', printers.map(p => p.name));

      const printer = printers.find(p => 
        p.name.toLowerCase() === printerName.toLowerCase() || 
        (p.displayName && p.displayName.toLowerCase() === printerName.toLowerCase())
      );
      if (printer) {
        console.log(`Main Process: FOUND printer: ${printer.name}`);
        printOptions.deviceName = printer.name;
      } else {
        console.error(`Main Process: Printer '${printerName}' NOT FOUND. Available: ${printers.map(p => p.name).join(', ')}`);
        // Fallback: IF a specific printer was asked for and not found, do NOT show dialog to avoid
        // accidental printing to wrong printer (e.g. kitchen ticket on main printer).
        throw new Error(`Printer '${printerName}' not found. Please check printer settings.`);
      }
    } else {
      console.log('Main Process: No specific printer requested, using default/dialog.');
    }

    console.log('Main Process: Calling webContents.print with options:', JSON.stringify(printOptions, null, 2));

    // DEBUG: Save PDF to check rendering
    try {
      const desktopPath = app.getPath('desktop');
      const debugPdfPath = path.join(desktopPath, 'debug_print.pdf');
      console.log('Main Process: Saving debug PDF to:', debugPdfPath);

      // Use A4 for debug PDF to ensure we capture everything visible
      const pdfData = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4'
      });

      await fs.writeFile(debugPdfPath, pdfData);
      console.log('Main Process: Debug PDF saved successfully.');
    } catch (debugErr) {
      console.error("Main Process: Failed to save debug PDF:", debugErr);
    }

    // Execute Print (Electron sometimes ignores 'copies', we do manual multiple triggers)
    const numCopies = printOptions.copies || 1;
    printOptions.copies = 1; // Reset to 1 for manual looping
    for (let i = 0; i < numCopies; i++) {
        await new Promise<void>((resolve, reject) => {
          if (!printWin) return reject("Window closed before print");
          printWin.webContents.print(printOptions, (success, failureReason) => {
            if (success) {
              console.log(`Main Process: Print callback SUCCESS (Copy ${i + 1}/${numCopies})`);
              resolve();
            } else {
              console.error(`Main Process: Print callback FAILED (Copy ${i + 1}/${numCopies}):`, failureReason);
              reject(new Error(failureReason));
            }
          });
        });

        // Add a small delay between copies for the spooler to process
        if (i < numCopies - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
    }

    console.log('Print completed successfully.');
    return true;

  } catch (error) {
    console.error('Print failed:', error);
    return false;
  } finally {
    // Keep window open slightly longer for debug visibility if needed, or close immediately
    // if (printWin && !printWin.isDestroyed()) {
    //   printWin.close();
    // }
    // printWin = null;

    // For now, close it to avoid clutter, but maybe delay it?
    if (printWin && !printWin.isDestroyed()) {
      setTimeout(() => {
        if (printWin && !printWin.isDestroyed()) printWin.close();
        printWin = null;
      }, 5000); // Wait 5s before closing to admire the work
    }
  }
});


// PDF Download/Share Handler
ipcMain.handle('download-pdf', async (_, { html, filename, silent }) => {
  let printWin: BrowserWindow | null = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // Wait for render/images
    await new Promise(resolve => setTimeout(resolve, 800));

    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 } // CSS handles margins
    });

    let filePath = '';

    if (silent) {
      // Silent Save: Save to Downloads -> Show in Folder
      const downloadsPath = app.getPath('downloads');
      // CRITICAL: Sanitize filename to prevent path traversal
      const safeFilename = path.basename(filename || `Invoice-${Date.now()}.pdf`);
      filePath = path.join(downloadsPath, safeFilename);
    } else {
      // Show Save Dialog
      const { filePath: chosenPath } = await dialog.showSaveDialog({
        title: 'Save Invoice PDF',
        defaultPath: filename || `Invoice-${Date.now()}.pdf`,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
      });
      if (!chosenPath) return false;
      filePath = chosenPath;
    }

    await fs.writeFile(filePath, pdfData);

    if (silent) {
      shell.showItemInFolder(filePath);
    }

    return true;

  } catch (error) {
    console.error('PDF generation failed:', error);
    return false;
  } finally {
    if (printWin) {
      printWin.close();
      printWin = null;
    }
  }
});

// Save File Handler (for Excel/Other)
ipcMain.handle('save-file-silently', async (_, { buffer, filename }) => {
  try {
    const downloadsPath = app.getPath('downloads');
    const safeFilename = path.basename(filename);
    const filePath = path.join(downloadsPath, safeFilename);

    // buffer comes as Uint8Array or similar
    await fs.writeFile(filePath, Buffer.from(buffer));

    shell.showItemInFolder(filePath);
    return true;
  } catch (e) {
    console.error("Silent save failed:", e);
    return false;
  }
});

// Open External Link Handler
ipcMain.handle('open-external', async (_, url: string) => {
  try {
    // SECURITY: Validate protocol to prevent protocol smuggling (e.g. file://, cmd://)
    const parsedUrl = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      throw new Error(`Forbidden protocol: ${parsedUrl.protocol}`);
    }
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Failed to open external link:', error);
    return false;
  }
});

import os from 'os';
import net from 'net';

ipcMain.handle('scan-network-scales', async (_, targetPort: number = 5005) => {
  console.log(`Main Process: Initiating Network Scale Scan on port ${targetPort}...`);
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  // Find local IPv4
  for (const k in interfaces) {
    for (const address of interfaces[k]!) {
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }

  if (addresses.length === 0) {
    return [];
  }

  // Build list of target IP networks to scan
  // Always include the current subnet, plus common ones (192.168.0.x, 192.168.1.x)
  const targetSubnets = new Set<string>();

  const parts = addresses[0].split('.');
  const baseIp = `${parts[0]}.${parts[1]}.${parts[2]}.`;
  targetSubnets.add(baseIp);

  if (parts[0] === '192' && parts[1] === '168') {
    targetSubnets.add('192.168.0.');
    targetSubnets.add('192.168.1.');
  }

  const foundScales: { ip: string, port: number }[] = [];
  const promises: Promise<void>[] = [];

  for (const subnet of Array.from(targetSubnets)) {
    for (let i = 1; i < 255; i++) {
      const targetIp = `${subnet}${i}`;
      promises.push(new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800); // Fast timeout for LAN scan

        socket.on('connect', () => {
          foundScales.push({ ip: targetIp, port: targetPort });
          socket.destroy();
          resolve();
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve();
        });

        socket.on('error', () => {
          socket.destroy();
          resolve();
        });

        socket.connect(targetPort, targetIp);
      }));
    }
  }

  await Promise.all(promises);
  console.log(`Main Process: Network scan completed. Found ${foundScales.length} scales.`);
  return foundScales;
});

ipcMain.handle('test-scale-connection', async (_, { ip, port }) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000); // 2 second timeout for explicit test

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, ip);
  });
});

ipcMain.handle('scale:connect', async (_, { ip, port }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.connect();
  } catch (error) {
    console.error('[IPC Error] scale:connect:', error);
    return false;
  }
});

ipcMain.handle('scale:sync-time', async (_, { ip, port, timeStr }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.syncTime(timeStr);
  } catch (error) {
    console.error('[IPC Error] scale:sync-time:', error);
    return false;
  }
});

ipcMain.handle('scale:upload-plu', async (_, { ip, port, product }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.uploadPLU(product);
  } catch (error) {
    console.error('[IPC Error] scale:upload-plu:', error);
    return false;
  }
});

ipcMain.handle('scale:delete-plu', async (_, { ip, port, pluNumber }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.deletePLU(pluNumber);
  } catch (error) {
    console.error('[IPC Error] scale:delete-plu:', error);
    return false;
  }
});

ipcMain.handle('scale:download-plu', async (_, { ip, port }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.downloadPLU();
  } catch (error) {
    console.error('[IPC Error] scale:download-plu:', error);
    return [];
  }
});

ipcMain.handle('scale:read-weight', async (_, { ip, port }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.readWeight();
  } catch (error) {
    console.error('[IPC Error] scale:read-weight:', error);
    return { weight: 0, unit: 'kg' };
  }
});

ipcMain.handle('scale:full-sync', async (_, { ip, port, products }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.fullSync(products);
  } catch (error) {
    console.error('[IPC Error] scale:full-sync:', error);
    return { success: false, synced: 0, failed: 0 };
  }
});

ipcMain.handle('scale:incremental-sync', async (_, { ip, port, products }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.incrementalSync(products);
  } catch (error) {
    console.error('[IPC Error] scale:incremental-sync:', error);
    return { success: false, synced: 0, failed: 0 };
  }
});

ipcMain.handle('scale:sync-hotkeys', async (_, { ip, port, hotkeys }) => {
  try {
    const service = new ScaleDirectService(ip, port);
    return await service.syncHotkeys(hotkeys);
  } catch (error) {
    console.error('[IPC Error] scale:sync-hotkeys:', error);
    return false;
  }
});


function createWindow() {
  const win = new BrowserWindow({
    title: 'Billing App v2.0',
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../dist/app-icon.png'), // Resolved from public/app-icon.png -> dist/app-icon.png
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    autoHideMenuBar: true,
    show: false, // Don't show until ready
  });
  console.log('BrowserWindow created');

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] [Level ${level}] ${message} (at ${path.basename(sourceId)}:${line})`);
  });

  win.once('ready-to-show', () => {
    console.log('Window ready to show');
    win.show();
    win.focus();
    if (app.isPackaged) {
      setupAutoUpdater(win);
      autoUpdater.checkForUpdatesAndNotify().catch(err => console.error("AutoUpdate initial check error:", err));
    }
  });

  // In development, load from the Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Auto Updater Handlers
function setupAutoUpdater(win: BrowserWindow) {
  autoUpdater.on('checking-for-update', () => {
    if (!win.isDestroyed()) win.webContents.send('updater:message', { type: 'checking-for-update' });
  });
  autoUpdater.on('update-available', (info) => {
    if (!win.isDestroyed()) win.webContents.send('updater:message', { type: 'update-available', info });
  });
  autoUpdater.on('update-not-available', (info) => {
    if (!win.isDestroyed()) win.webContents.send('updater:message', { type: 'update-not-available', info });
  });
  autoUpdater.on('error', (err) => {
    if (!win.isDestroyed()) win.webContents.send('updater:message', { type: 'error', error: err.message });
  });
  autoUpdater.on('download-progress', (progressObj) => {
    if (!win.isDestroyed()) win.webContents.send('updater:message', { type: 'download-progress', progress: progressObj });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (!win.isDestroyed()) win.webContents.send('updater:message', { type: 'update-downloaded', info });
  });
}

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) return { error: 'Not available in development' };
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err: any) {
    console.error('Update check failed:', err);
    return { error: err.message };
  }
});

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

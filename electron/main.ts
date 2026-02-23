import { app, BrowserWindow, ipcMain, dialog, WebContentsPrintOptions, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';

import { LicenseService } from './services/licenseService';
import { GoogleDriveService } from './services/googleDriveService';
import { ThermalPrinterService } from './services/thermalPrinterService';

// __dirname is natively available in CommonJS
const licenseService = new LicenseService();
const googleDriveService = new GoogleDriveService();
const thermalPrinterService = new ThermalPrinterService();

// IPC Handlers
ipcMain.handle('license:get-status', () => {
  return licenseService.initialize();
});

ipcMain.handle('license:activate', (_, key: string) => {
  return licenseService.activate(key);
});

ipcMain.handle('license:reset', () => {
  return licenseService.reset();
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
  return await googleDriveService.authenticate();
});

ipcMain.handle('google-drive:logout', async () => {
  return await googleDriveService.logout();
});

ipcMain.handle('google-drive:status', async () => {
  return await googleDriveService.checkconnection();
});

ipcMain.handle('google-drive:upload', async (_, { filename, content }) => {
  return await googleDriveService.uploadFile(filename, content);
});

ipcMain.handle('google-drive:set-config', async (_, config) => {
  googleDriveService.saveConfig(config);
  return true;
});

ipcMain.handle('google-drive:get-config', async () => {
  return googleDriveService.getConfig();
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
    // If filename not provided, generate one
    const name = filename || `AutoBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const fullPath = path.join(folderPath, name);

    await fs.writeFile(fullPath, data, 'utf-8');
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

// Unified Print Handler
ipcMain.handle('print', async (_, content: string, options: { printerName?: string; silent?: boolean; copies?: number; pageSize?: string; landscape?: boolean, margins?: any } = {}) => {
  const { printerName, silent = true, copies = 1, pageSize = 'A4', landscape = false, margins = { marginType: 'printableArea' } } = options;
  console.log('Main Process: Print requested. Options:', JSON.stringify({ printerName, silent, copies, pageSize, landscape }, null, 2));
  console.log('Main Process: Content Length:', content ? content.length : 0);
  if (!content || content.length < 50) {
    console.error("Main Process: WARNING - Content appears empty!");
  }

  let printWin: BrowserWindow | null = new BrowserWindow({
    show: false, // Revert debug visibility
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
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
    await printWin.loadURL(`file://${tempPath}`);

    // Wait for completion
    await loadPromise;
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

      const printer = printers.find(p => p.name === printerName || p.displayName === printerName);
      if (printer) {
        console.log(`Main Process: FOUND printer: ${printer.name}`);
        printOptions.deviceName = printer.name;
      } else {
        console.error(`Main Process: Printer '${printerName}' NOT FOUND. Available: ${printers.map(p => p.name).join(', ')}`);
        // Fallback: Show dialog if specific printer missing
        console.warn('Main Process: Falling back to system dialog (silent=false)');
        printOptions.silent = false;
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

    // Execute Print
    await new Promise<void>((resolve, reject) => {
      if (!printWin) return reject("Window closed before print");
      printWin.webContents.print(printOptions, (success, failureReason) => {
        if (success) {
          console.log('Main Process: Print callback SUCCESS');
          resolve();
        } else {
          console.error('Main Process: Print callback FAILED:', failureReason);
          reject(new Error(failureReason));
        }
      });
    });

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
      nodeIntegration: true
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
      // Ensure filename is safe?
      filePath = path.join(downloadsPath, filename || `Invoice-${Date.now()}.pdf`);
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
    const filePath = path.join(downloadsPath, filename);

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
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Failed to open external link:', error);
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
      sandbox: false
    },
    autoHideMenuBar: true,
    show: false, // Don't show until ready
  });
  console.log('BrowserWindow created');

  win.once('ready-to-show', () => {
    console.log('Window ready to show');
    win.show();
    win.focus();
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

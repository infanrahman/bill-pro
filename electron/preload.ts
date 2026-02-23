import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

interface PrintOptions {
    printerName?: string;
    silent?: boolean;
    copies?: number;
    pageSize?: string;
    landscape?: boolean;
    margins?: any;
}

contextBridge.exposeInMainWorld('electron', {
    saveBackup: (data: string) => ipcRenderer.invoke('backup-data', data),
    readBackup: () => ipcRenderer.invoke('restore-data'),

    // New Print API
    print: (content: string, options: PrintOptions) => ipcRenderer.invoke('print', content, options),
    printThermalRaw: (data: any, printerName: string) => ipcRenderer.invoke('print-thermal-raw', { data, printerName }),
    getPrinters: () => ipcRenderer.invoke('get-printers'),

    downloadPDF: (html: string, filename: string, silent?: boolean) => ipcRenderer.invoke('download-pdf', { html, filename, silent }),
    saveFileSilently: (buffer: ArrayBuffer, filename: string) => ipcRenderer.invoke('save-file-silently', { buffer, filename }),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

    getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
    activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),

    resetLicense: () => ipcRenderer.invoke('license:reset'),

    // Auto Backup
    selectBackupFolder: () => ipcRenderer.invoke('select-backup-folder'),
    saveAutoBackup: (folderPath: string, data: string, filename?: string) => ipcRenderer.invoke('save-backup-file', { folderPath, data, filename }),

    // Google Drive
    googleDrive: {
        login: () => ipcRenderer.invoke('google-drive:login'),
        logout: () => ipcRenderer.invoke('google-drive:logout'),
        getStatus: () => ipcRenderer.invoke('google-drive:status'),
        upload: (filename: string, content: string) => ipcRenderer.invoke('google-drive:upload', { filename, content }),
        setConfig: (config: any) => ipcRenderer.invoke('google-drive:set-config', config),
        getConfig: () => ipcRenderer.invoke('google-drive:get-config'),
    }
});

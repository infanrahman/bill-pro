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
    openCashDrawer: (printerName: string) => ipcRenderer.invoke('printer:open-drawer', { printerName }),
    getPrinters: () => ipcRenderer.invoke('get-printers'),

    downloadPDF: (html: string, filename: string, silent?: boolean) => ipcRenderer.invoke('download-pdf', { html, filename, silent }),
    saveFileSilently: (buffer: ArrayBuffer, filename: string) => ipcRenderer.invoke('save-file-silently', { buffer, filename }),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

    scanNetworkScales: (port?: number) => ipcRenderer.invoke('scan-network-scales', port),
    testScaleConnection: (ip: string, port: number) => ipcRenderer.invoke('test-scale-connection', { ip, port }),

    // Scale Direct TCP
    scaleConnect: (ip: string, port?: number) => ipcRenderer.invoke('scale:connect', { ip, port }),
    scaleSyncTime: (ip: string, port?: number, timeStr?: string) => ipcRenderer.invoke('scale:sync-time', { ip, port, timeStr }),
    scaleUploadPLU: (ip: string, port: number | undefined, product: any) => ipcRenderer.invoke('scale:upload-plu', { ip, port, product }),
    scaleDeletePLU: (ip: string, port: number | undefined, pluNumber: string) => ipcRenderer.invoke('scale:delete-plu', { ip, port, pluNumber }),
    scaleDownloadPLU: (ip: string, port?: number) => ipcRenderer.invoke('scale:download-plu', { ip, port }),
    scaleReadWeight: (ip: string, port?: number) => ipcRenderer.invoke('scale:read-weight', { ip, port }),
    scaleFullSync: (ip: string, port: number | undefined, products: any[]) => ipcRenderer.invoke('scale:full-sync', { ip, port, products }),
    scaleIncrementalSync: (ip: string, port: number | undefined, products: any[]) => ipcRenderer.invoke('scale:incremental-sync', { ip, port, products }),
    scaleSyncHotkeys: (ip: string, port: number | undefined, hotkeys: any[]) => ipcRenderer.invoke('scale:sync-hotkeys', { ip, port, hotkeys }),

    getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
    activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),

    resetLicense: () => ipcRenderer.invoke('license:reset'),
    signToken: (payload: string) => ipcRenderer.invoke('auth:sign-token', payload),
    verifyToken: (token: string) => ipcRenderer.invoke('auth:verify-token', token),

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
    },

    // ZATCA
    zatca: {
        getConfig: () => ipcRenderer.invoke('zatca:get-config'),
        saveConfig: (config: any) => ipcRenderer.invoke('zatca:save-config', config),
        request: (options: any) => ipcRenderer.invoke('zatca:request', options),
        generateCSR: (options: any) => ipcRenderer.invoke('zatca:generate-csr', options),
        signHash: (hashBase64: string, privateKeyPem: string) => ipcRenderer.invoke('zatca:sign-hash', { hashBase64, privateKeyPem }),
        signInvoiceXml: (unsignedXml: string, certificatePem: string, privateKeyPem: string) => 
            ipcRenderer.invoke('zatca:sign-invoice-xml', { unsignedXml, certificatePem, privateKeyPem }),
        runDiagnostic: () => ipcRenderer.invoke('zatca:run-diagnostic'),
    },

    // Auto Updater
    updater: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        check: () => ipcRenderer.invoke('updater:check'),
        install: () => ipcRenderer.invoke('updater:install'),
        onMessage: (callback: (message: any) => void) => {
            const subscription = (_event: IpcRendererEvent, message: any) => callback(message);
            ipcRenderer.on('updater:message', subscription);
            return () => ipcRenderer.off('updater:message', subscription);
        }
    }
});

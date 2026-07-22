export interface ElectronAPI {
 print: (content: string, options?: { printerName?: string; silent?: boolean; copies?: number; pageSize?: string; landscape?: boolean; margins?: any }) => Promise<boolean>;
 getPrinters: () => Promise<Electron.PrinterInfo[]>;
 backupData: (data: string) => Promise<boolean>;
 restoreData: () => Promise<string | null>;
 downloadPDF: (html: string, filename: string, silent?: boolean) => Promise<boolean>;
 saveFileSilently: (buffer: ArrayBuffer, filename: string) => Promise<boolean>;
 openExternal: (url: string) => Promise<boolean>;
 getLicenseStatus: () => Promise<{ status: 'ok' | 'expired' | 'pirated' | 'trial'; remainingDays: number; machineId: string; expiryDate?: string }>;
 activateLicense: (key: string) => Promise<boolean>;
 resetLicense: () => Promise<boolean>;
 signToken: (payload: string) => Promise<string>;
 verifyToken: (token: string) => Promise<string | null>;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 printThermal: (html: string, options?: any) => Promise<boolean>;
 printThermalRaw: (data: any, printerName: string) => Promise<boolean>;
 openCashDrawer: (printerName: string) => Promise<boolean>;
 scanNetworkScales: (port?: number) => Promise<{ ip: string; port: number }[]>;
 testScaleConnection: (ip: string, port: number) => Promise<boolean>;

 // Scale Direct TCP
 scaleConnect: (ip: string, port?: number) => Promise<{ success: boolean; message: string }>;
 scaleSyncTime: (ip: string, port?: number, timeStr?: string) => Promise<{ success: boolean; message: string }>;
 scaleUploadPLU: (ip: string, port: number | undefined, product: any) => Promise<{ success: boolean; message: string }>;
 scaleDeletePLU: (ip: string, port: number | undefined, pluNumber: string) => Promise<{ success: boolean; message: string }>;
 scaleDownloadPLU: (ip: string, port?: number) => Promise<{ success: boolean; message: string; data?: string }>;
 scaleReadWeight: (ip: string, port?: number) => Promise<{ success: boolean; message: string; data?: number }>;
 scaleFullSync: (ip: string, port: number | undefined, products: any[]) => Promise<{ success: boolean; message: string }>;
 scaleIncrementalSync: (ip: string, port: number | undefined, products: any[]) => Promise<{ success: boolean; message: string }>;
 scaleSyncHotkeys: (ip: string, port: number | undefined, hotkeys: any[]) => Promise<{ success: boolean; message: string }>;

 // Backup & Drive
 selectBackupFolder: () => Promise<string | null>;
 saveAutoBackup: (folderPath: string, data: string, filename?: string) => Promise<boolean>;
 
 googleDrive: {
 login: () => Promise<boolean>;
 logout: () => Promise<boolean>;
 getStatus: () => Promise<{ isAuthenticated: boolean; user?: any }>;
 upload: (filename: string, content: string) => Promise<boolean>;
 setConfig: (config: any) => Promise<boolean>;
 getConfig: () => Promise<any>;
 };

 // ZATCA
 zatca: {
 getConfig: () => Promise<any>;
 saveConfig: (config: any) => Promise<boolean>;
 };
}


declare global {
 interface Window {
 electron?: ElectronAPI;
 }
}

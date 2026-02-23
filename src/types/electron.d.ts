export interface ElectronAPI {
    print: (content: string, options?: { printerName?: string; silent?: boolean; copies?: number; pageSize?: string; landscape?: boolean; margins?: any }) => Promise<boolean>;
    getPrinters: () => Promise<Electron.PrinterInfo[]>;
    backupData: (data: string) => Promise<boolean>;
    restoreData: () => Promise<string | null>;
    downloadPDF: (html: string, filename: string, silent?: boolean) => Promise<boolean>;
    saveFileSilently: (buffer: ArrayBuffer, filename: string) => Promise<boolean>;
    openExternal: (url: string) => Promise<boolean>;
    getLicenseStatus: () => Promise<{ status: 'ok' | 'expired' | 'pirated'; remainingDays: number; machineId: string }>;
    activateLicense: (key: string) => Promise<boolean>;
    resetLicense: () => Promise<boolean>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    printThermal: (html: string, options?: any) => Promise<boolean>;
    printThermalRaw: (data: any, printerName: string) => Promise<boolean>;
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}

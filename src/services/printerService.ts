
export interface PrinterConfig {
    selectedPrinter: string;
    silent: boolean;
    copies: number;
    pageSize: 'a4' | 'thermal' | string;
    orientation: 'portrait' | 'landscape';
    margins: any;
}

export const getPrinters = async (): Promise<any[]> => {
    if (window.electron && window.electron.getPrinters) {
        return await window.electron.getPrinters();
    }
    return [];
};

export const printContent = async (html: string, config: Partial<PrinterConfig> = {}) => {
    const defaultOptions = {
        printerName: config.selectedPrinter || undefined, // Use undefined for system default
        silent: config.silent ?? true, // Default to silent if not specified
        copies: config.copies || 1,
        pageSize: config.pageSize === 'thermal' ? '80mm' : (config.pageSize || 'A4'),
        landscape: config.orientation === 'landscape',
        margins: config.margins || (config.pageSize === 'thermal' || config.pageSize === '80mm' ? { marginType: 'none' } : { marginType: 'printableArea' })
    };

    if (window.electron && window.electron.print) {
        console.log("Printing via Electron:", defaultOptions);
        try {
            await window.electron.print(html, defaultOptions);
            return true;
        } catch (e) {
            console.error("Electron print failed:", e);
            return false;
        }
    } else {
        // Web Fallback
        console.log("Printing via Web Fallback");
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();

            return new Promise<boolean>((resolve) => {
                iframe.contentWindow?.addEventListener('load', () => {
                    setTimeout(() => {
                        iframe.contentWindow?.print();
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                            resolve(true);
                        }, 1000); // Wait for print dialog to close/process
                    }, 500);
                });
            });
        }
        return false;
    }
};

export const printThermalRaw = async (data: any, printerName: string) => {
    if (window.electron && window.electron.printThermalRaw) {
        console.log("Printing Thermal RAW via Electron:", printerName);
        try {
            return await window.electron.printThermalRaw(data, printerName);
        } catch (e) {
            console.error("Electron thermal raw print failed:", e);
            return false;
        }
    }
    return false;
};

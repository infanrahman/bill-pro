import { Capacitor } from '@capacitor/core';

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
  } else if (Capacitor.isNativePlatform()) {
    console.log("Printing via Native OS Dialog");
    const root = document.getElementById('root');
    if (root) root.style.display = 'none';

    const printContainer = document.createElement('div');
    printContainer.id = 'capacitor-print-container';
    printContainer.style.backgroundColor = 'white';
    printContainer.style.width = '100%';
    printContainer.style.height = '100%';
    printContainer.style.position = 'absolute';
    printContainer.style.top = '0';
    printContainer.style.left = '0';
    printContainer.style.zIndex = '999999';
    printContainer.innerHTML = html;
    document.body.appendChild(printContainer);

    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        try {
          window.print();
        } catch (err) {
          console.error("Native print execution failed:", err);
        }
        setTimeout(() => {
          try {
            document.body.removeChild(printContainer);
            if (root) root.style.display = 'block';
          } catch (e) {}
          resolve(true);
        }, 1000);
      }, 500);
    });
  } else {
    // Web Fallback
    console.log("Printing via Web Fallback");
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.error("Web print execution failed:", err);
          }
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (e) {}
            resolve(true);
          }, 1000);
        }, 500);
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

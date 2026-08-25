import React, { useEffect, useState, useMemo } from 'react';
import Modal from '../../components/UI/Modal';
import { db, type Item } from '../../services/db';
import QRCode from 'qrcode';
import { Printer, Code2, QrCode, Loader2, Sparkles } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { printContent, getPrinters } from '../../services/printerService';
import JsBarcode from 'jsbarcode';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[] | null;
}

export const getCleanBarcodeValue = (rawItem: Partial<Item> | null | undefined): string => {
  if (!rawItem) return '20000001';
  if (rawItem.barcode && typeof rawItem.barcode === 'string' && rawItem.barcode.trim()) {
    return rawItem.barcode.trim();
  }
  if (rawItem.itemCode && typeof rawItem.itemCode === 'string' && rawItem.itemCode.trim()) {
    return rawItem.itemCode.trim();
  }
  if (rawItem.id) {
    const digits = String(rawItem.id).replace(/\D/g, '');
    if (digits.length >= 8) {
      return digits.slice(0, 8);
    }
    let hash = 0;
    const str = String(rawItem.id);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(Math.abs(hash) % 90000000 + 10000000);
  }
  return '20000001';
};

const BarcodeModal: React.FC<BarcodeModalProps> = ({ isOpen, onClose, items }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useSettings();
  const { addToast } = useNotification();
  const [qrUrl, setQrUrl] = useState('');
  const [barcodeUrl, setBarcodeUrl] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const [supplierName, setSupplierName] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  const [printCopies, setPrintCopies] = useState<number>(1);

  // Available printers & selection
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [labelWidth, setLabelWidth] = useState<string>('50mm');
  const [labelHeight, setLabelHeight] = useState<string>('25mm');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');

  // Customization Toggles
  const [format, setFormat] = useState<'qr' | 'linear'>('linear');
  const [showShopName, setShowShopName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showSupplier, setShowSupplier] = useState(true);
  const [showProductCode, setShowProductCode] = useState(true);
  const [showCostCode, setShowCostCode] = useState(true);

  const [shopFontSize, setShopFontSize] = useState<number>(8);
  const [productFontSize, setProductFontSize] = useState<number>(9);
  const [priceFontSize, setPriceFontSize] = useState<number>(11);

  const [shopAlignment, setShopAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [productAlignment, setProductAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [priceAlignment, setPriceAlignment] = useState<'left' | 'center' | 'right'>('center');

  // Derived Cost Code
  const [costCode, setCostCode] = useState<string>('');

  const item = items && items.length > 0 ? items[0] : null;
  const activeBarcodeString = useMemo(() => getCleanBarcodeValue(item), [item]);

  useEffect(() => {
    if (isOpen) {
      // Fetch printers
      getPrinters().then(printers => {
        setAvailablePrinters(printers || []);
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && item) {
      // Load Supplier Name if present
      const loadSupplier = async () => {
        let name = '';
        if (item.supplierId) {
          try {
            const sup = await db.suppliers.get(String(item.supplierId));
            if (sup) {
              name = sup.name;
            } else {
              const numId = Number(item.supplierId);
              if (!isNaN(numId)) {
                const sup2 = await db.suppliers.get(numId);
                if (sup2) name = sup2.name;
              }
            }
          } catch (e) { }
        }
        if (!name) {
          name = (item as any).supplierNameFallback || (item as any).supplierName || (item as any).supplier || '';
        }
        setSupplierName(name);
      };
      loadSupplier();

      let bName = '';
      const savedProfile = localStorage.getItem('businessDetails');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          bName = parsed.name || parsed.companyName || parsed.businessName || '';
        } catch (e) {
          bName = '';
        }
      }
      if (!bName) {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            bName = parsed.businessName || parsed.name || '';
          } catch (e) { }
        }
      }
      setBusinessName(bName || 'My Store');

      // Generate Cost Code & Printer Config
      const savedConfigRaw = localStorage.getItem('printerConfig');
      const pConfig = savedConfigRaw ? JSON.parse(savedConfigRaw) : {};
      const isBarcodeEnabled = pConfig?.enableBarcodePrinter;
      const bConfig = pConfig?.barcode || {};

      const defaultPrinter = isBarcodeEnabled 
        ? bConfig.printerName 
        : (pConfig.printerType === 'thermal' ? pConfig.thermal?.printerName : pConfig.regular?.printerName);
      
      setSelectedPrinter(defaultPrinter || '');
      setLabelWidth(bConfig.labelWidth || '50mm');
      setLabelHeight(bConfig.labelHeight || '25mm');

      // Set default copies based on stock
      const configCopies = isBarcodeEnabled ? (bConfig.copies || 1) : 1;
      setPrintCopies(item.stock > 0 ? item.stock : configCopies);

      const mapping = bConfig.numberMapping;

      if (mapping && Object.values(mapping).some((v: any) => v !== '')) {
        // Use purchasePrice as the cost price for encoding
        const getRandomLetter = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          return chars.charAt(Math.floor(Math.random() * chars.length));
        };

        let priceStr = (Number(item.purchasePrice) || 0).toString();
        // Remove decimals for cost code
        if (priceStr.includes('.')) {
            priceStr = priceStr.split('.')[0];
        }

        let mappedCode = '';
        for (let i = 0; i < priceStr.length; i++) {
          const char = priceStr[i];
          mappedCode += mapping[char] || char;
        }

        if (bConfig.enableRandomCostCode) {
            mappedCode = getRandomLetter() + mappedCode + getRandomLetter();
        }

        setCostCode(mappedCode.toUpperCase());
      } else {
        setCostCode((Number(item.purchasePrice) || 0).toString());
      }

      const valueToEncode = activeBarcodeString;

      if (valueToEncode) {
        // Generate QR
        QRCode.toDataURL(valueToEncode, { width: 300, margin: 1 }, (err, url) => {
          if (!err && url) setQrUrl(url);
        });

        // Generate 1D Barcode (Code128)
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, valueToEncode, {
            format: "CODE128",
            displayValue: false,
            margin: 0,
            width: 2,
            height: 55
          });
          setBarcodeUrl(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error("Barcode generation failed", e);
        }
      }
    }
  }, [isOpen, item, activeBarcodeString]);
  const extractNum = (val: string) => parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
  
  // Compute actual print dimensions based on orientation
  const rawW = extractNum(labelWidth || '50');
  const rawH = extractNum(labelHeight || '25');
  const printW = orientation === 'portrait' ? Math.min(rawW, rawH) : Math.max(rawW, rawH);
  const printH = orientation === 'portrait' ? Math.max(rawW, rawH) : Math.min(rawW, rawH);
  const printWStr = `${printW}mm`;
  const printHStr = `${printH}mm`;

  const widthMicrons = Math.floor(printW * 1000);
  const heightMicrons = Math.floor(printH * 1000);

  // Decide barcode height based on label height (landscape vs portrait)
  const isPortrait = orientation === 'portrait';
  // Reduced barcode sizes to prevent taking up too much vertical space
  const barcodeHeightMm = isPortrait ? Math.max(8, printH * 0.22) : Math.max(5, printH * 0.26);
  const qrSizeMm = isPortrait ? Math.max(10, printH * 0.28) : Math.max(8, printH * 0.45);

  const handlePrint = async () => {
    try {
      if (!items || items.length === 0) return;
      setIsPrinting(true);

      const savedConfig = localStorage.getItem('printerConfig');
      const config = savedConfig ? JSON.parse(savedConfig) : {};
      const bConfig = config.barcode || {};

      const printerName = selectedPrinter || (config.enableBarcodePrinter ? bConfig.printerName : (config.printerType === 'thermal' ? config.thermal?.printerName : config.regular?.printerName));

      let fullHtml = '';

      for (const printItem of items) {
        // 1. Get supplier name
        let itemSupplierName = '';
        if (printItem.supplierId) {
          try {
            const sup = await db.suppliers.get(String(printItem.supplierId));
            if (sup) itemSupplierName = sup.name;
            else {
              const numSup = await db.suppliers.get(Number(printItem.supplierId));
              if (numSup) itemSupplierName = numSup.name;
            }
          } catch (e) { }
        }
        if (!itemSupplierName && (printItem as any).supplierNameFallback) {
          itemSupplierName = (printItem as any).supplierNameFallback;
        }
        if (!itemSupplierName && (printItem as any).supplierName) {
          itemSupplierName = (printItem as any).supplierName;
        }

        // 2. Generate cost code
        let itemCostCode = '';
        // Use purchasePrice as the cost price for encoding
        const priceStr = (Number(printItem.purchasePrice) || 0).toString();
        const mapping = bConfig.numberMapping;
        if (mapping && Object.values(mapping).some((v: any) => v !== '')) {
          let mappedCode = '';
          for (let i = 0; i < priceStr.length; i++) {
            const char = priceStr[i];
            mappedCode += mapping[char] || char;
          }
          itemCostCode = mappedCode.toUpperCase();
        } else {
          itemCostCode = priceStr;
        }

        // 3. Generate Clean Code
        const cleanCode = getCleanBarcodeValue(printItem);
        let itemQrUrl = '';
        let itemBarcodeUrl = '';

        if (cleanCode) {
          if (format === 'qr') {
            try { 
              itemQrUrl = await QRCode.toDataURL(cleanCode, { width: 300, margin: 1 }); 
            } catch (e) { }
          } else {
            try {
              const canvas = document.createElement('canvas');
              // Use ~4px per mm at 96dpi for barcode height, minimum 40px
              const barcodeHeightPx = Math.max(40, Math.round(barcodeHeightMm * 3.78));
              JsBarcode(canvas, cleanCode, { format: "CODE128", displayValue: false, margin: 0, width: 1.5, height: barcodeHeightPx });
              itemBarcodeUrl = canvas.toDataURL('image/png');
            } catch (e) { }
          }
        }

        // 4. Calculate Copies
        const itemCopies = items.length > 1
          ? (printItem.stock > 0 ? printItem.stock : 1)
          : (printCopies >= 1 ? printCopies : 1);

        for (let c = 0; c < itemCopies; c++) {
          let labelContent = '';
          if (showShopName && businessName) {
            labelContent += `<div class="shop-name">${businessName}</div>`;
          }
          if (showProductName && printItem.name) {
            labelContent += `<div class="name">${printItem.name}</div>`;
          }
          if (showPrice) {
            labelContent += `<div class="price">${formatCurrency(printItem.salePrice || 0)}</div>`;
          }
          if (showSupplier && itemSupplierName) {
            labelContent += `<div class="supplier">Sup: ${itemSupplierName}</div>`;
          }

          let codeSection = '';
          if (format === 'qr' && itemQrUrl) {
            codeSection += `<img src="${itemQrUrl}" class="qr-img" alt="QR" />`;
          } else if (format === 'linear' && itemBarcodeUrl) {
            codeSection += `<img src="${itemBarcodeUrl}" class="linear-img" alt="Barcode" />`;
          }
          if (showProductCode && cleanCode) {
            codeSection += `<div class="sku">${cleanCode}</div>`;
          }
          let barcodeBlock = `<div class="barcode-container">${codeSection}</div>`;
          if (showCostCode && itemCostCode) {
            barcodeBlock += `<div class="cost-code">${itemCostCode}</div>`;
          }
          labelContent += `<div class="barcode-wrapper">${barcodeBlock}</div>`;

          fullHtml += `
            <div class="label">
              ${labelContent}
            </div>
          `;
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Product Labels</title>
          <meta charset="utf-8" />
          <style>
            @page { 
              size: ${printWStr} ${printHStr}; 
              margin: 0; 
            } 
            @media print {
              html, body {
                width: ${printWStr};
                height: ${printHStr};
                margin: 0;
                padding: 0;
              }
              .label {
                page-break-inside: avoid;
                page-break-after: always;
              }
              .label:last-child {
                page-break-after: avoid;
              }
            }
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
              margin: 0; 
              padding: 0; 
              background: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .label {
              page-break-after: always;
              page-break-inside: avoid;
              width: ${printWStr};
              height: ${printHStr};
              overflow: hidden;
              display: flex;
              flex-direction: column;
              align-items: stretch;
              justify-content: space-between;
              padding: 0.8mm 1.2mm;
            }
            .label:last-child { page-break-after: avoid; }
            .shop-name { 
              font-size: ${shopFontSize}px; 
              font-weight: bold; 
              text-transform: uppercase; 
              white-space: nowrap; 
              overflow: hidden; 
              text-overflow: ellipsis; 
              width: 100%;
              text-align: ${shopAlignment}; 
              line-height: 1.15;
              flex-shrink: 0;
            }
            .name { 
              font-weight: bold; 
              font-size: ${productFontSize}px; 
              line-height: 1.15;
              width: 100%;
              overflow: hidden; 
              display: -webkit-box; 
              -webkit-line-clamp: 2; 
              -webkit-box-orient: vertical; 
              text-align: ${productAlignment};
              flex-shrink: 0;
              word-break: break-word;
            }
            .price { 
              font-size: ${priceFontSize}px; 
              font-weight: 900; 
              width: 100%;
              text-align: ${priceAlignment}; 
              line-height: 1.1;
              flex-shrink: 0;
            }
            .supplier { 
              font-size: ${Math.max(6, shopFontSize - 1)}px; 
              color: #333; 
              white-space: nowrap; 
              overflow: hidden; 
              text-overflow: ellipsis; 
              width: 100%; 
              text-align: center;
              font-weight: bold;
              flex-shrink: 0;
            }
            .barcode-wrapper { 
              flex: 1;
              min-height: 0;
              display: flex; 
              flex-direction: row; 
              align-items: center; 
              justify-content: center; 
              width: 100%;
              overflow: hidden; 
            }
            .barcode-container { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              overflow: hidden;
              max-width: calc(100% - 15px);
            }
            .qr-img { 
              width: ${qrSizeMm}mm;
              height: ${qrSizeMm}mm;
              object-fit: contain;
              display: block;
            }
            .linear-img { 
              max-width: 100%;
              height: ${barcodeHeightMm}mm;
              object-fit: contain;
              display: block;
            }
            .sku { 
              font-size: ${Math.max(6, shopFontSize - 1)}px; 
              color: #000; 
              font-family: monospace; 
              font-weight: bold; 
              letter-spacing: 0.5px; 
              text-align: center; 
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .cost-code { 
              font-size: ${Math.max(6, shopFontSize - 1)}px; 
              font-weight: 800; 
              letter-spacing: 1px; 
              color: #222; 
              writing-mode: vertical-rl; 
              transform: rotate(180deg); 
              margin-left: 3px;
              margin-right: 6px;
              flex-shrink: 0;
            }
          </style>
        </head>
        <body>
          ${fullHtml}
        </body>
        </html>
      `;

      const success = await printContent(html, {
        selectedPrinter: printerName || undefined,
        silent: printerName ? (config.enableSilentPrint ?? true) : false,
        pageSize: (widthMicrons && heightMicrons) ? { width: widthMicrons, height: heightMicrons } : 'thermal',
        copies: 1
      } as any);

      if (success) {
        addToast(t('print.success') || 'Labels sent to printer', 'success');
        onClose();
      } else {
        addToast(t('print.failed') || 'Failed to print labels. Check printer configuration.', 'error');
      }
    } catch (error: any) {
      console.error("Barcode print error:", error);
      addToast(error.message || 'An error occurred during print', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('inventory.product_label') || 'Print Product Label'} maxWidth="3xl">
      <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* Left Side: Preview Area */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 md:p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center min-h-[280px] overflow-x-auto sticky top-0">
            {/* The actual label preview - matches physical print size */}
            <div className={`bg-white border border-slate-200 shadow-md overflow-hidden flex flex-col items-stretch justify-between text-slate-900`}
              style={{ 
                width: printWStr, 
                height: printHStr, 
                padding: '0.8mm 1.2mm',
                boxSizing: 'border-box'
              }}>
              {showShopName && (
                <p className="font-bold uppercase truncate text-slate-900"
                  style={{ fontSize: `${shopFontSize}px`, textAlign: shopAlignment, width: '100%', lineHeight: 1.15, flexShrink: 0, margin: 0 }}>
                  {businessName || 'My Store'}
                </p>
              )}
              {showProductName && (
                <p className="font-bold text-slate-900 overflow-hidden"
                  style={{
                    fontSize: `${productFontSize}px`, textAlign: productAlignment, width: '100%',
                    lineHeight: 1.15, flexShrink: 0, wordBreak: 'break-word',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden', margin: 0
                  }}>
                  {item?.name || 'Sample Product'}
                </p>
              )}
              {showPrice && (
                <p className="font-black text-slate-900"
                  style={{ fontSize: `${priceFontSize}px`, textAlign: priceAlignment as any, width: '100%', lineHeight: 1.1, flexShrink: 0, margin: 0 }}>
                  {formatCurrency(item?.salePrice || 0)}
                </p>
              )}
              {showSupplier && (
                <p className="text-slate-600 font-semibold truncate w-full text-center"
                  style={{ fontSize: `${Math.max(6, shopFontSize - 1)}px`, flexShrink: 0, margin: 0 }}>
                  Sup: {supplierName || 'N/A'}
                </p>
              )}

              <div className="flex flex-row items-center justify-center w-full flex-1 min-h-0 overflow-hidden" style={{ margin: 0 }}>
                <div className="flex flex-col items-center justify-center overflow-hidden" style={{ maxWidth: 'calc(100% - 15px)' }}>
                  {format === 'qr' && qrUrl && (
                    <img src={qrUrl} alt="QR Code" className="object-contain" style={{ width: `${qrSizeMm}mm`, height: `${qrSizeMm}mm`, display: 'block' }} />
                  )}
                  {format === 'linear' && barcodeUrl && (
                    <img src={barcodeUrl} alt="Barcode" className="object-contain" style={{ height: `${barcodeHeightMm}mm`, maxWidth: '100%', display: 'block' }} />
                  )}
                  {showProductCode && (
                    <p className="font-mono font-bold tracking-wider text-slate-900 truncate max-w-full"
                      style={{ fontSize: `${Math.max(6, shopFontSize - 1)}px`, margin: 0 }}>
                      {activeBarcodeString}
                    </p>
                  )}
                </div>

                {showCostCode && costCode && (
                  <p className="font-bold tracking-wider text-slate-800 opacity-80 select-none" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: `${Math.max(6, shopFontSize - 1)}px`, marginLeft: '3px', marginRight: '6px', flexShrink: 0, marginTop: 0, marginBottom: 0 }}>
                    {costCode}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 text-center font-medium">
              Preview · {printWStr} × {printHStr} ({orientation})
            </p>
          </div>

          {/* Right Side: Options Area */}
          <div className="flex flex-col space-y-4">

            {/* Format Toggle */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex border border-slate-200 dark:border-slate-700">
              <button type="button"
                onClick={() => setFormat('linear')}
                className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${format === 'linear' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                <Code2 size={16} className="mb-1" />
                Standard 1D
              </button>
              <button type="button"
                onClick={() => setFormat('qr')}
                className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${format === 'qr' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                <QrCode size={16} className="mb-1" />
                QR Code
              </button>
            </div>

            {/* Orientation Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Orientation</label>
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex border border-slate-200 dark:border-slate-700">
                <button type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  ⬛ Landscape
                </button>
                <button type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  ▮ Portrait
                </button>
              </div>
            </div>

            {/* Printer Selection */}
            {availablePrinters.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('print.select_printer') || 'Destination Printer'}
                </label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Default / System Dialog</option>
                  {availablePrinters.map((p, idx) => (
                    <option key={idx} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggles */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium dark:text-slate-200">
                  <input type="checkbox" checked={showShopName} onChange={(e) => setShowShopName(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4" />
                  {t('print.company_name') || 'Print Company Name'}
                </label>
                {showShopName && (
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t('print.company_name') || "Company Name"}
                    className="mt-1.5 w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium dark:text-slate-200">
                <input type="checkbox" checked={showProductName} onChange={(e) => setShowProductName(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4" />
                {t('inventory.item_name') || 'Item Name'}
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium dark:text-slate-200">
                <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4" />
                {t('inventory.sale_price') || 'Sale Price'}
              </label>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium dark:text-slate-200">
                  <input type="checkbox" checked={showSupplier} onChange={(e) => setShowSupplier(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4" />
                  {t('suppliers.title') || t('inventory.supplier') || 'Supplier Name'}
                </label>
                {showSupplier && (
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder={t('suppliers.title') || "Supplier Name"}
                    className="mt-1.5 w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium dark:text-slate-200">
                <input type="checkbox" checked={showProductCode} onChange={(e) => setShowProductCode(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4" />
                {t('inventory.barcode') || 'Barcode Text'}
              </label>
              {costCode && (
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium dark:text-slate-200">
                  <input type="checkbox" checked={showCostCode} onChange={(e) => setShowCostCode(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4" />
                  {t('inventory.show_cost_code') || 'Show Secret Cost Code'}
                </label>
              )}
            </div>

            {/* Typography Sizing Controls */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Shop Size</span>
                <div className="flex gap-1.5">
                  <input type="number" value={shopFontSize} onChange={(e) => setShopFontSize(parseInt(e.target.value) || 8)} className="w-14 p-1 text-xs border rounded-lg text-center dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                  <select value={shopAlignment} onChange={(e) => setShopAlignment(e.target.value as any)} className="text-xs border rounded-lg p-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Name Size</span>
                <div className="flex gap-1.5">
                  <input type="number" value={productFontSize} onChange={(e) => setProductFontSize(parseInt(e.target.value) || 9)} className="w-14 p-1 text-xs border rounded-lg text-center dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                  <select value={productAlignment} onChange={(e) => setProductAlignment(e.target.value as any)} className="text-xs border rounded-lg p-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Price Size</span>
                <div className="flex gap-1.5">
                  <input type="number" value={priceFontSize} onChange={(e) => setPriceFontSize(parseInt(e.target.value) || 11)} className="w-14 p-1 text-xs border rounded-lg text-center dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                  <select value={priceAlignment} onChange={(e) => setPriceAlignment(e.target.value as any)} className="text-xs border rounded-lg p-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Copies */}
            {items && items.length <= 1 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('print.copies') || 'Print Copies'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
            {items && items.length > 1 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  Printing {items.length} items in bulk. Copies automatically match each item's stock quantity!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end items-center gap-3 shrink-0">
        <button type="button"
          onClick={onClose}
          disabled={isPrinting}
          className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-xl dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          {t('common.close') || 'Close'}
        </button>
        <button type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 text-sm font-semibold shadow-md transition-all disabled:opacity-50"
        >
          {isPrinting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{t('inventory.generating') || 'Printing...'}</span>
            </>
          ) : (
            <>
              <Printer size={18} />
              <span>{t('inventory.print_label') || 'Print Label'}</span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};

export default BarcodeModal;

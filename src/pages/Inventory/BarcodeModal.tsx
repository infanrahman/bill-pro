import React, { useEffect, useState } from 'react';
import Modal from '../../components/UI/Modal';
import { db, type Item } from '../../services/db';
import QRCode from 'qrcode';
import { Printer, Code2, QrCode } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { printContent } from '../../services/printerService';
import JsBarcode from 'jsbarcode';

interface BarcodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: Item[] | null;
}

const BarcodeModal: React.FC<BarcodeModalProps> = ({ isOpen, onClose, items }) => {
    const { t } = useTranslation();
    const { formatCurrency } = useSettings();
    const [qrUrl, setQrUrl] = useState('');
    const [barcodeUrl, setBarcodeUrl] = useState('');

    const [supplierName, setSupplierName] = useState<string>('');
    const [businessName, setBusinessName] = useState<string>('');
    const [printCopies, setPrintCopies] = useState<number>(1);

    // Customization Toggles
    const [format, setFormat] = useState<'qr' | 'linear'>('linear');
    const [showShopName, setShowShopName] = useState(true);
    const [showProductName, setShowProductName] = useState(true);
    const [showPrice, setShowPrice] = useState(true);
    const [showSupplier, setShowSupplier] = useState(true);
    const [showProductCode, setShowProductCode] = useState(true);
    const [showCostCode, setShowCostCode] = useState(true);

    // Derived Cost Code
    const [costCode, setCostCode] = useState<string>('');

    const item = items && items.length > 0 ? items[0] : null;

    useEffect(() => {
        if (isOpen && item) {
            // Load Supplier Name if present
            if (item.supplierId) {
                db.suppliers.get(Number(item.supplierId)).then(sup => {
                    if (sup) setSupplierName(sup.name);
                });
            } else if ((item as any).supplierNameFallback) {
                setSupplierName((item as any).supplierNameFallback);
            } else {
                setSupplierName('');
            }

            const savedProfile = localStorage.getItem('businessDetails');
            if (savedProfile) {
                try {
                    const parsed = JSON.parse(savedProfile);
                    setBusinessName(parsed.name || '');
                } catch (e) {
                    setBusinessName('');
                }
            } else {
                // Try to fallback to current user business name if nothing in local storage under profile.
                const savedUser = localStorage.getItem('currentUser');
                if (savedUser) {
                    try {
                        const parsed = JSON.parse(savedUser);
                        setBusinessName(parsed.businessName || '');
                    } catch (e) { }
                }
            }

            // Generate Cost Code
            const savedConfigRaw = localStorage.getItem('printerConfig');
            const pConfig = savedConfigRaw ? JSON.parse(savedConfigRaw) : {};

            // Set default copies based on stock
            const configCopies = pConfig?.enableBarcodePrinter ? (pConfig?.barcode?.copies || 1) : 1;
            setPrintCopies(item.stock > 0 ? item.stock : configCopies);

            const mapping = pConfig?.barcode?.numberMapping;

            if (mapping && Object.values(mapping).some((v: any) => v !== '')) {
                // Determine base integer price
                const priceStr = Math.floor(item.purchasePrice || 0).toString();

                // Map the digits
                let mappedMiddle = '';
                for (let i = 0; i < priceStr.length; i++) {
                    const char = priceStr[i];
                    mappedMiddle += mapping[char] || char; // fallback to number if not mapped
                }

                // Find unassigned letters for padding
                const assignedLetters = Object.values(mapping).filter((v: any) => typeof v === 'string' && v.trim() !== '').map((v: any) => v.toLowerCase());
                const allLetters = 'abcdefghijklmnopqrstuvwxyz'.split('');
                const unassignedLetters = allLetters.filter((l: any) => !assignedLetters.includes(l));

                // If we have at least 2 unassigned letters, pad it randomly
                if (unassignedLetters.length >= 2) {
                    // Random pick
                    const pick1 = unassignedLetters[Math.floor(Math.random() * unassignedLetters.length)];
                    const pick2 = unassignedLetters[Math.floor(Math.random() * unassignedLetters.length)];
                    setCostCode(pick1.toUpperCase() + mappedMiddle.toUpperCase() + pick2.toUpperCase());
                } else {
                    setCostCode(mappedMiddle.toUpperCase());
                }
            } else {
                setCostCode(''); // Mapping disabled or empty
            }

            const valueToEncode = item.barcode || item.id?.toString() || '';

            if (valueToEncode) {
                // Generate QR
                QRCode.toDataURL(valueToEncode, { width: 300, margin: 1 }, (err, url) => {
                    if (!err) setQrUrl(url);
                });

                // Generate 1D Barcode (Code128)
                try {
                    const canvas = document.createElement('canvas');
                    JsBarcode(canvas, valueToEncode, {
                        format: "CODE128",
                        displayValue: false, // We render the text separately
                        margin: 0,
                        width: 2.2,
                        height: 65
                    });
                    setBarcodeUrl(canvas.toDataURL('image/png'));
                } catch (e) {
                    console.error("Barcode generation failed", e);
                }
            }
        }
    }, [isOpen, item]);

    const handlePrint = async () => {
        if (!items || items.length === 0) return;

        const savedConfig = localStorage.getItem('printerConfig');
        const config = savedConfig ? JSON.parse(savedConfig) : {};
        const isBarcodeEnabled = config.enableBarcodePrinter;
        const bConfig = config.barcode || {};

        const printerName = isBarcodeEnabled ? bConfig.printerName : (config.printerType === 'thermal' ? config.thermal?.printerName : config.regular?.printerName);
        const labelWidth = bConfig.labelWidth || '50mm';
        const labelHeight = bConfig.labelHeight || '25mm';

        // Convert mm strings to microns for Electron's absolute pageSize
        const extractNum = (val: string) => parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
        const widthMicrons = Math.floor(extractNum(labelWidth) * 1000);
        const heightMicrons = Math.floor(extractNum(labelHeight) * 1000);

        let fullHtml = '';

        for (const printItem of items) {
            // 1. Get supplier name
            let itemSupplierName = '';
            if (printItem.supplierId) {
                const sup = await db.suppliers.get(Number(printItem.supplierId));
                if (sup) itemSupplierName = sup.name;
            } else if ((printItem as any).supplierNameFallback) {
                itemSupplierName = (printItem as any).supplierNameFallback;
            }

            // 2. Generate cost code
            let itemCostCode = '';
            const mapping = bConfig.numberMapping;
            if (mapping && Object.values(mapping).some((v: any) => v !== '')) {
                const priceStr = Math.floor(printItem.purchasePrice || 0).toString();
                let mappedMiddle = '';
                for (let i = 0; i < priceStr.length; i++) {
                    const char = priceStr[i];
                    mappedMiddle += mapping[char] || char;
                }
                const assignedLetters = Object.values(mapping).filter((v: any) => typeof v === 'string' && v.trim() !== '').map((v: any) => v.toLowerCase());
                const allLetters = 'abcdefghijklmnopqrstuvwxyz'.split('');
                const unassignedLetters = allLetters.filter((l: any) => !assignedLetters.includes(l));
                if (unassignedLetters.length >= 2) {
                    const pick1 = unassignedLetters[Math.floor(Math.random() * unassignedLetters.length)];
                    const pick2 = unassignedLetters[Math.floor(Math.random() * unassignedLetters.length)];
                    itemCostCode = pick1.toUpperCase() + mappedMiddle.toUpperCase() + pick2.toUpperCase();
                } else {
                    itemCostCode = mappedMiddle.toUpperCase();
                }
            }

            // 3. Generate Codes
            const valueToEncode = printItem.barcode || printItem.id?.toString() || '';
            let itemQrUrl = '';
            let itemBarcodeUrl = '';

            if (valueToEncode) {
                if (format === 'qr') {
                    try { itemQrUrl = await QRCode.toDataURL(valueToEncode, { width: 300, margin: 1 }); } catch (e) { }
                } else {
                    try {
                        const canvas = document.createElement('canvas');
                        JsBarcode(canvas, valueToEncode, { format: "CODE128", displayValue: false, margin: 0, width: 2.2, height: 65 });
                        itemBarcodeUrl = canvas.toDataURL('image/png');
                    } catch (e) { }
                }
            }

            // 4. Calculate Copies
            // If multiple items, strictly use stock. If single item, trust the manual override input.
            const itemCopies = items.length > 1
                ? (printItem.stock > 0 ? printItem.stock : 1)
                : (printCopies >= 1 ? printCopies : 1);

            for (let c = 0; c < itemCopies; c++) {
                let labelContent = '';
                if (showShopName && businessName) {
                    labelContent += `<div class="shop-name">${businessName}</div>`;
                }
                if (showProductName) {
                    labelContent += `<div class="name">${printItem.name}</div>`;
                }
                if (showPrice) {
                    labelContent += `<div class="price">${formatCurrency(printItem.salePrice)}</div>`;
                }
                if (showSupplier && itemSupplierName) {
                    labelContent += `<div class="supplier">Sup: ${itemSupplierName}</div>`;
                }

                let codeSection = '';
                if (format === 'qr' && itemQrUrl) {
                    codeSection += `<img src="${itemQrUrl}" class="qr-img" />`;
                } else if (format === 'linear' && itemBarcodeUrl) {
                    codeSection += `<img src="${itemBarcodeUrl}" class="linear-img" />`;
                }
                if (showProductCode) {
                    const idStr = printItem.barcode ? printItem.barcode : 'ID: ' + printItem.id;
                    codeSection += `<div class="sku">${idStr}</div>`;
                }
                let barcodeBlock = `<div class="barcode-container">${codeSection}</div>`;
                if (showCostCode && itemCostCode) {
                    barcodeBlock += `<div class="cost-code">${itemCostCode}</div>`;
                }
                labelContent += `<div class="barcode-wrapper">${barcodeBlock}</div>`;

                fullHtml += `
                 <div class="label" style="page-break-after: always; width: 100vw; height: 100vh; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 1mm; box-sizing: border-box;">
                     ${labelContent}
                 </div>
                 `;
            }
        }

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print bulk labels</title>
            <style>
                @page { 
                    size: ${labelWidth} ${labelHeight}; 
                    margin: 0; 
                } 
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 0; 
                    text-align: center; 
                    box-sizing: border-box;
                    background: white;
                }
                /* Font sizes scale down naturally but have a floor to prevent unreadability */
                .shop-name { font-size: 8px; font-weight: bold; margin: 0; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
                .name { font-weight: bold; font-size: 9px; line-height: 1; margin: 0; max-height: 18px; overflow: hidden; max-width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
                .price { font-size: 11px; font-weight: 900; margin: 0; }
                .supplier { font-size: 8px; margin: 0; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; font-weight: bold; }
                .barcode-wrapper { flex: 1; min-height: 0; display: flex; flex-direction: row; align-items: center; justify-content: center; width: 100%; margin: 1px 0; overflow: hidden; }
                .barcode-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; min-height: 0; }
                .qr-img { height: 100%; width: auto; max-width: 100%; max-height: 35px; object-fit: contain; }
                .linear-img { width: 100%; height: 100%; max-width: 95%; max-height: 24px; object-fit: contain; }
                .sku { font-size: 8px; color: #000; font-family: monospace; font-weight: bold; letter-spacing: 1px; text-align: center; margin: 0;}
                .cost-code { font-size: 8px; font-weight: 800; letter-spacing: 1px; color: #222; writing-mode: vertical-rl; transform: rotate(180deg); margin-left: 2px; }
            </style>
        </head>
        <body>
            ${fullHtml}
        </body>
        </html>
        `;

        // Pass copies: 1 since we already duplicated the HTML tags N times
        await printContent(html, {
            selectedPrinter: printerName || undefined,
            silent: config.enableSilentPrint ?? true,
            pageSize: (widthMicrons && heightMicrons) ? { width: widthMicrons, height: heightMicrons } : 'thermal',
            copies: 1
        } as any);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('inventory.product_label') || 'Print Product Label'} maxWidth="md">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

                {/* Left Side: Preview Area */}
                <div className="bg-slate-50 p-6 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center w-full justify-center min-h-[250px] dark:bg-slate-300 overflow-hidden">
                    <div className="bg-white border rounded shadow-sm w-[200px] p-3 flex flex-col items-center text-black">
                        {showShopName && businessName && <p className="text-[10px] font-bold uppercase mb-1">{businessName}</p>}
                        {showProductName && <p className="text-[13px] font-bold leading-tight mb-1 max-w-[90%] truncate text-center">{item?.name}</p>}
                        {showPrice && item && <p className="text-[18px] font-black leading-none mb-1">{formatCurrency(item.salePrice)}</p>}
                        {showSupplier && supplierName && <p className="text-[9px] text-gray-700 mb-2 font-semibold">Sup: {supplierName}</p>}

                        <div className="flex flex-row items-center justify-center w-full mb-1">
                            <div className="flex flex-col items-center justify-center">
                                {format === 'qr' && qrUrl && (
                                    <img src={qrUrl} alt="QR Code" className="w-[80px] h-[80px] mix-blend-multiply mb-0 object-contain" />
                                )}
                                {format === 'linear' && barcodeUrl && (
                                    <img src={barcodeUrl} alt="Barcode" className="w-[140px] h-[40px] mix-blend-multiply mb-0 object-contain" />
                                )}
                                {showProductCode && item && (
                                    <p className="text-[11px] font-mono font-bold tracking-widest mt-0.5">{item.barcode || `ID: ${item.id}`}</p>
                                )}
                            </div>

                            {/* Rotate code to the side as requested visually */}
                            {showCostCode && costCode && (
                                <p className="text-[10px] font-black tracking-widest text-slate-800 ml-2 opacity-70" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                    {costCode}
                                </p>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 text-center">Preview Layout<br />(Size varies based on label printer dimensions)</p>
                </div>

                {/* Right Side: Options Area */}
                <div className="flex flex-col space-y-4">

                    {/* Format Toggle */}
                    <div className="bg-slate-100 p-1 rounded-lg flex dark:bg-slate-700">
                        <button
                            onClick={() => setFormat('linear')}
                            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-md transition-colors text-xs font-medium ${format === 'linear' ? 'bg-white shadow pointer-events-none text-blue-600 dark:bg-slate-600 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                        >
                            <Code2 size={16} className="mb-1" />
                            Standard 1D
                        </button>
                        <button
                            onClick={() => setFormat('qr')}
                            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-md transition-colors text-xs font-medium ${format === 'qr' ? 'bg-white shadow pointer-events-none text-blue-600 dark:bg-slate-600 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                        >
                            <QrCode size={16} className="mb-1" />
                            QR Code
                        </button>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
                            <input type="checkbox" checked={showShopName} onChange={(e) => setShowShopName(e.target.checked)} className="rounded border-slate-300 w-4 h-4" />
                            {t('print.company_name') || 'Show Shop/Company Name'}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
                            <input type="checkbox" checked={showProductName} onChange={(e) => setShowProductName(e.target.checked)} className="rounded border-slate-300 w-4 h-4" />
                            {t('inventory.item_name') || 'Show Product Name'}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
                            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded border-slate-300 w-4 h-4" />
                            {t('inventory.sale_price') || 'Show Price'}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
                            <input type="checkbox" checked={showSupplier} onChange={(e) => setShowSupplier(e.target.checked)} className="rounded border-slate-300 w-4 h-4" />
                            {t('suppliers.title') || 'Show Supplier'}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
                            <input type="checkbox" checked={showProductCode} onChange={(e) => setShowProductCode(e.target.checked)} className="rounded border-slate-300 w-4 h-4" />
                            {t('inventory.barcode') || 'Show Product Code / Text'}
                        </label>
                        {costCode && (
                            <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
                                <input type="checkbox" checked={showCostCode} onChange={(e) => setShowCostCode(e.target.checked)} className="rounded border-slate-300 w-4 h-4" />
                                {t('inventory.show_cost_code') || 'Show Secret Cost Code'}
                            </label>
                        )}
                    </div>

                    {items && items.length <= 1 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('print.copies') || 'Print Copies'} (Based on Qty)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="500"
                                value={printCopies}
                                onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>
                    )}
                    {items && items.length > 1 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Printing {items.length} items in bulk. Copies will automatically match each item's specific stock quantity!
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 mt-2 border-t border-slate-100 dark:border-slate-700 gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                            {t('common.close') || 'Close'}
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
                        >
                            <Printer size={18} /> {t('inventory.print_label') || 'Print Label'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default BarcodeModal;

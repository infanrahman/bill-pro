import React, { useEffect, useState } from 'react';
import Modal from '../../components/UI/Modal';
import type { Item } from '../../services/db';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { printContent } from '../../services/printerService';

interface BarcodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Item | null;
}

const BarcodeModal: React.FC<BarcodeModalProps> = ({ isOpen, onClose, item }) => {
    const { t } = useTranslation();
    const { formatCurrency } = useSettings();
    const [qrUrl, setQrUrl] = useState('');

    useEffect(() => {
        if (isOpen && item) {
            // Generate QR Code containing the Barcode Value (or ID if no barcode)
            const valueToEncode = item.barcode || item.id?.toString() || '';

            if (valueToEncode) {
                QRCode.toDataURL(valueToEncode, { width: 256, margin: 1 }, (err, url) => {
                    if (!err) setQrUrl(url);
                    else console.error(err);
                });
            }
        }
    }, [isOpen, item]);

    const handlePrint = async () => {
        if (!item || !qrUrl) return;

        // Load Printer Config
        const savedConfig = localStorage.getItem('printerConfig');
        const config = savedConfig ? JSON.parse(savedConfig) : {};

        // Determine Printer Settings
        // For barcodes, we typically use the 'thermal' printer or 'regular' if not specified.
        // If the user has a specific preference in settings for "Thermal Receipt", we can try to use that.
        // However, barcodes might be different. For now, we will default to the 'thermal' printer logic 
        // if the system is set to 'thermal' mode, or just use the selected printer.
        // Given the request "based on the settings invoice and printer", let's map it:

        const useThermal = config.printerType === 'thermal';
        const printerName = useThermal ? config.thermal?.printerName : config.regular?.printerName;

        // Let's assume a generic label size or maybe 58mm.

        // Construct HTML
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Label</title>
            <style>
                @page { margin: 0; size: auto; } /* Auto size for tickets/labels */
                body { 
                    font-family: sans-serif; 
                    margin: 0; 
                    padding: 5px; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    text-align: center; 
                    width: 100%;
                }
                .label { 
       
                    width: 100%;
                    max-width: 300px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .name { font-weight: bold; font-size: 16px; margin-bottom: 5px; line-height: 1.2; }
                .price { font-size: 20px; font-weight: 900; margin-bottom: 5px; }
                img { width: 120px; height: 120px; }
                .sku { font-size: 10px; color: #555; margin-top: 2px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="label">
                <div class="name">${item.name}</div>
                <div class="price">${formatCurrency(item.salePrice)}</div>
                <img src="${qrUrl}" />
                <div class="sku">${item.barcode || `ID: ${item.id}`}</div>
            </div>
        </body>
        </html>
        `;

        await printContent(html, {
            selectedPrinter: printerName || undefined,
            silent: config.enableSilentPrint ?? true,
            pageSize: 'thermal', // Treat as thermal/custom size
            copies: 1
        });
    };

    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('inventory.product_label')} maxWidth="sm">
            <div className="p-6 flex flex-col items-center space-y-4">

                {/* Preview Area (Visual Only) */}
                <div className="bg-white p-6 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center w-full max-w-[300px]">
                    <h3 className="text-lg font-bold text-center leading-tight mb-1 dark:text-black">{item.name}</h3>
                    <p className="text-2xl font-black text-slate-800 dark:text-black mb-4">{formatCurrency(item.salePrice)}</p>

                    {qrUrl ? (
                        <img src={qrUrl} alt="QR Code" className="w-40 h-40 mix-blend-multiply" />
                    ) : (
                        <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">{t('inventory.generating')}</div>
                    )}

                    <p className="text-sm text-slate-500 font-mono mt-2">{item.barcode || `ID: ${item.id}`}</p>
                </div>

                <div className="flex justify-end w-full pt-4 gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                        {t('common.close')}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
                    >
                        <Printer size={18} /> {t('inventory.print_label')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default BarcodeModal;

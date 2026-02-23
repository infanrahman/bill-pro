import React, { useState, useEffect } from 'react';
import { Save, Printer, RefreshCw } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';

export interface PrinterConfig {
    printerType: 'regular' | 'thermal';
    enableSilentPrint: boolean;
    printLanguage: 'english' | 'bilingual';
    showTerms: boolean;
    termsContent: string;
    printCompanyName: boolean;
    printToken?: boolean; // Print token number in cafe mode

    // Simplified specific configs
    thermal: {
        printerName: string;
        copies: number;
        paperSize: '80mm' | '58mm' | 'custom';
        customPaperWidth: string; // e.g. '76mm'
    };

    regular: {
        printerName: string;
        copies: number;
    };
}

const InvoicePrintTab: React.FC = () => {
    const { addToast } = useNotification();
    const { t } = useTranslation();

    const [config, setConfig] = useState<PrinterConfig>({
        printerType: 'regular',
        enableSilentPrint: true,
        printLanguage: 'english',
        showTerms: false,
        termsContent: '',
        printCompanyName: true,
        printToken: false,
        thermal: { printerName: '', copies: 1, paperSize: '80mm', customPaperWidth: '80mm' },
        regular: { printerName: '', copies: 1 }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [printers, setPrinters] = useState<any[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('printerConfig');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setConfig(prev => ({
                    ...prev,
                    ...parsed,
                    // Merge/Repair structure if needed
                    thermal: { ...prev.thermal, ...(parsed.thermal || {}) },
                    regular: { ...prev.regular, ...(parsed.regular || {}) }
                }));
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
        fetchPrinters();
    }, []);

    const fetchPrinters = async () => {
        if (window.electron && window.electron.getPrinters) {
            const list = await window.electron.getPrinters();
            setPrinters(list);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChange = (key: keyof PrinterConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSubChange = (type: 'thermal' | 'regular', key: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [key]: value
            }
        }));
    };

    const handleSave = () => {
        localStorage.setItem('printerConfig', JSON.stringify(config));
        addToast(t('print.saved_success'), 'success');
    };

    return (
        <div className="space-y-6 pb-20">
            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Printer className="text-blue-500" /> {t('print.title')}
            </h2>

            {/* Main Type Toggle */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold mb-4 dark:text-white">{t('print.printer_type')}</h3>
                <div className="flex gap-4">
                    <button
                        onClick={() => handleChange('printerType', 'regular')}
                        className={`flex-1 py-3 rounded-lg border-2 ${config.printerType === 'regular' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                    >
                        A4 Invoice
                    </button>
                    <button
                        onClick={() => handleChange('printerType', 'thermal')}
                        className={`flex-1 py-3 rounded-lg border-2 ${config.printerType === 'thermal' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                    >
                        Thermal Receipt
                    </button>
                </div>
            </div>

            {/* Printer Selection (Dynamic based on type) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold dark:text-white">
                        {config.printerType === 'regular' ? t('print.regular_settings') : t('print.thermal_settings')}
                    </h3>
                    <button onClick={fetchPrinters} className="text-blue-500 hover:text-blue-600"><RefreshCw size={18} /></button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('print.select_printer')}
                    </label>
                    <select
                        value={config[config.printerType].printerName}
                        onChange={(e) => handleSubChange(config.printerType, 'printerName', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                        <option value="">-- Default System Printer --</option>
                        {printers.map((p: any) => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('print.copies')}
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="5"
                        value={config[config.printerType].copies}
                        onChange={(e) => handleSubChange(config.printerType, 'copies', parseInt(e.target.value))}
                        className="w-24 px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                </div>

                {config.printerType === 'thermal' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('print.paper_size') || "Paper Size"}
                            </label>
                            <select
                                value={(config.thermal as any).paperSize || '80mm'}
                                onChange={(e) => handleSubChange('thermal', 'paperSize', e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            >
                                <option value="80mm">80mm (Standard)</option>
                                <option value="58mm">58mm (Small)</option>
                                <option value="custom">Custom Width</option>
                            </select>
                        </div>
                        {(config.thermal as any).paperSize === 'custom' && (
                            <div className="grid grid-cols-2 gap-4 col-span-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        {t('print.custom_width') || "Width (e.g. 76mm)"}
                                    </label>
                                    <input
                                        type="text"
                                        value={(config.thermal as any).customPaperWidth || ''}
                                        onChange={(e) => handleSubChange('thermal', 'customPaperWidth', e.target.value)}
                                        placeholder="e.g. 76mm"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        {t('print.custom_height') || "Length/Height (Default: auto)"}
                                    </label>
                                    <input
                                        type="text"
                                        value={(config.thermal as any).customPaperHeight || ''}
                                        onChange={(e) => handleSubChange('thermal', 'customPaperHeight', e.target.value)}
                                        placeholder="e.g. 150mm or auto"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Common Settings */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h3 className="font-semibold dark:text-white">{t('print.global_settings')}</h3>

                <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">{t('print.silent_printing')}</span>
                    <input
                        type="checkbox"
                        checked={config.enableSilentPrint}
                        onChange={(e) => handleChange('enableSilentPrint', e.target.checked)}
                        className="w-5 h-5 text-blue-600"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">{t('print.company_name')}</span>
                    <input
                        type="checkbox"
                        checked={config.printCompanyName}
                        onChange={(e) => handleChange('printCompanyName', e.target.checked)}
                        className="w-5 h-5 text-blue-600"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">{t('print.language')}</span>
                    <select
                        value={config.printLanguage}
                        onChange={(e) => handleChange('printLanguage', e.target.value)}
                        className="px-3 py-1 border border-slate-300 rounded bg-transparent dark:text-white dark:border-slate-600"
                    >
                        <option value="english">{t('print.english_only')}</option>
                        <option value="bilingual">{t('print.bilingual')}</option>
                    </select>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-slate-700 dark:text-slate-300">{t('print.print_token') || 'Print Token Number'}</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {t('print.print_token_desc') || 'Display order token on invoices (Cafe Mode)'}
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        checked={config.printToken || false}
                        onChange={(e) => handleChange('printToken', e.target.checked)}
                        className="w-5 h-5 text-blue-600"
                    />
                </div>
            </div>

            <button
                onClick={handleSave}
                className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold shadow-xl flex items-center gap-2"
            >
                <Save size={20} /> {t('print.save_settings')}
            </button>
        </div>
    );
};

export default InvoicePrintTab;

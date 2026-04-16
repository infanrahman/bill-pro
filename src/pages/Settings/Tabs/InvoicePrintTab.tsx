import React, { useState, useEffect } from 'react';
import { Save, Printer, RefreshCw, Archive } from 'lucide-react';
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

    kitchen: {
        enabled: boolean;
        printerName: string;
        paperSize: '80mm' | '58mm';
        copies: number;
    };

    // Barcode Printer Settings
    enableBarcodePrinter: boolean;
    barcode: {
        printerName: string;
        labelWidth: string; // e.g. '50mm'
        labelHeight: string; // e.g. '25mm'
        copies: number;
        orientation: 'portrait' | 'landscape';
        numberMapping: Record<string, string>; // '0'-'9' -> single letter
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
        regular: { printerName: '', copies: 1 },
        kitchen: { enabled: false, printerName: '', paperSize: '80mm', copies: 1 },
        enableBarcodePrinter: false,
        barcode: {
            printerName: '',
            labelWidth: '50mm',
            labelHeight: '25mm',
            copies: 1,
            orientation: 'portrait',
            numberMapping: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '', '9': '', '0': '' }
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [printers, setPrinters] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

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
                    regular: { ...prev.regular, ...(parsed.regular || {}) },
                    kitchen: { ...prev.kitchen, ...(parsed.kitchen || {}) },
                    barcode: { ...prev.barcode, ...(parsed.barcode || {}) }
                }));
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
        fetchPrinters();

        // Refresh printers when window gains focus (e.g. after adding a printer in system settings)
        const onFocus = () => fetchPrinters();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);

    const fetchPrinters = async () => {
        if (window.electron && window.electron.getPrinters) {
            setIsRefreshing(true);
            try {
                const list = await window.electron.getPrinters();
                setPrinters(list);
            } catch (error) {
                console.error("Failed to fetch printers:", error);
            } finally {
                setTimeout(() => setIsRefreshing(false), 500); // Small delay for visual feedback
            }
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChange = (key: keyof PrinterConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSubChange = (type: 'thermal' | 'regular' | 'barcode' | 'kitchen', key: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [key]: value
            }
        }));
    };

    const handleNumberMappingChange = (digit: string, value: string) => {
        // Only allow single letter a-z
        const filteredValue = value.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 1);
        setConfig(prev => ({
            ...prev,
            barcode: {
                ...prev.barcode,
                numberMapping: {
                    ...(prev.barcode.numberMapping || {}),
                    [digit]: filteredValue
                }
            }
        }));
    };

    const handleSave = () => {
        localStorage.setItem('printerConfig', JSON.stringify(config));
        addToast(t('print.saved_success'), 'success');
    };

    const handleTestCashDrawer = async () => {
        if (!config.thermal.printerName) {
            addToast('Please select a thermal printer first', 'error');
            return;
        }

        if (window.electron && window.electron.openCashDrawer) {
            try {
                addToast('Sending open command to drawer...', 'info');
                const success = await window.electron.openCashDrawer(config.thermal.printerName);
                if (success) {
                    addToast('Drawer opened successfully', 'success');
                } else {
                    addToast('Failed to open drawer. Check printer connection.', 'error');
                }
            } catch (err) {
                console.error(err);
                addToast('Error sending drawer command', 'error');
            }
        } else {
            addToast('Cash drawer feature requires desktop app', 'error');
        }
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
                    <button 
                        onClick={fetchPrinters} 
                        className={`text-blue-500 hover:text-blue-600 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                        title={t('common.refresh')}
                    >
                        <RefreshCw size={18} />
                    </button>
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

                {config.printerType === 'thermal' && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
                        <button
                            onClick={handleTestCashDrawer}
                            disabled={!config.thermal.printerName}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Archive size={18} />
                            Test Cash Drawer
                        </button>
                    </div>
                )}
            </div>

            {/* Kitchen Printer Settings */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                    <div>
                        <h3 className="font-semibold text-lg dark:text-white flex items-center gap-2">
                            {t('print.kitchen_title') || 'Kitchen Printer'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('print.kitchen_desc') || 'Automatically print order tickets to the kitchen'}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.kitchen.enabled}
                            onChange={(e) => handleSubChange('kitchen', 'enabled', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {config.kitchen.enabled && (
                    <div className="space-y-4 animation-fadeIn">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('print.select_printer')}
                            </label>
                            <select
                                value={config.kitchen.printerName}
                                onChange={(e) => handleSubChange('kitchen', 'printerName', e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            >
                                <option value="">-- Select Printer --</option>
                                {printers.map((p: any) => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('print.paper_size') || 'Paper Size'}
                            </label>
                            <select
                                value={config.kitchen.paperSize}
                                onChange={(e) => handleSubChange('kitchen', 'paperSize', e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white mb-2"
                            >
                                <option value="80mm">80mm</option>
                                <option value="58mm">58mm</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('print.copies') || 'Copies'}
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                value={config.kitchen.copies || 1}
                                onChange={(e) => handleSubChange('kitchen', 'copies', parseInt(e.target.value) || 1)}
                                className="w-24 px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Barcode Printer Settings */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                    <div>
                        <h3 className="font-semibold text-lg dark:text-white flex items-center gap-2">
                            {t('print.barcode_title') || 'Barcode Printer'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('print.barcode_desc') || 'Configure dedicated printer for product labels'}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.enableBarcodePrinter}
                            onChange={(e) => handleChange('enableBarcodePrinter', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {config.enableBarcodePrinter && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium dark:text-slate-200">
                                {t('print.barcode_settings') || 'Label Printer Configuration'}
                            </h4>
                            <button 
                                onClick={fetchPrinters} 
                                className={`text-blue-500 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all ${isRefreshing ? 'animate-spin' : ''}`} 
                                title="Refresh Printers"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('print.select_barcode_printer') || 'Select Barcode Printer'}
                            </label>
                            <select
                                value={(config.barcode as any).printerName || ''}
                                onChange={(e) => handleSubChange('barcode', 'printerName', e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">-- {t('print.select_printer') || 'Select a printer'} --</option>
                                {printers.map((p: any) => (
                                    <option key={`barcode-${p.name}`} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t('print.label_width') || 'Label Width (e.g. 50mm)'}
                                </label>
                                <input
                                    type="text"
                                    value={(config.barcode as any).labelWidth || '50mm'}
                                    onChange={(e) => handleSubChange('barcode', 'labelWidth', e.target.value)}
                                    placeholder="50mm"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t('print.label_height') || 'Label Height (e.g. 25mm)'}
                                </label>
                                <input
                                    type="text"
                                    value={(config.barcode as any).labelHeight || '25mm'}
                                    onChange={(e) => handleSubChange('barcode', 'labelHeight', e.target.value)}
                                    placeholder="25mm"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t('print.barcode_copies') || 'Default Copies per Item'}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={(config.barcode as any).copies || 1}
                                    onChange={(e) => handleSubChange('barcode', 'copies', parseInt(e.target.value) || 1)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t('print.label_orientation') || 'Orientation'}
                                </label>
                                <select
                                    value={(config.barcode as any).orientation || 'portrait'}
                                    onChange={(e) => handleSubChange('barcode', 'orientation', e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="portrait">{t('print.portrait') || 'Portrait'}</option>
                                    <option value="landscape">{t('print.landscape') || 'Landscape'}</option>
                                </select>
                            </div>

                            {/* Number to Letter Mapping for Cost Codes */}
                            <div className="pt-6 border-t border-slate-200 dark:border-slate-700 mt-4">
                                <h4 className="text-md font-medium text-slate-800 dark:text-white mb-2">
                                    {t('print.cost_code_mapping') || 'Cost Code Letter Mapping'}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    {t('print.cost_code_mapping_desc') || 'Assign a single letter (a-z) to each number. This will convert item Purchase Prices into a secret letter code printed on the barcode label (e.g., 23.99 becomes 23 -> ab).'}
                                </p>
                                <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit: any) => (
                                        <div key={digit} className="flex flex-col items-center">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{digit}</label>
                                            <input
                                                type="text"
                                                maxLength={1}
                                                value={config.barcode.numberMapping?.[digit] || ''}
                                                onChange={(e) => handleNumberMappingChange(digit, e.target.value)}
                                                className="w-10 h-10 text-center uppercase font-bold text-blue-600 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-blue-400 focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
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

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Printer as PrinterIcon } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import SettingsSectionHeader from '../components/SettingsSectionHeader';
import PrinterBasicConfigCard from './components/PrinterBasicConfigCard';
import ThermalPrinterCard from './components/ThermalPrinterCard';
import RegularPrinterCard from './components/RegularPrinterCard';
import KitchenPrinterCard from './components/KitchenPrinterCard';
import BarcodePrinterCard from './components/BarcodePrinterCard';
import ThermalTemplateEditorCard from './components/ThermalTemplateEditorCard';

export interface PrinterConfig {
 printerType: 'regular' | 'thermal';
 enableSilentPrint: boolean;
 printLanguage: 'english' | 'bilingual';
 showTerms: boolean;
 termsContent: string;
 printCompanyName: boolean;
 printToken?: boolean;

 thermalTemplate?: {
 showLogo: boolean;
 showBusinessName: boolean;
 showAddress: boolean;
 showContact: boolean;
 showVatNo: boolean;
 showArabicName: boolean;
 showLineVat: boolean;
 showToken: boolean;
 footerText: string;
 fontSize: 'small' | 'normal' | 'large';
 };

 thermal: {
 printerName: string;
 copies: number;
 paperSize: '80mm' | '58mm' | 'custom';
 customPaperWidth: string;
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
 enableBarcodePrinter: boolean;
 barcode: {
 printerName: string;
 labelWidth: string;
 labelHeight: string;
 copies: number;
 orientation: 'portrait' | 'landscape';
 numberMapping: Record<string, string>;
 enableRandomCostCode?: boolean;
 };
}

const InvoicePrintTab: React.FC = () => {
 const { addToast } = useNotification();
 const { t } = useTranslation();

 const [config, setConfig] = useState<PrinterConfig>({
 printerType: 'thermal',
 enableSilentPrint: true,
 printLanguage: 'english',
 showTerms: false,
 termsContent: '',
 printCompanyName: true,
 printToken: false,
 thermalTemplate: {
 showLogo: true,
 showBusinessName: true,
 showAddress: true,
 showContact: true,
 showVatNo: true,
 showArabicName: true,
 showLineVat: true,
 showToken: true,
 footerText: 'Thank you for your visit!\nPowered by Billing Pro',
 fontSize: 'normal'
 },
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
 numberMapping: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '', '9': '', '0': '' },
 enableRandomCostCode: false
 }
 });

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
 thermalTemplate: { ...prev.thermalTemplate, ...(parsed.thermalTemplate || {
 showLogo: true,
 showBusinessName: true,
 showAddress: true,
 showContact: true,
 showVatNo: true,
 showArabicName: true,
 showLineVat: true,
 showToken: true,
 footerText: 'Thank you for your visit!\nPowered by Billing Pro',
 fontSize: 'normal'
 }) },
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
 }, []);

 const fetchPrinters = async () => {
 setIsRefreshing(true);
 try {
 if ((window as any).electron) {
 const list = await (window as any).electron.getPrinters();
 setPrinters(list || []);
 }
 } catch (e) {
 console.error("Fetch printers failed", e);
 } finally {
 setIsRefreshing(false);
 }
 };

 const handleSave = () => {
 localStorage.setItem('printerConfig', JSON.stringify(config));
 addToast(t('settings.notifications.save_success', 'Printing settings saved successfully'), 'success');
 };

 const updateConfig = (patch: Partial<PrinterConfig>) => {
 setConfig(prev => ({ ...prev, ...patch }));
 };

 return (
 <div className="space-y-10 pb-20">
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <SettingsSectionHeader 
 title={t('settings.tabs.invoice_print')} 
 description={t('settings.printing.subtitle', 'Manage printers, paper sizes, and preferences')} 
 />
 <div className="flex gap-3 mb-6">
 <button type="button"
 onClick={fetchPrinters}
 disabled={isRefreshing}
 className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
 >
 <RefreshCw size={16} className={isRefreshing ? ' text-slate-900 dark:text-white' : ''} />
 {t('common.refresh', 'Refresh')}
 </button>
 <button type="button"
 onClick={handleSave}
 className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white rounded-xl text-sm font-semibold hover:bg-slate-900 dark:hover:bg-white"
 >
 <Save size={18} />
 {t('common.save_settings', 'Save Changes')}
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 {/* Basic / Global Config */}
 <div className="space-y-8">
 <PrinterBasicConfigCard config={config} updateConfig={updateConfig} />
 
 {config.printerType === 'thermal' ? (
 <>
 <ThermalPrinterCard config={config} updateConfig={updateConfig} printers={printers} />
 <ThermalTemplateEditorCard config={config} updateConfig={updateConfig} />
 </>
) : (
 <RegularPrinterCard config={config} updateConfig={updateConfig} printers={printers} />
)}
 </div>

 {/* Secondary Printers (Kitchen, Barcode) */}
 <div className="space-y-8">
 <KitchenPrinterCard config={config} updateConfig={updateConfig} printers={printers} />
 <BarcodePrinterCard config={config} updateConfig={updateConfig} printers={printers} />

 <div className="p-6 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl">
 <div className="flex items-start gap-4">
 <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg">
 <PrinterIcon size={20} />
 </div>
 <div>
 <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-tight">Pro-Tip</h4>
 <p className="text-sm text-slate-900/80 dark:text-white/80 mt-1 leading-relaxed">
 Ensure your printers are installed in Windows Control Panel before choosing them here. If a printer is missing, click <strong>Refresh List</strong> above.
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
);
};

export default InvoicePrintTab;

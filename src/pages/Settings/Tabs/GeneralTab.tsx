import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { 
 Minus, Plus, Languages, DollarSign, Calendar, 
 Hash, TrendingUp, FileSpreadsheet, 
 Zap, Coffee, Clock, Receipt, Sparkles, LayoutGrid
} from 'lucide-react';
import SettingsCard from '../components/SettingsCard';
import FormRow from '../components/FormRow';
import SettingsSectionHeader from '../components/SettingsSectionHeader';

const GeneralTab: React.FC = () => {
 const { settings, updateSettings } = useSettings();
 const { t, i18n } = useTranslation();

 const currencies = [
 { code: 'USD', symbol: '$', label: 'USD ($)' },
 { code: 'EUR', symbol: '€', label: 'EUR (€)' },
 { code: 'INR', symbol: '₹', label: 'INR (₹)' },
 { code: 'SAR', symbol: '﷼', label: 'SAR (﷼)' },
 { code: 'AED', symbol: 'د.إ', label: 'AED (د.إ)' },
 ];

 const dateFormats = [
 { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy' },
 { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy' },
 { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd' },
 ];

 const handleDecimalChange = (increment: boolean) => {
 const newValue = increment ? settings.decimals + 1 : settings.decimals - 1;
 if (newValue >= 0 && newValue <= 4) {
 updateSettings({ decimals: newValue });
 }
 };

 return (
 <div className="space-y-12 pb-20">
 <SettingsSectionHeader 
 title={t('settings.general.title')} 
 description={t('settings.general.subtitle')} 
 />

 <div className="grid grid-cols-1 gap-10">
 {/* 1. Localization & Visuals */}
 <SettingsCard title={t('settings.sections.localization', 'Localization & Regional')} icon={Languages}>
 <div className="divide-y divide-slate-100/50 dark:divide-slate-700/50">
 <FormRow 
 label={t('settings.general.language_label')} 
 description={t('settings.general.language_desc', 'Change the application display language')}
 icon={Languages}
 >
 <select
 value={i18n.language}
 onChange={(e) => i18n.changeLanguage(e.target.value)}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white min-w-[220px] cursor-pointer"
 >
 <option value="en">English (US)</option>
 <option value="hi">Hindi (हिन्दी)</option>
 <option value="bn">Bengali (বাংলা)</option>
 <option value="ar">Arabic (العربية)</option>
 </select>
 </FormRow>

 <FormRow 
 label={t('settings.general.currency_label')} 
 description={t('settings.general.currency_desc', 'Select your business currency symbol')}
 icon={DollarSign}
 >
 <select
 value={settings.currency}
 onChange={(e) => updateSettings({ currency: e.target.value })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white min-w-[220px] cursor-pointer"
 >
 {currencies.map((curr: any) => (
 <option key={curr.code} value={curr.symbol}>
 {curr.label}
 </option>
))}
 </select>
 </FormRow>

 <FormRow 
 label={t('settings.general.date_format_label')} 
 description={t('settings.general.date_format_desc', 'Set how dates appear across the app')}
 icon={Calendar}
 >
 <select
 value={settings.dateFormat}
 onChange={(e) => updateSettings({ dateFormat: e.target.value })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white min-w-[220px] cursor-pointer"
 >
 {dateFormats.map((fmt: any) => (
 <option key={fmt.value} value={fmt.value}>
 {fmt.label}
 </option>
))}
 </select>
 </FormRow>

 <FormRow 
 label={t('settings.general.decimals_label')} 
 description={t('settings.general.decimals_desc', 'Number of decimal places for financial calculations')}
 icon={Hash}
 >
 <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 bg-slate-100 dark:bg-slate-900">
 <button type="button"
 
 onClick={() => handleDecimalChange(false)}
 className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg disabled:opacity-30"
 disabled={settings.decimals <= 0}
 >
 <Minus size={16} />
 </button>
 <span className="w-14 text-center font-semibold text-sm dark:text-white tracking-tight">
 {settings.decimals}
 </span>
 <button type="button"
 
 onClick={() => handleDecimalChange(true)}
 className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 hover:text-slate-900 dark:hover:text-white rounded-lg disabled:opacity-30"
 disabled={settings.decimals >= 4}
 >
 <Plus size={16} />
 </button>
 </div>
 </FormRow>
 </div>
 </SettingsCard>

 {/* 2. Tax & Compliance */}
 <SettingsCard title={t('settings.sections.tax', 'Tax & Billing')} icon={Receipt}>
 <div className="divide-y divide-slate-100/50 dark:divide-slate-700/50">
 <FormRow 
 label={t('settings.general.apply_tax_label', 'Apply Tax automatically')} 
 description={t('settings.general.apply_tax_desc', 'Automatically add taxes to all new invoices and orders')}
 icon={Zap}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.applyTax}
 onChange={(e) => updateSettings({ applyTax: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
 </label>
 </FormRow>

 {settings.applyTax && (
 <div 
 
 
 className="bg-slate-100 dark:bg-slate-900 p-6 rounded-2xl my-4 grid grid-cols-2 gap-6 border border-dashed border-slate-200 dark:border-slate-700 relative overflow-hidden"
 >
 <div className="absolute top-0 right-0 w-24 h-24 bg-slate-900 dark:bg-white blur-2xl pointer-events-none"/>
 <div>
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 ml-1">Tax Label</label>
 <input 
 type="text"
 value={settings.taxName || 'VAT'}
 onChange={(e) => updateSettings({ taxName: e.target.value })}
 className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 placeholder="e.g. VAT"
 />
 </div>
 <div>
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 ml-1">Rate (%)</label>
 <input 
 type="number"
 value={settings.taxRate || 15}
 onChange={(e) => updateSettings({ taxRate: Number(e.target.value) })}
 className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 placeholder="15"
 />
 </div>
 </div>
)}

 <FormRow 
 label={t('settings.general.invoice_prefix_label', 'Invoice Prefix')} 
 description={t('settings.general.invoice_prefix_desc', 'Set a custom prefix for your bill numbers (e.g. INV-)')}
 >
 <input
 type="text"
 value={settings.invoicePrefix || 'INV-'}
 onChange={(e) => updateSettings({ invoicePrefix: e.target.value })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white min-w-[220px] text-right font-mono"
 placeholder="INV-"
 />
 </FormRow>
 </div>
 </SettingsCard>

 {/* 3. Advanced Feature Toggles */}
 <SettingsCard title={t('settings.sections.advanced', 'Advanced Features')} icon={Zap}>
 <div className="divide-y divide-slate-100/50 dark:divide-slate-700/50">
 <FormRow 
 label={t('settings.general.cafe_mode', 'Enable Market / Cafe Mode')} 
 description={t('settings.general.cafe_mode_desc', 'Switch POS to a touch-optimized image grid for restaurants/cafes')}
 icon={Coffee}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.cafeMode}
 onChange={(e) => updateSettings({ cafeMode: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
 </label>
 </FormRow>

 <FormRow 
 label={t('settings.general.shift_management', 'Advanced Shift Management')} 
 description={t('settings.general.shift_management_desc', 'Require cashiers to open/close shifts for financial accountability')}
 icon={Clock}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.enableShiftManagement}
 onChange={(e) => updateSettings({ enableShiftManagement: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
 </label>
 </FormRow>

 <FormRow 
 label={t('settings.general.enable_spreadsheet', 'Enable Spreadsheet View')} 
 description={t('settings.general.enable_spreadsheet_desc', 'Use high-density grid view for stock and reports')}
 icon={FileSpreadsheet}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.enableSpreadsheet}
 onChange={(e) => updateSettings({ enableSpreadsheet: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
 </label>
 </FormRow>

 <FormRow 
 label={t('settings.general.reports_group', 'Reports & Exporting')} 
 description={t('settings.general.reports_desc', 'Configure active reporting modules and export formats')}
 icon={TrendingUp}
 >
 <div className="flex flex-wrap gap-3">
 {[
 { id: 'enableStockReport', label: 'Stock' },
 { id: 'enableBillWiseProfit', label: 'Profit' },
 { id: 'enableExcelExport', label: 'Excel' }
 ].map((item: any) => (
 <label key={item.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-900 dark:hover:bg-white hover:text-white border border-slate-200 dark:border-slate-700">
 <input 
 type="checkbox"
 checked={(settings as any)[item.id]} 
 onChange={(e) => updateSettings({ [item.id]: e.target.checked })}
 className="rounded-lg text-slate-900 dark:text-white border-slate-300 focus:ring-0"
 />
 {item.label}
 </label>
))}
 </div>
 </FormRow>
 </div>
 </SettingsCard>

 {/* 4. POS Terminal Customizations */}
 <SettingsCard title={t('settings.sections.pos_terminal', 'POS Terminal Customization')} icon={LayoutGrid}>
 <div className="p-6 space-y-6">
 <p className="text-xs font-bold text-slate-700 mb-4">{t('settings.general.order_types_desc', 'Customize icons and labels for order types on the POS terminal.')}</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {(['dine_in', 'parcel', 'pickup', 'delivery'] as const).map(type => {
 const customData = settings.customOrderTypes?.[type] || {
 icon: type === 'dine_in' ? '🍽️' : type === 'parcel' ? '🥡' : type === 'pickup' ? '🚶' : '🚚',
 label: t('pos.' + type)
 };

 return (
 <div key={type} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
 <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t('pos.' + type)}</label>
 <div className="flex gap-3">
 <input 
 type="text"
 className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-center text-xl focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 placeholder="Icon"
 value={customData.icon}
 onChange={(e) => {
 const newOrderTypes = {
 ...(settings.customOrderTypes || {
 dine_in: { icon: '🍽️', label: t('pos.dine_in') },
 parcel: { icon: '🥡', label: t('pos.parcel') },
 pickup: { icon: '🚶', label: t('pos.pickup') },
 delivery: { icon: '🚚', label: t('pos.delivery') }
 }),
 [type]: { ...customData, icon: e.target.value }
 };
 updateSettings({ customOrderTypes: newOrderTypes });
 }}
 />
 <input 
 type="text"
 className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 placeholder="Label"
 value={customData.label}
 onChange={(e) => {
 const newOrderTypes = {
 ...(settings.customOrderTypes || {
 dine_in: { icon: '🍽️', label: t('pos.dine_in') },
 parcel: { icon: '🥡', label: t('pos.parcel') },
 pickup: { icon: '🚶', label: t('pos.pickup') },
 delivery: { icon: '🚚', label: t('pos.delivery') }
 }),
 [type]: { ...customData, label: e.target.value }
 };
 updateSettings({ customOrderTypes: newOrderTypes });
 }}
 />
 </div>
 </div>
);
 })}
 </div>
 </div>
 </SettingsCard>
 </div>
 </div>
);
};

export default GeneralTab;

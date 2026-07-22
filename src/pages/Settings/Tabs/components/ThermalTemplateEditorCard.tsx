import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layout, Eye, Type, AlignLeft } from 'lucide-react';
import SettingsCard from '../../components/SettingsCard';
import type { PrinterConfig } from '../InvoicePrintTab';

interface Props {
 config: PrinterConfig;
 updateConfig: (patch: Partial<PrinterConfig>) => void;
}

const ThermalTemplateEditorCard: React.FC<Props> = ({ config, updateConfig }) => {
 const { t } = useTranslation();

 const template = config.thermalTemplate || {
 showLogo: true,
 showBusinessName: true,
 showAddress: true,
 showContact: true,
 showVatNo: true,
 showArabicName: true,
 showLineVat: true,
 showToken: true,
 footerText: 'Thank you for your visit!\nPowered by Billing Pro',
 fontSize: 'normal' as const
 };

 const updateTemplate = (patch: Partial<typeof template>) => {
 updateConfig({ thermalTemplate: { ...template, ...patch } });
 };

 return (
 <SettingsCard 
 title={t('settings.printing.template_editor', 'Thermal Layout Designer')} 
 description={t('settings.printing.template_desc', 'Customize physical sections mapped out for your checkout vouchers')}
 icon={Layout}
 >
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-1">
 {/* Controls Section */}
 <div className="space-y-6">
 <div>
 <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
 <Eye size={16} className="text-slate-900 dark:text-white"/>
 {t('settings.printing.visible_elements', 'Visible Elements')}
 </h4>
 <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_logo', 'Print Business Logo')}
 </span>
 <input 
 type="checkbox"
 checked={template.showLogo} 
 onChange={(e) => updateTemplate({ showLogo: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_name', 'Print Company Name')}
 </span>
 <input 
 type="checkbox"
 checked={template.showBusinessName} 
 onChange={(e) => updateTemplate({ showBusinessName: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_address', 'Print Store Address')}
 </span>
 <input 
 type="checkbox"
 checked={template.showAddress} 
 onChange={(e) => updateTemplate({ showAddress: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_contact', 'Print Phone/Email')}
 </span>
 <input 
 type="checkbox"
 checked={template.showContact} 
 onChange={(e) => updateTemplate({ showContact: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_vat', 'Print VAT Number')}
 </span>
 <input 
 type="checkbox"
 checked={template.showVatNo} 
 onChange={(e) => updateTemplate({ showVatNo: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_arabic', 'Print Product Arabic Names')}
 </span>
 <input 
 type="checkbox"
 checked={template.showArabicName} 
 onChange={(e) => updateTemplate({ showArabicName: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_line_vat', 'Print Line-Item VAT')}
 </span>
 <input 
 type="checkbox"
 checked={template.showLineVat} 
 onChange={(e) => updateTemplate({ showLineVat: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200">
 {t('settings.printing.show_token', 'Print Queue Token Number')}
 </span>
 <input 
 type="checkbox"
 checked={template.showToken} 
 onChange={(e) => updateTemplate({ showToken: e.target.checked })}
 className="w-4 h-4 text-slate-900 dark:text-white bg-gray-100 border-gray-300 rounded focus:ring-slate-900/20 dark:focus:ring-white/20 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
 />
 </label>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-2 mb-2">
 <Type size={14} className="text-slate-900 dark:text-white"/>
 {t('settings.printing.font_size', 'Base Font Size')}
 </label>
 <select
 value={template.fontSize}
 onChange={(e) => updateTemplate({ fontSize: e.target.value as any })}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm dark:text-white"
 >
 <option value="small">Small (9px)</option>
 <option value="normal">Standard (11px)</option>
 <option value="large">Large (13px)</option>
 </select>
 </div>
 </div>

 <div>
 <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-2 mb-2">
 <AlignLeft size={14} className="text-slate-900 dark:text-white"/>
 {t('settings.printing.footer_text', 'Custom Footer Text')}
 </label>
 <textarea
 value={template.footerText}
 onChange={(e) => updateTemplate({ footerText: e.target.value })}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white font-mono"
 rows={3}
 placeholder="Thank you for shopping!"
 />
 </div>
 </div>

 {/* Live Preview Section */}
 <div className="flex flex-col items-center justify-start bg-slate-100 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
 <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4">Receipt Preview</span>
 
 {/* The"Paper Roll"container */}
 <div className="w-[68mm] bg-white text-black p-4 border border-slate-200 font-mono text-left relative overflow-hidden"
 style={{ 
 fontSize: template.fontSize === 'small' ? '9px' : template.fontSize === 'large' ? '13px' : '11px',
 lineHeight: '1.2'
 }}>
 
 {/* Header */}
 <div className="text-center space-y-1 mb-3">
 {template.showLogo && (
 <div className="border border-dashed border-black/30 p-2 mx-auto w-16 text-center text-[10px] text-gray-600 mb-1">
 [LOGO]
 </div>
)}
 {template.showBusinessName && <div className="font-bold text-sm">CHEF'S PALACE</div>}
 {template.showAddress && <div className="text-[10px]">123 Main St, King Fahd Rd</div>}
 {template.showContact && <div className="text-[10px]">Tel: 055-1234567</div>}
 {template.showVatNo && <div className="text-[10px]">VAT: 300123456700003</div>}
 </div>

 <div className="border-b border-dashed border-black my-2"></div>

 {/* Order Details */}
 <div className="flex justify-between text-[10px] mb-2">
 <span>Inv: #INV-00104</span>
 <span>28/04/2026</span>
 </div>

 {template.showToken && (
 <div className="text-center my-3">
 <div className="text-[10px] font-bold">TOKEN NUMBER</div>
 <div className="text-3xl font-extrabold">#42</div>
 </div>
)}

 <div className="border-b border-dashed border-black my-2"></div>

 {/* Items Header */}
 <div className="flex justify-between text-[10px] font-bold mb-1 border-b border-black pb-0.5">
 <span className="flex-[2]">ITEM</span>
 <span className="flex-[1] text-right">TOTAL</span>
 </div>

 {/* Items List */}
 <div className="space-y-2 py-1">
 <div>
 <div className="font-bold">Chicken Shawarma</div>
 {template.showArabicName && <div className="text-[10px] font-sans">شاورما دجاج</div>}
 <div className="flex justify-between text-[10px]">
 <span>2 x 15.00 {template.showLineVat && '(+VAT 2.25)'}</span>
 <span>30.00</span>
 </div>
 </div>

 <div>
 <div className="font-bold">Fresh Orange Juice</div>
 {template.showArabicName && <div className="text-[10px] font-sans">عصير برتقال طازج</div>}
 <div className="flex justify-between text-[10px]">
 <span>1 x 12.00 {template.showLineVat && '(+VAT 1.80)'}</span>
 <span>12.00</span>
 </div>
 </div>
 </div>

 <div className="border-b border-dashed border-black my-2"></div>

 {/* Totals */}
 <div className="space-y-1 text-[11px]">
 <div className="flex justify-between">
 <span>Subtotal</span>
 <span>42.00</span>
 </div>
 <div className="flex justify-between">
 <span>VAT (15%)</span>
 <span>4.05</span>
 </div>
 <div className="flex justify-between font-extrabold text-[13px] border-t border-dashed border-black pt-1 mt-1">
 <span>TOTAL</span>
 <span>SAR 42.00</span>
 </div>
 </div>

 <div className="border-b border-dashed border-black my-3"></div>

 {/* Footer */}
 {template.footerText && (
 <div className="text-center text-[10px] whitespace-pre-line text-black mt-2">
 {template.footerText}
 </div>
)}

 {/* Zig-Zag Bottom Edge */}
 <div className="absolute bottom-0 left-0 right-0 h-1 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-200 to-transparent"></div>
 </div>
 </div>
 </div>
 </SettingsCard>
);
};

export default ThermalTemplateEditorCard;

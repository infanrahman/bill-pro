import React from 'react';
import { useTranslation } from 'react-i18next';
import { Type, Languages, FileText, Zap, Receipt } from 'lucide-react';
import SettingsCard from '../../components/SettingsCard';
import FormRow from '../../components/FormRow';
import type { PrinterConfig } from '../InvoicePrintTab';

interface Props {
 config: PrinterConfig;
 updateConfig: (patch: Partial<PrinterConfig>) => void;
}

const PrinterBasicConfigCard: React.FC<Props> = ({ config, updateConfig }) => {
 const { t } = useTranslation();

 return (
 <SettingsCard 
 title={t('settings.printing.basic_title', 'General Printing Setup')} 
 description={t('settings.printing.basic_desc', 'Configure core invoice behavior and display')}
 icon={Receipt}
 >
 <div className="divide-y divide-slate-100 dark:divide-slate-700">
 <FormRow 
 label={t('settings.printing.type_label', 'Main Printer Type')} 
 description={t('settings.printing.type_desc', 'Select between thermal receipt or regular A4/A5 invoices')}
 icon={Type}
 >
 <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
 <button type="button"
 onClick={() => updateConfig({ printerType: 'thermal' })}
 className={`px-4 py-2 rounded-lg text-sm font-bold ${config.printerType === 'thermal'
 ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white '
 : 'text-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
 }`}
 >
 Thermal (80mm)
 </button>
 <button type="button"
 onClick={() => updateConfig({ printerType: 'regular' })}
 className={`px-4 py-2 rounded-lg text-sm font-bold ${config.printerType === 'regular'
 ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white '
 : 'text-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
 }`}
 >
 Regular (A4/A5)
 </button>
 </div>
 </FormRow>

 <FormRow 
 label={t('settings.printing.language_label', 'Print Language')} 
 description={t('settings.printing.language_desc', 'Choose if invoices should be single or dual language')}
 icon={Languages}
 >
 <select
 value={config.printLanguage}
 onChange={(e) => updateConfig({ printLanguage: e.target.value as any })}
 className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white sm:min-w-[180px]"
 >
 <option value="english">English Only</option>
 <option value="bilingual">Bilingual (EN + AR)</option>
 </select>
 </FormRow>

 <FormRow 
 label={t('settings.printing.silent_print_label', 'Enable Silent Printing')} 
 description={t('settings.printing.silent_print_desc', 'Print directly to system default printer without dialog')}
 icon={Zap}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={config.enableSilentPrint}
 onChange={(e) => updateConfig({ enableSilentPrint: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
 </label>
 </FormRow>

 <FormRow 
 label={t('settings.printing.show_terms_label', 'Show Terms & Conditions')} 
 description={t('settings.printing.show_terms_desc', 'Append custom terms to the bottom of the invoice')}
 icon={FileText}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={config.showTerms}
 onChange={(e) => updateConfig({ showTerms: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
 </label>
 </FormRow>

 {config.showTerms && (
 <div className="pt-4">
 <textarea
 value={config.termsContent}
 onChange={(e) => updateConfig({ termsContent: e.target.value })}
 placeholder="Enter terms and conditions here..."
 rows={4}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm dark:text-white focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none"
 />
 </div>
)}
 </div>
 </SettingsCard>
);
};

export default PrinterBasicConfigCard;

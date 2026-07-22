import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Printer, Copy } from 'lucide-react';
import SettingsCard from '../../components/SettingsCard';
import FormRow from '../../components/FormRow';
import type { PrinterConfig } from '../InvoicePrintTab';

interface Props {
 config: PrinterConfig;
 updateConfig: (patch: Partial<PrinterConfig>) => void;
 printers: any[];
}

const RegularPrinterCard: React.FC<Props> = ({ config, updateConfig, printers }) => {
 const { t } = useTranslation();

 const updateRegular = (patch: Partial<PrinterConfig['regular']>) => {
 updateConfig({ regular: { ...config.regular, ...patch } });
 };

 return (
 <SettingsCard 
 title={t('settings.printing.regular_title', 'A4/A5 Laser Printing')} 
 description={t('settings.printing.regular_desc', 'Settings for standard office printers and PDF generation')}
 icon={FileText}
 >
 <div className="divide-y divide-slate-100 dark:divide-slate-700">
 <FormRow 
 label={t('settings.printing.regular_device', 'Default System Printer')} 
 description={t('settings.printing.regular_device_desc', 'Select your primary office printer')}
 icon={Printer}
 >
 <select
 value={config.regular.printerName}
 onChange={(e) => updateRegular({ printerName: e.target.value })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white min-w-[220px]"
 >
 <option value="">System Default</option>
 {printers.map((p, idx) => (
 <option key={idx} value={p.name}>{p.name}</option>
))}
 </select>
 </FormRow>

 <FormRow 
 label={t('settings.printing.regular_copies', 'Print Copies')} 
 description={t('settings.printing.regular_copies_desc', 'Copies per invoice')}
 icon={Copy}
 >
 <input
 type="number"
 min="1"
 max="5"
 value={config.regular.copies}
 onChange={(e) => updateRegular({ copies: parseInt(e.target.value) || 1 })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white w-24 text-center font-bold"
 />
 </FormRow>
 </div>
 </SettingsCard>
);
};

export default RegularPrinterCard;

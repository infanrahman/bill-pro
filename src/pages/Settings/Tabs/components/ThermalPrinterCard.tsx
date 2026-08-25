import React from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Maximize2, Copy } from 'lucide-react';
import SettingsCard from '../../components/SettingsCard';
import FormRow from '../../components/FormRow';
import type { PrinterConfig } from '../InvoicePrintTab';

interface Props {
 config: PrinterConfig;
 updateConfig: (patch: Partial<PrinterConfig>) => void;
 printers: any[];
}

const ThermalPrinterCard: React.FC<Props> = ({ config, updateConfig, printers }) => {
 const { t } = useTranslation();

 const updateThermal = (patch: Partial<PrinterConfig['thermal']>) => {
 updateConfig({ thermal: { ...config.thermal, ...patch } });
 };

 return (
 <SettingsCard 
 title={t('settings.printing.thermal_title', 'Thermal Printer Settings')} 
 description={t('settings.printing.thermal_desc', 'Configure hardware for 80mm/58mm thermal receipts')}
 icon={Printer}
 >
 <div className="divide-y divide-slate-100 dark:divide-slate-700">
 <FormRow 
 label={t('settings.printing.device_label', 'Printer Device')} 
 description={t('settings.printing.device_desc', 'Select the thermal printer from connected system devices')}
 icon={Printer}
 >
 <select
 value={config.thermal.printerName}
 onChange={(e) => updateThermal({ printerName: e.target.value })}
 className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white sm:min-w-[220px]"
 >
 <option value="">{t('common.select_printer', 'Select Printer')}</option>
 {printers.map((p, idx) => (
 <option key={idx} value={p.name}>{p.name}</option>
 ))}
 </select>
 </FormRow>

 <FormRow 
 label={t('settings.printing.paper_size', 'Paper Size')} 
 description={t('settings.printing.paper_size_desc', 'Standard roll width (usually 80mm for standard pos)')}
 icon={Maximize2}
 >
 <select
 value={config.thermal.paperSize}
 onChange={(e) => updateThermal({ paperSize: e.target.value as any })}
 className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white sm:min-w-[180px]"
 >
 <option value="80mm">80mm (Standard)</option>
 <option value="58mm">58mm (Small)</option>
 <option value="custom">Custom Width</option>
 </select>
 </FormRow>

 {config.thermal.paperSize === 'custom' && (
 <FormRow 
 label={t('settings.printing.custom_width', 'Custom Width')} 
 description={t('settings.printing.custom_width_desc', 'Specify exact width (e.g. 76mm)')}
 >
 <input
 type="text"
 value={config.thermal.customPaperWidth}
 onChange={(e) => updateThermal({ customPaperWidth: e.target.value })}
 className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white sm:min-w-[180px] text-left sm:text-right"
 placeholder="76mm"
 />
 </FormRow>
)}

 <FormRow 
 label={t('settings.printing.copies_label', 'Print Copies')} 
 description={t('settings.printing.copies_desc', 'Number of duplicate receipts to print automatically')}
 icon={Copy}
 >
 <input
 type="number"
 min="1"
 max="5"
 value={config.thermal.copies}
 onChange={(e) => updateThermal({ copies: parseInt(e.target.value) || 1 })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white w-24 text-center font-bold"
 />
 </FormRow>
 </div>
 </SettingsCard>
);
};

export default ThermalPrinterCard;

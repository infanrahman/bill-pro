import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat, Printer, Copy } from 'lucide-react';
import SettingsCard from '../../components/SettingsCard';
import FormRow from '../../components/FormRow';
import type { PrinterConfig } from '../InvoicePrintTab';

interface Props {
 config: PrinterConfig;
 updateConfig: (patch: Partial<PrinterConfig>) => void;
 printers: any[];
}

const KitchenPrinterCard: React.FC<Props> = ({ config, updateConfig, printers }) => {
 const { t } = useTranslation();

 const updateKitchen = (patch: Partial<PrinterConfig['kitchen']>) => {
 updateConfig({ kitchen: { ...config.kitchen, ...patch } });
 };

 return (
 <SettingsCard 
 title={t('settings.printing.kitchen_title', 'Kitchen Printing')} 
 description={t('settings.printing.kitchen_desc', 'Enable automatic order tickets for the kitchen')}
 icon={ChefHat}
 >
 <div className="divide-y divide-slate-100 dark:divide-slate-700">
 <FormRow 
 label={t('settings.printing.enable_kitchen', 'Enable Kitchen Printer')} 
 description={t('settings.printing.enable_kitchen_desc', 'Send order items to a dedicated kitchen printer')}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={config.kitchen.enabled}
 onChange={(e) => updateKitchen({ enabled: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-orange-500"></div>
 </label>
 </FormRow>

 {config.kitchen.enabled && (
 <div className="pt-4 space-y-4">
 <FormRow 
 label={t('settings.printing.kitchen_device', 'Kitchen Device')} 
 description={t('settings.printing.kitchen_device_desc', 'Select the printer located in the kitchen')}
 icon={Printer}
 >
 <select
 value={config.kitchen.printerName}
 onChange={(e) => updateKitchen({ printerName: e.target.value })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white min-w-[220px]"
 >
 <option value="">Select Kitchen Printer</option>
 {printers.map((p, idx) => (
 <option key={idx} value={p.name}>{p.name}</option>
))}
 </select>
 </FormRow>

 <FormRow 
 label={t('settings.printing.kitchen_copies', 'Kitchen Copies')} 
 description={t('settings.printing.kitchen_copies_desc', 'Number of tickets per order')}
 icon={Copy}
 >
 <input
 type="number"
 min="1"
 max="5"
 value={config.kitchen.copies}
 onChange={(e) => updateKitchen({ copies: parseInt(e.target.value) || 1 })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white w-24 text-center font-bold"
 />
 </FormRow>
 </div>
)}
 </div>
 </SettingsCard>
);
};

export default KitchenPrinterCard;

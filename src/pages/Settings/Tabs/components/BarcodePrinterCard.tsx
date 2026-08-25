import React from 'react';
import { useTranslation } from 'react-i18next';
import { Barcode, ExternalLink, Settings2, Maximize } from 'lucide-react';
import SettingsCard from '../../components/SettingsCard';
import FormRow from '../../components/FormRow';
import type { PrinterConfig } from '../InvoicePrintTab';

interface Props {
 config: PrinterConfig;
 updateConfig: (patch: Partial<PrinterConfig>) => void;
 printers: any[];
}

const BarcodePrinterCard: React.FC<Props> = ({ config, updateConfig, printers }) => {
 const { t } = useTranslation();

 const updateBarcode = (patch: Partial<PrinterConfig['barcode']>) => {
 updateConfig({ barcode: { ...config.barcode, ...patch } });
 };

 return (
 <SettingsCard 
 title={t('settings.printing.barcode_title', 'Barcode & Label Printing')} 
 description={t('settings.printing.barcode_desc', 'Configure thermal label printers for product tagging')}
 icon={Barcode}
 >
 <div className="divide-y divide-slate-100 dark:divide-slate-700">
 <FormRow 
 label={t('settings.printing.enable_barcode', 'Enable Label Printer')} 
 description={t('settings.printing.enable_barcode_desc', 'Allow printing barcodes directly from stock management')}
 >
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={config.enableBarcodePrinter}
 onChange={(e) => updateConfig({ enableBarcodePrinter: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-slate-600 peer-checked:bg-indigo-600"></div>
 </label>
 </FormRow>

 {config.enableBarcodePrinter && (
 <div className="divide-y divide-slate-100 dark:divide-slate-700">
 <FormRow 
 label={t('settings.printing.barcode_device', 'Barcode Printer Device')} 
 description={t('settings.printing.barcode_device_desc', 'Select the label printer (e.g. Xprinter 370B)')}
 >
 <select
 value={config.barcode.printerName}
 onChange={(e) => updateBarcode({ printerName: e.target.value })}
 className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white sm:min-w-[220px]"
 >
 <option value="">Select Label Printer</option>
 {printers.map((p, idx) => (
 <option key={idx} value={p.name}>{p.name}</option>
 ))}
 </select>
 </FormRow>

 <FormRow label={t('settings.printing.label_size', 'Label Dimensions')}>
 <div className="flex items-center gap-3">
 <input
 type="text"
 value={config.barcode.labelWidth}
 onChange={(e) => updateBarcode({ labelWidth: e.target.value })}
 className="w-20 sm:w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 text-sm dark:text-white text-center"
 placeholder="50mm"
 title="Width"
 />
 <span className="text-slate-400 font-bold">×</span>
 <input
 type="text"
 value={config.barcode.labelHeight}
 onChange={(e) => updateBarcode({ labelHeight: e.target.value })}
 className="w-20 sm:w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 text-sm dark:text-white text-center"
 placeholder="25mm"
 title="Height"
 />
 </div>
 </FormRow>

 <FormRow 
 label={t('settings.printing.orientation', 'Print Orientation')} 
 icon={ExternalLink}
 >
 <select
 value={config.barcode.orientation}
 onChange={(e) => updateBarcode({ orientation: e.target.value as any })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white min-w-[180px]"
 >
 <option value="portrait">Portrait</option>
 <option value="landscape">Landscape</option>
 </select>
 </FormRow>

 <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
 <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">
 {t('settings.printing.number_mapping', 'Cost Price Mapping (Letter Option)')}
 </h4>
 <p className="text-xs text-slate-700 mb-4">
 {t('settings.printing.number_mapping_desc', 'Assign a letter to each number (0-9) to hide the cost price on barcodes.')}
 </p>

 <label className="flex items-center gap-3 p-3 mb-4 bg-slate-50 dark:bg-slate-900 rounded-xl cursor-pointer">
 <input
   type="checkbox"
   checked={config.barcode.enableRandomCostCode || false}
   onChange={(e) => updateBarcode({ enableRandomCostCode: e.target.checked })}
   className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-white border-slate-300 dark:border-slate-600 dark:bg-slate-800"
 />
 <div className="flex-1">
   <div className="text-sm font-semibold text-slate-800 dark:text-white">
   {t('settings.printing.random_cost_code', 'Add Random Letters Padding')}
   </div>
   <div className="text-[10px] text-slate-700 mt-0.5">
   {t('settings.printing.random_cost_code_desc', 'Generates random letters at the start and end of the secret cost code')}
   </div>
 </div>
 </label>
 <div className="grid grid-cols-5 gap-3">
 {['1','2','3','4','5','6','7','8','9','0'].map(num => (
 <div key={num} className="flex flex-col items-center">
 <label className="text-xs font-bold text-slate-700 mb-1">{num}</label>
 <input
 type="text"
 maxLength={1}
 value={config.barcode.numberMapping?.[num] || ''}
 onChange={(e) => {
 const mapping = { ...(config.barcode.numberMapping || {}) };
 mapping[num] = e.target.value.toUpperCase();
 updateBarcode({ numberMapping: mapping });
 }}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-center px-2 py-1.5 text-sm font-bold dark:text-white uppercase"
 />
 </div>
))}
 </div>
 </div>
 </div>
)}
 </div>
 </SettingsCard>
);
};

export default BarcodePrinterCard;

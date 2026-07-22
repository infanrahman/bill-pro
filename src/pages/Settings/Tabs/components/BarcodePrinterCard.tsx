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
 <div className="pt-4 space-y-4">
 <FormRow 
 label={t('settings.printing.barcode_device', 'Label Device')} 
 description={t('settings.printing.barcode_device_desc', 'Select your secondary barcode label printer')}
 icon={Settings2}
 >
 <select
 value={config.barcode.printerName}
 onChange={(e) => updateBarcode({ printerName: e.target.value })}
 className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white min-w-[220px]"
 >
 <option value="">Select Label Printer</option>
 {printers.map((p, idx) => (
 <option key={idx} value={p.name}>{p.name}</option>
))}
 </select>
 </FormRow>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <FormRow 
 label={t('settings.printing.label_width', 'Label Width')} 
 icon={Maximize}
 inline={false}
 >
 <input
 type="text"
 value={config.barcode.labelWidth}
 onChange={(e) => updateBarcode({ labelWidth: e.target.value })}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white"
 placeholder="50mm"
 />
 </FormRow>
 <FormRow 
 label={t('settings.printing.label_height', 'Label Height')} 
 icon={Maximize}
 inline={false}
 >
 <input
 type="text"
 value={config.barcode.labelHeight}
 onChange={(e) => updateBarcode({ labelHeight: e.target.value })}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white"
 placeholder="25mm"
 />
 </FormRow>
 </div>

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

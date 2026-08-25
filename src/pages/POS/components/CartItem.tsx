import React from 'react';
import { Trash2, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../contexts/SettingsContext';

interface CartItemProps {
 item: {
 itemId: string;
 name: string;
 quantity: number;
 price: number;
 total: number;
 unit: string;
 taxType?: 'inclusive' | 'exclusive';
 trackSerial?: boolean;
 serialNumber?: string;
 };
 onRemove: (id: string, index?: number) => void;
 onUpdateQuantity: (id: string, qty: number) => void;
 onUpdatePrice: (id: string, price: number) => void;
 onFetchScaleWeight?: (id: string) => void;
 onSetSerial?: () => void;
}

const CartItem: React.FC<CartItemProps> = ({
 item,
 onRemove,
 onUpdateQuantity,
 onUpdatePrice,
 onFetchScaleWeight,
 onSetSerial
}) => {
 const { t } = useTranslation();
 const { formatCurrency } = useSettings();

 const isWeighted = item.unit?.toLowerCase() === 'kg';

 return (
 <div className="group relative bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover: fade-in slide-in-from-right-2">
 <div className="flex justify-between items-start mb-2">
 <div className="flex-1 min-w-0 pr-4">
 <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">
 {item.name}
 </h4>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
 {item.unit || 'unit'}
 </span>
 {item.taxType === 'inclusive' ? (
 <span className="text-[9px] text-green-600 dark:text-green-400/80 font-bold uppercase tracking-tight">
 {t('pos.tax_incl')}
 </span>
) : (
 <span className="text-[9px] text-orange-500 dark:text-orange-400/80 font-bold uppercase tracking-tight">
 {t('pos.tax_excl')}
 </span>
)}
 </div>
 {item.trackSerial && (
   <div className="mt-1.5">
     <button 
       type="button" 
       onClick={onSetSerial}
       className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
         item.serialNumber 
           ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-500/20' 
           : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-500/20 animate-pulse'
       }`}
     >
       {item.serialNumber ? `S/N: ${item.serialNumber}` : '⚠️ MISSING SERIAL'}
     </button>
   </div>
 )}
 </div>
 <button type="button"
 onClick={() => onRemove(item.itemId)}
 className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
 >
 <Trash2 size={16} />
 </button>
 </div>

 <div className="flex items-end justify-between gap-3">
 <div className="flex-1 grid grid-cols-2 gap-2">
 <div className="flex flex-col gap-1">
 <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider ml-1">
 {t('pos.price')}
 </span>
 <div className="relative group/input">
 <input
 type="number"
 value={item.price}
 onChange={(e) => onUpdatePrice(item.itemId, parseFloat(e.target.value) || 0)}
 className="w-full h-8 px-2 pl-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:border-slate-900 dark:focus:border-white outline-none dark:text-white"
 />
 <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-bold">₹</span>
 </div>
 </div>

 <div className="flex flex-col gap-1">
 <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider ml-1">
 {isWeighted ? t('pos.weight', { defaultValue: 'Weight' }) : t('pos.qty')}
 </span>
 <div className="flex items-center gap-1">
 <div className="relative flex-1 group/input">
 <input
 type="number"
 value={item.quantity}
 step={isWeighted ? 0.001 : 1}
 disabled={item.trackSerial}
 onChange={(e) => onUpdateQuantity(item.itemId, parseFloat(e.target.value) || 0)}
 className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:border-slate-900 dark:focus:border-white outline-none dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
 />
 {isWeighted && onFetchScaleWeight && (
 <button type="button"
 onClick={() => onFetchScaleWeight(item.itemId)}
 className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
 title="Fetch Weight from Scale"
 >
 <Scale size={12} />
 </button>
)}
 </div>
 </div>
 </div>
 </div>

 <div className="text-right min-w-[80px]">
 <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-0.5">
 {item.quantity} × {item.price.toFixed(2)}
 </div>
 <div className="text-sm font-semibold text-slate-900 dark:text-white">
 {formatCurrency(item.total)}
 </div>
 </div>
 </div>
 </div>
);
};

export default React.memo(CartItem);

import React from 'react';
import type { Item } from '../../services/db';
import { useSettings } from '../../contexts/SettingsContext';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

interface CompactItemCardProps {
  item: Item;
  onClick: (item: Item) => void;
  showArabicName?: boolean;
}

const CompactItemCard: React.FC<CompactItemCardProps> = ({ item, onClick, showArabicName }) => {
  const { settings, formatCurrency } = useSettings();

  return (
    <button type="button"
      onClick={() => onClick(item)} 
      className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left flex flex-col justify-between h-44 sm:h-48 w-full group relative overflow-hidden transition-all duration-200 hover:border-slate-900 dark:hover:border-white hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] shrink-0"
    >
      <div className="absolute top-3 right-3 p-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 group-hover:scale-100 scale-75 transition-all duration-200 z-20 shadow-md">
        <Plus size={15} strokeWidth={2.5} />
      </div>

      <div className="relative z-10 w-full flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white line-clamp-2 leading-snug uppercase tracking-tight group-hover:text-slate-900 dark:group-hover:text-white pr-5">
            {item.name}
          </h3>
          {showArabicName && item.arabicName && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold tracking-tight">{item.arabicName}</p>
          )}
        </div>

        {!settings.cafeMode && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <div className={clsx(
              "w-2 h-2 rounded-full shrink-0", 
              (item.stock || 0) <= 0 ? 'bg-rose-500 ring-2 ring-rose-500/20' : 
              (item.stock || 0) <= (item.minStock || 5) ? 'bg-amber-500 ring-2 ring-amber-500/20' : 
              'bg-emerald-500 ring-2 ring-emerald-500/20'
            )} />
            <span className={clsx(
              "text-[10px] font-bold uppercase tracking-wider",
              (item.stock || 0) <= 0 ? 'text-rose-500' : 
              (item.stock || 0) <= (item.minStock || 5) ? 'text-amber-600 dark:text-amber-400' : 
              'text-slate-600 dark:text-slate-300'
            )}>
              {item.stock <= 0 ? 'Out of stock' : `${item.stock} ${item.unit || 'pc'}`}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <span className="font-extrabold text-sm sm:text-base md:text-lg text-slate-900 dark:text-white tracking-tight leading-none">
            {formatCurrency(item.salePrice)}
          </span>
        </div>
        {item.unit && (
          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 rounded-md">
            {item.unit}
          </span>
        )}
      </div>
    </button>
  );
};

export default React.memo(CompactItemCard);

import React from 'react';
import type { Item } from '../../services/db';
import { useSettings } from '../../contexts/SettingsContext';
import { ImageOff, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';

interface ItemCardProps {
  item: Item;
  onClick: (item: Item) => void;
  showArabicName?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, showArabicName }) => {
  const { settings, formatCurrency } = useSettings();
  const [imgError, setImgError] = React.useState(false);
  
  React.useEffect(() => {
    setImgError(false);
  }, [item.image]);

  return (
    <button type="button"
      onClick={() => onClick(item)}
      className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-900 dark:hover:border-white hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-44 sm:h-48 w-full active:scale-[0.99] shrink-0"
    >
      {/* Image Section */}
      <div className="w-full h-24 sm:h-26 bg-slate-100 dark:bg-slate-900 relative overflow-hidden shrink-0">
        {item.image && !imgError ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <ImageOff size={32} className="text-slate-300 dark:text-slate-600"/>
          </div>
        )}

        {/* Overlays */}
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors"/>
        
        {/* Stock Badge - Only show if NOT in Cafe Mode */}
        {!settings.cafeMode && (
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 z-10">
            {item.stock <= 0 ? (
              <div className="bg-rose-500/90 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                Out of Stock
              </div>
            ) : item.stock <= (item.minStock || 5) ? (
              <div className="bg-amber-500/90 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                Low Stock
              </div>
            ) : null}
          </div>
        )}

        {/* Quick Add Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 p-2.5 rounded-2xl scale-90 group-hover:scale-100 transition-transform shadow-lg">
            <ShoppingCart size={18} />
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="p-3 text-left flex-1 flex flex-col justify-between min-w-0 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50">
        <div>
          <h3 className="font-bold text-xs text-slate-800 dark:text-white line-clamp-1 uppercase tracking-tight group-hover:text-slate-900 dark:group-hover:text-white">
            {item.name}
          </h3>
          {showArabicName && item.arabicName && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 font-semibold" dir="rtl">{item.arabicName}</div>
          )}
        </div>
        
        <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40 flex items-center justify-between">
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(item.salePrice)}
          </span>
          {!settings.cafeMode && (
            <span className={clsx(
              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
              item.stock > 0 ? "text-slate-600 bg-slate-200/60 dark:bg-slate-700/60" : "text-rose-500 bg-rose-50 dark:bg-rose-950/30"
            )}>
              {item.stock} {item.unit || 'pc'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default React.memo(ItemCard);

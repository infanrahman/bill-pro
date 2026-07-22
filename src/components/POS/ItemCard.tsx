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
 const { settings } = useSettings();
 const [imgError, setImgError] = React.useState(false);
 
 React.useEffect(() => {
 setImgError(false);
 }, [item.image]);

 const formatCurrency = (amount: number) => settings.currency + amount.toFixed(settings.decimals);

 return (
 <button type="button"
 
 
 onClick={() => onClick(item)}
 className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white hover: overflow-hidden flex flex-col h-full w-full"
 >
 {/* Image Section */}
 <div className="w-full aspect-[16/10] bg-slate-100 dark:bg-slate-900 relative overflow-hidden shrink-0">
 {item.image && !imgError ? (
 <img
 src={item.image}
 alt={item.name}
 className="w-full h-full object-cover group- ease-out"
 onError={() => setImgError(true)}
 />
) : (
 <div className="w-full h-full flex items-center justify-center from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900">
 <ImageOff size={40} className="text-slate-300 dark:text-slate-300"/>
 </div>
)}

 {/* Overlays */}
 <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors"/>
 
 {/* Stock Badge - Only show if NOT in Cafe Mode */}
 {!settings.cafeMode && (
 <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
 {item.stock <= 0 ? (
 <div className="bg-red-500 text-white text-[9px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider">
 Out of Stock
 </div>
) : item.stock <= (item.minStock || 5) ? (
 <div className="bg-amber-500 text-white text-[9px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider">
 Low Stock
 </div>
) : null}
 </div>
)}

 {/* Quick Add Overlay */}
 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
 <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl scale-90 group-">
 <ShoppingCart size={20} className="text-slate-900 dark:text-white"/>
 </div>
 </div>
 </div>

 {/* Details Section */}
 <div className="p-4 text-left flex-1 flex flex-col justify-between min-w-0 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/50">
 <div>
 <h3 className="font-semibold text-xs md:text-sm text-slate-800 dark:text-white line-clamp-2 leading-tight group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-tight">
 {item.name}
 </h3>
 {showArabicName && item.arabicName && (
 <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-1 font-arabic font-bold"dir="rtl">{item.arabicName}</div>
)}
 </div>
 
 <div className="mt-3 flex flex-col gap-1">
 <div className="flex items-end justify-between">
 <span className="text-base md:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
 {formatCurrency(item.salePrice)}
 </span>
 {!settings.cafeMode && (
 <span className={clsx(
"text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-lg",
 item.stock > 0 ?"text-slate-600 bg-slate-100 dark:bg-slate-800":"text-red-400 bg-red-50 dark:bg-red-900/10"
)}>
 {item.stock} {item.unit || 'pc'}
 </span>
)}
 </div>
 {item.unit && settings.cafeMode && (
 <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
 per {item.unit}
 </span>
)}
 </div>
 </div>
 </button>
);
};

export default React.memo(ItemCard);

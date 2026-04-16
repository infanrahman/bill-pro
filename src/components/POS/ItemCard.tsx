import React from 'react';
import type { Item } from '../../services/db';
import { useSettings } from '../../contexts/SettingsContext';
import { ImageOff } from 'lucide-react';

interface ItemCardProps {
    item: Item;
    onClick: (item: Item) => void;
    showArabicName?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, showArabicName }) => {
    const { settings } = useSettings();
    const formatCurrency = (amount: number) => settings.currency + amount.toFixed(settings.decimals);

    return (
        <button
            onClick={() => onClick(item)}
            className="group relative bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-xl overflow-hidden"
        >
            {/* Image Section */}
            <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                {item.image ? (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageOff size={48} className="text-slate-300 dark:text-slate-600" />
                    </div>
                )}

                {/* Stock Badge - Only show if NOT in Cafe Mode */}
                {!settings.cafeMode && (
                    <>
                        {item.stock <= 0 ? (
                            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                Out of Stock
                            </div>
                        ) : item.stock <= item.minStock ? (
                            <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                Low Stock
                            </div>
                        ) : null}
                    </>
                )}
            </div>

            {/* Details Section */}
            <div className="p-3 text-left">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.name}
                </h3>
                {showArabicName && item.arabicName && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate" dir="rtl">{item.arabicName}</div>
                )}
                <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(item.salePrice)}
                    </span>
                    {!settings.cafeMode && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Stock: {item.stock}
                        </span>
                    )}
                </div>
                {item.unit && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        per {item.unit}
                    </span>
                )}
            </div>
        </button>
    );
};

export default ItemCard;

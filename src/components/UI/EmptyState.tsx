import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
 title: string;
 description: string;
 icon: LucideIcon;
 actionLabel?: string;
 onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
 title,
 description,
 icon: Icon,
 actionLabel,
 onAction
}) => {
 return (
 <div className="flex flex-col items-center justify-center p-8 text-center h-64 fade-in zoom-in-95">
 <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
 <Icon size={48} className="text-slate-600 dark:text-slate-400"/>
 </div>
 <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
 <p className="text-slate-700 dark:text-slate-300 max-w-sm mb-6">{description}</p>
 {actionLabel && onAction && (
 <button type="button"
 onClick={onAction}
 className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
 >
 {actionLabel}
 </button>
)}
 </div>
);
};

export default EmptyState;

import React from 'react';

interface SettingsCardProps {
 children: React.ReactNode;
 title?: string;
 description?: string;
 icon?: React.ElementType;
 className?: string;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ children, title, description, icon: Icon, className =""}) => {
 return (
 <div 
 
 
 className={`bg-white dark:bg-slate-800 border border-white/50 dark:border-slate-700/30 rounded-xl md:rounded-2xl overflow-hidden hover: ${className}`}
 >
 {(title || Icon) && (
 <div className="p-4 md:p-10 border-b border-slate-100/50 dark:border-slate-700/50 flex items-center gap-4 md:gap-6 bg-slate-50 dark:bg-slate-900">
 {Icon && (
 <div className="p-3 md:p-4 bg-slate-900 dark:bg-white text-white rounded-xl md:rounded-2xl border border-slate-900/20 dark:border-white/20 shrink-0">
 <Icon size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.5} />
 </div>
)}
 <div className="min-w-0">
 {title && <h3 className="text-lg md:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight uppercase truncate">{title}</h3>}
 {description && <p className="text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-0.5 md:mt-1">{description}</p>}
 </div>
 </div>
)}
 <div className="p-4 md:p-10">
 {children}
 </div>
 </div>
);
};

export default SettingsCard;

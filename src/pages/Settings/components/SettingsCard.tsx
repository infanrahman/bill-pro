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
 
 
 className={`bg-white dark:bg-slate-800 border border-white/50 dark:border-slate-700/30 rounded-2xl overflow-hidden hover: ${className}`}
 >
 {(title || Icon) && (
 <div className="p-10 border-b border-slate-100/50 dark:border-slate-700/50 flex items-center gap-6 bg-slate-50 dark:bg-slate-900">
 {Icon && (
 <div className="p-4 bg-slate-900 dark:bg-white text-white rounded-2xl border border-slate-900/20 dark:border-white/20">
 <Icon size={24} strokeWidth={2.5} />
 </div>
)}
 <div>
 {title && <h3 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight uppercase">{title}</h3>}
 {description && <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-1">{description}</p>}
 </div>
 </div>
)}
 <div className="p-10">
 {children}
 </div>
 </div>
);
};

export default SettingsCard;

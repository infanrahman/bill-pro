import React from 'react';
import { Sparkles } from 'lucide-react';

interface SettingsSectionHeaderProps {
 title: string;
 description?: string;
 className?: string;
}

const SettingsSectionHeader: React.FC<SettingsSectionHeaderProps> = ({ title, description, className =""}) => {
 return (
 <div className={`mb-10 relative ${className}`}>
 <div className="flex items-center gap-4">
 <div className="h-12 w-1.5 bg-slate-900 dark:bg-white rounded-full"/>
 <div>
 <h2 className="text-4xl font-semibold text-slate-900 dark:text-white tracking-tight uppercase">{title}</h2>
 {description && (
 <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-wider">
 <Sparkles size={14} className="text-amber-500"/>
 {description}
 </p>
)}
 </div>
 </div>
 </div>
);
};

export default SettingsSectionHeader;

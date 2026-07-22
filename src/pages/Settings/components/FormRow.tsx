import React from 'react';

interface FormRowProps {
 label: string;
 description?: string;
 children: React.ReactNode;
 icon?: React.ElementType;
 className?: string;
 inline?: boolean;
}

const FormRow: React.FC<FormRowProps> = ({ 
 label, 
 description, 
 children, 
 icon: Icon, 
 className ="",
 inline = true
}) => {
 return (
 <div className={`py-6 first:pt-0 last:pb-0 ${className}`}>
 <div className={`flex ${inline ? 'flex-col md:flex-row md:items-center' : 'flex-col'} justify-between gap-6`}>
 <div className="flex-1">
 <div className="flex items-center gap-3">
 {Icon && (
 <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg">
 <Icon size={16} />
 </div>
)}
 <label className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
 {label}
 </label>
 </div>
 {description && (
 <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 max-w-xl leading-relaxed uppercase tracking-tight">
 {description}
 </p>
)}
 </div>
 <div className={`${inline ? 'w-full sm:w-auto shrink-0' : 'w-full'} flex items-center`}>
 {children}
 </div>
 </div>
 </div>
);
};

export default FormRow;

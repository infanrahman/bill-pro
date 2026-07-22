import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
 title: string;
 value: string;
 icon: React.ElementType;
 trend?: string;
 trendType?: 'up' | 'down' | 'neutral';
 color: 'blue' | 'green' | 'red' | 'purple';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, trendType = 'neutral', color }) => {

 const colorClasses = {
 blue: {
 bg: ' from-white dark:from-slate-800 dark:to-slate-800/80',
 iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ',
 border: 'border-slate-300 dark:border-slate-600 ',
 ring: 'focus-within:ring-slate-900/20 dark:focus-within:ring-white/20'
 },
 green: {
 bg: ' from-white to-green-50 dark:from-slate-800 dark:to-slate-800/80',
 iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
 border: 'border-emerald-100 dark:border-emerald-900/30',
 ring: 'focus-within:ring-emerald-500'
 },
 red: {
 bg: ' from-white to-red-50 dark:from-slate-800 dark:to-slate-800/80',
 iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
 border: 'border-rose-100 dark:border-rose-900/30',
 ring: 'focus-within:ring-rose-500'
 },
 purple: {
 bg: ' from-white to-purple-50 dark:from-slate-800 dark:to-slate-800/80',
 iconBg: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40 dark:text-fuchsia-400',
 border: 'border-fuchsia-100 dark:border-fuchsia-900/30',
 ring: 'focus-within:ring-fuchsia-500'
 },
 };

 const theme = colorClasses[color];

 return (
 <div className={`relative overflow-hidden ${theme.bg} p-6 rounded-2xl border ${theme.border} hover: group`}>
 {/* Subtle Top Shine */}
 <div className="absolute top-0 left-0 right-0 h-px from-transparent via-white/50 to-transparent dark:via-white/5 opacity-0 group-hover:opacity-100"/>

 <div className="flex justify-between items-start relative z-10">
 <div className="flex flex-col gap-1">
 <p className="text-[13px] font-semibold tracking-wide text-slate-700 dark:text-slate-300 uppercase">{title}</p>
 <h3 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{value}</h3>
 </div>
 <div className={`p-3.5 rounded-2xl ${theme.iconBg} transform group-`}>
 <Icon size={24} strokeWidth={2.5} />
 </div>
 </div>

 {trend && (
 <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold">
 <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full ${trendType === 'up' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
 trendType === 'down' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
 }`}>
 {trendType === 'up' && <TrendingUp size={12} strokeWidth={3} />}
 {trendType === 'down' && <TrendingDown size={12} strokeWidth={3} />}
 {trend}
 </span>
 <span className="text-slate-600 dark:text-slate-400 font-medium tracking-wide">vs last period</span>
 </div>
)}

 {/* Ambient Background Glow (visible on hover) */}
 
 </div>
);
};

export default StatsCard;

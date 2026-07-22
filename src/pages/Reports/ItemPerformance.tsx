import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import type { InventoryRow } from './useInventoryReport';
import { TrendingUp, TrendingDown, DollarSign, ArrowDownLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface Props {
 data: InventoryRow[];
 loading: boolean;
 totals: any;
}

const ItemPerformance: React.FC<Props> = ({ data, loading, totals }) => {
 const { t } = useTranslation();
 const { formatCurrency } = useSettings();

 return (
 <div className="space-y-8 fade-in">
 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {[
 { title: t('reports.total_in'), value: totals.totalIn.toString(), icon: ArrowDownLeft, color: 'blue' },
 { title: t('reports.total_out'), value: totals.totalOut.toString(), icon: ArrowUpRight, color: 'purple' },
 { title: t('reports.total_revenue'), value: formatCurrency(totals.totalRevenue), icon: DollarSign, color: 'emerald' },
 { title: t('reports.total_profit'), value: formatCurrency(totals.totalProfit), icon: TrendingUp, color: totals.totalProfit >= 0 ? 'emerald' : 'rose' }
 ].map((stat, i) => (
 <div
 key={i}
 
 
 
 className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center gap-6 group"
 >
 <div className={clsx(
"p-4 rounded-2xl text-white group-",
 stat.color === 'blue' ?"bg-slate-900 dark:bg-white":
 stat.color === 'purple' ?"bg-purple-600":
 stat.color === 'emerald' ?"bg-emerald-500":"bg-rose-500"
)}>
 <stat.icon size={24} strokeWidth={2.5} />
 </div>
 <div>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{stat.title}</p>
 <p className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
 </div>
 </div>
))}
 </div>

 {/* Table Container */}
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-white/50 dark:border-slate-700/30 overflow-hidden">
 <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-slate-900 dark:bg-white text-white rounded-2xl">
 <Sparkles size={20} />
 </div>
 <div>
 <h3 className="text-lg font-semibold dark:text-white uppercase tracking-tight">{t('reports.item_performance')}</h3>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('reports.performance_subtitle') ||"Deep dive into product movement and profitability"}</p>
 </div>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left whitespace-nowrap">
 <thead>
 <tr className="bg-slate-50 dark:bg-slate-900">
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t('inventory.item_name')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-center">{t('reports.opening')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-center">{t('reports.in_qty')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-center">{t('reports.out_qty')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-center">{t('reports.closing')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right">{t('reports.revenue')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right">{t('reports.profit')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
 {loading ? (
 Array.from({ length: 5 }).map((_, i) => (
 <tr key={i} className="">
 <td colSpan={7} className="p-6"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-full"/></td>
 </tr>
))
) : data.length === 0 ? (
 <tr>
 <td colSpan={7} className="p-20 text-center">
 <TrendingUp size={48} className="mx-auto mb-4 text-slate-300 opacity-50"/>
 <p className="text-slate-700 font-bold uppercase text-[10px] tracking-wider">{t('reports.no_records')}</p>
 </td>
 </tr>
) : (
 data.map((row: any, idx) => (
 <tr 
 key={row.id}
 
 
 
 className="hover:bg-slate-50 dark:hover:bg-slate-700 group"
 >
 <td className="p-6 font-semibold text-slate-800 dark:text-white uppercase tracking-tight">{row.name}</td>
 <td className="p-6 text-center text-slate-700 font-bold text-xs">{row.openingStock}</td>
 <td className="p-6 text-center">
 <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-[11px] font-semibold border border-emerald-500/20">
 +{row.qtyIn}
 </span>
 </td>
 <td className="p-6 text-center">
 <span className="px-3 py-1 bg-rose-500/10 text-rose-600 rounded-lg text-[11px] font-semibold border border-rose-500/20">
 -{row.qtyOut}
 </span>
 </td>
 <td className="p-6 text-center">
 <span className="px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
 {row.closingStock}
 </span>
 </td>
 <td className="p-6 text-right font-semibold text-slate-900 dark:text-white tracking-tight text-sm">{formatCurrency(row.revenue || 0)}</td>
 <td className="p-6 text-right">
 <p className={clsx(
"text-sm font-semibold tracking-tight",
 (row.profit || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
)}>
 {formatCurrency(row.profit || 0)}
 </p>
 </td>
 </tr>
))
)}
 </tbody>
 </table>
 </div>
 </div>
 </div>
);
};

export default ItemPerformance;

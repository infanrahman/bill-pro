import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import type { InventoryRow } from './useInventoryReport';
import { Package, DollarSign, TrendingUp, Sparkles, Search } from 'lucide-react';
import clsx from 'clsx';

interface Props {
 data: InventoryRow[];
 loading: boolean;
 totals: any;
}

const StockSummary: React.FC<Props> = ({ data, loading, totals }) => {
 const { t } = useTranslation();
 const { formatCurrency } = useSettings();

 return (
 <div className="space-y-8 fade-in">
 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {[
 { title: t('reports.total_items'), value: data.length.toString(), icon: Package, color: 'blue' },
 { title: t('reports.total_cost_value'), value: formatCurrency(totals.totalCostValue), icon: DollarSign, color: 'purple' },
 { title: t('reports.total_retail_value'), value: formatCurrency(totals.totalRetailValue), icon: TrendingUp, color: 'emerald' }
 ].map((stat, i) => (
 <div
 key={i}
 
 
 
 className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center gap-4 md:gap-8 group"
 >
 <div className={clsx(
"p-5 rounded-xl text-white group-",
 stat.color === 'blue' ?"bg-slate-900 dark:bg-white":
 stat.color === 'purple' ?"bg-purple-600":"bg-emerald-500"
)}>
 <stat.icon size={28} strokeWidth={2.5} />
 </div>
 <div>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{stat.title}</p>
 <p className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
 </div>
 </div>
))}
 </div>

 {/* Table Container */}
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-white/50 dark:border-slate-700/30 overflow-hidden">
 <div className="p-4 md:p-8 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-900 gap-4 sm:gap-0">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-slate-900 dark:bg-white text-white rounded-2xl">
 <Sparkles size={20} />
 </div>
 <div>
 <h3 className="text-lg font-semibold dark:text-white uppercase tracking-tight">{t('reports.inventory_valuation')}</h3>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('reports.valuation_details') ||"Comprehensive stock value analysis"}</p>
 </div>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left whitespace-nowrap">
 <thead>
 <tr className="bg-slate-50 dark:bg-slate-900">
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t('inventory.item_name')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-center">{t('inventory.stock')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right">{t('inventory.purchase_price')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right">{t('inventory.sale_price')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right">{t('reports.cost_value')}</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right">{t('reports.retail_value')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
 {loading ? (
 Array.from({ length: 5 }).map((_, i) => (
 <tr key={i} className="">
 <td colSpan={6} className="p-6"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-full"/></td>
 </tr>
))
) : data.length === 0 ? (
 <tr>
 <td colSpan={6} className="p-20 text-center">
 <Package size={48} className="mx-auto mb-4 text-slate-300 opacity-50"/>
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
 <td className="p-6 text-center">
 <span className="px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
 {row.currentStock}
 </span>
 </td>
 <td className="p-6 text-right font-bold text-slate-700 dark:text-slate-300 text-xs">{formatCurrency(row.costPrice)}</td>
 <td className="p-6 text-right font-bold text-slate-700 dark:text-slate-300 text-xs">{formatCurrency(row.salePrice)}</td>
 <td className="p-6 text-right">
 <p className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{formatCurrency(row.totalCostValue)}</p>
 </td>
 <td className="p-6 text-right">
 <p className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{formatCurrency(row.totalRetailValue)}</p>
 </td>
 </tr>
))
)}
 </tbody>
 <tfoot className="bg-slate-50 dark:bg-slate-900">
 <tr className="border-t border-slate-200 dark:border-slate-700 font-semibold">
 <td colSpan={4} className="p-6 text-right text-[10px] uppercase tracking-wider text-slate-600">{t('common.total')}</td>
 <td className="p-6 text-right text-lg tracking-tight dark:text-white">{formatCurrency(totals.totalCostValue)}</td>
 <td className="p-6 text-right text-lg tracking-tight text-slate-900 dark:text-white">{formatCurrency(totals.totalRetailValue)}</td>
 </tr>
 </tfoot>
 </table>
 </div>
 </div>
 </div>
);
};

export default StockSummary;

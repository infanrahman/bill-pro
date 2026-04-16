import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import type { InventoryRow } from './useInventoryReport';
import { Package, DollarSign, TrendingUp } from 'lucide-react';
import StatsCard from '../../components/Reports/StatsCard';

interface Props {
    data: InventoryRow[];
    loading: boolean;
    totals: any;
}

const StockSummary: React.FC<Props> = ({ data, loading, totals }) => {
    const { t } = useTranslation();
    const { formatCurrency } = useSettings();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title={t('reports.total_items')}
                    value={data.length.toString()}
                    icon={Package}
                    color="blue"
                    trendType="neutral"
                />
                <StatsCard
                    title={t('reports.total_cost_value')}
                    value={formatCurrency(totals.totalCostValue)}
                    icon={DollarSign}
                    color="purple"
                    trendType="neutral"
                />
                <StatsCard
                    title={t('reports.total_retail_value')}
                    value={formatCurrency(totals.totalRetailValue)}
                    icon={TrendingUp}
                    color="green"
                    trendType="neutral"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-800 dark:text-white">{t('reports.inventory_valuation')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 font-semibold">{t('inventory.item_name')}</th>
                                <th className="p-4 font-semibold text-center">{t('inventory.stock')}</th>
                                <th className="p-4 font-semibold text-right">{t('inventory.purchase_price')}</th>
                                <th className="p-4 font-semibold text-right">{t('inventory.sale_price')}</th>
                                <th className="p-4 font-semibold text-right">{t('reports.cost_value')}</th>
                                <th className="p-4 font-semibold text-right">{t('reports.retail_value')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-8">{t('common.loading')}</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500">{t('reports.no_records')}</td></tr>
                            ) : (
                                data.map((row: any) => (
                                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="p-4 font-medium text-slate-800 dark:text-white text-sm">{row.name}</td>
                                        <td className="p-4 text-center text-slate-600 dark:text-slate-300 font-semibold">{row.currentStock}</td>
                                        <td className="p-4 text-right text-slate-500 font-mono text-sm">{formatCurrency(row.costPrice)}</td>
                                        <td className="p-4 text-right text-slate-500 font-mono text-sm">{formatCurrency(row.salePrice)}</td>
                                        <td className="p-4 text-right font-medium text-slate-700 dark:text-slate-300 text-sm bg-slate-50/50 dark:bg-slate-800/30 group-hover:bg-transparent transition-colors">{formatCurrency(row.totalCostValue)}</td>
                                        <td className="p-4 text-right font-medium text-slate-700 dark:text-slate-300 text-sm bg-slate-50/50 dark:bg-slate-800/30 group-hover:bg-transparent transition-colors">{formatCurrency(row.totalRetailValue)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white">
                            <tr>
                                <td colSpan={4} className="p-4 text-right uppercase tracking-wider text-xs">{t('common.total')}</td>
                                <td className="p-4 text-right">{formatCurrency(totals.totalCostValue)}</td>
                                <td className="p-4 text-right text-blue-600 dark:text-blue-400">{formatCurrency(totals.totalRetailValue)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockSummary;

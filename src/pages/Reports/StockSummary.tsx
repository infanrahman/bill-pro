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
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3">{t('inventory.item_name')}</th>
                                <th className="px-4 py-3 text-center">{t('inventory.stock')}</th>
                                <th className="px-4 py-3 text-right">{t('inventory.purchase_price')}</th>
                                <th className="px-4 py-3 text-right">{t('inventory.sale_price')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.cost_value')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.retail_value')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-8">{t('common.loading')}</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8">{t('reports.no_records')}</td></tr>
                            ) : (
                                data.map(row => (
                                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{row.name}</td>
                                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{row.currentStock}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(row.costPrice)}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(row.salePrice)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{formatCurrency(row.totalCostValue)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{formatCurrency(row.totalRetailValue)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-bold border-t border-slate-200 dark:border-slate-600">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 text-right">{t('common.total')}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(totals.totalCostValue)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(totals.totalRetailValue)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockSummary;

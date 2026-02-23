import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import type { InventoryRow } from './useInventoryReport';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import StatsCard from '../../components/Reports/StatsCard';

interface Props {
    data: InventoryRow[];
    loading: boolean;
    totals: any;
}

const ItemPerformance: React.FC<Props> = ({ data, loading, totals }) => {
    const { t } = useTranslation();
    const { formatCurrency } = useSettings();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatsCard
                    title={t('reports.total_in')}
                    value={totals.totalIn.toString()}
                    icon={TrendingDown} // Buying is usually Down arrow conceptually or Up stock? Let's use generic.
                    color="blue"
                    trendType="neutral"
                />
                <StatsCard
                    title={t('reports.total_out')}
                    value={totals.totalOut.toString()}
                    icon={TrendingUp}
                    color="purple"
                    trendType="neutral"
                />
                <StatsCard
                    title={t('reports.total_revenue')}
                    value={formatCurrency(totals.totalRevenue)}
                    icon={DollarSign}
                    color="green"
                    trendType="neutral"
                />
                <StatsCard
                    title={t('reports.total_profit')}
                    value={formatCurrency(totals.totalProfit)}
                    icon={DollarSign}
                    color={totals.totalProfit >= 0 ? "green" : "red"}
                    trendType="neutral"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-800 dark:text-white">{t('reports.item_performance')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3">{t('inventory.item_name')}</th>
                                <th className="px-4 py-3 text-center">{t('reports.opening')}</th>
                                <th className="px-4 py-3 text-center text-blue-600">{t('reports.in_qty')}</th>
                                <th className="px-4 py-3 text-center text-red-600">{t('reports.out_qty')}</th>
                                <th className="px-4 py-3 text-center font-bold">{t('reports.closing')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.revenue')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.profit')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-8">{t('common.loading')}</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8">{t('reports.no_records')}</td></tr>
                            ) : (
                                data.map(row => (
                                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{row.name}</td>
                                        <td className="px-4 py-3 text-center text-slate-500">{row.openingStock}</td>
                                        <td className="px-4 py-3 text-center text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">+{row.qtyIn}</td>
                                        <td className="px-4 py-3 text-center text-red-600 bg-red-50/50 dark:bg-red-900/10">-{row.qtyOut}</td>
                                        <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-white">{row.closingStock}</td>
                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(row.revenue || 0)}</td>
                                        <td className={`px-4 py-3 text-right font-medium ${(row.profit || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(row.profit || 0)}</td>
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

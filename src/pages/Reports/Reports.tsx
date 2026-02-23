import React, { useState } from 'react';
import { useReportData, type DateRange } from './useReportData';
import StatsCard from '../../components/Reports/StatsCard';
import SalesChart from '../../components/Reports/SalesChart';
import VatReport from './VatReport';
import BillProfitReport from './BillProfitReport';
import InventoryReport from './InventoryReport';
import DayBook from './DayBook';
import { DollarSign, ShoppingBag, PieChart, Calendar, TrendingDown, FileText, LayoutDashboard, ShieldOff, TrendingUp, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const Reports: React.FC = () => {
    const { t } = useTranslation();
    const { settings, formatCurrency } = useSettings();
    const [activeTab, setActiveTab] = useState<'overview' | 'vat' | 'profit' | 'inventory' | 'daybook'>('overview');
    const [range, setRange] = useState<DateRange>('week');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const { hasPermission } = useAuth();

    const {
        totalSales,
        totalExpenses,
        netProfit,
        grossProfit,
        salesByDate,
        currentStockValue
    } = useReportData(range, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);

    if (!hasPermission('reports_view')) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('reports.access_denied_msg')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                    <LayoutDashboard className="text-blue-600" />
                    {t('reports.title')}
                </h1>

                {/* Date Filter (Only for Overview) */}
                {activeTab === 'overview' && (
                    <div className="flex gap-2 items-center">
                        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            {(['today', 'week', 'month', 'year'] as DateRange[]).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRange(r)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${range === r
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                        }`}
                                >
                                    {t(`reports.range_${r}`)}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-1 gap-2">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'overview'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <LayoutDashboard size={18} /> {t('reports.overview')}
                </button>
                <button
                    onClick={() => setActiveTab('daybook')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'daybook'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <Calendar size={18} /> {t('reports.day_book')}
                </button>
                <button
                    onClick={() => setActiveTab('vat')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'vat'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <FileText size={18} /> {t('reports.vat_report')}
                </button>
                <button
                    onClick={() => setActiveTab('profit')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'profit'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <TrendingUp size={18} /> {t('reports.bill_wise_profit')}
                </button>
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'inventory'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <Package size={18} /> {t('reports.inventory_report')}
                </button>
            </div>

            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatsCard
                            title={t('reports.total_revenue')}
                            value={formatCurrency(totalSales)}
                            icon={DollarSign}
                            color="blue"
                            trend="+12.5%"
                            trendType="up"
                        />
                        <StatsCard
                            title={t('reports.gross_profit')}
                            value={formatCurrency(grossProfit)}
                            icon={ShoppingBag}
                            color="purple"
                            trendType="neutral"
                        />
                        <StatsCard
                            title={t('reports.net_profit')}
                            value={formatCurrency(netProfit)}
                            icon={PieChart}
                            color="green"
                            trend="+8.2%"
                            trendType="up"
                        />
                        <StatsCard
                            title={t('reports.expenses')}
                            value={formatCurrency(totalExpenses)}
                            icon={TrendingDown}
                            color="red"
                            trendType="neutral"
                        />
                        <StatsCard
                            title={t('reports.stock_value')}
                            value={formatCurrency(currentStockValue)}
                            icon={ShoppingBag}
                            color="purple"
                            trendType="neutral"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Main Chart */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="text-blue-500" size={20} />
                                <h3 className="font-bold text-lg dark:text-white">{t('reports.sales_trend')}</h3>
                            </div>
                            <SalesChart data={salesByDate} />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: VAT REPORT */}
            {activeTab === 'vat' && (
                <VatReport />
            )}

            {/* TAB CONTENT: BILL PROFIT */}
            {activeTab === 'profit' && (
                settings.enableBillWiseProfit ? <BillProfitReport /> :
                    <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        {t('reports.feature_disabled')}
                    </div>
            )}

            {/* TAB CONTENT: INVENTORY */}
            {activeTab === 'inventory' && (
                settings.enableStockReport ? <InventoryReport /> :
                    <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        {t('reports.feature_disabled')}
                    </div>
            )}

            {/* TAB CONTENT: DAY BOOK */}
            {activeTab === 'daybook' && (
                <DayBook />
            )}
        </div>
    );
};

export default Reports;

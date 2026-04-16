import React, { useState } from 'react';
import { useReportData, type DateRange } from './useReportData';
import StatsCard from '../../components/Reports/StatsCard';
import SalesChart from '../../components/Reports/SalesChart';
import VatReport from './VatReport';
import BillProfitReport from './BillProfitReport';
import InventoryReport from './InventoryReport';
import DayBook from './DayBook';
import { DollarSign, PieChart, Calendar, TrendingDown, FileText, LayoutDashboard, ShieldOff, TrendingUp, Package, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    } = useReportData(range, startDate, endDate);

    const getPeriodLabel = () => {
        if (startDate && endDate) {
            return `${format(new Date(startDate), 'dd MMM yvyy')} to ${format(new Date(endDate), 'dd MMM yyyy')}`;
        }
        return range.toUpperCase();
    };

    const handleExportExcel = () => {
        const periodLabel = getPeriodLabel();
        const summaryData = [{
            "Period": periodLabel,
            "Total Revenue": totalSales,
            "Gross Profit": grossProfit,
            "Net Profit": netProfit,
            "Expenses": totalExpenses,
            "Stock Value": currentStockValue
        }];

        const salesTrendData = salesByDate.map((d: any) => ({
            "Date": d.date,
            "Daily Sales": d.amount
        }));

        const wb = XLSX.utils.book_new();

        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Overview Summary");

        if (salesTrendData.length > 0) {
            const wsTrend = XLSX.utils.json_to_sheet(salesTrendData);
            XLSX.utils.book_append_sheet(wb, wsTrend, "Sales Trend");
        }

        XLSX.writeFile(wb, `Business_Overview_${periodLabel.replace(/ /g, '_')}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const periodLabel = getPeriodLabel();
        const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');

        // Safe formatter to prevent Arabic/Unicode symbols from garbling in jsPDF base fonts
        const safeCurrency = (amount: number) => {
            return Number(amount).toLocaleString('en-US', {
                minimumFractionDigits: settings.decimals,
                maximumFractionDigits: settings.decimals
            });
        };

        doc.setFontSize(22);
        // Clean business name of potential right-to-left or unicode chars if causing issues, but mostly currency symbol fails
        doc.text(businessDetails.businessName || 'Business Overview Report', 14, 20);
        doc.setFontSize(11);
        doc.text(`Period: ${periodLabel}`, 14, 28);
        doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 34);

        autoTable(doc, {
            head: [['Metric', 'Amount']],
            body: [
                ['Total Revenue', safeCurrency(totalSales)],
                ['Gross Profit', safeCurrency(grossProfit)],
                ['Net Profit', safeCurrency(netProfit)],
                ['Total Expenses', safeCurrency(totalExpenses)],
                ['Current Stock Value', safeCurrency(currentStockValue)],
            ],
            startY: 45,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 11, cellPadding: 5 }
        });

        if (salesByDate.length > 0) {
            const currentY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.text('Daily Sales Trend', 14, currentY);

            autoTable(doc, {
                head: [['Date', 'Sales Amount']],
                body: salesByDate.map((d: any) => [d.date, safeCurrency(d.amount)]),
                startY: currentY + 5,
                theme: 'grid',
                headStyles: { fillColor: [100, 116, 139], textColor: 255 },
                styles: { fontSize: 10 }
            });
        }

        doc.save(`Business_Overview_${periodLabel.replace(/ /g, '_')}.pdf`);
    };

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
            {/* Top Header Bar - Premium Glass styling */}
            <div className="bg-white/90 backdrop-blur-xl dark:bg-slate-800/95 rounded-3xl border border-white/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-none p-5 relative overflow-hidden">
                {/* Decorative header glow */}
                <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
                
                <div className="flex flex-col gap-5 relative z-10">
                    {/* Top Row: Title & Exports */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <h1 className="text-2xl font-bold dark:text-white flex items-center gap-3 shrink-0">
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800/50">
                                <LayoutDashboard size={24} strokeWidth={2.5} />
                            </div>
                            {t('reports.title')}
                        </h1>
                        
                        {/* Export Buttons */}
                        {activeTab === 'overview' && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportExcel}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all font-semibold text-sm shadow-sm"
                                    title="Export to Excel"
                                >
                                    <FileSpreadsheet size={16} strokeWidth={2.5} /> Excel
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all font-semibold text-sm shadow-sm"
                                    title="Export to PDF"
                                >
                                    <FileText size={16} strokeWidth={2.5} /> PDF
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-700/50 w-full" />

                    {/* Bottom Row: Navigation Tabs & Filters */}
                    <div className="flex flex-col 2xl:flex-row justify-between 2xl:items-center gap-5">
                        {/* Navigation Tabs */}
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { id: 'overview', icon: LayoutDashboard, label: t('reports.overview') },
                                { id: 'daybook', icon: Calendar, label: t('reports.day_book') },
                                { id: 'profit', icon: TrendingUp, label: t('reports.bill_wise_profit') },
                                { id: 'inventory', icon: Package, label: t('reports.inventory_report') },
                                { id: 'vat', icon: FileText, label: t('reports.vat_report') },
                            ].map(({ id, icon: Icon, label }) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id as typeof activeTab)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${activeTab === id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                                        : 'bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    <Icon size={16} strokeWidth={2.5} />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Date Filter */}
                        {activeTab === 'overview' && (
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
                                    {(['today', 'week', 'month', 'year'] as DateRange[]).map((r: any) => (
                                        <button
                                            key={r}
                                            onClick={() => { setRange(r); setStartDate(''); setEndDate(''); }}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${range === r && !startDate
                                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                        >
                                            {t(`reports.range_${r}`)}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 rounded-xl p-1.5 px-3 border border-slate-200/50 dark:border-slate-800">
                                    <Calendar size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                                    <input
                                        type="datetime-local"
                                        value={startDate}
                                        onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
                                        className="bg-transparent border-0 p-0 text-xs w-[130px] focus:ring-0 text-slate-700 dark:text-slate-300 font-medium dark:[color-scheme:dark]"
                                    />
                                    <span className="text-slate-400 font-bold px-1">→</span>
                                    <input
                                        type="datetime-local"
                                        value={endDate}
                                        onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
                                        className="bg-transparent border-0 p-0 text-xs w-[130px] focus:ring-0 text-slate-700 dark:text-slate-300 font-medium dark:[color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: '50ms' }}>
                            <StatsCard
                                title={t('reports.total_revenue')}
                                value={formatCurrency(totalSales)}
                                icon={DollarSign}
                                color="blue"
                                trendType="neutral"
                            />
                        </div>
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: '100ms' }}>
                            <StatsCard
                                title={t('reports.gross_profit')}
                                value={formatCurrency(grossProfit)}
                                icon={TrendingUp}
                                color="purple"
                                trendType="neutral"
                            />
                        </div>
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: '150ms' }}>
                            <StatsCard
                                title={t('reports.net_profit')}
                                value={formatCurrency(netProfit)}
                                icon={PieChart}
                                color="green"
                                trendType="neutral"
                            />
                        </div>
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: '200ms' }}>
                            <StatsCard
                                title={t('reports.expenses')}
                                value={formatCurrency(totalExpenses)}
                                icon={TrendingDown}
                                color="red"
                                trendType="neutral"
                            />
                        </div>
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: '250ms' }}>
                            <StatsCard
                                title={t('reports.stock_value')}
                                value={formatCurrency(currentStockValue)}
                                icon={Package}
                                color="purple"
                                trendType="neutral"
                            />
                        </div>
                    </div>

                    {/* Main Chart */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both" style={{ animationDelay: '300ms' }}>
                        <div className="relative bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden group">
                            {/* Decorative ambient glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            
                            <div className="flex items-center gap-3 mb-8 relative z-10">
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                    <Calendar size={22} strokeWidth={2.5} />
                                </div>
                                <h3 className="font-bold text-xl dark:text-white tracking-tight">{t('reports.sales_trend')}</h3>
                            </div>
                            <div className="relative z-10">
                                <SalesChart data={salesByDate} />
                            </div>
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

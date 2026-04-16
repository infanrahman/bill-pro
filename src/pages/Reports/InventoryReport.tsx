import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInventoryReport, type ReportMode, type DateRange } from './useInventoryReport';
import { PieChart, Calendar, ArrowLeftRight, Printer } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import StockSummary from './StockSummary';
import ItemPerformance from './ItemPerformance';
import { printContent } from '../../services/printerService';
import { generateGenericReportHTML } from '../../services/reportHTMLGenerator';

const InventoryReport: React.FC = () => {
    const { t } = useTranslation();
    const { formatCurrency } = useSettings();
    const [mode, setMode] = useState<ReportMode>('summary');
    const [range, setRange] = useState<DateRange>('week');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const activeRange = (startDate && endDate) ? 'custom' : range;

    const { data, loading, totals } = useInventoryReport(mode, activeRange, startDate, endDate);

    // Ranges are only needed for Performance mode
    const ranges: { id: DateRange; label: string }[] = [
        { id: 'today', label: t('reports.period_daily') },
        { id: 'week', label: t('reports.period_weekly') },
        { id: 'month', label: t('reports.period_monthly') },
        { id: 'year', label: t('reports.period_yearly') },
    ];

    const handleRangeChange = (r: DateRange) => {
        setRange(r);
        setStartDate('');
        setEndDate('');
    };

    const handlePrint = async () => {
        const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');
        const savedConfig = localStorage.getItem('printerConfig');
        const config = savedConfig ? JSON.parse(savedConfig) : {};

        let columns: any[] = [];
        let totalsData: any[] = [];

        if (mode === 'summary') {
            columns = [
                { header: 'Item Name', accessor: 'name', width: '40%' },
                { header: 'Category', accessor: 'category', width: '20%' },
                { header: 'Stock Qty', accessor: 'stockQuantity', align: 'right', width: '20%' },
                { header: 'Stock Value', accessor: (row: any) => formatCurrency(row.stockValue), align: 'right', width: '20%' },
            ];
            totalsData = [
                { label: 'Total Stock Value', value: formatCurrency(totals?.totalCostValue || 0) }
            ];
        } else {
            columns = [
                { header: 'Item Name', accessor: 'name', width: '30%' },
                { header: 'Qty Sold', accessor: 'soldQuantity', align: 'right', width: '15%' },
                { header: 'Revenue', accessor: (row: any) => formatCurrency(row.revenue), align: 'right', width: '20%' },
                { header: 'Profit', accessor: (row: any) => formatCurrency(row.profit), align: 'right', width: '20%' },
                { header: 'Margin', accessor: (row: any) => row.margin + '%', align: 'right', width: '15%' },
            ];
            totalsData = [
                { label: 'Total Revenue', value: formatCurrency(totals?.totalRevenue || 0) },
                { label: 'Total Profit', value: formatCurrency(totals?.totalProfit || 0), color: 'green' }
            ];
        }

        const html = generateGenericReportHTML({
            title: mode === 'summary' ? t('reports.stock_summary') : t('reports.item_performance'),
            period: mode === 'summary' ? 'Current Stock' : (startDate && endDate ? `${startDate} to ${endDate}` : range.toUpperCase()),
            columns,
            data,
            totals: totalsData,
            businessRaw: businessDetails
        });

        await printContent(html, {
            selectedPrinter: config.regular?.printerName,
            silent: config.enableSilentPrint ?? true,
            pageSize: 'a4',
            copies: 1
        });
    };

    return (
        <div className="space-y-6">
            {/* Header / Sub-Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('summary')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'summary'
                            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <PieChart size={16} />
                        {t('reports.stock_summary')}
                    </button>
                    <button
                        onClick={() => setMode('performance')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'performance'
                            ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <ArrowLeftRight size={16} />
                        {t('reports.item_performance')}
                    </button>
                </div>

                {/* Date Filter (Only for Performance) */}
                {mode === 'performance' && (
                    <div className="flex flex-col md:flex-row gap-3 animate-in fade-in">
                        <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex">
                            {ranges.map((r: any) => (
                                <button
                                    key={r.id}
                                    onClick={() => handleRangeChange(r.id)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${range === r.id && !startDate
                                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg px-2">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
                                className="bg-transparent border-0 p-0 text-sm w-40 focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
                                className="bg-transparent border-0 p-0 text-sm w-40 focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                        title="Print"
                    >
                        <Printer size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {mode === 'summary' && <StockSummary data={data} loading={loading} totals={totals} />}
            {mode === 'performance' && <ItemPerformance data={data} loading={loading} totals={totals} />}

        </div >
    );
};

export default InventoryReport;

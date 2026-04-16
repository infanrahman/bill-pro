import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBillProfitData, type DateRange } from './useBillProfitData';
import { format } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';
import { TrendingUp, TrendingDown, DollarSign, Calendar, FileText, Printer } from 'lucide-react';
import StatsCard from '../../components/Reports/StatsCard';
import { printContent } from '../../services/printerService';
import { generateGenericReportHTML } from '../../services/reportHTMLGenerator';

const BillProfitReport: React.FC = () => {
    const { t } = useTranslation();
    const { formatCurrency } = useSettings();
    const [range, setRange] = useState<DateRange>('week');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const activeRange = (startDate && endDate) ? 'custom' : range;

    const { data, loading, totals } = useBillProfitData(activeRange, startDate, endDate);

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

        const html = generateGenericReportHTML({
            title: t('reports.bill_wise_profit'),
            period: startDate && endDate ? `${startDate} to ${endDate}` : range.toUpperCase(),
            columns: [
                { header: 'Date', accessor: (row) => format(row.date, 'dd MMM yyyy HH:mm'), width: '15%' },
                { header: 'Invoice No', accessor: 'invoiceNumber', width: '15%' },
                { header: 'Customer', accessor: 'customerName', width: '20%' },
                { header: 'Net Sales', accessor: (row) => formatCurrency(row.netSales), align: 'right', width: '15%' },
                { header: 'Cost', accessor: (row) => formatCurrency(row.costAmount), align: 'right', width: '15%' },
                { header: 'Profit', accessor: (row) => formatCurrency(row.profit), align: 'right', width: '10%' },
                { header: 'Margin', accessor: (row) => row.marginPercent.toFixed(1) + '%', align: 'right', width: '10%' }
            ],
            data: data,
            totals: [
                { label: 'Total Sales', value: formatCurrency(totals.sales) },
                { label: 'Total Cost', value: formatCurrency(totals.cost) },
                { label: 'Total Profit', value: formatCurrency(totals.profit), color: totals.profit >= 0 ? '#16a34a' : '#dc2626' }
            ],
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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                    <FileText className="text-blue-600" size={24} />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t('reports.bill_wise_profit')}</h2>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
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
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title={t('reports.net_sales')}
                    value={formatCurrency(totals.sales)}
                    icon={DollarSign}
                    color="blue"
                    trendType="neutral"
                />
                <StatsCard
                    title={t('reports.total_cost')}
                    value={formatCurrency(totals.cost)}
                    icon={TrendingDown}
                    color="purple"
                    trendType="neutral"
                />
                <StatsCard
                    title={t('reports.total_profit')}
                    value={formatCurrency(totals.profit)}
                    icon={TrendingUp}
                    color={totals.profit >= 0 ? "green" : "red"}
                    trendType="neutral"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 dark:text-white">{t('reports.transaction_details')}</h3>
                    <div className="text-sm text-slate-500">{data.length} {t('common.records_found')}</div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3">{t('reports.date')}</th>
                                <th className="px-4 py-3">{t('reports.invoice_no')}</th>
                                <th className="px-4 py-3">{t('reports.customer')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.net_sales')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.cost')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.profit')}</th>
                                <th className="px-4 py-3 text-right">{t('reports.margin')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                            {t('common.loading')}
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                        {t('reports.no_records')}
                                    </td>
                                </tr>
                            ) : (
                                data.map((row: any) => (
                                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                            {format(row.date, 'dd MMM yyyy')}
                                            <div className="text-xs text-slate-400">{format(row.date, 'HH:mm')}</div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                                            {row.invoiceNumber}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            {row.customerName}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                            {formatCurrency(row.netSales)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                                            {formatCurrency(row.costAmount)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${row.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                            {formatCurrency(row.profit)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${row.marginPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                            {row.marginPercent.toFixed(1)}%
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {/* Footer Totals */}
                        {!loading && data.length > 0 && (
                            <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-bold text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-600">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-right">{t('common.total')}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(totals.sales)}</td>
                                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{formatCurrency(totals.cost)}</td>
                                    <td className={`px-4 py-3 text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(totals.profit)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {totals.sales !== 0 ? ((totals.profit / totals.sales) * 100).toFixed(1) : '0.0'}%
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BillProfitReport;

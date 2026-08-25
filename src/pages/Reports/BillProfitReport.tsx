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
 period: startDate && endDate ?`${startDate} to ${endDate}`: range.toUpperCase(),
 columns: [
 { header: 'Date', accessor: (row) => format(row.date, 'dd MMM yyyy HH:mm'), width: '15%' },
 { header: 'Invoice No', accessor: 'invoiceNumber', width: '15%' },
 { header: 'Customer', accessor: 'customerName', width: '20%' },
 { header: 'Net Sales', accessor: (row) => formatCurrency(row.netSales), align: 'right', width: '15%' },
 { header: 'Cost', accessor: (row) => formatCurrency(row.costAmount), align: 'right', width: '15%' },
 { header: 'Profit', accessor: (row) => formatCurrency(row.profit), align: 'right', width: '10%' },
 { header: 'Margin', accessor: (row) => (Number(row.marginPercent) || 0).toFixed(1) + '%', align: 'right', width: '10%' }
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
 <div className="space-y-6 fade-in">
 {/* Header Controls */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
 <div className="flex items-center gap-2">
 <FileText className="text-slate-900 dark:text-white" size={24} />
 <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t('reports.bill_wise_profit')}</h2>
 </div>

 <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
 <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex overflow-x-auto custom-scrollbar w-full md:w-auto">
 {ranges.map((r: any) => (
 <button type="button"
 key={r.id}
 onClick={() => handleRangeChange(r.id)}
 className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap shrink-0 ${range === r.id && !startDate
 ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-300'
 }`}
 >
 {r.label}
 </button>
 ))}
 </div>

 <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-2 rounded-lg w-full md:w-auto">
 <Calendar size={16} className="text-slate-600 shrink-0 hidden sm:block"/>
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <input
 type="datetime-local"
 value={startDate}
 onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-sm w-full md:w-36 focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 <span className="text-slate-600 shrink-0">-</span>
 <input
 type="datetime-local"
 value={endDate}
 onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-sm w-full md:w-36 focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 </div>
 </div>

 <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
 <button type="button"
 onClick={handlePrint}
 className="flex items-center justify-center gap-2 p-3 w-full md:w-auto md:p-2 bg-indigo-600 md:bg-transparent text-white md:text-slate-900 dark:text-white md:hover:bg-slate-100 dark:md:hover:bg-slate-800 rounded-lg border border-transparent md:hover:border-slate-300 dark:md:hover:border-slate-600"
 title="Print"
 >
 <Printer size={20} />
 <span className="md:hidden font-medium">Print Report</span>
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
 color={totals.profit >= 0 ?"green":"red"}
 trendType="neutral"
 />
 </div>

 {/* Table */}
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
 <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
 <h3 className="font-semibold text-slate-800 dark:text-white">{t('reports.transaction_details')}</h3>
 <div className="text-sm text-slate-700">{data.length} {t('common.records_found')}</div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium border-b border-slate-100 dark:border-slate-700">
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
 <td colSpan={7} className="px-4 py-8 text-center text-slate-700">
 <div className="flex justify-center items-center gap-2">
 <div className="w-4 h-4 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full"></div>
 {t('common.loading')}
 </div>
 </td>
 </tr>
) : data.length === 0 ? (
 <tr>
 <td colSpan={7} className="px-4 py-8 text-center text-slate-700">
 {t('reports.no_records')}
 </td>
 </tr>
) : (
 data.map((row: any) => (
 <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
 <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
 {format(row.date, 'dd MMM yyyy')}
 <div className="text-xs text-slate-600">{format(row.date, 'HH:mm')}</div>
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
 <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
 {formatCurrency(row.costAmount)}
 </td>
 <td className={`px-4 py-3 text-right font-bold ${row.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
 {formatCurrency(row.profit)}
 </td>
 <td className={`px-4 py-3 text-right font-medium ${(row.marginPercent || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
 {(Number(row.marginPercent) || 0).toFixed(1)}%
 </td>
 </tr>
))
)}
 </tbody>
 {/* Footer Totals */}
 {!loading && data.length > 0 && (
 <tfoot className="bg-slate-50 dark:bg-slate-700 font-bold text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-600">
 <tr>
 <td colSpan={3} className="px-4 py-3 text-right">{t('common.total')}</td>
 <td className="px-4 py-3 text-right">{formatCurrency(totals.sales)}</td>
 <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(totals.cost)}</td>
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

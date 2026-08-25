import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInventoryReport, type ReportMode, type DateRange } from './useInventoryReport';
import { PieChart, Calendar, ArrowLeftRight, Printer, Sparkles, ArrowRight, Download, FileText } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import StockSummary from './StockSummary';
import ItemPerformance from './ItemPerformance';
import { printContent } from '../../services/printerService';
import { generateGenericReportHTML } from '../../services/reportHTMLGenerator';
import clsx from 'clsx';

const InventoryReport: React.FC = () => {
 const { t } = useTranslation();
 const { formatCurrency } = useSettings();
 const [mode, setMode] = useState<ReportMode>('summary');
 const [range, setRange] = useState<DateRange>('week');
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');

 const activeRange = (startDate && endDate) ? 'custom' : range;

 const { data, loading, totals } = useInventoryReport(mode, activeRange, startDate, endDate);

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
 period: mode === 'summary' ? 'Current Stock' : (startDate && endDate ?`${startDate} to ${endDate}`: range.toUpperCase()),
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
 <div className="space-y-6 md:space-y-8 fade-in slide-in-from-bottom-4">
 {/* Premium Header Controls */}
 <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden group">
 
 
 <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 md:gap-8 relative z-10">
 <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-6">
 <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 md:p-1.5 rounded-lg md:rounded-xl border border-slate-200/50 dark:border-slate-800/50 overflow-x-auto custom-scrollbar">
 <button type="button"
 onClick={() => setMode('summary')}
 className={clsx(
 "flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded-md md:rounded-xl text-[10px] md:text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 flex-1 md:flex-none",
 mode === 'summary'
 ? 'bg-white text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
 )}
 >
 <PieChart size={16} className="md:w-[18px] md:h-[18px]" />
 {t('reports.stock_summary')}
 </button>
 <button type="button"
 onClick={() => setMode('performance')}
 className={clsx(
 "flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded-md md:rounded-xl text-[10px] md:text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 flex-1 md:flex-none",
 mode === 'performance'
 ? 'bg-white text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
 )}
 >
 <ArrowLeftRight size={16} className="md:w-[18px] md:h-[18px]" />
 {t('reports.item_performance')}
 </button>
 </div>

 {mode === 'performance' && (
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 fade-in zoom-in w-full md:w-auto">
 <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg md:rounded-xl border border-slate-200/50 dark:border-slate-800 overflow-x-auto custom-scrollbar">
 {(['today', 'week', 'month', 'year'] as DateRange[]).map((r: any) => (
 <button type="button"
 key={r}
 onClick={() => { setRange(r); setStartDate(''); setEndDate(''); }}
 className={clsx(
 "px-3 md:px-4 py-2 text-[9px] font-semibold uppercase tracking-wider rounded-md md:rounded-lg whitespace-nowrap shrink-0 flex-1 sm:flex-none text-center",
 range === r && !startDate
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-200'
 )}
 >
 {t(`reports.range_${r}`)}
 </button>
 ))}
 </div>

 <div className="flex items-center gap-2 md:gap-4 bg-slate-50 dark:bg-slate-900 rounded-lg md:rounded-xl p-2 px-3 md:px-4 border border-slate-200/50 dark:border-slate-800">
 <Calendar size={16} className="text-slate-900 dark:text-white shrink-0 hidden sm:block"/>
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <input
 type="datetime-local"
 value={startDate}
 onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-[10px] font-semibold uppercase tracking-tight w-full md:w-[130px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 <ArrowRight size={12} className="text-slate-300 shrink-0"/>
 <input
 type="datetime-local"
 value={endDate}
 onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-[10px] font-semibold uppercase tracking-tight w-full md:w-[130px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 </div>
 </div>
 </div>
 )}
 </div>

 <div className="flex gap-2 w-full xl:w-auto">
 <button type="button"
 
 
 onClick={handlePrint} 
 className="flex items-center justify-center gap-2 p-3 md:p-4 w-full xl:w-auto bg-indigo-600 xl:bg-white dark:xl:bg-slate-800 text-white xl:text-slate-900 dark:text-white rounded-xl md:rounded-2xl border border-transparent xl:border-slate-200 dark:xl:border-slate-700"
 >
 <Printer size={20} className="md:w-[24px] md:h-[24px]" />
 <span className="xl:hidden font-medium text-sm">Print Report</span>
 </button>
 </div>
 </div>
 </div>

 {/* Content Area */}
 <>
 <div
 key={mode}
 
 
 
 
 >
 {mode === 'summary' && <StockSummary data={data} loading={loading} totals={totals} />}
 {mode === 'performance' && <ItemPerformance data={data} loading={loading} totals={totals} />}
 </div>
 </>
 </div >
);
};

export default InventoryReport;

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
 <div className="space-y-8 fade-in slide-in-from-bottom-4">
 {/* Premium Header Controls */}
 <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden group">
 
 
 <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-8 relative z-10">
 <div className="flex flex-col md:flex-row items-center gap-6">
 <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
 <button type="button"
 onClick={() => setMode('summary')}
 className={clsx(
"flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider",
 mode === 'summary'
 ? 'bg-white text-slate-900 dark:text-white '
 : 'text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
)}
 >
 <PieChart size={18} />
 {t('reports.stock_summary')}
 </button>
 <button type="button"
 onClick={() => setMode('performance')}
 className={clsx(
"flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider",
 mode === 'performance'
 ? 'bg-white text-slate-900 dark:text-white '
 : 'text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
)}
 >
 <ArrowLeftRight size={18} />
 {t('reports.item_performance')}
 </button>
 </div>

 {mode === 'performance' && (
 <div className="flex flex-wrap items-center gap-3 fade-in zoom-in">
 <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
 {(['today', 'week', 'month', 'year'] as DateRange[]).map((r: any) => (
 <button type="button"
 key={r}
 onClick={() => { setRange(r); setStartDate(''); setEndDate(''); }}
 className={clsx(
"px-4 py-2 text-[9px] font-semibold uppercase tracking-wider rounded-lg",
 range === r && !startDate
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white dark:text-white '
 : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-200'
)}
 >
 {t(`reports.range_${r}`)}
 </button>
))}
 </div>

 <div className="flex items-center gap-4 bg-white dark:bg-slate-900 rounded-xl p-2 px-4 border border-slate-200/50 dark:border-slate-800">
 <Calendar size={16} className="text-slate-900 dark:text-white shrink-0"/>
 <div className="flex items-center gap-3">
 <input
 type="datetime-local"
 value={startDate}
 onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-[10px] font-semibold uppercase tracking-tight w-[130px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 <ArrowRight size={12} className="text-slate-300"/>
 <input
 type="datetime-local"
 value={endDate}
 onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-[10px] font-semibold uppercase tracking-tight w-[130px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 </div>
 </div>
 </div>
)}
 </div>

 <div className="flex gap-2">
 <button type="button"
 
 
 onClick={handlePrint} 
 className="p-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border border-white dark:border-slate-700"
 >
 <Printer size={20} />
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

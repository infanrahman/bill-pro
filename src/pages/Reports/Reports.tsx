import React, { useState } from 'react';
import { useReportData, type DateRange } from './useReportData';
import StatsCard from '../../components/Reports/StatsCard';
import SalesChart from '../../components/Reports/SalesChart';
import VatReport from './VatReport';
import BillProfitReport from './BillProfitReport';
import InventoryReport from './InventoryReport';
import DayBook from './DayBook';
import { DollarSign, PieChart, Calendar, TrendingDown, FileText, LayoutDashboard, ShieldOff, TrendingUp, Package, FileSpreadsheet, Download, Sparkles, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import clsx from 'clsx';

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
    try {
      if (startDate && endDate) {
        const d1 = new Date(startDate);
        const d2 = new Date(endDate);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          return `${format(d1, 'dd MMM yyyy')} to ${format(d2, 'dd MMM yyyy')}`;
        }
      }
    } catch {}
    return (range || 'Custom').toUpperCase();
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
 XLSX.utils.book_append_sheet(wb, wsSummary,"Overview Summary");

 if (salesTrendData.length > 0) {
 const wsTrend = XLSX.utils.json_to_sheet(salesTrendData);
 XLSX.utils.book_append_sheet(wb, wsTrend,"Sales Trend");
 }

 XLSX.writeFile(wb,`Business_Overview_${periodLabel.replace(/ /g, '_')}.xlsx`);
 };

 const handleExportPDF = () => {
 const doc = new jsPDF();
 const periodLabel = getPeriodLabel();
 const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');

 const safeCurrency = (amount: number) => {
 return Number(amount).toLocaleString('en-US', {
 minimumFractionDigits: settings.decimals,
 maximumFractionDigits: settings.decimals
 });
 };

 doc.setFontSize(22);
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
 <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-4 md:p-8 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
 <ShieldOff size={48} className="text-slate-300 mb-4"/>
 <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
 <p className="text-slate-700">{t('reports.access_denied_msg')}</p>
 </div>
);
 }

 const tabs = [
 { id: 'overview', icon: LayoutDashboard, label: t('reports.overview') },
 { id: 'daybook', icon: Calendar, label: t('reports.day_book') },
 { id: 'profit', icon: TrendingUp, label: t('reports.bill_wise_profit') },
 { id: 'inventory', icon: Package, label: t('reports.inventory_report') },
 { id: 'vat', icon: FileText, label: t('reports.vat_report') },
 ];

 return (
 <div className="space-y-6 md:space-y-8 pb-10">
 {/* Premium Header Bar */}
 <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden group">
 {/* Decorative background glow */}
 
 
 <div className="flex flex-col gap-6 md:gap-8 relative z-10">
 <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 md:gap-6">
 <div>
 <h1 className="text-2xl md:text-4xl font-semibold dark:text-white flex items-center gap-3 md:gap-4 tracking-tight uppercase">
 <div className="p-3 md:p-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl md:rounded-2xl shrink-0">
 <LayoutDashboard size={24} className="md:w-8 md:h-8" strokeWidth={2.5} />
 </div>
 <span>{t('reports.title')}</span>
 </h1>
 <p className="text-slate-700 dark:text-slate-300 font-bold mt-2 ml-1 md:ml-2 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-2">
 <Sparkles size={14} className="text-amber-500"/>
 {t('reports.insights_and_analytics')}
 </p>
 </div>
 
 {activeTab === 'overview' && (
 <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto">
 <button type="button"
 
 
 onClick={handleExportExcel}
 className="flex-1 sm:flex-none flex justify-center items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl md:rounded-2xl font-semibold text-xs uppercase tracking-wider border border-emerald-500/20 group"
 >
 <FileSpreadsheet size={18} strokeWidth={2.5} className=""/> Excel
 </button>
 <button type="button"
 
 
 onClick={handleExportPDF}
 className="flex-1 sm:flex-none flex justify-center items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl md:rounded-2xl font-semibold text-xs uppercase tracking-wider border border-rose-500/20 group"
 >
 <FileText size={18} strokeWidth={2.5} className=""/> PDF
 </button>
 </div>
 )}
 </div>

 <div className="h-px from-slate-200 dark:from-slate-700/50 via-transparent to-transparent w-full"/>

 <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 md:gap-8">
 {/* Custom Tab Navigation */}
 <div className="flex items-center gap-2 md:gap-3 bg-slate-100 dark:bg-slate-900 p-2 rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-x-auto custom-scrollbar w-full xl:w-auto">
 {tabs.map(({ id, icon: Icon, label }) => (
 <button type="button"
 key={id}
 onClick={() => setActiveTab(id as typeof activeTab)}
 className={clsx(
 "flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3.5 rounded-lg md:rounded-2xl text-[10px] md:text-xs font-semibold uppercase tracking-wider relative overflow-hidden whitespace-nowrap shrink-0",
 activeTab === id
 ? 'bg-white text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
 )}
 >
 <Icon size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
 {label}
 {activeTab === id && (
 <div className="absolute inset-0 bg-slate-900/10 dark:bg-white/10 dark:bg-white/10"/>
 )}
 </button>
 ))}
 </div>

 {/* Premium Date Filters */}
 {activeTab === 'overview' && (
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full xl:w-auto">
 <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-slate-800 overflow-x-auto custom-scrollbar">
 {(['today', 'week', 'month', 'year'] as DateRange[]).map((r: any) => (
 <button type="button"
 key={r}
 onClick={() => { setRange(r); setStartDate(''); setEndDate(''); }}
 className={clsx(
 "px-4 md:px-5 py-2 md:py-2.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg md:rounded-xl whitespace-nowrap shrink-0",
 range === r && !startDate
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-200'
 )}
 >
 {t(`reports.range_${r}`)}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-3 md:gap-4 bg-slate-50 dark:bg-slate-900 rounded-xl md:rounded-2xl p-2 px-3 md:px-5 border border-slate-200/50 dark:border-slate-800 overflow-x-auto w-full md:w-auto">
 <Calendar size={18} className="text-slate-900 dark:text-white shrink-0 hidden sm:block"/>
 <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
 <input
 type="datetime-local"
 value={startDate}
 onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-[10px] md:text-xs font-semibold uppercase tracking-tight w-full md:w-[150px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 <ArrowRight size={14} className="text-slate-300 shrink-0"/>
 <input
 type="datetime-local"
 value={endDate}
 onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-[10px] md:text-xs font-semibold uppercase tracking-tight w-full md:w-[150px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 <>
 <div
 key={activeTab}
 
 
 
 
 >
 {activeTab === 'overview' && (
 <div className="space-y-8">
 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
 <StatsCard
 title={t('reports.total_revenue')}
 value={formatCurrency(totalSales)}
 icon={DollarSign}
 color="blue"
 trendType="neutral"
 />
 <StatsCard
 title={t('reports.gross_profit')}
 value={formatCurrency(grossProfit)}
 icon={TrendingUp}
 color="purple"
 trendType="neutral"
 />
 <StatsCard
 title={t('reports.net_profit')}
 value={formatCurrency(netProfit)}
 icon={PieChart}
 color="green"
 trendType="neutral"
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
 icon={Package}
 color="blue"
 trendType="neutral"
 />
 </div>

 {/* Main Chart Section */}
 <div className="bg-white dark:bg-slate-800 p-10 rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden group">
 
 
 <div className="flex items-center justify-between mb-10 relative z-10">
 <div className="flex items-center gap-4">
 <div className="p-4 bg-slate-900 dark:bg-white text-white rounded-xl border border-slate-900/20 dark:border-white/20">
 <Calendar size={28} strokeWidth={2.5} />
 </div>
 <div>
 <h3 className="font-semibold text-2xl dark:text-white tracking-tight uppercase">{t('reports.sales_trend')}</h3>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-1">{t('reports.historical_sales_performance')}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 font-semibold text-[10px] uppercase tracking-wider text-slate-700">
 <Download size={14} /> {t('common.export')}
 </div>
 </div>
 
 <div className="relative z-10 h-[450px]">
 <SalesChart data={salesByDate} />
 </div>
 </div>
 </div>
)}

 {activeTab === 'vat' && <VatReport />}

 {activeTab === 'profit' && (
 settings.enableBillWiseProfit ? <BillProfitReport /> :
 <div className="p-16 text-center text-slate-600 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/50 font-semibold uppercase tracking-wider text-xs">
 <ShieldOff size={40} className="mx-auto mb-4 opacity-20"/>
 {t('reports.feature_disabled')}
 </div>
)}

 {activeTab === 'inventory' && (
 settings.enableStockReport ? <InventoryReport /> :
 <div className="p-16 text-center text-slate-600 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/50 font-semibold uppercase tracking-wider text-xs">
 <ShieldOff size={40} className="mx-auto mb-4 opacity-20"/>
 {t('reports.feature_disabled')}
 </div>
)}

 {activeTab === 'daybook' && <DayBook />}
 </div>
 </>
 </div>
);
};

export default Reports;

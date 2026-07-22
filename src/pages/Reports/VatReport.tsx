import React, { useState } from 'react';
import { printContent } from '../../services/printerService';
import { useTranslation } from 'react-i18next';
import { useVatReturnData, type VatPeriod } from './useVatReturnData';
import { useSettings } from '../../contexts/SettingsContext';
import { Calendar, Printer, TrendingUp, TrendingDown, DollarSign, FileSpreadsheet, FileText } from 'lucide-react';
import StatsCard from '../../components/Reports/StatsCard';
import { exportVatToPDF, exportVatToExcel } from '../../utils/vatExport';
import { generateVatReportA4, generateVatReportThermal } from './vatPrintTemplates';

const VatReport: React.FC = () => {
 const { t, i18n } = useTranslation();
 const { formatCurrency } = useSettings();
 const [period, setPeriod] = useState<VatPeriod>('monthly');
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const activePeriod = (startDate && endDate) ? 'custom' : period;

 const { data, loading } = useVatReturnData(activePeriod, startDate, endDate);
 const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');

 const periods: { id: VatPeriod; label: string }[] = [
 { id: 'daily', label: t('reports.period_daily') },
 { id: 'weekly', label: t('reports.period_weekly') },
 { id: 'monthly', label: t('reports.period_monthly') },
 { id: 'yearly', label: t('reports.period_yearly') },
 ];

 const handlePeriodChange = (p: VatPeriod) => {
 setPeriod(p);
 setStartDate('');
 setEndDate('');
 };

 const periodLabel = startDate && endDate
 ?`${startDate} to ${endDate}`
 : (periods.find(p => p.id === period)?.label || period.toUpperCase());



 const handlePrint = async () => {
 if (!data) return;
 const savedConfig = localStorage.getItem('printerConfig');
 const config = savedConfig ? JSON.parse(savedConfig) : {};
 const silent = config.enableSilentPrint ?? true;

 let html = '';
 let printerName = '';
 let pageSize: 'thermal' | 'a4' = 'a4';

 if (config.printerType === 'thermal') {
 html = generateVatReportThermal(data, periodLabel, businessDetails, t, i18n.language);
 printerName = config.thermal?.printerName || '';
 pageSize = 'thermal';
 } else {
 html = generateVatReportA4(data, periodLabel, businessDetails, t, i18n.language);
 printerName = config.regular?.printerName || '';
 pageSize = 'a4';
 }

 await printContent(html, {
 selectedPrinter: printerName,
 silent,
 pageSize,
 copies: 1
 });
 };

 const handleExportPDF = () => {
 if (data) {
 exportVatToPDF(data, periodLabel, businessDetails);
 }
 };

 const handleExportExcel = () => {
 if (data) {
 exportVatToExcel(data, periodLabel, businessDetails);
 }
 };

 if (!data) {
 if (loading) return <div className="p-12 text-center text-slate-700">{t('common.loading')}</div>;
 return null;
 }

 return (
 <div className={`space-y-6 fade-in ${loading ? 'opacity-50 pointer-events-none select-none' : ''}`}>
 {/* Controls */}
 <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
 <div className="flex flex-wrap gap-2 w-full md:w-auto">
 <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex">
 {periods.map((p: any) => (
 <button type="button"
 key={p.id}
 onClick={() => handlePeriodChange(p.id)}
 className={`px-3 py-1.5 rounded-md text-sm font-medium ${period === p.id && !startDate
 ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white '
 : 'text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-300'
 }`}
 >
 {p.label}
 </button>
))}
 </div>

 <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg px-2">
 <Calendar size={16} className="text-slate-600"/>
 <input
 type="datetime-local"
 value={startDate}
 onChange={(e) => { setStartDate(e.target.value); setPeriod('custom'); }}
 className="bg-transparent border-0 p-0 text-sm w-40 focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 <span className="text-slate-600">-</span>
 <input
 type="datetime-local"
 value={endDate}
 onChange={(e) => { setEndDate(e.target.value); setPeriod('custom'); }}
 className="bg-transparent border-0 p-0 text-sm w-40 focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 </div>
 </div>

 <div className="flex gap-2 w-full md:w-auto justify-end">
 <button type="button"
 onClick={handleExportExcel}
 className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
 title="Export to Excel"
 >
 <FileSpreadsheet size={18} />
 <span className="hidden md:inline">Excel</span>
 </button>
 <button type="button"
 onClick={handleExportPDF}
 className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
 title="Export to PDF"
 >
 <FileText size={18} />
 <span className="hidden md:inline">PDF</span>
 </button>
 <button type="button"
 onClick={handlePrint}
 className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
 >
 <Printer size={18} />
 {t('common.print')}
 </button>
 </div>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <StatsCard
 title={t('reports.net_sales_excl')}
 value={formatCurrency(data.net.sales.amount)}
 icon={TrendingUp}
 color="blue"
 trendType="neutral"
 />
 <StatsCard
 title={t('reports.net_purchase')}
 value={formatCurrency(data.net.purchases.amount)}
 icon={TrendingDown}
 color="purple"
 trendType="neutral"
 />
 <StatsCard
 title={t('reports.net_vat_period')}
 value={formatCurrency(data.net.vatPayable)}
 icon={DollarSign}
 color={data.net.vatPayable >= 0 ? 'green' : 'red'}
 trendType={data.net.vatPayable >= 0 ? 'up' : 'down'}
 />
 </div>

 {/* Detailed Tables */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

 {/* SALES SECTION */}
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
 <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
 <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
 <TrendingUp className="text-green-500"size={20} />
 {t('reports.vat_on_sales')}
 </h3>
 <span className="text-sm font-bold text-slate-700">{t('reports.vat')}</span>
 </div>
 <div className="p-0">
 <table className="w-full text-sm">
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
 <tr>
 <td className="p-4 text-slate-600 dark:text-slate-300">1. {t('reports.vat_sales_std')}</td>
 <td className="p-4 text-right font-medium dark:text-white">{formatCurrency(data.sales.standard.amount)}</td>
 <td className="p-4 text-right font-bold text-green-600 w-32">{formatCurrency(data.sales.standard.vat)}</td>
 </tr>
 <tr>
 <td className="p-4 text-slate-600 dark:text-slate-300">2. {t('reports.vat_sales_ret_std')}</td>
 <td className="p-4 text-right font-medium text-red-500">-{formatCurrency(data.sales.returnStandard.amount)}</td>
 <td className="p-4 text-right font-bold text-red-500">- {formatCurrency(data.sales.returnStandard.vat)}</td>
 </tr>
 <tr>
 <td className="p-4 text-slate-600 dark:text-slate-300">3. {t('reports.vat_sales_zero')}</td>
 <td className="p-4 text-right font-medium dark:text-white">{formatCurrency(data.sales.zero.amount)}</td>
 <td className="p-4 text-right text-slate-600">-</td>
 </tr>
 <tr className="bg-slate-50 dark:bg-slate-700 font-bold">
 <td className="p-4 dark:text-white">{t('reports.net_sales_excl')}</td>
 <td className="p-4 text-right dark:text-white">{formatCurrency(data.net.sales.amount)}</td>
 <td className="p-4 text-right text-green-700 dark:text-green-400">{formatCurrency(data.net.sales.vat)}</td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>

 {/* PURCHASES SECTION */}
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
 <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
 <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
 <TrendingDown className="text-orange-500"size={20} />
 {t('reports.vat_on_purchase')}
 </h3>
 <span className="text-sm font-bold text-slate-700">{t('reports.vat')}</span>
 </div>
 <div className="p-0">
 <table className="w-full text-sm">
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
 <tr>
 <td className="p-4 text-slate-600 dark:text-slate-300">5. {t('reports.vat_purchase_std')}</td>
 <td className="p-4 text-right font-medium dark:text-white">{formatCurrency(data.purchases.standard.amount)}</td>
 <td className="p-4 text-right font-bold text-orange-600 w-32">{formatCurrency(data.purchases.standard.vat)}</td>
 </tr>
 <tr>
 <td className="p-4 text-slate-600 dark:text-slate-300">6. {t('reports.vat_purchase_ret_std')}</td>
 <td className="p-4 text-right font-medium text-red-500">-{formatCurrency(data.purchases.returnStandard.amount)}</td>
 <td className="p-4 text-right font-bold text-red-500">- {formatCurrency(data.purchases.returnStandard.vat)}</td>
 </tr>
 <tr>
 <td className="p-4 text-slate-600 dark:text-slate-300">7. {t('reports.vat_purchase_zero')}</td>
 <td className="p-4 text-right font-medium dark:text-white">{formatCurrency(data.purchases.zero.amount)}</td>
 <td className="p-4 text-right text-slate-600">-</td>
 </tr>
 <tr className="bg-slate-50 dark:bg-slate-700 font-bold">
 <td className="p-4 dark:text-white">{t('reports.net_purchase')}</td>
 <td className="p-4 text-right dark:text-white">{formatCurrency(data.net.purchases.amount)}</td>
 <td className="p-4 text-right text-orange-700 dark:text-orange-400">{formatCurrency(data.net.purchases.vat)}</td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* Total Footer */}
 <div className="to-indigo-600 text-white rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
 <div>
 <h3 className="text-lg font-medium opacity-90">{t('reports.net_vat_period')}</h3>
 <p className="text-sm opacity-75">{t('reports.vat_payable_authority')}</p>
 </div>
 <div className="text-4xl font-bold font-mono">
 {formatCurrency(data.net.vatPayable)}
 </div>
 </div>

 <div className="mt-8 text-xs text-center text-slate-600">
 <p>{t('reports.generated_by')} • {t('reports.vat_report')}</p>
 </div>
 </div>
);
};

export default VatReport;

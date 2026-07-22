import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useDayBookData, type DayBookItem } from './useDayBookData';
import { useSettings } from '../../contexts/SettingsContext';
import { 
 Calendar, Download, TrendingUp, TrendingDown, 
 Wallet, ArrowUpRight, ArrowDownLeft, FileText, 
 Printer, Sparkles, Filter, MoreVertical, Search,
 ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printContent } from '../../services/printerService';
import { generateGenericReportHTML } from '../../services/reportHTMLGenerator';
import clsx from 'clsx';

const DayBook: React.FC = () => {
 const { t } = useTranslation();
 const { formatCurrency, settings } = useSettings();
 const [range, setRange] = useState<'today' | 'custom'>('today');
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');

 const { transactions, summary, loading } = useDayBookData(range, startDate, endDate);

 const handlePrint = async () => {
 const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');
 const savedConfig = localStorage.getItem('printerConfig');
 const config = savedConfig ? JSON.parse(savedConfig) : {};

 const html = generateGenericReportHTML({
 title: t('reports.day_book_title') ||"Day Book",
 period: startDate && endDate ?`${startDate} to ${endDate}`: range.toUpperCase(),
 columns: [
 { header: 'Time', accessor: (row) => format(row.date, 'HH:mm'), width: '10%' },
 { header: 'Type', accessor: (row) => row.type.toUpperCase(), width: '15%' },
 { header: 'Description', accessor: 'description', width: '35%' },
 { header: 'Mode', accessor: 'mode', width: '10%' },
 { header: 'Money In', accessor: (row) => row.moneyIn > 0 ? formatCurrency(row.moneyIn) : '-', align: 'right', width: '15%' },
 { header: 'Money Out', accessor: (row) => row.moneyOut > 0 ? formatCurrency(row.moneyOut) : '-', align: 'right', width: '15%' }
 ],
 data: transactions,
 totals: [
 { label: 'Total In', value: formatCurrency(summary.totalIn), color: '#16a34a' },
 { label: 'Total Out', value: formatCurrency(summary.totalOut), color: '#dc2626' },
 { label: 'Net Balance', value: formatCurrency(summary.balance) }
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

 const exportToExcel = () => {
 const data = transactions.map((t: any) => ({
 Date: format(t.date, 'yyyy-MM-dd HH:mm'),
 Type: t.type.toUpperCase(),
 Description: t.description,
 PaymentMode: t.mode,
 Credit: t.moneyIn > 0 ? t.moneyIn : '',
 Debit: t.moneyOut > 0 ? t.moneyOut : ''
 }));

 const ws = XLSX.utils.json_to_sheet(data);
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws,"DayBook");
 XLSX.writeFile(wb,`DayBook_${startDate || 'Today'}.xlsx`);
 };

 const exportToPDF = () => {
 const doc = new jsPDF();
 const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');
 const pageWidth = doc.internal.pageSize.width;

 const safeCurrency = (amount: number) => {
 return Number(amount).toLocaleString('en-US', {
 minimumFractionDigits: settings.decimals,
 maximumFractionDigits: settings.decimals
 });
 };

 let currentY = 20;

 if (businessDetails.logo) {
 try {
 doc.addImage(businessDetails.logo, 'PNG', 14, 10, 30, 30);
 currentY = 45;
 } catch (e) {
 console.error("Failed to add logo to PDF", e);
 }
 }

 doc.setFont('helvetica', 'bold');
 doc.setFontSize(22);
 doc.setTextColor(0, 0, 0);
 doc.text(businessDetails.shopName ||"Company Name", pageWidth / 2, currentY, { align: 'center' });
 currentY += 6;

 doc.setFontSize(10);
 doc.setFont('helvetica', 'normal');
 doc.setTextColor(100, 100, 100);
 if (businessDetails.address) {
 doc.text(businessDetails.address, pageWidth / 2, currentY, { align: 'center' });
 currentY += 5;
 }
 if (businessDetails.phone) {
 doc.text(`Phone: ${businessDetails.phone}`, pageWidth / 2, currentY, { align: 'center' });
 currentY += 5;
 }
 if (businessDetails.taxRegNo) {
 doc.setFont('helvetica', 'bold');
 doc.text(`TRN/VAT: ${businessDetails.taxRegNo}`, pageWidth / 2, currentY, { align: 'center' });
 currentY += 5;
 }

 currentY += 10;

 doc.setFont('helvetica', 'bold');
 doc.setFontSize(16);
 doc.setTextColor(0, 0, 0);
 const periodStr = startDate && endDate ?`${startDate} to ${endDate}`: range.toUpperCase();
 doc.text(`Day Book Report`, 14, currentY);
 
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(11);
 doc.setTextColor(100, 100, 100);
 doc.text(`Period: ${periodStr}`, 14, currentY + 6);
 
 currentY += 15;

 autoTable(doc, {
 startY: currentY,
 theme: 'plain',
 body: [
 [
`Total In:\n${safeCurrency(summary.totalIn)}`,
`Total Out:\n${safeCurrency(summary.totalOut)}`,
`Net Balance:\n${safeCurrency(summary.balance)}`
 ]
 ],
 styles: {
 fontSize: 12,
 font: 'helvetica',
 fontStyle: 'bold',
 halign: 'center',
 textColor: [0, 0, 0],
 cellPadding: 5,
 lineColor: [200, 200, 200],
 lineWidth: 0.1,
 },
 columnStyles: {
 0: { fillColor: [240, 253, 244] },
 1: { fillColor: [254, 242, 242] },
 2: { fillColor: [240, 249, 255] }
 }
 });

 // @ts-ignore
 currentY = doc.lastAutoTable.finalY + 10;

 const tableData = transactions.map((t: any) => [
 format(t.date, 'HH:mm'),
 t.type.toUpperCase(),
 t.description,
 t.mode,
 t.moneyIn > 0 ? safeCurrency(t.moneyIn) : '-',
 t.moneyOut > 0 ? safeCurrency(t.moneyOut) : '-'
 ]);

 autoTable(doc, {
 head: [['Time', 'Type', 'Description', 'Mode', 'Money In', 'Money Out']],
 body: tableData,
 startY: currentY,
 theme: 'grid',
 styles: { fontSize: 9, font: 'helvetica' },
 headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
 columnStyles: {
 4: { halign: 'right' },
 5: { halign: 'right' }
 }
 });

 doc.save(`DayBook_${startDate || 'Today'}.pdf`);
 };

 const getTypeColor = (type: DayBookItem['type']) => {
 switch (type) {
 case 'sale': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
 case 'receipt': return 'bg-slate-900 dark:bg-white text-white border-slate-900/20 dark:border-white/20';
 case 'purchase': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
 case 'expense': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
 case 'payment': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
 case 'return': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
 default: return 'bg-slate-500 text-slate-700 border-slate-500/20';
 }
 };

 return (
 <div className="space-y-8 fade-in slide-in-from-bottom-4">
 {/* Header & Controls */}
 <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden group">
 
 
 <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-8 relative z-10">
 <div className="flex items-center gap-4">
 <div className="p-4 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl">
 <Wallet size={32} />
 </div>
 <div>
 <h2 className="text-3xl font-semibold dark:text-white uppercase tracking-tight">
 {t('reports.day_book_title') ||"Transaction Journal"}
 </h2>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-1 flex items-center gap-2">
 <Sparkles size={12} className="text-amber-500"/>
 {t('reports.day_book_subtitle') ||"Real-time cash flow and transaction tracking"}
 </p>
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-4">
 <div className="flex items-center gap-4 bg-white dark:bg-slate-900 rounded-xl p-2 px-5 border border-slate-200/50 dark:border-slate-800">
 <Calendar size={18} className="text-slate-900 dark:text-white shrink-0"/>
 <div className="flex items-center gap-3">
 <input
 type="datetime-local"
 value={startDate}
 onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-xs font-semibold uppercase tracking-tight w-[150px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 <ArrowRight size={14} className="text-slate-300"/>
 <input
 type="datetime-local"
 value={endDate}
 onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
 className="bg-transparent border-0 p-0 text-xs font-semibold uppercase tracking-tight w-[150px] focus:ring-0 text-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
 />
 </div>
 </div>

 <div className="flex gap-2">
 <button type="button"onClick={handlePrint} className="p-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border border-white dark:border-slate-700"><Printer size={20} /></button>
 <button type="button"onClick={exportToPDF} className="p-4 bg-white dark:bg-slate-800 text-rose-500 rounded-2xl border border-white dark:border-slate-700"><FileText size={20} /></button>
 <button type="button"onClick={exportToExcel} className="p-4 bg-white dark:bg-slate-800 text-emerald-500 rounded-2xl border border-white dark:border-slate-700"><Download size={20} /></button>
 </div>
 </div>
 </div>
 </div>

 {/* Stats Ribbon */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {[
 { label: t('reports.money_in') ||"Money In", value: formatCurrency(summary.totalIn), icon: ArrowDownLeft, color: 'emerald' },
 { label: t('reports.money_out') ||"Money Out", value: formatCurrency(summary.totalOut), icon: ArrowUpRight, color: 'rose' },
 { label: t('reports.net_balance') ||"Net Balance", value: formatCurrency(summary.balance), icon: Wallet, color: 'blue' },
 { label: t('reports.est_daily_profit') ||"Est. Profit", value: formatCurrency(summary.dailyProfit), icon: TrendingUp, color: 'purple' }
 ].map((stat, i) => (
 <div
 key={i}
 
 
 
 className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center gap-6"
 >
 <div className={clsx(
"p-4 rounded-2xl text-white",
 stat.color === 'emerald' ?"bg-emerald-500":
 stat.color === 'rose' ?"bg-rose-500":
 stat.color === 'blue' ?"bg-slate-900 dark:bg-white":"bg-purple-500"
)}>
 <stat.icon size={24} />
 </div>
 <div>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{stat.label}</p>
 <p className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
 </div>
 </div>
))}
 </div>

 {/* Transactions Table */}
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-white/50 dark:border-slate-700/30 overflow-hidden">
 <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
 <div className="flex items-center gap-3">
 <Search size={18} className="text-slate-600"/>
 <h3 className="text-sm font-semibold dark:text-white uppercase tracking-wider">{t('reports.transactions')}</h3>
 </div>
 <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
 {transactions.length} Records
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left whitespace-nowrap">
 <thead>
 <tr className="bg-slate-50 dark:bg-slate-900">
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Time</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Type</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Description</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Mode</th>
 <th className="p-6 text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right">Amount</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
 {loading ? (
 Array.from({ length: 5 }).map((_, i) => (
 <tr key={i} className="">
 <td colSpan={5} className="p-6"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-full"/></td>
 </tr>
))
) : transactions.length === 0 ? (
 <tr>
 <td colSpan={5} className="p-20 text-center">
 <Wallet size={48} className="mx-auto mb-4 text-slate-300 opacity-50"/>
 <p className="text-slate-700 font-bold uppercase text-[10px] tracking-wider">{t('reports.no_transactions_for_date')}</p>
 </td>
 </tr>
) : (
 transactions.map((item: any, idx) => (
 <tr 
 key={item.id}
 
 
 
 className="hover:bg-slate-50 dark:hover:bg-slate-700 group"
 >
 <td className="p-6">
 <span className="font-mono text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
 {format(item.date, 'HH:mm')}
 </span>
 </td>
 <td className="p-6">
 <span className={clsx(
"px-3 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-wider border",
 getTypeColor(item.type)
)}>
 {item.type}
 </span>
 </td>
 <td className="p-6">
 <p className="font-semibold dark:text-white uppercase tracking-tight line-clamp-1">{item.description}</p>
 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mt-1">Ref: {item.id.slice(-8).toUpperCase()}</p>
 </td>
 <td className="p-6">
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-slate-400"/>
 <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">{item.mode || 'Cash'}</span>
 </div>
 </td>
 <td className="p-6 text-right">
 {item.moneyIn > 0 ? (
 <p className="text-lg font-semibold text-emerald-500 tracking-tight">+{formatCurrency(item.moneyIn)}</p>
) : (
 <p className="text-lg font-semibold text-rose-500 tracking-tight">-{formatCurrency(item.moneyOut)}</p>
)}
 </td>
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

export default DayBook;

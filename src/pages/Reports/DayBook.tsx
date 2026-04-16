import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useDayBookData, type DayBookItem } from './useDayBookData';
import { useSettings } from '../../contexts/SettingsContext';
import { Calendar, Download, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, FileText, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printContent } from '../../services/printerService';
import { generateGenericReportHTML } from '../../services/reportHTMLGenerator';

const DayBook: React.FC = () => {
    const { t } = useTranslation();
    const { formatCurrency } = useSettings();
    const [range, setRange] = useState<'today' | 'custom'>('today');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { transactions, summary, loading } = useDayBookData(range, startDate, endDate);

    const handlePrint = async () => {
        const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');
        const savedConfig = localStorage.getItem('printerConfig');
        const config = savedConfig ? JSON.parse(savedConfig) : {};

        const html = generateGenericReportHTML({
            title: t('reports.day_book_title') || "Day Book",
            period: startDate && endDate ? `${startDate} to ${endDate}` : range.toUpperCase(),
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
        XLSX.utils.book_append_sheet(wb, ws, "DayBook");
        XLSX.writeFile(wb, `DayBook_${startDate || 'Today'}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Day Book: ${startDate && endDate ? `${startDate} to ${endDate}` : range.toUpperCase()}`, 14, 20);

        doc.setFontSize(11);
        doc.text(`Total In: ${formatCurrency(summary.totalIn)}`, 14, 30);
        doc.text(`Total Out: ${formatCurrency(summary.totalOut)}`, 80, 30);
        doc.text(`Net Balance: ${formatCurrency(summary.balance)}`, 150, 30);

        const tableData = transactions.map((t: any) => [
            format(t.date, 'HH:mm'),
            t.type.toUpperCase(),
            t.description,
            t.mode,
            t.moneyIn > 0 ? formatCurrency(t.moneyIn) : '-',
            t.moneyOut > 0 ? formatCurrency(t.moneyOut) : '-'
        ]);

        autoTable(doc, {
            head: [['Time', 'Type', 'Description', 'Mode', 'Money In', 'Money Out']],
            body: tableData,
            startY: 40,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [66, 66, 66] }
        });

        doc.save(`DayBook_${startDate || 'Today'}.pdf`);
    };

    const getTypeColor = (type: DayBookItem['type']) => {
        switch (type) {
            case 'sale': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'receipt': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'purchase': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'expense': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'payment': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'return': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                    <Calendar className="text-blue-500" size={24} />
                    <h2 className="text-lg font-bold dark:text-white">{t('reports.day_book_title') || "Daily Transaction Book"}</h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button
                            onClick={() => { setRange('today'); setStartDate(''); setEndDate(''); }}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${range === 'today' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            {t('reports.period_daily')}
                        </button>
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
                        <button
                            onClick={exportToPDF}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200"
                            title="Export PDF"
                        >
                            <FileText size={20} />
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors border border-transparent hover:border-green-200"
                            title="Export Excel"
                        >
                            <Download size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Net Balance */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t('reports.net_balance') || "Net Balance"}</p>
                        <h3 className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-500'}`}>
                            {formatCurrency(summary.balance)}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Wallet size={24} />
                    </div>
                </div>

                {/* Money In */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t('reports.money_in') || "Money In"}</p>
                        <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(summary.totalIn)}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
                        <ArrowDownLeft size={24} />
                    </div>
                </div>

                {/* Money Out */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t('reports.money_out') || "Money Out"}</p>
                        <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(summary.totalOut)}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400">
                        <ArrowUpRight size={24} />
                    </div>
                </div>

                {/* Daily Profit */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t('reports.est_daily_profit') || "Est. Daily Profit"}</p>
                        <h3 className={`text-2xl font-bold ${summary.dailyProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                            {formatCurrency(summary.dailyProfit)}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <TrendingUp size={24} />
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold dark:text-white">{t('reports.transactions') || "Transactions"}</h3>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                        {t('reports.no_transactions_for_date') || "No transactions found for this date."}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {transactions.map((item: any) => (
                            <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-4">
                                {/* Left: Info */}
                                <div className="flex items-start gap-4 flex-1">
                                    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${(item.moneyIn > 0)
                                        ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                        : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                        }`}>
                                        {item.moneyIn > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getTypeColor(item.type)}`}>
                                                {item.type}
                                            </span>
                                            <span className="text-xs text-slate-400">{format(item.date, 'HH:mm')}</span>
                                        </div>
                                        <h4 className="font-medium text-slate-800 dark:text-slate-200">{item.description}</h4>
                                        <p className="text-xs text-slate-500 capitalize">{item.mode || 'cash'}</p>
                                    </div>
                                </div>

                                {/* Right: Amounts */}
                                <div className="text-right whitespace-nowrap">
                                    {item.moneyIn > 0 && (
                                        <div className="text-green-600 dark:text-green-400 font-bold">
                                            + {formatCurrency(item.moneyIn)}
                                        </div>
                                    )}
                                    {item.moneyOut > 0 && (
                                        <div className="text-red-600 dark:text-red-400 font-bold">
                                            - {formatCurrency(item.moneyOut)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DayBook;

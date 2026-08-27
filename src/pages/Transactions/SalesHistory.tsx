import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Dexie from 'dexie';
import { db, type Invoice, softDeleteMetadata, getCurrentBranchId } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Printer, Download, Trash2, RotateCcw, Eye, ShieldCheck, ShieldAlert, Clock, CreditCard, RefreshCw, History } from 'lucide-react';
import { generateInvoicePDF } from '../../services/invoiceGenerator';
import { printContent } from '../../services/printerService';
import { useNotification } from '../../contexts/NotificationContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import ShareModal from '../../components/UI/ShareModal';
import InvoiceDetailsModal from '../../components/UI/InvoiceDetailsModal';

import { Send, FileSpreadsheet } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import Pagination from '../../components/UI/Pagination';

interface SalesHistoryProps {
 onReturn?: (invoice: Invoice) => void;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ onReturn }) => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const { addToast } = useNotification();
 const { isAdmin, hasPermission, activeBranchId, activeBranch } = useAuth();
 const { formatCurrency, formatDate, settings } = useSettings();

 // Check if ZATCA is enabled (LIVE or COMPLIANCE_OBTAINED)
 const [isZatcaEnabled, setIsZatcaEnabled] = useState(false);
 useEffect(() => {
 const checkZatca = async () => {
 if (window.electron && window.electron.zatca) {
 const cfg = await window.electron.zatca.getConfig();
 if (cfg && (cfg.status === 'LIVE' || cfg.status === 'COMPLIANCE_OBTAINED')) {
 setIsZatcaEnabled(true);
 return;
 }
 }
 // Fallback
 const cfg = localStorage.getItem('zatca_config');
 if (cfg) {
 const { status } = JSON.parse(cfg);
 setIsZatcaEnabled(status === 'LIVE' || status === 'COMPLIANCE_OBTAINED');
 }
 };
 checkZatca();
 }, []);

 // Pagination & Filter State
 const [search, setSearch] = useState('');
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const [currentPage, setCurrentPage] = useState(1);
 const [pageSize, setPageSize] = useState(20);

 const [paymentMode, setPaymentMode] = useState('all');

 const [shareModalOpen, setShareModalOpen] = useState(false);
 const [selectedInvoiceForShare, setSelectedInvoiceForShare] = useState<Invoice | null>(null);
 const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

 // Reset pagination on filter change
 useEffect(() => {
 setCurrentPage(1);
 }, [search, startDate, endDate, paymentMode, pageSize]);

 // ==========================================
 // OPTIMIZED QUERY: Single fetch, client-side pagination
 // Uses the compound index [branchId+createdAt] for efficient retrieval
 // ==========================================
 const allFilteredInvoices = useLiveQuery(async () => {
 // Step 1: Use the compound index for branch-scoped, date-ordered query
 let collection;
 if (activeBranch?.isMaster) {
 // Master branch sees all — use createdAt index for ordering
 collection = db.invoices.orderBy('createdAt').reverse();
 } else {
 // Non-master: use compound index [branchId+createdAt]
 collection = db.invoices
 .where('[branchId+createdAt]')
 .between(
 [activeBranchId, Dexie.minKey],
 [activeBranchId, Dexie.maxKey]
)
 .reverse();
 }

 // Step 2: Apply filters in a single pass
 const searchLower = search.toLowerCase();
 const startDateTime = startDate ? new Date(startDate).getTime() : 0;
 // M12 Fix: Include the full end date
 const endDateTime = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;

 return collection.filter((inv: any) => {
 // Skip orders (Pay Later) - only show invoices in History
 if (inv.type === 'order') return false;

 // Skip soft-deleted records
 if (inv.deletedAt) return false;

 // Payment Mode Filter
 if (paymentMode !== 'all' && inv.paymentMode !== paymentMode) return false;

 // Date range filter (use timestamps for fast comparison)
 const invTime = new Date(inv.createdAt).getTime();
 if (invTime < startDateTime || invTime > endDateTime) return false;

 // Search filter
 if (searchLower) {
 const name = (inv.customerName || '').toLowerCase();
 const num = (inv.invoiceNumber || '').toLowerCase();
 if (!name.includes(searchLower) && !num.includes(searchLower)) return false;
 }

 return true;
 }).toArray();
 }, [search, startDate, endDate, paymentMode, activeBranchId, activeBranch?.isMaster]);

 // Client-side pagination (instant page switching, no re-query)
 const totalItems = allFilteredInvoices?.length || 0;
 const totalPages = Math.ceil(totalItems / pageSize);

 const filteredInvoices = useMemo(() => {
 if (!allFilteredInvoices) return undefined;
 const start = (currentPage - 1) * pageSize;
 return allFilteredInvoices.slice(start, start + pageSize);
 }, [allFilteredInvoices, currentPage, pageSize]);


 const printInvoice = (invoice: Invoice) => {
 try {
 const saved = localStorage.getItem('businessDetails');
 const businessDetails = saved ? JSON.parse(saved) : { name: 'My Shop', address: '', phone: '' };

 generateInvoicePDF(invoice, businessDetails).catch(console.error);
 } catch (error) {
 console.error(error);
 }
 };

 const [isRetryingZatca, setIsRetryingZatca] = useState<string | null>(null);

 const handleRetryZatca = async (invoice: Invoice) => {
 if (!invoice.id) return;
 setIsRetryingZatca(invoice.id);
 
 try {
 const saved = localStorage.getItem('businessDetails');
 const safeBusinessDetails = saved ? JSON.parse(saved) : { name: 'My Shop', address: '', phone: '', email: '' };
 const vatNumberRaw = safeBusinessDetails.gstin || safeBusinessDetails.vatNo || '';
 const vatNumber = vatNumberRaw.trim();

 if (!vatNumber) {
 addToast('VAT Number is missing in Business Profile', 'error');
 setIsRetryingZatca(null);
 return;
 }

 const zatcaConfig = (window.electron && window.electron.zatca)
 ? await window.electron.zatca.getConfig()
 : JSON.parse(localStorage.getItem('zatca_config') || 'null');

 if (!zatcaConfig || !zatcaConfig.privateKey) {
 addToast('ZATCA Configuration is missing or incomplete', 'error');
 setIsRetryingZatca(null);
 return;
 }

 const isLive = zatcaConfig.status === 'LIVE';
 const activeCsid = isLive ? zatcaConfig.productionCsid : zatcaConfig.complianceCsid;

 if (!activeCsid) {
 addToast('CSID is missing', 'error');
 setIsRetryingZatca(null);
 return;
 }

 const { generateZatcaXML } = await import('../../services/zatcaXml');
 
 const activeBranchId = getCurrentBranchId();
 const branch = await db.branches.get(activeBranchId);
 const currentPIH = branch?.lastInvoiceHash || 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';

 const result = await generateZatcaXML(
 invoice,
 { ...safeBusinessDetails, gstin: vatNumber },
 zatcaConfig.privateKey,
 activeCsid,
 currentPIH,
 branch?.invoiceCounter || 1
);

 const { reportInvoice } = await import('../../services/zatcaApi');
 const activeSecret = isLive ? zatcaConfig.productionSecret : zatcaConfig.complianceSecret;
 const env = zatcaConfig.environment || 'PRODUCTION';

 const reportResult = await reportInvoice(
 result.xml,
 result.hash,
 result.uuid,
 activeCsid,
 activeSecret,
 env
);

  // H26 Fix: Do NOT increment branch invoiceCounter during a RETRY.
  // The ICV counter was already assigned when the invoice was generated.

 if (reportResult.status === 'REPORTED') {
 await db.invoices.update(invoice.id, {
 zatcaStatus: 'REPORTED',
 zatcaHash: result.hash,
 zatcaError: undefined
 });
 addToast('Invoice successfully reported to ZATCA', 'success');
 } else {
 const errMessage = reportResult.validationResults ? JSON.stringify(reportResult.validationResults) : 'Validation Error';
 await db.invoices.update(invoice.id, { 
 zatcaStatus: 'ERROR',
 zatcaError: errMessage
 });
 addToast('Failed to report to ZATCA', 'error');
 }
 } catch (error: any) {
 console.error("Manual ZATCA Retry Failed:", error);
 addToast(`ZATCA Retry Failed: ${error.message}`, 'error');
 } finally {
 setIsRetryingZatca(null);
 }
 };

 // Delete Confirmation State
 const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);

 const handleDeleteClick = (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 setInvoiceToDelete(id);
 };

 const handleConfirmDelete = async () => {
 if (invoiceToDelete) {
 setIsDeleting(true);
 try {
 await db.invoices.update(invoiceToDelete, softDeleteMetadata());
 addToast(t('transactions.invoice_deleted'), 'success');
 } catch (error) {
 console.error(error);
 addToast(t('transactions.delete_failed'), 'error');
 } finally {
 setIsDeleting(false);
 setInvoiceToDelete(null);
 }
 }
 };

 const handleExportExcel = async () => {
 try {
 // Use the already-filtered data instead of re-querying
 const dataToExport = allFilteredInvoices || [];

 if (dataToExport.length === 0) {
 addToast(t('common.no_records'), 'info');
 return;
 }

 const data = dataToExport.map((inv: any) => ({
 [t('transactions.invoice_no')]: inv.invoiceNumber,
 [t('transactions.date')]: formatDate(inv.createdAt),
 [t('transactions.customer')]: inv.customerName,
 [t('transactions.amount')]: inv.grandTotal,
 [t('transactions.payment')]: inv.paymentMode,
 [t('common.status')]: inv.type === 'return' ? 'Return' : 'Sale'
 }));

 const ws = utils.json_to_sheet(data);
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws,"Sales History");
 writeFile(wb,`Sales_History_${formatDate(new Date()).replace(/\//g, '-')}.xlsx`);
 addToast(t('transactions.download_success'), 'success');
 } catch (e) {
 console.error(e);
  addToast(t('common.error'), 'error');
  }
  };

  const handlePrintDayReport = async () => {
    try {
        const dataToPrint = allFilteredInvoices || [];
        if (dataToPrint.length === 0) {
            addToast(t('common.no_records') || 'No records', 'info');
            return;
        }
        addToast('Generating report...', 'info');

        const totals = { total: 0, cash: 0, card: 0, credit: 0, upi: 0, split: 0, return: 0 };
        dataToPrint.forEach(inv => {
            if (inv.type === 'return') {
                totals.return += inv.grandTotal;
                totals.total -= inv.grandTotal;
            } else {
                totals.total += inv.grandTotal;
                const mode = inv.paymentMode || 'cash';
                if (totals[mode as keyof typeof totals] !== undefined) {
                    (totals[mode as keyof typeof totals] as number) += inv.grandTotal;
                }
            }
        });

        const saved = localStorage.getItem('businessDetails');
        const biz = saved ? JSON.parse(saved) : { name: 'My Shop' };

        const html = `
            <html>
                <head>
                    <style>
                        body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; color: #000; }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .line { border-bottom: 1px dashed #000; margin: 5px 0; }
                        .flex { display: flex; justify-content: space-between; }
                        table { width: 100%; text-align: left; border-collapse: collapse; margin-top: 10px; }
                        th, td { padding: 4px 0; border-bottom: 1px dotted #ccc; font-size: 10px; }
                        th { font-weight: bold; border-bottom: 1px dashed #000; }
                    </style>
                </head>
                <body>
                    <div class="center bold" style="font-size: 16px;">${biz.name}</div>
                    <div class="center bold" style="margin-top:5px;">DAY BUSINESS REPORT</div>
                    <div class="line"></div>
                    <div class="flex"><span>Date:</span> <span>${formatDate(new Date())}</span></div>
                    <div class="flex"><span>Filtered:</span> <span>${startDate ? formatDate(new Date(startDate)) : 'All'} - ${endDate ? formatDate(new Date(endDate)) : 'All'}</span></div>
                    <div class="line"></div>
                    
                    <div class="bold" style="margin-top: 10px;">SUMMARY</div>
                    <div class="flex"><span>Total Sales:</span> <span>${formatCurrency(totals.total)}</span></div>
                    <div class="flex"><span>Total Returns:</span> <span>${formatCurrency(totals.return)}</span></div>
                    <div class="flex"><span>Cash:</span> <span>${formatCurrency(totals.cash)}</span></div>
                    <div class="flex"><span>Card:</span> <span>${formatCurrency(totals.card)}</span></div>
                    <div class="flex"><span>UPI:</span> <span>${formatCurrency(totals.upi)}</span></div>
                    <div class="flex"><span>Credit:</span> <span>${formatCurrency(totals.credit)}</span></div>
                    <div class="flex"><span>Split:</span> <span>${formatCurrency(totals.split)}</span></div>
                    
                    <div class="line" style="margin-top: 10px;"></div>
                    <div class="bold center">INVOICES (${dataToPrint.length})</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Inv #</th>
                                <th>Type</th>
                                <th>Pay</th>
                                <th style="text-align:right">Amt</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dataToPrint.map(inv => `
                                <tr>
                                    <td>${inv.invoiceNumber}</td>
                                    <td>${inv.type === 'return' ? 'RET' : 'INV'}</td>
                                    <td>${(inv.paymentMode || 'cash').substring(0, 4).toUpperCase()}</td>
                                    <td style="text-align:right">${formatCurrency(inv.grandTotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="line" style="margin-top: 10px;"></div>
                    <div class="center">*** END OF REPORT ***</div>
                </body>
            </html>
        `;

        printContent(html, { pageSize: 'thermal', silent: false }).catch(console.error);
    } catch (e) {
        console.error(e);
        addToast(t('common.error'), 'error');
    }
  };  return (
 <div className="space-y-6">
 <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-700/50">
 <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3 mb-6">
 <div className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl">
 <History size={20} strokeWidth={2.5} />
 </div>
 {t('transactions.title') || 'SALES HISTORY'}
 </h2>
 
 <div className="flex flex-col gap-6">
 <div className="relative w-full group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white" size={18} />
 <input
 type="text"
 placeholder={t('transactions.search_placeholder') || 'Search by customer or invoice #...'}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl font-semibold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white shadow-sm"
 />
 </div>

 <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 w-full">
 <div className="flex flex-col flex-1 gap-1">
 <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider pl-1">{t('transactions.from') || 'From'}</label>
 <input
 type="date"
 value={startDate}
 onChange={(e) => setStartDate(e.target.value)}
 className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl font-semibold text-xs outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white shadow-sm"
 />
 </div>
 <div className="flex flex-col flex-1 gap-1">
 <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider pl-1">{t('transactions.to') || 'To'}</label>
 <input
 type="date"
 value={endDate}
 onChange={(e) => setEndDate(e.target.value)}
 className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl font-semibold text-xs outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white shadow-sm"
 />
 </div>
 <div className="flex flex-col flex-1 gap-1">
 <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider pl-1">{t('transactions.payment') || 'Payment'}</label>
 <select
 value={paymentMode}
 onChange={(e) => setPaymentMode(e.target.value)}
 className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl font-semibold text-xs outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white shadow-sm appearance-none cursor-pointer"
 >
 <option value="all">{t('common.all') || 'All'}</option>
 <option value="cash">{t('common.cash') || 'Cash'}</option>
 <option value="card">{t('common.card') || 'Card'}</option>
 <option value="credit">{t('common.credit') || 'Credit'}</option>
 <option value="upi">{t('common.upi') || 'UPI'}</option>
 </select>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row gap-3 pt-2">
  <button type="button"
  onClick={handlePrintDayReport}
  className="flex-1 flex justify-center items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-sm"
  >
  <Printer size={16} strokeWidth={2.5} />
  <span>{t('transactions.print_report') || 'Print Report'}</span>
  </button>
  {settings.enableExcelExport && (
  <button type="button"
  onClick={handleExportExcel}
  className="flex-1 flex justify-center items-center gap-2 px-6 py-3.5 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-sm"
  >
  <FileSpreadsheet size={16} strokeWidth={2.5} />
  <span>{t('common.export_excel') || 'Export to Excel'}</span>
  </button>
  )}
 </div>
 </div>
 </div> <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 overflow-hidden shadow-sm">
 <div className="overflow-x-auto custom-scrollbar">
 <table className="w-full text-left whitespace-nowrap min-w-[700px] responsive-table">
 <thead className="border-b border-slate-50 dark:border-slate-700/50">
 <tr>
 <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('transactions.invoice_no') || 'Invoice #'}</th>
 <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('transactions.date')} #</th>
 <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('transactions.customer')}</th>
 <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('transactions.amount')}</th>
 <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('transactions.payment')}</th>
 {isZatcaEnabled && <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">ZATCA</th>}
 <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">{t('transactions.actions')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
 {filteredInvoices?.map((inv: any) => (
 <tr key={inv.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
 <td className="p-5" data-label="ID">
 <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
 {inv.invoiceNumber}
 </span>
 </td>
 <td className="p-5 font-bold text-slate-900 dark:text-slate-300 text-xs" data-label="Date">{formatDate(inv.createdAt)}</td>
 <td className="p-5 font-bold text-slate-900 dark:text-white uppercase text-xs tracking-tight" data-label="Customer">{inv.customerName}</td>
 <td className="p-5 font-bold text-slate-900 dark:text-white text-sm tracking-tight" data-label="Amount">{formatCurrency(inv.grandTotal)}</td>
 <td className="p-5" data-label="Status">
 <span className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider border
 ${inv.type === 'return' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
 (settings.cafeMode && inv.paymentStatus !== 'paid') ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800' :
 inv.paymentMode ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 ' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
 {inv.type === 'return' 
 ? t('common.return') 
 : (settings.cafeMode && inv.paymentStatus !== 'paid') 
 ? 'Pending' 
 : t(`payment.${inv.paymentMode}`) || inv.paymentMode}
 </span>
 </td>
 {isZatcaEnabled && (
 <td className="p-5" data-label="ZATCA">
 {inv.zatcaStatus === 'REPORTED' ? (
 <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
 <ShieldCheck size={12} strokeWidth={2.5} /> Reported
 </span>
 ) : inv.zatcaStatus === 'ERROR' ? (
 <span 
 className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800 cursor-help"
 title={inv.zatcaError || 'Validation Error'}
 >
 <ShieldAlert size={12} strokeWidth={2.5} /> Error
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
 <Clock size={12} strokeWidth={2.5} /> Pending
 </span>
 )}
 </td>
 )}
 <td className="p-5" data-label="Actions">
 <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
 <button type="button"
 onClick={() => setViewInvoice(inv)}
 className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
 title={t('transactions.view_details')}
 >
 <Eye size={18} />
 </button>
 {inv.paymentStatus !== 'paid' && inv.type !== 'return' && (
 <button type="button"
 onClick={() => navigate('/pos', { state: { editInvoice: inv, hidePayLater: true } })}
 className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
 title="Proceed to Payment"
 >
 <CreditCard size={18} />
 </button>
)}
 {hasPermission('sales_edit') && inv.type !== 'return' && (
 <button type="button"
 onClick={() => onReturn && onReturn(inv)}
 className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
 title="Return"
 >
 <RotateCcw size={18} />
 </button>
)}
 {isZatcaEnabled && inv.zatcaStatus === 'ERROR' && (
 <button type="button"
 onClick={() => handleRetryZatca(inv)}
 disabled={isRetryingZatca === inv.id}
 className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
 title="Retry ZATCA Submission"
 >
 <RefreshCw size={18} className={isRetryingZatca === inv.id ?"":""} />
 </button>
)}
 <button type="button"
 onClick={() => printInvoice(inv)}
 className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
 title={t('transactions.print_invoice')}
 >
 <Printer size={18} />
 </button>
 <button type="button"
 onClick={async () => {
 const saved = localStorage.getItem('businessDetails');
 const business = saved ? JSON.parse(saved) : { name: 'My Shop' };
 import('../../services/invoiceGenerator').then(m => {
 m.downloadInvoicePDF(inv, business).then(success => {
 if (success) addToast(t('transactions.download_success'), 'success');
 else addToast(t('transactions.download_failed'), 'info');
 });
 });
 }}
 className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
 title={t('transactions.download_pdf')}
 >
 <Download size={18} />
 </button>
 {settings.enableSharing && (
 <button type="button"
 onClick={() => {
 setSelectedInvoiceForShare(inv);
 setShareModalOpen(true);
 }}
 className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
 title="Share"
 >
 <Send size={18} />
 </button>
)}
 {/* Delete: Admin OR sales_delete */}
 {(isAdmin || hasPermission('sales_delete')) && (
 <>
 <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"/>
 <button type="button"
 onClick={(e) => handleDeleteClick(inv.id!, e)}
 className="p-2 text-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
 title={t('transactions.delete_invoice')}
 >
 <Trash2 size={18} />
 </button>
 </>
)}
 </div>
 </td>
 </tr>
))}
 </tbody>
 </table>
 </div>

 <Pagination
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={setCurrentPage}
 totalItems={totalItems}
 itemsPerPage={pageSize}
 onItemsPerPageChange={setPageSize}
 />
 </div>
 <ConfirmationModal
 isOpen={!!invoiceToDelete}
 onClose={() => setInvoiceToDelete(null)}
 onConfirm={handleConfirmDelete}
 title={t('common.delete_confirm_title')}
 message={t('transactions.delete_confirm') ||"Are you sure you want to delete this invoice?"}
 confirmText={t('common.delete')}
 variant="danger"
 isLoading={isDeleting}
 />

 {
 selectedInvoiceForShare && (
 <ShareModal
 isOpen={shareModalOpen}
 onClose={() => {
 setShareModalOpen(false);
 setSelectedInvoiceForShare(null);
 }}
 data={selectedInvoiceForShare}
 type="invoice"
 />
)
 }

 <InvoiceDetailsModal
 isOpen={!!viewInvoice}
 onClose={() => setViewInvoice(null)}
 invoice={viewInvoice}
 />
 </div >
);
};

export default SalesHistory;

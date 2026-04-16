import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Dexie from 'dexie';
import { db, type Invoice, softDeleteMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Printer, Download, Trash2, RotateCcw, Eye, ShieldCheck, ShieldAlert, Clock, CreditCard } from 'lucide-react';
import { generateInvoicePDF } from '../../services/invoiceGenerator';
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
    const isZatcaEnabled = useMemo(() => {
        try {
            const cfg = localStorage.getItem('zatca_config');
            if (!cfg) return false;
            const { status } = JSON.parse(cfg);
            return status === 'LIVE' || status === 'COMPLIANCE_OBTAINED';
        } catch { return false; }
    }, []);

    // Pagination & Filter State
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedInvoiceForShare, setSelectedInvoiceForShare] = useState<Invoice | null>(null);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, startDate, endDate, pageSize]);

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
        const endDateTime = endDate ? new Date(endDate).getTime() : Infinity;

        return collection.filter((inv: any) => {
            // Skip soft-deleted records
            if (inv.deletedAt) return false;

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
    }, [search, startDate, endDate, activeBranchId, activeBranch?.isMaster]);

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
            utils.book_append_sheet(wb, ws, "Sales History");
            writeFile(wb, `Sales_History_${formatDate(new Date()).replace(/\//g, '-')}.xlsx`);
            addToast(t('transactions.download_success'), 'success');
        } catch (e) {
            console.error(e);
            addToast(t('common.error'), 'error');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold dark:text-white">{t('transactions.title')}</h1>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder={t('transactions.search_placeholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400 pl-1">{t('transactions.from')}</label>
                        <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400 pl-1">{t('transactions.to')}</label>
                        <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                </div>


                {settings.enableExcelExport && (
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors ml-auto"
                    >
                        <FileSpreadsheet size={18} />
                        <span className="text-sm font-medium">{t('common.export_excel')}</span>
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 font-semibold">{t('transactions.invoice_no')}</th>
                                <th className="p-4 font-semibold">{t('transactions.date')}</th>
                                <th className="p-4 font-semibold">{t('transactions.customer')}</th>
                                <th className="p-4 font-semibold">{t('transactions.amount')}</th>
                                <th className="p-4 font-semibold">{t('transactions.payment')}</th>
                                {isZatcaEnabled && <th className="p-4 font-semibold">ZATCA</th>}
                                <th className="p-4 font-semibold text-right">{t('transactions.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredInvoices?.map((inv: any) => (
                                <tr key={inv.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="p-4 font-mono text-sm dark:text-slate-300">{inv.invoiceNumber}</td>
                                    <td className="p-4 dark:text-slate-300 text-sm">{formatDate(inv.createdAt)}</td>
                                    <td className="p-4 font-medium dark:text-white text-sm">{inv.customerName}</td>
                                    <td className="p-4 font-bold text-slate-800 dark:text-white text-sm">{formatCurrency(inv.grandTotal)}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1.5 rounded-md text-xs font-semibold uppercase border
                                        ${inv.type === 'return' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                                (settings.cafeMode && inv.paymentStatus !== 'paid') ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800' :
                                                    inv.paymentMode ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                            {inv.type === 'return' 
                                                ? t('common.return') 
                                                : (settings.cafeMode && inv.paymentStatus !== 'paid') 
                                                    ? 'Pending' 
                                                    : t(`payment.${inv.paymentMode}`) || inv.paymentMode}
                                        </span>
                                    </td>
                                    {isZatcaEnabled && (
                                        <td className="p-4">
                                            {inv.zatcaStatus === 'REPORTED' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                                    <ShieldCheck size={12} /> Reported
                                                </span>
                                            ) : inv.zatcaStatus === 'ERROR' ? (
                                                <span 
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 cursor-help"
                                                    title={inv.zatcaError || 'Validation Error'}
                                                >
                                                    <ShieldAlert size={12} /> Error
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600">
                                                    <Clock size={12} /> Pending
                                                </span>
                                            )}
                                        </td>
                                    )}
                                    <td className="p-4 flex gap-2 justify-end">
                                        <button
                                            onClick={() => setViewInvoice(inv)}
                                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title={t('transactions.view_details')}
                                        >
                                            <Eye size={18} />
                                        </button>
                                        {settings.cafeMode && inv.paymentStatus !== 'paid' && inv.type !== 'return' && (
                                            <button
                                                onClick={() => navigate('/pos', { state: { editInvoice: inv } })}
                                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Proceed to Payment"
                                            >
                                                <CreditCard size={18} />
                                            </button>
                                        )}
                                        {hasPermission('sales_edit') && inv.type !== 'return' && (
                                            <button
                                                onClick={() => onReturn && onReturn(inv)}
                                                className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                title="Return"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => printInvoice(inv)}
                                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title={t('transactions.print_invoice')}
                                        >
                                            <Printer size={18} />
                                        </button>
                                        <button
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
                                            className="p-2 text-slate-500 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title={t('transactions.download_pdf')}
                                        >
                                            <Download size={18} />
                                        </button>
                                        {settings.enableSharing && (
                                            <button
                                                onClick={() => {
                                                    setSelectedInvoiceForShare(inv);
                                                    setShareModalOpen(true);
                                                }}
                                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Share"
                                            >
                                                <Send size={18} />
                                            </button>
                                        )}
                                        {/* Delete: Admin OR sales_delete */}
                                        {(isAdmin || hasPermission('sales_delete')) && (
                                            <button
                                                onClick={(e) => handleDeleteClick(inv.id!, e)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title={t('transactions.delete_invoice')}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
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
                message={t('transactions.delete_confirm') || "Are you sure you want to delete this invoice?"}
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

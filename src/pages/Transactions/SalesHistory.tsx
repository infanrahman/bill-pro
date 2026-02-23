import React, { useState, useEffect } from 'react';
import { db, type Invoice } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Printer, Download, Trash2, RotateCcw, Eye } from 'lucide-react';
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
    const { addToast } = useNotification();
    const { isAdmin, hasPermission } = useAuth();
    const { formatCurrency, formatDate, settings } = useSettings();

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

    // Query Logic
    const getQuery = () => {
        let collection = db.invoices.orderBy('createdAt').reverse();

        return collection.filter(inv => {
            // Apply Filters
            if (activeTabFilter(inv) === false) return false;

            const customerName = inv.customerName || '';
            const invoiceNumber = inv.invoiceNumber || '';

            // Search
            const matchesSearch = !search ||
                customerName.toLowerCase().includes(search.toLowerCase()) ||
                invoiceNumber.toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) return false;

            // Date Range
            if (startDate) {
                const invDate = new Date(inv.createdAt);
                const start = new Date(startDate);
                invDate.setHours(0, 0, 0, 0);
                start.setHours(0, 0, 0, 0);
                if (invDate < start) return false;
            }
            if (endDate) {
                const invDate = new Date(inv.createdAt);
                const end = new Date(endDate);
                invDate.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);
                if (invDate > end) return false;
            }

            return true;
        });
    };

    // Hard filter for 'invoice' type since this component is for Sales History
    const activeTabFilter = (_inv: Invoice) => {
        // Usually SalesHistory shows all, or just type='invoice' ?
        // The previous code filtered by activeTab in Sales.tsx (parent), but here in SalesHistory
        // it loaded ALL invoices. The parent Sales.tsx only conditionally rendered SalesHistory.
        // Let's assume SalesHistory is for ALL Invoices + Returns if mixed, or just Invoices.
        // Based on previous code: `db.invoices.orderBy('createdAt').reverse().toArray()`
        // It loaded everything. But Filter logic had:
        // `const filteredInvoices = invoices?.filter(inv => ...)`
        // It didn't filter by type explicitly in the filter function?
        // Ah, the parent renders it when `activeTab === 'invoice'`.
        // Let's stick to showing all for now but usually we might want to hide 'drafts' etc.
        return true;
    };

    // Count Total Items (for pagination)
    const totalItems = useLiveQuery(async () => {
        return await getQuery().count();
    }, [search, startDate, endDate]) || 0;

    // Fetch Paginated Data
    const filteredInvoices = useLiveQuery(async () => {
        return await getQuery()
            .offset((currentPage - 1) * pageSize)
            .limit(pageSize)
            .toArray();
    }, [search, startDate, endDate, currentPage, pageSize]);

    const totalPages = Math.ceil(totalItems / pageSize);


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
    const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setInvoiceToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if (invoiceToDelete) {
            setIsDeleting(true);
            try {
                await db.invoices.delete(invoiceToDelete);
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
        // For export, we might want ALL matching records, not just the current page.
        // BUT caution with 1TB data. 
        // Let's provide an export of "Current filtered view" (all matching filters).
        // If user has no filters, this might still be heavy.
        // Ideally export should be a separate worker or process.
        // For now, let's fetch matching items (maybe with a sane limit like 1000 or 5000?)

        try {
            // Fetch all matching filters
            const dataToExport = await getQuery().toArray(); // WARNING: Heavy if no filters

            if (dataToExport.length === 0) {
                addToast(t('common.no_records'), 'info');
                return;
            }

            const data = dataToExport.map(inv => ({
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
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400 pl-1">{t('transactions.to')}</label>
                        <input
                            type="date"
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
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="p-4 font-medium">{t('transactions.invoice_no')}</th>
                            <th className="p-4 font-medium">{t('transactions.date')}</th>
                            <th className="p-4 font-medium">{t('transactions.customer')}</th>
                            <th className="p-4 font-medium">{t('transactions.amount')}</th>
                            <th className="p-4 font-medium">{t('transactions.payment')}</th>
                            <th className="p-4 font-medium">{t('transactions.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredInvoices?.map((inv) => (
                            <tr key={inv.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="p-4 font-mono text-sm dark:text-slate-300">{inv.invoiceNumber}</td>
                                <td className="p-4 dark:text-slate-300">{formatDate(inv.createdAt)}</td>
                                <td className="p-4 font-medium dark:text-white">{inv.customerName}</td>
                                <td className="p-4 font-bold text-slate-800 dark:text-white">{formatCurrency(inv.grandTotal)}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase 
                                        ${inv.type === 'return' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                                            inv.paymentMode ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100'}`}>
                                        {inv.type === 'return' ? t('common.return') : t(`payment.${inv.paymentMode}`) || inv.paymentMode}
                                    </span>
                                </td>
                                <td className="p-4 flex gap-2">
                                    <button
                                        onClick={() => setViewInvoice(inv)}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        title={t('transactions.view_details')}
                                    >
                                        <Eye size={18} />
                                    </button>
                                    {hasPermission('sales_manage') && inv.type !== 'return' && (
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
                                    {/* Delete: Admin OR sales_manage */}
                                    {(isAdmin || hasPermission('sales_manage')) && (
                                        <button
                                            onClick={(e) => handleDeleteClick(inv.id!, e)}
                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
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

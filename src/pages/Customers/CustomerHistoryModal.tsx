import React, { useState, useEffect } from 'react';
import { FileText, Printer } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { db, type Invoice, type CustomerPayment } from '../../services/db';
import { generateInvoicePDF } from '../../services/invoiceGenerator';
import { useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';

interface CustomerHistoryModalProps {
    customerId: string;
    onClose: () => void;
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({ customerId, onClose }) => {
    const { t } = useTranslation();
    const { formatCurrency, formatDate } = useSettings();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<CustomerPayment[]>([]);
    const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'purchases'>('invoices');
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState('');
    const [balance, setBalance] = useState(0);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const customer = await db.customers.get(customerId);
                setCustomerName(customer?.name || 'Customer');
                setBalance(customer?.balance || 0);

                const fetchedInvoices = await db.invoices.where('customerId').equals(customerId).toArray();
                const fetchedPayments = await db.customerPayments.where('customerId').equals(customerId).toArray();

                // Sort invoices by date descending
                fetchedInvoices.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
                // Sort payments by date descending
                fetchedPayments.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

                setInvoices(fetchedInvoices);
                setPayments(fetchedPayments);

            } catch (error) {
                console.error("Failed to load history", error);
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
    }, [customerId]);

    const handlePrintInvoice = async (invoice: Invoice) => {
        const savedBusiness = localStorage.getItem('businessDetails');
        const business = savedBusiness ? JSON.parse(savedBusiness) : {};
        await generateInvoicePDF(invoice, business);
    };

    const handlePDFExport = () => {
        // Placeholder for PDF export logic for the entire history or current tab
        console.log("Exporting PDF for customer history...");
        alert("PDF Export functionality not yet implemented.");
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={t('customers.history_title', { name: customerName })} maxWidth="4xl">
            <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                    <span className={`text-sm font-semibold ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {t('customers.current_balance')}: {formatCurrency(balance)}
                    </span>
                </div>
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'invoices'
                            ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        onClick={() => setActiveTab('invoices')}
                    >
                        {t('customers.invoices')} ({loading ? '...' : invoices.length})
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'payments'
                            ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        onClick={() => setActiveTab('payments')}
                    >
                        {t('customers.payments')} ({loading ? '...' : payments.length})
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'purchases'
                            ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        onClick={() => setActiveTab('purchases')}
                    >
                        {t('customers.total_spent')}
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6" id="history-content">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading history...</div>
                    ) : (
                        <>
                            {activeTab === 'invoices' && (
                                <div className="space-y-4">
                                    {invoices.length === 0 ? (
                                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('customers.no_invoices')}</p>
                                    ) : (
                                        invoices.map((inv: any) => (
                                            <div key={inv.id} className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg flex justify-between items-center border border-gray-100 dark:border-slate-600">
                                                <div>
                                                    <div className="font-bold dark:text-white">#{inv.invoiceNumber}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {formatDate(inv.createdAt)}
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-2">
                                                    <div>
                                                        <div className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(inv.grandTotal)}</div>
                                                        <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${inv.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                            inv.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                            }`}>
                                                            {inv.paymentStatus?.toUpperCase() || 'UNKNOWN'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handlePrintInvoice(inv)}
                                                        className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 rounded transition-colors"
                                                        title="Print / Download Invoice"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'payments' && (
                                <div className="space-y-4">
                                    {payments.length === 0 ? (
                                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('customers.no_payments')}</p>
                                    ) : (
                                        payments.map((p: any) => (
                                            <div key={p.id} className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg flex justify-between items-center border border-green-100 dark:border-green-800/30">
                                                <div>
                                                    <div className="font-bold text-green-700 dark:text-green-400">Payment Received</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {formatDate(p.date)}
                                                    </div>
                                                    {p.note && <div className="text-xs text-gray-400 mt-1 italic">{p.note}</div>}
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-green-600 dark:text-green-400">+{formatCurrency(p.amount)}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">{p.paymentMode}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'purchases' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl text-center">
                                            <div className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-1">{t('customers.total_invoiced')}</div>
                                            <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-300">
                                                {formatCurrency(invoices.reduce((sum: any, i: any) => sum + i.grandTotal, 0))}
                                            </div>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl text-center">
                                            <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">{t('customers.total_paid')}</div>
                                            <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                                                {formatCurrency(payments.reduce((sum: any, p: any) => sum + p.amount, 0))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-slate-800">
                    <div className="flex gap-2">
                        <button
                            onClick={handlePDFExport}
                            className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                        >
                            <FileText size={16} /> {t('customers.export_pdf')}
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            {t('customers.close')}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CustomerHistoryModal;

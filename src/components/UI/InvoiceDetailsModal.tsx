import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { type Invoice } from '../../services/db';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';

interface InvoiceDetailsModalProps {
    invoice: Invoice | null;
    isOpen: boolean;
    onClose: () => void;
}

interface BusinessDetails {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string; // Base64
    gstin?: string; // Added gstin
    vatNo?: string;
    taxName?: string;
    crNo?: string;
    pincode?: string;
    country?: string;
    taxRate?: number;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({ invoice, isOpen, onClose }) => {
    const { t } = useTranslation();
    const { formatCurrency, formatDate } = useSettings();
    const [business, setBusiness] = useState<BusinessDetails | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('businessProfile');
        if (saved) {
            setBusiness(JSON.parse(saved));
        }
    }, [isOpen]);

    if (!invoice) return null;

    // Logic for tax columns - match invoiceGenerator
    const showVatColumn = (invoice.taxAmount || 0) > 0;
    // const isRTL = i18n.language === 'ar';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('transactions.invoice_details')}
            maxWidth="4xl"
        >
            <div className={`p-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ltr`} style={{ fontFamily: 'Segoe UI, sans-serif' }}>

                {/* 1. Header Section */}
                <div className="flex justify-between items-start mb-8 border-b-2 border-slate-100 dark:border-slate-800 pb-6">
                    {/* Logo Area */}
                    <div className="w-1/3">
                        {business?.logoUrl ? (
                            <img src={business.logoUrl} alt="Logo" className="max-h-24 max-w-full object-contain" />
                        ) : (
                            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{business?.name || 'Business Name'}</h1>
                        )}
                    </div>

                    {/* Company Details (Right/Left based on RTL) */}
                    <div className={`w-1/3 text-right text-sm space-y-1`}>
                        {business?.logoUrl && <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">{business.name}</h2>}
                        <p className="text-slate-600 dark:text-slate-400">{business?.address} {business?.pincode ? `- ${business.pincode}` : ''}</p>
                        {business?.phone && <p className="text-slate-600 dark:text-slate-400">{t('settings.profile.phone')}: <span dir="ltr">{business.phone}</span></p>}
                        {business?.email && <p className="text-slate-600 dark:text-slate-400">{t('settings.profile.email')}: {business.email}</p>}
                        {(business?.vatNo || business?.gstin as any) && <p className="text-slate-600 dark:text-slate-400 font-semibold">{t('settings.profile.tax_reg_no')}: {(business?.vatNo || business?.gstin as any)}</p>}
                    </div>
                </div>

                {/* 2. Meta Grid (Invoice Info & Customer Info) */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                    {/* Invoice Info */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                            {t('transactions.invoice_details')}
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">{t('common.order_no')}</span>
                                <span className="font-bold">{invoice.invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">{t('common.date')}</span>
                                <span>{formatDate(invoice.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">{t('common.status')}</span>
                                <span className={`uppercase font-bold text-xs px-2 py-0.5 rounded ${invoice.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                                    invoice.paymentStatus === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                    {t(`common.${invoice.paymentStatus}`)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">{t('payment.payment_mode')}</span>
                                <span className="capitalize">{t(`payment.${invoice.paymentMode}`)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                            {t('transactions.customer')}
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">{t('customers.name')}</span>
                                <span className="font-bold">{invoice.customerName}</span>
                            </div>
                            {invoice.customerPhone && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">{t('customers.phone')}</span>
                                    <span dir="ltr">{invoice.customerPhone}</span>
                                </div>
                            )}
                            {invoice.customerVatNumber && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">{t('customers.tax_number')}</span>
                                    <span>{invoice.customerVatNumber}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Items Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-8">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            <tr>
                                <th className={`p-3 font-bold text-left`}>{t('common.item')}</th>
                                <th className="p-3 font-bold text-center">{t('common.qty')}</th>
                                <th className={`p-3 font-bold text-right`}>{t('common.price')}</th>
                                {showVatColumn && <th className={`p-3 font-bold text-right`}>{t('pos.tax')}%</th>}
                                <th className={`p-3 font-bold text-right`}>{t('common.total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {invoice.items.map((item, idx) => {
                                // Calculate row tax for valid display if column is shown
                                const nominalTotal = item.price * item.quantity;
                                const rate = item.taxRate || business?.taxRate || 0;
                                let itemTax = 0;
                                let itemTotal = nominalTotal; // Display Total (inc tax if added)

                                if (item.taxType === 'inclusive') {
                                    const base = nominalTotal / (1 + rate / 100);
                                    itemTax = nominalTotal - base;
                                } else if (showVatColumn) { // Exclusive and we show Column
                                    itemTax = nominalTotal * (rate / 100);
                                    itemTotal += itemTax;
                                }

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className={`p-3 text-left`}>
                                            <div className="font-medium text-slate-800 dark:text-white">{item.name}</div>
                                            {item.nameAr && <div className="text-xs text-slate-500">{item.nameAr}</div>}
                                        </td>
                                        <td className="p-3 text-center">{item.quantity}</td>
                                        <td className={`p-3 text-right`}>{formatCurrency(item.price)}</td>
                                        {showVatColumn && (
                                            <td className={`p-3 text-slate-500 text-right`}>
                                                <div className="flex flex-col items-end">
                                                    <span>{formatCurrency(itemTax)}</span>
                                                    <span className="text-[10px] text-slate-400">({rate}%)</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className={`p-3 font-bold text-slate-800 dark:text-white text-right`}>
                                            {formatCurrency(itemTotal)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 4. Footer Totals */}
                <div className="flex justify-end">
                    <div className="w-full md:w-1/2 lg:w-1/3">
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span>{t('pos.subtotal')}</span>
                                <span>{formatCurrency(invoice.subTotal)}</span>
                            </div>

                            {showVatColumn && (
                                <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span>{t('pos.tax')} ({t('common.vat')})</span>
                                    <span>{formatCurrency(invoice.taxAmount)}</span>
                                </div>
                            )}

                            {invoice.discountAmount > 0 && (
                                <div className="flex justify-between text-green-600 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span>{t('pos.discount')}</span>
                                    <span>-{formatCurrency(invoice.discountAmount)}</span>
                                </div>
                            )}

                            <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white border-y-2 border-slate-900 dark:border-slate-200 py-3 my-2">
                                <span>{t('pos.total')}</span>
                                <span>{formatCurrency(invoice.grandTotal)}</span>
                            </div>

                            {invoice.paidAmount !== undefined && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1">
                                    <span>{t('pos.paid_amount')}</span>
                                    <span>{formatCurrency(invoice.paidAmount)}</span>
                                </div>
                            )}

                            {(invoice.remainingAmount || 0) > 0.01 && (
                                <div className="flex justify-between text-red-600 font-bold pt-1">
                                    <span>{t('pos.balance_due')}</span>
                                    <span>{formatCurrency(invoice.remainingAmount)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end pt-8 mt-8 border-t border-slate-100 dark:border-slate-800 no-print">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-medium transition-colors"
                    >
                        {t('common.close')}
                    </button>
                    {/* Could add a Print button here that calls the actual Print function if needed */}
                </div>
            </div>
        </Modal>
    );
};

export default InvoiceDetailsModal;

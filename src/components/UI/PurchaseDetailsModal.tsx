import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import type { Purchase } from '../../services/db';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';

interface PurchaseDetailsModalProps {
    purchase: Purchase | null;
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

const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({ purchase, isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const { formatCurrency, formatDate } = useSettings();
    const [business, setBusiness] = useState<BusinessDetails | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('businessProfile');
        if (saved) {
            setBusiness(JSON.parse(saved));
        }
    }, [isOpen]);

    if (!purchase) return null;

    // Calc helpers
    const grandTotal = purchase.totalAmount;
    const taxAmount = purchase.taxAmount ?? 0;
    const subTotal = purchase.subTotal ?? (grandTotal - taxAmount);
    const paidAmount = purchase.paidAmount ?? 0;
    const balance = Math.max(0, grandTotal - paidAmount);
    const isRTL = i18n.language === 'ar';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('purchases.title')} // "Purchase Orders" or "Purchase Bill"
            maxWidth="4xl"
        >
            <div className={`p-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${isRTL ? 'rtl' : 'ltr'}`} style={{ fontFamily: 'Segoe UI, sans-serif' }}>

                {/* 1. Header Section: Supplier (The 'Sender' in a bill) vs Us (The 'Receiver') 
                     In a Purchase Bill, usually WE receive it from Supplier. 
                     Standard Bill View:
                     LEFT: Supplier Details
                     RIGHT: Bill #, Date
                 */}
                <div className="flex justify-between items-start mb-8 border-b-2 border-slate-100 dark:border-slate-800 pb-6">
                    {/* Supplier Area (Sender) */}
                    <div className="w-1/2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('purchases.supplier_name')}</h3>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{purchase.supplierName}</h1>
                        {/* We might not have full supplier address stored in purchase object, depends on implementation. 
                             Usually just name is stored in lite version. If we had supplierID, we could fetch, but for now name is fallback.
                         */}
                    </div>

                    {/* Bill Meta */}
                    <div className={`w-1/2 ${isRTL ? 'text-left' : 'text-right'} space-y-1`}>
                        <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">{t('purchases.ref_no')}: {purchase.orderNumber}</h2>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">{t('common.date')}: {formatDate(purchase.date)}</p>
                        {purchase.dueDate && <p className="text-slate-500 text-sm">{t('purchases.due_date')}: {formatDate(purchase.dueDate)}</p>}
                        <div className="mt-2">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${purchase.status === 'completed' ? 'bg-green-100 text-green-700' :
                                purchase.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {purchase.status === 'completed' ? t('purchases.status_completed') : t('purchases.status_pending')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Received By (Us) - Optional but good for 'Bill' styling */}
                <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('purchases.receiver')}</h3>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {business?.name || 'My Business'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {business?.address}
                    </div>
                </div>

                {/* 3. Items Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-8">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            <tr>
                                <th className={`p-3 font-bold ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.item')}</th>
                                <th className="p-3 font-bold text-center">{t('purchases.unit')}</th>
                                <th className="p-3 font-bold text-center">{t('common.qty')}</th>
                                <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('common.price')}</th> {/* Cost */}
                                <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('pos.tax')} %</th>
                                <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('purchases.vat_amount')}</th>
                                <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('common.total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {purchase.items.map((item, idx) => {
                                const qty = item.quantity;
                                const cost = item.cost;
                                const taxRate = item.taxRate ?? 0;
                                const taxType = item.taxType || 'exclusive';

                                let calculatedTax = item.taxAmount ?? 0;

                                // Recalculate if taxAmount is likely missing/zero but rate exists, OR just for display sanity
                                // Ideally trust DB, but if 0 and rate > 0, recalculate.
                                if (taxRate > 0 && calculatedTax === 0) {
                                    if (taxType === 'inclusive') {
                                        const basePrice = cost / (1 + taxRate / 100);
                                        calculatedTax = (cost - basePrice) * qty;
                                    } else {
                                        calculatedTax = (cost * (taxRate / 100)) * qty;
                                    }
                                }

                                const displayTotal = item.total ?? ((cost * qty) + (taxType === 'inclusive' ? 0 : calculatedTax));

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className={`p-3 font-medium text-slate-800 dark:text-white ${isRTL ? 'text-right' : 'text-left'}`}>{item.name}</td>
                                        <td className="p-3 text-center text-slate-500">{item.unit || '-'}</td>
                                        <td className="p-3 text-center text-slate-800 dark:text-white">{item.quantity}</td>
                                        <td className={`p-3 text-slate-600 dark:text-slate-300 ${isRTL ? 'text-left' : 'text-right'}`}>{formatCurrency(item.cost)}</td>
                                        <td className={`p-3 text-slate-500 ${isRTL ? 'text-left' : 'text-right'}`}>
                                            {taxRate > 0 ? (
                                                <span className="flex flex-col">
                                                    <span>{taxRate}%</span>
                                                    <span className="text-[10px] text-slate-400 capitalize">({taxType})</span>
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className={`p-3 text-slate-500 ${isRTL ? 'text-left' : 'text-right'}`}>{formatCurrency(calculatedTax)}</td>
                                        <td className={`p-3 font-bold text-slate-800 dark:text-white ${isRTL ? 'text-left' : 'text-right'}`}>{formatCurrency(displayTotal)}</td>
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
                                <span>{formatCurrency(subTotal)}</span>
                            </div>

                            <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span>{t('purchases.total_vat')}</span>
                                <span>{formatCurrency(taxAmount)}</span>
                            </div>

                            <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white border-y-2 border-slate-900 dark:border-slate-200 py-3 my-2">
                                <span>{t('pos.total')}</span>
                                <span>{formatCurrency(grandTotal)}</span>
                            </div>

                            {paidAmount > 0 && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1">
                                    <span>{t('pos.paid_amount')}</span>
                                    <span>{formatCurrency(paidAmount)}</span>
                                </div>
                            )}

                            {balance > 0.01 && (
                                <div className="flex justify-between text-red-600 font-bold pt-1">
                                    <span>{t('purchases.balance_due')}</span>
                                    <span>{formatCurrency(balance)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end pt-8 mt-8 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-medium transition-colors"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseDetailsModal;

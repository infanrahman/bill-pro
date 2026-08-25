import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { db, type Purchase, type Item } from '../../services/db';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { Printer, QrCode } from 'lucide-react';
import BarcodeModal from '../../pages/Inventory/BarcodeModal';

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
  logoUrl?: string;
  gstin?: string;
  vatNo?: string;
  taxName?: string;
  crNo?: string;
  pincode?: string;
  country?: string;
  taxRate?: number;
}

const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({ purchase, isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const { formatCurrency, formatDate, settings } = useSettings();
  const [business, setBusiness] = useState<BusinessDetails | null>(null);

  // Label Printing State
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [itemsForLabel, setItemsForLabel] = useState<Item[] | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('businessDetails') || localStorage.getItem('businessProfile');
    if (saved) {
      setTimeout(() => setBusiness(JSON.parse(saved)), 0);
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

  const handlePrintLabels = async () => {
    if (!purchase.items || purchase.items.length === 0) return;
    try {
      const fullItems: Item[] = [];
      for (const pi of purchase.items) {
        const dbItem = await db.items.get(pi.itemId);
        const qty = Number(pi.quantity) || 1;
        const baseCost = Number(pi.cost) || (dbItem ? Number(dbItem.purchasePrice) : 0);
        let unitTotalPurchaseCost = baseCost;

        if (pi.taxType === 'exclusive') {
          if (pi.total !== undefined && pi.total > 0 && qty > 0) {
            unitTotalPurchaseCost = pi.total / qty;
          } else if (pi.taxAmount !== undefined && pi.taxAmount > 0 && qty > 0) {
            unitTotalPurchaseCost = baseCost + (pi.taxAmount / qty);
          } else if (pi.taxRate && pi.taxRate > 0) {
            unitTotalPurchaseCost = baseCost * (1 + pi.taxRate / 100);
          }
        }

        unitTotalPurchaseCost = Math.round(unitTotalPurchaseCost * 100) / 100;

        if (dbItem) {
          fullItems.push({
            ...dbItem,
            purchasePrice: unitTotalPurchaseCost,
            stock: qty,
            supplierNameFallback: purchase.supplierName
          } as any);
        } else {
          fullItems.push({
            id: pi.itemId,
            branchId: purchase.branchId || '',
            updatedAt: new Date(),
            name: pi.name,
            barcode: '',
            salePrice: baseCost,
            purchasePrice: unitTotalPurchaseCost,
            taxType: pi.taxType || 'exclusive',
            taxRate: pi.taxRate || 0,
            stock: qty,
            minStock: 5,
            unit: pi.unit || 'pc',
            supplierNameFallback: purchase.supplierName
          } as any);
        }
      }
      setItemsForLabel(fullItems);
      setIsLabelModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('purchases.title')}
        maxWidth="4xl"
      >
        <div className={`flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${isRTL ? 'rtl' : 'ltr'}`} style={{ fontFamily: 'Segoe UI, sans-serif' }}>

          {/* 1. Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 border-b-2 border-slate-100 dark:border-slate-800 pb-4 md:pb-6 gap-4 md:gap-0">
            <div className="w-full md:w-1/2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">{t('purchases.supplier_name')}</h3>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{purchase.supplierName}</h1>
            </div>

            <div className={`w-full md:w-1/2 md:${isRTL ? 'text-left' : 'text-right'} space-y-1`}>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('purchases.ref_no')}: {purchase.orderNumber}</h2>
              <p className="text-slate-600 dark:text-slate-300 font-medium">{t('common.date')}: {formatDate(purchase.date)}</p>
              {purchase.dueDate && <p className="text-slate-700 text-sm">{t('purchases.due_date')}: {formatDate(purchase.dueDate)}</p>}
              <div className={`mt-2 flex items-center md:justify-end gap-2`}>
                <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${purchase.status === 'completed' ? 'bg-green-100 text-green-700' :
                  purchase.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                }`}>
                  {purchase.status === 'completed' ? t('purchases.status_completed') : t('purchases.status_pending')}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Received By */}
          <div className="mb-6 md:mb-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">{t('purchases.receiver')}</h3>
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              {business?.name || 'My Business'}
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              {business?.address}
            </div>
          </div>

          {/* 3. Items Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:border-slate-300">
                <tr>
                  <th className={`p-3 font-bold ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.item')}</th>
                  <th className="p-3 font-bold text-center">{t('purchases.unit')}</th>
                  <th className="p-3 font-bold text-center">{t('common.qty')}</th>
                  <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('purchases.cost')}</th>
                  <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('pos.tax')} %</th>
                  <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('purchases.before_vat_amount')}</th>
                  <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('purchases.vat_amount')}</th>
                  <th className={`p-3 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>{t('purchases.total_with_vat')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {purchase.items.map((item, idx) => {
                  const qty = item.quantity;
                  const cost = item.cost;
                  const taxRate = item.taxRate ?? 0;
                  const taxType = item.taxType || 'exclusive';

                  let beforeVat = item.subtotalBeforeTax ?? 0;
                  let calculatedTax = item.taxAmount ?? 0;
                  let displayTotal = item.total ?? 0;

                  if (!beforeVat || (taxRate > 0 && calculatedTax === 0) || !displayTotal) {
                    if (taxType === 'inclusive') {
                      const basePrice = cost / (1 + taxRate / 100);
                      beforeVat = basePrice * qty;
                      calculatedTax = (cost - basePrice) * qty;
                      displayTotal = cost * qty;
                    } else {
                      beforeVat = cost * qty;
                      calculatedTax = (cost * (taxRate / 100)) * qty;
                      displayTotal = beforeVat + calculatedTax;
                    }
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className={`p-3 font-medium text-slate-800 dark:text-white ${isRTL ? 'text-right' : 'text-left'}`}>{item.name}</td>
                      <td className="p-3 text-center text-slate-700">{item.unit || '-'}</td>
                      <td className="p-3 text-center text-slate-800 dark:text-white">{item.quantity}</td>
                      <td className={`p-3 text-slate-600 dark:text-slate-300 ${isRTL ? 'text-left' : 'text-right'}`}>{formatCurrency(item.cost)}</td>
                      <td className={`p-3 text-slate-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                        {taxRate > 0 ? (
                          <span className="flex flex-col">
                            <span>{taxRate}%</span>
                            <span className="text-[10px] text-slate-600 capitalize">({taxType})</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td className={`p-3 text-slate-700 dark:text-slate-300 ${isRTL ? 'text-left' : 'text-right'}`}>{formatCurrency(beforeVat)}</td>
                      <td className={`p-3 text-slate-700 dark:text-slate-300 ${isRTL ? 'text-left' : 'text-right'}`}>{formatCurrency(calculatedTax)}</td>
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
                <div className="flex justify-between text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span>{t('pos.subtotal')}</span>
                  <span>{formatCurrency(subTotal)}</span>
                </div>

                <div className="flex justify-between text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span>{t('purchases.total_vat')}</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>

                <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white border-y-2 border-slate-900 dark:border-slate-200 py-3 my-2">
                  <span>{t('pos.total')}</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>

                {paidAmount > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1">
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
          <div className="flex justify-between items-center pt-8 mt-8 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrintLabels}
              className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <Printer size={16} />
              <span>{t('inventory.print_label') || 'Print Barcodes'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-semibold text-xs uppercase tracking-wider transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Barcode / QR Label Modal */}
      <BarcodeModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        items={itemsForLabel}
      />
    </>
  );
};

export default PurchaseDetailsModal;

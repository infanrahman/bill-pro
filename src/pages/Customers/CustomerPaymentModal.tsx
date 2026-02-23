import React, { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Wallet, Printer } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../services/db';
import type { Customer } from '../../services/db';
import { useTranslation } from 'react-i18next';
import { printPaymentReceipt } from '../../services/invoiceGenerator';

interface CustomerPaymentModalProps {
    customer: Customer;
    onClose: () => void;
    onPaymentComplete: () => void;
}

const CustomerPaymentModal: React.FC<CustomerPaymentModalProps> = ({ customer, onClose, onPaymentComplete }) => {
    const { t } = useTranslation();
    const { formatCurrency, settings } = useSettings();
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi'>('cash');
    const [printReceipt, setPrintReceipt] = useState(true);
    const { addToast } = useNotification();

    const handlePayment = async () => {
        const payAmount = parseFloat(amount);
        if (!payAmount || payAmount <= 0) {
            addToast(t('customers.invalid_amount'), 'error');
            return;
        }

        try {
            // 1. Record Payment
            const paymentId = await db.customerPayments.add({
                customerId: customer.id!,
                amount: payAmount,
                date: new Date(),
                paymentMode,
                note
            });

            // 2. Update Customer Balance
            const newBalance = (customer.balance || 0) - payAmount;

            await db.customers.update(customer.id!, {
                balance: newBalance
            });


            // 3. Print Receipt if requested
            if (printReceipt) {
                const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || '{}');
                await printPaymentReceipt(
                    {
                        amount: payAmount,
                        date: new Date(),
                        mode: paymentMode,
                        note,
                        id: Number(paymentId)
                    },
                    {
                        name: customer.name,
                        phone: customer.phone,
                        balance: newBalance
                    },
                    businessDetails
                ).catch(console.error);
            }

            addToast(t('customers.payment_success'), 'success');
            onPaymentComplete();
            onClose();
        } catch (error) {
            console.error(error);
            addToast(t('customers.payment_error'), 'error');
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={t('customers.receive_payment')} maxWidth="md">
            <div className="p-6 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center">
                    <span className="text-blue-800 dark:text-blue-300 font-medium">{t('customers.current_balance')}</span>
                    <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(customer.balance || 0)}</span>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('customers.amount_received')}</label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">{settings.currency}</div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                            placeholder={t('common.placeholder_amount')}
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('customers.payment_mode')}</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['cash', 'card', 'upi'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setPaymentMode(mode as any)}
                                className={`p-2 rounded-lg border text-sm font-medium capitalize ${paymentMode === mode
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                {t(`payment.${mode}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('customers.note_optional')}</label>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                        placeholder={t('customers.placeholder_note')}
                    />
                </div>

                {/* Print Checkbox */}
                <div className="flex items-center gap-2 pt-2">
                    <input
                        type="checkbox"
                        id="printReceipt"
                        checked={printReceipt}
                        onChange={(e) => setPrintReceipt(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="printReceipt" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer select-none">
                        <Printer size={16} />
                        {t('common.print_receipt') || "Print Receipt"}
                    </label>
                </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                    {t('common.cancel')}
                </button>
                <button
                    onClick={handlePayment}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
                >
                    <Wallet size={18} />
                    {t('customers.confirm_payment')}
                </button>
            </div>
        </Modal>
    );
};

export default CustomerPaymentModal;

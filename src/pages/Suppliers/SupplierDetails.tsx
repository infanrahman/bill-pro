import React from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Assuming react-router-dom is used, typically via hash routing in Electron
import { db, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Phone, Mail, MapPin, Building, FileText, RotateCcw, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotification } from '../../contexts/NotificationContext';

const SupplierDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { formatCurrency, formatDate } = useSettings();
    const { addToast } = useNotification();
    const supplierId = id!;

    const supplier = useLiveQuery(() => db.suppliers.get(supplierId), [supplierId]);

    // Fetch History
    const purchases = useLiveQuery(() =>
        db.purchases.where('supplierId').equals(supplierId).reverse().sortBy('date'),
        [supplierId]);

    const payments = useLiveQuery(() =>
        db.purchasePayments.where('supplierId').equals(supplierId).reverse().sortBy('date'),
        [supplierId]);

    // Merge and Sort
    const history = React.useMemo(() => {
        return [...(purchases || []), ...(payments || [])].sort((a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [purchases, payments]);

    const [activeTab, setActiveTab] = React.useState<'bills' | 'history'>('bills');
    const [selectedBill, setSelectedBill] = React.useState<any>(null); // For payment modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);

    // Payment Form State
    const [payAmount, setPayAmount] = React.useState('');
    const [payDate, setPayDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [payMode, setPayMode] = React.useState('cash');
    const [payNote, setPayNote] = React.useState('');

    const handleOpenPayment = (bill: any) => {
        setSelectedBill(bill);
        const due = bill.totalAmount - (bill.paidAmount || 0);
        setPayAmount(due.toString());
        setPayDate(new Date().toISOString().split('T')[0]);
        setPayMode('cash');
        setPayNote('');
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = async () => {
        if (!selectedBill || !payAmount) return;
        const amount = parseFloat(payAmount);
        if (isNaN(amount) || amount <= 0) {
            addToast(t('pos.invalid_amount'), 'error');
            return;
        }

        try {
            await db.transaction('rw', [db.purchases, db.purchasePayments, db.suppliers], async () => {
                // 1. Record Payment linked to Bill
                await db.purchasePayments.add({
                    ...createRecordMetadata(),
                    purchaseId: selectedBill.id,
                    supplierId: supplierId,
                    amount: amount,
                    date: new Date(payDate),
                    paymentMode: payMode as any,
                    note: payNote,
                    reference: selectedBill.orderNumber // Store bill no as reference
                });

                // 2. Update Bill Status
                const newPaid = (selectedBill.paidAmount || 0) + amount;
                const newStatus = newPaid >= selectedBill.totalAmount - 0.01 ? 'completed' : 'pending'; // Tolerance

                await db.purchases.update(selectedBill.id, {
                    ...updateRecordMetadata(),
                    paidAmount: newPaid,
                    status: newStatus
                });

                // 3. Update Supplier Total Balance
                const currentSup = await db.suppliers.get(supplierId);
                if (currentSup) {
                    await db.suppliers.update(supplierId, {
                        ...updateRecordMetadata(),
                        balance: currentSup.balance - amount
                    });
                }
            });

            addToast(t('purchases.payment_recorded'), 'success');
            setIsPaymentModalOpen(false);
        } catch (e) {
            console.error(e);
            addToast(t('common.error'), 'error');
        }
    };

    if (!supplier) return <div className="p-8 text-center">{t('common.loading')}</div>;

    // Filter for Tabs
    const outstandingBills = purchases?.filter((p: any) => !p.type || p.type === 'bill').filter((p: any) => {
        const paid = p.paidAmount || 0;
        return (p.totalAmount - paid) > 0.01;
    }) || [];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/suppliers')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                    <ArrowLeft size={20} />
                    {t('common.back')}
                </button>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl shrink-0">
                    {supplier.name.charAt(0)}
                </div>

                <div className="flex-1">
                    <h1 className="text-2xl font-bold dark:text-white mb-2">{supplier.name}</h1>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                        {supplier.phone && <div className="flex items-center gap-1"><Phone size={14} /> {supplier.phone}</div>}
                        {supplier.email && <div className="flex items-center gap-1"><Mail size={14} /> {supplier.email}</div>}
                        {supplier.location && <div className="flex items-center gap-1"><MapPin size={14} /> {supplier.location}</div>}
                        {supplier.taxNumber && <div className="flex items-center gap-1"><Building size={14} /> {supplier.taxNumber}</div>}
                    </div>
                </div>

                <div className="text-right bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">{t('purchases.balance_due')}</p>
                    <p className={`text-3xl font-bold ${supplier.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCurrency(supplier.balance)}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('bills')}
                    className={`pb-3 border-b-2 font-medium transition-colors ${activeTab === 'bills'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    {t('purchases.outstanding_bills')} ({outstandingBills.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 border-b-2 font-medium transition-colors ${activeTab === 'history'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    {t('common.history')}
                </button>
            </div>

            {/* Content */}
            {activeTab === 'bills' ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-sm">
                            <tr>
                                <th className="p-4">{t('common.date')}</th>
                                <th className="p-4">{t('purchases.bill_no')}</th>
                                <th className="p-4 text-right">{t('purchases.total')}</th>
                                <th className="p-4 text-right">{t('purchases.paid')}</th>
                                <th className="p-4 text-right">{t('purchases.balance')}</th>
                                <th className="p-4 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {outstandingBills.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('purchases.no_outstanding_bills')}</td></tr>
                            ) : outstandingBills.map((bill: any) => {
                                const paid = bill.paidAmount || 0;
                                const due = bill.totalAmount - paid;
                                return (
                                    <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="p-4 dark:text-slate-300 font-mono text-sm">{formatDate(bill.date)}</td>
                                        <td className="p-4 font-bold dark:text-white">{bill.orderNumber}</td>
                                        <td className="p-4 text-right dark:text-white">{formatCurrency(bill.totalAmount)}</td>
                                        <td className="p-4 text-right text-green-600">{formatCurrency(paid)}</td>
                                        <td className="p-4 text-right text-red-500 font-bold">{formatCurrency(due)}</td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleOpenPayment(bill)}
                                                className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                {t('purchases.pay_now')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-sm">
                            <tr>
                                <th className="p-4">{t('common.date')}</th>
                                <th className="p-4">{t('common.type')}</th>
                                <th className="p-4">{t('common.reference')}</th>
                                <th className="p-4 text-right">{t('common.amount')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {history.map((item: any) => {
                                const isPayment = 'paymentMode' in item;
                                const isReturn = !isPayment && item.type === 'return';

                                return (
                                    <tr key={`${isPayment ? 'pay' : 'po'}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="p-4 dark:text-slate-300 font-mono text-sm">{formatDate(item.date)}</td>
                                        <td className="p-4">
                                            {isPayment ? (
                                                <span className="flex items-center gap-1 text-green-600 font-medium text-sm">
                                                    <CreditCard size={14} /> {t('purchases.payment')} ({item.paymentMode})
                                                </span>
                                            ) : isReturn ? (
                                                <span className="flex items-center gap-1 text-amber-600 font-medium text-sm">
                                                    <RotateCcw size={14} /> {t('purchases.return')}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-blue-600 font-medium text-sm">
                                                    <FileText size={14} /> {t('purchases.bill')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 dark:text-slate-300 text-sm">
                                            {isPayment ? (
                                                <div className="flex flex-col">
                                                    {item.reference && <span className="font-bold text-xs bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded w-fit mb-0.5">{item.reference}</span>}
                                                    <span>{item.note || '-'}</span>
                                                </div>
                                            ) : item.orderNumber}
                                        </td>
                                        <td className={`p-4 text-right font-bold ${isPayment || isReturn ? 'text-green-600' : 'text-red-500'}`}>
                                            {isPayment ? `-${formatCurrency(item.amount)}` :
                                                isReturn ? `-${formatCurrency(item.totalAmount)}` :
                                                    `+${formatCurrency(item.totalAmount)}`}
                                        </td>
                                    </tr>
                                )
                            })}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">
                                        {t('common.no_history')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold dark:text-white mb-4">{t('purchases.record_payment')}</h3>

                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                                    <div className="flex justify-between text-sm mb-1 text-slate-500">
                                        <span>{t('purchases.bill_no')}</span>
                                        <span className="font-mono">{selectedBill?.orderNumber}</span>
                                    </div>
                                    <div className="flex justify-between font-bold dark:text-white">
                                        <span>{t('purchases.balance_due')}</span>
                                        <span className="text-red-500">{formatCurrency(parseFloat(payAmount))}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.amount')}</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold text-lg"
                                        value={payAmount}
                                        onChange={e => setPayAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.date')}</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        value={payDate}
                                        onChange={e => setPayDate(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.payment_mode')}</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        value={payMode}
                                        onChange={e => setPayMode(e.target.value)}
                                    >
                                        <option value="cash">{t('pos.pay_cash')}</option>
                                        <option value="card">{t('pos.pay_card')}</option>
                                        <option value="upi">{t('pos.pay_digital')}</option>
                                        <option value="bank_transfer">{t('pos.pay_bank')}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.notes')}</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        rows={2}
                                        value={payNote}
                                        onChange={e => setPayNote(e.target.value)}
                                        placeholder={t('common.notes_placeholder')}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleSavePayment}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
                                >
                                    {t('common.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierDetails;

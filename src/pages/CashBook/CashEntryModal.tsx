import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, FileText, Tag, Clock } from 'lucide-react';
import { db, type CashEntry } from '../../services/db';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { format } from 'date-fns';

interface CashEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    type: 'in' | 'out';
    partyId?: number; // New optional prop
    editEntry?: CashEntry;
}

const CashEntryModal: React.FC<CashEntryModalProps> = ({ isOpen, onClose, onSave, type, partyId, editEntry }) => {
    const { t } = useTranslation();
    const { addToast } = useNotification();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));

    useEffect(() => {
        if (editEntry) {
            setAmount(editEntry.amount.toString());
            setDescription(editEntry.description);
            setCategory(editEntry.category);
            setDate(format(editEntry.date, 'yyyy-MM-dd'));
            setTime(format(editEntry.date, 'HH:mm'));
        } else {
            setAmount('');
            setDescription('');
            setCategory('');
            setDate(new Date().toISOString().split('T')[0]);
            setTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
        }
    }, [editEntry, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!amount || parseFloat(amount) <= 0) {
            addToast(t('cashbook.invalid_amount'), 'error');
            return;
        }

        try {
            // Combine Date and Time
            const entryDate = new Date(`${date}T${time}`);

            if (editEntry && editEntry.id) {
                await db.cashEntries.update(editEntry.id, {
                    amount: parseFloat(amount),
                    date: entryDate,
                    category: category || (type === 'in' ? 'Income' : 'Expense'),
                    description: description || (type === 'in' ? 'Cash Received' : 'Cash Paid'),
                });
                addToast(t('cashbook.entry_updated'), 'success');
            } else {
                const entry: CashEntry = {
                    type,
                    amount: parseFloat(amount),
                    date: entryDate,
                    category: category || (type === 'in' ? 'Income' : 'Expense'),
                    description: description || (type === 'in' ? 'Cash Received' : 'Cash Paid'),
                    paymentMode: 'cash',
                    partyId: partyId // Save linkage
                };
                await db.cashEntries.add(entry);
                addToast(type === 'in' ? t('cashbook.cash_added') : t('cashbook.cash_paid'), 'success');
            }

            // Reset & Close
            setAmount('');
            setDescription('');
            setCategory('');
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            addToast(t('cashbook.save_failed'), 'error');
        }
    };

    // const isCashIn = type === 'in'; // Unused

    const displayType = editEntry ? editEntry.type : type;
    const isEditMode = !!editEntry;
    const isDisplayCashIn = displayType === 'in';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className={`p-4 flex justify-between items-center ${isDisplayCashIn ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        {isDisplayCashIn ? (
                            <>
                                <DollarSign size={20} />
                                {isEditMode ? t('cashbook.edit_cash_in') : t('cashbook.cash_in')}
                            </>
                        ) : (
                            <>
                                <DollarSign size={20} />
                                {isEditMode ? t('cashbook.edit_cash_out') : t('cashbook.cash_out')}
                            </>
                        )}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Amount */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('dashboard.amount')}</label>
                        <div className="relative">
                            <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDisplayCashIn ? 'text-green-600' : 'text-red-600'}`} size={20} />
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-lg font-bold outline-none transition-all"
                                placeholder={t('common.placeholder_amount')}
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashbook.date')}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashbook.time')}</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description (Remark) */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashbook.remark')}</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none dark:text-white"
                                placeholder={t('common.placeholder_details')}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashbook.category')}</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none dark:text-white"
                                placeholder={isDisplayCashIn ? t('cashbook.cat_placeholder_in') : t('cashbook.cat_placeholder_out')}
                                list="categories"
                            />
                            <datalist id="categories">
                                <option value="Sales" />
                                <option value="Payment" />
                                <option value="Expense" />
                                <option value="Salary" />
                                <option value="Rent" />
                                <option value="Personal" />
                            </datalist>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className={`w-full py-3 rounded-xl text-white font-bold shadow-lg transition-all transform active:scale-95 flex justify-center items-center gap-2 ${isDisplayCashIn
                            ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20'
                            : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                            }`}
                    >
                        {isDisplayCashIn ? <DollarSign size={20} /> : <DollarSign size={20} />}
                        {isEditMode ? t('common.update') : (isDisplayCashIn ? t('cashbook.save_in') : t('cashbook.save_out'))}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CashEntryModal;

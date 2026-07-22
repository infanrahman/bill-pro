import React, { useState } from 'react';
import { X, User, Phone, DollarSign, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { db, type CashParty, createRecordMetadata } from '../../services/db';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';

interface AddPartyModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: () => void;
 defaultType?: 'customer' | 'supplier' | 'other';
}

const AddPartyModal: React.FC<AddPartyModalProps> = ({ isOpen, onClose, onSave, defaultType = 'other' }) => {
 const { t } = useTranslation();
 const { addToast } = useNotification();

 const [name, setName] = useState('');
 const [phone, setPhone] = useState('');
 const [openingBalance, setOpeningBalance] = useState('');
 const [balanceType, setBalanceType] = useState<'pay' | 'collect'>('collect'); // pay = I give (Liability), collect = I get (Asset)

 if (!isOpen) return null;

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!name.trim()) {
 addToast(t('common.required'), 'error');
 return;
 }

 try {
 // Calculate final opening balance
 // If 'pay' (I will give), it's negative.
 // If 'collect' (I will get), it's positive.
 let bal = parseFloat(openingBalance) || 0;
 if (balanceType === 'pay') {
 bal = -Math.abs(bal);
 } else {
 bal = Math.abs(bal);
 }

 const newParty: CashParty = {
 ...createRecordMetadata(),
 name,
 phone,
 openingBalance: bal,
 type: defaultType,
 createdAt: new Date()
 };

 await db.cashParties.add(newParty);
 addToast(t('cashbook.party_added_success'), 'success');

 // Reset
 setName('');
 setPhone('');
 setOpeningBalance('');
 setBalanceType('collect');

 onSave();
 onClose();
 } catch (error) {
 console.error(error);
 addToast(t('cashbook.party_add_error'), 'error');
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md fade-in">
 <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden zoom-in-95">
 {/* Header */}
 <div className="p-4 flex justify-between items-center bg-indigo-600 text-white">
 <h2 className="text-lg font-bold flex items-center gap-2">
 <User size={20} />
 {t('cashbook.add_party_title')}
 </h2>
 <button type="button"onClick={onClose} className="p-1 hover:bg-white rounded-full">
 <X size={20} />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="p-6 space-y-4">
 {/* Name */}
 <div className="space-y-1">
 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashbook.label_party_name')}</label>
 <div className="relative">
 <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"size={18} />
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/75 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
 placeholder={t('cashbook.placeholder_party_name')}
 autoFocus
 required
 />
 </div>
 </div>

 {/* Phone */}
 <div className="space-y-1">
 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashbook.label_phone_optional')}</label>
 <div className="relative">
 <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"size={18} />
 <input
 type="tel"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/75 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
 placeholder={t('cashbook.placeholder_phone')}
 />
 </div>
 </div>

 {/* Opening Balance */}
 <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashbook.label_opening_balance')}</label>

 <div className="flex gap-2 mb-2">
 <button
 type="button"
 onClick={() => setBalanceType('collect')}
 className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${balanceType === 'collect'
 ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500 ring-offset-1'
 : 'border-slate-200 text-slate-700 hover:bg-slate-50'
 }`}
 >
 <ArrowDownCircle size={16} />
 {t('cashbook.btn_receive')}
 </button>
 <button
 type="button"
 onClick={() => setBalanceType('pay')}
 className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${balanceType === 'pay'
 ? 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-500 ring-offset-1'
 : 'border-slate-200 text-slate-700 hover:bg-slate-50'
 }`}
 >
 <ArrowUpCircle size={16} />
 {t('cashbook.btn_pay')}
 </button>
 </div>

 <div className="relative">
 <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 ${balanceType === 'collect' ? 'text-green-600' : 'text-red-600'}`} size={20} />
 <input
 type="number"
 step="0.01"
 value={openingBalance}
 onChange={(e) => setOpeningBalance(e.target.value)}
 className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/75 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 font-mono text-lg font-bold outline-none ${balanceType === 'collect' ? 'focus:ring-green-500 focus:border-green-500 text-green-600' : 'focus:ring-red-500 focus:border-red-500 text-red-600'
 }`}
 placeholder={t('common.placeholder_amount')}
 />
 </div>
 </div>

 <button
 type="submit"
 className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transform active:scale-95 mt-4"
 >
 {t('common.save')}
 </button>
 </form>
 </div>
 </div>
);
};

export default AddPartyModal;

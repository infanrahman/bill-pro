import React, { useState } from 'react';
import { Save, User, Phone, Mail, MapPin, CreditCard, Sparkles, X } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { useNotification } from '../../contexts/NotificationContext';
import { db, type Customer, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface CustomerFormProps {
 customer?: Customer;
 onClose: () => void;
 onSave: () => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onClose, onSave }) => {
 const { t } = useTranslation();
 const [formData, setFormData] = useState<Partial<Customer>>(customer || {
 name: '',
 phone: '',
 email: '',
 address: '',
 totalSpent: 0,
 loyaltyPoints: 0
 });
 const { addToast } = useNotification();

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
 if (customer?.id) {
 await db.customers.update(customer.id, { ...formData, ...updateRecordMetadata() });
 addToast(t('customers.update_success'), 'success');
 } else {
 if (formData.phone) {
 const existing = await db.customers
 .where('phone')
 .equals(formData.phone)
 .filter(c => !c.deletedAt)
 .first();
 if (existing) {
 addToast(t('customers.exists_error'), 'warning');
 return;
 }
 }
 await db.customers.add({ ...formData, ...createRecordMetadata() } as Customer);
 addToast(t('customers.add_success'), 'success');
 }
 onSave();
 onClose();
 } catch (error) {
 console.error(error);
 addToast(t('customers.save_error'), 'error');
 }
 };

 return (
 <Modal 
 isOpen={true} 
 onClose={onClose} 
 title={customer ? t('customers.edit_customer') || 'Edit Customer' : t('customers.add_customer') || 'New Customer'} 
 maxWidth="md"
 >
 <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-4 md:space-y-6">
 <div className="flex items-center gap-3 mb-2">
 <div className="p-2 bg-slate-900 dark:bg-white text-white rounded-xl">
 <Sparkles size={18} />
 </div>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('customers.profile_details') || 'Customer Profile Details'}</p>
 </div>

 <div className="space-y-4">
 <div className="group">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('customers.name')}</label>
 <div className="relative">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"size={18} />
 <input
 type="text"
 required
 placeholder="Full Name"
 className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 />
 </div>
 </div>

 <div className="group">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('customers.phone')}</label>
 <div className="relative">
 <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"size={18} />
 <input
 type="tel"
 required
 placeholder="05x xxx xxxx"
 className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
 value={formData.phone}
 onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="group">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('customers.email_optional')}</label>
 <div className="relative">
 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"size={16} />
 <input
 type="email"
 placeholder="email@example.com"
 className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
 value={formData.email || ''}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
 />
 </div>
 </div>

 <div className="group">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('customers.vat_optional')}</label>
 <div className="relative">
 <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"size={16} />
 <input
 type="text"
 placeholder="Tax ID"
 className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
 value={formData.vatNumber || ''}
 onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
 />
 </div>
 </div>
 </div>

 <div className="group">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('customers.address_optional')}</label>
 <div className="relative">
 <MapPin className="absolute left-4 top-4 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"size={18} />
 <textarea
 placeholder="Full Address"
 className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white min-h-[100px]"
 rows={2}
 value={formData.address || ''}
 onChange={(e) => setFormData({ ...formData, address: e.target.value })}
 />
 </div>
 </div>
 </div>

 <div className="flex gap-3 pt-4">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 px-6 py-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold text-[10px] uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800"
 >
 {t('common.cancel')}
 </button>
 <button
 
 
 type="submit"
 className="flex-1 bg-slate-800 dark:bg-slate-700 text-white px-6 py-4 rounded-2xl font-semibold text-[10px] uppercase tracking-wider flex items-center justify-center gap-3"
 >
 <Save size={18} />
 {customer ? t('common.update') : t('common.save')}
 </button>
 </div>
 </form>
 </Modal>
);
};

export default CustomerForm;

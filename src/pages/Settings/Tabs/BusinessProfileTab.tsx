import React, { useState, useEffect } from 'react';
import { Save, Loader2, Store, Phone, Globe, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import SettingsCard from '../components/SettingsCard';
import FormRow from '../components/FormRow';
import SettingsSectionHeader from '../components/SettingsSectionHeader';

interface BusinessDetails {
 name: string;
 address: string;
 phone: string;
 email: string;
 gstin: string;
 logoUrl?: string;
 country?: string;
 taxName?: string;
 taxRate?: number;
 vatNo?: string;
 crNo?: string;
 pincode?: string;
 buildingNumber?: string;
 district?: string;
 city?: string;
 terms?: string;
 primaryTitle?: string;
 secondaryTitle?: string;
}

const BusinessProfileTab: React.FC = () => {
 const { activeBranchId } = useAuth();
 const { addToast } = useNotification();
 const { t } = useTranslation();
 const [isSaving, setIsSaving] = useState(false);

 const branch = useLiveQuery(async () => {
 if (!activeBranchId) return undefined;
 return await db.branches.get(activeBranchId);
 }, [activeBranchId]);

 const [details, setDetails] = useState<BusinessDetails>({
 name: '', address: '', phone: '', email: '', gstin: '',
 country: 'Saudi Arabia', taxName: 'VAT', taxRate: 15,
 crNo: '', vatNo: '', primaryTitle: '', secondaryTitle: '',
 buildingNumber: '', district: '', city: ''
 });

 useEffect(() => {
 if (branch) {
 const gstin = branch.gstin || branch.vatNo || '';
 setDetails({
 name: branch.name || '',
 address: branch.location || '',
 buildingNumber: branch.buildingNumber || '',
 district: branch.district || '',
 city: branch.city || '',
 phone: branch.phone || '',
 email: branch.email || '',
 gstin,
 logoUrl: branch.logoUrl || '',
 country: branch.country || 'Saudi Arabia',
 taxName: branch.taxName || 'VAT',
 // Use nullish coalescing so taxRate=0 is preserved (not treated as falsy)
 taxRate: branch.taxRate ?? 15,
 pincode: branch.pincode ? branch.pincode.toString() : '',
 terms: branch.terms || '',
 crNo: branch.crNo || '',
 // vatNo always mirrors gstin for consistency
 vatNo: gstin,
 primaryTitle: branch.primaryTitle || '',
 secondaryTitle: branch.secondaryTitle || ''
 });
 }
 }, [branch]);

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
 setDetails({ ...details, [e.target.name]: e.target.value });
 };

 const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => {
 const base64String = reader.result as string;
 if (base64String.length > 700000) {
 addToast(t('settings.profile.logo_too_large'), 'error');
 return;
 }
 setDetails(prev => ({ ...prev, logoUrl: base64String }));
 };
 reader.readAsDataURL(file);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (isSaving) return;
 setIsSaving(true);

 try {
 if (activeBranchId) {
 const gstin = (details.gstin || '').trim();
 const taxRate = details.taxRate != null ? Number(details.taxRate) : 15;

 const updatePayload: any = {
 id: activeBranchId,
 branchId: activeBranchId,
 isMaster: true,
 status: 'active',
 name: (details.name || '').trim(),
 location: (details.address || '').trim(),
 buildingNumber: (details.buildingNumber || '').trim(),
 district: (details.district || '').trim(),
 city: (details.city || '').trim(),
 phone: (details.phone || '').trim(),
 email: (details.email || '').trim(),
 gstin,
 logoUrl: details.logoUrl || null,
 country: details.country || 'Saudi Arabia',
 taxName: details.taxName || 'VAT',
 taxRate,
 pincode: details.pincode || '',
 terms: details.terms || '',
 crNo: (details.crNo || '').trim(),
 // vatNo always mirrors gstin — single source of truth
 vatNo: gstin,
 primaryTitle: (details.primaryTitle || '').trim(),
 secondaryTitle: (details.secondaryTitle || '').trim(),
 updatedAt: new Date()
 };

 await db.branches.put(updatePayload);

 // Build a fully-normalized payload for localStorage so all consumers
 // (invoices, reports, POS, etc.) always get consistent, complete data.
 const localStoragePayload = {
 name: updatePayload.name,
 address: updatePayload.location,
 buildingNumber: updatePayload.buildingNumber,
 district: updatePayload.district,
 city: updatePayload.city,
 phone: updatePayload.phone,
 email: updatePayload.email,
 gstin,
 vatNo: gstin,
 crNo: updatePayload.crNo,
 logoUrl: updatePayload.logoUrl || '',
 country: updatePayload.country,
 taxName: updatePayload.taxName,
 taxRate,
 pincode: updatePayload.pincode,
 terms: updatePayload.terms,
 primaryTitle: updatePayload.primaryTitle,
 secondaryTitle: updatePayload.secondaryTitle,
 };

 // Write to both keys so every consumer finds data regardless of which key it reads
 const serialized = JSON.stringify(localStoragePayload);
 localStorage.setItem('businessDetails', serialized);
 localStorage.setItem('businessProfile', serialized);

 addToast(t('settings.profile.saved_success'), 'success');
 }
 } catch (error) {
 addToast(t('common.error'), 'error');
 } finally {
 setIsSaving(false);
 }
 };

 return (
 <div className="space-y-12 pb-20">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
 <SettingsSectionHeader 
 title={t('settings.profile.title')} 
 description={t('settings.profile.subtitle', 'Establish your business identity, contact details, and tax credentials')} 
 />
 <button type="button"
 
 
 onClick={handleSubmit}
 disabled={isSaving}
 className="flex items-center gap-3 px-10 py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-semibold text-xs uppercase tracking-wide disabled:opacity-50 shrink-0"
 >
 {isSaving ? <Loader2 size={18} className=""/> : <Save size={18} />}
 {isSaving ? t('common.saving') : t('common.save_profile')}
 </button>
 </div>

 <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
 
 <div className="space-y-10">
 <SettingsCard title={t('settings.profile.brand_section', 'Identity & Brand')} icon={Store}>
 <div className="space-y-8">
 <div className="flex flex-col items-center gap-6 p-8 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 group relative overflow-hidden">
 
 <div className="relative group/logo">
 <div className="w-32 h-32 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-center overflow-hidden group-hover/logo:scale-110">
 {details.logoUrl ? (
 <img src={details.logoUrl} alt="Logo"className="w-full h-full object-contain"/>
) : (
 <ImageIcon size={40} className="text-slate-300"/>
)}
 </div>
 <label className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white opacity-0 group-hover/logo:opacity-100 rounded-2xl cursor-pointer">
 <input type="file"accept="image/*"onChange={handleLogoUpload} className="hidden"/>
 <div className="text-center">
 <ImageIcon size={24} className="mx-auto mb-2"/>
 <span className="text-[10px] font-semibold uppercase tracking-wider">{t('common.change')}</span>
 </div>
 </label>
 </div>
 <div className="text-center relative z-10">
 <p className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-tight">{t('settings.profile.shop_logo')}</p>
 <p className="text-[10px] font-bold text-slate-600 mt-2 uppercase tracking-wider">{t('settings.profile.logo_hint', 'Max 700KB. PNG/JPG recommended.')}</p>
 </div>
 </div>

 <FormRow label={t('settings.profile.primary_title', 'Primary Title')} inline={false}>
 <div className="relative w-full group">
 <Sparkles size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"/>
 <input
 type="text"
 name="primaryTitle"
 value={details.primaryTitle || ''}
 onChange={handleChange}
 className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-xs uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 placeholder="Enter primary title"
 />
 </div>
 </FormRow>

 <FormRow label={t('settings.profile.secondary_title', 'Secondary Title')} inline={false}>
 <div className="relative w-full group">
 <Sparkles size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"/>
 <input
 type="text"
 name="secondaryTitle"
 value={details.secondaryTitle || ''}
 onChange={handleChange}
 className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-xs uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 placeholder="Enter secondary title"
 />
 </div>
 </FormRow>

 <FormRow label={t('settings.profile.business_name')} inline={false}>
 <div className="relative w-full group">
 <Store size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"/>
 <input
 type="text"
 name="name"
 value={details.name}
 onChange={handleChange}
 className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-xs uppercase tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 placeholder="Enter business name"
 required
 />
 </div>
 </FormRow>
 </div>
 </SettingsCard>

 <SettingsCard title={t('settings.profile.contact_section', 'Communication')} icon={Phone}>
 <div className="divide-y divide-slate-100/50 dark:divide-slate-700/50">
 <FormRow label={t('settings.profile.phone')} icon={Phone}>
 <input
 type="text"
 name="phone"
 value={details.phone}
 onChange={handleChange}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 />
 </FormRow>
 <FormRow label={t('settings.profile.email')} icon={Globe}>
 <input
 type="email"
 name="email"
 value={details.email}
 onChange={handleChange}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 />
 </FormRow>
 </div>
 </SettingsCard>
 </div>

 <div className="space-y-10">
 <SettingsCard title={t('settings.profile.legal_section', 'Legal & Compliance')} icon={FileText}>
 <div className="space-y-8">
  <FormRow label={t('settings.profile.address', 'Street Name')} inline={false}>
  <textarea
  name="address"
  value={details.address}
  onChange={handleChange}
  rows={2}
  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
  placeholder="Street Name"
  />
  </FormRow>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
  <div>
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Building No</label>
  <input type="text" name="buildingNumber" value={details.buildingNumber || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider outline-none dark:text-white" placeholder="e.g. 1234"/>
  </div>
  <div>
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">District</label>
  <input type="text" name="district" value={details.district || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider outline-none dark:text-white" placeholder="e.g. Al Olaya"/>
  </div>
  <div>
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">City</label>
  <input type="text" name="city" value={details.city || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider outline-none dark:text-white" placeholder="e.g. Riyadh"/>
  </div>
  </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <FormRow label={t('settings.profile.pincode')} inline={false}>
 <input
 type="text"
 name="pincode"
 value={details.pincode || ''}
 onChange={handleChange}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 />
 </FormRow>
 <FormRow label={t('settings.profile.country')} inline={false}>
 <select
 name="country"
 value={details.country || 'Saudi Arabia'}
 onChange={handleChange}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white cursor-pointer"
 >
 <option value="Saudi Arabia">Saudi Arabia (KSA)</option>
 <option value="UAE">UAE</option>
 <option value="India">India</option>
 <option value="USA">USA</option>
 </select>
 </FormRow>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100/50 dark:border-slate-700/50">
 <FormRow label={t('settings.profile.tax_reg_no')} inline={false}>
 <input
 type="text"
 name="gstin"
 value={details.gstin}
 onChange={handleChange}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 />
 </FormRow>
 <FormRow label={t('settings.profile.cr_no')} inline={false}>
 <input
 type="text"
 name="crNo"
 value={details.crNo || ''}
 onChange={handleChange}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 />
 </FormRow>
 </div>
 </div>
 </SettingsCard>

 <SettingsCard title={t('settings.profile.fine_print', 'Terms & Conditions')} icon={FileText}>
 <FormRow label={t('settings.profile.terms_conditions')} inline={false} description={t('settings.profile.terms_hint', 'Example: Goods once sold will not be returned.')}>
 <textarea
 name="terms"
 value={details.terms || ''}
 onChange={handleChange}
 rows={3}
 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-xs font-semibold tracking-wider focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white min-h-[100px]"
 />
 </FormRow>
 </SettingsCard>
 </div>
 </form>
 </div>
);
};

export default BusinessProfileTab;

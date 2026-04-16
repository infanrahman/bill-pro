import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface BusinessDetails {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin: string; // Tax Registration No
    logoUrl?: string;
    country?: string;
    taxName?: string; // e.g. 'VAT', 'GST'
    taxRate?: number;
    vatNo?: string;
    crNo?: string;
    pincode?: string;
    terms?: string; // Terms & Conditions
}

interface BusinessProfileTabProps {
    onBack?: () => void; // callback to switch back to settings tab list
}

const BusinessProfileTab: React.FC<BusinessProfileTabProps> = ({ onBack }) => {
    const { activeBranchId } = useAuth();
    const { addToast } = useNotification();
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const branch = useLiveQuery(async () => {
        if (!activeBranchId) return undefined;
        return await db.branches.get(activeBranchId);
    }, [activeBranchId]);

    const [details, setDetails] = useState<BusinessDetails>({
        name: '', address: '', phone: '', email: '', gstin: '',
        country: 'Saudi Arabia', taxName: 'VAT', taxRate: 15,
        crNo: '', vatNo: ''
    });

    useEffect(() => {
        if (branch) {
            setDetails({
                name: branch.name || '',
                address: branch.location || '',
                phone: branch.phone || '',
                email: branch.email || '',
                gstin: branch.gstin || '',
                logoUrl: branch.logoUrl,
                country: branch.country || 'India',
                taxName: branch.taxName || 'GST',
                taxRate: branch.taxRate || 0,
                pincode: branch.pincode ? branch.pincode.toString() : '',
                terms: branch.terms || '',
                crNo: branch.crNo || '',
                vatNo: branch.vatNo || branch.gstin || ''
            });
        } else {
            // Fallback to localStorage for initial migration or if no branch record exists
            const saved = localStorage.getItem('businessDetails');
            if (saved) {
                setDetails(JSON.parse(saved));
            }
        }
    }, [branch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        setShowSuccess(false);

        try {
            if (activeBranchId) {
                const existing = await db.branches.get(activeBranchId);

                // Only update profile-related fields — never overwrite id, isMaster, status, etc.
                const updatePayload: Record<string, any> = {
                    name: details.name || '',
                    location: details.address || '',
                    phone: details.phone || '',
                    email: details.email || '',
                    gstin: details.gstin || '',
                    logoUrl: details.logoUrl || null,
                    country: details.country || 'Saudi Arabia',
                    taxName: details.taxName || 'VAT',
                    taxRate: details.taxRate ? Number(details.taxRate) : 0,
                    pincode: details.pincode || '',
                    terms: details.terms || '',
                    crNo: details.crNo || '',
                    vatNo: details.vatNo || details.gstin || '',
                    updatedAt: new Date()
                };

                if (existing) {
                    await db.branches.update(activeBranchId, updatePayload);
                } else {
                    await db.branches.add({
                        id: activeBranchId,
                        branchId: activeBranchId,
                        ...updatePayload,
                        isMaster: false,
                        status: 'active',
                        createdAt: new Date(),
                    } as any);
                }

                localStorage.setItem('businessDetails', JSON.stringify({ ...details, crNo: details.crNo || '', vatNo: details.vatNo || details.gstin || '' }));

                setShowSuccess(true);
                addToast(t('settings.profile.saved_success'), 'success');

                setTimeout(() => {
                    setShowSuccess(false);
                    if (onBack) onBack();
                }, 1000);
            }
        } catch (error) {
            console.error("Error saving business profile:", error);
            addToast(t('common.error'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            {/* Header with Back Button */}
            <div className="flex items-center gap-3 mb-6">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                        title={t('common.back')}
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <h2 className="text-lg font-semibold dark:text-white">{t('settings.profile.title')}</h2>
            </div>

            {/* Success Banner */}
            {showSuccess && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 animate-fade-in">
                    <CheckCircle size={18} />
                    <span className="text-sm font-medium">{t('settings.profile.saved_success')}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

                {/* Logo Upload */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-20 h-20 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900">
                        {details.logoUrl ? (
                            <img src={details.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-xs text-slate-400">{t('settings.profile.no_logo')}</span>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.shop_logo')}</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.business_name')}</label>
                        <input
                            type="text"
                            name="name"
                            value={details.name}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.phone')}</label>
                        <input
                            type="text"
                            name="phone"
                            value={details.phone}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                        />
                    </div>

                    {/* Email moved here */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.email')}</label>
                        <input
                            type="email"
                            name="email"
                            value={details.email}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.address')}</label>
                        <textarea
                            name="address"
                            value={details.address}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            rows={2}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.pincode')}</label>
                        <input
                            type="text"
                            name="pincode"
                            value={details.pincode || ''}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.country')}</label>
                        <select
                            name="country"
                            value={details.country || 'India'}
                            onChange={(e) => setDetails({ ...details, country: e.target.value })}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="India">India</option>
                            <option value="Saudi Arabia">Saudi Arabia (KSA)</option>
                            <option value="UAE">United Arab Emirates (UAE)</option>
                            <option value="USA">United States</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.tax_name')}</label>
                        <input
                            type="text"
                            name="taxName"
                            value={details.taxName || ''}
                            placeholder="VAT"
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.tax_rate')}</label>
                        <input
                            type="number"
                            name="taxRate"
                            value={details.taxRate || ''}
                            placeholder="15"
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.tax_reg_no')}</label>
                        <input
                            type="text"
                            name="gstin"
                            value={details.gstin}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.cr_no')}</label>
                        <input
                            type="text"
                            name="crNo"
                            value={details.crNo || ''}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.profile.terms_conditions')}</label>
                        <textarea
                            name="terms"
                            value={details.terms || ''}
                            placeholder={t('settings.profile.terms_placeholder', 'Example: Goods once sold will not be returned.')}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            rows={3}
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold transition-colors w-full md:w-auto min-w-[140px]"
                >
                    {isSaving ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            {t('common.saving', 'Saving...')}
                        </>
                    ) : (
                        <>
                            <Save size={18} /> {t('common.save')}
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default BusinessProfileTab;


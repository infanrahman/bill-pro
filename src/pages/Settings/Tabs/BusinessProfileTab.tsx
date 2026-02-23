import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';

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

const BusinessProfileTab: React.FC = () => {
    // const { isAdmin } = useAuth(); // Might use for permissions later
    const { addToast } = useNotification();

    const [details, setDetails] = useState<BusinessDetails>({
        name: '', address: '', phone: '', email: '', gstin: '',
        country: 'India', taxName: 'GST',
    });

    useEffect(() => {
        const saved = localStorage.getItem('businessDetails');
        if (saved) {
            setDetails(JSON.parse(saved));
        }
    }, []);

    const { t } = useTranslation();

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('businessDetails', JSON.stringify(details));
        addToast(t('settings.profile.saved_success'), 'success');
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">{t('settings.profile.title')}</h2>
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
                            value={(details as any).terms || ''} // Cast to any to avoid TS error until interface updated
                            placeholder={t('settings.profile.terms_placeholder', 'Example: Goods once sold will not be returned.')}
                            onChange={handleChange}
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            rows={3}
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors w-full md:w-auto"
                >
                    <Save size={18} /> {t('common.save')}
                </button>
            </form>
        </div>
    );
};

export default BusinessProfileTab;

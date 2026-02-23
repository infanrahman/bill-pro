import React, { useState } from 'react';
import { X, Send, Mail } from 'lucide-react'; // Removed FileSpreadsheet, FileText
import { useTranslation } from 'react-i18next';
// Removed excelGenerator, downloadInvoicePDF imports
import { generateInvoiceText } from '../../utils/shareUtils';
import type { Invoice, Purchase } from '../../services/db';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: Invoice | Purchase;
    type: 'invoice' | 'purchase';
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, data, type }) => {
    const { t } = useTranslation();
    // Removed format state
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleShare = async (platform: 'whatsapp' | 'email') => {
        setLoading(true);
        try {
            const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || 'null');

            // Generate formatted text
            const invoiceText = generateInvoiceText(data, type, businessDetails);
            const encodedText = encodeURIComponent(invoiceText);

            // Get contact info
            const phone = (data as any).customerPhone || (data as any).phone || '';
            const email = (data as any).email || (data as any).customerEmail || '';

            if (platform === 'whatsapp') {
                // Smart Linking: Try App (whatsapp://) -> Fallback Web (https://web.whatsapp.com)
                const appUrl = `whatsapp://send?phone=${phone}&text=${encodedText}`;
                const webUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`;

                if (window.electron && window.electron.openExternal) {
                    // Try to open external link (App)
                    const success = await window.electron.openExternal(appUrl);
                    if (!success) {
                        console.warn("WhatsApp App not found, falling back to Web.");
                        window.open(webUrl, '_blank');
                    }
                } else {
                    // Browser Fallback (Usually opens same tab or redirect)
                    window.open(webUrl, '_blank');
                }
            } else {
                // Email
                window.open(`mailto:${email}?subject=${type.toUpperCase()} #${(data as any).invoiceNumber || (data as any).orderNumber}&body=${encodedText}`, '_blank');
            }

            onClose();
        } catch (error) {
            console.error("Sharing failed", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-scale-in">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Send size={20} className="text-blue-600" />
                        {type === 'invoice' ? t('sales.share_invoice') || 'Share Invoice' : t('purchases.share_bill') || 'Share Bill'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Note: Sharing as text now */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                        <p>{t('common.share_text_info') || 'The invoice details will be formatted as text and sent directly via WhatsApp or Email.'}</p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleShare('whatsapp')}
                            disabled={loading}
                            className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Send size={20} />
                            {t('common.share_whatsapp') || 'Share via WhatsApp'}
                        </button>
                        <button
                            onClick={() => handleShare('email')}
                            disabled={loading}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Mail size={20} />
                            {t('common.share_email') || 'Share via Email'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;

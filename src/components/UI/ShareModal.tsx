import React, { useState } from 'react';
import { X, Send, Mail, Share2 } from 'lucide-react'; 
import { useTranslation } from 'react-i18next';
import { generateInvoiceText } from '../../utils/shareUtils';
import type { Invoice, Purchase } from '../../services/db';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Invoice | Purchase;
  type: 'invoice' | 'purchase';
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, data, type }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (platform: 'whatsapp' | 'email' | 'native') => {
    setLoading(true);
    try {
      const businessDetails = JSON.parse(localStorage.getItem('businessDetails') || 'null');
      const title = type === 'invoice' ? t('sales.invoice') || 'Invoice' : t('purchases.bill') || 'Bill';

      // Generate formatted text
      const invoiceText = generateInvoiceText(data, type, businessDetails, title);
      const encodedText = encodeURIComponent(invoiceText);

      // Get contact info
      const phone = (data as any).customerPhone || (data as any).phone || '';
      const email = (data as any).email || (data as any).customerEmail || '';

      if (platform === 'native' && Capacitor.isNativePlatform()) {
        await Share.share({
          title: `${title} #${(data as any).invoiceNumber || (data as any).orderNumber}`,
          text: invoiceText,
          dialogTitle: 'Share with',
        });
      } else if (platform === 'whatsapp') {
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
      } else if (platform === 'email') {
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
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4">
 <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden">
 <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/75 backdrop-blur-md">
 <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
 <Send size={20} className="text-slate-900 dark:text-white"/>
 {type === 'invoice' ? t('sales.share_invoice') || 'Share Invoice' : t('purchases.share_bill') || 'Share Bill'}
 </h3>
 <button type="button"onClick={onClose} className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-200">
 <X size={20} />
 </button>
 </div>

 <div className="p-6 space-y-6">
 {/* Note: Sharing as text now */}
 <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white">
 <p>{t('common.share_text_info') || 'The invoice details will be formatted as text and sent directly via WhatsApp or Email.'}</p>
 </div>

 {/* Actions */}
 <div className="space-y-3">
 {Capacitor.isNativePlatform() && (
 <button type="button"
 onClick={() => handleShare('native')}
 disabled={loading}
 className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
 >
 <Share2 size={20} />
 {t('common.share_native') || 'Share via Device'}
 </button>
 )}
 <button type="button"
 onClick={() => handleShare('whatsapp')}
 disabled={loading}
 className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
 >
 <Send size={20} />
 {t('common.share_whatsapp') || 'Share via WhatsApp'}
 </button>
 <button type="button"
 onClick={() => handleShare('email')}
 disabled={loading}
 className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
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

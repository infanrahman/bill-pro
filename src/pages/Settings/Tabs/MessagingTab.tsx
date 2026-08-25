import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, MessageSquare, Shield, Globe, ExternalLink } from 'lucide-react';
import { messagingService } from '../../../services/messagingService';
import { useNotification } from '../../../contexts/NotificationContext';

const MessagingTab: React.FC = () => {
 const { t } = useTranslation();
 const { addToast } = useNotification();
 const [config, setConfig] = useState<any>({
 enabled: false,
 provider: 'ultramsg',
 apiKey: '',
 instanceId: '',
 portalUrl: 'https://portal.billpro.app'
 });

 useEffect(() => {
 const saved = messagingService.getWhatsAppConfig();
 if (saved) setTimeout(() => setConfig(saved), 0);
 }, []);

 const handleSave = () => {
 messagingService.saveWhatsAppConfig(config);
 addToast(t('settings.messaging_saved', 'Messaging settings saved!'), 'success');
 };

 return (
 <div className="space-y-8">
 <div className="flex justify-between items-end">
 <div>
 <h2 className="text-3xl font-semibold text-slate-800 dark:text-white tracking-tight">{t('settings.tabs.messaging', 'Customer Messaging')}</h2>
 <p className="text-slate-700 mt-1 font-medium">{t('settings.messaging_desc', 'Configure automated WhatsApp and SMS notifications for your customers.')}</p>
 </div>
 <button type="button"
 onClick={handleSave}
 className="px-8 py-3 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white rounded-xl font-bold active:scale-95"
 >
 {t('common.save_changes')}
 </button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Main Settings */}
 <div className="lg:col-span-2 space-y-6">
 <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700">
 <div className="flex items-center gap-3 mb-6">
 <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600">
 <MessageSquare size={20} />
 </div>
 <h3 className="text-lg font-semibold dark:text-white uppercase tracking-wider">{t('settings.whatsapp_config', 'WhatsApp Automation')}</h3>
 </div>

 <div className="space-y-6">
 <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl cursor-pointer group">
 <div>
 <span className="block font-bold dark:text-white">{t('settings.enable_auto_whatsapp', 'Enable Automated WhatsApp')}</span>
 <span className="text-xs text-slate-700">{t('settings.auto_whatsapp_desc', 'Automatically send a thank you message and loyalty points balance after checkout.')}</span>
 </div>
 <div className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={config.enabled}
 onChange={e => setConfig({ ...config, enabled: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after: dark:border-gray-600 peer-checked:bg-green-600"></div>
 </div>
 </label>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1">{t('settings.provider', 'Provider')}</label>
 <select
 value={config.provider}
 onChange={e => setConfig({ ...config, provider: e.target.value })}
 className="w-full p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white font-bold focus:border-slate-900 dark:focus:border-white outline-none"
 >
 <option value="ultramsg">UltraMsg (Recommended)</option>
 <option value="twilio">Twilio</option>
 <option value="custom">Custom Webhook</option>
 </select>
 </div>
 <div className="space-y-2">
 <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1">Instance ID</label>
 <input
 type="text"
 value={config.instanceId || ''}
 onChange={e => setConfig({ ...config, instanceId: e.target.value })}
 placeholder="e.g. instance12345"
 className="w-full p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white font-bold focus:border-slate-900 dark:focus:border-white outline-none"
 />
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1">API Token / Secret Key</label>
 <div className="relative">
 <input
 type="password"
 value={config.apiKey || ''}
 onChange={e => setConfig({ ...config, apiKey: e.target.value })}
 placeholder="Enter your API token"
 className="w-full p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white font-bold focus:border-slate-900 dark:focus:border-white outline-none"
 />
 <Shield size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"/>
 </div>
 </div>
 </div>
 </div>

 <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700">
 <div className="flex items-center gap-3 mb-6">
 <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white">
 <Globe size={20} />
 </div>
 <h3 className="text-lg font-semibold dark:text-white uppercase tracking-wider">{t('settings.customer_portal', 'Customer Portal')}</h3>
 </div>

 <div className="space-y-2">
 <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1">{t('settings.portal_url', 'Portal Base URL')}</label>
 <div className="flex gap-2">
 <input
 type="text"
 value={config.portalUrl || ''}
 onChange={e => setConfig({ ...config, portalUrl: e.target.value })}
 placeholder="https://portal.billpro.app"
 className="flex-1 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white font-bold focus:border-slate-900 dark:focus:border-white outline-none"
 />
 <a 
 href={config.portalUrl} 
 target="_blank"
 rel="noreferrer"
 className="p-4 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-700 hover:text-slate-900 dark:hover:text-white"
 >
 <ExternalLink size={20} />
 </a>
 </div>
 <p className="text-[10px] text-slate-700 px-1 italic">
 {t('settings.portal_hint', 'This link will be included in messages so customers can view their invoices online.')}
 </p>
 </div>
 </div>
 </div>

 {/* Preview / Tips */}
 <div className="space-y-6">
 <div className="bg-slate-900 dark:bg-white text-white p-8 rounded-3xl relative overflow-hidden">
 <div className="absolute -right-4 -top-4 w-24 h-24 bg-white rounded-full blur-2xl"></div>
 <h4 className="font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
 <Send size={18} />
 {t('settings.message_preview', 'Message Preview')}
 </h4>
 <div className="bg-white rounded-2xl p-4 text-xs font-medium leading-relaxed border border-white/10">
 <p className="mb-2"><strong>Thank you for shopping with us, John Doe!</strong></p>
 <p>Your order <strong>#INV-001</strong> for <strong>$150.00</strong> has been confirmed.</p>
 <p>You earned <strong>150</strong> loyalty points. Your total points: <strong>1250</strong>.</p>
 <br />
 <p>See you again soon!</p>
 <p className="text-slate-700 dark:text-slate-300 mt-2">{config.portalUrl}/view/INV-001</p>
 </div>
 </div>
 </div>
 </div>
 </div>
);
};

export default MessagingTab;

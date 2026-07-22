import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import BusinessProfileTab from './Tabs/BusinessProfileTab';
import RemindersTab from './Tabs/RemindersTab';
import InvoicePrintTab from './Tabs/InvoicePrintTab';
import DataBackupTab from './Tabs/DataBackupTab';
import GeneralTab from './Tabs/GeneralTab';
import ActivityLogTab from './Tabs/ActivityLogTab';
import UserManagementTab from './Tabs/UserManagementTab';
import MessagingTab from './Tabs/MessagingTab';
import HelpTab from './Tabs/HelpTab';
import { 
 Scale as ScaleIcon, Building2, Cpu, Lock, LayoutGrid, MessageSquare,
 User, Printer, Users, ShieldCheck, Shield, Settings as SettingsIcon, Keyboard, Bell, Database, HelpCircle,
 Sparkles, ChevronRight
} from 'lucide-react';
import ZatcaTab from './Tabs/ZatcaTab';
import LicenseTab from './Tabs/LicenseTab';
import ScaleTab from './Tabs/ScaleTab';
import KeyboardShortcutsTab from './Tabs/KeyboardShortcutsTab';
import clsx from 'clsx';

const Settings: React.FC = () => {
 const { user, hasPermission } = useAuth();
 const { t } = useTranslation();
 const [activeTab, setActiveTab] = useState('general');

 const categories = [
 {
 id: 'business',
 label: t('settings.categories.business', 'Store & Business'),
 icon: Building2,
 tabs: [
 { id: 'profile', label: t('settings.tabs.business_profile'), icon: User, permission: 'settings_general' },
 ]
 },
 {
 id: 'hardware',
 label: t('settings.categories.hardware', 'Devices & Hardware'),
 icon: Cpu,
 tabs: [
 { id: 'print', label: t('settings.tabs.invoice_print'), icon: Printer, permission: 'settings_invoice' },
 { id: 'scales', label: t('settings.tabs.scales', 'Scale Management'), icon: ScaleIcon, permission: 'settings_printers' },
 ]
 },
 {
 id: 'security',
 label: t('settings.categories.security', 'Security & Compliance'),
 icon: Lock,
 tabs: [
 { id: 'users', label: t('settings.tabs.users_roles'), icon: Users, permission: 'users_manage' },
 { id: 'zatca', label: t('settings.tabs.zatca'), icon: ShieldCheck, permission: 'admin' },
 { id: 'logs', label: t('settings.tabs.activity_logs'), icon: Shield, permission: 'admin' },
 { id: 'license', label: t('settings.tabs.license'), icon: ShieldCheck, permission: 'admin' },
 ]
 },
 {
 id: 'system',
 label: t('settings.categories.system', 'App Preferences'),
 icon: LayoutGrid,
 tabs: [
 { id: 'general', label: t('settings.tabs.general'), icon: SettingsIcon, permission: 'settings_general' },
 { id: 'shortcuts', label: t('settings.tabs.shortcuts'), icon: Keyboard, permission: null },
 { id: 'reminders', label: t('settings.tabs.reminders'), icon: Bell, permission: 'settings_general' },
 { id: 'backup', label: t('settings.tabs.data_backup'), icon: Database, permission: 'settings_backup' },
 { id: 'help', label: t('settings.tabs.help'), icon: HelpCircle, permission: null },
 ]
 },
 {
 id: 'engagement',
 label: t('settings.categories.engagement', 'Engagement & Marketing'),
 icon: MessageSquare,
 tabs: [
 { id: 'messaging', label: t('settings.tabs.messaging', 'Customer Messaging'), icon: MessageSquare, permission: 'settings_general' },
 ]
 }
 ];

 const filteredCategories = categories.map(cat => ({
 ...cat,
 tabs: cat.tabs.filter((tab: any) => {
 if (!tab.permission) return true;
 if (tab.permission === 'admin') return user?.role === 'admin';
 return user?.role === 'admin' || hasPermission(tab.permission);
 })
 })).filter(cat => cat.tabs.length > 0);

 const renderTab = () => {
 switch (activeTab) {
 case 'general': return <GeneralTab />;
 case 'license': return <LicenseTab />;
 case 'shortcuts': return <React.Suspense fallback={<div className="p-8 text-slate-600">Loading...</div>}><KeyboardShortcutsTab /></React.Suspense>;
 case 'profile': return <BusinessProfileTab />;
 case 'zatca': return <ZatcaTab />;
 case 'users': return <UserManagementTab />;
 case 'reminders': return <RemindersTab />;
 case 'print': return <InvoicePrintTab />;
 case 'scales': return <ScaleTab />;
 case 'backup': return <DataBackupTab />;
 case 'logs': return <ActivityLogTab />;
 case 'messaging': return <MessagingTab />;
 case 'help': return <HelpTab />;
 default: return <GeneralTab />;
 }
 };

 return (
 <div className="flex h-[calc(100vh-6rem)] bg-white dark:bg-slate-900 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
 {/* Sidebar */}
 <div className="w-48 md:w-56 lg:w-60 shrink-0 bg-slate-50 dark:bg-slate-900 flex flex-col h-full border-r border-slate-200 dark:border-slate-800 overflow-hidden">
 {/* Header */}
 <div className="px-5 py-6 border-b border-slate-200 dark:border-slate-800">
 <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-3 uppercase">
 <div className="p-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl">
 <SettingsIcon size={18} />
 </div>
 {t('settings.title')}
 </h1>
 <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-[0.25em] mt-2 ml-0.5 flex items-center gap-1.5">
 <Sparkles size={10} className="text-amber-500"/>
 App Configuration
 </p>
 </div>

 {/* Nav */}
 <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
 {filteredCategories.map((category) => (
 <div key={category.id} className="space-y-1">
 <h2 className="px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
 <category.icon size={10} />
 {category.label}
 </h2>
 {category.tabs.map((tab: any) => {
 const Icon = tab.icon;
 const isActive = activeTab === tab.id;
 return (
 <button type="button"
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={clsx(
"w-full flex items-center justify-between px-3 py-2.5 rounded-xl group",
 isActive
 ? 'bg-slate-800 dark:bg-slate-700 text-white '
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
)}
 >
 <div className="flex items-center gap-2.5">
 <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
 <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{tab.label}</span>
 </div>
 <ChevronRight size={12} className={clsx("shrink-0", isActive ?"opacity-100":"opacity-0 group-hover:opacity-50")} />
 </button>
);
 })}
 </div>
))}
 </nav>
 </div>

 {/* Content Area */}
 <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white dark:bg-slate-900 custom-scrollbar min-w-0">
 <div className="w-full mx-auto h-full flex flex-col">
 {renderTab()}
 </div>
 </div>
 </div>
);
};

export default Settings;

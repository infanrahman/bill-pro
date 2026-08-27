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
import NetworkSyncTab from './Tabs/NetworkSyncTab';
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
 { id: 'network', label: 'Local Sync & Network', icon: Database, permission: 'settings_general' },
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
 case 'network': return <NetworkSyncTab />;
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
 <div className="flex flex-col md:flex-row h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] bg-white dark:bg-slate-900 overflow-hidden rounded-none md:rounded-2xl border-0 md:border border-slate-200 dark:border-slate-800">
 {/* Sidebar */}
 <div className="w-full md:w-56 lg:w-60 shrink-0 bg-slate-50 dark:bg-slate-900 flex flex-col md:h-full border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 overflow-hidden z-10">
 {/* Header */}
 <div className="px-4 md:px-5 py-4 md:py-6 border-b border-slate-200 dark:border-slate-800 flex md:block items-center justify-between">
 <div>
 <h1 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 md:gap-3 uppercase">
 <div className="p-1.5 md:p-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg md:rounded-xl">
 <SettingsIcon size={16} className="md:w-[18px] md:h-[18px]" />
 </div>
 {t('settings.title')}
 </h1>
 <p className="hidden md:flex text-[9px] font-semibold text-slate-600 uppercase tracking-[0.25em] mt-2 ml-0.5 items-center gap-1.5">
 <Sparkles size={10} className="text-amber-500"/>
 App Configuration
 </p>
 </div>
 </div>

 {/* Nav */}
 <nav className="flex md:flex-col px-2 md:px-3 py-3 md:py-4 gap-2 md:gap-0 space-y-0 md:space-y-6 overflow-x-auto md:overflow-y-auto custom-scrollbar">
 {filteredCategories.map((category) => (
 <div key={category.id} className="flex md:block items-center space-y-0 md:space-y-1 gap-2 md:gap-0 shrink-0 md:shrink">
 <h2 className="hidden md:flex px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 items-center gap-1.5 mb-2">
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
 "flex items-center justify-between px-3 md:px-3 py-2 md:py-2.5 rounded-lg md:rounded-xl group shrink-0 md:w-full",
 isActive
 ? 'bg-slate-800 dark:bg-slate-700 text-white '
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 bg-slate-100 md:bg-transparent'
 )}
 >
 <div className="flex items-center gap-2 md:gap-2.5">
 <Icon size={14} className="md:w-[15px] md:h-[15px]" strokeWidth={isActive ? 2.5 : 2} />
 <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap md:truncate">{tab.label}</span>
 </div>
 <ChevronRight size={12} className={clsx("hidden md:block shrink-0", isActive ?"opacity-100":"opacity-0 group-hover:opacity-50")} />
 </button>
 );
 })}
 </div>
 ))}
 </nav>
 </div>

 {/* Content Area */}
 <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-slate-900 custom-scrollbar min-w-0 h-full">
 <div className="w-full mx-auto h-full flex flex-col">
 {renderTab()}
 </div>
 </div>
 </div>
);
};

export default Settings;

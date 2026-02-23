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
import HelpTab from './Tabs/HelpTab';
import { User, Bell, Printer, Database, Settings as SettingsIcon, Shield, Users, HelpCircle, ShieldCheck, Keyboard } from 'lucide-react';

import ZatcaTab from './Tabs/ZatcaTab';
import LicenseTab from './Tabs/LicenseTab';

import KeyboardShortcutsTab from './Tabs/KeyboardShortcutsTab';

const Settings: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('general');

    const allTabs = [
        { id: 'general', label: t('settings.tabs.general'), icon: SettingsIcon, permission: null },
        { id: 'shortcuts', label: t('settings.tabs.shortcuts'), icon: Keyboard, permission: null },
        { id: 'license', label: t('settings.tabs.license'), icon: ShieldCheck, permission: 'admin' },
        { id: 'profile', label: t('settings.tabs.business_profile'), icon: User, permission: 'admin' }, // Usually only admin
        { id: 'zatca', label: t('settings.tabs.zatca'), icon: ShieldCheck, permission: 'admin' },
        { id: 'users', label: t('settings.tabs.users_roles'), icon: Users, permission: 'users_manage' },
        { id: 'reminders', label: t('settings.tabs.reminders'), icon: Bell, permission: 'settings' },
        { id: 'print', label: t('settings.tabs.invoice_print'), icon: Printer, permission: 'settings' },
        { id: 'backup', label: t('settings.tabs.data_backup'), icon: Database, permission: 'backup_manage' },
        { id: 'logs', label: t('settings.tabs.activity_logs'), icon: Shield, permission: 'admin' },
        { id: 'help', label: t('settings.tabs.help'), icon: HelpCircle, permission: null },
    ];

    const tabs = allTabs.filter(tab => {
        if (!tab.permission) return true;
        if (tab.permission === 'admin') return user?.role === 'admin';
        // 'settings' permission implies backup or general settings access if we had it, 
        // but for now let's allow basic settings for shopkeepers? 
        // Actually, let's keep it simple:
        // print/reminders -> accessible if 'settings' permission, OR if admin.
        // But I didn't add 'settings' permission to UserForm.
        // Let's map 'print','reminders' to 'pos' maybe? Use 'pos' for print settings?
        // Let's assume shopkeepers can change print settings if they have POS access.
        if (tab.id === 'print') return true;
        if (tab.id === 'reminders') return true;

        return hasPermission(tab.permission);
    });

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-900">
            {/* Sidebar / Tabs List */}
            <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('settings.title')}</h1>
                </div>
                <nav className="flex-1 px-4 space-y-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <Icon size={20} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                    {activeTab === 'general' && <GeneralTab />}
                    {activeTab === 'license' && <LicenseTab />}
                    {activeTab === 'shortcuts' && <React.Suspense fallback={<div>Loading...</div>}><KeyboardShortcutsTab /></React.Suspense>}
                    {activeTab === 'profile' && <BusinessProfileTab />}
                    {activeTab === 'zatca' && <ZatcaTab />}
                    {activeTab === 'users' && <UserManagementTab />}
                    {activeTab === 'reminders' && <RemindersTab />}
                    {activeTab === 'print' && <InvoicePrintTab />}
                    {activeTab === 'backup' && <DataBackupTab />}
                    {activeTab === 'logs' && <ActivityLogTab />}
                    {activeTab === 'help' && <HelpTab />}
                </div>
            </div>
        </div>
    );
};

export default Settings;

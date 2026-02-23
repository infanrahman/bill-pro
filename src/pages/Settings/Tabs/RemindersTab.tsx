import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';

const RemindersTab: React.FC = () => {
    // Persist to localStorage
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('reminderSettings');
        return saved ? JSON.parse(saved) : {
            lowStock: true,
            paymentDue: true
        };
    });

    const { addToast } = useNotification();
    const { t } = useTranslation();

    const toggleSetting = (key: 'lowStock' | 'paymentDue') => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        localStorage.setItem('reminderSettings', JSON.stringify(newSettings));
        addToast(t('reminders.toast_msg', {
            type: key === 'lowStock' ? t('reminders.low_stock') : t('reminders.payment_due'),
            status: newSettings[key] ? t('reminders.enabled') : t('reminders.disabled')
        }), 'success');
    };

    const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
        <button
            onClick={onChange}
            className={`w-14 h-8 rounded-full transition-colors relative ${enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
            <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Bell className="text-blue-500" /> {t('reminders.title')}
            </h2>

            <div className="space-y-4">
                {/* Low Stock Toggle */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white">{t('reminders.low_stock')}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {t('reminders.low_stock_desc')}
                        </p>
                    </div>
                    <Toggle enabled={settings.lowStock} onChange={() => toggleSetting('lowStock')} />
                </div>

                {/* Payment Due Toggle */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white">{t('reminders.payment_due')}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {t('reminders.payment_due_desc')}
                        </p>
                    </div>
                    <Toggle enabled={settings.paymentDue} onChange={() => toggleSetting('paymentDue')} />
                </div>
            </div>
        </div >
    );
};

export default RemindersTab;

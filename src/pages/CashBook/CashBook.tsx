import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Package, ShieldOff } from 'lucide-react';
import PartyDetails from './PartyDetails';
import PartyList from './PartyList';
import { useAuth } from '../../contexts/AuthContext';

const CashBook: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = useAuth();

    if (!hasPermission('cashbook_access')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('cashbook.access_denied_msg')}</p>
            </div>
        );
    }

    // Tabs
    const [activeTab, setActiveTab] = useState<'supplier' | 'customer'>('supplier');
    const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);

    // If a party is selected, show details
    if (selectedPartyId) {
        return <PartyDetails partyId={selectedPartyId} onBack={() => setSelectedPartyId(null)} />;
    }

    return (
        <div className="space-y-6 pb-24 animate-in fade-in">
            {/* Header / Tabs */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold dark:text-white">{t('cashbook.title')}</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('cashbook.subtitle')}</p>
                    </div>

                    {/* TABS SWITCHER */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex self-start md:self-auto overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('supplier')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'supplier'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                                }`}
                        >
                            <Package size={18} />
                            {t('cashbook.tab_suppliers')}
                        </button>
                        <button
                            onClick={() => setActiveTab('customer')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'customer'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                                }`}
                        >
                            <Users size={18} />
                            {t('cashbook.tab_customers')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <PartyList
                filterType={activeTab}
                onSelect={setSelectedPartyId}
            />
        </div>
    );
};

export default CashBook;

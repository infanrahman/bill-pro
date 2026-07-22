import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Package, ShieldOff, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';
import PartyDetails from './PartyDetails';
import PartyList from './PartyList';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

const CashBook: React.FC = () => {
 const { t } = useTranslation();
 const { hasPermission } = useAuth();

 if (!hasPermission('cashbook_access')) {
 return (
 <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8 bg-white dark:bg-slate-800 rounded-2xl border border-white/50 dark:border-slate-700/30">
 <div className="p-6 bg-rose-500/10 text-rose-500 rounded-full mb-6">
 <ShieldOff size={48} strokeWidth={1.5} />
 </div>
 <h2 className="text-2xl font-semibold text-slate-900 dark:text-white uppercase tracking-tight">{t('common.access_denied')}</h2>
 <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-2 max-w-md">{t('cashbook.access_denied_msg')}</p>
 </div>
);
 }

 const [activeTab, setActiveTab] = useState<'supplier' | 'customer'>('supplier');
 const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);

 if (selectedPartyId) {
 return <PartyDetails partyId={selectedPartyId} onBack={() => setSelectedPartyId(null)} />;
 }

 return (
 <div className="space-y-10 pb-24 fade-in">
 {/* Header / Tabs */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
 <div className="relative">
 
 <h1 className="text-5xl font-semibold text-slate-900 dark:text-white tracking-tight uppercase relative z-10 flex items-center gap-4">
 {t('cashbook.title')}
 <Sparkles size={24} className="text-amber-500"/>
 </h1>
 <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-[0.4em] mt-3 ml-1">
 {t('cashbook.subtitle')}
 </p>
 </div>

 {/* PREMIUM TABS SWITCHER */}
 <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center">
 <button type="button"
 onClick={() => setActiveTab('supplier')}
 className={clsx(
"flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wide relative overflow-hidden group",
 activeTab === 'supplier'
 ? 'bg-slate-800 dark:bg-slate-700 text-white '
 : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
)}
 >
 <Package size={16} strokeWidth={activeTab === 'supplier' ? 2.5 : 2} />
 {t('cashbook.tab_suppliers')}
 {activeTab === 'supplier' && (
 <div className="absolute inset-0 from-transparent via-white/5 to-transparent"/>
)}
 </button>
 <button type="button"
 onClick={() => setActiveTab('customer')}
 className={clsx(
"flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wide relative overflow-hidden group",
 activeTab === 'customer'
 ? 'bg-slate-800 dark:bg-slate-700 text-white '
 : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
)}
 >
 <Users size={16} strokeWidth={activeTab === 'customer' ? 2.5 : 2} />
 {t('cashbook.tab_customers')}
 {activeTab === 'customer' && (
 <div className="absolute inset-0 from-transparent via-white/5 to-transparent"/>
)}
 </button>
 </div>
 </div>

 {/* Content Container */}
 <>
 <div
 key={activeTab}
 
 
 
 
 >
 <PartyList
 filterType={activeTab}
 onSelect={setSelectedPartyId}
 />
 </div>
 </>
 </div>
);
};

export default CashBook;

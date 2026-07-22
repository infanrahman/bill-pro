import React, { useState } from 'react';
import { Search, Plus, User, Phone, ArrowUpRight, ArrowDownLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { formatCurrency } from '../../utils/currency';
import AddPartyModal from './AddPartyModal';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

interface PartyListProps {
 onSelect?: (id: string) => void;
 filterType?: 'customer' | 'supplier' | 'other';
}

const PartyList: React.FC<PartyListProps> = ({ onSelect, filterType }) => {
 const { t } = useTranslation();
 const { activeBranchId, activeBranch } = useAuth();
 const [searchTerm, setSearchTerm] = useState('');
 const [isAddOpen, setIsAddOpen] = useState(false);

 const parties = useLiveQuery(() => {
 const query = (activeBranch?.isMaster ? db.cashParties : db.cashParties.where('branchId').equals(activeBranchId)) as any;
 if (filterType) {
 return query.filter((p: any) => !p.deletedAt && p.type === filterType).toArray();
 }
 return query.filter((p: any) => !p.deletedAt).toArray();
 }, [filterType, activeBranchId, activeBranch?.isMaster]);

 const filteredParties = parties?.filter((p: any) =>
 (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
 (p.phone || '').includes(searchTerm)
);

 const totalToCollect = parties?.filter((p: any) => p.openingBalance > 0).reduce((sum: any, p: any) => sum + p.openingBalance, 0) || 0;
 const totalToPay = parties?.filter((p: any) => p.openingBalance < 0).reduce((sum: any, p: any) => sum + Math.abs(p.openingBalance), 0) || 0;

 return (
 <div className="space-y-10">
 {/* Net Stats Ribbon */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div 
 
 
 className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center gap-8 group"
 >
 <div className="p-6 bg-emerald-500 text-white rounded-xl group-">
 <ArrowDownLeft size={32} strokeWidth={2.5} />
 </div>
 <div>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('cashbook.you_will_get')}</p>
 <p className="text-4xl font-semibold text-emerald-500 tracking-tight">{formatCurrency(totalToCollect)}</p>
 </div>
 </div>

 <div 
 
 
 className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center gap-8 group"
 >
 <div className="p-6 bg-rose-500 text-white rounded-xl group-">
 <ArrowUpRight size={32} strokeWidth={2.5} />
 </div>
 <div>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('cashbook.you_will_give')}</p>
 <p className="text-4xl font-semibold text-rose-500 tracking-tight">{formatCurrency(totalToPay)}</p>
 </div>
 </div>
 </div>

 {/* Actions Bar */}
 <div className="flex flex-col md:flex-row gap-6">
 <div className="relative flex-1 group">
 <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"size={20} />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder={t('cashbook.search_parties')}
 className="w-full pl-16 pr-8 py-5 bg-white dark:bg-slate-800 border border-white/50 dark:border-slate-700/30 rounded-2xl focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white font-semibold text-xs uppercase tracking-wider"
 />
 </div>
 <button type="button"
 
 
 onClick={() => setIsAddOpen(true)}
 className="flex items-center justify-center gap-3 bg-slate-800 dark:bg-slate-700 text-white px-10 py-5 rounded-2xl font-semibold text-xs uppercase tracking-wide shrink-0"
 >
 <Plus size={20} strokeWidth={3} />
 {t('common.add_party')}
 </button>
 </div>

 {/* Premium List */}
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-white/50 dark:border-slate-700/30 overflow-hidden">
 <div className="p-8 border-b border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-slate-900 dark:bg-white text-white rounded-2xl">
 <Sparkles size={20} />
 </div>
 <div>
 <h3 className="text-lg font-semibold dark:text-white uppercase tracking-tight">{t('cashbook.active_ledger')}</h3>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('cashbook.ledger_subtitle') ||"Real-time balance monitoring"}</p>
 </div>
 </div>
 </div>

 <div className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
 {filteredParties?.map((party: any, idx: number) => (
 <div
 key={party.id}
 
 
 
 onClick={() => onSelect && party.id && onSelect(party.id as string)}
 className="p-8 hover:bg-white dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center group"
 >
 <div className="flex items-center gap-6">
 <div className="w-16 h-16 rounded-xl to-indigo-600 text-white flex items-center justify-center text-xl font-semibold transform">
 {party.name.charAt(0).toUpperCase()}
 </div>
 <div>
 <h3 className="text-xl font-semibold text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-slate-900 dark:group-hover:text-white">{party.name}</h3>
 {party.phone && (
 <div className="flex items-center gap-2 mt-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
 <Phone size={12} className="text-slate-900 dark:text-white"/>
 {party.phone}
 </div>
)}
 </div>
 </div>

 <div className="flex items-center gap-8">
 <div className="text-right">
 <p className={clsx(
"text-2xl font-semibold tracking-tight",
 party.openingBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'
)}>
 {formatCurrency(Math.abs(party.openingBalance))}
 </p>
 <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-1">
 {party.openingBalance >= 0 ? t('cashbook.you_will_get') : t('cashbook.you_will_give')}
 </p>
 </div>
 <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:bg-slate-900 dark:group-hover:bg-white group-hover:text-white transform group-">
 <ChevronRight size={20} strokeWidth={3} />
 </div>
 </div>
 </div>
))}

 {(!filteredParties || filteredParties.length === 0) && (
 <div className="p-24 text-center">
 <div className="p-8 bg-slate-100 dark:bg-slate-900 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
 <User size={48} className="text-slate-300"strokeWidth={1.5} />
 </div>
 <h3 className="text-xl font-semibold text-slate-900 dark:text-white uppercase tracking-tight">{t('cashbook.no_parties_found')}</h3>
 <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-2 uppercase tracking-wider">{t('cashbook.start_by_adding')}</p>
 </div>
)}
 </div>
 </div>

 <AddPartyModal
 isOpen={isAddOpen}
 onClose={() => setIsAddOpen(false)}
 onSave={() => { }}
 defaultType={filterType}
 />
 </div>
);
};

export default PartyList;

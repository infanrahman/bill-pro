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
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
 <div 
 
 
 className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center gap-4 md:gap-8 group"
 >
 <div className="p-4 md:p-6 bg-emerald-500 text-white rounded-xl group-">
 <ArrowDownLeft size={24} className="md:w-[32px] md:h-[32px]" strokeWidth={2.5} />
 </div>
 <div>
 <p className="text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('cashbook.you_will_get')}</p>
 <p className="text-2xl md:text-4xl font-semibold text-emerald-500 tracking-tight">{formatCurrency(totalToCollect)}</p>
 </div>
 </div>

 <div 
 
 
 className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 flex items-center gap-4 md:gap-8 group"
 >
 <div className="p-4 md:p-6 bg-rose-500 text-white rounded-xl group-">
 <ArrowUpRight size={24} className="md:w-[32px] md:h-[32px]" strokeWidth={2.5} />
 </div>
 <div>
 <p className="text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('cashbook.you_will_give')}</p>
 <p className="text-2xl md:text-4xl font-semibold text-rose-500 tracking-tight">{formatCurrency(totalToPay)}</p>
 </div>
 </div>
 </div>

 {/* Actions Bar */}
 <div className="flex flex-col md:flex-row gap-4 md:gap-6">
 <div className="relative flex-1 group">
 <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white" size={18} />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder={t('cashbook.search_parties')}
 className="w-full pl-12 md:pl-16 pr-4 md:pr-8 py-3 md:py-5 bg-white dark:bg-slate-800 border border-white/50 dark:border-slate-700/30 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white font-semibold text-xs uppercase tracking-wider"
 />
 </div>
 <button type="button"
 
 
 onClick={() => setIsAddOpen(true)}
 className="flex items-center justify-center gap-3 bg-slate-800 dark:bg-slate-700 text-white px-6 md:px-10 py-3 md:py-5 rounded-xl md:rounded-2xl font-semibold text-xs uppercase tracking-wide shrink-0"
 >
 <Plus size={18} className="md:w-[20px] md:h-[20px]" strokeWidth={3} />
 {t('common.add_party')}
 </button>
 </div>

 {/* Premium List */}
 <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 overflow-hidden">
 <div className="p-4 md:p-8 border-b border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
 <div className="flex items-center gap-3 md:gap-4">
 <div className="p-2 md:p-3 bg-slate-900 dark:bg-white text-white rounded-xl md:rounded-2xl">
 <Sparkles size={16} className="md:w-[20px] md:h-[20px]" />
 </div>
 <div>
 <h3 className="text-sm md:text-lg font-semibold dark:text-white uppercase tracking-tight">{t('cashbook.active_ledger')}</h3>
 <p className="text-[8px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{t('cashbook.ledger_subtitle') ||"Real-time balance monitoring"}</p>
 </div>
 </div>
 </div>

 <div className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
 {filteredParties?.map((party: any, idx: number) => (
 <div
 key={party.id}
 
 
 
 onClick={() => onSelect && party.id && onSelect(party.id as string)}
 className="p-4 md:p-8 hover:bg-white dark:hover:bg-slate-700 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 group"
 >
 <div className="flex items-center gap-4 md:gap-6 w-full sm:w-auto">
 <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-xl to-indigo-600 text-white flex items-center justify-center text-lg md:text-xl font-semibold shrink-0 transform">
 {party.name.charAt(0).toUpperCase()}
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-base md:text-xl font-semibold text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-slate-900 dark:group-hover:text-white truncate">{party.name}</h3>
 {party.phone && (
 <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-2 text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
 <Phone size={10} className="md:w-[12px] md:h-[12px] text-slate-900 dark:text-white"/>
 {party.phone}
 </div>
 )}
 </div>
 </div>

 <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-4 md:gap-8">
 <div className="text-left sm:text-right">
 <p className={clsx(
 "text-xl md:text-2xl font-semibold tracking-tight",
 party.openingBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'
 )}>
 {formatCurrency(Math.abs(party.openingBalance))}
 </p>
 <p className="text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-0.5 md:mt-1">
 {party.openingBalance >= 0 ? t('cashbook.you_will_get') : t('cashbook.you_will_give')}
 </p>
 </div>
 <div className="p-2 md:p-3 bg-slate-100 dark:bg-slate-800 rounded-lg md:rounded-xl group-hover:bg-slate-900 dark:group-hover:bg-white group-hover:text-white transform group- shrink-0">
 <ChevronRight size={16} className="md:w-[20px] md:h-[20px]" strokeWidth={3} />
 </div>
 </div>
 </div>
 ))}

 {(!filteredParties || filteredParties.length === 0) && (
 <div className="p-12 md:p-24 text-center">
 <div className="p-6 md:p-8 bg-slate-100 dark:bg-slate-900 rounded-full w-20 h-20 md:w-24 md:h-24 flex items-center justify-center mx-auto mb-4 md:mb-6">
 <User size={36} className="md:w-[48px] md:h-[48px] text-slate-300" strokeWidth={1.5} />
 </div>
 <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white uppercase tracking-tight">{t('cashbook.no_parties_found')}</h3>
 <p className="text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-400 mt-1 md:mt-2 uppercase tracking-wider">{t('cashbook.start_by_adding')}</p>
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

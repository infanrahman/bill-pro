import React, { useState } from 'react';
import { Search, Plus, User, Phone, ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { formatCurrency } from '../../utils/currency';
import AddPartyModal from './AddPartyModal';
import { useTranslation } from 'react-i18next';

interface PartyListProps {
    onSelect?: (id: number) => void;
    filterType?: 'customer' | 'supplier' | 'other';
}

const PartyList: React.FC<PartyListProps> = ({ onSelect, filterType }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);

    const parties = useLiveQuery(() => {
        if (filterType) {
            return db.cashParties.where('type').equals(filterType).toArray();
        }
        return db.cashParties.toArray();
    }, [filterType]);

    // Filtered Parties
    const filteredParties = parties?.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm)
    );

    // Calculate Net Stats
    const totalToCollect = parties?.filter(p => p.openingBalance > 0).reduce((sum, p) => sum + p.openingBalance, 0) || 0;
    const totalToPay = parties?.filter(p => p.openingBalance < 0).reduce((sum, p) => sum + Math.abs(p.openingBalance), 0) || 0;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* ... Rest of Header Cards ... */}
            {/* Header Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('cashbook.you_will_get')}</p>
                    <div className="flex items-center gap-2 text-green-600">
                        <ArrowDownLeft size={24} />
                        <span className="text-2xl font-bold">{formatCurrency(totalToCollect)}</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('cashbook.you_will_give')}</p>
                    <div className="flex items-center gap-2 text-red-600">
                        <ArrowUpRight size={24} />
                        <span className="text-2xl font-bold">{formatCurrency(totalToPay)}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('cashbook.search_parties')}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    />
                </div>
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus size={20} />
                    {t('common.add')}
                </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredParties?.map(party => (
                        <div
                            key={party.id}
                            onClick={() => onSelect && party.id && onSelect(party.id)}
                            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer flex justify-between items-center group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-lg font-bold">
                                    {party.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold dark:text-white">{party.name}</h3>
                                    {party.phone && (
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Phone size={12} />
                                            {party.phone}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className={`font-mono font-bold ${party.openingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(Math.abs(party.openingBalance))}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {party.openingBalance >= 0 ? t('cashbook.you_will_get') : t('cashbook.you_will_give')}
                                    </p>
                                </div>
                                <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" size={20} />
                            </div>
                        </div>
                    ))}

                    {filteredParties?.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <User size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No parties found</p>
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

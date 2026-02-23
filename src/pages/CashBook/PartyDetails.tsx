import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Phone, FileText, Wallet, Trash2, Edit, AlertCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CashEntry } from '../../services/db';
import { formatCurrency } from '../../utils/currency';
import { format } from 'date-fns';

import CashEntryModal from './CashEntryModal';
import { exportToPDF } from '../../utils/export';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import { useNotification } from '../../contexts/NotificationContext';

interface PartyDetailsProps {
    partyId: number;
    onBack: () => void;
}

const PartyDetails: React.FC<PartyDetailsProps> = ({ partyId, onBack }) => {
    const { t } = useTranslation();
    const { addToast } = useNotification();
    const party = useLiveQuery(() => db.cashParties.get(partyId), [partyId]);
    const entries = useLiveQuery(() => db.cashEntries.where('partyId').equals(partyId).sortBy('date'), [partyId]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [entryType, setEntryType] = useState<'in' | 'out'>('in');
    const [editingEntry, setEditingEntry] = useState<CashEntry | undefined>(undefined);

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<CashEntry | null>(null);
    const [isEntryDeleteOpen, setIsEntryDeleteOpen] = useState(false);

    const [balance, setBalance] = useState(0);

    useEffect(() => {
        if (party && entries) {
            // Calculate running balance
            // Opening Balance: Positive = Receivable (Get), Negative = Payable (Give)
            // Balance = Opening + (OUT - IN)
            // Correction: 
            // If I GIVE money (OUT), I expect to GET it back (Asset increases) -> +
            // If I GOT money (IN), I owe it (Liability increases) or settled debt -> -
            // Wait, let's stick to the visual logic:
            // "You will Get" (Green) -> Positive
            // "You will Give" (Red) -> Negative

            // Standard Accounting for personal ledger:
            // Opening Balance (Positive = Get/Receivable)
            // + I GAVE (Loaned out) -> Increases what I will Get
            // - I GOT (Repayment) -> Decreases what I will Get

            const totalGiven = entries.filter(e => e.type === 'out').reduce((sum, e) => sum + e.amount, 0);
            const totalGot = entries.filter(e => e.type === 'in').reduce((sum, e) => sum + e.amount, 0);

            setBalance(party.openingBalance + totalGiven - totalGot);
        }
    }, [party, entries]);

    const handleDeleteParty = async () => {
        if (!party) return;

        try {
            // Delete all entries for this party
            await db.cashEntries.where('partyId').equals(partyId).delete();
            // Delete the party
            await db.cashParties.delete(partyId);

            setIsDeleteOpen(false);
            onBack();
            addToast('Party deleted successfully', 'success');
        } catch (error) {
            console.error("Failed to delete party:", error);
            addToast("Failed to delete party. Please try again.", 'error');
        }
    };

    const handleDeleteEntry = async () => {
        if (!entryToDelete || !entryToDelete.id) return;
        try {
            await db.cashEntries.delete(entryToDelete.id);
            addToast('Transaction deleted successfully', 'success');
            setIsEntryDeleteOpen(false);
            setEntryToDelete(null);
        } catch (error) {
            console.error("Failed to delete entry:", error);
            addToast("Failed to delete transaction.", 'error');
        }
    };

    if (!party) return <div>Loading...</div>;

    const handleExport = () => {
        if (!entries?.length) return;
        const headers = ['Date', 'Type', 'Description', 'Amount'];
        const rows = entries.map(e => [
            format(e.date, 'yyyy-MM-dd HH:mm'),
            e.type === 'in' ? 'Got' : 'Gave',
            e.description,
            e.amount.toFixed(2)
        ]);

        exportToPDF(
            `Statement: ${party.name}`,
            headers,
            rows,
            `Statement_${party.name}_${format(new Date(), 'yyyyMMdd')}`
        );
    };

    const openEditEntry = (entry: CashEntry) => {
        setEntryType(entry.type);
        setEditingEntry(entry);
        setIsAddOpen(true);
    };

    const confirmDeleteEntry = (entry: CashEntry) => {
        setEntryToDelete(entry);
        setIsEntryDeleteOpen(true);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold dark:text-white">{party.name}</h1>
                    {party.phone && (
                        <div className="flex items-center gap-1 text-slate-500 text-sm">
                            <Phone size={14} />
                            {party.phone}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                        title={t('common.download')}
                    >
                        <FileText size={20} />
                    </button>
                    <button
                        onClick={() => setIsDeleteOpen(true)}
                        className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        title={t('common.delete')}
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* Balance Card */}
            <div className={`p-6 rounded-2xl text-white shadow-lg ${balance >= 0 ? 'bg-gradient-to-br from-green-600 to-teal-700' : 'bg-gradient-to-br from-red-600 to-pink-700'}`}>
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-white/80 font-medium mb-1">
                            {balance >= 0 ? 'You will Get' : 'You will Give'}
                        </p>
                        <h2 className="text-4xl font-bold">{formatCurrency(Math.abs(balance))}</h2>
                    </div>
                    <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                        <Wallet size={32} />
                    </div>
                </div>
                {/* Opening Balance Display */}
                {party.openingBalance !== 0 && (
                    <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2 text-sm text-white/90">
                        <AlertCircle size={16} />
                        <span>
                            Opening Balance: <strong>{formatCurrency(Math.abs(party.openingBalance))}</strong> {party.openingBalance >= 0 ? '(You will Get)' : '(You will Give)'}
                        </span>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => { setEntryType('out'); setEditingEntry(undefined); setIsAddOpen(true); }}
                    className="py-6 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex flex-col items-center gap-1 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight size={28} strokeWidth={2.5} />
                    </div>
                    <span className="text-xl font-bold">I GAVE</span>
                    <span className="text-xs opacity-80 font-medium uppercase tracking-wide">Cash Out</span>
                </button>
                <button
                    onClick={() => { setEntryType('in'); setEditingEntry(undefined); setIsAddOpen(true); }}
                    className="py-6 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex flex-col items-center gap-1 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors shadow-sm"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <ArrowDownLeft size={28} strokeWidth={2.5} />
                    </div>
                    <span className="text-xl font-bold">I GOT</span>
                    <span className="text-xs opacity-80 font-medium uppercase tracking-wide">Cash In</span>
                </button>
            </div>

            {/* Transactions List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300">
                    Transactions
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {entries?.slice().reverse().map(entry => (
                        <div key={entry.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                            <div className="flex flex-col gap-1">
                                <span className="font-medium dark:text-white">
                                    {entry.type === 'in' ? 'You Got' : 'You Gave'}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {format(entry.date, 'dd MMM, hh:mm a')} • {entry.description || 'No Description'}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className={`font-mono font-bold text-lg ${entry.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(entry.amount)}
                                </div>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditEntry(entry)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => confirmDeleteEntry(entry)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {entries?.length === 0 && (
                        <div className="p-10 text-center flex flex-col items-center gap-3 text-slate-400">
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                                <FileText size={24} />
                            </div>
                            <p>No transactions yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {isAddOpen && (
                <CashEntryModal
                    isOpen={isAddOpen}
                    onClose={() => setIsAddOpen(false)}
                    onSave={() => { }}
                    type={entryType}
                    partyId={partyId}
                    editEntry={editingEntry}
                />
            )}

            <ConfirmationModal
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={handleDeleteParty}
                title={t('common.delete_confirm_title')}
                message={t('cashbook.delete_party_confirm', { name: party.name })}
                confirmText={t('common.delete')}
                variant="danger"
            />

            <ConfirmationModal
                isOpen={isEntryDeleteOpen}
                onClose={() => setIsEntryDeleteOpen(false)}
                onConfirm={handleDeleteEntry}
                title={t('common.delete_confirm_title')}
                message={t('cashbook.delete_entry_confirm')}
                confirmText={t('common.delete')}
                variant="danger"
            />
        </div>
    );
};

// Helper icons
const ArrowUpRight = ({ size, className, strokeWidth = 2 }: { size: number, className?: string, strokeWidth?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
);
const ArrowDownLeft = ({ size, className, strokeWidth = 2 }: { size: number, className?: string, strokeWidth?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 7H7v10" /><path d="M17 7 7 17" /></svg>
);

export default PartyDetails;

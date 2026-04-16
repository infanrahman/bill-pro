import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { type Scale } from '../../services/db';

interface DeletePluModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (pluNumber: string) => Promise<void>;
    scale: Scale | null;
}

const DeletePluModal: React.FC<DeletePluModalProps> = ({ isOpen, onClose, onConfirm, scale }) => {
    const { t } = useTranslation();
    const [pluNumber, setPluNumber] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen || !scale) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pluNumber.trim()) return;

        setIsDeleting(true);
        try {
            await onConfirm(pluNumber.trim());
            setPluNumber('');
            onClose();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Trash2 size={20} className="text-red-500" />
                        {t('scales.delete_plu_title', { defaultValue: 'Delete PLU from Scale' })}
                    </h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <p>
                            {t('scales.delete_plu_warning', {
                                defaultValue: 'This will permanently delete the selected PLU from the {{scaleName}} scale. This action cannot be undone on the scale.',
                                scaleName: scale.name
                            })}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('scales.plu_number', { defaultValue: 'PLU Number' })}
                        </label>
                        <input
                            type="text"
                            required
                            value={pluNumber}
                            onChange={(e) => setPluNumber(e.target.value)}
                            placeholder="e.g. 1001"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-red-500 dark:text-white"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
                        >
                            {t('common.cancel', { defaultValue: 'Cancel' })}
                        </button>
                        <button
                            type="submit"
                            disabled={isDeleting || !pluNumber.trim()}
                            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isDeleting ? t('common.deleting', { defaultValue: 'Deleting...' }) : t('scales.delete_plu', { defaultValue: 'Delete PLU' })}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeletePluModal;

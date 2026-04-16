import React, { useState } from 'react';
import { db, type Branch, softDeleteMetadata } from '../../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Edit2, Trash2, MapPin, Phone, Mail, CheckCircle2, Globe } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../contexts/AuthContext';

const BranchesTab: React.FC = () => {
    const { addToast } = useNotification();
    const { t } = useTranslation();
    const { activeBranchId } = useAuth();
    const branches = useLiveQuery(() => 
        db.branches
            .filter((b: any) => !b.deletedAt)
            .toArray()
    ) || [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        phone: '',
        email: '',
        isMaster: false,
        status: 'active' as 'active' | 'inactive'
    });

    const handleOpenModal = (branch?: Branch) => {
        if (branch) {
            setEditingBranch(branch);
            setFormData({
                name: branch.name,
                location: branch.location,
                phone: branch.phone,
                email: branch.email || '',
                isMaster: branch.isMaster,
                status: branch.status
            });
        } else {
            setEditingBranch(null);
            setFormData({
                name: '',
                location: '',
                phone: '',
                email: '',
                isMaster: false,
                status: 'active'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { createRecordMetadata, updateRecordMetadata } = await import('../../../services/db');
            
            const branchData = {
                ...formData,
            };

            if (editingBranch) {
                await db.branches.update(editingBranch.id, {
                    ...branchData,
                    ...updateRecordMetadata()
                });
                addToast(t('settings.branches.update_success', 'Branch updated successfully'), 'success');
            } else {
                const metadata = createRecordMetadata();
                const newId = uuidv4();
                await db.branches.add({
                    ...metadata,
                    ...branchData,
                    id: newId,
                    branchId: newId, // Self-referencing branchId for the branch record itself
                } as Branch);
                addToast(t('settings.branches.add_success', 'Branch added successfully'), 'success');
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving branch:", error);
            addToast(t('common.error'), 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (id === activeBranchId) {
            addToast(t('settings.branches.delete_active_error', 'Cannot delete the active branch'), 'error');
            return;
        }
        if (window.confirm(t('common.confirm_delete'))) {
            await db.branches.update(id, softDeleteMetadata());
            addToast(t('settings.branches.delete_success', 'Branch deleted successfully'), 'success');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('settings.tabs.branches', 'Branches')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('settings.branches.description', 'Manage your store locations and branches')}</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                    <Plus size={18} /> {t('settings.branches.add_new', 'Add Branch')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((branch: any) => (
                    <div 
                        key={branch.id} 
                        className={`p-5 rounded-xl border transition-all ${
                            branch.id === activeBranchId 
                                ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500/20' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md'
                        }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${branch.id === activeBranchId ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                        {branch.name}
                                        {branch.isMaster && (
                                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Master</span>
                                        )}
                                        {branch.id === activeBranchId && (
                                            <span className="flex items-center gap-1 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                <CheckCircle2 size={10} /> Active
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{branch.location}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleOpenModal(branch)} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    <Edit2 size={16} />
                                </button>
                                {!branch.isMaster && (
                                    <button onClick={() => handleDelete(branch.id)} className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Phone size={14} className="opacity-70" />
                                <span>{branch.phone || t('common.na')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Mail size={14} className="opacity-70" />
                                <span className="truncate">{branch.email || t('common.na')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Globe size={14} className="opacity-70" />
                                <span>{branch.status === 'active' ? t('common.active') : t('common.inactive')}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {branches.length === 0 && (
                    <div className="md:col-span-2 py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <MapPin size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                        <h3 className="text-slate-600 dark:text-slate-400 font-medium">{t('settings.branches.none_found', 'No branches found')}</h3>
                        <button 
                            onClick={() => handleOpenModal()} 
                            className="mt-4 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                        >
                            {t('settings.branches.add_first', 'Add your first branch')}
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 slide-in-from-bottom-4 duration-300">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {editingBranch ? t('settings.branches.edit_title', 'Edit Branch') : t('settings.branches.add_title', 'Add New Branch')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.branches.name', 'Branch Name')}</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.branches.location', 'Location / Address')}</label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.branches.phone', 'Phone')}</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('settings.branches.email', 'Email')}</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 mt-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isMaster}
                                        onChange={(e) => setFormData({ ...formData, isMaster: e.target.checked })}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                    />
                                    {t('settings.branches.is_master', 'Set as Main / Master Branch')}
                                </label>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    {editingBranch ? t('common.save') : t('common.add')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchesTab;

// d:\mobile\src\pages\Inventory\CategoryTab.tsx
import React, { useState } from 'react';
import { db, type Category, softDeleteMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash, Tags, Hash, Search } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmationModal from '../../components/UI/ConfirmationModal';

const CategoryTab: React.FC = () => {
    const { t } = useTranslation();
    const { addToast } = useNotification();
    const { activeBranchId, activeBranch } = useAuth();
    const [search, setSearch] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '', color: '#3B82F6' });

    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

    const categories = useLiveQuery(
        () => {
            const query = (activeBranch?.isMaster ? db.categories : db.categories.where('branchId').equals(activeBranchId)) as any;
            if (search) {
                return query
                    .filter((c: any) => !c.deletedAt && c.name.toLowerCase().includes(search.toLowerCase()))
                    .toArray();
            }
            return query.filter((c: any) => !c.deletedAt).toArray();
        },
        [search, activeBranchId, activeBranch?.isMaster]
    );

    const handleOpenForm = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                description: category.description || '',
                color: category.color || '#3B82F6'
            });
        } else {
            setEditingCategory(null);
            setFormData({ name: '', description: '', color: '#3B82F6' });
        }
        setIsFormOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { createRecordMetadata, updateRecordMetadata } = await import('../../services/db');
            if (editingCategory?.id) {
                await db.categories.update(editingCategory.id, {
                    ...formData,
                    ...updateRecordMetadata()
                });
                addToast(t('inventory.category_updated') || 'Category updated', 'success');
            } else {
                await db.categories.add({
                    ...createRecordMetadata(),
                    ...formData,
                    createdAt: new Date(),
                });
                addToast(t('inventory.category_created') || 'Category created', 'success');
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error(error);
            addToast(t('inventory.category_save_error') || 'Failed to save', 'error');
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        try {
            // Optional: Check if items are using this category before deleting.
            // For now, simple delete.
            await db.categories.update(categoryToDelete, softDeleteMetadata());
            addToast(t('inventory.category_deleted') || 'Category deleted', 'success');
            setCategoryToDelete(null);
        } catch (error) {
            console.error(error);
            addToast(t('inventory.category_delete_error') || 'Failed to delete category', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden text-ellipsis whitespace-nowrap dark:text-white"
                    />
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                    <Plus size={20} />
                    <span>{t('inventory.add_category')}</span>
                </button>
            </div>

            {/* Form Drawer / Panel */}
            {isFormOpen && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 animate-fade-in">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">
                        {editingCategory ? t('inventory.edit_category') : t('inventory.new_category')}
                    </h3>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('inventory.category_name')} *</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                placeholder="e.g. Beverages"
                            />
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('inventory.category_desc')}</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                placeholder="Optional details..."
                            />
                        </div>
                        {/* 
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Theme Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                    className="h-10 w-14 p-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg cursor-pointer"
                                />
                                <span className="text-xs font-mono text-slate-500">{formData.color}</span>
                            </div>
                        </div>
                        */}
                        <div className="md:col-span-3 flex justify-end gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                            >
                                {t('inventory.save_category')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {!categories ? (
                    Array.from({ length: 4 }).map((_: any, i: any) => (
                        <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
                            <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-3"></div>
                            <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-600 rounded"></div>
                        </div>
                    ))
                ) : categories.length === 0 ? (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
                        <Tags className="mx-auto h-12 w-12 text-slate-400 mb-3 opacity-50" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">{t('inventory.no_categories') || 'No categories found'}</h3>
                        <p className="text-slate-500 text-sm">{t('inventory.no_categories_desc') || 'Create categories to organize your items.'}</p>
                    </div>
                ) : (
                    categories.map((category: any) => (
                        <div key={category.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-full relative overflow-hidden">
                            {/* Accent Line */}
                            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: category.color || '#3B82F6' }}></div>

                            <div>
                                <div className="flex items-start justify-between mb-2 mt-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Hash size={16} className="text-slate-400" />
                                        {category.name}
                                    </h3>
                                </div>
                                {category.description && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                                        {category.description}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleOpenForm(category)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => setCategoryToDelete(category.id!)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmationModal
                isOpen={categoryToDelete !== null}
                title={t('inventory.delete_title', { defaultValue: 'Delete Category?' })}
                message={t('inventory.category_delete_confirm') || 'Are you sure you want to delete this category? Items assigned to it will lose their category association.'}
                onConfirm={handleDelete}
                onClose={() => setCategoryToDelete(null)}
                confirmText={t('common.delete')}
                cancelText={t('common.cancel')}
            />
        </div>
    );
};

export default CategoryTab;

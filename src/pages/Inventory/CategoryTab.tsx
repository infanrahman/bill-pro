import React, { useState } from 'react';
import { db, type Category, softDeleteMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { 
 Plus, Edit, Trash, Tags, Hash, Search, 
 Sparkles, Palette, MoreVertical, Layers, 
 ArrowRight, Box
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import Modal from '../../components/UI/Modal';
import clsx from 'clsx';

interface CategoryTabProps {
  onSelectCategory?: (categoryId: string) => void;
}

const CategoryTab: React.FC<CategoryTabProps> = ({ onSelectCategory }) => {
 const { t } = useTranslation();
 const { addToast } = useNotification();
 const { activeBranchId, activeBranch } = useAuth();
 const [search, setSearch] = useState('');

 const [isFormOpen, setIsFormOpen] = useState(false);
 const [editingCategory, setEditingCategory] = useState<Category | null>(null);
 const [formData, setFormData] = useState({ name: '', description: '', color: '#3B82F6' });

 const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

 const itemCounts = useLiveQuery(async () => {
   const query = (activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId)) as any;
   const items = await query.filter((i: any) => !i.deletedAt).toArray();
   const counts: Record<string, number> = {};
   items.forEach((i: any) => {
     if (i.categoryId) {
       counts[i.categoryId] = (counts[i.categoryId] || 0) + 1;
     }
   });
   return counts;
 }, [activeBranchId, activeBranch?.isMaster]);

 const categories = useLiveQuery(
 () => {
 const query = (activeBranch?.isMaster ? db.categories : db.categories.where('branchId').equals(activeBranchId)) as any;
 if (search) {
 return query
 .filter((c: any) => !c.deletedAt && (c.name || '').toLowerCase().includes(search.toLowerCase()))
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
 addToast(t('inventory.category_updated'), 'success');
 } else {
 await db.categories.add({
 ...createRecordMetadata(),
 ...formData,
 createdAt: new Date(),
 });
 addToast(t('inventory.category_created'), 'success');
 }
 setIsFormOpen(false);
 } catch (error) {
 console.error(error);
 addToast(t('inventory.category_save_error'), 'error');
 }
 };

 const handleDelete = async () => {
 if (!categoryToDelete) return;
 try {
 await db.categories.update(categoryToDelete, softDeleteMetadata());
 addToast(t('inventory.category_deleted'), 'success');
 setCategoryToDelete(null);
 } catch (error) {
 console.error(error);
 addToast(t('inventory.category_delete_error'), 'error');
 }
 };

 return (
 <div className="space-y-8 fade-in slide-in-from-bottom-4">
 {/* Header & Search */}
 <div className="flex flex-col md:flex-row justify-between items-center gap-6">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-indigo-500 text-indigo-600 rounded-2xl border border-indigo-500/20">
 <Layers size={24} />
 </div>
 <div>
 <h2 className="text-2xl font-semibold dark:text-white uppercase tracking-tight">
 {t('inventory.categories')}
 </h2>
 <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{t('inventory.organize_items') || 'Organize products by departments'}</p>
 </div>
 </div>

 <div className="flex items-center gap-4 w-full md:w-auto">
 <div className="relative flex-1 group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500"size={18} />
 <input
 type="text"
 placeholder={t('inventory.search_categories') ||"Search categories..."}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full md:w-64 pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 dark:text-white"
 />
 </div>
 <button type="button"
 
 
 onClick={() => handleOpenForm()}
 className="flex items-center gap-3 bg-slate-900 dark:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold text-[10px] uppercase tracking-wider"
 >
 <Plus size={18} />
 {t('inventory.add_category')}
 </button>
 </div>
 </div>

 {/* Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
 <>
 {!categories ? (
 Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl"/>
))
) : categories.length === 0 ? (
 <div 
 
 
 className="col-span-full py-32 text-center bg-white dark:bg-slate-800 rounded-2xl border-4 border-dashed border-slate-200 dark:border-slate-800"
 >
 <Tags size={64} strokeWidth={1} className="mx-auto mb-6 text-slate-300"/>
 <h3 className="text-xl font-semibold dark:text-white uppercase tracking-tight mb-2">{t('inventory.no_categories')}</h3>
 <p className="text-slate-700 font-medium">{t('inventory.no_categories_desc')}</p>
 </div>
) : (
        categories.map((category: Category, idx: number) => (
          <div
            key={category.id}
            onClick={() => {
              if (onSelectCategory && category.id) {
                onSelectCategory(category.id);
              }
            }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-white/50 dark:border-slate-700/30 group relative overflow-hidden flex flex-col justify-between hover:border-indigo-500/50 hover:shadow-lg transition-all cursor-pointer"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/20" style={{ backgroundColor: category.color || '#3B82F6', color: 'white' }}>
                  <Hash size={24} />
                </div>
                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOpenForm(category); }}
                    className="p-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCategoryToDelete(category.id!); }}
                    className="p-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-semibold dark:text-white uppercase tracking-tight mb-2 line-clamp-1">{category.name}</h3>
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider line-clamp-2 min-h-[30px]">
                {category.description || 'No description provided'}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color || '#3B82F6' }} />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  {itemCounts?.[category.id!] || 0} {t('inventory.items') || 'Products'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>{t('inventory.view_products') || 'View Products'}</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>
        ))
)}
 </>
 </div>

 {/* Category Form Modal */}
 <Modal
 isOpen={isFormOpen}
 onClose={() => setIsFormOpen(false)}
 title={editingCategory ? t('inventory.edit_category') : t('inventory.new_category')}
 maxWidth="md"
 >
 <form onSubmit={handleSave} className="p-8 space-y-6">
 <div className="space-y-4">
 <div className="group">
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('inventory.category_name')} *</label>
 <div className="relative">
 <Tags className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500"size={18} />
 <input
 type="text"
 required
 value={formData.name}
 onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
 className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 dark:text-white"
 placeholder="e.g. Beverages"
 />
 </div>
 </div>

 <div>
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('inventory.category_desc')}</label>
 <textarea
 value={formData.description}
 onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
 className="w-full px-4 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 dark:text-white"
 rows={3}
 placeholder="Describe this category..."
 />
 </div>

 <div>
 <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">{t('inventory.category_color') || 'Category Color'}</label>
 <div className="flex items-center gap-4 p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
 <div className="relative">
 <input
 type="color"
 value={formData.color}
 onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
 className="h-12 w-12 rounded-xl cursor-pointer border-0 bg-transparent"
 />
 <Palette size={16} className="absolute inset-0 m-auto pointer-events-none text-white drop-"/>
 </div>
 <span className="font-mono text-xs font-bold text-slate-700 tracking-wider">{formData.color.toUpperCase()}</span>
 </div>
 </div>
 </div>

 <div className="flex gap-3 pt-4">
 <button
 type="button"
 onClick={() => setIsFormOpen(false)}
 className="flex-1 px-6 py-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold text-[10px] uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800"
 >
 {t('common.cancel')}
 </button>
 <button
 type="submit"
 className="flex-1 bg-slate-900 dark:bg-indigo-600 text-white px-6 py-4 rounded-2xl font-semibold text-[10px] uppercase tracking-wider"
 >
 {t('inventory.save_category')}
 </button>
 </div>
 </form>
 </Modal>

 <ConfirmationModal
 isOpen={categoryToDelete !== null}
 title={t('inventory.delete_category_title') || 'Delete Category?'}
 message={t('inventory.category_delete_confirm')}
 onConfirm={handleDelete}
 onClose={() => setCategoryToDelete(null)}
 confirmText={t('common.delete')}
 variant="danger"
 />
 </div>
);
};

export default CategoryTab;

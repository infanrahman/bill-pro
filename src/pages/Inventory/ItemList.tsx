import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, createRecordMetadata, softDeleteMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { 
 Search, Plus, Edit, Trash, ShieldOff, Upload, 
 QrCode, LayoutGrid, Tags, Wand2, PackageOpen, 
 List, Filter, ChevronDown, Sparkles, TrendingUp, 
 AlertTriangle, Banknote, MapPin, Box, ArrowUpRight, X, Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { read, utils } from 'xlsx';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import BarcodeModal from './BarcodeModal';
import CategoryTab from './CategoryTab';
import type { Item } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import Skeleton from '../../components/UI/Skeleton';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import clsx from 'clsx';

const ItemList: React.FC = () => {
 const { t } = useTranslation();
 const { settings, formatCurrency } = useSettings();
 const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();
 const { addToast } = useNotification();
 const navigate = useNavigate();

 const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
 const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

 // Pagination & Filter State
 const [search, setSearch] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
 const [currentPage, setCurrentPage] = useState(1);
 const [pageSize, setPageSize] = useState(settings.cafeMode ? 12 : 10);

 const [selectedItemForLabel, setSelectedItemForLabel] = useState<Item[] | null>(null);
 const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
 const [selectedIds, setSelectedIds] = useState<string[]>([]);

 // Delete States
 const [itemToDelete, setItemToDelete] = useState<string | null>(null);
 const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

 // Import State
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [isImporting, setIsImporting] = useState(false);

 // Categories Query to populate filter dropdown & resolve names
 const categories = useLiveQuery(
   () => {
     const query = (activeBranch?.isMaster ? db.categories : db.categories.where('branchId').equals(activeBranchId)) as any;
     return query.filter((c: any) => !c.deletedAt).toArray();
   },
   [activeBranchId, activeBranch?.isMaster]
 );

 const categoryMap = React.useMemo(() => {
   const map = new Map<string, { name: string; color?: string }>();
   if (categories) {
     categories.forEach((c: any) => {
       if (c.id) map.set(String(c.id), { name: c.name, color: c.color });
     });
   }
   return map;
 }, [categories]);

  // Reset to page 1 when search or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedSupplier, pageSize]);

 // Query for total count (for pagination)
 const totalItems = useLiveQuery(
   () => {
     const query = (activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId)) as any;
     return query
       .filter((item: any) => {
         if (item.deletedAt) return false;
         if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
         if (selectedSupplier !== 'all' && item.supplierId !== selectedSupplier) return false;
         if (search) {
           const searchLower = search.toLowerCase();
           return (
             (item.name || '').toLowerCase().includes(searchLower) ||
             (item.barcode || '').includes(searchLower) ||
             (!!item.itemCode && item.itemCode.toLowerCase().includes(searchLower))
           );
         }
         return true;
       })
       .count();
   },
   [search, selectedCategory, selectedSupplier, activeBranchId, activeBranch?.isMaster]
 ) || 0;

 // Paginated Data Query
 const items = useLiveQuery(
   () => {
     const offset = (currentPage - 1) * pageSize;
     const query = (activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId)) as any;
     return query
       .filter((item: any) => {
         if (item.deletedAt) return false;
         if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
         if (selectedSupplier !== 'all' && item.supplierId !== selectedSupplier) return false;
         if (search) {
           const searchLower = search.toLowerCase();
           return (
             (item.name || '').toLowerCase().includes(searchLower) ||
             (item.barcode || '').includes(searchLower) ||
             (!!item.itemCode && item.itemCode.toLowerCase().includes(searchLower))
           );
         }
         return true;
       })
       .offset(offset)
       .limit(pageSize)
       .toArray();
   },
   [search, selectedCategory, selectedSupplier, currentPage, pageSize, activeBranchId, activeBranch?.isMaster]
 );

 const loading = items === undefined;

 // Suppliers query to resolve supplier names
 const suppliers = useLiveQuery(() => db.suppliers.filter((s: any) => !s.deletedAt).toArray(), []);
 const supplierMap = React.useMemo(() => {
   const map = new Map<string, string>();
   if (suppliers) {
     suppliers.forEach((s: any) => {
       if (s.id) map.set(String(s.id), s.name);
     });
   }
   return map;
 }, [suppliers]);

 // Stats Query
 const inventoryStats = useLiveQuery(async () => {
 const query = (activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId)) as any;
 
 let total = 0;
 let lowStock = 0;
 let totalValue = 0;
 
 await query.filter((i: any) => !i.deletedAt).each((i: any) => {
 total++;
  // L4 Fix: Only flag low stock if minStock threshold > 0
  if ((i.minStock || 0) > 0 && (i.stock || 0) <= (i.minStock || 0)) {
  lowStock++;
  }
 totalValue += ((i.stock || 0) * (i.purchasePrice || 0));
 });
 
 return { total, lowStock, totalValue };
 }, [activeBranchId, activeBranch?.isMaster]);

 const totalPages = Math.ceil(totalItems / pageSize);

 const handleDeleteClick = useCallback((id: string) => {
 setItemToDelete(id);
 }, []);

 const handleConfirmDelete = async () => {
 if (itemToDelete) {
 await db.items.update(itemToDelete, softDeleteMetadata());
 setItemToDelete(null);
 setSelectedIds(prev => prev.filter((id: any) => id !== itemToDelete));
 addToast(t('inventory.delete_success') || 'Item deleted', 'success');
 }
 };

 const handleBulkDeleteClick = useCallback(() => {
 if (selectedIds.length === 0) return;
 setIsBulkDeleteModalOpen(true);
 }, [selectedIds.length]);

 const handleConfirmBulkDelete = async () => {
 try {
 await db.transaction('rw', db.items, async () => {
 for (const id of selectedIds) {
 await db.items.update(id, softDeleteMetadata());
 }
 });
 setSelectedIds([]);
 addToast(t('inventory.bulk_delete_success', { count: selectedIds.length }), 'success');
 } catch (e) {
 addToast(t('inventory.bulk_delete_error'), 'error');
 console.error(e);
 } finally {
 setIsBulkDeleteModalOpen(false);
 }
 };

 const toggleSelect = useCallback((id: string) => {
 setSelectedIds(prev =>
 prev.includes(id)
 ? prev.filter((x: any) => x !== id)
 : [...prev, id]
);
 }, []);

 const toggleSelectAll = () => {
 if (!items) return;
 const allSelected = items.every((item: any) => selectedIds.includes(item.id!));

 if (allSelected) {
 const visibleIds = items.map((i: any) => i.id!);
 setSelectedIds(prev => prev.filter((id: any) => !visibleIds.includes(id)));
 } else {
 const newIds = items.map((item: any) => item.id!).filter((id: any) => !selectedIds.includes(id));
 setSelectedIds(prev => [...prev, ...newIds]);
 }
 };

  const handleAutoFillBarcodes = async () => {
    try {
      const allItems = await db.items.toArray();
      const itemsWithoutBarcode = allItems.filter((item: any) => !item.barcode || item.barcode.trim() === '');

      if (itemsWithoutBarcode.length === 0) {
        addToast(t('inventory.all_items_have_barcodes'), 'info');
        return;
      }

      const confirm = window.confirm(t('inventory.confirm_auto_barcode', { count: itemsWithoutBarcode.length }));
      if (!confirm) return;

      const existingBarcodes = new Set(
        allItems.filter((item: any) => item.barcode && item.barcode.trim() !== '').map((item: any) => item.barcode)
      );

      const updatedItems = itemsWithoutBarcode.map((item: any) => {
        let newBarcode = '';
        let attempts = 0;
        do {
          newBarcode = Math.floor(10000000 + Math.random() * 90000000).toString();
          attempts++;
        } while (existingBarcodes.has(newBarcode) && attempts < 50);
        existingBarcodes.add(newBarcode);
        return { ...item, barcode: newBarcode };
      });

      await db.items.bulkPut(updatedItems);
      addToast(t('inventory.barcodes_generated', { count: updatedItems.length }), 'success');
    } catch (error) {
      console.error('Failed to auto-generate barcodes:', error);
      addToast(t('inventory.barcode_gen_error'), 'error');
    }
  };

 const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setIsImporting(true);
 try {
 const data = await file.arrayBuffer();
 const workbook = read(data);
 const sheetName = workbook.SheetNames[0];
 const worksheet = workbook.Sheets[sheetName];
 const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

 if (jsonData.length < 2) {
 addToast(t('inventory.import_empty'), 'error');
 return;
 }

 const headers = jsonData[0].map((h: any) => String(h || '').toLowerCase().trim());
 const nameIdx = headers.findIndex(h => h === 'name' || h === 'item name' || h === 'item');
 const arabicNameIdx = headers.findIndex(h => h.includes('arabic') || h === 'الاسم العربي');
 const barcodeIdx = headers.findIndex(h => h.includes('barcode') || h === 'plu');
 const salePriceIdx = headers.findIndex(h => h.includes('sale') || h.includes('price'));
 const costPriceIdx = headers.findIndex(h => h.includes('cost') || h.includes('purchase') || h.includes('buy'));
 const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('qty') || h.includes('quantity'));
 const catIdx = headers.findIndex(h => h.includes('category') || h.includes('dept'));
 const itemCodeIdx = headers.findIndex(h => h.includes('item code') || h.includes('itemcode') || h.includes('scale plu'));

 if (nameIdx === -1 || salePriceIdx === -1) {
 addToast(t('inventory.import_missing_cols'), 'error');
 return;
 }

 const categories = await db.categories.toArray();
 const categoryMap = new Map(categories.map((c: any) => [c.name.toLowerCase(), c.id!]));

 const itemsToAdd: Item[] = [];
 for (let i = 1; i < jsonData.length; i++) {
 const row = jsonData[i];
 if (!row || !row[nameIdx]) continue;

 let categoryId: string | undefined = undefined;
 if (catIdx !== -1 && row[catIdx]) {
 const catName = String(row[catIdx]).trim();
 const catLower = catName.toLowerCase();
 if (categoryMap.has(catLower)) {
 categoryId = categoryMap.get(catLower);
 } else if (catName) {
 const newId = await db.categories.add({ 
 ...createRecordMetadata(),
 name: catName, 
 color: '#3b82f6', 
 createdAt: new Date() 
 });
 categoryMap.set(catLower, newId as string);
 categoryId = newId as string;
 }
 }

 itemsToAdd.push({
 ...createRecordMetadata(),
 branchId: activeBranchId || '', // H21 Fix
 name: String(row[nameIdx]),
 arabicName: arabicNameIdx !== -1 && row[arabicNameIdx] ? String(row[arabicNameIdx]) : undefined,
 barcode: barcodeIdx !== -1 && row[barcodeIdx] ? String(row[barcodeIdx]) : '',
 itemCode: itemCodeIdx !== -1 && row[itemCodeIdx] ? String(row[itemCodeIdx]) : undefined,
 salePrice: Number(row[salePriceIdx]) || 0,
 purchasePrice: costPriceIdx !== -1 ? (Number(row[costPriceIdx]) || 0) : 0,
 stock: stockIdx !== -1 ? (Number(row[stockIdx]) || 0) : 0,
 categoryId,
 unit: 'pcs',
 taxType: 'inclusive',
 taxRate: 15,
 minStock: 5,
 });
 }

 if (itemsToAdd.length > 0) {
 await db.items.bulkPut(itemsToAdd);
 addToast(t('inventory.import_success', { count: itemsToAdd.length }), 'success');
 }

 } catch (err) {
 console.error(err);
 addToast(t('inventory.import_error'), 'error');
 } finally {
 setIsImporting(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

  // Page Level Guard
  if (!hasPermission('inventory_view')) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-8">
        <ShieldOff size={48} className="text-slate-300 mb-4"/>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
        <p className="text-slate-700">{t('inventory.access_denied_view')}</p>
      </div>
    );
  }

  return (
 <div className="space-y-6 max-w-[1600px] mx-auto">
 {/* Header Section */}
  <div className="relative overflow-hidden group">
 
 <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 relative z-10">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <PackageOpen size={32} className="text-slate-900 dark:text-white"/>
 <h1 className="text-2xl md:text-4xl font-semibold dark:text-white tracking-tight uppercase">
 {t('inventory.title')}
 </h1>
 </div>
 <p className="text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase tracking-wider">
 {t('inventory.manage_stock') || 'Maintain your product catalog and inventory levels'}
 </p>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <>
 {selectedIds.length > 0 && (
 <div className="flex items-center gap-2 bg-slate-900 dark:bg-slate-700 p-2 rounded-2xl">
 <span className="text-white text-[10px] font-semibold uppercase px-4 border-r border-white/20">{selectedIds.length} {t('common.selected')}</span>
 <button type="button"
 onClick={() => {
 const selectedItems = items?.filter((i: any) => selectedIds.includes(i.id!)) || [];
 setSelectedItemForLabel(selectedItems);
 setIsLabelModalOpen(true);
 }}
 className="p-3 text-white hover:bg-white hover:text-slate-900 rounded-xl transition-colors"
 title={t('inventory.print_label') || 'Print Labels'}
 >
 <Printer size={18} />
 </button>
 <button type="button"
 onClick={handleBulkDeleteClick}
 className="p-3 text-rose-400 hover:bg-rose-500 hover:text-white rounded-full transition-colors"
 title={t('common.delete')}
 >
 <Trash size={18} />
 </button>
 </div>
)}
 </>

 <div className="flex items-center gap-3">
  <button type="button"
  onClick={handleAutoFillBarcodes}
  className="p-3 bg-white dark:bg-slate-800 text-indigo-500 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
  title={t('inventory.auto_fill_barcodes')}
  >
  <Wand2 size={18} />
  </button>
  
  <input type="file"ref={fileInputRef} className="hidden"onChange={handleImportExcel} accept=".xlsx, .xls, .csv"/>
  <button type="button"
  onClick={() => fileInputRef.current?.click()}
  disabled={isImporting}
  className="p-3 bg-white dark:bg-slate-800 text-emerald-500 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
  >
  <Upload size={18} />
  </button>

  <button type="button"
  onClick={() => navigate('/inventory/add')}
  className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white px-6 py-3 rounded-full font-semibold text-xs uppercase tracking-wider"
  >
  <Plus size={16} />
  {t('common.add')}
  </button>
  </div>
 </div>
 </div>
 </div>

 {/* Stats Ribbon */}
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
 {[
 { label: t('inventory.total_items') || 'Total Products', value: inventoryStats?.total || 0, icon: Box, color: 'indigo' },
 { label: t('inventory.low_stock') || 'Low Stock Alerts', value: inventoryStats?.lowStock || 0, icon: AlertTriangle, color: 'rose' },
 { label: t('inventory.stock_value') || 'Stock Value (Cost)', value: formatCurrency(inventoryStats?.totalValue || 0), icon: Banknote, color: 'emerald' }
 ].map((stat, i) => (
 <div
 key={i}
 className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/30 shadow-sm flex flex-col items-start gap-4"
 >
 <div className={clsx(
 "p-3 rounded-2xl",
 stat.color === 'indigo' ?"bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600":
 stat.color === 'rose' ?"bg-rose-50 dark:bg-rose-900/30 text-rose-500":"bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500"
 )}>
 <stat.icon size={22} />
 </div>
 <div>
 <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">{stat.label}</p>
 <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
 </div>
 </div>
 ))}
 {/* Main Tabs & View Toggle */}
 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
 {/* Main Tabs */}
 <div className="flex md:inline-flex p-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 w-full md:w-auto shadow-sm">
 {[
 { id: 'items', label: t('inventory.items') || 'Products', icon: Box },
 { id: 'categories', label: t('inventory.categories') || 'Categories', icon: LayoutGrid }
 ].map((tab) => (
 <button type="button"
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={clsx(
 "flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
 activeTab === tab.id 
 ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-600' 
 : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
 )}
 >
 <tab.icon size={16} />
 {tab.label}
 </button>
 ))}
 </div>

 <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto flex-1 md:flex-none max-w-2xl">
 <div className="relative flex-1 group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white" size={18} />
 <input
 type="text"
 placeholder={t('inventory.search_placeholder') || 'Search items by name or barcode'}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl font-semibold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white shadow-sm"
 />
 </div>

 <div className="flex p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm shrink-0 self-center">
 <button
 type="button"
 onClick={() => setViewMode('list')}
 className={clsx(
 "p-2 rounded-lg transition-colors",
 viewMode === 'list' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-400'
 )}
 >
 <List size={18} />
 </button>
 <button
 type="button"
 onClick={() => setViewMode('grid')}
 className={clsx(
 "p-2 rounded-lg transition-colors",
 viewMode === 'grid' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-400'
 )}
 >
 <LayoutGrid size={18} />
 </button>
 </div>
 </div>
 </div>

 <div className="flex flex-col gap-2 md:flex-row md:items-center md:w-auto w-full">
 {activeTab === 'items' && categories && categories.length > 0 && (
 <select
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value)}
 className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl font-semibold text-xs outline-none shadow-sm cursor-pointer"
 >
 <option value="all">{t('inventory.all_categories') || 'All Categories'}</option>
 {categories.map((c: any) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 )}

 {activeTab === 'items' && suppliers && suppliers.length > 0 && (
 <select
 value={selectedSupplier}
 onChange={(e) => setSelectedSupplier(e.target.value)}
 className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl font-semibold text-xs outline-none shadow-sm cursor-pointer"
 >
 <option value="all">{t('inventory.supplier') || 'Supplier'}</option>
 {suppliers.map((s: any) => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 )}
 </div>
      </div>

      {activeTab === 'items' && selectedCategory !== 'all' && (
        <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 px-5 py-3 rounded-2xl w-fit">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryMap.get(selectedCategory)?.color || '#6366F1' }} />
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
            {t('inventory.category') || 'Category'}: <span className="font-extrabold">{categoryMap.get(selectedCategory)?.name || selectedCategory}</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="ml-2 text-indigo-500 hover:text-rose-500 font-bold p-1 rounded-lg transition-colors flex items-center gap-1 text-[10px] uppercase"
            title="Clear category filter"
          >
            <X size={14} />
            {t('common.clear') || 'Clear'}
          </button>
        </div>
      )}

      {/* Content Area */}
      <>
        {activeTab === 'categories' ? (
          <div key="categories">
            <CategoryTab
              onSelectCategory={(catId) => {
                setSelectedCategory(catId);
                setActiveTab('items');
              }}
            />
          </div>
) : (
 <div key="items">
 {loading || (items && items.length > 0) ? (
  viewMode === 'list' ? (
 <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 overflow-hidden shadow-sm">
   {/* Mobile Card View */}
   <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
     {loading || !items ? (
       Array.from({ length: 4 }).map((_, i) => (
         <div key={i} className="p-4 animate-pulse">
           <div className="flex gap-3">
             <Skeleton width={40} height={40} />
             <div className="flex-1">
               <Skeleton width="60%" height={14} />
               <Skeleton width="40%" height={12} />
             </div>
           </div>
         </div>
       ))
     ) : items.map((item: Item) => (
       <div key={item.id} className="p-4 flex items-start justify-between gap-3">
         <div className="flex items-center gap-3 min-w-0 flex-1">
           {item.image && <img src={item.image} className="w-10 h-10 rounded-lg object-cover border border-slate-100 dark:border-slate-700 shrink-0" alt="" />}
           <div className="min-w-0">
             <p className="font-bold text-xs dark:text-white uppercase tracking-tight truncate">{item.name}</p>
             {item.barcode && <p className="font-mono text-[10px] text-slate-400">{item.barcode}</p>}
             <div className="flex items-center gap-2 mt-1">
               <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase border",
                 (item.stock || 0) <= (item.minStock || 0)
                   ? "bg-rose-50 text-rose-500 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400"
                   : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
               )}>
                 {item.stock} {t('inventory.units')}
               </span>
               <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(item.salePrice)}</span>
             </div>
           </div>
         </div>
         <div className="flex gap-1 shrink-0">
           <button type="button" onClick={() => navigate(`/inventory/edit/${item.id}`)} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg"><Edit size={14} /></button>
           <button type="button" onClick={() => handleDeleteClick(item.id!)} className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-lg"><Trash size={14} /></button>
         </div>
       </div>
     ))}
   </div>

   {/* Desktop Table View */}
   <div className="hidden md:block overflow-x-auto">
   <table className="w-full text-left whitespace-nowrap min-w-[800px]">
   <thead>
   <tr className="border-b border-slate-50 dark:border-slate-700/50">
   <th className="p-5 w-12 text-center">
   <input
   type="checkbox"
   className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
   checked={items && items.length > 0 && items.every((i: any) => selectedIds.includes(i.id!))}
   onChange={toggleSelectAll}
   />
   </th>
   <th className="p-5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('inventory.item_name') || 'Item Name'}</th>
   <th className="p-5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('inventory.barcode') || 'Barcode'}</th>
   <th className="p-5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('inventory.stock') || 'Stock'}</th>
   <th className="p-5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('inventory.sale_price') || 'Sale Price'}</th>
   <th className="p-5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('inventory.supplier') || t('suppliers.title') || 'Supplier'}</th>
   <th className="p-5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right"></th>
   </tr>
   </thead>
   <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
   {loading || !items ? (
   Array.from({ length: 5 }).map((_, i) => (
   <tr key={i} className="">
   <td className="p-5"><Skeleton width={20} height={20} /></td>
   <td className="p-5"><Skeleton width={200} height={20} /></td>
   <td className="p-5"><Skeleton width={120} height={20} /></td>
   <td className="p-5"><Skeleton width={80} height={20} /></td>
   <td className="p-5"><Skeleton width={100} height={20} /></td>
   <td className="p-5"><Skeleton width={100} height={20} /></td>
   <td className="p-5 text-right"><Skeleton width={100} height={32} /></td>
   </tr>
  ))
 ) : (
   items.map((item: Item, idx: number) => (
   <tr 
   key={item.id}
   className="hover:bg-slate-50 dark:hover:bg-slate-700/50 group transition-colors"
   >
   <td className="p-5 text-center">
   <input
   type="checkbox"
   className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
   checked={selectedIds.includes(item.id!)}
   onChange={() => toggleSelect(item.id!)}
   />
   </td>
   <td className="p-5">
   <div className="flex items-center gap-4">
   {item.image && (
   <img src={item.image} className="w-10 h-10 rounded-lg object-cover border border-slate-100 dark:border-slate-700" alt=""/>
  )}
   <div>
   <p className="font-bold text-xs dark:text-white uppercase tracking-tight">{item.name}</p>
   {item.itemCode && (
   <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded tracking-wider">
   PLU: {item.itemCode}
   </span>
  )}
   </div>
   </div>
   </td>
   <td className="p-5">
   <span className="font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg text-indigo-700 dark:text-indigo-400 tracking-wider inline-block">
   {item.barcode || '---'}
   </span>
   </td>
   <td className="p-5">
   <div className={clsx(
  "flex items-center gap-2 px-3 py-1 rounded-full w-fit text-[9px] font-semibold uppercase tracking-wider border",
   (item.stock || 0) <= (item.minStock || 0) 
   ?"bg-rose-500/10 text-rose-500 border-rose-500/20"
   :"bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  )}>
   <div className={clsx("w-1.5 h-1.5 rounded-full", (item.stock || 0) <= (item.minStock || 0) ?"bg-rose-500":"bg-emerald-500")} />
   {item.stock} {t('inventory.units')}
   </div>
   </td>
   <td className="p-5">
   <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{formatCurrency(item.salePrice)}</p>
   </td>
   <td className="p-5">
   <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
   {item.supplierId ? (supplierMap.get(item.supplierId) || '---') : '---'}
   </span>
   </td>
   <td className="p-5 text-right">
   <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100">
   <button type="button" onClick={() => navigate(`/inventory/edit/${item.id}`)} className="p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors" title={t('common.edit') || 'Edit'}><Edit size={16} /></button>
   <button type="button" onClick={() => { setSelectedItemForLabel([item]); setIsLabelModalOpen(true); }} className="p-2.5 bg-white dark:bg-slate-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors" title={t('inventory.print_label') || 'Print Label'}><Printer size={16} /></button>
   <button type="button" onClick={() => handleDeleteClick(item.id!)} className="p-2.5 bg-white dark:bg-slate-800 text-rose-500 hover:bg-rose-50 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors" title={t('common.delete') || 'Delete'}><Trash size={16} /></button>
   </div>
   </td>
   </tr>
  ))
 )}
   </tbody>
   </table>
   </div>
 </div>
) : (
 <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-8">
 {items?.map((item: Item, idx: number) => (
 <div
 key={item.id}
 className={clsx(
"bg-white dark:bg-slate-800 p-6 rounded-2xl border group relative",
 selectedIds.includes(item.id!) ?"border-slate-900/50 dark:border-white/50":"border-white/50 dark:border-slate-700/30"
)}
 >
 <div className="flex justify-between items-start mb-6">
 <div className="relative">
 <div className="w-16 h-16 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center border border-slate-900/20 dark:border-white/20 overflow-hidden">
 {item.image ? (
 <img src={item.image} className="w-full h-full object-cover"alt=""/>
) : (
 <Box size={24} className="text-slate-900 dark:text-white"/>
)}
 </div>
 <input
 type="checkbox"
 className="absolute -top-2 -left-2 w-6 h-6 rounded-lg border-slate-300 text-slate-900 dark:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100"
 checked={selectedIds.includes(item.id!)}
 onChange={() => toggleSelect(item.id!)}
 />
 </div>
 <div className="text-right">
 <p className="text-[8px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{t('common.price')}</p>
 <p className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">{formatCurrency(item.salePrice)}</p>
 </div>
 </div>

 <h3 className="text-xl font-semibold dark:text-white uppercase tracking-tight mb-2 line-clamp-1">{item.name}</h3>
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="font-mono text-[9px] font-semibold text-slate-600 uppercase bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded tracking-wider">{item.barcode || 'NO BARCODE'}</span>
                {item.categoryId && categoryMap.has(item.categoryId) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryMap.get(item.categoryId)?.color || '#6366f1' }} />
                    {categoryMap.get(item.categoryId)?.name}
                  </span>
                )}
                {item.location && (
                  <span className="flex items-center gap-1 text-[8px] font-semibold text-slate-600 uppercase tracking-wider">
                    <MapPin size={10} /> {item.location}
                  </span>
                )}
              </div>

 <div className={clsx(
"flex items-center justify-between p-4 rounded-2xl border mb-6",
 (item.stock || 0) <= (item.minStock || 0) 
 ?"bg-rose-500/5 border-rose-500/10"
 :"bg-emerald-500/5 border-emerald-500/10"
)}>
 <div className="flex items-center gap-3">
 <div className={clsx("w-2 h-2 rounded-full", (item.stock || 0) <= (item.minStock || 0) ?"bg-rose-500":"bg-emerald-500")} />
 <p className="text-[10px] font-semibold dark:text-white uppercase tracking-wider">{t('inventory.stock')}</p>
 </div>
 <p className={clsx("text-lg font-semibold tracking-tight", (item.stock || 0) <= (item.minStock || 0) ?"text-rose-500":"text-emerald-500")}>
 {item.stock} <span className="text-[10px] font-bold text-slate-600">{t('units.pc')}</span>
 </p>
 </div>

 <div className="flex gap-2">
 <button type="button" onClick={() => navigate(`/inventory/edit/${item.id}`)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white transition-colors">
 <Edit size={14} /> {t('common.edit')}
 </button>
 <button type="button" onClick={() => { setSelectedItemForLabel([item]); setIsLabelModalOpen(true); }} className="p-3 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors" title={t('inventory.print_label') || 'Print Label'}>
 <Printer size={16} />
 </button>
 </div>
 </div>
))}
 </div>
)
 ) : null}
 </div>
)}
 </>

 {/* Pagination */}
 {!loading && activeTab === 'items' && totalPages > 1 && (
 <div className="mt-8 flex justify-center">
 <Pagination
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={setCurrentPage}
 totalItems={totalItems}
 itemsPerPage={pageSize}
 onItemsPerPageChange={setPageSize}
 />
 </div>
)}

 {/* Empty State */}
 {!loading && activeTab === 'items' && items?.length === 0 && (
 <div className="py-20 md:py-40 px-6 text-center bg-white dark:bg-slate-800 rounded-3xl md:rounded-[4rem] border-4 border-dashed border-slate-200 dark:border-slate-800 max-w-4xl mx-auto">
 <PackageOpen size={64} strokeWidth={1} className="mx-auto mb-6 text-slate-300 md:w-20 md:h-20"/>
 <h3 className="text-xl md:text-2xl font-semibold dark:text-white uppercase tracking-tight mb-2">{search ? t('common.no_results') : t('inventory.no_items')}</h3>
 <p className="text-slate-700 font-medium mb-8 text-sm md:text-base">{search ? t('common.try_different_search') : t('inventory.no_items_desc')}</p>
 {hasPermission('inventory_add') && !search && (
 <button type="button"
 onClick={() => navigate('/inventory/add')}
 className="bg-slate-900 dark:bg-white text-white px-8 md:px-10 py-3 md:py-4 rounded-2xl font-semibold text-[10px] md:text-xs uppercase tracking-wider"
 >
 {t('inventory.add_item', 'Add New Item')}
 </button>
)}
 </div>
)}

 {/* Modals */}
 <ConfirmationModal
 isOpen={!!itemToDelete}
 onClose={() => setItemToDelete(null)}
 onConfirm={handleConfirmDelete}
 title={t('inventory.delete_confirm_title')}
 message={t('inventory.delete_confirm')}
 confirmText={t('common.delete')}
 variant="danger"
 />

 <ConfirmationModal
 isOpen={isBulkDeleteModalOpen}
 onClose={() => setIsBulkDeleteModalOpen(false)}
 onConfirm={handleConfirmBulkDelete}
 title={t('inventory.bulk_delete_title')}
 message={t('inventory.bulk_delete_confirm', { count: selectedIds.length })}
 confirmText={t('common.delete')}
 variant="danger"
 />

 <BarcodeModal
 isOpen={isLabelModalOpen}
 onClose={() => setIsLabelModalOpen(false)}
 items={selectedItemForLabel}
 />
 </div>
);
};

export default ItemList;

import React, { useState, useEffect, useRef } from 'react';
import { db, createRecordMetadata, softDeleteMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Edit, Trash, ShieldOff, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { read, utils } from 'xlsx';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { QrCode, LayoutGrid, Tags, Wand2 } from 'lucide-react';
import BarcodeModal from './BarcodeModal';
import CategoryTab from './CategoryTab';
import type { Item } from '../../services/db';

import { useNotification } from '../../contexts/NotificationContext';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import { useGridNavigation } from '../../hooks/useGridNavigation';
import Skeleton from '../../components/UI/Skeleton';
import EmptyState from '../../components/UI/EmptyState';
import { PackageOpen } from 'lucide-react';
import Pagination from '../../components/UI/Pagination';

const ItemList: React.FC = () => {
    const { t } = useTranslation();
    const { settings, formatCurrency } = useSettings();
    const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();
    const { addToast } = useNotification();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');

    // Pagination & Filter State
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [selectedItemForLabel, setSelectedItemForLabel] = useState<Item[] | null>(null);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Delete States
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Import State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Page Level Guard
    if (!hasPermission('inventory_view')) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('inventory.access_denied_view')}</p>
            </div>
        );
    }

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search, pageSize]);

    // Query for total count (for pagination)
    const totalItems = useLiveQuery(
        () => {
            const query = (activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId)) as any;
            if (search) {
                return query
                    .filter((item: any) => !item.deletedAt && (
                        item.name.toLowerCase().includes(search.toLowerCase()) ||
                        item.barcode.includes(search) ||
                        (!!item.itemCode && item.itemCode.includes(search))
                    ))
                    .count();
            }
            return query.filter((item: any) => !item.deletedAt).count();
        },
        [search, activeBranchId, activeBranch?.isMaster]
    ) || 0;

    // Paginated Data Query
    const items = useLiveQuery(
        () => {
            const offset = (currentPage - 1) * pageSize;
            const query = (activeBranch?.isMaster ? db.items : db.items.where('branchId').equals(activeBranchId)) as any;
            if (search) {
                return query
                    .filter((item: any) => !item.deletedAt && (
                        item.name.toLowerCase().includes(search.toLowerCase()) ||
                        item.barcode.includes(search) ||
                        (!!item.itemCode && item.itemCode.includes(search))
                    ))
                    .offset(offset)
                    .limit(pageSize)
                    .toArray();
            }
            return query
                .filter((item: any) => !item.deletedAt)
                .offset(offset)
                .limit(pageSize)
                .toArray();
        },
        [search, currentPage, pageSize, activeBranchId, activeBranch?.isMaster]
    );

    const totalPages = Math.ceil(totalItems / pageSize);

    // Grid Nav
    const { getGridCellProps } = useGridNavigation({
        rows: items?.length || 0,
        cols: 8
    });

    const suppliers = useLiveQuery(() => activeBranch?.isMaster ? db.suppliers.toArray() : db.suppliers.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);

    const handleDeleteClick = (id: string) => {
        setItemToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if (itemToDelete) {
            await db.items.update(itemToDelete, softDeleteMetadata());
            setItemToDelete(null);
            // Refresh selection if needed, though useLiveQuery handles data
            setSelectedIds(prev => prev.filter((id: any) => id !== itemToDelete));
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedIds.length === 0) return;
        setIsBulkDeleteModalOpen(true);
    };

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

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter((x: any) => x !== id)
                : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (!items) return;
        const allSelected = items.every((item: any) => selectedIds.includes(item.id!));

        if (allSelected) {
            // Deselect all visible
            const visibleIds = items.map((i: any) => i.id!);
            setSelectedIds(prev => prev.filter((id: any) => !visibleIds.includes(id)));
        } else {
            // Select all visible
            const newIds = items.map((item: any) => item.id!).filter((id: any) => !selectedIds.includes(id));
            setSelectedIds(prev => [...prev, ...newIds]);
        }
    };

    const handleAutoFillBarcodes = async () => {
        try {
            const allItems = await db.items.toArray();
            const itemsWithoutBarcode = allItems.filter((item: any) => !item.barcode || item.barcode.trim() === '');

            if (itemsWithoutBarcode.length === 0) {
                addToast(t('inventory.all_items_have_barcodes', { defaultValue: 'All items already have barcodes.' }), 'info');
                return;
            }

            const confirm = window.confirm(t('inventory.confirm_auto_barcode', {
                defaultValue: `Auto-generate barcodes for ${itemsWithoutBarcode.length} items without barcodes?`,
                count: itemsWithoutBarcode.length
            }));
            if (!confirm) return;

            const updatedItems = itemsWithoutBarcode.map((item: any) => {
                const newBarcode = Math.floor(10000000 + Math.random() * 90000000).toString();
                return { ...item, barcode: newBarcode };
            });

            await db.items.bulkPut(updatedItems);
            addToast(t('inventory.barcodes_generated', {
                defaultValue: `Generated barcodes for ${updatedItems.length} items.`,
                count: updatedItems.length
            }), 'success');

            // Just force a reload or wait for live query
        } catch (error) {
            console.error('Failed to auto-generate barcodes:', error);
            addToast(t('inventory.barcode_gen_error', { defaultValue: 'Error generating barcodes.' }), 'error');
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
                addToast(t('inventory.import_empty', { defaultValue: 'File is empty or missing data.' }), 'error');
                return;
            }

            // Simple column mapping heuristics
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
                addToast(t('inventory.import_missing_cols', { defaultValue: 'Missing required columns: Name and Price' }), 'error');
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
                    taxRate: 15, // Default tax rate
                    minStock: 5, // Default min stock
                });
            }

            if (itemsToAdd.length > 0) {
                await db.items.bulkPut(itemsToAdd);
                addToast(t('inventory.import_success', { defaultValue: `Successfully imported ${itemsToAdd.length} items.` }), 'success');
            }

        } catch (err) {
            console.error(err);
            addToast(t('inventory.import_error', { defaultValue: 'Failed to import file.' }), 'error');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold dark:text-white">{t('inventory.title')}</h1>
                    {selectedIds.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const selectedItems = items?.filter((i: any) => selectedIds.includes(i.id!)) || [];
                                    setSelectedItemForLabel(selectedItems);
                                    setIsLabelModalOpen(true);
                                }}
                                className="flex items-center gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors animate-in fade-in"
                            >
                                <QrCode size={16} /> {t('inventory.print_label')} ({selectedIds.length})
                            </button>
                            <button
                                onClick={handleBulkDeleteClick}
                                className="flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors animate-in fade-in"
                            >
                                <Trash size={16} /> {t('common.delete')} ({selectedIds.length})
                            </button>
                        </div>
                    )}
                </div>
                {hasPermission('inventory_add') && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleAutoFillBarcodes}
                            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                            title={t('inventory.auto_fill_barcodes', { defaultValue: 'Auto-fill missing barcodes' })}
                        >
                            <Wand2 size={20} className="text-purple-500" />
                        </button>
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleImportExcel}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                            <Upload size={20} />
                            {isImporting ? t('common.loading', { defaultValue: 'Importing...' }) : t('inventory.import_excel', { defaultValue: 'Import Excel' })}
                        </button>
                        <button
                            onClick={() => navigate('/inventory/add')}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            <Plus size={20} />
                            {t('common.add')}
                        </button>
                    </div>
                )}
            </div>

            {/* In Market Mode, show tabs to manage Items vs Categories */}
            {settings.cafeMode && (
                <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6 pb-2">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'items' ? 'text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                    >
                        <LayoutGrid size={18} />
                        {t('sidebar.menu', { defaultValue: 'Menu Items' })}
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'categories' ? 'text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                    >
                        <Tags size={18} />
                        {t('inventory.categories') || 'Categories'}
                    </button>
                </div>
            )}

            {activeTab === 'categories' ? (
                <CategoryTab />
            ) : (
                <>
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder={t('inventory.search_placeholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left whitespace-nowrap min-w-[800px]">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={items && items.length > 0 && items.every((i: any) => selectedIds.includes(i.id!))}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="p-4 font-semibold">{t('inventory.item_name')}</th>
                                        <th className="p-4 font-semibold">{t('inventory.barcode')}</th>
                                        <th className="p-4 font-semibold">{t('inventory.item_code') || 'Item Code'}</th>
                                        <th className="p-4 font-semibold">{t('inventory.stock')}</th>
                                        <th className="p-4 font-semibold">{t('inventory.sale_price')}</th>
                                        <th className="p-4 font-semibold">{t('purchases.supplier') || 'Supplier'}</th>
                                        <th className="p-4 font-semibold">{t('inventory.location')}</th>
                                        <th className="p-4 font-semibold text-right">{t('inventory.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {!items ? (
                                        Array.from({ length: 5 }).map((_: any, i: any) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="p-4"><Skeleton width={20} height={20} /></td>
                                                <td className="p-4"><Skeleton width={200} height={20} /></td>
                                                <td className="p-4"><Skeleton width={120} height={20} /></td>
                                                <td className="p-4"><Skeleton width={80} height={20} /></td>
                                                <td className="p-4"><Skeleton width={80} height={20} /></td>
                                                <td className="p-4"><Skeleton width={100} height={20} /></td>
                                                <td className="p-4"><Skeleton width={80} height={20} /></td>
                                                <td className="p-4"><Skeleton width={100} height={20} /></td>
                                                <td className="p-4"><Skeleton width={120} height={36} /></td>
                                            </tr>
                                        ))
                                    ) : items.length === 0 ? (
                                        <tr>
                                            <td colSpan={9}>
                                                <EmptyState
                                                    title={search ? t('common.no_results') : t('inventory.no_items')}
                                                    description={search ? t('common.try_different_search') : (t('inventory.no_items_desc') || "Start by adding items to your inventory.")}
                                                    icon={PackageOpen}
                                                    actionLabel={!search && hasPermission('inventory_manage') ? t('common.add') : undefined}
                                                    onAction={() => navigate('/inventory/add')}
                                                />
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item: any, rowIndex: any) => (
                                            <tr key={item.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group ${selectedIds.includes(item.id!) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                                <td {...getGridCellProps(rowIndex, 0)} className="p-4 text-center outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-l-lg">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedIds.includes(item.id!)}
                                                        onChange={() => toggleSelect(item.id!)}
                                                        // Allow Enter key to toggle checkbox
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') toggleSelect(item.id!);
                                                        }}
                                                    />
                                                </td>
                                                <td {...getGridCellProps(rowIndex, 1)} className="p-4 font-medium dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm">{item.name}</td>
                                                <td {...getGridCellProps(rowIndex, 2)} className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{item.barcode || '-'}</td>
                                                <td {...getGridCellProps(rowIndex, 3)} className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{item.itemCode || '-'}</td>
                                                <td {...getGridCellProps(rowIndex, 4)} className="p-4 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">
                                                    <span className={`px-2 py-1.5 rounded-md text-xs font-semibold ${item.stock <= item.minStock
                                                        ? 'bg-red-50 text-red-600 border border-red-200 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                                                        : 'bg-green-50 text-green-600 border border-green-200 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                        }`}>
                                                        {item.stock} <span className="text-[10px] font-medium uppercase opacity-70 ml-1">{t('inventory.units')}</span>
                                                    </span>
                                                </td>
                                                <td {...getGridCellProps(rowIndex, 5)} className="p-4 dark:text-slate-200 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm font-medium">{formatCurrency(item.salePrice)}</td>
                                                <td {...getGridCellProps(rowIndex, 6)} className="p-4 text-slate-500 dark:text-slate-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm">
                                                    {item.supplierId && suppliers ? suppliers.find(s => s.id === item.supplierId)?.name || '-' : '-'}
                                                </td>
                                                <td {...getGridCellProps(rowIndex, 7)} className="p-4 text-slate-500 dark:text-slate-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm">{item.location || '-'}</td>
                                                <td {...getGridCellProps(rowIndex, 8)} className="p-4 flex gap-2 justify-end outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-r-lg">
                                                    {hasPermission('inventory_edit') && (
                                                        <button
                                                            onClick={() => navigate(`/inventory/edit/${item.id}`)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                                                            title={t('common.edit')}
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                    )}
                                                    {(isAdmin || hasPermission('inventory_delete')) && (
                                                        <button
                                                            onClick={() => handleDeleteClick(item.id!)}
                                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                                            title={t('common.delete')}
                                                        >
                                                            <Trash size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedItemForLabel([item]);
                                                            setIsLabelModalOpen(true);
                                                        }}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                                                        title={t('inventory.print_label')}
                                                    >
                                                        <QrCode size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={totalItems}
                            itemsPerPage={pageSize}
                            onItemsPerPageChange={setPageSize}
                        />
                    )}
                </>
            )}

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
        </div >
    );
};

export default ItemList;

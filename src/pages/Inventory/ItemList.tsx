import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Edit, Trash, ShieldOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { QrCode } from 'lucide-react';
import BarcodeModal from './BarcodeModal';
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
    const { formatCurrency } = useSettings();
    const { hasPermission, isAdmin } = useAuth();
    const { addToast } = useNotification();
    const navigate = useNavigate();

    // Pagination & Filter State
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [selectedItemForLabel, setSelectedItemForLabel] = useState<Item | null>(null);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Delete States
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

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
            if (search) {
                return db.items
                    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.barcode.includes(search))
                    .count();
            }
            return db.items.count();
        },
        [search]
    ) || 0;

    // Paginated Data Query
    const items = useLiveQuery(
        () => {
            const offset = (currentPage - 1) * pageSize;
            if (search) {
                return db.items
                    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.barcode.includes(search))
                    .offset(offset)
                    .limit(pageSize)
                    .toArray();
            }
            return db.items
                .offset(offset)
                .limit(pageSize)
                .toArray();
        },
        [search, currentPage, pageSize]
    );

    const totalPages = Math.ceil(totalItems / pageSize);

    // Grid Nav
    const { getGridCellProps } = useGridNavigation({
        rows: items?.length || 0,
        cols: 7
    });

    const handleDeleteClick = (id: number) => {
        setItemToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if (itemToDelete) {
            await db.items.delete(itemToDelete);
            setItemToDelete(null);
            // Refresh selection if needed, though useLiveQuery handles data
            setSelectedIds(prev => prev.filter(id => id !== itemToDelete));
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedIds.length === 0) return;
        setIsBulkDeleteModalOpen(true);
    };

    const handleConfirmBulkDelete = async () => {
        try {
            await db.items.bulkDelete(selectedIds);
            setSelectedIds([]);
            addToast(t('inventory.bulk_delete_success', { count: selectedIds.length }), 'success');
        } catch (e) {
            addToast(t('inventory.bulk_delete_error'), 'error');
            console.error(e);
        } finally {
            setIsBulkDeleteModalOpen(false);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (!items) return;
        const allSelected = items.every(item => selectedIds.includes(item.id!));

        if (allSelected) {
            // Deselect all visible
            const visibleIds = items.map(i => i.id!);
            setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            // Select all visible
            const newIds = items.map(item => item.id!).filter(id => !selectedIds.includes(id));
            setSelectedIds(prev => [...prev, ...newIds]);
        }
    };



    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold dark:text-white">{t('inventory.title')}</h1>
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDeleteClick}
                            className="flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors animate-in fade-in"
                        >
                            <Trash size={16} /> {t('common.delete')} ({selectedIds.length})
                        </button>
                    )}
                </div>
                {hasPermission('inventory_manage') && (
                    <div className="flex gap-2">
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
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="p-4 w-12">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={items && items.length > 0 && items.every(i => selectedIds.includes(i.id!))}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="p-4 font-medium">{t('inventory.item_name')}</th>
                            <th className="p-4 font-medium">{t('inventory.barcode')}</th>
                            <th className="p-4 font-medium">{t('inventory.stock')}</th>
                            <th className="p-4 font-medium">{t('inventory.sale_price')}</th>
                            <th className="p-4 font-medium">{t('inventory.location')}</th>
                            <th className="p-4 font-medium">{t('inventory.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {!items ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="p-4"><Skeleton width={20} height={20} /></td>
                                    <td className="p-4"><Skeleton width={200} height={20} /></td>
                                    <td className="p-4"><Skeleton width={120} height={20} /></td>
                                    <td className="p-4"><Skeleton width={80} height={20} /></td>
                                    <td className="p-4"><Skeleton width={80} height={20} /></td>
                                    <td className="p-4"><Skeleton width={100} height={20} /></td>
                                    <td className="p-4"><Skeleton width={120} height={36} /></td>
                                </tr>
                            ))
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={7}>
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
                            items.map((item, rowIndex) => (
                                <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedIds.includes(item.id!) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                    <td {...getGridCellProps(rowIndex, 0)} className="p-4 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-l-lg">
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
                                    <td {...getGridCellProps(rowIndex, 1)} className="p-4 font-medium dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{item.name}</td>
                                    <td {...getGridCellProps(rowIndex, 2)} className="p-4 text-slate-500 dark:text-slate-400 font-mono text-sm outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{item.barcode || '-'}</td>
                                    <td {...getGridCellProps(rowIndex, 3)} className="p-4 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.stock <= item.minStock
                                            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                            {item.stock} {t('inventory.units')}
                                        </span>
                                    </td>
                                    <td {...getGridCellProps(rowIndex, 4)} className="p-4 dark:text-slate-200 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{formatCurrency(item.salePrice)}</td>
                                    <td {...getGridCellProps(rowIndex, 5)} className="p-4 text-slate-500 dark:text-slate-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{item.location || '-'}</td>
                                    <td {...getGridCellProps(rowIndex, 6)} className="p-4 flex gap-2 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-r-lg">
                                        {hasPermission('inventory_manage') && (
                                            <button
                                                onClick={() => navigate(`/inventory/edit/${item.id}`)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                                                title={t('common.edit')}
                                            >
                                                <Edit size={18} />
                                            </button>
                                        )}
                                        {(isAdmin || hasPermission('inventory_manage')) && (
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
                                                setSelectedItemForLabel(item);
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

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={pageSize}
                    onItemsPerPageChange={setPageSize}
                />
            </div>

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
                item={selectedItemForLabel}
            />
        </div >
    );
};

export default ItemList;

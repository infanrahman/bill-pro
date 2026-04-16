import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db, type Scale } from '../../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNotification } from '../../../contexts/NotificationContext';
import { scaleService } from '../../../services/scaleService';
import { Plus, Wifi, Upload, Download, RefreshCw, Trash2, Server, Search, Settings, Keyboard } from 'lucide-react';
import ScalePluManager, { type PluRow } from '../../../components/Scale/ScalePluManager';
import DeletePluModal from '../../../components/Scale/DeletePluModal';
import ScaleHotkeyModal from '../../../components/Scale/ScaleHotkeyModal';

const ScaleTab: React.FC = () => {
    const { t } = useTranslation();
    const { addToast } = useNotification();

    const scales = useLiveQuery(() => db.scales.toArray());

    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState('');
    const [ipAddress, setIpAddress] = useState('');
    const [port, setPort] = useState('33581');
    const [model, setModel] = useState('Generic');
    const [isTesting, setIsTesting] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState<string | null>(null);
    const [isBulkSyncing, setIsBulkSyncing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [activeScaleManager, setActiveScaleManager] = useState<Scale | null>(null);
    const [activeScalePlus, setActiveScalePlus] = useState<any[]>([]);
    const [deletePluScale, setDeletePluScale] = useState<Scale | null>(null);
    const [configHotkeyScale, setConfigHotkeyScale] = useState<Scale | null>(null);
    const [deleteScaleId, setDeleteScaleId] = useState<string | null>(null);

    const handleScanNetwork = async () => {
        if (!window.electron?.scanNetworkScales) {
            addToast('Network scanning not supported in this environment.', 'warning');
            return;
        }

        setIsScanning(true);
        try {
            const targetPort = parseInt(port) || 33581;
            const results = await window.electron.scanNetworkScales(targetPort);
            if (results && results.length > 0) {
                setIpAddress(results[0].ip);
                addToast(t('scales.scan_success', { defaultValue: `Found ${results.length} scale(s) on network (Port ${targetPort}).` }), 'success');
            } else {
                addToast(t('scales.scan_empty', { defaultValue: `No scales found on the local network (Port ${targetPort}).` }), 'warning');
            }
        } catch (error) {
            addToast(t('scales.scan_error', { defaultValue: 'Error scanning network.' }), 'error');
        } finally {
            setIsScanning(false);
        }
    };

    const handleAddScale = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { createRecordMetadata } = await import('../../../services/db');
            await db.scales.add({
                ...createRecordMetadata(),
                name,
                ipAddress,
                port: parseInt(port) || 33581,
                model,
                status: 'unknown',
                createdAt: new Date(),
            });
            addToast(t('scales.add_success', { defaultValue: 'Scale added successfully.' }), 'success');
            setIsAdding(false);
            setName('');
            setIpAddress('');
        } catch (error) {
            addToast(t('scales.add_error', { defaultValue: 'Failed to add scale.' }), 'error');
        }
    };

    const confirmDeleteScale = async () => {
        if (deleteScaleId !== null) {
            await db.scales.delete(deleteScaleId);
            addToast(t('scales.delete_success', { defaultValue: 'Scale deleted.' }), 'success');
            setDeleteScaleId(null);
        }
    };

    const handleDeleteScale = (id: string) => {
        setDeleteScaleId(id);
    };

    const handleConfirmDeletePLU = async (pluNumber: string) => {
        if (!deletePluScale) return;
        setIsSyncing(deletePluScale.id!);
        try {
            const success = await scaleService.deletePLU(deletePluScale, pluNumber);
            if (success) {
                addToast(t('scales.delete_plu_success', { defaultValue: `PLU ${pluNumber} deleted successfully.`, plu: pluNumber }), 'success');
            } else {
                addToast(t('scales.delete_plu_failed', { defaultValue: `Failed to delete PLU ${pluNumber}.`, plu: pluNumber }), 'error');
            }
        } catch (err) {
            addToast(t('scales.delete_plu_error', { defaultValue: 'Error deleting PLU from scale.' }), 'error');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleTestConnection = async (scale: Scale) => {
        setIsTesting(scale.id!);
        try {
            const result = await scaleService.testConnection(scale.ipAddress, scale.port);
            await db.scales.update(scale.id!, { status: result.success ? 'online' : 'offline' });

            if (result.success) {
                addToast(t('scales.test_success', { defaultValue: 'Connection successful!' }), 'success');
            } else {
                addToast(result.message || t('scales.test_failed', { defaultValue: 'Connection failed. Scale unreachable.' }), 'error');
            }
        } catch (err) {
            addToast(t('scales.test_error', { defaultValue: 'Error during connection test.' }), 'error');
            await db.scales.update(scale.id!, { status: 'offline' });
        } finally {
            setIsTesting(null);
        }
    };

    const handleFullSync = async (scale: Scale) => {
        setIsSyncing(scale.id!);
        try {
            const items = await db.items.toArray();
            const result = await scaleService.uploadProducts(scale, items, true);

            if (result.success) {
                addToast(result.message, 'success');
            } else {
                addToast(result.message, 'warning');
            }
        } catch (err) {
            addToast(t('scales.sync_error', { defaultValue: 'Error syncing products to scale.' }), 'error');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleIncrementalSync = async (scale: Scale) => {
        setIsSyncing(scale.id!);
        try {
            // For 'Upload Selected', we will currently just do an incremental sync of all items since there is no selection grid here yet
            const items = await db.items.toArray();
            const result = await scaleService.uploadProducts(scale, items, false);

            if (result.success) {
                addToast(result.message, 'success');
            } else {
                addToast(result.message, 'warning');
            }
        } catch (err) {
            addToast('Error syncing products to scale.', 'error');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleTimeSync = async (scale: Scale) => {
        setIsSyncing(scale.id!);
        try {
            const success = await scaleService.syncTime(scale);
            if (success) {
                addToast('Time synced successfully.', 'success');
            } else {
                addToast('Failed to sync time.', 'error');
            }
        } catch (err) {
            addToast('Error syncing time to scale.', 'error');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleDownloadPLUs = async (scale: Scale) => {
        setIsSyncing(scale.id!);
        try {
            const result = await scaleService.downloadExistingPLUs(scale);
            if (result.success && result.plus && result.plus.length > 0) {
                setActiveScalePlus(result.plus);
                setActiveScaleManager(scale);
            } else if (result.success) {
                setActiveScalePlus([]);
                setActiveScaleManager(scale);
                addToast(t('scales.download_empty', { defaultValue: 'Scale reported success, but no PLUs were found.' }), 'warning');
            } else {
                addToast(result.message || 'Failed to download PLUs', 'error');
            }
        } catch (err) {
            addToast(t('scales.download_error', { defaultValue: 'Error downloading PLUs from scale.' }), 'error');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleOpenManager = (scale: Scale) => {
        setActiveScalePlus([]);
        setActiveScaleManager(scale);
    };

    const handleSaveManagerPlus = async (plus: PluRow[]) => {
        try {
            const { createRecordMetadata } = await import('../../../services/db');
            const newItems = plus.map((p: any) => ({
                ...createRecordMetadata(),
                name: p.name || `Scale Item ${p.plu}`,
                barcode: p.plu.toString().padStart(5, '0'),
                salePrice: Number(p.price) || 0,
                purchasePrice: 0,
                stock: 0,
                minStock: 0,
                category: 'Scale Items',
                unit: p.unit.toLowerCase() === 'piece' ? 'pcs' : 'kg',
                taxRate: 0,
                createdAt: new Date(),
                isWeighingScale: true
            }));

            const existingItems = await db.items.toArray();
            const existingBarcodes = new Set(existingItems.map((i: any) => i.barcode));

            const itemsToInsert = newItems.filter((item: any) => !existingBarcodes.has(item.barcode));

            if (itemsToInsert.length > 0) {
                await db.items.bulkPut(itemsToInsert as any);
                addToast(t('scales.download_success', { defaultValue: `Saved ${itemsToInsert.length} new PLUs to Inventory.` }), 'success');
            } else {
                addToast(t('scales.download_no_new', { defaultValue: `No new items were added (already exist in inventory).` }), 'info');
            }
        } catch (error) {
            addToast(t('scales.save_plu_error', { defaultValue: 'Error saving PLUs to inventory.' }), 'error');
        }
    };

    const handleApplyToScale = async (plus: PluRow[]) => {
        if (!activeScaleManager) return;
        setIsSyncing(activeScaleManager.id!);
        try {
            const { createRecordMetadata } = await import('../../../services/db');
            const scaleItems = plus.map((p: any) => ({
                ...createRecordMetadata(),
                name: p.name,
                barcode: p.plu.toString().padStart(5, '0'),
                salePrice: p.price,
                purchasePrice: 0,
                taxType: 'inclusive' as const,
                taxRate: 0,
                stock: 0,
                minStock: 0,
                unit: p.unit.toLowerCase() === 'piece' ? 'pc' : 'kg',
                // Keep the raw scale data attached for direct TCP upload
                rawScaleData: {
                    plu: p.plu,
                    unit: p.unit,
                    itemCode: p.itemCode,
                    indexBarcode: p.indexBarcode,
                    printShelfDate: p.printShelfDate,
                    shelfDays: p.shelfDays
                }
            }));

            const result = await scaleService.uploadProducts(activeScaleManager, scaleItems, true);

            if (result.success) {
                addToast(t('scales.apply_success', { defaultValue: 'Successfully applied PLUs to scale.' }), 'success');
            } else {
                addToast(result.message, 'warning');
            }
        } catch (err) {
            addToast(t('scales.sync_error', { defaultValue: 'Error syncing PLUs to scale.' }), 'error');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleBulkSync = async () => {
        setIsBulkSyncing(true);
        try {
            const items = await db.items.toArray();
            const result = await scaleService.bulkSyncAllScales(items);

            if (result.totalScales === 0) {
                addToast(t('scales.no_scales', { defaultValue: 'No scales configured.' }), 'warning');
            } else {
                addToast(t('scales.bulk_sync_success', {
                    defaultValue: `Bulk sync complete. Success: ${result.successful}, Failed: ${result.failed}`
                }), result.failed > 0 ? 'warning' : 'success');
            }
        } catch (err) {
            addToast(t('scales.bulk_sync_error', { defaultValue: 'Error during bulk sync.' }), 'error');
        } finally {
            setIsBulkSyncing(false);
        }
    };

    if (activeScaleManager) {
        return (
            <ScalePluManager
                scale={activeScaleManager}
                initialPlus={activeScalePlus}
                onClose={() => setActiveScaleManager(null)}
                onApplyToScale={handleApplyToScale}
                onSaveToInventory={handleSaveManagerPlus}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {t('settings.tabs.scales', { defaultValue: 'Scale Management' })}
                    </h2>
                    <p className="text-slate-500 text-sm">
                        {t('scales.description', { defaultValue: 'Manage IP weighing scales, sync PLUs, and test connections.' })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleBulkSync}
                        disabled={isBulkSyncing || !scales?.length}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isBulkSyncing ? 'animate-spin' : ''} />
                        {t('scales.bulk_update', { defaultValue: 'Bulk Update All' })}
                    </button>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium text-sm"
                    >
                        <Plus size={16} />
                        {t('scales.add_scale', { defaultValue: 'Add Scale' })}
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">{t('scales.add_scale', { defaultValue: 'Add Scale' })}</h3>
                    <form onSubmit={handleAddScale} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                        <div className="flex flex-col gap-1 lg:col-span-3">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('scales.name', { defaultValue: 'Scale Name / Location' })}</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                placeholder="e.g. Front Deli"
                            />
                        </div>
                        <div className="flex flex-col gap-1 lg:col-span-4">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('scales.ip_address', { defaultValue: 'IP Address' })}</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    required
                                    value={ipAddress}
                                    onChange={e => setIpAddress(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                    placeholder="192.168.1.100"
                                />
                                <button
                                    type="button"
                                    onClick={handleScanNetwork}
                                    disabled={isScanning}
                                    className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                                    title="Auto-Detect Scale on Network"
                                >
                                    {isScanning ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 lg:col-span-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('scales.port', { defaultValue: 'Port' })}</label>
                            <input
                                type="number"
                                required
                                value={port}
                                onChange={e => setPort(e.target.value)}
                                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>
                        <div className="flex flex-col gap-1 lg:col-span-3">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('scales.model', { defaultValue: 'Scale Model' })}</label>
                            <select
                                value={model}
                                onChange={e => setModel(e.target.value)}
                                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            >
                                <option value="Generic">Generic / TCP</option>
                                <option value="City POS">City POS</option>
                                <option value="E-Noteq">E-Noteq</option>
                                <option value="Rongta">Rongta</option>
                                <option value="CAS">CAS</option>
                                <option value="Dibal">Dibal</option>
                            </select>
                        </div>
                        <div className="col-span-full flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {scales?.map((scale: any) => (
                    <div key={scale.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${scale.status === 'online' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : scale.status === 'offline' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
                                <Server size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                    {scale.name}
                                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${scale.status === 'online' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                        scale.status === 'offline' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                        }`}>
                                        {scale.status}
                                    </span>
                                </h4>
                                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                                    <span className="flex items-center gap-1"><Wifi size={14} /> {scale.ipAddress}:{scale.port}</span>
                                    <span>•</span>
                                    <span>{scale.model}</span>
                                    {scale.lastSync && (
                                        <>
                                            <span>•</span>
                                            <span className="text-xs">
                                                Sync: {scale.lastSync.toLocaleTimeString()}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => handleTestConnection(scale)}
                                disabled={isTesting === scale.id || isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Wifi size={16} className={isTesting === scale.id ? 'animate-pulse text-blue-500' : ''} />
                                {t('scales.test_config', { defaultValue: 'Test' })}
                            </button>
                            <button
                                onClick={() => handleOpenManager(scale)}
                                disabled={isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Settings size={16} />
                                Manager
                            </button>
                            <button
                                onClick={() => handleDownloadPLUs(scale)}
                                disabled={isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Download size={16} />
                                {t('scales.download', { defaultValue: 'Get PLUs' })}
                            </button>
                            <button
                                onClick={() => setConfigHotkeyScale(scale)}
                                disabled={isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Keyboard size={16} />
                                Hotkeys
                            </button>
                            <button
                                onClick={() => handleTimeSync(scale)}
                                disabled={isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isSyncing === scale.id ? <RefreshCw size={16} className="animate-spin" /> : <Server size={16} />}
                                Time Sync
                            </button>
                            <button
                                onClick={() => handleIncrementalSync(scale)}
                                disabled={isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 dark:text-sky-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isSyncing === scale.id ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                                Upload Selected
                            </button>
                            <button
                                onClick={() => handleFullSync(scale)}
                                disabled={isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isSyncing === scale.id ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                                Full Sync
                            </button>
                            <button
                                onClick={() => setDeletePluScale(scale)}
                                disabled={isSyncing === scale.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ml-2"
                                title="Delete Single PLU"
                            >
                                <Trash2 size={16} />
                                Delete PLU
                            </button>
                            <button
                                onClick={() => handleDeleteScale(scale.id!)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-2"
                                title={t('common.delete')}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}

                {scales?.length === 0 && !isAdding && (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <Server size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No scales configured</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-4">Add your network IP weighing scales to begin syncing items and PLUs.</p>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            <Plus size={16} />
                            Add First Scale
                        </button>
                    </div>
                )}
            </div>

            <DeletePluModal
                isOpen={deletePluScale !== null}
                onClose={() => setDeletePluScale(null)}
                onConfirm={handleConfirmDeletePLU}
                scale={deletePluScale}
            />

            {configHotkeyScale && (
                <ScaleHotkeyModal
                    scale={configHotkeyScale}
                    onClose={() => setConfigHotkeyScale(null)}
                />
            )}

            {/* Custom Confirm Modal for Scale Deletion */}
            {deleteScaleId !== null && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center animate-in zoom-in-95 duration-200">
                        <Trash2 size={48} className="text-red-500 mx-auto mb-4 opacity-80" />
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                            {t('scales.delete_scale_title', { defaultValue: 'Delete Scale?' })}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                            {t('scales.delete_scale_desc', { defaultValue: 'Are you sure you want to remove this scale from your settings? This action cannot be undone.' })}
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => setDeleteScaleId(null)}
                                className="px-5 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg font-semibold transition-colors w-full"
                            >
                                {t('common.cancel', { defaultValue: 'Cancel' })}
                            </button>
                            <button
                                onClick={confirmDeleteScale}
                                className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-semibold transition-colors w-full"
                            >
                                {t('common.delete', { defaultValue: 'Delete' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScaleTab;

import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, type Item, type Purchase, type PurchaseItem, type SyncEntity, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, Save, ArrowLeft, Printer } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/UI/Modal';
import ItemForm from '../Inventory/ItemForm';
import BarcodeModal from '../Inventory/BarcodeModal';

const NewPurchaseBill = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const type = (searchParams.get('type') || 'bill') as 'bill' | 'order' | 'return';

    const { addToast, addNotification } = useNotification();
    const { formatCurrency, settings } = useSettings();
    const { activeBranchId, activeBranch } = useAuth();
    const { t } = useTranslation();

    const [searchTerm, setSearchTerm] = useState('');
    const [supplier, setSupplier] = useState('');
    const [supplierId, setSupplierId] = useState<string | undefined>(undefined);
    const [orderNumber, setOrderNumber] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [orderItems, setOrderItems] = useState<PurchaseItem[]>([]);
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentType, setPaymentType] = useState('cash');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Barcode / Label Printing State
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [selectedItemsForLabel, setSelectedItemsForLabel] = useState<Item[] | null>(null);

    // Inline supplier creation
    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierPhone, setNewSupplierPhone] = useState('');
    const [newSupplierEmail, setNewSupplierEmail] = useState('');
    const [newSupplierTaxNumber, setNewSupplierTaxNumber] = useState('');
    const [newSupplierLocation, setNewSupplierLocation] = useState('');

    // Inline item creation
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemStock, setNewItemStock] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('');
    const [newItemCategoryId, setNewItemCategoryId] = useState('');

    const categories = useLiveQuery(() =>
        activeBranch?.isMaster ? db.categories.filter((c: any) => !c.deletedAt).toArray() : db.categories.where('branchId').equals(activeBranchId).filter((c: any) => !c.deletedAt).toArray(),
        [activeBranchId, activeBranch?.isMaster]
    );

    const suppliers = useLiveQuery(() =>
        activeBranch?.isMaster ? db.suppliers.filter((s: any) => !s.deletedAt).toArray() : db.suppliers.where('branchId').equals(activeBranchId).filter((s: any) => !s.deletedAt).toArray(),
        [activeBranchId, activeBranch?.isMaster]
    );

    const inventoryItems = useLiveQuery(() =>
        activeBranch?.isMaster ? db.items.filter((i: any) => !i.deletedAt).toArray() : db.items.where('branchId').equals(activeBranchId).filter((i: any) => !i.deletedAt).toArray(),
        [activeBranchId, activeBranch?.isMaster]
    );

    const filteredInventory = inventoryItems?.filter((i: any) =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addToOrder = useCallback((item: Item) => {
        setOrderItems(prev => {
            const existing = prev.find((i: any) => i.itemId === item.id);
            if (existing) {
                return prev.map((i: any) =>
                    i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
                );
            } else {
                // H18 Fix: Preserve 0% tax rate if specified
                const defaultTaxRate = item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : 15;
                return [...prev, {
                    itemId: item.id!,
                    name: item.name,
                    quantity: 1,
                    cost: item.purchasePrice,
                    unit: item.unit,
                    taxRate: defaultTaxRate,
                    taxType: item.taxType || 'exclusive'
                }];
            }
        });
    }, []);

    const updateOrderItem = (itemId: string, field: string, value: string | number) => {
        setOrderItems(orderItems.map((i: any) =>
            i.itemId === itemId ? { ...i, [field]: value } : i
        ));
    };

    const removeOrderItem = (itemId: string) => {
        setOrderItems(orderItems.filter((i: any) => i.itemId !== itemId));
    };

    const calculateTotals = (items: PurchaseItem[]) => {
        let subTotal = 0, taxTotal = 0, grandTotal = 0;
        items.forEach((item: any) => {
            const qty = item.quantity, cost = item.cost, rate = item.taxRate || 0, taxType = item.taxType || 'exclusive';
            let lineTax = 0, lineTotal = 0;
            if (settings.applyTax) {
                if (taxType === 'inclusive') {
                    const base = cost / (1 + rate / 100);
                    lineTax = Math.round(((cost - base) * qty) * 100) / 100;
                    lineTotal = Math.round((cost * qty) * 100) / 100;
                    subTotal += Math.round((base * qty) * 100) / 100;
                } else {
                    lineTax = Math.round(((cost * (rate / 100)) * qty) * 100) / 100;
                    lineTotal = Math.round(((cost * qty) + lineTax) * 100) / 100;
                    subTotal += Math.round((cost * qty) * 100) / 100;
                }
            } else {
                lineTotal = Math.round((cost * qty) * 100) / 100;
                subTotal += lineTotal;
            }
            taxTotal += lineTax;
            grandTotal += lineTotal;
        });
        return { subTotal, taxTotal, grandTotal };
    };

    const { subTotal, taxTotal, grandTotal: totalAmount } = calculateTotals(orderItems);
    const advance = parseFloat(paidAmount) || 0;
    const balanceDue = Math.max(0, totalAmount - advance);

    const handlePrintLabels = async () => {
        if (orderItems.length === 0) {
            addToast(t('purchases.no_items_added', 'No items added yet'), 'error');
            return;
        }
        try {
            const fullItems: Item[] = [];
            for (const pi of orderItems) {
                const dbItem = await db.items.get(pi.itemId);
                const qty = Number(pi.quantity) || 1;
                const cost = Number(pi.cost) || (dbItem ? Number(dbItem.purchasePrice) : 0);
                const rate = Number(pi.taxRate) || 0;
                const taxType = pi.taxType || 'exclusive';

                let unitTotalPurchaseCost = cost;
                if (settings.applyTax && rate > 0) {
                    if (taxType === 'exclusive') {
                        unitTotalPurchaseCost = cost * (1 + rate / 100);
                    } else {
                        unitTotalPurchaseCost = cost;
                    }
                }

                unitTotalPurchaseCost = Math.round(unitTotalPurchaseCost * 100) / 100;

                if (dbItem) {
                    fullItems.push({
                        ...dbItem,
                        salePrice: dbItem.salePrice,
                        purchasePrice: unitTotalPurchaseCost,
                        stock: qty,
                        supplierNameFallback: supplier || (dbItem as any).supplierNameFallback
                    } as any);
                } else {
                    fullItems.push({
                        id: pi.itemId,
                        branchId: activeBranchId || '',
                        updatedAt: new Date(),
                        name: pi.name,
                        barcode: '',
                        salePrice: 0,
                        purchasePrice: unitTotalPurchaseCost,
                        taxType: pi.taxType || 'exclusive',
                        taxRate: pi.taxRate || 0,
                        stock: qty,
                        minStock: 5,
                        unit: pi.unit || 'pc',
                        supplierNameFallback: supplier
                    } as any);
                }
            }
            setSelectedItemsForLabel(fullItems);
            setIsLabelModalOpen(true);
        } catch (err) {
            console.error(err);
            addToast(t('common.error'), 'error');
        }
    };

    const applyStockEffect = async (items: PurchaseItem[], purchaseType: 'bill' | 'order' | 'return', currentSupplierId?: string) => {
        if (purchaseType === 'order') return;
        for (const orderItem of items) {
            const item = await db.items.get(orderItem.itemId);
            if (item) {
                let newStock = item.stock;
                if (purchaseType === 'bill') {
                    newStock += orderItem.quantity;
                    await db.items.update(item.id!, {
                        ...updateRecordMetadata(),
                        stock: newStock,
                        purchasePrice: orderItem.cost,
                        ...(currentSupplierId && !item.supplierId ? { supplierId: currentSupplierId } : {})
                    });
                } else if (purchaseType === 'return') {
                    newStock -= orderItem.quantity;
                    await db.items.update(item.id!, { ...updateRecordMetadata(), stock: newStock });
                }
            }
        }
    };

    const handleSave = async () => {
        if (!supplier || orderItems.length === 0) {
            addToast(t('purchases.fill_supplier'), 'error');
            return;
        }
        setIsSaving(true);
        try {
            const processedItems = orderItems.map((item: any) => {
                const qty = item.quantity, cost = item.cost, rate = item.taxRate || 0, taxType = item.taxType || 'exclusive';
                let lineBeforeVat = 0, lineTax = 0, lineTotal = 0;
                if (settings.applyTax) {
                    if (taxType === 'inclusive') {
                        const base = cost / (1 + rate / 100);
                        lineBeforeVat = Math.round((base * qty) * 100) / 100;
                        lineTax = Math.round(((cost - base) * qty) * 100) / 100;
                        lineTotal = Math.round((cost * qty) * 100) / 100;
                    } else {
                        lineBeforeVat = Math.round((cost * qty) * 100) / 100;
                        lineTax = Math.round(((cost * (rate / 100)) * qty) * 100) / 100;
                        lineTotal = Math.round((lineBeforeVat + lineTax) * 100) / 100;
                    }
                } else {
                    lineBeforeVat = Math.round((cost * qty) * 100) / 100;
                    lineTotal = lineBeforeVat;
                }
                return { ...item, subtotalBeforeTax: lineBeforeVat, taxAmount: lineTax, total: lineTotal };
            });

            const purchaseData: Omit<Purchase, keyof SyncEntity | 'id'> = {
                orderNumber: orderNumber || `${type === 'bill' ? 'BILL' : type === 'return' ? 'RET' : 'PO'}-${Date.now()}`,
                supplierName: supplier,
                items: processedItems,
                totalAmount,
                subTotal,
                taxAmount: taxTotal,
                date: new Date(orderDate),
                dueDate: dueDate ? new Date(dueDate) : undefined,
                paymentType: paymentType as 'cash' | 'card' | 'upi' | 'credit',
                paidAmount: advance,
                notes,
                type,
                status: type === 'order' ? 'pending' : 'completed',
                supplierId,
            };

            await db.transaction('rw', [db.purchases, db.items, db.suppliers], async () => {
                const id = await db.purchases.add({ ...purchaseData, ...createRecordMetadata() } as Purchase);
                await applyStockEffect(orderItems, type, supplierId);

                if (supplierId) {
                    const sup = await db.suppliers.get(supplierId);
                    if (sup) {
                        const curBal = sup.balance || 0; // H20 Fix: safe balance
                        if (type === 'bill') {
                            await db.suppliers.update(sup.id!, { ...updateRecordMetadata(), balance: curBal + totalAmount - advance });
                        } else if (type === 'return') {
                            await db.suppliers.update(sup.id!, { ...updateRecordMetadata(), balance: curBal - totalAmount });
                        }
                    }
                }

                addToast(t('purchases.created', { type: typeLabel }) || 'Purchase bill added successfully', 'success');
                addNotification(t('purchases.created', { type: `${type} #${purchaseData.orderNumber}` }), 'success', id);
            });

            navigate('/purchase');
        } catch (e) {
            console.error(e);
            addToast(t('common.error'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddSupplier = async () => {
        if (!newSupplierName.trim()) { addToast(t('suppliers.name_required'), 'error'); return; }
        try {
            const id = await db.suppliers.add({
                ...createRecordMetadata(),
                branchId: activeBranchId || '',
                name: newSupplierName,
                phone: newSupplierPhone || '',
                email: newSupplierEmail || '',
                taxNumber: newSupplierTaxNumber || '',
                location: newSupplierLocation || '',
                balance: 0
            } as any);
            setSupplierId(id as string);
            setSupplier(newSupplierName);
            setIsAddSupplierOpen(false);
            setNewSupplierName(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierTaxNumber(''); setNewSupplierLocation('');
        } catch (e) { addToast(t('common.error'), 'error'); }
    };

    const handleAddItem = async () => {
        if (!newItemName.trim() || !newItemCost) { addToast(t('sales.name_price_required'), 'error'); return; }
        try {
            const cost = parseFloat(newItemCost) || 0;
            const price = parseFloat(newItemPrice) || cost;
            const stock = parseFloat(newItemStock) || 0;
            const id = await db.items.add({ ...createRecordMetadata(), branchId: activeBranchId || '', name: newItemName, salePrice: price, purchasePrice: cost, stock, taxType: 'exclusive', taxRate: 15, unit: newItemUnit || 'pcs', barcode: '', categoryId: newItemCategoryId || undefined } as any);
            addToOrder({ id: id as string, name: newItemName, salePrice: price, purchasePrice: cost, stock, unit: newItemUnit || 'pcs', taxType: 'exclusive', taxRate: 15, categoryId: newItemCategoryId || undefined } as Item);
            setIsAddItemOpen(false);
            setNewItemName(''); setNewItemCost(''); setNewItemPrice(''); setNewItemStock(''); setNewItemUnit(''); setNewItemCategoryId('');
        } catch (e) { addToast(t('common.error'), 'error'); }
    };

    const typeLabel = type === 'bill' ? t('purchases.new_bill') : type === 'return' ? t('purchases.new_return') : t('purchases.new_order');

    if (isAddItemOpen) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
                <ItemForm 
                    isInline 
                    onSuccess={(item) => {
                        addToOrder(item);
                        setIsAddItemOpen(false);
                    }} 
                    onCancel={() => setIsAddItemOpen(false)} 
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Page Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <button type="button" onClick={() => navigate('/purchase')} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
                        <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{typeLabel}</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Fill in the details to create a new {type}</p>
                    </div>
                </div>

                {orderItems.length > 0 && (
                    <button
                        type="button"
                        onClick={handlePrintLabels}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold text-xs uppercase tracking-wider transition-colors border border-indigo-200 dark:border-indigo-800"
                    >
                        <Printer size={16} />
                        <span>{t('inventory.print_label') || 'Print Labels'}</span>
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left: Item Selector */}
                <div className="w-full md:w-[300px] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900 shrink-0 h-48 md:h-full overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 text-sm uppercase tracking-wider">{t('purchases.select_items')}</h3>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input type="text" placeholder={t('purchases.search_placeholder')} className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <button type="button" onClick={() => setIsAddItemOpen(true)} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0" title={t('inventory.add_item')}>
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredInventory?.map((item: any) => (
                            <PurchaseItemCard 
                                key={item.id} 
                                item={item} 
                                onAdd={addToOrder} 
                                formatCurrency={formatCurrency} 
                                t={t} 
                            />
                        ))}
                    </div>
                </div>

                {/* Right: Form */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">

                        {/* Ref & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('purchases.ref_no')}</label>
                                <input type="text" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder={t('purchases.auto_generated')} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('purchases.date')}</label>
                                <input type="date" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                            </div>
                        </div>

                        {/* Supplier */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('purchases.supplier_name')} *</label>
                            <div className="flex gap-2">
                                <select className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={supplierId || ''} onChange={e => { const id = e.target.value; const s = suppliers?.find((sup: any) => sup.id === id); setSupplierId(id); setSupplier(s ? s.name : ''); }}>
                                    <option value="">{t('purchases.select_supplier')}</option>
                                    {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button type="button" onClick={() => setIsAddSupplierOpen(true)} className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl hover:bg-blue-200 transition-colors" title={t('purchases.add_supplier_tooltip')}>
                                    <Plus size={18} />
                                </button>
                            </div>
                            <input type="text" className="w-full mt-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={supplier} onChange={e => { setSupplier(e.target.value); setSupplierId(undefined); }} placeholder={t('purchases.enter_supplier_name')} />
                        </div>

                        {/* Due Date (not for returns) */}
                        {type !== 'return' && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('purchases.due_date')}</label>
                                <input type="date" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                        )}

                        {/* Items Table */}
                        <div>
                            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t('purchases.items_header', { count: orderItems.length })}</h3>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                {orderItems.length === 0 ? (
                                    <div className="p-10 text-center text-slate-400 text-sm">{t('purchases.no_items_added', 'No items added yet')}</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[850px]">
                                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="text-left p-3 font-semibold text-slate-500 dark:text-slate-400">{t('purchases.item_name')}</th>
                                                    <th className="text-center p-3 font-semibold text-slate-500 dark:text-slate-400 w-20">{t('purchases.unit')}</th>
                                                    <th className="text-center p-3 font-semibold text-slate-500 dark:text-slate-400 w-20">{t('purchases.qty')}</th>
                                                    <th className="text-right p-3 font-semibold text-slate-500 dark:text-slate-400 w-24">{t('purchases.cost')}</th>
                                                    <th className="text-center p-3 font-semibold text-slate-500 dark:text-slate-400 w-20">Tax %</th>
                                                    <th className="text-right p-3 font-semibold text-slate-500 dark:text-slate-400 w-28">{t('purchases.before_vat_amount')}</th>
                                                    <th className="text-right p-3 font-semibold text-slate-500 dark:text-slate-400 w-28">{t('purchases.vat_amount')}</th>
                                                    <th className="text-right p-3 font-semibold text-slate-500 dark:text-slate-400 w-32">{t('purchases.total_with_vat')}</th>
                                                    <th className="w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {orderItems.map((item: any) => {
                                                    const qty = item.quantity || 0, cost = item.cost || 0, rate = item.taxRate || 0, taxType = item.taxType || 'exclusive';
                                                    let lineBeforeVat = 0, lineTax = 0, lineTotal = 0;
                                                    if (settings.applyTax) {
                                                        if (taxType === 'inclusive') {
                                                            const base = cost / (1 + rate / 100);
                                                            lineBeforeVat = base * qty;
                                                            lineTax = (cost - base) * qty;
                                                            lineTotal = cost * qty;
                                                        } else {
                                                            lineBeforeVat = cost * qty;
                                                            lineTax = (cost * (rate / 100)) * qty;
                                                            lineTotal = lineBeforeVat + lineTax;
                                                        }
                                                    } else {
                                                        lineBeforeVat = cost * qty;
                                                        lineTotal = lineBeforeVat;
                                                    }
                                                    return (
                                                        <tr key={item.itemId} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="p-3 font-medium dark:text-white">{item.name}</td>
                                                            <td className="p-3"><input type="text" className="w-full p-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={item.unit || ''} onChange={e => updateOrderItem(item.itemId, 'unit', e.target.value)} /></td>
                                                            <td className="p-3"><input type="number" className="w-full p-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={item.quantity} min={1} onChange={e => updateOrderItem(item.itemId, 'quantity', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))} /></td>
                                                            <td className="p-3"><input type="number" className="w-full p-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={item.cost} onChange={e => updateOrderItem(item.itemId, 'cost', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))} /></td>
                                                            <td className="p-3"><input type="number" className="w-full p-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={item.taxRate ?? 0} onChange={e => updateOrderItem(item.itemId, 'taxRate', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))} /></td>
                                                            <td className="p-3 text-right text-slate-600 dark:text-slate-300 font-medium">{formatCurrency(lineBeforeVat)}</td>
                                                            <td className="p-3 text-right text-slate-600 dark:text-slate-300 font-medium">{formatCurrency(lineTax)}</td>
                                                            <td className="p-3 text-right font-semibold dark:text-white">{formatCurrency(lineTotal)}</td>
                                                            <td className="p-3"><button onClick={() => removeOrderItem(item.itemId)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors"><Trash2 size={15} /></button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl space-y-2">
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400"><span>{t('purchases.subtotal')}</span><span>{formatCurrency(subTotal)}</span></div>
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400"><span>{t('purchases.tax')}</span><span>{formatCurrency(taxTotal)}</span></div>
                            <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2 mt-2"><span>{t('purchases.total')}</span><span>{formatCurrency(totalAmount)}</span></div>
                        </div>

                        {/* Payment */}
                        {type === 'bill' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('purchases.paid_now')}</label>
                                    <input type="number" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('purchases.payment_type')}</label>
                                    <select className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                                        <option value="cash">{t('purchases.cash')}</option>
                                        <option value="card">{t('purchases.card')}</option>
                                        <option value="upi">{t('purchases.upi')}</option>
                                        <option value="credit">{t('purchases.credit')}</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('purchases.notes')}</label>
                            <textarea className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('purchases.notes_placeholder')} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            {type === 'bill' && advance > 0 && <span>{t('purchases.balance_due')}: <strong className="text-red-500 dark:text-red-400">{formatCurrency(balanceDue)}</strong></span>}
                        </div>
                        <div className="flex gap-3">
                            {orderItems.length > 0 && (
                                <button type="button" onClick={handlePrintLabels} className="px-5 py-2.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center gap-2 transition-colors">
                                    <Printer size={16} />
                                    {t('inventory.print_label') || 'Print Labels'}
                                </button>
                            )}
                            <button type="button" onClick={() => navigate('/purchase')} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-colors">{t('common.cancel')}</button>
                            <button type="button" onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 text-sm font-semibold disabled:opacity-60 transition-colors">
                                <Save size={16} />
                                {isSaving ? t('common.saving', 'Saving...') : typeLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Supplier Modal */}
            <Modal isOpen={isAddSupplierOpen} onClose={() => setIsAddSupplierOpen(false)} title={t('suppliers.add_supplier')} maxWidth="sm">
                <div className="p-6 space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.name')} *</label><input type="text" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.phone')}</label><input type="text" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" value={newSupplierPhone} onChange={e => setNewSupplierPhone(e.target.value)} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.tax_vat') || 'Tax / VAT Number'}</label><input type="text" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" value={newSupplierTaxNumber} onChange={e => setNewSupplierTaxNumber(e.target.value)} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.email') || 'Email'}</label><input type="email" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" value={newSupplierEmail} onChange={e => setNewSupplierEmail(e.target.value)} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.location') || 'Location'}</label><textarea className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" rows={2} value={newSupplierLocation} onChange={e => setNewSupplierLocation(e.target.value)} /></div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsAddSupplierOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-xl">{t('common.cancel')}</button>
                        <button onClick={handleAddSupplier} className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">{t('common.save')}</button>
                    </div>
                </div>
            </Modal>

            {/* Add Item Modal Replaced by Inline ItemForm Page */}

            {/* Barcode Modal */}
            <BarcodeModal
                isOpen={isLabelModalOpen}
                onClose={() => setIsLabelModalOpen(false)}
                items={selectedItemsForLabel}
            />
        </div>
    );
};
export default NewPurchaseBill;

interface PurchaseItemCardProps {
    item: any;
    onAdd: (item: any) => void;
    formatCurrency: (amount: number) => string;
    t: any;
}

const PurchaseItemCard = memo(({ item, onAdd, formatCurrency, t }: PurchaseItemCardProps) => (
    <button type="button" onClick={() => onAdd(item)} className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
        <p className="font-medium text-slate-800 dark:text-white text-sm truncate">{item.name}</p>
        <div className="flex justify-between mt-0.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('inventory.stock')}: {item.stock ?? 0}</span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(item.purchasePrice)}</span>
        </div>
    </button>
));

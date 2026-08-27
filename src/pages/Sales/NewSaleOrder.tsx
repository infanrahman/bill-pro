import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, createRecordMetadata } from '../../services/db';
import type { Invoice, InvoiceItem, Item } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, Save, RotateCcw, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/UI/Modal';
import ItemForm from '../Inventory/ItemForm';

const NewSaleOrder = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const type = (searchParams.get('type') || 'order') as 'order' | 'return';

    const { addToast } = useNotification();
    const { formatCurrency, settings } = useSettings();
    const { activeBranchId } = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerId, setCustomerId] = useState<string | undefined>(undefined);
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Inline Item Creation State
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemStock, setNewItemStock] = useState('');

    const customers = useLiveQuery(() =>
        db.customers.where('branchId').equals(activeBranchId).filter((c: any) => !c.deletedAt).toArray(),
        [activeBranchId]
    );
    const inventory = useLiveQuery(() =>
        db.items.where('branchId').equals(activeBranchId).filter((i: any) => !i.deletedAt).toArray(),
        [activeBranchId]
    );

    const [visibleItemsCount, setVisibleItemsCount] = useState(50);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const filteredInventory = inventory?.filter((i: any) =>
        (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.barcode || '').includes(searchTerm)
    );

    useEffect(() => {
        setVisibleItemsCount(50);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }, [searchTerm]);

    const visibleItems = filteredInventory?.slice(0, visibleItemsCount);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            setVisibleItemsCount(prev => Math.min(prev + 50, filteredInventory?.length || 0));
        }
    };

    const addToOrder = useCallback((item: Item) => {
        setItems(prevItems => {
            const existing = prevItems.find((i: any) => i.itemId === item.id);
            if (existing) {
                return prevItems.map((i: any) =>
                    i.itemId === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i
                );
            } else {
                return [...prevItems, {
                    itemId: item.id!,
                    name: item.name,
                    quantity: 1,
                    price: item.salePrice,
                    purchasePrice: item.purchasePrice,
                    total: item.salePrice,
                    taxType: item.taxType,
                    taxRate: item.taxRate
                }];
            }
        });
    }, []);

    const updateItem = (itemId: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map((i: any) => {
            if (i.itemId === itemId) {
                const updated = { ...i, [field]: value };
                if (field === 'quantity' || field === 'price') {
                    updated.total = updated.quantity * updated.price;
                }
                return updated;
            }
            return i;
        }));
    };

    const removeItem = (itemId: string) => {
        setItems(items.filter((i: any) => i.itemId !== itemId));
    };

    const totalAmount = items.reduce((sum: any, i: any) => sum + i.total, 0);

    const handleSave = async () => {
        if (!customerName || items.length === 0) {
            addToast(t('sales.required_error'), 'error');
            return;
        }

        setIsSaving(true);
        try {
            const finalItems = items.map(item => {
                const nominal = item.price * item.quantity;
                const rate = item.taxRate || 0;
                const taxType = item.taxType || 'exclusive';
                let lineTax = 0, lineFinal = 0;
                if (settings.applyTax) {
                    if (taxType === 'exclusive') {
                        lineTax = Math.round((nominal * (rate / 100)) * 100) / 100;
                        lineFinal = Math.round((nominal + lineTax) * 100) / 100;
                    } else {
                        const base = nominal / (1 + (rate / 100));
                        lineTax = Math.round((nominal - base) * 100) / 100;
                        lineFinal = Math.round(nominal * 100) / 100;
                    }
                } else {
                    lineFinal = nominal;
                }
                return { ...item, taxAmount: lineTax, total: lineFinal };
            });

            const totalTax = finalItems.reduce((sum, i) => sum + (i.taxAmount || 0), 0);
            const totalGrand = finalItems.reduce((sum, i) => sum + i.total, 0);

            const lastInvoice = await db.invoices.orderBy('createdAt').last();
            let nextNumber = 1;
            if (lastInvoice?.invoiceNumber) {
                const lastNum = parseInt(lastInvoice.invoiceNumber.replace(/\D/g, ''), 10);
                if (!isNaN(lastNum)) nextNumber = lastNum + 1;
            }
            const prefix = type === 'order' ? 'SO-' : 'RET-';
            const seqInvoiceNumber = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

            let tokenNumber: string | undefined;
            const savedPrinterConfig = localStorage.getItem('printerConfig');
            const currentPrinterConfig = savedPrinterConfig ? JSON.parse(savedPrinterConfig) : undefined;
            if (settings.cafeMode || currentPrinterConfig?.printToken) {
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);

                const lastTokenInvoice = await db.invoices
                    .where('createdAt').above(startOfToday)
                    .filter((inv: any) => !!inv.tokenNumber)
                    .last();
                
                let nextToken = 1;
                if (lastTokenInvoice?.tokenNumber) {
                    const lastTokenVal = parseInt(lastTokenInvoice.tokenNumber, 10);
                    if (!isNaN(lastTokenVal)) {
                        nextToken = lastTokenVal + 1;
                    }
                }
                tokenNumber = nextToken.toString().padStart(3, '0');
            }

            const invoiceData: Invoice = {
                ...createRecordMetadata(),
                branchId: activeBranchId || '',
                invoiceNumber: seqInvoiceNumber,
                tokenNumber,
                customerName,
                customerId,
                items: finalItems,
                subTotal: totalAmount,
                taxAmount: totalTax,
                discountAmount: 0,
                grandTotal: totalGrand,
                paidAmount: 0,
                remainingAmount: totalGrand,
                paymentMode: 'split',
                paymentStatus: type === 'order' ? 'pending' : 'paid',
                createdAt: new Date(orderDate),
                type: type as 'order' | 'return',
                status: type === 'order' ? 'pending' : 'paid',
                notes
            };

            await db.transaction('rw', [db.invoices, db.items, db.customers], async () => {
                await db.invoices.add(invoiceData);
                if (type === 'return') {
                    for (const item of items) {
                        const dbItem = await db.items.get(item.itemId);
                        if (dbItem) {
                            await db.items.update(item.itemId, { stock: dbItem.stock + item.quantity });
                        }
                    }
                    if (customerId) {
                        const customer = await db.customers.get(customerId);
                        if (customer) {
                            await db.customers.update(customerId, { balance: customer.balance - totalGrand });
                        }
                    }
                }
            });

            addToast(type === 'order' ? t('sales.order_created') : t('sales.return_created'), 'success');
            navigate('/sales');
        } catch (e) {
            console.error(e);
            addToast(t('sales.error_saving'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddNewItem = async () => {
        if (!newItemName.trim() || !newItemPrice) {
            addToast(t('sales.name_price_required'), 'error');
            return;
        }
        try {
            const price = parseFloat(newItemPrice);
            const cost = parseFloat(newItemCost) || 0;
            const stock = parseFloat(newItemStock) || 0;
            const id = await db.items.add({
                ...createRecordMetadata(),
                branchId: activeBranchId || '',
                name: newItemName,
                salePrice: price,
                purchasePrice: cost,
                stock,
                taxType: 'exclusive',
                taxRate: 0,
                unit: 'pcs',
                barcode: '',
            } as any);
            addToOrder({ id: id as string, name: newItemName, salePrice: price, purchasePrice: cost, stock } as Item);
            setIsAddItemOpen(false);
            setNewItemName(''); setNewItemCost(''); setNewItemPrice(''); setNewItemStock('');
        } catch (e) {
            addToast(t('sales.error_adding_item'), 'error');
        }
    };

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
            <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0 shadow-sm">
                <button
                    type="button"
                    onClick={() => navigate('/sales')}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                >
                    <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        {type === 'order' ? t('sales.new_order') : t('sales.new_return')}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {type === 'order' ? t('sales.new_order_desc', 'Create a new sales order') : t('sales.new_return_desc', 'Create a new sales return')}
                    </p>
                </div>
                {type === 'return' && (
                    <span className="ml-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                        <RotateCcw size={12} /> {t('sales.return')}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left: Item Selector */}
                <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900 shrink-0 h-48 md:h-full overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 text-sm uppercase tracking-wider">{t('sales.select_items')}</h3>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder={t('common.search')}
                                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAddItemOpen(true)}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 shrink-0 text-sm font-medium"
                                title={t('sales.add_new_item_tooltip') || 'Add New Item'}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                    >
                        {visibleItems?.map((item: any) => (
                            <SaleOrderItemCard 
                                key={item.id} 
                                item={item} 
                                onAdd={addToOrder} 
                                formatCurrency={formatCurrency}
                                t={t} 
                            />
                        ))}
                        {(!visibleItems || visibleItems.length === 0) && (
                            <div className="p-6 text-center text-slate-400 text-sm">{t('common.no_results')}</div>
                        )}
                    </div>
                </div>

                {/* Right: Form */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* Customer & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('sales.customer_name')} *</label>
                                <select
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={customerId || ''}
                                    onChange={e => {
                                        const id = e.target.value;
                                        const c = customers?.find((cus: any) => cus.id === id);
                                        setCustomerId(id);
                                        setCustomerName(c ? c.name : '');
                                    }}
                                >
                                    <option value="">{t('sales.select_existing_customer')}</option>
                                    {customers?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    className="w-full mt-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={customerName}
                                    onChange={e => { setCustomerName(e.target.value); setCustomerId(undefined); }}
                                    placeholder={t('sales.custom_name_placeholder')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('sales.date')}</label>
                                <input
                                    type="date"
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={orderDate}
                                    onChange={e => setOrderDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Items List */}
                        <div>
                            <h3 className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t('sales.items_count')} ({items.length})</h3>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                {items.length === 0 ? (
                                    <div className="p-10 text-center text-slate-400 text-sm">{t('sales.no_items_selected_msg')}</div>
                                ) : (
                                    <div className="flex flex-col gap-2 p-2">
                                        {items.map((item: any) => (
                                            <div key={item.itemId} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-sm dark:text-white">{item.name}</span>
                                                    <button onClick={() => removeItem(item.itemId)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center gap-2 mt-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase text-slate-500 font-bold">{t('sales.qty')}</span>
                                                        <input
                                                            type="number"
                                                            className="w-16 p-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-center dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            value={item.quantity}
                                                            min={1}
                                                            onChange={e => updateItem(item.itemId, 'quantity', parseFloat(e.target.value) || 1)}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase text-slate-500 font-bold">{t('sales.price')}</span>
                                                        <input
                                                            type="number"
                                                            className="w-20 p-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-right dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            value={item.price}
                                                            onChange={e => updateItem(item.itemId, 'price', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] uppercase text-slate-500 font-bold">{t('sales.total')}</span>
                                                        <span className="font-bold text-sm dark:text-white">{formatCurrency(item.total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl">
                            <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white">
                                <span>{t('sales.total_amount')}</span>
                                <span>{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('sales.notes')}</label>
                            <textarea
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder={t('sales.notes_placeholder')}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => navigate('/sales')}
                            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 text-sm font-semibold disabled:opacity-60 transition-colors"
                        >
                            <Save size={16} />
                            {isSaving ? t('common.saving', 'Saving...') : (type === 'order' ? t('sales.save_order') : t('sales.save_return'))}
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Add Item Modal Replaced by Inline ItemForm Page */}
        </div>
    );
};
export default NewSaleOrder;

interface SaleOrderItemCardProps {
    item: any;
    onAdd: (item: any) => void;
    formatCurrency: (amount: number) => string;
    t: any;
}

const SaleOrderItemCard = memo(({ item, onAdd, formatCurrency, t }: SaleOrderItemCardProps) => (
    <button
        type="button"
        onClick={() => onAdd(item)}
        className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
    >
        <p className="font-medium text-slate-800 dark:text-white text-sm truncate">{item.name}</p>
        <div className="flex justify-between mt-0.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('common.stock')}: {item.stock ?? 0}</span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(item.salePrice)}</span>
        </div>
    </button>
));

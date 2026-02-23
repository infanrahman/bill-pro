import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../services/db';
import type { Item, Customer, InvoiceItem } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ShoppingCart, User, CreditCard, Trash2, ShieldOff } from 'lucide-react';
import CheckoutModal from './CheckoutModal';
import ItemCard from '../../components/POS/ItemCard';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

const PosTerminal: React.FC = () => {
    const { formatCurrency, settings } = useSettings();
    const { addToast } = useNotification();
    const { hasPermission } = useAuth();
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    if (!hasPermission('pos_access')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8 bg-slate-50 dark:bg-slate-900">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('pos.access_denied_msg')}</p>
            </div>
        );
    }


    // State
    const [cart, setCart] = useState<InvoiceItem[]>([]);
    const [customer, setCustomer] = useState<Customer>({ name: 'Walk-in Customer', phone: '', id: 0, totalSpent: 0, balance: 0, vatNumber: '' });
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isTaxExclusiveMode, setIsTaxExclusiveMode] = useState(false);

    // Optimization: Pagination / Infinite Scroll
    const [visibleItemsCount, setVisibleItemsCount] = useState(50);
    const itemsContainerRef = React.useRef<HTMLDivElement>(null);

    const GLOBAL_TAX_RATE = 15;

    // Queries
    const items = useLiveQuery(() => db.items.toArray());
    const customers = useLiveQuery(() => db.customers.toArray());

    // Barcode Scanner Buffer
    const barcodeBuffer = React.useRef<string>('');
    const lastKeyTime = React.useRef<number>(0);

    React.useEffect(() => {
        const handleGlobalKeyDown = async (e: KeyboardEvent) => {
            // 1. Ignore if typing in an input field (Search, Customer Name, etc.)
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const now = Date.now();
            if (now - lastKeyTime.current > 100) {
                barcodeBuffer.current = ''; // Reset if slow typing (manual)
            }
            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                if (barcodeBuffer.current.length >= 3) {
                    // Barcode Detected
                    e.preventDefault();
                    e.stopPropagation();

                    const code = barcodeBuffer.current;
                    barcodeBuffer.current = '';

                    // Lookup Item
                    try {
                        const item = await db.items.where('barcode').equals(code).first();
                        if (item) {
                            addToCart(item);
                            addToast(t('pos.added_item', { name: item.name }), 'success');
                        } else {
                            addToast(t('pos.item_not_found'), 'error');
                        }
                    } catch (err) {
                        console.error("Barcode lookup failed", err);
                    }
                }
            } else if (e.key.length === 1) {
                barcodeBuffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [items]);

    // Derived
    const filteredItems = useMemo(() => {
        if (!items) return [];
        if (!search) return items;
        const lower = search.toLowerCase();
        return items.filter(i =>
            i.name.toLowerCase().includes(lower) ||
            (i.barcode && i.barcode.includes(lower))
        );
    }, [items, search]);

    // Reset pagination when filter changes
    React.useEffect(() => {
        setVisibleItemsCount(50);
        if (itemsContainerRef.current) itemsContainerRef.current.scrollTop = 0;
    }, [search]);

    const visibleItems = useMemo(() => filteredItems.slice(0, visibleItemsCount), [filteredItems, visibleItemsCount]);

    const handleScroll = () => {
        if (itemsContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = itemsContainerRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                setVisibleItemsCount(prev => Math.min(prev + 50, filteredItems.length));
            }
        }
    };

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
        if (!customerSearchTerm) return [];
        const lower = customerSearchTerm.toLowerCase();
        return customers.filter(c => c.name.toLowerCase().includes(lower) || c.phone.includes(lower));
    }, [customers, customerSearchTerm]);

    const cartSubTotal = useMemo(() => cart.reduce((sum, i) => sum + i.total, 0), [cart]);
    const cartTax = isTaxExclusiveMode ? cartSubTotal * (GLOBAL_TAX_RATE / 100) : 0;
    const payableTotal = cartSubTotal + cartTax;

    // Handlers
    const addToCart = (item: Item) => {
        setCart(prev => {
            const existing = prev.find(i => i.itemId === item.id);
            if (existing) {
                return prev.map(i => i.itemId === item.id
                    ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
                    : i);
            }
            return [...prev, {
                itemId: item.id!,
                name: item.name,
                quantity: 1,
                price: item.salePrice,
                total: item.salePrice,
                unit: item.unit,
                taxType: item.taxType
            }];
        });
    };

    const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.itemId !== id));

    const updateQuantity = (id: number, qty: number) => {
        if (qty < 0) return;
        setCart(prev => prev.map(i => i.itemId === id ? { ...i, quantity: qty, total: qty * i.price } : i));
    };

    const updatePrice = (id: number, price: number) => {
        if (price < 0) return;
        setCart(prev => prev.map(i => i.itemId === id ? { ...i, price, total: i.quantity * price } : i));
    };

    const updateUnit = (id: number, unit: string) => {
        setCart(prev => prev.map(i => i.itemId === id ? { ...i, unit } : i));
    };

    const selectCustomer = (c: Customer) => {
        setCustomer(c);
        setCustomerSearchTerm('');
        setShowCustomerSearch(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCheckoutComplete = async (invoiceData: any) => {
        try {
            // TRANSACTIONAL SAVE for Speed & Consistency
            const newId = await db.transaction('rw', [db.invoices, db.customers, db.items], async () => {
                // 1. Save Invoice
                const id = await db.invoices.add(invoiceData);

                // 2. Update Customer
                if (invoiceData.customerId) {
                    const customer = await db.customers.get(invoiceData.customerId);
                    if (customer) {
                        await db.customers.update(invoiceData.customerId, {
                            totalSpent: (customer.totalSpent || 0) + invoiceData.grandTotal,
                            balance: (customer.balance || 0) + (invoiceData.remainingAmount || 0)
                        });
                    }
                }

                // 3. Update Stock
                // Use Promise.all for parallel updates (faster than sequential loop await)
                const stockUpdates = invoiceData.items.map(async (item: any) => {
                    const dbItem = await db.items.get(item.itemId);
                    if (dbItem) {
                        return db.items.update(item.itemId, {
                            stock: Math.max(0, dbItem.stock - item.quantity)
                        });
                    }
                });
                await Promise.all(stockUpdates);

                return id;
            });

            return newId;
        } catch (error) {
            console.error("Failed to save invoice:", error);
            throw error;
        }
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] gap-6">
            {/* ... Left Side ... */}
            <div className="w-[65%] flex flex-col gap-6">
                {/* Same Search and Grid */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder={t('pos.search_placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>
                </div>

                <div
                    ref={itemsContainerRef}
                    onScroll={handleScroll}
                    className={`flex-1 overflow-y-auto content-start pr-2 ${settings.cafeMode
                        ? 'grid grid-cols-2 lg:grid-cols-3 gap-4'
                        : 'grid grid-cols-3 lg:grid-cols-4 gap-4'
                        }`}
                >
                    {visibleItems?.map(item => (
                        // In cafe mode: show card ONLY if item has image, otherwise regular button
                        (settings.cafeMode && item.image) ? (
                            <ItemCard
                                key={item.id}
                                item={item}
                                onClick={addToCart}
                            />
                        ) : (
                            <button
                                key={item.id}
                                onClick={() => addToCart(item)}
                                className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-500 transition-all text-left flex flex-col justify-between h-40 group"
                            >
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-white line-clamp-2">{item.name}</h3>
                                    {!settings.cafeMode && (
                                        <p className="text-xs text-slate-500 mt-1">{item.stock} {item.unit || 'pc'} in stock</p>
                                    )}
                                </div>
                                <div className="mt-2">
                                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {formatCurrency(item.salePrice)}
                                    </span>
                                </div>
                            </button>
                        )
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-full text-center p-8 text-slate-400">
                            {t('pos.item_not_found')}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart - Right Side (35%) */}
            <div className="w-[35%] bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                {/* Customer Header */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <User size={16} /> <span className="text-xs font-semibold uppercase">{t('dashboard.customer')}</span>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            value={customer.name}
                            onChange={(e) => {
                                setCustomer({ ...customer, name: e.target.value });
                                setCustomerSearchTerm(e.target.value);
                                setShowCustomerSearch(true);
                            }}
                            onFocus={() => setShowCustomerSearch(true)}
                            placeholder={t('pos.add_customer')}
                            className="w-full bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none pb-1 dark:text-white font-medium"
                        />
                        {showCustomerSearch && customerSearchTerm && (
                            <div className="absolute top-full left-0 w-full z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                                <div
                                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm text-blue-600"
                                    onClick={() => {
                                        // Keep what typed as new name
                                        setShowCustomerSearch(false);
                                    }}
                                >
                                    + {t('common.use')} "{customerSearchTerm}"
                                </div>
                                {filteredCustomers?.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => selectCustomer(c)}
                                        className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                                    >
                                        <div className="flex justify-between">
                                            <div className="font-medium text-slate-800 dark:text-white">{c.name}</div>
                                            {c.balance > 0 && <span className="text-xs text-red-500 font-bold">Due: {formatCurrency(c.balance)}</span>}
                                        </div>
                                        <div className="text-xs text-slate-500">{c.phone} {c.vatNumber && `| VAT: ${c.vatNumber}`}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map((item) => (
                        <div key={item.itemId} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg gap-2">
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-slate-800 dark:text-white">{item.name}</div>
                                <button onClick={() => removeFromCart(item.itemId)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <div className="flex-1 flex gap-2">
                                    <div className="flex flex-col w-20">
                                        <label className="text-[10px] uppercase">{t('pos.price')}</label>
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => updatePrice(item.itemId, parseFloat(e.target.value))}
                                            className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col w-16">
                                        <label className="text-[10px] uppercase">{t('pos.qty')}</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.itemId, parseFloat(e.target.value))}
                                            className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col w-16">
                                        <label className="text-[10px] uppercase">{t('pos.unit')}</label>
                                        <input
                                            type="text"
                                            value={item.unit}
                                            onChange={(e) => updateUnit(item.itemId, e.target.value)}
                                            className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="font-bold text-slate-800 dark:text-blue-300 text-sm">
                                        {formatCurrency(item.total)}
                                    </span>
                                    {item.taxType === 'inclusive' ?
                                        <span className="text-[10px] text-green-600 font-semibold">{t('pos.tax_incl')}</span> :
                                        <span className="text-[10px] text-orange-500">{t('pos.tax_excl')}</span>
                                    }
                                </div>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                            <ShoppingCart size={48} />
                            <p className="mt-2 text-sm">{t('pos.empty_cart')}</p>
                        </div>
                    )}
                </div>

                {/* Footer / Totals */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex justify-between text-sm dark:text-slate-400">
                        <span>{t('pos.subtotal')}</span>
                        <span>{formatCurrency(cartSubTotal)}</span>
                    </div>
                    {cartTax > 0 && (
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>{t('pos.tax')} ({GLOBAL_TAX_RATE}%)</span>
                            <span>{formatCurrency(cartTax)}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('pos.add_vat')}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isTaxExclusiveMode} onChange={(e) => setIsTaxExclusiveMode(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    <div className="flex justify-between font-bold text-lg dark:text-white">
                        <span>{t('pos.total')}</span>
                        <span>{formatCurrency(payableTotal)}</span>
                    </div>

                    <button
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                    >
                        <CreditCard size={24} />
                        {t('pos.checkout')} {formatCurrency(payableTotal)}
                    </button>
                </div>
            </div>

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={(success) => {
                    setIsCheckoutOpen(false);
                    if (success) {
                        setCart([]);
                        setCustomer({ name: 'Walk-in Customer', phone: '', id: 0, totalSpent: 0, balance: 0, vatNumber: '' });
                        setSearch('');
                        // Focus Search?
                    }
                }}
                subTotal={cartSubTotal}
                items={cart}
                customerName={customer.name}
                customerId={customer.id}
                customerVatNumber={customer.vatNumber}
                onConfirm={handleCheckoutComplete}
            />
        </div>
    );
};

export default PosTerminal;

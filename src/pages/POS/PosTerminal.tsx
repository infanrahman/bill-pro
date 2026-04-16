import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db, createRecordMetadata, type Invoice } from '../../services/db';

import type { Item, Customer, InvoiceItem } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ShoppingCart, User, CreditCard, Trash2, ShieldOff, LayoutGrid, Archive } from 'lucide-react';
import CheckoutModal from './CheckoutModal';
import ItemCard from '../../components/POS/ItemCard';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import CustomerForm from '../Customers/CustomerForm';
import { UserPlus, XCircle } from 'lucide-react';

const PosTerminal: React.FC = () => {
    const { formatCurrency, settings } = useSettings();
    const { addToast } = useNotification();
    const { hasPermission, activeBranchId, activeBranch } = useAuth();
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [search, setSearch] = useState('');
    const [showArabicName, setShowArabicName] = useState(false);

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
    const [customer, setCustomer] = useState<Customer>({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [kitchenNote, setKitchenNote] = useState('');
    const [orderType, setOrderType] = useState<'dine_in' | 'parcel' | 'pickup' | 'delivery'>('dine_in');
    const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
    
    // Load existing invoice if passed via state
    useEffect(() => {
        const state = location.state as { editInvoice?: Invoice };
        if (state?.editInvoice) {
            const inv = state.editInvoice;
            setEditingInvoice(inv);
            
            // Populate Cart
            const cartItems: InvoiceItem[] = inv.items.map((item: any) => ({
                itemId: item.itemId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                purchasePrice: item.purchasePrice,
                total: item.total,
                unit: item.unit,
                taxType: item.taxType,
                taxRate: item.taxRate
            }));
            setCart(cartItems);

            // Populate Customer
            if (inv.customerId && inv.customerId !== '0') {
                db.customers.get(inv.customerId).then(c => {
                    if (c) setCustomer(c);
                });
            } else {
                setCustomer({ name: inv.customerName || 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
            }

            // Populate Other Details
            setKitchenNote(inv.notes || '');
            if (inv.orderType) setOrderType(inv.orderType as any);

            // Clear location state to prevent reload on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    // Optimization: Pagination / Infinite Scroll
    const [visibleItemsCount, setVisibleItemsCount] = useState(50);
    const itemsContainerRef = React.useRef<HTMLDivElement>(null);

    const GLOBAL_TAX_RATE = 15;

    // Queries
    const items = useLiveQuery(() => activeBranch?.isMaster ? db.items.filter((i: any) => !i.deletedAt).toArray() : db.items.where('branchId').equals(activeBranchId).filter((i: any) => !i.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]);
    const customers = useLiveQuery(() => activeBranch?.isMaster ? db.customers.filter((c: any) => !c.deletedAt).toArray() : db.customers.where('branchId').equals(activeBranchId).filter((c: any) => !c.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]);
    const categories = useLiveQuery(() => activeBranch?.isMaster ? db.categories.filter((cat: any) => !cat.deletedAt).toArray() : db.categories.where('branchId').equals(activeBranchId).filter((cat: any) => !cat.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]);

    // Category Selection (Cafe Mode)
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Barcode Scanner Buffer
    const barcodeBuffer = React.useRef<string>('');
    const lastKeyTime = React.useRef<number>(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const isScanningRef = React.useRef<boolean>(false);

    const handleBarcodeLookup = async (code: string) => {
        try {
            let isScaleBarcode = false;
            let scaleQty = 1;
            let lookupCode = code;
            let parsedPrice = 0;

            if (code.length === 13 && code.match(/^2[0-9]/)) {
                const itemCode = code.substring(2, 7);
                const dataStr = code.substring(7, 12);
                lookupCode = itemCode;
                parsedPrice = Number(dataStr) / 100;
                isScaleBarcode = true;
            }

            let item = await db.items.where('barcode').equals(code).first();

            if (!item && isScaleBarcode) {
                item = await db.items.where('itemCode').equals(lookupCode).first();
                if (!item) {
                    item = await db.items.where('itemCode').equals(Number(lookupCode).toString()).first();
                }
            }

            if (item) {
                if (isScaleBarcode) {
                    if (item.salePrice > 0) {
                        scaleQty = Number((parsedPrice / item.salePrice).toFixed(3));
                    } else {
                        scaleQty = 1;
                    }
                }
                addToCart(item, isScaleBarcode ? scaleQty : 1);
                addToast(t('pos.added_item', { name: item.name }), 'success');
                
                if (searchInputRef.current) {
                    setSearch('');
                    searchInputRef.current.blur();
                }
            } else {
                addToast(t('pos.item_not_found'), 'error');
            }
        } catch (err) {
            console.error("Barcode lookup failed", err);
        }
    };

    React.useEffect(() => {

        const handleGlobalKeyDown = async (e: KeyboardEvent) => {
            // --- Barcode Scanner Detection ---
            // Barcode scanners type very fast (< 50ms between keys) then hit Enter.
            // We detect this pattern globally, INCLUDING inside input fields,
            // so scanned barcodes always go directly to cart.

            const target = e.target as HTMLElement;
            const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // Skip non-character keys (except Enter which finalizes barcode)
            if (e.key !== 'Enter' && e.key.length !== 1) return;
            // Skip modifier combos (Ctrl+C, etc.)
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const now = Date.now();
            const timeDelta = now - lastKeyTime.current;

            // If too slow between keystrokes, reset buffer (manual typing)
            if (timeDelta > 100) {
                barcodeBuffer.current = '';
                isScanningRef.current = false;
            }
            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                if (barcodeBuffer.current.length >= 3) {
                    // Barcode Detected! Prevent default behavior
                    e.preventDefault();
                    e.stopPropagation();

                    const code = barcodeBuffer.current;
                    barcodeBuffer.current = '';
                    isScanningRef.current = false;

                    // Clear the search field if barcode chars leaked into it
                    if (searchInputRef.current) {
                        setSearch('');
                        searchInputRef.current.blur();
                    }

                    // Lookup Item
                    await handleBarcodeLookup(code);
                }
                // If buffer < 3 chars, it's a normal Enter press — let it through
                barcodeBuffer.current = '';
            } else if (e.key.length === 1) {
                barcodeBuffer.current += e.key;

                // If we detect fast typing (scanner), mark as scanning
                // and prevent characters from going into search input
                if (barcodeBuffer.current.length >= 2 && timeDelta < 80) {
                    isScanningRef.current = true;
                }

                // If scanning and focused on search input, prevent the character
                if (isScanningRef.current && isInputField) {
                    e.preventDefault();
                    // Also clear any chars that already leaked into search
                    if (searchInputRef.current && searchInputRef.current === target) {
                        setSearch('');
                    }
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown, true); // Use capture phase
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [items]);

    // Derived
    const filteredItems = useMemo(() => {
        if (!items) return [];
        let filtered = items;

        if (settings.cafeMode && selectedCategoryId !== null) {
            filtered = filtered.filter((i: any) => i.categoryId === selectedCategoryId);
        }

        if (search) {
            const lower = search.toLowerCase();
            filtered = filtered.filter((i: any) =>
                i.name.toLowerCase().includes(lower) ||
                (i.barcode && i.barcode.includes(lower))
            );
        }
        return filtered;
    }, [items, search, settings.cafeMode, selectedCategoryId]);

    // Reset pagination when filter changes
    React.useEffect(() => {
        setVisibleItemsCount(50);
        if (itemsContainerRef.current) itemsContainerRef.current.scrollTop = 0;
    }, [search, selectedCategoryId]);

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
        return customers.filter((c: any) => c.name.toLowerCase().includes(lower) || c.phone.includes(lower));
    }, [customers, customerSearchTerm]);

    const cartCalculations = useMemo(() => {
        let totalTaxAmount = 0;
        let totalGrandTotal = 0;
        let totalSubTotal = 0;
        
        cart.forEach(item => {
            const lineTotal = Math.round((item.price * item.quantity) * 100) / 100;
            const rate = item.taxRate ?? GLOBAL_TAX_RATE;
            const type = item.taxType || 'exclusive';
            
            let lineTax = 0;
            let lineFinal = 0;

            if (settings.applyTax) {
                if (type === 'inclusive') {
                    const base = lineTotal / (1 + (rate / 100));
                    lineTax = Math.round((lineTotal - base) * 100) / 100;
                    lineFinal = lineTotal;
                } else {
                    lineTax = Math.round((lineTotal * (rate / 100)) * 100) / 100;
                    lineFinal = Math.round((lineTotal + lineTax) * 100) / 100;
                }
            } else {
                // VAT is strictly OFF
                lineTax = 0;
                lineFinal = lineTotal;
            }
            
            totalSubTotal = Math.round((totalSubTotal + lineTotal) * 100) / 100;
            totalTaxAmount = Math.round((totalTaxAmount + lineTax) * 100) / 100;
            totalGrandTotal = Math.round((totalGrandTotal + lineFinal) * 100) / 100;
        });

        return {
            subTotal: totalSubTotal,
            taxAmount: totalTaxAmount,
            grandTotal: totalGrandTotal
        };
    }, [cart, settings.applyTax, GLOBAL_TAX_RATE]);

    const cartSubTotal = cartCalculations.subTotal;
    const cartTax = cartCalculations.taxAmount;
    const payableTotal = cartCalculations.grandTotal;


    // Handlers
    const addToCart = (item: Item, overrideQty?: number) => {
        const qtyToAdd = overrideQty || 1;
        setCart(prev => {
            const existing = prev.find(i => i.itemId === item.id);
            if (existing) {
                return prev.map((i: any) => {
                    if (i.itemId === item.id) {
                        const newQuantity = i.quantity + qtyToAdd;
                        return { ...i, quantity: newQuantity, total: newQuantity * i.price };
                    }
                    return i;
                });
            }
            return [...prev, {
                itemId: item.id!,
                name: item.name,
                quantity: qtyToAdd,
                price: item.salePrice,
                purchasePrice: item.purchasePrice,
                total: qtyToAdd * item.salePrice,
                unit: item.unit,
                taxType: item.taxType
            }];
        });
    };

    const removeFromCart = (id: string) => setCart(prev => prev.filter((i: any) => i.itemId !== id));

    const updateQuantity = (id: string, qty: number) => {
        if (qty < 0) return;
        setCart(prev => prev.map((i: any) => i.itemId === id ? { ...i, quantity: qty, total: qty * i.price } : i));
    };

    const updatePrice = (id: string, price: number) => {
        if (price < 0) return;
        setCart(prev => prev.map((i: any) => i.itemId === id ? { ...i, price, total: i.quantity * price } : i));
    };

    const updateUnit = (id: string, unit: string) => {
        setCart(prev => prev.map((i: any) => i.itemId === id ? { ...i, unit } : i));
    };

    const selectCustomer = (c: Customer) => {
        setCustomer(c);
        setCustomerSearchTerm('');
        setShowCustomerSearch(false);
    };

    const handleCheckoutComplete = async (invoiceData: any): Promise<string> => {
        try {
            const newId = await db.transaction('rw', [db.invoices, db.customers, db.items], async () => {
                const metadata = createRecordMetadata();
                
                // If editing, preserve the original ID and invoice number
                const finalData = editingInvoice 
                    ? { ...editingInvoice, ...invoiceData, updatedAt: new Date() }
                    : { ...invoiceData, ...metadata };

                const id = await db.invoices.put(finalData);

                // Update Customer Balance
                if (invoiceData.customerId) {
                    const customer = await db.customers.get(invoiceData.customerId);
                    if (customer) {
                        // For editing existing invoices, we need to handle the balance carefully.
                        // If it was already a partial payment, we only add the NEW remaining amount.
                        // However, the simple way here is to just add the new grandTotal to totalSpent
                        // and set the current balance correctly.
                        // NOTE: If it was an 'order', stock wasn't deducted yet, and balance wasn't updated.
                        
                        const isOriginalOrder = editingInvoice?.type === 'order';
                        
                        if (isOriginalOrder) {
                            await db.customers.update(invoiceData.customerId, {
                                totalSpent: (customer.totalSpent || 0) + invoiceData.grandTotal,
                                balance: (customer.balance || 0) + (invoiceData.remainingAmount || 0)
                            });
                        } else {
                            // If it was already an invoice (Pending Sale), balance was already added possibly?
                            // In Cafe Mode, Pending Invoices don't update balance until Paid? 
                            // Actually Sales.tsx line 495-502 updates balance for converted orders.
                            // Let's ensure consistency.
                            await db.customers.update(invoiceData.customerId, {
                                totalSpent: (customer.totalSpent || 0) + (editingInvoice ? 0 : invoiceData.grandTotal),
                                balance: (customer.balance || 0) + (invoiceData.remainingAmount || 0)
                            });
                        }
                    }
                }

                // Deduct Stock (only if not already done)
                // Sales Orders (type='order') do NOT deduct stock.
                // Pendng Invoices... let's check current behavior.
                const shouldDeductStock = !editingInvoice || editingInvoice.type === 'order';

                if (shouldDeductStock) {
                    for (const item of invoiceData.items) {
                        const dbItem = await db.items.get(item.itemId);
                        if (dbItem) {
                            await db.items.update(item.itemId, {
                                stock: Math.max(0, dbItem.stock - item.quantity)
                            });
                        }
                    }
                }

                return id;
            });

            setEditingInvoice(null);
            return newId as string;
        } catch (error) {
            console.error("Failed to save invoice:", error);
            throw error;
        }
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] gap-6">
            {/* ... Left Side (Products & Categories) ... */}
            <div className="flex-1 flex gap-6 min-w-0">

                {/* Categories Column (Only in Cafe Mode) */}
                {settings.cafeMode && (
                    <div className="w-[120px] lg:w-[160px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
                        <button
                            onClick={() => setSelectedCategoryId(null)}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all h-24 shadow-sm
                                ${selectedCategoryId === null
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-blue-900/20'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
                        >
                            <LayoutGrid size={24} />
                            <span className="text-xs font-bold font-sans">All Items</span>
                        </button>

                        {categories?.map((category: any) => (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategoryId(category.id)}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all h-24 shadow-sm relative overflow-hidden
                                    ${selectedCategoryId === category.id
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-blue-900/20'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
                            >
                                {category.color && selectedCategoryId !== category.id && (
                                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: category.color }}></div>
                                )}
                                <span className="text-xs font-bold leading-tight line-clamp-2 md:line-clamp-3 font-sans break-words w-full px-1">{category.name}</span>
                            </button>
                        ))}
                    </div>
                )}


                <div className="flex-1 flex flex-col gap-6">
                    {/* Search Bar */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={t('pos.search_placeholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const code = search.trim();
                                        if (code) {
                                            e.preventDefault();
                                            handleBarcodeLookup(code);
                                        }
                                    }
                                }}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => setShowArabicName(!showArabicName)}
                            className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap font-medium ${showArabicName
                                ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600'
                                }`}
                        >
                            عربي
                        </button>
                    </div>

                    <div
                        ref={itemsContainerRef}
                        onScroll={handleScroll}
                        className={`flex-1 overflow-y-auto content-start pr-2 ${settings.cafeMode
                            ? 'grid grid-cols-2 xl:grid-cols-3 gap-4'
                            : 'grid grid-cols-3 lg:grid-cols-4 gap-4'
                            }`}
                    >
                        {visibleItems?.map((item: any) => (
                            // In cafe mode: show card ONLY if item has image, otherwise regular button
                            (settings.cafeMode && item.image) ? (
                                <ItemCard
                                    key={item.id}
                                    item={item}
                                    onClick={addToCart}
                                    showArabicName={showArabicName}
                                />
                            ) : (
                                <button
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-500 transition-all text-left flex flex-col justify-between h-40 group"
                                >
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-white line-clamp-2">{item.name}</h3>
                                        {showArabicName && item.arabicName && (
                                            <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5" dir="rtl">{item.arabicName}</div>
                                        )}
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
            </div>

            {/* Cart - Right Side (Fixed Width) */}
            <div className="w-[350px] xl:w-[400px] shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                {/* Customer Header */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3 text-slate-500">
                        <div className="flex items-center gap-2">
                            <User size={16} /> 
                            <span className="text-xs font-semibold uppercase">{t('dashboard.customer')}</span>
                        </div>
                        <button 
                            onClick={() => setIsCustomerFormOpen(true)}
                            className="flex items-center gap-1 text-[10px] font-bold bg-blue-500 text-white px-2 py-1 rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                        >
                            <UserPlus size={12} /> {t('common.add')}
                        </button>
                    </div>

                    <div className="relative">
                        {customer.id !== '0' ? (
                            <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-blue-700 dark:text-blue-300 truncate">{customer.name}</div>
                                        {customer.loyaltyPoints !== undefined && customer.loyaltyPoints > 0 && (
                                            <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-md text-[10px] font-black">
                                                ★ {customer.loyaltyPoints}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        {customer.phone || 'No Phone'}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
                                        setCustomerSearchTerm('');
                                    }}
                                    className="p-1 hover:text-red-500 text-slate-400 transition-colors"
                                    title={t('common.reset')}
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={customerSearchTerm}
                                    onChange={(e) => {
                                        setCustomerSearchTerm(e.target.value);
                                        setShowCustomerSearch(true);
                                    }}
                                    onFocus={() => setShowCustomerSearch(true)}
                                    placeholder={t('pos.walk_in_customer')}
                                    className="w-full bg-slate-100/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none dark:text-white font-medium italic"
                                />
                                {showCustomerSearch && customerSearchTerm && (
                                    <div className="absolute top-full left-0 w-full z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                                        {filteredCustomers?.map((c: any) => (
                                            <div
                                                key={c.id}
                                                onClick={() => selectCustomer(c)}
                                                className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-bold text-slate-800 dark:text-white">{c.name === 'Walk-in Customer' ? t('pos.walk_in_customer') : c.name}</div>
                                                        <div className="text-xs text-slate-500 font-medium">{c.phone}</div>
                                                    </div>
                                                    {c.loyaltyPoints !== undefined && c.loyaltyPoints > 0 && (
                                                        <span className="text-[10px] text-yellow-600 font-bold">★ {c.loyaltyPoints}</span>
                                                    )}
                                                </div>
                                                {c.balance > 0 && (
                                                    <div className="mt-1 text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded inline-block">
                                                        {t('pos.balance')}: {formatCurrency(c.balance)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {filteredCustomers?.length === 0 && (
                                            <div className="p-4 text-center text-sm text-slate-400">
                                                {t('pos.item_not_found')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 custom-scrollbar">
                    {cart.map((item: any) => (
                        <div key={item.itemId} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg gap-2">
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-slate-800 dark:text-white">{item.name}</div>
                                <button onClick={() => removeFromCart(item.itemId)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <div className="flex-1 grid grid-cols-3 gap-1 xl:gap-2">
                                    <div className="flex flex-col min-w-0">
                                        <label className="text-[10px] uppercase truncate">{t('pos.price')}</label>
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => updatePrice(item.itemId, parseFloat(e.target.value))}
                                            className="w-full px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500 outline-none text-center min-w-0"
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <label className="text-[10px] uppercase truncate">
                                            {item.unit === 'kg' ? t('pos.weight', { defaultValue: 'WEIGHT' }) : t('pos.qty')}
                                        </label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.itemId, parseFloat(e.target.value))}
                                            className="w-full px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500 outline-none text-center min-w-0"
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <label className="text-[10px] uppercase truncate">{t('pos.unit')}</label>
                                        <input
                                            type="text"
                                            value={item.unit}
                                            onChange={(e) => updateUnit(item.itemId, e.target.value)}
                                            className="w-full px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500 outline-none text-center min-w-0"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col items-end min-w-[70px]">
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
                    <div className="flex justify-between font-bold text-lg dark:text-white">
                        <span>{t('pos.total')}</span>
                        <span>{formatCurrency(payableTotal)}</span>
                    </div>

                    {settings.cafeMode && (
                        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mt-2 border border-slate-200 dark:border-slate-700">
                            {[
                                { id: 'dine_in', label: 'pos.dine_in', icon: '🍽️' },
                                { id: 'parcel', label: 'pos.parcel', icon: '🥡' },
                                { id: 'pickup', label: 'pos.pickup', icon: '🚶' },
                                { id: 'delivery', label: 'pos.delivery', icon: '🚚' }
                            ].map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setOrderType(type.id as any)}
                                    className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all duration-200 gap-1
                                        ${orderType === type.id
                                            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm scale-[1.02] ring-1 ring-slate-200 dark:ring-slate-500'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                        }`}
                                >
                                    <span className="text-xl">{type.icon}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-tight truncate w-full text-center">
                                        {t(type.label)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-2">
                        <textarea
                            value={kitchenNote}
                            onChange={(e) => setKitchenNote(e.target.value)}
                            placeholder={t('pos.kitchen_notes') || 'Add kitchen note (e.g. No onions)'}
                            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none dark:text-white"
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-4">
                        <button
                            onClick={async () => {
                                try {
                                    const saved = localStorage.getItem('printerConfig');
                                    if (!saved) { addToast('Please configure a thermal printer in Settings first.', 'error'); return; }
                                    const config = JSON.parse(saved);
                                    if (!config.thermal?.printerName) { addToast('No thermal printer selected in Settings.', 'error'); return; }
                                    if (window.electron && window.electron.openCashDrawer) {
                                        const success = await window.electron.openCashDrawer(config.thermal.printerName);
                                        if (success) addToast('Cash drawer opened.', 'success');
                                        else addToast('Failed to open cash drawer.', 'error');
                                    } else {
                                        addToast('Cash drawer requires desktop app.', 'error');
                                    }
                                } catch (e) {
                                    console.error(e);
                                    addToast('Error opening drawer', 'error');
                                }
                            }}
                            title="Open Cash Drawer (F8)"
                            className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 py-4 rounded-xl font-bold flex justify-center items-center transition-all col-span-1"
                        >
                            <Archive size={24} />
                        </button>
                        <button
                            onClick={() => setIsCheckoutOpen(true)}
                            disabled={cart.length === 0}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all flex justify-center items-center gap-2 col-span-3"
                        >
                            <CreditCard size={24} />
                            {t('pos.checkout')} {formatCurrency(payableTotal)}
                        </button>
                    </div>
                </div>
            </div>

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={(success) => {
                    setIsCheckoutOpen(false);
                    if (success) {
                        setCart([]);
                        setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
                        setSearch('');
                        setKitchenNote('');
                        setOrderType('dine_in');
                        setEditingInvoice(null);
                        // Blur search to prevent barcode scanner conflict
                        searchInputRef.current?.blur();
                    }
                    setTimeout(() => {
                        if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                        }
                    }, 50);
                }}
                subTotal={cartSubTotal}
                items={cart}
                customerName={(customer.name === 'Walk-in Customer' || !customer.name) ? t('pos.walk_in_customer') : customer.name}
                customerId={customer.id}
                customerVatNumber={customer.vatNumber}
                notes={kitchenNote}
                orderType={orderType}
                onConfirm={handleCheckoutComplete}
                invoiceNumber={editingInvoice?.invoiceNumber}
            />

            {isCustomerFormOpen && (
                <CustomerForm 
                    onClose={() => setIsCustomerFormOpen(false)}
                    onSave={() => {
                        // Refresh customers query is handled by useLiveQuery automatically
                        setIsCustomerFormOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default PosTerminal;

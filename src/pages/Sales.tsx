import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Dexie from 'dexie';
import { db, createRecordMetadata } from '../services/db';
import type { Invoice, InvoiceItem, Item } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, FileText, ShoppingCart, RotateCcw, DollarSign, Save, Printer, ShieldCheck, ShieldAlert, Clock, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../contexts/NotificationContext';
import { useSettings } from '../contexts/SettingsContext';
import Modal from '../components/UI/Modal';
import ItemForm from './Inventory/ItemForm';
import SalesHistory from './Transactions/SalesHistory';
import Expenses from './Transactions/Expenses';
import { useAuth } from '../contexts/AuthContext';

import { useGridNavigation } from '../hooks/useGridNavigation';
import { generateInvoicePDF } from '../services/invoiceGenerator';
import Skeleton from '../components/UI/Skeleton';
import EmptyState from '../components/UI/EmptyState';
import { Receipt, CreditCard } from 'lucide-react';
import clsx from 'clsx';
import QuickPaymentModal from '../components/Sales/QuickPaymentModal';
import SalesDashboard from './Sales/SalesDashboard';

const Sales = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addToast } = useNotification();
    const { formatCurrency, formatDate, settings } = useSettings();
    const { activeBranchId } = useAuth();
    
    // Parse URL params for default state
    const searchParams = new URLSearchParams(location.search);
    const initialTab = (searchParams.get('tab') as any) || 'dashboard';
    const actionParam = searchParams.get('action');

    const [activeTab, setActiveTab] = useState<'dashboard' | 'order' | 'invoice' | 'return' | 'payment'>(initialTab);

    // Sync state if URL changes (like clicking bottom nav)
    useEffect(() => {
        const tab = searchParams.get('tab') as any;
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }

        const action = searchParams.get('action');
        if (action) {
            if (action === 'new') {
                if (tab === 'payment') {
                    setIsPaymentModalOpen(true);
                } else if (tab === 'expense') {
                    // Handled inside Expenses.tsx if needed, but for now we'll just switch tabs
                    // Actually, Expenses component has its own Add Modal, we can't easily trigger it from here unless we pass a prop or use global state.
                    // For now, we just switch to the expense tab.
                } else {
                    setIsModalOpen(true); // For Order/Return
                }
            } else if (action === 'quick_pay') {
                setIsQuickPayModalOpen(true);
            }
            
            // Clean up the URL so refreshing doesn't re-trigger it
            navigate(location.pathname + (tab ? `?tab=${tab}` : ''), { replace: true });
        }
    }, [location.search]);

    // Check if ZATCA is enabled
    const isZatcaEnabled = useMemo(() => {
        try {
            const cfg = localStorage.getItem('zatca_config');
            if (!cfg) return false;
            const { status } = JSON.parse(cfg);
            return status === 'LIVE' || status === 'COMPLIANCE_OBTAINED';
        } catch { return false; }
    }, []);

    // Stats — use indexed 'type' field for fast counts (no full table scans)
    const ordersCount = useLiveQuery(() => db.invoices.where('type').equals('order').filter((inv: any) => !inv.deletedAt && inv.branchId === activeBranchId).count(), [activeBranchId]) || 0;
    const invoicesCount = useLiveQuery(() => db.invoices.where('type').equals('invoice').filter((inv: any) => !inv.deletedAt && inv.branchId === activeBranchId).count(), [activeBranchId]) || 0;
    const returnsCount = useLiveQuery(() => db.invoices.where('type').equals('return').filter((inv: any) => !inv.deletedAt && inv.branchId === activeBranchId).count(), [activeBranchId]) || 0;
    const paymentsCount = useLiveQuery(() => db.customerPayments.filter((p: any) => !p.deletedAt && p.branchId === activeBranchId).count(), [activeBranchId]) || 0;
    const expensesCount = useLiveQuery(() => db.expenses.filter((e: any) => !e.deletedAt && e.branchId === activeBranchId).count(), [activeBranchId]) || 0;

    const stats = {
        orders: ordersCount,
        invoices: invoicesCount,
        returns: returnsCount,
        payments: paymentsCount,
        expenses: expensesCount,
    };

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    // const [editingId, setEditingId] = useState<string | null>(null); // For future use
    const [customerName, setCustomerName] = useState('');
    const [customerId, setCustomerId] = useState<string | undefined>(undefined);
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    // const [dueDate, setDueDate] = useState(''); // For future use
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [notes, setNotes] = useState('');

    // Payment State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentCustomerId, setPaymentCustomerId] = useState<string | undefined>(undefined);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'bank_transfer'>('cash');
    const [paymentReference, setPaymentReference] = useState('');

    // Payment Filter State
    const [paymentFilterMode, setPaymentFilterMode] = useState<string>('all');
    const [paymentDateType, setPaymentDateType] = useState<'all' | 'single' | 'range'>('all');
    const [paymentStartDate, setPaymentStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentEndDate, setPaymentEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Inline Item Creation State
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemStock, setNewItemStock] = useState('');

    const [isQuickPayModalOpen, setIsQuickPayModalOpen] = useState(false);

    // Fetch Lists — branch-scoped with soft-delete filter
    const customers = useLiveQuery(() => db.customers.where('branchId').equals(activeBranchId).filter((c: any) => !c.deletedAt).toArray(), [activeBranchId]);
    const inventory = useLiveQuery(() => db.items.where('branchId').equals(activeBranchId).filter((i: any) => !i.deletedAt).toArray(), [activeBranchId]);

    // Derived Lists — use compound [branchId+createdAt] index for efficient ordered retrieval
    const currentList = useLiveQuery(async () => {
        const results = await db.invoices
            .where('[branchId+createdAt]')
            .between(
                [activeBranchId, Dexie.minKey],
                [activeBranchId, Dexie.maxKey]
            )
            .filter((inv: any) => !inv.deletedAt && inv.type === activeTab)
            .reverse()
            .toArray();
        return results;
    }, [activeTab, activeBranchId]);

    // Grid Nav
    const recentOrders = useLiveQuery(async () => {
        return await db.invoices
            .where('[branchId+createdAt]')
            .between([activeBranchId, Dexie.minKey], [activeBranchId, Dexie.maxKey])
            .filter((inv: any) => !inv.deletedAt && inv.type === 'order')
            .reverse()
            .limit(5)
            .toArray();
    }, [activeBranchId]);
    const { getGridCellProps } = useGridNavigation({
        rows: currentList?.length || 0,
        cols: 6
    });

    const paymentList = useLiveQuery(() => db.customerPayments.orderBy('date').filter((p: any) => !p.deletedAt && p.branchId === activeBranchId).reverse().toArray(), [activeBranchId]);

    // Filtered Lists
    const filteredPayments = useMemo(() => {
        if (!paymentList) return [];
        return paymentList.filter(p => {
            let match = true;
            if (paymentFilterMode !== 'all' && p.paymentMode !== paymentFilterMode) match = false;
            
            if (paymentDateType === 'single') {
                const dateToMatch = new Date(paymentStartDate).toDateString();
                const pDate = new Date(p.date).toDateString();
                if (dateToMatch !== pDate) match = false;
            } else if (paymentDateType === 'range') {
                const start = new Date(paymentStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(paymentEndDate);
                end.setHours(23, 59, 59, 999);
                const pDate = new Date(p.date);
                if (pDate < start || pDate > end) match = false;
            }
            return match;
        });
    }, [paymentList, paymentFilterMode, paymentDateType, paymentStartDate, paymentEndDate]);

    const paymentTotals = useMemo(() => {
        const totals = { total: 0, byMethod: {} as Record<string, number> };
        filteredPayments.forEach(p => {
            totals.total += p.amount;
            totals.byMethod[p.paymentMode] = (totals.byMethod[p.paymentMode] || 0) + p.amount;
        });
        return totals;
    }, [filteredPayments]);

    const filteredInventory = inventory?.filter((i: any) =>
        (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.barcode || '').includes(searchTerm)
    );

    // Infinite Scroll Logic
    const [visibleItemsCount, setVisibleItemsCount] = useState(50);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Derived & Pagination
    // Reset pagination when filter changes
    useEffect(() => {
        setTimeout(() => {
            setVisibleItemsCount(50);
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        }, 0);
    }, [searchTerm]);

    const visibleItems = filteredInventory?.slice(0, visibleItemsCount);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            setVisibleItemsCount(prev => Math.min(prev + 50, filteredInventory?.length || 0));
        }
    };

    // Helpers
    const printInvoice = (invoice: Invoice) => {
        try {
            const saved = localStorage.getItem('businessDetails');
            const businessDetails = saved ? JSON.parse(saved) : { name: 'My Shop', address: '', phone: '' };

            // Unified Print Function (Handles Thermal & A4)
            generateInvoicePDF(invoice, businessDetails).catch(console.error);
        } catch (error) {
            console.error(error);
        }
    };

    const printPaymentReport = async () => {
        try {
            const { generatePaymentReportPDF } = await import('../services/invoiceGenerator');
            const saved = localStorage.getItem('businessDetails');
            const businessDetails = saved ? JSON.parse(saved) : { name: 'My Shop', address: '', phone: '' };
            generatePaymentReportPDF(filteredPayments, businessDetails, {
                mode: paymentFilterMode,
                dateType: paymentDateType,
                start: paymentStartDate,
                end: paymentEndDate,
                totals: paymentTotals
            }).catch(console.error);
        } catch (error) {
            console.error(error);
        }
    };

    const printPaymentReceipt = async (payment: any, customerName: string) => {
        try {
            const { generatePaymentReceiptPDF } = await import('../services/invoiceGenerator');
            const saved = localStorage.getItem('businessDetails');
            const businessDetails = saved ? JSON.parse(saved) : { name: 'My Shop', address: '', phone: '' };
            generatePaymentReceiptPDF(payment, businessDetails, customerName).catch(console.error);
        } catch (error) {
            console.error(error);
        }
    };

    const addToOrder = (item: Item) => {
        const existing = items.find(i => i.itemId === item.id);
        if (existing) {
            setItems(items.map((i: any) =>
                i.itemId === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i
            ));
        } else {
            setItems([...items, {
                itemId: item.id!,
                name: item.name,
                quantity: 1,
                price: item.salePrice,
                purchasePrice: item.purchasePrice, // Capture cost
                total: item.salePrice,
                taxType: item.taxType,
                taxRate: item.taxRate
            }]);
        }
    };

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

    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

    if (isAddItemOpen) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 overflow-y-auto">
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

    const handleSave = async () => {
        if (!customerName || items.length === 0) {
            addToast(t('sales.required_error'), 'error');
            return;
        }

        // Guard: inline modal only creates orders or returns, not invoices
        if (activeTab !== 'order' && activeTab !== 'return') {
            return;
        }

        const finalItems = items.map(item => {
            const nominal = item.price * item.quantity;
            const rate = item.taxRate || 0;
            const type = item.taxType || 'exclusive';

            let lineTax = 0;
            let lineFinal = 0;

            if (settings.applyTax) {
                if (type === 'exclusive') {
                    lineTax = Math.round((nominal * (rate / 100)) * 100) / 100;
                    lineFinal = Math.round((nominal + lineTax) * 100) / 100;
                } else {
                    const base = nominal / (1 + (rate / 100));
                    lineTax = Math.round((nominal - base) * 100) / 100;
                    lineFinal = Math.round(nominal * 100) / 100;
                }
            } else {
                lineTax = 0;
                lineFinal = nominal;
            }

            return {
                ...item,
                taxAmount: lineTax,
                total: lineFinal
            };
        });

        const totalTax = finalItems.reduce((sum, i) => sum + (i.taxAmount || 0), 0);
        const totalGrand = finalItems.reduce((sum, i) => sum + i.total, 0);

        try {
            await db.transaction('rw', [db.invoices, db.items, db.customers], async () => {
                // Generate sequential invoice number inside transaction to prevent race conditions
                const lastInvoice = await db.invoices.orderBy('createdAt').last();
                let nextNumber = 1;
                if (lastInvoice && lastInvoice.invoiceNumber) {
                    const lastNumStr = lastInvoice.invoiceNumber.replace(/\D/g, '');
                    const lastNum = parseInt(lastNumStr, 10);
                    if (!isNaN(lastNum)) nextNumber = lastNum + 1;
                }
                const prefix = activeTab === 'order' ? 'SO-' : 'RET-';
                const seqInvoiceNumber = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

                const invoiceData: Invoice = {
                    ...createRecordMetadata(),
                    branchId: activeBranchId || '',
                    invoiceNumber: seqInvoiceNumber,
                    customerName,
                    customerId,
                    items: finalItems,
                    subTotal: totalAmount, 
                    taxAmount: totalTax,
                    discountAmount: 0,
                    grandTotal: totalGrand,
                    // H14 Fix: Returns mark full amount paid; orders mark 0 paid
                    paidAmount: activeTab === 'return' ? totalGrand : 0,
                    remainingAmount: activeTab === 'return' ? 0 : totalGrand,
                    paymentMode: 'split', // Default
                    paymentStatus: activeTab === 'order' ? 'pending' : 'paid',
                    createdAt: new Date(orderDate),
                    type: activeTab as 'order' | 'return',
                    status: activeTab === 'order' ? 'pending' : 'paid',
                    notes
                };

                await db.invoices.add(invoiceData);

                if (activeTab === 'return') {
                    // 1. Increase Stock
                    for (const item of items) {
                        const dbItem = await db.items.get(item.itemId);
                        if (dbItem) {
                            await db.items.update(item.itemId, {
                                stock: (dbItem.stock || 0) + item.quantity
                            });
                        }
                    }

                    // 2. Decrease Customer Balance (Credit Note)
                    // H15 Fix: Handle undefined/null balance safely to prevent NaN
                    if (customerId) {
                        const customer = await db.customers.get(customerId);
                        if (customer) {
                            await db.customers.update(customerId, {
                                balance: (customer.balance || 0) - totalGrand
                            });
                        }
                    }
                }
            });

            addToast(activeTab === 'order' ? t('sales.order_created') : t('sales.return_created'), 'success');
            setIsModalOpen(false);
            setItems([]);
            setCustomerName('');
            setCustomerId(undefined);
            setNotes('');
        } catch (e) {
            console.error(e);
            addToast(t('sales.error_saving'), 'error');
        }
    };


    return (
        <>
        {activeTab === 'dashboard' ? (
            <SalesDashboard stats={stats} recentOrders={recentOrders || []} totalPaymentsIn={paymentTotals.total} />
        ) : (
        <div className="space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen p-4 md:p-8 pt-2 md:pt-0 max-w-[1600px] mx-auto font-inter pb-24">
            
            {/* Dynamic List Header (Screen 2, 3, etc.) */}
            <div className="flex flex-col gap-4 relative z-10 pt-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-slate-700 dark:text-slate-300">
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {activeTab === 'order' && <ShoppingCart className="text-blue-600" size={20} />}
                            {activeTab === 'invoice' && <FileText className="text-blue-600" size={20} />}
                            {activeTab === 'return' && <RotateCcw className="text-amber-600" size={20} />}
                            {activeTab === 'payment' && <DollarSign className="text-emerald-600" size={20} />}
                            {activeTab === 'order' && 'Sales Orders'}
                            {activeTab === 'invoice' && 'Invoices'}
                            {activeTab === 'return' && 'Returns'}
                            {activeTab === 'payment' && 'Payments In'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 text-slate-600">
                            <Search size={18} />
                        </button>
                        <button className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 text-slate-600">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        </button>
                    </div>
                </div>

                {/* Pill Tabs for Lists */}
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    <button className="px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs whitespace-nowrap">All ({
                        activeTab === 'order' ? stats.orders :
                        activeTab === 'invoice' ? stats.invoices :
                        activeTab === 'return' ? stats.returns :
                        stats.payments
                    })</button>
                    {activeTab === 'order' && (
                        <>
                            <button className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-medium text-xs whitespace-nowrap">Pending</button>
                            <button className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-medium text-xs whitespace-nowrap">Completed</button>
                        </>
                    )}
                    {activeTab === 'invoice' && (
                        <>
                            <button className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-medium text-xs whitespace-nowrap">Paid</button>
                            <button className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-medium text-xs whitespace-nowrap">Unpaid</button>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 min-h-[400px] overflow-hidden">
                {activeTab === 'invoice' && <SalesHistory onReturn={(inv) => {
                    setActiveTab('return');
                    setCustomerId(inv.customerId);
                    setCustomerName(inv.customerName);
                    setItems(inv.items.map((i: any) => ({ ...i }))); // Clone items
                    setNotes(t('sales.return_for_invoice', { number: inv.invoiceNumber }));
                    setIsModalOpen(true);
                }} />}

                {(activeTab === 'order' || activeTab === 'return') && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap min-w-[600px] responsive-table">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-700/50">
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.date')} #</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{activeTab === 'order' ? t('sales.order_no') : t('sales.return_no')}</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.customer')}</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.amount')}</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.status')}</th>
                                    {activeTab === 'return' && isZatcaEnabled && <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">ZATCA</th>}
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {!currentList ? (
                                    Array.from({ length: 5 }).map((_: any, i: any) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-5"><Skeleton width={80} height={20} /></td>
                                            <td className="p-5"><Skeleton width={100} height={20} /></td>
                                            <td className="p-5"><Skeleton width={120} height={20} /></td>
                                            <td className="p-5"><Skeleton width={80} height={20} /></td>
                                            <td className="p-5"><Skeleton width={80} height={20} /></td>
                                            <td className="p-5"><Skeleton width={40} height={30} /></td>
                                        </tr>
                                    ))
                                ) : currentList.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <EmptyState
                                                title={t('sales.no_records')}
                                                description={activeTab === 'order' ? t('sales.no_orders_desc') || "No orders found." : t('sales.no_invoices_desc') || "No invoices found."}
                                                icon={Receipt}
                                                actionLabel={activeTab === 'order' ? t('sales.new_order') : undefined}
                                                onAction={() => {
                                                    setActiveTab('order');
                                                    setIsModalOpen(true);
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    currentList.map((invoice: any, rowIndex: any) => (
                                        <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                                            <td {...getGridCellProps(rowIndex, 0)} data-label="Date" className="p-5 text-xs text-slate-500 dark:text-slate-400 outline-none"
                                            >
                                                {formatDate(invoice.createdAt)}
                                            </td>
                                            <td {...getGridCellProps(rowIndex, 1)} data-label="ID" className="p-5 text-xs font-bold text-slate-900 dark:text-white outline-none tracking-tight">{invoice.invoiceNumber || '-'}</td>
                                            <td {...getGridCellProps(rowIndex, 2)} data-label="Customer" className="p-5 text-xs font-medium text-slate-600 dark:text-slate-300 outline-none">{invoice.customerName || 'Unknown'}</td>
                                            <td {...getGridCellProps(rowIndex, 3)} data-label="Amount" className="p-5 text-xs font-bold text-slate-900 dark:text-white outline-none tracking-tight">{formatCurrency(invoice.grandTotal)}</td>
                                            <td {...getGridCellProps(rowIndex, 4)} data-label="Status" className="p-5 outline-none">
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                                    invoice.status === 'paid' || invoice.status === 'completed' 
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                        : invoice.status === 'pending' 
                                                            ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                )}>
                                                    {invoice.status?.toUpperCase()}
                                                </span>
                                            </td>
                                            {activeTab === 'return' && isZatcaEnabled && (
                                                <td className="p-5">
                                                    {invoice.zatcaStatus === 'REPORTED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                                                            <ShieldCheck size={12} /> Reported
                                                        </span>
                                                    ) : invoice.zatcaStatus === 'ERROR' ? (
                                                        <span 
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 cursor-help"
                                                            title={invoice.zatcaError || 'Validation Error'}
                                                        >
                                                            <ShieldAlert size={12} /> Error
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                            <Clock size={12} /> Pending
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td {...getGridCellProps(rowIndex, 5)} data-label="Actions" className="p-5 text-right flex flex-col items-end gap-3 outline-none">
                                                {activeTab === 'order' && invoice.status === 'pending' && (
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await db.transaction('rw', [db.invoices, db.items, db.customers], async () => {
                                                                    // Generate sequential invoice number
                                                                    const last = await db.invoices.orderBy('createdAt').last();
                                                                    let nextNum = 1;
                                                                    if (last && last.invoiceNumber) {
                                                                        const numStr = last.invoiceNumber.replace(/\D/g, '');
                                                                        const parsed = parseInt(numStr, 10);
                                                                        if (!isNaN(parsed)) nextNum = parsed + 1;
                                                                    }
                                                                    const convInvNumber = `${settings.invoicePrefix || 'INV-'}${nextNum.toString().padStart(3, '0')}`;

                                                                    // 1. Create New Invoice
                                                                    const newInvoice: Invoice = {
                                                                        ...invoice,
                                                                        ...createRecordMetadata(),
                                                                        branchId: activeBranchId || '',
                                                                        invoiceNumber: convInvNumber,
                                                                        type: 'invoice',
                                                                        status: 'pending',
                                                                        paymentStatus: 'pending',
                                                                        createdAt: new Date(),
                                                                        notes: `Converted from Order #${invoice.invoiceNumber}`
                                                                    };
                                                                    await db.invoices.add(newInvoice);

                                                                    // 2. Mark Order as Completed
                                                                    await db.invoices.update(invoice.id!, { status: 'completed' });

                                                                    // 3. Deduct Stock
                                                                    for (const item of invoice.items) {
                                                                        const dbItem = await db.items.get(item.itemId);
                                                                        if (dbItem) {
                                                                            await db.items.update(item.itemId, {
                                                                                stock: dbItem.stock - item.quantity
                                                                            });
                                                                        }
                                                                    }

                                                                    // 4. Update Customer Balance (Increase Debt)
                                                                    if (invoice.customerId) {
                                                                        const customer = await db.customers.get(invoice.customerId);
                                                                        if (customer) {
                                                                            await db.customers.update(invoice.customerId, {
                                                                                balance: (customer.balance || 0) + invoice.remainingAmount
                                                                            });
                                                                        }
                                                                    }
                                                                });

                                                                addToast(t('sales.converted'), 'success');
                                                            } catch (e) {
                                                                console.error(e);
                                                                addToast(t('sales.conversion_failed'), 'error');
                                                            }
                                                        }}
                                                        className="text-emerald-500 hover:text-emerald-600 transition-colors tooltip"
                                                        title={t('sales.convert_invoice')}
                                                    >
                                                        <RotateCcw size={16} className="rotate-180" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => printInvoice(invoice)}
                                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                                    title={t('common.print')}
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                {settings.cafeMode && invoice.status === 'pending' && activeTab === 'order' && (
                                                    <button
                                                        onClick={() => navigate('/pos', { state: { editInvoice: invoice } })}
                                                        className="text-blue-500 hover:text-blue-600 transition-colors"
                                                        title="Proceed to Payment"
                                                    >
                                                        <CreditCard size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'payment' && (
                    <div className="overflow-x-auto">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-end justify-between">
                            <div className="flex flex-wrap gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('sales.payment_method')}</label>
                                    <select
                                        className="p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                        value={paymentFilterMode}
                                        onChange={e => setPaymentFilterMode(e.target.value)}
                                    >
                                        <option value="all">{t('common.all', { defaultValue: 'All Types' })}</option>
                                        <option value="cash">{t('payment.cash', { defaultValue: 'Cash' })}</option>
                                        <option value="card">{t('payment.card', { defaultValue: 'Card' })}</option>
                                        <option value="upi">{t('payment.upi', { defaultValue: 'UPI' })}</option>
                                        <option value="bank_transfer">{t('payment.bank_transfer', { defaultValue: 'Bank Transfer' })}</option>
                                        <option value="split">{t('payment.split', { defaultValue: 'Split' })}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('common.date', { defaultValue: 'Date Filter' })}</label>
                                    <select
                                        className="p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                        value={paymentDateType}
                                        onChange={e => setPaymentDateType(e.target.value as any)}
                                    >
                                        <option value="all">{t('common.all_time', { defaultValue: 'All Time' })}</option>
                                        <option value="single">Single Date</option>
                                        <option value="range">Date Range</option>
                                    </select>
                                </div>
                                {paymentDateType !== 'all' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">{paymentDateType === 'range' ? 'Start Date' : 'Date'}</label>
                                        <input
                                            type="date"
                                            className="p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                            value={paymentStartDate}
                                            onChange={e => setPaymentStartDate(e.target.value)}
                                        />
                                    </div>
                                )}
                                {paymentDateType === 'range' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
                                        <input
                                            type="date"
                                            className="p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                            value={paymentEndDate}
                                            onChange={e => setPaymentEndDate(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={printPaymentReport}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600 font-medium transition-colors"
                                    title="Print Filtered Report"
                                >
                                    <Printer size={18} /> Print Report
                                </button>
                                <button
                                    onClick={() => setIsPaymentModalOpen(true)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 font-medium transition-colors"
                                >
                                    <Plus size={18} /> {t('sales.record_payment')}
                                </button>
                            </div>
                        </div>

                        {/* Summary Bar */}
                        <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex gap-6 overflow-x-auto">
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Amount</span>
                                <span className="text-lg font-bold text-slate-800 dark:text-white">{formatCurrency(paymentTotals.total)}</span>
                            </div>
                            {Object.entries(paymentTotals.byMethod).map(([method, amount]) => (
                                <div key={method} className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-6">
                                    <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">{method}</span>
                                    <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(amount as number)}</span>
                                </div>
                            ))}
                        </div>

                        <table className="w-full text-left whitespace-nowrap min-w-[600px] responsive-table">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-700/50">
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.date')} #</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.customer')}</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.amount')}</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.method')}</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('sales.reference')}</th>
                                    <th className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {!filteredPayments ? (
                                    Array.from({ length: 5 }).map((_: any, i: any) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-5"><Skeleton width={80} height={20} /></td>
                                            <td className="p-5"><Skeleton width={150} height={20} /></td>
                                            <td className="p-5"><Skeleton width={80} height={20} /></td>
                                            <td className="p-5"><Skeleton width={80} height={20} /></td>
                                            <td className="p-5"><Skeleton width={100} height={20} /></td>
                                            <td className="p-5"><Skeleton width={40} height={20} /></td>
                                        </tr>
                                    ))
                                ) : filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <EmptyState
                                                title={t('sales.no_payments')}
                                                description={t('sales.no_payments_desc', { defaultValue: "No payments recorded yet." })}
                                                icon={CreditCard}
                                                actionLabel={t('sales.record_payment')}
                                                onAction={() => setIsPaymentModalOpen(true)}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map((payment: any) => {
                                        const customer = customers?.find(c => c.id === payment.customerId);
                                        const custName = customer?.name || 'Unknown';
                                        return (
                                            <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                                                <td className="p-5 text-xs text-slate-500 dark:text-slate-400" data-label="Date">{formatDate(payment.date)}</td>
                                                <td className="p-5 text-xs font-bold text-slate-900 dark:text-white tracking-tight">{custName}</td>
                                                <td className="p-5 text-sm font-bold text-emerald-600 tracking-tight">+{formatCurrency(payment.amount)}</td>
                                                <td className="p-5 capitalize">
                                                    <span className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-full text-[9px] font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-800">
                                                        {payment.paymentMode}
                                                    </span>
                                                </td>
                                                <td className="p-5 text-slate-500 text-xs font-medium">{payment.reference || '-'}</td>
                                                <td className="p-5 text-right flex flex-col items-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => printPaymentReceipt(payment, custName)}
                                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors tooltip"
                                                        title="Print Receipt"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>



            {/* Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title={t('sales.record_payment')}
                maxWidth="md"
            >
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.customer')}</label>
                        <select
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            value={paymentCustomerId || ''}
                            onChange={e => setPaymentCustomerId(e.target.value)}
                        >
                            <option value="">{t('sales.select_customer')}</option>
                            {customers?.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.amount')}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">{settings.currency}</span>
                            <input
                                type="number"
                                className="w-full pl-8 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.payment_method')}</label>
                        <select
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as any)}
                        >
                            <option value="cash">{t('payment.cash') || "Cash"}</option>
                            <option value="card">{t('payment.card') || "Card"}</option>
                            <option value="upi">{t('payment.upi') || "UPI"}</option>
                            <option value="bank_transfer">{t('payment.bank_transfer') || "Bank Transfer"}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.reference')} (Optional)</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            placeholder={t('sales.reference_placeholder')}
                            value={paymentReference}
                            onChange={e => setPaymentReference(e.target.value)}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={async () => {
                                if (!paymentCustomerId || !paymentAmount) {
                                    addToast(t('sales.select_cust_amount_error'), 'error');
                                    return;
                                }
                                try {
                                    const amount = parseFloat(paymentAmount);
                                    await db.transaction('rw', [db.customerPayments, db.customers], async () => {
                                        // 1. Save Payment
                                        await db.customerPayments.add({
                                            ...createRecordMetadata(),
                                            branchId: activeBranchId || '',
                                            customerId: paymentCustomerId,
                                            amount: amount,
                                            date: new Date(),
                                            paymentMode: paymentMethod,
                                            reference: paymentReference
                                        });

                                        // 2. Update Customer Balance (Reduction in Debt)
                                        const customer = await db.customers.get(paymentCustomerId);
                                        if (customer) {
                                            await db.customers.update(paymentCustomerId, {
                                                balance: (customer.balance || 0) - amount
                                            });
                                        }
                                    });

                                    addToast(t('sales.payment_recorded'), 'success');
                                    setIsPaymentModalOpen(false);
                                    setPaymentAmount('');
                                    setPaymentCustomerId(undefined);
                                    setPaymentReference('');
                                } catch (e) {
                                    console.error(e);
                                    addToast(t('sales.error_payment'), 'error');
                                }
                            }}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            {t('sales.save_payment')}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Create/Edit Modal (Order/Return) */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={activeTab === 'order' ? t('sales.new_order') : t('sales.new_return')}
                maxWidth="5xl"
                className="h-[90vh]"
            >
                <div className="flex-1 overflow-hidden flex h-full">
                    {/* Left: Item Selector */}
                    <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('sales.select_items')}</h3>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder={t('common.search')}
                                    className="w-full pl-9 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setIsAddItemOpen(true)}
                                className="px-3 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 shrink-0 text-sm font-medium"
                                title={t('sales.add_new_item_tooltip') || "Add New Item to Inventory"}
                            >
                                <Plus size={16} /> {t('sales.new_item')}
                            </button>
                        </div>
                        <div
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto space-y-2"
                        >
                            {visibleItems?.map((item: any) => (
                                <button
                                    key={item.id}
                                    onClick={() => addToOrder(item)}
                                    className="w-full text-left p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors"
                                >
                                    <div className="flex justify-between">
                                        <span className="font-medium dark:text-white">{item.name}</span>
                                        <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                            {t('sales.stock')}: {item.stock}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{t('sales.price')}: {formatCurrency(item.salePrice)}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Form & Details */}
                    <div className="w-2/3 flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Customer & Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('sales.customer_name')}</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                        value={customerId || ''}
                                        onChange={e => {
                                            const id = e.target.value;
                                            const c = customers?.find(cus => cus.id === id);
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
                                        className="w-full p-2 mt-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white text-sm"
                                        value={customerName}
                                        onChange={e => {
                                            setCustomerName(e.target.value);
                                            setCustomerId(undefined);
                                        }}
                                        placeholder={t('sales.custom_name_placeholder')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('sales.date')}</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                        value={orderDate}
                                        onChange={e => setOrderDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">{t('sales.items_count')} ({items.length})</h3>
                                <div className="border rounded-lg divide-y dark:border-slate-700 dark:divide-slate-700">
                                    {items.map((item: any) => (
                                        <div key={item.itemId} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800">
                                            <div className="flex-1">
                                                <p className="font-medium dark:text-white text-sm">{item.name}</p>
                                            </div>
                                            <div className="w-20">
                                                <input
                                                    type="number"
                                                    className="w-full p-1 text-sm bg-slate-50 dark:bg-slate-900 border rounded text-center dark:text-white"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(item.itemId, 'quantity', parseFloat(e.target.value))}
                                                    placeholder={t('sales.qty')}
                                                />
                                            </div>
                                            <div className="w-24">
                                                <input
                                                    type="number"
                                                    className="w-full p-1 text-sm bg-slate-50 dark:bg-slate-900 border rounded text-right dark:text-white"
                                                    value={item.price}
                                                    onChange={e => updateItem(item.itemId, 'price', parseFloat(e.target.value))}
                                                    placeholder={t('sales.price')}
                                                />
                                            </div>
                                            <div className="w-24 text-right font-medium dark:text-white text-sm">
                                                {formatCurrency(item.total)}
                                            </div>
                                            <button
                                                onClick={() => removeItem(item.itemId)}
                                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {items.length === 0 && (
                                        <div className="p-4 md:p-8 text-center text-slate-400 text-sm">
                                            {t('sales.no_items_selected_msg')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg space-y-2">
                                <div className="flex justify-between text-lg font-bold dark:text-white">
                                    <span>{t('sales.total_amount')}</span>
                                    <span>{formatCurrency(totalAmount)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">{t('sales.notes')}</label>
                                <textarea
                                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white h-20"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder={t('sales.notes_placeholder')}
                                />
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Save size={18} />
                                {activeTab === 'order' ? t('sales.save_order') : t('sales.save_return')}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
            <QuickPaymentModal isOpen={isQuickPayModalOpen} onClose={() => setIsQuickPayModalOpen(false)} />
        </div>
        )}
        </>
    );
};

export default Sales;

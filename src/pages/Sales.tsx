import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, createRecordMetadata } from '../services/db';
import type { Invoice, InvoiceItem, Item } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, FileText, ShoppingCart, RotateCcw, DollarSign, Save, Printer, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../contexts/NotificationContext';
import { useSettings } from '../contexts/SettingsContext';
import Modal from '../components/UI/Modal';
import SalesHistory from './Transactions/SalesHistory';
import { useAuth } from '../contexts/AuthContext';

import { useGridNavigation } from '../hooks/useGridNavigation';
import { generateInvoicePDF } from '../services/invoiceGenerator';
import Skeleton from '../components/UI/Skeleton';
import EmptyState from '../components/UI/EmptyState';
import { Receipt, CreditCard } from 'lucide-react';

const Sales = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { addToast } = useNotification();
    const { formatCurrency, formatDate, settings } = useSettings();
    const { activeBranchId } = useAuth();
    const [activeTab, setActiveTab] = useState<'order' | 'invoice' | 'return' | 'payment'>('invoice');

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
    const stats = {
        orders: useLiveQuery(() => db.invoices.where('type').equals('order').count()) || 0,
        invoices: useLiveQuery(() => db.invoices.where('type').equals('invoice').count()) || 0,
        returns: useLiveQuery(() => db.invoices.where('type').equals('return').count()) || 0,
        payments: useLiveQuery(() => db.customerPayments.count()) || 0,
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

    // Inline Item Creation State
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemStock, setNewItemStock] = useState('');

    // Fetch Lists — branch-scoped with soft-delete filter
    const customers = useLiveQuery(() => db.customers.where('branchId').equals(activeBranchId).filter((c: any) => !c.deletedAt).toArray(), [activeBranchId]);
    const inventory = useLiveQuery(() => db.items.where('branchId').equals(activeBranchId).filter((i: any) => !i.deletedAt).toArray(), [activeBranchId]);

    // Derived Lists — use indexed 'type' field, branch-scoped, with deletedAt filter
    const currentList = useLiveQuery(async () => {
        return db.invoices
            .where('type')
            .equals(activeTab)
            .filter((inv: any) => !inv.deletedAt && inv.branchId === activeBranchId)
            .reverse()
            .sortBy('createdAt');
    }, [activeTab, activeBranchId]);

    // Grid Nav
    const { getGridCellProps } = useGridNavigation({
        rows: currentList?.length || 0,
        cols: 6
    });

    const paymentList = useLiveQuery(() => db.customerPayments.orderBy('date').reverse().toArray(), []);

    // Filtered Lists
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

    const totalAmount = items.reduce((sum: any, i: any) => sum + i.total, 0);

    const handleSave = async () => {
        if (!customerName || items.length === 0) {
            addToast(t('sales.required_error'), 'error');
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

        // Generate proper sequential invoice number (same logic as POS)
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
            paidAmount: 0,
            remainingAmount: totalGrand,
            paymentMode: 'split', // Default
            paymentStatus: activeTab === 'order' ? 'pending' : 'paid',
            createdAt: new Date(orderDate),
            type: activeTab as 'order' | 'return',
            status: activeTab === 'order' ? 'pending' : 'paid',
            notes
        };

        try {
            await db.transaction('rw', [db.invoices, db.items, db.customers], async () => {
                await db.invoices.add(invoiceData);

                if (activeTab === 'return') {
                    // 1. Increase Stock
                    for (const item of items) {
                        const dbItem = await db.items.get(item.itemId);
                        if (dbItem) {
                            await db.items.update(item.itemId, {
                                stock: dbItem.stock + item.quantity
                            });
                        }
                    }

                    // 2. Decrease Customer Balance (Credit Note)
                    // If customer exists, we reduce their 'balance' (Debt)
                    if (customerId) {
                        const customer = await db.customers.get(customerId);
                        if (customer) {
                            // Logic: Balance = What they owe us.
                            // Return means we owe them, or they owe us less.
                            // So Balance = Balance - ReturnAmount
                            await db.customers.update(customerId, {
                                balance: customer.balance - totalGrand
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
        <div className="space-y-6">


            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                        <ShoppingCart className="text-blue-600" />
                        {t('sales.title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('sales.description')}</p>
                </div>
                <div className="flex gap-2">

                    <button
                        onClick={() => {
                            setActiveTab('order');
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
                    >
                        <Plus size={20} /> {t('sales.new_order')}
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('return');
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg flex items-center gap-2 hover:bg-amber-700"
                    >
                        <RotateCcw size={20} /> {t('sales.create_return')}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-1">
                <button
                    onClick={() => setActiveTab('order')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'order'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <ShoppingCart size={18} /> {t('sales.orders')} ({stats.orders})
                </button>
                <button
                    onClick={() => setActiveTab('invoice')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'invoice'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <FileText size={18} /> {t('sales.invoices')} ({stats.invoices})
                </button>
                <button
                    onClick={() => setActiveTab('return')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'return'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <RotateCcw size={18} /> {t('sales.returns')} ({stats.returns})
                </button>
                <button
                    onClick={() => setActiveTab('payment')}
                    className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'payment'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                >
                    <DollarSign size={18} /> {t('sales.payments_in')} ({stats.payments})
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[400px] overflow-hidden">
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
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.date')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{activeTab === 'order' ? t('sales.order_no') : t('sales.return_no')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.customer')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.amount')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.status')}</th>
                                    {activeTab === 'return' && isZatcaEnabled && <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">ZATCA</th>}
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {!currentList ? (
                                    Array.from({ length: 5 }).map((_: any, i: any) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-4"><Skeleton width={100} height={20} /></td>
                                            <td className="p-4"><Skeleton width={120} height={20} /></td>
                                            <td className="p-4"><Skeleton width={150} height={20} /></td>
                                            <td className="p-4"><Skeleton width={80} height={20} /></td>
                                            <td className="p-4"><Skeleton width={80} height={20} /></td>
                                            <td className="p-4"><Skeleton width={60} height={30} /></td>
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
                                        <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td
                                                {...getGridCellProps(rowIndex, 0)}
                                                className="p-4 text-slate-600 dark:text-slate-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-l-lg"
                                            >
                                                {formatDate(invoice.createdAt)}
                                            </td>
                                            <td {...getGridCellProps(rowIndex, 1)} className="p-4 font-medium dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{invoice.invoiceNumber || '-'}</td>
                                            <td {...getGridCellProps(rowIndex, 2)} className="p-4 text-slate-600 dark:text-slate-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{invoice.customerName || 'Unknown'}</td>
                                            <td {...getGridCellProps(rowIndex, 3)} className="p-4 font-medium dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{formatCurrency(invoice.grandTotal)}</td>
                                            <td {...getGridCellProps(rowIndex, 4)} className="p-4 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoice.status === 'paid' || invoice.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    invoice.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {invoice.status?.toUpperCase()}
                                                </span>
                                            </td>
                                            {activeTab === 'return' && isZatcaEnabled && (
                                                <td className="p-4">
                                                    {invoice.zatcaStatus === 'REPORTED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                                            <ShieldCheck size={12} /> Reported
                                                        </span>
                                                    ) : invoice.zatcaStatus === 'ERROR' ? (
                                                        <span 
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 cursor-help"
                                                            title={invoice.zatcaError || 'Validation Error'}
                                                        >
                                                            <ShieldAlert size={12} /> Error
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600">
                                                            <Clock size={12} /> Pending
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td {...getGridCellProps(rowIndex, 5)} className="p-4 text-right flex justify-end gap-2 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-r-lg">
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
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg tooltip"
                                                        title={t('sales.convert_invoice')}
                                                    >
                                                        <RotateCcw size={18} className="rotate-180" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => printInvoice(invoice)}
                                                    className="p-2 text-slate-400 hover:text-slate-600"
                                                    title={t('common.print')}
                                                >
                                                    <Printer size={18} />
                                                </button>
                                                {settings.cafeMode && invoice.status === 'pending' && activeTab === 'order' && (
                                                    <button
                                                        onClick={() => navigate('/pos', { state: { editInvoice: invoice } })}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Proceed to Payment"
                                                    >
                                                        <CreditCard size={18} />
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
                        <div className="p-4 flex justify-end">
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700"
                            >
                                <Plus size={20} /> {t('sales.record_payment')}
                            </button>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.date')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.customer')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.amount')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.method')}</th>
                                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t('sales.reference')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {!paymentList ? (
                                    Array.from({ length: 5 }).map((_: any, i: any) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-4"><Skeleton width={80} height={20} /></td>
                                            <td className="p-4"><Skeleton width={150} height={20} /></td>
                                            <td className="p-4"><Skeleton width={80} height={20} /></td>
                                            <td className="p-4"><Skeleton width={80} height={20} /></td>
                                            <td className="p-4"><Skeleton width={100} height={20} /></td>
                                        </tr>
                                    ))
                                ) : paymentList.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <EmptyState
                                                title={t('sales.no_payments')}
                                                description={t('sales.no_payments_desc') || "No payments recorded yet."}
                                                icon={CreditCard}
                                                actionLabel={t('sales.record_payment')}
                                                onAction={() => setIsPaymentModalOpen(true)}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    paymentList.map((payment: any) => {
                                        const customer = customers?.find(c => c.id === payment.customerId);
                                        return (
                                            <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{formatDate(payment.date)}</td>
                                                <td className="p-4 font-medium dark:text-white">{customer?.name || 'Unknown'}</td>
                                                <td className="p-4 font-medium text-green-600">+{formatCurrency(payment.amount)}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400 capitalize">{payment.paymentMode}</td>
                                                <td className="p-4 text-slate-500 text-sm">{payment.reference || '-'}</td>
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
                                        <div className="p-8 text-center text-slate-400 text-sm">
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
            {/* Quick Add Item Modal */}
            <Modal
                isOpen={isAddItemOpen}
                onClose={() => setIsAddItemOpen(false)}
                title={t('sales.add_item_title')}
                maxWidth="md"
            >
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.item_name')}</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            placeholder={t('sales.item_name_placeholder')}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.purchase_cost')}</label>
                            <input
                                type="number"
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                value={newItemCost}
                                onChange={e => setNewItemCost(e.target.value)}
                                placeholder={t('common.placeholder_amount')}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.selling_price')}</label>
                            <input
                                type="number"
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                value={newItemPrice}
                                onChange={e => setNewItemPrice(e.target.value)}
                                placeholder={t('common.placeholder_amount')}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sales.initial_stock')}</label>
                        <input
                            type="number"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            value={newItemStock}
                            onChange={e => setNewItemStock(e.target.value)}
                            placeholder={t('common.placeholder_qty')}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsAddItemOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={async () => {
                                if (!newItemName.trim() || !newItemPrice) {
                                    addToast(t('sales.name_price_required'), 'error');
                                    return;
                                }
                                try {
                                    const price = parseFloat(newItemPrice);
                                    const cost = parseFloat(newItemCost) || 0;
                                    const stock = parseInt(newItemStock) || 0;

                                    const meta = createRecordMetadata();
                                    const id = await db.items.add({
                                        ...meta,
                                        branchId: activeBranchId || '',
                                        name: newItemName,
                                        purchasePrice: cost,
                                        salePrice: price,
                                        stock: stock,
                                        minStock: 5,
                                        taxType: 'exclusive',
                                        taxRate: 0,
                                        barcode: ''
                                    });

                                    // Add to current order list directly
                                    addToOrder({
                                        ...meta,
                                        branchId: activeBranchId || '',
                                        id: id as string,
                                        name: newItemName,
                                        purchasePrice: cost,
                                        stock: stock,
                                        salePrice: price,
                                        minStock: 5,
                                        taxType: 'exclusive',
                                        taxRate: 0,
                                        barcode: ''
                                    });

                                    setIsAddItemOpen(false);
                                    // Reset Form
                                    setNewItemName('');
                                    setNewItemCost('');
                                    setNewItemPrice('');
                                    setNewItemStock('');

                                    setNewItemStock('');

                                    addToast(t('sales.item_created'), 'success');
                                } catch (error) {
                                    console.error(error);
                                    addToast(t('sales.item_add_failed'), 'error');
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            {t('sales.create_add')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Sales;

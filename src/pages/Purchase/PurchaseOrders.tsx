

import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import type { Item, Purchase, PurchaseItem } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, Save, FileText, ShoppingCart, RotateCcw, Edit, CheckCircle, Printer, Download, ShieldOff, CreditCard, Eye } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../../components/UI/Modal';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import { useSettings } from '../../contexts/SettingsContext';
import { getPurchaseHTML, printPurchase } from '../../services/invoiceGenerator';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import ShareModal from '../../components/UI/ShareModal';
import { Send } from 'lucide-react';
import { useGridNavigation } from '../../hooks/useGridNavigation';

import PurchaseDetailsModal from '../../components/UI/PurchaseDetailsModal';

const PurchaseOrders = () => {
    const { addToast, addNotification } = useNotification();
    const { formatCurrency, formatDate, settings } = useSettings();
    const { hasPermission, isAdmin } = useAuth();
    const { t, i18n } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedOrderForShare, setSelectedOrderForShare] = useState<Purchase | null>(null);
    const [viewOrder, setViewOrder] = useState<Purchase | null>(null);

    if (!hasPermission('purchases_view')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('purchases.access_denied_msg')}</p>
            </div>
        );
    }

    // Tabs
    const [activeTab, setActiveTab] = useState<'bill' | 'order' | 'return'>('bill');

    // Form State
    // Form State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [originalPurchase, setOriginalPurchase] = useState<Purchase | null>(null); // For stock reversal
    const [editSupplierId, setEditSupplierId] = useState<number | undefined>(undefined); // Linked Supplier ID
    const [supplier, setSupplier] = useState(''); // Name for display
    const [orderNumber, setOrderNumber] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [orderItems, setOrderItems] = useState<PurchaseItem[]>([]);

    // Financials & Payment
    const [paidAmount, setPaidAmount] = useState<string>(''); // Advance Amt
    const [paymentType, setPaymentType] = useState('cash');
    const [notes, setNotes] = useState('');
    const [relatedOrderId, setRelatedOrderId] = useState<number | null>(null); // For linking

    // Inline Creation State
    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierPhone, setNewSupplierPhone] = useState('');

    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState(''); // Purchase Price
    const [newItemPrice, setNewItemPrice] = useState(''); // Selling Price
    const [newItemStock, setNewItemStock] = useState('');
    const [newItemTaxType, setNewItemTaxType] = useState('exclusive');
    const [newItemUnit, setNewItemUnit] = useState('');
    const [newItemTaxRate, setNewItemTaxRate] = useState(0); // Added for logic

    // Helper to get business details
    const getBusinessDetails = () => {
        const saved = localStorage.getItem('businessDetails');
        return saved ? JSON.parse(saved) : null;
    };

    // Global Tax State
    const [globalTax, setGlobalTax] = useState<{ name: string, rate: number } | null>(null);

    useEffect(() => {
        const details = getBusinessDetails();
        if (details?.taxRate && parseFloat(details.taxRate) > 0) {
            setGlobalTax({
                name: details.taxName || 'Tax',
                rate: parseFloat(details.taxRate)
            });
        }
    }, [isModalOpen]); // Refresh when modal opens

    const handlePrint = async (po: Purchase) => {
        try {
            await printPurchase(po, getBusinessDetails(), t, i18n.language);
            addToast(t('purchases.print_success'), 'success');
        } catch (error) {
            console.error(error);
            addToast(t('purchases.print_error'), 'error');
        }
    };

    const handleDownload = async (po: Purchase) => {
        const html = await getPurchaseHTML(po, getBusinessDetails());
        if (html && window.electron && window.electron.downloadPDF) {
            await window.electron.downloadPDF(html, `Purchase-${po.orderNumber}.pdf`);
            addToast(t('purchases.download_pdf'), 'success');
        } else {
            handlePrint(po); // Fallback
        }
    };


    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Fetch all purchases
    const purchases = useLiveQuery(() => db.purchases.orderBy('date').reverse().toArray(), []);
    const suppliers = useLiveQuery(() => db.suppliers.toArray(), []);

    // Filter by Tab & Date (Moved up for hook usage)
    const filteredPurchases = purchases?.filter(po => {
        // Filter by Type
        const poType = po.type || 'bill'; // Default to bill for migration
        if (poType !== activeTab) return false;

        // Date Filter
        if (startDate) {
            const poDate = new Date(po.date);
            const start = new Date(startDate);
            poDate.setHours(0, 0, 0, 0);
            start.setHours(0, 0, 0, 0);
            if (poDate < start) return false;
        }
        if (endDate) {
            const poDate = new Date(po.date);
            const end = new Date(endDate);
            poDate.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            if (poDate > end) return false;
        }
        return true;
    });

    // Grid Nav
    const { getGridCellProps } = useGridNavigation({
        rows: filteredPurchases?.length || 0,
        cols: 7 // Date, Ref, Supplier, Items, Total, Status, Actions
    });

    const inventoryItems = useLiveQuery(() => db.items.toArray(), []);

    const filteredInventory = inventoryItems?.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addToOrder = (item: Item) => {
        const existing = orderItems.find(i => i.itemId === item.id);
        if (existing) {
            setOrderItems(orderItems.map(i =>
                i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setOrderItems([...orderItems, {
                itemId: item.id!,
                name: item.name,
                quantity: 1,
                cost: item.purchasePrice,
                unit: item.unit,
                taxRate: item.taxRate,
                taxType: item.taxType
            }]);
        }
    };

    const updateOrderItem = (itemId: number, field: string, value: string | number) => {
        setOrderItems(orderItems.map(i =>
            i.itemId === itemId ? { ...i, [field]: value } : i
        ));
    };

    const removeOrderItem = (itemId: number) => {
        setOrderItems(orderItems.filter(i => i.itemId !== itemId));
    };

    // Calculate Totals
    const calculateTotals = (items: PurchaseItem[]) => {
        let subTotal = 0;
        let taxTotal = 0;
        let grandTotal = 0;

        items.forEach(item => {
            const qty = item.quantity;
            const cost = item.cost;
            const rate = item.taxRate || 0;
            const type = item.taxType || 'exclusive';

            let itemTax = 0;
            let itemTotal = 0;

            if (type === 'inclusive') {
                const basePrice = cost / (1 + rate / 100);
                itemTax = (cost - basePrice) * qty;
                itemTotal = cost * qty;
                subTotal += basePrice * qty;
            } else {
                itemTax = (cost * (rate / 100)) * qty;
                itemTotal = (cost * qty) + itemTax;
                subTotal += cost * qty;
            }

            taxTotal += itemTax;
            grandTotal += itemTotal;
        });

        return { subTotal, taxTotal, grandTotal };
    };

    const { subTotal, taxTotal, grandTotal: totalAmount } = calculateTotals(orderItems);
    const advance = parseFloat(paidAmount) || 0;
    const balanceDue = Math.max(0, totalAmount - advance);

    const resetForm = () => {
        setEditingId(null);
        setOriginalPurchase(null);
        setRelatedOrderId(null);
        setEditSupplierId(undefined);
        setSupplier('');
        setOrderNumber('');
        setOrderDate(new Date().toISOString().split('T')[0]);
        setDueDate('');
        setOrderItems([]);
        setPaidAmount('');
        setPaymentType('cash');
        setNotes('');
    };

    // Stock Helpers
    const applyStockEffect = async (items: PurchaseItem[], type: 'bill' | 'order' | 'return') => {
        if (type === 'order') return; // Orders don't affect stock

        for (const orderItem of items) {
            const item = await db.items.get(orderItem.itemId);
            if (item) {
                let newStock = item.stock;
                if (type === 'bill') {
                    newStock += orderItem.quantity;
                    // Update Cost Price only on new Bills
                    await db.items.update(item.id!, { stock: newStock, purchasePrice: orderItem.cost });
                } else if (type === 'return') {
                    newStock -= orderItem.quantity;
                    await db.items.update(item.id!, { stock: newStock });
                }
            }
        }
    };

    const revertStockEffect = async (purchase: Purchase) => {
        if (purchase.type === 'order') return;

        for (const orderItem of purchase.items) {
            const item = await db.items.get(orderItem.itemId);
            if (item) {
                let newStock = item.stock;
                // Reverse operation
                if (purchase.type === 'bill') {
                    newStock -= orderItem.quantity; // Remove added stock
                } else if (purchase.type === 'return') {
                    newStock += orderItem.quantity; // Add back returned stock
                }
                await db.items.update(item.id!, { stock: newStock });
            }
        }
    };


    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMode, setPaymentMode] = useState('cash');
    const [paymentNote, setPaymentNote] = useState('');
    const [selectedBillForPayment, setSelectedBillForPayment] = useState<Purchase | null>(null);

    const handleOpenPayment = (po: Purchase) => {
        const balance = po.totalAmount - (po.paidAmount || 0);
        setSelectedBillForPayment(po);
        setPaymentAmount(balance.toString());
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMode('cash');
        setPaymentNote('');
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = async () => {
        if (!selectedBillForPayment || !paymentAmount) return;

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            addToast(t('pos.invalid_amount'), 'error');
            return;
        }

        try {
            await db.transaction('rw', [db.purchases, db.purchasePayments, db.suppliers], async () => {
                // 1. Record Payment
                await db.purchasePayments.add({
                    purchaseId: selectedBillForPayment.id,
                    supplierId: selectedBillForPayment.supplierId!,
                    amount,
                    date: new Date(paymentDate),
                    paymentMode: paymentMode as any,
                    note: paymentNote
                });

                // 2. Update Purchase (Paid Amount & Status)
                const newPaidAmount = (selectedBillForPayment.paidAmount || 0) + amount;
                const newStatus = newPaidAmount >= selectedBillForPayment.totalAmount ? 'completed' : 'pending';

                await db.purchases.update(selectedBillForPayment.id!, {
                    paidAmount: newPaidAmount,
                    status: newStatus
                });

                // 3. Decrease Supplier Balance (We owe less)
                const supplier = await db.suppliers.get(selectedBillForPayment.supplierId!);
                if (supplier) {
                    await db.suppliers.update(supplier.id!, {
                        balance: supplier.balance - amount
                    });
                }
            });

            addToast(t('purchases.payment_recorded'), 'success');
            setIsPaymentModalOpen(false);
        } catch (error) {
            console.error(error);
            addToast(t('common.error'), 'error');
        }
    };

    const handleSavePurchase = async (closeModal: boolean = true) => {
        if (!supplier || orderItems.length === 0) {
            addToast(t('purchases.fill_supplier'), 'error');
            return;
        }

        // Prepare Items with calculated totals
        const processedItems = orderItems.map(item => {
            const qty = item.quantity;
            const cost = item.cost;
            const rate = item.taxRate || 0;
            const type = item.taxType || 'exclusive';

            let itemTax = 0;
            let itemTotal = 0;

            if (type === 'inclusive') {
                const basePrice = cost / (1 + rate / 100);
                itemTax = (cost - basePrice) * qty;
                itemTotal = cost * qty;
            } else {
                itemTax = (cost * (rate / 100)) * qty;
                itemTotal = (cost * qty) + itemTax;
            }

            return {
                ...item,
                taxAmount: itemTax,
                total: itemTotal
            };
        });

        const purchaseData: Purchase = {
            orderNumber: orderNumber || `${activeTab === 'bill' ? 'BILL' : activeTab === 'return' ? 'RET' : 'PO'}-${Date.now()}`,
            supplierName: supplier,
            items: processedItems,
            totalAmount,
            subTotal,
            taxAmount: taxTotal,
            date: new Date(orderDate),
            dueDate: dueDate ? new Date(dueDate) : undefined,
            paymentType: paymentType as 'cash' | 'card' | 'upi' | 'credit',
            paidAmount: advance,
            notes: notes,
            type: activeTab,
            status: activeTab === 'order' ? 'pending' : 'completed',
            relatedOrderId: relatedOrderId || undefined,
            supplierId: editSupplierId
        };

        try {
            await db.transaction('rw', [db.purchases, db.items, db.suppliers], async () => {
                if (editingId && originalPurchase) {
                    // EDIT MODE
                    await revertStockEffect(originalPurchase); // Revert old stock

                    // Revert Supplier Balance Effect of old purchase
                    if (originalPurchase.supplierId) {
                        const sup = await db.suppliers.get(originalPurchase.supplierId);
                        if (sup) {
                            // Calculate original net debt impact (Total - Paid)
                            const oldPaid = originalPurchase.paidAmount || 0;
                            const oldNet = originalPurchase.totalAmount - oldPaid;

                            // If Bill: We owed (Total-Paid). Revert = Subtract.
                            // If Return: We owed LESS (Total-Paid). Revert = Add (Subtract negative).
                            const oldEffect = originalPurchase.type === 'return' ? -oldNet : oldNet;

                            await db.suppliers.update(sup.id!, {
                                balance: sup.balance - oldEffect
                            });
                        }
                    }

                    await db.purchases.update(editingId, purchaseData as any);
                    await applyStockEffect(orderItems, activeTab); // Apply new stock

                    // Apply New Supplier Balance Effect
                    if (editSupplierId) {
                        const sup = await db.suppliers.get(editSupplierId);
                        if (sup) {
                            const newPaid = advance || 0;
                            const newNet = totalAmount - newPaid;
                            const newEffect = activeTab === 'return' ? -newNet : newNet;

                            await db.suppliers.update(sup.id!, {
                                balance: sup.balance + newEffect
                            });
                        }
                    }

                    addToast(t('purchases.updated'), 'success');
                } else {
                    // CREATE MODE
                    const id = await db.purchases.add(purchaseData);
                    await applyStockEffect(orderItems, activeTab);

                    // Update Supplier Balance
                    if (editSupplierId) {
                        const sup = await db.suppliers.get(editSupplierId);
                        if (sup) {
                            // Bill: We owe more (+). Return: We owe less (-).
                            // Order: No effect until received.
                            if (activeTab === 'bill') {
                                // If advanced paid, balance increases only by remaining? 
                                // Ideally: Balance + TotalAmount. Payment reduces it separately. 
                                // If we record 'paidAmount' here, we should treat it as immediate payment?
                                // Yes, let's treat 'advance' as payment.

                                await db.suppliers.update(sup.id!, {
                                    balance: sup.balance + totalAmount - advance
                                });
                            } else if (activeTab === 'return') {
                                await db.suppliers.update(sup.id!, {
                                    balance: sup.balance - totalAmount
                                });
                            }
                        }
                    }

                    // If this was a "Receive Order" action, update the original order status
                    if (relatedOrderId && activeTab === 'bill') {
                        await db.purchases.update(relatedOrderId, { status: 'completed' });
                    }

                    addToast(t('purchases.created'), 'success');
                    addNotification(t('purchases.created', { type: `${activeTab} #${purchaseData.orderNumber}` }), 'success', id);
                }
            });

            resetForm();
            if (closeModal) setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            addToast(t('common.error'), 'error');
        }
    };

    const [orderToDelete, setOrderToDelete] = useState<Purchase | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (po: Purchase) => {
        setOrderToDelete(po);
    };

    const handleConfirmDelete = async () => {
        if (orderToDelete && orderToDelete.id) {
            setIsDeleting(true);
            try {
                await revertStockEffect(orderToDelete); // Revert stock
                await db.purchases.delete(orderToDelete.id);
                addToast(t('purchases.record_deleted'), 'success');
            } catch (error) {
                console.error(error);
                addToast(t('common.error'), 'error');
            } finally {
                setIsDeleting(false);
                setOrderToDelete(null);
            }
        }
    };

    const handleEditPurchase = (po: Purchase) => {
        setEditingId(po.id!);
        setOriginalPurchase(po);
        setRelatedOrderId(po.relatedOrderId || null);
        setActiveTab(po.type || 'bill');

        setSupplier(po.supplierName);
        setEditSupplierId(po.supplierId);
        setOrderNumber(po.orderNumber);
        setOrderDate(new Date(po.date).toISOString().split('T')[0]);
        setDueDate(po.dueDate ? new Date(po.dueDate).toISOString().split('T')[0] : '');
        setOrderItems(po.items);
        setPaidAmount(po.paidAmount?.toString() || '');
        setPaymentType(po.paymentType || 'cash');
        setNotes(po.notes || '');

        setIsModalOpen(true);
    };

    const convertOrderToBill = (po: Purchase) => {
        resetForm();
        setRelatedOrderId(po.id!);
        setActiveTab('bill');

        setSupplier(po.supplierName);
        setOrderDate(new Date().toISOString().split('T')[0]); // New Date for Bill
        setOrderItems(po.items); // Copy items
        // Don't copy Order Number, let it generate a BILL number
        setIsModalOpen(true);
    };

    const createReturnFromBill = (po: Purchase) => {
        resetForm();
        setRelatedOrderId(po.id!);
        setActiveTab('return');

        setSupplier(po.supplierName);
        setOrderDate(new Date().toISOString().split('T')[0]);
        setOrderItems(po.items); // Start with all items, user triggers removals
        setNotes(`${t('purchases.return_for_bill')} ${po.orderNumber}`);
        setIsModalOpen(true);
    };


    // Tab Render Helper
    const TabButton = ({ id, label, icon: Icon }: { id: 'bill' | 'order' | 'return', label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-all relative ${activeTab === id
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
        >
            <Icon size={18} />
            {label}
            {activeTab === id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
            )}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold dark:text-white">{t('purchases.title')}</h1>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl px-2">
                <TabButton id="bill" label={t('purchases.bill')} icon={FileText} />
                <TabButton id="order" label={t('purchases.order')} icon={ShoppingCart} />
                <TabButton id="return" label={t('purchases.return')} icon={RotateCcw} />
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center">
                {hasPermission('purchases_manage') ? (
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors shadow-sm ${activeTab === 'return' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        <Plus size={20} />
                        {activeTab === 'bill' ? t('purchases.new_bill') : activeTab === 'return' ? t('purchases.new_return') : t('purchases.new_order')}
                    </button>
                ) : <div />}

                <div className="flex gap-3">
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400 pl-1">{t('purchases.from')}</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400 pl-1">{t('purchases.to')}</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-800 rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="p-4 font-medium">{t('purchases.date')}</th>
                            <th className="p-4 font-medium">{t('purchases.ref_no')}</th>
                            <th className="p-4 font-medium">{t('purchases.supplier')}</th>
                            <th className="p-4 font-medium">{t('purchases.items')}</th>
                            <th className="p-4 font-medium">{t('purchases.total')}</th>
                            <th className="p-4 font-medium">{activeTab === 'order' ? t('purchases.status') : t('purchases.balance')}</th>
                            <th className="p-4 font-medium text-right">{t('purchases.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredPurchases?.map((po, rowIndex) => {
                            const paid = po.paidAmount || 0;
                            const balance = po.totalAmount - paid;
                            return (
                                <tr key={po.id || po.orderNumber} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td {...getGridCellProps(rowIndex, 0)} className="p-4 dark:text-slate-300 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-l-lg">{formatDate(po.date)}</td>
                                    <td {...getGridCellProps(rowIndex, 1)} className="p-4 font-medium dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{po.orderNumber}</td>
                                    <td {...getGridCellProps(rowIndex, 2)} className="p-4 dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{po.supplierName}</td>
                                    <td {...getGridCellProps(rowIndex, 3)} className="p-4 dark:text-slate-300 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{t('purchases.item_count', { count: po.items.length })}</td>
                                    <td {...getGridCellProps(rowIndex, 4)} className={`p-4 font-bold outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 ${activeTab === 'return' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                                        {formatCurrency(po.totalAmount)}
                                    </td>
                                    <td {...getGridCellProps(rowIndex, 5)} className="p-4 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">
                                        {activeTab === 'order' ? (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${po.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {po.status === 'completed' ? t('purchases.status_completed') : t('purchases.status_pending')}
                                            </span>
                                        ) : (
                                            balance > 0.01 ?
                                                <span className="text-red-500 font-medium">{formatCurrency(balance)}</span> :
                                                <span className="text-green-500 font-medium">{t('purchases.settled')}</span>
                                        )}
                                    </td>
                                    <td {...getGridCellProps(rowIndex, 6)} className="p-4 text-right outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-r-lg">
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Action: View Details */}
                                            <button
                                                onClick={() => setViewOrder(po)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg tooltip"
                                                title={t('purchases.view_details')}
                                            >
                                                <Eye size={18} />
                                            </button>

                                            {/* Action: Receive Order */}
                                            {activeTab === 'order' && po.status !== 'completed' && (
                                                <button
                                                    onClick={() => convertOrderToBill(po)}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg tooltip"
                                                    title={t('purchases.tooltip_receive')}
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}

                                            {/* Action: Pay Bill */}
                                            {activeTab === 'bill' && balance > 0.01 && (
                                                <button
                                                    onClick={() => handleOpenPayment(po)}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                    title={t('purchases.tooltip_pay')}
                                                >
                                                    <CreditCard size={18} />
                                                </button>
                                            )}

                                            {/* Action: Return Bill */}
                                            {activeTab === 'bill' && (
                                                <button
                                                    onClick={() => createReturnFromBill(po)}
                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                                                    title={t('purchases.tooltip_return')}
                                                >
                                                    <RotateCcw size={18} />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handlePrint(po)}
                                                className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg"
                                                title={t('common.print')}
                                            >
                                                <Printer size={18} />
                                            </button>

                                            <button
                                                onClick={() => handleDownload(po)}
                                                className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg"
                                                title={t('purchases.tooltip_download')}
                                            >
                                                <Download size={18} />
                                            </button>

                                            {settings.enableSharing && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrderForShare(po);
                                                        setShareModalOpen(true);
                                                    }}
                                                    className="p-2 text-indigo-600 hover:bg-slate-100 dark:text-indigo-400 dark:hover:bg-slate-700 rounded-lg"
                                                    title="Share"
                                                >
                                                    <Send size={18} />
                                                </button>
                                            )}

                                            {hasPermission('purchases_manage') && (
                                                <>
                                                    <button
                                                        onClick={() => handleEditPurchase(po)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                        title={t('common.edit')}
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                </>
                                            )}

                                            {(isAdmin || hasPermission('purchases_manage')) && (
                                                <button
                                                    onClick={() => handleDeleteClick(po)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                    title={t('common.delete')}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {filteredPurchases?.length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">
                                {t('purchases.no_records')}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title={t('purchases.record_payment')}
                maxWidth="sm"
            >
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg flex justify-between items-center mb-4">
                        <span className="text-slate-500 dark:text-slate-400">{t('purchases.bill_amount')}</span>
                        <span className="font-bold dark:text-white">{formatCurrency(selectedBillForPayment?.totalAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 dark:text-slate-400">{t('purchases.balance_due')}</span>
                        <span className="font-bold text-red-500">{formatCurrency((selectedBillForPayment?.totalAmount || 0) - (selectedBillForPayment?.paidAmount || 0))}</span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.payment_amount')}</label>
                        <input
                            type="number"
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.payment_date')}</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={paymentDate}
                            onChange={e => setPaymentDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.payment_mode')}</label>
                        <select
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={paymentMode}
                            onChange={e => setPaymentMode(e.target.value)}
                        >
                            <option value="cash">{t('pos.pay_cash')}</option>
                            <option value="card">{t('pos.pay_card')}</option>
                            <option value="upi">{t('pos.pay_digital')}</option>
                            <option value="bank_transfer">{t('sales.bank_transfer')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.notes')}</label>
                        <textarea
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={paymentNote}
                            onChange={e => setPaymentNote(e.target.value)}
                            rows={2}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSavePayment}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            {t('purchases.save_payment')}
                        </button>
                    </div>
                </div>
            </Modal>

            <PurchaseDetailsModal
                isOpen={!!viewOrder}
                onClose={() => setViewOrder(null)}
                purchase={viewOrder}
            />

            {/* Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={activeTab === 'bill' ? t('purchases.new_bill') : activeTab === 'return' ? t('purchases.new_return') : t('purchases.new_order')}
                maxWidth="5xl"
                className="h-[90vh]"
            >
                <div className="flex-1 overflow-hidden flex h-full">
                    {/* Left: Item Selector */}
                    <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('purchases.select_items')}</h3>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder={t('purchases.search_placeholder')}
                                    className="w-full pl-9 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setIsAddItemOpen(true)}
                                className="px-3 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 shrink-0 text-sm font-medium"
                                title={t('inventory.add_item')}
                            >
                                <Plus size={16} /> {t('purchases.new_item')}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {filteredInventory?.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => addToOrder(item)}
                                    className="w-full text-left p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors"
                                >
                                    <div className="flex justify-between">
                                        <span className="font-medium dark:text-white">{item.name}</span>
                                        <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                            {t('inventory.stock')}: {item.stock}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{t('purchases.cost')}: {formatCurrency(item.purchasePrice)}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Form & Details */}
                    <div className="w-2/3 flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Top Row: Order No & Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('purchases.ref_no')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white font-medium"
                                        value={orderNumber}
                                        onChange={e => setOrderNumber(e.target.value)}
                                        placeholder={t('purchases.auto_generated')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('purchases.date')}</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                        value={orderDate}
                                        onChange={e => setOrderDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Party & Due Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('purchases.supplier_name')}</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                            value={editSupplierId || ''}
                                            onChange={e => {
                                                const id = Number(e.target.value);
                                                const s = suppliers?.find(sup => sup.id === id);
                                                setEditSupplierId(id);
                                                setSupplier(s ? s.name : '');
                                            }}
                                        >
                                            <option value="">{t('purchases.select_supplier')}</option>
                                            {suppliers?.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => setIsAddSupplierOpen(true)}
                                            className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 transaction-colors"
                                            title={t('purchases.add_supplier_tooltip')}
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full p-2 mt-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white text-sm"
                                        value={supplier}
                                        onChange={e => {
                                            setSupplier(e.target.value);
                                            setEditSupplierId(undefined); // Clear ID if manual typing
                                        }}
                                        placeholder={t('purchases.enter_supplier_name')}
                                    />
                                </div>
                                {activeTab !== 'return' && (
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('purchases.due_date')}</label>
                                        <input
                                            type="date"
                                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                            value={dueDate}
                                            onChange={e => setDueDate(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">{t('purchases.items_header', { count: orderItems.length })}</h3>

                                {/* Table Header */}
                                <div className="hidden md:flex gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-t-lg font-semibold text-xs text-slate-600 dark:text-slate-300">
                                    <div className="w-8 text-center">#</div>
                                    <div className="flex-1">Item Name</div>
                                    <div className="w-16 text-center">Unit</div>
                                    <div className="w-16 text-center">Qty</div>
                                    <div className="w-20 text-right">Cost</div>
                                    <div className="w-16 text-center">Tax %</div>
                                    <div className="w-20 text-right">Tax Amt</div>
                                    <div className="w-20 text-right">Total</div>
                                    <div className="w-6"></div>
                                </div>

                                <div className="border rounded-b-lg divide-y dark:border-slate-700 dark:divide-slate-700">
                                    {orderItems.map((item, index) => {
                                        // Calculate display total for the line item including tax
                                        const qty = item.quantity || 0;
                                        const cost = item.cost || 0;
                                        const taxRate = item.taxRate || 0;
                                        const taxType = item.taxType || 'exclusive';

                                        let lineTax = 0;
                                        let lineTotal = 0;

                                        if (taxType === 'inclusive') {
                                            const basePrice = cost / (1 + taxRate / 100);
                                            lineTax = (cost - basePrice) * qty;
                                            lineTotal = cost * qty;
                                        } else {
                                            lineTax = (cost * (taxRate / 100)) * qty;
                                            lineTotal = (cost * qty) + lineTax;
                                        }

                                        return (
                                            <div key={item.itemId} className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800">
                                                <div className="w-8 text-center text-slate-400 text-xs font-mono">{index + 1}</div>
                                                <div className="flex-1 min-w-[120px]">
                                                    <p className="font-medium dark:text-white text-sm truncate" title={item.name}>{item.name}</p>
                                                    <span className="text-[10px] text-slate-400 uppercase">{item.taxType}</span>
                                                </div>
                                                <div className="w-16">
                                                    <input
                                                        type="text"
                                                        className="w-full p-1 text-sm bg-slate-50 dark:bg-slate-900 border rounded text-center dark:text-white"
                                                        value={item.unit || ''}
                                                        onChange={e => updateOrderItem(item.itemId, 'unit', e.target.value)}
                                                        placeholder={t('purchases.unit')}
                                                    />
                                                </div>
                                                <div className="w-16">
                                                    <input
                                                        type="number"
                                                        className="w-full p-1 text-sm bg-slate-50 dark:bg-slate-900 border rounded text-center dark:text-white"
                                                        value={item.quantity}
                                                        onChange={e => updateOrderItem(item.itemId, 'quantity', parseFloat(e.target.value))}
                                                        placeholder={t('purchases.qty')}
                                                    />
                                                </div>
                                                <div className="w-20">
                                                    <input
                                                        type="number"
                                                        className="w-full p-1 text-sm bg-slate-50 dark:bg-slate-900 border rounded text-right dark:text-white"
                                                        value={item.cost}
                                                        onChange={e => updateOrderItem(item.itemId, 'cost', parseFloat(e.target.value))}
                                                        placeholder={t('purchases.cost')}
                                                    />
                                                </div>
                                                <div className="w-16">
                                                    <input
                                                        type="number"
                                                        className="w-full p-1 text-sm bg-slate-50 dark:bg-slate-900 border rounded text-center dark:text-white"
                                                        value={item.taxRate || 0}
                                                        onChange={e => updateOrderItem(item.itemId, 'taxRate', parseFloat(e.target.value))}
                                                        placeholder="Tax%"
                                                    />
                                                </div>
                                                <div className="w-20 text-right text-xs text-slate-500">
                                                    {formatCurrency(lineTax)}
                                                </div>
                                                <div className="w-20 text-right font-medium dark:text-white text-sm">
                                                    {formatCurrency(lineTotal)}
                                                </div>
                                                <div className="w-6 flex justify-center">
                                                    <button onClick={() => removeOrderItem(item.itemId)} className="text-red-500 hover:text-red-700">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {orderItems.length === 0 && (
                                        <div className="p-4 text-center text-slate-400 text-sm">{t('purchases.no_items_added')}</div>
                                    )}
                                </div>
                            </div>

                            {/* Financials & Payment */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4">
                                <div className="flex justify-between items-center text-lg font-bold">
                                    <span className="dark:text-white">{t('purchases.total_amount')}</span>
                                    <span className={activeTab === 'return' ? 'text-amber-600' : 'dark:text-white'}>
                                        {formatCurrency(totalAmount)}
                                    </span>
                                </div>

                                {/* Only show Payment for Bills. For Returns it implies refund/credit. For Orders it implies advance. */}
                                <div className="grid grid-cols-2 gap-4 items-center">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                        {activeTab === 'return' ? t('purchases.refund_received') : t('purchases.paid_amount')}
                                    </label>
                                    <input
                                        type="number"
                                        className="p-2 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-right"
                                        placeholder={t('common.placeholder_amount')}
                                        value={paidAmount}
                                        onChange={e => setPaidAmount(e.target.value)}
                                    />
                                </div>

                                <div className={`flex justify-between items-center font-bold ${activeTab === 'return' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    <span>{activeTab === 'return' ? t('purchases.balance_credit') : t('purchases.balance_due')}</span>
                                    <span>{formatCurrency(balanceDue)}</span>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium dark:text-slate-300">{t('purchases.payment_type')}</label>
                                    <select
                                        className="p-2 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                        value={paymentType}
                                        onChange={e => setPaymentType(e.target.value)}
                                    >
                                        <option value="cash">{t('pos.pay_cash')}</option>
                                        <option value="card">{t('pos.pay_card')}</option>
                                        <option value="upi">{t('pos.pay_digital')}</option>
                                        <option value="credit">{t('pos.pay_credit')}</option>
                                    </select>
                                </div>

                                <textarea
                                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white text-sm"
                                    rows={2}
                                    placeholder={t('purchases.notes')}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                ></textarea>
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between gap-4 shrink-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleSavePurchase(false)}
                                    className="px-6 py-2.5 rounded-xl font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {t('purchases.save_new')}
                                </button>
                                <button
                                    onClick={() => handleSavePurchase(true)}
                                    className={`px-8 py-2.5 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all transform active:scale-95 ${activeTab === 'return' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30' : 'bg-[#E11D48] hover:bg-[#BE123C] shadow-rose-500/30'
                                        }`}
                                >
                                    <Save size={18} /> {t('common.save')}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </Modal>



            <ConfirmationModal
                isOpen={!!orderToDelete}
                onClose={() => setOrderToDelete(null)}
                onConfirm={handleConfirmDelete}
                title={t('purchases.delete_title')}
                message={t('purchases.delete_confirm')}
                confirmText={t('common.delete')}
                variant="danger"
                isLoading={isDeleting}
            />

            {/* Quick Add Supplier Modal */}
            <Modal
                isOpen={isAddSupplierOpen}
                onClose={() => setIsAddSupplierOpen(false)}
                title={t('purchases.add_supplier_title')}
                maxWidth="md"
            >
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.supplier_name')}</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            value={newSupplierName}
                            onChange={e => setNewSupplierName(e.target.value)}
                            placeholder={t('purchases.enter_supplier_name')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.phone_number')}</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            value={newSupplierPhone}
                            onChange={e => setNewSupplierPhone(e.target.value)}
                            placeholder={t('purchases.enter_phone')}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsAddSupplierOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={async () => {
                                if (!newSupplierName.trim()) {
                                    addToast(t('purchases.supplier_required'), 'error');
                                    return;
                                }
                                try {
                                    const id = await db.suppliers.add({
                                        name: newSupplierName,
                                        phone: newSupplierPhone || '',
                                        email: '',
                                        location: '',
                                        taxNumber: '',
                                        balance: 0
                                    });
                                    setIsAddSupplierOpen(false);
                                    setNewSupplierName('');
                                    setNewSupplierPhone('');
                                    setEditSupplierId(Number(id));
                                    setSupplier(newSupplierName);
                                    setEditSupplierId(Number(id));
                                    setSupplier(newSupplierName);
                                    addToast(t('purchases.supplier_added'), 'success');
                                } catch (error) {
                                    console.error(error);
                                    addToast(t('purchases.supplier_add_failed'), 'error');
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            {t('purchases.save_select')}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Quick Add Item Modal */}
            <Modal
                isOpen={isAddItemOpen}
                onClose={() => setIsAddItemOpen(false)}
                title={t('purchases.add_item_title')}
                maxWidth="md"
            >
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.item_name_label')}</label>
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
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.cost_label')}</label>
                            <input
                                type="number"
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                value={newItemCost}
                                onChange={e => setNewItemCost(e.target.value)}
                                placeholder={t('common.placeholder_amount')}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.price_label')}</label>
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
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.initial_stock_label')}</label>
                        <input
                            type="number"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            value={newItemStock}
                            onChange={e => setNewItemStock(e.target.value)}
                            placeholder={t('common.placeholder_qty')}
                        />
                    </div>



                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.tax_status')}</label>
                            {globalTax ? (
                                <select
                                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                    value={newItemTaxRate === 0 ? 'none' : 'with'}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === 'none') {
                                            setNewItemTaxRate(0);
                                            setNewItemTaxType('exclusive');
                                        } else {
                                            setNewItemTaxRate(globalTax.rate);
                                            setNewItemTaxType('exclusive');
                                        }
                                    }}
                                >
                                    <option value="none">{t('inventory.tax_none', { name: globalTax.name })}</option>
                                    <option value="with">{t('inventory.tax_msg_with', { name: globalTax.name })}</option>
                                </select>
                            ) : (
                                <select
                                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                    value={newItemTaxType}
                                    onChange={e => setNewItemTaxType(e.target.value)}
                                >
                                    <option value="exclusive">{t('inventory.tax_exclusive')}</option>
                                    <option value="inclusive">{t('inventory.tax_inclusive')}</option>
                                </select>
                            )}
                        </div>
                        {globalTax && newItemTaxRate > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.tax_type')}</label>
                                <select
                                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                    value={newItemTaxType}
                                    onChange={e => setNewItemTaxType(e.target.value)}
                                >
                                    <option value="exclusive">{t('inventory.tax_exclusive')}</option>
                                    <option value="inclusive">{t('inventory.tax_inclusive')}</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.unit')}</label>
                            <input
                                type="text"
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                                value={newItemUnit}
                                onChange={e => setNewItemUnit(e.target.value)}
                                placeholder="e.g. pcs, kg"
                            />
                        </div>
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
                                if (!newItemName.trim() || !newItemCost) {
                                    addToast(t('purchases.name_cost_required'), 'error');
                                    return;
                                }
                                try {
                                    const cost = parseFloat(newItemCost);
                                    const stock = parseInt(newItemStock) || 0;

                                    // Add to DB
                                    const id = await db.items.add({
                                        name: newItemName,
                                        purchasePrice: cost,
                                        salePrice: parseFloat(newItemPrice) || cost,
                                        stock: stock,
                                        minStock: 5,
                                        taxType: newItemTaxType as 'inclusive' | 'exclusive',
                                        taxRate: newItemTaxRate,
                                        unit: newItemUnit,
                                        barcode: ''
                                    });

                                    // Add to current order list directly
                                    addToOrder({
                                        id: Number(id),
                                        name: newItemName,
                                        purchasePrice: cost,
                                        stock: stock,
                                        salePrice: parseFloat(newItemPrice) || cost,
                                        minStock: 5,
                                        taxType: newItemTaxType as 'inclusive' | 'exclusive',
                                        taxRate: newItemTaxRate,
                                        unit: newItemUnit,
                                        barcode: ''
                                    });

                                    setIsAddItemOpen(false);
                                    // Reset Form
                                    setNewItemName('');
                                    setNewItemCost('');
                                    setNewItemPrice('');
                                    setNewItemStock('');
                                    setNewItemUnit('');
                                    setNewItemTaxType('exclusive');
                                    setNewItemTaxRate(0);
                                    setNewItemTaxRate(0);

                                    addToast(t('purchases.item_created_msg'), 'success');
                                } catch (error) {
                                    console.error(error);
                                    addToast(t('sales.item_add_failed'), 'error');
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            {t('purchases.create_add')}
                        </button>
                    </div>
                </div>
            </Modal>
            {selectedOrderForShare && (
                <ShareModal
                    isOpen={shareModalOpen}
                    onClose={() => {
                        setShareModalOpen(false);
                        setSelectedOrderForShare(null);
                    }}
                    data={selectedOrderForShare}
                    type="purchase"
                />
            )}



        </div>
    );
};

export default PurchaseOrders;

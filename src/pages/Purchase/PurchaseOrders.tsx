

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type Item, type Purchase, type PurchaseItem, type SyncEntity, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, Save, FileText, ShoppingCart, RotateCcw, Edit, CheckCircle, Printer, Download, ShieldOff, CreditCard, Eye, ArrowLeft } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../../components/UI/Modal';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import { useSettings } from '../../contexts/SettingsContext';
import { getPurchaseHTML, printPurchase } from '../../services/invoiceGenerator';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import ShareModal from '../../components/UI/ShareModal';
import ItemForm from '../Inventory/ItemForm';
import { Send, Wand2, QrCode } from 'lucide-react';
import { useGridNavigation } from '../../hooks/useGridNavigation';
import BarcodeModal from '../Inventory/BarcodeModal';

import PurchaseDetailsModal from '../../components/UI/PurchaseDetailsModal';

const PurchaseOrders = () => {
    const navigate = useNavigate();
    const { addToast, addNotification } = useNotification();
    const { formatCurrency, formatDate, settings } = useSettings();
    const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();
    const { t, i18n } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedOrderForShare, setSelectedOrderForShare] = useState<Purchase | null>(null);
    const [viewOrder, setViewOrder] = useState<Purchase | null>(null);

    // Barcode Printing State
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [selectedItemsForLabel, setSelectedItemsForLabel] = useState<Item[] | null>(null);

    const [activeTab, setActiveTab] = useState<'bill' | 'order' | 'return'>('bill');

    // Form State
    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [originalPurchase, setOriginalPurchase] = useState<Purchase | null>(null); // For stock reversal
    const [editSupplierId, setEditSupplierId] = useState<string | undefined>(undefined); // Linked Supplier ID
    const [supplier, setSupplier] = useState(''); // Name for display
    const [orderNumber, setOrderNumber] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [orderItems, setOrderItems] = useState<PurchaseItem[]>([]);

    // Financials & Payment
    const [paidAmount, setPaidAmount] = useState<string>(''); // Advance Amt
    const [paymentType, setPaymentType] = useState('cash');
    const [notes, setNotes] = useState('');
    const [relatedOrderId, setRelatedOrderId] = useState<string | null>(null); // For linking

    // Inline Creation State
    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierPhone, setNewSupplierPhone] = useState('');
    const [newSupplierEmail, setNewSupplierEmail] = useState('');
    const [newSupplierTaxNumber, setNewSupplierTaxNumber] = useState('');
    const [newSupplierLocation, setNewSupplierLocation] = useState('');

    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemBarcode, setNewItemBarcode] = useState('');
    const [newItemCost, setNewItemCost] = useState(''); // Purchase Price
    const [newItemPrice, setNewItemPrice] = useState(''); // Selling Price
    const [newItemStock, setNewItemStock] = useState('');
    const [newItemTaxType, setNewItemTaxType] = useState('exclusive');
    const [newItemUnit, setNewItemUnit] = useState('');
    const [newItemTaxRate, setNewItemTaxRate] = useState(0); // Added for logic
    const [newItemCategoryId, setNewItemCategoryId] = useState('');

    const categories = useLiveQuery(() =>
        activeBranch?.isMaster ? db.categories.filter((c: any) => !c.deletedAt).toArray() : db.categories.where('branchId').equals(activeBranchId).filter((c: any) => !c.deletedAt).toArray(),
        [activeBranchId, activeBranch?.isMaster]
    );

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

    const handlePrintLabels = async (po: Purchase) => {
        try {
            const fullItems: Item[] = [];
            for (const pi of po.items) {
                const dbItem = await db.items.get(pi.itemId);
                const qty = Number(pi.quantity) || 1;
                const baseCost = Number(pi.cost) || (dbItem ? Number(dbItem.purchasePrice) : 0);
                let unitTotalPurchaseCost = baseCost;

                if (pi.taxType === 'exclusive') {
                    if (pi.total !== undefined && pi.total > 0 && qty > 0) {
                        unitTotalPurchaseCost = pi.total / qty;
                    } else if (pi.taxAmount !== undefined && pi.taxAmount > 0 && qty > 0) {
                        unitTotalPurchaseCost = baseCost + (pi.taxAmount / qty);
                    } else if (pi.taxRate && pi.taxRate > 0) {
                        unitTotalPurchaseCost = baseCost * (1 + pi.taxRate / 100);
                    }
                }

                unitTotalPurchaseCost = Math.round(unitTotalPurchaseCost * 100) / 100;

                if (dbItem) {
                    // Override stock with the purchased quantity and purchasePrice with unit total purchase cost
                    fullItems.push({ 
                        ...dbItem,
                        salePrice: dbItem.salePrice,
                        purchasePrice: unitTotalPurchaseCost,
                        stock: qty, 
                        supplierNameFallback: po.supplierName 
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
                        supplierNameFallback: po.supplierName
                    } as any);
                }
            }
            if (fullItems.length > 0) {
                setSelectedItemsForLabel(fullItems);
                setIsLabelModalOpen(true);
            } else {
                addToast(t('inventory.no_items_found') || 'No items found to print', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast(t('common.error'), 'error');
        }
    };


    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Fetch all purchases
    const purchases = useLiveQuery(() => activeBranch?.isMaster ? db.purchases.reverse().sortBy('date') : db.purchases.where('branchId').equals(activeBranchId).reverse().sortBy('date'), [activeBranchId, activeBranch?.isMaster]);
    const suppliers = useLiveQuery(() => activeBranch?.isMaster ? db.suppliers.filter((s: any) => !s.deletedAt).toArray() : db.suppliers.where('branchId').equals(activeBranchId).filter((s: any) => !s.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]);

    // Filter by Tab & Date (Moved up for hook usage)
    const filteredPurchases = purchases?.filter((po: any) => {
        // Filter by Type
        const poType = po.type || 'bill'; // Default to bill for migration
        if (poType !== activeTab) return false;

        // Date Filter
        if (startDate) {
            const poDate = new Date(po.date);
            const start = new Date(startDate);
            if (poDate < start) return false;
        }
        if (endDate) {
            const poDate = new Date(po.date);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // M18 Fix
            if (poDate > end) return false;
        }
        return true;
    });

    // Grid Nav
    const { getGridCellProps } = useGridNavigation({
        rows: filteredPurchases?.length || 0,
        cols: 7 // Date, Ref, Supplier, Items, Total, Status, Actions
    });

    const inventoryItems = useLiveQuery(() => activeBranch?.isMaster ? db.items.filter((i: any) => !i.deletedAt).toArray() : db.items.where('branchId').equals(activeBranchId).filter((i: any) => !i.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]);

    const filteredInventory = inventoryItems?.filter((i: any) =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addToOrder = (item: Item) => {
        const existing = orderItems.find(i => i.itemId === item.id);
        if (existing) {
            setOrderItems(orderItems.map((i: any) =>
                i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            // H18 Fix: Preserve 0% tax rate if specified
            const defaultTaxRate = item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : 15;

            setOrderItems([...orderItems, {
                itemId: item.id!,
                name: item.name,
                quantity: 1,
                cost: item.purchasePrice,
                unit: item.unit,
                taxRate: defaultTaxRate,
                taxType: item.taxType || 'exclusive'
            }]);
        }
    };

    const updateOrderItem = (itemId: string, field: string, value: string | number) => {
        setOrderItems(orderItems.map((i: any) =>
            i.itemId === itemId ? { ...i, [field]: value } : i
        ));
    };

    const removeOrderItem = (itemId: string) => {
        setOrderItems(orderItems.filter((i: any) => i.itemId !== itemId));
    };

    // Calculate Totals
    const calculateTotals = (items: PurchaseItem[]) => {
        let subTotalSum = 0;
        let taxTotalSum = 0;
        let grandTotalSum = 0;

        items.forEach((item: any) => {
            const qty = item.quantity;
            const cost = item.cost;
            const rate = item.taxRate || 0;
            const type = item.taxType || 'exclusive';

            let lineTax = 0;
            let lineTotal = 0;

            if (settings.applyTax) {
                if (type === 'inclusive') {
                    const basePrice = cost / (1 + rate / 100);
                    lineTax = Math.round(((cost - basePrice) * qty) * 100) / 100;
                    lineTotal = Math.round((cost * qty) * 100) / 100;
                    subTotalSum += Math.round((basePrice * qty) * 100) / 100;
                } else {
                    lineTax = Math.round(((cost * (rate / 100)) * qty) * 100) / 100;
                    lineTotal = Math.round(((cost * qty) + lineTax) * 100) / 100;
                    subTotalSum += Math.round((cost * qty) * 100) / 100;
                }
            } else {
                lineTax = 0;
                lineTotal = Math.round((cost * qty) * 100) / 100;
                subTotalSum += lineTotal;
            }

            taxTotalSum += lineTax;
            grandTotalSum += lineTotal;
        });

        return { subTotal: subTotalSum, taxTotal: taxTotalSum, grandTotal: grandTotalSum };
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
    const applyStockEffect = async (items: PurchaseItem[], type: 'bill' | 'order' | 'return', currentSupplierId?: string) => {
        if (type === 'order') return; // Orders don't affect stock

        for (const orderItem of items) {
            const item = await db.items.get(orderItem.itemId);
            if (item) {
                let newStock = item.stock;
                if (type === 'bill') {
                    newStock += orderItem.quantity;
                    // Update Cost Price and Supplier only on new Bills
                    await db.items.update(item.id!, { 
                        ...updateRecordMetadata(),
                        stock: newStock, 
                        purchasePrice: orderItem.cost,
                        ...(currentSupplierId && !item.supplierId ? { supplierId: currentSupplierId } : {})
                    });
                } else if (type === 'return') {
                    newStock -= orderItem.quantity;
                    await db.items.update(item.id!, { 
                        ...updateRecordMetadata(),
                        stock: newStock 
                    });
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
                    ...createRecordMetadata(),
                    purchaseId: selectedBillForPayment.id,
                    supplierId: selectedBillForPayment.supplierId!,
                    amount,
                    date: new Date(paymentDate),
                    paymentMode: paymentMode as any,
                    note: paymentNote,
                    reference: selectedBillForPayment.orderNumber
                });

                // 2. Update Purchase (Paid Amount & Status)
                const newPaidAmount = (selectedBillForPayment.paidAmount || 0) + amount;
                const newStatus = newPaidAmount >= selectedBillForPayment.totalAmount ? 'completed' : 'pending';

                await db.purchases.update(selectedBillForPayment.id!, {
                    ...updateRecordMetadata(),
                    paidAmount: newPaidAmount,
                    status: newStatus
                });

                // 3. Decrease Supplier Balance (We owe less)
                const supplier = await db.suppliers.get(selectedBillForPayment.supplierId!);
                if (supplier) {
                    await db.suppliers.update(supplier.id!, {
                        ...updateRecordMetadata(),
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
        const processedItems = orderItems.map((item: any) => {
            const qty = item.quantity;
            const cost = item.cost;
            const rate = item.taxRate || 0;
            const type = item.taxType || 'exclusive';

            let lineBeforeVat = 0;
            let lineTax = 0;
            let lineTotal = 0;

            if (settings.applyTax) {
                if (type === 'inclusive') {
                    const basePrice = cost / (1 + rate / 100);
                    lineBeforeVat = Math.round((basePrice * qty) * 100) / 100;
                    lineTax = Math.round(((cost - basePrice) * qty) * 100) / 100;
                    lineTotal = Math.round((cost * qty) * 100) / 100;
                } else {
                    lineBeforeVat = Math.round((cost * qty) * 100) / 100;
                    lineTax = Math.round(((cost * (rate / 100)) * qty) * 100) / 100;
                    lineTotal = Math.round((lineBeforeVat + lineTax) * 100) / 100;
                }
            } else {
                lineBeforeVat = Math.round((cost * qty) * 100) / 100;
                lineTax = 0;
                lineTotal = lineBeforeVat;
            }

            return {
                ...item,
                subtotalBeforeTax: lineBeforeVat,
                taxAmount: lineTax,
                total: lineTotal
            };
        });

        const purchaseData: Omit<Purchase, keyof SyncEntity | 'id'> = {
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
                                ...updateRecordMetadata(),
                                balance: sup.balance - oldEffect
                            });
                        }
                    }

                    await db.purchases.update(editingId, { ...purchaseData, ...updateRecordMetadata() } as any);
                    await applyStockEffect(orderItems, activeTab, editSupplierId); // Apply new stock

                    // Apply New Supplier Balance Effect
                    if (editSupplierId) {
                        const sup = await db.suppliers.get(editSupplierId);
                        if (sup) {
                            const newPaid = advance || 0;
                            const newNet = totalAmount - newPaid;
                            const newEffect = activeTab === 'return' ? -newNet : newNet;

                            await db.suppliers.update(sup.id!, {
                                ...updateRecordMetadata(),
                                balance: sup.balance + newEffect
                            });
                        }
                    }

                    addToast(t('purchases.updated'), 'success');
                } else {
                    // CREATE MODE
                    const id = await db.purchases.add({ ...purchaseData, ...createRecordMetadata() } as Purchase);
                    await applyStockEffect(orderItems, activeTab, editSupplierId);

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
                                    ...updateRecordMetadata(),
                                    balance: sup.balance + totalAmount - advance
                                });
                            } else if (activeTab === 'return') {
                                await db.suppliers.update(sup.id!, {
                                    ...updateRecordMetadata(),
                                    balance: sup.balance - totalAmount
                                });
                            }
                        }
                    }

                    // If this was a "Receive Order" action, update the original order status
                    if (relatedOrderId && activeTab === 'bill') {
                        await db.purchases.update(relatedOrderId, { 
                            ...updateRecordMetadata(),
                            status: 'completed' 
                        });
                    }

                    const label = activeTab === 'bill' ? t('purchases.new_bill') : activeTab === 'return' ? t('purchases.new_return') : t('purchases.new_order');
                    addToast(t('purchases.created', { type: label }) || 'Purchase bill added successfully', 'success');
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
                await db.transaction('rw', [db.purchases, db.purchasePayments, db.suppliers, db.items], async () => {
                    // 1. Revert stock
                    await revertStockEffect(orderToDelete);

                    // 2. Revert supplier balance
                    if (orderToDelete.supplierId && (orderToDelete.type === 'bill' || orderToDelete.type === 'return' || !orderToDelete.type)) {
                        const sup = await db.suppliers.get(orderToDelete.supplierId);
                        if (sup) {
                            const paidAtCreation = orderToDelete.paidAmount || 0;
                            // Sum any separate payments recorded against this purchase
                            const relatedPayments = await db.purchasePayments.where('purchaseId').equals(orderToDelete.id!).toArray();
                            const totalSeparatePayments = relatedPayments.reduce((s: number, p: any) => s + p.amount, 0);

                            // Net balance effect this purchase had on supplier:
                            // bill: +(totalAmount - paidAtCreation - separatePayments)
                            // return: -(totalAmount)
                            let netEffect = 0;
                            if (!orderToDelete.type || orderToDelete.type === 'bill') {
                                netEffect = orderToDelete.totalAmount - paidAtCreation - totalSeparatePayments;
                            } else if (orderToDelete.type === 'return') {
                                netEffect = -orderToDelete.totalAmount;
                            }

                            await db.suppliers.update(sup.id!, {
                                ...updateRecordMetadata(),
                                balance: Math.max(0, (sup.balance || 0) - netEffect)
                            });
                        }
                    }

                    // 3. Delete associated payment records
                    const paymentKeys = await db.purchasePayments.where('purchaseId').equals(orderToDelete.id!).primaryKeys();
                    if (paymentKeys.length > 0) {
                        await db.purchasePayments.bulkDelete(paymentKeys as string[]);
                    }

                    // 4. Delete the purchase
                    await db.purchases.delete(orderToDelete.id!);
                });

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

    if (!hasPermission('purchases_view')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('purchases.access_denied_msg')}</p>
            </div>
        );
    }

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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold dark:text-white">{t('purchases.title')}</h1>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl px-2 overflow-x-auto custom-scrollbar">
                <TabButton id="bill" label={t('purchases.bill')} icon={FileText} />
                <TabButton id="order" label={t('purchases.order')} icon={ShoppingCart} />
                <TabButton id="return" label={t('purchases.return')} icon={RotateCcw} />
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {hasPermission('purchases_add') ? (
                    <button
                        onClick={() => navigate(`/purchase/new?type=${activeTab}`)}
                        className={`flex items-center justify-center w-full sm:w-auto gap-2 text-white px-4 py-2 rounded-lg transition-colors shadow-sm ${activeTab === 'return' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        <Plus size={20} />
                        {activeTab === 'bill' ? t('purchases.new_bill') : activeTab === 'return' ? t('purchases.new_return') : t('purchases.new_order')}
                    </button>
                ) : <div />}

                <div className="flex gap-3 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1">
                    <div className="flex flex-col flex-1 sm:flex-none">
                        <label className="text-[10px] uppercase font-bold text-slate-400 pl-1">{t('purchases.from')}</label>
                        <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                        />
                    </div>
                    <div className="flex flex-col flex-1 sm:flex-none">
                        <label className="text-[10px] uppercase font-bold text-slate-400 pl-1">{t('purchases.to')}</label>
                        <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-800 rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap min-w-[900px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="p-4 font-semibold">{t('purchases.date')}</th>
                            <th className="p-4 font-semibold">{t('purchases.ref_no')}</th>
                            <th className="p-4 font-semibold">{t('purchases.supplier')}</th>
                            <th className="p-4 font-semibold">{t('purchases.items')}</th>
                            <th className="p-4 font-semibold">{t('purchases.total')}</th>
                            <th className="p-4 font-semibold">{activeTab === 'order' ? t('purchases.status') : t('purchases.balance')}</th>
                            <th className="p-4 font-semibold text-right">{t('purchases.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredPurchases?.map((po: any, rowIndex: any) => {
                            const paid = po.paidAmount || 0;
                            const balance = po.totalAmount - paid;
                            return (
                                <tr key={po.id || po.orderNumber} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group">
                                    <td {...getGridCellProps(rowIndex, 0)} className="p-4 dark:text-slate-300 text-sm outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-l-md">{formatDate(po.date)}</td>
                                    <td {...getGridCellProps(rowIndex, 1)} className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{po.orderNumber}</td>
                                    <td {...getGridCellProps(rowIndex, 2)} className="p-4 font-medium dark:text-white text-sm outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{po.supplierName}</td>
                                    <td {...getGridCellProps(rowIndex, 3)} className="p-4 dark:text-slate-300 text-sm outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">{t('purchases.item_count', { count: po.items.length })}</td>
                                    <td {...getGridCellProps(rowIndex, 4)} className={`p-4 font-bold text-sm outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 ${activeTab === 'return' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                                        {formatCurrency(po.totalAmount)}
                                    </td>
                                    <td {...getGridCellProps(rowIndex, 5)} className="p-4 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500">
                                        {activeTab === 'order' ? (
                                            <span className={`px-2 py-1.5 border rounded-md text-xs font-semibold uppercase ${po.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                                                }`}>
                                                {po.status === 'completed' ? t('purchases.status_completed') : t('purchases.status_pending')}
                                            </span>
                                        ) : (
                                            balance > 0.01 ?
                                                <span className="text-red-500 dark:text-red-400 font-semibold text-sm">{formatCurrency(balance)}</span> :
                                                <span className="text-green-600 dark:text-green-400 font-semibold text-sm">{t('purchases.settled')}</span>
                                        )}
                                    </td>
                                    <td {...getGridCellProps(rowIndex, 6)} className="p-4 text-right outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-inset focus:ring-2 focus:ring-blue-500 rounded-r-md">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
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

                                            {activeTab === 'bill' && (
                                                <button
                                                    onClick={() => handlePrintLabels(po)}
                                                    className="p-2 text-indigo-600 hover:bg-slate-100 dark:text-indigo-400 dark:hover:bg-slate-700 rounded-lg"
                                                    title={t('inventory.print_label') || 'Print Labels'}
                                                >
                                                    <QrCode size={18} />
                                                </button>
                                            )}

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

                                            {hasPermission('purchases_edit') && (
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

                                            {(isAdmin || hasPermission('purchases_delete')) && (
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
                            <tr><td colSpan={7} className="p-4 md:p-8 text-center text-slate-500">
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

            <BarcodeModal
                isOpen={isLabelModalOpen}
                onClose={() => setIsLabelModalOpen(false)}
                items={selectedItemsForLabel}
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
                            {filteredInventory?.map((item: any) => (
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
                                                const id = e.target.value;
                                                const s = suppliers?.find(sup => sup.id === id);
                                                setEditSupplierId(id);
                                                setSupplier(s ? s.name : '');
                                            }}
                                        >
                                            <option value="">{t('purchases.select_supplier')}</option>
                                            {suppliers?.map((s: any) => (
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

                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                                    <table className="w-full text-left whitespace-nowrap min-w-[900px]">
                                        <thead className="bg-slate-50 dark:bg-slate-700/80 font-semibold text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-3 py-3 text-center w-12">#</th>
                                                <th className="px-3 py-3">{t('purchases.item_name') || 'Item Name'}</th>
                                                <th className="px-3 py-3 text-center w-24">{t('purchases.unit') || 'Unit'}</th>
                                                <th className="px-3 py-3 text-center w-24">{t('purchases.qty') || 'Qty'}</th>
                                                <th className="px-3 py-3 text-right w-28">{t('purchases.cost') || 'Cost'}</th>
                                                <th className="px-3 py-3 text-center w-24">Tax %</th>
                                                <th className="px-3 py-3 text-right w-28">{t('purchases.before_vat_amount')}</th>
                                                <th className="px-3 py-3 text-right w-28">{t('purchases.vat_amount')}</th>
                                                <th className="px-3 py-3 text-right w-36">{t('purchases.total_with_vat')}</th>
                                                <th className="px-3 py-3 text-center w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {orderItems.map((item: any, index: any) => {
                                                // Calculate display total for the line item including tax
                                                const qty = item.quantity || 0;
                                                const cost = item.cost || 0;
                                                const taxRate = item.taxRate || 0;
                                                const taxType = item.taxType || 'exclusive';

                                                let lineBeforeVat = 0;
                                                let lineTax = 0;
                                                let lineTotal = 0;

                                                if (taxType === 'inclusive') {
                                                    const basePrice = cost / (1 + taxRate / 100);
                                                    lineBeforeVat = basePrice * qty;
                                                    lineTax = (cost - basePrice) * qty;
                                                    lineTotal = cost * qty;
                                                } else {
                                                    lineBeforeVat = cost * qty;
                                                    lineTax = (cost * (taxRate / 100)) * qty;
                                                    lineTotal = lineBeforeVat + lineTax;
                                                }

                                                return (
                                                    <tr key={item.itemId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group">
                                                        <td className="px-3 py-2 text-center text-slate-400 text-xs font-mono">{index + 1}</td>
                                                        <td className="px-3 py-2">
                                                            <p className="font-medium dark:text-white text-sm truncate max-w-[200px]" title={item.name}>{item.name}</p>
                                                            <span className="text-[10px] text-slate-400 uppercase">{item.taxType}</span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="text"
                                                                className="w-full min-w-[60px] p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md text-center dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-shadow"
                                                                value={item.unit || ''}
                                                                onChange={e => updateOrderItem(item.itemId, 'unit', e.target.value)}
                                                                placeholder={t('purchases.unit')}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                className="w-full min-w-[60px] p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md text-center dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-shadow"
                                                                value={item.quantity}
                                                                onChange={e => updateOrderItem(item.itemId, 'quantity', parseFloat(e.target.value))}
                                                                placeholder={t('purchases.qty')}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                className="w-full min-w-[70px] p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md text-right dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-shadow font-medium"
                                                                value={item.cost}
                                                                onChange={e => updateOrderItem(item.itemId, 'cost', parseFloat(e.target.value))}
                                                                placeholder={t('purchases.cost')}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                className="w-full min-w-[60px] p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md text-center dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-shadow"
                                                                value={item.taxRate || 0}
                                                                onChange={e => updateOrderItem(item.itemId, 'taxRate', parseFloat(e.target.value))}
                                                                placeholder="Tax%"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs text-slate-600 dark:text-slate-300 font-medium w-28">
                                                            {formatCurrency(lineBeforeVat)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs text-slate-600 dark:text-slate-300 font-medium w-28">
                                                            {formatCurrency(lineTax)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium dark:text-white text-sm bg-slate-50/50 dark:bg-slate-800/30 group-hover:bg-transparent transition-colors w-36">
                                                            {formatCurrency(lineTotal)}
                                                        </td>
                                                        <td className="px-3 py-2 text-center w-12">
                                                            <button onClick={() => removeOrderItem(item.itemId)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                            {orderItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={9} className="p-10 text-center text-slate-400">
                                                        <div className="flex flex-col items-center justify-center space-y-3">
                                                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                                                                <ShoppingCart size={24} className="text-slate-400 dark:text-slate-500" />
                                                            </div>
                                                            <span className="text-sm font-medium">{t('purchases.no_items_added')}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Financials & Payment */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5 mt-4">
                                <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700/70 border-dashed">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase text-xs sm:text-sm">{t('purchases.total_amount')}</span>
                                    <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${activeTab === 'return' ? 'text-amber-600' : 'text-slate-800 dark:text-white'}`}>
                                        {formatCurrency(totalAmount)}
                                    </span>
                                </div>

                                {/* Only show Payment for Bills. For Returns it implies refund/credit. For Orders it implies advance. */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 items-center">
                                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                        {activeTab === 'return' ? t('purchases.refund_received') : t('purchases.paid_amount')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full py-2.5 px-3 rounded-lg border border-slate-300 dark:bg-slate-900 dark:border-slate-600 dark:text-white text-right sm:text-lg font-medium shadow-inner focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                            placeholder={t('common.placeholder_amount')}
                                            value={paidAmount}
                                            onChange={e => setPaidAmount(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className={`flex justify-between items-center font-bold px-4 py-3.5 rounded-lg shadow-sm border ${activeTab === 'return'
                                    ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/50 dark:text-amber-400'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700/50 dark:text-emerald-400'
                                    }`}>
                                    <span className="text-sm uppercase tracking-wider">{activeTab === 'return' ? t('purchases.balance_credit') : t('purchases.balance_due')}</span>
                                    <span className="text-lg sm:text-xl">{formatCurrency(balanceDue)}</span>
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
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.tax_vat') || 'Tax / VAT Number'}</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            value={newSupplierTaxNumber}
                            onChange={e => setNewSupplierTaxNumber(e.target.value)}
                            placeholder="VAT / Tax Number"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.email') || 'Email'}</label>
                        <input
                            type="email"
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            value={newSupplierEmail}
                            onChange={e => setNewSupplierEmail(e.target.value)}
                            placeholder="email@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('suppliers.location') || 'Location'}</label>
                        <textarea
                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                            rows={2}
                            value={newSupplierLocation}
                            onChange={e => setNewSupplierLocation(e.target.value)}
                            placeholder="Full Address"
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
                                        ...createRecordMetadata(),
                                        name: newSupplierName,
                                        phone: newSupplierPhone || '',
                                        email: newSupplierEmail || '',
                                        location: newSupplierLocation || '',
                                        taxNumber: newSupplierTaxNumber || '',
                                        balance: 0
                                    });
                                    setIsAddSupplierOpen(false);
                                    setNewSupplierName('');
                                    setNewSupplierPhone('');
                                    setNewSupplierEmail('');
                                    setNewSupplierTaxNumber('');
                                    setNewSupplierLocation('');
                                    setEditSupplierId(id as string);
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

            {/* Quick Add Item Modal Replaced by Inline ItemForm Page */}
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

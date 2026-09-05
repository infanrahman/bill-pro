import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db, createRecordMetadata, type Invoice } from '../../services/db';
import { calculateLineItem, calculateDocumentTotals } from '../../utils/financials';

import type { Item, Customer, InvoiceItem, HeldBill } from '../../services/db';
import type { RestaurantTable } from '../../contexts/SettingsContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ShoppingCart, User, CreditCard, ShieldOff, LayoutGrid, Archive, ArrowLeft, Clock, UserPlus, XCircle, X, Sparkles, Plus, Minus, Trash2, Weight, FileText, PauseCircle, PlayCircle, ScanBarcode, UtensilsCrossed, SendHorizontal } from 'lucide-react';
import CheckoutModal from './CheckoutModal';
import ShiftModal from './ShiftModal';
import ItemCard from '../../components/POS/ItemCard';
import CompactItemCard from '../../components/POS/CompactItemCard';
import CartItem from './components/CartItem';
import TableSelectionScreen from './TableSelectionScreen';
import { useSettings } from '../../contexts/SettingsContext';
import { useKeyboard } from '../../contexts/KeyboardContext';
import { scaleService } from '../../services/scaleService';
import { shiftService } from '../../services/shiftService';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import CustomerForm from '../Customers/CustomerForm';
import Modal from '../../components/UI/Modal';
import { recommendationService } from '../../services/recommendationService';
import clsx from 'clsx';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

// Persistent storage to survive React StrictMode remounts for the same navigation transition
let pendingTransitionState: { editInvoice?: Invoice; hidePayLater?: boolean; autoCheckout?: boolean } | null = null;
let lastCapturedTime: number = 0;

const PosTerminal: React.FC = () => {
 const { formatCurrency, settings } = useSettings();
 const { addToast } = useNotification();
 const { registerShortcut, unregisterShortcut } = useKeyboard();
 const { hasPermission, activeBranchId, activeBranch, user } = useAuth();
 const { t } = useTranslation();
 const location = useLocation();
 const navigate = useNavigate();

 // --- State & Refs ---
 const [search, setSearch] = useState('');
 const [debouncedSearch, setDebouncedSearch] = useState('');
 
 useEffect(() => {
 const handler = setTimeout(() => setDebouncedSearch(search), 300);
 return () => clearTimeout(handler);
 }, [search]);

 const [showArabicName, setShowArabicName] = useState(false);
 const [showCustomerSearch, setShowCustomerSearch] = useState(false);
 const [customerSearchTerm, setCustomerSearchTerm] = useState('');
 const [debouncedCustomerSearchTerm, setDebouncedCustomerSearchTerm] = useState('');

 useEffect(() => {
 const handler = setTimeout(() => setDebouncedCustomerSearchTerm(customerSearchTerm), 300);
 return () => clearTimeout(handler);
 }, [customerSearchTerm]);
 const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
 const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isHeldBillsOpen, setIsHeldBillsOpen] = useState(false);
  const [isHoldPromptOpen, setIsHoldPromptOpen] = useState(false);
  const [holdName, setHoldName] = useState('');
  // Order Taking Mode: null = no table selected yet (show table picker); undefined = skip table
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null | undefined>(
    settings.orderTakingMode ? null : undefined
  );
  
  const [serialPromptIndex, setSerialPromptIndex] = useState<number | null>(null);
  const [serialPromptValue, setSerialPromptValue] = useState('');

  const heldBills = useLiveQuery(async () => {
   if (!activeBranchId) return [];
   return await db.heldBills.where('branchId').equals(activeBranchId).reverse().sortBy('createdAt');
 }, [activeBranchId]) || [];
 const [kitchenNote, setKitchenNote] = useState('');
 const [orderType, setOrderType] = useState<'dine_in' | 'parcel' | 'pickup' | 'delivery'>('dine_in');
 const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
 const [activeShift, setActiveShift] = useState<any>(null);
 const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
 const [shiftMode, setShiftMode] = useState<'open' | 'close'>('open');
 const [visibleItemsCount, setVisibleItemsCount] = useState(50);
 const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
 const [recommendations, setRecommendations] = useState<Item[]>([]);

 const activeShiftIdRef = useRef<string | undefined>(undefined);
 const itemsContainerRef = useRef<HTMLDivElement>(null);
 const barcodeBuffer = useRef<string>('');
 const lastKeyTime = useRef<number>(0);
 const searchInputRef = useRef<HTMLInputElement>(null);
 const isScanningRef = useRef<boolean>(false);

 // --- Handwriting logic: StrictMode Resilient ---
 const initState = useMemo(() => {
  const currentState = location.state as { editInvoice?: Invoice; hidePayLater?: boolean; autoCheckout?: boolean } | null;
 if (currentState?.editInvoice) {
 pendingTransitionState = currentState;
 lastCapturedTime = Date.now();
 return currentState;
 }
 const now = Date.now();
 if (pendingTransitionState && (now - lastCapturedTime < 2000)) return pendingTransitionState;
 return null;
 }, [location]);

 const initInvoice = initState?.editInvoice || null;
 const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(initInvoice);

 // --- Cart & Customer State ---
 const [cart, setCart] = useState<InvoiceItem[]>([]);
 const [customer, setCustomer] = useState<Customer>({ 
 name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() 
 });

 const GLOBAL_TAX_RATE = settings.taxRate ?? 15;

 // --- Queries ---
 const items = useLiveQuery(async () => {
 let collection;
 if (selectedCategoryId !== null) {
 collection = db.items.where('categoryId').equals(selectedCategoryId);
 } else if (activeBranch && !activeBranch.isMaster) {
 collection = db.items.where('branchId').equals(activeBranchId);
 } else {
 collection = db.items.toCollection();
 }

 const results = await collection.filter((i: any) => {
 if (i.deletedAt) return false;
 // Ensure branch filtering is applied when searching by category
 if (selectedCategoryId !== null && activeBranch && !activeBranch.isMaster) {
 if (i.branchId !== activeBranchId) return false;
 }
 if (debouncedSearch) {
 const lower = debouncedSearch.toLowerCase();
 return (i.name || '').toLowerCase().includes(lower) || (i.barcode && i.barcode.includes(lower));
 }
 return true;
 }).toArray();
 // Apply limit after filtering so the cap is on matched results, not raw cursor reads
 return results.slice(0, 300);
 }, [activeBranchId, activeBranch?.isMaster, debouncedSearch, settings.cafeMode, selectedCategoryId]);

 const customers = useLiveQuery(async () => {
 const collection = activeBranch?.isMaster ? db.customers.toCollection() : db.customers.where('branchId').equals(activeBranchId);
 return collection.filter((c: any) => {
 if (c.deletedAt) return false;
 if (debouncedCustomerSearchTerm) {
 const lower = debouncedCustomerSearchTerm.toLowerCase();
 return (c.name || '').toLowerCase().includes(lower) || (c.phone && c.phone.includes(lower));
 }
 return true;
 }).limit(50).toArray();
 }, [activeBranchId, activeBranch?.isMaster, debouncedCustomerSearchTerm]);

 const categories = useLiveQuery(() => activeBranch?.isMaster ? db.categories.filter((cat: any) => !cat.deletedAt).toArray() : db.categories.where('branchId').equals(activeBranchId).filter((cat: any) => !cat.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]);

 // --- Handlers ---
 const addToCart = useCallback((item: Item, overrideQty?: number) => {
  const qtyToAdd = overrideQty || 1;
  setCart(prev => {
  // If serial tracking is enabled for this item, always create new rows (do not merge)
  const isSerialTracked = settings.enableSerialTracking && item.trackSerial;

  const existing = !isSerialTracked ? prev.find(i => i.itemId === item.id) : undefined;
  if (existing) {
  return prev.map((i: any) => {
  if (i.itemId === item.id) {
  const newQuantity = i.quantity + qtyToAdd;
  return { ...i, quantity: newQuantity, total: newQuantity * i.price };
  }
  return i;
  });
  }

  // If we are adding multiple quantities of a serial tracked item at once (e.g., from scale or custom qty),
  // we must split it into multiple single-quantity rows so each can have a unique serial.
  if (isSerialTracked && qtyToAdd > 1) {
    const newItems = Array.from({ length: qtyToAdd }).map(() => ({
      itemId: item.id!,
      name: item.name,
      quantity: 1,
      price: item.salePrice,
      purchasePrice: item.purchasePrice,
      total: item.salePrice,
      unit: item.unit,
      taxType: item.taxType,
      taxRate: item.taxRate ?? GLOBAL_TAX_RATE,
      trackSerial: true, // internal flag for POS logic
      serialNumber: '' // empty initially
    }));
    return [...prev, ...newItems];
  }

  return [...prev, {
  itemId: item.id!,
  name: item.name,
  quantity: qtyToAdd,
  price: item.salePrice,
  purchasePrice: item.purchasePrice,
  total: qtyToAdd * item.salePrice,
  unit: item.unit,
  taxType: item.taxType,
  taxRate: item.taxRate ?? GLOBAL_TAX_RATE,
  ...(isSerialTracked ? { trackSerial: true, serialNumber: '' } : {})
  }];
  });
 }, [GLOBAL_TAX_RATE, settings.enableSerialTracking]);

 const handleHoldBill = () => {
   if (cart.length === 0) return;
   setHoldName('');
   setIsHoldPromptOpen(true);
 };

 const confirmHoldBill = async () => {
   try {
     await db.heldBills.add({
       ...createRecordMetadata(),
       name: holdName.trim() || t('pos.unnamed_bill', 'Unnamed Bill'),
       cartItems: cart,
       customerId: customer.id !== '0' ? customer.id : null,
       orderType,
       kitchenNote,
       createdAt: new Date()
     } as any);
     
     // Clear current cart
     setCart([]);
     setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
     setKitchenNote('');
     setOrderType('dine_in');
     setIsHoldPromptOpen(false);
     addToast(t('pos.bill_held_success', 'Bill held successfully'), 'success');
   } catch (e) {
     addToast(t('common.error'), 'error');
   }
 };

 const handleResumeBill = async (bill: HeldBill) => {
   try {
     setCart(bill.cartItems);
     setOrderType(bill.orderType || 'dine_in');
     setKitchenNote(bill.kitchenNote || '');
     
     if (bill.customerId) {
       const cust = await db.customers.get(bill.customerId);
       if (cust) setCustomer(cust);
       else setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
     } else {
       setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
     }
     
     await db.heldBills.delete(bill.id);
     setIsHeldBillsOpen(false);
     addToast(t('pos.bill_resumed', 'Bill resumed'), 'success');
   } catch (e) {
     addToast(t('common.error'), 'error');
   }
 };
 const updateCartItem = (itemId: string, field: keyof InvoiceItem, value: any) => {
 setCart(prev => prev.map(item => {
 if (item.itemId === itemId) {
 const updated = { ...item, [field]: value };
 const calcResult = calculateLineItem({
   price: updated.price,
   quantity: updated.quantity,
   discount: updated.discountAmount || 0,
   discountType: 'fixed',
   taxRate: updated.taxRate ?? 0,
   taxType: updated.taxType || 'exclusive'
 }, settings.applyTax);
 return { ...updated, ...calcResult };
 }
 return item;
 }));
 };

 const removeFromCart = useCallback((id: string) => setCart(prev => prev.filter((i: any) => i.itemId !== id)), []);

 const updateQuantity = useCallback((id: string, qty: number) => {
 if (qty < 0) return;
 setCart(prev => prev.map((i: any) => i.itemId === id ? { ...i, quantity: qty, total: qty * i.price } : i));
 }, []);

 const updatePrice = useCallback((id: string, price: number) => {
 if (price < 0) return;
 setCart(prev => prev.map((i: any) => i.itemId === id ? { ...i, price, total: i.quantity * price } : i));
 }, []);

 const selectCustomer = useCallback((c: Customer) => {
 setCustomer(c);
 setCustomerSearchTerm('');
 setShowCustomerSearch(false);
 }, []);

 const fetchScaleWeight = useCallback(async (itemId: string) => {
 try {
 const scales = await db.scales.where('status').equals('online').toArray();
 const scale = scales[0];
 if (!scale) {
 addToast(t('pos.no_scale_online', 'No online scale found. Check settings.'), 'error');
 return;
 }
 addToast(t('pos.reading_scale', 'Reading scale...'), 'info');
 const result = await scaleService.readWeight(scale);
 if (result.success && result.data !== undefined) {
 updateQuantity(itemId, result.data);
 addToast(t('pos.weight_fetched', 'Weight updated: {{weight}}kg', { weight: result.data }), 'success');
 } else {
 addToast(result.message || 'Failed to read weight', 'error');
 }
 } catch (error) {
 console.error('Scale fetch error:', error);
 addToast('Hardware communication error', 'error');
 }
 }, [addToast, t, updateQuantity]);

  const handleBarcodeLookup = useCallback(async (code: string) => {
    try {
      if (code.startsWith('SO-')) {
        const order = await db.invoices.where('invoiceNumber').equals(code).first();
        if (order && order.type === 'order') {
          if (order.paymentStatus !== 'paid') {
            setEditingInvoice(order);
            setCart(order.items.map((item: any) => ({
              itemId: item.itemId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              purchasePrice: item.purchasePrice,
              total: item.total || (item.price * item.quantity),
              unit: item.unit,
              taxType: item.taxType,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              discountAmount: item.discountAmount
            })));
            setKitchenNote(order.notes || '');
            setOrderType((order.orderType as any) || 'dine_in');
            
            if (order.customerId && order.customerId !== '0') {
              const c = await db.customers.get(order.customerId);
              if (c) setCustomer(c);
            }

            setIsCheckoutOpen(true);
            addToast(t('pos.order_loaded', 'Sales Order Loaded'), 'success');
          } else {
            addToast(t('pos.order_already_paid', 'This order is already paid'), 'warning');
          }
          if (searchInputRef.current) {
            setSearch('');
            searchInputRef.current.blur();
          }
          return;
        }
      }

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
      let matchedAsScale = false;
      
      if (!item && isScaleBarcode) {
        item = await db.items.where('itemCode').equals(lookupCode).first();
        if (!item) item = await db.items.where('itemCode').equals(Number(lookupCode).toString()).first();
        if (item) matchedAsScale = true;
      }

      if (item) {
        if (matchedAsScale) {
          scaleQty = item.salePrice > 0 ? Number((parsedPrice / item.salePrice).toFixed(3)) : 1;
        }
        addToCart(item, matchedAsScale ? scaleQty : 1);
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
      addToast(t('common.error') + ': Barcode lookup failed', 'error');
    }
  }, [addToCart, addToast, t, setCart, setKitchenNote, setOrderType, setCustomer, setIsCheckoutOpen, setSearch]);

 // --- Effects ---
 useEffect(() => {
 if (!initInvoice) return;
 setCart(initInvoice.items.map((item: any) => ({
 itemId: item.itemId,
 name: item.name,
 quantity: item.quantity,
 price: item.price,
 purchasePrice: item.purchasePrice,
 total: item.total || (item.price * item.quantity),
 unit: item.unit,
 taxType: item.taxType,
 taxRate: item.taxRate,
 taxAmount: item.taxAmount,
 discountAmount: item.discountAmount
 })));
 setKitchenNote(initInvoice.notes || '');
 setOrderType((initInvoice.orderType as any) || 'dine_in');
 
 if (initInvoice.customerId && initInvoice.customerId !== '0') {
 db.customers.get(initInvoice.customerId).then(c => {
 if (c) setCustomer(c);
 });
 }

 if (initState?.autoCheckout) {
 setIsCheckoutOpen(true);
 }

 navigate(location.pathname, { replace: true, state: {} });
 }, [initInvoice, navigate, location.pathname, initState]);

 useEffect(() => {
 if (settings.enableShiftManagement && user) {
 shiftService.getCurrentShift(user.id, activeBranchId).then(shift => {
 if (shift) {
 if (shift.id !== activeShiftIdRef.current) {
 activeShiftIdRef.current = shift.id;
 setActiveShift(shift);
 }
 } else {
 activeShiftIdRef.current = undefined;
 setShiftMode('open');
 setIsShiftModalOpen(true);
 }
 });
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [settings.enableShiftManagement, user, activeBranchId]);

 useEffect(() => {
 registerShortcut({ id: 'pos-search', keys: ['F2'], description: 'Focus Search', action: () => searchInputRef.current?.focus() });
 registerShortcut({ id: 'pos-checkout', keys: ['F9'], description: 'Checkout', action: () => setIsCheckoutOpen(true) });
 registerShortcut({ id: 'pos-clear', keys: ['Delete'], description: 'Clear Cart', action: () => setCart([]) });
 if (settings.cafeMode) {
 registerShortcut({ id: 'pos-type', keys: ['F8'], description: 'Change Order Type', action: () => {
 const types: ('dine_in' | 'parcel' | 'pickup' | 'delivery')[] = ['dine_in', 'parcel', 'pickup', 'delivery'];
 setOrderType(prev => types[(types.indexOf(prev) + 1) % types.length]);
 }});
 }
 return () => {
 unregisterShortcut('pos-search');
 unregisterShortcut('pos-checkout');
 unregisterShortcut('pos-clear');
 unregisterShortcut('pos-type');
 };
 }, [registerShortcut, unregisterShortcut]);

 useEffect(() => {
 const handleGlobalKeyDown = async (e: KeyboardEvent) => {
 const target = e.target as HTMLElement;
 const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
 const now = Date.now();
 const timeDelta = now - lastKeyTime.current;
 lastKeyTime.current = now;

 if (e.key === 'Enter') {
 if (barcodeBuffer.current.length >= 3) {
 e.preventDefault();
 e.stopPropagation();
 const code = barcodeBuffer.current.trim();
 barcodeBuffer.current = '';
 isScanningRef.current = false;
 if (isInputField && target instanceof HTMLInputElement) {
 const currentVal = target.value;
 if (currentVal.endsWith(code)) {
 target.value = currentVal.substring(0, currentVal.length - code.length);
 } else if (target === searchInputRef.current) setSearch('');
 }
 await handleBarcodeLookup(code);
 }
 barcodeBuffer.current = '';
 } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
 if (timeDelta > 300) {
 barcodeBuffer.current = '';
 isScanningRef.current = false;
 }
 barcodeBuffer.current += e.key;
 if (barcodeBuffer.current.length >= 2 && timeDelta < 200) isScanningRef.current = true;
 if (isScanningRef.current && barcodeBuffer.current.length > 2) e.preventDefault();
 }
 };
 window.addEventListener('keydown', handleGlobalKeyDown, true);
 return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
 }, [handleBarcodeLookup]);

 // --- Derived ---
 const filteredItems = useMemo(() => items || [], [items]);

 useEffect(() => {
 setVisibleItemsCount(50);
 if (itemsContainerRef.current) itemsContainerRef.current.scrollTop = 0;
 }, [debouncedSearch, selectedCategoryId]);

 const visibleItems = useMemo(() => filteredItems.slice(0, visibleItemsCount), [filteredItems, visibleItemsCount]);

 const filteredCustomers = useMemo(() => {
 if (!customers) return [];
 return customers.slice(0, 10);
 }, [customers]);

  // --- Recommendations Effect (debounced, only re-fetches when item IDs change) ---
  const cartItemIdsKey = cart.map(i => i.itemId).sort().join(',');

  useEffect(() => {
  let cancelled = false;
  const timer = setTimeout(async () => {
  const itemIds = cart.map(i => i.itemId);
  if (itemIds.length > 0) {
  const recs = await recommendationService.getFrequentlyBoughtWith(itemIds);
  if (!cancelled) setRecommendations(recs);
  } else {
  const trending = await recommendationService.getTrendingItems();
  if (!cancelled) setRecommendations(trending);
  }
  }, 600);
  return () => {
  cancelled = true;
  clearTimeout(timer);
  };
  // Use the sorted item IDs key so qty changes don't trigger re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItemIdsKey]);

 const cartCalculations = useMemo(() => {
 const lineResults = cart.map(item => calculateLineItem({
 price: item.price,
 quantity: item.quantity,
 taxRate: item.taxRate ?? GLOBAL_TAX_RATE,
 taxType: item.taxType || 'exclusive',
 discount: item.discountAmount || 0,
 discountType: 'fixed'
 }, settings.applyTax));
 return calculateDocumentTotals(lineResults, 0, 'fixed', settings.applyTax);
 }, [cart, settings.applyTax, settings.taxRate]);

 const cartSubTotal = cartCalculations.subTotal;
 const cartTax = cartCalculations.taxAmount;
 const payableTotal = cartCalculations.grandTotal;

 const handleScroll = () => {
 if (itemsContainerRef.current) {
 const { scrollTop, scrollHeight, clientHeight } = itemsContainerRef.current;
 if (scrollTop + clientHeight >= scrollHeight - 200) {
 setVisibleItemsCount(prev => Math.min(prev + 50, filteredItems.length));
 }
 }
 };
const handleCheckoutComplete = async (invoiceData: any): Promise<string> => {
 try {
 return await db.transaction('rw', [db.invoices, db.customers, db.items], async () => {
 const metadata = createRecordMetadata();
        const finalData = editingInvoice 
            ? { 
                ...editingInvoice, 
                ...invoiceData, 
                type: invoiceData.type || 'invoice',
                status: invoiceData.status || 'paid',
                paymentStatus: invoiceData.paymentStatus || 'paid',
                shiftId: activeShift?.id || editingInvoice.shiftId, 
                updatedAt: new Date() 
              }
            : { 
                ...invoiceData, 
                ...metadata, 
                shiftId: activeShift?.id, 
                type: invoiceData.type || 'invoice', 
                status: invoiceData.status || (invoiceData.paymentStatus === 'paid' ? 'paid' : 'pending') 
              };

 const id = await db.invoices.put(finalData);

 const wasInvoice = editingInvoice?.type === 'invoice';
 const isInvoice = finalData.type === 'invoice';
 const isBecomingInvoice = isInvoice && !wasInvoice;
 const isEditingInvoice = isInvoice && wasInvoice;

 if (invoiceData.customerId && (isBecomingInvoice || isEditingInvoice)) {
 const c = await db.customers.get(invoiceData.customerId);
 if (c) {
 if (isBecomingInvoice) {
 const newPoints = Math.floor(invoiceData.grandTotal);
 await db.customers.update(invoiceData.customerId, { 
 totalSpent: (c.totalSpent || 0) + invoiceData.grandTotal, 
 balance: (c.balance || 0) + (invoiceData.remainingAmount || 0),
 loyaltyPoints: (c.loyaltyPoints || 0) + newPoints
 });
 } else {
  // Read the CURRENT invoice state from DB (not stale component state) to prevent
  // balance double-counting when payments were made after the invoice was loaded.
  const currentDbInvoice = await db.invoices.get(editingInvoice!.id);
  const currentGrandTotal = Number(invoiceData.grandTotal) || 0;
  const previousGrandTotal = Number(currentDbInvoice?.grandTotal ?? editingInvoice?.grandTotal) || 0;
  const totalDelta = currentGrandTotal - previousGrandTotal;

  const currentRemaining = Number(invoiceData.remainingAmount) || 0;
  const previousRemaining = Number(currentDbInvoice?.remainingAmount ?? editingInvoice?.remainingAmount) || 0;
  const balanceDelta = currentRemaining - previousRemaining;

  const pointsDelta = Math.floor(currentGrandTotal) - Math.floor(previousGrandTotal);

  await db.customers.update(invoiceData.customerId, {
  totalSpent: (c.totalSpent || 0) + totalDelta,
  balance: (c.balance || 0) + balanceDelta,
  loyaltyPoints: (c.loyaltyPoints || 0) + pointsDelta
  });
  }
 }
 }

 if (isBecomingInvoice || isEditingInvoice) {
 if (isBecomingInvoice) {
 for (const item of invoiceData.items) {
 const dbItem = await db.items.get(item.itemId);
 if (dbItem) await db.items.update(item.itemId, { stock: Math.max(0, dbItem.stock - item.quantity) });
 }
 } else {
 const oldMap = new Map(editingInvoice?.items.map((i: any) => [i.itemId, i.quantity]) || []);
 const newMap = new Map(invoiceData.items.map((i: any) => [i.itemId, i.quantity]));
 const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);
 for (const itemId of allIds) {
 const delta = (Number(newMap.get(itemId)) || 0) - (Number(oldMap.get(itemId)) || 0);
 if (delta !== 0) {
 const dbItem = await db.items.get(itemId);
 if (dbItem) await db.items.update(itemId, { stock: Math.max(0, dbItem.stock - delta) });
 }
 }
 }
 }
 return id as string;
 });
 } catch (error) {
 console.error("Save invoice failed:", error);
 throw error;
 }
 };

 // --- Access Control (After hooks) ---
  if (!hasPermission('pos_access')) {
 return (
 <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-4 md:p-8 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
 <ShieldOff size={48} className="text-slate-300 mb-4"/>
 <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
 <p className="text-slate-700">{t('pos.access_denied_msg')}</p>
 </div>
);
 }

 // Order Taking Mode: show table selection screen first
 if (settings.orderTakingMode && !window.electron && selectedTable === null) {
   return (
     <TableSelectionScreen
       onSelectTable={(table) => setSelectedTable(table ?? undefined)}
     />
   );
 }

 return (
  <div className="flex flex-col sm:flex-row h-full gap-3 sm:gap-4 overflow-y-auto sm:overflow-hidden relative custom-scrollbar pb-20 sm:pb-0">

  <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4 min-w-0 relative z-10 min-h-[500px] sm:min-h-0 shrink-0">
  {/* Modern Category Sidebar */}
  <div 
  className="w-full sm:w-32 md:w-36 flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto pr-1.5 pb-2 sm:pb-12 custom-scrollbar shrink-0 max-h-16 sm:max-h-none"
  >
  <button type="button"
  onClick={() => setSelectedCategoryId(null)}
  className={clsx(
 "group px-3 py-2.5 sm:py-3 rounded-2xl border flex flex-row sm:flex-col items-center justify-center text-center gap-2 min-w-[85px] sm:min-w-0 sm:w-full shrink-0 relative overflow-hidden transition-all duration-200",
  selectedCategoryId === null 
  ?"bg-slate-900 dark:bg-slate-700 text-white border-transparent shadow-md ring-2 ring-slate-900/10 dark:ring-white/10"
  :"bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750"
 )}
  >
  <LayoutGrid size={18} className={clsx("shrink-0", selectedCategoryId === null ?"text-white":"text-slate-500 dark:text-slate-400")} />
  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-tight">{t('common.all')}</span>
  </button>
  
  {categories?.map((cat: any) => (
  <button type="button"
  key={cat.id}
  onClick={() => setSelectedCategoryId(cat.id)}
  className={clsx(
 "group px-3 py-2.5 sm:py-3 rounded-2xl border flex flex-row sm:flex-col items-center justify-center text-center gap-2 min-w-[105px] sm:min-w-0 sm:w-full shrink-0 relative overflow-hidden transition-all duration-200",
  selectedCategoryId === cat.id 
  ?"bg-slate-900 dark:bg-slate-700 text-white border-transparent shadow-md ring-2 ring-slate-900/10 dark:ring-white/10 scale-[1.02]"
  :"bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750"
 )}
  >
  {cat.color && selectedCategoryId !== cat.id && (
  <div className="absolute left-0 top-0 bottom-0 w-1 sm:w-full sm:h-1 opacity-80"style={{ backgroundColor: cat.color }} />
 )}
  <span className="text-[10px] sm:text-xs font-bold leading-snug line-clamp-2 w-full uppercase tracking-tight relative z-10 text-center break-words">{cat.name}</span>
  </button>
 ))}
  </div>

 <div className="flex-1 flex flex-col gap-6 min-w-0">
 {/* Premium Header / Search & Actions Bar */}
 <div 
 
 
 className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 relative overflow-hidden"
 >

 {settings.enableShiftManagement && (
 <button type="button"
 
 
 onClick={() => { setShiftMode(activeShift ? 'close' : 'open'); setIsShiftModalOpen(true); }}
 className={clsx(
"flex items-center gap-3 px-5 py-2.5 rounded-xl text-[9px] font-semibold uppercase tracking-wide border relative overflow-hidden group",
 activeShift 
 ?"bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
 :"bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
)}
 >
 <div className={clsx(
"w-2 h-2 rounded-full ring-4", 
 activeShift ? 'bg-emerald-500 ring-emerald-500/20 ' : 'bg-rose-500 ring-rose-500/20'
)} />
 {activeShift ? t('pos.shift_active') : t('pos.shift_required')}
 <div className="absolute inset-0 from-transparent via-white/10 to-transparent -translate-x-full group-hover:"/>
 </button>
)}
 
 {editingInvoice && (
 <button type="button"
 
 
 onClick={() => navigate('/sales')} 
 className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-[9px] uppercase tracking-wider border border-slate-200 dark:border-slate-700 group"
 >
 <ArrowLeft size={16} /> 
 <span>{t('common.back')}</span>
 </button>
)}

 <div className="flex-1 relative flex items-center gap-2 group">
 <div className="relative flex-1">
 <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white group-focus-within:scale-110"size={18} />
 <input
 ref={searchInputRef}
 type="text"
 placeholder={t('pos.search_placeholder')}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter') { const code = search.trim(); if (code) { e.preventDefault(); handleBarcodeLookup(code); } } }}
 className="w-full pl-12 pr-6 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 focus:bg-white dark:focus:bg-slate-900 font-bold text-base placeholder:text-slate-600/60"
 />
 </div>
 {Capacitor.isNativePlatform() && settings?.scannerType !== 'hardware' && (
 <button
 type="button"
 onClick={async () => {
 try {
 await BarcodeScanner.requestPermissions();
 const result = await BarcodeScanner.scan();
 if (result.barcodes.length > 0) {
 const rawVal = result.barcodes[0].rawValue;
 if (rawVal) {
 setSearch(rawVal);
 handleBarcodeLookup(rawVal);
 }
 }
 } catch (err) {
 addToast('Camera scan failed', 'error');
 }
 }}
 title="Scan Barcode"
 className="w-12 h-12 bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0"
 >
 <ScanBarcode size={20} />
 </button>
 )}
 </div>

 <button type="button"
 
 
 onClick={() => setShowArabicName(!showArabicName)} 
 className={clsx(
"w-12 h-12 rounded-xl border font-semibold text-[10px] flex items-center justify-center",
 showArabicName 
 ? 'bg-slate-900 dark:bg-white border-transparent text-white' 
 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
)}
 >
 عربي
 </button>
 </div>

            <div ref={itemsContainerRef} onScroll={handleScroll} className={clsx(
                "flex-1 overflow-y-auto content-start pr-1.5 grid gap-3 sm:gap-4 custom-scrollbar pb-16",
                settings.cafeMode 
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
                    : 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5'
            )}>
                <>
                    {visibleItems?.map((item: any, idx) => (
                        <div key={item.id} className="h-full">
                            {(settings.cafeMode || item.image) ? (
                                <ItemCard item={item} onClick={addToCart} showArabicName={showArabicName} />
                            ) : (
                                <CompactItemCard item={item} onClick={addToCart} showArabicName={showArabicName} />
                            )}
                        </div>
                    ))}
                </>
            </div>

 {/* Premium Recommendations Section */}
 <>
 {recommendations.length > 0 && (
 <div 
 
 
 
 className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden mb-4"
 >
 <h4 className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
 <div className="p-1.5 bg-amber-100 dark:bg-amber-950/40 rounded-lg">
 <Sparkles size={14} className="text-amber-500"/>
 </div>
 {cart.length > 0 ? t('pos.frequently_bought_together') : t('pos.trending_now')}
 </h4>
 
 <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar -mx-4 px-4">
 {recommendations.map(item => (
 <button type="button"
 key={item.id}
 
 
 onClick={() => addToCart(item)}
 className="flex-shrink-0 w-44 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left group relative"
 >
 <div className="text-xs font-semibold text-slate-800 dark:text-white line-clamp-1 mb-2 uppercase tracking-tight group-hover:text-amber-500">{item.name}</div>
 <div className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{formatCurrency(item.salePrice)}</div>
 <div className="absolute bottom-3.5 right-3.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
 <div className="bg-amber-500 text-white p-1.5 rounded-lg">
 <Plus size={14} />
 </div>
 </div>
 </button>
))}
 </div>
 </div>
)}
 </>
 </div>
 </div>

 {/* Mobile "View Cart" Floating Button */}
 {!isMobileCartOpen && (
   <button
     type="button"
     onClick={() => setIsMobileCartOpen(true)}
     className="sm:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-4 left-4 bg-blue-600 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between z-40 active:scale-95 transition-transform"
   >
     <div className="flex items-center gap-3">
       <div className="relative">
         <ShoppingCart size={24} />
         {cart.length > 0 && (
           <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-blue-600">
             {cart.reduce((sum, item) => sum + item.quantity, 0)}
           </span>
         )}
       </div>
       <span className="font-bold">View Cart</span>
     </div>
     <span className="font-bold text-lg">{formatCurrency(cart.reduce((sum, item) => sum + item.total, 0))}</span>
   </button>
 )}

 {/* Premium Cart Sidebar */}
 <div 
 className={clsx(
   "sm:w-72 md:w-80 xl:w-96 2xl:w-[400px] h-full shrink-0 bg-white dark:bg-slate-900 sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-850 flex flex-col z-50 sm:z-20 group/cart",
   isMobileCartOpen ? "fixed inset-0 w-full rounded-none" : "hidden sm:flex relative"
 )}
 >
 <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 relative z-20 pt-[max(1rem,env(safe-area-inset-top))]">
   {/* Mobile Cart Header with Close Button */}
   <div className="flex items-center justify-between mb-4 sm:hidden">
     <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
       <ShoppingCart size={20} /> Current Order
     </h2>
     <button 
       onClick={() => setIsMobileCartOpen(false)}
       className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-700 dark:text-slate-300"
     >
       <X size={20} />
     </button>
   </div>
 <>
 {editingInvoice && (
 <div 
 
 
 
 className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between"
 >
 <div className="flex items-center gap-3">
 <div className="w-2.5 h-2.5 bg-amber-500 rounded-full 0_0_8px_rgba(245,158,11,0.4)]"></div>
 <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{t('pos.editing_mode')} #{editingInvoice.invoiceNumber}</span>
 </div>
 <button type="button"
 
 
 onClick={() => { setEditingInvoice(null); setCart([]); setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() }); }} 
 className="text-amber-600 hover:bg-amber-500/20 p-1.5 rounded-lg"
 >
 <XCircle size={18} />
 </button>
 </div>
)}
 
 {!editingInvoice && (
   <div className="flex gap-2 mb-3">
     <button type="button" onClick={handleHoldBill} disabled={cart.length === 0} className="flex-1 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-[10px] uppercase tracking-wider rounded-lg border border-indigo-200 dark:border-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
       <PauseCircle size={14} /> {t('pos.table_order', 'Table Order / Hold')}
     </button>
     <button type="button" onClick={() => setIsHeldBillsOpen(true)} className="flex-1 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] uppercase tracking-wider rounded-lg border border-emerald-200 dark:border-emerald-800 flex justify-center items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
       <PlayCircle size={14} /> {t('pos.active_tables', 'Active Tables')} {heldBills.length > 0 && `(${heldBills.length})`}
     </button>
   </div>
 )}
 </>

 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2 font-semibold text-[10px] text-slate-600 uppercase tracking-[0.4em]">
 <div className="w-7 h-7 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center text-slate-900 dark:text-white">
 <User size={14} /> 
 </div>
 {t('dashboard.customer')}
 </div>
 <button type="button"
 
 
 onClick={() => setIsCustomerFormOpen(true)} 
 className="p-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg"
 >
 <UserPlus size={16} />
 </button>
 </div>

 {customer.id !== '0' ? (
 <div 
 className="flex items-center justify-between p-3 bg-indigo-600 text-white rounded-xl group relative overflow-hidden"
 >
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-500"/>
 <div className="relative z-10">
 <div className="font-semibold text-sm uppercase tracking-tight truncate max-w-[200px]">{customer.name}</div>
 <div className="text-[9px] opacity-70 font-bold mt-1 tracking-wide">{customer.phone || 'NO PHONE RECORDED'}</div>
 </div>
 <button type="button"
 
 
 onClick={() => setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() })} 
 className="bg-white hover:bg-white p-1.5 rounded-lg relative z-10"
 >
 <XCircle size={16} />
 </button>
 </div>
) : (
 <div className="relative group/custsearch">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/custsearch:text-slate-900 dark:group-focus-within/custsearch:text-white"size={16} />
 <input
 type="text"
 value={customerSearchTerm}
 onChange={(e) => { setCustomerSearchTerm(e.target.value); setShowCustomerSearch(true); }}
 onFocus={() => setShowCustomerSearch(true)}
 placeholder={t('pos.walk_in_customer')}
 className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 />
 <>
 {showCustomerSearch && (
 <div 
 
 
 
 className="absolute top-full left-0 w-full z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mt-1.5 max-h-[300px] overflow-y-auto custom-scrollbar p-2"
 >
 <div 
 
 onClick={() => selectCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() })} 
 className="p-2.5 hover:bg-slate-900 dark:hover:bg-white hover:text-white cursor-pointer rounded-lg border-b last:border-0 border-slate-50 dark:border-slate-700/50 group flex justify-between items-center bg-slate-100 dark:bg-slate-800"
 >
 <div>
 <div className="font-semibold text-xs uppercase tracking-tight">{t('pos.walk_in_customer')}</div>
 <div className="text-[9px] opacity-60 font-bold uppercase tracking-wide mt-0.5">{t('common.default', 'Default')}</div>
 </div>
 <User size={14} className="opacity-50"/>
 </div>
 {filteredCustomers?.length > 0 ? filteredCustomers.map((c: any) => (
 <div 
 key={c.id} 
 
 onClick={() => selectCustomer(c)} 
 className="p-2.5 hover:bg-slate-900 dark:hover:bg-white hover:text-white cursor-pointer rounded-lg border-b last:border-0 border-slate-50 dark:border-slate-700/50 group flex justify-between items-center"
 >
 <div>
 <div className="font-semibold text-xs uppercase tracking-tight">{c.name}</div>
 <div className="text-[9px] opacity-60 font-bold uppercase tracking-wide mt-0.5">{c.phone || 'No phone'}</div>
 </div>
 {c.balance > 0 && (
 <span className="text-rose-500 group-hover:text-white text-[9px] font-semibold bg-rose-500/10 group-hover:bg-white px-2 py-1 rounded-full border border-rose-500/10 group-hover:border-transparent">
 {formatCurrency(c.balance)}
 </span>
)}
 </div>
)) : (
 <div className="p-4 text-center text-slate-600 font-bold text-xs uppercase tracking-wider">{t('common.no_results')}</div>
)}
 </div>
)}
 </>
 </div>
)}
 </div>

 <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative z-10">
 <>
 {cart.map((item, index) => (
 <div
 key={`${item.itemId}-${index}`}
 
 >
 <CartItem 
   item={{ ...item, unit: item.unit || 'unit' }} 
   onRemove={(id) => {
     setCart(prev => {
       const copy = [...prev];
       const idxToRemove = copy.findIndex((c, i) => c.itemId === id && i === index);
       if (idxToRemove !== -1) copy.splice(idxToRemove, 1);
       return copy;
     });
   }} 
   onUpdateQuantity={updateQuantity} 
   onUpdatePrice={updatePrice} 
   onFetchScaleWeight={fetchScaleWeight} 
   onSetSerial={() => {
     setSerialPromptIndex(index);
     setSerialPromptValue(item.serialNumber || '');
   }}
 />
 </div>
))}
 </>
 {cart.length === 0 && (
 <div className="h-full flex flex-col items-center justify-center py-8">
 <div
 
 
 className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-400"
 >
 <ShoppingCart size={40} strokeWidth={1} />
 </div>
 <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.5em] text-slate-600 opacity-50">{t('pos.empty_cart')}</p>
 </div>
)}
 </div>

 {/* Premium Cart Footer */}
 <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 relative z-10 space-y-4">
 <div className="space-y-2">
 <div className="flex justify-between text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
 <span>{t('pos.subtotal')}</span>
 <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(cartSubTotal)}</span>
 </div>
 {cartTax > 0 && (
 <div className="flex justify-between text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
 <span className="flex items-center gap-2">
 {t('pos.tax')} 
 <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[7px] text-slate-900 dark:text-white">15%</span>
 </span>
 <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(cartTax)}</span>
 </div>
)}
 <div className="h-px from-transparent via-slate-200 dark:via-slate-800 to-transparent my-2"/>
 <div className="flex justify-between items-baseline">
 <div className="flex flex-col">
 <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-[0.4em] mb-0.5">{t('pos.total')}</span>
 <span className="text-[7px] text-slate-900 dark:text-white font-semibold uppercase tracking-wide">{cart.length} ITEMS IN CART</span>
 </div>
 <span 
 key={payableTotal}
 
 
 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight"
 >
 {formatCurrency(payableTotal)}
 </span>
 </div>
 </div>

 {settings.cafeMode && (
 <div className="grid grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
 {(['dine_in', 'parcel', 'pickup', 'delivery'] as const).map(typeId => {
 const customData = settings.customOrderTypes?.[typeId] || {
 icon: typeId === 'dine_in' ? '🍽️' : typeId === 'parcel' ? '🥡' : typeId === 'pickup' ? '🚶' : '🚚',
 label: t('pos.' + typeId)
 };
 return (
 <button type="button"
 key={typeId} 
 
 
 onClick={() => setOrderType(typeId as any)} 
 className={clsx(
"flex flex-col items-center py-1.5 rounded-lg outline-none border",
 orderType === typeId 
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-transparent ring-4 ring-slate-900/20 dark:ring-white/20' 
 : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 border-transparent'
)}
 >
 <span className="text-lg mb-1">{customData.icon}</span>
 <span className="text-[8px] font-semibold uppercase tracking-tight">{customData.label}</span>
 </button>
);
 })}
 </div>
)}

 {settings.cafeMode && (
  <div className="relative group/note">
    <textarea 
      value={kitchenNote} 
      onChange={(e) => setKitchenNote(e.target.value)} 
      placeholder={t('pos.kitchen_notes')} 
      className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none resize-none dark:text-white focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 placeholder:opacity-40"
      rows={1} 
    />
    <div className="absolute right-3 bottom-3 p-1 bg-slate-50 dark:bg-slate-900 rounded-md opacity-30 group-focus-within/note:opacity-100">
      <FileText size={12} className="text-slate-600"/>
    </div>
  </div>
)}

 <div className="grid grid-cols-5 gap-3">
 <button type="button"
 
 
 onClick={async () => {
 const saved = localStorage.getItem('printerConfig');
 if (!saved) return addToast('No printer config found', 'error');
 const config = JSON.parse(saved);
 if (window.electron?.openCashDrawer && config.thermal?.printerName) {
 const ok = await window.electron.openCashDrawer(config.thermal.printerName);
 if (ok) addToast('Drawer opened', 'success');
 else addToast('Failed to open drawer', 'error');
 }
 }} 
 className="bg-white dark:bg-slate-800 text-slate-700 hover:text-slate-900 dark:hover:text-white p-3 rounded-xl font-bold flex justify-center items-center border border-slate-200/50 dark:border-slate-700/50 group"
 >
 <Archive size={20} className="group-" />
 </button>
 
 {settings.orderTakingMode && !window.electron ? (
   // ORDER TAKING MODE: Send to Kitchen button (no payment)
   <button type="button"
     onClick={async () => {
       if (cart.length === 0) return;
       try {
         const tableName = selectedTable?.name ?? 'No Table';
         const billName = selectedTable ? selectedTable.name : `Order ${Date.now()}`;
         const existing = selectedTable
           ? await db.heldBills.where('branchId').equals(activeBranchId).filter(b => b.tableName === selectedTable.name).first()
           : null;
         const metadata = createRecordMetadata();
         if (existing) {
           await db.heldBills.update(existing.id, {
             cartItems: cart,
             kitchenNote,
             orderType,
             updatedAt: new Date(),
             tableName,
             tableCapacity: selectedTable?.capacity,
           });
         } else {
           await db.heldBills.add({
             ...metadata,
             name: billName,
             cartItems: cart,
             customerId: customer.id,
             orderType,
             kitchenNote,
             createdAt: new Date(),
             tableName,
             tableCapacity: selectedTable?.capacity,
           });
         }
         addToast('Order sent to kitchen!', 'success');
         setCart([]);
         setKitchenNote('');
         // Return to table selection
         setSelectedTable(null);
       } catch {
         addToast('Failed to send order', 'error');
       }
     }}
     disabled={cart.length === 0}
     className="col-span-5 flex items-center justify-center gap-3 bg-orange-500 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all relative overflow-hidden group"
   >
     <div className="p-1.5 bg-white/20 rounded-lg">
       <SendHorizontal size={20} />
     </div>
     <div className="flex flex-col items-start">
       <span className="text-[8px] uppercase tracking-wider opacity-70 font-semibold mb-0.5">
         {selectedTable ? selectedTable.name : 'No Table'}
       </span>
       <span className="uppercase tracking-wider text-sm">Send to Kitchen</span>
     </div>
   </button>
 ) : (
   // NORMAL MODE: Regular checkout button
   <button type="button"
     onClick={() => {
       if (settings.enableSerialTracking) {
         const missingSerial = cart.find(i => i.trackSerial && !i.serialNumber);
         if (missingSerial) {
           addToast(t('pos.serial_missing_error', `Please provide a serial number for ${missingSerial.name}`), 'error');
           return;
         }
       }
       setIsCheckoutOpen(true);
     }}
     disabled={cart.length === 0 || (settings.enableShiftManagement && !activeShift)}
     className="bg-slate-800 dark:bg-slate-700 disabled:bg-slate-400 disabled:dark:bg-slate-800 disabled:cursor-not-allowed text-white p-2.5 rounded-xl font-semibold shadow-[0_10px_25px_-5px_rgba(37,99,235,0.3)] hover:shadow-[0_15px_30px_-5px_rgba(37,99,235,0.4)] disabled:shadow-none active:scale-[0.98] flex justify-center items-center gap-3 col-span-4 relative overflow-hidden group transition-all"
   >
     <div className="absolute inset-0 from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 group-disabled:hidden"/>
     <div className="p-2 bg-white/20 group-disabled:bg-white/10 rounded-lg text-white">
       <CreditCard size={20} />
     </div>
     <div className="flex flex-col items-start group-disabled:opacity-80">
       <span className="uppercase tracking-wider text-[8px] opacity-70 font-semibold mb-0.5">{t('pos.ready_to_pay')}</span>
       <span className="uppercase tracking-[0.1em] text-sm">{t('pos.checkout')}</span>
     </div>
   </button>
 )}
 </div>
 </div>
 </div>

 <CheckoutModal
 isOpen={isCheckoutOpen}
 onClose={(success) => {
 setIsCheckoutOpen(false);
 if (success) {
 setCart([]); setCustomer({ name: 'Walk-in Customer', phone: '', id: '0', totalSpent: 0, balance: 0, vatNumber: '', branchId: '', updatedAt: new Date() });
 setSearch(''); setKitchenNote(''); setOrderType('dine_in'); setEditingInvoice(null);
 }
 setTimeout(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }, 50);
 }}
 subTotal={cartSubTotal}
 items={cart}
 customerName={customer.name}
 customerId={customer.id}
 customerVatNumber={customer.vatNumber}
 notes={kitchenNote}
 orderType={orderType}
 onConfirm={handleCheckoutComplete}
 invoiceNumber={editingInvoice?.invoiceNumber}
 showPayLater={!initState?.hidePayLater && !editingInvoice}
 />

 {isCustomerFormOpen && <CustomerForm onClose={() => setIsCustomerFormOpen(false)} onSave={() => setIsCustomerFormOpen(false)} />}
 
 <ShiftModal
 isOpen={isShiftModalOpen}
 mode={shiftMode}
 onClose={(success) => {
 setIsShiftModalOpen(false);
 if (success && user) shiftService.getCurrentShift(user.id, activeBranchId).then(setActiveShift);
 }}
 />

 <Modal isOpen={isHeldBillsOpen} onClose={() => setIsHeldBillsOpen(false)} title={t('pos.held_bills', 'Held Bills')}>
   <div className="max-h-[60vh] overflow-y-auto">
     {heldBills.length === 0 ? (
       <div className="text-center p-4 md:p-8 text-slate-500 font-medium">
         {t('pos.no_held_bills', 'No held bills at the moment.')}
       </div>
     ) : (
       <div className="space-y-3 p-4">
         {heldBills.map(bill => (
           <div key={bill.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center group">
             <div>
               <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                 <Archive size={16} className="text-emerald-500" />
                 {bill.name}
               </div>
               <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                 {bill.cartItems.length} items • {new Date(bill.createdAt).toLocaleTimeString()}
               </div>
             </div>
             <div className="flex gap-2">
               <button type="button" onClick={() => {
                 db.heldBills.delete(bill.id);
               }} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg">
                 <Trash2 size={18} />
               </button>
               <button type="button" onClick={() => handleResumeBill(bill)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors">
                 <PlayCircle size={16} /> Resume
               </button>
             </div>
           </div>
         ))}
       </div>
     )}
   </div>
 </Modal>

 <Modal isOpen={isHoldPromptOpen} onClose={() => setIsHoldPromptOpen(false)} title={t('pos.table_order', 'Table Order / Hold')}>
   <div className="p-4">
     <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
       {t('pos.hold_bill_name', 'Enter Table Number or Name (e.g. Table 4):')}
     </label>
     <input 
       autoFocus
       type="text" 
       className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
       value={holdName}
       onChange={(e) => setHoldName(e.target.value)}
       onKeyDown={(e) => {
         if (e.key === 'Enter') confirmHoldBill();
       }}
       placeholder={t('pos.unnamed_bill', 'Unnamed Bill')}
     />
     <div className="flex justify-end gap-3 mt-6">
       <button type="button" onClick={() => setIsHoldPromptOpen(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
         {t('common.cancel', 'Cancel')}
       </button>
       <button type="button" onClick={confirmHoldBill} className="px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all">
         {t('pos.hold_bill', 'Hold Bill')}
       </button>
     </div>
   </div>
 </Modal>

 <Modal isOpen={serialPromptIndex !== null} onClose={() => setSerialPromptIndex(null)} title={t('pos.enter_serial', 'Enter Serial Number / IMEI')}>
   <div className="p-4">
     <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
       {t('pos.scan_serial', 'Scan or type the serial number for this item:')}
     </label>
     <input 
       autoFocus
       type="text" 
       className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
       value={serialPromptValue}
       onChange={(e) => setSerialPromptValue(e.target.value)}
       onKeyDown={(e) => {
         if (e.key === 'Enter') {
           if (!serialPromptValue.trim()) return;
           setCart(prev => {
             const copy = [...prev];
             if (serialPromptIndex !== null && copy[serialPromptIndex]) {
               copy[serialPromptIndex] = { ...copy[serialPromptIndex], serialNumber: serialPromptValue.trim() };
             }
             return copy;
           });
           setSerialPromptIndex(null);
         }
       }}
       placeholder="e.g. SN-948302849"
     />
     <div className="flex justify-end gap-3 mt-6">
       <button type="button" onClick={() => setSerialPromptIndex(null)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
         {t('common.cancel', 'Cancel')}
       </button>
       <button 
         type="button" 
         onClick={() => {
           if (!serialPromptValue.trim()) return;
           setCart(prev => {
             const copy = [...prev];
             if (serialPromptIndex !== null && copy[serialPromptIndex]) {
               copy[serialPromptIndex] = { ...copy[serialPromptIndex], serialNumber: serialPromptValue.trim() };
             }
             return copy;
           });
           setSerialPromptIndex(null);
         }} 
         disabled={!serialPromptValue.trim()}
         className="px-5 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white shadow-lg transition-all"
       >
         {t('common.save', 'Save')}
       </button>
     </div>
   </div>
 </Modal>
 </div>
);
};

export default PosTerminal;

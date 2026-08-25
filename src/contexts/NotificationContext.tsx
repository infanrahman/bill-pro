import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db, type Notification, createRecordMetadata } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface Toast {
 id: number;
 message: string;
 type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationContextType {
 toasts: Toast[];
 notifications: Notification[];
 unreadCount: number;
 addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
 addNotification: (message: string, type: 'info' | 'warning' | 'success' | 'error', relatedId?: string) => Promise<void>;
 markAsRead: (id: string) => Promise<void>;
 markAllAsRead: () => Promise<void>;
 checkReminders: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [toasts, setToasts] = useState<Toast[]>([]);

 // Live query for persistent notifications
 const notifications = useLiveQuery(
 () => db.notifications.orderBy('date').reverse().limit(50).toArray()
 , []) || [];

 const unreadCount = notifications.filter(n => !n.read).length;

 const removeToast = React.useCallback((id: number) => {
 setToasts(prev => prev.filter(t => t.id !== id));
 }, []);

 const addToast = React.useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
 const id = Date.now();
 setToasts(prev => [...prev, { id, message, type }]);
 setTimeout(() => removeToast(id), 3000);
 }, [removeToast]);

 const addNotification = React.useCallback(async (message: string, type: 'info' | 'warning' | 'success' | 'error', relatedId?: string) => {
 await db.notifications.add({
 ...createRecordMetadata(),
 title: type.toUpperCase(), // Default title based on type
 message,
 type,
 read: false,
 date: new Date(),
 referenceId: relatedId
 });
 }, []);

 const markAsRead = React.useCallback(async (id: string) => {
 await db.notifications.update(id, { read: true, updatedAt: new Date() });
 }, []);

 const markAllAsRead = React.useCallback(async () => {
 const now = new Date();
 const unread = await db.notifications.filter(n => !n.read).toArray();
 if (unread.length === 0) return;
 const updated = unread.map(n => ({ ...n, read: true, updatedAt: now }));
 await db.notifications.bulkPut(updated);
 }, []);

 const checkReminders = React.useCallback(async () => {
 // Load Settings (Default to TRUE if not found)
 const savedSettings = localStorage.getItem('reminderSettings');
 const settings = savedSettings ? JSON.parse(savedSettings) : { lowStock: true, paymentDue: true };

 const today = new Date();
 today.setHours(0, 0, 0, 0);

 // Pre-fetch all existing unread notifications in ONE query to avoid N+1
 const existingUnread = await db.notifications
   .filter(n => !n.read)
   .toArray();
 const existingRefs = new Set(existingUnread.map(n => `${n.referenceId}:${n.type}`));

 // 1. Payment Due Reminders (Customer Credit)
 if (settings.paymentDue) {
 const overdueInvoices = await db.invoices
 .filter(inv => {
 const isUnpaid = inv.paymentStatus === 'pending' || inv.paymentStatus === 'partial' || inv.paymentStatus === 'overdue';
 const hasBalance = (inv.remainingAmount ?? 0) > 0.1 || (inv.grandTotal - (inv.paidAmount ?? 0)) > 0.1;
 return isUnpaid && hasBalance && inv.dueDate !== undefined && inv.dueDate < today;
 })
 .toArray();

 for (const inv of overdueInvoices) {
 if (!existingRefs.has(`${inv.id}:warning`)) {
 await addNotification(
 `Overdue Credit: ${inv.customerName} owes $${inv.remainingAmount?.toFixed(2)} (Inv #${inv.invoiceNumber})`,
 'warning',
 inv.id
 );
 existingRefs.add(`${inv.id}:warning`);
 }
 }
 }

 // 2. Low Stock Reminders
 if (settings.lowStock) {
 const lowStockItems = await db.items
 .filter(item => item.stock <= (item.minStock || 0))
 .toArray();

 for (const item of lowStockItems) {
 if (!existingRefs.has(`${item.id}:warning`)) {
 await addNotification(
 `Low stock alert: ${item.name} (Qty: ${item.stock})`,
 'warning',
 item.id
 );
 existingRefs.add(`${item.id}:warning`);
 }
 }
 }

 // 3. Purchase Order Due (Due Credit) Reminders
 if (settings.paymentDue) {
 const overduePurchases = await db.purchases
 .filter(p => {
 const balance = p.totalAmount - (p.paidAmount || 0);
 return balance > 0.1 && !!p.dueDate && p.dueDate < today;
 })
 .toArray();

 for (const po of overduePurchases) {
 const relId = po.id;
 if (!relId) continue;
 if (!existingRefs.has(`${relId}:error`)) {
 await addNotification(
 `Overdue Purchase to ${po.supplierName} (${po.orderNumber})`,
 'error',
 relId
 );
 existingRefs.add(`${relId}:error`);
 }
 }
 }
 }, [addNotification]);

 // Initial check on mount
 useEffect(() => {
 checkReminders();

 const handleSuspend = () => {
 addToast('Account Suspended: Cloud Sync disabled. Please contact support.', 'error');
 };

 const handleExpire = () => {
 addToast('Subscription Expired: Please renew to restore cloud sync.', 'error');
 };

 const handleDisabled = () => {
 addToast('Cloud Sync Disabled: This feature is not allowed for your account.', 'warning');
 };

 const handleError = (e: any) => {
 addToast(e.detail || 'Cloud Sync Error: Connection rejected.', 'error');
 };

 window.addEventListener('saas-suspend', handleSuspend);
 window.addEventListener('saas-expire', handleExpire);
 window.addEventListener('saas-disabled', handleDisabled);
 window.addEventListener('saas-error', handleError);
 
 return () => {
 window.removeEventListener('saas-suspend', handleSuspend);
 window.removeEventListener('saas-expire', handleExpire);
 window.removeEventListener('saas-disabled', handleDisabled);
 window.removeEventListener('saas-error', handleError);
 };
 }, [checkReminders, addToast]);

 const contextValue = useMemo(() => ({
 toasts,
 notifications,
 unreadCount,
 addToast,
 addNotification,
 markAsRead,
 markAllAsRead,
 checkReminders
 }), [toasts, notifications, unreadCount, addToast, addNotification, markAsRead, markAllAsRead, checkReminders]);

 return (
 <NotificationContext.Provider value={contextValue}>
 {children}
 </NotificationContext.Provider>
);
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => {
 const context = useContext(NotificationContext);
 if (!context) {
 throw new Error('useNotification must be used within a NotificationProvider');
 }
 return context;
};

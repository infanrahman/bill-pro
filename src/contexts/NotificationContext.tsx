import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, type Notification } from '../services/db';
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
    addNotification: (message: string, type: 'info' | 'warning' | 'success' | 'error', relatedId?: number) => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
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

    const addToast = React.useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 3000);
    }, []);

    const removeToast = React.useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addNotification = React.useCallback(async (message: string, type: 'info' | 'warning' | 'success' | 'error', relatedId?: number) => {
        await db.notifications.add({
            title: type.toUpperCase(), // Default title based on type
            message,
            type,
            read: false,
            date: new Date(),
            referenceId: relatedId
        });
    }, []);

    const markAsRead = React.useCallback(async (id: number) => {
        await db.notifications.update(id, { read: true });
    }, []);

    const markAllAsRead = React.useCallback(async () => {
        const unread = await db.notifications.filter(n => !n.read).toArray();
        await Promise.all(unread.map(n => db.notifications.update(n.id!, { read: true })));
    }, []);

    const checkReminders = React.useCallback(async () => {
        // Load Settings (Default to TRUE if not found)
        const savedSettings = localStorage.getItem('reminderSettings');
        const settings = savedSettings ? JSON.parse(savedSettings) : { lowStock: true, paymentDue: true };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
                const exists = await db.notifications
                    .filter(n => n.referenceId === inv.id && n.type === 'warning' && !n.read)
                    .first();

                if (!exists) {
                    await addNotification(
                        `Overdue Credit: ${inv.customerName} owes $${inv.remainingAmount?.toFixed(2)} (Inv #${inv.invoiceNumber})`,
                        'warning',
                        inv.id
                    );
                }
            }
        }

        // 2. Low Stock Reminders
        if (settings.lowStock) {
            const lowStockItems = await db.items
                .filter(item => item.stock <= (item.minStock || 0))
                .toArray();

            for (const item of lowStockItems) {
                const exists = await db.notifications
                    .where({ referenceId: item.id, type: 'warning' }) // Use referenceId
                    .filter(n => !n.read && n.message.includes('Low stock'))
                    .first();

                if (!exists) {
                    await addNotification(
                        `Low stock alert: ${item.name} (Qty: ${item.stock})`,
                        'warning',
                        item.id
                    );
                }
            }
        }

        // 3. Purchase Order Due (Due Credit) Reminders
        if (settings.paymentDue) { // Reuse paymentDue setting or add new one
            const overduePurchases = await db.purchases
                .filter(p => {
                    const balance = p.totalAmount - (p.paidAmount || 0);
                    return balance > 0.1 && !!p.dueDate && p.dueDate < today;
                })
                .toArray();

            for (const po of overduePurchases) {
                // Note: Dexie 'relatedId' was used in previous code, but interface has referenceId.
                const relId = po.id || 0;

                const existsId = await db.notifications
                    .where({ referenceId: relId, type: 'error' })
                    .filter(n => !n.read && n.message.includes('Overdue Purchase'))
                    .first();

                if (!existsId) {
                    await addNotification(
                        `Overdue Purchase to ${po.supplierName} (${po.orderNumber})`,
                        'error',
                        relId
                    );
                }
            }
        }
    }, [addNotification]);

    // Initial check on mount
    useEffect(() => {
        checkReminders();
    }, [checkReminders]);

    return (
        <NotificationContext.Provider value={{
            toasts,
            notifications,
            unreadCount,
            addToast,
            addNotification,
            markAsRead,
            markAllAsRead,
            checkReminders
        }}>
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

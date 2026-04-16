import { db } from './db';

export interface BackupData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoices: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expenses: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    purchases: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customers: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    suppliers: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customerPayments: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    users: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activityLogs: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notifications: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cashEntries: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cashParties: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    purchasePayments: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categories?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spreadsheets?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scales?: any[];
    businessDetails: string | null;
    printerConfig: string | null;
    timestamp: number;
    version: string;
}

export const generateBackupData = async (): Promise<string> => {
    const exportData: BackupData = {
        items: await db.items.toArray(),
        invoices: await db.invoices.toArray(),
        expenses: await db.expenses.toArray(),
        purchases: await db.purchases.toArray(),
        customers: await db.customers.toArray(),
        suppliers: await db.suppliers.toArray(),
        customerPayments: await db.customerPayments.toArray(),
        users: await db.users.toArray(),
        activityLogs: await db.activityLogs.toArray(),
        notifications: await db.notifications.toArray(),
        cashEntries: await db.cashEntries.toArray(),
        cashParties: await db.cashParties.toArray(),
        purchasePayments: await db.purchasePayments.toArray(),
        categories: await db.categories.toArray(),
        spreadsheets: await db.spreadsheets.toArray(),
        scales: await db.scales.toArray(),
        businessDetails: localStorage.getItem('businessDetails'),
        printerConfig: localStorage.getItem('printerConfig'),
        timestamp: Date.now(),
        version: '1.2.0'
    };
    return JSON.stringify(exportData, null, 2);
};

export const restoreBackupData = async (jsonContent: string) => {
    const data = JSON.parse(jsonContent);

    // Validate structure
    if (!data.items || !data.invoices) throw new Error('Invalid backup file structure');

    // Helper function to insert only missing records (Prevent overwriting/duplicating)
    const safeAddMissing = async (table: any, items: any[]) => {
        if (!items || items.length === 0) return;
        
        // Grab all existing IDs to check against
        const existingIds = new Set(await table.toCollection().primaryKeys());
        
        // Filter out items that already exist in the database
        const newItems = items.filter((item: any) => !existingIds.has(item.id));
        
        if (newItems.length > 0) {
            await table.bulkAdd(newItems);
        }
    };

    // Helper to fix dates
    const fixDates = (arr: any[], dateFields: string[]) => arr.map((item: any) => {
        const newItem = { ...item };
        dateFields.forEach(f => {
            if (newItem[f]) newItem[f] = new Date(newItem[f]);
        });
        return newItem;
    });

    await db.transaction('rw', [
        db.items, db.invoices, db.expenses, db.purchases,
        db.customers, db.suppliers, db.customerPayments,
        db.users, db.notifications, db.activityLogs,
        db.cashEntries, db.cashParties, db.purchasePayments,
        db.categories, db.spreadsheets, db.scales
    ], async () => {
        
        // Merge strategy: Add records that don't already exist locally.
        await safeAddMissing(db.items, data.items || []);
        await safeAddMissing(db.invoices, fixDates(data.invoices || [], ['createdAt', 'dueDate']));
        await safeAddMissing(db.expenses, fixDates(data.expenses || [], ['date']));
        await safeAddMissing(db.purchases, fixDates(data.purchases || [], ['date', 'orderDate', 'dueDate']));
        await safeAddMissing(db.customers, fixDates(data.customers || [], ['createdAt', 'updatedAt']));
        await safeAddMissing(db.suppliers, data.suppliers || []);
        await safeAddMissing(db.customerPayments, fixDates(data.customerPayments || [], ['date']));
        await safeAddMissing(db.users, data.users || []);
        await safeAddMissing(db.activityLogs, fixDates(data.activityLogs || [], ['timestamp']));
        await safeAddMissing(db.notifications, fixDates(data.notifications || [], ['date']));
        await safeAddMissing(db.cashEntries, fixDates(data.cashEntries || [], ['date']));
        await safeAddMissing(db.cashParties, fixDates(data.cashParties || [], ['createdAt']));
        await safeAddMissing(db.purchasePayments, fixDates(data.purchasePayments || [], ['date']));
        await safeAddMissing(db.categories, data.categories || []);
        await safeAddMissing(db.spreadsheets, fixDates(data.spreadsheets || [], ['createdAt']));
        await safeAddMissing(db.scales, data.scales || []);

        // Optional: Overwrite settings if user imports them
        if (data.businessDetails) {
            localStorage.setItem('businessDetails', data.businessDetails);
        }
        if (data.printerConfig) {
            localStorage.setItem('printerConfig', data.printerConfig);
        }
    });

    return true;
};

export const checkAndPerformAutoBackup = async () => {
    try {
        const enabled = localStorage.getItem('autoBackupEnabled') === 'true';
        const path = localStorage.getItem('autoBackupPath');
        const lastBackup = localStorage.getItem('lastAutoBackupTime');

        if (!enabled || !path) return;

        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // If never backed up, or last backup was > 24 hours ago
        if (!lastBackup || (now - parseInt(lastBackup)) > twentyFourHours) {
            console.log('Performing Automatic Backup...');

            // Check if electron API is available
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const electron = (window as any).electron;
            if (!electron || !electron.saveAutoBackup) {
                console.warn('Auto Backup skipped: Electron API not available');
                return;
            }

            const data = await generateBackupData();
            const success = await electron.saveAutoBackup(path, data);

            if (success) {
                localStorage.setItem('lastAutoBackupTime', now.toString());
                console.log('Auto Backup Success');

            } else {
                console.error('Auto Backup Failed to save file');
            }
        }
    } catch (error) {
        console.error('Auto Backup Error:', error);
    }
};

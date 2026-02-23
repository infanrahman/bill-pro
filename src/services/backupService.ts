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

    await db.transaction('rw', [
        db.items, db.invoices, db.expenses, db.purchases,
        db.customers, db.suppliers, db.customerPayments,
        db.users, db.notifications, db.activityLogs,
        db.cashEntries, db.cashParties, db.purchasePayments
    ], async () => {
        await db.items.clear();
        await db.invoices.clear();
        await db.expenses.clear();
        await db.purchases.clear();
        await db.customers.clear();
        await db.suppliers.clear();
        await db.customerPayments.clear();
        await db.users.clear();
        await db.activityLogs.clear();
        await db.activityLogs.clear();
        await db.notifications.clear();
        await db.cashEntries.clear();
        await db.cashParties.clear();
        await db.purchasePayments.clear();

        await db.items.bulkAdd(data.items || []);

        // Helper to fix dates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fixDates = (arr: any[], dateFields: string[]) => arr.map((item: any) => {
            const newItem = { ...item };
            dateFields.forEach(f => {
                if (newItem[f]) newItem[f] = new Date(newItem[f]);
            });
            return newItem;
        });

        await db.invoices.bulkAdd(fixDates(data.invoices || [], ['createdAt', 'dueDate']));
        await db.expenses.bulkAdd(fixDates(data.expenses || [], ['date']));
        await db.purchases.bulkAdd(fixDates(data.purchases || [], ['date', 'orderDate', 'dueDate']));
        await db.customers.bulkAdd(fixDates(data.customers || [], ['createdAt', 'updatedAt']));
        await db.suppliers.bulkAdd(data.suppliers || []);
        await db.customerPayments.bulkAdd(fixDates(data.customerPayments || [], ['date']));
        await db.users.bulkAdd(data.users || []);
        await db.activityLogs.bulkAdd(fixDates(data.activityLogs || [], ['timestamp']));
        await db.activityLogs.bulkAdd(fixDates(data.activityLogs || [], ['timestamp']));
        await db.notifications.bulkAdd(fixDates(data.notifications || [], ['date']));
        await db.cashEntries.bulkAdd(fixDates(data.cashEntries || [], ['date']));
        await db.cashParties.bulkAdd(fixDates(data.cashParties || [], ['createdAt']));
        await db.purchasePayments.bulkAdd(fixDates(data.purchasePayments || [], ['date']));

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

                // Check if Google Drive is connected
                if (electron.googleDrive) {
                    const isConnected = await electron.googleDrive.getStatus();
                    if (isConnected) {
                        const driveSuccess = await electron.googleDrive.upload(`AutoBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, data);
                        if (driveSuccess) console.log('Google Drive Backup Success');
                        else console.error('Google Drive Backup Failed');
                    }
                }

            } else {
                console.error('Auto Backup Failed to save file');
            }
        }
    } catch (error) {
        console.error('Auto Backup Error:', error);
    }
};

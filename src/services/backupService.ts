import { db } from './db';

// Current backup format version — bump this when schema changes
const BACKUP_VERSION = '1.2.0';

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
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 branches?: any[];
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 shifts?: any[];
 businessDetails: string | null;
 printerConfig: string | null;
 timestamp: number;
 version: string;
}

// Fix #2 & #3: Strict schema validation — checks required fields are arrays
const validateBackupData = (data: unknown): data is BackupData => {
 if (!data || typeof data !== 'object') return false;
 const d = data as Record<string, unknown>;

 // Required top-level array fields
 const requiredArrayFields = ['items', 'invoices', 'expenses', 'purchases', 'customers', 'suppliers', 'customerPayments', 'users'];
 for (const field of requiredArrayFields) {
 if (!Array.isArray(d[field])) {
 console.error(`Backup validation failed:"${field}"is missing or not an array.`);
 return false;
 }
 }

 // Timestamp must be a finite number
 if (typeof d['timestamp'] !== 'number' || !isFinite(d['timestamp'] as number)) {
 console.error('Backup validation failed:"timestamp"is invalid.');
 return false;
 }

 return true;
};

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
 branches: await db.branches.toArray(),
 shifts: await db.shifts.toArray(),
 businessDetails: localStorage.getItem('businessDetails'),
 printerConfig: localStorage.getItem('printerConfig'),
 timestamp: Date.now(),
 version: BACKUP_VERSION // Fix #17: use constant, not hardcoded string
 };
 return JSON.stringify(exportData, null, 2);
};

export const restoreBackupData = async (jsonContent: string) => {
 let data: unknown;
 try {
 data = JSON.parse(jsonContent);
 } catch {
 throw new Error('Invalid backup file: could not parse JSON.');
 }

 // Fix #2: Validate structure before touching the DB
 if (!validateBackupData(data)) {
 throw new Error('Invalid backup file: required fields are missing or malformed.');
 }

 // Fix #3: Use actual Dexie primary keys instead of hardcoding`.id`
 // safeAddMissing uses the table's own primaryKeys() — works for all key types
 const safeAddMissing = async (table: ReturnType<typeof db.table>, items: unknown[]) => {
 if (!items || items.length === 0) return;

 // Fetch all existing primary key values from the table
 const existingKeys = new Set(await table.toCollection().primaryKeys());

 // Get this table's primary key field name from Dexie's schema
 const pkField = table.schema.primKey.keyPath as string ?? 'id';

 // Filter to only new records
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const newItems = (items as any[]).filter((item: any) => !existingKeys.has(item[pkField]));

 if (newItems.length > 0) {
 await table.bulkAdd(newItems);
 }
 };

 // Helper to fix dates
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 db.categories, db.spreadsheets, db.scales, db.branches, db.shifts
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
 await safeAddMissing(db.branches, data.branches || []);
 await safeAddMissing(db.shifts, fixDates(data.shifts || [], ['startTime', 'endTime']));

 // Optional: Overwrite settings if user imports them
 if (data.businessDetails) {
 const detailsStr = typeof data.businessDetails === 'string'
 ? data.businessDetails
 : JSON.stringify(data.businessDetails);
 localStorage.setItem('businessDetails', detailsStr);
 }
 if (data.printerConfig) {
 const printerStr = typeof data.printerConfig === 'string'
 ? data.printerConfig
 : JSON.stringify(data.printerConfig);
 localStorage.setItem('printerConfig', printerStr);
 }
 });

 // Ensure a valid branch is selected after restore
 const currentBranchId = localStorage.getItem('currentBranchId');
 const dbBranches = await db.branches.toArray();
 if (dbBranches.length > 0) {
 const exists = dbBranches.some(b => b.id === currentBranchId);
 if (!exists) {
 localStorage.setItem('currentBranchId', dbBranches[0].id);
 }
 }

 return true;
};

// Fix #1 & #10: Returns a result object so the caller can show user-facing notifications.
export type AutoBackupResult = 
 | { status: 'skipped'; reason: 'disabled' | 'no_path' | 'not_due' | 'no_electron' }
 | { status: 'success'; timestamp: number }
 | { status: 'error'; message: string };

export const checkAndPerformAutoBackup = async (): Promise<AutoBackupResult> => {
 try {
 const enabled = localStorage.getItem('autoBackupEnabled') === 'true';
 const path = localStorage.getItem('autoBackupPath');
 const lastBackup = localStorage.getItem('lastAutoBackupTime');

 if (!enabled) return { status: 'skipped', reason: 'disabled' };
 if (!path) return { status: 'skipped', reason: 'no_path' };

 const now = Date.now();
 const twentyFourHours = 24 * 60 * 60 * 1000;

 // If never backed up, or last backup was > 24 hours ago
 if (lastBackup && (now - parseInt(lastBackup)) <= twentyFourHours) {
 return { status: 'skipped', reason: 'not_due' };
 }

 console.log('Performing Automatic Backup...');

 // Check if electron API is available
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const electron = (window as any).electron;
 if (!electron || !electron.saveAutoBackup) {
 console.warn('Auto Backup skipped: Electron API not available');
 return { status: 'skipped', reason: 'no_electron' };
 }

 const data = await generateBackupData();
 const success = await electron.saveAutoBackup(path, data);

 if (success) {
 localStorage.setItem('lastAutoBackupTime', now.toString());
 console.log('Auto Backup Success');
 return { status: 'success', timestamp: now };
 } else {
 console.error('Auto Backup Failed to save file');
 return { status: 'error', message: 'Failed to write backup file. Check folder permissions.' };
 }
 } catch (error) {
 const msg = error instanceof Error ? error.message : 'Unknown error';
 console.error('Auto Backup Error:', error);
 return { status: 'error', message: msg };
 }
};

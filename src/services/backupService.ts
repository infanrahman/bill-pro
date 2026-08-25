import { db } from './db';

const BACKUP_VERSION = '2.0.0';

export interface BackupMetadata {
  tableNames: string[];
  recordCounts: Record<string, number>;
}

export interface BackupData {
  // Legacy explicitly named tables for backward compatibility with v1 restores
  items?: any[];
  invoices?: any[];
  expenses?: any[];
  purchases?: any[];
  customers?: any[];
  suppliers?: any[];
  customerPayments?: any[];
  users?: any[];
  activityLogs?: any[];
  notifications?: any[];
  cashEntries?: any[];
  cashParties?: any[];
  purchasePayments?: any[];
  categories?: any[];
  spreadsheets?: any[];
  scales?: any[];
  branches?: any[];
  shifts?: any[];

  // Legacy localStorage strings
  businessDetails?: string | object | null;
  businessProfile?: string | object | null;
  printerConfig?: string | object | null;
  appSettings?: string | object | null;
  zatca_config?: string | object | null;
  reminderSettings?: string | object | null;

  // V2 Dynamic Fields
  databaseData?: Record<string, any[]>;
  localStorageData?: Record<string, string>;
  metadata?: BackupMetadata;

  timestamp: number;
  version: string;
}

// Strict schema validation — checks integrity using metadata if available
const validateBackupData = (data: unknown): data is BackupData => {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  // Timestamp must be a finite number
  if (typeof d['timestamp'] !== 'number' || !isFinite(d['timestamp'] as number)) {
    console.error('Backup validation failed: "timestamp" is invalid.');
    return false;
  }

  // V2 Dynamic Integrity Check
  if (d['metadata'] && d['databaseData']) {
    const metadata = d['metadata'] as BackupMetadata;
    const databaseData = d['databaseData'] as Record<string, any[]>;
    
    if (!Array.isArray(metadata.tableNames) || typeof metadata.recordCounts !== 'object') {
      console.error('Backup validation failed: metadata is malformed.');
      return false;
    }
    
    for (const tableName of metadata.tableNames) {
      const tableData = databaseData[tableName];
      if (!Array.isArray(tableData)) {
        console.error(`Backup validation failed: data for table "${tableName}" is missing or not an array.`);
        return false;
      }
      if (tableData.length !== metadata.recordCounts[tableName]) {
        console.error(`Backup validation failed: record count mismatch for table "${tableName}". Expected ${metadata.recordCounts[tableName]}, got ${tableData.length}.`);
        return false;
      }
    }
  } else {
    // V1 Legacy Structure Check
    const requiredArrayFields = ['items', 'invoices', 'expenses', 'purchases', 'customers', 'suppliers', 'customerPayments', 'users'];
    for (const field of requiredArrayFields) {
      if (!Array.isArray(d[field])) {
        console.error(`Backup validation failed (legacy mode): "${field}" is missing or not an array.`);
        return false;
      }
    }
  }

  return true;
};

/**
 * Serialises a localStorage value for inclusion in the backup JSON.
 */
const readLocalStorageKey = (key: string): string | null => {
  return localStorage.getItem(key);
};

export const generateBackupData = async (): Promise<string> => {
  const databaseData: Record<string, any[]> = {};
  const metadata: BackupMetadata = {
    tableNames: [],
    recordCounts: {}
  };

  // 1. Export all tables dynamically (future-proof)
  for (const table of db.tables) {
    const records = await table.toArray();
    databaseData[table.name] = records;
    metadata.tableNames.push(table.name);
    metadata.recordCounts[table.name] = records.length;
  }

  // 2. Export all localStorage dynamically (future-proof)
  const localStorageData: Record<string, string> = {};
  // Exclude transient or machine-specific tokens that shouldn't be backed up
  const EXCLUDED_KEYS = ['user', 'currentUser', 'token', 'lastAutoBackupTime'];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !EXCLUDED_KEYS.includes(key)) {
      localStorageData[key] = localStorage.getItem(key) || '';
    }
  }

  const businessDetailsRaw = localStorage.getItem('businessDetails') || localStorage.getItem('businessProfile') || null;

  const exportData: BackupData = {
    // V2 Dynamic payload
    databaseData,
    localStorageData,
    metadata,
    
    // V1 legacy payload (preserved for downgrading to older app versions)
    items: databaseData['items'] || [],
    invoices: databaseData['invoices'] || [],
    expenses: databaseData['expenses'] || [],
    purchases: databaseData['purchases'] || [],
    customers: databaseData['customers'] || [],
    suppliers: databaseData['suppliers'] || [],
    customerPayments: databaseData['customerPayments'] || [],
    users: databaseData['users'] || [],
    activityLogs: databaseData['activityLogs'] || [],
    notifications: databaseData['notifications'] || [],
    cashEntries: databaseData['cashEntries'] || [],
    cashParties: databaseData['cashParties'] || [],
    purchasePayments: databaseData['purchasePayments'] || [],
    categories: databaseData['categories'] || [],
    spreadsheets: databaseData['spreadsheets'] || [],
    scales: databaseData['scales'] || [],
    branches: databaseData['branches'] || [],
    shifts: databaseData['shifts'] || [],

    businessDetails: businessDetailsRaw,
    businessProfile: businessDetailsRaw,
    printerConfig: readLocalStorageKey('printerConfig'),
    appSettings: readLocalStorageKey('appSettings'),
    zatca_config: readLocalStorageKey('zatca_config'),
    reminderSettings: readLocalStorageKey('reminderSettings'),

    timestamp: Date.now(),
    version: BACKUP_VERSION,
  };
  return JSON.stringify(exportData, null, 2);
};

/**
 * Restores all application data from a backup JSON string.
 * - Validates completeness and integrity before proceeding.
 * - Clears all IndexedDB tables and dynamically restores them.
 * - Restores all localStorage settings dynamically.
 */
export const restoreBackupData = async (jsonContent: string): Promise<void> => {
  let data: unknown;
  try {
    data = JSON.parse(jsonContent);
  } catch {
    throw new Error('Invalid backup file: could not parse JSON.');
  }

  if (!validateBackupData(data)) {
    throw new Error('Invalid backup file: integrity check failed. The backup file is corrupted or incomplete.');
  }

  const backup = data as BackupData;
  const isV2 = !!(backup.metadata && backup.databaseData);

  // Helper to revive ISO date strings in objects
  const reviveDates = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(reviveDates);
    const result: any = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        result[key] = new Date(val);
      } else if (val !== null && typeof val === 'object') {
        result[key] = reviveDates(val);
      } else {
        result[key] = val;
      }
    }
    return result;
  };

  const processRecords = (records: any[]) => records.map(reviveDates);

  // Helper: safely restore a localStorage setting from the backup (for V1).
  const restoreLocalStorageKey = (key: string, value: string | object | null | undefined) => {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return;
    }
    if (typeof value === 'string') {
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  // ── 1. Restore all IndexedDB tables inside a single read-write transaction ──
  // Passing db.tables allows dynamic access to all registered tables
  await db.transaction('rw', db.tables, async () => {
    // Clear every table first
    for (const table of db.tables) {
      await table.clear();
    }

    if (isV2 && backup.databaseData) {
      // V2: Dynamic restore based on tables in the backup
      for (const table of db.tables) {
        const tableData = backup.databaseData[table.name];
        if (tableData && Array.isArray(tableData) && tableData.length > 0) {
          await table.bulkAdd(processRecords(tableData));
        }
      }
    } else {
      // V1: Legacy explicit mapping
      const legacyMap: Record<string, any[] | undefined> = {
        branches: backup.branches,
        items: backup.items,
        customers: backup.customers,
        customerPayments: backup.customerPayments,
        invoices: backup.invoices,
        expenses: backup.expenses,
        purchases: backup.purchases,
        purchasePayments: backup.purchasePayments,
        suppliers: backup.suppliers,
        users: backup.users,
        activityLogs: backup.activityLogs,
        notifications: backup.notifications,
        cashEntries: backup.cashEntries,
        cashParties: backup.cashParties,
        spreadsheets: backup.spreadsheets,
        scales: backup.scales,
        categories: backup.categories,
        shifts: backup.shifts,
      };

      for (const table of db.tables) {
        const tableData = legacyMap[table.name];
        if (tableData && Array.isArray(tableData) && tableData.length > 0) {
          await table.bulkAdd(processRecords(tableData));
        }
      }
    }
  });

  // ── 2. Restore all localStorage settings ──
  if (isV2 && backup.localStorageData) {
    // V2: Dynamically restore all localStorage items
    for (const [key, value] of Object.entries(backup.localStorageData)) {
      if (value !== null && value !== undefined) {
        localStorage.setItem(key, value);
      }
    }
  } else {
    // V1: Legacy explicit restore
    const businessValue = backup.businessDetails ?? backup.businessProfile ?? null;
    restoreLocalStorageKey('businessDetails', businessValue);
    restoreLocalStorageKey('businessProfile', businessValue);

    restoreLocalStorageKey('printerConfig', backup.printerConfig);
    restoreLocalStorageKey('appSettings', backup.appSettings);
    restoreLocalStorageKey('zatca_config', backup.zatca_config);
    restoreLocalStorageKey('reminderSettings', backup.reminderSettings);
  }

  // ── 3. Post-Restore Fallbacks and Normalization ──
  const branchesTable = isV2 && backup.databaseData ? backup.databaseData['branches'] : backup.branches;
  
  if (branchesTable && branchesTable.length > 0) {
    const currentBranchId = localStorage.getItem('currentBranchId');
    const exists = branchesTable.some((b: { id: string }) => b.id === currentBranchId);
    if (!exists) {
      localStorage.setItem('currentBranchId', branchesTable[0].id);
    }
  }

  // Fallback: if business profile is entirely missing, derive from master branch
  const finalBusinessDetails = localStorage.getItem('businessDetails');
  if (!finalBusinessDetails && branchesTable && branchesTable.length > 0) {
    const masterBranch = branchesTable.find((b: any) => b.isMaster) ?? branchesTable[0];
    if (masterBranch) {
      const gstin = masterBranch.gstin || masterBranch.vatNo || '';
      const derived = JSON.stringify({
        name: masterBranch.name || '',
        address: masterBranch.location || '',
        phone: masterBranch.phone || '',
        email: masterBranch.email || '',
        gstin,
        vatNo: gstin,
        crNo: masterBranch.crNo || '',
        logoUrl: masterBranch.logoUrl || '',
        country: masterBranch.country || 'Saudi Arabia',
        taxName: masterBranch.taxName || 'VAT',
        taxRate: masterBranch.taxRate ?? 15,
        pincode: masterBranch.pincode || '',
        terms: masterBranch.terms || '',
        primaryTitle: masterBranch.primaryTitle || '',
        secondaryTitle: masterBranch.secondaryTitle || '',
      });
      localStorage.setItem('businessDetails', derived);
      localStorage.setItem('businessProfile', derived);
    }
  }

  console.log('Backup restored successfully.');
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

 // Skip only if last backup was LESS than 24 hours ago (fix: was incorrectly using <=)
 if (lastBackup && (now - parseInt(lastBackup, 10)) < twentyFourHours) {
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

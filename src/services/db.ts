import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

// Helper to get current branch ID (Placeholder until Phase 4)
export const getCurrentBranchId = () => {
 const saved = localStorage.getItem('currentBranchId');
 if (saved) return saved;
 // Default/Master Branch ID - for single store setup
 const defaultId = '00000000-0000-0000-0000-000000000000';
 if (!saved) localStorage.setItem('currentBranchId', defaultId);
 return saved || defaultId;
};

// Helper to create record metadata
export const createRecordMetadata = () => ({
 id: uuidv4(),
 branchId: getCurrentBranchId(),
 updatedAt: new Date()
});

// Helper to update record metadata
export const updateRecordMetadata = () => ({
 updatedAt: new Date()
});

// Helper for soft deletion (local-only)
export const softDeleteMetadata = () => ({
 deletedAt: new Date(),
 updatedAt: new Date()
});

// Helper to mark a record as updated
export const markUpdated = () => ({
 updatedAt: new Date()
});

// Base interface for all entities
export interface SyncEntity {
 id: string; // UUID v4
 branchId: string;
 updatedAt: Date;
 deletedAt?: Date;
}

// Item Interface
export interface Item extends SyncEntity {
 name: string;
 arabicName?: string;
 barcode: string;
 salePrice: number;
 purchasePrice: number;
 taxType: 'inclusive' | 'exclusive';
 taxRate: number;
 stock: number;
 minStock: number;
 location?: string;
 unit?: string; // e.g. 'pcs', 'kg', 'box'
 image?: string; // Base64 encoded image for cafe mode
 supplierId?: string; // Link to specific supplier (UUID)
 categoryId?: string; // Link to specific category (Market Mode) (UUID)
 itemCode?: string; // Scale PLU / Item Code
}

// Category Interface (Market Mode)
export interface Category extends SyncEntity {
 name: string;
 description?: string;
 color?: string; // Hex color code for UI
 icon?: string; // Icon identifier for UI
 createdAt: Date;
}

// Customer Payment Interface
export interface CustomerPayment extends SyncEntity {
 customerId: string; // UUID
 amount: number; // Amount paid by customer
 date: Date;
 paymentMode: 'cash' | 'card' | 'upi' | 'bank_transfer';
 reference?: string;
 note?: string;
}

export interface Invoice extends SyncEntity {
 invoiceNumber: string;
 tokenNumber?: string; // Token number for cafe mode orders
 customerName: string;
 customerId?: string; // UUID
 customerPhone?: string; // Standardized phone field
 customerContact?: string; // Legacy/Fallback
 customerVatNumber?: string;
 customerAddress?: string;
 items: InvoiceItem[];
 subTotal: number;
 taxAmount: number;
 discountAmount: number;
 grandTotal: number;
 paidAmount: number; // New: Amount paid at checkout
 remainingAmount: number; // New: Balance remaining
 paymentMode: 'cash' | 'card' | 'upi' | 'credit' | 'split'; // Added split
 paymentStatus: 'paid' | 'pending' | 'partial' | 'overdue'; // Added partial
 dueDate?: Date;
 taxRate?: number;
 taxType?: 'inclusive' | 'exclusive'; // Added taxType
 type?: 'invoice' | 'order' | 'return'; // Default to 'invoice'
 orderType?: 'dine_in' | 'parcel' | 'pickup' | 'delivery'; // Added for cafe mode
 status?: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'partial' | 'completed';
 notes?: string;
 createdAt: Date;
 zatcaStatus?: 'REPORTED' | 'ERROR' | 'PENDING'; // New: ZATCA Reporting Status
 zatcaHash?: string; // New: XML Hash
 zatcaXml?: string; // New: Raw XML for offline queueing
 zatcaError?: string; // New: Detailed error message
 shiftId?: string; // New: Link to drawer session
}

export interface InvoiceItem {
 itemId: string; // UUID
 name: string;
 nameAr?: string; // Legacy Arabic Name
 arabicName?: string; // New Arabic Name
 quantity: number;
 price: number;
 total: number;
 unit?: string;
 taxType?: 'inclusive' | 'exclusive';
 taxRate?: number;
 taxAmount?: number; // Added for line-level tracking
 discountAmount?: number; // Prorated discount from global, or explicit line discount
 netAmount?: number; // Gross total - discountAmount
 purchasePrice?: number; // Added for historical profit tracking
}

export interface Expense extends SyncEntity {
 description: string;
 amount: number;
 category: string;
 date: Date;
 notes?: string; // New
 receipt?: string; // New (Base64 or URL)
}

export interface PurchaseItem {
 itemId: string; // UUID
 name: string;
 quantity: number;
 cost: number;
 unit?: string;
 taxRate?: number;
 taxType?: 'inclusive' | 'exclusive';
 taxAmount?: number;
 total?: number;
}

export interface Purchase extends SyncEntity {
 orderNumber: string;
 supplierName: string;
 items: PurchaseItem[];
 subTotal?: number;
 taxAmount?: number;
 totalAmount: number;
 date: Date;
 dueDate?: Date;
 paymentType?: 'cash' | 'card' | 'upi' | 'credit';
 paidAmount?: number;
 notes?: string;
 type?: 'bill' | 'order' | 'return'; // New Field
 status?: 'pending' | 'completed' | 'cancelled'; // New Field
 relatedOrderId?: string; // UUID
 supplierId?: string; // UUID
}

export interface User extends SyncEntity {
 username: string;
 password?: string;
 salt?: string; // For PBKDF2
 isHashed?: boolean; // Flag for migration
 iterations?: number; // PBKDF2 iterations count
 role: 'admin' | 'shopkeeper';
 name: string;
 permissions?: string[]; 
 forcePasswordChange?: boolean; // For default admin hardening
}

export interface Notification extends SyncEntity {
 title: string;
 message: string;
 type: 'info' | 'warning' | 'alert' | 'success' | 'error';
 date: Date;
 read: boolean;
 referenceId?: string; // UUID
 referenceType?: 'invoice' | 'stock' | 'payment'; // Added payment
}

export interface Customer extends SyncEntity {
 name: string;
 phone: string;
 email?: string;
 address?: string;
 vatNumber?: string;
 totalSpent: number;
 balance: number; // New: Outstanding Credit Balance
 creditLimit?: number; // Added credit limit
 loyaltyPoints?: number; // Added for POS loyalty program
}

export interface Supplier extends SyncEntity {
 name: string;
 phone: string;
 email?: string;
 location?: string;
 taxNumber?: string;
 balance: number; // Amount we owe them
}

export interface ActivityLog extends SyncEntity {
 userId: string; // UUID
 username: string;
 action: string;
 details?: string;
 timestamp: Date;
}

export interface CashParty extends SyncEntity {
 name: string;
 phone: string;
 openingBalance: number; // Positive = You will get (Receivable), Negative = You will give (Payable)
 type: 'customer' | 'supplier' | 'other';
 createdAt: Date;
}

export interface CashEntry extends SyncEntity {
 type: 'in' | 'out';
 amount: number;
 date: Date;
 category: string;
 description: string; // Notes
 paymentMode: 'cash'; // Fixed for Cash Book
 partyId?: string; // UUID
}

// Purchase Payment Interface
export interface PurchasePayment extends SyncEntity {
 purchaseId?: string; // UUID
 supplierId: string; // UUID
 amount: number;
 date: Date;
 paymentMode: 'cash' | 'card' | 'upi' | 'bank_transfer';
 reference?: string;
 note?: string;
}

// Spreadsheet Interface
export interface SpreadsheetData extends SyncEntity {
 name: string;
 description?: string;
 data: any[][];
 headers: string[];
 styles: Record<string, any>;
 colWidths: Record<number, number>;
 rowHeights: Record<number, number>;
 createdAt: Date;
}


// Shift Management Interface
export interface Shift extends SyncEntity {
 userId: string;
 username: string;
 openTime: Date;
 closeTime?: Date;
 openingFloat: number; // Starting cash
 actualCash?: number; // Reported cash at end
 expectedCash?: number; // Calculated (float + cash sales + cash entries)
 totalCashSales: number;
 totalCardSales: number;
 totalUpiSales: number;
 totalCreditSales: number;
 status: 'open' | 'closed';
 notes?: string;
}



// Weighing Scale Interface
export interface Scale extends SyncEntity {
 name: string;
 ipAddress: string;
 port: number;
 model: string; // e.g., 'Rongta', 'CAS', 'Dibal', 'Generic'
 status: 'online' | 'offline' | 'unknown';
 lastSync?: Date;
 createdAt: Date;
}

export interface ScaleSyncLog extends SyncEntity {
 scaleIp: string;
 action: string;
 pluNo?: string;
 status: 'success' | 'failed';
 response?: string;
 createdAt: Date;
}

// Branch Interface
export interface Branch extends SyncEntity {
 name: string;
 location: string; // Address
 phone: string;
 email?: string;
 gstin?: string; // Tax Registration No
 vatNo?: string; // Legacy/Additional VAT No
 crNo?: string; // Commercial Registration No
 logoUrl?: string;
 country?: string;
 taxName?: string;
 taxRate?: number;
 pincode?: string;
 terms?: string;
 isMaster: boolean; // Only one master branch usually
 status: 'active' | 'inactive';
 // ZATCA Chaining (Phase 2)
 lastInvoiceHash?: string; // PIH
 invoiceCounter?: number; // ICV
 primaryTitle?: string;
 secondaryTitle?: string;
}

// Database Class
class AppDatabase extends Dexie {
 branches!: Table<Branch>;
 items!: Table<Item>;
 customers!: Table<Customer>;
 customerPayments!: Table<CustomerPayment>;
 invoices!: Table<Invoice>;
 expenses!: Table<Expense>;
 purchases!: Table<Purchase>;
 purchasePayments!: Table<PurchasePayment>; // New Table
 suppliers!: Table<Supplier>;
 users!: Table<User>;
 activityLogs!: Table<ActivityLog>;
 notifications!: Table<Notification>;
 cashEntries!: Table<CashEntry>; // New Table
 cashParties!: Table<CashParty>; // New Table v13
 spreadsheets!: Table<SpreadsheetData>; // New Table v15
 scales!: Table<Scale>; // New Table v16
 categories!: Table<Category>; // New Table v17
 scaleLogs!: Table<ScaleSyncLog>; // New Table v18
 shifts!: Table<Shift>; // New: Shift Management

 constructor() {
 super('MyShopDB'); // Ensuring name is consistent with what was likely used or acceptable

 // Define schema versions
 // Simplified previous versions for compactness, but crucial ones kept

 this.version(1).stores({
 items: '++id, name, barcode, category, stock, minStock',
 customers: '++id, name, phone, email',
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status',
 expenses: '++id, category, date',
 users: '++id, username, role',
 notifications: '++id, type, date, read'
 });

 // Version 5: Credit System (Historical reference)
 this.version(5).stores({
 customers: '++id, name, phone',
 invoices: '++id, invoiceNumber, customerName, customerId, createdAt, paymentStatus, dueDate',
 customerPayments: '++id, customerId, date'
 });

 // Version 8: Purchase Types
 this.version(8).stores({
 purchases: '++id, orderNumber, date, supplierName, dueDate, type, status'
 });

 // Version 10: Suppliers
 this.version(10).stores({
 suppliers: '++id, name, phone, email',
 purchases: '++id, orderNumber, date, supplierName, dueDate, type, status, relatedOrderId, supplierId'
 });

 // Version 12: Cash Book
 this.version(12).stores({
 items: '++id, name, barcode, category, stock, minStock',
 customers: '++id, name, phone, email',
 customerPayments: '++id, customerId, date, paymentMode',
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status',
 expenses: '++id, category, date',
 purchases: '++id, orderNumber, supplierId, date, status, type',
 suppliers: '++id, name, phone, email',
 users: '++id, username, role',
 activityLogs: '++id, userId, action, timestamp',
 notifications: '++id, type, date, read',
 cashEntries: '++id, type, date, category' // New Table Schema
 });

 // Version 13: Party Ledger & Purchase Payments [UPDATED]
 this.version(13).stores({
 cashEntries: '++id, type, date, category, partyId',
 cashParties: '++id, name, type',
 purchasePayments: '++id, supplierId, date, purchaseId' // New Table
 });

 // Version 14: ZATCA Reporting Link
 this.version(14).stores({
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status, zatcaStatus' // Added index for zatcaStatus
 });

 // Version 15: Spreadsheet Support
 this.version(15).stores({
 spreadsheets: '++id, name, createdAt'
 });

 // Version 16: IP Weighing Scales
 this.version(16).stores({
 scales: '++id, name, ipAddress, status'
 });

 // Version 17: Market Mode Categories
 this.version(17).stores({
 categories: '++id, name',
 items: '++id, name, barcode, categoryId, stock, minStock' // Update items to index categoryId
 });

 // Version 18: Scale Sync Logs
 this.version(18).stores({
 scaleLogs: '++id, scaleIp, action, pluNo, status, createdAt'
 });

 // Version 19: Add Item Code / PLU indexing
 this.version(19).stores({
 items: '++id, name, barcode, itemCode, categoryId, stock, minStock'
 });

 // Version 20: TRANSITION TO UUID
 this.version(20).stores({
 items: '++id, name, barcode, itemCode, categoryId, stock, branchId',
 customers: '++id, name, phone, branchId',
 customerPayments: '++id, customerId, date, branchId',
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status, zatcaStatus, branchId',
 expenses: '++id, category, date, branchId',
 purchases: '++id, orderNumber, supplierId, date, status, type, branchId',
 purchasePayments: '++id, supplierId, date, purchaseId, branchId',
 suppliers: '++id, name, phone, branchId',
 users: '++id, username, role, branchId',
 activityLogs: '++id, userId, action, timestamp, branchId',
 notifications: '++id, type, date, read, branchId',
 cashEntries: '++id, type, date, category, partyId, branchId',
 cashParties: '++id, name, type, branchId',
 spreadsheets: '++id, name, createdAt, branchId',
 scales: '++id, name, ipAddress, status, branchId',
 categories: '++id, name, branchId',
 scaleLogs: '++id, scaleIp, action, pluNo, status, createdAt, branchId',
 branches: '++id, name, status'
 }).upgrade(async tx => {
 const branchId = getCurrentBranchId();
 const now = new Date();

 const tables = [
 'branches', 'items', 'customers', 'customerPayments', 'invoices', 'expenses', 
 'purchases', 'purchasePayments', 'suppliers', 'users', 'activityLogs', 
 'notifications', 'cashEntries', 'cashParties', 'spreadsheets', 'scales', 
 'categories', 'scaleLogs'
 ];

 // Global map of TableName -> Map(OldID -> NewUUID)
 const globalIdMap = new Map<string, Map<number, string>>();

 // PASS 1: Generate new UUIDs for all records across all tables
 for (const tableName of tables) {
 const table = tx.table(tableName);
 const records = await table.toArray();
 const tableIdMap = new Map<number, string>();
 
 for (const record of records) {
 if (typeof record.id === 'number') {
 const newId = uuidv4();
 tableIdMap.set(record.id, newId);
 }
 }
 globalIdMap.set(tableName, tableIdMap);
 }

 // PASS 2: Apply remapping and save
 for (const tableName of tables) {
 const table = tx.table(tableName);
 const records = await table.toArray();
 const tableIdMap = globalIdMap.get(tableName);

 for (const record of records) {
 // Update main ID
 if (tableIdMap && tableIdMap.has(record.id)) {
 record.id = tableIdMap.get(record.id);
 record.branchId = branchId;
 record.updatedAt = now;
 }

 // Map Foreign Keys
 if (tableName === 'items') {
 if (typeof record.supplierId === 'number') record.supplierId = globalIdMap.get('suppliers')?.get(record.supplierId) || String(record.supplierId);
 if (typeof record.categoryId === 'number') record.categoryId = globalIdMap.get('categories')?.get(record.categoryId) || String(record.categoryId);
 }
 if (tableName === 'customerPayments') {
 if (typeof record.customerId === 'number') record.customerId = globalIdMap.get('customers')?.get(record.customerId) || String(record.customerId);
 }
 if (tableName === 'invoices') {
 if (typeof record.customerId === 'number') record.customerId = globalIdMap.get('customers')?.get(record.customerId) || String(record.customerId);
 record.items?.forEach((item: any) => {
 if (typeof item.itemId === 'number') item.itemId = globalIdMap.get('items')?.get(item.itemId) || String(item.itemId);
 });
 }
 if (tableName === 'purchases') {
 if (typeof record.supplierId === 'number') record.supplierId = globalIdMap.get('suppliers')?.get(record.supplierId) || String(record.supplierId);
 if (typeof record.relatedOrderId === 'number') record.relatedOrderId = globalIdMap.get('invoices')?.get(record.relatedOrderId) || String(record.relatedOrderId);
 record.items?.forEach((item: any) => {
 if (typeof item.itemId === 'number') item.itemId = globalIdMap.get('items')?.get(item.itemId) || String(item.itemId);
 });
 }
 if (tableName === 'purchasePayments') {
 if (typeof record.purchaseId === 'number') record.purchaseId = globalIdMap.get('purchases')?.get(record.purchaseId) || String(record.purchaseId);
 if (typeof record.supplierId === 'number') record.supplierId = globalIdMap.get('suppliers')?.get(record.supplierId) || String(record.supplierId);
 }
 if (tableName === 'activityLogs') {
 if (typeof record.userId === 'number') record.userId = globalIdMap.get('users')?.get(record.userId) || String(record.userId);
 }
 if (tableName === 'notifications') {
 if (typeof record.referenceId === 'number') {
 // Try matching across common referenced tables
 const refId = record.referenceId;
 record.referenceId = globalIdMap.get('invoices')?.get(refId) || 
 globalIdMap.get('items')?.get(refId) || 
 globalIdMap.get('customerPayments')?.get(refId) || 
 String(refId);
 }
 }
 if (tableName === 'cashEntries') {
 if (typeof record.partyId === 'number') record.partyId = globalIdMap.get('cashParties')?.get(record.partyId) || String(record.partyId);
 }
 }

 // 3. Save migrated records back to the table atomicity
 await table.clear();
 await table.bulkAdd(records);
 }
 console.log("Database successfully migrated to Version 20 (UUID with preserved relations)");
 console.log("Database successfully migrated to Version 20 (UUID & Cloud Sync Foundation)");
 });

 // Version 21: Optimized Indexes for Sales Queries
 this.version(21).stores({
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status, zatcaStatus, branchId, [branchId+createdAt]'
 });

 // Version 22: Final Cleanup
 this.version(22).stores({});

 // Version 23: Shift Management
 this.version(23).stores({
 shifts: '++id, userId, status, branchId',
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status, zatcaStatus, branchId, shiftId'
 });

 // Version 24: Restore optimized compound index missing in v23
 this.version(24).stores({
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status, zatcaStatus, branchId, shiftId, [branchId+createdAt]'
 });

 // Version 25: Stable fully-declared single-store database schema (no branch scoping needed)
 this.version(25).stores({
 branches: '++id, name, status',
 items: '++id, name, barcode, itemCode, categoryId, stock, branchId',
 customers: '++id, name, phone, branchId',
 customerPayments: '++id, customerId, date, branchId',
 invoices: '++id, invoiceNumber, customerId, createdAt, type, paymentStatus, status, zatcaStatus, branchId, shiftId, [branchId+createdAt]',
 expenses: '++id, category, date, branchId',
 purchases: '++id, orderNumber, supplierId, date, status, type, branchId',
 purchasePayments: '++id, supplierId, date, purchaseId, branchId',
 suppliers: '++id, name, phone, branchId',
 users: '++id, username, role, branchId',
 activityLogs: '++id, userId, action, timestamp, branchId',
 notifications: '++id, type, date, read, branchId',
 cashEntries: '++id, type, date, category, partyId, branchId',
 cashParties: '++id, name, type, branchId',
 spreadsheets: '++id, name, createdAt, branchId',
 scales: '++id, name, ipAddress, status, branchId',
 categories: '++id, name, branchId',
 scaleLogs: '++id, scaleIp, action, pluNo, status, createdAt, branchId',
 shifts: '++id, userId, status, branchId'
 });

 }
}

export const db = new AppDatabase();

// Request persistent storage status to protect against silent browser evictions under storage pressure
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
 navigator.storage.persist().then(persistent => {
 if (persistent) {
 console.log("Database persistent storage status: GRANTED. Chromium will not evict database.");
 } else {
 console.warn("Database persistent storage status: DENIED. Database could be evicted under low disk conditions.");
 }
 }).catch(err => {
 console.error("Failed to request database storage persistence:", err);
 });
}

// Factory Reset Function
export const resetApplicationData = async () => {
 await db.transaction('rw', [
 db.items, db.customers, db.customerPayments, db.invoices, db.expenses,
 db.purchases, db.purchasePayments, db.suppliers, db.users, db.activityLogs,
 db.notifications, db.cashEntries, db.cashParties, db.spreadsheets,
 db.scales, db.categories, db.scaleLogs, db.branches, db.shifts
 ], async () => {
 // 1. Preserve Admin Users
 const adminUsers = await db.users.where('role').equals('admin').toArray();

 // 2. Truncate Tables
 await db.items.clear();
 await db.customers.clear();
 await db.customerPayments.clear();
 await db.invoices.clear();
 await db.expenses.clear();
 await db.purchases.clear();
 await db.purchasePayments.clear();
 await db.suppliers.clear();
 await db.activityLogs.clear();
 await db.notifications.clear();
 await db.cashEntries.clear();
 await db.cashParties.clear();
 await db.spreadsheets.clear();
 await db.scales.clear();
 await db.scaleLogs.clear();
 await db.branches.clear();
 await db.shifts.clear();
 await db.users.clear();

 // 3. Restore Admin Users
 await db.users.bulkAdd(adminUsers);
 });

 // 4. Clear LocalStorage (Filtering specific keys)
 const keysToKeep = ['i18nextLng', 'theme', 'zatca_config', 'zatca_enabled']; // Keep ZATCA to avoid re-onboarding pain unless explicit
 // const currentAdmin = localStorage.getItem('user'); // Keep current session if possible (Removed unused warning)

 // We actually want to clear settings like 'businessDetails', 'printerConfig', etc.
 // So we iterate and remove ones NOT in allowlist
 Object.keys(localStorage).forEach(key => {
 if (!keysToKeep.includes(key) && key !== 'user' && key !== 'token') {
 localStorage.removeItem(key);
 }
 });
};

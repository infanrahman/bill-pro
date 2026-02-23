import Dexie, { type Table } from 'dexie';

// Item Interface
export interface Item {
    id?: number;
    name: string;
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
}

// Customer Payment Interface
export interface CustomerPayment {
    id?: number;
    customerId: number;
    amount: number; // Amount paid by customer
    date: Date;
    paymentMode: 'cash' | 'card' | 'upi' | 'bank_transfer';
    reference?: string;
    note?: string;
}

export interface Invoice {
    id?: number;
    invoiceNumber: string;
    tokenNumber?: string; // Token number for cafe mode orders
    customerName: string;
    customerId?: number;
    customerPhone?: string; // Standardized phone field
    customerContact?: string; // Legacy/Fallback
    customerVatNumber?: string;
    customerAddress?: string;
    items: InvoiceItem[];
    subTotal: number;
    taxAmount: number;
    discountAmount: number;
    grandTotal: number;
    paidAmount: number;      // New: Amount paid at checkout
    remainingAmount: number; // New: Balance remaining
    paymentMode: 'cash' | 'card' | 'upi' | 'credit' | 'split'; // Added split
    paymentStatus: 'paid' | 'pending' | 'partial' | 'overdue'; // Added partial
    dueDate?: Date;
    taxRate?: number;
    type?: 'invoice' | 'order' | 'return'; // Default to 'invoice'
    status?: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'partial' | 'completed';
    notes?: string;
    createdAt: Date;
    zatcaStatus?: 'REPORTED' | 'ERROR' | 'PENDING'; // New: ZATCA Reporting Status
    zatcaHash?: string; // New: XML Hash
}

export interface InvoiceItem {
    itemId: number; // Keep consistent with previous definition
    name: string;
    nameAr?: string; // Arabic Name
    quantity: number;
    price: number;
    total: number;
    unit?: string;
    taxType?: 'inclusive' | 'exclusive';
    taxRate?: number;
}

export interface Expense {
    id?: number;
    description: string;
    amount: number;
    category: string;
    date: Date;
    notes?: string;   // New
    receipt?: string; // New (Base64 or URL)
}

export interface PurchaseItem {
    itemId: number;
    name: string;
    quantity: number;
    cost: number;
    unit?: string;
    taxRate?: number;
    taxType?: 'inclusive' | 'exclusive';
    taxAmount?: number;
    total?: number;
}

export interface Purchase {
    id?: number;
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
    relatedOrderId?: number;
    supplierId?: number;
}

export interface User {
    id?: number;
    username: string;
    password?: string;
    role: 'admin' | 'shopkeeper';
    name: string;
    permissions?: string[]; // New: Granular permissions e.g. ['sales', 'inventory']
}

export interface Notification {
    id?: number;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'alert' | 'success' | 'error';
    date: Date;
    read: boolean;
    referenceId?: number; // e.g. Invoice ID
    referenceType?: 'invoice' | 'stock' | 'payment'; // Added payment
}

export interface Customer {
    id?: number;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    vatNumber?: string;
    totalSpent: number;
    balance: number; // New: Outstanding Credit Balance
    creditLimit?: number; // Added credit limit
}

export interface Supplier {
    id?: number;
    name: string;
    phone: string;
    email?: string;
    location?: string;
    taxNumber?: string;
    balance: number; // Amount we owe them
}

export interface ActivityLog {
    id?: number;
    userId: number;
    username: string;
    action: string;
    details?: string;
    timestamp: Date;
}

export interface CashParty {
    id?: number;
    name: string;
    phone: string;
    openingBalance: number; // Positive = You will get (Receivable), Negative = You will give (Payable)
    type: 'customer' | 'supplier' | 'other';
    createdAt: Date;
}

export interface CashEntry {
    id?: number;
    type: 'in' | 'out';
    amount: number;
    date: Date;
    category: string;
    description: string; // Notes
    paymentMode: 'cash'; // Fixed for Cash Book
    partyId?: number; // Optional Link to Party
}

// Purchase Payment Interface
export interface PurchasePayment {
    id?: number;
    purchaseId?: number; // Optional: Link to specific bill
    supplierId: number;
    amount: number;
    date: Date;
    paymentMode: 'cash' | 'card' | 'upi' | 'bank_transfer';
    reference?: string;
    note?: string;
}

// Spreadsheet Interface
export interface SpreadsheetData {
    id?: number;
    name: string;
    data: string[][];
    headers: string[];
    styles: Record<string, any>;
    colWidths: Record<number, number>;
    rowHeights: Record<number, number>;
    createdAt: Date;
    updatedAt: Date;
}

// Database Class
class AppDatabase extends Dexie {
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
            spreadsheets: '++id, name, createdAt, updatedAt'
        });
    }
}

export const db = new AppDatabase();

// Factory Reset Function
export const resetApplicationData = async () => {
    await db.transaction('rw', [db.items, db.customers, db.customerPayments, db.invoices, db.expenses, db.purchases, db.suppliers, db.users, db.activityLogs, db.notifications, db.cashEntries, db.cashParties, db.spreadsheets], async () => {
        // 1. Preserve Admin Users
        const adminUsers = await db.users.where('role').equals('admin').toArray();

        // 2. Truncate Tables
        await db.items.clear();
        await db.customers.clear();
        await db.customerPayments.clear();
        await db.invoices.clear();
        await db.expenses.clear();
        await db.purchases.clear();
        await db.suppliers.clear();
        await db.activityLogs.clear();
        await db.notifications.clear();
        await db.cashEntries.clear();
        await db.cashEntries.clear();
        await db.cashParties.clear();
        await db.spreadsheets.clear();
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

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db, type User, createRecordMetadata } from '../services/db';
import LoadingScreen from '../components/UI/LoadingScreen';
import * as forge from 'node-forge';
import { useTranslation } from 'react-i18next';
import { useNotification } from './NotificationContext';

interface AuthContextType {
 user: User | null;
 token: string | null;
 activeBranchId: string;
 activeBranch: any | null;
 availableBranches: any[];
 login: (username: string, password: string) => Promise<boolean>;
 logout: () => void;
 switchBranch: (branchId: string) => void;
 isAuthenticated: boolean;
 isAdmin: boolean;
 hasPermission: (permission: string) => boolean;
 logActivity: (action: string, details?: string) => Promise<void>;
}

export const PERMISSIONS = [
 // Core
 { id: 'pos_access', label: 'POS Terminal Access' },
 { id: 'reports_view', label: 'View Reports' },
 { id: 'cashbook_access', label: 'Access Cash Book' },
 
 // Inventory
 { id: 'inventory_view', label: 'View Inventory' },
 { id: 'inventory_add', label: 'Add Items' },
 { id: 'inventory_edit', label: 'Edit Items' },
 { id: 'inventory_delete', label: 'Delete Items' },
 
 // Sales
 { id: 'sales_view', label: 'View Sales History' },
 { id: 'sales_add', label: 'Create Sales' },
 { id: 'sales_edit', label: 'Edit Invoices' },
 { id: 'sales_delete', label: 'Delete Invoices' },
 
 // Purchases
 { id: 'purchases_view', label: 'View Purchases' },
 { id: 'purchases_add', label: 'Create Purchases' },
 { id: 'purchases_edit', label: 'Edit Purchases' },
 { id: 'purchases_delete', label: 'Delete Purchases' },
 
 // Customers
 { id: 'customers_view', label: 'View Customers' },
 { id: 'customers_add', label: 'Add Customers' },
 { id: 'customers_edit', label: 'Edit Customers' },
 { id: 'customers_delete', label: 'Delete Customers' },
 
 // Suppliers
 { id: 'suppliers_view', label: 'View Suppliers' },
 { id: 'suppliers_add', label: 'Add Suppliers' },
 { id: 'suppliers_edit', label: 'Edit Suppliers' },
 { id: 'suppliers_delete', label: 'Delete Suppliers' },
 
 // Expenses
 { id: 'expenses_view', label: 'View Expenses' },
 { id: 'expenses_add', label: 'Add Expenses' },
 { id: 'expenses_edit', label: 'Edit Expenses' },
 { id: 'expenses_delete', label: 'Delete Expenses' },
 
 // Settings Tabs
 { id: 'settings_general', label: 'General / Business Setup' },
 { id: 'settings_taxes', label: 'Taxes & Localization' },
 { id: 'settings_invoice', label: 'Invoice Customization' },
 { id: 'settings_printers', label: 'Hardware/Printers' },
 { id: 'settings_backup', label: 'Data Backups' },
 { id: 'users_manage', label: 'User Management' },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SECURE_ITERATIONS = 600000;
const LEGACY_ITERATIONS = 5000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const { t } = useTranslation();
 const { addToast } = useNotification();
 const [user, setUser] = useState<User | null>(null);
 const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
 const [loading, setLoading] = useState(true);
 const [activeBranchId] = useState<string>('00000000-0000-0000-0000-000000000000');
 const [availableBranches, setAvailableBranches] = useState<any[]>([]);
 const [activeBranch, setActiveBranch] = useState<any | null>({
 id: '00000000-0000-0000-0000-000000000000',
 name: 'Default Store',
 isMaster: true,
 status: 'active'
 });

 useEffect(() => {
 const fetchBranches = async () => {
 // Seed default master branch if it does not exist in the database
 const masterBranch = await db.branches.get('00000000-0000-0000-0000-000000000000');
 if (!masterBranch) {
 await db.branches.add({
 id: '00000000-0000-0000-0000-000000000000',
 name: 'Default Store',
 location: '',
 phone: '',
 isMaster: true,
 status: 'active',
 country: 'Saudi Arabia',
 taxName: 'VAT',
 taxRate: 15,
 updatedAt: new Date(),
 branchId: '00000000-0000-0000-0000-000000000000'
 });
 }
 const branches = await db.branches.toArray();
 setAvailableBranches(branches);
 const current = branches.find(b => b.id === '00000000-0000-0000-0000-000000000000') || branches[0];
 if (current) {
 // Ensure store/branch always reports as Master to disable branching query filters globally
 setActiveBranch({ ...current, isMaster: true });
 }
 };
 if (!loading) fetchBranches();
 }, [loading]);

 useEffect(() => {
 const initAuth = async () => {
 try {
 // Ensure default admin exists
 const adminCount = await db.users.where('role').equals('admin').count();

 if (adminCount === 0) {
 const salt = forge.util.encode64(forge.random.getBytesSync(16));
 const derivedKey = forge.pkcs5.pbkdf2('admin123', salt, SECURE_ITERATIONS, 32, forge.md.sha256.create());
 const hashedPassword = forge.util.encode64(derivedKey);

 await db.users.add({
 ...createRecordMetadata(),
 username: 'admin',
 password: hashedPassword,
 salt: salt,
 isHashed: true,
 iterations: SECURE_ITERATIONS,
 forcePasswordChange: true,
 role: 'admin',
 name: 'System Admin',
 permissions: []
 });
 console.log("Seeded default admin user with hardened security");
 }

 // Validate existing token (Now using HMAC Signature)
 if (token && window.electron) {
 try {
 const payload = await window.electron.verifyToken(token);
 if (payload) {
 const [idStr] = payload.split(':');
 const foundUser = await db.users.get(idStr);
 if (foundUser) {
 setUser(foundUser);
 } else {
 logout();
 }
 } else {
 console.warn("Insecure or tampered token detected. Logging out.");
 logout();
 }
 } catch (e) {
 console.error("Token validation failed:", e);
 addToast("Session expired or invalid. Please login again.","error");
 logout();
 }
 } else if (token) {
 // In browser mode without electron, just decode (Dev fallback)
 try {
 const decoded = atob(token.split('.')[0]); // Take payload part
 const [idStr] = decoded.split(':');
 const foundUser = await db.users.get(idStr);
 if (foundUser) setUser(foundUser);
 else logout();
 } catch (e) { logout(); }
 }
 } catch (error) {
 console.error("Auth initialization failed:", error);
 addToast("Authentication system failed to initialize.","error");
 } finally {
 setLoading(false);
 }
 };

 initAuth();
 return () => { };
 }, []);

 const login = async (username: string, password: string): Promise<boolean> => {
 try {
 const foundUser = await db.users.where('username').equalsIgnoreCase(username).first();
 if (!foundUser) return false;

 let isValid = false;
 const currentIterations = foundUser.iterations || (foundUser.isHashed ? LEGACY_ITERATIONS : 0);

 if (foundUser.isHashed && foundUser.salt) {
 const derivedKey = forge.pkcs5.pbkdf2(password, foundUser.salt, currentIterations, 32, forge.md.sha256.create());
 const hashAttempt = forge.util.encode64(derivedKey);
 isValid = (foundUser.password === hashAttempt);
 } else if (foundUser.password === password) {
 // Raw password (unlikely but handled)
 isValid = true;
 }

 if (isValid) {
 // Check if we need to upgrade hashing iterations
 if (currentIterations < SECURE_ITERATIONS) {
 const newSalt = forge.util.encode64(forge.random.getBytesSync(16));
 const newDerivedKey = forge.pkcs5.pbkdf2(password, newSalt, SECURE_ITERATIONS, 32, forge.md.sha256.create());
 const newHashedPassword = forge.util.encode64(newDerivedKey);
 
 await db.users.update(foundUser.id!, {
 password: newHashedPassword,
 salt: newSalt,
 isHashed: true,
 iterations: SECURE_ITERATIONS
 });
 console.log(`User ${username} migrated to ${SECURE_ITERATIONS} iterations`);
 }

 setUser(foundUser);
 
 // Create Signed Session Token: [UserID]:[Role]:[Timestamp]:[Entropy]
 const payload =`${foundUser.id}:${foundUser.role}:${Date.now()}:${crypto.randomUUID()}`;
 let newToken = '';
 if (window.electron) {
 newToken = await window.electron.signToken(payload);
 } else {
 newToken = btoa(payload) + '.dev-unsigned-token';
 }
 
 setToken(newToken);
 localStorage.setItem('token', newToken);

 await db.activityLogs.add({
 ...createRecordMetadata(),
 userId: foundUser.id!,
 username: foundUser.username,
 action: 'LOGIN',
 timestamp: new Date()
 });

 return true;
 }
 } catch (error) {
 console.error("Login error:", error);
 addToast("Login error:"+ (error instanceof Error ? error.message :"Unknown error"),"error");
 throw error;
 }
 return false;
 };

 const logout = useCallback(() => {
 setUser(null);
 setToken(null);
 localStorage.removeItem('token');
 window.location.reload();
 }, []);

 const switchBranch = useCallback(async (branchId: string) => {
 // No-op for single-store setup without branching system
 console.log("switchBranch called, ignored for single-store setup:", branchId);
 }, []);

 const hasPermission = useCallback((permission: string): boolean => {
 if (!user) return false;
 if (user.role === 'admin') return true; // Admin has all permissions
 return user.permissions?.includes(permission) || false;
 }, [user]);

 const logActivity = useCallback(async (action: string, details?: string) => {
 if (!user) return;
 try {
 await db.activityLogs.add({
 ...createRecordMetadata(),
 userId: user.id!,
 username: user.username,
 action,
 details,
 timestamp: new Date()
 });
 } catch (e) {
 console.error("Failed to log activity", e);
 addToast("Failed to log activity.","error");
 }
 }, [user, addToast]);

 if (loading) {
 return <LoadingScreen />;
 }

 return (
 <AuthContext.Provider value={{
 user,
 token,
 activeBranchId,
 activeBranch,
 availableBranches,
 login,
 logout,
 switchBranch,
 isAuthenticated: !!user,
 isAdmin: user?.role === 'admin',
 hasPermission,
 logActivity
 }}>
 {children}
 </AuthContext.Provider>
);
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
 const context = useContext(AuthContext);
 if (!context) {
 throw new Error('useAuth must be used within an AuthProvider');
 }
 return context;
};

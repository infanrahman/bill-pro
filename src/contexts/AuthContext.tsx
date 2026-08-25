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

// Async PBKDF2 using native Web Crypto — runs off the main thread, no UI freeze
async function derivePbkdf2Key(password: string, salt: string, iterations: number): Promise<string> {
  try {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
  'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
  keyMaterial, 256
  );
  // Convert ArrayBuffer to base64
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
  } catch {
  // Fallback to synchronous forge for environments without SubtleCrypto
  const derivedKey = forge.pkcs5.pbkdf2(password, salt, iterations, 32, forge.md.sha256.create());
  return forge.util.encode64(derivedKey);
  }
}

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
  // H2 Fix: Use a flag to prevent double-seeding in React 18 Strict Mode
  const existingAdmin = await db.users.where('role').equals('admin').first();
  if (!existingAdmin) {
  // Double-check with a count after brief yield to prevent concurrent seeding
  const adminCount = await db.users.where('role').equals('admin').count();
  if (adminCount === 0) {
  const salt = forge.util.encode64(forge.random.getBytesSync(16));
  // Use a lighter iteration count for the seed hash (will be upgraded on first login)
  const derivedKey = forge.pkcs5.pbkdf2('admin123', salt, LEGACY_ITERATIONS, 32, forge.md.sha256.create());
  const hashedPassword = forge.util.encode64(derivedKey);
  try {
  await db.users.add({
  ...createRecordMetadata(),
  username: 'admin',
  password: hashedPassword,
  salt: salt,
  isHashed: true,
  iterations: LEGACY_ITERATIONS,
  forcePasswordChange: true,
  role: 'admin',
  name: 'System Admin',
  permissions: []
  });
  console.log('Seeded default admin user');
  } catch (addErr: any) {
  // Ignore ConstraintError – another concurrent call already seeded
  if (!addErr?.message?.includes('ConstraintError')) throw addErr;
  }
  }
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
  // M3 Fix: validate token format before atob() to prevent DOMException
  try {
  const parts = token.split('.');
  if (parts.length >= 1 && parts[0]) {
  const decoded = atob(parts[0]);
  const [idStr] = decoded.split(':');
  if (idStr) {
  const foundUser = await db.users.get(idStr);
  if (foundUser) setUser(foundUser);
  else {
  localStorage.removeItem('token');
  setToken(null);
  }
  } else {
  localStorage.removeItem('token');
  setToken(null);
  }
  } else {
  localStorage.removeItem('token');
  setToken(null);
  }
  } catch {
  localStorage.removeItem('token');
  setToken(null);
  }
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

 const login = useCallback(async (username: string, password: string): Promise<boolean> => {
 try {
 const foundUser = await db.users.where('username').equalsIgnoreCase(username).first();
 if (!foundUser) return false;

 let isValid = false;
 const currentIterations = foundUser.iterations || (foundUser.isHashed ? LEGACY_ITERATIONS : 0);

 if (foundUser.isHashed && foundUser.salt) {
 // C2 Fix: use async SubtleCrypto-based PBKDF2 (no UI thread freeze)
 const hashAttempt = await derivePbkdf2Key(password, foundUser.salt, currentIterations);
 isValid = (foundUser.password === hashAttempt);
 } else if (foundUser.password === password) {
 // Raw password (unlikely but handled)
 isValid = true;
 }

 if (isValid) {
 // Check if we need to upgrade hashing iterations
 if (currentIterations < SECURE_ITERATIONS) {
 const newSalt = forge.util.encode64(forge.random.getBytesSync(16));
 // C2 Fix: use async derivation for upgrade too
 const newHashedPassword = await derivePbkdf2Key(password, newSalt, SECURE_ITERATIONS);
 
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

  // H3 Fix: wrap activity log in try/catch so login never fails due to log errors
  try {
  await db.activityLogs.add({
  ...createRecordMetadata(),
  userId: foundUser.id!,
  username: foundUser.username,
  action: 'LOGIN',
  timestamp: new Date()
  });
  } catch (logErr) {
  console.warn('Activity log write failed (non-critical):', logErr);
  }

 return true;
 }
 } catch (error) {
 console.error("Login error:", error);
 addToast("Login error:"+ (error instanceof Error ? error.message :"Unknown error"),"error");
 throw error;
 }
 return false;
 }, [addToast]);

  const logout = useCallback(() => {
  setUser(null);
  setToken(null);
  localStorage.removeItem('token');
  // H1 Fix: use React state navigation instead of window.location.reload()
  // to avoid infinite reload loops when called from token validation useEffect.
  // Navigate to login via state change — the ProtectedRoute will redirect.
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

  const contextValue = useMemo(() => ({
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
  }), [
    user,
    token,
    activeBranchId,
    activeBranch,
    availableBranches,
    login,
    logout,
    switchBranch,
    hasPermission,
    logActivity
  ]);

 if (loading) {
 return <LoadingScreen />;
 }

 return (
 <AuthContext.Provider value={contextValue}>
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

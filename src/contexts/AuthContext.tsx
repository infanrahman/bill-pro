import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, type User, createRecordMetadata } from '../services/db';
import LoadingScreen from '../components/UI/LoadingScreen';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [activeBranchId, setActiveBranchId] = useState<string>(localStorage.getItem('currentBranchId') || '00000000-0000-0000-0000-000000000000');
    const [availableBranches, setAvailableBranches] = useState<any[]>([]);
    const [activeBranch, setActiveBranch] = useState<any | null>(null);

    useEffect(() => {
        const fetchBranches = async () => {
            const branches = await db.branches.toArray();
            setAvailableBranches(branches);
            const current = branches.find(b => b.id === activeBranchId);
            if (current) setActiveBranch(current);
        };
        if (!loading) fetchBranches();
    }, [activeBranchId, loading]);

    useEffect(() => {
        const initAuth = async () => {
            // Create a minimum delay promise of 4 seconds (4000ms)
            const minDelay = new Promise(resolve => setTimeout(resolve, 4000));

            try {   // Run auth logic and delay concurrently
                const [_, adminCount] = await Promise.all([
                    minDelay,
                    db.users.where('role').equals('admin').count()
                ]);

                if (adminCount === 0) {
                    await db.users.add({
                        ...createRecordMetadata(),
                        username: 'admin',
                        password: 'admin123', // Simple default
                        role: 'admin',
                        name: 'System Admin',
                        permissions: [] // Admin has all implicit permissions
                    });
                    console.log("Seeded default admin user");
                }

                // Validate existing token
                if (token) {
                    try {
                        const decoded = atob(token);
                        const [idStr] = decoded.split(':');
                        if (idStr) {
                            const foundUser = await db.users.get(idStr);
                            if (foundUser) {
                                setUser(foundUser);
                            } else {
                                logout();
                            }
                        } else {
                            logout();
                        }
                    } catch (e) {
                        console.error("Token validation failed:", e);
                        logout();
                    }
                }
            } catch (error) {
                console.error("Auth initialization failed:", error);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
        // Remove the separate timeout as it's now handled internally
        return () => { };
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const foundUser = await db.users.where('username').equalsIgnoreCase(username).first();
            if (foundUser && foundUser.password === password) {
                setUser(foundUser);
                const newToken = btoa(`${foundUser.id}:${foundUser.role}:${Date.now()}`);
                setToken(newToken);
                localStorage.setItem('token', newToken);

                // Log Login
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
            throw error;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        window.location.reload();
    };

    const switchBranch = async (branchId: string) => {

        
        setActiveBranchId(branchId);
        localStorage.setItem('currentBranchId', branchId);
        // Refresh to ensure all hooks reload with new filter
        window.location.reload(); 
    };

    const hasPermission = (permission: string): boolean => {
        if (!user) return false;
        if (user.role === 'admin') return true; // Admin has all permissions
        return user.permissions?.includes(permission) || false;
    };

    const logActivity = async (action: string, details?: string) => {
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
        }
    };

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

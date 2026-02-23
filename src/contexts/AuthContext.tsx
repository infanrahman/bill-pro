import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, type User } from '../services/db';
import LoadingScreen from '../components/UI/LoadingScreen';

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    hasPermission: (permission: string) => boolean;
    logActivity: (action: string, details?: string) => Promise<void>;
}

export const PERMISSIONS = [
    { id: 'pos_access', label: 'POS Terminal Access' },
    { id: 'inventory_view', label: 'View Inventory' },
    { id: 'inventory_manage', label: 'Manage Inventory (Add/Edit/Delete)' },
    { id: 'sales_view', label: 'View Sales History' },
    { id: 'sales_manage', label: 'Manage Sales (Edit/Delete Invoices)' },
    { id: 'purchases_view', label: 'View Purchases' },
    { id: 'purchases_manage', label: 'Manage Purchases' },
    { id: 'customers_view', label: 'View Customers' },
    { id: 'customers_manage', label: 'Manage Customers' },
    { id: 'suppliers_view', label: 'View Suppliers' },
    { id: 'suppliers_manage', label: 'Manage Suppliers' },
    { id: 'expenses_view', label: 'View Expenses' },
    { id: 'expenses_manage', label: 'Manage Expenses' },
    { id: 'cashbook_access', label: 'Access Cash Book' },
    { id: 'reports_view', label: 'View Reports' },
    { id: 'settings_manage', label: 'Manage Settings' },
    { id: 'backup_manage', label: 'Manage Backups' },
    { id: 'users_manage', label: 'Manage Users & Roles' },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

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
                        const userId = parseInt(idStr);
                        if (!isNaN(userId)) {
                            const foundUser = await db.users.get(userId);
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
        if (user) {
            // Log Logout (fire and forget)
            db.activityLogs.add({
                userId: user.id!,
                username: user.username,
                action: 'LOGOUT',
                timestamp: new Date()
            });
        }
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
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
            login,
            logout,
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

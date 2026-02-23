import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    FileText,
    Settings,
    LogOut,
    TrendingUp,
    ShoppingBag,
    DollarSign,
    Users,
    BookOpen,
    FileSpreadsheet
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import clsx from 'clsx';

const Sidebar: React.FC = () => {
    const { user, logout, hasPermission } = useAuth();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const role = user?.role || 'shopkeeper';

    // Define links with required permission
    const allLinks = [
        { to: '/', icon: LayoutDashboard, label: t('sidebar.dashboard'), permission: null }, // Always visible
        { to: '/pos', icon: ShoppingCart, label: t('sidebar.pos'), permission: 'pos_access' },
        { to: '/inventory', icon: Package, label: t('sidebar.inventory'), permission: 'inventory_view' },
        { to: '/sales', icon: TrendingUp, label: t('sidebar.sales'), permission: 'sales_view' },
        { to: '/expenses', icon: DollarSign, label: t('sidebar.expenses'), permission: 'expenses_view' }, // Decoupled
        { to: '/purchase', icon: ShoppingBag, label: t('sidebar.purchase'), permission: 'purchases_view' },
        { to: '/suppliers', icon: Package, label: t('sidebar.suppliers'), permission: 'suppliers_view' },
        { to: '/reports', icon: FileText, label: t('sidebar.reports'), permission: 'reports_view' },
        { to: '/cash-book', icon: BookOpen, label: t('sidebar.cashbook'), permission: 'cashbook_access' },
        { to: '/customers', icon: Users, label: t('sidebar.customers'), permission: 'customers_view' },
        { to: '/spreadsheet', icon: FileSpreadsheet, label: t('sidebar.excel_sheet'), permission: null },
        { to: '/settings', icon: Settings, label: t('sidebar.settings'), permission: 'settings_manage' },
    ];

    const links = allLinks.filter(link => {
        if (!link.permission) {
            // Special case: Spreadsheet
            if (link.to === '/spreadsheet') return settings.enableSpreadsheet;
            return true;
        }

        // Special case: Settings also accessible if you have backup_manage or users_manage
        if (link.label === t('sidebar.settings')) {
            return role === 'admin' || hasPermission('settings_manage') || hasPermission('backup_manage') || hasPermission('users_manage');
        }

        return hasPermission(link.permission);
    });

    // Focus Management
    const navRef = React.useRef<HTMLElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = document.getElementById(`sidebar-link-${index + 1}`);
            if (next) (next as HTMLElement).focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = document.getElementById(`sidebar-link-${index - 1}`);
            if (prev) (prev as HTMLElement).focus();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            // Optional: Move to content?
            // Enter automatically triggers click on links
        }
    };

    return (
        <div className="h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-xl z-20">
            <div className="p-6 border-b border-slate-800 flex flex-col items-center">
                <h1 className="text-xl font-bold text-white tracking-wide font-sans">
                    Billing PRO
                </h1>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{user?.name || role}</p>
            </div>

            <nav ref={navRef} className="flex-1 overflow-y-auto p-4 space-y-1">
                {links.map((link, index) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        id={`sidebar-link-${index}`}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className={({ isActive }) => clsx(
                            "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-800",
                            isActive
                                ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                    >
                        <link.icon size={20} />
                        <span className="font-medium text-sm">
                            {link.label}
                        </span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 p-3 w-full rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors outline-none focus:ring-2 focus:ring-red-500"
                >
                    <LogOut size={20} />
                    <span className="font-medium text-sm">{t('sidebar.logout')}</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;

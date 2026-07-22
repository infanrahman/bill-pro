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
 FileSpreadsheet,
 X
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import clsx from 'clsx';

interface SidebarProps {
 isOpen?: boolean;
 onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose = () => {} }) => {
 const { user, logout, hasPermission } = useAuth();
 const { settings } = useSettings();
 const { t } = useTranslation();
 const role = user?.role || 'shopkeeper';

 const allLinks = [
 { to: '/', icon: LayoutDashboard, label: t('sidebar.dashboard'), permission: null },
 { to: '/pos', icon: ShoppingCart, label: t('sidebar.pos'), permission: 'pos_access' },
 { to: '/inventory', icon: Package, label: settings.cafeMode ? t('sidebar.menu', { defaultValue: 'Menu' }) : t('sidebar.inventory'), permission: 'inventory_view' },
 { to: '/sales', icon: TrendingUp, label: t('sidebar.sales'), permission: 'sales_view' },
 { to: '/expenses', icon: DollarSign, label: t('sidebar.expenses'), permission: 'expenses_view' },
 { to: '/purchase', icon: ShoppingBag, label: t('sidebar.purchase'), permission: 'purchases_view' },
 { to: '/suppliers', icon: Package, label: t('sidebar.suppliers'), permission: 'suppliers_view' },
 { to: '/reports', icon: FileText, label: t('sidebar.reports'), permission: 'reports_view' },
 { to: '/cash-book', icon: BookOpen, label: t('sidebar.cashbook'), permission: 'cashbook_access' },
 { to: '/customers', icon: Users, label: t('sidebar.customers'), permission: 'customers_view' },
 { to: '/spreadsheet', icon: FileSpreadsheet, label: t('sidebar.excel_sheet'), permission: null },
 { to: '/settings', icon: Settings, label: t('sidebar.settings'), permission: 'settings_any' },
 ];

 const links = allLinks.filter(link => {
 if (!link.permission) {
 if (link.to === '/spreadsheet') return settings.enableSpreadsheet;
 return true;
 }
 if (link.permission === 'settings_any') {
 return role === 'admin'
 || hasPermission('settings_general')
 || hasPermission('settings_taxes')
 || hasPermission('settings_invoice')
 || hasPermission('settings_printers')
 || hasPermission('settings_backup')
 || hasPermission('users_manage');
 }
 return hasPermission(link.permission);
 });

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
 }
 };

 return (
    <>
      {/* Backdrop for mobile */}
      <div
        onClick={onClose}
        className={clsx(
          "fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-40 xl:hidden transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Sidebar Panel */}
      <div 
        className={clsx(
          "fixed inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/50 flex flex-col z-50 overflow-hidden shadow-sm transition-all duration-300 ease-in-out xl:static",
          isOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full xl:translate-x-0 border-none"
        )}
      >
        <div className="w-64 h-full flex flex-col shrink-0">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                BILLING PRO
              </h1>
              <p className="text-[10px] text-slate-700 mt-0.5 uppercase font-semibold tracking-wider">{user?.name || role}</p>
            </div>
            <button type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 xl:hidden"
            >
              <X size={18} />
            </button>
          </div>

 {/* Nav links */}
 <nav ref={navRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 custom-scrollbar">
 {links.map((link, index) => (
 <NavLink
 key={link.to}
 to={link.to}
 id={`sidebar-link-${index}`}
 onKeyDown={(e) => handleKeyDown(e, index)}
 onClick={onClose}
 className={({ isActive }) => clsx(
"flex items-center gap-3 px-3 py-2.5 rounded-xl outline-none group transition-colors",
 isActive
 ?"bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
 :"text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
)}
 >
 {({ isActive }) => (
 <>
 <link.icon size={18} className={clsx(isActive ?"text-slate-900 dark:text-white":"")} />
 <span className="text-sm tracking-tight">
 {link.label}
 </span>
 {isActive && (
 <div className="absolute left-0 w-1 h-5 bg-slate-800 dark:bg-white rounded-r-full"/>
)}
 </>
)}
 </NavLink>
))}
 </nav>

 {/* Logout */}
 <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
 <button type="button"
 onClick={logout}
 className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors group"
 >
 <LogOut size={18} />
 <span className="font-bold text-sm">{t('sidebar.logout')}</span>
 </button>
 </div>
        </div>
      </div>
    </>
);
};

export default Sidebar;

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, FileText, RotateCcw, Wallet, LayoutGrid, Plus, Calculator, Users, Package, DollarSign, Zap, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { useSettings } from '../../contexts/SettingsContext';

const QuickActionSheet: React.FC<{ isOpen: boolean; onClose: () => void; onAction: (action: string) => void }> = ({ isOpen, onClose, onAction }) => {
    const { t } = useTranslation();
    const { settings } = useSettings();

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const actions = [
        { id: 'pos', icon: Calculator, label: settings.orderTakingMode ? 'New Table Order' : t('pos.title', { defaultValue: 'New Invoice (POS)' }), color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
        { id: 'order', icon: ShoppingCart, label: t('sales.new_order', { defaultValue: 'New Sales Order' }), color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
        { id: 'payment_in', icon: DollarSign, label: t('sales.record_payment', { defaultValue: 'Record Payment In' }), color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
        { id: 'expense', icon: Wallet, label: t('expenses.add_expense', { defaultValue: 'Add Expense' }), color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
        { id: 'customer', icon: Users, label: t('customers.add_customer', { defaultValue: 'Add Customer' }), color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
        ...(!settings.orderTakingMode ? [{ id: 'quick_pay', icon: Zap, label: t('sales.quick_pay', { defaultValue: 'Quick Pay' }), color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' }] : []),
    ];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col justify-end xl:hidden">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white dark:bg-slate-900 w-full rounded-t-3xl shadow-2xl relative pb-[env(safe-area-inset-bottom)]">
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>

                <div className="px-6 pb-6 pt-2">
                    {/* Order Taking Mode badge */}
                    {settings.orderTakingMode && (
                        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl">
                            <UtensilsCrossed size={14} className="text-orange-500" />
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">Order Taking Mode — Send to Kitchen Only</span>
                        </div>
                    )}

                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-5">
                        Quick Actions
                    </h3>

                    <div className="grid grid-cols-3 gap-y-5 gap-x-4">
                        {actions.map(action => (
                            <button
                                key={action.id}
                                onClick={() => onAction(action.id)}
                                className="flex flex-col items-center gap-2.5 group active:scale-95 transition-transform"
                            >
                                <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-active:scale-95', action.color)}>
                                    <action.icon size={24} strokeWidth={2.5} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
                                    {action.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const MobileBottomNav: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

    const handleAction = (action: string) => {
        setIsQuickActionsOpen(false);
        if (action === 'pos') navigate('/pos');
        if (action === 'order') navigate('/sales?tab=order&action=new');
        if (action === 'payment_in') navigate('/sales?tab=payment&action=new');
        if (action === 'expense') navigate('/sales?tab=expense&action=new');
        if (action === 'customer') navigate('/customers?action=new');
        if (action === 'quick_pay') navigate('/sales?action=quick_pay');
    };

    const navItems = [
        { id: 'home', to: '/', icon: LayoutGrid, label: t('sidebar.dashboard', { defaultValue: 'Home' }) },
        { id: 'pos', to: '/pos', icon: Calculator, label: settings.orderTakingMode ? 'Orders' : 'POS' },
        { id: 'sales', to: '/sales', icon: ShoppingCart, label: t('sidebar.sales', { defaultValue: 'Sales' }) },
        { id: 'inventory', icon: Package, to: '/inventory', label: t('sidebar.inventory', { defaultValue: 'Items' }) },
        { id: 'more', to: '/settings', icon: LayoutGrid, label: t('common.more', { defaultValue: 'More' }) },
    ];

    return (
        <>
            {/* Global FAB */}
            <div className="xl:hidden fixed bottom-[calc(68px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[55]">
                <button
                    onClick={() => setIsQuickActionsOpen(true)}
                    className={clsx(
                        'w-14 h-14 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform',
                        settings.orderTakingMode
                            ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/40'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/40'
                    )}
                >
                    <Plus size={28} strokeWidth={2.5} className="text-white" />
                </button>
            </div>

            {/* Bottom nav bar */}
            <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center px-1 pb-[env(safe-area-inset-bottom)] z-[60] h-[68px]">
                {navItems.map(item => {
                    const isActive = location.pathname === item.to ||
                        (item.to !== '/' && location.pathname.startsWith(item.to));
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.to)}
                            className="flex flex-col items-center justify-center flex-1 pt-2 pb-1 gap-0.5 transition-colors relative"
                        >
                            {/* Active pill indicator */}
                            {isActive && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                            )}
                            <item.icon
                                size={22}
                                strokeWidth={isActive ? 2.5 : 1.8}
                                className={clsx(
                                    'transition-colors',
                                    isActive
                                        ? (item.id === 'pos' && settings.orderTakingMode ? 'text-orange-500' : 'text-blue-600 dark:text-blue-400')
                                        : 'text-slate-400 dark:text-slate-500'
                                )}
                            />
                            <span className={clsx(
                                'text-[9px] font-bold tracking-wide',
                                isActive
                                    ? (item.id === 'pos' && settings.orderTakingMode ? 'text-orange-500' : 'text-blue-600 dark:text-blue-400')
                                    : 'text-slate-400 dark:text-slate-500'
                            )}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            <QuickActionSheet
                isOpen={isQuickActionsOpen}
                onClose={() => setIsQuickActionsOpen(false)}
                onAction={handleAction}
            />
        </>
    );
};

export default MobileBottomNav;

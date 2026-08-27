import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, FileText, RotateCcw, Wallet, LayoutGrid, Plus, Calculator, Users, Package, DollarSign, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { createPortal } from 'react-dom';

const QuickActionSheet: React.FC<{ isOpen: boolean; onClose: () => void; onAction: (action: string) => void }> = ({ isOpen, onClose, onAction }) => {
    const { t } = useTranslation();

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
        { id: 'pos', icon: Calculator, label: t('pos.title', { defaultValue: 'New Invoice (POS)' }), color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
        { id: 'order', icon: ShoppingCart, label: t('sales.new_order', { defaultValue: 'New Sales Order' }), color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
        { id: 'payment_in', icon: DollarSign, label: t('sales.record_payment', { defaultValue: 'Record Payment In' }), color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
        { id: 'expense', icon: Wallet, label: t('expenses.add_expense', { defaultValue: 'Add Expense' }), color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
        { id: 'customer', icon: Users, label: t('customers.add_customer', { defaultValue: 'Add Customer' }), color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
        { id: 'quick_pay', icon: Zap, label: t('sales.quick_pay', { defaultValue: 'Quick Pay' }), color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col justify-end xl:hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm fade-in" onClick={onClose} />
            <div className="bg-white dark:bg-slate-900 w-full rounded-t-3xl shadow-2xl slide-up relative pb-[env(safe-area-inset-bottom)]">
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
                <div className="p-6 pt-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 text-center">{t('common.quick_actions', { defaultValue: 'Quick Actions' })}</h3>
                    <div className="grid grid-cols-3 gap-y-6 gap-x-4">
                        {actions.map(action => (
                            <button
                                key={action.id}
                                onClick={() => onAction(action.id)}
                                className="flex flex-col items-center gap-3 group active:scale-95 transition-transform"
                            >
                                <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105', action.color)}>
                                    <action.icon size={26} strokeWidth={2.5} />
                                </div>
                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
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
        { id: 'sales', to: '/sales', icon: ShoppingCart, label: t('sidebar.sales', { defaultValue: 'Sales' }) },
        { id: 'purchases', to: '/purchase', icon: Package, label: t('sidebar.purchases', { defaultValue: 'Purchases' }) },
        { id: 'inventory', icon: Package, to: '/inventory', label: t('sidebar.inventory', { defaultValue: 'Inventory' }) },
        { id: 'more', to: '/settings', icon: LayoutGrid, label: t('common.more', { defaultValue: 'More' }) },
    ];

    return (
        <>
            {/* Global FAB floating above bottom nav */}
            <div className="xl:hidden fixed bottom-[84px] left-1/2 -translate-x-1/2 z-[55]">
                <button
                    onClick={() => setIsQuickActionsOpen(true)}
                    className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(37,99,235,0.6)] active:scale-95 transition-transform"
                >
                    <Plus size={28} strokeWidth={2.5} />
                </button>
            </div>

            <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center px-2 pb-[env(safe-area-inset-bottom)] z-[60] h-[68px] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.02)]">
                {navItems.map(item => {
                    const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.to)}
                            className={clsx(
                                'flex flex-col items-center justify-center flex-1 py-2 mt-1 transition-colors relative',
                                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            )}
                        >
                            <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={clsx("mb-1", isActive ? "" : "")} />
                            <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
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

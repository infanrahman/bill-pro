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
    
    // Check active tab via URL search params
    const searchParams = new URLSearchParams(location.search);
    const activeTab = searchParams.get('tab') || 'order'; // Default to order if no tab
    const isSalesPage = location.pathname.startsWith('/sales');

    const handleAction = (action: string) => {
        setIsQuickActionsOpen(false);
        if (action === 'pos') navigate('/pos');
        if (action === 'order') navigate('/sales?tab=order&action=new');
        if (action === 'payment_in') navigate('/sales?tab=payment&action=new');
        if (action === 'expense') navigate('/sales?tab=expense&action=new');
        if (action === 'customer') navigate('/customers?action=new');
        if (action === 'quick_pay') navigate('/sales?action=quick_pay');
    };

    const navItemsLeft = [
        { id: 'order', icon: ShoppingCart, label: t('sales.orders', { defaultValue: 'Orders' }) },
        { id: 'invoice', icon: FileText, label: t('sales.invoices', { defaultValue: 'Invoices' }) },
    ];
    
    const navItemsRight = [
        { id: 'return', icon: RotateCcw, label: t('sales.returns', { defaultValue: 'Returns' }) },
        { id: 'expense', icon: Wallet, label: t('expenses.title', { defaultValue: 'Expenses' }) },
    ];

    const renderNavItem = (item: any) => {
        const isActive = isSalesPage && activeTab === item.id;
        return (
            <button
                key={item.id}
                onClick={() => navigate(`/sales?tab=${item.id}`)}
                className={clsx(
                    'flex flex-col items-center justify-center flex-1 py-2 mt-1 transition-colors relative',
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                )}
            >
                <div className={clsx('p-1.5 rounded-xl mb-0.5 transition-colors', isActive ? 'bg-indigo-50 dark:bg-indigo-900/30' : '')}>
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </button>
        );
    };

    return (
        <>
            <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center px-1 pb-[env(safe-area-inset-bottom)] z-[60] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] h-[68px]">
                {navItemsLeft.map(renderNavItem)}
                
                {/* Center FAB */}
                <div className="flex-1 flex justify-center -mt-6">
                    <button
                        onClick={() => setIsQuickActionsOpen(true)}
                        className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform"
                    >
                        <Plus size={32} strokeWidth={2.5} />
                    </button>
                </div>
                
                {navItemsRight.map(renderNavItem)}

                {/* More / Settings Menu */}
                <button
                    onClick={() => navigate('/settings')}
                    className={clsx(
                        'flex flex-col items-center justify-center flex-1 py-2 mt-1 transition-colors relative',
                        location.pathname.startsWith('/settings') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    )}
                >
                    <div className={clsx('p-1.5 rounded-xl mb-0.5 transition-colors', location.pathname.startsWith('/settings') ? 'bg-indigo-50 dark:bg-indigo-900/30' : '')}>
                        <LayoutGrid size={22} strokeWidth={location.pathname.startsWith('/settings') ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">{t('common.more', { defaultValue: 'More' })}</span>
                </button>
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

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calculator, FileText, Package, Users, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const MobileBottomNav: React.FC = () => {
    const { t } = useTranslation();
    
    const navItems = [
        { to: '/pos', icon: Calculator, label: 'POS' },
        { to: '/sales', icon: FileText, label: 'Orders' },
        { to: '/inventory', icon: Package, label: 'Products' },
        { to: '/customers', icon: Users, label: 'Customers' },
        { to: '/settings', icon: LayoutGrid, label: 'More' },
    ];

    return (
        <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center px-2 pb-[env(safe-area-inset-bottom)] z-[60] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
            {navItems.map(item => (
                <NavLink 
                    key={item.to} 
                    to={item.to} 
                    className={({isActive}) => clsx(
                        'flex flex-col items-center justify-center flex-1 py-2 mt-1 transition-colors relative',
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    )}
                >
                    {({isActive}) => (
                        <>
                            <div className={clsx('p-1.5 rounded-xl mb-0.5 transition-colors', isActive ? 'bg-indigo-50 dark:bg-indigo-900/30' : '')}>
                                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
                        </>
                    )}
                </NavLink>
            ))}
        </div>
    );
};

export default MobileBottomNav;

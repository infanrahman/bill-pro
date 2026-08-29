import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu, Wifi, WifiOff, Loader2 } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationBell from '../UI/NotificationBell';
import { Zap } from 'lucide-react';
import QuickPaymentModal from '../Sales/QuickPaymentModal';
import { useState, useEffect } from 'react';
import { TrialBanner } from '../Settings/LicenseComponents';
import LicenseBlocker from '../Settings/LicenseBlocker';
import { AnimatePresence } from 'framer-motion';
import PageTransition from '../UI/PageTransition';
import { db } from '../../services/db';
import MobileBottomNav from './MobileBottomNav';
import { Search } from 'lucide-react';
import { useSyncStatus } from '../../App';
import clsx from 'clsx';

// Map route paths to page titles for mobile header
const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/pos': 'Point of Sale',
  '/inventory': 'Inventory',
  '/sales': 'Sales',
  '/expenses': 'Expenses',
  '/purchase': 'Purchases',
  '/suppliers': 'Suppliers',
  '/reports': 'Reports',
  '/cash-book': 'Cash Book',
  '/customers': 'Customers',
  '/settings': 'Settings',
  '/spreadsheet': 'Spreadsheet',
};

const SyncStatusPill: React.FC = () => {
  const status = useSyncStatus();
  if (window.electron) return null; // Only show on mobile

  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors',
      status === 'connected' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
      status === 'connecting' && 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
      status === 'disconnected' && 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    )}>
      {status === 'connected' && <Wifi size={11} />}
      {status === 'connecting' && <Loader2 size={11} className="animate-spin" />}
      {status === 'disconnected' && <WifiOff size={11} />}
      <span className="hidden sm:block">
        {status === 'connected' ? 'Synced' : status === 'connecting' ? 'Connecting' : 'Offline'}
      </span>
    </div>
  );
};

const MainLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isQuickPayOpen, setIsQuickPayOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1280);

    // Get current page title for mobile header
    const currentTitle = Object.entries(routeTitles).reduce((best, [path, title]) => {
      if (location.pathname === path) return title;
      if (location.pathname.startsWith(path) && path !== '/' && path.length > (best?.path?.length ?? 0)) {
        return { path, title };
      }
      return best;
    }, null as any);
    const pageTitle = typeof currentTitle === 'string' ? currentTitle
      : currentTitle?.title ?? 'BillPro';

    useEffect(() => {
        const handleKvKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F1') {
                e.preventDefault();
                navigate('/pos');
            }
            if (e.key === 'F9') {
                e.preventDefault();
                setIsQuickPayOpen(true);
            }
        };

        window.addEventListener('keydown', handleKvKeyDown);
        return () => window.removeEventListener('keydown', handleKvKeyDown);
    }, [navigate]);

    // Close sidebar on page navigation for mobile/tablet screens only
    useEffect(() => {
        if (window.innerWidth < 1280) {
            setTimeout(() => setIsSidebarOpen(false), 0);
        }
    }, [location.pathname]);

    // Global barcode listener for scanning Sales Orders
    useEffect(() => {
        let barcodeBuffer = '';
        let lastKeyTime = Date.now();

        const handleGlobalKeyDown = async (e: KeyboardEvent) => {
            const now = Date.now();
            const timeDelta = now - lastKeyTime;
            lastKeyTime = now;

            if (e.key === 'Enter') {
                if (barcodeBuffer.length >= 3) {
                    const code = barcodeBuffer.trim();
                    barcodeBuffer = '';

                    if (code.startsWith('SO-')) {
                        e.preventDefault();
                        e.stopPropagation();

                        try {
                            const order = await db.invoices.where('invoiceNumber').equals(code).first();
                            if (order && order.type === 'order') {
                                navigate('/pos', { state: { editInvoice: order, hidePayLater: true, autoCheckout: true } });
                            }
                        } catch (err) {
                            console.error("Global Sales Order scan lookup failed:", err);
                        }
                    }
                }
                barcodeBuffer = '';
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (timeDelta > 300) {
                    barcodeBuffer = '';
                }
                barcodeBuffer += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [navigate]);

    return (
        <div className="flex h-[100dvh] w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 font-inter pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            <LicenseBlocker />
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
                <TrialBanner />
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 md:px-4 flex items-center justify-between z-10 h-14 md:h-16 shrink-0">
                    <div className="flex items-center gap-2.5">
                        {/* Hamburger */}
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen(prev => !prev)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-800 dark:text-slate-200 transition-colors shrink-0"
                        >
                            <Menu size={22} />
                        </button>

                        {/* Desktop back/forward */}
                        <div className="hidden md:flex items-center gap-1">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => navigate(1)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Mobile: dynamic page title */}
                        <div className="md:hidden flex flex-col pl-0.5">
                            <span className="font-bold text-base leading-tight tracking-tight text-slate-900 dark:text-white">
                                {pageTitle}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        {/* Mobile sync status pill */}
                        <div className="md:hidden">
                            <SyncStatusPill />
                        </div>

                        {/* Desktop search */}
                        <button className="hidden md:hidden p-2 text-slate-700 dark:text-slate-300">
                            <Search size={22} />
                        </button>

                        {/* Desktop quick pay */}
                        <div className="hidden md:flex">
                            <button
                                onClick={() => setIsQuickPayOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50 rounded-full transition-colors font-medium text-sm"
                            >
                                <Zap size={16} className="fill-yellow-700 dark:fill-yellow-400" />
                                <span>Quick Pay</span>
                            </button>
                        </div>

                        <NotificationBell />
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-6 xl:p-8 pb-24 md:pb-6 xl:pb-8">
                    <div className="w-full h-full mx-auto">
                        <AnimatePresence mode="wait">
                            <PageTransition key={location.pathname} className="h-full">
                                <Outlet />
                            </PageTransition>
                        </AnimatePresence>
                    </div>
                </main>

                <MobileBottomNav />
            </div>

            <QuickPaymentModal
                isOpen={isQuickPayOpen}
                onClose={() => setIsQuickPayOpen(false)}
            />
        </div>
    );
};

export default MainLayout;

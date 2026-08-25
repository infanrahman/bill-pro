import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationBell from '../UI/NotificationBell';

import { Zap } from 'lucide-react';
import QuickPaymentModal from '../Sales/QuickPaymentModal';
import { useState, useEffect } from 'react';
// import { useKeyboard } from '../../contexts/KeyboardContext';

import { TrialBanner } from '../Settings/LicenseComponents'; // Import Banner
import LicenseBlocker from '../Settings/LicenseBlocker';
import { AnimatePresence } from 'framer-motion';
import PageTransition from '../UI/PageTransition';
import { useLocation } from 'react-router-dom';

import { db } from '../../services/db';

import MobileBottomNav from './MobileBottomNav';
import { Search } from 'lucide-react';

const MainLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isQuickPayOpen, setIsQuickPayOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1280);

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
            const target = e.target;
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
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 md:p-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        {/* Hamburger Menu Button */}
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen(prev => !prev)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-800 dark:text-slate-200 transition-colors"
                            title="Toggle Menu"
                        >
                            <Menu size={24} />
                        </button>

                        <div className="hidden md:flex items-center gap-2 ml-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
                                title="Go Back"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => navigate(1)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
                                title="Go Forward"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Mobile Brand Name */}
                        <div className="md:hidden flex flex-col pl-1">
                            <span className="font-bold text-lg leading-tight tracking-wide text-slate-900 dark:text-white uppercase">POS App</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                        <button className="md:hidden p-2 text-slate-700 dark:text-slate-300">
                            <Search size={22} />
                        </button>
                        
                        <div className="hidden md:flex">
                            <button
                                onClick={() => setIsQuickPayOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50 rounded-full transition-colors font-medium text-sm"
                                title="Quick Payment (Zap)"
                            >
                                <Zap size={16} className="fill-yellow-700 dark:fill-yellow-400" />
                                <span>Quick Pay</span>
                            </button>
                        </div>

                        <NotificationBell />
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm">
                            {/* Avatar Placeholder */}
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

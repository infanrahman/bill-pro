import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const MainLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // const { registerShortcut, unregisterShortcut } = useKeyboard(); // Removed context dependency for F9 to ensure it works
    const [isQuickPayOpen, setIsQuickPayOpen] = useState(false);

    useEffect(() => {
        const handleKvKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F9') {
                e.preventDefault();
                setIsQuickPayOpen(true);
            }
        };

        window.addEventListener('keydown', handleKvKeyDown);
        return () => window.removeEventListener('keydown', handleKvKeyDown);
    }, []);

    return (
        <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 font-inter">
            <LicenseBlocker />
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <TrialBanner />
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
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

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsQuickPayOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50 rounded-full transition-colors font-medium text-sm"
                            title="Quick Payment (Zap)"
                        >
                            <Zap size={16} className="fill-yellow-700 dark:fill-yellow-400" />
                            <span className="hidden md:inline">Quick Pay</span>
                        </button>
                        <NotificationBell />
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            {/* Avatar Placeholder */}
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <AnimatePresence mode="wait">
                            <PageTransition key={location.pathname} className="h-full">
                                <Outlet />
                            </PageTransition>
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            <QuickPaymentModal
                isOpen={isQuickPayOpen}
                onClose={() => setIsQuickPayOpen(false)}
            />
        </div>
    );
};

export default MainLayout;

import React, { useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { LicenseProvider } from './contexts/LicenseContext';
import { KeyboardProvider } from './contexts/KeyboardContext';
import ToastContainer from './components/UI/ToastContainer';
const Login = lazy(() => import('./pages/Login'));
const MainLayout = lazy(() => import('./components/Layout/MainLayout'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PosTerminal = lazy(() => import('./pages/POS/PosTerminal'));
const ItemList = lazy(() => import('./pages/Inventory/ItemList'));
const ItemForm = lazy(() => import('./pages/Inventory/ItemForm'));
const Sales = lazy(() => import('./pages/Sales'));
const NewSaleOrder = lazy(() => import('./pages/Sales/NewSaleOrder'));
const Expenses = lazy(() => import('./pages/Transactions/Expenses'));
const PurchaseOrders = lazy(() => import('./pages/Purchase/PurchaseOrders'));
const NewPurchaseBill = lazy(() => import('./pages/Purchase/NewPurchaseBill'));
const CustomerList = lazy(() => import('./pages/Customers/CustomerList'));
const Suppliers = lazy(() => import('./pages/Suppliers/Suppliers'));
const SupplierDetails = lazy(() => import('./pages/Suppliers/SupplierDetails'));
const Reports = lazy(() => import('./pages/Reports/Reports'));
const CashBook = lazy(() => import('./pages/CashBook/CashBook'));
const Spreadsheet = lazy(() => import('./pages/Spreadsheet/Spreadsheet'));

import { useLicense } from './contexts/LicenseContext';
import { ActivationModal } from './components/Settings/LicenseComponents'; // Import modal
import { checkAndPerformAutoBackup } from './services/backupService';
import ZatcaSyncService from './components/Background/ZatcaSyncService';
import { AutoUpdateBanner } from './components/UI/AutoUpdateBanner';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
 const { isAuthenticated } = useAuth();
 if (!isAuthenticated) return <Navigate to="/login"/>;
 return <>{children}</>;
};

const AppContent = () => {
 const { status, loading } = useLicense();
 const { addToast } = useNotification();

 // Fix #1: Run auto-backup check every hour (not just once at startup)
 // Fix #10: Show user-facing toast on success or failure
 useEffect(() => {
 const runBackup = async () => {
 const result = await checkAndPerformAutoBackup();
 if (result.status === 'success') {
 addToast('Auto backup completed successfully.', 'success');
 } else if (result.status === 'error') {
 addToast(`Auto backup failed: ${result.message}`, 'error');
 }
 };
 runBackup();
 const interval = setInterval(runBackup, 60 * 60 * 1000); // re-check every hour
 return () => clearInterval(interval);
 }, [addToast]);

 useEffect(() => {
 const handleGlobalF8 = async (e: KeyboardEvent) => {
 if (e.key === 'F8') {
 e.preventDefault();
 try {
 const saved = localStorage.getItem('printerConfig');
 if (!saved) {
 addToast('Please configure a thermal printer in Settings first.', 'error');
 return;
 }
 const config = JSON.parse(saved);
 if (!config.thermal?.printerName) {
 addToast('No thermal printer selected in Settings.', 'error');
 return;
 }
 if (window.electron && window.electron.openCashDrawer) {
 const success = await window.electron.openCashDrawer(config.thermal.printerName);
 if (success) {
 addToast('Cash drawer opened.', 'success');
 } else {
 addToast('Failed to open cash drawer. Check printer connection.', 'error');
 }
 } else {
 addToast('Cash drawer requires the desktop app.', 'error');
 }
 } catch (err) {
 console.error('Drawer error:', err);
 addToast('Error opening cash drawer.', 'error');
 }
 }
 };

 window.addEventListener('keydown', handleGlobalF8);
 return () => window.removeEventListener('keydown', handleGlobalF8);
 }, [addToast]);

 if (loading) {
 return <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">Loading...</div>;
 }

 if (status === 'expired' || status === 'pirated') {
 return (
 <>
 <ActivationModal isOpen={true} onClose={() => { }} canClose={false} />
 <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-700">
 Access Blocked - License Expired
 </div>
 </>
);
 }

 return (
 <>
 <ToastContainer />
 <ZatcaSyncService />
 <AutoUpdateBanner />
 <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white font-bold tracking-wider uppercase">Loading module...</div>}>
 <Routes>
 <Route path="/login"element={<Login />} />

 <Route path="/"element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
 <Route index element={<Dashboard />} />
 <Route path="pos"element={<PosTerminal />} />

 <Route path="inventory"element={<ItemList />} />
 <Route path="inventory/add"element={<ItemForm />} />
 <Route path="inventory/edit/:id"element={<ItemForm />} />

 <Route path="sales" element={<Sales />} />
 <Route path="sales/new" element={<NewSaleOrder />} />
 <Route path="expenses" element={<Expenses />} />
 <Route path="purchase" element={<PurchaseOrders />} />
 <Route path="purchase/new" element={<NewPurchaseBill />} />

 <Route path="reports"element={<Reports />} />
 <Route path="customers"element={<CustomerList />} />
 <Route path="suppliers"element={<Suppliers />} />
 <Route path="suppliers/:id"element={<SupplierDetails />} />
 <Route path="settings"element={<Settings />} />
 <Route path="cash-book"element={<CashBook />} /> {/* Moved inside Layout */}
 <Route path="spreadsheet"element={<Spreadsheet />} />
 </Route>
 </Routes>
 </Suspense>
 </>
);
};

function App() {
 const { i18n } = useTranslation();

 useEffect(() => {
 document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
 document.documentElement.lang = i18n.language;
 }, [i18n.language]);

 // Note: auto-backup is now handled inside AppContent (has access to addToast)



 return (
 <Router>
 <SettingsProvider>
 <NotificationProvider>
 <AuthProvider>
 <LicenseProvider>
 <KeyboardProvider>
 <AppContent />
 </KeyboardProvider>
 </LicenseProvider>
 </AuthProvider>
 </NotificationProvider>
 </SettingsProvider>
 </Router>
);
}

export default App;

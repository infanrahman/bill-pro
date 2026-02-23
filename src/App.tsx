import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { LicenseProvider } from './contexts/LicenseContext';
import { KeyboardProvider } from './contexts/KeyboardContext';
import ToastContainer from './components/UI/ToastContainer';
import Login from './pages/Login';
import MainLayout from './components/Layout/MainLayout';
import Settings from './pages/Settings/Settings';
import Dashboard from './pages/Dashboard';
import PosTerminal from './pages/POS/PosTerminal';
import ItemList from './pages/Inventory/ItemList';
import ItemForm from './pages/Inventory/ItemForm';
import Sales from './pages/Sales';
import Expenses from './pages/Transactions/Expenses';
import PurchaseOrders from './pages/Purchase/PurchaseOrders';
import CustomerList from './pages/Customers/CustomerList';
import Suppliers from './pages/Suppliers/Suppliers';
import SupplierDetails from './pages/Suppliers/SupplierDetails';
import Reports from './pages/Reports/Reports';
import CashBook from './pages/CashBook/CashBook'; // New Import
import Spreadsheet from './pages/Spreadsheet/Spreadsheet';

import { useLicense } from './contexts/LicenseContext';
import { ActivationModal } from './components/Settings/LicenseComponents'; // Import modal
import { checkAndPerformAutoBackup } from './services/backupService';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AppContent = () => {
  const { status, loading } = useLicense();

  if (loading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">Loading...</div>;
  }

  if (status === 'expired' || status === 'pirated') {
    return (
      <>
        <ActivationModal isOpen={true} onClose={() => { }} canClose={false} />
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-500">
          Access Blocked - License Expired
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<PosTerminal />} />

          <Route path="inventory" element={<ItemList />} />
          <Route path="inventory/add" element={<ItemForm />} />
          <Route path="inventory/edit/:id" element={<ItemForm />} />

          <Route path="sales" element={<Sales />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="purchase" element={<PurchaseOrders />} />

          <Route path="reports" element={<Reports />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierDetails />} />
          <Route path="settings" element={<Settings />} />
          <Route path="cash-book" element={<CashBook />} /> {/* Moved inside Layout */}
          <Route path="spreadsheet" element={<Spreadsheet />} />
        </Route>
      </Routes>
    </>
  );
};

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    checkAndPerformAutoBackup();
  }, []);



  return (
    <Router>
      <SettingsProvider>
        <AuthProvider>
          <NotificationProvider>
            <LicenseProvider>
              <KeyboardProvider>
                <AppContent />
              </KeyboardProvider>
            </LicenseProvider>
          </NotificationProvider>
        </AuthProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;

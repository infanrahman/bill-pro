import React, { createContext, useContext, useState, useEffect } from 'react';

interface AppSettings {
    currency: string;
    decimals: number;
    dateFormat: string;
    invoicePrefix?: string; // Custom prefix for generated invoices
    enableSharing?: boolean;
    enableBillWiseProfit?: boolean;
    enableStockReport?: boolean;
    enableExcelExport?: boolean;
    enableSpreadsheet?: boolean; // New feature toggle
    cafeMode?: boolean; // Enable image-based POS for restaurants/cafes
    applyTax?: boolean; // Global tax toggle
}

const defaultSettings: AppSettings = {
    currency: '$',
    decimals: 2,
    dateFormat: 'dd/MM/yyyy',
    invoicePrefix: 'INV-',
    enableSharing: false,
    enableBillWiseProfit: false,
    enableStockReport: false,
    enableExcelExport: false,
    enableSpreadsheet: false,
    cafeMode: false,
    applyTax: false
};


interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    formatCurrency: (amount: number) => string;
    formatDate: (date: string | Date | undefined) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem('appSettings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    const formatCurrency = (amount: number) => {
        if (amount === undefined || amount === null) return settings.currency + '0.00';
        return settings.currency + Number(amount).toFixed(settings.decimals);
    };

    const formatDate = (date: string | Date | undefined) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        if (settings.dateFormat === 'MM/dd/yyyy') return `${month}/${day}/${year}`;
        if (settings.dateFormat === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
        return `${day}/${month}/${year}`; // Default dd/MM/yyyy
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, formatCurrency, formatDate }}>
            {children}
        </SettingsContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

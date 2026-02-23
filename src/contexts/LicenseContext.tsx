import React, { createContext, useContext, useState, useEffect } from 'react';

interface LicenseState {
    status: 'ok' | 'expired' | 'pirated' | 'loading';
    remainingDays: number;
    machineId: string;
    expiryDate?: string;
    loading: boolean;
}

interface LicenseContextType extends LicenseState {
    activate: (key: string) => Promise<boolean>;
    checkStatus: () => Promise<void>;
    resetLicense: () => Promise<boolean>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<LicenseState>({
        status: 'loading',
        remainingDays: 0,
        machineId: '',
        loading: true
    });

    const checkStatus = async () => {
        if (!window.electron) {
            // Browser dev mode fallback
            setState({ status: 'ok', remainingDays: 999, machineId: 'DEV-MODE', loading: false });
            return;
        }

        try {
            const result = await window.electron.getLicenseStatus();
            setState({ ...result, loading: false });
        } catch (error) {
            console.error('Failed to check license:', error);
            // Default to expired/error state if check fails massively
            setState(prev => ({ ...prev, status: 'expired', loading: false }));
        }
    };

    const activate = async (key: string) => {
        if (!window.electron) return true;

        try {
            const success = await window.electron.activateLicense(key);
            if (success) {
                await checkStatus();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Activation failed:', error);
            return false;
        }
    };

    const resetLicense = async (): Promise<boolean> => {
        if (!window.electron) return false;
        try {
            const success = await window.electron.resetLicense();
            if (success) {
                await checkStatus(); // Should trigger 'expired' state logic
                return true;
            }
            return false;
        } catch (error) {
            console.error('Reset failed:', error);
            return false;
        }
    };

    useEffect(() => {
        checkStatus();
        // Periodic re-check every 1 hour to ensure validity during long sessions
        const interval = setInterval(checkStatus, 3600000); // 1 hour
        return () => clearInterval(interval);
    }, []);

    return (
        <LicenseContext.Provider value={{ ...state, activate, checkStatus, resetLicense }}>
            {children}
        </LicenseContext.Provider>
    );
};

export const useLicense = () => {
    const context = useContext(LicenseContext);
    if (!context) {
        throw new Error('useLicense must be used within a LicenseProvider');
    }
    return context;
};

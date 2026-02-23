import React from 'react';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
}) => {
    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return <AlertTriangle className="text-red-600" size={32} />;
            case 'warning':
                return <AlertCircle className="text-orange-600" size={32} />;
            case 'info':
                return <Info className="text-blue-600" size={32} />;
        }
    };

    const getColors = () => {
        switch (variant) {
            case 'danger':
                return {
                    bg: 'bg-red-50 dark:bg-red-900/10',
                    iconBg: 'bg-red-100 dark:bg-red-900/30',
                    confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
                };
            case 'warning':
                return {
                    bg: 'bg-orange-50 dark:bg-orange-900/10',
                    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
                    confirmBtn: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
                };
            case 'info':
                return {
                    bg: 'bg-blue-50 dark:bg-blue-900/10',
                    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
                    confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
                };
        }
    };

    const colors = getColors();

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
            <div className="text-center p-6">
                <div className={`w-16 h-16 ${colors.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    {getIcon()}
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {title}
                </h3>

                <p className="text-slate-500 dark:text-slate-400 mb-8 whitespace-pre-wrap">
                    {message}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-3 px-4 text-white rounded-xl font-bold transition-colors shadow-lg disabled:opacity-50 flex justify-center items-center gap-2 ${colors.confirmBtn}`}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;

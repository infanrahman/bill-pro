import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
    className?: string; // For additional custom classes
}

declare global {
    interface Window {
        modalOpenCount: number;
    }
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = '2xl',
    className = ''
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Global modal counter to handle nested modals correctly
    // We use a module-level variable since this component is reused

    // Handle Body Scroll Lock (Only depends on isOpen)
    useEffect(() => {
        if (isOpen) {
            // Increment count
            window.modalOpenCount = (window.modalOpenCount || 0) + 1;
            document.body.style.overflow = 'hidden';
        }

        return () => {
            if (isOpen) {
                // Decrement count
                window.modalOpenCount = Math.max(0, (window.modalOpenCount || 1) - 1);
                // Only unlock if no modals are open
                if (window.modalOpenCount === 0) {
                    document.body.style.overflow = 'unset';
                }
            }
        };
    }, [isOpen]);

    // Handle Escape Key (Depends on onClose)
    useEffect(() => {
        if (isOpen) {
            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') onClose();
            };
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    // Handle Click Outside (Backdrop)
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    // Width Maps
    const widthClasses = {
        'sm': 'max-w-sm',
        'md': 'max-w-md',
        'lg': 'max-w-lg',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        'full': 'max-w-full m-4',
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onMouseDown={handleBackdropClick}
            aria-modal="true"
            role="dialog"
        >
            <div
                ref={modalRef}
                className={`bg-white dark:bg-slate-900 w-full ${widthClasses[maxWidth]} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 ${className}`}
            >
                {/* Header - Only render if title or close button needed here, 
                    but usually we want a consistent header. 
                    If title is provided, specific header logic. 
                    If not, caller handles header? 
                    Let's provide a standard header if title exists.
                */}
                {(title) && (
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
                        <h2 className="text-xl font-bold dark:text-white">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <X className="text-slate-500 hover:text-red-500 transition-colors" size={20} />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {/* If no title, user might want to put their own header, 
                        so we just render children. 
                        User is responsible for padding/layout inside. */}
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;

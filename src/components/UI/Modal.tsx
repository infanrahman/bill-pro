import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
 isOpen: boolean;
 onClose: () => void;
 title?: string;
 children: React.ReactNode;
 maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
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
     '6xl': 'max-w-6xl',
     '7xl': 'max-w-7xl',
     'full': 'max-w-full m-4',
   };

   return createPortal(
     <div
       className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 fade-in"
       onMouseDown={handleBackdropClick}
       aria-modal="true"
       role="dialog"
     >
       <div
         ref={modalRef}
         className={`bg-white dark:bg-slate-900 w-full ${widthClasses[maxWidth]} rounded-2xl overflow-hidden flex flex-col max-h-[90vh] zoom-in-95 ${className}`}
       >
         {/* Header */}
         {title && (
           <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
             <h2 className="text-xl font-bold dark:text-white">{title}</h2>
             <button
               type="button"
               onClick={onClose}
               className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
             >
               <X className="text-slate-700 hover:text-red-500" size={20} />
             </button>
           </div>
         )}

         {/* Content */}
         <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
           {children}
         </div>
       </div>
     </div>,
     document.body
   );
};

export default Modal;

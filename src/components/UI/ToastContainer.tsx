import React from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContainer: React.FC = () => {
 const { toasts } = useNotification();

 return (
 <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none w-auto h-auto max-w-[100vw] max-h-screen"style={{ pointerEvents: 'none' }}>
 <>
 {toasts.map(toast => (
 <div
 key={toast.id}
 
 
 
 className={`
 min-w-[300px] p-4 rounded-lg border flex items-center gap-3
 ${toast.type === 'success' ? 'bg-white border-green-500 text-green-700 dark:bg-slate-800 dark:text-green-400' : ''}
 ${toast.type === 'error' ? 'bg-white border-red-500 text-red-700 dark:bg-slate-800 dark:text-red-400' : ''}
 ${toast.type === 'warning' ? 'bg-white border-yellow-500 text-yellow-700 dark:bg-slate-800 dark:text-yellow-400' : ''}
 ${toast.type === 'info' ? 'bg-white border-slate-900 dark:border-white text-slate-900 dark:text-white dark:bg-slate-800 ' : ''}
 pointer-events-auto
`}
 >
 {toast.type === 'success' && <CheckCircle size={20} />}
 {toast.type === 'error' && <AlertCircle size={20} />}
 {toast.type === 'warning' && <AlertTriangle size={20} />}
 {toast.type === 'info' && <Info size={20} />}

 <span className="font-medium text-sm flex-1">{toast.message}</span>
 </div>
))}
 </>
 </div>
);
};

export default ToastContainer;

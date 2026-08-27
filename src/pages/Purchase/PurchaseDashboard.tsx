import React from 'react';
import { ShoppingCart, FileText, RotateCcw, Plus, ChevronRight, Bell, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';

interface PurchaseDashboardProps {
    stats: {
        bills: number;
        orders: number;
        returns: number;
    };
    recentBills: any[];
    totalUnpaid: number;
}

const PurchaseDashboard: React.FC<PurchaseDashboardProps> = ({ stats, recentBills, totalUnpaid }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatCurrency, formatDate } = useSettings();

    const menuItems = [
        { id: 'bill', label: 'Bills', count: stats.bills, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { id: 'order', label: 'Orders', count: stats.orders, icon: ShoppingCart, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
        { id: 'return', label: 'Returns', count: stats.returns, icon: RotateCcw, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
    ];

    return (
        <div className="space-y-6 bg-white dark:bg-slate-950 min-h-screen pb-24">
            <div className="p-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/settings')} className="p-2 -ml-2 text-slate-700 dark:text-slate-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ShoppingCart className="text-blue-600" size={20} />
                            Purchase Management
                        </h1>
                        <p className="text-[10px] text-slate-500 font-medium">Manage purchases and supplier records</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Bell className="text-slate-600 dark:text-slate-300" size={22} />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold border-2 border-white dark:border-slate-950">2</span>
                    </div>
                    <div className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden">
                        <img src="https://ui-avatars.com/api/?name=User&background=random" alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                </div>
            </div>

            <div className="px-5 space-y-6">
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/purchase/new?type=bill')}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] active:scale-95 transition-all"
                    >
                        <Plus size={18} strokeWidth={2.5} /> New Purchase Bill
                    </button>
                    <button
                        onClick={() => navigate('/purchase/new?type=order')}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_8px_16px_-6px_rgba(79,70,229,0.4)] active:scale-95 transition-all"
                    >
                        <Plus size={18} strokeWidth={2.5} /> New Purchase Order
                    </button>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 custom-scrollbar snap-x">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => navigate('/purchase?tab=' + item.id)}
                            className={`flex flex-col items-center justify-center min-w-[90px] py-4 rounded-2xl snap-center shrink-0 border border-slate-100 dark:border-slate-800 ${item.bg}`}
                        >
                            <item.icon size={24} className={`mb-2 ${item.color}`} />
                            <span className={`text-[11px] font-bold ${item.color}`}>{item.label}</span>
                            <span className={`text-[10px] font-medium mt-0.5 ${item.color}`}>({item.count})</span>
                        </button>
                    ))}
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Purchase Bills</h3>
                        <button onClick={() => navigate('/purchase?tab=bill')} className="text-xs font-bold text-blue-600">View All</button>
                    </div>
                    <div className="space-y-3">
                        {recentBills.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                No recent bills
                            </div>
                        ) : (
                            recentBills.map(bill => {
                                const isSettled = bill.paidAmount >= bill.totalAmount;
                                return (
                                <div key={bill.id} onClick={() => navigate('/purchase?tab=bill&view=' + bill.id)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform">
                                    <div className="flex flex-col gap-1 w-[100px]">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{bill.orderNumber}</span>
                                        <span className="text-[10px] font-medium text-slate-500">{formatDate(bill.date)}</span>
                                    </div>
                                    <div className="flex flex-col items-start gap-1 flex-1 px-3 border-l border-slate-100 dark:border-slate-800 ml-2 pl-3">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-full">{bill.supplierName}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                                            isSettled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                        }`}>
                                            {isSettled ? 'Settled' : 'Unpaid'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 justify-end">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                                                {formatCurrency(bill.totalAmount)}
                                            </span>
                                            <span className="text-[10px] font-medium text-slate-500">{bill.items.length} items</span>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 ml-1" />
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseDashboard;

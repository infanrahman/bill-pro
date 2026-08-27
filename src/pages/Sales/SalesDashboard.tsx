import React from 'react';
import { ShoppingCart, FileText, RotateCcw, DollarSign, Plus, ChevronRight, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';

interface SalesDashboardProps {
    stats: {
        orders: number;
        invoices: number;
        returns: number;
        payments: number;
    };
    recentOrders: any[];
    totalPaymentsIn: number;
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ stats, recentOrders, totalPaymentsIn }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatCurrency, formatDate } = useSettings();

    const menuItems = [
        { id: 'order', label: 'Orders', count: stats.orders, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { id: 'invoice', label: 'Invoices', count: stats.invoices, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
        { id: 'return', label: 'Returns', count: stats.returns, icon: RotateCcw, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
        { id: 'payment', label: 'Payments In', count: stats.payments, icon: DollarSign, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
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
                            Sales Management
                        </h1>
                        <p className="text-[10px] text-slate-500 font-medium">Manage orders, invoices, returns and payments</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Bell className="text-slate-600 dark:text-slate-300" size={22} />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold border-2 border-white dark:border-slate-950">3</span>
                    </div>
                    <div className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden">
                        <img src="https://ui-avatars.com/api/?name=User&background=random" alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                </div>
            </div>

            <div className="px-5 space-y-6">
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/sales?tab=order&action=new')}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] active:scale-95 transition-all"
                    >
                        <Plus size={18} strokeWidth={2.5} /> New Sales Order
                    </button>
                    <button
                        onClick={() => navigate('/sales?tab=return&action=new')}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_8px_16px_-6px_rgba(249,115,22,0.4)] active:scale-95 transition-all"
                    >
                        <RotateCcw size={18} strokeWidth={2.5} /> Create Return
                    </button>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 custom-scrollbar snap-x">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => navigate('/sales?tab=' + item.id)}
                            className={`flex flex-col items-center justify-center min-w-[90px] py-4 rounded-2xl snap-center shrink-0 border border-slate-100 dark:border-slate-800 ${item.bg}`}
                        >
                            <item.icon size={24} className={`mb-2 ${item.color}`} />
                            <span className={`text-[11px] font-bold ${item.color}`}>{item.label}</span>
                            <span className={`text-[10px] font-medium mt-0.5 ${item.color}`}>({item.count})</span>
                        </button>
                    ))}
                </div>

                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Summary</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                            <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-1">Sales Orders</div>
                            <div className="text-xl font-black text-slate-900 dark:text-white">{stats.orders}</div>
                        </div>
                        <div className="bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                            <div className="text-[9px] font-bold text-purple-600 uppercase tracking-wider mb-1">Invoices</div>
                            <div className="text-xl font-black text-slate-900 dark:text-white">{stats.invoices}</div>
                        </div>
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                            <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Payments In</div>
                            <div className="text-sm font-black text-emerald-600 mt-1.5">{formatCurrency(totalPaymentsIn)}</div>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Sales Orders</h3>
                        <button onClick={() => navigate('/sales?tab=order')} className="text-xs font-bold text-blue-600">View All</button>
                    </div>
                    <div className="space-y-3">
                        {recentOrders.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                No recent orders
                            </div>
                        ) : (
                            recentOrders.map(order => (
                                <div key={order.id} onClick={() => navigate('/sales?tab=order&view=' + order.id)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform">
                                    <div className="flex flex-col gap-1 w-[80px]">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{order.invoiceNumber}</span>
                                        <span className="text-[10px] font-medium text-slate-500">{formatDate(order.date)}</span>
                                    </div>
                                    <div className="flex flex-col items-start gap-1 flex-1 px-3 border-l border-slate-100 dark:border-slate-800 ml-2 pl-3">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-full">{order.customerName}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                                            order.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            order.status === 'paid' || order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 justify-end">
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                                            {formatCurrency(order.grandTotal)}
                                        </span>
                                        <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesDashboard;

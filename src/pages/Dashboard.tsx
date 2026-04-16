import React from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    ShoppingBag,
    Users
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

import { useNotification } from '../contexts/NotificationContext';
import Skeleton from '../components/UI/Skeleton';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    subValue?: string;
}

const StatCard = ({ title, value, icon: Icon, color, subValue }: StatCardProps) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">{title}</p>
                <h3 className="text-3xl font-bold mt-2 dark:text-white">{value}</h3>
                {subValue && <p className={`text-sm mt-2 ${subValue.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{subValue}</p>}
            </div>
            <div className={`p-4 rounded-xl ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
        </div>
    </div>
);

import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const Dashboard: React.FC = () => {
    const today = new Date();
    const { t } = useTranslation();
    const { checkReminders } = useNotification();
    const { formatCurrency, formatDate } = useSettings();
    const { hasPermission, activeBranchId, activeBranch } = useAuth();

    React.useEffect(() => {
        checkReminders();
    }, [checkReminders]);

    const invoices = useLiveQuery(() => activeBranch?.isMaster ? db.invoices.toArray() : db.invoices.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);
    const expenses = useLiveQuery(() => activeBranch?.isMaster ? db.expenses.toArray() : db.expenses.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);
    const lowStockItems = useLiveQuery(() =>
        activeBranch?.isMaster ? db.items.filter((i: any) => i.stock <= i.minStock).toArray() : db.items.where('branchId').equals(activeBranchId).filter((i: any) => i.stock <= i.minStock).toArray(), [activeBranchId, activeBranch?.isMaster]
    );
    const purchases = useLiveQuery(() => activeBranch?.isMaster ? db.purchases.toArray() : db.purchases.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);
    const suppliers = useLiveQuery(() => activeBranch?.isMaster ? db.suppliers.toArray() : db.suppliers.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);

    const inventoryItems = useLiveQuery(() => db.items.toArray());
 
    // Calculate Metrics
    const { totalSales, totalTax, totalCOGS } = (invoices || []).reduce((acc, inv) => {
        acc.totalSales += inv.grandTotal;
        acc.totalTax += inv.taxAmount || 0;
        
        const invCOGS = (inv.items || []).reduce((pSum, item) => {
            const cost = item.purchasePrice ?? (inventoryItems?.find(oi => oi.id === item.itemId)?.purchasePrice || 0);
            return pSum + (cost * item.quantity);
        }, 0);
        
        acc.totalCOGS += invCOGS;
        return acc;
    }, { totalSales: 0, totalTax: 0, totalCOGS: 0 });
 
    const netRevenue = totalSales - totalTax;
    const totalExpenses = expenses?.reduce((sum: any, exp: any) => sum + exp.amount, 0) || 0;
    const netProfit = netRevenue - totalCOGS - totalExpenses;

    const todaySales = invoices
        ?.filter((inv: any) => new Date(inv.createdAt).toDateString() === today.toDateString())
        .reduce((sum: any, inv: any) => sum + inv.grandTotal, 0) || 0;

    // Purchase Metrics
    const pendingOrders = purchases?.filter((p: any) => p.type === 'order' && p.status === 'pending') || [];
    const totalPurchasesMonth = purchases
        ?.filter((p: any) => p.type === 'bill' && new Date(p.date).getMonth() === today.getMonth())
        .reduce((sum: any, p: any) => sum + p.totalAmount, 0) || 0;
    const totalSupplierBalance = suppliers?.reduce((sum: any, s: any) => sum + (s.balance || 0), 0) || 0;

    // Chart Data Preparation (Last 7 Days)
    const chartData = Array.from({ length: 7 }).map((_: any, i: any) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toDateString();

        const sales = invoices
            ?.filter((inv: any) => new Date(inv.createdAt).toDateString() === dateStr)
            .reduce((sum: any, inv: any) => sum + inv.grandTotal, 0) || 0;

        return {
            name: formatDate(d),
            sales: sales
        };
    });




    // ... (existing code)

    const isLoading = !invoices || !expenses || !lowStockItems || !purchases || !suppliers;

    if (isLoading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div>
                    <Skeleton width={200} height={40} className="mb-2" />
                    <Skeleton width={300} height={20} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Skeleton height={140} className="rounded-2xl" />
                    <Skeleton height={140} className="rounded-2xl" />
                    <Skeleton height={140} className="rounded-2xl" />
                    <Skeleton height={140} className="rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton height={400} className="lg:col-span-2 rounded-2xl" />
                    <Skeleton height={400} className="rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold dark:text-white flex items-center gap-3">
                    {t('dashboard.title')}
                    <span className="text-sm bg-blue-600/10 text-blue-600 border border-blue-200 px-3 py-1 rounded-full font-medium">v2.9.7</span>
                </h1>
                <p className="text-slate-500 mt-1">{t('dashboard.description')}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {hasPermission('reports_view') && (
                    <>
                        <StatCard
                            title={t('dashboard.total_revenue')}
                            value={formatCurrency(netRevenue)}
                            icon={DollarSign}
                            color="bg-blue-500"
                            subValue={`+${formatCurrency(todaySales)} ${t('dashboard.today_suffix')}`}
                        />
                        <StatCard
                            title={t('dashboard.net_profit')}
                            value={formatCurrency(netProfit)}
                            icon={TrendingUp}
                            color="bg-green-500"
                        />
                        <StatCard
                            title={t('dashboard.total_expenses')}
                            value={formatCurrency(totalExpenses)}
                            icon={TrendingDown}
                            color="bg-red-500"
                        />
                    </>
                )}

                {hasPermission('inventory_view') && (
                    <StatCard
                        title={t('dashboard.low_stock_items')}
                        value={lowStockItems?.length || 0}
                        icon={AlertCircle}
                        color="bg-orange-500"
                        subValue={t('dashboard.action_needed')}
                    />
                )}
            </div>

            {/* Purchase & Supplier Stats */}
            {hasPermission('purchases_view') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium uppercase">{t('dashboard.pending_orders')}</p>
                            <h3 className="text-2xl font-bold dark:text-white">{pendingOrders.length}</h3>
                            <p className="text-xs text-slate-400">{t('dashboard.waiting_delivery')}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl">
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium uppercase">{t('dashboard.purchases_month')}</p>
                            <h3 className="text-2xl font-bold dark:text-white">{formatCurrency(totalPurchasesMonth)}</h3>
                            <p className="text-xs text-slate-400">{t('dashboard.bills_this_month')}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                        <div className="p-3 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium uppercase">{t('dashboard.supplier_balance')}</p>
                            <h3 className="text-2xl font-bold dark:text-white">{formatCurrency(totalSupplierBalance)}</h3>
                            <p className="text-xs text-slate-400">{t('dashboard.total_payable')}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts & Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                {hasPermission('reports_view') && (
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold mb-6 dark:text-white">{t('dashboard.sales_overview')}</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Low Stock List */}
                {hasPermission('inventory_view') && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold mb-6 dark:text-white flex items-center gap-2">
                            <AlertCircle size={20} className="text-orange-500" /> {t('dashboard.low_stock_items')}
                        </h3>
                        <div className="space-y-4">
                            {lowStockItems?.slice(0, 5).map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <div>
                                        <p className="font-medium dark:text-white line-clamp-1">{item.name}</p>
                                        <p className="text-xs text-slate-500">{t('dashboard.min')}: {item.minStock}</p>
                                    </div>
                                    <span className="px-3 py-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-bold">
                                        {item.stock} {t('dashboard.left')}
                                    </span>
                                </div>
                            ))}
                            {lowStockItems?.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-8">{t('dashboard.all_stocked')}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold dark:text-white">{t('dashboard.recent_transactions')}</h3>
                    {/* Added link for View All */}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 font-semibold">{t('common.date')}</th>
                                <th className="p-4 font-semibold">{t('dashboard.invoice_no')}</th>
                                <th className="p-4 font-semibold">{t('dashboard.customer')}</th>
                                <th className="p-4 font-semibold">{t('dashboard.amount')}</th>
                                <th className="p-4 font-semibold">{t('dashboard.mode')}</th>
                                <th className="p-4 font-semibold">{t('dashboard.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {[...(invoices || [])].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map((inv: any) => (
                                <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group">
                                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300 text-sm">
                                        {formatDate(inv.createdAt)}
                                    </td>
                                    <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">#{inv.invoiceNumber}</td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300 font-medium text-sm">{inv.customerName}</td>
                                    <td className="p-4 font-bold text-slate-800 dark:text-white text-sm">{formatCurrency(inv.grandTotal)}</td>
                                    <td className="p-4 text-sm">
                                        <span className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-semibold uppercase border border-slate-200 dark:border-slate-700">
                                            {inv.paymentMode}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm">
                                        <span className={`px-2 py-1.5 rounded-md text-xs font-semibold uppercase border
                                            ${inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                                inv.paymentStatus === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                                    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'}`}>
                                            {inv.paymentStatus}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {invoices?.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">{t('dashboard.no_transactions')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

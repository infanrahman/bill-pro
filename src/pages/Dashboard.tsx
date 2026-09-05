import React from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';
import {
 DollarSign,
 TrendingUp,
 TrendingDown,
 AlertCircle,
 ShoppingBag,
 Users,
 ArrowUpRight,
 ArrowDownRight,
 Layers,
 Activity
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
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

interface StatCardProps {
 title: string;
 value: string | number;
 icon: React.ElementType;
 color: string;
 subValue?: string;
 trend?: 'up' | 'down';
 index: number;
}

const StatCard = ({ title, value, icon: Icon, color, subValue, trend, index }: StatCardProps) => (
 <div
 
 
 
 className="relative group overflow-hidden bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:0_20px_50px_rgba(0,0,0,0.1)] dark:hover:0_20px_50px_rgba(0,0,0,0.3)]"
 >
 {/* Background Glow */}
 
 
 <div className="relative flex justify-between items-start z-10">
 <div className="flex-1">
 <p className="text-slate-700 dark:text-slate-300 text-[10px] font-semibold uppercase tracking-wide mb-4">{title}</p>
 <h3 className="text-3xl font-semibold dark:text-white tracking-tight group- origin-left">{value}</h3>
 
 {subValue && (
 <div className="flex items-center gap-2 mt-4">
 <span className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${trend === 'down' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
 {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
 {subValue}
 </span>
 </div>
)}
 </div>
 <div className={`p-4 rounded-2xl ${color} text-white transform`}>
 <Icon size={24} strokeWidth={2.5} />
 </div>
 </div>
 </div>
);

const Dashboard: React.FC = () => {
 const today = new Date();
 const { t } = useTranslation();
 const { checkReminders } = useNotification();
 const { formatCurrency, formatDate } = useSettings();
 const { hasPermission, activeBranchId, activeBranch, user } = useAuth();

 React.useEffect(() => {
 checkReminders();
 }, [checkReminders]);

 // Keep full invoices query for accurate total stats (important for billing app)
 const invoices = useLiveQuery(() => activeBranch?.isMaster ? db.invoices.toArray() : db.invoices.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);
 const expenses = useLiveQuery(() => activeBranch?.isMaster ? db.expenses.toArray() : db.expenses.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);
 const lowStockItems = useLiveQuery(() =>
 activeBranch?.isMaster ? db.items.filter((i: any) => i.stock <= i.minStock && !i.deletedAt).toArray() : db.items.where('branchId').equals(activeBranchId).filter((i: any) => i.stock <= i.minStock && !i.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]
);
 const purchases = useLiveQuery(() => activeBranch?.isMaster ? db.purchases.toArray() : db.purchases.where('branchId').equals(activeBranchId).toArray(), [activeBranchId, activeBranch?.isMaster]);
 const suppliers = useLiveQuery(() => activeBranch?.isMaster ? db.suppliers.filter((s: any) => !s.deletedAt).toArray() : db.suppliers.where('branchId').equals(activeBranchId).filter((s: any) => !s.deletedAt).toArray(), [activeBranchId, activeBranch?.isMaster]);
 const inventoryItems = useLiveQuery(() => db.items.toArray());

 const isLoading = !invoices || !expenses || !lowStockItems || !purchases || !suppliers;

 // Metrics Calculation
  // Only count valid sales: exclude cancelled and sales returns
  const validInvoices = (invoices || []).filter(
  (inv: any) => inv.status !== 'cancelled' && inv.type !== 'return'
  );
  // Sales returns to subtract from revenue/COGS
  const returnInvoices = (invoices || []).filter(
  (inv: any) => inv.status !== 'cancelled' && inv.type === 'return'
  );

  // Build a costMap for O(1) COGS fallback lookups instead of O(n) Array.find
  const costMap = new Map<string, number>(
    (inventoryItems || []).map(item => [item.id!, item.purchasePrice])
  );

  const { totalSales, totalTax, totalCOGS } = validInvoices.reduce((acc, inv) => {
  acc.totalSales += inv.grandTotal;
  acc.totalTax += inv.taxAmount || 0;
  const invCOGS = (inv.items || []).reduce((pSum, item) => {
  const cost = item.purchasePrice ?? (costMap.get(item.itemId) || 0);
  return pSum + (cost * item.quantity);
  }, 0);
  acc.totalCOGS += invCOGS;
  return acc;
  }, { totalSales: 0, totalTax: 0, totalCOGS: 0 });

  // Subtract returns from totals
  const { returnSales, returnTax, returnCOGS } = returnInvoices.reduce((acc, inv) => {
  acc.returnSales += inv.grandTotal || 0;
  acc.returnTax += inv.taxAmount || 0;
  const invCOGS = (inv.items || []).reduce((pSum: number, item: any) => {
  const cost = item.purchasePrice ?? (costMap.get(item.itemId) || 0);
  return pSum + (cost * item.quantity);
  }, 0);
  acc.returnCOGS += invCOGS;
  return acc;
  }, { returnSales: 0, returnTax: 0, returnCOGS: 0 });

  const netRevenue = (totalSales - returnSales) - (totalTax - returnTax);
  const totalExpenses = expenses?.reduce((sum: any, exp: any) => sum + (exp.amount || 0), 0) || 0;
  const netProfit = netRevenue - (totalCOGS - returnCOGS) - totalExpenses;

  const todaySales = (invoices || [])
  .filter((inv: any) =>
  inv.status !== 'cancelled' &&
  inv.type !== 'return' &&
  new Date(inv.createdAt).toDateString() === today.toDateString()
  )
  .reduce((sum: any, inv: any) => sum + inv.grandTotal, 0) || 0;

  const pendingOrders = purchases?.filter((p: any) => p.type === 'order' && p.status === 'pending') || [];
  // H27 Fix: also check year to avoid aggregating same-month data from previous years
  const totalPurchasesMonth = purchases
  ?.filter((p: any) => {
  const d = new Date(p.date);
  return p.type === 'bill' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  })
  .reduce((sum: any, p: any) => sum + p.totalAmount, 0) || 0;
  const totalSupplierBalance = suppliers?.reduce((sum: any, s: any) => sum + (s.balance || 0), 0) || 0;

  // Build a date->sales map from validInvoices for O(1) chart lookups
  const salesByDate = new Map<string, number>();
  for (const inv of validInvoices) {
    const dateKey = new Date(inv.createdAt).toDateString();
    salesByDate.set(dateKey, (salesByDate.get(dateKey) || 0) + inv.grandTotal);
  }

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { name: formatDate(d), sales: salesByDate.get(d.toDateString()) || 0 };
  });

 if (isLoading) {
 return (
 <div className="space-y-6 md:space-y-8 p-4 md:p-8">
 <div className="flex justify-between items-end">
 <div className="space-y-2">
 <Skeleton width={200} height={40} className="rounded-xl"/>
 <Skeleton width={300} height={20} className="rounded-lg"/>
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
 {[1, 2, 3, 4].map(i => <Skeleton key={i} height={160} className="rounded-2xl"/>)}
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <Skeleton height={450} className="lg:col-span-2 rounded-2xl"/>
 <Skeleton height={450} className="rounded-2xl"/>
 </div>
 </div>
);
 }

 const greeting = () => {
 const hour = today.getHours();
 if (hour < 12) return 'Good morning';
 if (hour < 17) return 'Good afternoon';
 return 'Good evening';
 };

 return (
 <div className="space-y-5 md:space-y-10 p-3 md:p-8 min-h-screen pb-24 md:pb-20">
 {/* Header */}
 <div className="relative">
 <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
 <div>
 <div className="flex items-center gap-3 mb-1 md:mb-2">
 <span className="text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">{greeting()}</span>
 <div className="h-[2px] w-6 md:w-8 bg-slate-900 dark:bg-white"/>
 </div>
 <h1 className="text-xl md:text-5xl font-semibold dark:text-white tracking-tight flex flex-wrap items-center gap-2 md:gap-4">
 {user?.name || 'Admin'}
 <span className="text-sm md:text-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1 md:px-4 md:py-1.5 rounded-full font-semibold uppercase tracking-wider">v3.0</span>
 </h1>
 <p className="text-slate-700 dark:text-slate-300 mt-1 md:mt-2 font-medium text-sm md:text-base">{t('dashboard.description')}</p>
 </div>
 <div className="hidden md:flex gap-3">
 <div className="px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600">
 <Activity size={20} />
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">System Status</p>
 <p className="text-sm font-semibold dark:text-white uppercase tracking-tight flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full bg-emerald-500"/>
 Operational
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Stats Grid */}
 <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
 {hasPermission('reports_view') && (
 <>
 <StatCard
 index={0}
 title={t('dashboard.total_revenue')}
 value={formatCurrency(netRevenue)}
 icon={DollarSign}
 color="to-indigo-600"
 subValue={`${formatCurrency(todaySales)} today`}
 trend="up"
 />
 <StatCard
 index={1}
 title={t('dashboard.net_profit')}
 value={formatCurrency(netProfit)}
 icon={TrendingUp}
 color="from-emerald-500 to-teal-600"
 subValue="Stable"
 trend="up"
 />
 <StatCard
 index={2}
 title={t('dashboard.total_expenses')}
 value={formatCurrency(totalExpenses)}
 icon={TrendingDown}
 color="from-rose-500 to-orange-600"
 subValue="Controlled"
 trend="down"
 />
 </>
)}
 {hasPermission('inventory_view') && (
 <StatCard
 index={3}
 title={t('dashboard.low_stock_items')}
 value={lowStockItems?.length || 0}
 icon={AlertCircle}
 color="from-amber-500 to-orange-600"
 subValue={t('dashboard.action_needed')}
 trend="down"
 />
)}
 </div>

 {/* Secondary Metrics */}
 {hasPermission('purchases_view') && (
 <div 
 
 
 
 className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8"
 >
 {[
 { title: t('dashboard.pending_orders'), value: pendingOrders.length, icon: ShoppingBag, color: 'text-white', bg: 'bg-indigo-500' },
 { title: t('dashboard.purchases_month'), value: formatCurrency(totalPurchasesMonth), icon: Layers, color: 'text-white', bg: 'bg-slate-900 dark:bg-white' },
 { title: t('dashboard.supplier_balance'), value: formatCurrency(totalSupplierBalance), icon: Users, color: 'text-rose-500', bg: 'bg-rose-500/10' }
 ].map((item, i) => (
 <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-6 hover:border-indigo-500/30 group">
 <div className={`p-4 rounded-2xl ${item.bg} text-white`}>
 <item.icon size={24} strokeWidth={2.5} />
 </div>
 <div>
 <p className="text-slate-700 dark:text-slate-300 text-[10px] font-semibold uppercase tracking-wider">{item.title}</p>
 <h3 className="text-2xl font-semibold dark:text-white tracking-tight mt-1">{item.value}</h3>
 </div>
 </div>
))}
 </div>
)}

 {/* Charts & Tables */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
 {/* Main Chart */}
 {hasPermission('reports_view') && (
 <div 
 
 
 
 className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl border border-slate-200/50 dark:border-slate-700/50"
 >
 <div className="flex justify-between items-center mb-10">
 <div>
 <h3 className="text-xl font-semibold dark:text-white tracking-tight">{t('dashboard.sales_overview')}</h3>
 <p className="text-slate-600 text-xs font-bold uppercase tracking-wider mt-1">Last 7 Days Activity</p>
 </div>
 <div className="flex gap-2">
 <div className="w-3 h-3 rounded-full bg-slate-900 dark:bg-white 0_0_10px_rgba(59,130,246,0.5)]"/>
 <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Revenue</span>
 </div>
 </div>
 <div className="h-[200px] md:h-[350px]">
 <ResponsiveContainer width="100%"height="100%">
 <AreaChart data={chartData}>
 <defs>
 <linearGradient id="colorSales"x1="0"y1="0"x2="0"y2="1">
 <stop offset="5%"stopColor="#3b82f6"stopOpacity={0.3} />
 <stop offset="95%"stopColor="#3b82f6"stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="8 8"vertical={false} stroke="#64748b"opacity={0.1} />
 <XAxis 
 dataKey="name"
 axisLine={false} 
 tickLine={false} 
 tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900, style: { textTransform: 'uppercase' } }}
 dy={20}
 />
 <YAxis 
 axisLine={false} 
 tickLine={false} 
 tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
 dx={-10}
 />
 <Tooltip 
 cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4' }}
 contentStyle={{ 
 backgroundColor: 'rgba(15, 23, 42, 0.9)', 
 borderRadius: '24px', 
 border: '1px solid rgba(255, 255, 255, 0.1)',
 backdropFilter: 'blur(12px)',
 boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
 padding: '16px'
 }}
 itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase' }}
 labelStyle={{ color: '#64748b', marginBottom: '8px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
 />
 <Area 
 type="monotone"
 dataKey="sales"
 stroke="#3b82f6"
 strokeWidth={6} 
 fillOpacity={1} 
 fill="url(#colorSales)"
 animationDuration={2000}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
)}

 {/* Low Stock List */}
 {hasPermission('inventory_view') && (
 <div 
 
 
 
 className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl border border-slate-200/50 dark:border-slate-700/50"
 >
 <h3 className="text-xl font-semibold mb-8 dark:text-white tracking-tight flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
 <AlertCircle size={20} className="text-amber-500"/>
 </div>
 {t('dashboard.low_stock_items')}
 </h3>
 <div className="space-y-4">
 {lowStockItems?.slice(0, 6).map((item: any, i: number) => (
 <div 
 
 
 
 key={item.id} 
 className="flex items-center justify-between p-5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group"
 >
 <div className="min-w-0">
 <p className="font-semibold text-xs dark:text-white line-clamp-1 uppercase tracking-tight group-hover:text-slate-900 dark:group-hover:text-white">{item.name}</p>
 <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mt-1">Ref: {item.barcode || 'N/A'}</p>
 </div>
 <span className="px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-xl text-[9px] font-semibold uppercase tracking-wider border border-rose-500/20">
 {item.stock} LEFT
 </span>
 </div>
))}
 {lowStockItems?.length === 0 && (
 <div className="flex flex-col items-center justify-center py-12 space-y-4">
 <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
 <Activity size={32} />
 </div>
 <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-wider text-center">{t('dashboard.all_stocked')}</p>
 </div>
)}
 </div>
 </div>
)}
 </div>

 {/* Recent Transactions */}
 <div 
 
 
 
 className="bg-white dark:bg-slate-800 p-4 md:p-10 rounded-2xl md:rounded-[3.5rem] border border-slate-200/50 dark:border-slate-700/50"
 >
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 md:mb-10">
 <div>
 <h3 className="text-base md:text-2xl font-semibold dark:text-white tracking-tight uppercase">{t('dashboard.recent_transactions')}</h3>
 <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wide mt-1">Live Feed</p>
 </div>
 </div>

 {/* Mobile Card List */}
 <div className="md:hidden space-y-3">
 {[...(invoices || [])].sort((a: any, b: any) => {
   const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
   const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
   return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
 }).slice(0, 8).map((inv: any) => (
   <div key={inv.id} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800">
     <div className="flex items-start justify-between mb-2">
       <div>
         <span className="font-mono text-[10px] font-semibold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
           #{inv.invoiceNumber}
         </span>
         <p className="font-semibold text-sm text-slate-900 dark:text-white mt-1.5 uppercase tracking-tight">{inv.customerName || 'Walk-in Customer'}</p>
       </div>
       <div className="text-right">
         <p className="font-bold text-base text-slate-900 dark:text-white">{formatCurrency(inv.grandTotal)}</p>
         <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full
           ${inv.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
             inv.paymentStatus === 'pending' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
             'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
           {inv.paymentStatus}
         </span>
       </div>
     </div>
     <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
       <span>{formatDate(inv.createdAt)}</span>
       <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">{inv.paymentMode}</span>
     </div>
   </div>
 ))}
 {invoices?.length === 0 && (
   <div className="flex flex-col items-center gap-4 py-12">
     <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
       <Layers size={32} />
     </div>
     <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">{t('dashboard.no_transactions')}</p>
   </div>
 )}
 </div>

 {/* Desktop Table */}
 <div className="hidden md:block overflow-x-auto -mx-10 px-10 pb-4">
 <table className="w-full text-left whitespace-nowrap min-w-[600px]">
 <thead className="text-slate-600 text-[10px] font-semibold uppercase tracking-wider">
 <tr>
 <th className="pb-8 px-4">Timestamp</th>
 <th className="pb-8 px-4">Invoice #</th>
 <th className="pb-8 px-4">Customer Entity</th>
 <th className="pb-8 px-4">Grand Total</th>
 <th className="pb-8 px-4">Method</th>
 <th className="pb-8 px-4 text-center">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {[...(invoices || [])].sort((a: any, b: any) => {
                  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
                }).slice(0, 8).map((inv: any) => (
 <tr key={inv.id} className="hover:bg-slate-100 dark:hover:bg-slate-700 group">
 <td className="py-6 px-4 font-semibold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wider">
 {formatDate(inv.createdAt)}
 </td>
 <td className="py-6 px-4">
 <span className="font-mono text-[10px] font-semibold bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white tracking-wider">#{inv.invoiceNumber}</span>
 </td>
 <td className="py-6 px-4 text-slate-800 dark:text-white font-semibold text-sm uppercase tracking-tight">{inv.customerName || 'Walk-in Customer'}</td>
 <td className="py-6 px-4 font-semibold text-slate-900 dark:text-white text-lg tracking-tight">{formatCurrency(inv.grandTotal)}</td>
 <td className="py-6 px-4">
 <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-semibold uppercase tracking-[0.15em] border border-slate-200/50 dark:border-slate-700/50">
 {inv.paymentMode}
 </span>
 </td>
 <td className="py-6 px-4 text-center">
 <span className={`px-4 py-2 rounded-2xl text-[9px] font-semibold uppercase tracking-wider border 
 ${inv.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
 inv.paymentStatus === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
 'bg-slate-900 dark:bg-white text-white border-slate-900/20 dark:border-white/20'}`}>
 {inv.paymentStatus}
 </span>
 </td>
 </tr>
))}
 {invoices?.length === 0 && (
 <tr>
 <td colSpan={6} className="text-center py-20">
 <div className="flex flex-col items-center gap-4">
 <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
 <Layers size={40} />
 </div>
 <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">{t('dashboard.no_transactions')}</p>
 </div>
 </td>
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

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesChartProps {
 data: { date: string; amount: number }[];
}

const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
 return (
 <div className="h-[300px] w-full mt-4">
 <ResponsiveContainer width="100%"height="100%">
 <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id="colorSales"x1="0"y1="0"x2="0"y2="1">
 <stop offset="5%"stopColor="#2563eb"stopOpacity={0.8} />
 <stop offset="95%"stopColor="#2563eb"stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3"vertical={false} stroke="#E2E8F0"opacity={0.5} />
 <XAxis
 dataKey="date"
 axisLine={false}
 tickLine={false}
 tick={{ fill: '#64748B', fontSize: 12 }}
 dy={10}
 />
 <YAxis
 axisLine={false}
 tickLine={false}
 tick={{ fill: '#64748B', fontSize: 12 }}
 tickFormatter={(value) =>`$${value}`}
 />
 <Tooltip
 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
 formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, 'Sales']}
 />
 <Area
 type="monotone"
 dataKey="amount"
 stroke="#2563eb"
 strokeWidth={3}
 fillOpacity={1}
 fill="url(#colorSales)"
 animationDuration={1000}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
);
};

export default SalesChart;

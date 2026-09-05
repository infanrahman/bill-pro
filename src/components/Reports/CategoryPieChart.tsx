import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CategoryPieChartProps {
 data: { name: string; value: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data }) => {
 if (data.length === 0) {
 return (
 <div className="h-[300px] w-full flex items-center justify-center text-slate-600">
 No data available for this period
 </div>
);
 }

 return (
 <div className="h-[300px] w-full mt-4">
 <ResponsiveContainer width="100%"height="100%">
 <PieChart>
 <Pie
 data={data}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={80}
 paddingAngle={5}
 dataKey="value"
 >
 {data.map((_, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
))}
 </Pie>
 <Tooltip
 formatter={(value: any) => [`${value} items`, 'Sold']}
 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
 />
 <Legend iconType="circle"/>
 </PieChart>
 </ResponsiveContainer>
 </div>
);
};

export default CategoryPieChart;

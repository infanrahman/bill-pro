import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Upload, RefreshCw, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type Scale } from '../../services/db';
import { ScaleImportExportModal } from './ScaleImportExportModal';

export interface PluRow {
 id: string; // unique internal id for react keys
 plu: number;
 name: string;
 unit: 'Weight' | 'Piece';
 price: number;
 itemCode: string;
 indexBarcode: string;
 printShelfDate: 'Not Print' | 'Print';
 shelfDays: number;
 status?: 'synced' | 'new' | 'modified' | 'deleted';
}

interface ScalePluManagerProps {
 scale: Scale;
 initialPlus: any[];
 onClose: () => void;
 onApplyToScale: (plus: PluRow[]) => Promise<void>;
 onSaveToInventory: (plus: PluRow[]) => Promise<void>;
}

const ScalePluManager: React.FC<ScalePluManagerProps> = ({ scale, initialPlus, onClose, onApplyToScale, onSaveToInventory }) => {
 const { t } = useTranslation();
 const [rows, setRows] = useState<PluRow[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [showImportExport, setShowImportExport] = useState(false);

 // Convert initial raw PLUs to our enriched structured rows
 useEffect(() => {
 const enriched = initialPlus.map(p => ({
 id: crypto.randomUUID(),
 plu: parseInt(p.plu) || 0,
 name: p.name || '',
 unit: 'Weight' as const, // Or parse from p if available
 price: Number(p.price) || 0,
 itemCode: '0',
 indexBarcode: p.plu?.toString() || '0',
 printShelfDate: 'Not Print' as const,
 shelfDays: 0,
 status: 'synced' as const
 }));
 setTimeout(() => setRows(enriched), 0);
 }, [initialPlus]);

 const handleAddRow = () => {
 const nextPlu = rows.length > 0 ? Math.max(...rows.map(r => r.plu)) + 1 : 1;
 setRows([...rows, {
 id: crypto.randomUUID(),
 plu: nextPlu,
 name: '',
 unit: 'Weight',
 price: 0,
 itemCode: '0',
 indexBarcode: nextPlu.toString(),
 printShelfDate: 'Not Print',
 shelfDays: 0,
 status: 'new'
 }]);
 };

 const handleDeleteRow = (id: string) => {
 setRows(rows.filter(r => r.id !== id));
 };

 const updateRow = (id: string, field: keyof PluRow, value: any) => {
 setRows(rows.map(r => {
 if (r.id === id) {
 return { ...r, [field]: value, status: r.status === 'synced' ? 'modified' : r.status };
 }
 return r;
 }));
 };

 return (
 <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
 {/* Toolbar */}
 <div className="flex flex-wrap items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
 <div className="flex items-center gap-4">
 <button type="button"onClick={onClose} className="p-2 -ml-2 text-slate-600 hover:text-slate-600 dark:hover:text-slate-200">
 <X size={20} />
 </button>
 <div>
 <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
 Config Wizard: PLU ({scale.name})
 </h2>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button type="button"onClick={handleAddRow} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg">
 <Plus size={16} /> Add New
 </button>
 <button type="button"
 onClick={() => setShowImportExport(true)}
 className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium rounded-lg"
 >
 <FileText size={16} /> Import / Export
 </button>
 <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
 <button type="button"onClick={() => onSaveToInventory(rows)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900 dark:hover:bg-indigo-900 dark:text-indigo-400 text-sm font-medium rounded-lg">
 <Save size={16} /> Save to Inventory
 </button>
 <button type="button"
 onClick={async () => {
 setIsLoading(true);
 await onApplyToScale(rows);
 setIsLoading(false);
 }}
 disabled={isLoading}
 className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 dark:bg-white text-white hover:bg-slate-900 dark:hover:bg-white text-sm font-medium rounded-lg disabled:opacity-50"
 >
 {isLoading ? <RefreshCw size={16} className=""/> : <Upload size={16} />}
 {t('common.save', { defaultValue: 'Apply to Scale' })}
 </button>
 </div>
 </div>

 {/* Excel-like Grid */}
 <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
 <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
 <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
 <tr>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-16 text-center">#</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-24">Number</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[200px]">Name</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-24">Unit</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-24 text-right">U.Price</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-24">Item Code</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-32">Index Barcode</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-32">Print Shelf Date</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-24">Shelf Days</th>
 <th className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 w-12 text-center">Act</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((row, index) => (
 <tr key={row.id} className={`${row.status === 'new' ? 'bg-green-50/50 dark:bg-green-900/10' : row.status === 'modified' ? 'bg-slate-100 dark:bg-slate-800 ' : 'bg-white dark:bg-slate-900'} border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 group`}>
 <td className="px-3 py-1.5 border-r border-slate-100 dark:border-slate-800 text-center text-xs text-slate-600">{index + 1}</td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <input
 type="number"
 value={row.plu}
 onChange={(e) => updateRow(row.id, 'plu', parseInt(e.target.value) || 0)}
 className="w-full h-8 px-3 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm dark:text-white"
 />
 </td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <input
 type="text"
 value={row.name}
 onChange={(e) => updateRow(row.id, 'name', e.target.value)}
 className="w-full h-8 px-3 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm dark:text-white"
 />
 </td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <select
 value={row.unit}
 onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
 className="w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm dark:text-white"
 >
 <option value="Weight">Weight</option>
 <option value="Piece">Piece</option>
 </select>
 </td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <input
 type="number"
 step="0.01"
 value={row.price}
 onChange={(e) => updateRow(row.id, 'price', parseFloat(e.target.value) || 0)}
 className="w-full h-8 px-3 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm text-right font-mono dark:text-white"
 />
 </td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <input
 type="text"
 value={row.itemCode}
 onChange={(e) => updateRow(row.id, 'itemCode', e.target.value)}
 className="w-full h-8 px-3 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm dark:text-white"
 />
 </td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <input
 type="text"
 value={row.indexBarcode}
 onChange={(e) => updateRow(row.id, 'indexBarcode', e.target.value)}
 className="w-full h-8 px-3 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm dark:text-white"
 />
 </td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <select
 value={row.printShelfDate}
 onChange={(e) => updateRow(row.id, 'printShelfDate', e.target.value)}
 className="w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm dark:text-white"
 >
 <option value="Not Print">Not Print</option>
 <option value="Print">Print</option>
 </select>
 </td>
 <td className="px-0 py-0 border-r border-slate-100 dark:border-slate-800">
 <input
 type="number"
 value={row.shelfDays}
 onChange={(e) => updateRow(row.id, 'shelfDays', parseInt(e.target.value) || 0)}
 className="w-full h-8 px-3 bg-transparent outline-none focus:bg-slate-100 dark:focus:bg-slate-800 text-sm dark:text-white"
 />
 </td>
 <td className="px-0 py-0 text-center">
 <button type="button"
 onClick={() => handleDeleteRow(row.id)}
 className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
 >
 <Trash2 size={14} />
 </button>
 </td>
 </tr>
))}
 {rows.length === 0 && (
 <tr>
 <td colSpan={10} className="px-6 py-12 text-center text-slate-600 dark:text-slate-400">
 No PLUs present. Add a new row or import from Excel.
 </td>
 </tr>
)}
 </tbody>
 </table>
 </div>

 <div className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-2 px-4 text-xs text-slate-700 dark:text-slate-300 flex justify-between">
 <span>Total Items: {rows.length}</span>
 <span className="flex gap-4">
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> New Rows</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 inline-block"></span> Modified Rows</span>
 </span>
 </div>

 <ScaleImportExportModal
 isOpen={showImportExport}
 onClose={() => setShowImportExport(false)}
 currentRows={rows}
 onImport={(newRows) => {
 setRows([...rows, ...newRows]);
 setShowImportExport(false);
 }}
 onExport={() => { }}
 />
 </div>
);
};

export default ScalePluManager;

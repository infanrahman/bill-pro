import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { Plus, Table, Trash2, Calendar, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';

interface SpreadsheetListProps {
 onSelect: (id: string | 'new') => void;
}

const SpreadsheetList: React.FC<SpreadsheetListProps> = ({ onSelect }) => {
 const { t } = useTranslation();
 const { formatDate } = useSettings();

 // Query spreadsheets and sort in memory since updatedAt is not indexed
 const spreadsheets = useLiveQuery(
 async () => {
 const data = await db.spreadsheets.toArray();
 return data.sort((a: any, b: any) => {
 const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
 const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
 return dateB - dateA; // Descending
 });
 }
);

 const handleDelete = async (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 if (window.confirm('Are you sure you want to delete this spreadsheet?')) {
 await db.spreadsheets.delete(id);
 }
 };

 if (!spreadsheets) return <div className="p-8 text-center">Loading...</div>;

 return (
 <div className="space-y-6 w-full mx-auto p-6">
 <div className="flex justify-between items-center">
 <div>
 <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
 <FileSpreadsheet className="text-green-600"/>
 {t('sidebar.excel_sheet')}
 </h1>
 <p className="text-slate-700 text-sm">Manage your spreadsheets</p>
 </div>
 <button type="button"
 onClick={() => onSelect('new')}
 className="flex items-center gap-2 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white text-white px-4 py-2 rounded-lg"
 >
 <Plus size={20} />
 <span>Create New Sheet</span>
 </button>
 </div>

 {spreadsheets.length === 0 ? (
 <div className="bg-white dark:bg-slate-800 rounded-xl border-dashed border-2 border-slate-300 dark:border-slate-700 p-12 text-center">
 <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
 <Table size={32} />
 </div>
 <h3 className="text-lg font-medium dark:text-white mb-2">No spreadsheets yet</h3>
 <p className="text-slate-700 dark:text-slate-300 mb-6">Create your first spreadsheet to start organizing data.</p>
 <button type="button"
 onClick={() => onSelect('new')}
 className="inline-flex items-center gap-2 text-slate-900 dark:text-white hover:text-slate-900 dark:hover:text-white font-medium"
 >
 <Plus size={20} />
 Create Spreadsheet
 </button>
 </div>
) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {spreadsheets.map((sheet: any) => (
 <div
 key={sheet.id}
 onClick={() => sheet.id && onSelect(sheet.id)}
 className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover: cursor-pointer group"
 >
 <div className="flex justify-between items-start mb-3">
 <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
 <Table size={24} />
 </div>
 <button type="button"
 onClick={(e) => sheet.id && handleDelete(sheet.id, e)}
 className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100"
 title="Delete"
 >
 <Trash2 size={16} />
 </button>
 </div>
 <h3 className="font-bold dark:text-white mb-1 truncate">{sheet.name}</h3>
 <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 mt-2">
 <Calendar size={12} />
 <span>Updated {formatDate(sheet.updatedAt)}</span>
 </div>
 </div>
))}
 </div>
)}
 </div>
);
};

export default SpreadsheetList;

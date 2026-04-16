import React, { useState, useRef } from 'react';
import { X, Upload, Save, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { PluRow } from './ScalePluManager';

// The fields our scale expects based on the Config Wizard
const SCALE_FIELDS = [
    { key: 'plu', label: 'Number (PLU)', type: 'number', defaultValue: '1' },
    { key: 'name', label: 'Name', type: 'string', defaultValue: 'Item' },
    { key: 'unit', label: 'Unit', type: 'select', options: ['Weight', 'Piece'], defaultValue: 'Weight' },
    { key: 'price', label: 'U.Price', type: 'number', defaultValue: '0' },
    { key: 'itemCode', label: 'Item Code', type: 'string', defaultValue: '0' },
    { key: 'indexBarcode', label: 'Index Barcode', type: 'string', defaultValue: '0' },
    { key: 'printShelfDate', label: 'Print Shelf Date', type: 'select', options: ['Not Print', 'Print'], defaultValue: 'Not Print' },
    { key: 'shelfDays', label: 'Shelf Days', type: 'number', defaultValue: '0' },
];

interface ScaleImportExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRows: PluRow[];
    onImport: (newRows: PluRow[]) => void;
    onExport: () => void; // Could also just generate export here
}

export const ScaleImportExportModal: React.FC<ScaleImportExportModalProps> = ({ isOpen, onClose, currentRows, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload phases: 'select' -> 'map' -> 'done'
    const [phase, setPhase] = useState<'select' | 'map'>('select');
    const [importedData, setImportedData] = useState<any[]>([]);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [fileName, setFileName] = useState('');

    // Mapping: scaleFieldKey -> fileHeaderName or null 
    const [fieldMapping, setFieldMapping] = useState<Record<string, string | null>>({});
    const [defaultValues, setDefaultValues] = useState<Record<string, string>>({});

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (data.length > 0) {
                    const headers = data[0].map(h => String(h || '').trim());
                    // Remove empty rows
                    const rows = data.slice(1).filter(row => row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== ''));

                    // Map arrays to objects based on header row
                    const objectRows = rows.map(rowArray => {
                        const obj: any = {};
                        headers.forEach((header, index) => {
                            if (header) {
                                obj[header] = rowArray[index];
                            }
                        });
                        return obj;
                    });

                    setFileHeaders(headers.filter(h => h));
                    setImportedData(objectRows);

                    // Setup initial mappings (auto-match by name if possible)
                    const initialMapping: Record<string, string | null> = {};
                    const initDefaults: Record<string, string> = {};

                    SCALE_FIELDS.forEach(field => {
                        const match = headers.find(h => h.toLowerCase().includes(field.label.toLowerCase()) || field.label.toLowerCase().includes(h.toLowerCase()));
                        initialMapping[field.key] = match || null;
                        initDefaults[field.key] = field.defaultValue;
                    });

                    setFieldMapping(initialMapping);
                    setDefaultValues(initDefaults);
                    setPhase('map');
                } else {
                    alert("Empty file or unrecognized format.");
                }
            } catch (err) {
                console.error("Error parsing file", err);
                alert("Failed to parse the file. Please ensure it is a valid Excel or CSV file.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImportSubmit = () => {
        const newRows: PluRow[] = importedData.map(dataRow => {
            const row: any = {
                id: crypto.randomUUID(),
                status: 'new'
            };

            SCALE_FIELDS.forEach(field => {
                const mappedHeader = fieldMapping[field.key];
                let rawValue = mappedHeader && dataRow[mappedHeader] !== undefined && dataRow[mappedHeader] !== null
                    ? dataRow[mappedHeader]
                    : defaultValues[field.key];

                // Type safety formatting
                if (field.type === 'number') {
                    row[field.key] = Number(rawValue) || 0;
                } else if (field.type === 'string') {
                    row[field.key] = String(rawValue);
                } else if (field.type === 'select') {
                    // Check if value exists in allowed options, else fallback to default
                    row[field.key] = field.options?.includes(String(rawValue)) ? String(rawValue) : field.defaultValue;
                } else {
                    row[field.key] = rawValue;
                }
            });

            return row as PluRow;
        });

        onImport(newRows);
    };

    const handleExport = () => {
        // Export existing grid data
        const exportData = currentRows.map(row => {
            const exp: any = {};
            SCALE_FIELDS.forEach(f => {
                exp[f.label] = row[f.key as keyof PluRow];
            });
            return exp;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PLUs");
        XLSX.writeFile(wb, "Scale_PLUs_Export.xlsx");
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh] max-h-[800px]">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold dark:text-white">Excel/CSV Import and Export</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Map your Excel columns to the Scale Database fields.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900">
                    {phase === 'select' ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 max-w-md mx-auto">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Upload size={36} />
                                </div>
                                <h3 className="text-xl font-bold dark:text-white mb-2">Import PLU List</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                    Upload an Excel (.xlsx, .xls) or CSV file containing your products. In the next step, you will map the columns.
                                </p>
                            </div>

                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20"
                            >
                                Select File to Import
                            </button>

                            <div className="relative w-full my-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-300 dark:border-slate-700"></div></div>
                                <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-50 dark:bg-slate-900 text-slate-500">OR</span></div>
                            </div>

                            <button
                                onClick={handleExport}
                                className="w-full py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors"
                            >
                                Export Current Grid to Excel
                            </button>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg">
                                <AlertCircle size={20} />
                                <span className="text-sm">Mapping {importedData.length} rows from <strong>{fileName}</strong>. If a column is unmapped (None), the Default Value will be used.</span>
                            </div>

                            <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 w-1/3">Scale Field Name</th>
                                            <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 w-1/3 border-l border-slate-200 dark:border-slate-700">Import File Column</th>
                                            <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 w-1/3 border-l border-slate-200 dark:border-slate-700">Default Value (If None/Empty)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SCALE_FIELDS.map((field) => (
                                            <tr key={field.key} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3 text-sm font-medium dark:text-white">
                                                    {field.label}
                                                </td>
                                                <td className="px-4 py-2 border-l border-slate-100 dark:border-slate-700/50">
                                                    <select
                                                        value={fieldMapping[field.key] || ''}
                                                        onChange={(e) => setFieldMapping({ ...fieldMapping, [field.key]: e.target.value || null })}
                                                        className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                                                    >
                                                        <option value="">-- None --</option>
                                                        {fileHeaders.map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2 border-l border-slate-100 dark:border-slate-700/50">
                                                    {field.type === 'select' ? (
                                                        <select
                                                            value={defaultValues[field.key]}
                                                            onChange={(e) => setDefaultValues({ ...defaultValues, [field.key]: e.target.value })}
                                                            className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                                                            disabled={!!fieldMapping[field.key]}
                                                        >
                                                            {field.options?.map(o => (
                                                                <option key={o} value={o}>{o}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type={field.type === 'number' ? 'number' : 'text'}
                                                            step={field.type === 'number' ? 'any' : undefined}
                                                            value={defaultValues[field.key]}
                                                            onChange={(e) => setDefaultValues({ ...defaultValues, [field.key]: e.target.value })}
                                                            className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white disabled:opacity-50 disabled:bg-slate-100"
                                                            disabled={!!fieldMapping[field.key]}
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between">
                    <button
                        onClick={() => phase === 'map' ? setPhase('select') : onClose()}
                        className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {phase === 'map' ? 'Back' : 'Cancel'}
                    </button>

                    {phase === 'map' && (
                        <button
                            onClick={handleImportSubmit}
                            className="px-6 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Save size={18} />
                            Import {importedData.length} Rows
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

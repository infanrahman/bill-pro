import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Download, Bold, AlignLeft, AlignCenter, AlignRight, Undo, Minus, Palette, Type, Scissors, Copy, Clipboard, Eraser, Redo, Grid3X3, ArrowLeft, WrapText, HelpCircle } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../../components/UI/Modal';
import { db } from '../../services/db';

// Types
interface CellStyle {
 bold?: boolean;
 align?: 'left' | 'center' | 'right';
 color?: string;
 bgColor?: string;
 fontSize?: 'sm' | 'base' | 'lg' | 'xl';
 wrapText?: boolean;
 format?: 'text' | 'number' | 'currency' | 'percentage' | 'date';
 border?: boolean;
}

interface SelectionStats {
 sum: number;
 avg: number;
 min: number;
 max: number;
 count: number;
}

interface SpreadsheetState {
 data: string[][];
 headers: string[];
 styles: Record<string, CellStyle>;
 colWidths: Record<number, number>;
 rowHeights: Record<number, number>;
}

interface SheetEditorProps {
 sheetId: string | 'new';
 onBack: () => void;
}

const SheetEditor: React.FC<SheetEditorProps> = ({ sheetId, onBack }) => {
 // const { t } = useTranslation(); // t unused
 const { addToast } = useNotification();

 // State
 const [data, setData] = useState<string[][]>(Array(20).fill('').map(() => Array(10).fill('')));
 const [headers, setHeaders] = useState<string[]>(Array(10).fill('').map((_: any, i: any) => String.fromCharCode(65 + i)));
 const [colWidths, setColWidths] = useState<Record<number, number>>({});
 const [styles, setStyles] = useState<Record<string, CellStyle>>({});
 const [selectedCell, setSelectedCell] = useState<{ r: number, c: number } | null>(null);
 const [rowHeights, setRowHeights] = useState<Record<number, number>>({});

 const [sheetName, setSheetName] = useState('Untitled Spreadsheet');
 const [isSaving, setIsSaving] = useState(false);

 const [selectionRange, setSelectionRange] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } } | null>(null);
 const [isDragging, setIsDragging] = useState(false);

 // Resize State
 const [resizingCol, setResizingCol] = useState<number | null>(null);
 const [resizingRow, setResizingRow] = useState<number | null>(null);
 const [resizeStart, setResizeStart] = useState<number | null>(null);
 const [startSize, setStartSize] = useState<number>(0);

 // AutoFill
 const [isFilling, setIsFilling] = useState(false);
 const [fillRange, setFillRange] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } } | null>(null);

 // Context Menu
 const [contextMenu, setContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null);

 const [history, setHistory] = useState<SpreadsheetState[]>([]);
 const [redoStack, setRedoStack] = useState<SpreadsheetState[]>([]);
 const [clipboard, setClipboard] = useState<{ matrix: { val: string, style?: CellStyle }[][] } | null>(null);
 const [showHelp, setShowHelp] = useState(false);

 // Load Data
 useEffect(() => {
 if (sheetId === 'new') return;

 const loadSheet = async () => {
 try {
 const sheet = await db.spreadsheets.get(sheetId);
 if (sheet) {
 setSheetName(sheet.name || 'Untitled');

 // Safely reconstruct data, ensuring no undefined rows crash the mapping later
 const safeData = sheet.data ? sheet.data.map((row: any) => row ? [...row] : []) : Array(20).fill('').map(() => Array(10).fill(''));
 setData(safeData);

 setHeaders(sheet.headers || Array(10).fill('').map((_: any, i: any) => String.fromCharCode(65 + i)));
 setStyles(sheet.styles || {});
 setColWidths(sheet.colWidths || {});
 setRowHeights(sheet.rowHeights || {});
 } else {
 addToast('Spreadsheet not found', 'error');
 onBack();
 }
 } catch (error) {
 console.error(error);
 addToast('Failed to load spreadsheet', 'error');
 }
 };
 loadSheet();
 }, [sheetId, onBack, addToast]);

 const saveState = useCallback(async () => {
 setIsSaving(true);
 try {
 // First we need to get the existing sheet if it exists
 let existingParams: Partial<SpreadsheetState> & { createdAt?: Date } = {};
 if (sheetId !== 'new') {
 const sheet = await db.spreadsheets.get(sheetId);
 if (sheet) existingParams = { createdAt: sheet.createdAt };
 }

 const payload = {
 name: sheetName,
 data,
 headers,
 styles,
 colWidths,
 rowHeights,
 updatedAt: new Date(),
 createdAt: existingParams.createdAt || new Date()
 };

 if (sheetId === 'new') {
 const { createRecordMetadata } = await import('../../services/db');
 await db.spreadsheets.add({
 ...createRecordMetadata(),
 ...payload
 } as any);
 addToast('Spreadsheet created', 'success');
 onBack(); // Simplest to go back to list to see it
 } else {
 await db.spreadsheets.update(sheetId, payload);
 addToast('Spreadsheet saved', 'success');
 }
 } catch (error) {
 console.error(error);
 addToast('Failed to save', 'error');
 } finally {
 setIsSaving(false);
 }
 }, [sheetId, sheetName, data, headers, styles, colWidths, rowHeights, addToast, onBack]);

 const addToHistory = () => {
 setHistory(prev => [...prev.slice(-10), {
 data: JSON.parse(JSON.stringify(data)),
 headers: [...headers],
 styles: JSON.parse(JSON.stringify(styles)),
 colWidths: { ...colWidths },
 rowHeights: { ...rowHeights }
 }]);
 setRedoStack([]); // Clear redo on new action
 };

 const undo = useCallback(() => {
 if (history.length === 0) return;
 const last = history[history.length - 1];
 setHistory(prev => prev.slice(0, -1));

 // Push current to redo
 setRedoStack(prev => [...prev, {
 data: JSON.parse(JSON.stringify(data)),
 headers: [...headers],
 styles: JSON.parse(JSON.stringify(styles)),
 colWidths: { ...colWidths },
 rowHeights: { ...rowHeights }
 }]);

 setData(last.data);
 setHeaders(last.headers);
 setStyles(last.styles);
 setColWidths(last.colWidths || {});
 setRowHeights(last.rowHeights || {});
 addToast("Undid last action","info");
 }, [history, data, headers, styles, colWidths, rowHeights, addToast]);

 const redo = useCallback(() => {
 if (redoStack.length === 0) return;
 const next = redoStack[redoStack.length - 1];
 setRedoStack(prev => prev.slice(0, -1));

 // Push current to history
 setHistory(prev => [...prev, {
 data: JSON.parse(JSON.stringify(data)),
 headers: [...headers],
 styles: JSON.parse(JSON.stringify(styles)),
 colWidths: { ...colWidths },
 rowHeights: { ...rowHeights }
 }]);

 setData(next.data);
 setHeaders(next.headers);
 setStyles(next.styles);
 setColWidths(next.colWidths || {});
 setRowHeights(next.rowHeights || {});
 addToast("Redid action","info");
 }, [redoStack, data, headers, styles, colWidths, rowHeights, addToast]);

 // Global Mouse Up for Resize & AutoFill
 useEffect(() => {
 const handleGlobalMouseUp = () => {
 if (isFilling && selectionRange && fillRange) {
 // Execute Auto Fill
 addToHistory();
 const newData = [...data];
 const rMin = Math.min(selectionRange.start.r, selectionRange.end.r);
 const rMax = Math.max(selectionRange.start.r, selectionRange.end.r);
 const cMin = Math.min(selectionRange.start.c, selectionRange.end.c);
 const cMax = Math.max(selectionRange.start.c, selectionRange.end.c);

 const frMin = Math.min(fillRange.start.r, fillRange.end.r);
 const frMax = Math.max(fillRange.start.r, fillRange.end.r);
 const fcMin = Math.min(fillRange.start.c, fillRange.end.c);
 const fcMax = Math.max(fillRange.start.c, fillRange.end.c);

 for (let r = frMin; r <= frMax; r++) {
 for (let c = fcMin; c <= fcMax; c++) {
 if (r >= rMin && r <= rMax && c >= cMin && c <= cMax) continue; // Skip source
 const srcR = rMin + ((r - rMin) % (rMax - rMin + 1));
 const srcC = cMin + ((c - cMin) % (cMax - cMin + 1));
 newData[r][c] = newData[srcR][srcC];
 if (styles[`${srcR},${srcC}`]) {
 setStyles(p => ({ ...p, [`${r},${c}`]: styles[`${srcR},${srcC}`] }));
 }
 }
 }
 setData(newData);
 setSelectionRange(fillRange); // Expand select
 }

 setResizingCol(null);
 setResizingRow(null);
 setIsFilling(false);
 setFillRange(null);
 };
 const handleGlobalMouseMove = (e: MouseEvent) => {
 if (resizingCol !== null && resizeStart !== null) {
 const diff = e.clientX - resizeStart;
 const newWidth = Math.max(50, startSize + diff);
 setColWidths(prev => ({ ...prev, [resizingCol]: newWidth }));
 }
 if (resizingRow !== null && resizeStart !== null) {
 const diff = e.clientY - resizeStart;
 const newHeight = Math.max(25, startSize + diff);
 setRowHeights(prev => ({ ...prev, [resizingRow]: newHeight }));
 }
 };
 window.addEventListener('mouseup', handleGlobalMouseUp);
 window.addEventListener('mousemove', handleGlobalMouseMove);
 return () => {
 window.removeEventListener('mouseup', handleGlobalMouseUp);
 window.removeEventListener('mousemove', handleGlobalMouseMove);
 };
 }, [resizingCol, resizingRow, resizeStart, startSize, isFilling, selectionRange, fillRange, data, styles]);

 // Close context menu on click
 useEffect(() => {
 const handleClick = () => setContextMenu(null);
 window.addEventListener('click', handleClick);
 return () => window.removeEventListener('click', handleClick);
 }, []);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (!selectedCell) return;
 // Only navigate if modifier keys are not used (except Shift)
 if (e.ctrlKey || e.altKey || e.metaKey) return;

 const { r, c } = selectedCell;
 let nr = r, nc = c;

 if (e.key === 'Tab') {
 e.preventDefault();
 nc = e.shiftKey ? Math.max(0, c - 1) : Math.min(headers.length - 1, c + 1);
 } else if (e.key === 'Enter') {
 e.preventDefault();
 nr = e.shiftKey ? Math.max(0, r - 1) : Math.min(data.length - 1, r + 1);
 } else {
 return;
 }

 if (nr !== r || nc !== c) {
 setSelectedCell({ r: nr, c: nc });
 // Clear range on nav
 setSelectionRange({ start: { r: nr, c: nc }, end: { r: nr, c: nc } });
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [selectedCell, headers.length, data.length]);

 // Shortcuts
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.ctrlKey || e.metaKey) && e.key === 's') {
 e.preventDefault();
 saveState();
 }
 if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
 e.preventDefault();
 undo();
 }
 if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
 e.preventDefault();
 redo();
 }
 if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
 e.preventDefault();
 redo();
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [saveState, undo, redo]);

 // --- Logic & Formulas ---

 const parseCellRef = (ref: string) => {
 const match = ref.match(/^([A-Z]+)([0-9]+)$/);
 if (!match) return null;
 let colIndex = 0;
 for (let i = 0; i < match[1].length; i++) colIndex = colIndex * 26 + (match[1].charCodeAt(i) - 64);
 return { c: colIndex - 1, r: parseInt(match[2]) - 1 };
 };

 const getCellValue = (r: number, c: number, visited: Set<string>): string | number => {
 const key =`${r},${c}`;
 if (visited.has(key)) return 0;
 visited.add(key);
 if (r < 0 || r >= data.length || c < 0 || c >= (data[0]?.length || 0)) return 0;

 const val = data[r][c];
 if (!val) return 0;
 if (val.startsWith('=')) return evaluateFormula(val.substring(1), visited);
 return isNaN(Number(val)) ? val : Number(val);
 };

 const evaluateFormula = (formula: string, visited: Set<string>): string | number => {
 try {
 let parsed = formula.toUpperCase();

 // Helper to get range values
 const getRangeValues = (p1: string, p2: string) => {
 const s = parseCellRef(p1);
 const e = parseCellRef(p2);
 if (!s || !e) return [];
 const vals: number[] = [];
 for (let r = Math.min(s.r, e.r); r <= Math.max(s.r, e.r); r++) {
 for (let c = Math.min(s.c, e.c); c <= Math.max(s.c, e.c); c++) {
 const v = getCellValue(r, c, new Set(visited));
 vals.push(typeof v === 'number' ? v : 0);
 }
 }
 return vals;
 };

 // 1. Handle Ranges First (SUM, AVG, etc)
 parsed = parsed.replace(/(SUM|AVERAGE|MIN|MAX|COUNT)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)/g, (_, fn, p1, p2) => {
 const vals = getRangeValues(p1, p2);
 if (fn === 'SUM') return String(vals.reduce((a: any, b: any) => a + b, 0));
 if (fn === 'AVERAGE') return String(vals.length ? vals.reduce((a: any, b: any) => a + b, 0) / vals.length : 0);
 if (fn === 'MIN') return String(vals.length ? Math.min(...vals) : 0);
 if (fn === 'MAX') return String(vals.length ? Math.max(...vals) : 0);
 if (fn === 'COUNT') return String(vals.filter((v: any) => v !== 0).length);
 return '0';
 });

 // 2. Resolve Cell References
 parsed = parsed.replace(/[A-Z]+[0-9]+/g, (m) => {
 const ref = parseCellRef(m);
 if (!ref) return '0';
 const val = getCellValue(ref.r, ref.c, visited);
 return typeof val === 'string' ?`"${val}"`: String(val);
 });

 // 3. Shim Excel functions to JS
 const scope = {
 IF: (c: any, t: any, f: any) => c ? t : f,
 CONCAT: (...args: any[]) => args.join(''),
 UPPER: (s: any) => String(s).toUpperCase(),
 LOWER: (s: any) => String(s).toLowerCase(),
 ROUND: (n: any) => Math.round(Number(n)),
 ABS: (n: any) => Math.abs(Number(n)),
 SQRT: (n: any) => Math.sqrt(Number(n)),
 LEN: (s: any) => String(s).length,
 TRIM: (s: any) => String(s).trim()
 };

 const funcs = ['IF', 'CONCAT', 'UPPER', 'LOWER', 'ROUND', 'ABS', 'SQRT', 'LEN', 'TRIM'];
 funcs.forEach((fn: any) => {
 const regex = new RegExp(`\\b${fn}\\(`, 'g');
 parsed = parsed.replace(regex,`this.${fn}(`);
 });

 // 4. Eval
 
 return new Function('return ' + parsed).call(scope);

 } catch (e) {
 console.error(e);
 return"#ERR";
 }
 };

 const getDisplayValue = (r: number, c: number, raw: string) => {
 if (selectedCell?.r === r && selectedCell?.c === c) return raw;
 let val = raw;
 if (raw?.startsWith('=')) {
 try { val = String(evaluateFormula(raw.substring(1), new Set())); }
 catch { return"#ERR"; }
 }

 const fmt = styles[`${r},${c}`]?.format;
 if (fmt && val && !isNaN(Number(val))) {
 const num = Number(val);
 if (fmt === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
 if (fmt === 'percentage') return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 }).format(num / 100);
 if (fmt === 'number') return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(num);
 if (fmt === 'date') return new Date(num).toLocaleDateString();
 }
 return val;
 };

 const getSelectionStats = (): SelectionStats | null => {
 if (!selectionRange) return null;
 const vals: number[] = [];
 const rMin = Math.min(selectionRange.start.r, selectionRange.end.r);
 const rMax = Math.max(selectionRange.start.r, selectionRange.end.r);
 const cMin = Math.min(selectionRange.start.c, selectionRange.end.c);
 const cMax = Math.max(selectionRange.start.c, selectionRange.end.c);

 for (let r = rMin; r <= rMax; r++) {
 for (let c = cMin; c <= cMax; c++) {
 const raw = data[r][c];
 let val = parseFloat(raw);
 if (raw.startsWith('=')) {
 val = parseFloat(String(getDisplayValue(r, c, raw)).replace(/[^0-9.-]+/g,""));
 }
 if (!isNaN(val)) vals.push(val);
 }
 }

 if (vals.length === 0) return null;
 const sum = vals.reduce((a: any, b: any) => a + b, 0);
 return {
 sum,
 avg: sum / vals.length,
 min: Math.min(...vals),
 max: Math.max(...vals),
 count: vals.length
 };
 };

 const stats = getSelectionStats();

 // --- Actions ---

 const updateCell = (r: number, c: number, val: string) => {
 if (data[r][c] === val) return;
 addToHistory();
 const newData = [...data];
 newData[r] = [...newData[r]];
 newData[r][c] = val;
 setData(newData);
 };

 const updateHeader = (i: number, val: string) => {
 const newH = [...headers];
 newH[i] = val;
 setHeaders(newH);
 };

 const addRow = (index?: number) => {
 addToHistory();
 const newData = [...data];
 const newRow = Array(headers.length).fill('');
 if (typeof index === 'number') {
 newData.splice(index, 0, newRow);
 } else {
 newData.push(newRow);
 }
 setData(newData);
 };

 const deleteRow = () => {
 if (!selectedCell) return;
 addToHistory();
 const newData = data.filter((_: any, i: any) => i !== selectedCell.r);
 setData(newData);
 setSelectedCell(null);
 };

 const addCol = (index?: number) => {
 addToHistory();
 const nextChar = String.fromCharCode(65 + (headers.length % 26));
 const headerName = headers.length >= 26 ?`A${nextChar}`: nextChar;

 const newHeaders = [...headers];
 const newData = data.map((r: any) => [...r]);

 if (typeof index === 'number') {
 newHeaders.splice(index, 0, headerName);
 newData.forEach((r: any) => r.splice(index, 0, ''));
 } else {
 newHeaders.push(headerName);
 newData.forEach((r: any) => r.push(''));
 }
 setHeaders(newHeaders);
 setData(newData);
 };

 const deleteCol = () => {
 if (!selectedCell) return;
 addToHistory();
 const c = selectedCell.c;
 setHeaders(headers.filter((_: any, i: any) => i !== c));
 setData(data.map((row: any) => row.filter((_: any, i: any) => i !== c)));
 setSelectedCell(null);
 };

 const handleCopy = () => {
 if (!selectedCell) return;
 let rMin = selectedCell.r, rMax = selectedCell.r;
 let cMin = selectedCell.c, cMax = selectedCell.c;

 if (selectionRange) {
 rMin = Math.min(selectionRange.start.r, selectionRange.end.r);
 rMax = Math.max(selectionRange.start.r, selectionRange.end.r);
 cMin = Math.min(selectionRange.start.c, selectionRange.end.c);
 cMax = Math.max(selectionRange.start.c, selectionRange.end.c);
 }

 const matrix = [];
 for (let r = rMin; r <= rMax; r++) {
 const row = [];
 for (let c = cMin; c <= cMax; c++) {
 row.push({
 val: data[r][c],
 style: styles[`${r},${c}`]
 });
 }
 matrix.push(row);
 }
 setClipboard({ matrix });
 addToast("Copied to clipboard","success");
 };

 const handleCut = () => {
 if (!selectedCell) return;
 handleCopy();
 addToHistory();
 const rMin = selectionRange ? Math.min(selectionRange.start.r, selectionRange.end.r) : selectedCell.r;
 const rMax = selectionRange ? Math.max(selectionRange.start.r, selectionRange.end.r) : selectedCell.r;
 const cMin = selectionRange ? Math.min(selectionRange.start.c, selectionRange.end.c) : selectedCell.c;
 const cMax = selectionRange ? Math.max(selectionRange.start.c, selectionRange.end.c) : selectedCell.c;

 const newData = data.map((r: any) => [...r]);
 for (let r = rMin; r <= rMax; r++) {
 for (let c = cMin; c <= cMax; c++) {
 if (newData[r] && newData[r][c] !== undefined) newData[r][c] = '';
 }
 }
 setData(newData);
 };

 const handlePaste = () => {
 if (!selectedCell || !clipboard) return;
 addToHistory();
 const startR = selectedCell.r;
 const startC = selectedCell.c;
 const matrix = clipboard.matrix;

 const newStyles = { ...styles };
 const newData = [...data];

 matrix.forEach((row, i) => {
 row.forEach((cell, j) => {
 const targetR = startR + i;
 const targetC = startC + j;
 if (targetR < data.length && targetC < headers.length) {
 newData[targetR][targetC] = cell.val;
 if (cell.style) {
 newStyles[`${targetR},${targetC}`] = cell.style;
 }
 }
 });
 });

 setData(newData);
 setStyles(newStyles);
 };

 const clearFormatting = () => {
 if (!selectedCell && !selectionRange) return;
 addToHistory();
 const newStyles = { ...styles };

 const loopRange = (cb: (r: number, c: number) => void) => {
 if (selectionRange) {
 const rMin = Math.min(selectionRange.start.r, selectionRange.end.r);
 const rMax = Math.max(selectionRange.start.r, selectionRange.end.r);
 const cMin = Math.min(selectionRange.start.c, selectionRange.end.c);
 const cMax = Math.max(selectionRange.start.c, selectionRange.end.c);
 for (let r = rMin; r <= rMax; r++) for (let c = cMin; c <= cMax; c++) cb(r, c);
 } else if (selectedCell) {
 cb(selectedCell.r, selectedCell.c);
 }
 };

 loopRange((r, c) => {
 delete newStyles[`${r},${c}`];
 });
 setStyles(newStyles);
 };

 const toggleStyle = (key: keyof CellStyle, val: any) => {
 if (!selectedCell && !selectionRange) return;
 const newStyles = { ...styles };

 const loopRange = (cb: (r: number, c: number) => void) => {
 if (selectionRange) {
 const rMin = Math.min(selectionRange.start.r, selectionRange.end.r);
 const rMax = Math.max(selectionRange.start.r, selectionRange.end.r);
 const cMin = Math.min(selectionRange.start.c, selectionRange.end.c);
 const cMax = Math.max(selectionRange.start.c, selectionRange.end.c);
 for (let r = rMin; r <= rMax; r++) for (let c = cMin; c <= cMax; c++) cb(r, c);
 } else if (selectedCell) {
 cb(selectedCell.r, selectedCell.c);
 }
 };

 loopRange((r, c) => {
 const cellKey =`${r},${c}`;
 const current = newStyles[cellKey] || {};
 newStyles[cellKey] = { ...current, [key]: current[key] === val ? undefined : val };
 });

 setStyles(newStyles);
 };

 const handleMouseDown = (r: number, c: number) => {
 setIsDragging(true);
 setSelectedCell({ r, c });
 setSelectionRange({ start: { r, c }, end: { r, c } });
 };

 const handleMouseEnter = (r: number, c: number) => {
 if (isDragging && selectionRange) {
 setSelectionRange({ ...selectionRange, end: { r, c } });
 }
 if (isFilling && selectionRange) {
 const rMax = Math.max(selectionRange.start.r, selectionRange.end.r);
 const cMax = Math.max(selectionRange.start.c, selectionRange.end.c);
 if (r > rMax || c > cMax) {
 setFillRange({ start: selectionRange.start, end: { r: Math.max(r, selectionRange.end.r), c: Math.max(c, selectionRange.end.c) } });
 }
 }
 };

 const handleMouseUp = () => {
 setIsDragging(false);
 };

 const exportExcel = () => {
 const out = data.map((row: any, r: any) => row.map((cell: any, c: any) => getDisplayValue(r, c, cell)));
 const ws = utils.aoa_to_sheet([headers, ...out]);
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws,"Sheet1");
 writeFile(wb,`${sheetName}.xlsx`);
 };

 return (
 <div className="h-full flex flex-col space-y-2">
 <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
 <div className="flex items-center gap-2 flex-1">
 <button type="button"onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
 <ArrowLeft size={20} />
 </button>
 <input
 type="text"
 value={sheetName}
 onChange={(e) => setSheetName(e.target.value)}
 className="font-bold text-lg bg-transparent border-none outline-none focus:ring-1 ring-slate-900/20 dark:ring-white/20 rounded px-1 dark:text-white"
 placeholder="Spreadsheet Name"
 />
 </div>

 <div className="flex items-center gap-2">
 <div className="flex gap-1 border-l pl-2 border-slate-200 dark:border-slate-700">
 <button type="button"onClick={saveState} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 flex items-center gap-2"title="Save">
 <Save size={18} />
 {isSaving && <span className="text-xs">Saving...</span>}
 </button>
 <button type="button"onClick={undo} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"title="Undo"><Undo size={18} /></button>
 <button type="button"onClick={redo} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"title="Redo"><Redo size={18} /></button>
 <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"/>
 <button type="button"onClick={() => toggleStyle('bold', true)} className={`p-2 rounded ${styles[`${selectedCell?.r},${selectedCell?.c}`]?.bold ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><Bold size={18} /></button>
 <button type="button"onClick={() => toggleStyle('align', 'left')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><AlignLeft size={18} /></button>
 <button type="button"onClick={() => toggleStyle('align', 'center')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><AlignCenter size={18} /></button>
 <button type="button"onClick={() => toggleStyle('align', 'right')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><AlignRight size={18} /></button>
 <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"/>
 <div className="flex items-center gap-1">
 <label className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer flex items-center gap-1"title="Text Color">
 <Type size={18} className="text-slate-600 dark:text-slate-300"/>
 <input
 type="color"
 className="w-4 h-4 p-0 border-none outline-none bg-transparent cursor-pointer"
 onChange={(e) => toggleStyle('color', e.target.value)}
 value={styles[`${selectedCell?.r},${selectedCell?.c}`]?.color || '#000000'}
 />
 </label>
 <label className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer flex items-center gap-1"title="Background Color">
 <Palette size={18} className="text-slate-600 dark:text-slate-300"/>
 <input
 type="color"
 className="w-4 h-4 p-0 border-none outline-none bg-transparent cursor-pointer"
 onChange={(e) => toggleStyle('bgColor', e.target.value)}
 value={styles[`${selectedCell?.r},${selectedCell?.c}`]?.bgColor || '#ffffff'}
 />
 </label>
 </div>
 <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"/>
 <button type="button"onClick={() => toggleStyle('border', true)} className={`p-2 rounded ${styles[`${selectedCell?.r},${selectedCell?.c}`]?.border ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><Grid3X3 size={18} /></button>
 <button type="button"onClick={() => toggleStyle('wrapText', true)} className={`p-2 rounded ${styles[`${selectedCell?.r},${selectedCell?.c}`]?.wrapText ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><WrapText size={18} /></button>
 </div>
 <button type="button"onClick={exportExcel} className="p-2 hover:bg-green-100 text-green-600 rounded flex items-center gap-1">
 <Download size={18} /> <span className="text-xs font-bold">Export</span>
 </button>
 <button type="button"onClick={() => setShowHelp(true)} className="p-2 text-slate-600 hover:text-slate-900 dark:hover:text-white"><HelpCircle size={18} /></button>
 </div>
 </div>

 {/* Formula Bar */}
 <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
 <div className="font-bold text-xs text-slate-700 w-8 text-center bg-slate-100 dark:bg-slate-700 rounded py-1">
 {selectedCell ?`${headers[selectedCell.c]}${selectedCell.r + 1}`: ''}
 </div>
 <div className="text-slate-600">fx</div>
 <input
 className="flex-1 bg-transparent outline-none text-sm dark:text-white font-mono"
 value={selectedCell ? data[selectedCell.r][selectedCell.c] : ''}
 onChange={(e) => selectedCell && updateCell(selectedCell.r, selectedCell.c, e.target.value)}
 placeholder="Select a cell to edit..."
 disabled={!selectedCell}
 />
 </div>

 {/* Grid */}
 <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
 <table className="w-full border-collapse select-none"style={{ tableLayout: 'fixed' }}>
 <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900">
 <tr>
 <th className="w-10 p-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 z-30"></th>
 {headers.map((h: any, i: any) => (
 <th key={i} className="border border-slate-200 dark:border-slate-700 p-0 relative group"style={{ width: colWidths[i] || 100 }}>
 <input
 className="w-full bg-transparent text-center font-bold text-xs p-1 outline-none dark:text-slate-300"
 value={h}
 onChange={(e) => updateHeader(i, e.target.value)}
 onContextMenu={(e) => {
 e.preventDefault();
 setContextMenu({ x: e.clientX, y: e.clientY, r: -1, c: i });
 }}
 />
 <div
 className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-slate-100 dark:hover:bg-slate-800 z-40"
 onMouseDown={(e) => {
 e.stopPropagation();
 setResizingCol(i);
 setResizeStart(e.clientX);
 setStartSize(colWidths[i] || 100);
 }}
 />
 </th>
))}
 <th className="w-8 border border-slate-200 dark:border-slate-700 p-0">
 <button type="button"onClick={() => addCol()} className="w-full h-full hover:bg-slate-200 flex items-center justify-center text-slate-600"><Plus size={14} /></button>
 </th>
 </tr>
 </thead>
 <tbody>
 {data.map((row: any, r: any) => (
 <tr key={r} style={{ height: rowHeights[r] || 24 }}>
 <td
 className="text-center font-mono text-xs text-slate-600 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 sticky left-0 z-10 cursor-pointer hover:bg-slate-200 relative group"
 onContextMenu={(e) => {
 e.preventDefault();
 setContextMenu({ x: e.clientX, y: e.clientY, r, c: -1 });
 }}
 >
 {r + 1}
 <div
 className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-slate-100 dark:hover:bg-slate-800 z-40"
 onMouseDown={(e) => {
 e.stopPropagation();
 setResizingRow(r);
 setResizeStart(e.clientY);
 setStartSize(rowHeights[r] || 24);
 }}
 />
 </td>
 {row.map((cell: any, c: any) => {
 const isSelected = selectedCell?.r === r && selectedCell?.c === c;
 const inRange = selectionRange && r >= Math.min(selectionRange.start.r, selectionRange.end.r) && r <= Math.max(selectionRange.start.r, selectionRange.end.r) && c >= Math.min(selectionRange.start.c, selectionRange.end.c) && c <= Math.max(selectionRange.start.c, selectionRange.end.c);
 const style = styles[`${r},${c}`] || {};
 return (
 <td
 key={c}
 className={`border border-slate-200 dark:border-slate-700 p-0 relative 
 ${isSelected ? 'outline outline-2 outline-blue-500 z-10' : ''}
 ${inRange ? 'bg-slate-100 dark:bg-slate-800 ' : ''}
`}
 onMouseDown={() => handleMouseDown(r, c)}
 onMouseEnter={() => handleMouseEnter(r, c)}
 onContextMenu={(e) => {
 e.preventDefault();
 setContextMenu({ x: e.clientX, y: e.clientY, r, c });
 }}
 style={{
 textAlign: style.align || 'left',
 fontWeight: style.bold ? 'bold' : 'normal',
 color: style.color,
 backgroundColor: style.bgColor,
 fontSize: style.fontSize === 'xl' ? '20px' : style.fontSize === 'lg' ? '18px' : style.fontSize === 'sm' ? '12px' : '14px',
 whiteSpace: style.wrapText ? 'normal' : 'nowrap',
 border: style.border ? '1px solid #000' : undefined
 }}
 >
 <div className="w-full h-full px-1 overflow-hidden">
 {getDisplayValue(r, c, cell)}
 </div>
 {isSelected && (
 <div
 className="absolute bottom-[-4px] right-[-4px] w-3 h-3 bg-slate-900 dark:bg-white cursor-crosshair z-20 border-2 border-white"
 onMouseDown={(e) => {
 e.stopPropagation();
 setIsFilling(true);
 setFillRange({ start: { r, c }, end: { r, c } });
 }}
 />
)}
 </td>
);
 })}
 </tr>
))}
 </tbody>
 </table>
 <div className="p-2">
 <button type="button"onClick={() => addRow()} className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded">
 <Plus size={14} /> Add Row
 </button>
 </div>
 </div>

 {
 contextMenu && (
 <div
 className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded py-1 z-50 text-sm"
 style={{ top: contextMenu.y, left: contextMenu.x }}
 >
 <button type="button"onClick={() => { handleCut(); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white flex items-center gap-2"><Scissors size={14} /> Cut</button>
 <button type="button"onClick={() => { handleCopy(); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white flex items-center gap-2"><Copy size={14} /> Copy</button>
 <button type="button"onClick={() => { handlePaste(); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white flex items-center gap-2"><Clipboard size={14} /> Paste</button>
 <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"/>
 <button type="button"onClick={() => { addRow(contextMenu.r); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white flex items-center gap-2"disabled={contextMenu.r === -1}><Plus size={14} /> Insert Row</button>
 <button type="button"onClick={() => { addCol(contextMenu.c); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white flex items-center gap-2"disabled={contextMenu.c === -1}><Plus size={14} /> Insert Column</button>
 <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"/>
 <button type="button"onClick={() => { clearFormatting(); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white flex items-center gap-2"><Eraser size={14} /> Clear Content</button>
 <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"/>
 <button type="button"onClick={() => { deleteRow(); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"><Minus size={14} /> Delete Row</button>
 <button type="button"onClick={() => { deleteCol(); setContextMenu(null); }} className="block w-full text-left px-4 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete Column</button>
 </div>
)
 }

 {/* Status Bar */}
 <div className="bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-1 flex justify-end gap-6 text-xs text-slate-600 dark:text-slate-300 font-mono px-4">
 {stats ? (
 <>
 <span>Count: <span className="font-bold text-slate-800 dark:text-slate-200">{stats.count}</span></span>
 <span>Min: <span className="font-bold text-slate-800 dark:text-slate-200">{stats.min}</span></span>
 <span>Max: <span className="font-bold text-slate-800 dark:text-slate-200">{stats.max}</span></span>
 <span>Avg: <span className="font-bold text-slate-800 dark:text-slate-200">{stats.avg.toFixed(2)}</span></span>
 <span>Sum: <span className="font-bold text-slate-800 dark:text-slate-200">{stats.sum.toFixed(2)}</span></span>
 </>
) : (
 <span>Ready</span>
)}
 </div>

 <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} title="Spreadsheet Help">
 <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
 <div>
 <h4 className="font-bold text-slate-900 dark:text-white mb-1">Formulas</h4>
 <ul className="list-disc pl-4 space-y-1">
 <li><code>=SUM(A1:A5)</code> - Calculate sum of range</li>
 <li><code>=AVERAGE(A1:B2)</code> - Calculate average</li>
 <li><code>=A1+B2</code> - Basic arithmetic (+, -, *, /)</li>
 <li><code>=IF(A1&gt;10,"Yes","No")</code> - Logic</li>
 </ul>
 </div>
 </div>
 </Modal>
 </div>
);
};

export default SheetEditor;

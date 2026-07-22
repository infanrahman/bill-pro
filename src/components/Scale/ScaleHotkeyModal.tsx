import React, { useState, useEffect } from 'react';

import { X, Save, Search, Settings } from 'lucide-react';
import { db } from '../../services/db';
import type { Scale, Item } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { useLiveQuery } from 'dexie-react-hooks';

interface ScaleHotkeyModalProps {
 scale: Scale;
 onClose: () => void;
}

interface HotkeyMapping {
 keyIndex: number; // 1 to 63 for IM-xA/TM-xA
 plu: string;
 itemName: string;
}

const MAX_HOTKEYS = 112; // IM-xA can support up to 112 per page usually, let's show an 8x14 grid or 7x10. Let's start with 63 which is common for TM-A.

const ScaleHotkeyModal: React.FC<ScaleHotkeyModalProps> = ({ scale, onClose }) => {
 const { addToast } = useNotification();
 const items = useLiveQuery(() => db.items.toArray());

 const [mappings, setMappings] = useState<HotkeyMapping[]>([]);
 const [selectedKeyIndex, setSelectedKeyIndex] = useState<number | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [isSaving, setIsSaving] = useState(false);

 // Initialize empirical grid if empty
 useEffect(() => {
 const initial: HotkeyMapping[] = [];
 for (let i = 1; i <= MAX_HOTKEYS; i++) {
 initial.push({ keyIndex: i, plu: '', itemName: '' });
 }
 setMappings(initial);
 // We could load existing mappings from DEXIE or Scale here, but scale doesn't support reading hotkeys natively in the UPL command we found.
 }, []);

 const handleAssign = (item: Item) => {
 if (selectedKeyIndex === null) {
 addToast('Please select a Hotkey slot first.', 'warning');
 return;
 }
 const plu = item.barcode || item.id?.toString() || '00000';
 setMappings(prev => prev.map(m => m.keyIndex === selectedKeyIndex ? { ...m, plu, itemName: item.name } : m));
 // Move to next empty slot automatically
 setSelectedKeyIndex(selectedKeyIndex < MAX_HOTKEYS ? selectedKeyIndex + 1 : null);
 };

 const handleClear = (keyIndex: number) => {
 setMappings(prev => prev.map(m => m.keyIndex === keyIndex ? { ...m, plu: '', itemName: '' } : m));
 };

 const handleSaveHotkeys = async () => {
 setIsSaving(true);
 try {
 if (!window.electron?.scaleSyncHotkeys) {
 addToast('System updating, please restart app to enable hotkey sync.', 'error');
 return;
 }
 const activeMapps = mappings.filter(m => m.plu && m.plu !== '');
 const payload = activeMapps.map(m => ({
 keyIndex: m.keyIndex.toString(),
 plu: m.plu
 }));

 const result = await window.electron.scaleSyncHotkeys(scale.ipAddress, scale.port, payload);
 if (result.success) {
 addToast('Shortcut Keys successfully uploaded to Scale!', 'success');
 onClose();
 } else {
 addToast(result.message || 'Failed to sync hotkeys', 'error');
 }
 } catch (error) {
 console.error('Save Hotkeys Error:', error);
 addToast('Unexpected error during hotkey sync.', 'error');
 } finally {
 setIsSaving(false);
 }
 };

 const filteredItems = items?.filter(item =>
 (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
 (item.barcode && item.barcode.includes(searchQuery))
) || [];

 return (
 <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
 {/* Header */}
 <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
 <div>
 <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
 <Settings className="w-6 h-6 text-indigo-500"/>
 Shortcut Key Config
 </h2>
 <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">Configure physical hotkeys for {scale.name} ({scale.ipAddress})</p>
 </div>
 <button type="button"onClick={onClose} className="text-gray-600 hover:text-gray-600 dark:hover:text-gray-300">
 <X className="w-6 h-6"/>
 </button>
 </div>

 {/* Content */}
 <div className="flex-1 flex overflow-hidden">
 {/* Left Panel: Keyboard Grid */}
 <div className="flex-1 border-r border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-6 overflow-y-auto">
 <div className="grid grid-cols-7 gap-2">
 {mappings.map((mapping) => (
 <div
 key={mapping.keyIndex}
 onClick={() => setSelectedKeyIndex(mapping.keyIndex)}
 className={`relative flex flex-col justify-center items-center h-20 rounded-lg border-2 cursor-pointer ${selectedKeyIndex === mapping.keyIndex
 ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900 0_0_0_4px_rgba(99,102,241,0.2)]'
 : mapping.plu
 ? 'border-green-500/50 bg-white dark:bg-gray-800 hover:border-green-500 hover:'
 : 'border-dashed border-gray-300 dark:border-gray-600 bg-transparent hover:border-indigo-400 hover:bg-white dark:hover:bg-gray-800'
 }`}
 >
 <span className="absolute top-1 left-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
 {mapping.keyIndex}
 </span>
 {mapping.plu && (
 <button type="button"
 onClick={(e) => { e.stopPropagation(); handleClear(mapping.keyIndex); }}
 className="absolute top-1 right-1 text-gray-300 hover:text-red-500"
 >
 <X className="w-3 h-3"/>
 </button>
)}
 {mapping.plu ? (
 <div className="text-center px-2 mt-2">
 <p className="text-xs font-bold text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight">
 {mapping.itemName}
 </p>
 <p className="text-[10px] text-gray-700 mt-0.5 font-mono">PLU {mapping.plu}</p>
 </div>
) : (
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">Empty</span>
)}
 </div>
))}
 </div>
 </div>

 {/* Right Panel: Item Selector */}
 <div className="w-96 bg-white dark:bg-gray-800 flex flex-col">
 <div className="p-4 border-b border-gray-100 dark:border-gray-700">
 <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
 {selectedKeyIndex !== null
 ?`Assign to Key ${selectedKeyIndex}`
 : 'Select a Key on the left'}
 </h3>
 <div className="relative">
 <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/>
 <input
 type="text"
 placeholder="Search products..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 disabled={selectedKeyIndex === null}
 className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
 />
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-4 space-y-2">
 {selectedKeyIndex === null ? (
 <div className="h-full flex flex-col flex-1 items-center justify-center text-center px-6">
 <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
 <Settings className="w-8 h-8 text-gray-600"/>
 </div>
 <p className="text-gray-700 dark:text-gray-300">Click any key slot on the left to start assigning products.</p>
 </div>
) : filteredItems.length > 0 ? (
 filteredItems.map(item => (
 <button type="button"
 key={item.id}
 onClick={() => handleAssign(item)}
 className="w-full text-left p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-500 hover: group bg-white dark:bg-gray-800"
 >
 <div className="flex justify-between items-start">
 <div>
 <p className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
 {item.name}
 </p>
 <div className="flex items-center gap-3 mt-1">
 <p className="text-sm font-mono text-gray-700 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
 {item.barcode || item.id}
 </p>
 <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
 ₹{item.salePrice?.toFixed(2)}
 </p>
 </div>
 </div>
 </div>
 </button>
))
) : (
 <div className="text-center py-8 text-gray-700 dark:text-gray-300">
 No products found matching your search.
 </div>
)}
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
 <div className="text-sm text-gray-700 dark:text-gray-300">
 {mappings.filter(m => m.plu).length} keys assigned
 </div>
 <div className="flex gap-3">
 <button type="button"
 onClick={onClose}
 className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
 >
 Cancel
 </button>
 <button type="button"
 onClick={handleSaveHotkeys}
 disabled={isSaving}
 className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 font-medium"
 >
 <Save className={`${isSaving ? '' : ''} w-4 h-4`} />
 {isSaving ? 'Uploading to Scale...' : 'Execute & Save'}
 </button>
 </div>
 </div>
 </div>
 </div>
);
};

export default ScaleHotkeyModal;

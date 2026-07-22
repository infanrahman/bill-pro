import { db, type Item, type Scale } from './db';

const logScaleAction = async (scaleIp: string, action: string, pluNo: string | undefined, status: 'success' | 'failed', response: string) => {
 try {
 const { createRecordMetadata } = await import('./db');
 await db.scaleLogs.add({
 ...createRecordMetadata(),
 scaleIp,
 action,
 pluNo,
 status,
 response,
 createdAt: new Date()
 });
 } catch (e) {
 console.error('Failed to log scale action', e);
 }
};

class ScaleService {
 async testConnection(ipAddress: string, port: number): Promise<{ success: boolean; message: string }> {
 console.log(`Testing TCP connection to ${ipAddress}:${port}...`);
 if (window.electron?.scaleConnect) {
 try {
 const result = await window.electron.scaleConnect(ipAddress, port);
 await logScaleAction(ipAddress, 'CONNECT', undefined, result.success ? 'success' : 'failed', result.message);
 return { success: result.success, message: result.message };
 } catch (err: any) {
 console.error('Scale TCP connection test failed:', err);
 await logScaleAction(ipAddress, 'CONNECT', undefined, 'failed', err.message);
 return { success: false, message: err.message || 'Unknown connection error' };
 }
 }
 return { success: false, message: 'IPC Bridge not connected' };
 }

 async syncTime(scale: Scale, timeStr?: string): Promise<boolean> {
 if (window.electron?.scaleSyncTime) {
 try {
 const result = await window.electron.scaleSyncTime(scale.ipAddress, scale.port, timeStr);
 await logScaleAction(scale.ipAddress, 'SYNC_TIME', undefined, result.success ? 'success' : 'failed', result.message);
 return result.success;
 } catch (err: any) {
 await logScaleAction(scale.ipAddress, 'SYNC_TIME', undefined, 'failed', err.message);
 return false;
 }
 }
 return false;
 }

 async deletePLU(scale: Scale, pluNumber: string): Promise<boolean> {
 if (window.electron?.scaleDeletePLU) {
 try {
 const result = await window.electron.scaleDeletePLU(scale.ipAddress, scale.port, pluNumber);
 await logScaleAction(scale.ipAddress, 'DELETE_PLU', pluNumber, result.success ? 'success' : 'failed', result.message);
 return result.success;
 } catch (err: any) {
 await logScaleAction(scale.ipAddress, 'DELETE_PLU', pluNumber, 'failed', err.message);
 return false;
 }
 }
 return false;
 }

 async uploadProducts(scale: Scale, items: Item[], isFullSync: boolean = true): Promise<{ success: boolean; message: string; successfulItems: number; failedItems: number }> {
 console.log(`Starting upload to scale: ${scale.name} at ${scale.ipAddress}`);

 if (items.length === 0) {
 return { success: false, message: 'No items to upload.', successfulItems: 0, failedItems: 0 };
 }

 if (window.electron?.scaleFullSync) {
 try {
 const syncMethod = isFullSync ? window.electron.scaleFullSync : window.electron.scaleIncrementalSync;
 const result = await syncMethod(scale.ipAddress, scale.port, items);

 // Log the batch sync
 await logScaleAction(scale.ipAddress, isFullSync ? 'FULL_SYNC' : 'INCREMENTAL_SYNC', undefined, result.success ? 'success' : 'failed', result.message);

 // Update DB Last Sync
 if (result.success) {
 await db.scales.update(scale.id!, {
 status: 'online',
 lastSync: new Date()
 });
 } else {
 await db.scales.update(scale.id!, { status: 'offline' });
 }

 // For simplicity, returning counts based on success boolean right now
 return {
 success: result.success,
 message: result.message,
 successfulItems: result.success ? items.length : 0,
 failedItems: result.success ? 0 : items.length
 };
 } catch (err: any) {
 await logScaleAction(scale.ipAddress, isFullSync ? 'FULL_SYNC' : 'INCREMENTAL_SYNC', undefined, 'failed', err.message);
 return { success: false, message:`Failed to communicate with ${scale.model} scale.`, successfulItems: 0, failedItems: items.length };
 }
 }

 return { success: false, message: 'Electron IPC not found.', successfulItems: 0, failedItems: items.length };
 }

 async downloadExistingPLUs(scale: Scale): Promise<{ success: boolean; plus: any[], message: string }> {
 console.log(`Downloading PLUs from scale: ${scale.name}`);

 if (window.electron?.scaleDownloadPLU) {
 try {
 const result = await window.electron.scaleDownloadPLU(scale.ipAddress, scale.port);
 await logScaleAction(scale.ipAddress, 'DOWNLOAD_PLU', undefined, result.success ? 'success' : 'failed', result.message);

 // Parser logic: If success, we'd normally parse result.data TSV string here
 // For now returning empty array as placeholder until TSV parsing dictates structure
 const parsedPlus: any[] = [];
 if (result.success && result.data) {
 const lines = result.data.split(/\r?\n/);
 for (const line of lines) {
 const cols = line.split('\t').map(c => c.trim());
 if (cols.length >= 3) {
 // ENOTEQ Format:
 // PLU \t No. \t Name \t Unit \t UnitPrice \t ItemCode \t IndexBarcode \t PrintDate \t ShelfDays \t Department \t Format
 if (cols[0] === 'PLU') {
 // Sometimes the first column is PLU, so No is [1], Name is [2]
 // But wait! In the screenshot:
 // Number=1 (cols[1]), Name=0 (cols[2]?), UnitPrice=456 (cols[4]), IndexBarcode=1 (cols[6])
 // ENOTEQ scale returns a massive 69-column format on UPL PLU!
 // Here is the exact mapping from the device:
 // 0: PLU
 // 1: PLU Number
 // 2: Item Code
 // 3: Unit Price
 // 4: Unit Type (0 = Weight, 1 = Piece, etc.)
 // 15: Name

 // Determine format based on length. If it's a huge dump (> 15 cols), use ENOTEQ map.
 if (cols.length >= 16) {
 parsedPlus.push({
 plu: parseInt(cols[1]) || 0,
 name: cols[15] || 'Unknown',
 price: parseFloat(cols[5]?.replace(',', '.')) || 0, // ENOTEQ uses comma for decimal sometimes
 unit: parseInt(cols[4]) === 1 ? 'Piece' : 'Weight',
 itemCode: cols[2] || '0',
 // The wireshark dump confirmed price is index 5 and indexBarcode is index 3
 indexBarcode: cols[3],
 printShelfDate: parseInt(cols[7]) === 1 ? 'Print' : 'Not Print',
 shelfDays: parseInt(cols[8]) || 0
 });
 } else {
 // Fallback for smaller/other PLU lengths sent by different firmwares
 parsedPlus.push({
 plu: parseInt(cols[1]) || 0,
 name: cols[2] !== undefined ? cols[2] : '',
 unit: parseInt(cols[3]) === 1 ? 'Piece' : 'Weight',
 price: parseFloat(cols[4]) || parseFloat(cols[3]) || 0,
 itemCode: cols[5] || cols[1],
 indexBarcode: cols[6] || cols[1],
 printShelfDate: parseInt(cols[7]) === 1 ? 'Print' : 'Not Print',
 shelfDays: parseInt(cols[8]) || 0
 });
 }
 } else if (/^\d+$/.test(cols[0])) {
 // Fallback for bare rows: 1 \t Name \t Price ...
 parsedPlus.push({
 plu: parseInt(cols[0]) || 0,
 name: cols[2] !== undefined ? cols[2] : cols[1], // Sometimes ItemCode is col 1
 price: parseFloat(cols[4]) || parseFloat(cols[3]) || parseFloat(cols[2]) || 0
 });
 }
 }
 }
 if (parsedPlus.length === 0 && lines.length > 0) {
 result.message ="Received data but couldn't parse. Raw:"+ result.data.substring(0, 100);
 }
 }

 // Temporary logging of first parsed item to help debug if needed
 if (parsedPlus.length > 0 && result.data) {
 console.log("Parsed First PLU:", parsedPlus[0]);
 console.log("From Raw Line:", result.data.split(/\r?\n/)[0]);
 }

 return {
 success: result.success,
 message: result.message,
 plus: parsedPlus
 };
 } catch (err: any) {
 await logScaleAction(scale.ipAddress, 'DOWNLOAD_PLU', undefined, 'failed', err.message);
 return { success: false, message:`Download failed: ${err.message}`, plus: [] };
 }
 }
 return { success: false, message: 'Electron IPC not found', plus: [] };
 }

 async readWeight(scale: Scale): Promise<{ success: boolean; data?: number; message: string }> {
 if (window.electron?.scaleReadWeight) {
 try {
 const result = await window.electron.scaleReadWeight(scale.ipAddress, scale.port);
 await logScaleAction(scale.ipAddress, 'READ_WEIGHT', undefined, result.success ? 'success' : 'failed', result.message);
 return result;
 } catch (err: any) {
 await logScaleAction(scale.ipAddress, 'READ_WEIGHT', undefined, 'failed', err.message);
 return { success: false, message: err.message || 'Unknown error' };
 }
 }
 return { success: false, message: 'IPC Bridge not connected' };
 }

 async bulkSyncAllScales(items: Item[]): Promise<{ totalScales: number, successful: number, failed: number }> {
 const scales = await db.scales.toArray();
 if (scales.length === 0) {
 return { totalScales: 0, successful: 0, failed: 0 };
 }

 // Run sync in parallel for all scales
 const results = await Promise.all(
 scales.map(scale => this.uploadProducts(scale, items, true))
);

 let successful = 0;
 let failed = 0;

 for (const res of results) {
 if (res.success) successful++;
 else failed++;
 }

 return { totalScales: scales.length, successful, failed };
 }
}

export const scaleService = new ScaleService();

import { db, createRecordMetadata, type Shift } from './db';

export const shiftService = {
 /**
 * Finds the currently active shift for a user in a specific branch.
 */
 async getCurrentShift(userId: string, branchId: string): Promise<Shift | null> {
 const shift = await db.shifts
 .where({ userId, branchId, status: 'open' })
 .first();
 return shift || null;
 },

 /**
 * Opens a new shift for the user.
 */
 async openShift(userId: string, username: string, branchId: string, openingFloat: number): Promise<Shift> {
 const newShift: Shift = {
 ...createRecordMetadata(),
 branchId,
 userId,
 username,
 openTime: new Date(),
 openingFloat,
 totalCashSales: 0,
 totalCardSales: 0,
 totalUpiSales: 0,
 totalCreditSales: 0,
 status: 'open'
 };

 await db.shifts.add(newShift);
 return newShift;
 },

 /**
 * Calculates the expected values for a shift and closes it.
 */
 async closeShift(shiftId: string, actualCash: number, notes?: string): Promise<Shift> {
 const shift = await db.shifts.get(shiftId);
 if (!shift) throw new Error('Shift not found');

 // Aggregate All Invoices for this shift
 const invoices = await db.invoices.where('shiftId').equals(shiftId).toArray();
 
 let cashSales = 0;
 let cardSales = 0;
 let upiSales = 0;
 let creditSales = 0;

 invoices.forEach(inv => {
 if (inv.paymentMode === 'cash') cashSales += inv.grandTotal;
 else if (inv.paymentMode === 'card') cardSales += inv.grandTotal;
 else if (inv.paymentMode === 'upi') upiSales += inv.grandTotal;
 else if (inv.paymentMode === 'credit') creditSales += inv.grandTotal;
 });

 // Add any manual Cash Entries (In/Out) linked to this user/branch/time
 // Note: For simplicity, we filter by time range if explicit link is missing
 const cashEntries = await db.cashEntries
 .where('branchId').equals(shift.branchId)
 .filter(entry => entry.date >= shift.openTime && (!shift.closeTime || entry.date <= shift.closeTime))
 .toArray();

 let netCashEntries = 0;
 cashEntries.forEach(entry => {
 if (entry.type === 'in') netCashEntries += entry.amount;
 else netCashEntries -= entry.amount;
 });

 const expectedCash = shift.openingFloat + cashSales + netCashEntries;

 const updatedShift: Shift = {
 ...shift,
 closeTime: new Date(),
 expectedCash,
 actualCash,
 totalCashSales: cashSales,
 totalCardSales: cardSales,
 totalUpiSales: upiSales,
 totalCreditSales: creditSales,
 status: 'closed',
 notes,
 updatedAt: new Date()
 };

 await db.shifts.put(updatedShift);
 return updatedShift;
 },

 /**
 * Gets a detailed summary for a shift.
 */
 async getShiftStats(shiftId: string) {
 const shift = await db.shifts.get(shiftId);
 if (!shift) return null;

 const invoices = await db.invoices.where('shiftId').equals(shiftId).toArray();
 
 return {
 shift,
 invoiceCount: invoices.length,
 invoices
 };
 }
};

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
 // H8 Fix: Check for existing open shift first
 const existing = await this.getCurrentShift(userId, branchId);
 if (existing) {
   return existing; // Return existing active shift instead of creating duplicate
 }

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

 // H9 Fix: Aggregate only valid invoices (exclude cancelled and draft; subtract returns)
 const invoices = await db.invoices.where('shiftId').equals(shiftId).toArray();
 const validInvoices = invoices.filter((inv: any) => inv.status !== 'cancelled' && inv.status !== 'draft' && !inv.deletedAt);
 
 let cashSales = 0;
 let cardSales = 0;
 let upiSales = 0;
 let creditSales = 0;

 validInvoices.forEach(inv => {
   const multiplier = inv.type === 'return' ? -1 : 1;
   const amount = (inv.grandTotal || 0) * multiplier;
   if (inv.paymentMode === 'cash') cashSales += amount;
   else if (inv.paymentMode === 'card') cardSales += amount;
   else if (inv.paymentMode === 'upi') upiSales += amount;
   else if (inv.paymentMode === 'credit') creditSales += amount;
 });

 // M22 Fix: Add manual Cash Entries linked to this branch, time range, and user (if tagged)
 const openTimeDate = new Date(shift.openTime);
 const closeTimeDate = shift.closeTime ? new Date(shift.closeTime) : new Date();

 const cashEntries = await db.cashEntries
   .where('branchId').equals(shift.branchId)
   .filter(entry => {
     const entryDate = new Date(entry.date);
     const matchesTime = entryDate >= openTimeDate && entryDate <= closeTimeDate;
     const matchesUser = !(entry as any).userId || (entry as any).userId === shift.userId;
     return matchesTime && matchesUser;
   })
   .toArray();

 let netCashEntries = 0;
 cashEntries.forEach(entry => {
   if (entry.type === 'in') netCashEntries += (entry.amount || 0);
   else netCashEntries -= (entry.amount || 0);
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

import { db, type Item } from './db';

export const recommendationService = {
 /**
 * Finds items frequently bought with the given item IDs.
 * Logic: 
 * 1. Find all invoices containing any of the target items.
 * 2. Count occurrences of other items in those invoices.
 * 3. Return the top N items.
 */
 async getFrequentlyBoughtWith(itemIds: string[], limit: number = 5): Promise<Item[]> {
 if (itemIds.length === 0) return [];

 try {
 // 1. Get recent invoices (last 1000 for performance)
 const recentInvoices = await db.invoices
 .orderBy('createdAt')
 .reverse()
 .limit(1000)
 .toArray();

 const itemCounts: Record<string, number> = {};

 recentInvoices.forEach(invoice => {
 const invoiceItemIds = invoice.items.map(i => i.itemId);
 
 // Check if this invoice contains any of our target items
 const hasTarget = itemIds.some(id => invoiceItemIds.includes(id));
 
 if (hasTarget) {
 invoiceItemIds.forEach(id => {
 if (!itemIds.includes(id)) {
 itemCounts[id] = (itemCounts[id] || 0) + 1;
 }
 });
 }
 });

 // 2. Sort by frequency
 const sortedIds = Object.entries(itemCounts)
 .sort(([, a], [, b]) => b - a)
 .slice(0, limit)
 .map(([id]) => id);

 if (sortedIds.length === 0) return [];

 // 3. Fetch item details
 const recommendedItems = await db.items
 .where('id')
 .anyOf(sortedIds)
 .toArray();

 return recommendedItems.filter(item => !item.deletedAt);
 } catch (error) {
 console.error('Failed to fetch recommendations', error);
 return [];
 }
 },

 /**
 * Get global trending items (most sold in last 30 days)
 */
 async getTrendingItems(limit: number = 5): Promise<Item[]> {
 try {
 const thirtyDaysAgo = new Date();
 thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

 const recentInvoices = await db.invoices
 .where('createdAt')
 .above(thirtyDaysAgo)
 .toArray();

 const itemCounts: Record<string, number> = {};
 recentInvoices.forEach(inv => {
 inv.items.forEach(item => {
 itemCounts[item.itemId] = (itemCounts[item.itemId] || 0) + item.quantity;
 });
 });

 const sortedIds = Object.entries(itemCounts)
 .sort(([, a], [, b]) => b - a)
 .slice(0, limit)
 .map(([id]) => id);

 if (sortedIds.length === 0) return [];

 const items = await db.items
 .where('id')
 .anyOf(sortedIds)
 .toArray();

 return items.filter(item => !item.deletedAt);
 } catch (error) {
 console.error('Failed to fetch trending items', error);
 return [];
 }
 }
};

export const formatCurrency = (amount: number, currencySymbol?: string): string => {
 let symbol = currencySymbol;
 if (!symbol) {
 try {
 const saved = localStorage.getItem('appSettings');
 if (saved) {
 symbol = JSON.parse(saved).currency;
 }
 } catch (e) {
 // ignore
 }
 }
 symbol = symbol || '$';

 return new Intl.NumberFormat('en-US', {
 style: 'currency',
 currency: 'USD',
 minimumFractionDigits: 2,
 maximumFractionDigits: 2
 }).format(amount).replace('$', symbol);
};

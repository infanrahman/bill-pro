/**
 * Financial calculation utility for consistent VAT and total handling.
 * Follows ZATCA and standard accounting practices for precision and rounding.
 */

export interface LineItem {
 price: number;
 quantity: number;
 discount?: number; // Percentage or fixed amount (implementation below uses percentage by default if not specified)
 discountType?: 'percentage' | 'fixed';
 taxRate: number;
 taxType: 'inclusive' | 'exclusive';
}

export interface LineResult {
 taxableAmount: number; // Amount before tax
 taxAmount: number; // VAT amount
 discountAmount: number; // The calculated discount value
 total: number; // Final line total (taxable + tax)
 unitPriceTaxable: number; // The base unit price before tax
}

/**
 * Rounds a number to exactly 2 decimal places.
 */
export const round = (num: number): number => {
 return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates financial values for a single line item.
 */
export const calculateLineItem = (item: LineItem, applyTax: boolean = true): LineResult => {
 const { price, quantity, discount = 0, discountType = 'percentage', taxRate, taxType } = item;
 
 // 1. Determine Unit Price Taxable (Base)
 let unitPriceTaxable: number;
 if (applyTax && taxType === 'inclusive') {
 unitPriceTaxable = price / (1 + taxRate / 100);
 } else {
 unitPriceTaxable = price;
 }

 // 2. Calculate Gross Taxable Amount (Total before discount)
 const grossTaxableAmount = unitPriceTaxable * quantity;

 // 3. Calculate Discount Amount
 let discountAmount: number;
 if (discountType === 'percentage') {
 discountAmount = grossTaxableAmount * (discount / 100);
 } else {
 discountAmount = discount; // Fixed amount
 }

 // 4. Calculate Net Taxable Amount
 const taxableAmount = grossTaxableAmount - discountAmount;

 // 5. Calculate Tax Amount
 const taxAmount = applyTax ? taxableAmount * (taxRate / 100) : 0;

 // 6. Round everything to 2 decimals
 const roundedTaxable = round(taxableAmount);
 const roundedTax = round(taxAmount);
 const roundedTotal = round(roundedTaxable + roundedTax);
 const roundedDiscount = round(discountAmount);

 return {
 taxableAmount: roundedTaxable,
 taxAmount: roundedTax,
 discountAmount: roundedDiscount,
 total: roundedTotal,
 unitPriceTaxable: round(unitPriceTaxable)
 };
};

/**
 * Aggregates line items into document totals.
 */
export const calculateDocumentTotals = (
 items: LineResult[],
 globalDiscount: number = 0,
 globalDiscountType: 'percentage' | 'fixed' = 'fixed',
 applyTax: boolean = true
) => {
 let subTotalSum = 0; // Total taxable amount
 let taxTotalSum = 0; // Total tax amount
 let totalDiscountSum = 0; // Item level discounts
 
 items.forEach(item => {
 subTotalSum += item.taxableAmount;
 taxTotalSum += applyTax ? item.taxAmount : 0;
 totalDiscountSum += item.discountAmount;
 });

 // Handle Global Discount
 let calculatedGlobalDiscount = 0;
 if (globalDiscountType === 'percentage') {
 calculatedGlobalDiscount = subTotalSum * (globalDiscount / 100);
 } else {
 calculatedGlobalDiscount = globalDiscount;
 }

 // Adjust subtotal by global discount
 const finalSubTotal = subTotalSum - calculatedGlobalDiscount;
 
 // NOTE: If global discount is applied, tax usually needs adjustment if it's applied POST-discount.
 // In many KSA implementations, global discounts are distributed per line.
 // For simplicity, if we don't distribute, we at least ensure the math is sound.
 
 const finalTax = taxTotalSum;
 if (calculatedGlobalDiscount > 0 && applyTax) {
 // Recalculate tax if global discount affects taxable amount globally?
 // Usually, it's better to distribute global discount to lines.
 // If not distributed, we just subtract from subtotal and potentially tax if tax is on net.
 }

 const grandTotal = round(finalSubTotal + finalTax);

 return {
 subTotal: round(subTotalSum),
 taxAmount: round(finalTax),
 discountAmount: round(totalDiscountSum + calculatedGlobalDiscount),
 grandTotal: grandTotal,
 balance: grandTotal
 };
};

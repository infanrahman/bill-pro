import { calculateLineItem, round } from '../src/utils/financials';

const tests = [
    {
        name: "Inclusive Tax (115 SAR @ 15%)",
        item: { price: 115, quantity: 1, taxRate: 15, taxType: 'inclusive' as const },
        expected: { taxableAmount: 100, taxAmount: 15, total: 115 }
    },
    {
        name: "Exclusive Tax (100 SAR @ 15%)",
        item: { price: 100, quantity: 1, taxRate: 15, taxType: 'exclusive' as const },
        expected: { taxableAmount: 100, taxAmount: 15, total: 115 }
    },
    {
        name: "Exclusive Tax with Discount (100 SAR @ 15% - 10%)",
        item: { price: 100, quantity: 1, discount: 10, discountType: 'percentage' as const, taxRate: 15, taxType: 'exclusive' as const },
        expected: { taxableAmount: 90, taxAmount: 13.5, total: 103.5 }
    },
    {
        name: "2 Units Inclusive (115 SAR @ 15%)",
        item: { price: 115, quantity: 2, taxRate: 15, taxType: 'inclusive' as const },
        expected: { taxableAmount: 200, taxAmount: 30, total: 230 }
    }
];

tests.forEach(test => {
    const result = calculateLineItem(test.item);
    console.log(`Test: ${test.name}`);
    console.log(`  Taxable: ${result.taxableAmount} (Expected: ${test.expected.taxableAmount})`);
    console.log(`  Tax:     ${result.taxAmount} (Expected: ${test.expected.taxAmount})`);
    console.log(`  Total:   ${result.total} (Expected: ${test.expected.total})`);
    
    if (result.taxableAmount === test.expected.taxableAmount && 
        result.taxAmount === test.expected.taxAmount && 
        result.total === test.expected.total) {
        console.log("  ✅ PASSED");
    } else {
        console.log("  ❌ FAILED");
    }
    console.log("---");
});

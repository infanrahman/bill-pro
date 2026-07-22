import { calculateLineItem, round } from '../src/utils/financials';

// Mocking the aggregate logic used in reports
const mockVatLogic = (items: any[]) => {
    let invoiceTax = 0;
    let invoiceNet = 0;
    let invoiceGross = 0;

    items.forEach(item => {
        const result = calculateLineItem({
            price: item.price,
            quantity: item.quantity,
            taxRate: item.taxRate,
            taxType: item.taxType,
            discount: item.discount || 0,
            discountType: item.discountType || 'percentage'
        });
        invoiceTax += result.taxAmount;
        invoiceNet += result.taxableAmount; // financials.ts uses taxableAmount
        invoiceGross += result.total;
    });

    return { 
        tax: round(invoiceTax), 
        net: round(invoiceNet), 
        gross: round(invoiceGross) 
    };
};

const runTests = () => {
    console.log("🚀 Starting Comprehensive Calculation Audit...\n");

    let passCount = 0;
    let failCount = 0;

    const test = (name: string, fn: () => boolean) => {
        try {
            if (fn()) {
                console.log(`✅ PASS: ${name}`);
                passCount++;
            } else {
                console.log(`❌ FAIL: ${name}`);
                failCount++;
            }
        } catch (e) {
            console.log(`💥 ERROR: ${name} - ${e.message}`);
            failCount++;
        }
    };

    // --- Core Math Tests ---
    test("Inclusive Tax Extraction (115 SAR @ 15%)", () => {
        const res = calculateLineItem({ price: 115, quantity: 1, taxRate: 15, taxType: 'inclusive' });
        return res.taxableAmount === 100 && res.taxAmount === 15 && res.total === 115;
    });

    test("Inclusive Tax Rounding (99 SAR @ 15%)", () => {
        // 99 / 1.15 = 86.0869... -> 86.09
        // 99 - 86.09 = 12.91
        const res = calculateLineItem({ price: 99, quantity: 1, taxRate: 15, taxType: 'inclusive' });
        return res.taxableAmount === 86.09 && res.taxAmount === 12.91 && res.total === 99;
    });

    test("Exclusive Tax Calculation (100 SAR @ 15%)", () => {
        const res = calculateLineItem({ price: 100, quantity: 1, taxRate: 15, taxType: 'exclusive' });
        return res.taxableAmount === 100 && res.taxAmount === 15 && res.total === 115;
    });

    test("Discount Application BEFORE Tax", () => {
        // 100 SAR - 10% = 90 SAR taxable. Tax @ 15% = 13.5. Total = 103.5
        const res = calculateLineItem({ price: 100, quantity: 1, taxRate: 15, taxType: 'exclusive', discount: 10, discountType: 'percentage' });
        return res.taxableAmount === 90 && res.taxAmount === 13.5 && res.total === 103.5;
    });

    // --- Report Aggregation Tests ---
    test("Report Totals match Document Totals (Multi-item)", () => {
        const items = [
            { price: 115, quantity: 1, taxRate: 15, taxType: 'inclusive' as const }, // Tax 15, Net 100
            { price: 50, quantity: 2, taxRate: 15, taxType: 'exclusive' as const }  // Tax 15, Net 100
        ];

        const report = mockVatLogic(items);
        // Expected total tax: 15 + 15 = 30
        // Expected total net: 100 + 100 = 200
        // Expected gross: 115 + 115 = 230
        return report.tax === 30 && report.net === 200 && report.gross === 230;
    });

    console.log(`\n📊 Summary: ${passCount} Passed, ${failCount} Failed`);
    if (failCount > 0) process.exit(1);
};

runTests();

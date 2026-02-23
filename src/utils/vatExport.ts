import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { VatReturnData } from '../pages/Reports/useVatReturnData';

interface BusinessDetails {
    shopName?: string;
    address?: string;
    phone?: string;
    taxRegNo?: string;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const exportVatToPDF = (
    data: VatReturnData,
    periodLabel: string,
    businessDetails: BusinessDetails
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(businessDetails.shopName || "Company Name", pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (businessDetails.address) doc.text(businessDetails.address, pageWidth / 2, 26, { align: 'center' });
    if (businessDetails.phone) doc.text(`Phone: ${businessDetails.phone}`, pageWidth / 2, 31, { align: 'center' });
    if (businessDetails.taxRegNo) {
        doc.setFont('helvetica', 'bold');
        doc.text(`TRN: ${businessDetails.taxRegNo}`, pageWidth / 2, 36, { align: 'center' });
    }

    // Title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("VAT Return Report", 14, 50);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${periodLabel}`, 14, 57);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 57, { align: 'right' });

    let currentY = 65;

    // 1. VAT on Sales (Outputs)
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(220, 252, 231); // green-100
    doc.rect(14, currentY, pageWidth - 28, 8, 'F');
    doc.text("1. VAT on Sales (Outputs)", 16, currentY + 6);
    currentY += 10;

    const salesBody = [
        ["1. Sales - Standard Rated", formatCurrency(data.sales.standard.amount), formatCurrency(data.sales.standard.vat)],
        ["2. Sales - Standard Rated (Returns)", `-${formatCurrency(data.sales.returnStandard.amount)}`, `-${formatCurrency(data.sales.returnStandard.vat)}`],
        ["3. Sales - Zero Rated", formatCurrency(data.sales.zero.amount), "-"],
        ["4. Sales - Zero Rated (Returns)", `-${formatCurrency(data.sales.returnZero.amount)}`, "-"]
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['Description', 'Amount', 'VAT Amount']],
        body: salesBody,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74] }, // green-600
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 40, halign: 'right' }
        },
        foot: [[
            "Total Net Sales",
            formatCurrency(data.net.sales.amount),
            formatCurrency(data.net.sales.vat)
        ]],
        footStyles: { fillColor: [240, 253, 244], textColor: [0, 0, 0], fontStyle: 'bold' } // green-50
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 15;

    // 2. VAT on Purchases (Inputs)
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(254, 249, 195); // yellow-100
    doc.rect(14, currentY, pageWidth - 28, 8, 'F');
    doc.text("2. VAT on Purchases (Inputs)", 16, currentY + 6);
    currentY += 10;

    const purchasesBody = [
        ["5. Purchases - Standard Rated", formatCurrency(data.purchases.standard.amount), formatCurrency(data.purchases.standard.vat)],
        ["6. Purchases - Standard Rated (Returns)", `-${formatCurrency(data.purchases.returnStandard.amount)}`, `-${formatCurrency(data.purchases.returnStandard.vat)}`],
        ["7. Purchases - Zero Rated", formatCurrency(data.purchases.zero.amount), "-"],
        // ["Returns - Zero Rated", `-${formatCurrency(data.purchases.returnZero.amount)}`, "-"]
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['Description', 'Amount', 'VAT Amount']],
        body: purchasesBody,
        theme: 'grid',
        headStyles: { fillColor: [202, 138, 4] }, // yellow-600 (darker gold)
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 40, halign: 'right' }
        },
        foot: [[
            "Total Net Purchases",
            formatCurrency(data.net.purchases.amount),
            formatCurrency(data.net.purchases.vat)
        ]],
        footStyles: { fillColor: [254, 252, 232], textColor: [0, 0, 0], fontStyle: 'bold' } // yellow-50
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 15;

    // Net VAT
    const netVat = data.net.vatPayable;
    doc.setFillColor(netVat >= 0 ? 220 : 254, netVat >= 0 ? 252 : 226, netVat >= 0 ? 231 : 226); // green-100 or red-100
    doc.roundedRect(14, currentY, pageWidth - 28, 20, 3, 3, 'F');

    doc.setFontSize(14);
    doc.text("Net VAT Payable for Period:", 20, currentY + 13);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(netVat), pageWidth - 20, currentY + 13, { align: 'right' });

    doc.save(`VAT_Return_${periodLabel.replace(/\s+/g, '_')}.pdf`);
};

export const exportVatToExcel = (
    data: VatReturnData,
    periodLabel: string,
    businessDetails: BusinessDetails
) => {
    const wb = XLSX.utils.book_new();
    const wsData = [
        [businessDetails.shopName || "Company Name"],
        [businessDetails.address],
        [`TRN: ${businessDetails.taxRegNo || "N/A"}`],
        [],
        ["VAT RETURN REPORT"],
        [`Period: ${periodLabel}`, "", `Generated: ${new Date().toLocaleDateString()}`],
        [],
        ["1. VAT ON SALES (OUTPUTS)", "", ""],
        ["Description", "Amount", "VAT Amount"],
        ["1. Sales - Standard Rated", data.sales.standard.amount, data.sales.standard.vat],
        ["2. Sales - Standard Rated (Returns)", -data.sales.returnStandard.amount, -data.sales.returnStandard.vat],
        ["3. Sales - Zero Rated", data.sales.zero.amount, 0],
        ["4. Sales - Zero Rated (Returns)", -data.sales.returnZero.amount, 0],
        ["TOTAL NET SALES", data.net.sales.amount, data.net.sales.vat],
        [],
        ["2. VAT ON PURCHASES (INPUTS)", "", ""],
        ["Description", "Amount", "VAT Amount"],
        ["5. Purchases - Standard Rated", data.purchases.standard.amount, data.purchases.standard.vat],
        ["6. Purchases - Standard Rated (Returns)", -data.purchases.returnStandard.amount, -data.purchases.returnStandard.vat],
        ["7. Purchases - Zero Rated", data.purchases.zero.amount, 0],
        ["TOTAL NET PURCHASES", data.net.purchases.amount, data.net.purchases.vat],
        [],
        ["NET VAT PAYABLE", "", data.net.vatPayable]
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Basic Column Widths
    ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(wb, ws, "VAT Return");
    XLSX.writeFile(wb, `VAT_Return_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
};

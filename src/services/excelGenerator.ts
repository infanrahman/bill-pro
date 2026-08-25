import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Invoice, Purchase } from './db';

interface BusinessDetails {
 name: string;
 address: string;
 phone: string;
 email: string;
}

export const generateExcel = (data: Invoice | Purchase, type: 'invoice' | 'purchase', businessRaw: BusinessDetails | null) => {
 const business = businessRaw || { name: 'My Business', address: '', phone: '', email: '' };

 // Create Workbook
 const wb = XLSX.utils.book_new();
 const isInvoice = type === 'invoice';
 const refNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Purchase).orderNumber;

 // --- META DATA ---
 const metaData = [
 [business.name],
 [business.address],
 [business.phone, business.email],
 [],
 [isInvoice ? 'INVOICE' : 'PURCHASE ORDER'],
 ['Reference:', refNumber],
 ['Date:', format(new Date(isInvoice ? (data as Invoice).createdAt : (data as Purchase).date), 'dd/MM/yyyy HH:mm')],
 ['Status:', data.status || 'Completed'],
 [],
 ['From:', isInvoice ? business.name : (data as Purchase).supplierName],
 ['To:', isInvoice ? (data as Invoice).customerName : business.name],
 []
 ];

 // --- ITEM DATA ---
 const isPurchase = type === 'purchase';
 const headers = isPurchase
  ? ['#', 'Item', 'Quantity', 'Unit Cost', 'Tax %', 'Before VAT Amount', 'VAT Amount', 'Total Amount with VAT']
  : ['#', 'Item', 'Quantity', 'Price/Cost', 'Total'];

 const items = data.items.map((item: any, index: number) => {
  if (isPurchase) {
   const qty = item.quantity;
   const cost = item.cost;
   const taxRate = item.taxRate ?? 0;
   const taxType = item.taxType || 'exclusive';

   let beforeVat = item.subtotalBeforeTax ?? 0;
   let lineTax = item.taxAmount ?? 0;
   let totalWithVat = item.total ?? 0;

   if (!beforeVat || (taxRate > 0 && lineTax === 0) || !totalWithVat) {
    if (taxType === 'inclusive') {
     const basePrice = cost / (1 + taxRate / 100);
     beforeVat = basePrice * qty;
     lineTax = (cost - basePrice) * qty;
     totalWithVat = cost * qty;
    } else {
     beforeVat = cost * qty;
     lineTax = (cost * (taxRate / 100)) * qty;
     totalWithVat = beforeVat + lineTax;
    }
   }

   return [
    index + 1,
    item.name,
    qty,
    cost,
    `${taxRate}%`,
    Math.round(beforeVat * 100) / 100,
    Math.round(lineTax * 100) / 100,
    Math.round(totalWithVat * 100) / 100
   ];
  }

  return [
   index + 1,
   item.name,
   item.quantity,
   item.price || item.cost,
   (item.quantity * (item.price || item.cost))
  ];
 });

 // --- TOTALS ---
 const totalAmount = isInvoice ? (data as Invoice).grandTotal : (data as Purchase).totalAmount;

 const footer = [
 [],
 ['', '', '', 'Total Amount:', totalAmount],
 ['', '', '', 'Paid:', (data as any).paidAmount || 0],
 ['', '', '', 'Balance:', (totalAmount - ((data as any).paidAmount || 0))]
 ];

 // Combine all rows
 const wsData = [...metaData, headers, ...items, ...footer];

 // Create Worksheet
 const ws = XLSX.utils.aoa_to_sheet(wsData);

 // Column Widths
 ws['!cols'] = [
 { wch: 5 }, // #
 { wch: 30 }, // Item
 { wch: 10 }, // Qty
 { wch: 15 }, // Price
 { wch: 15 } // Total
 ];

 XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

 // Generate Buffer
 const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

 return excelBuffer;
};

export const downloadExcel = (data: Invoice | Purchase, type: 'invoice' | 'purchase', businessDetails: BusinessDetails | null) => {
 try {
 const buffer = generateExcel(data, type, businessDetails);
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 const refNumber = type === 'invoice' ? (data as Invoice).invoiceNumber : (data as Purchase).orderNumber;
 const fileName =`${type}_${refNumber}.xlsx`;

 // Direct Download Link
 const url = window.URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = fileName;
 link.click();

 return true;
 } catch (error) {
 console.error("Excel generation failed:", error);
 return false;
 }
};
export const generateVatReportExcel = (data: any[], totals: any, periodLabel: string, businessRaw: BusinessDetails | null) => {
 const business = businessRaw || { name: 'My Business', address: '', phone: '', email: '' };

 // Create Workbook
 const wb = XLSX.utils.book_new();

 // --- META DATA ---
 const metaData = [
 [business.name],
 [business.address],
 [business.phone, business.email],
 [],
 ['VAT REPORT'],
 ['Period:', periodLabel],
 ['Generated:', format(new Date(), 'dd/MM/yyyy HH:mm')],
 []
 ];

 // --- ITEM DATA ---
 const headers = ['Period', 'Net Sales', 'VAT Amount', 'Gross Sales'];

 const items = data.map((row: any) => [
 row.label,
 row.netSales,
 row.vatAmount,
 row.grossSales
 ]);

 // --- TOTALS ---
 const footer = [
 [],
 ['TOTALS', totals.netSales, totals.vatAmount, totals.grossSales]
 ];

 // Combine all rows
 const wsData = [...metaData, headers, ...items, ...footer];

 // Create Worksheet
 const ws = XLSX.utils.aoa_to_sheet(wsData);

 // Column Widths
 ws['!cols'] = [
 { wch: 20 }, // Period
 { wch: 15 }, // Net
 { wch: 15 }, // VAT
 { wch: 15 } // Gross
 ];

 XLSX.utils.book_append_sheet(wb, ws, 'VAT Report');

 // Generate Buffer
 const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

 return excelBuffer;
};

export const downloadVatReportExcel = (data: any[], totals: any, periodLabel: string, businessDetails: BusinessDetails | null) => {
 try {
 const buffer = generateVatReportExcel(data, totals, periodLabel, businessDetails);
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 const fileName =`VAT_Report_${periodLabel.replace(/ /g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`;

 // Direct Download Link
 const url = window.URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = fileName;
 link.click();

 return true;
 } catch (error) {
 console.error("VAT Excel generation failed:", error);
 return false;
 }
};

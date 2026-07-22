import type { VatReturnData } from './useVatReturnData';

interface BusinessDetails {
 name?: string; // Was shopName
 address?: string;
 phone?: string;
 email?: string;
 gstin?: string; // Tax Reg No
 logoUrl?: string;
 crNo?: string;
 pincode?: string;
 [key: string]: any;
}

const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('en-US', {
 style: 'decimal',
 minimumFractionDigits: 2,
 maximumFractionDigits: 2
 }).format(amount);
};

export const generateVatReportA4 = (
 data: VatReturnData,
 periodLabel: string,
 business: BusinessDetails,
 t: (key: string) => string,
 language: string = 'en'
) => {
 // Helper to format date
 const today = new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
 const isRtl = language === 'ar';
 const alignLeft = isRtl ? 'right' : 'left';
 const alignRight = isRtl ? 'left' : 'right';

 // Professional Header
 const headerHtml =`
 <div class="header"style="direction: ${isRtl ? 'rtl' : 'ltr'}">
 <div class="brand-section">
 ${business.logoUrl ?`<img src="${business.logoUrl}"class="logo"/>`:`<div class="company-name-fallback">${business.name || 'Business Name'}</div>`}
 </div>
 <div class="business-details"style="text-align: ${alignRight}">
 <h2 class="company-title">${business.name || ''}</h2>
 <div class="detail-row">${business.address || ''} ${business.pincode || ''}</div>
 ${business.phone ?`<div class="detail-row"><strong>${t('common.phone') || 'Tel'}:</strong> ${business.phone}</div>`: ''}
 ${business.email ?`<div class="detail-row"><strong>${t('common.email') || 'Email'}:</strong> ${business.email}</div>`: ''}
 <div class="tax-row">
 ${(() => {
 const trn = (business.gstin || '').trim();
 return trn ?`<span><strong>${t('reports.vat_no') || 'TRN'}:</strong> ${trn}</span>`: '';
 })()}
 ${business.crNo ?`<span><strong>${t('reports.cr_no') || 'CR'}:</strong> ${business.crNo}</span>`: ''}
 </div>
 </div>
 </div>
`;

 return`
 <!DOCTYPE html>
 <html lang="${language}"dir="${isRtl ? 'rtl' : 'ltr'}">
 <head>
 <meta charset="UTF-8">
 <style>
 @media print {
 @page { size: A4; margin: 0; }
 body { margin: 0; padding: 10mm; -webkit-print-color-adjust: exact; }
 }
 body { 
 font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
 color: #1e293b;
 background: #fff;
 max-width: 210mm;
 margin: 0 auto;
 padding: 15mm;
 line-height: 1.3;
 direction: ${isRtl ? 'rtl' : 'ltr'};
 }

 /* Header Styling */
 .header {
 display: flex;
 justify-content: space-between;
 align-items: center;
 padding-bottom: 20px;
 border-bottom: 3px solid #2563eb;
 margin-bottom: 20px;
 }
 .brand-section { flex: 1; }
 .logo { max-height: 70px; max-width: 200px; object-fit: contain; }
 .company-name-fallback { font-size: 24px; font-weight: bold; color: #2563eb; }
 .business-details { text-align: ${alignRight}; font-size: 13px; color: #475569; }
 .company-title { margin: 0 0 5px 0; font-size: 18px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
 .detail-row { margin-bottom: 2px; }
 .tax-row { margin-top: 8px; font-size: 13px; padding: 4px 8px; background: #f1f5f9; border-radius: 4px; display: inline-block; }
 .tax-row span { margin-${alignLeft}: 10px; }
 .tax-row span:first-child { margin-${alignLeft}: 0; }

 /* Title & Period */
 .report-heading { text-align: center; margin-bottom: 20px; }
 h1 { margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
 .period-badge { display: inline-block; background: #eff6ff; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; border: 1px solid #dbeafe; }

 /* Section Styling */
 .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #334155; margin-top: 15px; margin-bottom: 8px; padding-${alignLeft}: 8px; border-${alignLeft}: 4px solid #cbd5e1; }
 .section-title.sales { border-${alignLeft}-color: #16a34a; color: #166534; }
 .section-title.purchases { border-${alignLeft}-color: #ca8a04; color: #854d0e; }

 /* Table Styling */
 table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
 th { text-align: ${alignLeft}; padding: 6px 8px; background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; }
 td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; text-align: ${alignLeft}; }
 .text-right { text-align: ${alignRight}; }
 .row-subtotal td { background-color: #f8fafc; font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0; }

 /* Summary Card */
 .summary-card { margin-top: 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow: hidden; page-break-inside: avoid; }
 .summary-header { background: #f8fafc; padding: 10px 20px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
 .summary-body { padding: 15px 20px; }
 .summary-item { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #475569; }
 .summary-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #e2e8f0; color: #0f172a; }

 .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
 </style>
 </head>
 <body>
 ${headerHtml}

 <div class="report-heading">
 <h1>${t('reports.vat_report')}</h1>
 <div class="period-badge">${t('reports.period')}: ${periodLabel}</div>
 </div>

 <!-- Sales -->
 <div class="section-title sales">1. ${t('reports.vat_on_sales')}</div>
 <table>
 <thead>
 <tr>
 <th style="width: 50%;">${t('common.description')}</th>
 <th class="text-right">${t('common.amount')}</th>
 <th class="text-right">${t('reports.vat_amount')}</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td>${t('reports.vat_sales_std')}</td>
 <td class="text-right">${formatCurrency(data.sales.standard.amount)}</td>
 <td class="text-right">${formatCurrency(data.sales.standard.vat)}</td>
 </tr>
 <tr>
 <td>${t('reports.vat_sales_ret_std')}</td>
 <td class="text-right">-${formatCurrency(data.sales.returnStandard.amount)}</td>
 <td class="text-right">-${formatCurrency(data.sales.returnStandard.vat)}</td>
 </tr>
 <tr>
 <td>${t('reports.vat_sales_zero')}</td>
 <td class="text-right">${formatCurrency(data.sales.zero.amount)}</td>
 <td class="text-right">-</td>
 </tr>
 <tr>
 <td>${t('reports.vat_sales_ret_zero')}</td>
 <td class="text-right">-${formatCurrency(data.sales.returnZero.amount)}</td>
 <td class="text-right">-</td>
 </tr>
 <tr class="row-subtotal">
 <td>${t('reports.net_sales_excl')}</td>
 <td class="text-right">${formatCurrency(data.net.sales.amount)}</td>
 <td class="text-right">${formatCurrency(data.net.sales.vat)}</td>
 </tr>
 </tbody>
 </table>

 <!-- Purchases -->
 <div class="section-title purchases">2. ${t('reports.vat_on_purchase')}</div>
 <table>
 <thead>
 <tr>
 <th style="width: 50%;">${t('common.description')}</th>
 <th class="text-right">${t('common.amount')}</th>
 <th class="text-right">${t('reports.vat_amount')}</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td>${t('reports.vat_purchase_std')}</td>
 <td class="text-right">${formatCurrency(data.purchases.standard.amount)}</td>
 <td class="text-right">${formatCurrency(data.purchases.standard.vat)}</td>
 </tr>
 <tr>
 <td>${t('reports.vat_purchase_ret_std')}</td>
 <td class="text-right">-${formatCurrency(data.purchases.returnStandard.amount)}</td>
 <td class="text-right">-${formatCurrency(data.purchases.returnStandard.vat)}</td>
 </tr>
 <tr>
 <td>${t('reports.vat_purchase_zero')}</td>
 <td class="text-right">${formatCurrency(data.purchases.zero.amount)}</td>
 <td class="text-right">-</td>
 </tr>
 <tr class="row-subtotal">
 <td>${t('reports.net_purchase')}</td>
 <td class="text-right">${formatCurrency(data.net.purchases.amount)}</td>
 <td class="text-right">${formatCurrency(data.net.purchases.vat)}</td>
 </tr>
 </tbody>
 </table>

 <div class="summary-card">
 <div class="summary-header">${t('reports.tax_summary')}</div>
 <div class="summary-body">
 <div class="summary-item">
 <span>${t('reports.total_vat_sales')}</span>
 <span>${formatCurrency(data.net.sales.vat)}</span>
 </div>
 <div class="summary-item">
 <span>${t('reports.total_vat_purchases')}</span>
 <span>${formatCurrency(data.net.purchases.vat)}</span>
 </div>
 <div class="summary-total"style="color: ${data.net.vatPayable >= 0 ? '#16a34a' : '#ef4444'}">
 <span>${t('reports.net_vat_period')}</span>
 <span>${formatCurrency(Math.abs(data.net.vatPayable))} ${data.net.vatPayable < 0 ?`(${t('common.credit') || 'Credit'})`: ''}</span>
 </div>
 </div>
 </div>

 <div class="footer">
 Generated by Billing Pro &bull; ${today}
 </div>
 </body>
 </html>
`;
};

export const generateVatReportThermal = (
 data: VatReturnData,
 periodLabel: string,
 business: BusinessDetails,
 t: (key: string) => string,
 language: string = 'en'
) => {
 const today = new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
 const isRtl = language === 'ar';


 // Get Printer Config for Size
 const savedConfig = localStorage.getItem('printerConfig');
 
 const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};
 const config = fullConfig.thermal || {};
 const pageSize = config.pageSize || '80mm';

 let width = '80mm';
 if (pageSize === '58mm') width = '58mm';
 if (pageSize === '100mm') width = '100mm';

 // Less padding for 58mm
 const padding = width === '58mm' ? '2mm' : '5mm';

 return`
 <!DOCTYPE html>
 <html lang="${language}"dir="${isRtl ? 'rtl' : 'ltr'}">
 <head>
 <meta charset="UTF-8">
 <style>
 @media print {
 @page { margin: 0; size: ${width} auto; }
 body { margin: 0; padding: ${padding}; -webkit-print-color-adjust: exact; }
 }
 body { 
 font-family: 'Courier New', monospace;
 color: #000;
 font-size: 12px;
 width: 100%; /* Responsive */
 max-width: 100%;
 box-sizing: border-box;
 direction: ${isRtl ? 'rtl' : 'ltr'};
 overflow: hidden;
 }
 .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
 .business-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
 .business-info { font-size: 10px; margin-bottom: 2px; }
 
 .report-title { text-align: center; font-weight: bold; font-size: 14px; margin: 10px 0; text-decoration: underline; }
 .period { text-align: center; font-size: 10px; margin-bottom: 15px; }
 
 .line { border-bottom: 1px dashed #000; margin: 5px 0; }
 .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
 .font-bold { font-weight: bold; }
 
 .total-box { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; margin-top: 10px; }
 
 .footer { text-align: center; font-size: 10px; margin-top: 20px; color: #444; }
 </style>
 </head>
 <body>
 <div class="header">
 <div class="business-name">${business.name || 'Business Name'}</div>
 ${business.address ?`<div class="business-info">${business.address}</div>`: ''}
 ${business.phone ?`<div class="business-info">${t('common.phone') || 'Tel'}: ${business.phone}</div>`: ''}
 ${(() => {
 const trn = (business.gstin || '').trim();
 return trn ?`<div class="business-info">${t('reports.vat_no') || 'TRN'}: ${trn}</div>`: '';
 })()}
 </div>

 <div class="report-title">${t('reports.vat_report').toUpperCase()}</div>
 <div class="period">${periodLabel}</div>
 
 <div class="line"></div>
 <div class="font-bold">1. ${t('reports.sales').toUpperCase()}</div>
 <div class="line"></div>
 <div class="row">
 <span>${t('reports.vat_sales_std')}</span>
 <span>${formatCurrency(data.sales.standard.amount)}</span>
 </div>
 <div class="row">
 <span>${t('reports.vat_amount')}</span>
 <span>${formatCurrency(data.sales.standard.vat)}</span>
 </div>
 <div class="row">
 <span>${t('reports.vat_sales_zero')}</span>
 <span>${formatCurrency(data.sales.zero.amount)}</span>
 </div>
 <div class="row font-bold"style="margin-top: 5px;">
 <span>${t('reports.vat')} (${t('common.total')})</span>
 <span>${formatCurrency(data.net.sales.vat)}</span>
 </div>

 <div class="line"></div>
 <div class="font-bold">2. ${t('reports.purchases').toUpperCase()}</div>
 <div class="line"></div>
 <div class="row">
 <span>${t('reports.vat_purchase_std')}</span>
 <span>${formatCurrency(data.purchases.standard.amount)}</span>
 </div>
 <div class="row">
 <span>${t('reports.vat_amount')}</span>
 <span>${formatCurrency(data.purchases.standard.vat)}</span>
 </div>
 <div class="row font-bold"style="margin-top: 5px;">
 <span>${t('reports.vat')} (${t('common.total')})</span>
 <span>${formatCurrency(data.net.purchases.vat)}</span>
 </div>

 <div class="total-box">
 <div class="row font-bold">
 <span>${t('reports.net_vat_period')}</span>
 <span>${formatCurrency(data.net.vatPayable)}</span>
 </div>
 </div>

 <div class="footer">
 Generated by Billing Pro<br/>
 ${today}
 </div>
 </body>
 </html>
`;
};

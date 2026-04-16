import { format } from 'date-fns';
import QRCode from 'qrcode';
import { generateZatcaQR, formatZatcaDate } from './zatca';
import type { Invoice, Purchase } from './db';
import { printContent } from './printerService';

export interface BusinessDetails {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin?: string; // VAT/GST/Tax ID
    logoUrl?: string; // Base64
    country?: string;
    taxName?: string; // 'VAT' | 'GST'
    taxRate?: number; // Added for passing rate
    crNo?: string; // Commercial Registration
    pincode?: string;
    vatNo?: string; // Backup for gstin
}

// --- HTML GENERATOR ---
export const getInvoiceHTML = async (invoice: Invoice, businessRaw: BusinessDetails | null): Promise<string | null> => {

    // Safety Fallback for Business Details
    const business: BusinessDetails = businessRaw || {
        name: 'Business Name',
        address: 'Business Address',
        phone: '',
        email: '',
        gstin: '',
        country: 'Saudi Arabia'
    };

    // 1. Load Settings
    const savedConfig = localStorage.getItem('printerConfig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};

    const config = fullConfig.regular || {};
    // const pageSize = config.pageSize || fullConfig.pageSize || 'a4';
    // const orientation = config.orientation || 'portrait';

    // Global Settings
    const printCompanyName = fullConfig.printCompanyName ?? true;
    const printLanguage = fullConfig.printLanguage || 'english';
    const showTerms = fullConfig.showTerms || false;
    const termsContent = fullConfig.termsContent || '';


    // Parse App Settings for Formatting
    const savedAppSettings = localStorage.getItem('appSettings');
    const appSettings = savedAppSettings ? JSON.parse(savedAppSettings) : { currency: '$', decimals: 2, dateFormat: 'dd/MM/yyyy' };

    // Helper Formatters
    const formatCurrency = (amount: number) => appSettings.currency + Number(amount).toFixed(appSettings.decimals);
    const formatDate = (date: Date) => {
        try {
            return format(date, appSettings.dateFormat + ' hh:mm a');
        } catch (e) {
            return format(date, 'dd/MM/yyyy hh:mm a');
        }
    };


    // If Thermal, we actually usually delegate, but if we need HTML for download, we generate it.
    // Ideally we should have a thermal-specific HTML generator, but for now we'll use a standard one
    // or return null if we want to force native thermal handling (which we might not want for download).

    const isBilingual = printLanguage === 'bilingual';
    const isRtl = printLanguage === 'arabic' || printLanguage === 'ar';
    const tLabel = (en: string, ar: string) => isBilingual ? `${en} / <span class="ar">${ar}</span>` : (isRtl ? ar : en);

    const appliedTaxRate = invoice.taxRate ?? (business.taxRate || 15);

    // Logic to toggle VAT columns
    const showVatColumn = invoice.taxAmount > 0;

    // Calculations
    const displayBase = invoice.subTotal;
    const displayTax = invoice.taxAmount;
    const displayNet = invoice.grandTotal;

    // QR Code
    let qrImg = '';
    // Consolidate all possible VAT fields
    const vatNumber = business.gstin || business.vatNo || (business as any).vat || (business as any).taxRegNo;

    // Phase 2 Check
    const savedZatcaConfig = localStorage.getItem('zatca_config');
    const zatcaConfig = savedZatcaConfig ? JSON.parse(savedZatcaConfig) : null;
    const isZatcaPhase2 = zatcaConfig && zatcaConfig.status === 'LIVE' && zatcaConfig.privateKey;

    if (vatNumber && showVatColumn) {
        try {
            if (isZatcaPhase2) {
                try {
                    // Import Dynamically to avoid circular deps or heavy load
                    const { generateZatcaXML } = await import('./zatcaXml');
                    const { qr } = await generateZatcaXML(invoice, {
                        ...business,
                        gstin: vatNumber // Ensure mapped correctly
                    }, zatcaConfig.privateKey);

                    // Convert Base64 TLV to QR Image
                    const QRCode = (await import('qrcode')).default;
                    qrImg = await QRCode.toDataURL(qr);
                } catch (ph2Error) {
                    console.error("ZATCA Phase 2 QR Generation Failed, falling back to Phase 1:", ph2Error);
                    // Standard Fallback (Phase 1)
                    qrImg = await generateZatcaQR(
                        business.name,
                        vatNumber,
                        formatZatcaDate(new Date(invoice.createdAt)),
                        invoice.grandTotal.toFixed(2),
                        invoice.taxAmount.toFixed(2)
                    );
                }
            } else {
                // Phase 1 (Standard)
                qrImg = await generateZatcaQR(
                    business.name,
                    vatNumber,
                    formatZatcaDate(new Date(invoice.createdAt)),
                    invoice.grandTotal.toFixed(2),
                    invoice.taxAmount.toFixed(2)
                );
            }
        } catch (e) {
            console.error("QR Generation Failed Completely", e);
        }
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @media print {
                @page { size: ${config.pageSize === 'letter' ? 'Letter' : 'A4'} ${config.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 0; }
                body { margin: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                * { text-shadow: none !important; box-shadow: none !important; }
                body, .invoice-table th, .invoice-table td, .total-row, .footer, .terms { background-color: white !important; color: black !important; }
                .invoice-table th { border-bottom: 2px solid black !important; font-weight: 900 !important; background: #eee !important; }
                .invoice-table td { border-bottom: 1px solid #ccc !important; }
                .total-row.final { border: 2px solid black !important; background: #f3f4f6 !important; color: black !important; }
            }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #fff; padding: 25px; max-width: 800px; margin: 0 auto; }
            .ar { font-family: 'Tahoma', sans-serif; direction: rtl; }
            .inv-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 5px; }
            .inv-header .logo img { max-height: 70px; max-width: 180px; }
            .inv-header .company { text-align: right; }
            .inv-header .company-name { font-size: 22px; font-weight: 800; color: #1e40af; margin-bottom: 3px; }
            .inv-header .company div { font-size: 12px; color: #475569; line-height: 1.6; }
            .inv-header .company strong { color: #1e293b; }
            .inv-title { text-align: center; padding: 8px 0; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; }
            .inv-title h2 { margin: 0; font-size: 16px; font-weight: 700; color: #1e40af; letter-spacing: 1px; text-transform: uppercase; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .meta-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .meta-box .title { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #1e40af; margin-bottom: 8px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; color: #334155; }
            .meta-row strong { color: #0f172a; }
            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .invoice-table th { background: #1e40af; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
            .invoice-table th.right { text-align: right; }
            .invoice-table td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; }
            .invoice-table td.right { text-align: right; }
            .invoice-table tbody tr:nth-child(even) td { background: #f8fafc; }
            .totals-container { display: flex; justify-content: flex-end; margin-bottom: 20px; }
            .totals-box { width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 7px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #e2e8f0; }
            .total-row.final { background: #1e40af; color: #fff; font-weight: 800; font-size: 16px; padding: 12px; border-radius: 6px; margin-top: 8px; border: none; }
            .total-row.discount { color: #dc2626; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            .terms { background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; margin-top: 20px; border: 1px solid #e2e8f0; }
            .qr-section { text-align: center; margin-top: 15px; }
            .qr-section img { width: 120px; height: 120px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; }
            .bilingual-text { display: flex; align-items: baseline; gap: 5px; }
        </style>
    </head>
    <body>
        <!-- HEADER -->
        <div class="inv-header">
            <div class="logo">
                ${business.logoUrl ? `<img src="${business.logoUrl}" />` : ''}
            </div>
            <div class="company">
                ${printCompanyName ? `<div class="company-name">${business.name}</div>` : ''}
                <div>${business.address}${business.pincode ? ` - ${business.pincode}` : ''}</div>
                ${business.phone ? `<div>${tLabel('Tel', 'هاتف')}: ${business.phone}</div>` : ''}
                ${business.email ? `<div>${tLabel('Email', 'بريد')}: ${business.email}</div>` : ''}
                ${vatNumber ? `<div><strong>${tLabel('VAT Reg No', 'الرقم الضريبي')}: ${vatNumber}</strong></div>` : ''}
                ${business.crNo ? `<div>${tLabel('CR No', 'سجل تجاري')}: ${business.crNo}</div>` : ''}
            </div>
        </div>

        <!-- INVOICE TITLE (ZATCA Mandatory) -->
        <div class="inv-title">
            <h2>${tLabel('Simplified Tax Invoice', 'فاتورة ضريبية مبسطة')}</h2>
        </div>

        <!-- META -->
        <div class="meta-grid">
            <div class="meta-box">
                <div class="title">${tLabel('Invoice Details', 'تفاصيل الفاتورة')}</div>
                <div class="meta-row">
                    <span>${tLabel('Invoice No', 'رقم الفاتورة')}</span>
                    <strong>${invoice.invoiceNumber || invoice.id || '-'}</strong>
                </div>
                ${invoice.tokenNumber ? `
                <div style="text-align: center; margin: 10px 0;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e40af;">${tLabel('Token Number', 'رقم الطلب')}</div>
                    <div style="font-size: 32px; font-weight: 900; color: #1e40af;">#${invoice.tokenNumber}</div>
                </div>` : ''}
                <div class="meta-row">
                    <span>${tLabel('Date & Time', 'التاريخ والوقت')}</span>
                    <span>${formatDate(new Date(invoice.createdAt))}</span>
                </div>
                ${invoice.orderType ? `<div class="meta-row">
                    <span>${tLabel('Order Type', 'نوع الطلب')}</span>
                    <strong>${invoice.orderType === 'dine_in' ? tLabel('DINE-IN', 'محلي') : invoice.orderType === 'parcel' ? tLabel('PARCEL', 'سفري') : invoice.orderType === 'pickup' ? tLabel('PICKUP', 'استلام') : tLabel('DELIVERY', 'توصيل')}</strong>
                </div>` : ''}
                <div class="meta-row">
                    <span>${tLabel('Payment', 'طريقة الدفع')}</span>
                    <span style="text-transform:uppercase">${invoice.paymentMode}</span>
                </div>
                ${invoice.dueDate ? `<div class="meta-row">
                    <span>${tLabel('Due Date', 'تاريخ الاستحقاق')}</span>
                    <span>${formatDate(new Date(invoice.dueDate)).split(' ')[0]}</span>
                </div>` : ''}
            </div>
            
            <div class="meta-box">
                <div class="title">${tLabel('Bill To', 'فاتورة إلى')}</div>
                <div class="meta-row">
                    <span>${tLabel('Customer', 'العميل')}</span>
                    <strong>${invoice.customerName}</strong>
                </div>
                ${invoice.customerPhone ? `<div class="meta-row">
                    <span>${tLabel('Phone', 'الهاتف')}</span>
                    <span>${invoice.customerPhone}</span>
                </div>` : ''}
                ${invoice.customerAddress ? `<div class="meta-row">
                    <span>${tLabel('Address', 'العنوان')}</span>
                    <span>${invoice.customerAddress}</span>
                </div>` : ''}
                ${invoice.customerVatNumber ? `<div class="meta-row">
                    <span>${tLabel('VAT No', 'الرقم الضريبي')}</span>
                    <span>${invoice.customerVatNumber}</span>
                </div>` : ''}
            </div>
        </div>

        <!-- ITEMS TABLE -->
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>${tLabel('Description', 'الوصف')}</th>
                    <th class="right">${tLabel('Qty', 'الكمية')}</th>
                    <th class="right">${tLabel('Unit Price', 'سعر الوحدة')}</th>
                    ${showVatColumn ? `<th class="right">${tLabel('Taxable Amt', 'المبلغ الخاضع للضريبة')}</th>` : ''}
                    ${showVatColumn ? `<th class="right">${tLabel('VAT ' + appliedTaxRate + '%', 'ضريبة ' + appliedTaxRate + '%')}</th>` : ''}
                    <th class="right">${tLabel('Total', 'الإجمالي')}</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items.map((item, idx) => {
        const grossTotal = item.price * item.quantity;
        const lineDiscount = item.discountAmount ?? 0;
        const taxableAmount = item.netAmount ?? (grossTotal - lineDiscount);
        const itemTax = item.taxAmount ?? 0;
        const lineTotal = item.total ?? (taxableAmount + itemTax);

        return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>
                        ${item.name}
                        ${isBilingual && (item.arabicName || item.nameAr) ? `<div class="ar">${item.arabicName || item.nameAr}</div>` : ''}
                    </td>
                    <td class="right">${item.quantity}${item.unit === 'kg' ? ' kg' : ''}</td>
                    <td class="right">${formatCurrency(item.price)}</td>
                    ${showVatColumn ? `<td class="right">${formatCurrency(taxableAmount)}</td>` : ''}
                    ${showVatColumn ? `<td class="right">${appliedTaxRate}%</td>` : ''}
                    <td class="right">${formatCurrency(lineTotal)}</td>
                </tr>`;
    }).join('')}
            </tbody>
        </table>

        <!-- TOTALS -->
        <div class="totals-container">
            <div class="totals-box">
                <div class="total-row">
                    <span>${tLabel('Subtotal', 'المجموع الفرعي')}</span>
                    <span>${formatCurrency(displayBase)}</span>
                </div>
                
                ${(invoice.discountAmount || 0) > 0 ? `
                <div class="total-row discount">
                    <span>${tLabel('Discount', 'الخصم')}</span>
                    <span>-${formatCurrency(invoice.discountAmount)}</span>
                </div>
                <div class="total-row" style="font-weight:700;">
                    <span>${tLabel('Taxable Amount', 'المبلغ الخاضع للضريبة')}</span>
                    <span>${formatCurrency(displayBase - invoice.discountAmount)}</span>
                </div>
                ` : ''}
                
                ${showVatColumn ? `
                <div class="total-row">
                    <span>${tLabel('VAT (' + appliedTaxRate + '%)', 'الضريبة ' + appliedTaxRate + '%')}</span>
                    <span>${formatCurrency(displayTax)}</span>
                </div>
                ` : ''}

                <div class="total-row final">
                    <span>${tLabel('Total Amount Due', 'المبلغ المستحق')}</span>
                    <span>${formatCurrency(displayNet)}</span>
                </div>
                
                ${invoice.paidAmount !== undefined ? `
                <div class="total-row" style="border:none; margin-top:5px; font-size:13px;">
                     <span>${tLabel('Paid', 'المدفوع')}</span>
                     <span>${formatCurrency(invoice.paidAmount)}</span>
                </div>
                ${invoice.remainingAmount > 0 ? `
                <div class="total-row" style="border:none; color:#dc2626; font-weight:700;">
                     <span>${tLabel('Balance Due', 'المبلغ المتبقي')}</span>
                     <span>${formatCurrency(invoice.remainingAmount)}</span>
                </div>` : ''}
                ` : ''}
            </div>
        </div>

        <!-- QR CODE -->
        ${qrImg ? `<div class="qr-section"><img src="${qrImg}" /></div>` : ''}

        ${showTerms && termsContent ? `
        <div class="terms">
            <strong>${tLabel('Terms & Conditions', 'الشروط والأحكام')}</strong><br/>
            ${termsContent}
        </div>
        ` : ''}

        <div class="footer">
            <p>Thank you for your business! / شكراً لتعاملكم معنا</p>
        </div>
    </body>
    </html>
    `;
};



// --- THERMAL HTML GENERATOR (Monoscope / Receipt Style) ---
export const getThermalInvoiceHTML = async (invoice: Invoice, businessRaw: BusinessDetails | null): Promise<string | null> => {
    if (!invoice || !businessRaw) return null;
    const business = businessRaw || { name: 'Business', address: '', phone: '' } as BusinessDetails;

    // --- APP SETTINGS ---
    const savedAppSettings = localStorage.getItem('appSettings');
    const appSettings = savedAppSettings ? JSON.parse(savedAppSettings) : { currency: 'SAR', decimals: 2, dateFormat: 'dd/MM/yyyy' };

    const savedConfig = localStorage.getItem('printerConfig');
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};
    const printLanguage = fullConfig.printLanguage || 'english';
    const isBilingual = printLanguage === 'bilingual';
    const isRtl = printLanguage === 'arabic' || printLanguage === 'ar';
    const t = (en: string, ar: string) => isBilingual ? `${en} / <span dir="rtl" style="font-family: Arial, sans-serif;">${ar}</span>` : (isRtl ? ar : en);



    try {
        const formatDate = (date: Date) => {
            try {
                // Simple DD/MM/YYYY HH:MM
                return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            } catch (e) { return date.toISOString().split('T')[0]; }
        };

        // --- QR CODE ---
        let qrImg = '';
        // Consolidate all possible VAT fields (Same as A4)
        const vatNumber = business.gstin || business.vatNo || (business as any).vat || (business as any).taxRegNo;
        const savedZatcaConfig = localStorage.getItem('zatca_config');
        const zatcaConfig = savedZatcaConfig ? JSON.parse(savedZatcaConfig) : null;
        const isZatcaPhase2 = zatcaConfig && zatcaConfig.status === 'LIVE' && zatcaConfig.privateKey;

        if (vatNumber) {
            try {
                if (isZatcaPhase2) {
                    try {
                        const { generateZatcaXML } = await import('./zatcaXml');
                        const { qr } = await generateZatcaXML(invoice, { ...business, gstin: vatNumber }, zatcaConfig.privateKey);
                        qrImg = await QRCode.toDataURL(qr, { margin: 0 });
                    } catch (ph2Error) {
                        console.error("ZATCA Phase 2 QR Generation Failed (Thermal), falling back to Phase 1:", ph2Error);
                        qrImg = await generateZatcaQR(
                            business.name,
                            vatNumber,
                            formatZatcaDate(new Date(invoice.createdAt)),
                            invoice.grandTotal.toFixed(2),
                            invoice.taxAmount.toFixed(2)
                        );
                    }
                } else {
                    qrImg = await generateZatcaQR(
                        business.name,
                        vatNumber,
                        formatZatcaDate(new Date(invoice.createdAt)),
                        invoice.grandTotal.toFixed(2),
                        invoice.taxAmount.toFixed(2)
                    );
                }
            } catch (e) { console.error("QR Code Error in Thermal", e); }
        }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { margin: 0; padding: 0; size: 80mm auto; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            
            body {
                font-family: 'Courier New', Courier, monospace;
                width: 72mm;
                max-width: 72mm;
                margin: 0 auto;
                padding: 2mm 4mm;
                background: #fff;
                color: #000000 !important;
                font-weight: 900 !important;
                font-size: 11px;
                line-height: 1.2;
                overflow: hidden;
                word-wrap: break-word;
                overflow-wrap: break-word;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .container {
                width: 100%;
                max-width: 100%;
                padding: 0;
                overflow: hidden;
            }

            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: 900 !important; font-size: 13px !important; }
            
            /* Spacers */
            .hr { border-bottom: 1px dashed #000; margin: 5px 0; width: 100%; }
            .spacer { margin-bottom: 5px; }

            /* Header Section */
            .header-title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; word-break: break-word; }
            .header-info { font-size: 11px; color: #000; word-break: break-word; }

            /* Grid Layout for Rows */
            .row { display: flex; justify-content: space-between; width: 100%; max-width: 100%; overflow: hidden; gap: 4px; }
            .col { flex: 1; min-width: 0; }
            
            /* Items */
            .item-line { margin-bottom: 2px; max-width: 100%; overflow: hidden; }
            .item-name { width: 100%; display: block; font-weight: 900 !important; font-size: 12px; word-break: break-word; overflow-wrap: break-word; }
            .item-meta { display: flex; justify-content: space-between; font-size: 11px; margin-left: 5px; font-weight: 800; max-width: 100%; }
            .item-calc { color: #000000 !important; font-weight: 900; white-space: nowrap; }

            /* Totals */
            .totals-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-weight: 900; font-size: 12px; max-width: 100%; overflow: hidden; }
            .totals-row span { min-width: 0; }
            .grand-total { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 5px 0; margin: 5px 0; font-size: 15px; font-weight: 900 !important; }
            
            /* QR */
            .qr-code { display: block; margin: 10px auto; width: 90px; height: 90px; }
            
            /* Footer */
            .footer { text-align: center; font-size: 10px; margin-top: 10px; color: #000; }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="center">
                ${business.logoUrl ? `<img src="${business.logoUrl}" style="max-height: 50px; margin-bottom: 5px;" />` : ''}
                <div class="header-title">${business.name}</div>
                <div class="header-info">${business.address}</div>
                ${business.crNo ? `<div class="header-info">${t('CR No', 'سجل تجاري')}: ${business.crNo}</div>` : ''}
                ${vatNumber ? `<div class="header-info">VAT: ${vatNumber}</div>` : ''}
                ${business.phone ? `<div class="header-info">Tel: ${business.phone}</div>` : ''}
                ${business.email ? `<div class="header-info">${business.email}</div>` : ''}
            </div>

            <div class="hr"></div>

            <!-- Invoice Meta -->
            <div class="row">
                <span>${t('Inv', 'فاتورة')}: ${invoice.invoiceNumber}</span>
                <span>${formatDate(new Date(invoice.createdAt))}</span>
            </div>
            ${invoice.tokenNumber ? `<div style="text-align: center; margin: 10px 0; line-height: 1.1;">
                <div style="font-size: 12px; font-weight: bold; text-transform: uppercase;">${t('TOKEN NUMBER', 'رقم الطلب')}</div>
                <div style="font-size: 36px; font-weight: 900;">#${invoice.tokenNumber}</div>
            </div>` : ''}
            ${invoice.orderType ? `<div style="text-align: center; font-size: 18px; font-weight: bold; margin: 5px 0; padding: 4px; border: 2px solid #000; border-radius: 4px; text-transform: uppercase;">${invoice.orderType === 'dine_in' ? t('DINE-IN', 'محلي') : invoice.orderType === 'parcel' ? t('PARCEL', 'سفري') : invoice.orderType === 'pickup' ? t('PICKUP', 'استلام') : t('DELIVERY', 'توصيل')}</div>` : ''}
            
            <!-- Customer -->
             ${invoice.customerName ? `
            <div class="hr"></div>
            <div>${t('Cust', 'العميل')}: ${invoice.customerName}</div>
            ${invoice.customerPhone ? `<div>${t('Tel', 'جوال')}: ${invoice.customerPhone}</div>` : ''}
            ${invoice.customerVatNumber ? `<div>${t('VAT', 'الرقم الضريبي')}: ${invoice.customerVatNumber}</div>` : ''}
            ` : ''}

            <div class="hr"></div>

            <!-- Items Header (Simple) -->
            <div class="row" style="margin-bottom: 3px; font-size: 10px; font-weight: bold; text-decoration: underline;">
                <span style="flex:2">${t('ITEM / WT', 'الصنف / الوزن')}</span>
                <span style="flex:1; text-align:right">${t('TOTAL', 'المجموع')}</span>
            </div>

            <!-- Items -->
            ${invoice.items.map(item => {
                // Use pre-calculated fields if available, fallback to basic math if not (for legacy compatibility)
                const lineTotal = item.total ?? (item.price * item.quantity);

                return `
            <div class="item-line">
                <div class="item-name">${item.name}</div>
                ${(isBilingual && (item.arabicName || item.nameAr)) ? `<div style="font-size: 10px; margin-bottom:1px;">${item.arabicName || item.nameAr}</div>` : ''}
                <div class="item-meta">
                    <span class="item-calc">${item.quantity}${item.unit === 'kg' ? 'kg' : ''} x ${Number(item.price).toFixed(2)}</span>
                    <span>${Number(lineTotal).toFixed(2)}</span>
                </div>
            </div>
            `;
            }).join('')}

            <div class="hr"></div>

            <!-- Totals -->
            <div class="totals-row">
                <span>${t('Gross Total', 'المجموع الإجمالي')}</span>
                <span>${Number(invoice.subTotal).toFixed(2)}</span>
            </div>
            
            ${(invoice.discountAmount || 0) > 0 ? `
            <div class="totals-row" style="color: #666;">
                <span>${t('Discount', 'إجمالي الخصم')}</span>
                <span>-${Number(invoice.discountAmount).toFixed(2)}</span>
            </div>
            ` : ''}

            ${(invoice.taxAmount || 0) > 0 ? `
            <div class="totals-row" style="font-weight:bold; border-top: 1px dashed #000; padding-top: 2px;">
                <span>${t('Net (Pre-VAT)', 'الإجمالي بعد الخصم')}</span>
                <span>${Number(invoice.subTotal - (invoice.discountAmount || 0)).toFixed(2)}</span>
            </div>

            <div class="totals-row">
                <span>${t('VAT', 'ضريبة')} (${invoice.taxRate ?? (business.taxRate || 15)}%)</span>
                <span>${Number(invoice.taxAmount).toFixed(2)}</span>
            </div>
            ` : ''}

            <div class="row grand-total" style="margin-top: 5px; padding-top: 5px; font-size: 15px;">
                <span>${t('TOTAL', 'الإجمالي')}</span>
                <span>${appSettings.currency} ${Number(invoice.grandTotal).toFixed(2)}</span>
            </div>

            <div class="totals-row" style="font-size: 11px; margin-top: 10px;">
                <span>${t('Paid', 'المدفوع')}</span>
                <span>${Number(invoice.paidAmount || invoice.grandTotal).toFixed(2)}</span>
            </div>

            ${(invoice.remainingAmount || 0) > 0 ? `
            <div class="totals-row" style="font-weight:bold;">
                <span>${t('Balance Due', 'المتبقي')}</span>
                <span>${Number(invoice.remainingAmount).toFixed(2)}</span>
            </div>`: ''}
            
            <!-- QR -->
            ${qrImg ? `<img src="${qrImg}" class="qr-code" />` : ''}
            
            <div class="footer">
                Thank you for your visit!<br/>
                Powered by Billing Pro
            </div>
        </div>
    </body>
    </html>
    `;
    } catch (fatalError) {
        console.error("FATAL ERROR in Thermal HTML generation, returning fallback:", fatalError);
        return getMinimalThermalReceiptHTML(invoice, business);
    }
};

/**
 * A fail-safe, minimal HTML receipt if the main generator crashes.
 * Contains only critical data to ensure a receipt is ALWAYS printed.
 */
const getMinimalThermalReceiptHTML = (invoice: Invoice, business: BusinessDetails) => {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><style>
        body { font-family: monospace; width: 72mm; margin: 0 auto; padding: 5mm; }
        .center { text-align: center; }
        .hr { border-bottom: 1px dashed #000; margin: 5px 0; }
        .bold { font-weight: bold; font-size: 14px; }
    </style></head>
    <body>
        <div class="center">
            <div class="bold">${business.name}</div>
            <div>${business.phone || ''}</div>
            <div class="hr"></div>
            <div>INVOICE: ${invoice.invoiceNumber}</div>
            <div>DATE: ${new Date(invoice.createdAt).toLocaleString()}</div>
            <div class="hr"></div>
            <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">TOTAL: SAR ${Number(invoice.grandTotal).toFixed(2)}</div>
            <div class="hr"></div>
            <div style="font-size: 10px;">Fallback Receipt Generated due to error.</div>
        </div>
    </body></html>
    `;
};

export const generateInvoicePDF = async (invoice: Invoice, businessRaw: BusinessDetails | null) => {

    // Safety Fallback
    const business: BusinessDetails = businessRaw || {
        name: 'My Business',
        address: '',
        phone: '',
        email: ''
    };

    // 1. Load Config
    const savedConfig = localStorage.getItem('printerConfig');
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};

    // 2. Determine Type (Thermal vs A4/Regular)
    const useThermal = fullConfig.printerType === 'thermal';
    let html: string | null = '';
    let printerName = '';
    let pageSize = 'A4';

    if (useThermal) {
        console.log("Generating Thermal Invoice (HTML)...");
        html = await getThermalInvoiceHTML(invoice, business);
        printerName = fullConfig.thermal?.printerName || fullConfig.selectedPrinter || '';
        pageSize = '80mm';
    } else {
        console.log("Generating A4 Invoice (HTML)...");
        html = await getInvoiceHTML(invoice, business);
        printerName = fullConfig.regular?.printerName || fullConfig.selectedPrinter || '';
        pageSize = 'A4';
    }

    if (!html) {
        console.error("Failed to generate invoice HTML");
        return;
    }

    // 3. Print — respect copies from config
    const copies = useThermal
        ? (fullConfig.thermal?.copies || 1)
        : (fullConfig.regular?.copies || 1);

    console.log(`Printing customer receipt: printer="${printerName}", copies=${copies}, pageSize=${pageSize}`);

    await printContent(html, {
        selectedPrinter: printerName,
        silent: true,
        pageSize: pageSize,
        copies: copies
    });
};

// --- DOWNLOAD FUNCTION (Electron) ---
export const downloadInvoicePDF = async (invoice: Invoice, businessRaw: BusinessDetails | null, silent: boolean = false) => {
    const business: BusinessDetails = businessRaw || {
        name: 'Business', address: '', phone: '', email: ''
    };

    // Always use Standard HTML for PDF Downloads (Cleaner)
    const html = await getInvoiceHTML(invoice, business);

    if (!html) return false;

    if (window.electron && window.electron.downloadPDF) {
        return await window.electron.downloadPDF(html, `Invoice - ${invoice.invoiceNumber}.pdf`, silent);
    } else {
        // Fallback: Just Print
        alert("Download as PDF via the Print Dialog.");
        await generateInvoicePDF(invoice, business);
        return true;
    }
};


// --- PAYMENT RECEIPT HTML GENERATOR ---
export const getPaymentReceiptHTML = async (
    payment: { amount: number, date: Date, mode: string, note?: string, id?: string | number },
    customer: { name: string, phone?: string, balance?: number },
    businessRaw: BusinessDetails | null
): Promise<string | null> => {

    const business = businessRaw || { name: 'Business', address: '', phone: '', email: '' };

    // Load Settings
    const savedConfig = localStorage.getItem('printerConfig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};
    const useThermal = fullConfig.printerType === 'thermal';

    // App Settings
    const savedAppSettings = localStorage.getItem('appSettings');
    const appSettings = savedAppSettings ? JSON.parse(savedAppSettings) : { currency: 'SAR', decimals: 2, dateFormat: 'dd/MM/yyyy' };

    const formatCurrency = (amount: number) => appSettings.currency + ' ' + Number(amount).toFixed(appSettings.decimals);
    const formatDate = (date: Date) => {
        try {
            return format(date, appSettings.dateFormat + ' hh:mm a');
        } catch (e) { return date.toISOString(); }
    };

    // --- LANGUAGE & RTL ---
    const printLanguage = fullConfig.printLanguage || 'english';
    const isBilingual = printLanguage === 'bilingual';
    const isRtl = printLanguage === 'arabic' || printLanguage === 'ar';

    const t = (en: string, ar: string) => isBilingual ? `${en} / ${ar}` : (isRtl ? ar : en);

    // --- COLORS ---
    const primaryColor = '#2563eb';

    // Styles
    const css = useThermal ? `
        @page { margin: 0; size: 80mm auto; }
        body { 
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            font-size: 13px; margin: 0; padding: 10px; width: 72mm; 
            color: #000;
            direction: ${isRtl ? 'rtl' : 'ltr'};
        }
        .header { text-align: center; padding-bottom: 10px; margin-bottom: 15px; border-bottom: 2px solid #000; }
        .business-title { font-weight: 800; font-size: 16px; text-transform: uppercase; margin-bottom: 4px; }
        .business-meta { font-size: 11px; color: #555; }
        
        .title { text-align: center; font-weight: 800; font-size: 14px; margin: 10px 0 15px; text-transform: uppercase; letter-spacing: 1px; }
        
        .grid { display: flex; flex-direction: column; gap: 8px; }
        .row { display: flex; justify-content: space-between; align-items: center; }
        .label { font-size: 11px; color: #444; font-weight: 500; }
        .value { font-weight: 700; font-size: 12px; }
        
        .box-amount { 
            margin: 15px 0; padding: 10px; 
            border: 2px solid #000; border-radius: 6px; 
            text-align: center; 
        }
        .amount-lbl { font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
        .amount-val { font-size: 20px; font-weight: 900; }
        
        .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; font-style: italic; }
    ` : `
        @page { size: A5; margin: 20mm; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 14px; color: #333; direction: ${isRtl ? 'rtl' : 'ltr'}; }
        .header { text-align: center; border-bottom: 3px solid ${primaryColor}; padding-bottom: 20px; margin-bottom: 30px; }
        .business-title { font-size: 24px; font-weight: bold; color: ${primaryColor}; margin-bottom: 5px; }
        .business-meta { font-size: 12px; color: #666; }
        .title { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 20px 0 30px; letter-spacing: 2px; text-align: center; color: #1e293b; }
        
        .box { border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px; }
        .row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #64748b; }
        .value { font-weight: 700; color: #0f172a; }
        
        .highlight-row { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; display: block; border: 1px solid #e2e8f0; }
        .amount { font-size: 28px; color: ${primaryColor}; font-weight: 900; display: block; margin-top: 5px; }
        
        .footer { text-align: center; margin-top: 40px; color: #94a3b8; font-size: 12px; }
    `;

    return `
    <!DOCTYPE html>
    <html dir="${isRtl ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <style>${css}</style>
    </head>
    <body>
        <div class="header">
            ${business.logoUrl && useThermal ? `<img src="${business.logoUrl}" style="max-height: 50px; display: block; margin: 0 auto 5px;" />` : ''}
            ${business.logoUrl && !useThermal ? `<img src="${business.logoUrl}" style="max-height: 80px;" />` : ''}
            
            <div class="business-title">${business.name}</div>
            <div class="business-meta">
                ${business.address}<br>
                ${business.phone ? `${t('Tel', 'هاتف')}: ${business.phone}` : ''}
            </div>
        </div>

        <div class="title">${t('Payment Receipt', 'سند قبض')}</div>

        <div class="${useThermal ? 'grid' : 'box'}">
            
            ${useThermal ? `
            <div class="box-amount">
                <div class="amount-lbl">${t('Amount Received', 'المبلغ المستلم')}</div>
                <div class="amount-val">${formatCurrency(payment.amount)}</div>
            </div>
            ` : ''}

            <div class="row">
                <span class="label">${t('Date', 'التاريخ')}</span>
                <span class="value">${formatDate(new Date(payment.date))}</span>
            </div>
            <div class="row">
                <span class="label">${t('Receipt No', 'رقم السند')}</span>
                <span class="value">#${payment.id || '-'}</span>
            </div>
            <div class="row">
                <span class="label">${t('Received From', 'استلمنا من')}</span>
                <span class="value">${customer.name}</span>
            </div>
            <div class="row">
                <span class="label">${t('Payment Mode', 'طريقة الدفع')}</span>
                <span class="value" style="text-transform: uppercase">${payment.mode}</span>
            </div>
            ${payment.note ? `
            <div class="row">
                 <span class="label">${t('Note', 'ملاحظة')}</span>
                 <span class="value">${payment.note}</span>
            </div>` : ''}

            ${!useThermal ? `
            <div class="highlight-row">
                <span>${t('Amount Received', 'المبلغ المستلم')}</span>
                <span class="amount">${formatCurrency(payment.amount)}</span>
            </div>
            ` : ''}

            ${customer.balance !== undefined ? `
            <div class="row" style="margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;">
                <span class="label">${t('Current Balance', 'الرصيد الحالي')}</span>
                <span class="value">${formatCurrency(customer.balance)}</span>
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>${t('Thank you for your payment!', 'شكراً لسدادكم!')}</p>
        </div>
    </body>
    </html>
    `;
};

export const getPurchaseHTML = async (
    purchase: Purchase,
    businessRaw: BusinessDetails | null,
    t: (key: string) => string = (k) => k,
    language: string = 'en'
): Promise<string | null> => {

    const isRtl = language === 'ar';
    const alignLeft = isRtl ? 'right' : 'left';
    const alignRight = isRtl ? 'left' : 'right';

    // Safety Fallback
    const business: BusinessDetails = businessRaw || {
        name: 'Business Name',
        address: 'Business Address',
        phone: '',
        email: '',
        gstin: '',
        country: 'Saudi Arabia'
    };

    // Load Settings
    const savedConfig = localStorage.getItem('printerConfig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};
    const config = fullConfig.regular || { pageSize: 'a4', orientation: 'portrait' };

    const savedAppSettings = localStorage.getItem('appSettings');
    const appSettings = savedAppSettings ? JSON.parse(savedAppSettings) : { currency: '$', decimals: 2, dateFormat: 'dd/MM/yyyy' };
    const formatCurrency = (amount: number) => appSettings.currency + Number(amount).toFixed(appSettings.decimals);


    // Determine Title & Labels
    let docTitle = t('purchases.print_title_bill') || 'PURCHASE BILL';
    let fromLabel = t('common.supplier') || 'Supplier';
    let toLabel = t('purchases.bill_to') || 'Bill To';

    if (purchase.type === 'order') {
        docTitle = t('purchases.print_title_order') || 'PURCHASE ORDER';
        fromLabel = t('purchases.from') || 'Vendor / Supplier';
        toLabel = t('purchases.ship_to') || 'Ship To';
    } else if (purchase.type === 'return') {
        docTitle = t('purchases.print_title_return') || 'DEBIT NOTE / RETURN';
        fromLabel = t('purchases.return_to') || 'Return To';
        toLabel = t('common.from') || 'From';
    }

    return `
    <!DOCTYPE html>
    <html lang="${language}" dir="${isRtl ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <style>
            @media print {
                @page { size: ${config.pageSize === 'letter' ? 'Letter' : 'A4'} ${config.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 0; }
                body { margin: 20mm; -webkit-print-color-adjust: exact; }
            }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #333;
                padding: 20px;
                max-width: 900px;
                margin: 0 auto;
                direction: ${isRtl ? 'rtl' : 'ltr'};
            }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .title-section { text-align: ${alignRight}; }
            .doc-title { font-size: 32px; font-weight: bold; color: ${purchase.type === 'return' ? '#d97706' : '#2563eb'}; letter-spacing: 1px; }
            .doc-number { font-size: 16px; color: #666; margin-top: 5px; }
            
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .box-title { font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            .box-content { font-size: 14px; line-height: 1.6; }
            
            .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .table th { text-align: ${alignLeft}; padding: 12px; background: #f8fafc; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
            .table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; text-align: ${alignLeft}; }
            .table td.right { text-align: ${alignRight}; }
            .table th.right { text-align: ${alignRight}; }
            
            .totals { display: flex; justify-content: flex-end; }
            .totals-box { width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
            .total-row.final { font-size: 18px; font-weight: bold; border-top: 2px solid #333; border-bottom: none; margin-top: 10px; padding-top: 15px; color: #0f172a; }
            
            .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                ${business.logoUrl ? `<img src="${business.logoUrl}" style="max-height: 80px;" />` : `<div style="font-size: 24px; font-weight: bold;">${business.name}</div>`}
            </div>
            <div class="title-section">
                <div class="doc-title">${docTitle}</div>
                <div class="doc-number">#${purchase.orderNumber}</div>
                <div style="margin-top: 5px; font-size: 14px;">${t('common.date') || 'Date'}: ${format(new Date(purchase.date), appSettings.dateFormat)}</div>
                ${purchase.dueDate ? `<div style="font-size: 14px; color: #dc2626;">${t('common.overdue') || 'Due'}: ${format(new Date(purchase.dueDate), appSettings.dateFormat)}</div>` : ''}
            </div>
        </div>

        <div class="meta-grid">
            <div>
                <div class="box-title">${fromLabel}</div>
                <div class="box-content">
                    <div style="font-weight: bold; font-size: 16px;">${purchase.supplierName}</div>
                    ${purchase.supplierId ? `<div>${t('purchases.supplier_ref') || 'Ref'}: ${purchase.supplierId}</div>` : ''}
                </div>
            </div>
            <div>
                <div class="box-title">${toLabel}</div>
                <div class="box-content">
                    <div style="font-weight: bold; font-size: 16px;">${business.name}</div>
                    <div>${business.address}</div>
                    <div>${business.phone}</div>
                    <div>${business.email}</div>
                </div>
            </div>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th style="width: 50px;">#</th>
                    <th>${t('common.description') || 'Item Description'}</th>
                    <th class="right">${t('common.qty') || 'Quantity'}</th>
                    <th class="right">${t('purchases.unit_cost') || 'Unit Cost'}</th>
                    <th class="right">${t('common.total') || 'Total'}</th>
                </tr>
            </thead>
            <tbody>
                ${purchase.items.map((item, index) => `
                <tr>
                    <td style="color: #94a3b8;">${index + 1}</td>
                    <td style="font-weight: 500;">${item.name}</td>
                    <td class="right">${item.quantity}</td>
                    <td class="right">${formatCurrency(item.cost)}</td>
                    <td class="right" style="font-weight: bold;">${formatCurrency(item.quantity * item.cost)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totals">
            <div class="totals-box">
                <div class="total-row">
                    <span>${t('pos.subtotal') || 'Subtotal'}</span>
                    <span>${formatCurrency(purchase.totalAmount)}</span>
                </div>
                ${purchase.paymentType ? `
                <div class="total-row">
                    <span>${t('common.type') || 'Payment Type'}</span>
                    <span style="text-transform: capitalize;">${purchase.paymentType}</span>
                </div>` : ''}
                <div class="total-row final">
                    <span>${t('common.total') || 'Total Amount'}</span>
                    <span>${formatCurrency(purchase.totalAmount)}</span>
                </div>
                ${purchase.paidAmount ? `
                <div class="total-row" style="color: #16a34a; font-weight: bold;">
                    <span>${t('common.paid') || 'Paid'}</span>
                    <span>${formatCurrency(purchase.paidAmount)}</span>
                </div>
                <div class="total-row" style="color: #dc2626; border-bottom: none;">
                    <span>${t('purchases.balance_due') || 'Balance Due'}</span>
                    <span>${formatCurrency(Math.max(0, purchase.totalAmount - purchase.paidAmount))}</span>
                </div>` : ''}
            </div>
        </div>

        ${purchase.notes ? `
        <div style="margin-top: 40px; background: #f8fafc; padding: 20px; border-radius: 8px;">
            <div class="box-title" style="border-bottom: none; margin-bottom: 5px;">${t('common.notes') || 'Notes'}</div>
            <div style="font-style: italic; color: #64748b;">${purchase.notes}</div>
        </div>` : ''}

        <div class="footer">
            Generated by Billing Pro
        </div>
    </body>
    </html>
    `;
};

export const printPurchase = async (
    purchase: Purchase,
    businessRaw: BusinessDetails | null,
    t: (key: string) => string = (k) => k,
    language: string = 'en'
) => {
    // 1. Generate HTML
    const html = await getPurchaseHTML(purchase, businessRaw, t, language);
    if (!html) return;

    // 2. Load Config
    const savedConfig = localStorage.getItem('printerConfig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};

    // Default to Regular printer for Purchase Orders usually
    const config = fullConfig.regular || {};
    const printerName = config.printerName || fullConfig.selectedPrinter || '';

    // 3. Print
    // 3. Print
    await printContent(html, {
        selectedPrinter: printerName,
        silent: true,
        pageSize: 'a4' // Defaulting to A4 for purchases
    });
};



export const printPaymentReceipt = async (
    payment: { amount: number, date: Date, mode: string, note?: string, id?: string | number },
    customer: { name: string, phone?: string, balance?: number },
    businessRaw: BusinessDetails | null
) => {
    const business = businessRaw || { name: 'Business', address: '', phone: '', email: '' };

    // 1. Load Config
    const savedConfig = localStorage.getItem('printerConfig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};
    const useThermal = fullConfig.printerType === 'thermal';

    let html: string | null = '';
    let printerName = '';
    let pageSize = 'A4';

    // Generate HTML based on type
    html = await getPaymentReceiptHTML(payment, customer, business);

    if (useThermal) {
        printerName = fullConfig.thermal?.printerName || fullConfig.selectedPrinter || '';
        pageSize = '80mm';
    } else {
        printerName = fullConfig.regular?.printerName || fullConfig.selectedPrinter || '';
        pageSize = 'A5';
    }

    if (html) {
        await printContent(html, {
            selectedPrinter: printerName,
            silent: true,
            pageSize: pageSize,
            copies: 1
        });
    }
};

// --- KITCHEN PRINTER (SIMPLIFIED THERMAL) ---
export const getKitchenTicketHTML = async (invoice: Invoice) => {
    // 1. App Settings (Language/Format)
    const savedConfig = localStorage.getItem('printerConfig');
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};

    const savedAppSettings = localStorage.getItem('appSettings');
    const appSettings = savedAppSettings ? JSON.parse(savedAppSettings) : { dateFormat: 'dd/MM/yyyy' };

    const formatDate = (date: Date) => {
        try {
            return format(date, appSettings.dateFormat + ' hh:mm a');
        } catch (e) { return date.toISOString(); }
    };

    // --- LANGUAGE & RTL ---
    const printLanguage = fullConfig.printLanguage || 'english';
    const isBilingual = printLanguage === 'bilingual';
    const isRtl = printLanguage === 'arabic' || printLanguage === 'ar';
    const t = (en: string, ar: string) => isBilingual ? `${en} / <span dir="rtl" style="font-family: Arial, sans-serif;">${ar}</span>` : (isRtl ? ar : en);

    // CSS specifically for Kitchen (usually 80mm)
    const css = `
        @page { margin: 0; size: 80mm auto; }
        body { 
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            font-size: 13px; 
            margin: 0; padding: 3mm 2mm; width: 64mm; 
            color: #000;
            direction: ${isRtl ? 'rtl' : 'ltr'};
        }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 5px; margin-bottom: 10px; }
        .ticket-title { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
        .order-no { font-size: 13px; font-weight: bold; }
        .meta { font-size: 11px; margin-bottom: 2px; }
        
        .item-line { margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #ccc; display: flex; justify-content: space-between; align-items: start;}
        .item-details { flex: 1; padding-right: 5px; }
        .item-name { font-weight: 900; font-size: 14px; line-height: 1.1; }
        .item-name-ar { font-weight: bold; font-size: 12px; line-height: 1.1; margin-top: 2px; }
        .item-qty { font-weight: 900; font-size: 18px; text-align: center; white-space: nowrap; padding-left: 8px; border-left: 2px solid #000; min-width: 40px; }
        
        .footer { text-align: center; margin-top: 15px; font-size: 10px; }
    `;

    return `
    <!DOCTYPE html>
    <html dir="${isRtl ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <style>${css}</style>
    </head>
    <body>
        <div class="header">
            <div class="ticket-title">${t('KITCHEN TICKET', 'تذكرة المطبخ')}</div>
            ${invoice.tokenNumber ? `<div style="text-align: center; margin: 5px 0; line-height: 1.1;">
                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase;">${t('TOKEN NUMBER', 'رقم الطلب')}</div>
                <div style="font-size: 32px; font-weight: 900;">#${invoice.tokenNumber}</div>
            </div>` : ''}
            <div class="order-no" style="${invoice.tokenNumber ? 'font-size:11px; font-weight:normal;' : ''}">
                ${t('Order', 'الطلب')} #${invoice.invoiceNumber}
            </div>
            ${invoice.orderType ? `<div style="margin: 8px 0; padding: 4px; font-size: 18px; font-weight: 900; border: 2px dashed #000; text-transform: uppercase;">${invoice.orderType === 'dine_in' ? t('DINE-IN', 'محلي') : invoice.orderType === 'parcel' ? t('PARCEL', 'سفري') : invoice.orderType === 'pickup' ? t('PICKUP', 'استلام') : t('DELIVERY', 'توصيل')}</div>` : ''}
            <div class="meta">${t('Date', 'التاريخ')}: ${formatDate(new Date(invoice.createdAt))}</div>
            ${invoice.customerName && invoice.customerName !== 'Walk-in Customer' && invoice.customerName !== 'عميل نقدي' ?
            `<div class="meta">Cust: ${invoice.customerName}</div>` : ''}
        </div>

        <div>
            <!-- Items Header -->
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; text-decoration: underline; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #000;">
                <span>${t('ITEM', 'الصنف')}</span>
                <span>${t('QTY/WT', 'الكمية/الوزن')}</span>
            </div>

            ${invoice.items.map(item => `
            <div class="item-line">
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    ${(isBilingual && (item.arabicName || item.nameAr)) ? `<div class="item-name-ar">${item.arabicName || item.nameAr}</div>` : ''}
                </div>
                <div class="item-qty">${item.quantity}${item.unit === 'kg' ? '<span style="font-size: 14px; margin-left: 2px;">kg</span>' : ''}</div>
            </div>
            `).join('')}
        </div>

        ${invoice.notes ? `
        <div style="margin-top: 15px; padding-top: 10px; border-top: 2px dashed #000;">
            <div style="font-weight: bold; font-size: 14px; text-decoration: underline; margin-bottom: 5px;">${t('NOTES', 'ملاحظات')}:</div>
            <div style="font-size: 16px; font-weight: bold; white-space: pre-wrap;">${invoice.notes}</div>
        </div>
        ` : ''}

        <div class="footer">
            --- End of Ticket ---
        </div>
    </body>
    </html>
    `;
};

export const generateKitchenTicketPDF = async (invoice: Invoice) => {
    // 1. Load Config
    const savedConfig = localStorage.getItem('printerConfig');
    const fullConfig = savedConfig ? JSON.parse(savedConfig) : {};

    // 2. Strict Check for Kitchen Printing
    if (!fullConfig.kitchen?.enabled) {
        console.log("Kitchen printing skipped: Disabled in settings.");
        return;
    }

    // 3. Kitchen printer MUST be specified — never fall back to main printer
    const kitchenPrinterName = fullConfig.kitchen?.printerName;
    if (!kitchenPrinterName) {
        console.error("Kitchen printing skipped: No kitchen printer configured. Configure one in Settings > Print > Kitchen Printer.");
        return;
    }

    const paperSize = fullConfig.kitchen?.paperSize || '80mm';
    const copies = fullConfig.kitchen?.copies || 1;

    console.log(`Generating Kitchen Ticket — Printer: "${kitchenPrinterName}", Copies: ${copies}, Paper: ${paperSize}`);
    
    // 4. Generate HTML
    const html = await getKitchenTicketHTML(invoice);
    if (!html) return;

    // 5. Send ONLY to kitchen printer (never falls to system default / main)
    await printContent(html, {
        selectedPrinter: kitchenPrinterName,
        silent: true,
        pageSize: paperSize,
        copies: copies
    });
};

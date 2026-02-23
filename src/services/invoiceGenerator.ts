import { format } from 'date-fns';
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
    const t = (en: string, ar: string) => isBilingual ? `<div class="bilingual-text"><span class="en">${en}</span><span class="ar">${ar}</span></div>` : en;
    const tLabel = (en: string, ar: string) => isBilingual ? `${en} / <span class="ar">${ar}</span>` : en;

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
                // Import Dynamically to avoid circular deps or heavy load
                const { generateZatcaXML } = await import('./zatcaXml');
                const { qr } = await generateZatcaXML(invoice, {
                    ...business,
                    gstin: vatNumber // Ensure mapped correctly
                }, zatcaConfig.privateKey);

                // Convert Base64 TLV to QR Image
                const QRCode = (await import('qrcode')).default;
                qrImg = await QRCode.toDataURL(qr);
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
            console.error("QR Generation Failed", e);
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
                
                /* FORCE HIGH CONTRAST FOR THERMAL / BLACK & WHITE PRINTERS */
                * {
                    text-shadow: none !important;
                    box-shadow: none !important;
                    background-image: none !important; /* Remove gradients */
                }
                body, .header, .meta-box, .invoice-table th, .invoice-table td, .total-row, .footer, .terms {
                    background-color: white !important;
                    color: black !important;
                }
                .company-name, .meta-title, .invoice-table th {
                    -webkit-text-fill-color: black !important;
                    color: black !important;
                }
                .header { border-bottom: 2px solid black !important; padding-bottom: 15px !important; }
                .meta-box { border: 2px solid black !important; }
                .invoice-table th { border-bottom: 2px solid black !important; font-weight: 900 !important; color: black !important; }
                .invoice-table td { border-bottom: 1px solid #000 !important; }
                .total-row { border-bottom: 1px dashed black !important; }
                .total-row.final { 
                    border-top: 2px solid black !important; 
                    border-bottom: 2px solid black !important;
                    background: none !important;
                }
                /* Ensure small text is readable */
                .meta-row, .invoice-table td { font-weight: 600 !important; color: black !important; }
            }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #1e293b;
                background: #fff;
                padding: 20px;
            }
            .ar { font-family: 'Tahoma', sans-serif; direction: rtl; }
            .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: flex-start; 
                margin-bottom: 30px; 
                border-bottom: 4px solid #3b82f6; 
                padding-bottom: 20px;
                background: linear-gradient(135deg, #dbeafe 0%, #f0f9ff 100%);
                padding: 20px;
                border-radius: 12px 12px 0 0;
            }
            .logo-section img { max-height: 80px; max-width: 200px; filter: grayscale(0%); }
            @media print { .logo-section img { filter: grayscale(100%) contrast(150%); } } /* Improve Logo Print */
            
            .company-info { text-align: right; }
            .company-name { 
                font-size: 26px; 
                font-weight: bold; 
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 5px; 
            }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .meta-box { 
                border: 3px solid #3b82f6; 
                border-radius: 12px; 
                padding: 15px; 
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #dbeafe 100%);
                box-shadow: 0 4px 6px rgba(59, 130, 246, 0.1);
            }
            .meta-title { 
                font-size: 13px; 
                text-transform: uppercase; 
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 10px; 
                font-weight: 800; 
                letter-spacing: 0.8px; 
            }
            .meta-row { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 5px; 
                font-size: 14px; 
                color: #0f172a;
                font-weight: 500;
            }
            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-radius: 12px; overflow: hidden; }
            .invoice-table th { 
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%); 
                text-align: left; 
                padding: 14px; 
                font-size: 13px; 
                font-weight: 800; 
                text-transform: uppercase; 
                border-bottom: 3px solid #1e40af; 
                color: #ffffff;
                letter-spacing: 0.5px;
            }
            .invoice-table td { 
                padding: 12px; 
                border-bottom: 2px solid #bfdbfe; 
                font-size: 14px; 
                color: #0f172a;
                font-weight: 500;
                background: linear-gradient(to right, #f8fafc 0%, #ffffff 50%, #f8fafc 100%);
            }
            .invoice-table tr:hover td {
                background: linear-gradient(to right, #dbeafe 0%, #eff6ff 50%, #dbeafe 100%);
            }
            .invoice-table td.right { text-align: right; }
            .totals-container { display: flex; justify-content: flex-end; }
            .totals-box { width: 320px; }
            .total-row { 
                display: flex; 
                justify-content: space-between; 
                padding: 10px 15px; 
                border-bottom: 2px dashed #60a5fa; 
                color: #0f172a;
                font-weight: 600;
                font-size: 14px;
                background: linear-gradient(to right, #f0f9ff 0%, #ffffff 100%);
                margin-bottom: 2px;
            }
            .total-row.final { 
                border-top: 4px solid #3b82f6; 
                border-bottom: 4px solid #10b981; 
                font-weight: 800; 
                font-size: 18px; 
                margin-top: 10px; 
                padding: 18px 15px; 
                background: linear-gradient(135deg, #6366f1 0%, #3b82f6 50%, #10b981 100%);
                color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 6px 12px rgba(59, 130, 246, 0.3);
            }
            .footer { 
                margin-top: 50px; 
                text-align: center; 
                color: #0f172a; 
                font-size: 13px; 
                border-top: 3px solid #3b82f6; 
                padding-top: 20px;
                background: linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%);
                padding: 20px;
                border-radius: 8px;
                font-weight: 600;
            }
            .terms { 
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #dbeafe 100%); 
                padding: 18px; 
                border-radius: 12px; 
                font-size: 13px; 
                color: #0f172a; 
                margin-top: 30px; 
                border: 3px solid #3b82f6;
                font-weight: 500;
                box-shadow: 0 4px 8px rgba(59, 130, 246, 0.15);
            }
            .bilingual-text { display: flex; align-items: baseline; gap: 5px; }
            .qr-float { float: left; margin-top: 10px; width: 100px; height: 100px; border: 3px solid #3b82f6; border-radius: 8px; padding: 5px; background: white; }
            @media print { .qr-float { border: 2px solid black !important; } }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo-section">
                ${business.logoUrl ? `<img src="${business.logoUrl}" />` : ''}
                ${qrImg ? `<div class="qr-float"><img src="${qrImg}" style="width:100%" /></div>` : ''}
            </div>
            <div class="company-info">
                ${printCompanyName ? `<div class="company-name">${business.name}</div>` : ''}
                <div>${business.address} ${business.pincode ? `- ${business.pincode}` : ''}</div>
                ${business.phone ? `<div>${tLabel('Tel', 'هاتف')}: ${business.phone}</div>` : ''}
                ${business.email ? `<div>${tLabel('Email', 'بريد إلكتروني')}: ${business.email}</div>` : ''}
                ${vatNumber ? `<div><strong>${tLabel('VAT Number', 'الرقم الضريبي')}: ${vatNumber}</strong></div>` : ''}
                ${business.crNo ? `<div>${tLabel('CR Number', 'سجل تجاري')}: ${business.crNo}</div>` : ''}
            </div>
        </div>

        <div class="meta-grid">
            <div class="meta-box">
                <div class="meta-title">${t('Invoice Details', 'تفاصيل الفاتورة')}</div>
                <div class="meta-row">
                    <span>${tLabel('Invoice No', 'رقم الفاتورة')}</span>
                    <strong>${invoice.invoiceNumber || invoice.id || '-'}</strong>
                </div>
                ${invoice.tokenNumber ? `<div class="meta-row">
                    <span>${tLabel('Token No', 'رقم الطلب')}</span>
                    <strong style="font-size: 1.2em; color: #3b82f6;">#${invoice.tokenNumber}</strong>
                </div>` : ''}
                <div class="meta-row">
                    <span>${tLabel('Date & Time', 'التاريخ والوقت')}</span>
                    <span>${formatDate(new Date(invoice.createdAt))}</span>
                </div>
                <div class="meta-row">
                    <span>${tLabel('Payment Mode', 'طريقة الدفع')}</span>
                    <span style="text-transform: uppercase">${invoice.paymentMode}</span>
                </div>
                ${invoice.dueDate ? `<div class="meta-row">
                    <span>${tLabel('Due Date', 'تاريخ الاستحقاق')}</span>
                    <span>${formatDate(new Date(invoice.dueDate)).split(' ')[0]}</span>
                </div>` : ''}
            </div>
            
            <div class="meta-box">
                <div class="meta-title">${t('Bill To', 'فاتورة إلى')}</div>
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

        <table class="invoice-table">
            <thead>
                <tr>
                    <th>${tLabel('Item', 'الصنف')}</th>
                    <th class="right">${tLabel('Qty', 'الكمية')}</th>
                    <th class="right">${tLabel('Price', 'السعر')}</th>
                    ${showVatColumn ? `<th class="right">${tLabel('VAT', 'الضريبة')}</th>` : ''}
                    <th class="right">${tLabel('Total', 'الإجمالي')}</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items.map(item => {
        const itemNominalTotal = item.price * item.quantity;
        const rate = item.taxRate ?? appliedTaxRate;
        const type = item.taxType || 'exclusive';

        // Calculate tax for display
        let itemTax = 0;
        let itemRowTotal = itemNominalTotal;

        if (type === 'inclusive') {
            // Tax is inside price
            const base = itemNominalTotal / (1 + (rate / 100));
            itemTax = itemNominalTotal - base;
            itemRowTotal = itemNominalTotal;
        } else {
            // Exclusive
            // Check if tax was applied?
            // Since we don't store per-line tax verdict, we rely on the global fact:
            // If invoice has tax, and this is exclusive, did we separate it?
            // Actually, "User Choice" is global for the cart in checkout generally (single toggle).
            // But if we had mixed items + tax enabled...
            // Simplest inference:
            // If ShowVatColumn is true, then we show calculated tax for exclusive items too.
            if (showVatColumn) {
                itemTax = itemNominalTotal * (rate / 100);
                itemRowTotal = itemNominalTotal + itemTax;
            } else {
                itemTax = 0;
                itemRowTotal = itemNominalTotal;
            }
        }

        return `
                <tr>
                    <td>
                        ${item.name}
                        ${isBilingual && item.nameAr ? `<div class="ar">${item.nameAr}</div>` : ''}
                    </td>
                    <td class="right">${item.quantity}</td>
                    <td class="right">${formatCurrency(item.price)}</td>
                    ${showVatColumn ? `<td class="right">${formatCurrency(itemTax)}</td>` : ''}
                    <td class="right">${formatCurrency(itemRowTotal)}</td>
                </tr>
                `;
    }).join('')}
            </tbody>
        </table>

        <div class="totals-container">
            <div class="totals-box">
                <div class="total-row">
                    <span>${tLabel('Subtotal', 'المجموع الفرعي')}</span>
                    <span>${formatCurrency(displayBase)}</span>
                </div>
                
                 ${showVatColumn ? `
                <div class="total-row">
                    <span>${tLabel('VAT Amount', 'مبلغ الضريبة')} (${appliedTaxRate}%)</span>
                    <span>${formatCurrency(displayTax)}</span>
                </div>
                ` : ''}
                
                ${invoice.discountAmount > 0 ? `
                <div class="total-row">
                    <span>${tLabel('Discount', 'الخصم')}</span>
                    <span>-${formatCurrency(invoice.discountAmount)}</span>
                </div>` : ''}

                <div class="total-row final">
                    <span>${tLabel('Grand Total', 'الإجمالي النهائي')}</span>
                    <span>${formatCurrency(displayNet)}</span>
                </div>
                
                ${invoice.paidAmount !== undefined ? `
                <div class="total-row" style="background:none; border:none; margin-top:5px; font-size: 14px;">
                     <span>${tLabel('Paid Amount', 'المبلغ المدفوع')}</span>
                     <span>${formatCurrency(invoice.paidAmount)}</span>
                </div>
                ${invoice.remainingAmount > 0 ? `
                <div class="total-row" style="background:none; border:none; color: #ef4444;">
                     <span>${tLabel('Balance Due', 'المبلغ المتبقي')}</span>
                     <span>${formatCurrency(invoice.remainingAmount)}</span>
                </div>` : ''}
                ` : ''}
            </div>
        </div>

        ${showTerms && termsContent ? `
        <div class="terms">
            <strong>${tLabel('Terms & Conditions', 'الشروط والأحكام')}</strong><br/>
            ${termsContent}
        </div>
        ` : ''}

        <div class="footer">
            <p>Thank you for your business!</p>
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
                const { generateZatcaXML } = await import('./zatcaXml');
                const { qr } = await generateZatcaXML(invoice, { ...business, gstin: vatNumber }, zatcaConfig.privateKey);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const QRCode = (await import('qrcode')).default;
                qrImg = await QRCode.toDataURL(qr, { margin: 0 });
            } else {
                const { generateZatcaQR, formatZatcaDate } = await import('./zatca');
                qrImg = await generateZatcaQR(
                    business.name,
                    vatNumber,
                    formatZatcaDate(new Date(invoice.createdAt)),
                    invoice.grandTotal.toFixed(2),
                    invoice.taxAmount.toFixed(2)
                );
            }
        } catch (e) { console.error("QR Code Error", e); }
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { margin: 0; size: auto; }
            * { box-sizing: border-box; }
            
            body {
                font-family: 'Courier New', Courier, monospace;
                width: 64mm; /* SAFE ZONE: 80mm paper - ~8mm margins/side */
                margin: 0 auto;
                padding: 10px 0;
                background: #fff;
                color: #000;
                font-size: 11px;
                line-height: 1.2;
                overflow: hidden; /* ABSOLUTELY PREVENT OVERFLOW */
                word-wrap: break-word; /* Force wrapping */
            }

            .container {
                width: 100%;
                padding: 0 2mm; /* Tiny padding from edge */
            }

            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            
            /* Spacers */
            .hr { border-bottom: 1px dashed #000; margin: 5px 0; width: 100%; }
            .spacer { margin-bottom: 5px; }

            /* Header Section */
            .header-title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; }
            .header-info { font-size: 11px; color: #000; }

            /* Grid Layout for Rows */
            .row { display: flex; justify-content: space-between;width: 100%; }
            .col { flex: 1; }
            
            /* Items */
            .item-line { margin-bottom: 2px; }
            .item-name { width: 100%; display: block; font-weight: bold; }
            .item-meta { display: flex; justify-content: space-between; font-size: 10px; margin-left: 5px; }
            .item-calc { color: #000; } /* 2 x 50.00 */

            /* Totals */
            .totals-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
            .grand-total { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin: 5px 0; font-size: 14px; font-weight: bold; }
            
            /* QR */
            .qr-code { display: block; margin: 10px auto; width: 100px; height: 100px; }
            
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
                ${vatNumber ? `<div class="header-info">VAT: ${vatNumber}</div>` : ''}
                ${business.phone ? `<div class="header-info">Tel: ${business.phone}</div>` : ''}
                ${business.email ? `<div class="header-info">${business.email}</div>` : ''}
            </div>

            <div class="hr"></div>

            <!-- Invoice Meta -->
            <div class="row">
                <span>Inv: ${invoice.invoiceNumber}</span>
                <span>${formatDate(new Date(invoice.createdAt))}</span>
            </div>
            ${invoice.tokenNumber ? `<div style="text-align: center; font-size: 24px; font-weight: bold; margin: 10px 0; padding: 8px; background: #3b82f6; color: white; border-radius: 8px;">TOKEN #${invoice.tokenNumber}</div>` : ''}
            
            <!-- Customer -->
             ${invoice.customerName ? `
            <div class="hr"></div>
            <div>Cust: ${invoice.customerName}</div>
            ${invoice.customerPhone ? `<div>Tel : ${invoice.customerPhone}</div>` : ''}
            ${invoice.customerVatNumber ? `<div>VAT : ${invoice.customerVatNumber}</div>` : ''}
            ` : ''}

            <div class="hr"></div>

            <!-- Items Header (Simple) -->
            <div class="row" style="margin-bottom: 3px; font-size: 10px; font-weight: bold; text-decoration: underline;">
                <span style="flex:2">ITEM</span>
                <span style="flex:1; text-align:right">TOTAL</span>
            </div>

            <!-- Items -->
            ${invoice.items.map(item => `
            <div class="item-line">
                <div class="item-name">${item.name}</div>
                ${item.nameAr ? `<div style="font-size: 10px; margin-bottom:1px;">${item.nameAr}</div>` : ''}
                <div class="item-meta">
                    <span class="item-calc">${item.quantity} x ${Number(item.price).toFixed(2)}</span>
                    <span>${Number(item.total).toFixed(2)}</span>
                </div>
            </div>
            `).join('')}

            <div class="hr"></div>

            <!-- Totals -->
            <div class="totals-row">
                <span>Subtotal</span>
                <span>${Number(invoice.subTotal).toFixed(2)}</span>
            </div>
            
            ${invoice.discountAmount > 0 ? `
            <div class="totals-row">
                <span>Discount</span>
                <span>-${Number(invoice.discountAmount).toFixed(2)}</span>
            </div>` : ''}

            <div class="totals-row">
                <span>VAT (15%)</span>
                <span>${Number(invoice.taxAmount).toFixed(2)}</span>
            </div>

            <div class="row grand-total">
                <span>TOTAL</span>
                <span>${appSettings.currency} ${Number(invoice.grandTotal).toFixed(2)}</span>
            </div>

            <div class="totals-row" style="font-size: 11px;">
                <span>Paid</span>
                <span>${Number(invoice.paidAmount || invoice.grandTotal).toFixed(2)}</span>
            </div>

            ${(invoice.remainingAmount || 0) > 0 ? `
            <div class="totals-row" style="font-weight:bold;">
                <span>Balance Due</span>
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

    // 3. Print (HTML Fallback or A4)
    await printContent(html, {
        selectedPrinter: printerName,
        silent: true,
        pageSize: pageSize,
        copies: 1
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
    payment: { amount: number, date: Date, mode: string, note?: string, id?: number },
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
    payment: { amount: number, date: Date, mode: string, note?: string, id?: number },
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

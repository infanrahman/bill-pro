
import type { Invoice, Purchase } from "../services/db";
import { format } from "date-fns";

export const generateInvoiceText = (
    data: Invoice | Purchase,
    type: 'invoice' | 'purchase',
    businessDetails: any,
    title?: string
): string => {
    const isInvoice = type === 'invoice';
    const refNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Purchase).orderNumber;
    const date = isInvoice ? (data as Invoice).createdAt : (data as Purchase).date;
    const items = data.items;

    let text = `*${businessDetails?.name || 'Business Name'}*\n`;
    text += `${businessDetails?.address || ''}\n`;
    text += `${businessDetails?.phone || ''}\n`;
    text += `--------------------------------\n`;

    const displayTitle = title || (type === 'invoice' ? 'Receipt' : 'Bill');
    text += `*${displayTitle} #${refNumber}*\n`;
    text += `Date: ${format(new Date(date), 'dd/MM/yyyy')}\n`;

    if (isInvoice) {
        text += `Customer: ${(data as Invoice).customerName || 'Walk-in'}\n`;
    } else {
        text += `Supplier: ${(data as Purchase).supplierName}\n`;
    }

    text += `--------------------------------\n`;

    items.forEach((item: any, index: number) => {
        const total = item.quantity * (item.price || item.cost);
        text += `${index + 1}. ${item.name} x ${item.quantity} = ${total.toFixed(2)}\n`;
    });

    text += `--------------------------------\n`;

    if (type === 'invoice') {
        const inv = data as Invoice;
        text += `Subtotal: ${inv.subTotal.toFixed(2)}\n`;
        if (inv.taxAmount > 0) text += `Tax: ${inv.taxAmount.toFixed(2)}\n`;
        if (inv.discountAmount > 0) text += `Discount: ${inv.discountAmount.toFixed(2)}\n`;
        text += `*Grand Total: ${inv.grandTotal.toFixed(2)}*\n`;

        if (inv.remainingAmount > 0) {
            text += `Paid: ${inv.paidAmount.toFixed(2)}\n`;
            text += `Balance Due: ${inv.remainingAmount.toFixed(2)}\n`;
        }
    } else {
        const pur = data as Purchase;
        text += `Total: ${pur.totalAmount.toFixed(2)}\n`;
        const paid = pur.paidAmount || 0;
        if (paid > 0) {
            text += `Paid: ${paid.toFixed(2)}\n`;
            text += `Balance: ${(pur.totalAmount - paid).toFixed(2)}\n`;
        }
    }

    text += `\nThank you for your business!\n`;

    // Add Business Email/Contact at bottom if requested
    if (businessDetails?.email) {
        text += `Email: ${businessDetails.email}`;
    }

    return text;
};

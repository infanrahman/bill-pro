import { type Invoice, type Customer } from './db';

interface WhatsAppConfig {
 enabled: boolean;
 provider: 'ultramsg' | 'twilio' | 'custom';
 apiKey?: string;
 instanceId?: string; // For UltraMsg
 template?: string;
 portalUrl?: string;
}

export const messagingService = {
 getWhatsAppConfig(): WhatsAppConfig {
 const saved = localStorage.getItem('whatsapp_config');
 return saved ? JSON.parse(saved) : { enabled: false, provider: 'ultramsg' };
 },

 saveWhatsAppConfig(config: WhatsAppConfig) {
 localStorage.setItem('whatsapp_config', JSON.stringify(config));
 },

 async sendThankYouMessage(invoice: Invoice, customer: Customer) {
 const config = this.getWhatsAppConfig();
 if (!config.enabled || !customer.phone) return;

 const portalUrl = config.portalUrl || 'https://portal.billpro.app';
 const invoiceLink =`${portalUrl}/view/${invoice.id}`;

 const message =`*Thank you for shopping with us, ${customer.name}!*\n\n`+
`Your order *#${invoice.invoiceNumber}* for *${invoice.grandTotal}* has been confirmed.\n`+
`You earned *${Math.floor(invoice.grandTotal)}* loyalty points. Your total points: *${(customer.loyaltyPoints || 0) + Math.floor(invoice.grandTotal)}*.\n\n`+
`View your digital receipt here: ${invoiceLink}\n\n`+
`See you again soon!`;

 try {
 if (config.provider === 'ultramsg' && config.apiKey && config.instanceId) {
 const url =`https://api.ultramsg.com/${config.instanceId}/messages/chat`;
 const params = new URLSearchParams();
 params.append('token', config.apiKey);
 params.append('to', customer.phone);
 params.append('body', message);

 await fetch(url, {
 method: 'POST',
 body: params
 });
 console.log('WhatsApp message sent via UltraMsg');
 } else {
 // Manual fallback if no API is configured but enabled
 // This would still require user interaction, so we just log it for now
 console.warn('WhatsApp API not fully configured');
 }
 } catch (error) {
 console.error('Failed to send WhatsApp message', error);
 }
 }
};

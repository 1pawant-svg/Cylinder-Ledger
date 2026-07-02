import { Customer, Setting } from '@/lib/types';

/**
 * Generates a reminder message for a customer based on their balance.
 */
export function generateReminderMessage(customer: Customer, settings: Setting | null): string {
  const businessName = settings?.businessName || 'PGS Cylinder Ledger';
  const toReceive = customer.balance > 0 ? customer.balance : 0;
  const toGive = customer.balance < 0 ? Math.abs(customer.balance) : 0;

  return `Hello ${customer.name},

According to our records:

To Receive: ${toReceive} Cylinders
To Give: ${toGive} Cylinders

Please settle the pending cylinders at your earliest convenience.

Thank you,
${businessName}`;
}

/**
 * Formats a phone number for WhatsApp (with 977 prefix for Nepal if 10 digits)
 */
export function formatPhoneNumberForWhatsApp(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return clean.length === 10 ? `977${clean}` : clean;
}

/**
 * Opens WhatsApp with a pre-filled message
 */
export function openWhatsAppReminder(phone: string, message: string) {
  const formattedPhone = formatPhoneNumberForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  window.open(url, '_blank');
}

/**
 * Opens the native SMS app with a pre-filled message
 */
export function openSMSReminder(phone: string, message: string) {
  const encodedMessage = encodeURIComponent(message);
  const url = `sms:${phone}?body=${encodedMessage}`;
  window.location.href = url;
}

import axios from 'axios';
import { WhatsAppConfig } from '../models/WhatsApp.js';

/**
 * Restaurant WhatsApp Service
 * Sends automated WhatsApp messages for restaurant events:
 * - Restaurant opened notification
 * - Order placed confirmation
 * - Order ready notification
 * - Order served notification
 */

function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) return '966' + digits.slice(1);
  if (digits.length === 9) return '966' + digits;
  return digits;
}

async function getTenantWhatsAppConfig(tenantId) {
  return WhatsAppConfig.findOne({ tenantId, isActive: true });
}

function applyReplacements(text, replacements = {}) {
  if (!text) return '';
  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value || ''));
  }
  return result;
}

/**
 * Send a WhatsApp message to a customer or notification list.
 * Uses the tenant's WhatsApp Business API config.
 */
export async function sendRestaurantWhatsApp({ tenantId, phone, messageEn, messageAr, replacements = {} }) {
  const config = await getTenantWhatsAppConfig(tenantId);
  if (!config || !config.accessToken || !config.phoneNumberId) {
    return { sent: false, reason: 'WhatsApp not configured' };
  }

  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) {
    return { sent: false, reason: 'No valid phone number' };
  }

  // Use Arabic message if the tenant's default language is Arabic, otherwise English
  const lang = config.businessHours?.language || 'ar';
  const rawMessage = lang === 'ar' ? (messageAr || messageEn) : (messageEn || messageAr);
  const text = applyReplacements(rawMessage, replacements);

  if (!text) {
    return { sent: false, reason: 'No message content' };
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'text',
    text: { body: text },
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return { sent: true, messageId: response.data?.messages?.[0]?.id };
}

/**
 * Send "restaurant opened" WhatsApp notification to all phones in the notify list.
 * Called by the cron job when the restaurant opens.
 */
export async function sendRestaurantOpenNotification(tenantId) {
  const Tenant = (await import('../models/Tenant.js')).default;
  const tenant = await Tenant.findById(tenantId).select('settings.restaurant.whatsapp settings.restaurant.openingTime settings.restaurant.closingTime settings.language');

  const wa = tenant?.settings?.restaurant?.whatsapp;
  if (!wa?.autoSendEnabled || !wa?.autoSendOnOpen) {
    return { sent: false, reason: 'Auto-send on open is disabled' };
  }

  // Only send once per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (wa.lastOpenNotificationSent && wa.lastOpenNotificationSent >= today) {
    return { sent: false, reason: 'Already sent today' };
  }

  const phones = Array.isArray(wa.notifyPhoneList) ? wa.notifyPhoneList : [];
  if (phones.length === 0) {
    return { sent: false, reason: 'No notification phones configured' };
  }

  const results = [];
  for (const phone of phones) {
    try {
      const result = await sendRestaurantWhatsApp({
        tenantId,
        phone,
        messageEn: wa.openMessageEn,
        messageAr: wa.openMessageAr,
        replacements: {},
      });
      results.push({ phone, ...result });
    } catch (err) {
      results.push({ phone, sent: false, error: err.message });
    }
  }

  // Update lastOpenNotificationSent
  await Tenant.updateOne(
    { _id: tenantId },
    { 'settings.restaurant.whatsapp.lastOpenNotificationSent': new Date() }
  );

  return { sent: true, results };
}

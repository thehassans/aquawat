import logger from './logger.js';
import SystemSettings from '../models/SystemSettings.js';

const EVENT_FLAG = {
  invoice_created: 'invoiceCreated',
  invoice_paid: 'invoicePaid',
  invoice_signed: 'invoiceSigned',
  subscription_started: 'subscriptionStarted',
  subscription_renewed: 'subscriptionRenewed',
  subscription_canceled: 'subscriptionCanceled',
  trial_converted: 'trialConverted',
  first_invoice_within_7d: 'firstInvoiceWithin7d',
  sign_up: 'signUp',
  login: 'login',
};

let cachedSettings = null;
let cachedAt = 0;
const SETTINGS_TTL_MS = 60_000;

async function getAnalyticsSettings() {
  if (cachedSettings && Date.now() - cachedAt < SETTINGS_TTL_MS) return cachedSettings;
  try {
    const doc = await SystemSettings.findOne({ key: 'global' }).select('analytics').lean();
    cachedSettings = doc?.analytics || {};
    cachedAt = Date.now();
  } catch {
    cachedSettings = cachedSettings || {};
  }
  return cachedSettings;
}

function isEventEnabled(analytics, eventName) {
  if (analytics?.enabled !== true) return false;
  const flag = EVENT_FLAG[eventName];
  if (!flag) return true;
  const track = analytics.trackEvents || {};
  return track[flag] !== false;
}

/**
 * Backend source of truth for product analytics.
 * Always logs; POSTs to the configured endpoint when analytics is enabled.
 */
export function emitPlatformEvent(eventName, properties = {}) {
  const payload = {
    event: eventName,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
      platform: 'api',
    },
  };

  logger.info({ message: 'platform_event', event: eventName, ...properties });

  Promise.resolve()
    .then(async () => {
      const analytics = await getAnalyticsSettings();
      if (!isEventEnabled(analytics, eventName)) return;
      if (!analytics.endpoint || !analytics.apiKey) return;

      await fetch(analytics.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${analytics.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    })
    .catch((error) => {
      logger.warn(`[platformEvents] ${eventName} failed: ${error.message}`);
    });
}

export function invoiceEventProps(invoice, extra = {}) {
  return {
    tenantId: invoice?.tenantId ? String(invoice.tenantId) : undefined,
    invoiceId: invoice?._id ? String(invoice._id) : undefined,
    invoiceNumber: invoice?.invoiceNumber,
    flow: invoice?.flow,
    status: invoice?.status,
    paymentStatus: invoice?.paymentStatus,
    grandTotal: Number(invoice?.grandTotal) || 0,
    currency: invoice?.currency || 'SAR',
    ...extra,
  };
}

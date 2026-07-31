import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import multer from 'multer';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import TravelBooking from '../models/TravelBooking.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import EmailMessage from '../models/EmailMessage.js';
import Employee from '../models/Employee.js';
import SystemSettings, { getDefaultPricingPlans, getDefaultPlansByBusinessType } from '../models/SystemSettings.js';
import Expense from '../models/Expense.js';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import RestaurantMenuItem from '../models/RestaurantMenuItem.js';
import Supplier from '../models/Supplier.js';
import Warehouse from '../models/Warehouse.js';
import Shipment from '../models/Shipment.js';
import VatReturn from '../models/VatReturn.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Payroll from '../models/Payroll.js';
import JobCostEntry from '../models/JobCostEntry.js';
import JobCostingJob from '../models/JobCostingJob.js';
import LeadQuery from '../models/LeadQuery.js';
import Quotation from '../models/Quotation.js';
import DeliveryNote from '../models/DeliveryNote.js';
import ReportSchedule from '../models/ReportSchedule.js';
import DemoUser from '../models/DemoUser.js';
import IoTDevice from '../models/IoTDevice.js';
import IoTReading from '../models/IoTReading.js';
import {
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppTemplate,
  QuickReply,
  Broadcast,
} from '../models/WhatsApp.js';
import { protect, authorize } from '../middleware/auth.js';
import { getPrimaryBusinessType, normalizeBusinessTypes, BUSINESS_TYPES } from '../utils/businessTypes.js';
import { sendTenantWelcomeEmail } from '../utils/emailService.js';
import { verifyEmailDeliveryConnection, sendEmailWithConfig } from '../utils/emailProviderService.js';
import { resolvePeriodDates, buildTenantBackup } from '../utils/tenantBackupService.js';
import { sendTenantOnboardingEmail } from '../utils/emailService.js';
import { buildEmailShell } from '../utils/tenantEmailService.js';
import whatsappService from '../services/whatsappService.js';
import { generateTermsPdf } from '../utils/termsPdf.js';

const router = express.Router();
const parsedDatabaseQueryTimeoutMs = Number(process.env.MONGODB_QUERY_TIMEOUT_MS || 10000);
const databaseQueryTimeoutMs = Number.isFinite(parsedDatabaseQueryTimeoutMs) && parsedDatabaseQueryTimeoutMs > 0 ? parsedDatabaseQueryTimeoutMs : 10000;

const withQueryTimeout = (query) => query.maxTimeMS(databaseQueryTimeoutMs);

const isDatabaseAvailabilityError = (error) => {
  const message = String(error?.message || '').toLowerCase();

  return message.includes('buffering timed out')
    || message.includes('timed out after')
    || message.includes('server selection')
    || message.includes('ecconnrefused')
    || message.includes('not connected')
    || message.includes('initial connection')
    || message.includes('topology is closed')
    || message.includes('client must be connected');
};

const sendRouteError = (res, error) => {
  if (isDatabaseAvailabilityError(error)) {
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again in a moment.' });
  }

  return res.status(500).json({ error: error.message });
};

router.use(protect);
router.use(authorize('super_admin'));

const getGlobalSettings = async () => {
  const existing = await SystemSettings.findOne({ key: 'global' });
  if (existing) {
    if (!existing.website) {
      existing.website = {};
      existing.markModified('website');
      await existing.save();
    }
    return existing;
  }
  return SystemSettings.create({ key: 'global', website: {} });
};

const maskApiKey = (key) => {
  if (!key) return '';
  const k = String(key);
  if (k.length <= 8) return `${k.slice(0, 2)}***${k.slice(-2)}`;
  return `${k.slice(0, 4)}***${k.slice(-4)}`;
};

const maskSecret = (value) => {
  if (!value) return '';
  const v = String(value);
  if (v.length <= 4) return '****';
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
};

const mergeWebsiteDefaults = (website) => {
  const defaultsDoc = new SystemSettings({ key: 'global' });
  const defaults = defaultsDoc.website?.toObject?.() || defaultsDoc.website || {};
  const current = website?.toObject?.() || website || {};
  const currentPlans = current.pricing?.plans;
  const hasPlans = Array.isArray(currentPlans) && currentPlans.length > 0;
  const currentPlansByBusinessType = current.pricing?.plansByBusinessType;
  const hasPlansByBusinessType = Array.isArray(currentPlansByBusinessType);

  const existingMap = new Map((hasPlansByBusinessType ? currentPlansByBusinessType : []).map((p) => [p.businessType, p]));
  const mergedPlansByBusinessType = BUSINESS_TYPES.map((type) => {
    if (existingMap.has(type)) return existingMap.get(type);
    return { businessType: type, plans: getDefaultPlansByBusinessType(type) };
  });

  return {
    ...defaults,
    ...current,
    hero: { ...(defaults.hero || {}), ...(current.hero || {}) },
    cta: { ...(defaults.cta || {}), ...(current.cta || {}) },
    demo: { ...(defaults.demo || {}), ...(current.demo || {}) },
    pricing: {
      ...(defaults.pricing || {}),
      ...(current.pricing || {}),
      plans: hasPlans ? currentPlans : getDefaultPricingPlans(),
      plansByBusinessType: mergedPlansByBusinessType
    }
  };
};

const mergeIdentityDefaults = (identity) => {
  const defaultsDoc = new SystemSettings({ key: 'global', identity: {} });
  const defaults = defaultsDoc.identity?.toObject?.() || defaultsDoc.identity || {};
  const current = identity?.toObject?.() || identity || {};
  return {
    ...defaults,
    ...current,
  };
};

const serializeIdentitySettings = (identity) => ({
  ...identity,
  apiKey: '',
  hasApiKey: !!identity?.apiKey,
  apiKeyMasked: maskSecret(identity?.apiKey),
});

const mergeEmailDefaults = (email) => {
  const defaultsDoc = new SystemSettings({ key: 'global', website: {}, email: {} });
  const defaults = defaultsDoc.email?.toObject?.() || defaultsDoc.email || {};
  const current = email?.toObject?.() || email || {};
  return {
    ...defaults,
    ...current,
    templates: {
      ...(defaults.templates || {}),
      ...(current.templates || {}),
      tenantCreated: {
        ...(defaults.templates?.tenantCreated || {}),
        ...(current.templates?.tenantCreated || {})
      },
      invoice: {
        ...(defaults.templates?.invoice || {}),
        ...(current.templates?.invoice || {})
      }
    }
  };
};

const serializeEmailSettings = (email) => ({
  ...email,
  smtpPass: '',
  hasSmtpPass: !!email?.smtpPass,
  smtpPassMasked: maskSecret(email?.smtpPass),
  brevoApiKey: '',
  hasBrevoApiKey: !!email?.brevoApiKey,
  brevoApiKeyMasked: maskSecret(email?.brevoApiKey)
});

const normalizeTenantPlatformProvider = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'brevo') return 'brevo';
  if (normalized === 'smtp' || normalized === 'platform' || normalized === 'internal_platform' || normalized === 'internal') {
    return 'platform';
  }
  return 'platform';
};

const mergeGlobalEmailPayload = ({ settings, payload = {} }) => {
  const currentEmail = mergeEmailDefaults(settings?.email);

  const nextEmail = {
    ...currentEmail,
    ...payload,
    templates: {
      ...(currentEmail.templates || {}),
      ...(payload.templates || {}),
      tenantCreated: {
        ...(currentEmail.templates?.tenantCreated || {}),
        ...(payload.templates?.tenantCreated || {})
      },
      invoice: {
        ...(currentEmail.templates?.invoice || {}),
        ...(payload.templates?.invoice || {})
      }
    }
  };

  if (payload.smtpPass !== undefined) {
    const trimmedPassword = String(payload.smtpPass || '').trim();
    nextEmail.smtpPass = trimmedPassword || currentEmail.smtpPass || '';
  }

  if (payload.brevoApiKey !== undefined) {
    const trimmedApiKey = String(payload.brevoApiKey || '').trim();
    nextEmail.brevoApiKey = trimmedApiKey || currentEmail.brevoApiKey || '';
  }

  return nextEmail;
};

const resolveGlobalEmailTransportConfig = ({ settings, payload = {} }) => {
  const nextEmail = mergeGlobalEmailPayload({ settings, payload });
  const website = settings?.website?.toObject?.() || settings?.website || {};
  const smtpPort = Number(nextEmail.smtpPort || 587);

  return {
    email: nextEmail,
    config: {
      enabled: nextEmail.enabled === true,
      provider: String(nextEmail.provider || 'smtp').trim() || 'smtp',
      host: String(nextEmail.smtpHost || '').trim(),
      port: Number.isFinite(smtpPort) ? smtpPort : 587,
      secure: nextEmail.smtpSecure === true,
      user: String(nextEmail.smtpUser || '').trim(),
      pass: String(nextEmail.smtpPass || '').trim(),
      brevoApiKey: String(nextEmail.brevoApiKey || '').trim(),
      fromName: String(nextEmail.fromName || website.brandName || 'Maqder ERP').trim(),
      fromEmail: String(nextEmail.fromEmail || nextEmail.smtpUser || '').trim(),
      replyTo: String(nextEmail.replyTo || website.contactEmail || '').trim(),
      brandName: String(website.brandName || 'Maqder ERP').trim(),
    }
  };
};

const serializeTenantForSuperAdmin = (tenant) => {
  const serializedTenant = tenant?.toObject?.() || tenant;
  const currentSettings = serializedTenant?.settings || {};
  const currentCommunication = currentSettings.communication || {};
  const currentEmail = currentCommunication.email || {};
  const serializedEmail = {
    ...currentEmail,
    platformProvider: normalizeTenantPlatformProvider(currentEmail?.platformProvider),
  };

  return {
    ...serializedTenant,
    settings: {
      ...currentSettings,
      communication: {
        ...currentCommunication,
        email: serializeEmailSettings(serializedEmail)
      }
    }
  };
};

const mergeTenantEmailSettings = ({ existingTenant, incomingSettings }) => {
  const currentSettings = existingTenant?.settings?.toObject?.() || existingTenant?.settings || {};
  if (!incomingSettings) {
    return currentSettings;
  }

  const currentCommunication = currentSettings.communication || {};
  const currentEmail = currentCommunication.email || {};
  const incomingCommunication = incomingSettings.communication || {};
  const hasIncomingEmail = Object.prototype.hasOwnProperty.call(incomingCommunication, 'email');
  const incomingEmail = hasIncomingEmail ? (incomingCommunication.email || {}) : null;

  let nextEmail = currentEmail;
  if (hasIncomingEmail) {
    nextEmail = {
      ...currentEmail,
      ...incomingEmail,
      enabled: incomingEmail?.enabled !== undefined ? incomingEmail.enabled === true : currentEmail.enabled,
      autoSendInvoices: incomingEmail?.autoSendInvoices !== undefined ? incomingEmail.autoSendInvoices === true : currentEmail.autoSendInvoices,
      smtpSecure: incomingEmail?.smtpSecure !== undefined ? incomingEmail.smtpSecure === true : currentEmail.smtpSecure,
      smtpPort: incomingEmail?.smtpPort !== undefined ? Number(incomingEmail.smtpPort || 587) : currentEmail.smtpPort,
      platformProvider: normalizeTenantPlatformProvider(incomingEmail?.platformProvider ?? currentEmail?.platformProvider),
    };

    if (incomingEmail && Object.prototype.hasOwnProperty.call(incomingEmail, 'smtpPass')) {
      const trimmedPassword = String(incomingEmail.smtpPass || '').trim();
      nextEmail.smtpPass = trimmedPassword || currentEmail.smtpPass || '';
    }

    delete nextEmail.hasSmtpPass;
    delete nextEmail.smtpPassMasked;
    nextEmail.inboundAddress = String(nextEmail.inboundAddress || `${existingTenant.slug}@inbound.maqder.local`).trim().toLowerCase();
  }

  const nextCommunication = {
    ...currentCommunication,
    ...incomingCommunication,
    ...(hasIncomingEmail ? { email: nextEmail } : {}),
  };

  return {
    ...currentSettings,
    ...incomingSettings,
    communication: nextCommunication,
    invoiceBranding: {
      ...(currentSettings.invoiceBranding || {}),
      ...(incomingSettings.invoiceBranding || {})
    }
  };
};

// @route   GET /api/super-admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await Promise.all([
      Tenant.countDocuments({ isActive: true }),
      Tenant.countDocuments({ 'subscription.status': 'active' }),
      User.countDocuments({ isActive: true }),
      Invoice.aggregate([
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
      ])
    ]);
    
    const recentTenants = await Tenant.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name slug business.legalNameEn subscription createdAt');
    
    const subscriptionStats = await Tenant.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
    ]);
    
    const monthlyRevenue = await Tenant.aggregate([
      { $match: { 'subscription.status': 'active' } },
      { $group: { _id: '$subscription.plan', total: { $sum: '$subscription.price' }, count: { $sum: 1 } } }
    ]);
    
    res.json({
      totalTenants: stats[0],
      activeSubscriptions: stats[1],
      totalUsers: stats[2],
      invoiceStats: stats[3][0] || { total: 0, count: 0 },
      recentTenants,
      subscriptionStats,
      monthlyRevenue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/settings/website', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    const website = mergeWebsiteDefaults(settings.website);
    res.json({
      website: {
        ...website,
        demo: {
          ...(website.demo?.toObject?.() || website.demo || {}),
          password: '',
          hasPassword: !!website?.demo?.password,
          passwordMasked: maskSecret(website?.demo?.password)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/website', async (req, res) => {
  try {
    const payload = req.body?.website || req.body || {};
    const settings = await getGlobalSettings();
    const currentWebsite = mergeWebsiteDefaults(settings.website);

    const nextWebsite = {
      ...currentWebsite,
      ...payload,
      hero: {
        ...(currentWebsite.hero || {}),
        ...(payload.hero || {})
      },
      cta: {
        ...(currentWebsite.cta || {}),
        ...(payload.cta || {})
      },
      pricing: {
        ...(currentWebsite.pricing || {}),
        ...(payload.pricing || {})
      },
      demo: {
        ...(currentWebsite.demo || {}),
        ...(payload.demo || {})
      }
    };

    const nextDemo = { ...(nextWebsite.demo || {}) };
    if (payload?.demo && Object.prototype.hasOwnProperty.call(payload.demo, 'password')) {
      const trimmed = String(payload.demo.password || '').trim();
      if (trimmed) {
        nextDemo.password = trimmed;
      } else {
        nextDemo.password = currentWebsite?.demo?.password;
      }
    }
    nextWebsite.demo = nextDemo;

    settings.website = nextWebsite;
    settings.markModified('website');
    await settings.save();

    const website = mergeWebsiteDefaults(settings.website);
    res.json({
      website: {
        ...website,
        demo: {
          ...(website.demo?.toObject?.() || website.demo || {}),
          password: '',
          hasPassword: !!website?.demo?.password,
          passwordMasked: maskSecret(website?.demo?.password)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/settings/pricing-defaults', async (req, res) => {
  try {
    const businessType = normalizeBusinessTypes(req.query.businessType)[0] || 'trading';
    const plans = getDefaultPlansByBusinessType(businessType);
    res.json({ businessType, plans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/settings/email', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    const email = mergeEmailDefaults(settings.email);
    res.json({ email: serializeEmailSettings(email) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/email', async (req, res) => {
  try {
    const payload = req.body?.email || req.body || {};
    const settings = await getGlobalSettings();
    const { email: nextEmail } = resolveGlobalEmailTransportConfig({ settings, payload });

    settings.email = nextEmail;
    settings.markModified('email');
    await settings.save();

    res.json({ email: serializeEmailSettings(mergeEmailDefaults(settings.email)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/email/test-connection', async (req, res) => {
  try {
    const payload = req.body?.email || req.body || {};
    const settings = await getGlobalSettings();
    const { config } = resolveGlobalEmailTransportConfig({ settings, payload });
    const result = await verifyEmailDeliveryConnection(config);

    res.json({
      connected: true,
      message: `${String(result.provider || config.provider || 'smtp').toUpperCase()} connection verified successfully`,
      provider: result.provider || config.provider,
      host: result.host || config.host,
      port: result.port || config.port,
      secure: result.secure ?? config.secure,
      accountEmail: result.accountEmail || '',
      fromEmail: result.fromEmail || config.fromEmail,
      fromName: result.fromName || config.fromName,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to verify mail connection' });
  }
});

router.get('/settings/identity', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    const identity = mergeIdentityDefaults(settings.identity);
    res.json({ identity: serializeIdentitySettings(identity) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/identity', async (req, res) => {
  try {
    const payload = req.body?.identity || req.body || {};
    const settings = await getGlobalSettings();
    const currentIdentity = mergeIdentityDefaults(settings.identity);

    const nextIdentity = {
      ...currentIdentity,
      ...payload,
      enabled: payload.enabled !== undefined ? payload.enabled === true : currentIdentity.enabled,
      ocrEnabled: payload.ocrEnabled !== undefined ? payload.ocrEnabled === true : currentIdentity.ocrEnabled,
      provider: String(payload.provider || currentIdentity.provider || 'custom_webhook').trim() || 'custom_webhook',
      endpoint: String(payload.endpoint || currentIdentity.endpoint || '').trim(),
    };

    if (payload.apiKey !== undefined) {
      const trimmedApiKey = String(payload.apiKey || '').trim();
      nextIdentity.apiKey = trimmedApiKey || currentIdentity.apiKey || '';
    }

    settings.identity = nextIdentity;
    settings.markModified('identity');
    await settings.save();

    res.json({ identity: serializeIdentitySettings(mergeIdentityDefaults(settings.identity)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/settings/ai', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    const deprecatedGroqModels = ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 'llama-3.2-1b-preview', 'llama-3.2-3b-preview'];
    let groqModel = settings.groq?.model || 'llama-3.1-8b-instant';
    if (!groqModel || deprecatedGroqModels.includes(groqModel)) groqModel = 'llama-3.1-8b-instant';
    res.json({
      gemini: {
        enabled: settings.gemini?.enabled !== false,
        model: settings.gemini?.model || 'gemini-2.5-flash',
        hasApiKey: !!settings.gemini?.apiKey,
        apiKeyMasked: maskApiKey(settings.gemini?.apiKey)
      },
      openai: {
        enabled: settings.openai?.enabled !== false,
        model: settings.openai?.model || 'gpt-4o-mini',
        hasApiKey: !!settings.openai?.apiKey,
        apiKeyMasked: maskApiKey(settings.openai?.apiKey)
      },
      grok: {
        enabled: settings.grok?.enabled !== false,
        model: settings.grok?.model || 'grok-2-latest',
        hasApiKey: !!settings.grok?.apiKey,
        apiKeyMasked: maskApiKey(settings.grok?.apiKey)
      },
      groq: {
        enabled: settings.groq?.enabled !== false,
        model: groqModel,
        hasApiKey: !!settings.groq?.apiKey,
        apiKeyMasked: maskApiKey(settings.groq?.apiKey)
      },
      glmOcr: {
        enabled: settings.glmOcr?.enabled !== false,
        baseURL: settings.glmOcr?.baseURL || 'http://localhost:8000/v1',
        model: settings.glmOcr?.model || 'glm-ocr',
        hasApiKey: !!settings.glmOcr?.apiKey,
        apiKeyMasked: maskApiKey(settings.glmOcr?.apiKey)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/ai', async (req, res) => {
  try {
    const { gemini, openai, grok, groq, glmOcr } = req.body || {};

    const settings = await getGlobalSettings();
    
    if (gemini) {
      const nextGemini = {
        ...(settings.gemini?.toObject?.() || settings.gemini || {}),
        model: (gemini.model || settings.gemini?.model || 'gemini-2.5-flash').trim(),
        enabled: gemini.enabled !== undefined ? gemini.enabled : settings.gemini?.enabled
      };
      if (gemini.apiKey !== undefined) {
        const trimmed = String(gemini.apiKey || '').trim();
        if (trimmed) nextGemini.apiKey = trimmed;
      }
      settings.gemini = nextGemini;
    }

    if (openai) {
      const nextOpenAI = {
        ...(settings.openai?.toObject?.() || settings.openai || {}),
        model: (openai.model || settings.openai?.model || 'gpt-4o-mini').trim(),
        enabled: openai.enabled !== undefined ? openai.enabled : settings.openai?.enabled
      };
      if (openai.apiKey !== undefined) {
        const trimmed = String(openai.apiKey || '').trim();
        if (trimmed) nextOpenAI.apiKey = trimmed;
      }
      settings.openai = nextOpenAI;
    }

    if (grok) {
      const nextGrok = {
        ...(settings.grok?.toObject?.() || settings.grok || {}),
        model: (grok.model || settings.grok?.model || 'grok-2-latest').trim(),
        enabled: grok.enabled !== undefined ? grok.enabled : settings.grok?.enabled
      };
      if (grok.apiKey !== undefined) {
        const trimmed = String(grok.apiKey || '').trim();
        if (trimmed) nextGrok.apiKey = trimmed;
      }
      settings.grok = nextGrok;
    }

    if (groq) {
      const deprecatedGroqModels = ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 'llama-3.2-1b-preview', 'llama-3.2-3b-preview'];
      let groqModel = (groq.model || settings.groq?.model || 'llama-3.1-8b-instant').trim();
      if (!groqModel || deprecatedGroqModels.includes(groqModel)) groqModel = 'llama-3.1-8b-instant';
      const nextGroq = {
        ...(settings.groq?.toObject?.() || settings.groq || {}),
        model: groqModel,
        enabled: groq.enabled !== undefined ? groq.enabled : settings.groq?.enabled
      };
      if (groq.apiKey !== undefined) {
        const trimmed = String(groq.apiKey || '').trim();
        if (trimmed) nextGroq.apiKey = trimmed;
      }
      settings.groq = nextGroq;
    }

    if (glmOcr) {
      const nextGlmOcr = {
        ...(settings.glmOcr?.toObject?.() || settings.glmOcr || {}),
        model: (glmOcr.model || settings.glmOcr?.model || 'glm-ocr').trim(),
        baseURL: (glmOcr.baseURL || settings.glmOcr?.baseURL || 'http://localhost:8000/v1').trim(),
        enabled: glmOcr.enabled !== undefined ? glmOcr.enabled : settings.glmOcr?.enabled
      };
      if (glmOcr.apiKey !== undefined) {
        const trimmed = String(glmOcr.apiKey || '').trim();
        if (trimmed) nextGlmOcr.apiKey = trimmed;
      }
      settings.glmOcr = nextGlmOcr;
    }

    settings.markModified('gemini');
    settings.markModified('openai');
    settings.markModified('grok');
    settings.markModified('groq');
    settings.markModified('glmOcr');
    await settings.save();

    res.json({
      gemini: {
        enabled: settings.gemini?.enabled !== false,
        model: settings.gemini?.model || 'gemini-2.5-flash',
        hasApiKey: !!settings.gemini?.apiKey,
        apiKeyMasked: maskApiKey(settings.gemini?.apiKey)
      },
      openai: {
        enabled: settings.openai?.enabled !== false,
        model: settings.openai?.model || 'gpt-4o-mini',
        hasApiKey: !!settings.openai?.apiKey,
        apiKeyMasked: maskApiKey(settings.openai?.apiKey)
      },
      grok: {
        enabled: settings.grok?.enabled !== false,
        model: settings.grok?.model || 'grok-2-latest',
        hasApiKey: !!settings.grok?.apiKey,
        apiKeyMasked: maskApiKey(settings.grok?.apiKey)
      },
      groq: {
        enabled: settings.groq?.enabled !== false,
        model: settings.groq?.model || 'llama-3.1-8b-instant',
        hasApiKey: !!settings.groq?.apiKey,
        apiKeyMasked: maskApiKey(settings.groq?.apiKey)
      },
      glmOcr: {
        enabled: settings.glmOcr?.enabled !== false,
        model: settings.glmOcr?.model || 'glm-ocr',
        baseURL: settings.glmOcr?.baseURL || 'http://localhost:8000/v1',
        hasApiKey: !!settings.glmOcr?.apiKey,
        apiKeyMasked: maskApiKey(settings.glmOcr?.apiKey)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/ai/test', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    const settings = await getGlobalSettings();
    
    let activeKey = apiKey;
    if (!activeKey) {
      if (provider === 'gemini') activeKey = settings.gemini?.apiKey;
      if (provider === 'openai') activeKey = settings.openai?.apiKey;
      if (provider === 'grok') activeKey = settings.grok?.apiKey;
      if (provider === 'groq') activeKey = settings.groq?.apiKey;
      if (provider === 'glmOcr') activeKey = settings.glmOcr?.apiKey || 'EMPTY';
    }

    if (!activeKey) {
      return res.status(400).json({ error: `${provider} API key is missing` });
    }

    let text = '';
    let model = '';

    if (provider === 'gemini') {
      model = settings.gemini?.model || 'gemini-2.5-flash';
      const client = new GoogleGenAI({ apiKey: activeKey });
      const response = await client.models.generateContent({
        model,
        contents: "Explain how AI works in a few words",
      });
      text = response?.text || '';
    } else if (provider === 'openai') {
      model = settings.openai?.model || 'gpt-4o-mini';
      const client = new OpenAI({ apiKey: activeKey });
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: "Explain how AI works in a few words" }],
        max_tokens: 50,
      });
      text = response.choices?.[0]?.message?.content || '';
    } else if (provider === 'grok') {
      model = settings.grok?.model || 'grok-2-latest';
      const client = new OpenAI({ apiKey: activeKey, baseURL: "https://api.x.ai/v1" });
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: "Explain how AI works in a few words" }],
        max_tokens: 50,
      });
      text = response.choices?.[0]?.message?.content || '';
    } else if (provider === 'groq') {
      const deprecatedGroqModels = ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 'llama-3.2-1b-preview', 'llama-3.2-3b-preview'];
      model = settings.groq?.model || 'llama-3.1-8b-instant';
      if (!model || deprecatedGroqModels.includes(model)) model = 'llama-3.1-8b-instant';
      const client = new OpenAI({ apiKey: activeKey, baseURL: "https://api.groq.com/openai/v1" });
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: "Explain how AI works in a few words" }],
        max_tokens: 50,
      });
      text = response.choices?.[0]?.message?.content || '';
    } else if (provider === 'glmOcr') {
      model = settings.glmOcr?.model || 'glm-ocr';
      const baseURL = settings.glmOcr?.baseURL || 'http://localhost:8000/v1';
      // Local models might not require a real API key but the SDK requires a non-empty string.
      const client = new OpenAI({ apiKey: activeKey || 'EMPTY', baseURL });
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: "Explain how AI works in a few words" }],
        max_tokens: 50,
      });
      text = response.choices?.[0]?.message?.content || '';
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    res.json({ success: true, model, responseText: text });
  } catch (error) {
    const apiError = error.response?.data?.error?.message || error.response?.data?.error || error.message;
    res.status(500).json({ error: apiError });
  }
});

// @route   GET /api/super-admin/tenants
router.get('/tenants', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, plan, search, resellerId } = req.query;
    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    const normalizedSearch = String(search || '').trim();
    
    const query = {};
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (plan) query['subscription.plan'] = plan;
    if (resellerId) query.resellerId = resellerId;
    if (normalizedSearch) {
      query.$or = [
        { name: { $regex: normalizedSearch, $options: 'i' } },
        { 'business.legalNameEn': { $regex: normalizedSearch, $options: 'i' } },
        { 'business.vatNumber': { $regex: normalizedSearch, $options: 'i' } }
      ];
    }
    
    const tenants = await withQueryTimeout(
      Tenant.find(query)
        .select('name slug businessType businessTypes business subscription isActive createdAt resellerId settings.communication.email terminationNotice')
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
    );
    
    const total = await withQueryTimeout(Tenant.countDocuments(query));

    if (tenants.length === 0) {
      return res.json({
        tenants: [],
        pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) }
      });
    }
    
    const tenantIds = tenants.map((tenant) => tenant._id);
    const userCounts = await User.aggregate([
      { $match: { tenantId: { $in: tenantIds } } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } }
    ]).option({ maxTimeMS: databaseQueryTimeoutMs });
    const userCountMap = new Map(userCounts.map((item) => [String(item._id), item.count || 0]));

    const invoiceCounts = await Invoice.aggregate([
      { $match: { tenantId: { $in: tenantIds } } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } }
    ]).option({ maxTimeMS: databaseQueryTimeoutMs });
    const invoiceCountMap = new Map(invoiceCounts.map((item) => [String(item._id), item.count || 0]));
    
    const tenantsWithCounts = tenants.map(t => ({
      ...serializeTenantForSuperAdmin(t),
      userCount: userCountMap.get(String(t._id)) || 0,
      invoiceCount: invoiceCountMap.get(String(t._id)) || 0
    }));
    
    res.json({
      tenants: tenantsWithCounts,
      pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) }
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   GET /api/super-admin/tenants/:id
router.get('/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const users = await User.find({ tenantId: tenant._id }).select('-password');
    const invoiceStats = await Invoice.aggregate([
      { $match: { tenantId: tenant._id } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } }
    ]);
    const employeeCount = await Employee.countDocuments({ tenantId: tenant._id, isActive: true });
    
    res.json({
      tenant: serializeTenantForSuperAdmin(tenant),
      users,
      invoiceStats,
      employeeCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/tenants
router.post('/tenants', async (req, res) => {
  try {
    const { name, slug, businessType, businessTypes, business, subscription, adminUser, branding, settings, zatca, personalEmail, phoneNumber, billingCleared, resellerId } = req.body;

    const nextBusinessTypes = normalizeBusinessTypes(businessTypes || businessType);
    const primaryBusinessType = businessType && nextBusinessTypes.includes(businessType)
      ? businessType
      : getPrimaryBusinessType({ businessTypes: nextBusinessTypes, businessType });

    // Create tenant
    const tenant = await Tenant.create({
      name,
      slug,
      personalEmail,
      phoneNumber,
      businessType: primaryBusinessType,
      businessTypes: nextBusinessTypes,
      business,
      ...(resellerId ? { resellerId } : {}),
      ...(settings ? { settings: mergeTenantEmailSettings({ existingTenant: { settings: {}, slug }, incomingSettings: settings }) } : {}),
      ...(branding ? { branding } : {}),
      ...(zatca ? { zatca: { phase: zatca.phase || 1 } } : {}),
      subscription: {
        ...subscription,
        startDate: subscription?.startDate ? new Date(subscription.startDate) : new Date(),
        endDate: subscription?.endDate ? new Date(subscription.endDate) : new Date(Date.now() + (subscription?.billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000)
      },
      createdBy: req.user._id
    });
    
    let createdAdminUser = null;

    // Create admin user for tenant
    if (adminUser) {
      createdAdminUser = await User.create({
        ...adminUser,
        tenantId: tenant._id,
        role: 'admin'
      });
    }

    const welcomeEmail = await sendTenantOnboardingEmail({
      tenant,
      adminUser: createdAdminUser,
      rawPassword: adminUser?.password || '',
      personalEmail,
      billingCleared: Boolean(billingCleared),
      preferredLanguage: createdAdminUser?.preferences?.language || tenant?.settings?.language,
    });
    
    // WhatsApp Onboarding
    let whatsappStatus = { sent: false, reason: 'not_attempted' };
    if (phoneNumber) {
      try {
        const waState = whatsappService.getStatus('super_admin');
        if (waState?.status === 'READY') {
          const waText = `Welcome to the Maqder Family, ${adminUser?.firstName || 'Customer'}!\n\nYour account is ready.\n*Login URL:* https://maqder.com/login\n*Email:* ${adminUser?.email}\n*Password:* ${adminUser?.password || ''}${billingCleared ? '\n\n*Billing Status:* CLEARED ✅' : ''}`;
          
          if (billingCleared) {
            const pdfBuffer = await generateTermsPdf({ tenantName: tenant.name, billingCleared: true });
            await whatsappService.sendPdf('super_admin', phoneNumber, pdfBuffer, 'Terms_and_Conditions.pdf', waText);
          } else {
            await whatsappService.sendText('super_admin', phoneNumber, waText);
          }
          whatsappStatus = { sent: true };
        } else {
          whatsappStatus = { sent: false, reason: 'super_admin_whatsapp_not_ready' };
        }
      } catch (waErr) {
        console.error('Failed to send WhatsApp onboarding:', waErr);
        whatsappStatus = { sent: false, reason: 'error', details: waErr.message };
      }
    }

    res.status(201).json({
      ...serializeTenantForSuperAdmin(tenant),
      welcomeEmail,
      whatsappStatus,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/super-admin/tenants/:id
router.put('/tenants/:id', async (req, res) => {
  try {
    const existingTenant = await Tenant.findById(req.params.id);
    if (!existingTenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const hasBusinessTypePayload = Object.prototype.hasOwnProperty.call(req.body || {}, 'businessType') || Object.prototype.hasOwnProperty.call(req.body || {}, 'businessTypes');
    const nextBusinessTypes = hasBusinessTypePayload
      ? normalizeBusinessTypes(req.body?.businessTypes || req.body?.businessType)
      : normalizeBusinessTypes(existingTenant.businessTypes || existingTenant.businessType);
    const primaryBusinessType = hasBusinessTypePayload
      ? (req.body?.businessType && nextBusinessTypes.includes(req.body.businessType)
          ? req.body.businessType
          : getPrimaryBusinessType({ businessTypes: nextBusinessTypes, businessType: req.body?.businessType }))
      : getPrimaryBusinessType(existingTenant);
    const nextSubscription = req.body?.subscription
      ? {
          ...(existingTenant.subscription?.toObject?.() || existingTenant.subscription || {}),
          ...(req.body.subscription || {}),
        }
      : undefined;

    if (nextSubscription) {
      const nextFeatures = Array.isArray(nextSubscription.features) ? nextSubscription.features.filter(Boolean) : [];
      nextSubscription.features = nextSubscription.hasEmailAddon === true
        ? [...new Set([...nextFeatures, 'email_automation'])]
        : nextFeatures.filter((feature) => feature !== 'email_automation');
    }

    const nextSettings = req.body?.settings
      ? mergeTenantEmailSettings({ existingTenant, incomingSettings: req.body.settings })
      : undefined;

    const nextZatca = req.body?.zatca
      ? {
          ...(existingTenant.zatca?.toObject?.() || existingTenant.zatca || {}),
          ...(req.body.zatca || {}),
        }
      : undefined;

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        ...(nextSettings ? { settings: nextSettings } : {}),
        ...(nextSubscription ? { subscription: nextSubscription } : {}),
        ...(nextZatca ? { zatca: nextZatca } : {}),
        businessType: primaryBusinessType,
        businessTypes: nextBusinessTypes,
      },
      { new: true, runValidators: true }
    );
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json(serializeTenantForSuperAdmin(tenant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/super-admin/tenants/:id/subscription
router.put('/tenants/:id/subscription', async (req, res) => {
  try {
    const { plan, status, maxUsers, maxInvoices, features, billingCycle, price, hasEmailAddon, endDate } = req.body;
    
    const updateData = { 'subscription.plan': plan };
    if (status) updateData['subscription.status'] = status;
    if (maxUsers) updateData['subscription.maxUsers'] = maxUsers;
    if (maxInvoices) updateData['subscription.maxInvoices'] = maxInvoices;
    if (features) {
      const featureList = Array.isArray(features) ? features.filter(Boolean) : [];
      updateData['subscription.features'] = hasEmailAddon === true
        ? [...new Set([...featureList, 'email_automation'])]
        : featureList.filter((feature) => feature !== 'email_automation');
    }
    if (billingCycle) updateData['subscription.billingCycle'] = billingCycle;
    if (price !== undefined) updateData['subscription.price'] = price;
    if (hasEmailAddon !== undefined) updateData['subscription.hasEmailAddon'] = hasEmailAddon === true;
    if (!features && hasEmailAddon !== undefined) {
      const existingTenant = await Tenant.findById(req.params.id).select('subscription.features');
      const existingFeatures = Array.isArray(existingTenant?.subscription?.features) ? existingTenant.subscription.features.filter(Boolean) : [];
      updateData['subscription.features'] = hasEmailAddon === true
        ? [...new Set([...existingFeatures, 'email_automation'])]
        : existingFeatures.filter((feature) => feature !== 'email_automation');
    }
    
    // Extend end date
    if (endDate) {
      updateData['subscription.endDate'] = new Date(endDate);
    } else if (status === 'active' && !updateData['subscription.endDate']) {
      const days = billingCycle === 'yearly' ? 365 : 30;
      updateData['subscription.endDate'] = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/super-admin/tenants/:id/toggle-status
router.put('/tenants/:id/toggle-status', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    tenant.isActive = !tenant.isActive;
    await tenant.save();
    
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/tenants/:id/resume
router.post('/tenants/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    const tenant = await Tenant.findById(id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    tenant.terminationNotice = undefined;
    tenant.isActive = true;
    if (tenant.subscription && tenant.subscription.status === 'terminated') {
      tenant.subscription.status = 'active';
    }

    if (days && !isNaN(days)) {
      const now = new Date();
      let currentEndDate = tenant.subscription.endDate ? new Date(tenant.subscription.endDate) : now;
      if (currentEndDate < now) {
        currentEndDate = now;
      }
      
      currentEndDate.setDate(currentEndDate.getDate() + Number(days));
      tenant.subscription.endDate = currentEndDate;
    }

    await tenant.save();
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const getMonitoringHeaders = (apiKey, provider) => {
  if (!apiKey) return {};
  if (provider === 'plesk') return { 'X-API-Key': apiKey, 'Accept': 'application/json' };
  if (provider === 'cpanel') return { 'Authorization': `cpanel ${apiKey}` };
  return { 'Authorization': `Bearer ${apiKey}` };
};

// @route   POST /api/super-admin/settings/monitoring/test-connection
router.post('/settings/monitoring/test-connection', async (req, res) => {
  try {
    const { endpointURL, apiKey, provider } = req.body;
    if (!endpointURL) return res.status(400).json({ error: 'Endpoint URL is required for testing' });
    
    const response = await axios.get(endpointURL, {
      params: { tenantSlug: 'test-connection' },
      headers: getMonitoringHeaders(apiKey, provider),
      timeout: 5000
    });
    
    res.json({ message: 'Connection successful', data: response.data });
  } catch (error) {
    res.status(400).json({ error: error.response?.data?.message || error.message || 'Connection failed' });
  }
});

// @route   GET /api/super-admin/tenants/:id/monitoring
router.get('/tenants/:id/monitoring', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findById(id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const settings = await SystemSettings.findOne({ key: 'global' });
    const monitoring = settings?.tenantMonitoring || { enabled: false };

    // Default basic stats using DB (active sessions tracked via User login attempts or counts)
    let activeSessions = 0;
    const usersCount = await User.countDocuments({ tenantId: id });
    activeSessions = await User.countDocuments({ tenantId: id, lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }); // Logged in past 24h

    let result = {
      tenantSlug: tenant.slug,
      status: monitoring.enabled ? 'fetched' : 'mocked',
      activeSessions: activeSessions,
      resources: {
        disk: '1.2 GB',
        memory: '256 MB',
        cpu: '2%'
      }
    };

    if (monitoring.enabled && monitoring.endpointURL) {
      try {
        const response = await axios.get(monitoring.endpointURL, {
          params: { tenantSlug: tenant.slug },
          headers: getMonitoringHeaders(monitoring.apiKey, monitoring.provider),
          timeout: 5000
        });
        
        if (response.data) {
          if (response.data.activeSessions !== undefined) result.activeSessions = response.data.activeSessions;
          if (response.data.resources) result.resources = response.data.resources;
        }
      } catch (err) {
        console.error('Tenant Monitoring API Error:', err.message);
        result.status = 'error';
        result.error = err.message;
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/super-admin/tenants/:id/termination
router.put('/tenants/:id/termination', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, reason, clear } = req.body;

    const tenant = await Tenant.findById(id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    if (clear) {
      tenant.terminationNotice = undefined;
      if (tenant.subscription.status === 'terminated') {
        tenant.subscription.status = 'active';
      }
    } else {
      if (!date || !reason) {
        return res.status(400).json({ error: 'Date and reason are required' });
      }
      tenant.terminationNotice = {
        date: new Date(date),
        reason
      };
      if (new Date(date) <= new Date()) {
        tenant.subscription.status = 'terminated';
      }
    }

    await tenant.save();
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/super-admin/tenants/:id/invoices
// @desc    Purge every invoice for a tenant and reset derived stats (dashboard, reports, customer stats, travel/restaurant bookings)
router.delete('/tenants/:id/invoices', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenantId = tenant._id;

    const [invoiceDeletion, quotationDeletion, travelBookingReset, restaurantOrderReset, customerReset, emailReset] = await Promise.all([
      Invoice.deleteMany({ tenantId }),
      Quotation.deleteMany({ tenantId }),
      TravelBooking.updateMany(
        { tenantId, invoiceId: { $ne: null } },
        { $set: { invoiceId: null, invoiceNumber: '', invoicedAt: null } }
      ),
      RestaurantOrder.updateMany(
        { tenantId, invoiceId: { $ne: null } },
        { $set: { invoiceId: null, invoiceNumber: '', invoicedAt: null } }
      ),
      Customer.updateMany(
        { tenantId },
        { $set: { totalInvoices: 0, totalRevenue: 0, lastInvoiceDate: null } }
      ),
      EmailMessage.updateMany(
        { tenantId, relatedInvoiceId: { $ne: null } },
        { $set: { relatedInvoiceId: null } }
      ),
    ]);

    tenant.zatca = {
      ...(tenant.zatca?.toObject?.() || tenant.zatca || {}),
      invoiceCounter: 0,
      lastInvoiceHash: '',
    };
    tenant.markModified('zatca');
    await tenant.save();

    res.json({
      success: true,
      tenantId: String(tenantId),
      deletedInvoices: invoiceDeletion?.deletedCount || 0,
      deletedQuotations: quotationDeletion?.deletedCount || 0,
      travelBookingsReset: travelBookingReset?.modifiedCount || 0,
      restaurantOrdersReset: restaurantOrderReset?.modifiedCount || 0,
      customersReset: customerReset?.modifiedCount || 0,
      emailsDetached: emailReset?.modifiedCount || 0,
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/super-admin/tenants/:id/reset
// @desc    Hard-reset the tenant's workspace: wipe all business data across every
//          module so the panel starts fresh. The tenant record, its users/employees
//          and tenant settings (branding, ZATCA config, invoice template, etc.) are
//          preserved.
router.post('/tenants/:id/reset', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenantId = tenant._id;
    const filter = { tenantId };

    const collections = [
      ['invoices', Invoice],
      ['customers', Customer],
      ['travelBookings', TravelBooking],
      ['restaurantOrders', RestaurantOrder],
      ['restaurantMenuItems', RestaurantMenuItem],
      ['emails', EmailMessage],
      ['expenses', Expense],
      ['products', Product],
      ['purchaseOrders', PurchaseOrder],
      ['suppliers', Supplier],
      ['warehouses', Warehouse],
      ['shipments', Shipment],
      ['vatReturns', VatReturn],
      ['tasks', Task],
      ['projects', Project],
      ['payroll', Payroll],
      ['jobCostEntries', JobCostEntry],
      ['jobCostingJobs', JobCostingJob],
      ['iotDevices', IoTDevice],
      ['iotReadings', IoTReading],
      ['whatsappContacts', WhatsAppContact],
      ['whatsappMessages', WhatsAppMessage],
      ['whatsappTemplates', WhatsAppTemplate],
      ['whatsappQuickReplies', QuickReply],
      ['whatsappBroadcasts', Broadcast],
      ['quotations', Quotation],
      ['deliveryNotes', DeliveryNote],
      ['reportSchedules', ReportSchedule],
    ];

    const results = await Promise.all(
      collections.map(async ([key, Model]) => {
        try {
          const result = await Model.deleteMany(filter);
          return [key, result?.deletedCount || 0];
        } catch (err) {
          return [key, { error: err.message }];
        }
      })
    );

    // Reset the ZATCA invoice chain so the next invoice starts from scratch.
    tenant.zatca = {
      ...(tenant.zatca?.toObject?.() || tenant.zatca || {}),
      invoiceCounter: 0,
      lastInvoiceHash: '',
    };
    tenant.markModified('zatca');
    await tenant.save();

    const summary = Object.fromEntries(results);
    res.json({
      success: true,
      tenantId: String(tenantId),
      deleted: summary,
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   DELETE /api/super-admin/tenants/:id
// @desc    Completely delete a tenant and all of its associated data
router.delete('/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenantId = tenant._id;
    const filter = { tenantId };

    const collections = [
      ['invoices', Invoice],
      ['customers', Customer],
      ['travelBookings', TravelBooking],
      ['restaurantOrders', RestaurantOrder],
      ['restaurantMenuItems', RestaurantMenuItem],
      ['emails', EmailMessage],
      ['expenses', Expense],
      ['products', Product],
      ['purchaseOrders', PurchaseOrder],
      ['suppliers', Supplier],
      ['warehouses', Warehouse],
      ['shipments', Shipment],
      ['vatReturns', VatReturn],
      ['tasks', Task],
      ['projects', Project],
      ['payroll', Payroll],
      ['jobCostEntries', JobCostEntry],
      ['jobCostingJobs', JobCostingJob],
      ['iotDevices', IoTDevice],
      ['iotReadings', IoTReading],
      ['whatsappContacts', WhatsAppContact],
      ['whatsappMessages', WhatsAppMessage],
      ['whatsappTemplates', WhatsAppTemplate],
      ['whatsappQuickReplies', QuickReply],
      ['whatsappBroadcasts', Broadcast],
      ['quotations', Quotation],
      ['deliveryNotes', DeliveryNote],
      ['reportSchedules', ReportSchedule],
      ['users', User],
      ['employees', Employee]
    ];

    const results = await Promise.all(
      collections.map(async ([key, Model]) => {
        try {
          const result = await Model.deleteMany(filter);
          return [key, result?.deletedCount || 0];
        } catch (err) {
          return [key, { error: err.message }];
        }
      })
    );

    await Tenant.findByIdAndDelete(tenantId);
    results.push(['tenant', 1]);

    const summary = Object.fromEntries(results);
    res.json({
      success: true,
      message: 'Tenant and all associated data completely deleted',
      deleted: summary,
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   GET /api/super-admin/users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, tenantId, role, search } = req.query;
    
    const query = {};
    if (tenantId) query.tenantId = tenantId;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .populate('tenantId', 'name slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/users
router.post('/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/super-admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update password separately if provided
    if (password) {
      user.password = password;
      await user.save();
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/super-admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/tenants/:id/login-as
router.post('/tenants/:id/login-as', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    // Find the admin user for this tenant
    const adminUser = await User.findOne({ 
      tenantId: tenant._id, 
      role: 'admin',
      isActive: true 
    });
    
    if (!adminUser) {
      return res.status(404).json({ error: 'No admin user found for this tenant' });
    }
    
    // Generate token for the admin user
    const token = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
    
    res.json({
      token,
      user: {
        id: adminUser._id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role,
        permissions: adminUser.permissions,
        preferences: adminUser.preferences
      },
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        business: tenant.business,
        branding: tenant.branding,
        settings: tenant.settings,
        subscription: tenant.subscription,
        terminationNotice: tenant.terminationNotice
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/super-admin/reports/revenue
router.get('/reports/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const revenue = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: '$issueDate' },
            month: { $month: '$issueDate' }
          },
          totalRevenue: { $sum: '$grandTotal' },
          totalTax: { $sum: '$totalTax' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);
    
    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/tenants/:id/send-backup
// @desc    Generate Excel + PDF backup of tenant data and email it
router.post('/tenants/:id/send-backup', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const { period = 'monthly', startDate: rawStart, endDate: rawEnd, email, formats = ['excel', 'pdf'] } = req.body || {};

    const recipientEmail = String(email || tenant.business?.email || '').trim();
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const normalizedFormats = Array.isArray(formats) ? formats.filter((f) => ['excel', 'pdf'].includes(f)) : ['excel', 'pdf'];
    if (normalizedFormats.length === 0) {
      return res.status(400).json({ error: 'At least one format (excel or pdf) must be selected' });
    }

    const { startDate, endDate } = resolvePeriodDates({ period, startDate: rawStart, endDate: rawEnd });
    const { buffers, invoices, expenses, employees, payrolls, summary } = await buildTenantBackup({
      tenantId: tenant._id,
      startDate,
      endDate,
      formats: normalizedFormats,
    });

    const settings = await SystemSettings.findOne({ key: 'global' });
    const { config: rawConfig } = resolveGlobalEmailTransportConfig({ settings: settings || {}, payload: {} });
    const hasCredentials = rawConfig.provider === 'brevo'
      ? !!rawConfig.brevoApiKey
      : (!!rawConfig.host && !!rawConfig.user && !!rawConfig.pass);
    if (!hasCredentials) {
      return res.status(503).json({ error: 'Email is not configured. Please set up SMTP or Brevo in Super Admin → Email Settings.', code: 'EMAIL_NOT_CONFIGURED' });
    }
    // For explicit admin actions, bypass the enabled flag so backups can be sent
    // even when automated email delivery is toggled off.
    const config = { ...rawConfig, enabled: true };

    const tenantName = tenant.business?.legalNameEn || tenant.business?.legalNameAr || tenant.name || 'Tenant';
    const periodLabel = period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Custom';
    const periodText = `${startDate.toLocaleDateString('en-US')} — ${endDate.toLocaleDateString('en-US')}`;
    const creatorRows = (summary?.invoiceCreators || []).slice(0, 5)
      .map((row) => `<tr><td style="padding:8px 12px;border-top:1px solid #e5e7eb;">${row.creatorName}</td><td style="padding:8px 12px;border-top:1px solid #e5e7eb;text-align:center;">${row.invoiceCount}</td><td style="padding:8px 12px;border-top:1px solid #e5e7eb;text-align:right;">SAR ${Number(row.total || 0).toFixed(2)}</td></tr>`)
      .join('');

    const attachments = [];
    if (normalizedFormats.includes('excel') && buffers.excel) {
      attachments.push({
        filename: `backup_${tenantName.replace(/\s+/g, '_')}_${period}.xlsx`,
        content: buffers.excel,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }
    if (normalizedFormats.includes('pdf') && buffers.pdf) {
      attachments.push({
        filename: `backup_${tenantName.replace(/\s+/g, '_')}_${period}.pdf`,
        content: buffers.pdf,
        contentType: 'application/pdf',
      });
    }

    const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="background:#1a3d28;color:#fff;padding:24px 28px;">
      <h2 style="margin:0;font-size:20px;">Maqder ERP — ${periodLabel} Backup</h2>
      <p style="margin:8px 0 0;opacity:.75;font-size:14px;">Period: ${periodText}</p>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;">Hello,</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151;">
        Please find attached the ${periodLabel.toLowerCase()} data backup for <strong>${tenantName}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Invoices</td><td style="padding:8px 12px;">${invoices.length}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">Expenses</td><td style="padding:8px 12px;">${expenses.length}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Employees</td><td style="padding:8px 12px;">${employees.length}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">Payroll Records</td><td style="padding:8px 12px;">${payrolls.length}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Revenue</td><td style="padding:8px 12px;">SAR ${Number(summary?.totalRevenue || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">VAT</td><td style="padding:8px 12px;">SAR ${Number(summary?.totalVat || 0).toFixed(2)}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Expenses Total</td><td style="padding:8px 12px;">SAR ${Number(summary?.totalExpenses || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">Payroll Total</td><td style="padding:8px 12px;">SAR ${Number(summary?.totalPayroll || 0).toFixed(2)}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Total Profit</td><td style="padding:8px 12px;">SAR ${Number(summary?.totalProfit || 0).toFixed(2)}</td></tr>
      </table>
      ${creatorRows ? `
      <div style="margin-top:24px;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#111827;">Top Invoice Creators</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;">User</th><th style="padding:8px 12px;text-align:center;">Invoices</th><th style="padding:8px 12px;text-align:right;">Grand Total</th></tr>
          ${creatorRows}
        </table>
      </div>` : ''}
      <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">This is an automated backup sent from Maqder ERP Super Admin Panel.</p>
    </div>
  </div>
</div>`;

    await sendEmailWithConfig({
      config,
      to: [recipientEmail],
      subject: `[${periodLabel} Backup] ${tenantName} — ${periodText}`,
      html,
      text: `Maqder ERP ${periodLabel} Backup for ${tenantName}\nPeriod: ${periodText}\nInvoices: ${invoices.length} | Expenses: ${expenses.length} | Employees: ${employees.length} | Payroll: ${payrolls.length}\nRevenue: SAR ${Number(summary?.totalRevenue || 0).toFixed(2)} | VAT: SAR ${Number(summary?.totalVat || 0).toFixed(2)} | Expenses Total: SAR ${Number(summary?.totalExpenses || 0).toFixed(2)} | Payroll Total: SAR ${Number(summary?.totalPayroll || 0).toFixed(2)} | Total Profit: SAR ${Number(summary?.totalProfit || 0).toFixed(2)}${summary?.invoiceCreators?.length ? `\nTop Creators: ${summary.invoiceCreators.slice(0, 5).map((row) => `${row.creatorName} (${row.invoiceCount} invoices, SAR ${Number(row.total || 0).toFixed(2)})`).join(' | ')}` : ''}`,
      attachments,
    });

    res.json({
      success: true,
      message: `Backup sent to ${recipientEmail}`,
      period: periodLabel,
      periodText,
      counts: { invoices: invoices.length, expenses: expenses.length, employees: employees.length, payrolls: payrolls.length },
      summary,
      attachments: attachments.map((a) => a.filename),
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// GET /api/super-admin/system-settings
router.get('/system-settings', async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) settings = await SystemSettings.create({});
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/super-admin/system-settings
router.put('/system-settings', async (req, res) => {
  try {
    const allowed = ['errorTracking', 'analytics', 'rateLimiting', 'sessionConfig', 'xssProtection', 'mongoSanitize'];
    const update = {};
    allowed.forEach(key => { if (req.body[key] !== undefined) update[key] = req.body[key]; });

    let settings = await SystemSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/tenants/:id/seed-khayyat
// @desc    Seed initial Khayyat data (fabrics, designs, suppliers)
router.post('/tenants/:id/seed-khayyat', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenantId = tenant._id;
    
    const baseImages = [
      { name: 'Golden Collar Embroidery', image: '/thawbs/embroidery/embroidery_01_1780726341358.png' },
      { name: 'Silver Geometric Chest', image: '/thawbs/embroidery/embroidery_02_1780726352005.png' },
      { name: 'Navy Islamic Pattern Cuff', image: '/thawbs/embroidery/embroidery_03_1780726362907.png' },
      { name: 'White Tone-on-Tone Floral', image: '/thawbs/embroidery/embroidery_04_1780726378834.png' },
      { name: 'Maroon & Gold Collar', image: '/thawbs/embroidery/embroidery_05_1780726390155.png' },
      { name: 'Subtle Grey Hidden Placket', image: '/thawbs/embroidery/embroidery_06_1780726401240.png' },
      { name: 'White Bespoke Pocket', image: '/thawbs/embroidery/embroidery_07_1780726415676.png' },
      { name: 'Navy & Gold Modern Collar', image: '/thawbs/embroidery/embroidery_08_1780726425634.png' },
      { name: 'Silver Arabesque Cuff', image: '/thawbs/embroidery/embroidery_09_1780726437290.png' },
      { name: 'White Elaborate Placket', image: '/thawbs/embroidery/embroidery_10_1780726448519.png' }
    ];

    const colors = ['White', 'Black', 'Navy', 'Maroon', 'Silver', 'Gold', 'Bronze', 'Emerald', 'Beige', 'Charcoal'];
    const styles = ['Modern', 'Classic', 'Geometric', 'Floral', 'Islamic', 'Bespoke', 'Elaborate', 'Minimalist', 'Royal', 'Vintage'];
    const parts = ['Collar', 'Cuff', 'Placket', 'Pocket', 'Chest', 'Shoulder', 'Sleeve', 'Back', 'Hem', 'Neckline'];

    const colorsAr = ['أبيض', 'أسود', 'كحلي', 'عنابي', 'فضي', 'ذهبي', 'برونزي', 'زمردي', 'بيج', 'فحمي'];
    const stylesAr = ['حديث', 'كلاسيكي', 'هندسي', 'مورد', 'إسلامي', 'مخصص', 'مفصل', 'بسيط', 'ملكي', 'عتيق'];
    const partsAr = ['ياقة', 'كم', 'مرد', 'جيب', 'صدر', 'كتف', 'ساعد', 'ظهر', 'حاشية', 'ياقة'];

    const embroideryImages = [...baseImages.map(img => ({
      ...img,
      nameI18n: { en: img.name, ar: img.name } // Base images keep their original names, could translate later
    }))];
    
    // Generate 40 more to make 50 with Arabic
    for (let i = 0; i < 40; i++) {
      const color = colors[i % colors.length];
      const style = styles[Math.floor(i / colors.length) % styles.length];
      const part = parts[Math.floor(i / (colors.length * styles.length)) % parts.length];
      
      const colorAr = colorsAr[i % colors.length];
      const styleAr = stylesAr[Math.floor(i / colors.length) % styles.length];
      const partAr = partsAr[Math.floor(i / (colors.length * styles.length)) % parts.length];

      embroideryImages.push({
        name: `${color} ${style} ${part} ${i + 1}`,
        nameI18n: { en: `${color} ${style} ${part} ${i + 1}`, ar: `${colorAr} ${styleAr} ${partAr} ${i + 1}` },
        image: baseImages[i % baseImages.length].image
      });
    }

    const fabricsData = [
      { name: 'Toyobo Premium', madeIn: 'Japan', pricePerRoll: 1200, rollsInStock: 20, stockMeters: 500, code: 'SUP-01' },
      { name: 'Shikibo Classic', madeIn: 'Japan', pricePerRoll: 1350, rollsInStock: 15, stockMeters: 375, code: 'SUP-01' },
      { name: 'Tetoron Blend', madeIn: 'Taiwan', pricePerRoll: 600, rollsInStock: 40, stockMeters: 1000, code: 'SUP-02' },
      { name: 'Winter Wool', madeIn: 'Italy', pricePerRoll: 2500, rollsInStock: 5, stockMeters: 125, code: 'SUP-02' },
      { name: 'Summer Cotton', madeIn: 'India', pricePerRoll: 400, rollsInStock: 30, stockMeters: 750, code: 'SUP-02' },
      { name: 'Kurabo Polyester', madeIn: 'Japan', pricePerRoll: 1100, rollsInStock: 25, stockMeters: 625, code: 'SUP-01' }
    ];

    const suppliersData = [
      { code: 'SUP-01', nameEn: 'Al-Jedaie Japanese Fabrics', nameAr: 'أقمشة الجديعي اليابانية', vatNumber: '300123456789012' },
      { code: 'SUP-02', nameEn: 'Riyadh Textile Co.', nameAr: 'شركة نسيج الرياض', vatNumber: '300987654321012' }
    ];
    
    // Seed Suppliers
    const supplierIds = {};
    for (const sup of suppliersData) {
      let supplier = await Supplier.findOne({ tenantId, code: sup.code });
      if (!supplier) {
        supplier = new Supplier({ ...sup, tenantId });
        await supplier.save();
      }
      supplierIds[sup.code] = supplier._id;
    }

    // Seed Khayyat Fabrics
    const { default: KhayyatFabric } = await import('../models/khayyat/KhayyatFabric.js');
    for (const f of fabricsData) {
      let fabric = await KhayyatFabric.findOne({ tenantId, name: f.name });
      if (!fabric) {
        const supplierId = supplierIds[f.code];
        fabric = new KhayyatFabric({
          tenantId,
          name: f.name,
          madeIn: f.madeIn,
          pricePerRoll: f.pricePerRoll,
          rollsInStock: f.rollsInStock,
          stockMeters: f.stockMeters,
          supplierId
        });
        await fabric.save();
      }
    }

    // Seed Embroidery Designs
    const { default: KhayyatEmbroideryDesign } = await import('../models/khayyat/KhayyatEmbroideryDesign.js');
    
    // Cleanup any lingering external picsum images from previous partial seeds that break CSP
    await KhayyatEmbroideryDesign.updateMany(
      { tenantId, image: { $regex: 'picsum.photos' } },
      { $set: { image: null } }
    );
    await Promise.all(embroideryImages.map(async (design) => {
      let existing = await KhayyatEmbroideryDesign.findOne({ tenantId, name: design.name });
      if (!existing) {
        existing = new KhayyatEmbroideryDesign({
          tenantId,
          name: design.name,
          nameI18n: design.nameI18n,
          image: design.image,
          price: 15,
          isActive: true
        });
        await existing.save();
      } else {
        existing.nameI18n = design.nameI18n;
        if (!existing.image || existing.image.includes('picsum.photos')) {
          existing.image = design.image;
        }
        await existing.save();
      }
    }));
    
    res.json({ message: 'Khayyat data seeded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed Saloon Data
router.post('/tenants/:id/seed-saloon', async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { default: Tenant } = await import('../models/Tenant.js');
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const saloonServices = [
      { nameEn: 'Haircut', nameAr: 'حلاقة شعر', category: 'Hair', durationMinutes: 30, price: 35, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Beard Trim', nameAr: 'تحديد لحية', category: 'Beard', durationMinutes: 15, price: 20, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Hair & Beard', nameAr: 'حلاقة شعر ولحية', category: 'Hair', durationMinutes: 45, price: 50, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Kids Haircut', nameAr: 'حلاقة أطفال', category: 'Hair', durationMinutes: 30, price: 25, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1595475884562-073c30d45670?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Hair Wash', nameAr: 'غسيل شعر', category: 'Care', durationMinutes: 10, price: 10, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Facial Scrub', nameAr: 'سنفرة للوجه', category: 'Skin', durationMinutes: 20, price: 40, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Face Mask', nameAr: 'ماسك للوجه', category: 'Skin', durationMinutes: 15, price: 30, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Hair Dye', nameAr: 'صبغة شعر', category: 'Color', durationMinutes: 45, price: 80, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1605980776566-0486c3ac7617?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Beard Dye', nameAr: 'صبغة لحية', category: 'Color', durationMinutes: 30, price: 40, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1504703395950-b89145a5425b?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Protein Treatment', nameAr: 'بروتين للشعر', category: 'Care', durationMinutes: 60, price: 150, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Keratin Treatment', nameAr: 'كيراتين', category: 'Care', durationMinutes: 60, price: 200, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=400&q=80' },
      { nameEn: 'Blow Dry', nameAr: 'استشوار', category: 'Styling', durationMinutes: 15, price: 20, taxRate: 15, imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80' }
    ];

    const { default: SaloonService } = await import('../models/SaloonService.js');
    await Promise.all(saloonServices.map(async (svc) => {
      await SaloonService.findOneAndUpdate(
        { tenantId, nameEn: svc.nameEn },
        { $set: { ...svc, isActive: true } },
        { upsert: true, new: true }
      );
    }));
    
    res.json({ message: 'Saloon data seeded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Import products and invoices from CSV data (JSON payload) ---
router.post('/tenants/:id/import-data', async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { products: productRows = [], invoices: invoiceRows = [] } = req.body;

    const { default: TenantModel } = await import('../models/Tenant.js');
    const { default: ProductModel } = await import('../models/Product.js');
    const { default: CustomerModel } = await import('../models/Customer.js');
    const { default: InvoiceModel } = await import('../models/Invoice.js');

    const tenant = await TenantModel.findById(tenantId).lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const sellerInfo = {
      name:      tenant.name || '',
      nameAr:    tenant.nameAr || '',
      vatNumber: tenant?.business?.vatNumber || '',
      crNumber:  tenant?.business?.crNumber  || '',
      address: { country: 'SA', city: tenant?.business?.city || '' },
    };

    const normalizeUOM = (u) => {
      const map = { 'PCS':'PCE','PC':'PCE','EA':'PCE','CTN':'CT','CARTON':'CT','BOX':'BX','TIN':'PCE','BTL':'PCE','BAG':'BG','KG':'KGM','LTR':'LTR','MTR':'MTR','ROLL':'RO' };
      const v = String(u||'').toUpperCase().trim();
      return map[v] || (v || 'PCE');
    };

    const parseDMY = (s) => {
      if (!s) return new Date();
      const [d,m,y] = String(s).trim().split('-');
      if (!d||!m||!y) return new Date();
      return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00.000Z`);
    };

    const normalizePayment = (m) => {
      const v = String(m||'').toLowerCase().trim();
      if (v==='cash') return 'cash'; if (v==='credit') return 'credit';
      if (v==='card') return 'card'; if (v.includes('bank')) return 'bank_transfer';
      return 'cash';
    };

    // ── Products ──────────────────────────────────────────────────────────
    let pCreated=0, pUpdated=0, pSkipped=0;
    const productMap = {};

    for (let i=0; i<productRows.length; i++) {
      const r = productRows[i];
      const nameEn = String(r['english items']||r.nameEn||'').trim();
      const nameAr  = String(r['arabic items'] ||r.nameAr ||'').trim();
      const barcode = String(r['bracode']||r.barcode||'').trim();
      const unit    = normalizeUOM(r['unit']||r.unit||'PCE');
      const cost    = parseFloat(r['purchase_price']||r.costPrice||0)||0;
      const price   = parseFloat(r['sale_price']||r.sellingPrice||0)||0;
      const alert   = parseFloat(r['alert_quantity']||0)||0;

      if (!nameEn || price === 0) { pSkipped++; continue; }

      const sku = barcode || `BL-${String(i+1).padStart(5,'0')}`;
      const filter = barcode ? { tenantId, barcode } : { tenantId, nameEn };
      const doc = {
        tenantId, sku, nameEn, nameAr: nameAr||undefined,
        barcode: barcode||undefined,
        category: String(r['category']||'').trim()||undefined,
        brand:    String(r['brand']||'').trim()||undefined,
        descriptionEn: String(r['description']||'').trim()||undefined,
        unitOfMeasure: unit, unitOfMeasureAr: 'قطعة',
        costPrice: cost, sellingPrice: price,
        taxRate: 15, taxCategory: 'S', currency: 'SAR',
        isActive: String(r['active']||'1') !== '0',
        alertQuantity: alert, totalStock: 0,
      };

      const result = await ProductModel.findOneAndUpdate(filter, { $set: doc }, { upsert: true, new: true });
      productMap[barcode] = result._id;
      productMap[nameEn.toLowerCase()] = result._id;
      if (result.createdAt?.getTime() === result.updatedAt?.getTime()) pCreated++; else pUpdated++;
    }

    // ── Customers cache ───────────────────────────────────────────────────
    const customerCache = {};
    const existingCusts = await CustomerModel.find({ tenantId }).select('name vatNumber').lean();
    for (const c of existingCusts) {
      customerCache[c.name.toLowerCase()] = c._id;
      if (c.vatNumber) customerCache[`vat:${c.vatNumber}`] = c._id;
    }

    // ── Invoices ──────────────────────────────────────────────────────────
    let iCreated=0, iSkipped=0, cCreated=0;

    for (let i=0; i<invoiceRows.length; i++) {
      const r = invoiceRows[i];
      const invoiceNumber = String(r['Invoice No']||r.invoiceNumber||'').trim();
      const dateStr       = String(r['Date']||r.date||'').trim();
      const amount        = parseFloat(r['Amount']||0)||0;
      const discount      = parseFloat(r['Discount']||0)||0;
      const vat           = parseFloat(r['VAT']||0)||0;
      const grandTotal    = parseFloat(r['Grand Total']||r.grandTotal||0)||0;
      const payMethod     = String(r['Payment Method']||'').trim();
      const custName      = String(r['Customer Name']||'Cash Customer').trim()||'Cash Customer';
      const custPhone     = String(r['Customer Phone']||'').trim().replace(/^0+$/,'');
      const custVAT       = String(r['Customer VAT NO']||'').trim();

      if (!invoiceNumber) { iSkipped++; continue; }

      const exists = await InvoiceModel.exists({ tenantId, invoiceNumber });
      if (exists) { iSkipped++; continue; }

      const nameKey = custName.toLowerCase();
      const vatKey  = custVAT && custVAT.length > 5 ? `vat:${custVAT}` : null;
      let customerId = (vatKey && customerCache[vatKey]) || customerCache[nameKey];

      if (!customerId && custName !== 'Cash Customer') {
        const newCust = await CustomerModel.create({
          tenantId, name: custName,
          phone: custPhone && custPhone.length > 2 ? custPhone : undefined,
          vatNumber: custVAT && custVAT.length > 5 ? custVAT : undefined,
          type: custVAT && custVAT.length > 5 ? 'business' : 'individual',
          isActive: true,
        });
        customerId = newCust._id;
        customerCache[nameKey] = customerId;
        if (vatKey) customerCache[vatKey] = customerId;
        cCreated++;
      }

      const isB2B = !!(custVAT && custVAT.length > 5);
      const pm = normalizePayment(payMethod);

      await InvoiceModel.create({
        tenantId, flow: 'sell', businessContext: 'trading',
        invoiceNumber, invoiceType: '388',
        invoiceTypeCode: isB2B ? '0100000' : '0200000',
        transactionType: isB2B ? 'B2B' : 'B2C',
        issueDate: parseDMY(dateStr),
        seller: sellerInfo,
        buyer: {
          name: custName,
          vatNumber: custVAT && custVAT.length > 5 ? custVAT : undefined,
          contactPhone: custPhone && custPhone.length > 2 ? custPhone : undefined,
        },
        customerId: customerId || undefined,
        lineItems: [{
          lineNumber: 1, productName: 'Goods & Products', productNameAr: 'بضائع ومنتجات',
          quantity: 1, unitCode: 'PCE', unitPrice: amount,
          discount, discountType: 'fixed', taxCategory: 'S', taxRate: 15,
          taxAmount: vat, lineTotal: amount-discount, lineTotalWithTax: (amount-discount)+vat,
        }],
        subtotal: amount, invoiceDiscount: discount, totalDiscount: discount,
        taxableAmount: amount-discount, totalTax: vat, grandTotal,
        currency: 'SAR', paymentMethod: pm,
        paymentStatus: pm === 'credit' ? 'pending' : 'paid',
        status: 'draft', source: 'import',
      });
      iCreated++;
    }

    res.json({
      success: true,
      products:  { created: pCreated, updated: pUpdated, skipped: pSkipped },
      invoices:  { created: iCreated, skipped: iSkipped },
      customers: { created: cCreated },
    });
  } catch (error) {
    console.error('[import-data]', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Finalise imported data: approve invoices + rebuild customer stats ---
router.post('/tenants/:id/finalise-import', async (req, res) => {
  try {
    const tenantId = new (await import('mongoose')).default.Types.ObjectId(req.params.id);

    const { default: InvoiceModel }  = await import('../models/Invoice.js');
    const { default: CustomerModel } = await import('../models/Customer.js');

    // 1. Approve all draft invoices for this tenant, set paidAmount correctly
    const updateResult = await InvoiceModel.updateMany(
      { tenantId, status: 'draft' },
      [
        {
          $set: {
            status: 'approved',
            paidAmount: {
              $cond: [
                { $in: ['$paymentStatus', ['paid']] },
                '$grandTotal',
                0
              ]
            }
          }
        }
      ]
    );

    // 2. Rebuild customer stats from invoices
    const customerStats = await InvoiceModel.aggregate([
      { $match: { tenantId, flow: 'sell', status: 'approved', customerId: { $exists: true, $ne: null } } },
      { $group: {
          _id: '$customerId',
          totalInvoices: { $sum: 1 },
          totalRevenue:  { $sum: '$grandTotal' },
          lastInvoiceDate: { $max: '$issueDate' },
      }},
    ]);

    let custUpdated = 0;
    for (const stat of customerStats) {
      await CustomerModel.findByIdAndUpdate(stat._id, {
        $set: {
          totalInvoices:   stat.totalInvoices,
          totalRevenue:    stat.totalRevenue,
          lastInvoiceDate: stat.lastInvoiceDate,
        }
      });
      custUpdated++;
    }

    res.json({
      success: true,
      invoicesApproved: updateResult.modifiedCount,
      customersUpdated: custUpdated,
    });
  } catch (error) {
    console.error('[finalise-import]', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Super Admin Eval (Temp Debug) ---
router.post('/eval-db', async (req, res) => {
  try {
    const { code } = req.body;
    const mongoose = (await import('mongoose')).default;
    const db = mongoose.connection.db;
    const Invoice = (await import('../models/Invoice.js')).default;
    const Customer = (await import('../models/Customer.js')).default;
    const Tenant = (await import('../models/Tenant.js')).default;
    const Product = (await import('../models/Product.js')).default;
    
    // Evaluate the code
    const result = await eval(`(async () => { ${code} })()`);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// --- Super Admin Mailbox ---
router.get('/mailbox/messages', async (req, res) => {
  try {
    const pageNumber = Math.max(1, Number(req.query.page) || 1);
    const limitNumber = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const normalizedFolder = ['all', 'inbox', 'sent', 'draft'].includes(String(req.query.folder || '').trim().toLowerCase())
      ? String(req.query.folder || '').trim().toLowerCase()
      : 'inbox';
    const search = req.query.search;
    
    const query = {
      ownerType: 'super_admin',
      ...(normalizedFolder === 'all' ? {} : { type: normalizedFolder }),
    };

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { from: { $regex: search, $options: 'i' } },
        { to: { $regex: search, $options: 'i' } },
        { previewText: { $regex: search, $options: 'i' } },
      ];
    }

    const [messages, total, counts] = await Promise.all([
      EmailMessage.find(query)
        .select('from to cc subject previewText isRead type direction status createdAt updatedAt delivery.sentAt delivery.receivedAt attachments.name attachments.type attachments.size metadata')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      EmailMessage.countDocuments(query),
      EmailMessage.aggregate([
        { $match: { ownerType: 'super_admin' } },
        { $group: { _id: '$type', count: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } } } },
      ]),
    ]);

    const result = {
      messages,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.max(1, Math.ceil(total / limitNumber)),
      },
      counts: counts.reduce((acc, item) => {
        acc[item._id] = { count: item.count, unread: item.unread };
        acc.all.count += item.count || 0;
        acc.all.unread += item.unread || 0;
        return acc;
      }, { all: { count: 0, unread: 0 }, inbox: { count: 0, unread: 0 }, sent: { count: 0, unread: 0 }, draft: { count: 0, unread: 0 } }),
    };
    
    res.json(result);
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get('/mailbox/messages/:id', async (req, res) => {
  try {
    const message = await EmailMessage.findOne({ _id: req.params.id, ownerType: 'super_admin' });
    if (!message) {
      return res.status(404).json({ error: 'Email message not found' });
    }

    if (!message.isRead && message.type === 'inbox') {
      message.isRead = true;
      await message.save();
    }

    res.json(message);
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.patch('/mailbox/messages/:id/read', async (req, res) => {
  try {
    const message = await EmailMessage.findOne({ _id: req.params.id, ownerType: 'super_admin' });
    if (!message) {
      return res.status(404).json({ error: 'Email message not found' });
    }

    message.isRead = req.body?.isRead !== false;
    await message.save();
    res.json(message);
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post('/mailbox/messages/send', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    const globalEmail = settings.email || {};
    
    const config = {
      enabled: globalEmail.enabled === true,
      provider: String(globalEmail.provider || 'smtp').trim().toLowerCase() === 'brevo' ? 'brevo' : 'smtp',
      host: String(globalEmail.smtpHost || '').trim(),
      port: Number(globalEmail.smtpPort || 587),
      secure: globalEmail.smtpSecure === true,
      user: String(globalEmail.smtpUser || '').trim(),
      pass: String(globalEmail.smtpPass || '').trim(),
      brevoApiKey: String(globalEmail.brevoApiKey || '').trim(),
      fromName: String(globalEmail.fromName || 'Maqder ERP').trim(),
      fromEmail: String(req.body.from || globalEmail.fromEmail || globalEmail.smtpUser || '').trim(),
      replyTo: String(globalEmail.replyTo || '').trim(),
    };

    if (!config.enabled) {
      return res.status(400).json({ error: 'Global email delivery is disabled' });
    }

    const payload = req.body || {};
    const to = payload.to || [];
    if (!to || to.length === 0) {
      return res.status(400).json({ error: 'Email recipient is required' });
    }

    if (payload.saveAsDraft === true) {
      const draft = await EmailMessage.create({
        ownerType: 'super_admin',
        to,
        cc: payload.cc || [],
        bcc: payload.bcc || [],
        from: config.fromEmail,
        subject: String(payload.subject || '').trim(),
        bodyHtml: String(payload.bodyHtml || '').trim(),
        bodyText: String(payload.bodyText || '').trim(),
        type: 'draft',
        direction: 'outgoing',
        status: 'draft',
        attachments: payload.attachments || [],
        metadata: { purpose: 'super_admin_compose' },
      });
      return res.status(201).json({ success: true, draft });
    }

    let department = '';
    if (config.fromEmail === globalEmail.salesEmail) department = 'Sales Team';
    else if (config.fromEmail === globalEmail.supportEmail) department = 'Support Team';
    else if (config.fromEmail === globalEmail.billingEmail) department = 'Billing Team';

    const signatureHtml = `
<br /><br />
<div style="font-family: sans-serif; color: #475569; font-size: 13px; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
  <div style="font-weight: bold; color: #0f172a; margin-bottom: 2px;">${config.fromName}</div>
  ${department ? `<div style="color: #1a3d28; font-weight: 600; margin-bottom: 8px;">${department}</div>` : ''}
  <img src="https://maqder.com/maqdernewlogo.png" alt="Logo" style="height: 32px; width: auto; border-radius: 4px;" />
</div>
`;

    let htmlBody = payload.bodyHtml || '';
    if (htmlBody.includes('─────────────────────')) {
      htmlBody = htmlBody.replace('─────────────────────', signatureHtml + '<br /><br />─────────────────────');
    } else {
      htmlBody += signatureHtml;
    }

    const fullHtml = `
<div style="font-family: sans-serif; color: #1e293b; font-size: 14px; line-height: 1.6;">
  ${htmlBody}
</div>
`;

    const textSignature = `\n\n-- \n${config.fromName}${department ? ` - ${department}` : ''}`;
    let fullText = payload.bodyText || '';
    if (fullText.includes('─────────────────────')) {
      fullText = fullText.replace('─────────────────────', textSignature + '\n\n─────────────────────');
    } else {
      fullText += textSignature;
    }

    const result = await sendEmailWithConfig({
      config,
      to,
      cc: payload.cc || [],
      bcc: payload.bcc || [],
      replyTo: config.replyTo || undefined,
      subject: payload.subject,
      html: fullHtml,
      text: fullText,
      attachments: payload.attachments || [],
    });

    const stored = await EmailMessage.create({
      ownerType: 'super_admin',
      messageId: String(result?.providerMessageId || '').trim(),
      to,
      cc: payload.cc || [],
      bcc: payload.bcc || [],
      from: config.fromEmail,
      subject: payload.subject,
      bodyHtml: fullHtml,
      bodyText: fullText || '',
      type: 'sent',
      direction: 'outgoing',
      status: 'sent',
      attachments: payload.attachments || [],
      delivery: {
        provider: config.provider,
        providerMessageId: String(result?.providerMessageId || '').trim(),
        sentAt: new Date(),
      },
      metadata: { purpose: 'super_admin_compose' },
    });

    res.status(201).json({ success: true, delivery: { sent: true, message: stored } });
  } catch (error) {
    sendRouteError(res, error);
  }
});


// @route   GET /api/super-admin/whatsapp/status
router.get('/whatsapp/status', async (req, res) => {
  try {
    const status = whatsappService.getStatus('super_admin');
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/whatsapp/init
router.post('/whatsapp/init', async (req, res) => {
  try {
    const status = await whatsappService.initClient('super_admin');
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/whatsapp/logout
router.post('/whatsapp/logout', async (req, res) => {
  try {
    await whatsappService.logout('super_admin');
    res.json({ success: true, message: 'WhatsApp session disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LEAD / QUERY CRM ---

// @route   GET /api/super-admin/leads
router.get('/leads', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, serviceInterest, tenantType } = req.query;
    const parsedPage = Math.max(1, Number.parseInt(page, 10));
    const parsedLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10)));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = {};
    if (status) filter.status = status;
    if (serviceInterest) filter.serviceInterest = serviceInterest;
    if (tenantType) filter.tenantType = tenantType;
    if (search) {
      filter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const [leads, total] = await Promise.all([
      LeadQuery.find(filter).sort('-createdAt').skip(skip).limit(parsedLimit).lean(),
      LeadQuery.countDocuments(filter),
    ]);

    res.json({
      leads,
      pagination: { page: parsedPage, limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/super-admin/leads/stats
router.get('/leads/stats', async (req, res) => {
  try {
    const [total, newCount, attended, interested, notInterested, converted, followUp, byService, byTenant] = await Promise.all([
      LeadQuery.countDocuments(),
      LeadQuery.countDocuments({ status: 'new' }),
      LeadQuery.countDocuments({ status: 'attended' }),
      LeadQuery.countDocuments({ status: 'interested' }),
      LeadQuery.countDocuments({ status: 'not_interested' }),
      LeadQuery.countDocuments({ status: 'converted' }),
      LeadQuery.countDocuments({ status: 'follow_up' }),
      LeadQuery.aggregate([{ $group: { _id: '$serviceInterest', count: { $sum: 1 } } }]),
      LeadQuery.aggregate([{ $group: { _id: '$tenantType', count: { $sum: 1 } } }]),
    ]);
    res.json({ total, new: newCount, attended, interested, notInterested, converted, followUp, byService, byTenant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/leads
router.post('/leads', async (req, res) => {
  try {
    const { phoneNumber, name, status, serviceInterest, tenantType, city, notes } = req.body;
    const lead = await LeadQuery.create({
      phoneNumber: String(phoneNumber || '').trim(),
      name: String(name || '').trim(),
      status: status || 'new',
      serviceInterest: serviceInterest || 'none',
      tenantType: tenantType || '',
      city: city || '',
      notes: notes || '',
      noteHistory: notes ? [{ note: notes, date: new Date() }] : [],
      createdBy: req.user?._id,
    });
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/super-admin/leads/:id
router.put('/leads/:id', async (req, res) => {
  try {
    const { phoneNumber, name, status, serviceInterest, tenantType, city, notes, newNote } = req.body;
    
    let updateData = {
      ...(phoneNumber !== undefined && { phoneNumber: String(phoneNumber).trim() }),
      ...(name !== undefined && { name: String(name).trim() }),
      ...(status !== undefined && { status }),
      ...(serviceInterest !== undefined && { serviceInterest }),
      ...(tenantType !== undefined && { tenantType }),
      ...(city !== undefined && { city }),
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    if (newNote) {
      updateData.$push = { noteHistory: { note: newNote, date: new Date() } };
    }

    const lead = await LeadQuery.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/super-admin/leads/:id
router.delete('/leads/:id', async (req, res) => {
  try {
    const lead = await LeadQuery.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/leads/:id/send-demo
router.post('/leads/:id/send-demo', async (req, res) => {
  try {
    const { langPair = 'en+ar', loginUrl, email, password } = req.body;
    const lead = await LeadQuery.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const phone = lead.phoneNumber;
    if (!phone) return res.status(400).json({ error: 'Lead has no phone number' });

    const name = lead.name || 'Customer';
    const url   = loginUrl  || 'https://maqder.com/login';
    const usr   = email     || 'demo@maqder.com';
    const pwd   = password  || 'Demo@1234';

    // Bilingual message blocks
    const blocks = {
      'en+ar': [
        `🌟 *Welcome to Maqder – مرحباً بك في مقدر!*`,
        ``,
        `Dear ${name} / عزيزي ${name}،`,
        ``,
        `🚀 *Try Our Demo / جرّب النظام الآن*`,
        `Your demo account is ready. Explore all features of Maqder POS & ERP — completely free!`,
        `حسابك التجريبي جاهز. استكشف جميع مزايا مقدر — مجاناً!`,
        ``,
        `🔗 *Login / تسجيل الدخول:* ${url}`,
        `📧 *Email / البريد:* ${usr}`,
        `🔑 *Password / كلمة المرور:* ${pwd}`,
        ``,
        `💬 Contact us anytime / تواصل معنا في أي وقت`,
        `📞 WhatsApp: wa.me/966500000000`,
      ],
      'en+hi': [
        `🌟 *Welcome to Maqder – मक़दर में आपका स्वागत है!*`,
        ``,
        `Dear ${name} / प्रिय ${name},`,
        ``,
        `🚀 *Try Our Demo / डेमो आज़माएं*`,
        `Your demo account is ready. Explore all features of Maqder POS & ERP — completely free!`,
        `आपका डेमो अकाउंट तैयार है। मक़दर की सभी सुविधाएं मुफ़्त में आज़माएं!`,
        ``,
        `🔗 *Login / लॉगिन:* ${url}`,
        `📧 *Email / ईमेल:* ${usr}`,
        `🔑 *Password / पासवर्ड:* ${pwd}`,
        ``,
        `💬 Contact us anytime / किसी भी समय संपर्क करें`,
        `📞 WhatsApp: wa.me/966500000000`,
      ],
      'en+ur': [
        `🌟 *Welcome to Maqder – مقدر میں خوش آمدید!*`,
        ``,
        `Dear ${name} / عزیز ${name}،`,
        ``,
        `🚀 *Try Our Demo / ڈیمو آزمائیں*`,
        `Your demo account is ready. Explore all features of Maqder POS & ERP — completely free!`,
        `آپ کا ڈیمو اکاؤنٹ تیار ہے۔ مقدر کی تمام سہولیات مفت میں آزمائیں!`,
        ``,
        `🔗 *Login / لاگ ان:* ${url}`,
        `📧 *Email / ای میل:* ${usr}`,
        `🔑 *Password / پاس ورڈ:* ${pwd}`,
        ``,
        `💬 Contact us anytime / کسی بھی وقت رابطہ کریں`,
        `📞 WhatsApp: wa.me/966500000000`,
      ],
      'en+bn': [
        `🌟 *Welcome to Maqder – মাকদারে স্বাগতম!*`,
        ``,
        `Dear ${name} / প্রিয় ${name},`,
        ``,
        `🚀 *Try Our Demo / ডেমো ব্যবহার করুন*`,
        `Your demo account is ready. Explore all features of Maqder POS & ERP — completely free!`,
        `আপনার ডেমো অ্যাকাউন্ট প্রস্তুত। মাকদারের সব সুবিধা বিনামূল্যে উপভোগ করুন!`,
        ``,
        `🔗 *Login / লগইন:* ${url}`,
        `📧 *Email / ইমেইল:* ${usr}`,
        `🔑 *Password / পাসওয়ার্ড:* ${pwd}`,
        ``,
        `💬 Contact us anytime / যেকোনো সময় যোগাযোগ করুন`,
        `📞 WhatsApp: wa.me/966500000000`,
      ],
      'en+fa': [
        `🌟 *Welcome to Maqder – به مقدر خوش آمدید!*`,
        ``,
        `Dear ${name} / عزیز ${name}،`,
        ``,
        `🚀 *Try Our Demo / سیستم را امتحان کنید*`,
        `Your demo account is ready. Explore all features of Maqder POS & ERP — completely free!`,
        `حساب دیمو شما آماده است. تمام امکانات مقدر را رایگان امتحان کنید!`,
        ``,
        `🔗 *Login / ورود:* ${url}`,
        `📧 *Email / ایمیل:* ${usr}`,
        `🔑 *Password / رمز عبور:* ${pwd}`,
        ``,
        `💬 Contact us anytime / هر زمان تماس بگیرید`,
        `📞 WhatsApp: wa.me/966500000000`,
      ],
    };

    const message = (blocks[langPair] || blocks['en+ar']).join('\n');

    const waState = whatsappService.getStatus('super_admin');
    if (waState?.status !== 'READY') {
      return res.status(503).json({ error: 'WhatsApp is not connected. Please connect WhatsApp first.' });
    }

    await whatsappService.sendText('super_admin', phone, message);

    // Mark lead as attended if still new
    if (lead.status === 'new') {
      await LeadQuery.findByIdAndUpdate(lead._id, { status: 'attended' });
    }

    res.json({ success: true, sentTo: phone, langPair });
  } catch (error) {
    console.error('[Send Demo] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Demo Users ─────────────────────────────────────────────────────────────────

// @route   GET /api/super-admin/demo-users
router.get('/demo-users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, businessType } = req.query;
    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;

    const query = {};
    if (status === 'upgraded') query.isUpgraded = true;
    if (status === 'trial') query.isUpgraded = false;
    if (businessType) query.businessType = businessType;
    if (search) {
      query.$or = [
        { email: { $regex: String(search).trim(), $options: 'i' } },
      ];
    }

    const demoUsers = await DemoUser.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('tenantId', 'name slug isActive isDemo demoTrialEndsAt demoUpgraded subscription')
      .lean();

    const total = await DemoUser.countDocuments(query);

    res.json({
      demoUsers,
      pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   GET /api/super-admin/demo-users/stats
router.get('/demo-users/stats', async (req, res) => {
  try {
    const stats = await Promise.all([
      DemoUser.countDocuments(),
      DemoUser.countDocuments({ isUpgraded: false }),
      DemoUser.countDocuments({ isUpgraded: true }),
    ]);

    const byBusinessType = await DemoUser.aggregate([
      { $group: { _id: '$businessType', count: { $sum: 1 } } },
    ]);

    res.json({
      total: stats[0],
      trial: stats[1],
      upgraded: stats[2],
      byBusinessType,
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// ── Payment Gateway Settings ───────────────────────────────────────────────────

const serializePaymentProvider = (p) => {
  if (!p) p = {};
  return {
    enabled: p.enabled === true,
    environment: p.environment || 'test',
  };
};

// @route   GET /api/super-admin/settings/payment
router.get('/settings/payment', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    const payment = settings?.payment?.toObject?.() || settings?.payment || {};
    const moyasar = payment?.moyasar || {};
    const applePay = payment?.applePay || {};
    const stcPay = payment?.stcPay || {};
    const tabby = payment?.tabby || {};
    const tamara = payment?.tamara || {};

    res.json({
      payment: {
        moyasar: {
          enabled: moyasar.enabled === true,
          publishableKey: moyasar.publishableKey || '',
          hasSecretKey: !!moyasar.secretKey,
          secretKeyMasked: maskSecret(moyasar.secretKey),
          hasWebhookSecret: !!moyasar.webhookSecret,
          webhookSecretMasked: maskSecret(moyasar.webhookSecret),
          environment: moyasar.environment || 'test',
        },
        applePay: {
          ...serializePaymentProvider(applePay),
          merchantId: applePay.merchantId || '',
          merchantCertificatePath: applePay.merchantCertificatePath || '',
          merchantCertificateKeyPath: applePay.merchantCertificateKeyPath || '',
        },
        stcPay: {
          ...serializePaymentProvider(stcPay),
          merchantId: stcPay.merchantId || '',
          hasApiKey: !!stcPay.apiKey,
          apiKeyMasked: maskSecret(stcPay.apiKey),
        },
        tabby: {
          ...serializePaymentProvider(tabby),
          publicKey: tabby.publicKey || '',
          merchantCode: tabby.merchantCode || '',
          hasSecretKey: !!tabby.secretKey,
          secretKeyMasked: maskSecret(tabby.secretKey),
        },
        tamara: {
          ...serializePaymentProvider(tamara),
          hasApiToken: !!tamara.apiToken,
          apiTokenMasked: maskSecret(tamara.apiToken),
          hasNotificationToken: !!tamara.notificationToken,
          notificationTokenMasked: maskSecret(tamara.notificationToken),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/super-admin/settings/payment
router.put('/settings/payment', async (req, res) => {
  try {
    const payload = req.body?.payment || req.body || {};
    const moyasarPayload = payload?.moyasar || {};
    const applePayPayload = payload?.applePay || {};
    const stcPayPayload = payload?.stcPay || {};
    const tabbyPayload = payload?.tabby || {};
    const tamaraPayload = payload?.tamara || {};

    const settings = await getGlobalSettings();
    const currentPayment = settings?.payment?.toObject?.() || settings?.payment || {};
    const currentMoyasar = currentPayment?.moyasar || {};
    const currentApplePay = currentPayment?.applePay || {};
    const currentStcPay = currentPayment?.stcPay || {};
    const currentTabby = currentPayment?.tabby || {};
    const currentTamara = currentPayment?.tamara || {};

    // ── Moyasar ──
    const nextMoyasar = {
      enabled: moyasarPayload.enabled !== undefined ? moyasarPayload.enabled === true : currentMoyasar.enabled,
      publishableKey: String(moyasarPayload.publishableKey || currentMoyasar.publishableKey || '').trim(),
      environment: moyasarPayload.environment || currentMoyasar.environment || 'test',
    };

    if (moyasarPayload.secretKey !== undefined) {
      const trimmed = String(moyasarPayload.secretKey || '').trim();
      nextMoyasar.secretKey = trimmed || currentMoyasar.secretKey || '';
    } else {
      nextMoyasar.secretKey = currentMoyasar.secretKey || '';
    }

    if (moyasarPayload.webhookSecret !== undefined) {
      const trimmed = String(moyasarPayload.webhookSecret || '').trim();
      nextMoyasar.webhookSecret = trimmed || currentMoyasar.webhookSecret || '';
    } else {
      nextMoyasar.webhookSecret = currentMoyasar.webhookSecret || '';
    }

    // ── Apple Pay ──
    const nextApplePay = {
      enabled: applePayPayload.enabled !== undefined ? applePayPayload.enabled === true : currentApplePay.enabled,
      merchantId: String(applePayPayload.merchantId || currentApplePay.merchantId || '').trim(),
      merchantCertificatePath: String(applePayPayload.merchantCertificatePath || currentApplePay.merchantCertificatePath || '').trim(),
      merchantCertificateKeyPath: String(applePayPayload.merchantCertificateKeyPath || currentApplePay.merchantCertificateKeyPath || '').trim(),
      environment: applePayPayload.environment || currentApplePay.environment || 'test',
    };

    // ── STC Pay ──
    const nextStcPay = {
      enabled: stcPayPayload.enabled !== undefined ? stcPayPayload.enabled === true : currentStcPay.enabled,
      merchantId: String(stcPayPayload.merchantId || currentStcPay.merchantId || '').trim(),
      environment: stcPayPayload.environment || currentStcPay.environment || 'test',
    };

    if (stcPayPayload.apiKey !== undefined) {
      const trimmed = String(stcPayPayload.apiKey || '').trim();
      nextStcPay.apiKey = trimmed || currentStcPay.apiKey || '';
    } else {
      nextStcPay.apiKey = currentStcPay.apiKey || '';
    }

    // ── Tabby ──
    const nextTabby = {
      enabled: tabbyPayload.enabled !== undefined ? tabbyPayload.enabled === true : currentTabby.enabled,
      publicKey: String(tabbyPayload.publicKey || currentTabby.publicKey || '').trim(),
      merchantCode: String(tabbyPayload.merchantCode || currentTabby.merchantCode || '').trim(),
      environment: tabbyPayload.environment || currentTabby.environment || 'test',
    };

    if (tabbyPayload.secretKey !== undefined) {
      const trimmed = String(tabbyPayload.secretKey || '').trim();
      nextTabby.secretKey = trimmed || currentTabby.secretKey || '';
    } else {
      nextTabby.secretKey = currentTabby.secretKey || '';
    }

    // ── Tamara ──
    const nextTamara = {
      enabled: tamaraPayload.enabled !== undefined ? tamaraPayload.enabled === true : currentTamara.enabled,
      environment: tamaraPayload.environment || currentTamara.environment || 'test',
    };

    if (tamaraPayload.apiToken !== undefined) {
      const trimmed = String(tamaraPayload.apiToken || '').trim();
      nextTamara.apiToken = trimmed || currentTamara.apiToken || '';
    } else {
      nextTamara.apiToken = currentTamara.apiToken || '';
    }

    if (tamaraPayload.notificationToken !== undefined) {
      const trimmed = String(tamaraPayload.notificationToken || '').trim();
      nextTamara.notificationToken = trimmed || currentTamara.notificationToken || '';
    } else {
      nextTamara.notificationToken = currentTamara.notificationToken || '';
    }

    settings.payment = { moyasar: nextMoyasar, applePay: nextApplePay, stcPay: nextStcPay, tabby: nextTabby, tamara: nextTamara };
    settings.markModified('payment');
    await settings.save();

    res.json({
      payment: {
        moyasar: {
          enabled: nextMoyasar.enabled,
          publishableKey: nextMoyasar.publishableKey,
          hasSecretKey: !!nextMoyasar.secretKey,
          secretKeyMasked: maskSecret(nextMoyasar.secretKey),
          hasWebhookSecret: !!nextMoyasar.webhookSecret,
          webhookSecretMasked: maskSecret(nextMoyasar.webhookSecret),
          environment: nextMoyasar.environment,
        },
        applePay: {
          ...serializePaymentProvider(nextApplePay),
          merchantId: nextApplePay.merchantId,
          merchantCertificatePath: nextApplePay.merchantCertificatePath,
          merchantCertificateKeyPath: nextApplePay.merchantCertificateKeyPath,
        },
        stcPay: {
          ...serializePaymentProvider(nextStcPay),
          merchantId: nextStcPay.merchantId,
          hasApiKey: !!nextStcPay.apiKey,
          apiKeyMasked: maskSecret(nextStcPay.apiKey),
        },
        tabby: {
          ...serializePaymentProvider(nextTabby),
          publicKey: nextTabby.publicKey,
          merchantCode: nextTabby.merchantCode,
          hasSecretKey: !!nextTabby.secretKey,
          secretKeyMasked: maskSecret(nextTabby.secretKey),
        },
        tamara: {
          ...serializePaymentProvider(nextTamara),
          hasApiToken: !!nextTamara.apiToken,
          apiTokenMasked: maskSecret(nextTamara.apiToken),
          hasNotificationToken: !!nextTamara.notificationToken,
          notificationTokenMasked: maskSecret(nextTamara.notificationToken),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/settings/payment/test-connection
router.post('/settings/payment/test-connection', async (req, res) => {
  try {
    const { provider } = req.body;
    const settings = await getGlobalSettings();
    const payment = settings?.payment?.toObject?.() || settings?.payment || {};

    if (provider === 'moyasar') {
      const moyasar = payment?.moyasar || {};
      if (!moyasar.secretKey) return res.json({ ok: false, message: 'Moyasar secret key is not configured.' });
      try {
        const response = await fetch('https://api.moyasar.com/v1/payments?per_page=1', {
          method: 'GET',
          headers: { 'Authorization': `Basic ${Buffer.from(moyasar.secretKey + ':').toString('base64')}` },
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          return res.json({ ok: true, message: 'Moyasar connection successful — API key is valid.' });
        }
        const body = await response.json().catch(() => ({}));
        return res.json({ ok: false, message: `Moyasar API returned ${response.status}: ${body?.message || response.statusText}` });
      } catch (err) {
        return res.json({ ok: false, message: err.message || 'Could not reach Moyasar API.' });
      }
    }

    if (provider === 'applePay') {
      const applePay = payment?.applePay || {};
      if (!applePay.merchantId) return res.json({ ok: false, message: 'Apple Pay merchant ID is not configured.' });
      // Apple Pay requires domain verification — we check that the merchant ID format is valid
      const merchantIdValid = /^merchant\.[a-zA-Z0-9.-]+$/i.test(applePay.merchantId) || applePay.merchantId.length > 5;
      if (!merchantIdValid) return res.json({ ok: false, message: 'Apple Pay merchant ID format looks invalid.' });
      return res.json({ ok: true, message: 'Apple Pay merchant ID format is valid. Full verification happens at checkout time.' });
    }

    if (provider === 'stcPay') {
      const stcPay = payment?.stcPay || {};
      if (!stcPay.apiKey) return res.json({ ok: false, message: 'STC Pay API key is not configured.' });
      const baseUrl = stcPay.environment === 'live'
        ? 'https://bpay.stcpay.com.sa/BusinessPayment/v1/BusinessPayments'
        : 'https://bpaystgtest.stcpay.com.sa/BusinessPayment/v1/BusinessPayments';
      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Code': stcPay.merchantId || '',
            'X-Client-Password': stcPay.apiKey || '',
          },
          body: JSON.stringify({ testConnection: true }),
          signal: AbortSignal.timeout(8000),
        });
        // STC Pay may return 400 for test payload but still confirm connectivity
        if (response.status < 500) {
          return res.json({ ok: true, message: `STC Pay endpoint reachable (HTTP ${response.status}). Credentials will be verified on first transaction.` });
        }
        return res.json({ ok: false, message: `STC Pay API returned ${response.status}.` });
      } catch (err) {
        return res.json({ ok: false, message: err.message || 'Could not reach STC Pay API.' });
      }
    }

    if (provider === 'tabby') {
      const tabby = payment?.tabby || {};
      if (!tabby.secretKey) return res.json({ ok: false, message: 'Tabby secret key is not configured.' });
      try {
        const response = await fetch('https://api.tabby.ai/api/v2/payments?limit=1', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tabby.secretKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok || response.status === 404) {
          return res.json({ ok: true, message: 'Tabby connection successful — API key is valid.' });
        }
        const body = await response.json().catch(() => ({}));
        return res.json({ ok: false, message: `Tabby API returned ${response.status}: ${body?.error || response.statusText}` });
      } catch (err) {
        return res.json({ ok: false, message: err.message || 'Could not reach Tabby API.' });
      }
    }

    if (provider === 'tamara') {
      const tamara = payment?.tamara || {};
      if (!tamara.apiToken) return res.json({ ok: false, message: 'Tamara API token is not configured.' });
      const baseUrl = tamara.environment === 'live'
        ? 'https://api.tamara.co'
        : 'https://api-sandbox.tamara.co';
      try {
        const response = await fetch(`${baseUrl}/merchants/payment-types`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tamara.apiToken}` },
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          return res.json({ ok: true, message: 'Tamara connection successful — API token is valid.' });
        }
        const body = await response.json().catch(() => ({}));
        return res.json({ ok: false, message: `Tamara API returned ${response.status}: ${body?.message || response.statusText}` });
      } catch (err) {
        return res.json({ ok: false, message: err.message || 'Could not reach Tamara API.' });
      }
    }

    return res.status(400).json({ error: 'Unknown provider. Use moyasar, applePay, stcPay, tabby, or tamara.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/super-admin/demo-users/:id/upgrade
router.post('/demo-users/:id/upgrade', async (req, res) => {
  try {
    const { plan = 'professional', billingCycle = 'monthly' } = req.body;

    const demoUser = await DemoUser.findById(req.params.id);
    if (!demoUser) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

    await Tenant.findByIdAndUpdate(demoUser.tenantId, {
      isDemo: false,
      demoUpgraded: true,
      'subscription.plan': plan,
      'subscription.status': 'active',
      'subscription.startDate': now,
      'subscription.endDate': endDate,
      'subscription.billingCycle': billingCycle,
    });

    demoUser.isUpgraded = true;
    demoUser.upgradedAt = now;
    demoUser.plan = plan;
    demoUser.billingCycle = billingCycle;
    await demoUser.save();

    res.json({ success: true, demoUser });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// --- Khayyat Customer CSV Import ---
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]?.trim()] = (values[j] || '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// @route   POST /api/super-admin/tenants/:id/seed-khayyat-customers
// @desc    Bulk import khayyat customers from CSV file
router.post('/tenants/:id/seed-khayyat-customers', csvUpload.single('file'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvText = req.file.buffer.toString('utf-8');
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or has no data rows' });
    }

    const tenantId = tenant._id;
    let imported = 0;
    let skipped = 0;
    const errors = [];
    const batchSize = 500;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const ops = [];

      for (const row of batch) {
        const name = (row.CusName || '').trim();
        const customerCode = (row.CusId || '').trim();
        if (!name || !customerCode) {
          skipped++;
          continue;
        }

        const phone = (row.TelNo || '').trim();
        const hijriDate = (row.FaxNo || '').trim();
        const receiptNumbers = (row.Address || '').trim();
        const notes = (row.Notes || '').trim();

        ops.push({
          updateOne: {
            filter: { tenantId, customerCode },
            update: {
              $set: {
                tenantId,
                name,
                customerCode,
                phone,
                khayyatHijriDate: hijriDate,
                khayyatReceiptNumbers: receiptNumbers,
                notes: notes || undefined,
                isActive: true,
                type: 'individual',
              },
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        });
      }

      if (ops.length > 0) {
        try {
          const result = await Customer.bulkWrite(ops, { ordered: false });
          imported += (result.upsertedCount || 0) + (result.modifiedCount || 0);
        } catch (err) {
          errors.push(`Batch ${i / batchSize}: ${err.message}`);
        }
      }
    }

    res.json({
      message: `Import complete: ${imported} customers processed, ${skipped} skipped`,
      imported,
      skipped,
      total: rows.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/super-admin/tenants/:id/khayyat-customers
// @desc    Search khayyat customers by name or receipt number
router.get('/tenants/:id/khayyat-customers', async (req, res) => {
  try {
    const { q = '', page = 1, limit = 50 } = req.query;
    const tenantId = req.params.id;

    const query = { tenantId, isActive: true };

    if (q && String(q).trim().length >= 1) {
      const cleanQ = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: cleanQ, $options: 'i' } },
        { nameAr: { $regex: cleanQ, $options: 'i' } },
        { customerCode: { $regex: cleanQ, $options: 'i' } },
        { phone: { $regex: cleanQ, $options: 'i' } },
        { khayyatReceiptNumbers: { $regex: cleanQ, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const customers = await Customer.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('customerCode name phone khayyatReceiptNumbers khayyatHijriDate notes createdAt');

    const total = await Customer.countDocuments(query);

    res.json({
      customers,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/super-admin/tenants/:id/khayyat-customers/stats
// @desc    Get stats for khayyat customers
router.get('/tenants/:id/khayyat-customers/stats', async (req, res) => {
  try {
    const tenantId = req.params.id;
    const total = await Customer.countDocuments({ tenantId, isActive: true });
    const withReceipts = await Customer.countDocuments({ tenantId, isActive: true, khayyatReceiptNumbers: { $ne: '', $exists: true } });
    res.json({ total, withReceipts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


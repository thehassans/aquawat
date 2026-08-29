/**
 * Safe auth/tenant payloads for login, /me, and app-store responses.
 * Never include private keys, CSIDs, SMTP passwords, or integration secrets.
 */

const SENSITIVE_KEY_RE = /^(password|secret|token|apiKey|apiSecret|privateKey|clientSecret|accessToken|refreshToken|smtpPass|brevoApiKey|webhookSecret|notificationToken|secretKey|complianceCsid|productionCsid|twilioAuthToken|unifonicToken|customApiKey)$/i;

const deepSanitize = (value) => {
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (!value || typeof value !== 'object') return value;

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`] = Boolean(child);
      continue;
    }
    out[key] = deepSanitize(child);
  }
  return out;
};

export const serializeZatcaForAuth = (zatca) => {
  if (!zatca) return null;
  return {
    phase: zatca.phase || 1,
    isOnboarded: Boolean(zatca.isOnboarded),
    environment: zatca.environment || 'sandbox',
    invoiceCounter: zatca.invoiceCounter || 0,
    onboardedAt: zatca.onboardedAt || null,
    hasPrivateKey: Boolean(zatca.privateKey),
    hasComplianceCsid: Boolean(zatca.complianceCsid),
    hasProductionCsid: Boolean(zatca.productionCsid),
    hasLastInvoiceHash: Boolean(zatca.lastInvoiceHash),
  };
};

export const serializeNbrForAuth = (nbr) => {
  if (!nbr) return null;
  return {
    isEnabled: nbr.isEnabled !== false,
    isOnboarded: Boolean(nbr.isOnboarded),
    binNumber: nbr.binNumber || '',
    vatRegistrationNumber: nbr.vatRegistrationNumber || '',
    mushakForm: nbr.mushakForm || '6.3',
    defaultVatRate: nbr.defaultVatRate ?? 15,
    autoGenerateQr: nbr.autoGenerateQr !== false,
    environment: nbr.environment || 'sandbox',
    apiBaseUrl: nbr.apiBaseUrl || '',
    connectionStatus: nbr.connectionStatus || 'disconnected',
    lastSyncAt: nbr.lastSyncAt || null,
    onboardedAt: nbr.onboardedAt || null,
    invoiceCounter: nbr.invoiceCounter || 0,
    hasApiKey: Boolean(nbr.apiKey),
    hasApiSecret: Boolean(nbr.apiSecret),
  };
};

export const serializeFbrForAuth = (fbr) => {
  if (!fbr) return null;
  return {
    isEnabled: fbr.isEnabled !== false,
    isOnboarded: Boolean(fbr.isOnboarded),
    ntn: fbr.ntn || '',
    strn: fbr.strn || '',
    cnic: fbr.cnic || '',
    posId: fbr.posId || '',
    scenarioId: fbr.scenarioId || '',
    province: fbr.province || 'Sindh',
    defaultHsCode: fbr.defaultHsCode || '0000.0000',
    defaultSalesTaxRate: fbr.defaultSalesTaxRate ?? 18,
    autoGenerateQr: fbr.autoGenerateQr !== false,
    autoSubmit: fbr.autoSubmit !== false,
    environment: fbr.environment || 'sandbox',
    apiBaseUrl: fbr.apiBaseUrl || '',
    connectionStatus: fbr.connectionStatus || 'disconnected',
    lastSyncAt: fbr.lastSyncAt || null,
    onboardedAt: fbr.onboardedAt || null,
    invoiceCounter: fbr.invoiceCounter || 0,
    hasApiToken: Boolean(fbr.apiToken || fbr.apiKey),
  };
};

export const serializeAuthTenant = (tenant) => {
  if (!tenant) return null;

  const source = typeof tenant.toObject === 'function' ? tenant.toObject() : tenant;
  const businessRaw = source.business && typeof source.business === 'object'
    ? (typeof source.business.toObject === 'function' ? source.business.toObject() : source.business)
    : {};

  return {
    _id: source._id,
    name: source.name,
    slug: source.slug,
    businessType: source.businessType,
    businessTypes: source.businessTypes,
    business: businessRaw,
    settings: deepSanitize(source.settings || {}),
    branding: source.branding,
    subscription: source.subscription,
    terminationNotice: source.terminationNotice,
    isActive: source.isActive,
    isDemo: Boolean(source.isDemo),
    demoTrialEndsAt: source.demoTrialEndsAt || null,
    demoUpgraded: Boolean(source.demoUpgraded),
    zatca: serializeZatcaForAuth(source.zatca),
    nbr: serializeNbrForAuth(source.nbr),
    fbr: serializeFbrForAuth(source.fbr),
  };
};

export default serializeAuthTenant;

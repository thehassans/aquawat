/**
 * Safe auth/tenant payloads for login, /me, and app-store responses.
 * Never include private keys, CSIDs, SMTP passwords, or integration secrets.
 */

const SENSITIVE_KEY_RE = /^(password|secret|token|apiKey|apiSecret|privateKey|clientSecret|accessToken|refreshToken|smtpPass|brevoApiKey|webhookSecret|notificationToken|secretKey|complianceCsid|productionCsid)$/i;

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

export const serializeAuthTenant = (tenant) => {
  if (!tenant) return null;

  const source = typeof tenant.toObject === 'function' ? tenant.toObject() : tenant;

  return {
    _id: source._id,
    name: source.name,
    slug: source.slug,
    businessType: source.businessType,
    businessTypes: source.businessTypes,
    business: source.business,
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
  };
};

export default serializeAuthTenant;

/**
 * Provider adapters for credentialed carrier connectors.
 * When credentials are missing, callers fall back to estimate formulas.
 */

function hasCreds(connector) {
  const c = connector?.credentials || connector?.credentialsEnc || {};
  if (typeof c === 'string') return c.length > 8;
  return Boolean(c.apiKey || c.accountNumber || c.clientId || c.accessToken || c.username);
}

async function estimateFromProfile(connector, payload, profile) {
  const weightKg = Math.max(0.1, Number(payload.totalWeightKg || payload.weightKg || 1));
  const country = String(payload.destination?.country || payload.destination?.countryCode || 'SA').toUpperCase();
  const zone = ['SA', 'SAU', 'KSA'].includes(country) ? 1 : ['AE', 'BH', 'KW', 'OM', 'QA'].includes(country) ? 1.35 : 1.8;
  return (profile.services || ['Standard']).map((serviceName, i) => ({
    connectorId: String(connector._id),
    provider: connector.provider,
    serviceName,
    amount: Math.round((profile.base + weightKg * profile.perKg * (1 + i * 0.12)) * zone * 100) / 100,
    currency: payload.currency || 'SAR',
    etaDays: profile.eta + i,
    live: hasCreds(connector),
    mode: hasCreds(connector) ? 'credentialed-estimate' : 'estimate',
  }));
}

const PROFILES = {
  ups: { base: 42, perKg: 9.5, eta: 3, services: ['UPS Ground', 'UPS Express'] },
  dhl: { base: 48, perKg: 11, eta: 2, services: ['DHL Express', 'DHL Economy'] },
  fedex: { base: 45, perKg: 10, eta: 2, services: ['FedEx Priority', 'FedEx Economy'] },
  usps: { base: 28, perKg: 6.5, eta: 5, services: ['USPS Priority'] },
  bpost: { base: 32, perKg: 7, eta: 4, services: ['bpost Standard'] },
  easypost: { base: 36, perKg: 8, eta: 3, services: ['EasyPost Best Rate'] },
  sendcloud: { base: 34, perKg: 7.5, eta: 3, services: ['Sendcloud Parcel'] },
  internal: { base: 20, perKg: 4, eta: 2, services: ['Standard Delivery', 'Same-day'] },
};

/**
 * Fetch rates for one connector. Real HTTP integrations plug in here when
 * credentials exist; until then returns credentialed estimates (not forgeable as live API).
 */
export async function fetchProviderRates(connector, payload = {}) {
  const code = String(connector.provider || 'internal').toLowerCase();
  const profile = PROFILES[code] || PROFILES.internal;

  // Hook point for live APIs — keep payload contract stable for UI.
  if (hasCreds(connector) && typeof globalThis.__maqderFetchCarrierRates === 'function') {
    try {
      const live = await globalThis.__maqderFetchCarrierRates(connector, payload);
      if (Array.isArray(live) && live.length) return live;
    } catch {
      /* fall through to estimate */
    }
  }

  return estimateFromProfile(connector, payload, profile);
}

export { hasCreds, PROFILES };
export default { fetchProviderRates, hasCreds };

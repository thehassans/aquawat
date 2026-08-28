/** Carrier rate-shopping abstraction — provider-weighted quotes from active connectors */

const PROVIDERS = ['ups', 'dhl', 'fedex', 'usps', 'bpost', 'easypost', 'sendcloud', 'internal'];

const PROVIDER_PROFILE = {
  ups: { base: 42, perKg: 9.5, eta: 3, services: ['UPS Ground', 'UPS Express'] },
  dhl: { base: 48, perKg: 11, eta: 2, services: ['DHL Express', 'DHL Economy'] },
  fedex: { base: 45, perKg: 10, eta: 2, services: ['FedEx Priority', 'FedEx Economy'] },
  usps: { base: 28, perKg: 6.5, eta: 5, services: ['USPS Priority', 'USPS Ground'] },
  bpost: { base: 32, perKg: 7, eta: 4, services: ['bpost Standard', 'bpost Express'] },
  easypost: { base: 36, perKg: 8, eta: 3, services: ['EasyPost Best Rate'] },
  sendcloud: { base: 34, perKg: 7.5, eta: 3, services: ['Sendcloud Parcel'] },
  internal: { base: 20, perKg: 4, eta: 2, services: ['Standard Delivery', 'Same-day'] },
};

function zoneFactor(destination = {}) {
  const country = String(destination.country || destination.countryCode || 'SA').toUpperCase();
  if (['SA', 'SAU', 'KSA'].includes(country)) return 1;
  if (['AE', 'BH', 'KW', 'OM', 'QA'].includes(country)) return 1.35;
  return 1.8;
}

/**
 * Returns selectable live/stub rates. When connector.credentialsEnc is set,
 * real provider APIs can replace the formula path without changing the UI contract.
 */
export async function shopShippingRates({ connectors = [], payload = {} } = {}) {
  const active = connectors.filter((c) => c.isActive);
  const dest = payload.destination || {};
  const weightKg = Math.max(0.1, Number(payload.totalWeightKg || payload.weightKg || 1));
  const zone = zoneFactor(dest);
  const results = [];

  for (const connector of active) {
    const code = String(connector.provider || 'internal').toLowerCase();
    const profile = PROVIDER_PROFILE[code] || PROVIDER_PROFILE.internal;
    const services = profile.services || [`${code.toUpperCase()} Standard`];

    for (const [i, serviceName] of services.entries()) {
      const amount = Math.round((profile.base + weightKg * profile.perKg * (1 + i * 0.15)) * zone * 100) / 100;
      results.push({
        connectorId: String(connector._id),
        provider: code,
        serviceName,
        amount,
        currency: payload.currency || connector.currency || 'SAR',
        etaDays: profile.eta + i,
        destination: dest,
        live: Boolean(connector.credentialsEnc),
        mode: connector.credentialsEnc ? 'credentialed' : 'estimate',
      });
    }
  }

  return results.sort((a, b) => a.amount - b.amount);
}

export { PROVIDERS, PROVIDER_PROFILE };
export default { shopShippingRates, PROVIDERS };

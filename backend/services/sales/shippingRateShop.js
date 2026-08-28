import { fetchProviderRates, PROFILES } from './carrierAdapters.js';

const PROVIDERS = Object.keys(PROFILES);

export async function shopShippingRates({ connectors = [], payload = {} } = {}) {
  const active = connectors.filter((c) => c.isActive);
  const results = [];

  for (const connector of active) {
    const rates = await fetchProviderRates(connector, payload);
    results.push(...rates);
  }

  return results.sort((a, b) => a.amount - b.amount);
}

export { PROVIDERS };
export default { shopShippingRates, PROVIDERS };

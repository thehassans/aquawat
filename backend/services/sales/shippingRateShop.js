/** Carrier rate-shopping abstraction — returns mock/live rates per active connector */

const PROVIDERS = ['ups', 'dhl', 'fedex', 'usps', 'bpost', 'easypost', 'sendcloud', 'internal'];

export async function shopShippingRates({ connectors = [], payload = {} } = {}) {
  const active = connectors.filter((c) => c.isActive);
  const dest = payload.destination || {};
  const weightKg = Number(payload.totalWeightKg || 1);
  const results = [];

  for (const connector of active) {
    const base = connector.provider === 'internal' ? 25 : 35 + weightKg * 8;
    results.push({
      connectorId: String(connector._id),
      provider: connector.provider,
      serviceName: connector.provider === 'internal' ? 'Standard Delivery' : `${connector.provider.toUpperCase()} Express`,
      amount: Math.round(base * 100) / 100,
      currency: payload.currency || 'SAR',
      etaDays: connector.provider === 'internal' ? 2 : 3,
      destination: dest,
    });
  }

  return results.sort((a, b) => a.amount - b.amount);
}

export { PROVIDERS };
export default { shopShippingRates, PROVIDERS };

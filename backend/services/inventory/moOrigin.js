/**
 * Manufacturing order origin: MO:productId[:variantId][:qty]
 * variantId may be empty when the finished good has no variant matrix.
 */
export function parseMoOrigin(origin) {
  if (!origin || typeof origin !== 'string' || !origin.startsWith('MO:')) return null;
  const parts = origin.slice(3).split(':');
  const productId = parts[0];
  if (!productId) return null;

  if (parts.length === 1) {
    return { productId, variantId: null, qty: '1' };
  }
  if (parts.length === 2) {
    const second = parts[1];
    if (!second) return { productId, variantId: null, qty: '1' };
    if (/^[a-f0-9]{24}$/i.test(second)) {
      return { productId, variantId: second, qty: '1' };
    }
    return { productId, variantId: null, qty: second };
  }

  return {
    productId,
    variantId: parts[1] || null,
    qty: parts[2] || '1',
  };
}

export function formatMoOrigin({ productId, variantId, qty }) {
  if (!productId) return '';
  const q = qty != null && qty !== '' ? String(qty) : '1';
  return `MO:${productId}:${variantId || ''}:${q}`;
}

export function moProduceOrigin(consumeTransferId) {
  return `MO-produce:${consumeTransferId}`;
}

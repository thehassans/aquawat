/**
 * Pure helpers for delivered invoicing policy (unit-tested without Mongo).
 */
export function clampInvoiceLinesToDelivered(lineItems = [], deliveredMap = new Map()) {
  const warnings = [];
  const adjusted = [];

  for (const line of lineItems) {
    if (!line.productId) {
      adjusted.push(line);
      continue;
    }
    if ((line.productType || 'goods') === 'service') {
      adjusted.push(line);
      continue;
    }

    const key = `${line.productId}:${line.variantId || ''}`;
    const maxQty = Number(deliveredMap.get(key) ?? 0);
    const requested = Number(line.quantity || 0);

    if (maxQty <= 0) {
      warnings.push(`No delivered quantity for ${line.productName || line.productId} — line skipped`);
      continue;
    }

    if (requested > maxQty) {
      warnings.push(
        `Quantity for ${line.productName || line.productId} reduced from ${requested} to ${maxQty} (delivered)`,
      );
    }

    adjusted.push({ ...line, quantity: Math.min(requested, maxQty) });
  }

  return { adjusted, warnings };
}

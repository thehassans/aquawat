/**
 * Resolve unit price from pricelist item rules (volume / formula / fixed / %).
 * Full SO hierarchy (manual → promo → contract → volume → UoM → FX → catalog)
 * is applied in POST /sales/pricing/resolve.
 */
export function evaluatePriceRules({ basePrice = 0, cost = 0, quantity = 1, rules = [], fixedPrice = null }) {
  if (fixedPrice != null && Number.isFinite(Number(fixedPrice))) {
    return Number(fixedPrice);
  }

  const now = Date.now();
  const applicable = rules
    .filter((r) => {
      if (r.validFrom && new Date(r.validFrom).getTime() > now) return false;
      if (r.validTo && new Date(r.validTo).getTime() < now) return false;
      const min = Number(r.minQuantity || 0);
      const max = r.maxQuantity != null ? Number(r.maxQuantity) : Infinity;
      return quantity >= min && quantity <= max;
    })
    .sort((a, b) => Number(b.minQuantity || 0) - Number(a.minQuantity || 0));

  const rule = applicable[0];
  if (!rule) return Number(basePrice);

  if (rule.ruleType === 'formula' && rule.formula) {
    try {
      const expr = String(rule.formula)
        .replace(/\bcost\b/gi, String(cost))
        .replace(/\bprice\b/gi, String(basePrice))
        .replace(/\bqty\b/gi, String(quantity));
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${expr})`);
      const val = Number(fn());
      if (Number.isFinite(val) && val >= 0) return val;
    } catch {
      /* fall through */
    }
  }

  if (rule.fixedPrice != null) return Number(rule.fixedPrice);
  if (rule.discountPercent != null) {
    return Math.max(0, basePrice * (1 - Number(rule.discountPercent) / 100));
  }

  return Number(basePrice);
}

export function resolvePricelistItemPrice(item, { basePrice = 0, cost = 0, quantity = 1 } = {}) {
  if (!item) return Number(basePrice);
  return evaluatePriceRules({
    basePrice,
    cost,
    quantity,
    rules: item.rules || [],
    fixedPrice: item.fixedPrice,
  });
}

export default { evaluatePriceRules, resolvePricelistItemPrice };

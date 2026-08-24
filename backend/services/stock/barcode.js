/**
 * Match a scanned barcode against nomenclature rules (first matching pattern by sequence).
 * Patterns support simple tokens: .* and digit ranges like \d{12}
 */
export function matchBarcode(nomenclature, barcode) {
  const code = String(barcode || '').trim();
  if (!code || !nomenclature?.rules?.length) {
    return { type: 'product', value: code, matched: false };
  }

  const rules = [...nomenclature.rules].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  for (const rule of rules) {
    try {
      const re = new RegExp(`^${rule.pattern}$`);
      const m = code.match(re);
      if (m) {
        return {
          type: rule.type,
          value: code,
          matched: true,
          ruleName: rule.name,
          groups: m.slice(1),
        };
      }
    } catch {
      // invalid pattern — skip
    }
  }
  return { type: 'product', value: code, matched: false };
}

export function defaultBarcodeRules() {
  return [
    { name: 'EAN13', sequence: 10, type: 'product', encoding: 'ean13', pattern: '\\d{13}' },
    { name: 'EAN8', sequence: 20, type: 'product', encoding: 'ean8', pattern: '\\d{8}' },
    { name: 'Lot prefix', sequence: 30, type: 'lot', encoding: 'any', pattern: '10(.+)' },
    { name: 'Location prefix', sequence: 40, type: 'location', encoding: 'any', pattern: 'LOC(.+)' },
  ];
}

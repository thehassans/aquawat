/**
 * Weight-embedded barcode parsing for PoS inventory transfers.
 *
 * Matches:
 *   ^21\d{5}\d{5}$     — 12-digit (prefix + item + weight)
 *   ^21\d{5}\d{5}\d$   — EAN-13 with check digit
 *
 * Weight digits are interpreted as grams → kg (01250 → 1.25 kg).
 */

const WEIGHT_RE = /^21(\d{5})(\d{5})\d?$/

/**
 * @param {string} raw
 * @returns {{ kind: 'weight', itemCode: string, weightKg: number, raw: string }
 *          | { kind: 'standard', code: string }
 *          | null}
 */
export function parsePosBarcode(raw) {
  const code = String(raw || '').trim()
  if (!code) return null

  const m = code.match(WEIGHT_RE)
  if (m) {
    const itemCode = m[1]
    const weightRaw = parseInt(m[2], 10)
    if (!Number.isFinite(weightRaw) || weightRaw <= 0) {
      return { kind: 'standard', code }
    }
    const weightKg = weightRaw / 1000
    return { kind: 'weight', itemCode, weightKg, raw: code }
  }

  return { kind: 'standard', code }
}

/**
 * Find a product matching a 5-digit scale item code against sku / barcode.
 */
export function matchProductByItemCode(products, itemCode) {
  const needle = String(itemCode || '')
  if (!needle) return null
  const list = Array.isArray(products) ? products : []
  return list.find((p) => {
    const barcode = String(p.barcode || p.primaryBarcode || '')
    const sku = String(p.sku || '')
    return (
      barcode === needle
      || barcode.startsWith(needle)
      || barcode.endsWith(needle)
      || sku === needle
      || sku.endsWith(needle)
    )
  }) || null
}

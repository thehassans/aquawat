/**
 * Format a money amount for display.
 * null / undefined / NaN → em dash (never silent 0.00 on missing data).
 */
export function fmtMoney(value, { digits = 2, empty = '—' } = {}) {
  if (value == null || value === '') return empty
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return empty
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function isMissingMoney(value) {
  if (value == null || value === '') return true
  const n = typeof value === 'number' ? value : Number(value)
  return !Number.isFinite(n)
}

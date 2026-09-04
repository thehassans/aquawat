/**
 * Calendar date-only helpers (YYYY-MM-DD).
 * Never use Date#toISOString().slice(0,10) for local wall dates — that shifts days across timezones.
 */

export function extractDateOnly(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (y && m && day) return `${y}-${m}-${day}`
  } catch {
    /* fall through */
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysToDateOnly(dateOnly, days) {
  const base = extractDateOnly(dateOnly)
  if (!base) return null
  const [y, m, d] = base.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d + Number(days || 0))
  const dt = new Date(utc)
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function endOfMonthDateOnly(dateOnly) {
  const base = extractDateOnly(dateOnly)
  if (!base) return null
  const [y, m] = base.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export function dateOnlyToUtcNoon(dateOnly) {
  const base = extractDateOnly(dateOnly)
  if (!base) return null
  const [y, m, d] = base.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
}

export function compareDateOnly(a, b) {
  const left = extractDateOnly(a)
  const right = extractDateOnly(b)
  if (!left || !right) return 0
  if (left === right) return 0
  return left < right ? -1 : 1
}

/** Format YYYY-MM-DD for UI without timezone day-shift. */
export function formatDateOnlyDisplay(value, locale = 'en-GB') {
  const only = extractDateOnly(value)
  if (!only) return ''
  const [y, m, d] = only.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(locale, { timeZone: 'UTC' })
}

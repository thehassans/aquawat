/** Invoice date display — Gregorian, Hijri, or both (tenant setting). */

export const INVOICE_DATE_CALENDAR_OPTIONS = [
  { value: 'gregorian', labelEn: 'Gregorian (English calendar)', labelAr: 'التقويم الميلادي' },
  { value: 'hijri', labelEn: 'Hijri (Islamic calendar)', labelAr: 'التقويم الهجري' },
  { value: 'both', labelEn: 'Both calendars', labelAr: 'التقويمان معاً' },
]

export function resolveInvoiceDateCalendar(tenant) {
  const explicit = tenant?.settings?.invoiceDateCalendar
  if (explicit && INVOICE_DATE_CALENDAR_OPTIONS.some((o) => o.value === explicit)) {
    return explicit
  }
  return tenant?.settings?.useHijriDates === false ? 'gregorian' : 'both'
}

export function formatGregorianDate(value, language = 'en', { includeTime = false, timeZone = 'Asia/Riyadh' } = {}) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const opts = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }
  if (includeTime) {
    opts.hour = '2-digit'
    opts.minute = '2-digit'
  }
  return d.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', opts)
}

export function formatHijriDate(value, language = 'ar', hijriFallback = '') {
  if (hijriFallback) return hijriFallback
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return d.toLocaleDateString(language === 'ar' ? 'ar-SA-u-ca-islamic' : 'en-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

/**
 * @param {Date|string} value
 * @param {{ mode?: 'gregorian'|'hijri'|'both', language?: string, hijriValue?: string, includeTime?: boolean, timeZone?: string }} options
 */
export function formatInvoiceDateDisplay(value, options = {}) {
  const {
    mode = 'both',
    language = 'en',
    hijriValue = '',
    includeTime = false,
    timeZone = 'Asia/Riyadh',
  } = options

  const gregorian = formatGregorianDate(value, language, { includeTime, timeZone })
  const hijri = formatHijriDate(value, language, hijriValue)

  if (mode === 'gregorian') return gregorian
  if (mode === 'hijri') return hijri
  if (gregorian === '—' && hijri !== '—') return hijri
  if (hijri === '—' || gregorian === hijri) return gregorian
  return language === 'ar'
    ? `${hijri}\n${gregorian}`
    : `${gregorian}\n${hijri}`
}

/** Saudi VAT: exactly 15 digits, starts with 3, ends with 3. */

/** Strip spaces / dashes / Arabic-Indic digits to ASCII digits. */
export function normalizeSaudiVatDigits(v) {
  const mapped = String(v || '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
  return mapped.replace(/\D/g, '')
}

export function isValidSaudiVat(v) {
  return /^3\d{13}3$/.test(normalizeSaudiVatDigits(v))
}

/** Empty allowed; if present must be valid. */
export function isEmptyOrValidSaudiVat(v) {
  const raw = normalizeSaudiVatDigits(v)
  if (!raw) return true
  return isValidSaudiVat(raw)
}

export function saudiVatErrorMessage(language = 'en') {
  return language === 'ar'
    ? 'الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بـ 3'
    : 'VAT number must be 15 digits and start/end with 3'
}

export function assertSaudiVat(v, { required = false, language = 'en' } = {}) {
  const raw = normalizeSaudiVatDigits(v)
  if (!raw) {
    if (required) {
      const err = new Error(language === 'ar' ? 'الرقم الضريبي مطلوب' : 'VAT number is required')
      err.code = 'VAT_REQUIRED'
      err.status = 400
      throw err
    }
    return ''
  }
  if (!isValidSaudiVat(raw)) {
    const err = new Error(saudiVatErrorMessage(language))
    err.code = 'VAT_INVALID'
    err.status = 400
    throw err
  }
  return raw
}

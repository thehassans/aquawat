/** Saudi VAT: exactly 15 digits, starts with 3, ends with 3. */

export function isValidSaudiVat(v) {
  return /^3\d{13}3$/.test(String(v || '').trim())
}

/** Empty allowed; if present must be valid. */
export function isEmptyOrValidSaudiVat(v) {
  const raw = String(v || '').trim()
  if (!raw) return true
  return isValidSaudiVat(raw)
}

export function saudiVatErrorMessage(language = 'en') {
  return language === 'ar'
    ? 'الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بـ 3'
    : 'VAT number must be 15 digits and start/end with 3'
}

export function assertSaudiVat(v, { required = false, language = 'en' } = {}) {
  const raw = String(v || '').trim()
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

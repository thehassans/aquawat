/**
 * Normalize inventory (and general API) error payloads for toast / UI.
 * Inventory APIs return `{ error: { code, message, messageAr } }` — never pass that object to React.
 */
export function pickApiErrorPayload(raw, language = 'en') {
  if (raw == null) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') {
    const ar = language === 'ar' || language === 'ar-SA'
    const msg = ar
      ? (raw.messageAr || raw.message || raw.code)
      : (raw.message || raw.messageAr || raw.code)
    return msg ? String(msg) : null
  }
  return String(raw)
}

export function formatInvError(err, language = 'en') {
  const ar = language === 'ar' || language === 'ar-SA'
  const data = err?.response?.data
  const nested = data?.error

  if (nested && typeof nested === 'object') {
    const msg = ar
      ? (nested.messageAr || nested.message || nested.code)
      : (nested.message || nested.messageAr || nested.code)
    if (msg) return String(msg)
  }

  if (typeof nested === 'string' && nested) return nested
  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof data?.error === 'string' && data.error) return data.error
  if (typeof err?.message === 'string' && err.message && err.message !== 'Error') return err.message
  return ar ? 'حدث خطأ' : 'Something went wrong'
}

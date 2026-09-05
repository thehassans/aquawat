/**
 * IBAN helpers — mirrors backend/utils/iban.js (Saudi + mod-97).
 */

const SA_IBAN_LEN = 24

export function normalizeIban(value = '') {
  return String(value || '').replace(/[\s\-]/g, '').toUpperCase()
}

export function isValidIbanChecksum(iban) {
  const compact = normalizeIban(iban)
  if (!compact) return true
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact)) return false
  if (compact.length < 15 || compact.length > 34) return false

  const rearranged = compact.slice(4) + compact.slice(0, 4)
  let expanded = ''
  for (const ch of rearranged) {
    if (ch >= 'A' && ch <= 'Z') expanded += String(ch.charCodeAt(0) - 55)
    else expanded += ch
  }

  let remainder = 0
  for (const digit of expanded) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function isValidSaudiIban(iban) {
  const compact = normalizeIban(iban)
  if (!compact) return true
  if (!compact.startsWith('SA')) return false
  if (compact.length !== SA_IBAN_LEN) return false
  if (!/^SA\d{22}$/.test(compact)) return false
  return isValidIbanChecksum(compact)
}

export function validateIban(iban, { required = false } = {}) {
  const compact = normalizeIban(iban)
  if (!compact) {
    if (required) return { ok: false, iban: '', error: 'IBAN is required' }
    return { ok: true, iban: '' }
  }

  if (compact.startsWith('SA')) {
    if (compact.length !== SA_IBAN_LEN) {
      return {
        ok: false,
        iban: compact,
        error: `Saudi IBAN must be ${SA_IBAN_LEN} characters (got ${compact.length})`,
      }
    }
    if (!/^SA\d{22}$/.test(compact)) {
      return { ok: false, iban: compact, error: 'Saudi IBAN must be SA followed by 22 digits' }
    }
    if (!isValidIbanChecksum(compact)) {
      return { ok: false, iban: compact, error: 'Invalid Saudi IBAN checksum (mod-97)' }
    }
    return { ok: true, iban: compact }
  }

  if (!isValidIbanChecksum(compact)) {
    return { ok: false, iban: compact, error: 'Invalid IBAN checksum (mod-97)' }
  }
  return { ok: true, iban: compact }
}

export function formatIbanDisplay(iban) {
  const compact = normalizeIban(iban)
  if (!compact) return ''
  return compact.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * IBAN helpers — Saudi focus (SA + mod-97), with generic ISO 13616 checksum.
 */

const SA_IBAN_LEN = 24;

/** Strip spaces / punctuation; uppercase. */
export function normalizeIban(value = '') {
  return String(value || '').replace(/[\s\-]/g, '').toUpperCase();
}

/**
 * ISO 13616 mod-97 check. Returns true when the IBAN checksum is valid.
 * Empty string is treated as "no IBAN" (valid for optional fields).
 */
export function isValidIbanChecksum(iban) {
  const compact = normalizeIban(iban);
  if (!compact) return true;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact)) return false;
  if (compact.length < 15 || compact.length > 34) return false;

  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let expanded = '';
  for (const ch of rearranged) {
    if (ch >= 'A' && ch <= 'Z') expanded += String(ch.charCodeAt(0) - 55);
    else expanded += ch;
  }

  // Incremental mod 97 to avoid BigInt dependency issues in older runtimes
  let remainder = 0;
  for (const digit of expanded) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/**
 * Saudi IBAN: SA + 2 check digits + 2 bank code + 18 BBAN = 24 chars.
 * Also enforces mod-97.
 */
export function isValidSaudiIban(iban) {
  const compact = normalizeIban(iban);
  if (!compact) return true;
  if (!compact.startsWith('SA')) return false;
  if (compact.length !== SA_IBAN_LEN) return false;
  if (!/^SA\d{22}$/.test(compact)) return false;
  return isValidIbanChecksum(compact);
}

/**
 * Validate a company/vendor IBAN.
 * - Empty → ok (optional)
 * - SA… → Saudi rules (length 24 + mod-97)
 * - Other country codes → length + mod-97 only
 */
export function validateIban(iban, { required = false, preferSaudi = true } = {}) {
  const compact = normalizeIban(iban);
  if (!compact) {
    if (required) {
      return { ok: false, iban: '', error: 'IBAN is required' };
    }
    return { ok: true, iban: '' };
  }

  if (preferSaudi || compact.startsWith('SA')) {
    if (!compact.startsWith('SA')) {
      // Allow non-SA when preferSaudi but still checksum-validate
      if (!isValidIbanChecksum(compact)) {
        return { ok: false, iban: compact, error: 'Invalid IBAN checksum (mod-97)' };
      }
      return { ok: true, iban: compact };
    }
    if (compact.length !== SA_IBAN_LEN) {
      return {
        ok: false,
        iban: compact,
        error: `Saudi IBAN must be ${SA_IBAN_LEN} characters (got ${compact.length})`,
      };
    }
    if (!/^SA\d{22}$/.test(compact)) {
      return { ok: false, iban: compact, error: 'Saudi IBAN must be SA followed by 22 digits' };
    }
    if (!isValidIbanChecksum(compact)) {
      return { ok: false, iban: compact, error: 'Invalid Saudi IBAN checksum (mod-97)' };
    }
    return { ok: true, iban: compact };
  }

  if (!isValidIbanChecksum(compact)) {
    return { ok: false, iban: compact, error: 'Invalid IBAN checksum (mod-97)' };
  }
  return { ok: true, iban: compact };
}

/** Format SA IBAN in groups of 4 for display. */
export function formatIbanDisplay(iban) {
  const compact = normalizeIban(iban);
  if (!compact) return '';
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

export default {
  normalizeIban,
  isValidIbanChecksum,
  isValidSaudiIban,
  validateIban,
  formatIbanDisplay,
};

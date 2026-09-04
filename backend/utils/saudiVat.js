/** Saudi VAT: exactly 15 digits, starts with 3, ends with 3. */

export function isValidSaudiVat(v) {
  return /^3\d{13}3$/.test(String(v || '').trim());
}

/** Empty allowed; if present must be valid. */
export function isEmptyOrValidSaudiVat(v) {
  const raw = String(v || '').trim();
  if (!raw) return true;
  return isValidSaudiVat(raw);
}

export function assertSaudiVat(v, { required = false } = {}) {
  const raw = String(v || '').trim();
  if (!raw) {
    if (required) {
      const err = new Error('VAT number is required');
      err.status = 400;
      err.code = 'VAT_REQUIRED';
      throw err;
    }
    return '';
  }
  if (!isValidSaudiVat(raw)) {
    const err = new Error('VAT number must be exactly 15 digits starting and ending with 3');
    err.status = 400;
    err.code = 'VAT_INVALID';
    throw err;
  }
  return raw;
}

/** @deprecated Prefer isValidSaudiVat / isEmptyOrValidSaudiVat */
export function isValidSaudiVatNumber(vat) {
  return isEmptyOrValidSaudiVat(vat);
}

/** @deprecated Prefer assertSaudiVat */
export function assertSaudiVatNumber(vat, opts) {
  return assertSaudiVat(vat, opts);
}

/** Saudi VAT: exactly 15 digits, starts with 3, ends with 3. */

/** Strip spaces / dashes / Arabic-Indic digits to ASCII digits. */
export function normalizeSaudiVatDigits(v) {
  const mapped = String(v || '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  return mapped.replace(/\D/g, '');
}

export function isValidSaudiVat(v) {
  return /^3\d{13}3$/.test(normalizeSaudiVatDigits(v));
}

/** Empty allowed; if present must be valid. */
export function isEmptyOrValidSaudiVat(v) {
  const raw = normalizeSaudiVatDigits(v);
  if (!raw) return true;
  return isValidSaudiVat(raw);
}

export function assertSaudiVat(v, { required = false } = {}) {
  const raw = normalizeSaudiVatDigits(v);
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

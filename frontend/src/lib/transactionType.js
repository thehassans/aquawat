/**
 * ZATCA B2B (standard) / B2C (simplified) from buyer VAT — not a manual print toggle.
 * Valid 15-digit Saudi VAT → Standard (B2B); otherwise Simplified (B2C).
 * Walk-in / Cash Customer → always Simplified.
 */

import { isValidSaudiVat, normalizeSaudiVatDigits } from './saudiVat'

export function isWalkInOrCashCustomer(party = {}) {
  if (!party) return true
  const code = String(party.customerCode || party.code || '').trim().toUpperCase()
  if (code === 'WALKIN' || code === 'WALK-IN' || code === 'CASH') return true
  const name = String(party.name || party.nameEn || '').toLowerCase()
  const nameAr = String(party.nameAr || '')
  if (
    name.includes('walk-in')
    || name.includes('walk in')
    || name.includes('cash customer')
    || name.includes('cash sale')
    || nameAr.includes('عميل نقدي')
  ) {
    return true
  }
  return false
}

export function partyVatDigits(party = {}) {
  return normalizeSaudiVatDigits(
    party?.vatNumber || party?.taxNumber || party?.vat || party?.trn || '',
  )
}

/** @deprecated Prefer VAT-based resolveTransactionTypeFromParty */
export function isBusinessParty(party = {}) {
  if (isWalkInOrCashCustomer(party)) return false
  return isValidSaudiVat(partyVatDigits(party))
}

/**
 * Auto-derive ZATCA transaction type from the selected customer.
 * @returns {'B2B'|'B2C'}
 */
export function resolveTransactionTypeFromParty(party, _fallback = 'B2C') {
  if (!party) return 'B2C'
  if (isWalkInOrCashCustomer(party)) return 'B2C'
  return isValidSaudiVat(partyVatDigits(party)) ? 'B2B' : 'B2C'
}

export function invoiceTypeCodeForTransaction(txn) {
  return txn === 'B2B' ? '0100000' : '0200000'
}

/** ZATCA document kind for labels / clearance vs reporting. */
export function zatcaInvoiceKindForTransaction(txn) {
  return txn === 'B2B' ? 'standard' : 'simplified'
}

/** @deprecated use zatcaInvoiceKindForTransaction */
export const zatcaInvoiceTypeForTransaction = zatcaInvoiceKindForTransaction

/** @deprecated use isWalkInOrCashCustomer */
export const isWalkInParty = isWalkInOrCashCustomer

export function partyHasValidVat(party = {}) {
  return isValidSaudiVat(partyVatDigits(party))
}

export function transactionTypeBadgeLabel(txn, language = 'en') {
  if (txn === 'B2B') {
    return language === 'ar' ? 'قياسية (B2B)' : 'Standard (B2B)'
  }
  return language === 'ar' ? 'مبسطة (B2C)' : 'Simplified (B2C)'
}

export function transactionTypeReasonLine(txn, { hasValidVat = false, isWalkIn = false, language = 'en' } = {}) {
  if (txn === 'B2B') {
    return language === 'ar'
      ? 'الرقم الضريبي للعميل موجود — فاتورة ضريبية قياسية'
      : 'Customer ka VAT number mojood hai — Standard Tax Invoice'
  }
  return language === 'ar'
    ? 'الرقم الضريبي للعميل غير موجود — فاتورة ضريبية مبسطة'
    : 'Customer ka VAT number nahi — Simplified Tax Invoice'
}

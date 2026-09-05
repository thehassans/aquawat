/**
 * ZATCA B2B / B2C derivation from buyer VAT (server-side mirror of frontend).
 */

import { isValidSaudiVat, normalizeSaudiVatDigits } from './saudiVat.js';

export function isWalkInOrCashCustomer(party = {}) {
  if (!party) return true;
  const code = String(party.customerCode || party.code || '').trim().toUpperCase();
  if (code === 'WALKIN' || code === 'WALK-IN' || code === 'CASH') return true;
  const name = String(party.name || party.nameEn || '').toLowerCase();
  const nameAr = String(party.nameAr || '');
  if (
    name.includes('walk-in')
    || name.includes('walk in')
    || name.includes('cash customer')
    || name.includes('cash sale')
    || nameAr.includes('عميل نقدي')
  ) {
    return true;
  }
  return false;
}

export function resolveTransactionTypeFromParty(party) {
  if (!party) return 'B2C';
  if (isWalkInOrCashCustomer(party)) return 'B2C';
  const vat = normalizeSaudiVatDigits(
    party?.vatNumber || party?.taxNumber || party?.vat || party?.trn || '',
  );
  return isValidSaudiVat(vat) ? 'B2B' : 'B2C';
}

export function invoiceTypeCodeForTransaction(txn) {
  return txn === 'B2B' ? '0100000' : '0200000';
}

export function zatcaInvoiceKindForTransaction(txn) {
  return String(txn || '').toUpperCase() === 'B2B' ? 'standard' : 'simplified';
}

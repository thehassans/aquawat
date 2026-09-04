import PurchaseOrder from '../../models/PurchaseOrder.js';
import Partner from '../../models/Partner.js';
import Invoice from '../../models/Invoice.js';
import { isValidSaudiVat, normalizeSaudiVatDigits } from '../../utils/saudiVat.js';
import { getPartnerBalances } from '../ledger/balances.js';

/**
 * Credit exposure = AR balance + uninvoiced confirmed sell orders + this SO total.
 * Returns { ok, exposure, creditLimit, code, error } — ok:false means hold required.
 */
export async function evaluateCustomerCredit({ tenantId, customerId, orderTotal, excludeOrderId = null }) {
  if (!customerId) {
    return { ok: true, exposure: 0, creditLimit: 0, skipped: true };
  }

  const partner = await Partner.findOne({ _id: customerId, tenantId })
    .select('creditLimit currentBalance name nameEn entityType type')
    .lean();
  if (!partner) {
    return { ok: true, exposure: 0, creditLimit: 0, skipped: true };
  }

  const creditLimit = Number(partner.creditLimit || 0);
  if (!(creditLimit > 0)) {
    return { ok: true, exposure: 0, creditLimit: 0, skipped: true, partner };
  }

  const partnerBal = await getPartnerBalances({
    tenantId,
    partnerType: 'customer',
    partnerIds: [customerId],
  });
  const open = (partnerBal.partners || []).find((p) => String(p.partnerId) === String(customerId));
  const arBalance = Math.max(0, Number(open?.openResidual ?? partner.currentBalance ?? 0));

  const confirmedStatuses = [
    'approved',
    'partially_delivered',
    'delivered',
    'pending_approval',
  ];
  const openOrders = await PurchaseOrder.find({
    tenantId,
    flow: 'sell',
    customerId,
    status: { $in: confirmedStatuses },
    ...(excludeOrderId ? { _id: { $ne: excludeOrderId } } : {}),
  })
    .select('grandTotal billedInvoiceId lineItems')
    .lean();

  let uninvoicedConfirmed = 0;
  for (const o of openOrders) {
    const remaining = (o.lineItems || []).reduce((sum, li) => {
      const ordered = Number(li.quantityOrdered || 0);
      const invoiced = Number(li.quantityInvoiced || 0);
      const unit = Number(li.unitCost || 0);
      const tax = Number(li.taxRate || 0) / 100;
      const openQty = Math.max(0, ordered - invoiced);
      return sum + openQty * unit * (1 + tax);
    }, 0);
    if (remaining > 0) uninvoicedConfirmed += remaining;
    else if (!o.billedInvoiceId) uninvoicedConfirmed += Number(o.grandTotal || 0);
  }

  const thisTotal = Number(orderTotal || 0);
  const exposure = arBalance + uninvoicedConfirmed + thisTotal;

  if (exposure > creditLimit) {
    return {
      ok: false,
      exposure,
      creditLimit,
      arBalance,
      uninvoicedConfirmed,
      thisTotal,
      partner,
      code: 'CREDIT_LIMIT_EXCEEDED',
      error: `Credit limit exceeded: exposure ${exposure.toFixed(2)} exceeds limit ${creditLimit.toFixed(2)}`,
    };
  }

  return {
    ok: true,
    exposure,
    creditLimit,
    arBalance,
    uninvoicedConfirmed,
    thisTotal,
    partner,
  };
}

/** B2B partners require VAT + CR before invoicing */
export function assertSellerAddressReady(address = {}, { requireVat = false, vatNumber = '' } = {}) {
  const addr = address && typeof address === 'object' ? address : {};
  const missing = [];
  if (!String(addr.street || addr.streetAr || '').trim()) missing.push('street');
  if (!String(addr.buildingNumber || '').trim()) missing.push('buildingNumber');
  if (!String(addr.district || addr.districtAr || '').trim()) missing.push('district');
  if (!String(addr.city || addr.cityAr || '').trim()) missing.push('city');
  if (!String(addr.postalCode || '').trim()) missing.push('postalCode');
  if (!String(addr.country || '').trim()) missing.push('country');
  if (requireVat) {
    const vat = normalizeSaudiVatDigits(vatNumber);
    if (!vat) missing.push('VAT number');
    else if (!isValidSaudiVat(vat)) {
      return {
        ok: false,
        code: 'INVALID_SELLER_VAT',
        error: 'Company VAT must be a valid 15-digit Saudi VAT number (starts and ends with 3). Update it under Company Profile.',
        missing: ['VAT number'],
      };
    }
  }
  if (missing.length) {
    return {
      ok: false,
      code: 'SELLER_ADDRESS_REQUIRED',
      error: `Seller address incomplete for ZATCA: ${missing.join(', ')}`,
      missing,
    };
  }
  return { ok: true };
}

export function assertB2bInvoiceReady(partnerOrBuyer = {}) {
  const name = String(partnerOrBuyer.name || partnerOrBuyer.nameEn || partnerOrBuyer.displayName || '').trim();
  const addr = partnerOrBuyer.address || {};
  const addressLine = typeof partnerOrBuyer.address === 'string'
    ? partnerOrBuyer.address.trim()
    : [
      addr.street, addr.street2, addr.buildingNumber, addr.district,
      addr.city, addr.state, addr.postalCode, addr.country,
    ].filter(Boolean).join(' ').trim();
  const vat = String(partnerOrBuyer.vatNumber || '').trim();
  const cr = String(partnerOrBuyer.crNumber || partnerOrBuyer.commercialRegistration?.crNumber || '').trim();
  const missing = [];
  if (!name) missing.push('Customer name');
  if (!vat) missing.push('VAT number');
  if (!cr) missing.push('CR number');
  // Address strongly recommended for ZATCA B2B; keep as hard requirement when company-like.
  const isCompany = Boolean(
    partnerOrBuyer.isCompany
    || partnerOrBuyer.entityType === 'business'
    || partnerOrBuyer.entityType === 'company'
    || partnerOrBuyer.type === 'company'
    || partnerOrBuyer.type === 'business'
    || vat
    || cr,
  );
  if (isCompany && !addressLine) missing.push('Address');
  if (missing.length) {
    return {
      ok: false,
      isCompany,
      code: 'B2B_IDENTITY_REQUIRED',
      error: `B2B tax invoice requires ${missing.join(', ')} before posting`,
      missing,
    };
  }
  if (!isValidSaudiVat(vat)) {
    return {
      ok: false,
      isCompany,
      code: 'INVALID_BUYER_VAT',
      error: 'B2B tax invoice requires a valid 15-digit Saudi customer VAT number (starts and ends with 3)',
      missing: ['VAT number'],
    };
  }
  return { ok: true, isCompany };
}

export async function sumInvoicedQtyForPoLine({ tenantId, sourcePoItemId }) {
  if (!sourcePoItemId) return 0;
  const invoices = await Invoice.find({
    tenantId,
    flow: 'sell',
    status: { $nin: ['draft', 'cancelled', 'credited'] },
    'lineItems.sourcePoItemId': sourcePoItemId,
  })
    .select('lineItems')
    .lean();
  let qty = 0;
  for (const inv of invoices) {
    for (const li of inv.lineItems || []) {
      if (String(li.sourcePoItemId) === String(sourcePoItemId)) {
        qty += Number(li.quantity || 0);
      }
    }
  }
  return qty;
}

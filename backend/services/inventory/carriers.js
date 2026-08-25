import InvDeliveryCarrier from '../../models/inventory/InvDeliveryCarrier.js';
import { D, decStr } from '../../utils/decimal.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

/**
 * Local rate for fixed carriers. Provider connectors stay stubbed
 * until a live API is explicitly confirmed.
 */
export async function rateDeliveryCarrier(tenantId, carrierId, { orderTotal = null } = {}) {
  const carrier = await InvDeliveryCarrier.findOne({
    _id: carrierId,
    tenantId: toObjectId(tenantId),
    active: { $ne: false },
  }).lean();
  if (!carrier) throw new InventoryValidationError('Carrier not found', 'CARRIER_NOT_FOUND');

  if (carrier.carrierType === 'provider' || (carrier.providerCode && carrier.providerCode !== 'none')) {
    if (!carrier.installed) {
      throw new InventoryValidationError(
        `Carrier connector "${carrier.providerCode}" is not installed`,
        'CARRIER_NOT_INSTALLED',
      );
    }
    throw new InventoryValidationError(
      'Live carrier rating is not enabled',
      'CARRIER_LIVE_DISABLED',
    );
  }

  // fixed + basedOnRules (rules not modeled yet → treat as fixed)
  let price = D(carrier.fixedPrice || '0');
  let source = 'fixed';

  if (carrier.freeAbove != null && carrier.freeAbove !== '' && orderTotal != null && orderTotal !== '') {
    if (D(orderTotal).gte(D(carrier.freeAbove))) {
      price = D(0);
      source = 'free_above';
    }
  }

  if (source === 'fixed' && carrier.marginPercent) {
    price = price.times(D(1).plus(D(carrier.marginPercent).div(100)));
  }

  return {
    carrierId: carrier._id,
    name: carrier.name,
    carrierType: carrier.carrierType,
    providerCode: carrier.providerCode,
    installed: !!carrier.installed,
    price: decStr(price),
    currency: 'SAR',
    source,
    freeAbove: carrier.freeAbove != null ? String(carrier.freeAbove) : null,
    fixedPrice: String(carrier.fixedPrice || '0'),
  };
}

export async function updateDeliveryCarrier(tenantId, id, userId, body) {
  const doc = await InvDeliveryCarrier.findOne({ _id: id, tenantId: toObjectId(tenantId) });
  if (!doc) throw new InventoryValidationError('Carrier not found', 'CARRIER_NOT_FOUND');

  if (body.name != null) doc.name = String(body.name).trim();
  if (body.nameAr != null) doc.nameAr = String(body.nameAr).trim();
  if (body.carrierType != null) doc.carrierType = body.carrierType;
  if (body.fixedPrice != null) doc.fixedPrice = String(body.fixedPrice);
  if (body.freeAbove !== undefined) {
    doc.freeAbove = body.freeAbove === null || body.freeAbove === ''
      ? null
      : String(body.freeAbove);
  }
  if (body.marginPercent != null) doc.marginPercent = Number(body.marginPercent) || 0;
  if (body.active != null) doc.active = !!body.active;
  // Never flip installed:true from this path — live connectors stay explicit
  doc.updatedBy = userId;
  doc.version = (doc.version || 0) + 1;
  await doc.save();
  return doc;
}

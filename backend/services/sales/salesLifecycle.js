import SalesSettings from '../../models/sales/SalesSettings.js';
import Partner from '../../models/Partner.js';
import Product from '../../models/Product.js';
import { evaluateCustomerCredit } from './creditLimit.js';

export async function getSalesSettings(tenantId) {
  let doc = await SalesSettings.findOne({ tenantId }).lean();
  if (!doc) {
    doc = (await SalesSettings.create({ tenantId })).toObject();
  }
  return doc;
}

export function computeQuotationValidUntil(issueDate, validityDays = 30) {
  const base = issueDate ? new Date(issueDate) : new Date();
  const until = new Date(base);
  until.setDate(until.getDate() + Number(validityDays || 30));
  return until;
}

/** Returns blocking and warning messages for customer/products on a sale */
export async function resolveSaleWarnings({ tenantId, customerId, productIds = [] }) {
  const warnings = [];
  const blocks = [];

  if (customerId) {
    const partner = await Partner.findOne({ _id: customerId, tenantId })
      .select('name stockWarn stockWarnMsg')
      .lean();
    if (partner?.stockWarn === 'warning') {
      warnings.push({
        type: 'customer',
        id: String(partner._id),
        message: partner.stockWarnMsg || `Customer "${partner.name}" has an active warning`,
      });
    }
    if (partner?.stockWarn === 'block') {
      blocks.push({
        type: 'customer',
        id: String(partner._id),
        message: partner.stockWarnMsg || `Customer "${partner.name}" is blocked for sales`,
      });
    }
  }

  if (productIds.length) {
    const products = await Product.find({ _id: { $in: productIds }, tenantId })
      .select('name nameEn notes isActive')
      .lean();
    for (const p of products) {
      if (p.isActive === false) {
        blocks.push({
          type: 'product',
          id: String(p._id),
          message: `Product "${p.nameEn || p.name}" is inactive`,
        });
      }
      if (p.notes && String(p.notes).trim()) {
        warnings.push({
          type: 'product',
          id: String(p._id),
          message: String(p.notes).trim(),
        });
      }
    }
  }

  return { warnings, blocks, hasBlock: blocks.length > 0 };
}

/**
 * Pre-confirm gates for sell orders.
 * @param {{ skipCredit?: boolean }} opts — finance release skips credit re-hold
 */
export async function assertSellOrderCanConfirm(order, tenantId, opts = {}) {
  const settings = await getSalesSettings(tenantId);
  if (order.flow !== 'sell') return { ok: true, settings };

  if (settings.requireOnlineSignature && !order.signedAt) {
    return { ok: false, error: 'Customer digital signature is required before confirmation', code: 'SIGNATURE_REQUIRED', settings };
  }
  if (settings.requireOnlinePayment && !order.paymentConfirmedAt) {
    return { ok: false, error: 'Online payment must be confirmed before order confirmation', code: 'PAYMENT_REQUIRED', settings };
  }

  if (!opts.skipCredit) {
    const credit = await evaluateCustomerCredit({
      tenantId,
      customerId: order.customerId?._id || order.customerId,
      orderTotal: order.grandTotal,
      excludeOrderId: order._id,
    });
    if (!credit.ok) {
      return {
        ok: false,
        hold: true,
        error: credit.error,
        code: credit.code,
        credit,
        settings,
      };
    }
  }

  return { ok: true, settings };
}

export function shouldLockSellOrder(order, settings) {
  return order.flow === 'sell' && order.status === 'approved' && settings?.lockConfirmedOrders !== false;
}

/** Order-level margin % from line costs vs selling prices (unitCost field is sell price on SO) */
export function estimateOrderMarginPercent(order, costByProductId = {}) {
  let revenue = 0;
  let cost = 0;
  for (const li of order.lineItems || []) {
    const qty = Number(li.quantityOrdered || 0);
    const sell = Number(li.unitCost || 0) * qty;
    revenue += sell;
    const pid = String(li.productId?._id || li.productId || '');
    const unitCost = Number(costByProductId[pid] ?? li.productCost ?? 0);
    cost += unitCost * qty;
  }
  if (!(revenue > 0)) return 100;
  return ((revenue - cost) / revenue) * 100;
}

import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import SalesSettings from '../models/sales/SalesSettings.js';
import SalesTeam from '../models/sales/SalesTeam.js';
import SalesTag from '../models/sales/SalesTag.js';
import SalesActivityType from '../models/sales/SalesActivityType.js';
import SalesActivityPlan from '../models/sales/SalesActivityPlan.js';
import SalesPaymentProvider from '../models/sales/SalesPaymentProvider.js';
import SalesPaymentMethod from '../models/sales/SalesPaymentMethod.js';
import SalesPaymentToken from '../models/sales/SalesPaymentToken.js';
import SalesPaymentTransaction from '../models/sales/SalesPaymentTransaction.js';
import Pricelist from '../models/sales/Pricelist.js';
import QuotationTemplate from '../models/sales/QuotationTemplate.js';
import SalesPromotion from '../models/sales/SalesPromotion.js';
import CarrierConnector from '../models/sales/CarrierConnector.js';
import Quotation from '../models/Quotation.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import CRMActivity from '../models/CRMActivity.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { parsePagination } from '../utils/pagination.js';
import { resolvePricelistItemPrice } from '../services/sales/pricingEngine.js';
import { shopShippingRates } from '../services/sales/shippingRateShop.js';
import { resolveSaleWarnings } from '../services/sales/salesLifecycle.js';

const router = express.Router();

/** Payment provider webhook — public, marks SO payment confirmed */
router.post('/payment-webhook/:providerCode', async (req, res) => {
  try {
    const provider = await SalesPaymentProvider.findOne({
      code: String(req.params.providerCode || '').toLowerCase(),
      isActive: true,
    });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const { purchaseOrderId, quotationId, amount, externalId, status } = req.body || {};
    const txn = await SalesPaymentTransaction.create({
      tenantId: provider.tenantId,
      providerId: provider._id,
      purchaseOrderId: purchaseOrderId || null,
      quotationId: quotationId || null,
      amount: Number(amount || 0),
      externalId: externalId || '',
      status: status === 'failed' ? 'failed' : 'captured',
      rawPayload: req.body,
    });

    if (txn.status === 'captured' && purchaseOrderId) {
      await PurchaseOrder.findOneAndUpdate(
        { _id: purchaseOrderId, tenantId: provider.tenantId, flow: 'sell' },
        { paymentConfirmedAt: new Date() },
      );
    }

    res.json({ received: true, transactionId: txn._id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function cleanBody(body) {
  const cleaned = {};
  for (const [key, value] of Object.entries(body || {})) {
    cleaned[key] = value === '' ? null : value;
  }
  return cleaned;
}

async function getOrCreateSettings(tenantId) {
  let doc = await SalesSettings.findOne({ tenantId }).lean();
  if (!doc) {
    doc = await SalesSettings.create({ tenantId });
    doc = doc.toObject();
  }
  return doc;
}

/* ─── Settings ─── */
router.get('/settings', checkPermission('sales', 'read'), async (req, res) => {
  try {
    res.json(await getOrCreateSettings(req.user.tenantId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Blueprint alias — normalized configuration ledger for SalesSettingsContext */
router.get('/configuration', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const s = await getOrCreateSettings(req.user.tenantId);
    res.json({
      invoicing_policy: String(s.defaultInvoicingPolicy || 'ordered').toUpperCase(),
      default_quotation_validity: s.quotationValidityDays ?? 30,
      lock_confirmed_sales: s.lockConfirmedOrders !== false,
      enable_sale_warnings: s.enableSaleWarnings !== false,
      enable_proforma: s.enableProforma !== false,
      require_online_signature: !!s.requireOnlineSignature,
      require_online_payment: !!s.requireOnlinePayment,
      portal_signup_mode: s.portalSignupMode || 'invitation_only',
      default_incoterm: s.defaultIncoterm || 'EXW',
      show_margins_by_default: !!s.showMarginsByDefault,
      amazon_sync_enabled: !!s.amazonSyncEnabled,
      show_incoterm_on_documents: !!s.showIncotermOnDocuments,
      show_compute_shipping: !!s.showComputeShipping,
      show_promo_codes: !!s.showPromoCodes,
      show_crm_tags_on_documents: !!s.showCrmTagsOnDocuments,
      raw: s,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/settings', checkPermission('sales', 'update'), async (req, res) => {
  try {
    const doc = await SalesSettings.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { ...cleanBody(req.body), tenantId: req.user.tenantId, updatedBy: req.user._id },
      { new: true, upsert: true, runValidators: true },
    );
    res.json(doc);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* ─── Generic list helper ─── */
function crudRoutes(Model, permModule = 'sales', populate = '') {
  const r = express.Router({ mergeParams: true });

  r.get('/', checkPermission(permModule, 'read'), async (req, res) => {
    try {
      const { page, limit, skip } = parsePagination(req.query, { limit: 50 });
      const filter = { ...req.tenantFilter };
      if (req.query.scope) filter.scope = req.query.scope;
      if (req.query.isActive != null) filter.isActive = req.query.isActive === 'true';
      let q = Model.find(filter).sort('-createdAt').skip(skip).limit(limit);
      if (populate) q = q.populate(populate);
      const [items, total] = await Promise.all([q.lean(), Model.countDocuments(filter)]);
      res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  r.get('/:id', checkPermission(permModule, 'read'), async (req, res) => {
    try {
      let q = Model.findOne({ _id: req.params.id, ...req.tenantFilter });
      if (populate) q = q.populate(populate);
      const item = await q.lean();
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/', checkPermission(permModule, 'create'), async (req, res) => {
    try {
      const item = await Model.create({
        ...cleanBody(req.body),
        tenantId: req.user.tenantId,
        createdBy: req.user._id,
      });
      res.status(201).json(item);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/:id', checkPermission(permModule, 'update'), async (req, res) => {
    try {
      const item = await Model.findOneAndUpdate(
        { _id: req.params.id, ...req.tenantFilter },
        cleanBody(req.body),
        { new: true, runValidators: true },
      );
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.delete('/:id', checkPermission(permModule, 'delete'), async (req, res) => {
    try {
      const item = await Model.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}

router.use('/teams', crudRoutes(SalesTeam, 'sales', 'leaderId memberIds'));
router.use('/tags', crudRoutes(SalesTag));
router.use('/activity-types', crudRoutes(SalesActivityType));
router.use('/activity-plans', crudRoutes(SalesActivityPlan, 'sales', 'steps.activityTypeId'));
router.use('/payment-providers', crudRoutes(SalesPaymentProvider));
router.use('/payment-methods', crudRoutes(SalesPaymentMethod, 'sales', 'providerId'));
router.use('/pricelists', crudRoutes(Pricelist, 'sales', 'items.productId items.variantId items.uomId'));
router.use('/quotation-templates', crudRoutes(QuotationTemplate));
router.use('/promotions', crudRoutes(SalesPromotion));
router.use('/carrier-connectors', crudRoutes(CarrierConnector));

router.get('/payment-tokens', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { limit: 50 });
    const filter = { ...req.tenantFilter };
    if (req.query.partnerId) filter.partnerId = req.query.partnerId;
    const [items, total] = await Promise.all([
      SalesPaymentToken.find(filter).populate('partnerId', 'name').populate('providerId', 'name code').sort('-createdAt').skip(skip).limit(limit).lean(),
      SalesPaymentToken.countDocuments(filter),
    ]);
    res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/payment-transactions', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { limit: 50 });
    const filter = { ...req.tenantFilter };
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      SalesPaymentTransaction.find(filter).populate('providerId', 'name code').sort('-createdAt').skip(skip).limit(limit).lean(),
      SalesPaymentTransaction.countDocuments(filter),
    ]);
    res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Apply activity plan to a quotation — schedules follow-up activities */
router.post('/activity-plans/:id/apply-to-quotation/:quotationId', checkPermission('sales', 'update'), async (req, res) => {
  try {
    const [plan, quotation] = await Promise.all([
      SalesActivityPlan.findOne({ _id: req.params.id, ...req.tenantFilter }).lean(),
      Quotation.findOne({ _id: req.params.quotationId, ...req.tenantFilter }),
    ]);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const base = new Date();
    const created = [];
    for (const step of plan.steps || []) {
      const due = new Date(base);
      due.setDate(due.getDate() + Number(step.delayDays || 0));
      const act = await CRMActivity.create({
        tenantId: req.user.tenantId,
        type: 'task',
        subject: step.summary || plan.name,
        description: step.summaryAr || step.summary || '',
        dueDate: due,
        quotationId: quotation._id,
        customerId: quotation.customerId || null,
        assignedTo: req.user._id,
        createdBy: req.user._id,
        status: 'pending',
      });
      created.push(act);
    }
    res.status(201).json({ planId: plan._id, quotationId: quotation._id, activities: created });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Resolve price from pricelist for product/qty (hierarchy-aware) */
router.post('/pricing/resolve', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const {
      pricelistId,
      productId,
      variantId,
      quantity = 1,
      basePrice = 0,
      cost = 0,
      partnerId = null,
      uomId = null,
      uomFactor = 1,
      currencyRate = 1,
      manualOverride = null,
      hasMarginOverridePermission = false,
      promoCode = null,
    } = req.body;

    // 1) Manual override (requires margin_override / margin permission)
    if (manualOverride != null && Number.isFinite(Number(manualOverride)) && hasMarginOverridePermission) {
      return res.json({
        unitPrice: Number(manualOverride),
        source: 'manual_override',
      });
    }

    const qty = Number(quantity) || 1;
    let unitPrice = Number(basePrice) || 0;
    let source = 'catalog';
    let promoMeta = null;

    // 2) Coupon / promo code (SKU-specific or order-level percent applied to unit)
    if (promoCode) {
      const promo = await SalesPromotion.findOne({
        ...req.tenantFilter,
        code: String(promoCode).trim(),
        isActive: true,
      }).lean();
      const now = Date.now();
      if (promo
        && (!promo.validFrom || new Date(promo.validFrom).getTime() <= now)
        && (!promo.validTo || new Date(promo.validTo).getTime() >= now)
        && (promo.maxUses == null || Number(promo.usedCount || 0) < Number(promo.maxUses))
        && (!promo.partnerIds?.length || (partnerId && promo.partnerIds.some((id) => String(id) === String(partnerId))))
        && (!promo.productIds?.length || promo.productIds.some((id) => String(id) === String(productId)))) {
        if (promo.discountType === 'fixed' && promo.discountValue != null) {
          // Treat fixed promo as absolute unit discount from catalog base
          unitPrice = Math.max(0, Number(basePrice) - Number(promo.discountValue));
          source = 'promo_fixed';
          promoMeta = { code: promo.code, promotionId: promo._id };
          const factor = Number(uomFactor || 1) || 1;
          unitPrice *= factor;
          const rate = Number(currencyRate) || 1;
          if (rate !== 1) {
            unitPrice *= rate;
            source = `${source}+fx`;
          }
          return res.json({
            unitPrice: Math.round(unitPrice * 10000) / 10000,
            source,
            promo: promoMeta,
            pricelistId: null,
          });
        }
        if (promo.discountType === 'percent') {
          promoMeta = {
            code: promo.code,
            promotionId: promo._id,
            discountPercent: Number(promo.discountValue),
          };
        }
      }
    }

    const list = pricelistId
      ? await Pricelist.findOne({ _id: pricelistId, ...req.tenantFilter }).lean()
      : null;

    let resolvedList = list;
    if (!resolvedList && partnerId) {
      try {
        const Partner = (await import('../models/Partner.js')).default;
        const partner = await Partner.findOne({ _id: partnerId, ...req.tenantFilter })
          .select('salesPricelistId')
          .lean();
        if (partner?.salesPricelistId) {
          resolvedList = await Pricelist.findOne({
            _id: partner.salesPricelistId,
            ...req.tenantFilter,
            isActive: true,
          }).lean();
        }
      } catch { /* partner lookup optional */ }
    }
    if (!resolvedList) {
      resolvedList = await Pricelist.findOne({
        tenantId: req.user.tenantId,
        isDefault: true,
        isActive: true,
      }).lean();
    }

    const now = Date.now();

    if (resolvedList) {
      const listValid = (!resolvedList.validFrom || new Date(resolvedList.validFrom).getTime() <= now)
        && (!resolvedList.validTo || new Date(resolvedList.validTo).getTime() >= now);

      if (listValid) {
        // Prefer partner-scoped contract rules, then volume tiers
        const candidates = (resolvedList.items || []).filter((row) => {
          if (String(row.productId) !== String(productId)) return false;
          if (variantId && row.variantId && String(row.variantId) !== String(variantId)) return false;
          if (uomId && row.uomId && String(row.uomId) !== String(uomId)) return false;
          if (row.partnerIds?.length && partnerId) {
            if (!row.partnerIds.some((id) => String(id) === String(partnerId))) return false;
          } else if (row.partnerIds?.length && !partnerId) {
            return false;
          }
          if (row.validFrom && new Date(row.validFrom).getTime() > now) return false;
          if (row.validTo && new Date(row.validTo).getTime() < now) return false;
          return qty >= Number(row.minQuantity || 1);
        }).sort((a, b) => {
          const ap = a.partnerIds?.length ? 1 : 0;
          const bp = b.partnerIds?.length ? 1 : 0;
          if (bp !== ap) return bp - ap;
          return Number(b.minQuantity || 0) - Number(a.minQuantity || 0);
        });

        const item = candidates[0];
        if (item) {
          unitPrice = resolvePricelistItemPrice(item, { basePrice, cost, quantity: qty });
          source = item.partnerIds?.length ? 'customer_contract' : (
            Number(item.minQuantity || 0) > 1 ? 'volume_tier' : 'pricelist'
          );
        }
      }
    }

    // 3) Promo percent after catalog/contract resolution
    if (promoMeta?.discountPercent != null) {
      unitPrice = Math.max(0, unitPrice * (1 - Number(promoMeta.discountPercent) / 100));
      source = `${source}+promo`;
    }

    // 4) UoM factor (e.g. Box of 12 → ×12)
    const factor = Number(uomFactor || 1) || 1;
    if (factor !== 1) {
      unitPrice *= factor;
      if (!String(source).includes('uom')) source = `${source}+uom`;
    }

    // 5) Currency conversion last
    const rate = Number(currencyRate) || 1;
    if (rate !== 1) {
      unitPrice *= rate;
      source = `${source}+fx`;
    }

    res.json({
      unitPrice: Math.round(unitPrice * 10000) / 10000,
      source,
      promo: promoMeta,
      pricelistId: resolvedList?._id || null,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Apply promotion code to order payload */
router.post('/promotions/apply', checkPermission('sales', 'update'), async (req, res) => {
  try {
    const { code, subtotal = 0, partnerId = null, productIds = [] } = req.body;
    const promo = await SalesPromotion.findOne({
      ...req.tenantFilter,
      code: String(code || '').trim(),
      isActive: true,
    });
    if (!promo) return res.status(404).json({ error: 'Invalid or expired promo code' });
    const now = Date.now();
    if (promo.validFrom && new Date(promo.validFrom).getTime() > now) {
      return res.status(400).json({ error: 'Promotion not yet active' });
    }
    if (promo.validTo && new Date(promo.validTo).getTime() < now) {
      return res.status(400).json({ error: 'Promotion expired' });
    }
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ error: 'Promotion usage limit reached' });
    }
    if (Number(subtotal) < Number(promo.minOrderAmount || 0)) {
      return res.status(400).json({ error: 'Order below minimum for promotion' });
    }
    if (promo.partnerIds?.length) {
      if (!partnerId || !promo.partnerIds.some((id) => String(id) === String(partnerId))) {
        return res.status(400).json({ error: 'Promotion not valid for this customer' });
      }
    }
    if (promo.productIds?.length) {
      const ids = (productIds || []).map(String);
      const hit = promo.productIds.some((id) => ids.includes(String(id)));
      if (!hit) {
        return res.status(400).json({ error: 'Promotion not valid for selected products' });
      }
    }

    let discountAmount = 0;
    if (promo.discountType === 'percent') {
      discountAmount = (Number(subtotal) * Number(promo.discountValue)) / 100;
    } else {
      discountAmount = Number(promo.discountValue);
    }
    discountAmount = Math.min(discountAmount, Number(subtotal));

    promo.usedCount = Number(promo.usedCount || 0) + 1;
    await promo.save();

    res.json({
      promotionId: promo._id,
      code: promo.code,
      name: promo.name,
      discountAmount,
      usedCount: promo.usedCount,
      discountLine: {
        productName: `Promotion: ${promo.name}`,
        quantity: 1,
        unitPrice: -discountAmount,
        productType: 'service',
      },
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Compute shipping rates via active carrier connectors */
router.post('/shipping/compute-rates', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const connectors = await CarrierConnector.find({ ...req.tenantFilter, isActive: true }).lean();
    const rates = await shopShippingRates({ connectors, payload: req.body });
    res.json({ rates });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Blueprint alias — POST /api/sales/shipping/rates */
router.post('/shipping/rates', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const connectors = await CarrierConnector.find({ ...req.tenantFilter, isActive: true }).lean();
    const rates = await shopShippingRates({ connectors, payload: req.body });
    res.json({ rates });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Sale warnings for customer/product selection */
router.get('/sale-warnings', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user.tenantId);
    if (settings.enableSaleWarnings === false) {
      return res.json({ warnings: [], blocks: [], hasBlock: false, disabled: true });
    }
    const productIds = String(req.query.productIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    res.json(await resolveSaleWarnings({
      tenantId: req.user.tenantId,
      customerId: req.query.customerId,
      productIds,
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** UoMs for SO line selection (sales-scoped; avoids inventory permission gate) */
router.get('/uoms', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const InvUom = (await import('../models/inventory/InvUom.js')).default;
    const rows = await InvUom.find({ ...req.tenantFilter, active: { $ne: false } })
      .select('name nameAr factor categoryId')
      .sort({ name: 1 })
      .lean();
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Product packagings for SO lines (empty when packaging module disabled) */
router.get('/product-packagings', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const productId = req.query.productId;
    if (!productId) return res.json({ items: [] });
    const InvProductPackaging = (await import('../models/inventory/InvProductPackaging.js')).default;
    const rows = await InvProductPackaging.find({
      ...req.tenantFilter,
      productId,
      active: { $ne: false },
      salesOk: { $ne: false },
    })
      .select('name qty barcode')
      .sort({ name: 1 })
      .lean();
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Smart-button counts for a sell order (deliveries + invoices) */
router.get('/orders/:id/smart-buttons', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter, flow: 'sell' }).lean();
    if (!order) return res.status(404).json({ error: 'Sales order not found' });
    const DeliveryNote = (await import('../models/DeliveryNote.js')).default;
    const Invoice = (await import('../models/Invoice.js')).default;
    const InvTransfer = (await import('../models/inventory/InvTransfer.js')).default;

    const dns = await DeliveryNote.find({ ...req.tenantFilter, purchaseOrderId: order._id })
      .select('dnNumber status inventoryTransferId lineItems createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const transferIds = dns.map((d) => d.inventoryTransferId).filter(Boolean);
    const transfers = transferIds.length
      ? await InvTransfer.find({ _id: { $in: transferIds } })
        .select('state backorderOfId origin')
        .lean()
      : [];
    const transferMap = Object.fromEntries(transfers.map((t) => [String(t._id), t]));

    const deliveryNotes = dns.map((d) => {
      const t = d.inventoryTransferId ? transferMap[String(d.inventoryTransferId)] : null;
      return {
        _id: d._id,
        dnNumber: d.dnNumber,
        status: d.status,
        inventoryTransferId: d.inventoryTransferId || null,
        transferState: t?.state || null,
        backorderOfId: t?.backorderOfId || null,
        hasBackorder: Boolean(t?.backorderOfId) || String(t?.state || '') === 'waiting',
      };
    });

    const [deliveries, invoices] = await Promise.all([
      Promise.resolve(dns.length),
      Invoice.countDocuments({ ...req.tenantFilter, purchaseOrderId: order._id, flow: 'sell' }),
    ]);
    res.json({
      purchaseOrderId: order._id,
      deliveries,
      invoices,
      deliveryNotes,
      deliveryHref: `/app/dashboard/delivery-notes?purchaseOrderId=${order._id}`,
      invoiceHref: `/app/dashboard/accounting/invoices?purchaseOrderId=${order._id}`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Seed default activity types for tenant */
router.post('/activity-types/seed-defaults', checkPermission('sales', 'create'), async (req, res) => {
  try {
    const defaults = [
      { name: 'Call', kind: 'call', icon: 'phone' },
      { name: 'Email', kind: 'email', icon: 'mail' },
      { name: 'Meeting', kind: 'meeting', icon: 'users' },
    ];
    const created = [];
    for (const row of defaults) {
      const existing = await SalesActivityType.findOne({ tenantId: req.user.tenantId, name: row.name });
      if (!existing) {
        created.push(await SalesActivityType.create({ ...row, tenantId: req.user.tenantId }));
      }
    }
    res.status(201).json({ created });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Document chatter */
router.get('/chatter/:docType/:docId', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { listDocumentMessages } = await import('../services/sales/documentChatter.js');
    const messages = await listDocumentMessages({
      tenantId: req.user.tenantId,
      docType: req.params.docType,
      docId: req.params.docId,
    });
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/chatter/:docType/:docId', checkPermission('sales', 'update'), async (req, res) => {
  try {
    const { appendDocumentMessage } = await import('../services/sales/documentChatter.js');
    const msg = await appendDocumentMessage({
      tenantId: req.user.tenantId,
      docType: req.params.docType,
      docId: req.params.docId,
      userId: req.user._id,
      body: req.body?.body || req.body?.message,
      kind: 'note',
    });
    res.status(201).json(msg);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * RMA from done delivery: create return transfer + optional draft credit note.
 * Body: { deliveryNoteId, invoiceId?, lines: [{ productId, quantity }], createCreditNote?: boolean }
 */
router.post('/rma', checkPermission('sales', 'create'), async (req, res) => {
  try {
    const DeliveryNote = (await import('../models/DeliveryNote.js')).default;
    const InvoiceModel = (await import('../models/Invoice.js')).default;

    const dn = await DeliveryNote.findOne({
      _id: req.body.deliveryNoteId,
      ...req.tenantFilter,
    });
    if (!dn) return res.status(404).json({ error: 'Delivery note not found' });

    let returnTransfer = null;
    if (dn.inventoryTransferId && Array.isArray(req.body.lines) && req.body.lines.length) {
      try {
        const { createReturnTransfer } = await import('../services/inventory/returns.js');
        returnTransfer = await createReturnTransfer(
          req.user.tenantId,
          req.user._id,
          dn.inventoryTransferId,
          {
            lines: req.body.lines,
            note: `RMA from DN ${dn.dnNumber}`,
          },
        );
      } catch (e) {
        returnTransfer = { error: e.message };
      }
    }

    let creditNote = null;
    let invoiceId = req.body.invoiceId;
    if (req.body.createCreditNote && !invoiceId && dn.purchaseOrderId) {
      const linked = await InvoiceModel.findOne({
        ...req.tenantFilter,
        flow: 'sell',
        purchaseOrderId: dn.purchaseOrderId,
        invoiceType: { $nin: ['381', 'credit_note'] },
        status: { $nin: ['cancelled', 'draft'] },
      }).sort({ createdAt: -1 });
      if (linked) invoiceId = linked._id;
    }
    if (req.body.createCreditNote && invoiceId) {
      const inv = await InvoiceModel.findOne({ _id: invoiceId, ...req.tenantFilter });
      if (inv) {
        const lines = (req.body.lines || []).map((l) => {
          const src = (inv.lineItems || []).find(
            (li) => String(li.productId) === String(l.productId),
          );
          return {
            productId: l.productId,
            productName: src?.productName || 'Return',
            quantity: Number(l.quantity || 0),
            unitPrice: src?.unitPrice || 0,
            taxRate: src?.taxRate ?? 15,
            productType: src?.productType || 'goods',
            sourcePoItemId: src?.sourcePoItemId || l.sourcePoItemId,
          };
        }).filter((l) => l.quantity > 0);

        if (lines.length) {
          creditNote = await InvoiceModel.create({
            tenantId: req.user.tenantId,
            flow: 'sell',
            transactionType: inv.transactionType || 'B2B',
            status: 'draft',
            invoiceNumber: `CN-${Date.now().toString(36).toUpperCase()}`,
            invoiceType: '381',
            originalInvoiceId: inv._id,
            relatedInvoiceId: inv._id,
            sourcePurchaseOrderId: dn.purchaseOrderId,
            purchaseOrderId: dn.purchaseOrderId,
            customerId: inv.customerId,
            buyer: inv.buyer,
            lineItems: lines,
            createdBy: req.user._id,
            notes: `RMA credit for DN ${dn.dnNumber}`,
          });
        }
      }
    }

    try {
      const { appendDocumentMessage } = await import('../services/sales/documentChatter.js');
      if (dn.purchaseOrderId) {
        await appendDocumentMessage({
          tenantId: req.user.tenantId,
          docType: 'sales_order',
          docId: dn.purchaseOrderId,
          userId: req.user._id,
          body: `RMA opened from ${dn.dnNumber}`,
          kind: 'system',
        });
      }
    } catch { /* optional */ }

    res.status(201).json({ returnTransfer, creditNote, deliveryNoteId: dn._id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

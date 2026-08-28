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
router.use('/pricelists', crudRoutes(Pricelist));
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

/** Resolve price from pricelist for product/qty */
router.post('/pricing/resolve', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { pricelistId, productId, variantId, quantity = 1, basePrice = 0, cost = 0 } = req.body;
    const list = pricelistId
      ? await Pricelist.findOne({ _id: pricelistId, ...req.tenantFilter }).lean()
      : await Pricelist.findOne({ tenantId: req.user.tenantId, isDefault: true, isActive: true }).lean();
    if (!list) return res.json({ unitPrice: Number(basePrice) });

    const item = (list.items || []).find((row) => {
      if (String(row.productId) !== String(productId)) return false;
      if (variantId && row.variantId && String(row.variantId) !== String(variantId)) return false;
      return Number(quantity) >= Number(row.minQuantity || 1);
    });

    const unitPrice = resolvePricelistItemPrice(item, { basePrice, cost, quantity });
    res.json({ unitPrice, pricelistId: list._id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Apply promotion code to order payload */
router.post('/promotions/apply', checkPermission('sales', 'update'), async (req, res) => {
  try {
    const { code, subtotal = 0 } = req.body;
    const promo = await SalesPromotion.findOne({
      ...req.tenantFilter,
      code: String(code || '').trim(),
      isActive: true,
    }).lean();
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

    let discountAmount = 0;
    if (promo.discountType === 'percent') {
      discountAmount = (Number(subtotal) * Number(promo.discountValue)) / 100;
    } else {
      discountAmount = Number(promo.discountValue);
    }

    res.json({
      promotionId: promo._id,
      code: promo.code,
      name: promo.name,
      discountAmount: Math.min(discountAmount, Number(subtotal)),
      discountLine: {
        productName: `Promotion: ${promo.name}`,
        quantity: 1,
        unitPrice: -Math.min(discountAmount, Number(subtotal)),
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

/** Sale warnings for customer/product selection */
router.get('/sale-warnings', checkPermission('sales', 'read'), async (req, res) => {
  try {
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

export default router;

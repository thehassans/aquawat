import express from 'express';
import mongoose from 'mongoose';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Tenant from '../models/Tenant.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function requireSyncTenant(req, res) {
  if (!req.user?.tenantId) {
    res.status(403).json({ success: false, error: 'Tenant context required' });
    return null;
  }
  return req.user.tenantId;
}

function isMongoObjectId(id) {
  return typeof id === 'string' && id.length === 24 && mongoose.Types.ObjectId.isValid(id);
}

async function upsertTenantOwned(Model, rawId, data, tenantId) {
  const payload = { ...data, tenantId };
  delete payload._id;

  if (!isMongoObjectId(rawId)) {
    return Model.create(payload);
  }

  const existing = await Model.findById(rawId).select('tenantId').lean();
  if (existing && String(existing.tenantId) !== String(tenantId)) {
    const err = new Error('Document belongs to another tenant');
    err.status = 403;
    throw err;
  }

  return Model.findOneAndUpdate(
    { _id: rawId, tenantId },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * POST /api/desktop/sync/auth
 * Authenticates desktop app and returns basic tenant info + Phase 2 check
 */
router.post('/auth', protect, async (req, res) => {
  try {
    const tenantId = requireSyncTenant(req, res);
    if (!tenantId) return;

    const tenant = await Tenant.findById(tenantId);
    
    // Check if Phase 2 is enabled
    const isPhase2 = tenant?.zatca?.phase === '2';

    res.json({
      success: true,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        isPhase2
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/desktop/sync/push
 * Receives batched invoices and customers from desktop NeDB
 */
router.post('/push', protect, async (req, res) => {
  try {
    const tenantId = requireSyncTenant(req, res);
    if (!tenantId) return;

    const { invoices = [], customers = [] } = req.body;

    for (const cust of customers) {
      if (cust._id) {
        await upsertTenantOwned(Customer, cust._id, cust, tenantId);
      } else {
        await Customer.create({ ...cust, tenantId });
      }
    }

    for (const inv of invoices) {
      if (inv._id) {
        await upsertTenantOwned(Invoice, inv._id, inv, tenantId);
      } else {
        await Invoice.create({ ...inv, tenantId });
      }
    }

    res.json({ success: true, message: 'Sync push completed' });
  } catch (error) {
    const status = error.status === 403 ? 403 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/desktop/sync/pull
 * Returns updated products and customers since last sync
 */
router.get('/pull', protect, async (req, res) => {
  try {
    const tenantId = requireSyncTenant(req, res);
    if (!tenantId) return;

    const { since } = req.query;

    const query = { tenantId };
    if (since) {
      query.updatedAt = { $gte: new Date(since) };
    }

    const products = await Product.find(query);
    const customers = await Customer.find(query);

    res.json({
      success: true,
      data: {
        products,
        customers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

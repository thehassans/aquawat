import express from 'express';
import Product from '../models/Product.js';
import InvQuant from '../models/inventory/InvQuant.js';
import InvTransfer from '../models/inventory/InvTransfer.js';
import { authenticateApiKey, requireApiScope } from '../middleware/invApiKeyAuth.js';
import { InventoryValidationError } from '../services/inventory/errors.js';

function handleInventoryError(res, err) {
  const status = err.statusCode || (err instanceof InventoryValidationError ? 400 : 500);
  res.status(status).json({
    error: { code: err.code || 'ERROR', message: err.message, messageAr: err.messageAr },
  });
}

const router = express.Router();
router.use(authenticateApiKey);

router.get('/products', requireApiScope('read'), async (req, res) => {
  try {
    const items = await Product.find({ tenantId: req.apiKeyAuth.tenantId, isActive: { $ne: false } })
      .select('productId sku nameEn nameAr costPrice sellingPrice trackInventory')
      .limit(Math.min(500, Number(req.query.limit) || 100))
      .lean();
    res.json({ items, total: items.length });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/stock-levels', requireApiScope('read'), async (req, res) => {
  try {
    const filter = { tenantId: req.apiKeyAuth.tenantId, quantity: { $ne: '0' } };
    if (req.query.productId) filter.productId = req.query.productId;
    const rows = await InvQuant.find(filter)
      .populate('productId', 'sku nameEn')
      .populate('locationId', 'name completePath')
      .limit(Math.min(500, Number(req.query.limit) || 200))
      .lean();
    res.json({ items: rows });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/pickings/:id', requireApiScope('read'), async (req, res) => {
  try {
    const t = await InvTransfer.findOne({ _id: req.params.id, tenantId: req.apiKeyAuth.tenantId }).lean();
    if (!t) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Picking not found' } });
    res.json(t);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/pickings/:id/validate', requireApiScope('write'), async (req, res) => {
  try {
    const { validateTransfer } = await import('../services/inventory/transferService.js');
    const transfer = await validateTransfer(req.apiKeyAuth.tenantId, req.params.id, { userId: null });
    const { dispatchInventoryWebhook } = await import('../services/inventory/webhooks.js');
    await dispatchInventoryWebhook(req.apiKeyAuth.tenantId, 'picking.validated', {
      transferId: transfer._id,
      name: transfer.name,
      state: transfer.state,
    });
    res.json(transfer);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

export default router;

import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import StockTransfer from '../models/StockTransfer.js';
import { adjustProductStock } from '../services/inventoryAdjust.js';
import { resolveTenantId, withTenant, handleTenantScopeError } from '../utils/tenantScope.js';
import {
  isStockEngineEnabled,
  postStockTransferViaEngine,
} from '../services/stock/legacyAdapter.js';
import { StockValidationError } from '../services/stock/errors.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

router.get('/', async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const transfers = await StockTransfer.find(withTenant(tenantId))
      .populate('sourceWarehouseId', 'nameEn nameAr')
      .populate('destinationWarehouseId', 'nameEn nameAr')
      .populate('shippedBy', 'name')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(transfers);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sourceWarehouseId, destinationWarehouseId, notes, expectedArrivalDate, lines } = req.body;
    const tenantId = getTargetTenantId(req.user, req);

    const count = await StockTransfer.countDocuments({ tenantId });
    const transferNumber = `ST-${String(count + 1).padStart(5, '0')}`;

    const transfer = new StockTransfer({
      tenantId,
      transferNumber,
      sourceWarehouseId,
      destinationWarehouseId,
      status: 'In Transit',
      shippedBy: req.user._id,
      notes,
      expectedArrivalDate,
      lines,
    });

    if (await isStockEngineEnabled(tenantId)) {
      const picking = await postStockTransferViaEngine({
        tenantId,
        userId: req.user._id,
        transfer,
      });
      transfer.stockPickingId = picking._id;
      transfer.stockPostedAt = new Date();
      transfer.status = 'Completed';
      transfer.receivedBy = req.user._id;
    } else {
      for (const line of lines || []) {
        await adjustProductStock({
          tenantId,
          productId: line.productId,
          delta: -Math.abs(line.quantity),
          warehouseId: sourceWarehouseId,
        });
      }
    }

    await transfer.save();
    res.status(201).json(transfer);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    if (error instanceof StockValidationError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/receive', async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const transfer = await StockTransfer.findOne({ _id: req.params.id, ...withTenant(tenantId) });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status === 'Completed') return res.status(400).json({ error: 'Transfer already completed' });

    // Engine path already completed on ship
    if (transfer.stockPickingId || transfer.stockPostedAt) {
      transfer.status = 'Completed';
      transfer.receivedBy = req.user._id;
      await transfer.save();
      return res.json(transfer);
    }

    transfer.status = 'Completed';
    transfer.receivedBy = req.user._id;

    for (const line of transfer.lines) {
      await adjustProductStock({
        tenantId,
        productId: line.productId,
        delta: Math.abs(line.quantity),
        warehouseId: transfer.destinationWarehouseId,
      });
    }

    await transfer.save();
    res.json(transfer);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;

import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import StockTransfer from '../models/StockTransfer.js';
import { adjustProductStock } from '../services/inventoryAdjust.js';
import { resolveTenantId, withTenant, handleTenantScopeError } from '../utils/tenantScope.js';
import {
  isInvEngineEnabled,
} from '../services/inventory/legacyAdapter.js';
import InvOperationType from '../models/inventory/InvOperationType.js';
import { createTransfer } from '../services/inventory/createTransfer.js';
import { confirmTransfer, validateTransfer } from '../services/inventory/transferService.js';
import Warehouse from '../models/Warehouse.js';
import { ensureInventoryBootstrap, bootstrapWarehouse } from '../services/inventory/bootstrap.js';

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

/**
 * When engine is on: create + validate a single internal InvTransfer (source → dest).
 * Legacy StockTransfer doc kept as façade with inventoryTransferId.
 */
async function postViaEngine(tenantId, userId, {
  sourceWarehouseId,
  destinationWarehouseId,
  lines,
  notes,
  transferNumber,
}) {
  await ensureInventoryBootstrap(tenantId, userId);
  let srcWh = await Warehouse.findOne({ _id: sourceWarehouseId, tenantId });
  let destWh = await Warehouse.findOne({ _id: destinationWarehouseId, tenantId });
  if (!srcWh || !destWh) throw new Error('Warehouse not found');
  if (!srcWh.stockLocationId) {
    await bootstrapWarehouse(tenantId, srcWh, null, userId);
    srcWh = await Warehouse.findById(srcWh._id);
  }
  if (!destWh.stockLocationId) {
    await bootstrapWarehouse(tenantId, destWh, null, userId);
    destWh = await Warehouse.findById(destWh._id);
  }

  const opType = await InvOperationType.findOne({
    tenantId,
    warehouseId: srcWh._id,
    code: 'internal',
    active: true,
    sequenceCode: { $not: /\/ADJ$/ },
  });
  if (!opType) throw new Error('Internal operation type missing — bootstrap warehouse');

  const transfer = await createTransfer(tenantId, {
    operationTypeId: opType._id,
    sourceLocationId: srcWh.stockLocationId,
    destLocationId: destWh.stockLocationId,
    origin: transferNumber,
    note: notes,
    lines: (lines || []).map((l) => ({
      productId: l.productId,
      demandQty: l.quantity,
    })),
  }, userId);

  await confirmTransfer(tenantId, transfer._id, userId);
  const done = await validateTransfer(tenantId, transfer._id, {
    userId,
    immediate: true,
    createBackorder: false,
  });
  return done;
}

router.post('/', async (req, res) => {
  try {
    const { sourceWarehouseId, destinationWarehouseId, notes, expectedArrivalDate, lines } = req.body;
    const tenantId = getTargetTenantId(req.user, req);

    const count = await StockTransfer.countDocuments({ tenantId });
    const transferNumber = `ST-${String(count + 1).padStart(5, '0')}`;

    if (await isInvEngineEnabled(tenantId)) {
      const invTransfer = await postViaEngine(tenantId, req.user._id, {
        sourceWarehouseId,
        destinationWarehouseId,
        lines,
        notes,
        transferNumber,
      });

      const transfer = await StockTransfer.create({
        tenantId,
        transferNumber,
        sourceWarehouseId,
        destinationWarehouseId,
        status: 'Completed',
        shippedBy: req.user._id,
        receivedBy: req.user._id,
        notes,
        expectedArrivalDate,
        lines,
        inventoryTransferId: invTransfer?._id,
        completedAt: new Date(),
      });
      return res.status(201).json(transfer);
    }

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

    for (const line of lines) {
      await adjustProductStock({
        tenantId,
        productId: line.productId,
        delta: -Math.abs(line.quantity),
        warehouseId: sourceWarehouseId,
      });
    }

    await transfer.save();
    res.status(201).json(transfer);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    const status = error.code === 'ENGINE_BLOCKS_LEGACY_STOCK' ? 409 : 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

router.post('/:id/receive', async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const transfer = await StockTransfer.findOne({ _id: req.params.id, ...withTenant(tenantId) });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status === 'Completed') return res.status(400).json({ error: 'Transfer already completed' });

    if (await isInvEngineEnabled(tenantId)) {
      // Engine path posts both sides on create; receive is a no-op status flip if still open
      if (transfer.inventoryTransferId) {
        transfer.status = 'Completed';
        transfer.receivedBy = req.user._id;
        transfer.completedAt = new Date();
        await transfer.save();
        return res.json(transfer);
      }
      const invTransfer = await postViaEngine(tenantId, req.user._id, {
        sourceWarehouseId: transfer.sourceWarehouseId,
        destinationWarehouseId: transfer.destinationWarehouseId,
        lines: transfer.lines,
        notes: transfer.notes,
        transferNumber: transfer.transferNumber,
      });
      transfer.status = 'Completed';
      transfer.receivedBy = req.user._id;
      transfer.inventoryTransferId = invTransfer?._id;
      transfer.completedAt = new Date();
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

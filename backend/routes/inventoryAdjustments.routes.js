import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import InventoryAdjustment from '../models/InventoryAdjustment.js';
import Warehouse from '../models/Warehouse.js';
import InvLocation from '../models/inventory/InvLocation.js';
import InvOperationType from '../models/inventory/InvOperationType.js';
import { adjustProductStock } from '../services/inventoryAdjust.js';
import { resolveTenantId, withTenant, handleTenantScopeError } from '../utils/tenantScope.js';
import { isInvEngineEnabled } from '../services/inventory/legacyAdapter.js';
import { createTransfer } from '../services/inventory/createTransfer.js';
import { confirmTransfer, validateTransfer } from '../services/inventory/transferService.js';
import { ensureInventoryBootstrap, bootstrapWarehouse } from '../services/inventory/bootstrap.js';
import { assertWarehouseAccess } from '../services/inventory/warehouseScope.js';
import { D, decStr } from '../utils/decimal.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

const generateAdjustmentNumber = async (tenantId) => {
  const count = await InventoryAdjustment.countDocuments({ tenantId });
  return `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

async function postAdjustmentViaEngine(tenantId, userId, {
  warehouseId,
  lines,
  reason,
  notes,
  adjustmentNumber,
}) {
  await ensureInventoryBootstrap(tenantId, userId);
  let wh = await Warehouse.findOne({ _id: warehouseId, tenantId });
  if (!wh) throw new Error('Warehouse not found');
  if (!wh.stockLocationId) {
    await bootstrapWarehouse(tenantId, wh, null, userId);
    wh = await Warehouse.findById(wh._id);
  }

  const adjLoc = await InvLocation.findOne({ tenantId, usage: 'inventoryLoss' });
  const code = (wh.code || 'WH').toUpperCase();
  const opType = await InvOperationType.findOne({ tenantId, sequenceCode: `${code}/ADJ` });
  if (!adjLoc || !opType) {
    throw new Error('Adjustment configuration missing — run inventory bootstrap');
  }

  const transferIds = [];
  for (const line of lines || []) {
    const diff = D(line.difference ?? 0);
    if (diff.isZero() || !line.productId) continue;

    const isGain = diff.gt(0);
    const transfer = await createTransfer(tenantId, {
      operationTypeId: opType._id,
      sourceLocationId: isGain ? adjLoc._id : wh.stockLocationId,
      destLocationId: isGain ? wh.stockLocationId : adjLoc._id,
      origin: adjustmentNumber,
      note: notes || reason || 'Inventory adjustment',
      sourceModel: 'inventoryAdjustment',
      lines: [{ productId: line.productId, demandQty: decStr(diff.abs()) }],
    }, userId);

    await confirmTransfer(tenantId, transfer._id, userId);
    await validateTransfer(tenantId, transfer._id, {
      userId,
      immediate: true,
      createBackorder: false,
    });
    transferIds.push(transfer._id);
  }
  return transferIds;
}

router.get('/', async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const adjustments = await InventoryAdjustment.find(withTenant(tenantId))
      .populate('adjustedBy', 'firstName lastName name')
      .sort('-createdAt')
      .limit(200);
    res.json(adjustments);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { reason, notes, lines, warehouseId } = req.body;
    const tenantId = getTargetTenantId(req.user, req);
    const adjustmentNumber = await generateAdjustmentNumber(tenantId);

    if (await isInvEngineEnabled(tenantId)) {
      if (!warehouseId) {
        return res.status(400).json({ error: 'warehouseId required when inventory engine is enabled' });
      }
      await assertWarehouseAccess(req, warehouseId);

      const transferIds = await postAdjustmentViaEngine(tenantId, req.user._id, {
        warehouseId,
        lines,
        reason,
        notes,
        adjustmentNumber,
      });

      const adjustment = await InventoryAdjustment.create({
        tenantId,
        adjustmentNumber,
        reason: reason || 'Adjustment',
        notes,
        warehouseId,
        adjustedBy: req.user._id,
        lines: lines || [],
        inventoryTransferIds: transferIds,
      });
      return res.status(201).json(adjustment);
    }

    const adjustment = new InventoryAdjustment({
      tenantId,
      adjustmentNumber,
      reason: reason || 'Adjustment',
      notes,
      warehouseId: warehouseId || undefined,
      adjustedBy: req.user._id,
      lines: lines || [],
    });

    await adjustment.save();

    for (const line of adjustment.lines) {
      if (line.productId && line.difference !== undefined) {
        await adjustProductStock({
          tenantId,
          productId: line.productId,
          delta: line.difference,
          warehouseId,
        });
      }
    }

    res.status(201).json(adjustment);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    const status = error.code === 'WAREHOUSE_FORBIDDEN' ? 403
      : error.code === 'ENGINE_BLOCKS_LEGACY_STOCK' ? 409
        : 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const adjustment = await InventoryAdjustment.findOne({
      _id: req.params.id,
      ...withTenant(tenantId),
    }).populate('adjustedBy', 'firstName lastName name');

    if (!adjustment) return res.status(404).json({ error: 'Adjustment not found' });
    res.json(adjustment);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;

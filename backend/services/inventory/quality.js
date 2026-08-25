import InvQualityPoint from '../../models/inventory/InvQualityPoint.js';
import InvQualityCheck from '../../models/inventory/InvQualityCheck.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { getInvSettings } from './settingsService.js';

async function assertQualityEnabled(tenantId) {
  const settings = await getInvSettings(tenantId);
  if (!settings.moduleQuality) {
    throw new InventoryValidationError('Quality checks are disabled in settings', 'QUALITY_DISABLED');
  }
}

export async function listQualityPoints(tenantId, { operationTypeId, activeOnly = true } = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (operationTypeId) filter.operationTypeId = toObjectId(operationTypeId);
  if (activeOnly) filter.active = true;
  return InvQualityPoint.find(filter)
    .populate('operationTypeId', 'name nameAr code')
    .populate('productId', 'nameEn nameAr sku')
    .sort({ name: 1 })
    .lean();
}

export async function createQualityPoint(tenantId, userId, body) {
  await assertQualityEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const name = String(body.name || '').trim();
  if (!name) throw new InventoryValidationError('Name required', 'QUALITY_NAME');
  if (!body.operationTypeId) {
    throw new InventoryValidationError('operationTypeId required', 'OP_TYPE_REQUIRED');
  }
  const ot = await InvOperationType.findOne({
    _id: body.operationTypeId,
    tenantId: tid,
    active: true,
  }).lean();
  if (!ot) throw new InventoryValidationError('Operation type not found', 'OP_TYPE_NOT_FOUND');

  return InvQualityPoint.create({
    tenantId: tid,
    name,
    operationTypeId: ot._id,
    productId: body.productId || null,
    categoryId: body.categoryId || null,
    testType: ['passFail', 'measure', 'instructions'].includes(body.testType)
      ? body.testType
      : 'passFail',
    instructions: body.instructions,
    active: body.active !== false,
    createdBy: userId,
  });
}

export async function updateQualityPoint(tenantId, id, userId, body) {
  await assertQualityEnabled(tenantId);
  const doc = await InvQualityPoint.findOne({ _id: id, tenantId: toObjectId(tenantId) });
  if (!doc) throw new InventoryValidationError('Quality point not found', 'QUALITY_POINT_NOT_FOUND');
  if (body.name != null) doc.name = String(body.name).trim();
  if (body.instructions != null) doc.instructions = body.instructions;
  if (body.testType != null) doc.testType = body.testType;
  if (body.active != null) doc.active = !!body.active;
  if (body.productId !== undefined) doc.productId = body.productId || null;
  doc.updatedBy = userId;
  doc.version = (doc.version || 0) + 1;
  await doc.save();
  return doc;
}

export async function listTransferQualityChecks(tenantId, transferId) {
  const tid = toObjectId(tenantId);
  const transfer = await InvTransfer.findOne({ _id: transferId, tenantId: tid }).lean();
  if (!transfer) throw new InventoryValidationError('Transfer not found', 'TRANSFER_NOT_FOUND');

  return InvQualityCheck.find({ tenantId: tid, transferId: transfer._id })
    .populate('pointId', 'name testType instructions')
    .populate('productId', 'nameEn nameAr sku')
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * Ensure checks exist for active points on the transfer's operation type
 * (same logic as confirm — useful if quality was enabled after confirm).
 */
export async function ensureTransferQualityChecks(tenantId, transferId, userId = null) {
  await assertQualityEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const transfer = await InvTransfer.findOne({ _id: transferId, tenantId: tid }).lean();
  if (!transfer) throw new InventoryValidationError('Transfer not found', 'TRANSFER_NOT_FOUND');

  const points = await InvQualityPoint.find({
    tenantId: tid,
    operationTypeId: transfer.operationTypeId,
    active: true,
  }).lean();

  let created = 0;
  for (const point of points) {
    const exists = await InvQualityCheck.findOne({
      tenantId: tid,
      transferId: transfer._id,
      pointId: point._id,
    }).lean();
    if (!exists) {
      await InvQualityCheck.create({
        tenantId: tid,
        pointId: point._id,
        transferId: transfer._id,
        productId: point.productId || null,
        state: 'none',
        createdBy: userId,
      });
      created += 1;
    }
  }
  return {
    created,
    checks: await listTransferQualityChecks(tenantId, transferId),
  };
}

export async function resolveQualityCheck(tenantId, checkId, userId, body) {
  await assertQualityEnabled(tenantId);
  const doc = await InvQualityCheck.findOne({ _id: checkId, tenantId: toObjectId(tenantId) });
  if (!doc) throw new InventoryValidationError('Quality check not found', 'QUALITY_CHECK_NOT_FOUND');

  const state = body.state;
  if (!['pass', 'fail', 'none'].includes(state)) {
    throw new InventoryValidationError('state must be pass, fail, or none', 'QUALITY_STATE');
  }

  const transfer = await InvTransfer.findOne({
    _id: doc.transferId,
    tenantId: toObjectId(tenantId),
  }).lean();
  if (!transfer) throw new InventoryValidationError('Transfer not found', 'TRANSFER_NOT_FOUND');
  if (transfer.state === 'done' || transfer.state === 'cancelled') {
    throw new InventoryValidationError('Transfer is closed', 'TRANSFER_CLOSED');
  }

  doc.state = state;
  if (body.measureValue != null) doc.measureValue = String(body.measureValue);
  if (body.note != null) doc.note = String(body.note);
  doc.updatedBy = userId;
  doc.version = (doc.version || 0) + 1;
  await doc.save();
  return doc.populate([
    { path: 'pointId', select: 'name testType instructions' },
    { path: 'productId', select: 'nameEn nameAr sku' },
  ]);
}

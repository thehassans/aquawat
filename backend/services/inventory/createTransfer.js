import { decStr, D } from '../../utils/decimal.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { nextSequenceName } from './sequence.js';
import { getDefaultUom } from './bootstrap.js';
import { recomputeTransferState } from './transferState.js';
import { runWithTransaction } from './reserve.js';
import { InventoryValidationError } from './errors.js';

/**
 * Create a transfer with move lines.
 * @param {object} payload
 * @param {Array<{ productId, demandQty, uomId? }>} payload.lines
 */
export async function createTransfer(tenantId, payload, userId = null) {
  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const opType = await InvOperationType.findOne({
      _id: toObjectId(payload.operationTypeId),
      tenantId: tid,
      active: true,
    }).session(session);
    if (!opType) throw new InventoryValidationError('Operation type not found', 'OP_TYPE_NOT_FOUND');

    const sourceLocationId = payload.sourceLocationId || opType.defaultSourceLocationId;
    const destLocationId = payload.destLocationId || opType.defaultDestLocationId;
    if (!sourceLocationId || !destLocationId) {
      throw new InventoryValidationError('Source and destination locations required', 'LOCATIONS_REQUIRED');
    }

    const name = payload.name || await nextSequenceName(tid, opType.sequenceCode, session);
    const defaultUom = await getDefaultUom(tid);

    const [transfer] = await InvTransfer.create([{
      tenantId: tid,
      name,
      operationTypeId: opType._id,
      partnerId: payload.partnerId || null,
      sourceLocationId,
      destLocationId,
      scheduledDate: payload.scheduledDate || new Date(),
      deadlineDate: payload.deadlineDate,
      origin: payload.origin,
      note: payload.note,
      priority: payload.priority || 'normal',
      procurementGroupId: payload.procurementGroupId || null,
      responsibleId: payload.responsibleId || userId,
      sourceModel: payload.sourceModel,
      sourceDocId: payload.sourceDocId,
      state: 'draft',
      createdBy: userId,
    }], { session });

    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    for (const line of lines) {
      if (!line.productId) continue;
      const product = await Product.findOne({ _id: line.productId, tenantId: tid }).session(session);
      if (!product) throw new InventoryValidationError(`Product ${line.productId} not found`, 'PRODUCT_NOT_FOUND');

      const uomId = line.uomId || product.uomId || defaultUom?._id;
      if (!uomId) throw new InventoryValidationError('UoM required — run bootstrap first', 'UOM_REQUIRED');

      const qty = decStr(line.demandQty || line.quantity || 0);
      if (D(qty).lte(0) && product.trackInventory !== false) {
        // allow zero only if explicitly passed; skip empty
        if (!line.demandQty && !line.quantity) continue;
      }

      await InvMove.create([{
        tenantId: tid,
        reference: name,
        origin: payload.origin,
        productId: product._id,
        uomId,
        demandQty: qty,
        unitCost: line.unitCost != null && line.unitCost !== '' ? String(line.unitCost) : undefined,
        sourceLocationId,
        destLocationId,
        state: 'draft',
        transferId: transfer._id,
        partnerId: payload.partnerId || null,
        sourceModel: payload.sourceModel,
        sourceDocId: payload.sourceDocId,
        sourceLineId: line.sourceLineId,
        priority: payload.priority || 'normal',
        createdBy: userId,
      }], { session });
    }

    await recomputeTransferState(transfer._id, tid, session);
    return InvTransfer.findById(transfer._id).session(session);
  });
}

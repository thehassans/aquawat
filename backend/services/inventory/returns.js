import { D, decStr, decIsPositive } from '../../utils/decimal.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import { toObjectId } from '../../models/inventory/common.js';
import { nextSequenceName } from './sequence.js';
import { runWithTransaction } from './reserve.js';
import { recomputeTransferState } from './transferState.js';
import { InventoryValidationError } from './errors.js';

/**
 * Return wizard data for a done transfer.
 */
export async function getReturnWizard(tenantId, transferId) {
  const tid = toObjectId(tenantId);
  const transfer = await InvTransfer.findOne({ _id: transferId, tenantId: tid })
    .populate('operationTypeId')
    .lean();
  if (!transfer) throw new InventoryValidationError('Transfer not found', 'NOT_FOUND');
  if (transfer.state !== 'done') {
    throw new InventoryValidationError('Only done transfers can be returned', 'NOT_DONE');
  }

  const moves = await InvMove.find({
    tenantId: tid,
    transferId,
    state: 'done',
  })
    .populate('productId', 'nameEn nameAr sku tracking')
    .lean();

  const lines = [];
  for (const m of moves) {
    const moveLines = await InvMoveLine.find({
      tenantId: tid,
      moveId: m._id,
      state: 'done',
    }).lean();

    lines.push({
      moveId: m._id,
      productId: m.productId,
      uomId: m.uomId,
      quantityDone: m.doneQty,
      quantity: m.doneQty,
      sourceLocationId: m.destLocationId,
      destLocationId: m.sourceLocationId,
      lots: moveLines.map((ml) => ({
        lotId: ml.lotId,
        packageId: ml.packageId,
        quantity: ml.quantityInProductUom || ml.quantity,
      })),
    });
  }

  return { transfer, lines };
}

/**
 * Create return transfer with source/dest swapped, chained via originMoveIds.
 */
export async function createReturnTransfer(tenantId, userId, transferId, { lines }) {
  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const original = await InvTransfer.findOne({ _id: transferId, tenantId: tid }).session(session);
    if (!original) throw new InventoryValidationError('Transfer not found', 'NOT_FOUND');
    if (original.state !== 'done') {
      throw new InventoryValidationError('Only done transfers can be returned', 'NOT_DONE');
    }

    const opType = await InvOperationType.findById(original.operationTypeId).session(session);
    let returnOpType = null;
    if (opType?.returnOperationTypeId) {
      returnOpType = await InvOperationType.findById(opType.returnOperationTypeId).session(session);
    }
    if (!returnOpType) {
      const code = opType?.code === 'incoming'
        ? 'outgoing'
        : opType?.code === 'outgoing'
          ? 'incoming'
          : 'internal';
      returnOpType = await InvOperationType.findOne({
        tenantId: tid,
        warehouseId: opType.warehouseId,
        code,
        active: true,
        sequenceCode: { $not: /\/ADJ$/ },
      }).session(session);
    }
    if (!returnOpType) {
      throw new InventoryValidationError('No return operation type configured', 'NO_RETURN_TYPE');
    }

    const name = await nextSequenceName(tid, returnOpType.sequenceCode, session);
    const [retTransfer] = await InvTransfer.create([{
      tenantId: tid,
      name,
      operationTypeId: returnOpType._id,
      partnerId: original.partnerId,
      sourceLocationId: original.destLocationId,
      destLocationId: original.sourceLocationId,
      scheduledDate: new Date(),
      origin: `Return of ${original.name}`,
      isReturn: true,
      returnOfTransferId: original._id,
      state: 'draft',
      procurementGroupId: original.procurementGroupId,
      sourceModel: original.sourceModel,
      sourceDocId: original.sourceDocId,
      createdBy: userId,
    }], { session });

    for (const line of lines || []) {
      const qty = D(line.quantity);
      if (!decIsPositive(qty)) continue;

      const origMove = await InvMove.findOne({
        _id: line.moveId,
        transferId: original._id,
        tenantId: tid,
      }).session(session);
      if (!origMove) continue;

      const maxQty = D(origMove.doneQty || origMove.demandQty);
      const retQty = qty.gt(maxQty) ? maxQty : qty;

      const [retMove] = await InvMove.create([{
        tenantId: tid,
        reference: name,
        origin: `Return of ${original.name}`,
        productId: origMove.productId,
        variantId: origMove.variantId,
        uomId: origMove.uomId,
        demandQty: decStr(retQty),
        sourceLocationId: origMove.destLocationId,
        destLocationId: origMove.sourceLocationId,
        state: 'draft',
        transferId: retTransfer._id,
        originMoveIds: [origMove._id],
        procurementGroupId: original.procurementGroupId,
        sourceModel: origMove.sourceModel,
        sourceDocId: origMove.sourceDocId,
        sourceLineId: origMove.sourceLineId,
        createdBy: userId,
      }], { session });

      origMove.destMoveIds = [...(origMove.destMoveIds || []), retMove._id];
      await origMove.save({ session });
    }

    await recomputeTransferState(retTransfer._id, tid, session);
    return InvTransfer.findById(retTransfer._id).session(session);
  });
}

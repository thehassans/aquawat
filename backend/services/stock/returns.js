import mongoose from 'mongoose';
import { D, decStr, decIsPositive } from '../../utils/decimal.js';
import {
  StockPicking,
  StockMove,
  StockMoveLine,
  StockOperationType,
} from '../../models/stock/index.js';
import { nextSequenceName } from './sequence.js';
import { runWithTransaction } from './reserve.js';
import { StockValidationError } from './errors.js';

/**
 * Return wizard data for a done picking.
 */
export async function getReturnWizard(tenantId, pickingId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const picking = await StockPicking.findOne({ _id: pickingId, tenantId: tid })
    .populate('operationTypeId')
    .lean();
  if (!picking) throw new StockValidationError('Picking not found', 'PICKING_NOT_FOUND');
  if (picking.state !== 'done') throw new StockValidationError('Only done pickings can be returned', 'NOT_DONE');

  const moves = await StockMove.find({
    tenantId: tid,
    pickingId,
    state: 'done',
  }).populate('productId').lean();

  return {
    picking,
    lines: moves.map((m) => ({
      moveId: m._id,
      productId: m.productId,
      productUomId: m.productUomId,
      quantityDone: m.quantity,
      quantity: m.quantity,
      locationId: m.locationDestId,
      locationDestId: m.locationId,
    })),
  };
}

/**
 * Create return picking with source/dest swapped, linked via moveOrigIds.
 */
export async function createReturnPicking(tenantId, userId, pickingId, { lines }) {
  return runWithTransaction(async (session) => {
    const tid = new mongoose.Types.ObjectId(String(tenantId));
    const original = await StockPicking.findOne({ _id: pickingId, tenantId: tid }).session(session);
    if (!original) throw new StockValidationError('Picking not found', 'PICKING_NOT_FOUND');
    if (original.state !== 'done') throw new StockValidationError('Only done pickings can be returned', 'NOT_DONE');

    const opType = await StockOperationType.findById(original.operationTypeId).session(session);
    let returnOpType = null;
    if (opType?.returnPickingTypeId) {
      returnOpType = await StockOperationType.findById(opType.returnPickingTypeId).session(session);
    }
    if (!returnOpType) {
      // Infer opposite: incoming ↔ outgoing, else same warehouse internal
      const code = opType?.code === 'incoming' ? 'outgoing' : opType?.code === 'outgoing' ? 'incoming' : 'internal';
      returnOpType = await StockOperationType.findOne({
        tenantId: tid,
        warehouseId: opType.warehouseId,
        code,
        active: true,
      }).session(session);
    }
    if (!returnOpType) {
      throw new StockValidationError('No return operation type configured', 'NO_RETURN_TYPE');
    }

    const name = await nextSequenceName(tid, returnOpType.sequenceCode, session);
    const [retPicking] = await StockPicking.create([{
      tenantId: tid,
      name,
      operationTypeId: returnOpType._id,
      partnerId: original.partnerId,
      locationId: original.locationDestId,
      locationDestId: original.locationId,
      scheduledDate: new Date(),
      origin: `Return of ${original.name}`,
      state: 'draft',
      groupId: original.groupId,
      createdBy: userId,
    }], { session });

    for (const line of lines || []) {
      const qty = D(line.quantity);
      if (!decIsPositive(qty)) continue;

      const origMove = await StockMove.findOne({
        _id: line.moveId,
        pickingId: original._id,
        tenantId: tid,
      }).session(session);
      if (!origMove) continue;

      const maxQty = D(origMove.quantity);
      const retQty = qty.gt(maxQty) ? maxQty : qty;

      await StockMove.create([{
        tenantId: tid,
        reference: name,
        origin: `Return of ${original.name}`,
        productId: origMove.productId,
        productUomId: origMove.productUomId,
        productUomQty: decStr(retQty),
        quantity: '0',
        locationId: origMove.locationDestId,
        locationDestId: origMove.locationId,
        state: 'draft',
        pickingId: retPicking._id,
        moveOrigIds: [origMove._id],
        groupId: original.groupId,
        createdBy: userId,
      }], { session });
    }

    return retPicking;
  });
}

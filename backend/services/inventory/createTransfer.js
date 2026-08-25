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
import { getInvSettings } from './settingsService.js';
import Customer from '../../models/Customer.js';

/**
 * Create a transfer with move lines.
 * @param {object} payload
 * @param {Array<{ productId, demandQty, uomId? }>} payload.lines
 */
export async function createTransfer(tenantId, payload, userId = null) {
  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const settings = await getInvSettings(tid);

    if (settings.groupStockWarning && payload.partnerId) {
      const partner = await Customer.findOne({ _id: payload.partnerId, tenantId: tid }).session(session);
      if (partner?.stockWarn === 'block') {
        throw new InventoryValidationError(
          partner.stockWarnMsg || 'Partner is blocked for stock operations',
          'PARTNER_BLOCK',
        );
      }
    }

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

    if (!settings.groupStockMultiLocations && String(sourceLocationId) !== String(destLocationId)
      && opType.code === 'internal') {
      throw new InventoryValidationError(
        'Internal transfers require Storage Locations to be enabled',
        'MULTI_LOC_OFF',
      );
    }

    let scheduledDate = payload.scheduledDate ? new Date(payload.scheduledDate) : new Date();
    if (opType.code === 'outgoing' && settings.securityLeadTimeSales) {
      scheduledDate = new Date(scheduledDate);
      scheduledDate.setDate(scheduledDate.getDate() - Number(settings.securityLeadTimeSales || 0));
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
      scheduledDate,
      deadlineDate: payload.deadlineDate,
      origin: payload.origin,
      note: payload.note,
      priority: payload.priority || 'normal',
      procurementGroupId: payload.procurementGroupId || null,
      ownerId: settings.groupStockTrackingOwner ? (payload.ownerId || null) : null,
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

      if (line.variantId) {
        const { default: InvProductVariant } = await import('../../models/inventory/InvProductVariant.js');
        const variant = await InvProductVariant.findOne({
          _id: line.variantId,
          tenantId: tid,
          productId: product._id,
          active: true,
        }).session(session).lean();
        if (!variant) {
          throw new InventoryValidationError('Variant not found for product', 'VARIANT_NOT_FOUND');
        }
      }

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
        variantId: line.variantId ? toObjectId(line.variantId) : null,
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

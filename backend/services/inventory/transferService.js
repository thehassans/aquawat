import { randomUUID } from 'crypto';
import { D, decStr, decIsPositive } from '../../utils/decimal.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { applyQuantDelta } from './quantDelta.js';
import { reserveMove, unreserveMove, runWithTransaction } from './reserve.js';
import { recomputeTransferState } from './transferState.js';
import { nextSequenceName } from './sequence.js';
import { resolveOrCreateLot, isLotExpired } from './lotService.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import { InventoryValidationError, InventoryConflictError } from './errors.js';
import {
  getInvSettings,
  lotsEnabled,
  packagesEnabled,
  signatureRequired,
} from './settingsService.js';
import { assertNotPeriodLocked } from './periodLock.js';
import { stampMoveDone, stampMoveLineDone } from './doneChecksum.js';
import InvQualityPoint from '../../models/inventory/InvQualityPoint.js';
import InvQualityCheck from '../../models/inventory/InvQualityCheck.js';
import Customer from '../../models/Customer.js';

/**
 * Confirm a draft transfer: moves → confirmed, optionally reserve.
 */
export async function confirmTransfer(tenantId, transferId, userId = null) {
  return runWithTransaction(async (session) => {
    const transfer = await InvTransfer.findOne({
      _id: toObjectId(transferId),
      tenantId: toObjectId(tenantId),
    }).session(session);
    if (!transfer) throw new InventoryValidationError('Transfer not found', 'NOT_FOUND');
    if (transfer.state === 'done' || transfer.state === 'cancelled') {
      throw new InventoryValidationError(`Cannot confirm transfer in state ${transfer.state}`, 'INVALID_STATE');
    }

    const settings = await getInvSettings(tenantId);
    if (settings.groupStockWarning && transfer.partnerId) {
      const partner = await Customer.findOne({
        _id: transfer.partnerId,
        tenantId: toObjectId(tenantId),
      }).session(session);
      if (partner?.stockWarn === 'block') {
        throw new InventoryValidationError(
          partner.stockWarnMsg || 'Partner is blocked for stock operations',
          'PARTNER_BLOCK',
        );
      }
    }

    const opType = await InvOperationType.findById(transfer.operationTypeId).session(session);
    const moves = await InvMove.find({
      tenantId: transfer.tenantId,
      transferId: transfer._id,
      state: { $in: ['draft', 'waiting'] },
    }).session(session);

    for (const move of moves) {
      if (move.state === 'draft') {
        move.state = 'confirmed';
        if (userId) move.updatedBy = userId;
        await move.save({ session });
      }
      if (opType?.reservationMethod === 'atConfirm' && move.state === 'confirmed') {
        await reserveMove(move, session);
      }
    }

    if (settings.moduleQuality && opType) {
      const points = await InvQualityPoint.find({
        tenantId: toObjectId(tenantId),
        operationTypeId: opType._id,
        active: true,
      }).session(session);
      for (const point of points) {
        const exists = await InvQualityCheck.findOne({
          tenantId: toObjectId(tenantId),
          transferId: transfer._id,
          pointId: point._id,
        }).session(session);
        if (!exists) {
          await InvQualityCheck.create([{
            tenantId: toObjectId(tenantId),
            pointId: point._id,
            transferId: transfer._id,
            productId: point.productId || null,
            state: 'none',
            createdBy: userId,
          }], { session });
        }
      }
    }

    await recomputeTransferState(transfer._id, tenantId, session);
    return InvTransfer.findById(transfer._id).session(session);
  });
}

/**
 * Upsert open move lines so validate processes the given quantities (partial in/out).
 */
async function applyMoveQuantities(session, tid, transfer, moveQuantities, userId) {
  for (const row of moveQuantities) {
    if (!row?.moveId) continue;
    const qty = decStr(row.quantity ?? 0);
    if (D(qty).lt(0)) {
      throw new InventoryValidationError('Done quantity cannot be negative', 'BAD_QTY');
    }
    const move = await InvMove.findOne({
      _id: toObjectId(row.moveId),
      tenantId: tid,
      transferId: transfer._id,
      state: { $nin: ['done', 'cancelled'] },
    }).session(session);
    if (!move) continue;

    // Prefer explicit variant from validate payload when move lacked one (legacy drafts)
    if (row.variantId && !move.variantId) {
      move.variantId = toObjectId(row.variantId);
      await move.save({ session });
    }

    if (D(qty).gt(D(move.demandQty))) {
      throw new InventoryValidationError(
        `Done qty exceeds demand for ${move.reference || move._id}`,
        'QTY_EXCEEDS_DEMAND',
      );
    }

    const openLines = await InvMoveLine.find({
      tenantId: tid,
      moveId: move._id,
      state: { $nin: ['done', 'cancelled'] },
    }).session(session);

    if (!openLines.length) {
      if (!decIsPositive(qty)) continue;
      await InvMoveLine.create([{
        tenantId: tid,
        moveId: move._id,
        transferId: transfer._id,
        productId: move.productId,
        variantId: move.variantId || null,
        uomId: move.uomId,
        quantity: qty,
        quantityInProductUom: qty,
        sourceLocationId: move.sourceLocationId,
        destLocationId: move.destLocationId,
        state: 'assigned',
        reference: move.reference,
        createdBy: userId,
      }], { session });
      continue;
    }

    // Collapse to a single open line with the intended qty; cancel extras
    const [primary, ...rest] = openLines;
    primary.quantity = qty;
    primary.quantityInProductUom = qty;
    if (move.variantId && !primary.variantId) {
      primary.variantId = move.variantId;
    }
    if (userId) primary.updatedBy = userId;
    await primary.save({ session });
    for (const extra of rest) {
      extra.state = 'cancelled';
      await extra.save({ session });
    }
  }
}

/**
 * Public helper — set done quantities on open moves without validating.
 */
export async function setTransferMoveQuantities(tenantId, transferId, moveQuantities, userId = null) {
  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const transfer = await InvTransfer.findOne({
      _id: toObjectId(transferId),
      tenantId: tid,
      state: { $nin: ['done', 'cancelled'] },
    }).session(session);
    if (!transfer) throw new InventoryValidationError('Transfer not found', 'NOT_FOUND');
    await applyMoveQuantities(session, tid, transfer, moveQuantities || [], userId);
    return InvTransfer.findById(transfer._id).session(session);
  });
}

/**
 * Validate (complete) a transfer — atomic, idempotent.
 */
export async function validateTransfer(tenantId, transferId, {
  userId = null,
  createBackorder = null,
  immediate = false,
  moveQuantities = null,
  signature = null,
  signedBy = null,
} = {}) {
  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const lock = randomUUID();

    const transfer = await InvTransfer.findOneAndUpdate(
      {
        _id: toObjectId(transferId),
        tenantId: tid,
        state: { $nin: ['done', 'cancelled'] },
        $or: [{ validateLock: null }, { validateLock: { $exists: false } }],
      },
      { $set: { validateLock: lock } },
      { session, new: true },
    );

    if (!transfer) {
      const existing = await InvTransfer.findOne({ _id: toObjectId(transferId), tenantId: tid }).session(session);
      if (existing?.state === 'done') return existing;
      throw new InventoryConflictError('Transfer is locked or already done', 'VALIDATE_LOCK');
    }

    try {
      const settings = await getInvSettings(tenantId);
      const opType = await InvOperationType.findById(transfer.operationTypeId).session(session);

      await assertNotPeriodLocked(tenantId, transfer.scheduledDate || transfer.dateDone || new Date(), {
        message: 'Cannot validate — inventory period is locked for this date',
        messageAr: 'لا يمكن الاعتماد — الفترة المحاسبية مقفلة لهذا التاريخ',
      });

      if (signature != null && String(signature).trim()) {
        transfer.signature = String(signature).trim();
        transfer.signedBy = signedBy ? String(signedBy).trim() : transfer.signedBy;
        transfer.signedOn = new Date();
        await transfer.save({ session });
      }

      const needsSignature = opType?.code === 'outgoing' && (
        !!opType?.requireSignature || signatureRequired(settings)
      );
      if (needsSignature && !transfer.signature) {
        throw new InventoryValidationError('Signature required on delivery', 'SIGNATURE_REQUIRED');
      }

      if (settings.moduleQuality) {
        const openChecks = await InvQualityCheck.countDocuments({
          tenantId: tid,
          transferId: transfer._id,
          state: { $ne: 'pass' },
        }).session(session);
        if (openChecks > 0) {
          throw new InventoryValidationError(
            'Quality checks incomplete — all checks must pass before validate',
            'QUALITY_PENDING',
          );
        }
      }

      if (settings.defaultPickingPolicy === 'one') {
        const openMoves = await InvMove.find({
          tenantId: tid,
          transferId: transfer._id,
          state: { $nin: ['cancelled', 'done'] },
        }).session(session);
        const allReady = openMoves.every((m) => m.state === 'assigned');
        if (!allReady) {
          throw new InventoryValidationError(
            'Waiting another operation — picking policy requires full availability',
            'WAITING_ANOTHER',
          );
        }
      }

      // Apply explicit done quantities before processing (partial receipt/delivery)
      if (Array.isArray(moveQuantities) && moveQuantities.length) {
        await applyMoveQuantities(session, tid, transfer, moveQuantities, userId);
      }

      const moves = await InvMove.find({
        tenantId: tid,
        transferId: transfer._id,
        state: { $nin: ['cancelled', 'done'] },
      }).session(session);

      if (!moves.length && !immediate) {
        throw new InventoryValidationError('Transfer has no moves to validate', 'NO_MOVES');
      }

      const backorderPolicy = createBackorder || opType?.createBackorder || 'ask';
      const valuationJobs = [];

      for (const move of moves) {
        let lines = await InvMoveLine.find({
          tenantId: tid,
          moveId: move._id,
          state: { $nin: ['done', 'cancelled'] },
        }).session(session);

        // Immediate transfer with no lines: create a single line for full demand at stock locations
        // Skip auto-create when caller already supplied moveQuantities for this move (incl. qty 0)
        const hadExplicitQty = Array.isArray(moveQuantities)
          && moveQuantities.some((q) => String(q.moveId) === String(move._id));
        if (!lines.length && immediate && decIsPositive(move.demandQty) && !hadExplicitQty) {
          await InvMoveLine.create([{
            tenantId: tid,
            moveId: move._id,
            transferId: transfer._id,
            productId: move.productId,
            variantId: move.variantId || null,
            uomId: move.uomId,
            quantity: move.demandQty,
            quantityInProductUom: move.demandQty,
            sourceLocationId: move.sourceLocationId,
            destLocationId: move.destLocationId,
            state: 'assigned',
            reference: move.reference,
            createdBy: userId,
          }], { session });
          lines = await InvMoveLine.find({
            tenantId: tid,
            moveId: move._id,
            state: { $nin: ['done', 'cancelled'] },
          }).session(session);
        }

        let doneTotal = D(0);

        for (const line of lines) {
          const qty = D(line.quantityInProductUom || line.quantity || 0);
          if (!decIsPositive(qty)) continue;

          const product = await Product.findById(line.productId).session(session);
          const tracking = product?.tracking || 'none';

          let allowNegative = !!settings.allowNegativeStock;
          if (!allowNegative && product?.categoryId) {
            const { default: InvProductCategory } = await import('../../models/inventory/InvProductCategory.js');
            const cat = await InvProductCategory.findById(product.categoryId).session(session).lean();
            allowNegative = !!cat?.allowNegativeStock;
          } else if (!allowNegative && product?.allowNegativeStock) {
            allowNegative = true;
          }

          if (!line.variantId && move.variantId) {
            line.variantId = move.variantId;
          }

          if ((line.lotId || line.lotName) && !lotsEnabled(settings)) {
            throw new InventoryValidationError('Lots & serials are disabled in settings', 'LOTS_DISABLED');
          }
          if ((line.packageId || line.resultPackageId) && !packagesEnabled(settings)) {
            throw new InventoryValidationError('Packages are disabled in settings', 'PACKAGES_DISABLED');
          }

          // Lot / serial guards
          if (tracking !== 'none') {
            if (!lotsEnabled(settings)) {
              throw new InventoryValidationError(
                'Product requires lot tracking but Lots & serials are disabled',
                'LOTS_DISABLED',
              );
            }
            if (!line.lotId && !line.lotName) {
              throw new InventoryValidationError(
                `Lot/serial required for ${product.nameEn || product.sku}`,
                'LOT_REQUIRED',
              );
            }
            if (opType?.useCreateLots === false && opType?.useExistingLots && line.lotName && !line.lotId) {
              const { default: InvLot } = await import('../../models/inventory/InvLot.js');
              const found = await InvLot.findOne({
                tenantId: tid,
                productId: product._id,
                name: line.lotName,
              }).session(session);
              if (!found) {
                throw new InventoryValidationError(`Lot "${line.lotName}" does not exist`, 'LOT_NOT_FOUND');
              }
              line.lotId = found._id;
            } else if (line.lotName && !line.lotId) {
              const lot = await resolveOrCreateLot(session, tid, product, null, line.lotName, userId);
              line.lotId = lot?._id || null;
            } else if (line.lotId) {
              const lot = await resolveOrCreateLot(session, tid, product, line.lotId, null, userId);
              if (isLotExpired(lot) && settings.blockExpiredShipping && opType?.code === 'outgoing') {
                const srcCheck = await InvLocation.findById(line.sourceLocationId).session(session);
                if (srcCheck?.usage === 'internal') {
                  throw new InventoryValidationError(
                    `Lot ${lot.name} is expired — shipping expired stock is blocked in settings`,
                    'LOT_EXPIRED',
                  );
                }
              }
            }

            if (tracking === 'serial') {
              if (D(qty).gt(1)) {
                throw new InventoryValidationError('Serial lines must be quantity 1', 'SERIAL_QTY');
              }
              const destLoc = await InvLocation.findById(line.destLocationId).session(session);
              if (destLoc?.usage === 'internal' && line.lotId) {
                const existing = await InvQuant.findOne({
                  tenantId: tid,
                  productId: line.productId,
                  lotId: line.lotId,
                  locationId: { $ne: null },
                }).session(session);
                // allow if only at non-internal or zero
                if (existing && D(existing.quantity).gt(0)) {
                  const loc = await InvLocation.findById(existing.locationId).session(session);
                  if (loc?.usage === 'internal') {
                    throw new InventoryValidationError(
                      'Serial already exists in stock',
                      'SERIAL_EXISTS',
                    );
                  }
                }
              }
              const srcLocSerial = await InvLocation.findById(line.sourceLocationId).session(session);
              if (srcLocSerial?.usage === 'internal' && line.lotId) {
                const atSrc = await InvQuant.findOne({
                  tenantId: tid,
                  productId: line.productId,
                  lotId: line.lotId,
                  locationId: line.sourceLocationId,
                }).session(session);
                if (!atSrc || D(atSrc.quantity).lte(0)) {
                  throw new InventoryValidationError(
                    'Serial not found in source location',
                    'SERIAL_NOT_IN_SOURCE',
                  );
                }
              }
            }
          }

          const srcLoc = await InvLocation.findById(line.sourceLocationId).session(session);
          let destLoc = await InvLocation.findById(line.destLocationId).session(session);

          // View locations are virtual folders — never accept stock.quant posts
          if (destLoc?.usage === 'view') {
            throw new InventoryValidationError(
              `Cannot post inventory to View location "${destLoc.completePath || destLoc.name}". Use a child Internal location.`,
              'LOC_VIEW_STOCK',
            );
          }
          if (srcLoc?.usage === 'view' && qty.gt(0)) {
            throw new InventoryValidationError(
              `Cannot pull inventory from View location "${srcLoc.completePath || srcLoc.name}".`,
              'LOC_VIEW_STOCK',
            );
          }

          // Putaway: prefer a storage bin when receiving into an internal location
          if (destLoc?.usage === 'internal') {
            try {
              const { resolvePutawayLocation } = await import('./putaway.js');
              const putawayId = await resolvePutawayLocation(tid, {
                fromLocationId: line.destLocationId,
                productId: line.productId,
                packageTypeId: line.packageTypeId,
              });
              if (putawayId && String(putawayId) !== String(line.destLocationId)) {
                line.destLocationId = putawayId;
                destLoc = await InvLocation.findById(putawayId).session(session);
              }
            } catch {
              // keep original dest if putaway resolution fails
            }
          }

          // Source: reduce on-hand and reserved only for internal locations
          if (srcLoc?.usage === 'internal') {
            await applyQuantDelta(
              session,
              tid,
              line.productId,
              line.sourceLocationId,
              decStr(qty.neg()),
              decStr(qty.neg()),
              new Date(),
              {
                variantId: line.variantId,
                lotId: line.lotId,
                packageId: line.packageId,
                ownerId: line.ownerId,
                tracking,
                allowNegative,
                productLabel: product?.nameEn || product?.sku || product?.nameAr,
                locationLabel: srcLoc?.completeName || srcLoc?.name,
                requestedQty: decStr(qty),
              },
            );
          }

          // Dest: increase on-hand only for internal locations
          if (destLoc?.usage === 'internal') {
            const destDims = {
              variantId: line.variantId,
              lotId: line.lotId,
              packageId: line.resultPackageId || line.packageId,
              ownerId: line.ownerId,
              tracking,
              allowNegative,
            };
            if (transfer.isReturn) {
              destDims.inventoryStatus = 'quarantine';
            }
            await applyQuantDelta(
              session,
              tid,
              line.productId,
              line.destLocationId,
              decStr(qty),
              '0',
              new Date(),
              destDims,
            );
          }

          // Valuation when crossing internal boundary (only if costing / full accounting)
          const srcInternal = srcLoc?.usage === 'internal';
          const destInternal = destLoc?.usage === 'internal';
          const { isInventoryEvaluationOn } = await import('./accountingMode.js');
          const evaluationOn = isInventoryEvaluationOn(settings);
          if (srcInternal !== destInternal && evaluationOn) {
            try {
              const { createValuationForMove } = await import('./valuation.js');
              const direction = destInternal && !srcInternal ? 'in' : 'out';
              let unitCost = move.unitCost != null && move.unitCost !== ''
                ? move.unitCost
                : (product?.costPrice != null ? String(product.costPrice) : undefined);
              const moveVariantId = move.variantId || line.variantId || null;
              if ((unitCost == null || unitCost === '') && moveVariantId) {
                const InvProductVariant = (await import('../../models/inventory/InvProductVariant.js')).default;
                const variant = await InvProductVariant.findById(moveVariantId).select('standardPrice').lean();
                if (variant?.standardPrice != null && variant.standardPrice !== '') {
                  unitCost = String(variant.standardPrice);
                }
              }
              const val = await createValuationForMove(session, {
                tenantId: tid,
                productId: line.productId,
                variantId: move.variantId || line.variantId || null,
                quantity: decStr(qty),
                moveId: move._id,
                direction,
                unitCostOverride: direction === 'in' ? unitCost : undefined,
                description: `${transfer.name || ''} ${direction}`,
                evaluationEnabled: evaluationOn,
              });
              if (val?.layer) {
                valuationJobs.push({
                  layerId: val.layer._id,
                  direction: val.direction,
                  valuationMode: val.valuationMode,
                  productId: line.productId,
                  // Receipts: dest location; deliveries: source location
                  locationId: direction === 'in' ? line.destLocationId : line.sourceLocationId,
                });
              }
            } catch (err) {
              console.error('[inventory] valuation layer failed', err?.message || err);
            }
          }

          stampMoveLineDone(line);
          await line.save({ session });
          doneTotal = doneTotal.plus(qty);
        }

        const remaining = D(move.demandQty).minus(doneTotal);
        move.doneQty = decStr(doneTotal);
        stampMoveDone(move);
        if (userId) move.updatedBy = userId;
        await move.save({ session });

        if (remaining.gt(0)) {
          if (backorderPolicy === 'never') {
            // drop remaining demand
          } else if (backorderPolicy === 'ask' && createBackorder == null) {
            throw new InventoryValidationError(
              'Partial validation requires backorder decision',
              'BACKORDER_REQUIRED',
            );
          } else if (backorderPolicy === 'always' || createBackorder === true) {
            await createBackorderMove(session, transfer, move, decStr(remaining), opType, userId);
          }
        }
      }

      // Chain: waiting dest moves whose origins are all done → confirmed + reserve
      const allMoves = await InvMove.find({ tenantId: tid, transferId: transfer._id }).session(session);
      for (const m of allMoves) {
        for (const destId of m.destMoveIds || []) {
          const dest = await InvMove.findById(destId).session(session);
          if (!dest || dest.state !== 'waiting') continue;
          const origins = await InvMove.find({ _id: { $in: dest.originMoveIds || [] } }).session(session);
          if (origins.length && origins.every((o) => o.state === 'done')) {
            dest.state = 'confirmed';
            await dest.save({ session });
            await reserveMove(dest, session);
            if (dest.transferId) {
              await recomputeTransferState(dest.transferId, tenantId, session);
            }
          }
        }
      }

      transfer.validateLock = null;
      transfer.state = 'done';
      transfer.doneDate = new Date();
      if (userId) transfer.updatedBy = userId;
      await transfer.save({ session });
      await recomputeTransferState(transfer._id, tenantId, session);

      return {
        transfer: await InvTransfer.findById(transfer._id).session(session),
        valuationJobs,
      };
    } catch (err) {
      await InvTransfer.updateOne(
        { _id: transfer._id, validateLock: lock },
        { $set: { validateLock: null } },
        { session },
      );
      throw err;
    }
  }).then(async (result) => {
    if (!result?.transfer) return result;
    const jobs = result.valuationJobs || [];
    if (jobs.length) {
      try {
        const { postValuationLayerJournal } = await import('./stockAccounting.js');
        for (const job of jobs) {
          await postValuationLayerJournal({
            tenantId,
            userId,
            layerId: job.layerId,
            direction: job.direction,
            valuationMode: job.valuationMode,
            productId: job.productId,
            locationId: job.locationId,
          });
        }
      } catch (err) {
        console.error('[inventory] valuation journal failed', err?.message || err);
      }
    }
    try {
      const moves = await InvMove.find({
        tenantId: toObjectId(tenantId),
        transferId: result.transfer._id,
      }).select('productId').lean();
      const { syncProductsStockCache } = await import('./syncProductCache.js');
      await syncProductsStockCache(
        tenantId,
        moves.map((m) => m.productId),
      );
    } catch (err) {
      console.error('[inventory] product cache sync failed', err?.message || err);
    }
    try {
      const { sendDeliveryConfirmations } = await import('./deliveryConfirmations.js');
      await sendDeliveryConfirmations(tenantId, result.transfer);
    } catch (err) {
      console.error('[inventory] delivery confirmation failed', err?.message || err);
    }
    try {
      const { dispatchInventoryWebhook } = await import('./webhooks.js');
      await dispatchInventoryWebhook(tenantId, 'picking.validated', {
        transferId: result.transfer._id,
        name: result.transfer.name,
        state: result.transfer.state,
      });
    } catch (err) {
      console.error('[inventory] webhook dispatch failed', err?.message || err);
    }
    try {
      const fresh = await InvTransfer.findById(result.transfer._id);
      if (fresh) return fresh;
    } catch {
      /* ignore reload errors */
    }
    return result.transfer;
  });
}

async function createBackorderMove(session, transfer, move, remainingQty, opType, userId) {
  const name = await nextSequenceName(transfer.tenantId, opType.sequenceCode, session);
  const [backorder] = await InvTransfer.create([{
    tenantId: transfer.tenantId,
    name,
    operationTypeId: transfer.operationTypeId,
    partnerId: transfer.partnerId,
    sourceLocationId: transfer.sourceLocationId,
    destLocationId: transfer.destLocationId,
    scheduledDate: transfer.scheduledDate,
    origin: transfer.origin,
    backorderOfId: transfer._id,
    procurementGroupId: transfer.procurementGroupId,
    sourceModel: transfer.sourceModel,
    sourceDocId: transfer.sourceDocId,
    state: 'confirmed',
    createdBy: userId,
  }], { session });

  const [boMove] = await InvMove.create([{
    tenantId: transfer.tenantId,
    reference: name,
    origin: transfer.origin,
    productId: move.productId,
    variantId: move.variantId,
    uomId: move.uomId,
    demandQty: remainingQty,
    sourceLocationId: move.sourceLocationId,
    destLocationId: move.destLocationId,
    finalLocationId: move.finalLocationId,
    state: 'confirmed',
    transferId: backorder._id,
    procurementGroupId: move.procurementGroupId,
    sourceModel: move.sourceModel,
    sourceDocId: move.sourceDocId,
    sourceLineId: move.sourceLineId,
    createdBy: userId,
  }], { session });

  return { backorder, boMove };
}

export async function checkAvailability(tenantId, transferId) {
  return runWithTransaction(async (session) => {
    const settings = await getInvSettings(tenantId);
    const moves = await InvMove.find({
      tenantId: toObjectId(tenantId),
      transferId: toObjectId(transferId),
      state: { $in: ['confirmed', 'partiallyAvailable', 'assigned'] },
    }).session(session);
    for (const move of moves) {
      await unreserveMove(move, session);
      await reserveMove(move, session);
    }
    await recomputeTransferState(transferId, tenantId, session);

    if (settings.defaultPickingPolicy === 'one') {
      const after = await InvMove.find({
        tenantId: toObjectId(tenantId),
        transferId: toObjectId(transferId),
        state: { $nin: ['cancelled', 'done'] },
      }).session(session);
      const allAssigned = after.length > 0 && after.every((m) => m.state === 'assigned');
      if (!allAssigned) {
        for (const move of after) {
          if (move.state === 'assigned' || move.state === 'partiallyAvailable') {
            await unreserveMove(move, session);
          }
        }
        await InvTransfer.updateOne(
          { _id: toObjectId(transferId), tenantId: toObjectId(tenantId) },
          { $set: { state: 'waiting' } },
          { session },
        );
        const transfer = await InvTransfer.findById(transferId).session(session);
        return { ...transfer.toObject(), waitingAnotherOperation: true };
      }
    }

    return InvTransfer.findById(transferId).session(session);
  });
}

export async function unreserveTransfer(tenantId, transferId) {
  return runWithTransaction(async (session) => {
    const moves = await InvMove.find({
      tenantId: toObjectId(tenantId),
      transferId: toObjectId(transferId),
      state: { $nin: ['done', 'cancelled'] },
    }).session(session);
    for (const move of moves) {
      await unreserveMove(move, session);
    }
    await recomputeTransferState(transferId, tenantId, session);
    return InvTransfer.findById(transferId).session(session);
  });
}

export async function cancelTransfer(tenantId, transferId, userId = null, { reason = null } = {}) {
  return runWithTransaction(async (session) => {
    const transfer = await InvTransfer.findOne({
      _id: toObjectId(transferId),
      tenantId: toObjectId(tenantId),
    }).session(session);
    if (!transfer) throw new InventoryValidationError('Transfer not found', 'NOT_FOUND');
    if (transfer.state === 'done') {
      throw new InventoryValidationError('Cannot cancel a done transfer', 'INVALID_STATE');
    }

    const moves = await InvMove.find({
      tenantId: transfer.tenantId,
      transferId: transfer._id,
      state: { $ne: 'done' },
    }).session(session);

    for (const move of moves) {
      await unreserveMove(move, session);
      move.state = 'cancelled';
      if (userId) move.updatedBy = userId;
      await move.save({ session });

      if (move.propagateCancel) {
        for (const destId of move.destMoveIds || []) {
          const dest = await InvMove.findById(destId).session(session);
          if (dest && dest.state !== 'done') {
            await unreserveMove(dest, session);
            dest.state = 'cancelled';
            await dest.save({ session });
            if (dest.transferId) await recomputeTransferState(dest.transferId, tenantId, session);
          }
        }
      }
    }

    transfer.state = 'cancelled';
    if (reason?.trim()) {
      transfer.cancelReason = String(reason).trim().slice(0, 500);
      const stamp = `[cancelled ${new Date().toISOString()}] ${transfer.cancelReason}`;
      transfer.note = transfer.note ? `${transfer.note}\n${stamp}` : stamp;
    }
    if (userId) transfer.updatedBy = userId;
    await transfer.save({ session });
    return transfer;
  });
}

/** Duplicate a transfer (moves copied as draft lines). */
export async function duplicateTransfer(tenantId, transferId, userId = null) {
  const tid = toObjectId(tenantId);
  const src = await InvTransfer.findOne({ _id: toObjectId(transferId), tenantId: tid }).lean();
  if (!src) throw new InventoryValidationError('Transfer not found', 'NOT_FOUND');

  const moves = await InvMove.find({ tenantId: tid, transferId: src._id }).lean();
  const { createTransfer } = await import('./createTransfer.js');
  return createTransfer(tenantId, {
    operationTypeId: src.operationTypeId,
    partnerId: src.partnerId,
    sourceLocationId: src.sourceLocationId,
    destLocationId: src.destLocationId,
    origin: src.origin ? `${src.origin} (copy)` : undefined,
    note: src.note,
    priority: src.priority,
    deadlineDate: src.deadlineDate,
    ownerId: src.ownerId,
    carrierId: src.carrierId,
    lines: moves.map((m) => ({
      productId: m.productId,
      demandQty: m.demandQty,
      variantId: m.variantId,
      uomId: m.uomId,
      productPackagingId: m.productPackagingId,
      packagingQty: m.packagingQty,
    })),
  }, userId);
}

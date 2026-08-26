import Product from '../../models/Product.js';
import InvProductRelation, { PRODUCT_RELATION_TYPES } from '../../models/inventory/InvProductRelation.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

export async function listRelations(tenantId, {
  productId,
  type,
  direction = 'outgoing',
  activeOnly = true,
} = {}) {
  const tid = toObjectId(tenantId);
  const filter = { tenantId: tid };
  if (activeOnly) filter.active = true;
  if (type && PRODUCT_RELATION_TYPES.includes(type)) filter.type = type;

  if (productId) {
    const pid = toObjectId(productId);
    if (direction === 'incoming') filter.relatedProductId = pid;
    else if (direction === 'both') {
      filter.$or = [{ sourceProductId: pid }, { relatedProductId: pid }];
    } else {
      filter.sourceProductId = pid;
    }
  }

  return InvProductRelation.find(filter)
    .populate('sourceProductId', 'nameEn nameAr sku productId status isActive sellingPrice')
    .populate('relatedProductId', 'nameEn nameAr sku productId status isActive sellingPrice')
    .sort({ type: 1, sequence: 1 })
    .lean();
}

export async function upsertRelation(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const sourceProductId = toObjectId(body.sourceProductId);
  const relatedProductId = toObjectId(body.relatedProductId);
  const type = body.type;

  if (!PRODUCT_RELATION_TYPES.includes(type)) {
    throw new InventoryValidationError('Invalid relation type', 'RELATION_TYPE');
  }
  if (String(sourceProductId) === String(relatedProductId)) {
    throw new InventoryValidationError('Cannot relate a product to itself', 'RELATION_SELF');
  }

  const [source, related] = await Promise.all([
    Product.findOne({ _id: sourceProductId, tenantId: tid }).lean(),
    Product.findOne({ _id: relatedProductId, tenantId: tid }).lean(),
  ]);
  if (!source || !related) {
    throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  }

  const doc = await InvProductRelation.findOneAndUpdate(
    { tenantId: tid, sourceProductId, relatedProductId, type },
    {
      $set: {
        sequence: Number(body.sequence) || 10,
        note: body.note ? String(body.note).trim() : undefined,
        noteAr: body.noteAr ? String(body.noteAr).trim() : undefined,
        active: body.active !== false,
        updatedBy: userId,
      },
      $setOnInsert: {
        tenantId: tid,
        sourceProductId,
        relatedProductId,
        type,
        createdBy: userId,
      },
    },
    { upsert: true, new: true },
  );

  if (body.createReverse) {
    await InvProductRelation.findOneAndUpdate(
      {
        tenantId: tid,
        sourceProductId: relatedProductId,
        relatedProductId: sourceProductId,
        type,
      },
      {
        $set: {
          sequence: Number(body.sequence) || 10,
          active: body.active !== false,
          updatedBy: userId,
        },
        $setOnInsert: {
          tenantId: tid,
          sourceProductId: relatedProductId,
          relatedProductId: sourceProductId,
          type,
          createdBy: userId,
        },
      },
      { upsert: true, new: true },
    );
  }

  return doc;
}

export async function deleteRelation(tenantId, id) {
  const doc = await InvProductRelation.findOneAndDelete({
    _id: id,
    tenantId: toObjectId(tenantId),
  });
  if (!doc) throw new InventoryValidationError('Relation not found', 'RELATION_NOT_FOUND');
  return { deleted: true, id: doc._id };
}

/** Suggestions for sales/POS — active related products only; substitutes require isActive. */
export async function suggestionsForProduct(tenantId, productId, { types } = {}) {
  const rows = await listRelations(tenantId, {
    productId,
    direction: 'outgoing',
    activeOnly: true,
  });
  const wanted = Array.isArray(types) && types.length ? new Set(types) : null;
  return rows.filter((r) => {
    if (wanted && !wanted.has(r.type)) return false;
    const rel = r.relatedProductId;
    if (!rel || rel.isActive === false || rel.status === 'inactive' || rel.status === 'discontinued') {
      return false;
    }
    return true;
  });
}

import mongoose from 'mongoose';
import StockProductAttribute from '../../models/stock/StockProductAttribute.js';
import StockProductAttributeValue from '../../models/stock/StockProductAttributeValue.js';
import StockProductTemplateAttributeLine from '../../models/stock/StockProductTemplateAttributeLine.js';
import StockProductVariant from '../../models/stock/StockProductVariant.js';
import StockMove from '../../models/stock/StockMove.js';
import { StockValidationError } from './errors.js';

/**
 * Cartesian product of value-id arrays.
 * @param {string[][]} arrays
 * @returns {string[][]}
 */
export function cartesianProduct(arrays) {
  if (!arrays.length) return [[]];
  return arrays.reduce(
    (acc, cur) => acc.flatMap((a) => cur.map((v) => [...a, v])),
    [[]],
  );
}

function comboKey(ids) {
  return [...ids].map(String).sort().join('|');
}

/**
 * Regenerate variants for a template from attribute lines with createVariant=always.
 * Archives (never deletes) variants — especially those that already have stock moves.
 */
export async function regenerateVariants(tenantId, templateId, { session = null } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const tplId = new mongoose.Types.ObjectId(String(templateId));
  const q = (fn) => (session ? fn.session(session) : fn);

  const lines = await q(StockProductTemplateAttributeLine.find({
    tenantId: tid,
    templateId: tplId,
  })).lean();

  const alwaysLines = [];
  for (const line of lines) {
    const attr = await q(StockProductAttribute.findById(line.attributeId)).lean();
    if (!attr || attr.createVariant !== 'always') continue;
    const valueIds = (line.valueIds || []).map(String);
    if (!valueIds.length) continue;
    alwaysLines.push({ attributeId: String(line.attributeId), valueIds });
  }

  const desiredCombos = alwaysLines.length
    ? cartesianProduct(alwaysLines.map((l) => l.valueIds)).map((ids) => ids.map(String))
    : [[]];

  const existing = await q(StockProductVariant.find({ tenantId: tid, templateId: tplId }));
  const byKey = new Map();
  for (const v of existing) {
    byKey.set(comboKey(v.attributeValueIds || []), v);
  }

  let created = 0;
  let archived = 0;
  let kept = 0;
  const archivedWithMoves = [];

  for (const combo of desiredCombos) {
    const key = comboKey(combo);
    const found = byKey.get(key);
    if (found) {
      if (!found.active) {
        found.active = true;
        await found.save(session ? { session } : undefined);
      }
      kept += 1;
      byKey.delete(key);
    } else {
      await StockProductVariant.create([{
        tenantId: tid,
        templateId: tplId,
        attributeValueIds: combo.map((id) => new mongoose.Types.ObjectId(id)),
        active: true,
      }], session ? { session } : {});
      created += 1;
    }
  }

  for (const [, variant] of byKey) {
    const hasMoves = await q(StockMove.exists({
      tenantId: tid,
      productId: variant._id,
    }));

    if (variant.active) {
      variant.active = false;
      await variant.save(session ? { session } : undefined);
      archived += 1;
    }
    if (hasMoves) archivedWithMoves.push(String(variant._id));
  }

  const warning = archivedWithMoves.length
    ? 'Some variants already have stock moves and were archived instead of deleted.'
    : null;

  return { created, archived, kept, warning, archivedWithMoves };
}

export async function listTemplateAttributeLines(tenantId, templateId) {
  const lines = await StockProductTemplateAttributeLine.find({
    tenantId,
    templateId,
  }).lean();

  const enriched = [];
  for (const line of lines) {
    const attribute = await StockProductAttribute.findById(line.attributeId).lean();
    const values = await StockProductAttributeValue.find({
      _id: { $in: line.valueIds || [] },
      tenantId,
    }).sort({ sequence: 1 }).lean();
    enriched.push({ ...line, attribute, values });
  }
  return enriched;
}

export async function setTemplateAttributeLine(tenantId, templateId, { attributeId, valueIds }, userId) {
  if (!attributeId) throw new StockValidationError('attributeId required', 'ATTR_REQUIRED');
  const values = await StockProductAttributeValue.find({
    tenantId,
    attributeId,
    _id: { $in: valueIds || [] },
  }).lean();
  if ((valueIds || []).length && values.length !== valueIds.length) {
    throw new StockValidationError('Invalid attribute values', 'ATTR_VALUE_INVALID');
  }

  return StockProductTemplateAttributeLine.findOneAndUpdate(
    { tenantId, templateId, attributeId },
    {
      $set: {
        valueIds: values.map((v) => v._id),
        createdBy: userId,
      },
      $setOnInsert: { tenantId, templateId, attributeId },
    },
    { upsert: true, new: true },
  );
}

export async function deleteTemplateAttributeLine(tenantId, templateId, attributeId) {
  await StockProductTemplateAttributeLine.deleteOne({ tenantId, templateId, attributeId });
}

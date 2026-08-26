import Product from '../../models/Product.js';
import InvProductAttribute from '../../models/inventory/InvProductAttribute.js';
import InvAttributeValue from '../../models/inventory/InvAttributeValue.js';
import InvProductVariant from '../../models/inventory/InvProductVariant.js';
import InvAttributeExclusion from '../../models/inventory/InvAttributeExclusion.js';
import InvTemplateAttributeValue from '../../models/inventory/InvTemplateAttributeValue.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { getInvSettings } from './settingsService.js';

export const MAX_VARIANTS_PER_TEMPLATE = 1000;

function combinationKeyFromIds(valueIds) {
  return [...valueIds]
    .map((id) => String(id))
    .sort()
    .join('|');
}

function comboViolatesExclusion(comboIds, exclusions) {
  const set = new Set(comboIds.map(String));
  for (const ex of exclusions) {
    if (!ex.active) continue;
    const trigger = String(ex.attributeValueId);
    if (!set.has(trigger)) continue;
    for (const excluded of ex.excludedValueIds || []) {
      if (set.has(String(excluded))) return true;
    }
  }
  return false;
}

async function assertVariantsEnabled(tenantId) {
  const settings = await getInvSettings(tenantId);
  if (!settings.groupProductVariant) {
    throw new InventoryValidationError('Product variants are disabled in settings', 'VARIANTS_DISABLED');
  }
}

export async function listAttributes(tenantId, { activeOnly = true } = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (activeOnly) filter.active = true;
  return InvProductAttribute.find(filter).sort({ sequence: 1, name: 1 }).lean();
}

export async function createAttribute(tenantId, userId, body) {
  await assertVariantsEnabled(tenantId);
  const name = String(body.name || '').trim();
  if (!name) throw new InventoryValidationError('Attribute name required', 'ATTR_NAME');
  const mode = ['always', 'dynamic', 'never'].includes(body.createVariantMode)
    ? body.createVariantMode
    : (body.createVariant === false ? 'never' : 'always');
  return InvProductAttribute.create({
    tenantId: toObjectId(tenantId),
    name,
    nameAr: body.nameAr ? String(body.nameAr).trim() : undefined,
    createVariant: mode !== 'never',
    createVariantMode: mode,
    displayType: ['radio', 'select', 'color', 'pill', 'image'].includes(body.displayType)
      ? body.displayType
      : 'select',
    sequence: Number(body.sequence) || 10,
    active: body.active !== false,
    createdBy: userId,
  });
}

export async function updateAttribute(tenantId, id, userId, body) {
  await assertVariantsEnabled(tenantId);
  const doc = await InvProductAttribute.findOne({ _id: id, tenantId: toObjectId(tenantId) });
  if (!doc) throw new InventoryValidationError('Attribute not found', 'ATTR_NOT_FOUND');

  const nextMode = body.createVariantMode != null && ['always', 'dynamic', 'never'].includes(body.createVariantMode)
    ? body.createVariantMode
    : (body.createVariant != null
      ? (body.createVariant ? 'always' : 'never')
      : null);

  if (nextMode && nextMode !== doc.createVariantMode) {
    const inUse = await InvProductVariant.exists({
      tenantId: toObjectId(tenantId),
      attributeValueIds: {
        $in: await InvAttributeValue.find({
          tenantId: toObjectId(tenantId),
          attributeId: doc._id,
        }).distinct('_id'),
      },
    });
    if (inUse) {
      throw new InventoryValidationError(
        'Cannot change create-variant mode while this attribute is used by existing variants — archive values instead',
        'ATTR_MODE_LOCKED',
      );
    }
  }

  if (body.name != null) doc.name = String(body.name).trim();
  if (body.nameAr != null) doc.nameAr = String(body.nameAr).trim();
  if (body.displayType != null && ['radio', 'select', 'color', 'pill', 'image'].includes(body.displayType)) {
    doc.displayType = body.displayType;
  }
  if (nextMode) {
    doc.createVariantMode = nextMode;
    doc.createVariant = nextMode !== 'never';
  }
  if (body.sequence != null) doc.sequence = Number(body.sequence) || 10;
  if (body.active != null) doc.active = !!body.active;
  doc.updatedBy = userId;
  await doc.save();
  return doc;
}

export async function listAttributeValues(tenantId, attributeId) {
  return InvAttributeValue.find({
    tenantId: toObjectId(tenantId),
    attributeId: toObjectId(attributeId),
  }).sort({ sequence: 1, name: 1 }).lean();
}

export async function createAttributeValue(tenantId, userId, attributeId, body) {
  await assertVariantsEnabled(tenantId);
  const attr = await InvProductAttribute.findOne({
    _id: attributeId,
    tenantId: toObjectId(tenantId),
  }).lean();
  if (!attr) throw new InventoryValidationError('Attribute not found', 'ATTR_NOT_FOUND');
  const name = String(body.name || '').trim();
  if (!name) throw new InventoryValidationError('Value name required', 'VALUE_NAME');
  return InvAttributeValue.create({
    tenantId: toObjectId(tenantId),
    attributeId: attr._id,
    name,
    nameAr: body.nameAr ? String(body.nameAr).trim() : undefined,
    extraPrice: Number(body.extraPrice) || 0,
    htmlColor: body.htmlColor ? String(body.htmlColor).trim() : undefined,
    imageUrl: body.imageUrl || undefined,
    isCustom: !!body.isCustom,
    sequence: Number(body.sequence) || 10,
    active: body.active !== false,
    createdBy: userId,
  });
}

export async function updateAttributeValue(tenantId, id, userId, body) {
  await assertVariantsEnabled(tenantId);
  const doc = await InvAttributeValue.findOne({ _id: id, tenantId: toObjectId(tenantId) });
  if (!doc) throw new InventoryValidationError('Value not found', 'VALUE_NOT_FOUND');
  if (body.name != null) doc.name = String(body.name).trim();
  if (body.nameAr != null) doc.nameAr = String(body.nameAr).trim();
  if (body.extraPrice != null) doc.extraPrice = Number(body.extraPrice) || 0;
  if (body.htmlColor != null) doc.htmlColor = String(body.htmlColor).trim() || undefined;
  if (body.imageUrl != null) doc.imageUrl = body.imageUrl || undefined;
  if (body.isCustom != null) doc.isCustom = !!body.isCustom;
  if (body.sequence != null) doc.sequence = Number(body.sequence) || 10;
  if (body.active != null) doc.active = !!body.active;
  doc.updatedBy = userId;
  await doc.save();
  return doc;
}

export async function listVariants(tenantId, {
  productId,
  q,
  attributeId,
  activeOnly = true,
  limit = 200,
  enrichStock = false,
} = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (productId) filter.productId = toObjectId(productId);
  if (activeOnly) filter.active = true;
  if (q) {
    const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: re }, { sku: re }, { barcode: re }];
  }
  let rows = await InvProductVariant.find(filter)
    .populate('attributeValueIds', 'name nameAr attributeId extraPrice')
    .populate('productId', 'nameEn nameAr sku productId costPrice sellingPrice')
    .sort({ name: 1 })
    .limit(Math.min(500, Number(limit) || 200))
    .lean();

  if (attributeId) {
    const aid = String(attributeId);
    rows = rows.filter((v) => (v.attributeValueIds || []).some((val) => String(val.attributeId) === aid));
  }

  if (!enrichStock || !rows.length) return rows;

  const { computeForecast } = await import('./forecast.js');
  const out = [];
  for (const v of rows) {
    const pid = v.productId?._id || v.productId;
    let stock = { onHand: '0', forecasted: '0' };
    try {
      // eslint-disable-next-line no-await-in-loop
      const fc = await computeForecast(tenantId, pid, { variantId: v._id });
      stock = { onHand: fc.onHand, forecasted: fc.forecast };
    } catch {
      // ignore
    }
    const valueExtra = (v.attributeValueIds || []).reduce((s, val) => s + (Number(val.extraPrice) || 0), 0);
    const extra = Number(v.extraPrice) || valueExtra;
    const base = Number(v.productId?.sellingPrice) || 0;
    const cost = Number(v.productId?.costPrice) || 0;
    out.push({
      ...v,
      onHand: stock.onHand,
      forecasted: stock.forecasted,
      cost,
      price: base + extra,
      extraPrice: extra,
      productCode: v.productId?.productId || '',
      attributeValuesLabel: (v.attributeValueIds || []).map((val) => val.name).join(' / '),
    });
  }
  return out;
}

export async function createVariant(tenantId, userId, body) {
  await assertVariantsEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const product = await Product.findOne({ _id: body.productId, tenantId: tid }).lean();
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const valueIds = [...new Set((body.attributeValueIds || []).map((id) => String(id)))];
  if (!valueIds.length && !body.name) {
    throw new InventoryValidationError('attributeValueIds or name required', 'VARIANT_DIMS');
  }

  let values = [];
  if (valueIds.length) {
    values = await InvAttributeValue.find({
      tenantId: tid,
      _id: { $in: valueIds.map(toObjectId) },
      active: true,
    }).lean();
    if (values.length !== valueIds.length) {
      throw new InventoryValidationError('One or more attribute values invalid', 'VALUE_INVALID');
    }
  }

  const key = valueIds.length
    ? combinationKeyFromIds(values.map((v) => v._id))
    : `manual:${String(body.name).trim().toLowerCase()}`;

  const name = body.name
    ? String(body.name).trim()
    : values.map((v) => v.name).join(' / ');
  const nameAr = body.nameAr
    ? String(body.nameAr).trim()
    : values.map((v) => v.nameAr || v.name).join(' / ');

  try {
    return await InvProductVariant.create({
      tenantId: tid,
      productId: product._id,
      name,
      nameAr,
      sku: body.sku ? String(body.sku).trim() : undefined,
      barcode: body.barcode ? String(body.barcode).trim() : undefined,
      attributeValueIds: values.map((v) => v._id),
      combinationKey: key,
      active: body.active !== false,
      createdBy: userId,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new InventoryValidationError('Variant combination already exists', 'VARIANT_DUP');
    }
    throw err;
  }
}

export async function updateVariant(tenantId, id, userId, body) {
  await assertVariantsEnabled(tenantId);
  const doc = await InvProductVariant.findOne({ _id: id, tenantId: toObjectId(tenantId) });
  if (!doc) throw new InventoryValidationError('Variant not found', 'VARIANT_NOT_FOUND');
  if (body.name != null) doc.name = String(body.name).trim();
  if (body.nameAr != null) doc.nameAr = String(body.nameAr).trim();
  if (body.sku != null) doc.sku = String(body.sku).trim() || undefined;
  if (body.barcode != null) doc.barcode = String(body.barcode).trim() || undefined;
  if (body.extraPrice != null) doc.extraPrice = Number(body.extraPrice) || 0;
  if (body.imageUrl != null) doc.imageUrl = body.imageUrl || undefined;
  if (body.imageThumbUrl != null) doc.imageThumbUrl = body.imageThumbUrl || undefined;
  if (body.active != null) doc.active = !!body.active;
  doc.updatedBy = userId;
  await doc.save();
  return doc;
}

/** Cartesian product of Always attribute lines. Applies exclusions; archives obsolete combos. */
export async function generateVariants(tenantId, userId, {
  productId,
  attributeIds,
  attributeLines,
  dryRun = false,
} = {}) {
  await assertVariantsEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const product = await Product.findOne({ _id: productId, tenantId: tid });
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const lines = Array.isArray(attributeLines) && attributeLines.length
    ? attributeLines
    : (product.attributeLines || []).map((l) => ({
      attributeId: l.attributeId,
      valueIds: l.valueIds,
      createVariantMode: l.createVariantMode || 'always',
    }));

  let valueLists = [];
  if (lines.length) {
    for (const line of lines) {
      const mode = line.createVariantMode || 'always';
      if (mode !== 'always') continue;
      const vals = await InvAttributeValue.find({
        tenantId: tid,
        attributeId: toObjectId(line.attributeId),
        active: true,
        ...(line.valueIds?.length ? { _id: { $in: line.valueIds.map(toObjectId) } } : {}),
      }).sort({ sequence: 1 }).lean();
      if (!vals.length) {
        throw new InventoryValidationError('An Always attribute line has no values', 'NO_VALUES');
      }
      valueLists.push(vals);
    }
  } else {
    const attrFilter = {
      tenantId: tid,
      active: true,
      $or: [{ createVariantMode: 'always' }, { createVariant: true, createVariantMode: { $exists: false } }],
    };
    if (attributeIds?.length) {
      attrFilter._id = { $in: attributeIds.map(toObjectId) };
    }
    const attrs = await InvProductAttribute.find(attrFilter).sort({ sequence: 1 }).lean();
    if (!attrs.length) {
      throw new InventoryValidationError('No attributes selected for variant generation', 'NO_ATTRS');
    }
    for (const attr of attrs) {
      const vals = await InvAttributeValue.find({
        tenantId: tid,
        attributeId: attr._id,
        active: true,
      }).sort({ sequence: 1 }).lean();
      if (!vals.length) {
        throw new InventoryValidationError(`Attribute "${attr.name}" has no values`, 'NO_VALUES');
      }
      valueLists.push(vals);
    }
  }

  if (!valueLists.length) {
    throw new InventoryValidationError('No Always attributes to generate', 'NO_ATTRS');
  }

  let combos = [[]];
  for (const list of valueLists) {
    const next = [];
    for (const prefix of combos) {
      for (const v of list) next.push([...prefix, v]);
    }
    combos = next;
  }

  const rawCount = combos.length;
  if (rawCount > MAX_VARIANTS_PER_TEMPLATE) {
    throw new InventoryValidationError(
      `Refusing to generate ${rawCount} variants (max ${MAX_VARIANTS_PER_TEMPLATE}). Reduce attributes or values.`,
      'VARIANT_LIMIT',
      { count: rawCount, max: MAX_VARIANTS_PER_TEMPLATE },
    );
  }

  const exclusions = await InvAttributeExclusion.find({
    tenantId: tid,
    templateId: product._id,
    active: true,
  }).lean();

  const beforeExclusion = combos.length;
  combos = combos.filter((c) => !comboViolatesExclusion(c.map((v) => v._id), exclusions));
  const excludedCount = beforeExclusion - combos.length;

  const templateExtras = await InvTemplateAttributeValue.find({
    tenantId: tid,
    templateId: product._id,
    active: true,
  }).lean();
  const extraByValueId = new Map(
    templateExtras.map((t) => [String(t.attributeValueId), Number(t.priceExtra) || 0]),
  );

  const wantedKeys = new Set(combos.map((c) => combinationKeyFromIds(c.map((v) => v._id))));
  const existingAll = await InvProductVariant.find({
    tenantId: tid,
    productId: product._id,
  }).lean();

  const InvMove = (await import('../../models/inventory/InvMove.js')).default;
  const InvQuant = (await import('../../models/inventory/InvQuant.js')).default;
  let created = 0;
  let reactivated = 0;
  let skipped = 0;
  let archived = 0;
  let deleted = 0;
  const preview = [];
  const warnings = [];

  for (const combo of combos) {
    const key = combinationKeyFromIds(combo.map((v) => v._id));
    const name = combo.map((v) => v.name).join(' / ');
    const nameAr = combo.map((v) => v.nameAr || v.name).join(' / ');
    const existing = existingAll.find((e) => e.combinationKey === key);
    if (existing) {
      if (existing.active) {
        skipped += 1;
        preview.push({ name, action: 'skip', id: existing._id });
      } else {
        reactivated += 1;
        preview.push({ name, action: 'reactivate', id: existing._id });
        if (!dryRun) {
          await InvProductVariant.updateOne(
            { _id: existing._id },
            { $set: { active: true, updatedBy: userId } },
          );
        }
      }
      continue;
    }
    preview.push({ name, action: 'create' });
    if (dryRun) {
      created += 1;
      continue;
    }
    const extraPrice = combo.reduce((s, v) => {
      const tidExtra = extraByValueId.get(String(v._id));
      return s + (tidExtra != null ? tidExtra : (Number(v.extraPrice) || 0));
    }, 0);
    const doc = await InvProductVariant.create({
      tenantId: tid,
      productId: product._id,
      name,
      nameAr,
      attributeValueIds: combo.map((v) => v._id),
      combinationKey: key,
      extraPrice,
      active: true,
      createdBy: userId,
    });
    created += 1;
    preview[preview.length - 1].id = doc._id;
  }

  for (const old of existingAll) {
    if (wantedKeys.has(old.combinationKey)) continue;
    if (!old.active && dryRun) continue;

    const hasMove = await InvMove.exists({
      tenantId: tid,
      productId: product._id,
      variantId: old._id,
    });
    const hasQuant = await InvQuant.exists({
      tenantId: tid,
      productId: product._id,
      variantId: old._id,
    });

    if (hasMove || hasQuant) {
      warnings.push({
        variantId: old._id,
        name: old.name,
        reason: 'Has stock history — will be archived, not deleted',
      });
      preview.push({ name: old.name, action: 'archive', id: old._id });
      if (!dryRun && old.active) {
        await InvProductVariant.updateOne({ _id: old._id }, { $set: { active: false, updatedBy: userId } });
        archived += 1;
      } else if (dryRun && old.active) {
        archived += 1;
      }
      continue;
    }

    if (dryRun) {
      preview.push({ name: old.name, action: 'delete', id: old._id });
      deleted += 1;
      continue;
    }
    await InvProductVariant.deleteOne({ _id: old._id });
    deleted += 1;
    preview.push({ name: old.name, action: 'delete', id: old._id });
  }

  if (!dryRun && Array.isArray(attributeLines)) {
    product.attributeLines = attributeLines.map((l) => ({
      attributeId: toObjectId(l.attributeId),
      valueIds: (l.valueIds || []).map(toObjectId),
      createVariantMode: ['always', 'dynamic', 'never'].includes(l.createVariantMode)
        ? l.createVariantMode
        : 'always',
    }));
    await product.save();
  }

  return {
    productId: product._id,
    combinationCount: combos.length,
    rawCombinationCount: rawCount,
    excludedCount,
    created,
    reactivated,
    skipped,
    archived,
    deleted,
    dryRun: !!dryRun,
    warnings,
    preview: preview.slice(0, 200),
  };
}

export async function previewVariantCount(tenantId, { attributeLines } = {}) {
  const tid = toObjectId(tenantId);
  const lines = (attributeLines || []).filter((l) => (l.createVariantMode || 'always') === 'always');
  if (!lines.length) return { count: 0 };
  let count = 1;
  for (const line of lines) {
    const n = line.valueIds?.length
      || await InvAttributeValue.countDocuments({
        tenantId: tid,
        attributeId: toObjectId(line.attributeId),
        active: true,
      });
    count *= Math.max(1, n);
  }
  return { count };
}

export async function findVariantByBarcodeOrSku(tenantId, code) {
  const tid = toObjectId(tenantId);
  const q = String(code || '').trim();
  if (!q) return null;
  return InvProductVariant.findOne({
    tenantId: tid,
    active: true,
    $or: [{ barcode: q }, { sku: q }],
  })
    .populate('productId', 'nameEn nameAr sku barcode trackInventory')
    .lean();
}

/** Ensure every template has ≥1 default variant when it has no attribute lines. */
export async function ensureDefaultVariant(tenantId, userId, productId) {
  const tid = toObjectId(tenantId);
  const product = await Product.findOne({ _id: productId, tenantId: tid });
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const existing = await InvProductVariant.findOne({
    tenantId: tid,
    productId: product._id,
    $or: [{ isDefault: true }, { combinationKey: 'default' }],
  });
  if (existing) {
    if (!existing.active) {
      existing.active = true;
      existing.updatedBy = userId;
      await existing.save();
    }
    return existing;
  }

  const any = await InvProductVariant.findOne({ tenantId: tid, productId: product._id, active: true });
  if (any) return any;

  return InvProductVariant.create({
    tenantId: tid,
    productId: product._id,
    name: product.nameEn || product.sku || 'Default',
    nameAr: product.nameAr,
    sku: product.sku,
    barcode: product.barcode,
    attributeValueIds: [],
    combinationKey: 'default',
    isDefault: true,
    legacyProductId: product._id,
    active: true,
    createdBy: userId,
  });
}

/**
 * Dynamic mode: get or create a variant for a combination inside the caller's txn when possible.
 */
export async function getOrCreateVariant(tenantId, userId, { productId, attributeValueIds }) {
  await assertVariantsEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const valueIds = [...new Set((attributeValueIds || []).map(String))];
  if (!valueIds.length) {
    return ensureDefaultVariant(tenantId, userId, productId);
  }

  const key = combinationKeyFromIds(valueIds);
  const existing = await InvProductVariant.findOne({
    tenantId: tid,
    productId: toObjectId(productId),
    combinationKey: key,
  });
  if (existing) {
    if (!existing.active) {
      existing.active = true;
      existing.updatedBy = userId;
      await existing.save();
    }
    return existing;
  }

  const values = await InvAttributeValue.find({
    tenantId: tid,
    _id: { $in: valueIds.map(toObjectId) },
    active: true,
  }).lean();
  if (values.length !== valueIds.length) {
    throw new InventoryValidationError('Invalid attribute values', 'VALUE_INVALID');
  }

  const exclusions = await InvAttributeExclusion.find({
    tenantId: tid,
    templateId: toObjectId(productId),
    active: true,
  }).lean();
  if (comboViolatesExclusion(valueIds, exclusions)) {
    throw new InventoryValidationError('Combination is excluded for this product', 'COMBO_EXCLUDED');
  }

  try {
    return await InvProductVariant.create({
      tenantId: tid,
      productId: toObjectId(productId),
      name: values.map((v) => v.name).join(' / '),
      nameAr: values.map((v) => v.nameAr || v.name).join(' / '),
      attributeValueIds: values.map((v) => v._id),
      combinationKey: key,
      extraPrice: values.reduce((s, v) => s + (Number(v.extraPrice) || 0), 0),
      active: true,
      createdBy: userId,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return InvProductVariant.findOne({
        tenantId: tid,
        productId: toObjectId(productId),
        combinationKey: key,
      });
    }
    throw err;
  }
}

export async function listExclusions(tenantId, templateId) {
  return InvAttributeExclusion.find({
    tenantId: toObjectId(tenantId),
    templateId: toObjectId(templateId),
  })
    .populate('attributeValueId', 'name nameAr')
    .populate('excludedValueIds', 'name nameAr')
    .lean();
}

export async function upsertExclusion(tenantId, userId, body) {
  await assertVariantsEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const templateId = toObjectId(body.templateId);
  const attributeValueId = toObjectId(body.attributeValueId);
  const excludedValueIds = [...new Set((body.excludedValueIds || []).map((id) => String(id)))]
    .map(toObjectId);

  if (String(attributeValueId) && excludedValueIds.some((id) => String(id) === String(attributeValueId))) {
    throw new InventoryValidationError('A value cannot exclude itself', 'EXCLUSION_SELF');
  }

  return InvAttributeExclusion.findOneAndUpdate(
    { tenantId: tid, templateId, attributeValueId },
    {
      $set: {
        excludedValueIds,
        active: body.active !== false,
        updatedBy: userId,
      },
      $setOnInsert: {
        tenantId: tid,
        templateId,
        attributeValueId,
        createdBy: userId,
      },
    },
    { upsert: true, new: true },
  );
}

export async function deleteExclusion(tenantId, id) {
  const doc = await InvAttributeExclusion.findOneAndDelete({
    _id: id,
    tenantId: toObjectId(tenantId),
  });
  if (!doc) throw new InventoryValidationError('Exclusion not found', 'EXCLUSION_NOT_FOUND');
  return { deleted: true };
}

export async function upsertTemplateAttributeValue(tenantId, userId, body) {
  await assertVariantsEnabled(tenantId);
  const tid = toObjectId(tenantId);
  return InvTemplateAttributeValue.findOneAndUpdate(
    {
      tenantId: tid,
      templateId: toObjectId(body.templateId),
      attributeValueId: toObjectId(body.attributeValueId),
    },
    {
      $set: {
        attributeId: toObjectId(body.attributeId),
        priceExtra: Number(body.priceExtra) || 0,
        active: body.active !== false,
        updatedBy: userId,
      },
      $setOnInsert: {
        tenantId: tid,
        templateId: toObjectId(body.templateId),
        attributeValueId: toObjectId(body.attributeValueId),
        createdBy: userId,
      },
    },
    { upsert: true, new: true },
  );
}

export async function listTemplateAttributeValues(tenantId, templateId) {
  return InvTemplateAttributeValue.find({
    tenantId: toObjectId(tenantId),
    templateId: toObjectId(templateId),
    active: true,
  }).lean();
}

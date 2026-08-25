import Product from '../../models/Product.js';
import InvProductAttribute from '../../models/inventory/InvProductAttribute.js';
import InvAttributeValue from '../../models/inventory/InvAttributeValue.js';
import InvProductVariant from '../../models/inventory/InvProductVariant.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { getInvSettings } from './settingsService.js';

function combinationKeyFromIds(valueIds) {
  return [...valueIds]
    .map((id) => String(id))
    .sort()
    .join('|');
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
  return InvProductAttribute.create({
    tenantId: toObjectId(tenantId),
    name,
    nameAr: body.nameAr ? String(body.nameAr).trim() : undefined,
    createVariant: body.createVariant !== false,
    sequence: Number(body.sequence) || 10,
    active: body.active !== false,
    createdBy: userId,
  });
}

export async function updateAttribute(tenantId, id, userId, body) {
  await assertVariantsEnabled(tenantId);
  const doc = await InvProductAttribute.findOne({ _id: id, tenantId: toObjectId(tenantId) });
  if (!doc) throw new InventoryValidationError('Attribute not found', 'ATTR_NOT_FOUND');
  if (body.name != null) doc.name = String(body.name).trim();
  if (body.nameAr != null) doc.nameAr = String(body.nameAr).trim();
  if (body.createVariant != null) doc.createVariant = !!body.createVariant;
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
  if (body.sequence != null) doc.sequence = Number(body.sequence) || 10;
  if (body.active != null) doc.active = !!body.active;
  doc.updatedBy = userId;
  await doc.save();
  return doc;
}

export async function listVariants(tenantId, { productId, q, activeOnly = true, limit = 200 } = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (productId) filter.productId = toObjectId(productId);
  if (activeOnly) filter.active = true;
  if (q) {
    const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: re }, { sku: re }, { barcode: re }];
  }
  return InvProductVariant.find(filter)
    .populate('attributeValueIds', 'name nameAr attributeId')
    .populate('productId', 'nameEn nameAr sku')
    .sort({ name: 1 })
    .limit(Math.min(500, Number(limit) || 200))
    .lean();
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
  if (body.active != null) doc.active = !!body.active;
  doc.updatedBy = userId;
  await doc.save();
  return doc;
}

/** Cartesian product of active values for the given attributes (createVariant=true only). */
export async function generateVariants(tenantId, userId, { productId, attributeIds } = {}) {
  await assertVariantsEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const product = await Product.findOne({ _id: productId, tenantId: tid }).lean();
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const attrFilter = {
    tenantId: tid,
    active: true,
    createVariant: true,
  };
  if (attributeIds?.length) {
    attrFilter._id = { $in: attributeIds.map(toObjectId) };
  }
  const attrs = await InvProductAttribute.find(attrFilter).sort({ sequence: 1 }).lean();
  if (!attrs.length) {
    throw new InventoryValidationError('No attributes selected for variant generation', 'NO_ATTRS');
  }

  const valueLists = [];
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

  // Cartesian
  let combos = [[]];
  for (const list of valueLists) {
    const next = [];
    for (const prefix of combos) {
      for (const v of list) next.push([...prefix, v]);
    }
    combos = next;
  }

  let created = 0;
  let skipped = 0;
  const preview = [];

  for (const combo of combos) {
    const key = combinationKeyFromIds(combo.map((v) => v._id));
    const name = combo.map((v) => v.name).join(' / ');
    const nameAr = combo.map((v) => v.nameAr || v.name).join(' / ');
    const existing = await InvProductVariant.findOne({
      tenantId: tid,
      productId: product._id,
      combinationKey: key,
    }).lean();
    if (existing) {
      skipped += 1;
      preview.push({ name, action: 'skip', id: existing._id });
      continue;
    }
    const doc = await InvProductVariant.create({
      tenantId: tid,
      productId: product._id,
      name,
      nameAr,
      attributeValueIds: combo.map((v) => v._id),
      combinationKey: key,
      active: true,
      createdBy: userId,
    });
    created += 1;
    preview.push({ name, action: 'create', id: doc._id });
  }

  return {
    productId: product._id,
    attributeCount: attrs.length,
    combinationCount: combos.length,
    created,
    skipped,
    preview: preview.slice(0, 100),
  };
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

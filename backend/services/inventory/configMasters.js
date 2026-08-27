import {
  InvLocation,
  InvOperationType,
  InvProductCategory,
  InvQuant,
  InvTransfer,
} from '../../models/inventory/index.js';
import { ensureSequence } from './sequence.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildLocationPath(tenantId, parentId, name) {
  if (!parentId) return name;
  const parent = await InvLocation.findOne({ _id: parentId, tenantId }).lean();
  if (!parent) throw new InventoryValidationError('Parent location not found', 'LOC_PARENT');
  return `${parent.completePath}/${name}`;
}

async function buildCategoryPath(tenantId, parentId, name) {
  if (!parentId) return name;
  const parent = await InvProductCategory.findOne({ _id: parentId, tenantId }).lean();
  if (!parent) throw new InventoryValidationError('Parent category not found', 'CAT_PARENT');
  return `${parent.completePath}/${name}`;
}

/**
 * Cascade completePath updates when a location is renamed or reparented.
 */
async function cascadeLocationPaths(tenantId, loc, oldPath) {
  const newPath = loc.completePath;
  if (oldPath === newPath) return;
  const children = await InvLocation.find({
    tenantId,
    completePath: new RegExp(`^${escapeRegex(oldPath)}/`),
  });
  for (const child of children) {
    child.completePath = `${newPath}${child.completePath.slice(oldPath.length)}`;
    await child.save();
  }
}

async function cascadeCategoryPaths(tenantId, cat, oldPath) {
  const newPath = cat.completePath;
  if (oldPath === newPath) return;
  const children = await InvProductCategory.find({
    tenantId,
    completePath: new RegExp(`^${escapeRegex(oldPath)}/`),
  }).select('_id completePath').lean();
  if (!children.length) return;
  // One bulkWrite for the whole subtree — not sequential row saves
  const ops = children.map((child) => ({
    updateOne: {
      filter: { _id: child._id, tenantId },
      update: {
        $set: {
          completePath: `${newPath}${child.completePath.slice(oldPath.length)}`,
        },
      },
    },
  }));
  await InvProductCategory.bulkWrite(ops, { ordered: false });
}

export async function createLocation(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const name = String(body.name || '').trim();
  if (!name) throw new InventoryValidationError('Name is required', 'LOC_NAME');
  if (!body.usage) throw new InventoryValidationError('Usage is required', 'LOC_USAGE');

  const completePath = await buildLocationPath(tid, body.parentId || null, name);
  const existing = await InvLocation.findOne({ tenantId: tid, completePath });
  if (existing) throw new InventoryValidationError('Location path already exists', 'LOC_DUP');

  return InvLocation.create({
    tenantId: tid,
    name,
    nameAr: body.nameAr,
    parentId: body.parentId || null,
    completePath,
    usage: body.usage,
    warehouseId: body.warehouseId || null,
    storageCategoryId: body.storageCategoryId || null,
    removalStrategy: body.removalStrategy || undefined,
    isScrapLocation: !!body.isScrapLocation,
    isReturnLocation: !!body.isReturnLocation,
    stockInputAccountId: body.stockInputAccountId || null,
    stockOutputAccountId: body.stockOutputAccountId || null,
    stockValuationAccountId: body.stockValuationAccountId || null,
    barcode: body.barcode,
    pickSequence: body.pickSequence != null && body.pickSequence !== ''
      ? Number(body.pickSequence)
      : undefined,
    active: body.active !== false,
    createdBy: userId,
  });
}

export async function updateLocation(tenantId, userId, id, body) {
  const tid = toObjectId(tenantId);
  const loc = await InvLocation.findOne({ _id: id, tenantId: tid });
  if (!loc) throw new InventoryValidationError('Location not found', 'LOC_NOT_FOUND');

  if (body.active === false) {
    const quants = await InvQuant.find({ tenantId: tid, locationId: loc._id })
      .select('quantity reservedQuantity')
      .lean();
    const hasStock = quants.some(
      (q) => Number(q.quantity) !== 0 || Number(q.reservedQuantity) !== 0,
    );
    if (hasStock) {
      throw new InventoryValidationError('Cannot archive location with stock', 'LOC_HAS_STOCK');
    }
  }

  // Changing usage to view while stock exists is forbidden
  if (body.usage === 'view' && loc.usage !== 'view') {
    const quants = await InvQuant.find({ tenantId: tid, locationId: loc._id })
      .select('quantity reservedQuantity')
      .lean();
    const hasStock = quants.some(
      (q) => Number(q.quantity) !== 0 || Number(q.reservedQuantity) !== 0,
    );
    if (hasStock) {
      throw new InventoryValidationError(
        'Cannot change a stocked location to View — move or clear inventory first.',
        'LOC_VIEW_STOCK',
      );
    }
  }

  const oldPath = loc.completePath;
  const name = body.name != null ? String(body.name).trim() : loc.name;
  const parentId = body.parentId !== undefined ? (body.parentId || null) : loc.parentId;

  if (parentId && String(parentId) === String(loc._id)) {
    throw new InventoryValidationError('Location cannot be its own parent', 'LOC_CYCLE');
  }
  if (parentId) {
    const parent = await InvLocation.findOne({ _id: parentId, tenantId: tid }).lean();
    if (!parent) throw new InventoryValidationError('Parent location not found', 'LOC_PARENT');
    if (parent.completePath.startsWith(`${oldPath}/`) || parent.completePath === oldPath) {
      throw new InventoryValidationError('Cannot move under own descendant', 'LOC_CYCLE');
    }
  }

  if (body.name != null) loc.name = name;
  if (body.nameAr !== undefined) loc.nameAr = body.nameAr;
  if (body.parentId !== undefined) loc.parentId = parentId;
  if (body.usage != null) loc.usage = body.usage;
  if (body.warehouseId !== undefined) loc.warehouseId = body.warehouseId || null;
  if (body.storageCategoryId !== undefined) loc.storageCategoryId = body.storageCategoryId || null;
  if (body.removalStrategy !== undefined) loc.removalStrategy = body.removalStrategy || undefined;
  if (body.isScrapLocation != null) loc.isScrapLocation = !!body.isScrapLocation;
  if (body.isReturnLocation != null) loc.isReturnLocation = !!body.isReturnLocation;
  if (body.stockInputAccountId !== undefined) loc.stockInputAccountId = body.stockInputAccountId || null;
  if (body.stockOutputAccountId !== undefined) loc.stockOutputAccountId = body.stockOutputAccountId || null;
  if (body.stockValuationAccountId !== undefined) loc.stockValuationAccountId = body.stockValuationAccountId || null;
  if (body.barcode !== undefined) loc.barcode = body.barcode;
  if (body.pickSequence !== undefined) {
    loc.pickSequence = body.pickSequence != null && body.pickSequence !== ''
      ? Number(body.pickSequence)
      : undefined;
  }
  if (body.active != null) loc.active = !!body.active;
  loc.updatedBy = userId;

  loc.completePath = await buildLocationPath(tid, loc.parentId, loc.name);
  await loc.save();
  await cascadeLocationPaths(tid, loc, oldPath);
  return loc;
}

export async function createOperationType(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const name = String(body.name || '').trim();
  if (!name) throw new InventoryValidationError('Name is required', 'OT_NAME');
  if (!body.code) throw new InventoryValidationError('Code is required', 'OT_CODE');
  if (!body.warehouseId) throw new InventoryValidationError('Warehouse is required', 'OT_WH');
  if (!body.sequenceCode || !body.sequencePrefix) {
    throw new InventoryValidationError('Sequence code and prefix are required', 'OT_SEQ');
  }

  const dup = await InvOperationType.findOne({ tenantId: tid, sequenceCode: body.sequenceCode });
  if (dup) throw new InventoryValidationError('Sequence code already exists', 'OT_DUP');

  const ot = await InvOperationType.create({
    tenantId: tid,
    name,
    nameAr: body.nameAr,
    code: body.code,
    warehouseId: body.warehouseId,
    sequencePrefix: body.sequencePrefix,
    sequenceCode: body.sequenceCode,
    defaultSourceLocationId: body.defaultSourceLocationId || null,
    defaultDestLocationId: body.defaultDestLocationId || null,
    returnOperationTypeId: body.returnOperationTypeId || null,
    reservationMethod: body.reservationMethod || 'atConfirm',
    reservationDaysBefore: body.reservationDaysBefore || 0,
    createBackorder: body.createBackorder || 'ask',
    allowExtraProducts: !!body.allowExtraProducts,
    requireFullValidation: !!body.requireFullValidation,
    useCreateLots: !!body.useCreateLots,
    useExistingLots: !!body.useExistingLots,
    showDetailedOperations: !!body.showDetailedOperations,
    printLabelOnValidate: !!body.printLabelOnValidate,
    barcode: body.barcode,
    cardColor: body.cardColor || '#0d9488',
    active: body.active !== false,
    createdBy: userId,
  });
  await ensureSequence(tid, body.sequenceCode, body.sequencePrefix);
  return ot;
}

export async function updateOperationType(tenantId, userId, id, body) {
  const tid = toObjectId(tenantId);
  const ot = await InvOperationType.findOne({ _id: id, tenantId: tid });
  if (!ot) throw new InventoryValidationError('Operation type not found', 'OT_NOT_FOUND');

  if (body.active === false) {
    const open = await InvTransfer.countDocuments({
      tenantId: tid,
      operationTypeId: ot._id,
      state: { $nin: ['done', 'cancelled'] },
    });
    if (open > 0) {
      throw new InventoryValidationError('Cannot archive operation type with open transfers', 'OT_OPEN');
    }
  }

  const allowed = [
    'name', 'nameAr', 'code', 'defaultSourceLocationId', 'defaultDestLocationId',
    'returnOperationTypeId', 'reservationMethod', 'reservationDaysBefore', 'createBackorder',
    'allowExtraProducts', 'requireFullValidation', 'useCreateLots', 'useExistingLots',
    'showDetailedOperations', 'printLabelOnValidate', 'barcode', 'cardColor', 'active',
  ];
  for (const k of allowed) {
    if (body[k] !== undefined) ot[k] = body[k];
  }
  // Sequence code/prefix are immutable after create (document numbers already issued)
  ot.updatedBy = userId;
  await ot.save();
  return ot;
}

export async function createProductCategory(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const name = String(body.name || '').trim();
  if (!name) throw new InventoryValidationError('Name is required', 'CAT_NAME');

  const completePath = await buildCategoryPath(tid, body.parentId || null, name);
  const existing = await InvProductCategory.findOne({ tenantId: tid, completePath });
  if (existing) throw new InventoryValidationError('Category path already exists', 'CAT_DUP');

  const payload = {
    tenantId: tid,
    name,
    nameAr: body.nameAr,
    parentId: body.parentId || null,
    completePath,
    routeIds: body.routeIds || [],
    forceRemovalStrategy: body.forceRemovalStrategy || undefined,
    reservePackagings: body.reservePackagings || 'partial',
    costingMethod: body.costingMethod || 'average',
    valuationMode: body.valuationMode || 'automated',
    allowNegativeStock: body.allowNegativeStock === true,
    incomeAccountId: body.incomeAccountId || null,
    expenseAccountId: body.expenseAccountId || null,
    priceDifferenceAccountId: body.priceDifferenceAccountId || null,
    stockValuationAccountId: body.stockValuationAccountId || null,
    stockJournalId: body.stockJournalId || null,
    stockInputAccountId: body.stockInputAccountId || null,
    stockOutputAccountId: body.stockOutputAccountId || null,
    createdBy: userId,
  };
  const { assertAutomatedCategoryAccounts, isStockAccountingEnabled } = await import('./stockAccounting.js');
  const requireStockAccounts = await isStockAccountingEnabled(tid);
  assertAutomatedCategoryAccounts(payload, { requireStockAccounts });

  return InvProductCategory.create(payload);
}

export async function updateProductCategory(tenantId, userId, id, body) {
  const tid = toObjectId(tenantId);
  const cat = await InvProductCategory.findOne({ _id: id, tenantId: tid });
  if (!cat) throw new InventoryValidationError('Category not found', 'CAT_NOT_FOUND');

  const prior = cat.toObject();
  const oldPath = cat.completePath;
  const name = body.name != null ? String(body.name).trim() : cat.name;
  const parentId = body.parentId !== undefined ? (body.parentId || null) : cat.parentId;

  if (parentId && String(parentId) === String(cat._id)) {
    throw new InventoryValidationError('Category cannot be its own parent', 'CAT_CYCLE');
  }
  if (parentId) {
    const parent = await InvProductCategory.findOne({ _id: parentId, tenantId: tid }).lean();
    if (!parent) throw new InventoryValidationError('Parent category not found', 'CAT_PARENT');
    if (parent.completePath.startsWith(`${oldPath}/`) || parent.completePath === oldPath) {
      throw new InventoryValidationError('Cannot move under own descendant', 'CAT_CYCLE');
    }
  }

  if (body.name != null) cat.name = name;
  if (body.nameAr !== undefined) cat.nameAr = body.nameAr;
  if (body.parentId !== undefined) cat.parentId = parentId;
  if (body.routeIds !== undefined) cat.routeIds = body.routeIds;
  if (body.forceRemovalStrategy !== undefined) cat.forceRemovalStrategy = body.forceRemovalStrategy || undefined;
  if (body.reservePackagings != null) cat.reservePackagings = body.reservePackagings;
  if (body.costingMethod != null) cat.costingMethod = body.costingMethod;
  if (body.valuationMode != null) cat.valuationMode = body.valuationMode;
  if (body.allowNegativeStock !== undefined) cat.allowNegativeStock = !!body.allowNegativeStock;
  for (const k of [
    'incomeAccountId', 'expenseAccountId', 'priceDifferenceAccountId',
    'stockValuationAccountId', 'stockJournalId', 'stockInputAccountId', 'stockOutputAccountId',
  ]) {
    if (body[k] !== undefined) cat[k] = body[k] || null;
  }
  cat.updatedBy = userId;
  cat.completePath = await buildCategoryPath(tid, cat.parentId, cat.name);

  const { assertAutomatedCategoryAccounts, isStockAccountingEnabled } = await import('./stockAccounting.js');
  const requireStockAccounts = await isStockAccountingEnabled(tid);
  assertAutomatedCategoryAccounts(cat, { requireStockAccounts });

  await cat.save();
  await cascadeCategoryPaths(tid, cat, oldPath);

  try {
    const { recordConfigAudit, diffFields } = await import('./configAudit.js');
    const changes = diffFields(prior || {}, cat.toObject(), [
      'name', 'nameAr', 'parentId', 'costingMethod', 'valuationMode', 'allowNegativeStock',
      'forceRemovalStrategy', 'completePath',
    ]);
    await recordConfigAudit({
      tenantId: tid,
      userId,
      resourceType: 'productCategory',
      resourceId: cat._id,
      resourceName: cat.completePath,
      changes,
    });
  } catch {
    /* non-blocking */
  }
  return cat;
}

/**
 * Delete category — blocked when it has children or products.
 */
export async function deleteProductCategory(tenantId, id) {
  const tid = toObjectId(tenantId);
  const cat = await InvProductCategory.findOne({ _id: id, tenantId: tid }).lean();
  if (!cat) throw new InventoryValidationError('Category not found', 'CAT_NOT_FOUND');

  const childrenCount = await InvProductCategory.countDocuments({
    tenantId: tid,
    parentId: cat._id,
  });
  const Product = (await import('../../models/Product.js')).default;
  const productCount = await Product.countDocuments({
    tenantId: tid,
    categoryId: cat._id,
  });

  if (childrenCount > 0 || productCount > 0) {
    const err = new InventoryValidationError(
      `Cannot delete: ${productCount} product(s), ${childrenCount} child categor${childrenCount === 1 ? 'y' : 'ies'}`,
      'CAT_IN_USE',
    );
    err.meta = { productCount, childrenCount, categoryId: String(cat._id) };
    throw err;
  }

  await InvProductCategory.deleteOne({ _id: cat._id, tenantId: tid });
  return { ok: true, deletedId: cat._id };
}

/**
 * Duplicate category (logistics + valuation + accounts). Does not copy products.
 * Name gets " (copy)" / " (نسخة)".
 */
export async function duplicateProductCategory(tenantId, userId, id, { nameSuffix } = {}) {
  const tid = toObjectId(tenantId);
  const src = await InvProductCategory.findOne({ _id: id, tenantId: tid }).lean();
  if (!src) throw new InventoryValidationError('Category not found', 'CAT_NOT_FOUND');

  const suffix = nameSuffix || ' (copy)';
  let baseName = `${src.name}${suffix}`;
  let completePath = await buildCategoryPath(tid, src.parentId || null, baseName);
  let n = 2;
  while (await InvProductCategory.findOne({ tenantId: tid, completePath }).lean()) {
    baseName = `${src.name}${suffix} ${n}`;
    completePath = await buildCategoryPath(tid, src.parentId || null, baseName);
    n += 1;
  }

  return InvProductCategory.create({
    tenantId: tid,
    name: baseName,
    nameAr: src.nameAr ? `${src.nameAr}${suffix}` : undefined,
    parentId: src.parentId || null,
    completePath,
    routeIds: src.routeIds || [],
    forceRemovalStrategy: src.forceRemovalStrategy,
    reservePackagings: src.reservePackagings || 'partial',
    costingMethod: src.costingMethod || 'average',
    valuationMode: src.valuationMode || 'automated',
    allowNegativeStock: !!src.allowNegativeStock,
    incomeAccountId: src.incomeAccountId || null,
    expenseAccountId: src.expenseAccountId || null,
    priceDifferenceAccountId: src.priceDifferenceAccountId || null,
    stockValuationAccountId: src.stockValuationAccountId || null,
    stockJournalId: src.stockJournalId || null,
    stockInputAccountId: src.stockInputAccountId || null,
    stockOutputAccountId: src.stockOutputAccountId || null,
    createdBy: userId,
  });
}

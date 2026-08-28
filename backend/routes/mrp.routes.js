import express from 'express';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('trading'));

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeReorderPoint(product) {
  const stocks = Array.isArray(product?.stocks) ? product.stocks : [];
  if (!stocks.length) return 10;

  const points = stocks
    .map((s) => safeNumber(s?.reorderPoint, 10))
    .filter((x) => Number.isFinite(x));

  if (!points.length) return 10;
  return Math.min(...points);
}

function computeAvailableStock(product) {
  const stocks = Array.isArray(product?.stocks) ? product.stocks : [];

  const onHand = stocks.reduce((sum, s) => sum + safeNumber(s?.quantity, 0), 0);
  const reserved = stocks.reduce((sum, s) => sum + safeNumber(s?.reservedQuantity, 0), 0);
  const available = onHand - reserved;

  return {
    onHand,
    reserved,
    available: Number.isFinite(available) ? available : 0
  };
}

function mrpRowKey(productId, variantId) {
  return `${String(productId)}|${variantId ? String(variantId) : ''}`;
}

async function expandProductsWithVariants(tenantId, products) {
  const InvProductVariant = (await import('../models/inventory/InvProductVariant.js')).default;
  const ids = (products || []).map((p) => p._id).filter(Boolean);
  if (!ids.length) return [];

  const variants = await InvProductVariant.find({
    tenantId,
    productId: { $in: ids },
    active: { $ne: false },
  }).select('productId name sku').lean();

  const byProduct = new Map();
  for (const v of variants) {
    const key = String(v.productId);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(v);
  }

  const rows = [];
  for (const p of products || []) {
    const pvars = byProduct.get(String(p._id)) || [];
    if (pvars.length) {
      for (const v of pvars) rows.push({ product: p, variant: v, variantId: v._id });
    } else {
      rows.push({ product: p, variant: null, variantId: null });
    }
  }
  return rows;
}

async function resolveMrpStock(tenantId, productId, variantId, legacyProduct) {
  try {
    const { isInvEngineEnabled } = await import('../services/inventory/legacyAdapter.js');
    if (await isInvEngineEnabled(tenantId)) {
      const { computeForecast } = await import('../services/inventory/forecast.js');
      const fc = await computeForecast(tenantId, productId, { variantId: variantId || undefined });
      const onHand = safeNumber(fc.onHand, 0);
      const reserved = safeNumber(fc.reserved, 0);
      const available = safeNumber(fc.freeToUse ?? (onHand - reserved), 0);
      return {
        onHand,
        reserved,
        available: Number.isFinite(available) ? available : 0,
        incomingQty: safeNumber(fc.incoming, 0),
      };
    }
  } catch {
    /* fall through */
  }
  const stockInfo = computeAvailableStock(legacyProduct);
  return { ...stockInfo, incomingQty: 0 };
}

async function getIncomingMap(tenantFilterValue) {
  const pipeline = [
    {
      $match: {
        ...tenantFilterValue,
        status: { $in: ['sent', 'approved', 'partially_received'] },
      },
    },
    { $unwind: '$lineItems' },
    {
      $project: {
        productId: '$lineItems.productId',
        variantId: '$lineItems.variantId',
        remaining: {
          $subtract: ['$lineItems.quantityOrdered', '$lineItems.quantityReceived'],
        },
      },
    },
    { $match: { remaining: { $gt: 0 } } },
    {
      $group: {
        _id: { productId: '$productId', variantId: '$variantId' },
        incomingQty: { $sum: '$remaining' },
      },
    },
  ];

  const incoming = await PurchaseOrder.aggregate(pipeline);
  return new Map(
    incoming.map((row) => [
      mrpRowKey(row._id?.productId, row._id?.variantId),
      row.incomingQty || 0,
    ]),
  );
}

async function buildMrpSuggestion({
  tenantId,
  product,
  variant,
  variantId,
  incomingMap,
  mult,
}) {
  const reorderPoint = computeReorderPoint(product);
  const stockInfo = await resolveMrpStock(tenantId, product._id, variantId, product);
  const currentStock = safeNumber(stockInfo.available, 0);
  const incomingQty = safeNumber(
    stockInfo.incomingQty || incomingMap.get(mrpRowKey(product._id, variantId)),
    0,
  );
  const projectedStock = currentStock + incomingQty;
  const targetStock = reorderPoint * mult;
  const recommendedQty = Math.max(0, targetStock - projectedStock);
  if (recommendedQty <= 0) return null;

  const costPrice = safeNumber(product?.costPrice, 0);
  const baseName = product.nameEn || product.nameAr || product.sku || '';
  const displayName = variant?.name ? `${baseName} - ${variant.name}` : baseName;

  return {
    rowKey: mrpRowKey(product._id, variantId),
    productId: product._id,
    variantId: variantId || null,
    variantName: variant?.name || null,
    sku: variant?.sku || product.sku,
    nameEn: displayName,
    nameAr: product.nameAr,
    category: product.category,
    currentStock,
    onHand: stockInfo.onHand,
    reservedQty: stockInfo.reserved,
    incomingQty,
    projectedStock,
    reorderPoint,
    targetStock,
    recommendedQty,
    costPrice,
    estimatedCost: recommendedQty * costPrice,
  };
}

router.get('/suggestions', checkPermission('mrp', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, multiplier = 2 } = req.query;

    const p = parseInt(page);
    const l = parseInt(limit);
    const mult = Math.max(1, safeNumber(multiplier, 2));

    const productQuery = { ...req.tenantFilter, isActive: true };

    if (search) {
      productQuery.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { nameEn: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    const [products, incomingMap] = await Promise.all([
      Product.find(productQuery)
        .select('sku nameEn nameAr category totalStock costPrice stocks suppliers taxRate')
        .sort({ createdAt: -1 })
        .lean(),
      getIncomingMap(req.tenantFilter)
    ]);

    const suggestions = [];
    const expanded = await expandProductsWithVariants(req.user.tenantId, products || []);
    for (const row of expanded) {
      const suggestion = await buildMrpSuggestion({
        tenantId: req.user.tenantId,
        product: row.product,
        variant: row.variant,
        variantId: row.variantId,
        incomingMap,
        mult,
      });
      if (suggestion) suggestions.push(suggestion);
    }

    suggestions.sort((a, b) => b.recommendedQty - a.recommendedQty);

    const total = suggestions.length;
    const pages = Math.ceil(total / l) || 1;
    const start = (p - 1) * l;

    res.json({
      suggestions: suggestions.slice(start, start + l),
      pagination: {
        page: p,
        limit: l,
        total,
        pages
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bom-plan', checkPermission('mrp', 'read'), async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const demandQty = safeNumber(quantity, 0);
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }
    if (!Number.isFinite(demandQty) || demandQty <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const finished = await Product.findOne({ _id: productId, ...req.tenantFilter, isActive: true })
      .select('sku nameEn nameAr isManufactured bomComponents')
      .populate('bomComponents.productId', 'sku nameEn nameAr costPrice stocks suppliers taxRate purchaseTaxRate')
      .populate('bomComponents.variantId', 'name sku')
      .lean();

    if (!finished) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!finished.isManufactured) {
      return res.status(400).json({ error: 'Selected product is not marked as manufactured' });
    }

    const components = Array.isArray(finished.bomComponents) ? finished.bomComponents : [];
    if (components.length === 0) {
      return res.status(400).json({ error: 'No BOM components configured for this product' });
    }

    const incomingMap = await getIncomingMap(req.tenantFilter);

    const lines = [];

    for (const c of components) {
      const compProd = c?.productId;
      if (!compProd || !compProd._id) continue;

      const perUnit = safeNumber(c?.quantity, 0);
      if (!Number.isFinite(perUnit) || perUnit <= 0) continue;

      const requiredQty = demandQty * perUnit;
      const compVariantId = c?.variantId?._id || c?.variantId || null;
      const stockInfo = await resolveMrpStock(req.user.tenantId, compProd._id, compVariantId, compProd);

      const availableQty = safeNumber(stockInfo.available, 0);
      const incomingQty = safeNumber(
        stockInfo.incomingQty || incomingMap.get(mrpRowKey(compProd._id, compVariantId)),
        0,
      );
      const projectedQty = availableQty + incomingQty;
      const shortageQty = Math.max(0, requiredQty - projectedQty);

      const suppliers = Array.isArray(compProd?.suppliers) ? compProd.suppliers : [];
      const preferred = suppliers.find((s) => s?.isPreferred && s?.supplierId);
      const fallback = suppliers.find((s) => s?.supplierId);
      const unitCost = safeNumber(preferred?.cost ?? fallback?.cost ?? compProd?.costPrice, 0);

      const variant = c?.variantId && typeof c.variantId === 'object' ? c.variantId : null;
      const baseName = compProd.nameEn || compProd.nameAr || compProd.sku || '';
      const displayName = variant?.name ? `${baseName} - ${variant.name}` : baseName;

      lines.push({
        componentId: compProd._id,
        variantId: compVariantId,
        variantName: variant?.name || null,
        sku: variant?.sku || compProd.sku,
        nameEn: displayName,
        nameAr: compProd.nameAr,
        perUnit,
        requiredQty,
        onHand: stockInfo.onHand,
        reservedQty: stockInfo.reserved,
        availableQty,
        incomingQty,
        projectedQty,
        shortageQty,
        unitCost,
        estimatedCost: shortageQty * unitCost,
      });
    }

    const shortages = lines.filter((l) => (l.shortageQty || 0) > 0);
    const totals = shortages.reduce(
      (acc, l) => {
        acc.shortageQty += safeNumber(l.shortageQty, 0);
        acc.estimatedCost += safeNumber(l.estimatedCost, 0);
        return acc;
      },
      { shortageQty: 0, estimatedCost: 0 }
    );

    res.json({
      product: {
        productId: finished._id,
        sku: finished.sku,
        nameEn: finished.nameEn,
        nameAr: finished.nameAr,
        quantity: demandQty
      },
      components: lines,
      shortages,
      totals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', checkPermission('mrp', 'read'), async (req, res) => {
  try {
    const { search, multiplier = 2 } = req.query;

    const mult = Math.max(1, safeNumber(multiplier, 2));

    const productQuery = { ...req.tenantFilter, isActive: true };

    if (search) {
      productQuery.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { nameEn: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    const [products, incomingMap] = await Promise.all([
      Product.find(productQuery)
        .select('sku nameEn nameAr category totalStock costPrice stocks')
        .lean(),
      getIncomingMap(req.tenantFilter)
    ]);

    const byCategory = new Map();

    let suggestionsCount = 0;
    let totalRecommendedQty = 0;
    let totalEstimatedCost = 0;
    let totalIncomingQty = 0;

    for (const prod of products || []) {
      const expanded = await expandProductsWithVariants(req.user.tenantId, [prod]);
      for (const row of expanded) {
        const suggestion = await buildMrpSuggestion({
          tenantId: req.user.tenantId,
          product: row.product,
          variant: row.variant,
          variantId: row.variantId,
          incomingMap,
          mult,
        });
        if (!suggestion) continue;

        suggestionsCount += 1;
        totalRecommendedQty += suggestion.recommendedQty;
        totalEstimatedCost += suggestion.estimatedCost;
        totalIncomingQty += suggestion.incomingQty;

        const key = prod.category || 'Uncategorized';
        const current = byCategory.get(key) || { category: key, suggestions: 0, estimatedCost: 0 };
        byCategory.set(key, {
          category: key,
          suggestions: current.suggestions + 1,
          estimatedCost: current.estimatedCost + suggestion.estimatedCost,
        });
      }
    }

    const categories = Array.from(byCategory.values()).sort((a, b) => b.estimatedCost - a.estimatedCost);

    res.json({
      totals: {
        suggestions: suggestionsCount,
        recommendedQty: totalRecommendedQty,
        estimatedCost: totalEstimatedCost,
        incomingQty: totalIncomingQty
      },
      byCategory: categories.slice(0, 12)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLineItems(lineItems = []) {
  const normalized = (Array.isArray(lineItems) ? lineItems : []).map((li) => {
    const quantityOrdered = Math.max(0, toNumber(li.quantityOrdered ?? li.quantity ?? 0, 0));
    const unitCost = Math.max(0, toNumber(li.unitCost ?? 0, 0));
    const taxRate = Math.max(0, toNumber(li.taxRate ?? 15, 15));

    const lineSubtotal = quantityOrdered * unitCost;
    const lineTax = lineSubtotal * (taxRate / 100);
    const lineTotal = lineSubtotal + lineTax;

    return {
      productId: li.productId,
      variantId: li.variantId || undefined,
      description: li.description,
      quantityOrdered,
      quantityReceived: 0,
      unitCost,
      taxRate,
      lineSubtotal,
      lineTax,
      lineTotal
    };
  });

  const subtotal = normalized.reduce((sum, li) => sum + (li.lineSubtotal || 0), 0);
  const totalTax = normalized.reduce((sum, li) => sum + (li.lineTax || 0), 0);
  const grandTotal = subtotal + totalTax;

  return { normalized, subtotal, totalTax, grandTotal };
}

async function generatePoNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `PO-${y}${m}${d}`;

  const last = await PurchaseOrder.findOne({
    ...tenantFilterValue,
    poNumber: { $regex: `^${prefix}-` }
  })
    .sort({ createdAt: -1 })
    .select('poNumber');

  let seq = 1;
  if (last?.poNumber) {
    const parts = last.poNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// Create draft purchase order(s) from MRP suggestions
router.post('/create-po', checkPermission('supply_chain', 'create'), async (req, res) => {
  try {
    const { items, supplierId, expectedDate, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }

    const cleaned = items
      .map((x) => ({
        productId: x?.productId,
        variantId: x?.variantId || undefined,
        quantity: Math.max(0, toNumber(x?.quantity ?? x?.qty ?? 0, 0)),
      }))
      .filter((x) => x.productId && x.quantity > 0);

    if (cleaned.length === 0) {
      return res.status(400).json({ error: 'No valid items' });
    }

    const productIds = [...new Set(cleaned.map((x) => String(x.productId)))];

    const products = await Product.find({ _id: { $in: productIds }, ...req.tenantFilter, isActive: true }).lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const missing = productIds.filter((id) => !byId.has(String(id)));
    if (missing.length) {
      return res.status(400).json({ error: 'Invalid product in items' });
    }

    const supplierGroups = new Map();

    for (const row of cleaned) {
      const prod = byId.get(String(row.productId));

      let resolvedSupplierId = supplierId;
      let supplierUnitCost;

      if (!resolvedSupplierId) {
        const suppliers = Array.isArray(prod?.suppliers) ? prod.suppliers : [];
        const preferred = suppliers.find((s) => s?.isPreferred && s?.supplierId);
        const fallback = suppliers.find((s) => s?.supplierId);
        resolvedSupplierId = preferred?.supplierId || fallback?.supplierId || null;
        supplierUnitCost = preferred?.cost ?? fallback?.cost;
      }

      if (!resolvedSupplierId) {
        return res.status(400).json({ error: `No supplier configured for product ${prod?.sku || prod?._id}` });
      }

      const key = String(resolvedSupplierId);
      const group = supplierGroups.get(key) || [];
      group.push({
        productId: prod._id,
        variantId: row.variantId || undefined,
        description: prod?.nameEn || prod?.nameAr || prod?.sku,
        quantityOrdered: row.quantity,
        unitCost: toNumber(supplierUnitCost, toNumber(prod?.costPrice, 0)),
        taxRate: toNumber(prod?.purchaseTaxRate ?? prod?.taxRate, 15),
      });
      supplierGroups.set(key, group);
    }

    const supplierIds = [...supplierGroups.keys()];
    const supplierCount = await Supplier.countDocuments({ _id: { $in: supplierIds }, ...req.tenantFilter, isActive: true });
    if (supplierCount !== supplierIds.length) {
      return res.status(400).json({ error: 'Invalid supplier for one or more items' });
    }

    const created = [];
    for (const [sid, lineItems] of supplierGroups.entries()) {
      const poNumber = await generatePoNumber(req.tenantFilter);
      const { normalized, subtotal, totalTax, grandTotal } = normalizeLineItems(lineItems);

      const order = await PurchaseOrder.create({
        tenantId: req.user.tenantId,
        poNumber,
        supplierId: sid,
        status: 'draft',
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        notes,
        lineItems: normalized,
        subtotal,
        totalTax,
        grandTotal,
        createdBy: req.user._id
      });

      created.push(order);
    }

    res.status(201).json({ purchaseOrders: created });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate purchase order number' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;

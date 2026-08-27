import express from 'express';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import { ManufacturingBOM } from '../models/Manufacturing.js';
import Product from '../models/Product.js';
// Ensure populate('components.variantId') can resolve the model
import '../models/inventory/InvProductVariant.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

/**
 * GET /api/bom/:productId
 * Resolve BOM components for a finished good (Manufacturing BOM first, then Product.bomComponents).
 */
router.get('/:productId', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const productId = req.params.productId;

    let mfgBom = await ManufacturingBOM.findOne({
      tenantId,
      finishedProductId: productId,
      isActive: { $ne: false },
      status: 'active',
    })
      .sort({ updatedAt: -1 })
      .populate('finishedProductId', 'sku nameEn nameAr uom unitOfMeasure')
      .populate('components.productId', 'sku nameEn nameAr uom unitOfMeasure uomId costPrice')
      .populate('components.variantId', 'name sku')
      .lean();

    if (!mfgBom) {
      mfgBom = await ManufacturingBOM.findOne({
        tenantId,
        finishedProductId: productId,
        isActive: { $ne: false },
      })
        .sort({ updatedAt: -1 })
        .populate('finishedProductId', 'sku nameEn nameAr uom unitOfMeasure')
        .populate('components.productId', 'sku nameEn nameAr uom unitOfMeasure uomId costPrice')
        .populate('components.variantId', 'name sku')
        .lean();
    }

    if (mfgBom) {
      const baseQuantity = Number(mfgBom.baseQuantity) > 0 ? Number(mfgBom.baseQuantity) : 1;
      const components = (mfgBom.components || []).map((c) => {
        const p = c.productId && typeof c.productId === 'object' ? c.productId : null;
        const pid = p?._id || c.productId;
        const v = c.variantId && typeof c.variantId === 'object' ? c.variantId : null;
        const vid = v?._id || c.variantId || null;
        return {
          productId: pid,
          variantId: vid,
          variantName: v?.name || '',
          sku: p?.sku || '',
          nameEn: p?.nameEn || '',
          nameAr: p?.nameAr || '',
          quantity: Number(c.quantity) || 0,
          uom: c.uom || p?.uom || p?.unitOfMeasure || '',
          uomId: p?.uomId || undefined,
          scrapAllowancePercent: c.scrapAllowancePercent || 0,
          componentType: c.componentType || 'component',
        };
      }).filter((c) => c.productId && c.quantity > 0);

      return res.json({
        success: true,
        source: 'manufacturing_bom',
        bomId: mfgBom._id,
        bomNumber: mfgBom.bomNumber,
        finishedProductId: productId,
        baseQuantity,
        uom: mfgBom.uom || 'PCS',
        components,
      });
    }

    const product = await Product.findOne({ _id: productId, tenantId })
      .populate('bomComponents.productId', 'sku nameEn nameAr uom unitOfMeasure uomId')
      .populate('bomComponents.variantId', 'name sku')
      .select('sku nameEn nameAr bomComponents unitOfMeasure uom')
      .lean();

    if (!product) {
      return res.status(404).json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    }

    const components = (product.bomComponents || []).map((c) => {
      const p = c.productId && typeof c.productId === 'object' ? c.productId : null;
      const pid = p?._id || c.productId;
      const v = c.variantId && typeof c.variantId === 'object' ? c.variantId : null;
      const vid = v?._id || c.variantId || null;
      return {
        productId: pid,
        variantId: vid,
        variantName: v?.name || '',
        sku: p?.sku || '',
        nameEn: p?.nameEn || '',
        nameAr: p?.nameAr || '',
        quantity: Number(c.quantity) || 0,
        uom: p?.uom || p?.unitOfMeasure || '',
        uomId: p?.uomId || undefined,
        notes: c.notes || '',
      };
    }).filter((c) => c.productId && c.quantity > 0);

    return res.json({
      success: true,
      source: 'product_bom',
      bomId: null,
      finishedProductId: productId,
      baseQuantity: 1,
      uom: product.uom || product.unitOfMeasure || 'PCS',
      components,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

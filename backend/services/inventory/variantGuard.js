import InvProductVariant from '../../models/inventory/InvProductVariant.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

/**
 * Active non-default variants (attribute combinations), or any active variants
 * when the template declares attribute lines.
 */
export async function countStockableVariants(tenantId, productId, { session } = {}) {
  const tid = toObjectId(tenantId);
  const pid = toObjectId(productId);
  const q = InvProductVariant.find({
    tenantId: tid,
    productId: pid,
    active: true,
  }).select('_id isDefault combinationKey').lean();
  if (session) q.session(session);
  const variants = await q;
  return {
    total: variants.length,
    nonDefault: variants.filter((v) => !v.isDefault && v.combinationKey !== 'default').length,
    variants,
  };
}

/**
 * True when stock operations must carry an explicit InvProductVariant._id.
 * Templates with attribute lines or any non-default variant are "matrix" products.
 */
export async function productRequiresExplicitVariant(tenantId, productOrId, { session } = {}) {
  const tid = toObjectId(tenantId);
  let product = productOrId;
  if (!product || !product.attributeLines) {
    const q = Product.findOne({ _id: productOrId?._id || productOrId, tenantId: tid })
      .select('attributeLines nameEn sku')
      .lean();
    if (session) q.session(session);
    product = await q;
  }
  if (!product) return false;
  const hasAttrLines = Array.isArray(product.attributeLines) && product.attributeLines.length > 0;
  const { total, nonDefault } = await countStockableVariants(tid, product._id, { session });
  if (hasAttrLines && total === 0) return true; // must generate first — treat as requiring variant
  return nonDefault > 0 || total > 1 || (hasAttrLines && total > 0);
}

/**
 * Guardrail: refuse template-level stock when the product has (or must have) variants.
 * @returns {import('mongoose').Types.ObjectId|null} resolved variantId
 */
export async function assertStockMoveVariant(tenantId, {
  productId,
  variantId = null,
  session = null,
  allowAutoSingle = false,
} = {}) {
  const tid = toObjectId(tenantId);
  const product = await Product.findOne({ _id: productId, tenantId: tid })
    .select('attributeLines nameEn sku')
    .session(session || null)
    .lean();
  if (!product) {
    throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  }

  const { total, nonDefault, variants } = await countStockableVariants(tid, product._id, { session });
  const hasAttrLines = Array.isArray(product.attributeLines) && product.attributeLines.length > 0;

  if (hasAttrLines && total === 0) {
    throw new InventoryValidationError(
      'Generate product variants before recording stock on this template',
      'VARIANTS_NOT_GENERATED',
      { messageAr: 'ولّد متغيرات المنتج قبل تسجيل المخزون على هذا القالب' },
    );
  }

  const requires = hasAttrLines || nonDefault > 0 || total > 1;

  if (!requires) {
    // Plain product: optional default variant bind
    if (variantId) return toObjectId(variantId);
    if (total === 1) return variants[0]._id;
    return null;
  }

  if (variantId) {
    const ok = variants.some((v) => String(v._id) === String(variantId));
    if (!ok) {
      // May be inactive — re-check
      const live = await InvProductVariant.findOne({
        _id: variantId,
        tenantId: tid,
        productId: product._id,
        active: true,
      }).session(session || null).lean();
      if (!live) {
        throw new InventoryValidationError(
          'Variant not found for product',
          'VARIANT_NOT_FOUND',
          { messageAr: 'المتغير غير موجود لهذا المنتج' },
        );
      }
      return live._id;
    }
    return toObjectId(variantId);
  }

  // No variantId supplied
  if (allowAutoSingle && total === 1 && !hasAttrLines) {
    return variants[0]._id;
  }

  throw new InventoryValidationError(
    'Cannot move stock on a product template that has variants — select a specific variant (product.product).',
    'VARIANT_REQUIRED',
    {
      messageAr: 'لا يمكن نقل مخزون على قالب المنتج عند وجود متغيرات — اختر متغيراً محدداً',
      details: {
        productId: String(product._id),
        variantCount: total,
        hasAttributeLines: hasAttrLines,
      },
    },
  );
}

/** Display name: "Paneer Paratha (Large)" or "Paneer Paratha (Red / Large)". */
export function formatVariantDisplayName(templateName, valueNames = []) {
  const base = String(templateName || '').trim() || 'Product';
  const vals = (valueNames || []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!vals.length) return base;
  return `${base} (${vals.join(' / ')})`;
}

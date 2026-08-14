import BakalaProduct from '../models/BakalaProduct.js';
import Product from '../models/Product.js';

export async function findCatalogProduct(tenantId, productId) {
  if (!tenantId || !productId) return null;
  const bakala = await BakalaProduct.findOne({ _id: productId, tenantId }).select('_id').lean();
  if (bakala) return bakala;
  return Product.findOne({ _id: productId, tenantId }).select('_id').lean();
}

/**
 * Apply a stock delta to either the bakala catalog or the trading catalog.
 * GRN / purchase-return lines may reference either collection.
 */
export async function adjustProductStock({ tenantId, productId, delta, setFields = {} }) {
  if (!tenantId || !productId) return null;

  const qty = Number(delta) || 0;
  const $set = {};
  if (setFields.costPrice != null && setFields.costPrice !== '') {
    $set.costPrice = Number(setFields.costPrice);
  }
  if (setFields.expiryDate) $set.expiryDate = setFields.expiryDate;
  if (setFields.batchNumber) $set.batchNumber = setFields.batchNumber;

  const bakalaUpdate = { $inc: { stockQuantity: qty } };
  if (Object.keys($set).length) bakalaUpdate.$set = $set;

  const bakala = await BakalaProduct.findOneAndUpdate(
    { _id: productId, tenantId },
    bakalaUpdate,
    { new: true }
  );
  if (bakala) return { kind: 'bakala', product: bakala };

  const product = await Product.findOne({ _id: productId, tenantId });
  if (!product) return null;

  product.totalStock = (Number(product.totalStock) || 0) + qty;
  if (Array.isArray(product.stocks) && product.stocks.length) {
    product.stocks[0].quantity = (Number(product.stocks[0].quantity) || 0) + qty;
    product.stocks[0].lastStockUpdate = new Date();
  }
  if ($set.costPrice != null) product.costPrice = $set.costPrice;
  await product.save();
  return { kind: 'trading', product };
}

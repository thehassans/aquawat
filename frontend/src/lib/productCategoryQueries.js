/** Shared react-query keys for inventory product categories */
export const PRODUCT_CATEGORIES_KEY = ['product-categories']
export const INV_PRODUCT_CATEGORIES_KEY = ['inv-product-categories']
export const PRODUCT_CATEGORIES_POPULAR_KEY = ['product-categories-popular']

export function invalidateProductCategories(qc) {
  qc.invalidateQueries({ queryKey: PRODUCT_CATEGORIES_KEY })
  qc.invalidateQueries({ queryKey: INV_PRODUCT_CATEGORIES_KEY })
  qc.invalidateQueries({ queryKey: PRODUCT_CATEGORIES_POPULAR_KEY })
}

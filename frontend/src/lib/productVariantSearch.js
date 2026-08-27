import api from './api'

function hasAttributeLines(product) {
  return Array.isArray(product?.attributeLines) && product.attributeLines.length > 0
}

function mapVariantHit(v) {
  const productId = typeof v.productId === 'object' ? v.productId?._id : v.productId
  if (!productId || !v._id) return null
  const productName = (typeof v.productId === 'object'
    ? (v.productId.nameEn || v.productId.name)
    : null) || ''
  const sku = v.sku || (typeof v.productId === 'object' ? v.productId.sku : '') || ''
  return {
    _id: `v:${v._id}`,
    kind: 'variant',
    productId: String(productId),
    variantId: String(v._id),
    variantName: v.name || '',
    productName,
    sku,
    name: [sku, v.name || productName].filter(Boolean).join(' — ') || v.name,
    barcode: v.barcode,
    productHasVariants: true,
  }
}

function mapProductHit(p, { productHasVariants = false } = {}) {
  const productId = String(p._id)
  return {
    _id: `p:${productId}`,
    kind: 'product',
    productId,
    variantId: null,
    variantName: '',
    productName: p.nameEn || p.name || '',
    sku: p.sku || '',
    name: [p.sku, p.nameEn || p.name].filter(Boolean).join(' — ') || p.nameEn || p.name,
    barcode: p.barcode,
    uomId: p.uomId,
    unitOfMeasure: p.unitOfMeasure,
    nameAr: p.nameAr,
    productHasVariants,
  }
}

/**
 * Search products AND variants for operations line pickers.
 * Two parallel API calls only — no per-product N+1 variant expansion.
 * Templates with attribute lines are omitted (user picks a concrete variant hit).
 */
export async function searchProductsAndVariants(q, { variantsEnabled = true, limit = 25 } = {}) {
  const needle = String(q || '').trim()
  if (needle.length < 1) return []

  const results = []
  const seen = new Set()
  const coveredProductIds = new Set()

  const variantsPromise = variantsEnabled
    ? api.get('/stock/variants', { params: { q: needle, limit: 20 } })
      .then((r) => r.data)
      .catch(() => null)
    : Promise.resolve(null)

  const productsPromise = api.get('/products', {
    params: { search: needle, limit: 15, status: 'active' },
  })
    .then((r) => r.data?.products || r.data || [])
    .catch(() => [])

  const [variantData, productList] = await Promise.all([variantsPromise, productsPromise])

  if (variantData) {
    const items = Array.isArray(variantData)
      ? variantData
      : (variantData?.items || variantData?.variants || [])
    for (const v of items) {
      const row = mapVariantHit(v)
      if (!row || seen.has(row._id)) continue
      seen.add(row._id)
      coveredProductIds.add(row.productId)
      results.push(row)
    }
  }

  for (const p of productList || []) {
    if (!p?._id) continue
    const productId = String(p._id)
    if (coveredProductIds.has(productId)) continue

    // Product has variants but none matched this query — don't offer the parent template
    if (variantsEnabled && hasAttributeLines(p)) continue

    const key = `p:${productId}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(mapProductHit(p, { productHasVariants: false }))
  }

  return results.slice(0, limit)
}

/** Resolve a picked catalog option into a strict operations line binding. */
export async function resolveOperationsLinePick(opt, { variantsEnabled = true } = {}) {
  if (!opt) {
    return {
      productId: '',
      productName: '',
      sku: '',
      variantId: null,
      variantName: '',
      variants: [],
      needsVariant: false,
      productHasVariants: false,
    }
  }

  if (opt.kind === 'variant' || opt.variantId) {
    return {
      productId: String(opt.productId),
      productName: opt.productName || opt.name || '',
      sku: opt.sku || '',
      variantId: String(opt.variantId),
      variantName: opt.variantName || '',
      variants: [],
      needsVariant: false,
      productHasVariants: true,
      uomId: opt.uomId,
      uomLabel: opt.unitOfMeasure || '',
    }
  }

  const productId = String(opt.productId || opt._id || '')
  if (!productId) {
    return {
      productId: '',
      productName: '',
      sku: '',
      variantId: null,
      variantName: '',
      variants: [],
      needsVariant: false,
      productHasVariants: false,
    }
  }

  // Search already classified this as a plain product — skip another variants round-trip
  if (opt.productHasVariants === false || (opt.kind === 'product' && !variantsEnabled)) {
    return {
      productId,
      productName: opt.productName || opt.name || opt.nameEn || '',
      sku: opt.sku || '',
      variantId: null,
      variantName: '',
      variants: [],
      needsVariant: false,
      productHasVariants: false,
      uomId: opt.uomId,
      uomLabel: opt.unitOfMeasure || '',
    }
  }

  let variantId = null
  let variantName = ''
  let variants = []
  let needsVariant = false
  let productHasVariants = false

  if (variantsEnabled) {
    try {
      const data = await api.get('/stock/variants', {
        params: { productId, limit: 50 },
      }).then((r) => r.data)
      const items = Array.isArray(data) ? data : (data?.items || [])
      variants = items
      productHasVariants = items.length > 0
      if (items.length === 1) {
        variantId = String(items[0]._id)
        variantName = items[0].name || ''
        needsVariant = false
      } else if (items.length > 1) {
        needsVariant = true
        variantId = null
      }
    } catch {
      /* optional */
    }
  }

  return {
    productId,
    productName: opt.productName || opt.name || opt.nameEn || '',
    sku: opt.sku || '',
    variantId,
    variantName,
    variants,
    needsVariant,
    productHasVariants,
    uomId: opt.uomId,
    uomLabel: opt.unitOfMeasure || '',
  }
}

export function opsProductOptionLabel(o) {
  return o?.name || o?.productName || '—'
}

export function opsProductOptionSub(o) {
  if (o?.kind === 'variant' || o?.variantName) {
    return [o.sku, o.productName].filter(Boolean).join(' · ')
  }
  return o?.sku || ''
}

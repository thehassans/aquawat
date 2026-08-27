import api from './api'

/**
 * Search products AND variants for operations line pickers.
 * When a product has variants, only variant rows are selectable — never the parent template.
 */
export async function searchProductsAndVariants(q, { variantsEnabled = true, limit = 25 } = {}) {
  const needle = String(q || '').trim()
  if (needle.length < 1) return []

  const results = []
  const seen = new Set()

  if (variantsEnabled) {
    try {
      const data = await api.get('/stock/variants', {
        params: { q: needle, limit: 20 },
      }).then((r) => r.data)
      const items = Array.isArray(data) ? data : (data?.items || data?.variants || [])
      for (const v of items) {
        const productId = typeof v.productId === 'object' ? v.productId?._id : v.productId
        if (!productId || !v._id) continue
        const key = `v:${v._id}`
        if (seen.has(key)) continue
        seen.add(key)
        const productName = (typeof v.productId === 'object'
          ? (v.productId.nameEn || v.productId.name)
          : null) || ''
        const sku = v.sku || (typeof v.productId === 'object' ? v.productId.sku : '') || ''
        results.push({
          _id: key,
          kind: 'variant',
          productId: String(productId),
          variantId: String(v._id),
          variantName: v.name || '',
          productName,
          sku,
          name: [sku, v.name || productName].filter(Boolean).join(' — ') || v.name,
          barcode: v.barcode,
          productHasVariants: true,
        })
      }
    } catch {
      /* variants optional */
    }
  }

  try {
    const list = await api.get('/products', {
      params: { search: needle, limit: 15, status: 'active' },
    }).then((r) => r.data?.products || r.data || [])

    await Promise.all((list || []).map(async (p) => {
      if (!p?._id) return
      const productId = String(p._id)

      if (variantsEnabled) {
        // Template already represented by a variant hit — skip parent
        if (results.some((r) => String(r.productId) === productId && r.kind === 'variant')) {
          return
        }
        try {
          const data = await api.get('/stock/variants', {
            params: { productId, limit: 50 },
          }).then((r) => r.data)
          const items = Array.isArray(data) ? data : (data?.items || [])
          if (items.length > 0) {
            // Expand variants; never offer the parent template
            for (const v of items) {
              if (!v?._id) continue
              const key = `v:${v._id}`
              if (seen.has(key)) continue
              seen.add(key)
              results.push({
                _id: key,
                kind: 'variant',
                productId,
                variantId: String(v._id),
                variantName: v.name || '',
                productName: p.nameEn || p.name || '',
                sku: v.sku || p.sku || '',
                name: [v.sku || p.sku, v.name || p.nameEn || p.name].filter(Boolean).join(' — '),
                barcode: v.barcode || p.barcode,
                uomId: p.uomId,
                unitOfMeasure: p.unitOfMeasure,
                productHasVariants: true,
              })
            }
            return
          }
        } catch {
          /* fall through to template */
        }
      }

      const key = `p:${productId}`
      if (seen.has(key)) return
      seen.add(key)
      results.push({
        _id: key,
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
        productHasVariants: false,
      })
    }))
  } catch {
    /* ignore */
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

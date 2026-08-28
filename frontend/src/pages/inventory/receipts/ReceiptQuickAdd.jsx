import { useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { useForceVariantPick, isVariantPickCancelled } from '../../../lib/useForceVariantPick'

/**
 * Barcode / quick-entry field above the line items grid.
 * Scanning a SKU adds a line or increments Done (edit) / Demand (create) by 1.
 */
export function ReceiptQuickAdd({
  ar,
  enabled = true,
  mode = 'create', // 'create' | 'edit'
  variantsEnabled = true,
  onAddOrIncrementCreate,
  onIncrementDone,
  moves = [],
}) {
  const [buf, setBuf] = useState('')
  const [busy, setBusy] = useState(false)
  const { resolvePick, forceVariantModal } = useForceVariantPick({ ar, variantsEnabled })

  if (!enabled) return null

  const emitCreateLine = (resolved) => {
    onAddOrIncrementCreate?.({
      productId: resolved.productId,
      productName: resolved.productName || '',
      sku: resolved.sku || '',
      variantId: resolved.variantId || null,
      variantName: resolved.variantName || '',
      demandQty: '1',
      needsVariant: false,
    })
    setBuf('')
  }

  const lookup = async () => {
    const q = buf.trim()
    if (!q || busy) return
    setBusy(true)
    try {
      try {
        const variants = await api.get('/stock/variants', { params: { q, limit: 5 } }).then((r) => r.data?.items || [])
        const hit = variants.find((v) => v.barcode === q || v.sku === q)
        if (hit?.productId) {
          const productId = typeof hit.productId === 'object' ? hit.productId._id : hit.productId
          const productName = (typeof hit.productId === 'object'
            ? (hit.productId.nameEn || hit.productId.name)
            : null) || hit.name
          const sku = (typeof hit.productId === 'object' ? hit.productId.sku : null) || hit.sku

          if (mode === 'edit') {
            const move = moves.find((m) => {
              const pid = m.productId?._id || m.productId
              const vid = m.variantId?._id || m.variantId
              return String(pid) === String(productId) && String(vid || '') === String(hit._id)
            })
            if (move) {
              onIncrementDone?.(move._id)
              setBuf('')
              toast.success(ar ? '+1' : '+1')
              return
            }
            toast.error(ar ? 'المنتج غير موجود في هذا الاستلام' : 'Product not on this receipt')
            return
          }

          emitCreateLine({
            productId: String(productId),
            productName,
            sku,
            variantId: String(hit._id),
            variantName: hit.name || '',
          })
          toast.success(ar ? 'تمت الإضافة' : 'Added')
          return
        }
      } catch {
        // fall through to product lookup
      }

      const product = await api.get('/products/lookup', { params: { barcode: q } }).then((r) => r.data).catch(async () => {
        return api.get('/products/lookup', { params: { sku: q } }).then((r) => r.data)
      })
      if (!product?._id) {
        toast.error(ar ? 'غير موجود' : 'Not found')
        return
      }

      if (mode === 'edit') {
        const move = moves.find((m) => String(m.productId?._id || m.productId) === String(product._id))
        if (move) {
          onIncrementDone?.(move._id)
          setBuf('')
          toast.success(ar ? '+1' : '+1')
          return
        }
        toast.error(ar ? 'المنتج غير موجود في هذا الاستلام' : 'Product not on this receipt')
        return
      }

      let resolved
      try {
        resolved = await resolvePick({
          kind: 'product',
          productId: String(product._id),
          productName: product.nameEn || product.name,
          name: product.nameEn || product.name,
          sku: product.sku,
          productHasVariants: Array.isArray(product.attributeLines) && product.attributeLines.length > 0,
        })
      } catch (e) {
        if (isVariantPickCancelled(e)) return
        throw e
      }
      emitCreateLine(resolved)
      toast.success(ar ? 'تمت الإضافة' : 'Added')
    } catch {
      toast.error(ar ? 'غير موجود' : 'Not found')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {forceVariantModal}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full ps-9"
            placeholder={ar ? 'امسح الباركود أو أدخل الـ SKU…' : 'Scan barcode or type SKU…'}
            value={buf}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => setBuf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                lookup()
              }
            }}
          />
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy || !buf.trim()} onClick={lookup}>
          {ar ? 'إضافة' : 'Add'}
        </button>
      </div>
    </>
  )
}

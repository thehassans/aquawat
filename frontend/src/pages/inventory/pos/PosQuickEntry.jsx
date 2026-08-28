import { useEffect, useRef, useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { parsePosBarcode, matchProductByItemCode } from './weightBarcode'
import { useForceVariantPick, isVariantPickCancelled } from '../../../lib/useForceVariantPick'

/**
 * Always-focused PoS quick entry — scanners + weight barcodes.
 */
export function PosQuickEntry({
  ar,
  enabled = true,
  variantsEnabled = true,
  onAddWithQty,
}) {
  const inputRef = useRef(null)
  const [buf, setBuf] = useState('')
  const [busy, setBusy] = useState(false)
  const { resolvePick, forceVariantModal } = useForceVariantPick({ ar, variantsEnabled })

  useEffect(() => {
    if (!enabled) return undefined
    const focus = () => inputRef.current?.focus()
    focus()
    const t = setInterval(focus, 2500)
    return () => clearInterval(t)
  }, [enabled])

  if (!enabled) return null

  const addResolved = (resolved, qty) => {
    onAddWithQty?.({
      productId: resolved.productId,
      productName: resolved.productName || '',
      sku: resolved.sku || '',
      qty,
      variantId: resolved.variantId || null,
      variantName: resolved.variantName || '',
    })
  }

  const resolveAndAdd = async () => {
    const raw = buf.trim()
    if (!raw || busy) return
    setBusy(true)
    try {
      const parsed = parsePosBarcode(raw)
      if (!parsed) return

      if (parsed.kind === 'weight') {
        let product = null
        try {
          product = await api.get('/products/lookup', { params: { barcode: raw } }).then((r) => r.data)
        } catch { /* fall through */ }

        if (!product?._id) {
          const list = await api.get('/products', {
            params: { search: parsed.itemCode, limit: 25, status: 'active' },
          }).then((r) => r.data?.products || r.data || [])
          product = matchProductByItemCode(list, parsed.itemCode)
        }

        if (!product?._id) {
          toast.error(ar ? `لم يُعثر على منتج للكود ${parsed.itemCode}` : `No product for item code ${parsed.itemCode}`)
          return
        }

        let resolved
        try {
          resolved = await resolvePick({
            kind: 'product',
            productId: String(product._id),
            productName: ar && product.nameAr ? product.nameAr : (product.nameEn || product.name),
            name: product.nameEn || product.name,
            sku: product.sku || parsed.itemCode,
            productHasVariants: Array.isArray(product.attributeLines) && product.attributeLines.length > 0,
          })
        } catch (e) {
          if (isVariantPickCancelled(e)) return
          throw e
        }

        addResolved(resolved, parsed.weightKg)
        toast.success(ar ? `+${parsed.weightKg} كغ` : `+${parsed.weightKg} kg`)
        setBuf('')
        return
      }

      try {
        const variants = await api.get('/stock/variants', { params: { q: parsed.code, limit: 5 } })
          .then((r) => r.data?.items || r.data || [])
        const list = Array.isArray(variants) ? variants : []
        const hit = list.find((v) => v.barcode === parsed.code || v.sku === parsed.code)
        if (hit?.productId) {
          const productId = typeof hit.productId === 'object' ? hit.productId._id : hit.productId
          const productName = (typeof hit.productId === 'object'
            ? (hit.productId.nameEn || hit.productId.name)
            : null) || hit.name
          addResolved({
            productId: String(productId),
            productName,
            sku: hit.sku || '',
            variantId: String(hit._id),
            variantName: hit.name || '',
          }, 1)
          toast.success('+1')
          setBuf('')
          return
        }
      } catch { /* product lookup */ }

      const product = await api.get('/products/lookup', { params: { barcode: parsed.code } })
        .then((r) => r.data)
        .catch(async () => api.get('/products/lookup', { params: { sku: parsed.code } }).then((r) => r.data))

      if (!product?._id) {
        toast.error(ar ? 'غير موجود' : 'Not found')
        return
      }

      let resolved
      try {
        resolved = await resolvePick({
          kind: 'product',
          productId: String(product._id),
          productName: ar && product.nameAr ? product.nameAr : (product.nameEn || product.name),
          name: product.nameEn || product.name,
          sku: product.sku || '',
          productHasVariants: Array.isArray(product.attributeLines) && product.attributeLines.length > 0,
        })
      } catch (e) {
        if (isVariantPickCancelled(e)) return
        throw e
      }

      addResolved(resolved, 1)
      toast.success('+1')
      setBuf('')
    } catch {
      toast.error(ar ? 'فشل المسح' : 'Scan failed')
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <>
      {forceVariantModal}
      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          className="input w-full ps-9 font-mono text-sm"
          value={buf}
          disabled={busy}
          autoFocus
          placeholder={ar ? 'مسح سريع — باركود / ميزان…' : 'POS quick entry — barcode / scale…'}
          onChange={(e) => setBuf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              resolveAndAdd()
            }
          }}
        />
      </div>
    </>
  )
}

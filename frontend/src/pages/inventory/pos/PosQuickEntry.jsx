import { useEffect, useRef, useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { parsePosBarcode, matchProductByItemCode } from './weightBarcode'

/**
 * Always-focused PoS quick entry — scanners + weight barcodes.
 */
export function PosQuickEntry({
  ar,
  enabled = true,
  onAddWithQty,
}) {
  const inputRef = useRef(null)
  const [buf, setBuf] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined
    const focus = () => inputRef.current?.focus()
    focus()
    const t = setInterval(focus, 2500)
    return () => clearInterval(t)
  }, [enabled])

  if (!enabled) return null

  const resolveAndAdd = async () => {
    const raw = buf.trim()
    if (!raw || busy) return
    setBusy(true)
    try {
      const parsed = parsePosBarcode(raw)
      if (!parsed) return

      if (parsed.kind === 'weight') {
        // Try exact barcode first, then item-code match via product search
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

        onAddWithQty?.({
          productId: product._id,
          productName: ar && product.nameAr ? product.nameAr : (product.nameEn || product.name),
          sku: product.sku || parsed.itemCode,
          qty: parsed.weightKg,
          variantId: null,
          variantName: '',
        })
        toast.success(
          ar
            ? `+${parsed.weightKg} كغ`
            : `+${parsed.weightKg} kg`,
        )
        setBuf('')
        return
      }

      // Standard UPC/EAN — increment by 1
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
          onAddWithQty?.({
            productId,
            productName,
            sku: hit.sku || '',
            qty: 1,
            variantId: hit._id,
            variantName: hit.name || '',
          })
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

      onAddWithQty?.({
        productId: product._id,
        productName: ar && product.nameAr ? product.nameAr : (product.nameEn || product.name),
        sku: product.sku || '',
        qty: 1,
        variantId: null,
        variantName: '',
      })
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
  )
}

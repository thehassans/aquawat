import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Archive, Copy, Printer, Settings2 } from 'lucide-react'
import api from '../../lib/api'
import { formatInvError } from '../../lib/invError'
import { PortalDropdown } from '../../pages/inventory/PortalDropdown'

/** Strip identity fields and prepare a create-form payload from an existing product. */
export function buildDuplicateDraft(product, { ar = false } = {}) {
  if (!product) return null
  const nameEn = product.nameEn || product.name || ''
  const nameAr = product.nameAr || ''
  const suffix = Date.now().toString(36).slice(-4)
  const baseSku = String(product.sku || 'SKU').replace(/-copy-.*$/i, '')
  return {
    ...product,
    _id: undefined,
    id: undefined,
    productId: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    createdBy: undefined,
    updatedBy: undefined,
    stocks: [],
    totalStock: 0,
    inventory: undefined,
    images: [],
    barcode: '',
    sku: `${baseSku}-copy-${suffix}`.slice(0, 64),
    nameEn: nameEn ? `Copy of ${nameEn}` : 'Copy of product',
    nameAr: nameAr
      ? (ar ? `نسخة من ${nameAr}` : `Copy of ${nameAr}`)
      : (nameEn ? `نسخة من ${nameEn}` : ''),
    name: nameEn ? `Copy of ${nameEn}` : 'Copy of product',
    status: 'active',
    isActive: true,
  }
}

/**
 * Gear Actions menu for Product Detail — soft shadow, no harsh borders.
 */
export default function ProductActionsMenu({ product, language = 'en', disabled = false }) {
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)

  const archived = product?.isActive === false
    || product?.status === 'discontinued'
    || product?.status === 'inactive'

  const archiveMut = useMutation({
    mutationFn: async () => {
      if (archived) {
        return api.put(`/products/${product._id}`, {
          isActive: true,
          status: 'active',
        }).then((r) => r.data)
      }
      return api.delete(`/products/${product._id}`).then((r) => r.data)
    },
    onSuccess: () => {
      toast.success(archived
        ? (ar ? 'تمت الاستعادة' : 'Product restored')
        : (ar ? 'تم الأرشفة' : 'Product archived'))
      qc.invalidateQueries({ queryKey: ['product', String(product._id)] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-stats'] })
      setOpen(false)
      if (!archived) navigate('/app/dashboard/inventory/products')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const printLabels = async () => {
    try {
      const res = await api.post('/stock/print', {
        layout: 'product_label',
        productIds: [product._id],
        copies: 1,
        lang: ar ? 'ar' : 'en',
      }, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `label-${product.sku || product.productId || product._id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(ar ? 'تم إنشاء الملصقات' : 'Labels ready')
      setOpen(false)
    } catch (e) {
      toast.error(formatInvError(e, language))
    }
  }

  const onDuplicate = () => {
    const draft = buildDuplicateDraft(product, { ar })
    setOpen(false)
    navigate('/app/dashboard/inventory/products/new', { state: { duplicateFrom: draft } })
  }

  if (!product?._id) return null

  const items = [
    {
      id: 'duplicate',
      icon: Copy,
      label: ar ? 'تكرار' : 'Duplicate',
      hint: ar ? 'نسخة جديدة للتعديل' : 'Open a copy to edit',
      onClick: onDuplicate,
    },
    {
      id: 'archive',
      icon: Archive,
      label: archived ? (ar ? 'استعادة' : 'Restore') : (ar ? 'أرشفة' : 'Archive'),
      hint: archived
        ? (ar ? 'إعادة تفعيل المنتج' : 'Reactivate this product')
        : (ar ? 'إيقاف وإخفاء من القوائم' : 'Deactivate and hide from lists'),
      onClick: () => archiveMut.mutate(),
      danger: !archived,
    },
    {
      id: 'labels',
      icon: Printer,
      label: ar ? 'طباعة ملصقات' : 'Print Labels',
      hint: ar ? 'باركود + سعر + SKU' : 'Barcode + price + SKU',
      onClick: printLabels,
    },
  ]

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:bg-dark-800 dark:text-slate-300 dark:ring-dark-600"
        onClick={() => setOpen((v) => !v)}
        title={ar ? 'إجراءات' : 'Actions'}
        aria-label={ar ? 'قائمة الإجراءات' : 'Actions menu'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Settings2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <PortalDropdown
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        align="end"
        className="w-64 !border-0 !bg-white p-1.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5 dark:!bg-dark-800 dark:ring-white/10"
      >
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {ar ? 'إجراءات المنتج' : 'Product actions'}
        </p>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={archiveMut.isPending}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-slate-50 dark:hover:bg-dark-700 ${
                item.danger ? 'hover:bg-rose-50 dark:hover:bg-rose-950/30' : ''
              }`}
              onClick={item.onClick}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                item.danger ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-300'
              }`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${item.danger ? 'text-rose-700' : 'text-slate-800 dark:text-slate-100'}`}>
                  {item.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{item.hint}</span>
              </span>
            </button>
          )
        })}
      </PortalDropdown>
    </>
  )
}

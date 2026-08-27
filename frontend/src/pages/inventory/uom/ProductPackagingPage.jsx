import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import EmptyState from '../../../components/ui/EmptyState'
import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import { StatusChip, invTableClass, invTableWrapClass, invThClass, invTdClass } from '../inventoryUi'
import { ConfigModal } from '../ConfigModal'

const DEFAULT_PACKAGE_TYPES = [
  { en: 'Box', ar: 'صندوق' },
  { en: 'Pallet', ar: 'طبلية' },
  { en: 'Shrink-wrap', ar: 'تغليف حراري' },
]

function productLabel(p, ar) {
  if (!p) return '—'
  if (typeof p === 'string') return p
  const n = ar ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)
  return p.sku ? `${n} (${p.sku})` : (n || '—')
}

/**
 * Product packagings — product-specific pack sizes (not universal UoMs).
 */
export default function ProductPackagingPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [filterProductId, setFilterProductId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [product, setProduct] = useState(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('12')
  const [barcode, setBarcode] = useState('')
  const [typeId, setTypeId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inv-product-packagings', filterProductId],
    queryFn: () => api.get('/stock/product-packagings', {
      params: {
        active: 'all',
        ...(filterProductId ? { productId: filterProductId } : {}),
      },
    }).then((r) => asInvList(r.data)),
  })

  const { data: types = [] } = useQuery({
    queryKey: ['inv-package-types'],
    queryFn: async () => {
      const rows = asInvList(await api.get('/stock/package-types').then((r) => r.data))
      const names = new Set(rows.map((t) => String(t.name || '').toLowerCase()))
      for (const def of DEFAULT_PACKAGE_TYPES) {
        if (!names.has(def.en.toLowerCase())) {
          try {
            await api.post('/stock/package-types', { name: def.en, nameAr: def.ar })
          } catch {
            /* ignore race / unique */
          }
        }
      }
      return asInvList(await api.get('/stock/package-types').then((r) => r.data))
    },
  })

  const items = data || []

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter((row) => {
      const hay = [
        row.name,
        row.barcode,
        row.packageTypeId?.name,
        productLabel(row.productId, ar),
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [items, q, ar])

  const resetForm = () => {
    setProduct(null)
    setName('')
    setQty('12')
    setBarcode('')
    setTypeId('')
  }

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/product-packagings', {
      productId: product?._id,
      name,
      qty: qty || '1',
      barcode: barcode || undefined,
      packageTypeId: typeId || undefined,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم إنشاء التعبئة' : 'Packaging created')
      setModalOpen(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['inv-product-packagings'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/stock/product-packagings/${id}`, body),
    onSuccess: () => {
      toast.success(ar ? 'تم التحديث' : 'Updated')
      qc.invalidateQueries({ queryKey: ['inv-product-packagings'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const fetchProducts = async (search) => {
    const res = await api.get('/products', {
      params: { search, limit: 40, productType: 'goods' },
    })
    return res.data?.products || res.data?.data || (Array.isArray(res.data) ? res.data : [])
  }

  return (
    <div className="flex min-h-[60vh] flex-col gap-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'تعبئة المنتجات' : 'Product packagings'}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {ar
              ? 'التعبئة خاصة بمنتج واحد (مثل صندوق من 12 حبة) — وليست وحدة قياس عامة.'
              : 'Packagings belong to a single product (e.g. a case of 12) — not a universal UoM.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm()
            setModalOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {ar ? 'إضافة تعبئة' : 'Add packaging'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-10 pe-3 text-sm outline-none focus:border-sky-600/40 focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-800"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'بحث…' : 'Search…'}
          />
        </div>
        <div className="w-full max-w-xs sm:w-64">
            <AsyncCombobox
              value={filterProductId || null}
              selectedOption={null}
              onChange={(id) => setFilterProductId(id || '')}
              fetchOptions={fetchProducts}
              queryKeyPrefix="packaging-filter-product"
              getOptionLabel={(p) => productLabel(p, ar)}
              getOptionSub={(p) => p?.sku || ''}
              placeholder={ar ? 'تصفية بالمنتج…' : 'Filter by product…'}
              minChars={0}
              noResultsText={ar ? 'لا نتائج' : 'No results'}
            />
          {filterProductId ? (
            <button
              type="button"
              className="mt-1 text-xs text-sky-700 hover:underline"
              onClick={() => setFilterProductId('')}
            >
              {ar ? 'مسح التصفية' : 'Clear filter'}
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">…</div>
      ) : !filtered.length ? (
        <EmptyState
          title={ar ? 'لا تعبئة' : 'No packagings'}
          description={ar ? 'أضف تعبئة لمنتج محدد' : 'Add a packaging for a specific product'}
        />
      ) : (
        <div className={`${invTableWrapClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className={`${invTableClass} min-w-[800px]`}>
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-start text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
                <tr>
                  <th className={invThClass}>{ar ? 'المنتج' : 'Product'}</th>
                  <th className={invThClass}>{ar ? 'اسم التعبئة' : 'Packaging name'}</th>
                  <th className={invThClass}>{ar ? 'الكمية المحتواة' : 'Contained qty'}</th>
                  <th className={invThClass}>{ar ? 'باركود' : 'Barcode'}</th>
                  <th className={invThClass}>{ar ? 'نوع الطرد' : 'Package type'}</th>
                  <th className={invThClass}>{ar ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row._id}
                    className="border-b border-slate-50 transition hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-700/40"
                  >
                    <td className={invTdClass}>{productLabel(row.productId, ar)}</td>
                    <td className={`${invTdClass} font-semibold text-slate-900 dark:text-slate-100`}>
                      {row.name}
                    </td>
                    <td className={`${invTdClass} tabular-nums`}>{row.qty}</td>
                    <td className={`${invTdClass} font-mono text-xs text-slate-500`}>
                      {row.barcode || '—'}
                    </td>
                    <td className={invTdClass}>{row.packageTypeId?.name || '—'}</td>
                    <td className={invTdClass}>
                      <button
                        type="button"
                        className="me-2 text-xs text-primary-600 hover:underline"
                        onClick={() => patchMut.mutate({ id: row._id, active: row.active === false })}
                      >
                        {row.active === false
                          ? (ar ? 'تفعيل' : 'Activate')
                          : (ar ? 'إيقاف' : 'Deactivate')}
                      </button>
                      <StatusChip status={row.active === false ? 'cancelled' : 'done'} language={language} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfigModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ar={ar}
        title={ar ? 'إضافة تعبئة' : 'Add packaging'}
        subtitle={ar
          ? 'تعبئة مرتبطة بمنتج واحد وكمية من وحدة المنتج الأساسية'
          : 'Tied to one product and a quantity of its base UoM'}
        footer={(
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={createMut.isPending || !product?._id || !name.trim() || !qty}
              onClick={() => createMut.mutate()}
            >
              {ar ? 'إنشاء' : 'Create'}
            </button>
          </>
        )}
      >
        <div className="space-y-3">
          <div>
            <label className="label text-xs">{ar ? 'المنتج *' : 'Product *'}</label>
            <AsyncCombobox
              value={product?._id || null}
              selectedOption={product}
              onChange={(_id, opt) => setProduct(opt || null)}
              fetchOptions={fetchProducts}
              queryKeyPrefix="packaging-product"
              getOptionLabel={(p) => productLabel(p, ar)}
              getOptionSub={(p) => p?.sku || ''}
              placeholder={ar ? 'ابحث عن منتج…' : 'Search product…'}
              minChars={1}
              noResultsText={ar ? 'لا نتائج' : 'No results'}
            />
          </div>
          <div>
            <label className="label text-xs">{ar ? 'اسم التعبئة *' : 'Packaging name *'}</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ar ? 'كرتون 24' : 'Case of 24'}
            />
          </div>
          <div>
            <label className="label text-xs">
              {ar ? 'الكمية المحتواة (بوحدة المنتج) *' : 'Contained quantity (base UoM) *'}
            </label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="12"
            />
          </div>
          <div>
            <label className="label text-xs">{ar ? 'باركود العبوة' : 'Barcode'}</label>
            <input
              className="input"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder={ar ? 'باركود الصندوق' : 'Outer box barcode'}
            />
          </div>
          <div>
            <label className="label text-xs">{ar ? 'نوع الطرد (اختياري)' : 'Package type (optional)'}</label>
            <select className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">{ar ? '— بدون —' : '— None —'}</option>
              {(Array.isArray(types) ? types : []).map((t) => (
                <option key={t._id} value={t._id}>
                  {ar && t.nameAr ? t.nameAr : t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </ConfigModal>
    </div>
  )
}

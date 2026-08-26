import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, ArrowLeft, Trash2, Search } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import ProductChooser from '../../components/inventory/ProductChooser'
import { StatusChip } from './inventoryUi'
import EmptyState from '../../components/ui/EmptyState'

export function ScrapList() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['stock-scraps'],
    queryFn: () => api.get('/stock/scraps').then((r) => r.data),
  })
  const allItems = asInvList(data)
  const items = useMemo(() => {
    if (!q.trim()) return allItems
    const needle = q.toLowerCase()
    return allItems.filter((s) => {
      const pname = [s.productId?.nameEn, s.productId?.nameAr, s.productId?.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (
        s.name?.toLowerCase().includes(needle) ||
        s.reasonTag?.toLowerCase().includes(needle) ||
        pname.includes(needle) ||
        s.sourceLocationId?.completePath?.toLowerCase().includes(needle)
      )
    })
  }, [allItems, q])
  const draftIds = items.filter((s) => s.state === 'draft').map((s) => s._id)

  const validateBulk = useMutation({
    mutationFn: (ids) => api.post('/stock/scraps/validate-bulk', { ids }).then((r) => r.data),
    onSuccess: (res) => {
      toast.success(
        ar
          ? `تم اعتماد ${res.okCount}${res.failCount ? ` · فشل ${res.failCount}` : ''}`
          : `Validated ${res.okCount}${res.failCount ? ` · ${res.failCount} failed` : ''}`,
      )
      qc.invalidateQueries({ queryKey: ['stock-scraps'] })
      qc.invalidateQueries({ queryKey: ['stock-report'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['physical-inventory'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'الخردة' : 'Scrap'}
          </h2>
          <p className="text-xs text-slate-500">
            {ar ? 'إخراج مخزون تالف من الموقع إلى خردة' : 'Move damaged stock from source to scrap location'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draftIds.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={validateBulk.isPending}
              onClick={() => {
                if (window.confirm(ar ? `اعتماد ${draftIds.length} مسودة؟` : `Validate ${draftIds.length} draft(s)?`)) {
                  validateBulk.mutate(draftIds)
                }
              }}
            >
              {ar ? `اعتماد المسودات (${draftIds.length})` : `Validate drafts (${draftIds.length})`}
            </button>
          )}
          <Link to="/app/dashboard/inventory/scrap/new" className="btn btn-primary text-sm">
            <Plus className="h-4 w-4" />
            {ar ? 'جديد' : 'New'}
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input w-full ps-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? 'بحث بالمرجع أو المنتج…' : 'Search reference or product…'}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-dark-600">
            <tr>
              <th className="px-4 py-3 text-start">{ar ? 'المرجع' : 'Reference'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'الكمية' : 'Qty'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'الوحدة' : 'UoM'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'المصدر' : 'Source'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'الخردة' : 'Scrap loc'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'التاريخ' : 'Date'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-dark-700">
            {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={8} className="p-8"><EmptyState title={ar ? 'لا خردة' : 'No scraps'} /></td></tr>
            )}
            {items.map((s) => (
              <tr key={s._id} className="hover:bg-slate-50/60 dark:hover:bg-dark-900/40">
                <td className="px-4 py-3">
                  <Link to={`/app/dashboard/inventory/scrap/${s._id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {ar && s.productId?.nameAr ? s.productId.nameAr : s.productId?.nameEn}
                  </div>
                  {s.productId?.sku ? <div className="font-mono text-[11px] text-slate-400">{s.productId.sku}</div> : null}
                </td>
                <td className="px-4 py-3 tabular-nums">{s.quantity}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.uomId?.name || s.productId?.unitOfMeasure || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.sourceLocationId?.completePath || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.scrapLocationId?.completePath || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.date ? new Date(s.date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3"><StatusChip status={s.state === 'done' ? 'done' : 'draft'} language={language} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const emptyLine = () => ({
  productId: '',
  productName: '',
  sku: '',
  quantity: '1',
  uomId: '',
  uomLabel: '',
  variantId: '',
  variantName: '',
  variants: [],
})

export function ScrapForm() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations-internal'],
    queryFn: () => api.get('/stock/locations', { params: { usage: 'internal' } }).then((r) => asInvList(r.data)),
  })

  const { data: scrapLocations = [] } = useQuery({
    queryKey: ['stock-locations-scrap'],
    queryFn: () => api.get('/stock/locations', { params: { usage: 'scrap' } }).then((r) => asInvList(r.data)),
  })

  const { data: uoms = [] } = useQuery({
    queryKey: ['stock-uoms-lite'],
    queryFn: () => api.get('/stock/uoms').then((r) => asInvList(r.data)),
    staleTime: 10 * 60 * 1000,
  })

  const { data: scrap, isLoading } = useQuery({
    queryKey: ['stock-scrap', id],
    enabled: !isNew,
    queryFn: () => api.get(`/stock/scraps/${id}`).then((r) => r.data),
  })

  const [header, setHeader] = useState({
    sourceLocationId: '',
    scrapLocationId: '',
    date: new Date().toISOString().slice(0, 16),
    reasonTag: '',
  })
  const [lines, setLines] = useState([emptyLine()])

  useEffect(() => {
    if (!locations.length || header.sourceLocationId) return
    setHeader((h) => ({ ...h, sourceLocationId: locations[0]._id }))
  }, [locations, header.sourceLocationId])

  useEffect(() => {
    if (!scrapLocations.length || header.scrapLocationId) return
    setHeader((h) => ({ ...h, scrapLocationId: scrapLocations[0]._id }))
  }, [scrapLocations, header.scrapLocationId])

  const create = useMutation({
    mutationFn: (body) => api.post('/stock/scraps', body).then((r) => r.data),
    onSuccess: async (doc) => {
      const items = Array.isArray(doc?.items) ? doc.items : (Array.isArray(doc) ? doc : [doc]).filter(Boolean)
      toast.success(
        items.length > 1
          ? (ar ? `تم إنشاء ${items.length} خردة` : `Created ${items.length} scraps`)
          : (ar ? 'تم' : 'Created'),
      )
      qc.invalidateQueries({ queryKey: ['stock-scraps'] })
      if (items.length > 1) {
        navigate('/app/dashboard/inventory/scrap')
      } else if (items[0]?._id) {
        navigate(`/app/dashboard/inventory/scrap/${items[0]._id}`)
      } else {
        navigate('/app/dashboard/inventory/scrap')
      }
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const validate = useMutation({
    mutationFn: () => api.post(`/stock/scraps/${id}/validate`),
    onSuccess: () => {
      toast.success(ar ? 'تم الاعتماد' : 'Validated')
      qc.invalidateQueries({ queryKey: ['stock-scrap', id] })
      qc.invalidateQueries({ queryKey: ['stock-scraps'] })
      qc.invalidateQueries({ queryKey: ['stock-report'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['physical-inventory'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const pickProduct = async (product, targetIdx = null) => {
    let variants = []
    let variantId = ''
    let variantName = ''
    if (settings?.groupProductVariant) {
      try {
        const { items = [] } = await api.get('/stock/variants', {
          params: { productId: product._id, limit: 50 },
        }).then((r) => r.data)
        variants = items
        if (items.length === 1) {
          variantId = items[0]._id
          variantName = items[0].name
        }
      } catch {
        /* optional */
      }
    }
    const next = {
      productId: product._id,
      productName: ar && product.nameAr ? product.nameAr : (product.nameEn || product.name),
      sku: product.sku || '',
      quantity: '1',
      uomId: product.uomId || '',
      uomLabel: product.unitOfMeasure || '',
      variantId,
      variantName,
      variants,
    }
    setLines((prev) => {
      if (targetIdx != null && targetIdx >= 0) {
        const copy = [...prev]
        const prevQty = copy[targetIdx]?.quantity
        copy[targetIdx] = {
          ...next,
          quantity: prevQty && Number(prevQty) > 0 ? prevQty : next.quantity,
        }
        return copy
      }
      const blankIdx = prev.findIndex((l) => !l.productId)
      if (blankIdx >= 0) {
        const copy = [...prev]
        copy[blankIdx] = next
        return copy
      }
      return [...prev, next]
    })
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!header.sourceLocationId) {
      toast.error(ar ? 'موقع المصدر مطلوب' : 'Source location required')
      return
    }
    if (!header.scrapLocationId) {
      toast.error(ar ? 'موقع الخردة مطلوب' : 'Scrap location required')
      return
    }
    const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
    if (!validLines.length) {
      toast.error(ar ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product line')
      return
    }
    for (const l of validLines) {
      if ((l.variants || []).length > 1 && !l.variantId) {
        toast.error(ar ? 'اختر المتغير' : 'Select a variant')
        return
      }
    }
    create.mutate({
      sourceLocationId: header.sourceLocationId,
      scrapLocationId: header.scrapLocationId,
      date: header.date || undefined,
      reasonTag: header.reasonTag,
      lines: validLines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        uomId: l.uomId || undefined,
        variantId: l.variantId || undefined,
      })),
    })
  }

  if (!isNew && isLoading) return <div className="text-sm text-slate-400">…</div>

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/app/dashboard/inventory/scrap" className="btn btn-secondary btn-sm">
            <ArrowLeft className="h-4 w-4" />
            {ar ? 'رجوع' : 'Back'}
          </Link>
          <div>
            <p className="text-xs text-slate-500">{ar ? 'المخزون / خردة' : 'Inventory / Scrap'}</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isNew ? (ar ? 'خردة جديدة' : 'New scrap') : scrap?.name}
            </h2>
          </div>
        </div>
        {!isNew && scrap?.state === 'draft' && (
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={validate.isPending}
            onClick={() => validate.mutate()}
          >
            {ar ? 'اعتماد' : 'Validate'}
          </button>
        )}
      </div>

      {isNew ? (
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm sm:col-span-1">
              <span className="label">{ar ? 'التاريخ' : 'Date'} <span className="text-rose-500">*</span></span>
              <input
                type="datetime-local"
                className="input mt-1 w-full"
                required
                value={header.date}
                onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="label">{ar ? 'موقع المصدر' : 'Source location'} <span className="text-rose-500">*</span></span>
              <select
                className="select mt-1 w-full"
                required
                value={header.sourceLocationId}
                onChange={(e) => setHeader((h) => ({ ...h, sourceLocationId: e.target.value }))}
              >
                <option value="">…</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>{l.completePath || l.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="label">{ar ? 'موقع الخردة' : 'Scrap location'} <span className="text-rose-500">*</span></span>
              <select
                className="select mt-1 w-full"
                required
                value={header.scrapLocationId}
                onChange={(e) => setHeader((h) => ({ ...h, scrapLocationId: e.target.value }))}
              >
                <option value="">…</option>
                {(scrapLocations.length ? scrapLocations : locations).map((l) => (
                  <option key={l._id} value={l._id}>{l.completePath || l.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="label">{ar ? 'السبب' : 'Reason'}</span>
              <input
                className="input mt-1 w-full"
                value={header.reasonTag}
                onChange={(e) => setHeader((h) => ({ ...h, reasonTag: e.target.value }))}
                placeholder={ar ? 'تالف / منتهي…' : 'Damaged / expired…'}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {ar ? 'بنود الخردة' : 'Scrap lines'}
                </div>
                <p className="text-xs text-slate-500">
                  {ar ? 'منتج · متغير · وحدة · كمية' : 'Product · variant · UoM · quantity'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLines((l) => [...l, emptyLine()])}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:border-teal-600 hover:text-teal-700 dark:border-dark-500 dark:bg-dark-700 dark:text-slate-100"
              >
                <Plus className="h-3.5 w-3.5" />
                {ar ? 'إضافة' : 'Add'}
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-dark-600">
              <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(7rem,10rem)_minmax(5rem,8rem)_5.5rem_2.5rem] gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-dark-600 dark:bg-dark-900/50 sm:grid">
                <span>{ar ? 'المنتج' : 'Product'}</span>
                <span>{ar ? 'المتغير' : 'Variant'}</span>
                <span>{ar ? 'الوحدة' : 'UoM'}</span>
                <span>{ar ? 'الكمية' : 'Qty'}</span>
                <span />
              </div>
              <div className="divide-y divide-slate-100 dark:divide-dark-600">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1.5fr)_minmax(7rem,10rem)_minmax(5rem,8rem)_5.5rem_2.5rem]"
                  >
                    <div className="min-w-0">
                      <ProductChooser
                        mode="inline"
                        remote
                        valueLabel={line.productName || ''}
                        valueSub={line.sku ? `SKU ${line.sku}` : ''}
                        onPick={(p) => pickProduct(p, idx)}
                        placeholder={ar ? '— اختر من البحث —' : '— Pick from search —'}
                      />
                    </div>
                    {(line.variants || []).length > 0 ? (
                      <select
                        className="select select-sm"
                        value={line.variantId || ''}
                        onChange={(e) => {
                          const id = e.target.value
                          const v = line.variants.find((x) => String(x._id) === String(id))
                          setLines((rows) => {
                            const next = [...rows]
                            next[idx] = { ...line, variantId: id, variantName: v?.name || '' }
                            return next
                          })
                        }}
                      >
                        <option value="">{ar ? '— متغير —' : '— Variant —'}</option>
                        {line.variants.map((v) => (
                          <option key={v._id} value={v._id}>{v.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-slate-400">{line.variantName || '—'}</div>
                    )}
                    <select
                      className="select select-sm"
                      value={line.uomId || ''}
                      onChange={(e) => {
                        const id = e.target.value
                        const u = uoms.find((x) => String(x._id) === String(id))
                        setLines((rows) => {
                          const next = [...rows]
                          next[idx] = { ...line, uomId: id, uomLabel: u?.name || line.uomLabel }
                          return next
                        })
                      }}
                    >
                      <option value="">{line.uomLabel || (ar ? 'افتراضي' : 'Default')}</option>
                      {uoms.map((u) => (
                        <option key={u._id} value={u._id}>{ar && u.nameAr ? u.nameAr : u.name}</option>
                      ))}
                    </select>
                    <input
                      className="input input-sm text-end tabular-nums"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => {
                        const v = e.target.value
                        setLines((rows) => {
                          const next = [...rows]
                          next[idx] = { ...line, quantity: v }
                          return next
                        })
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon text-slate-400 hover:text-rose-600"
                      onClick={() => setLines((rows) => (rows.length <= 1 ? [emptyLine()] : rows.filter((_, i) => i !== idx)))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {ar ? 'حفظ' : 'Save'}
          </button>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">{ar ? 'التاريخ' : 'Date'}</div>
              <div className="font-medium">{scrap?.date ? new Date(scrap.date).toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{ar ? 'المصدر' : 'Source'}</div>
              <div className="font-medium text-xs">{scrap?.sourceLocationId?.completePath || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{ar ? 'موقع الخردة' : 'Scrap location'}</div>
              <div className="font-medium text-xs">{scrap?.scrapLocationId?.completePath || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{ar ? 'الحالة' : 'Status'}</div>
              <StatusChip status={scrap?.state === 'done' ? 'done' : 'draft'} language={language} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-dark-600">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/90 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900/50">
                <tr>
                  <th className="px-3 py-2.5 text-start">{ar ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-2.5 text-start">{ar ? 'المتغير' : 'Variant'}</th>
                  <th className="px-3 py-2.5 text-start">{ar ? 'الوحدة' : 'UoM'}</th>
                  <th className="px-3 py-2.5 text-start">{ar ? 'الكمية' : 'Qty'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2.5">
                    {scrap?.productId?._id ? (
                      <Link
                        className="font-medium text-primary-700 hover:underline dark:text-primary-300"
                        to={`/app/dashboard/inventory/products/${scrap.productId._id}`}
                      >
                        {ar && scrap.productId.nameAr ? scrap.productId.nameAr : scrap.productId.nameEn}
                      </Link>
                    ) : '—'}
                    {scrap?.productId?.sku ? <div className="font-mono text-[11px] text-slate-400">{scrap.productId.sku}</div> : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{scrap?.variantId?.name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{scrap?.uomId?.name || scrap?.productId?.unitOfMeasure || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums font-medium">{scrap?.quantity}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {scrap?.reasonTag ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="text-slate-500">{ar ? 'السبب' : 'Reason'}: </span>
              {scrap.reasonTag}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default ScrapList

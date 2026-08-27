import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScanBarcode } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import AsyncCombobox from '../../components/ui/AsyncCombobox'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import { formatInvError } from '../../lib/invError'
import {
  opsProductOptionLabel,
  opsProductOptionSub,
  searchProductsAndVariants,
} from '../../lib/productVariantSearch'

function fmtDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function diffColor(diff) {
  const n = Number(diff)
  if (!Number.isFinite(n) || n === 0) return 'text-slate-400'
  return n > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
}

function productLabel(row, ar) {
  const variant = row.variantId?.name || row.variantId?.nameAr
  const template = ar && row.productId?.nameAr ? row.productId.nameAr : (row.productId?.nameEn || row.productId?.sku || '—')
  if (variant) {
    // Prefer full variant name; if it already includes template, use as-is
    if (String(variant).toLowerCase().includes(String(template).toLowerCase().slice(0, 12))) {
      return ar && row.variantId?.nameAr ? row.variantId.nameAr : variant
    }
    return `${template} — ${ar && row.variantId?.nameAr ? row.variantId.nameAr : variant}`
  }
  return template
}

function rowSku(row) {
  return row.variantId?.sku || row.productId?.sku || ''
}

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename, headers, rows) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function PhysicalInventory() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const quickRef = useRef(null)

  const [filter, setFilter] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const [edits, setEdits] = useState({})
  const [dirty, setDirty] = useState(false)

  const [applyOpen, setApplyOpen] = useState(false)
  const [applyIds, setApplyIds] = useState([])
  const [applyPreview, setApplyPreview] = useState(null)
  const [accountingDate, setAccountingDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('Physical inventory')
  const [reasonCode, setReasonCode] = useState('data_entry_error')
  const [blindMode, setBlindMode] = useState(false)
  const [groupBy, setGroupBy] = useState('')
  const [colOptsOpen, setColOptsOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState({
    lot: true,
    package: true,
    onHand: true,
    uom: true,
    diff: true,
    scheduled: true,
    user: true,
    lastCount: true,
  })

  const REASON_CODES = [
    { code: 'damage', en: 'Damage', ar: 'تلف' },
    { code: 'theft_loss', en: 'Theft/Loss', ar: 'سرقة/فقدان' },
    { code: 'expiry', en: 'Expiry', ar: 'انتهاء صلاحية' },
    { code: 'found', en: 'Found', ar: 'عثر عليه' },
    { code: 'supplier_shortage', en: 'Supplier shortage', ar: 'نقص مورد' },
    { code: 'data_entry_error', en: 'Data entry error', ar: 'خطأ إدخال' },
  ]

  const [requestOpen, setRequestOpen] = useState(false)
  const [reqWh, setReqWh] = useState('')
  const [reqLoc, setReqLoc] = useState('')
  const [reqCat, setReqCat] = useState('')
  const [reqUser, setReqUser] = useState('')
  const [reqDate, setReqDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reqZero, setReqZero] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(null)
  const [quickTerm, setQuickTerm] = useState('')

  const pageSize = 50

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
    staleTime: 10 * 60 * 1000,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations-internal', warehouseId],
    queryFn: () =>
      api
        .get('/stock/locations', {
          params: { usage: 'internal', warehouseId: warehouseId || undefined },
        })
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: reqLocations = [] } = useQuery({
    queryKey: ['stock-locations-internal', reqWh],
    queryFn: () =>
      api
        .get('/stock/locations', {
          params: { usage: 'internal', warehouseId: reqWh || undefined },
        })
        .then((r) => r.data),
    enabled: requestOpen,
    staleTime: 5 * 60 * 1000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api.get('/stock/product-categories').then((r) => asInvList(r.data)),
    staleTime: 10 * 60 * 1000,
  })

  const { data: usersPayload } = useQuery({
    queryKey: ['users-lite'],
    queryFn: () => api.get('/users', { params: { limit: 200 } }).then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  })
  const users = usersPayload?.users || []

  const { data: payload, isLoading } = useQuery({
    queryKey: ['physical-inventory', warehouseId, locationId, filter, search, page],
    queryFn: () =>
      api
        .get('/stock/physical-inventory', {
          params: {
            warehouseId: warehouseId || undefined,
            locationId: locationId || undefined,
            filter: filter || undefined,
            search: search || undefined,
            page,
            limit: pageSize,
          },
        })
        .then((r) => r.data),
  })

  const list = useMemo(() => {
    if (Array.isArray(payload)) return payload
    return Array.isArray(payload?.data) ? payload.data : []
  }, [payload])
  const meta = payload?._meta || { total: list.length, page: 1, pageSize }
  const totals = meta.totals || {}
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.pageSize || pageSize)))

  const { data: historyPayload, isLoading: historyLoading } = useQuery({
    queryKey: ['physical-inventory-history', historyOpen?.productId, historyOpen?.locationId],
    queryFn: () =>
      api
        .get('/stock/physical-inventory/history', {
          params: {
            productId: historyOpen.productId,
            locationId: historyOpen.locationId,
            limit: 40,
          },
        })
        .then((r) => r.data?.items || []),
    enabled: Boolean(historyOpen?.productId && historyOpen?.locationId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['physical-inventory'] })
    qc.invalidateQueries({ queryKey: ['stock-report'], refetchType: 'active' })
  }

  const setCount = useMutation({
    mutationFn: (body) => api.post('/stock/physical-inventory/set', body),
    onSuccess: () => {
      setDirty(false)
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const clear = useMutation({
    mutationFn: (quantId) => api.post('/stock/physical-inventory/clear', { quantId }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const apply = useMutation({
    mutationFn: (body) => api.post('/stock/physical-inventory/apply', body),
    onSuccess: (res) => {
      const { applied = 0, failed = 0, needsApproval = 0 } = res.data || {}
      toast.success(
        ar
          ? `تم تطبيق ${applied}${failed ? `، فشل ${failed}` : ''}${needsApproval ? ` (يحتاج اعتماد: ${needsApproval})` : ''}`
          : `${applied} applied${failed ? `, ${failed} failed` : ''}${needsApproval ? ` (${needsApproval} need approval)` : ''}`,
      )
      setApplyOpen(false)
      setSelected(new Set())
      setApplyPreview(null)
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const approveVariance = useMutation({
    mutationFn: (ids) => api.post('/stock/physical-inventory/approve-variance', { ids }),
    onSuccess: (res) => {
      toast.success(ar ? `تم اعتماد ${res.data?.approved || 0}` : `Approved ${res.data?.approved || 0}`)
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const { data: invSettings } = useQuery({
    queryKey: ['inv-settings-pi'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (invSettings?.blindCountMode != null) setBlindMode(!!invSettings.blindCountMode)
  }, [invSettings?.blindCountMode])

  const requestCountMut = useMutation({
    mutationFn: (body) => api.post('/stock/physical-inventory/request-count', body),
    onSuccess: (res) => {
      const d = res.data || {}
      toast.success(
        ar
          ? `جدولة ${d.modified || 0} + ${d.zeroCreated || 0} صفوف صفر`
          : `Scheduled ${d.modified || 0}; created ${d.zeroCreated || 0} zero lines`,
      )
      setRequestOpen(false)
      setFilter('toCount')
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const groupedList = useMemo(() => {
    if (!groupBy) return [{ key: '', label: null, rows: list }]
    const map = new Map()
    for (const row of list) {
      let key = '—'
      let label = '—'
      if (groupBy === 'location') {
        key = String(row.locationId?._id || row.locationId || '—')
        label = row.locationId?.completePath || row.locationId?.name || '—'
      } else if (groupBy === 'product') {
        key = `${row.productId?._id || row.productId}:${row.variantId?._id || row.variantId || ''}`
        label = productLabel(row, ar)
      } else if (groupBy === 'category') {
        key = String(row.productId?.categoryId || row.productId?.category || '—')
        label = row.productId?.category || '—'
      }
      if (!map.has(key)) map.set(key, { key, label, rows: [] })
      map.get(key).rows.push(row)
    }
    return [...map.values()]
  }, [list, groupBy, ar])

  const whList = Array.isArray(warehouses) ? warehouses : []
  const locList = asInvList(locations)
  const reqLocList = asInvList(reqLocations)
  const catList = Array.isArray(categories) ? categories : []
  const effectiveLocationId = locationId || locList[0]?._id || ''

  const selectableIds = useMemo(
    () => list.filter((r) => r.isCountSet && !r.isStale).map((r) => r._id),
    [list],
  )
  const allFilteredSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const someFilteredSelected = selectableIds.some((id) => selected.has(id))

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleMaster = () => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev)
        selectableIds.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      selectableIds.forEach((id) => next.add(id))
      return next
    })
  }

  const openApply = async (ids) => {
    if (!ids.length) return
    try {
      const res = await api.post('/stock/physical-inventory/apply-preview', { ids })
      setApplyPreview(res.data)
      setApplyIds(ids)
      setApplyOpen(true)
    } catch (e) {
      toast.error(formatInvError(e, language))
    }
  }

  const addOrIncrement = useCallback(async ({ productId, variantId, name }) => {
    if (!effectiveLocationId) {
      toast.error(ar ? 'اختر موقعاً داخلياً أولاً' : 'Select an internal location first')
      return
    }
    const existing = list.find((r) => {
      const pid = String(r.productId?._id || r.productId || '')
      const vid = String(r.variantId?._id || r.variantId || '')
      const lid = String(r.locationId?._id || r.locationId || '')
      return pid === String(productId)
        && lid === String(effectiveLocationId)
        && vid === String(variantId || '')
    })

    let countedQty = '1'
    if (existing) {
      const current = edits[existing._id] ?? existing.countedQuantity ?? existing.quantity ?? 0
      countedQty = String(Number(current || 0) + 1)
    }

    setCount.mutate(
      {
        quantId: existing?._id,
        productId,
        variantId: variantId || undefined,
        locationId: effectiveLocationId,
        countedQty,
      },
      {
        onSuccess: () => {
          toast.success(
            existing
              ? (ar ? `+1 → ${countedQty}` : `+1 → ${countedQty}`)
              : (ar ? `أُضيف ${name || 'البند'}` : `Added ${name || 'line'}`),
          )
          if (existing) {
            setEdits((m) => ({ ...m, [existing._id]: countedQty }))
          }
        },
      },
    )
  }, [effectiveLocationId, list, edits, setCount, ar])

  const onQuickPick = async (_id, opt) => {
    if (!opt) return
    const productId = opt.productId || (opt.kind === 'product' ? opt._id : null)
    const variantId = opt.variantId || null
    if (!productId) return
    if (opt.productHasVariants && !variantId) {
      toast.error(ar ? 'اختر متغيراً محدداً' : 'Select a specific variant')
      return
    }
    await addOrIncrement({
      productId,
      variantId,
      name: opt.name || opt.variantName || opt.productName,
    })
    setQuickTerm('')
  }

  const scanBarcode = async (raw) => {
    const q = String(raw || '').trim()
    if (!q) return
    try {
      const variants = await api.get('/stock/variants', { params: { q, limit: 8 } }).then((r) => r.data?.items || r.data || [])
      const hit = (Array.isArray(variants) ? variants : []).find(
        (v) => String(v.barcode || '') === q || String(v.sku || '') === q,
      )
      if (hit) {
        const productId = typeof hit.productId === 'object' ? hit.productId?._id : hit.productId
        await addOrIncrement({
          productId,
          variantId: hit._id,
          name: hit.name,
        })
        setQuickTerm('')
        return
      }
      const product = await api.get('/products/lookup', { params: { barcode: q } }).then((r) => r.data).catch(async () => {
        return api.get('/products/lookup', { params: { sku: q } }).then((r) => r.data)
      })
      if (!product?._id) {
        toast.error(ar ? 'غير موجود' : 'Not found')
        return
      }
      // Prefer a single default variant when present
      const vData = await api.get('/stock/variants', { params: { productId: product._id, limit: 5 } })
        .then((r) => r.data)
        .catch(() => null)
      const items = Array.isArray(vData) ? vData : (vData?.items || [])
      if (items.length === 1) {
        await addOrIncrement({ productId: product._id, variantId: items[0]._id, name: items[0].name || product.nameEn })
      } else if (items.length > 1) {
        toast.error(ar ? 'اختر المتغير من البحث' : 'Pick a specific variant from search')
      } else {
        await addOrIncrement({ productId: product._id, variantId: null, name: product.nameEn || product.name })
      }
      setQuickTerm('')
    } catch {
      toast.error(ar ? 'غير موجود' : 'Not found')
    }
  }

  const persistRow = (row, patch = {}) => {
    const counted = edits[row._id] ?? row.countedQuantity
    setCount.mutate({
      quantId: row._id,
      productId: row.productId?._id || row.productId,
      variantId: row.variantId?._id || row.variantId || undefined,
      locationId: row.locationId?._id || row.locationId,
      countedQty: counted === '' || counted == null ? undefined : counted,
      ...patch,
    })
  }

  const discardLocal = () => {
    setEdits({})
    setDirty(false)
    qc.invalidateQueries({ queryKey: ['physical-inventory'] })
  }

  const exportAllFields = async () => {
    try {
      const res = await api.get('/stock/physical-inventory', {
        params: {
          warehouseId: warehouseId || undefined,
          locationId: locationId || undefined,
          filter: filter || undefined,
          search: search || undefined,
          page: 1,
          limit: 500,
        },
      }).then((r) => r.data)
      const rows = Array.isArray(res) ? res : (res?.data || [])
      const headers = [
        'Location', 'Product Name', 'Variant Name', 'SKU', 'Lot/Serial',
        'On Hand', 'Counted', 'Difference', 'User',
      ]
      const mapped = rows.map((row) => {
        const counted = edits[row._id] ?? row.countedQuantity ?? ''
        const liveDiff = counted !== '' && counted != null
          ? (Number(counted || 0) - Number(row.quantity || 0)).toFixed(2)
          : (row.isCountSet ? row.countDifference : '')
        const template = ar && row.productId?.nameAr ? row.productId.nameAr : (row.productId?.nameEn || '')
        const variantName = row.variantId?.name || row.variantId?.nameAr || ''
        return {
          Location: row.locationId?.completePath || row.locationId?.name || '',
          'Product Name': template,
          'Variant Name': variantName,
          SKU: rowSku(row),
          'Lot/Serial': row.lotId?.name || '',
          'On Hand': row.quantity ?? '',
          Counted: counted,
          Difference: liveDiff,
          User: row.countUserId?.name || row.countUserId?.email || '',
        }
      })
      downloadCsv(`physical-inventory-${fmtDate(new Date()) || 'export'}.csv`, headers, mapped)
      toast.success(ar ? `تم تصدير ${mapped.length} سطراً` : `Exported ${mapped.length} rows`)
    } catch (e) {
      toast.error(formatInvError(e, language))
    }
  }

  const fetchOptions = useCallback(
    (q) => searchProductsAndVariants(q, { variantsEnabled: true, limit: 25 }),
    [],
  )

  const chips = [
    { id: '', en: 'All', ar: 'الكل' },
    { id: 'toCount', en: 'To count', ar: 'للعد' },
    { id: 'toApply', en: 'To apply', ar: 'للتطبيق' },
    { id: 'negative', en: 'Negative', ar: 'سالب' },
    { id: 'scheduledMonth', en: 'Scheduled this month', ar: 'مجدول هذا الشهر' },
  ]

  const from = meta.total ? (page - 1) * (meta.pageSize || pageSize) + 1 : 0
  const to = Math.min(page * (meta.pageSize || pageSize), meta.total || 0)
  const showOnHand = !blindMode && visibleCols.onHand
  const showDiff = !blindMode && visibleCols.diff

  return (
    <div
      className="flex h-[calc(100vh-8.25rem)] max-h-[calc(100vh-8.25rem)] flex-col gap-2 overflow-hidden"
      dir={ar ? 'rtl' : 'ltr'}
    >
      {/* Header — frozen */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'الجرد الفعلي' : 'Physical Inventory'}
          </h2>
          <p className="text-xs text-slate-500">
            {ar ? 'عدّ المخزون وطابق الأرصدة' : 'Count stock and reconcile on-hand'}
            {blindMode ? (ar ? ' · عد أعمى' : ' · Blind count') : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn btn-secondary btn-sm" disabled={!dirty} onClick={discardLocal}>
            {ar ? 'تجاهل' : 'Discard'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!dirty || setCount.isPending}
            onClick={() => {
              Object.entries(edits).forEach(([id, countedQty]) => {
                if (countedQty === '' || countedQty == null) return
                const row = list.find((r) => String(r._id) === String(id))
                setCount.mutate({
                  quantId: id,
                  productId: row?.productId?._id || row?.productId,
                  variantId: row?.variantId?._id || row?.variantId || undefined,
                  countedQty,
                })
              })
            }}
          >
            {ar ? 'حفظ' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!list.some((r) => r.isCountSet)}
            onClick={() => openApply(list.filter((r) => r.isCountSet).map((r) => r._id))}
          >
            {ar ? 'تطبيق الكل' : 'Apply All'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={selected.size === 0}
            title={selected.size === 0 ? (ar ? 'حدد أسطراً أولاً' : 'Select rows first') : undefined}
            onClick={() => openApply([...selected])}
          >
            {ar ? `تطبيق المحدد (${selected.size})` : `Apply Selected (${selected.size})`}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${blindMode ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={blindMode}
            onClick={() => setBlindMode((v) => !v)}
          >
            {ar ? (blindMode ? 'عد أعمى: تشغيل' : 'عد أعمى') : (blindMode ? 'Blind: ON' : 'Blind count')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                const res = await api.post('/stock/print', {
                  layout: blindMode ? 'count_sheet_blind' : 'count_sheet_open',
                  lang: ar ? 'ar' : 'en',
                  filters: {
                    warehouseId: warehouseId || undefined,
                    locationId: locationId || undefined,
                    filter: filter || undefined,
                    search: search || undefined,
                  },
                }, { responseType: 'blob' })
                const url = URL.createObjectURL(res.data)
                const a = document.createElement('a')
                a.href = url
                a.download = 'count-sheet.pdf'
                a.click()
                URL.revokeObjectURL(url)
              } catch (e) {
                toast.error(formatInvError(e, language))
              }
            }}
          >
            {ar ? 'طباعة' : 'Print'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRequestOpen(true)}>
            {ar ? 'طلب جرد' : 'Request count'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportAllFields}>
            {ar ? 'تصدير' : 'Export'}
          </button>
          <InventoryIeButtons
            model="physical_inventory"
            ar={ar}
            filters={{
              warehouseId: warehouseId || undefined,
              locationId: locationId || undefined,
              filter: filter || undefined,
              search: search || undefined,
            }}
            onImported={() => {
              setFilter('toApply')
              invalidate()
            }}
          />
        </div>
      </div>

      {/* Compact KPIs — frozen */}
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: ar ? 'أسطر للعد' : 'Lines to count', value: totals.linesToCount ?? meta.total ?? 0 },
          { label: ar ? 'تم العد' : 'Lines counted', value: totals.linesCounted ?? 0 },
          { label: ar ? 'فرق +' : 'Positive Δ', value: totals.positiveDiff ?? '0', tone: 'text-emerald-700 dark:text-emerald-400' },
          { label: ar ? 'فرق −' : 'Negative Δ', value: totals.negativeDiff ?? '0', tone: 'text-rose-700 dark:text-rose-400' },
          { label: ar ? 'صافي القيمة' : 'Net value', value: totals.netValueImpact ?? '0' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-slate-200/70 bg-slate-50/90 px-2.5 py-1.5 dark:border-dark-600 dark:bg-dark-900/50"
          >
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{kpi.label}</div>
            <div className={`text-sm font-semibold tabular-nums tracking-tight ${kpi.tone || 'text-slate-800 dark:text-slate-100'}`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar + quick entry — frozen */}
      <div className="shrink-0 space-y-2 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-dark-600 dark:bg-dark-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            className="select select-sm"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value)
              setLocationId('')
              setPage(1)
            }}
          >
            <option value="">{ar ? 'كل المستودعات' : 'All warehouses'}</option>
            {whList.map((w) => (
              <option key={w._id} value={w._id}>{ar && w.nameAr ? w.nameAr : (w.nameEn || w.name)}</option>
            ))}
          </select>
          <select
            className="select select-sm"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setPage(1)
            }}
          >
            <option value="">{ar ? 'كل المواقع' : 'All locations'}</option>
            {locList.map((loc) => (
              <option key={loc._id} value={loc._id}>{loc.completePath || loc.name}</option>
            ))}
          </select>
          {chips.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setFilter(f.id)
                setPage(1)
              }}
            >
              {ar ? f.ar : f.en}
            </button>
          ))}
          <select
            className="select select-sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="">{ar ? 'بدون تجميع' : 'No grouping'}</option>
            <option value="location">{ar ? 'تجميع بالموقع' : 'By location'}</option>
            <option value="product">{ar ? 'تجميع بالمنتج' : 'By product'}</option>
            <option value="category">{ar ? 'تجميع بالفئة' : 'By category'}</option>
          </select>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setColOptsOpen((v) => !v)}>
            {ar ? 'أعمدة' : 'Columns'}
          </button>
          {selected.size > 0 && list.some((r) => selected.has(r._id) && r.varianceApprovalRequired && !r.varianceApprovedAt) && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={approveVariance.isPending}
              onClick={() => approveVariance.mutate([...selected])}
            >
              {ar ? 'اعتماد فروقات' : 'Approve variance'}
            </button>
          )}
          <div className="ms-auto flex items-center gap-1.5 text-xs text-slate-500">
            <span>{from}-{to} / {meta.total || 0}</span>
            <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>

        {colOptsOpen && (
          <div className="flex flex-wrap gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs dark:border-dark-600 dark:bg-dark-900/40">
            {Object.entries(visibleCols).map(([k, on]) => (
              <label key={k} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={(k === 'onHand' || k === 'diff') && blindMode}
                  onChange={(e) => setVisibleCols((c) => ({ ...c, [k]: e.target.checked }))}
                />
                {k}
              </label>
            ))}
          </div>
        )}

        {/* Unified barcode / variant search */}
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <AsyncCombobox
              value=""
              selectedOption={null}
              debounceMs={280}
              minChars={2}
              queryKeyPrefix="pi-variant-search"
              fetchOptions={fetchOptions}
              getOptionLabel={opsProductOptionLabel}
              getOptionSub={opsProductOptionSub}
              placeholder={ar ? 'امسح باركود أو ابحث عن متغير…' : 'Scan barcode or search variant…'}
              noResultsText={ar ? 'لا نتائج' : 'No results'}
              onChange={onQuickPick}
              className="w-full"
            />
          </div>
          <form
            className="flex shrink-0 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              scanBarcode(quickTerm)
            }}
          >
            <input
              ref={quickRef}
              className="input input-sm w-40 sm:w-48"
              value={quickTerm}
              onChange={(e) => setQuickTerm(e.target.value)}
              placeholder={ar ? 'باركود…' : 'Barcode…'}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-secondary btn-sm" title={ar ? 'مسح' : 'Scan'}>
              <ScanBarcode className="h-4 w-4" />
            </button>
          </form>
          <input
            className="input input-sm hidden max-w-[10rem] sm:block"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={ar ? 'تصفية الجدول…' : 'Filter table…'}
          />
        </div>
      </div>

      {/* Scrollable table only */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500 dark:border-dark-600 dark:bg-dark-900">
            <tr>
              <th className="w-10 px-3 py-2.5 text-start">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected
                  }}
                  onChange={toggleMaster}
                  aria-label={ar ? 'تحديد الكل' : 'Select all'}
                  disabled={selectableIds.length === 0}
                />
              </th>
              <th className="min-w-[140px] px-3 py-2.5 text-start">{ar ? 'الموقع' : 'Location'}</th>
              <th className="min-w-[200px] px-3 py-2.5 text-start">{ar ? 'المنتج / المتغير' : 'Product / Variant'}</th>
              {visibleCols.lot && <th className="min-w-[100px] px-3 py-2.5 text-start">{ar ? 'دفعة' : 'Lot/Serial'}</th>}
              {visibleCols.package && <th className="min-w-[100px] px-3 py-2.5 text-start">{ar ? 'عبوة' : 'Package'}</th>}
              {showOnHand && <th className="min-w-[90px] px-3 py-2.5 text-start">{ar ? 'المتاح' : 'On Hand'}</th>}
              {visibleCols.uom && <th className="min-w-[70px] px-3 py-2.5 text-start">{ar ? 'وحدة' : 'UoM'}</th>}
              <th className="min-w-[100px] px-3 py-2.5 text-start">{ar ? 'العد' : 'Counted'}</th>
              {showDiff && <th className="min-w-[90px] px-3 py-2.5 text-start">{ar ? 'الفرق' : 'Diff'}</th>}
              {visibleCols.scheduled && <th className="min-w-[110px] px-3 py-2.5 text-start">{ar ? 'مجدول' : 'Scheduled'}</th>}
              {visibleCols.user && <th className="min-w-[110px] px-3 py-2.5 text-start">{ar ? 'المستخدم' : 'User'}</th>}
              {visibleCols.lastCount && <th className="min-w-[100px] px-3 py-2.5 text-start">{ar ? 'آخر جرد' : 'Last count'}</th>}
              <th className="min-w-[110px] px-3 py-2.5 text-start">{ar ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={14} className="px-4 py-8 text-center text-slate-400">…</td></tr>
            )}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={14} className="p-8">
                  <EmptyState
                    title={ar ? 'لا أسطر جرد' : 'No count lines'}
                    description={
                      ar
                        ? 'امسح باركوداً أو ابحث عن متغير، أو استخدم «طلب جرد».'
                        : 'Scan a barcode, search a variant, or use Request count.'
                    }
                  />
                </td>
              </tr>
            )}
            {groupedList.map((group) => (
              <Fragment key={group.key || 'all'}>
                {group.label && (
                  <tr className="bg-slate-100/80 dark:bg-dark-900/60">
                    <td colSpan={14} className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {group.label}
                      <span className="ms-2 font-normal text-slate-400">
                        ({group.rows.length})
                        {showDiff && ` · Δ ${group.rows.reduce((s, r) => s + Number(r.countDifference || 0), 0).toFixed(2)}`}
                      </span>
                    </td>
                  </tr>
                )}
                {group.rows.map((row) => {
                  const counted = edits[row._id] ?? row.countedQuantity ?? ''
                  const liveDiff = counted !== '' && counted != null
                    ? (Number(counted || 0) - Number(row.quantity || 0)).toFixed(2)
                    : (row.isCountSet ? row.countDifference : '—')
                  const pid = row.productId?._id || row.productId
                  const lid = row.locationId?._id || row.locationId
                  const pname = productLabel(row, ar)
                  return (
                    <tr
                      key={row._id}
                      className={`border-b border-slate-50 dark:border-dark-700 ${row.isStale ? 'bg-amber-50/80 dark:bg-amber-950/20' : ''} ${row.varianceApprovalRequired && !row.varianceApprovedAt ? 'ring-1 ring-inset ring-amber-300' : ''}`}
                    >
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected.has(row._id)}
                          disabled={!row.isCountSet || row.isStale}
                          onChange={() => toggle(row._id)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-500">{row.locationId?.completePath || row.locationId?.name}</td>
                      <td className="px-3 py-1.5">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {pid ? (
                            <Link className="text-primary-700 hover:underline dark:text-primary-300" to={`/app/dashboard/inventory/products/${pid}`}>
                              {pname}
                            </Link>
                          ) : pname}
                        </div>
                        <div className="text-[11px] text-slate-400">{rowSku(row)}</div>
                        {row.isStale && (
                          <div className="text-[11px] font-medium text-amber-700">{ar ? 'رصيد تغيّر — أعد العد' : 'Stale — recount required'}</div>
                        )}
                        {row.varianceApprovalRequired && !row.varianceApprovedAt && (
                          <div className="text-[11px] font-medium text-amber-800">{ar ? 'يحتاج اعتماد فرق' : 'Needs variance approval'}</div>
                        )}
                      </td>
                      {visibleCols.lot && <td className="px-3 py-1.5 tabular-nums">{row.lotId?.name || '—'}</td>}
                      {visibleCols.package && <td className="px-3 py-1.5">{row.packageId?.name || '—'}</td>}
                      {showOnHand && <td className="px-3 py-1.5 tabular-nums">{row.quantity}</td>}
                      {visibleCols.uom && <td className="px-3 py-1.5 text-xs text-slate-500">{row.uom || row.productId?.unitOfMeasure || 'PCE'}</td>}
                      <td className="px-3 py-1.5">
                        <input
                          className="input input-sm w-24"
                          value={counted}
                          onChange={(e) => {
                            setEdits((m) => ({ ...m, [row._id]: e.target.value }))
                            setDirty(true)
                          }}
                          onBlur={() => {
                            if (edits[row._id] == null || edits[row._id] === '') return
                            persistRow(row)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                        />
                      </td>
                      {showDiff && (
                        <td className={`px-3 py-1.5 tabular-nums font-medium ${diffColor(liveDiff)}`}>
                          {liveDiff}
                        </td>
                      )}
                      {visibleCols.scheduled && (
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            className="input input-sm w-[9.5rem] text-xs"
                            value={fmtDate(row.countScheduledDate)}
                            onChange={(e) => persistRow(row, { countScheduledDate: e.target.value || null })}
                          />
                        </td>
                      )}
                      {visibleCols.user && (
                        <td className="px-3 py-1.5">
                          <select
                            className="select select-sm max-w-[9rem] text-xs"
                            value={row.countUserId?._id || row.countUserId || ''}
                            onChange={(e) => persistRow(row, { countUserId: e.target.value || null })}
                          >
                            <option value="">—</option>
                            {users.map((u) => (
                              <option key={u._id} value={u._id}>{u.name || u.email}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      {visibleCols.lastCount && <td className="px-3 py-1.5 text-xs text-slate-500">{fmtDate(row.lastCountDate) || '—'}</td>}
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="text-xs text-primary-600 hover:underline"
                            onClick={() => setHistoryOpen({ productId: pid, locationId: lid, label: pname })}
                          >
                            {ar ? 'سجل' : 'History'}
                          </button>
                          {row.isCountSet && (
                            <button type="button" className="text-xs text-emerald-600 hover:underline" onClick={() => openApply([row._id])}>
                              {ar ? 'تطبيق' : 'Apply'}
                            </button>
                          )}
                          {row.isCountSet && (
                            <button type="button" className="text-xs text-rose-500 hover:underline" onClick={() => clear.mutate(row._id)}>
                              {ar ? 'مسح' : 'Clear'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Apply confirm */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {ar ? 'تأكيد التطبيق' : 'Confirm apply'}
            </h3>
            <dl className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between"><dt>{ar ? 'الأسطر' : 'Lines'}</dt><dd className="tabular-nums">{applyPreview?.lines ?? applyIds.length}</dd></div>
              <div className="flex justify-between"><dt>{ar ? 'فرق موجب' : 'Positive diff'}</dt><dd className="tabular-nums text-emerald-600">{applyPreview?.positiveDiff}</dd></div>
              <div className="flex justify-between"><dt>{ar ? 'فرق سالب' : 'Negative diff'}</dt><dd className="tabular-nums text-rose-600">{applyPreview?.negativeDiff}</dd></div>
              <div className="flex justify-between"><dt>{ar ? 'أثر التقييم' : 'Valuation impact'}</dt><dd className="tabular-nums">{applyPreview?.valuationImpact}</dd></div>
            </dl>
            <label className="mt-4 block text-xs font-medium text-slate-500">{ar ? 'تاريخ المحاسبة' : 'Accounting date'}</label>
            <input type="date" className="input mt-1 w-full" value={accountingDate} onChange={(e) => setAccountingDate(e.target.value)} />
            <label className="mt-3 block text-xs font-medium text-slate-500">{ar ? 'سبب الفرق *' : 'Reason code *'}</label>
            <select className="select mt-1 w-full" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {REASON_CODES.map((c) => (
                <option key={c.code} value={c.code}>{ar ? c.ar : c.en}</option>
              ))}
            </select>
            <label className="mt-3 block text-xs font-medium text-slate-500">{ar ? 'ملاحظة' : 'Note'}</label>
            <input className="input mt-1 w-full" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setApplyOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={apply.isPending || !reasonCode}
                onClick={() => apply.mutate({ ids: applyIds, accountingDate, reason, reasonCode })}
              >
                {ar ? 'تطبيق' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {requestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {ar ? 'طلب جرد' : 'Request a Count'}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label text-xs">{ar ? 'المستودع' : 'Warehouse'}</label>
                <select
                  className="select w-full"
                  value={reqWh}
                  onChange={(e) => {
                    setReqWh(e.target.value)
                    setReqLoc('')
                  }}
                >
                  <option value="">—</option>
                  {whList.map((w) => (
                    <option key={w._id} value={w._id}>{ar && w.nameAr ? w.nameAr : (w.nameEn || w.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs">{ar ? 'الموقع' : 'Location'}</label>
                <select className="select w-full" value={reqLoc} onChange={(e) => setReqLoc(e.target.value)}>
                  <option value="">{ar ? 'كل المواقع الداخلية' : 'All internal locations'}</option>
                  {reqLocList.map((loc) => (
                    <option key={loc._id} value={loc._id}>{loc.completePath || loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs">{ar ? 'فئة المنتج' : 'Product category'}</label>
                <select className="select w-full" value={reqCat} onChange={(e) => setReqCat(e.target.value)}>
                  <option value="">—</option>
                  {catList.map((c) => (
                    <option key={c._id} value={c._id}>{c.completePath || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs">{ar ? 'المستخدم' : 'User'}</label>
                <select className="select w-full" value={reqUser} onChange={(e) => setReqUser(e.target.value)}>
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs">{ar ? 'تاريخ الجدولة' : 'Scheduled date'}</label>
                <input type="date" className="input w-full" value={reqDate} onChange={(e) => setReqDate(e.target.value)} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={reqZero} onChange={(e) => setReqZero(e.target.checked)} />
                  {ar ? 'أسطر كمية صفر' : 'Include zero-qty lines'}
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setRequestOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={(!reqWh && !reqLoc) || requestCountMut.isPending}
                onClick={() =>
                  requestCountMut.mutate({
                    warehouseId: reqWh || undefined,
                    locationId: reqLoc || undefined,
                    categoryId: reqCat || undefined,
                    scheduledDate: reqDate,
                    userId: reqUser || undefined,
                    includeZero: reqZero,
                  })
                }
              >
                {ar ? 'إنشاء' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {ar ? 'سجل التسوية' : 'Adjustment history'}
                </h3>
                <p className="text-sm text-slate-500">{historyOpen.label}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHistoryOpen(null)}>
                {ar ? 'إغلاق' : 'Close'}
              </button>
            </div>
            {historyLoading && <p className="mt-4 text-sm text-slate-400">…</p>}
            {!historyLoading && !(historyPayload || []).length && (
              <p className="mt-4 text-sm text-slate-400">{ar ? 'لا حركات بعد' : 'No adjustment moves yet'}</p>
            )}
            <ul className="mt-4 space-y-2">
              {(historyPayload || []).map((line) => (
                <li key={line._id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-dark-600">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{line.reference || line.moveId?.reference || '—'}</span>
                    <span className="tabular-nums">{line.quantity}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmtDate(line.moveId?.date || line.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

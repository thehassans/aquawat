import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScanBarcode, Search, X } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import { formatInvError } from '../../lib/invError'
import { isVariantPickCancelled, useForceVariantPick } from '../../lib/useForceVariantPick'
import {
  pageTitleClass,
  pageSubtitleClass,
  pageHeaderClass,
  statGridClass,
  statCardClass,
  statLabelClass,
  statValueClass,
  filterBarClass,
  listShellClass,
  salesThClass,
  salesTdClass,
  salesTrClass,
  primaryBtnClass,
  secondaryBtnClass,
  ghostActionClass,
  softChipClass,
  fieldControlClass,
  fieldLabelClass,
  chipFilterClass,
  sectionCardClass,
  sectionEyebrowClass,
  variantPillClass,
  monoCellClass,
  emptyStateClass,
  dangerActionClass,
} from '../planning/planningUi'

const compactFieldClass = `${fieldControlClass} !py-1.5 !px-2.5 !text-xs`

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

function playScanError() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 220
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    osc.onended = () => ctx.close()
  } catch {
    /* optional feedback */
  }
}

export default function PhysicalInventory() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const quickRef = useRef(null)
  const { resolvePick, forceVariantModal } = useForceVariantPick({ ar, variantsEnabled: true })

  const [filter, setFilter] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const [edits, setEdits] = useState({})
  const [dirty, setDirty] = useState(false)

  const [applyOpen, setApplyOpen] = useState(false)
  const [applyIds, setApplyIds] = useState([])
  const [applyPreview, setApplyPreview] = useState(null)
  const [clearConfirm, setClearConfirm] = useState(null) // { ids: string[], label: string }
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
    queryKey: ['physical-inventory', warehouseId, locationId, filter, page],
    queryFn: () =>
      api
        .get('/stock/physical-inventory', {
          params: {
            warehouseId: warehouseId || undefined,
            locationId: locationId || undefined,
            filter: filter || undefined,
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

  const filteredList = useMemo(() => {
    const needle = tableFilter.trim().toLowerCase()
    if (!needle) return list
    return list.filter((row) => {
      const name = productLabel(row, ar).toLowerCase()
      const sku = rowSku(row).toLowerCase()
      const loc = String(row.locationId?.completePath || row.locationId?.name || '').toLowerCase()
      return name.includes(needle) || sku.includes(needle) || loc.includes(needle)
    })
  }, [list, tableFilter, ar])

  const meta = payload?._meta || { total: list.length, page: 1, pageSize }
  const totals = meta.totals || {}
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.pageSize || pageSize)))

  const { data: historyPayload, isLoading: historyLoading } = useQuery({
    queryKey: ['physical-inventory-history', historyOpen?.productId, historyOpen?.locationId, historyOpen?.variantId],
    queryFn: () =>
      api
        .get('/stock/physical-inventory/history', {
          params: {
            productId: historyOpen.productId,
            locationId: historyOpen.locationId,
            variantId: historyOpen.variantId || undefined,
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
    mutationFn: (payload) => {
      if (Array.isArray(payload)) {
        return api.post('/stock/physical-inventory/clear', { ids: payload })
      }
      return api.post('/stock/physical-inventory/clear', { quantId: payload })
    },
    onSuccess: (_res, payload) => {
      const ids = Array.isArray(payload) ? payload : [payload]
      setEdits((m) => {
        const next = { ...m }
        for (const id of ids) next[id] = ''
        return next
      })
      setSelected((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
      setClearConfirm(null)
      invalidate()
      toast.success(ar ? 'تم مسح العد' : 'Counted quantities cleared')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  /** Reset counted to null/empty — never write 0 (that would wipe stock on apply). */
  const requestClearLines = useCallback((ids, { forceConfirm = false } = {}) => {
    const unique = [...new Set((ids || []).map(String).filter(Boolean))]
    if (!unique.length) return

    const run = () => {
      const serverIds = unique.filter((id) => {
        const row = list.find((r) => String(r._id) === String(id))
        return row?.isCountSet
      })
      // Always clear local edits to empty string (uncounted)
      setEdits((m) => {
        const next = { ...m }
        for (const id of unique) next[id] = ''
        return next
      })
      setDirty(true)
      if (serverIds.length) {
        clear.mutate(serverIds)
      } else {
        setSelected((prev) => {
          const next = new Set(prev)
          for (const id of unique) next.delete(id)
          return next
        })
        toast.success(ar ? 'تم مسح العد' : 'Counted quantities cleared')
      }
    }

    if (forceConfirm || unique.length > 5) {
      setClearConfirm({ ids: unique, count: unique.length })
      return
    }
    run()
  }, [list, clear, ar])

  const confirmClearLines = () => {
    if (!clearConfirm?.ids?.length) return
    const ids = clearConfirm.ids
    const serverIds = ids.filter((id) => list.find((r) => String(r._id) === String(id))?.isCountSet)
    setEdits((m) => {
      const next = { ...m }
      for (const id of ids) next[id] = ''
      return next
    })
    if (serverIds.length) clear.mutate(serverIds)
    else {
      setClearConfirm(null)
      setSelected(new Set())
      toast.success(ar ? 'تم مسح العد' : 'Counted quantities cleared')
    }
  }

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
    if (!groupBy) return [{ key: '', label: null, rows: filteredList }]
    const map = new Map()
    for (const row of filteredList) {
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
  }, [filteredList, groupBy, ar])

  const selectableIds = useMemo(
    () => filteredList.filter((r) => r.isCountSet && !r.isStale).map((r) => r._id),
    [filteredList],
  )

  const whList = Array.isArray(warehouses) ? warehouses : []
  const locList = asInvList(locations)
  const reqLocList = asInvList(reqLocations)
  const catList = Array.isArray(categories) ? categories : []
  const effectiveLocationId = locationId || locList[0]?._id || ''

  useEffect(() => {
    quickRef.current?.focus()
  }, [warehouseId, locationId])

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
          setQuickTerm('')
          quickRef.current?.focus()
        },
      },
    )
  }, [effectiveLocationId, list, edits, setCount, ar])

  const scanBarcode = async (raw) => {
    const q = String(raw || '').trim()
    if (!q) return
    try {
      const variants = await api.get('/stock/variants', { params: { q, limit: 8 } }).then((r) => r.data?.items || r.data || [])
      const variantList = Array.isArray(variants) ? variants : []
      const exactHits = variantList.filter(
        (v) => String(v.barcode || '') === q || String(v.sku || '') === q,
      )
      if (exactHits.length === 1) {
        const hit = exactHits[0]
        const productId = typeof hit.productId === 'object' ? hit.productId?._id : hit.productId
        await addOrIncrement({
          productId,
          variantId: hit._id,
          name: hit.name,
        })
        return
      }
      if (exactHits.length > 1) {
        const hit = exactHits[0]
        const productId = typeof hit.productId === 'object' ? hit.productId?._id : hit.productId
        const resolved = await resolvePick({
          kind: 'variant',
          productId,
          variantId: hit._id,
          variantName: hit.name,
          productName: typeof hit.productId === 'object' ? (hit.productId?.nameEn || hit.productId?.name) : undefined,
          name: hit.name,
          sku: hit.sku,
        })
        await addOrIncrement({
          productId: resolved.productId,
          variantId: resolved.variantId,
          name: resolved.variantName || resolved.productName || hit.name,
        })
        return
      }
      const product = await api.get('/products/lookup', { params: { barcode: q } }).then((r) => r.data).catch(async () => {
        return api.get('/products/lookup', { params: { sku: q } }).then((r) => r.data)
      })
      if (!product?._id) {
        playScanError()
        toast.error(ar ? 'غير موجود' : 'Not found')
        setQuickTerm('')
        quickRef.current?.focus()
        return
      }
      const resolved = await resolvePick({
        kind: 'product',
        productId: product._id,
        productName: product.nameEn || product.name,
        name: product.nameEn || product.name,
        sku: product.sku,
      })
      await addOrIncrement({
        productId: resolved.productId,
        variantId: resolved.variantId,
        name: resolved.variantName || resolved.productName || product.nameEn,
      })
      setQuickTerm('')
      quickRef.current?.focus()
    } catch (e) {
      if (isVariantPickCancelled(e)) return
      playScanError()
      toast.error(ar ? 'غير موجود' : 'Not found')
      setQuickTerm('')
      quickRef.current?.focus()
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
      className="flex h-[calc(100vh-8.25rem)] max-h-[calc(100vh-8.25rem)] flex-col gap-2 overflow-hidden pb-2"
      dir={ar ? 'rtl' : 'ltr'}
    >
      {forceVariantModal}

      <div className={`${pageHeaderClass} shrink-0`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={pageTitleClass}>{ar ? 'الجرد الفعلي' : 'Physical Inventory'}</h1>
            {blindMode && (
              <span className={softChipClass}>{ar ? 'عد أعمى' : 'Blind count'}</span>
            )}
          </div>
          <p className={pageSubtitleClass}>
            {ar ? 'عدّ المخزون وطابق الأرصدة مع المخزون الفعلي' : 'Count stock and reconcile on-hand quantities'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {dirty && (
            <>
              <button type="button" className={ghostActionClass} disabled={!dirty} onClick={discardLocal}>
                {ar ? 'تجاهل' : 'Discard'}
              </button>
              <button
                type="button"
                className={secondaryBtnClass}
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
            </>
          )}
          <button
            type="button"
            className={primaryBtnClass}
            disabled={!list.some((r) => r.isCountSet)}
            onClick={() => openApply(list.filter((r) => r.isCountSet).map((r) => r._id))}
          >
            {ar ? 'تطبيق الكل' : 'Apply all'}
          </button>
        </div>
      </div>

      <div className={`${statGridClass} shrink-0`}>
        {[
          { label: ar ? 'للعد' : 'To count', value: totals.linesToCount ?? meta.total ?? 0 },
          { label: ar ? 'تم العد' : 'Counted', value: totals.linesCounted ?? 0 },
          { label: ar ? 'فرق +' : 'Positive Δ', value: totals.positiveDiff ?? '0', tone: 'text-teal-700 dark:text-teal-300' },
          { label: ar ? 'فرق −' : 'Negative Δ', value: totals.negativeDiff ?? '0', tone: 'text-red-600 dark:text-red-400' },
          { label: ar ? 'صافي القيمة' : 'Net value', value: totals.netValueImpact ?? '0' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${statCardClass} !py-2`}>
            <p className={statLabelClass}>{kpi.label}</p>
            <p className={`${statValueClass} !mt-1 !text-lg ${kpi.tone || ''}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className={`${filterBarClass} shrink-0 !space-y-2 !p-3`}>
        <div className="flex w-full flex-row gap-4">
          <div className="min-w-0 flex-1">
            <label className={fieldLabelClass}>{ar ? 'المستودع' : 'Warehouse'}</label>
            <select
              className={fieldControlClass}
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
          </div>
          <div className="min-w-0 flex-1">
            <label className={fieldLabelClass}>{ar ? 'الموقع' : 'Location'}</label>
            <select
              className={fieldControlClass}
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chips.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              className={chipFilterClass(filter === f.id)}
              onClick={() => {
                setFilter(f.id)
                setPage(1)
              }}
            >
              {ar ? f.ar : f.en}
            </button>
          ))}
          <select
            className={`${compactFieldClass} w-auto min-w-[9rem]`}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            aria-label={ar ? 'تجميع' : 'Group by'}
          >
            <option value="">{ar ? 'بدون تجميع' : 'No grouping'}</option>
            <option value="location">{ar ? 'بالموقع' : 'By location'}</option>
            <option value="product">{ar ? 'بالمنتج' : 'By product'}</option>
            <option value="category">{ar ? 'بالفئة' : 'By category'}</option>
          </select>
          <button type="button" className={ghostActionClass} onClick={() => setColOptsOpen((v) => !v)}>
            {ar ? 'أعمدة' : 'Columns'}
          </button>
          <button
            type="button"
            className={chipFilterClass(blindMode)}
            aria-pressed={blindMode}
            onClick={() => setBlindMode((v) => !v)}
          >
            {ar ? 'عد أعمى' : 'Blind count'}
          </button>
        </div>

        {colOptsOpen && (
          <div className="flex flex-wrap gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs dark:border-dark-600 dark:bg-dark-900/40">
            {Object.entries(visibleCols).map(([k, on]) => (
              <label key={k} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={on}
                  disabled={(k === 'onHand' || k === 'diff') && blindMode}
                  onChange={(e) => setVisibleCols((c) => ({ ...c, [k]: e.target.checked }))}
                />
                {k}
              </label>
            ))}
          </div>
        )}

        <div className="flex w-full flex-row gap-4">
          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault()
              scanBarcode(quickTerm)
            }}
          >
            <label className={`${fieldLabelClass} inline-flex items-center gap-1.5`}>
              <ScanBarcode className="h-3.5 w-3.5" />
              {ar ? 'مسح / إضافة' : 'Scan to count'}
            </label>
            <div className="relative">
              <input
                ref={quickRef}
                className={fieldControlClass}
                value={quickTerm}
                onChange={(e) => setQuickTerm(e.target.value)}
                placeholder={ar ? 'باركود أو SKU — Enter' : 'Barcode or SKU — Enter'}
                autoComplete="off"
                autoFocus
              />
            </div>
          </form>
          <div className="min-w-0 flex-1 sm:max-w-sm">
            <label className={`${fieldLabelClass} inline-flex items-center gap-1.5`}>
              <Search className="h-3.5 w-3.5" />
              {ar ? 'تصفية الجدول' : 'Filter table'}
            </label>
            <div className="relative">
              <input
                className={fieldControlClass}
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder={ar ? 'اسم · SKU · موقع' : 'Name · SKU · location'}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-dark-700">
          <div className="flex flex-wrap gap-2">
            {selected.size > 0 && (
              <>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={selected.size === 0}
                  onClick={() => openApply([...selected])}
                >
                  {ar ? `تطبيق (${selected.size})` : `Apply (${selected.size})`}
                </button>
                <button
                  type="button"
                  className={ghostActionClass}
                  disabled={selected.size === 0 || clear.isPending}
                  onClick={() => requestClearLines([...selected])}
                >
                  {ar ? `مسح (${selected.size})` : `Clear (${selected.size})`}
                </button>
                {list.some((r) => selected.has(r._id) && r.varianceApprovalRequired && !r.varianceApprovedAt) && (
                  <button
                    type="button"
                    className={ghostActionClass}
                    disabled={approveVariance.isPending}
                    onClick={() => approveVariance.mutate([...selected])}
                  >
                    {ar ? 'اعتماد الفروقات' : 'Approve variance'}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className={ghostActionClass}
              disabled={!list.some((r) => r.isCountSet || (edits[r._id] != null && edits[r._id] !== ''))}
              onClick={() => {
                const ids = list
                  .filter((r) => r.isCountSet || (edits[r._id] != null && edits[r._id] !== ''))
                  .map((r) => r._id)
                requestClearLines(ids, { forceConfirm: ids.length > 5 })
              }}
            >
              {ar ? 'مسح الكل' : 'Clear all'}
            </button>
            <button type="button" className={ghostActionClass} onClick={() => setRequestOpen(true)}>
              {ar ? 'طلب جرد' : 'Request count'}
            </button>
            <button
              type="button"
              className={ghostActionClass}
              onClick={async () => {
                try {
                  const res = await api.post('/stock/print', {
                    layout: blindMode ? 'count_sheet_blind' : 'count_sheet_open',
                    lang: ar ? 'ar' : 'en',
                    filters: {
                      warehouseId: warehouseId || undefined,
                      locationId: locationId || undefined,
                      filter: filter || undefined,
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
            <button type="button" className={ghostActionClass} onClick={exportAllFields}>
              {ar ? 'تصدير' : 'Export'}
            </button>
            <InventoryIeButtons
              model="physical_inventory"
              ar={ar}
              hideExport
              filters={{
                warehouseId: warehouseId || undefined,
                locationId: locationId || undefined,
                filter: filter || undefined,
              }}
              onImported={() => {
                setFilter('toApply')
                invalidate()
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{from}–{to} / {meta.total || 0}</span>
            <button type="button" className={ghostActionClass} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <button type="button" className={ghostActionClass} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className={`${softChipClass} shrink-0 w-fit`}>
          {ar ? `${selected.size} محدد` : `${selected.size} selected`}
        </div>
      )}

      <div className={`${listShellClass} min-h-0 w-full flex-1 overflow-auto`}>
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${salesThClass} w-10`}>
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected
                  }}
                  onChange={toggleMaster}
                  aria-label={ar ? 'تحديد الكل' : 'Select all'}
                  disabled={selectableIds.length === 0}
                />
              </th>
              <th className={`${salesThClass} w-[14%]`}>{ar ? 'الموقع' : 'Location'}</th>
              <th className={salesThClass}>{ar ? 'المنتج' : 'Product / Variant'}</th>
              {visibleCols.lot && <th className={`${salesThClass} w-[8%]`}>{ar ? 'دفعة' : 'Lot'}</th>}
              {visibleCols.package && <th className={`${salesThClass} w-[8%]`}>{ar ? 'عبوة' : 'Pkg'}</th>}
              {showOnHand && <th className={`${salesThClass} w-[7%]`}>{ar ? 'المتاح' : 'On hand'}</th>}
              {visibleCols.uom && <th className={`${salesThClass} w-[6%]`}>{ar ? 'وحدة' : 'UoM'}</th>}
              <th className={`${salesThClass} w-[8%]`}>{ar ? 'العد' : 'Counted'}</th>
              {showDiff && <th className={`${salesThClass} w-[7%]`}>{ar ? 'الفرق' : 'Diff'}</th>}
              {visibleCols.scheduled && <th className={`${salesThClass} w-[9%]`}>{ar ? 'مجدول' : 'Sched.'}</th>}
              {visibleCols.user && <th className={`${salesThClass} w-[9%]`}>{ar ? 'المستخدم' : 'User'}</th>}
              {visibleCols.lastCount && <th className={`${salesThClass} w-[8%]`}>{ar ? 'آخر جرد' : 'Last'}</th>}
              <th className={`${salesThClass} w-[10%]`}>{ar ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={14} className={emptyStateClass}>…</td></tr>
            )}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={14} className="p-8">
                  <EmptyState
                    title={ar ? 'لا أسطر جرد' : 'No count lines'}
                    description={ar ? 'امسح باركوداً أو استخدم «طلب جرد».' : 'Scan a barcode or use Request count.'}
                  />
                </td>
              </tr>
            )}
            {!isLoading && list.length > 0 && filteredList.length === 0 && (
              <tr>
                <td colSpan={14} className={emptyStateClass}>
                  {ar ? 'لا نتائج تطابق التصفية' : 'No rows match the filter'}
                </td>
              </tr>
            )}
            {groupedList.map((group) => (
              <Fragment key={group.key || 'all'}>
                {group.label && (
                  <tr className="bg-slate-50/90 dark:bg-dark-900/60">
                    <td colSpan={14} className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
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
                  const vid = row.variantId?._id || row.variantId
                  const pname = productLabel(row, ar)
                  const variantOnly = row.variantId?.name || row.variantId?.nameAr
                  return (
                    <tr
                      key={row._id}
                      className={`${salesTrClass} ${row.isStale ? 'bg-amber-50/60 dark:bg-amber-950/15' : ''} ${row.varianceApprovalRequired && !row.varianceApprovedAt ? 'ring-1 ring-inset ring-amber-200 dark:ring-amber-800' : ''}`}
                    >
                      <td className={salesTdClass}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={selected.has(row._id)}
                          disabled={!row.isCountSet || row.isStale}
                          onChange={() => toggle(row._id)}
                        />
                      </td>
                      <td className={`${salesTdClass} truncate text-xs text-slate-500`} title={row.locationId?.completePath || row.locationId?.name}>
                        {row.locationId?.completePath || row.locationId?.name}
                      </td>
                      <td className={`${salesTdClass} max-w-0`}>
                        <div className="truncate font-medium text-slate-900 dark:text-white" title={pname}>
                          {pid ? (
                            <Link className="truncate hover:text-teal-700 dark:hover:text-teal-300" to={`/app/dashboard/inventory/products/${pid}`}>
                              {pname}
                            </Link>
                          ) : pname}
                        </div>
                        {variantOnly && !pname.includes('—') && (
                          <p className={`${variantPillClass} truncate`} title={variantOnly}>{variantOnly}</p>
                        )}
                        <p className={`${monoCellClass} truncate`} title={rowSku(row)}>{rowSku(row)}</p>
                        {row.isStale && (
                          <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">{ar ? 'رصيد تغيّر — أعد العد' : 'Stale — recount'}</p>
                        )}
                        {row.varianceApprovalRequired && !row.varianceApprovedAt && (
                          <p className="mt-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">{ar ? 'يحتاج اعتماد' : 'Needs approval'}</p>
                        )}
                      </td>
                      {visibleCols.lot && <td className={`${salesTdClass} ${monoCellClass}`}>{row.lotId?.name || '—'}</td>}
                      {visibleCols.package && <td className={salesTdClass}>{row.packageId?.name || '—'}</td>}
                      {showOnHand && <td className={`${salesTdClass} ${monoCellClass}`}>{row.quantity}</td>}
                      {visibleCols.uom && <td className={`${salesTdClass} text-xs text-slate-500`}>{row.uom || row.productId?.unitOfMeasure || 'PCE'}</td>}
                      <td className={salesTdClass}>
                        <input
                          className={`${compactFieldClass} w-24`}
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
                        <td className={`${salesTdClass} font-semibold tabular-nums ${diffColor(liveDiff)}`}>
                          {liveDiff}
                        </td>
                      )}
                      {visibleCols.scheduled && (
                        <td className={salesTdClass}>
                          <input
                            type="date"
                            className={`${compactFieldClass} w-[9.5rem]`}
                            value={fmtDate(row.countScheduledDate)}
                            onChange={(e) => persistRow(row, { countScheduledDate: e.target.value || null })}
                          />
                        </td>
                      )}
                      {visibleCols.user && (
                        <td className={salesTdClass}>
                          <select
                            className={`${compactFieldClass} max-w-[9rem]`}
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
                      {visibleCols.lastCount && <td className={`${salesTdClass} text-xs text-slate-500`}>{fmtDate(row.lastCountDate) || '—'}</td>}
                      <td className={salesTdClass}>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            onClick={() => setHistoryOpen({ productId: pid, locationId: lid, variantId: vid || undefined, label: pname })}
                          >
                            {ar ? 'سجل' : 'History'}
                          </button>
                          {row.isCountSet && (
                            <button type="button" className="text-xs font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-300" onClick={() => openApply([row._id])}>
                              {ar ? 'تطبيق' : 'Apply'}
                            </button>
                          )}
                          {(row.isCountSet || (edits[row._id] != null && edits[row._id] !== '')) && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                              title={ar ? 'مسح العد' : 'Clear count'}
                              onClick={() => requestClearLines([row._id])}
                            >
                              <X className="h-3 w-3" />
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

      {/* Clear counted confirm */}
      {clearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className={`${sectionCardClass} w-full max-w-md`}>
            <p className={sectionEyebrowClass}>{ar ? 'تأكيد' : 'Confirm'}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {ar ? 'مسح الكميات المعدودة؟' : 'Clear counted quantities?'}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {ar
                ? `${clearConfirm.count} سطر — لن يُصفَّر المخزون الفعلي.`
                : `${clearConfirm.count} line(s) — physical stock is not zeroed.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={ghostActionClass} onClick={() => setClearConfirm(null)}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="button" className={dangerActionClass} disabled={clear.isPending} onClick={confirmClearLines}>
                {ar ? 'مسح' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className={`${sectionCardClass} w-full max-w-md`}>
            <p className={sectionEyebrowClass}>{ar ? 'تطبيق' : 'Apply'}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {ar ? 'تأكيد التطبيق' : 'Confirm apply'}
            </h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>{ar ? 'الأسطر' : 'Lines'}</dt>
                <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{applyPreview?.lines ?? applyIds.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600 dark:text-slate-300">{ar ? 'فرق +' : 'Positive'}</dt>
                <dd className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">{applyPreview?.positiveDiff}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600 dark:text-slate-300">{ar ? 'فرق −' : 'Negative'}</dt>
                <dd className="font-semibold tabular-nums text-red-600 dark:text-red-400">{applyPreview?.negativeDiff}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600 dark:text-slate-300">{ar ? 'أثر التقييم' : 'Valuation'}</dt>
                <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{applyPreview?.valuationImpact}</dd>
              </div>
            </dl>
            <label className={`${fieldLabelClass} mt-4`}>{ar ? 'تاريخ المحاسبة' : 'Accounting date'}</label>
            <input type="date" className={fieldControlClass} value={accountingDate} onChange={(e) => setAccountingDate(e.target.value)} />
            <label className={`${fieldLabelClass} mt-3`}>{ar ? 'سبب الفرق' : 'Reason code'}</label>
            <select className={fieldControlClass} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {REASON_CODES.map((c) => (
                <option key={c.code} value={c.code}>{ar ? c.ar : c.en}</option>
              ))}
            </select>
            <label className={`${fieldLabelClass} mt-3`}>{ar ? 'ملاحظة' : 'Note'}</label>
            <input className={fieldControlClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={ghostActionClass} onClick={() => setApplyOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="button"
                className={primaryBtnClass}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className={`${sectionCardClass} w-full max-w-lg`}>
            <p className={sectionEyebrowClass}>{ar ? 'جدولة' : 'Schedule'}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {ar ? 'طلب جرد' : 'Request a count'}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={fieldLabelClass}>{ar ? 'المستودع' : 'Warehouse'}</label>
                <select
                  className={fieldControlClass}
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
                <label className={fieldLabelClass}>{ar ? 'الموقع' : 'Location'}</label>
                <select className={fieldControlClass} value={reqLoc} onChange={(e) => setReqLoc(e.target.value)}>
                  <option value="">{ar ? 'كل المواقع' : 'All internal'}</option>
                  {reqLocList.map((loc) => (
                    <option key={loc._id} value={loc._id}>{loc.completePath || loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>{ar ? 'الفئة' : 'Category'}</label>
                <select className={fieldControlClass} value={reqCat} onChange={(e) => setReqCat(e.target.value)}>
                  <option value="">—</option>
                  {catList.map((c) => (
                    <option key={c._id} value={c._id}>{c.completePath || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>{ar ? 'المستخدم' : 'User'}</label>
                <select className={fieldControlClass} value={reqUser} onChange={(e) => setReqUser(e.target.value)}>
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>{ar ? 'التاريخ' : 'Scheduled date'}</label>
                <input type="date" className={fieldControlClass} value={reqDate} onChange={(e) => setReqDate(e.target.value)} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" className="rounded border-slate-300" checked={reqZero} onChange={(e) => setReqZero(e.target.checked)} />
                  {ar ? 'أسطر صفر' : 'Zero-qty lines'}
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={ghostActionClass} onClick={() => setRequestOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="button"
                className={primaryBtnClass}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className={`${sectionCardClass} max-h-[80vh] w-full max-w-2xl overflow-auto`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={sectionEyebrowClass}>{ar ? 'سجل' : 'History'}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  {ar ? 'تسويات الجرد' : 'Adjustment history'}
                </h3>
                <p className="text-sm text-slate-500">{historyOpen.label}</p>
              </div>
              <button type="button" className={ghostActionClass} onClick={() => setHistoryOpen(null)}>
                {ar ? 'إغلاق' : 'Close'}
              </button>
            </div>
            {historyLoading && <p className="mt-4 text-sm text-slate-400">…</p>}
            {!historyLoading && !(historyPayload || []).length && (
              <p className="mt-4 text-sm text-slate-400">{ar ? 'لا حركات بعد' : 'No moves yet'}</p>
            )}
            <ul className="mt-4 space-y-2">
              {(historyPayload || []).map((line) => (
                <li key={line._id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-dark-600">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{line.reference || line.moveId?.reference || '—'}</span>
                    <span className={`${monoCellClass} font-semibold`}>{line.quantity}</span>
                  </div>
                  <div className="text-xs text-slate-400">{fmtDate(line.moveId?.date || line.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

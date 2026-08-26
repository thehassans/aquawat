import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import ProductChooser from '../../components/inventory/ProductChooser'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'

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
  return n > 0 ? 'text-emerald-600' : 'text-rose-600'
}

export default function PhysicalInventory() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()

  const [filter, setFilter] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [addCountedQty, setAddCountedQty] = useState('0')
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
    qc.invalidateQueries({ queryKey: ['stock-report'] })
  }

  const setCount = useMutation({
    mutationFn: (body) => api.post('/stock/physical-inventory/set', body),
    onSuccess: () => {
      setDirty(false)
      invalidate()
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const clear = useMutation({
    mutationFn: (quantId) => api.post('/stock/physical-inventory/clear', { quantId }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const apply = useMutation({
    mutationFn: (body) => api.post('/stock/physical-inventory/apply', body),
    onSuccess: (res) => {
      const { applied = 0, failed = 0 } = res.data || {}
      toast.success(
        ar
          ? `تم تطبيق ${applied}${failed ? `، فشل ${failed}` : ''}`
          : `${applied} applied${failed ? `, ${failed} failed` : ''}`,
      )
      setApplyOpen(false)
      setSelected(new Set())
      setApplyPreview(null)
      invalidate()
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

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
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const whList = Array.isArray(warehouses) ? warehouses : []
  const locList = Array.isArray(locations) ? locations : []
  const reqLocList = Array.isArray(reqLocations) ? reqLocations : []
  const catList = Array.isArray(categories) ? categories : []
  const effectiveLocationId = locationId || locList[0]?._id || ''

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const addProductToCount = (product) => {
    if (!effectiveLocationId) {
      toast.error(ar ? 'اختر مستودعاً بموقع داخلي أولاً' : 'Select a warehouse with an internal location first')
      return
    }
    setCount.mutate(
      {
        productId: product._id,
        locationId: effectiveLocationId,
        countedQty: addCountedQty === '' ? '0' : addCountedQty,
      },
      {
        onSuccess: () => {
          toast.success(ar ? `تمت إضافة ${product.name} للجرد` : `Added ${product.name} to count`)
        },
      },
    )
  }

  const persistRow = (row, patch = {}) => {
    const counted = edits[row._id] ?? row.countedQuantity
    setCount.mutate({
      quantId: row._id,
      countedQty: counted === '' || counted == null ? undefined : counted,
      ...patch,
    })
  }

  const discardLocal = () => {
    setEdits({})
    setDirty(false)
    qc.invalidateQueries({ queryKey: ['physical-inventory'] })
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'الجرد الفعلي' : 'Physical Inventory'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary text-sm" disabled={!dirty} onClick={discardLocal}>
            {ar ? 'تجاهل' : 'Discard'}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            disabled={!dirty || setCount.isPending}
            onClick={() => {
              Object.entries(edits).forEach(([id, countedQty]) => {
                if (countedQty === '' || countedQty == null) return
                setCount.mutate({ quantId: id, countedQty })
              })
            }}
          >
            {ar ? 'حفظ' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={!list.some((r) => r.isCountSet)}
            onClick={() => openApply(list.filter((r) => r.isCountSet).map((r) => r._id))}
          >
            {ar ? 'تطبيق الكل' : 'Apply All'}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            disabled={!selected.size}
            onClick={() => openApply([...selected])}
          >
            {ar ? `تطبيق المحدد (${selected.size})` : `Apply Selected (${selected.size})`}
          </button>
          <button
            type="button"
            className={`btn text-sm ${blindMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBlindMode((v) => !v)}
          >
            {ar ? (blindMode ? 'عد أعمى: تشغيل' : 'عد أعمى') : (blindMode ? 'Blind: ON' : 'Blind count')}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
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
                toast.error(e.response?.data?.error || e.message)
              }
            }}
          >
            {ar ? 'طباعة ورقة الجرد' : 'Print count sheet'}
          </button>
          <button type="button" className="btn btn-secondary text-sm" onClick={() => setRequestOpen(true)}>
            {ar ? 'طلب جرد' : 'Request a Count'}
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

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-slate-900 dark:text-white">
            {ar ? 'إضافة منتج للجرد' : 'Add product to count'}
          </div>
          <Link to="/app/dashboard/inventory/products" className="text-xs font-medium text-primary-600 hover:underline">
            {ar ? 'فتح كتالوج المنتجات' : 'Open product catalog'}
          </Link>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className="select"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value)
              setLocationId('')
              setPage(1)
            }}
          >
            <option value="">{ar ? 'كل المستودعات (عرض)' : 'All warehouses (view)'}</option>
            {whList.map((w) => (
              <option key={w._id} value={w._id}>{ar && w.nameAr ? w.nameAr : w.nameEn}</option>
            ))}
          </select>
          <select
            className="select"
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
          <input
            className="input w-28"
            type="text"
            inputMode="decimal"
            value={addCountedQty}
            onChange={(e) => setAddCountedQty(e.target.value)}
            placeholder={ar ? 'العد' : 'Counted'}
          />
          <input
            className="input min-w-[12rem] flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={ar ? 'بحث منتج / SKU…' : 'Search product / SKU…'}
          />
        </div>
        <ProductChooser
          remote
          onPick={addProductToCount}
          placeholder={ar ? 'ابحث عن منتج من الكتالوج…' : 'Search catalog products to count…'}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm sm:grid-cols-5 dark:border-dark-600 dark:bg-dark-900/40">
        <div><div className="text-xs text-slate-500">{ar ? 'أسطر للعد' : 'Lines to count'}</div><div className="tabular-nums font-semibold">{totals.linesToCount ?? meta.total ?? 0}</div></div>
        <div><div className="text-xs text-slate-500">{ar ? 'تم العد' : 'Lines counted'}</div><div className="tabular-nums font-semibold">{totals.linesCounted ?? 0}</div></div>
        <div><div className="text-xs text-slate-500">{ar ? 'فرق +' : 'Positive Δ'}</div><div className="tabular-nums font-semibold text-emerald-600">{totals.positiveDiff ?? '0'}</div></div>
        <div><div className="text-xs text-slate-500">{ar ? 'فرق −' : 'Negative Δ'}</div><div className="tabular-nums font-semibold text-rose-600">{totals.negativeDiff ?? '0'}</div></div>
        <div><div className="text-xs text-slate-500">{ar ? 'صافي القيمة (ر.س)' : 'Net value (SAR)'}</div><div className="tabular-nums font-semibold">{totals.netValueImpact ?? '0'}</div></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
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
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{from}-{to} / {meta.total || 0}</span>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary text-sm" onClick={() => openApply([...selected])}>
            {ar ? `تطبيق (${selected.size})` : `Apply (${selected.size})`}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
            <tr>
              <th className="px-3 py-3 w-10" />
              <th className="px-3 py-3 text-start">{ar ? 'الموقع' : 'Location'}</th>
              <th className="px-3 py-3 text-start">{ar ? 'المنتج' : 'Product'}</th>
              <th className="px-3 py-3 text-start">{ar ? 'دفعة' : 'Lot/Serial'}</th>
              <th className="px-3 py-3 text-start">{ar ? 'عبوة' : 'Package'}</th>
              {!blindMode && <th className="px-3 py-3 text-start">{ar ? 'المتاح' : 'On Hand'}</th>}
              <th className="px-3 py-3 text-start">{ar ? 'وحدة' : 'UoM'}</th>
              <th className="px-3 py-3 text-start">{ar ? 'العد' : 'Counted'}</th>
              {!blindMode && <th className="px-3 py-3 text-start">{ar ? 'الفرق' : 'Diff'}</th>}
              <th className="px-3 py-3 text-start">{ar ? 'مجدول' : 'Scheduled'}</th>
              <th className="px-3 py-3 text-start">{ar ? 'المستخدم' : 'User'}</th>
              <th className="px-3 py-3 text-start">{ar ? 'آخر جرد' : 'Last count'}</th>
              <th className="px-3 py-3 text-start">{ar ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-400">…</td></tr>
            )}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={13} className="p-8">
                  <EmptyState
                    title={ar ? 'لا أسطر جرد' : 'No count lines'}
                    description={
                      ar
                        ? 'أضف منتجاً، أو استخدم «طلب جرد» لإنشاء أسطر (بما فيها الكميات الصفر).'
                        : 'Add a product, or use Request a Count to generate lines (including zero qty).'
                    }
                  />
                </td>
              </tr>
            )}
            {list.map((row) => {
              const counted = edits[row._id] ?? row.countedQuantity ?? ''
              const liveDiff = counted !== '' && counted != null
                ? (Number(counted || 0) - Number(row.quantity || 0)).toFixed(2)
                : (row.isCountSet ? row.countDifference : '—')
              const pid = row.productId?._id || row.productId
              const lid = row.locationId?._id || row.locationId
              const pname = ar && row.productId?.nameAr ? row.productId.nameAr : row.productId?.nameEn
              return (
                <tr key={row._id} className={`border-b border-slate-50 dark:border-dark-700 ${row.isStale ? 'bg-amber-50/80 dark:bg-amber-950/20' : ''}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row._id)}
                      disabled={!row.isCountSet || row.isStale}
                      onChange={() => toggle(row._id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{row.locationId?.completePath || row.locationId?.name}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {pid ? (
                        <Link className="text-primary-700 hover:underline dark:text-primary-300" to={`/app/dashboard/inventory/products/${pid}`}>
                          {pname}
                        </Link>
                      ) : pname}
                    </div>
                    <div className="text-xs text-slate-400">{row.productId?.sku}</div>
                    {row.isStale && (
                      <div className="text-xs font-medium text-amber-700">{ar ? 'رصيد تغيّر — أعد العد' : 'Stale — recount required'}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.lotId?.name || '—'}</td>
                  <td className="px-3 py-2">{row.packageId?.name || '—'}</td>
                  {!blindMode && <td className="px-3 py-2 tabular-nums">{row.quantity}</td>}
                  <td className="px-3 py-2 text-xs text-slate-500">{row.uom || row.productId?.unitOfMeasure || 'PCE'}</td>
                  <td className="px-3 py-2">
                    <input
                      className="input w-24"
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
                  {!blindMode && <td className={`px-3 py-2 tabular-nums ${diffColor(liveDiff)}`}>{liveDiff}</td>}
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      className="input w-[9.5rem] text-xs"
                      value={fmtDate(row.countScheduledDate)}
                      onChange={(e) => persistRow(row, { countScheduledDate: e.target.value || null })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="select text-xs max-w-[9rem]"
                      value={row.countUserId?._id || row.countUserId || ''}
                      onChange={(e) => persistRow(row, { countUserId: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>{u.name || u.email}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(row.lastCountDate) || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="text-xs text-primary-600 hover:underline"
                        onClick={() => setHistoryOpen({ productId: pid, locationId: lid, label: pname })}
                      >
                        {ar ? 'سجل' : 'History'}
                      </button>
                      {row.isCountSet && (
                        <button
                          type="button"
                          className="text-xs text-emerald-600 hover:underline"
                          onClick={() => openApply([row._id])}
                        >
                          {ar ? 'تطبيق' : 'Apply'}
                        </button>
                      )}
                      {row.isCountSet && (
                        <button
                          type="button"
                          className="text-xs text-rose-500 hover:underline"
                          onClick={() => clear.mutate(row._id)}
                        >
                          {ar ? 'مسح' : 'Clear'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
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
            <p className="mt-2 text-xs text-slate-400">
              {ar
                ? 'الاستيراد يملأ العد فقط — التطبيق خطوة منفصلة. يُنشئ حركات تسوية عبر موقع التعديل.'
                : 'Import fills Counted only — apply stays a deliberate action. Creates adjustment moves via Inventory Loss.'}
            </p>
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

      {/* Request a Count */}
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
                    <option key={w._id} value={w._id}>{ar && w.nameAr ? w.nameAr : w.nameEn}</option>
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
                  {ar ? 'أسطر كمية صفر (انكماش)' : 'Include zero-qty lines'}
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

      {/* History */}
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

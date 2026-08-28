import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { formatInvError } from '../../lib/invError'
import { invTableWrapClass, invTableClass } from './inventoryUi'

function calcToOrder(maxQty, forecasted) {
  const max = Number(maxQty)
  const fc = Number(forecasted)
  if (!Number.isFinite(max) || !Number.isFinite(fc)) return 0
  return Math.max(0, Math.ceil(max - fc))
}

function rowKey(row) {
  return String(row._id || `${row.productId?._id || row.productId}-${row.locationId?._id || row.locationId}`)
}

/**
 * Interactive replenishment worksheet — editable To Order + Order Once.
 */
export default function ReplenishmentWorksheet() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [warehouseId, setWarehouseId] = useState('')
  const [qtyOverrides, setQtyOverrides] = useState({})
  const [dismissed, setDismissed] = useState(() => new Set())

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['replenishment', warehouseId],
    queryFn: () =>
      api.get('/stock/replenishment', {
        params: { warehouseId: warehouseId || undefined },
      }).then((r) => r.data),
  })

  const serverItems = data?.items || data?.data || []

  useEffect(() => {
    setQtyOverrides({})
    setDismissed(new Set())
  }, [warehouseId, data?.items?.length])

  const rows = useMemo(() => {
    return serverItems
      .filter((r) => !dismissed.has(rowKey(r)))
      .map((r) => {
        const key = rowKey(r)
        const auto = calcToOrder(r.maxQty, r.qtyForecast)
        const serverQty = Number(r.qtyToOrder)
        const defaultQty = Number.isFinite(serverQty) && serverQty > 0 ? serverQty : auto
        const toOrder = qtyOverrides[key] != null ? qtyOverrides[key] : defaultQty
        return { ...r, _key: key, _toOrder: toOrder, _auto: auto }
      })
  }, [serverItems, qtyOverrides, dismissed])

  const orderMut = useMutation({
    mutationFn: (row) =>
      api.post('/stock/replenishment/order', {
        productId: row.productId?._id || row.productId,
        locationId: row.locationId?._id || row.locationId,
        warehouseId: row.warehouseId?._id || row.warehouseId,
        qty: Number(row._toOrder) || 0,
        routeId: row.routeId?._id || row.routeId,
        preferredVendorId: row.preferredVendorId?._id || row.preferredVendorId,
      }).then((r) => r.data),
    onSuccess: (_res, row) => {
      toast.success(ar ? 'تم إنشاء أمر التوريد' : 'Order created')
      setDismissed((prev) => new Set(prev).add(row._key))
      qc.invalidateQueries({ queryKey: ['replenishment'] })
      qc.invalidateQueries({ queryKey: ['procurement-groups'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'ورقة إعادة التوريد' : 'Replenishment worksheet'}
          </h2>
          <p className="text-sm text-slate-500">
            {ar
              ? 'حدّث الكمية المطلوبة ثم اطلب مرة واحدةً — يُنشأ أمر شراء أو تصنيع فوراً'
              : 'Edit To Order, then Order Once — generates PO or MO immediately'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input input-sm min-w-[10rem]"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">{ar ? 'كل المستودعات' : 'All warehouses'}</option>
            {(warehouses || []).map((w) => (
              <option key={w._id} value={w._id}>{w.name || w.code}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <Link to="/app/dashboard/inventory/scheduler" className="btn btn-secondary btn-sm">
            {ar ? 'المجدول' : 'Scheduler'}
          </Link>
          <Link to="/app/dashboard/inventory/reordering-rules" className="btn btn-secondary btn-sm">
            {ar ? 'القواعد' : 'Rules'}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !rows.length ? (
        <EmptyState
          title={ar ? 'لا توجد بنود' : 'Nothing to replenish'}
          description={ar ? 'أضف قواعد إعادة الطلب أو انتظر توقعات سالبة' : 'Add reorder rules or wait for negative forecasts'}
        />
      ) : (
        <div className={invTableWrapClass}>
          <table className={`${invTableClass} min-w-[960px]`}>
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[220px] px-3 py-2.5">{ar ? 'المنتج والموقع' : 'Product & location'}</th>
                <th className="min-w-[90px] px-3 py-2.5 text-right">{ar ? 'بالمخزن' : 'On hand'}</th>
                <th className="min-w-[90px] px-3 py-2.5 text-right">{ar ? 'المتوقع' : 'Forecasted'}</th>
                <th className="min-w-[80px] px-3 py-2.5 text-right">{ar ? 'أدنى' : 'Min'}</th>
                <th className="min-w-[80px] px-3 py-2.5 text-right">{ar ? 'أقصى' : 'Max'}</th>
                <th className="min-w-[110px] px-3 py-2.5 text-right">{ar ? 'للطلب' : 'To order'}</th>
                <th className="min-w-[120px] px-3 py-2.5 text-right">{ar ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {rows.map((row) => {
                const name = row.productId?.nameEn || row.productId?.sku || '—'
                const loc = row.locationId?.completePath || row.locationId?.name
                  || row.warehouseId?.name || row.warehouseId?.code || '—'
                const forecast = Number(row.qtyForecast)
                const forecastNeg = Number.isFinite(forecast) && forecast < 0
                return (
                  <tr key={row._key} className={row.snoozed ? 'opacity-50' : ''}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900 dark:text-white">{name}</div>
                      <div className="text-xs text-slate-400">{loc}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        {row.kind === 'virtual' ? (ar ? 'افتراضي' : 'Virtual') : (ar ? 'قاعدة' : 'Rule')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {row.qtyOnHand}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${forecastNeg ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                      {row.qtyForecast}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{row.minQty ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{row.maxQty ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="input input-sm w-24 text-right tabular-nums"
                        value={row._toOrder}
                        disabled={row.snoozed}
                        onChange={(e) => {
                          const v = e.target.value === '' ? '' : Number(e.target.value)
                          setQtyOverrides((prev) => ({ ...prev, [row._key]: v }))
                        }}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={row.snoozed || orderMut.isPending || !(Number(row._toOrder) > 0)}
                        onClick={() => orderMut.mutate(row)}
                      >
                        {ar ? 'اطلب مرة' : 'Order once'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

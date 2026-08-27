import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import { locationOptionLabel, formatLocationLabel } from '../receipts/locationLabel'
import {
  defaultReturnDestinationId,
  filterReturnDestLocations,
  inventoryPathForOpCode,
} from './returnPaths'

/**
 * Professional partial-return modal for done inventory transfers.
 */
export default function ReverseTransferModal({
  open,
  onClose,
  transferId,
  transfer: transferProp = null,
  ar = false,
  language = 'en',
  onCreated,
}) {
  const [rows, setRows] = useState([])
  const [destLocationId, setDestLocationId] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const { data: wizard, isLoading, isError, error } = useQuery({
    queryKey: ['return-wizard', transferId],
    enabled: open && Boolean(transferId),
    queryFn: () => api.get(`/stock/transfers/${transferId}/return-wizard`).then((r) => r.data),
    staleTime: 0,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => asInvList(r.data)),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const transfer = wizard?.transfer || transferProp
  const reference = transfer?.name || transferProp?.name || '—'

  const warehouseId = useMemo(() => {
    const src = transfer?.sourceLocationId
    if (src && typeof src === 'object') return src.warehouseId?._id || src.warehouseId || ''
    return ''
  }, [transfer])

  const destOptions = useMemo(() => filterReturnDestLocations(locations, {
    includeIds: [destLocationId, transfer?.sourceLocationId?._id || transfer?.sourceLocationId],
    warehouseId: warehouseId || undefined,
  }), [locations, destLocationId, transfer, warehouseId])

  useEffect(() => {
    if (!open || !wizard) return
    const nextRows = (wizard.lines || []).map((l) => ({
      moveId: l.moveId,
      productId: l.productId,
      variantId: l.variantId,
      uomId: l.uomId,
      deliveredQty: Number(l.quantityDone ?? l.quantity ?? 0),
      returnQty: String(l.quantityDone ?? l.quantity ?? '0'),
      removed: false,
    }))
    setRows(nextRows)
    setErrors({})
    setDestLocationId(defaultReturnDestinationId(wizard.transfer, locations) || '')
  }, [open, wizard, locations])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  if (!open) return null

  const setReturnQty = (moveId, value) => {
    setRows((prev) => prev.map((r) => (r.moveId === moveId ? { ...r, returnQty: value } : r)))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[moveId]
      return next
    })
  }

  const removeRow = (moveId) => {
    setRows((prev) => prev.map((r) => (r.moveId === moveId ? { ...r, removed: true, returnQty: '0' } : r)))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[moveId]
      return next
    })
  }

  const validate = () => {
    const nextErrors = {}
    let hasPositive = false
    for (const r of rows) {
      if (r.removed) continue
      const qty = Number(r.returnQty)
      if (Number.isNaN(qty) || qty < 0) {
        nextErrors[r.moveId] = ar ? 'لا يمكن أن تكون الكمية سالبة' : 'Return qty cannot be negative'
        continue
      }
      if (qty > r.deliveredQty + 1e-9) {
        nextErrors[r.moveId] = ar
          ? 'كمية المرتجع أكبر من المسلّم'
          : 'Return Qty cannot exceed Delivered Qty'
        continue
      }
      if (qty > 0) hasPositive = true
    }
    if (!destLocationId) {
      nextErrors._dest = ar ? 'اختر موقع الوجهة' : 'Select a return destination'
    }
    if (!hasPositive && Object.keys(nextErrors).length === 0) {
      nextErrors._lines = ar ? 'أدخل كمية مرتجع واحدة على الأقل' : 'Enter at least one return quantity > 0'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const payloadLines = rows
        .filter((r) => !r.removed && Number(r.returnQty) > 0)
        .map((r) => ({ moveId: r.moveId, quantity: r.returnQty }))

      const ret = await api.post(`/stock/transfers/${transferId}/return`, {
        lines: payloadLines,
        destLocationId,
      }).then((r) => r.data)

      // Bring return to Ready for physical inspection / validate
      let ready = ret
      try {
        await api.post(`/stock/transfers/${ret._id}/confirm`)
        ready = await api.post(`/stock/transfers/${ret._id}/check-availability`).then((r) => r.data).catch(() => null)
        if (!ready || !['assigned', 'partiallyAvailable', 'confirmed', 'waiting'].includes(ready.state)) {
          // Retry availability once — incoming returns may need assign without reservation
          ready = await api.get(`/stock/transfers/${ret._id}`).then((r) => r.data)
          if (ready?.state === 'draft') {
            await api.post(`/stock/transfers/${ret._id}/confirm`)
            ready = await api.get(`/stock/transfers/${ret._id}`).then((r) => r.data)
          }
          if (['confirmed', 'waiting'].includes(ready?.state)) {
            await api.post(`/stock/transfers/${ret._id}/check-availability`).catch(() => null)
            ready = await api.get(`/stock/transfers/${ret._id}`).then((r) => r.data)
          }
        }
      } catch {
        ready = await api.get(`/stock/transfers/${ret._id}`).then((r) => r.data).catch(() => ret)
      }

      toast.success(ar ? 'تم إنشاء المرتجع' : 'Return created')
      onClose?.()
      onCreated?.(ready || ret)
    } catch (e) {
      toast.error(formatInvError(e, language))
    } finally {
      setSubmitting(false)
    }
  }

  const origFrom = formatLocationLabel(
    transfer?.sourceLocationId?.completePath,
    transfer?.sourceLocationId?.name || '—',
  )
  const origTo = formatLocationLabel(
    transfer?.destLocationId?.completePath,
    transfer?.destLocationId?.name || '—',
  )

  const visibleRows = rows.filter((r) => !r.removed)

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-950/55 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => !submitting && onClose?.()} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl border border-slate-200/80 bg-white shadow-xl dark:border-dark-600 dark:bg-dark-800 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {ar ? `عكس التحويل: ${reference}` : `Reverse Transfer: ${reference}`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {ar ? `الأصل: ${origFrom} → ${origTo}` : `Original: ${origFrom} → ${origTo}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-dark-700"
            onClick={() => !submitting && onClose?.()}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isLoading && (
            <p className="text-sm text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</p>
          )}
          {isError && (
            <p className="text-sm text-rose-600">{formatInvError(error, language)}</p>
          )}

          {!isLoading && !isError && (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {ar ? 'إعدادات الموقع' : 'Location Settings'}
                </h3>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    {ar ? 'وجهة المرتجع' : 'Return Destination'}
                    <span className="text-rose-500"> *</span>
                  </span>
                  <select
                    className={`select w-full ${errors._dest ? 'border-rose-400' : ''}`}
                    value={destLocationId}
                    onChange={(e) => {
                      setDestLocationId(e.target.value)
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next._dest
                        return next
                      })
                    }}
                  >
                    <option value="">—</option>
                    {destOptions.map((l) => (
                      <option key={l._id} value={l._id}>{locationOptionLabel(l, ar)}</option>
                    ))}
                  </select>
                  {errors._dest && <p className="mt-1 text-xs text-rose-600">{errors._dest}</p>}
                </label>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {ar ? 'بنود المرتجع' : 'Line Items'}
                </h3>
                {errors._lines && <p className="text-xs text-rose-600">{errors._lines}</p>}

                {visibleRows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-dark-600">
                    {ar ? 'لا توجد بنود للإرجاع' : 'No lines left to return'}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-dark-600">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/90 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900/50">
                        <tr>
                          <th className="px-3 py-2.5 text-start">{ar ? 'المنتج / المتغير' : 'Product & Variant'}</th>
                          <th className="px-3 py-2.5 text-end">{ar ? 'المسلّم' : 'Delivered Qty'}</th>
                          <th className="px-3 py-2.5 text-end">{ar ? 'كمية المرتجع' : 'Return Qty'}</th>
                          <th className="w-10 px-2 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
                        {visibleRows.map((r) => {
                          const p = r.productId
                          const v = r.variantId
                          const name = ar && p?.nameAr ? p.nameAr : (p?.nameEn || p?.sku || '—')
                          const variant = v?.name || v?.sku || ''
                          const sku = p?.sku || ''
                          return (
                            <tr key={r.moveId}>
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-slate-800 dark:text-slate-100">{name}</div>
                                {variant ? (
                                  <div className="text-xs text-slate-500">{variant}</div>
                                ) : null}
                                {sku ? (
                                  <div className="font-mono text-[11px] text-slate-400">{sku}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-end tabular-nums text-slate-600">
                                {r.deliveredQty}
                              </td>
                              <td className="px-3 py-2.5 text-end">
                                <input
                                  className={`input input-sm ms-auto w-24 text-end tabular-nums ${
                                    errors[r.moveId] ? 'border-rose-400' : ''
                                  }`}
                                  inputMode="decimal"
                                  min="0"
                                  value={r.returnQty}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    if (v === '' || v === '.' || /^-/.test(v)) {
                                      setReturnQty(r.moveId, v.replace(/^-/, ''))
                                      return
                                    }
                                    setReturnQty(r.moveId, v)
                                  }}
                                />
                                {errors[r.moveId] && (
                                  <p className="mt-1 text-start text-[11px] text-rose-600">{errors[r.moveId]}</p>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  onClick={() => removeRow(r.moveId)}
                                  aria-label="Remove line"
                                  title={ar ? 'استبعاد السطر' : 'Exclude line'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-dark-600">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            disabled={submitting}
            onClick={() => onClose?.()}
          >
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={submitting || isLoading || isError}
            onClick={submit}
          >
            {submitting
              ? (ar ? 'جاري الإنشاء…' : 'Creating…')
              : (ar ? 'إنشاء مرتجع' : 'Create Return')}
          </button>
        </div>
      </div>
    </div>
  )
}

export { inventoryPathForOpCode }

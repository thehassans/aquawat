import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Check, X, RefreshCw, Printer, RotateCcw } from 'lucide-react'
import api from '../../lib/api'
import { ghostBtn, primaryBtn, fieldControlClass, PICKING_STATUS_PILL, pickingStatusLabel, stockProductLabel, stockLocationLabel, INVENTORY_PATH } from './inventoryUi'
import { InventoryPageHeader } from './InventoryChrome'
import PickingChatter from './PickingChatter'
import InventorySheet from './InventorySheet'

export default function PickingForm() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const isNew = !id || id === 'new' || location.pathname.endsWith('/new')

  const params = new URLSearchParams(location.search)
  const pathCode = location.pathname.includes('/deliveries') ? 'outgoing'
    : location.pathname.includes('/internal') ? 'internal'
    : 'incoming'
  const opTypeCode = params.get('code') || pathCode

  const [lines, setLines] = useState([{ productId: '', productUomId: '', productUomQty: '1' }])
  const [backorderPrompt, setBackorderPrompt] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnLines, setReturnLines] = useState([])
  const [editLine, setEditLine] = useState(null)
  const [lineDraft, setLineDraft] = useState({ lotName: '', quantity: '' })
  /** Local optimistic status overlay (React 18 — no useOptimistic) */
  const [optimisticState, setOptimisticState] = useState(null)

  const { data: opTypes } = useQuery({
    queryKey: ['stock-op-types'],
    queryFn: () => api.get('/stock/operation-types').then((r) => r.data),
  })

  const { data: variants } = useQuery({
    queryKey: ['stock-variants'],
    queryFn: () => api.get('/stock/products/variants').then((r) => r.data),
    enabled: isNew,
  })

  const { data: uoms } = useQuery({
    queryKey: ['stock-uom'],
    queryFn: () => api.get('/stock/uom').then((r) => r.data),
  })

  const { data: detail, isLoading } = useQuery({
    queryKey: ['stock-picking', id],
    queryFn: () => api.get(`/stock/pickings/${id}`).then((r) => r.data),
    enabled: !isNew,
  })

  const picking = detail?.picking
  const moves = detail?.moves || []
  const moveLines = detail?.moveLines || []
  const displayState = optimisticState ?? picking?.state

  useEffect(() => {
    setOptimisticState(null)
  }, [picking?.state, picking?._id])

  const invalidate = () => {
    queryClient.invalidateQueries(['stock-picking', id])
    queryClient.invalidateQueries(['stock-pickings'])
    queryClient.invalidateQueries(['stock-overview'])
  }

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/stock/pickings', payload),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم الإنشاء' : 'Created')
      navigate(`/app/dashboard/inventory/pickings/${res.data._id}`)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const actionMutation = useMutation({
    mutationFn: ({ action, body }) => api.post(`/stock/pickings/${id}/${action}`, body),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Done')
      setBackorderPrompt(false)
      setOptimisticState(null)
      invalidate()
    },
    onError: (err) => {
      setOptimisticState(null)
      if (err.response?.data?.code === 'BACKORDER_REQUIRED') {
        setBackorderPrompt(true)
        return
      }
      toast.error(err.response?.data?.error || 'Error')
    },
  })

  const runAction = (action, body) => {
    if (action === 'validate') setOptimisticState('done')
    else if (action === 'cancel') setOptimisticState('cancel')
    else if (action === 'confirm') setOptimisticState('confirmed')
    actionMutation.mutate({ action, body })
  }

  const openLineEditor = (line) => {
    setEditLine(line)
    setLineDraft({
      lotName: line.lotName || '',
      quantity: String(line.quantityProduct || line.quantity || ''),
    })
  }

  const saveLineDraft = async () => {
    if (!editLine) return
    try {
      await api.post('/stock/move-lines', {
        id: editLine._id,
        quantity: lineDraft.quantity,
        locationId: editLine.locationId,
        locationDestId: editLine.locationDestId,
        lotName: lineDraft.lotName,
      })
      toast.success(isAr ? 'تم' : 'Saved')
      setEditLine(null)
      invalidate()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error')
    }
  }

  const openReturn = async () => {
    try {
      const res = await api.get(`/stock/pickings/${id}/return-wizard`)
      setReturnLines((res.data.lines || []).map((l) => ({
        moveId: l.moveId,
        quantity: String(l.quantity || l.quantityDone || 0),
        max: String(l.quantityDone || 0),
        productLabel: stockProductLabel(l.productId) !== '—'
          ? stockProductLabel(l.productId)
          : (l.productId?.name || String(l.productId?._id || l.productId)),
      })))
      setReturnOpen(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error')
    }
  }

  const submitReturn = useMutation({
    mutationFn: () => api.post(`/stock/pickings/${id}/return`, {
      lines: returnLines
        .filter((l) => Number(l.quantity) > 0)
        .map((l) => ({ moveId: l.moveId, quantity: l.quantity })),
    }),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم إنشاء المرتجع' : 'Return created')
      setReturnOpen(false)
      navigate(INVENTORY_PATH.picking(res.data._id))
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const printPicking = async () => {
    try {
      const url = `/stock/pickings/${id}/print?format=html`
      const res = await api.get(url, { responseType: 'text' })
      const blob = new Blob([res.data], { type: 'text/html' })
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank')
      toast.success(isAr ? 'تم فتح صفحة الطباعة' : 'Print page opened')
      invalidate()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error')
    }
  }

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/stock/pickings/${id}/print?format=pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank')
      toast.success(isAr ? 'تم فتح PDF' : 'PDF opened')
      invalidate()
    } catch (err) {
      toast.error(err.response?.data?.error || 'PDF failed')
    }
  }

  const productOptions = (variants || []).map((v) => ({
    id: v._id,
    name: v.templateId?.name || v.defaultCode || String(v._id),
    uomId: v.templateId?.uomId,
  }))

  const handleCreate = (e) => {
    e.preventDefault()
    const opType = (opTypes || []).find((o) => o.code === opTypeCode)
    if (!opType) return toast.error('Operation type not found')
    createMutation.mutate({
      operationTypeId: opType._id,
      moves: lines.filter((l) => l.productId).map((l) => ({
        productId: l.productId,
        productUomId: l.productUomId || uoms?.[0]?._id,
        productUomQty: String(l.productUomQty || 1),
      })),
    })
  }

  if (!isNew && isLoading) {
    return <div className="card p-8 text-center text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
  }

  return (
    <div className="space-y-8">
      <InventoryPageHeader
        title={isNew ? (isAr ? 'عملية جديدة' : 'New transfer') : (picking?.name || '…')}
        backTo={
          opTypeCode === 'outgoing' ? INVENTORY_PATH.deliveries
            : opTypeCode === 'internal' ? INVENTORY_PATH.internal
              : INVENTORY_PATH.receipts
        }
        backLabel={
          opTypeCode === 'outgoing' ? (isAr ? 'التسليمات' : 'Deliveries')
            : opTypeCode === 'internal' ? (isAr ? 'التحويلات' : 'Internal')
              : (isAr ? 'الاستلامات' : 'Receipts')
        }
        actions={!isNew ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={printPicking}>
              <Printer className="w-4 h-4" />
              {isAr ? 'طباعة' : 'Print'}
            </button>
            <button type="button" className={ghostBtn} onClick={downloadPdf}>
              PDF
            </button>
            {picking?.state === 'done' && (
              <button type="button" className={ghostBtn} onClick={openReturn}>
                <RotateCcw className="w-4 h-4" />
                {isAr ? 'مرتجع' : 'Return'}
              </button>
            )}
            {displayState !== 'done' && displayState !== 'cancel' && (
              <>
                {['draft', 'confirmed'].includes(displayState) && (
                  <button type="button" className={ghostBtn} onClick={() => runAction('confirm')}>
                    {isAr ? 'تأكيد' : 'Confirm'}
                  </button>
                )}
                <button type="button" className={ghostBtn} onClick={() => runAction('check-availability')}>
                  <RefreshCw className="w-4 h-4" />
                  {isAr ? 'فحص التوفر' : 'Check Availability'}
                </button>
                <button type="button" className={ghostBtn} onClick={() => runAction('unreserve')}>
                  {isAr ? 'إلغاء الحجز' : 'Unreserve'}
                </button>
                <button type="button" className={primaryBtn} onClick={() => runAction('validate')} disabled={actionMutation.isPending}>
                  <Check className="w-4 h-4" />
                  {isAr ? 'اعتماد' : 'Validate'}
                </button>
                <button type="button" className={`${ghostBtn} text-rose-600`} onClick={() => runAction('cancel')}>
                  <X className="w-4 h-4" />
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </>
            )}
          </div>
        ) : null}
      >
        {!isNew && picking && (
          <span className={`badge mt-2 ${PICKING_STATUS_PILL[displayState] || 'badge-neutral'}`}>
            {pickingStatusLabel(displayState, language)}
          </span>
        )}
      </InventoryPageHeader>

      {backorderPrompt && (
        <div className="card p-4 border-amber-200 bg-amber-50 dark:bg-amber-500/10">
          <p className="text-sm mb-3">{isAr ? 'إنشاء طلب متبقي؟' : 'Create backorder for remaining quantity?'}</p>
          <div className="flex gap-2">
            <button type="button" className={primaryBtn} onClick={() => runAction('validate', { createBackorder: true })}>
              {isAr ? 'نعم' : 'Yes'}
            </button>
            <button type="button" className={ghostBtn} onClick={() => runAction('validate', { createBackorder: false })}>
              {isAr ? 'لا' : 'No'}
            </button>
          </div>
        </div>
      )}

      {returnOpen && (
        <div className="card p-4 space-y-3 border-teal-200 dark:border-teal-500/30">
          <h3 className="font-medium">{isAr ? 'مرتجع' : 'Return wizard'}</h3>
          {returnLines.map((l, idx) => (
            <div key={l.moveId} className="grid gap-2 md:grid-cols-3 items-end">
              <div className="text-sm md:col-span-2">{l.productLabel}</div>
              <input
                type="number"
                min="0"
                max={l.max}
                step="any"
                className={fieldControlClass}
                value={l.quantity}
                onChange={(e) => {
                  const next = [...returnLines]
                  next[idx] = { ...next[idx], quantity: e.target.value }
                  setReturnLines(next)
                }}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className={primaryBtn} onClick={() => submitReturn.mutate()} disabled={submitReturn.isPending}>
              {isAr ? 'إنشاء مرتجع' : 'Create return'}
            </button>
            <button type="button" className={ghostBtn} onClick={() => setReturnOpen(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {isNew ? (
        <form onSubmit={handleCreate} className="card p-6 space-y-4">
          <p className="text-sm text-slate-500">{isAr ? 'نوع العملية:' : 'Operation:'} {opTypeCode}</p>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label">{isAr ? 'المنتج' : 'Product'}</label>
                <select
                  className={fieldControlClass}
                  value={line.productId}
                  onChange={(e) => {
                    const next = [...lines]
                    const opt = productOptions.find((p) => String(p.id) === e.target.value)
                    next[idx].productId = e.target.value
                    if (opt?.uomId) next[idx].productUomId = String(opt.uomId)
                    setLines(next)
                  }}
                >
                  <option value="">—</option>
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{isAr ? 'الوحدة' : 'UoM'}</label>
                <select
                  className={fieldControlClass}
                  value={line.productUomId}
                  onChange={(e) => {
                    const next = [...lines]
                    next[idx].productUomId = e.target.value
                    setLines(next)
                  }}
                >
                  <option value="">—</option>
                  {(uoms || []).map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{isAr ? 'الكمية' : 'Quantity'}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={fieldControlClass}
                  value={line.productUomQty}
                  onChange={(e) => {
                    const next = [...lines]
                    next[idx].productUomQty = e.target.value
                    setLines(next)
                  }}
                />
              </div>
            </div>
          ))}
          <button type="button" className={ghostBtn} onClick={() => setLines([...lines, { productId: '', productUomId: '', productUomQty: '1' }])}>
            + {isAr ? 'سطر' : 'Line'}
          </button>
          <div>
            <button type="submit" className={primaryBtn} disabled={createMutation.isPending}>
              {isAr ? 'حفظ' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {isAr ? 'أنشئ منتجات من تبويب المنتجات قبل إنشاء عمليات الاستلام/التسليم.' : 'Create products from the Products tab before creating transfers.'}
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="card p-6 grid gap-4 md:grid-cols-2 text-sm">
            <div><span className="text-slate-500">{isAr ? 'المصدر' : 'Origin'}:</span> {picking?.origin || '—'}</div>
            <div><span className="text-slate-500">{isAr ? 'التاريخ' : 'Scheduled'}:</span> {picking?.scheduledDate ? new Date(picking.scheduledDate).toLocaleString() : '—'}</div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-600 font-medium">
              {isAr ? 'العمليات' : 'Operations'}
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{isAr ? 'المنتج' : 'Product'}</th>
                    <th>{isAr ? 'الطلب' : 'Demand'}</th>
                    <th>{isAr ? 'المنجز' : 'Done'}</th>
                    <th>{isAr ? 'الحالة' : 'State'}</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m._id}>
                      <td>{stockProductLabel(m)}</td>
                      <td>{m.productUomQty}</td>
                      <td>{m.quantity}</td>
                      <td><span className={`badge ${PICKING_STATUS_PILL[m.state]}`}>{pickingStatusLabel(m.state, language)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {moveLines.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b font-medium">{isAr ? 'تفاصيل العمليات' : 'Detailed Operations'}</div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'من' : 'From'}</th>
                      <th>{isAr ? 'إلى' : 'To'}</th>
                      <th>{isAr ? 'الدفعة / التسلسل' : 'Lot / Serial'}</th>
                      <th>{isAr ? 'الكمية' : 'Qty'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moveLines.map((l) => (
                      <tr
                        key={l._id}
                        className={displayState !== 'done' && displayState !== 'cancel' ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]' : ''}
                        onClick={() => {
                          if (displayState !== 'done' && displayState !== 'cancel') openLineEditor(l)
                        }}
                      >
                        <td className="text-xs">{stockLocationLabel(l.locationId)}</td>
                        <td className="text-xs">{stockLocationLabel(l.locationDestId)}</td>
                        <td>{l.lotName || String(l.lotId || '—')}</td>
                        <td>{l.quantityProduct || l.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {displayState !== 'done' && displayState !== 'cancel' && (
                <p className="px-4 py-2 text-xs text-slate-400">{isAr ? 'انقر على سطر للتعديل' : 'Click a row to edit'}</p>
              )}
            </div>
          )}

          <InventorySheet
            open={Boolean(editLine)}
            onClose={() => setEditLine(null)}
            title={isAr ? 'تعديل سطر الحركة' : 'Edit move line'}
            footer={(
              <div className="flex gap-2">
                <button type="button" className={primaryBtn} onClick={saveLineDraft}>
                  {isAr ? 'حفظ' : 'Save'}
                </button>
                <button type="button" className={ghostBtn} onClick={() => setEditLine(null)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            )}
          >
            <div className="space-y-4">
              <div>
                <label className="label">{isAr ? 'الدفعة / التسلسل' : 'Lot / Serial'}</label>
                <input
                  className={fieldControlClass}
                  value={lineDraft.lotName}
                  onChange={(e) => setLineDraft((d) => ({ ...d, lotName: e.target.value }))}
                  placeholder={isAr ? 'اسم الدفعة' : 'Lot name'}
                />
              </div>
              <div>
                <label className="label">{isAr ? 'الكمية' : 'Quantity'}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={fieldControlClass}
                  value={lineDraft.quantity}
                  onChange={(e) => setLineDraft((d) => ({ ...d, quantity: e.target.value }))}
                />
              </div>
            </div>
          </InventorySheet>

          <PickingChatter pickingId={id} />
        </div>
      )}
    </div>
  )
}

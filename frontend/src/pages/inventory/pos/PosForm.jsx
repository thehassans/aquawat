import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import { useDirtyGuard } from '../../../lib/useDirtyGuard'
import { TransferPrintButton } from '../TransferPrint'
import { formatLocationLabel } from '../receipts/locationLabel'
import { enrichMovesWithReserved } from '../deliveries/deliveryState'
import { DeliveryDraftLines, DeliveryLineItems } from '../deliveries/DeliveryLineItems'
import { PosHeader, PosActionBar } from './PosHeader'
import { PosFormFields } from './PosFormFields'
import { PosQuickEntry } from './PosQuickEntry'
import { ensureWalkInCustomer } from './walkInCustomer'
import { useReturnedPartner } from '../useReturnedPartner'

const LIST_PATH = '/app/dashboard/inventory/pos'

const draftLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  demandQty: z.string().optional(),
  variantId: z.string().nullable().optional(),
  variantName: z.string().optional(),
  variants: z.array(z.any()).optional(),
  needsVariant: z.boolean().optional(),
  uomId: z.string().optional(),
  uomLabel: z.string().optional(),
})

const posSchema = z.object({
  operationTypeId: z.string().min(1, 'Select operation type'),
  partnerId: z.string().optional(),
  sourceLocationId: z.string().optional(),
  destLocationId: z.string().optional(),
  origin: z.string().optional(),
  note: z.string().optional(),
  priority: z.enum(['normal', 'urgent']).optional(),
  lines: z.array(draftLineSchema).refine(
    (rows) => rows.some((l) => l.productId && Number(l.demandQty) > 0),
    { message: 'Add at least one product' },
  ),
})

const emptyDefaults = {
  operationTypeId: '',
  partnerId: '',
  sourceLocationId: '',
  destLocationId: '',
  origin: '',
  note: '',
  priority: 'normal',
  lines: [],
}

export default function PosForm() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [busyFast, setBusyFast] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types', 'pos'],
    queryFn: () => api.get('/stock/operation-types', { params: { code: 'pos' } }).then((r) => asInvList(r.data)),
    staleTime: 10 * 60 * 1000,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
    staleTime: 10 * 60 * 1000,
  })

  const multiLocations = settings?.groupStockMultiLocations !== false

  const { data: locations = [] } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => asInvList(r.data)),
    enabled: multiLocations,
  })

  const { data: transfer, isLoading } = useQuery({
    queryKey: ['stock-transfer', id],
    enabled: !isNew,
    queryFn: () => api.get(`/stock/transfers/${id}`).then((r) => r.data),
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(posSchema),
    defaultValues: emptyDefaults,
    mode: 'onSubmit',
  })

  const lines = watch('lines') || []
  const formValues = watch()
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [doneEdits, setDoneEdits] = useState({})
  const [walkInReady, setWalkInReady] = useState(false)

  useReturnedPartner({
    role: 'customer',
    setValue,
    setSelected: setSelectedCustomer,
  })

  useDirtyGuard(isNew && isDirty, ar ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes')

  const barcodeEnabled = true
  const variantsEnabled = !!(settings?.groupProductVariant || transfer?.settingsHints?.variantsEnabled)

  const enrichedMoves = useMemo(
    () => enrichMovesWithReserved(transfer?.moves || [], transfer?.moveLines || []),
    [transfer?.moves, transfer?.moveLines],
  )

  // Prefill Walk-in Customer
  useEffect(() => {
    if (!isNew || walkInReady) return
    let cancelled = false
    ;(async () => {
      try {
        const c = await ensureWalkInCustomer()
        if (cancelled || !c?._id) return
        setSelectedCustomer(c)
        setValue('partnerId', c._id, { shouldDirty: false })
        setWalkInReady(true)
      } catch {
        setWalkInReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [isNew, walkInReady, setValue])

  const applyOpTypeDefaults = (otId, otArg) => {
    const ot = otArg || opTypes.find((o) => String(o._id) === String(otId))
    if (!ot) return
    const whId = String(ot.warehouseId?._id || ot.warehouseId || '')
    const inWh = (l) => !whId || String(l.warehouseId?._id || l.warehouseId || '') === whId
    const isPosStock = (l) => {
      if (l.usage !== 'internal') return false
      const path = String(l.completePath || l.name || '').toLowerCase()
      return path.includes('pos') || path.includes('/pos') || /\bpos\b/.test(path)
    }
    const src = ot.defaultSourceLocationId
      || locations.find((l) => isPosStock(l) && inWh(l))?._id
      || locations.find((l) => isPosStock(l))?._id
      || locations.find((l) => l.usage === 'internal' && inWh(l) && /stock/i.test(String(l.completePath || l.name || '')))?._id
      || locations.find((l) => l.usage === 'internal' && inWh(l))?._id
      || locations.find((l) => l.usage === 'internal')?._id
      || ''
    const dest = ot.defaultDestLocationId
      || locations.find((l) => l.usage === 'customer')?._id
      || ''
    setValue('sourceLocationId', typeof src === 'object' ? src._id : (src || ''), { shouldDirty: true })
    setValue('destLocationId', typeof dest === 'object' ? dest._id : (dest || ''), { shouldDirty: true })
  }

  useEffect(() => {
    if (!transfer) return
    const next = {}
    for (const m of transfer.moves || []) {
      const done = Number(m.doneQty || 0)
      next[m._id] = done > 0 ? String(m.doneQty) : String(m.demandQty ?? '0')
    }
    setDoneEdits(next)
    if (transfer.partner) setSelectedCustomer(transfer.partner)
    if (transfer.state === 'draft') {
      reset({
        operationTypeId: transfer.operationTypeId?._id || transfer.operationTypeId || '',
        partnerId: transfer.partnerId?._id || transfer.partnerId || transfer.partner?._id || '',
        sourceLocationId: transfer.sourceLocationId?._id || transfer.sourceLocationId || '',
        destLocationId: transfer.destLocationId?._id || transfer.destLocationId || '',
        origin: transfer.origin || '',
        note: transfer.note || '',
        priority: transfer.priority || 'normal',
        lines: [],
      })
    }
  }, [transfer?._id, transfer?.state, transfer?.moves?.length, reset])

  useEffect(() => {
    if (!isNew || !opTypes.length) return
    if (getValues('operationTypeId')) return
    const first = opTypes[0]
    setValue('operationTypeId', first._id)
    applyOpTypeDefaults(first._id, first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, opTypes, locations])

  const actionMut = useMutation({
    mutationFn: ({ action, body }) => api.post(`/stock/transfers/${id}/${action}`, body || {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfer', id] })
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock-report'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const setLines = (next) => setValue('lines', next, { shouldDirty: true, shouldValidate: false })

  const onAddWithQty = (payload) => {
    const qty = Number(payload.qty)
    if (!(qty > 0)) return
    const current = getValues('lines') || []
    const key = `${payload.productId}:${payload.variantId || ''}`
    const existing = current.findIndex((l) => `${l.productId}:${l.variantId || ''}` === key)
    if (existing >= 0) {
      const linesNext = [...current]
      linesNext[existing] = {
        ...linesNext[existing],
        demandQty: String(Number(linesNext[existing].demandQty || 0) + qty),
      }
      setLines(linesNext)
      return
    }
    setLines([...current, {
      productId: payload.productId,
      productName: payload.productName || '',
      sku: payload.sku || '',
      demandQty: String(qty),
      variantId: payload.variantId || null,
      variantName: payload.variantName || '',
      variants: [],
      needsVariant: false,
    }])
  }

  const pickProduct = async (product, targetIdx = null) => {
    let variantId = null
    let variantName = ''
    let variants = []
    let needsVariant = false
    if (variantsEnabled) {
      try {
        const data = await api.get('/stock/variants', {
          params: { productId: product._id, limit: 50 },
        }).then((r) => r.data)
        const items = Array.isArray(data) ? data : (data?.items || [])
        variants = items
        if (items.length === 1) {
          variantId = items[0]._id
          variantName = items[0].name
        } else if (items.length > 1) {
          needsVariant = true
        }
      } catch { /* optional */ }
    }
    const nextLine = {
      productId: product._id,
      productName: ar && product.nameAr ? product.nameAr : (product.nameEn || product.name),
      sku: product.sku || '',
      demandQty: '1',
      variantId,
      variantName,
      variants,
      needsVariant,
      uomId: product.uomId || undefined,
      uomLabel: product.unitOfMeasure || '',
    }
    const current = getValues('lines') || []
    if (targetIdx != null && targetIdx >= 0) {
      const linesNext = [...current]
      linesNext[targetIdx] = { ...nextLine, demandQty: linesNext[targetIdx]?.demandQty || '1' }
      setLines(linesNext)
      return
    }
    setLines([...current, nextLine])
  }

  const fillAllRemaining = () => {
    const next = { ...doneEdits }
    for (const m of transfer?.moves || []) next[m._id] = String(m.demandQty ?? '0')
    setDoneEdits(next)
  }

  const incrementDone = (moveId, by = 1) => {
    setDoneEdits((prev) => {
      const current = Number(prev[moveId] != null ? prev[moveId] : 0)
      return { ...prev, [moveId]: String(current + by) }
    })
  }

  /** Fast-track: create/confirm/validate → Done in one flow. */
  const saveAndValidateNew = handleSubmit(async (values) => {
    const cleanLines = (values.lines || []).filter((l) => l.productId && Number(l.demandQty) > 0)
    if (!cleanLines.length) {
      toast.error(ar ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product')
      return
    }
    for (const l of cleanLines) {
      if (l.needsVariant && !l.variantId) {
        toast.error(ar ? 'اختر المتغير' : 'Select a variant')
        return
      }
    }
    setBusyFast(true)
    try {
      const ot = opTypes.find((o) => String(o._id) === String(values.operationTypeId))
      const warehouseId = ot?.warehouseId?._id || ot?.warehouseId
      if (warehouseId) {
        // Prefer atomic pos/consume when warehouse is known
        const done = await api.post('/stock/pos/consume', {
          warehouseId,
          partnerId: values.partnerId || undefined,
          orderRef: values.origin || undefined,
          note: values.note || undefined,
          lines: cleanLines.map((l) => ({
            productId: l.productId,
            qty: l.demandQty,
            variantId: l.variantId || undefined,
          })),
        }).then((r) => r.data)
        toast.success(ar ? 'تم الحفظ والاعتماد' : 'Saved & validated')
        qc.invalidateQueries({ queryKey: ['stock-transfers'] })
        navigate(`${LIST_PATH}/${done._id || done.id}`)
        return
      }

      const doc = await api.post('/stock/transfers', {
        operationTypeId: values.operationTypeId,
        partnerId: values.partnerId || undefined,
        sourceLocationId: values.sourceLocationId || undefined,
        destLocationId: values.destLocationId || undefined,
        origin: values.origin || undefined,
        note: values.note || undefined,
        priority: 'normal',
        lines: cleanLines.map((l) => ({
          productId: l.productId,
          demandQty: l.demandQty,
          variantId: l.variantId || undefined,
        })),
      }).then((r) => r.data)

      await api.post(`/stock/transfers/${doc._id}/confirm`)
      await api.post(`/stock/transfers/${doc._id}/validate`, {
        immediate: true,
        createBackorder: false,
      })
      toast.success(ar ? 'تم الحفظ والاعتماد' : 'Saved & validated')
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      navigate(`${LIST_PATH}/${doc._id}`)
    } catch (e) {
      toast.error(formatInvError(e, language))
    } finally {
      setBusyFast(false)
    }
  })

  const saveAndValidateExisting = async () => {
    if (transfer?.state === 'done') return
    const moves = transfer?.moves || []
    const moveQuantities = moves.map((m) => ({
      moveId: m._id,
      quantity: doneEdits[m._id] != null ? doneEdits[m._id] : (m.demandQty || '0'),
    }))
    const totalDone = moveQuantities.reduce((sum, q) => sum + (Number(q.quantity) || 0), 0)
    if (totalDone <= 0) {
      toast.error(ar ? 'كميات المنجز غير صالحة' : 'Done quantities are not valid')
      return
    }
    setBusyFast(true)
    try {
      if (transfer.state === 'draft') {
        await api.post(`/stock/transfers/${id}/confirm`)
      }
      if (['waiting', 'confirmed'].includes(transfer.state) || transfer.state === 'draft') {
        try {
          await api.post(`/stock/transfers/${id}/check-availability`)
        } catch { /* optional for pos */ }
      }
      await api.post(`/stock/transfers/${id}/validate`, {
        immediate: true,
        createBackorder: false,
        moveQuantities,
      })
      toast.success(ar ? 'تم الحفظ والاعتماد' : 'Saved & validated')
      qc.invalidateQueries({ queryKey: ['stock-transfer', id] })
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    } catch (e) {
      toast.error(formatInvError(e, language))
    } finally {
      setBusyFast(false)
    }
  }

  const onCancelTransfer = () => {
    const reason = window.prompt(ar ? 'سبب الإلغاء (اختياري):' : 'Cancel reason (optional):')
    if (reason === null) return
    actionMut.mutate({ action: 'cancel', body: { reason: reason || undefined } })
  }

  const readOnly = ['done', 'cancelled'].includes(transfer?.state)
  const isDraft = !transfer || transfer?.state === 'draft'
  const canEditDone = !readOnly && transfer && transfer.state !== 'done'
  const busy = busyFast || actionMut.isPending

  const metaReadonly = useMemo(() => {
    if (isNew || !transfer || transfer.state === 'draft') return null
    return (
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs text-slate-500">{ar ? 'العميل' : 'Customer'}</div>
          <div className="font-medium">{transfer?.partner?.name || transfer?.partnerId?.name || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{ar ? 'المرجع' : 'Origin'}</div>
          <div className="font-medium">{transfer?.origin || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{ar ? 'من' : 'From'}</div>
          <div className="font-medium text-xs">
            {formatLocationLabel(transfer?.sourceLocationId?.completePath, transfer?.sourceLocationId?.name || '—')}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{ar ? 'إلى' : 'To'}</div>
          <div className="font-medium text-xs">
            {formatLocationLabel(transfer?.destLocationId?.completePath, transfer?.destLocationId?.name || '—')}
          </div>
        </div>
      </div>
    )
  }, [isNew, transfer, ar])

  if (!isNew && isLoading) {
    return <div className="p-6 text-sm text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 pb-10">
      <PosHeader
        ar={ar}
        language={language}
        isNew={isNew}
        title={transfer?.name}
        transferState={transfer?.state}
        listPath={LIST_PATH}
        actionBar={(
          <PosActionBar
            ar={ar}
            transferState={transfer?.state}
            busy={busy}
            onSaveAndValidate={saveAndValidateExisting}
            onCancel={onCancelTransfer}
            onPrint={(
              <TransferPrintButton transfer={transfer} code="pos" settingsHints={transfer?.settingsHints} />
            )}
          />
        )}
      />

      {isNew ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveAndValidateNew()
          }}
          className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800"
        >
          <PosFormFields
            ar={ar}
            language={language}
            register={register}
            errors={errors}
            setValue={setValue}
            opTypes={opTypes}
            warehouses={warehouses}
            locations={locations}
            multiLocations={multiLocations}
            values={formValues}
            selectedCustomer={selectedCustomer}
            onCustomerChange={setSelectedCustomer}
            onOperationTypeChange={(otId) => {
              setValue('operationTypeId', otId, { shouldDirty: true })
              applyOpTypeDefaults(otId)
            }}
          />

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {ar ? 'إدخال سريع' : 'Quick Entry'}
            </div>
            <PosQuickEntry ar={ar} enabled onAddWithQty={onAddWithQty} />
          </div>

          <DeliveryDraftLines
            ar={ar}
            lines={lines}
            variantsEnabled={variantsEnabled}
            barcodeEnabled={false}
            onAddLine={() => setLines([...lines, {
              productId: '', productName: '', sku: '', demandQty: '1', variantId: null, needsVariant: false, variants: [],
            }])}
            onRemoveLine={(idx) => setLines(lines.filter((_, i) => i !== idx))}
            onChangeLine={(idx, next) => {
              const copy = [...lines]
              copy[idx] = next
              setLines(copy)
            }}
            onPickProduct={(p, idx) => pickProduct(p, idx)}
            onAddOrIncrementCreate={(p) => onAddWithQty({ ...p, qty: 1 })}
          />

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-dark-600">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {ar ? 'حفظ واعتماد' : 'Save & Validate'}
            </button>
            <Link to={LIST_PATH} className="btn btn-secondary">{ar ? 'إلغاء' : 'Cancel'}</Link>
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800">
          {isDraft ? (
            <PosFormFields
              ar={ar}
              language={language}
              register={register}
              errors={errors}
              setValue={setValue}
              opTypes={opTypes}
              warehouses={warehouses}
              locations={locations}
              multiLocations={multiLocations}
              values={{ ...formValues, _lockOperationType: true }}
              selectedCustomer={selectedCustomer}
              onCustomerChange={setSelectedCustomer}
              onOperationTypeChange={(otId) => {
                setValue('operationTypeId', otId, { shouldDirty: true })
                applyOpTypeDefaults(otId)
              }}
            />
          ) : metaReadonly}

          {!readOnly && (
            <PosQuickEntry
              ar={ar}
              enabled={barcodeEnabled}
              onAddWithQty={(payload) => {
                const move = (transfer?.moves || []).find((m) => {
                  const pid = m.productId?._id || m.productId
                  const vid = m.variantId?._id || m.variantId
                  return String(pid) === String(payload.productId)
                    && String(vid || '') === String(payload.variantId || '')
                })
                if (move) {
                  incrementDone(move._id, Number(payload.qty) || 1)
                  toast.success(`+${payload.qty}`)
                  return
                }
                toast.error(ar ? 'المنتج غير موجود في هذا الطلب' : 'Product not on this PoS order')
              }}
            />
          )}

          <div className="border-t border-slate-100 pt-4 dark:border-dark-600">
            <DeliveryLineItems
              ar={ar}
              language={language}
              moves={enrichedMoves}
              doneEdits={doneEdits}
              readOnly={readOnly}
              canEditDone={canEditDone}
              uiState={transfer?.state === 'done' ? 'done' : 'ready'}
              onDoneChange={(moveId, value) => setDoneEdits((prev) => ({ ...prev, [moveId]: value }))}
              onFillRemaining={fillAllRemaining}
              barcodeEnabled={false}
              onIncrementDone={incrementDone}
            />
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-dark-600">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={saveAndValidateExisting}
              >
                {ar ? 'حفظ واعتماد' : 'Save & Validate'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

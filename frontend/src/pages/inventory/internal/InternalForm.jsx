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
import { toDeliveryUiState, enrichMovesWithReserved } from '../deliveries/deliveryState'
import { DeliveryDraftLines, DeliveryLineItems } from '../deliveries/DeliveryLineItems'
import { InternalHeader, InternalActionBar } from './InternalHeader'
import { InternalFormFields } from './InternalFormFields'

const LIST_PATH = '/app/dashboard/inventory/internal'

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

const internalSchema = z.object({
  operationTypeId: z.string().min(1, 'Select operation type'),
  sourceLocationId: z.string().min(1, 'From location is required'),
  destLocationId: z.string().min(1, 'To location is required'),
  scheduledDate: z.string().optional(),
  deadlineDate: z.string().optional(),
  origin: z.string().optional(),
  note: z.string().optional(),
  priority: z.enum(['normal', 'urgent']),
  lines: z.array(draftLineSchema).refine(
    (rows) => rows.some((l) => l.productId && Number(l.demandQty) > 0),
    { message: 'Add at least one product' },
  ),
}).refine((v) => String(v.sourceLocationId) !== String(v.destLocationId), {
  message: 'Source and destination must differ',
  path: ['destLocationId'],
})

const emptyDefaults = {
  operationTypeId: '',
  sourceLocationId: '',
  destLocationId: '',
  scheduledDate: '',
  deadlineDate: '',
  origin: '',
  note: '',
  priority: 'normal',
  lines: [],
}

export default function InternalForm() {
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

  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types', 'internal'],
    queryFn: () => api.get('/stock/operation-types', { params: { code: 'internal' } }).then((r) => asInvList(r.data)),
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
    resolver: zodResolver(internalSchema),
    defaultValues: emptyDefaults,
    mode: 'onSubmit',
  })

  const lines = watch('lines') || []
  const formValues = watch()
  const [doneEdits, setDoneEdits] = useState({})

  useDirtyGuard(isNew && isDirty, ar ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes')

  const barcodeEnabled = !!(settings?.groupStockBarcode || transfer?.settingsHints?.barcode)
  const variantsEnabled = !!(settings?.groupProductVariant || transfer?.settingsHints?.variantsEnabled)

  const enrichedMoves = useMemo(
    () => enrichMovesWithReserved(transfer?.moves || [], transfer?.moveLines || []),
    [transfer?.moves, transfer?.moveLines],
  )

  const applyOpTypeDefaults = (otId, otArg) => {
    const ot = otArg || opTypes.find((o) => String(o._id) === String(otId))
    if (!ot) return
    const whId = String(ot.warehouseId?._id || ot.warehouseId || '')
    const stockLocs = locations.filter((l) => l.usage === 'internal' && String(l.warehouseId) === whId)
    const src = ot.defaultSourceLocationId || stockLocs[0]?._id || ''
    const dest = ot.defaultDestLocationId || stockLocs[1]?._id || stockLocs[0]?._id || ''
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
    if (transfer.state === 'draft') {
      reset({
        operationTypeId: transfer.operationTypeId?._id || transfer.operationTypeId || '',
        sourceLocationId: transfer.sourceLocationId?._id || transfer.sourceLocationId || '',
        destLocationId: transfer.destLocationId?._id || transfer.destLocationId || '',
        scheduledDate: transfer.scheduledDate
          ? new Date(transfer.scheduledDate).toISOString().slice(0, 16)
          : '',
        deadlineDate: transfer.deadlineDate
          ? new Date(transfer.deadlineDate).toISOString().slice(0, 16)
          : '',
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

  const createMut = useMutation({
    mutationFn: (body) => api.post('/stock/transfers', body).then((r) => r.data),
    onSuccess: (doc) => {
      toast.success(ar ? 'تم إنشاء التحويل' : 'Transfer created')
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      navigate(`${LIST_PATH}/${doc._id}`)
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const patchMut = useMutation({
    mutationFn: (body) => api.patch(`/stock/transfers/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['stock-transfer', id] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const actionMut = useMutation({
    mutationFn: ({ action, body }) => api.post(`/stock/transfers/${id}/${action}`, body || {}).then((r) => r.data),
    onSuccess: () => {
      toast.success(ar ? 'تم' : 'Done')
      qc.invalidateQueries({ queryKey: ['stock-transfer', id] })
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock-report'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const duplicateMut = useMutation({
    mutationFn: () => api.post(`/stock/transfers/${id}/duplicate`).then((r) => r.data),
    onSuccess: (doc) => {
      toast.success(ar ? 'تم النسخ' : 'Duplicated')
      navigate(`${LIST_PATH}/${doc._id}`)
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const setLines = (next) => setValue('lines', next, { shouldDirty: true, shouldValidate: false })

  const buildLineFromProduct = async (product) => {
    let variantId = null
    let variantName = ''
    let variants = []
    let needsVariant = false
    if (variantsEnabled) {
      try {
        const { items = [] } = await api.get('/stock/variants', {
          params: { productId: product._id, limit: 50 },
        }).then((r) => r.data)
        variants = items
        if (items.length === 1) {
          variantId = items[0]._id
          variantName = items[0].name
        } else if (items.length > 1) needsVariant = true
      } catch { /* optional */ }
    }
    return {
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
  }

  const pickProduct = async (product, targetIdx = null) => {
    const nextLine = await buildLineFromProduct(product)
    const current = getValues('lines') || []
    if (targetIdx != null && targetIdx >= 0) {
      const linesNext = [...current]
      const prev = linesNext[targetIdx] || {}
      linesNext[targetIdx] = {
        ...nextLine,
        demandQty: prev.demandQty && Number(prev.demandQty) > 0 ? prev.demandQty : nextLine.demandQty,
      }
      setLines(linesNext)
      return
    }
    const blankIdx = current.findIndex((l) => !l.productId)
    if (blankIdx >= 0) {
      const linesNext = [...current]
      linesNext[blankIdx] = nextLine
      setLines(linesNext)
      return
    }
    const key = `${nextLine.productId}:${nextLine.variantId || ''}`
    const existing = current.findIndex((l) => `${l.productId}:${l.variantId || ''}` === key && !nextLine.needsVariant)
    if (existing >= 0 && !nextLine.needsVariant) {
      const linesNext = [...current]
      linesNext[existing] = {
        ...linesNext[existing],
        demandQty: String(Number(linesNext[existing].demandQty || 0) + 1),
      }
      setLines(linesNext)
      return
    }
    setLines([...current, nextLine])
  }

  const onAddOrIncrementCreate = (payload) => {
    const current = getValues('lines') || []
    const key = `${payload.productId}:${payload.variantId || ''}`
    const existing = current.findIndex((l) => `${l.productId}:${l.variantId || ''}` === key)
    if (existing >= 0) {
      const linesNext = [...current]
      linesNext[existing] = {
        ...linesNext[existing],
        demandQty: String(Number(linesNext[existing].demandQty || 0) + 1),
      }
      setLines(linesNext)
      toast.success('+1')
      return
    }
    setLines([...current, {
      productId: payload.productId,
      productName: payload.productName || '',
      sku: payload.sku || '',
      demandQty: '1',
      variantId: payload.variantId || null,
      variantName: payload.variantName || '',
      variants: [],
      needsVariant: false,
    }])
  }

  const fillAllRemaining = () => {
    const next = { ...doneEdits }
    for (const m of transfer?.moves || []) next[m._id] = String(m.demandQty ?? '0')
    setDoneEdits(next)
  }

  const incrementDone = (moveId) => {
    setDoneEdits((prev) => {
      const current = Number(prev[moveId] != null ? prev[moveId] : 0)
      return { ...prev, [moveId]: String(current + 1) }
    })
  }

  const onCreate = handleSubmit((values) => {
    const cleanLines = (values.lines || []).filter((l) => l.productId && Number(l.demandQty) > 0)
    if (!cleanLines.length) {
      toast.error(ar ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product')
      return
    }
    createMut.mutate({
      operationTypeId: values.operationTypeId,
      sourceLocationId: values.sourceLocationId,
      destLocationId: values.destLocationId,
      scheduledDate: values.scheduledDate || undefined,
      origin: values.origin || undefined,
      note: values.note || undefined,
      priority: values.priority || 'normal',
      lines: cleanLines.map((l) => ({
        productId: l.productId,
        demandQty: l.demandQty,
        variantId: l.variantId || undefined,
        uomId: l.uomId || undefined,
      })),
    })
  }, (formErrors) => {
    const first = formErrors?.operationTypeId?.message
      || formErrors?.sourceLocationId?.message
      || formErrors?.destLocationId?.message
      || formErrors?.lines?.message
    toast.error(first || (ar ? 'تحقق من الحقول' : 'Check the form fields'))
  })

  const onValidate = () => {
    const moves = transfer?.moves || []
    const moveQuantities = moves.map((m) => ({
      moveId: m._id,
      quantity: doneEdits[m._id] != null ? doneEdits[m._id] : (m.demandQty || '0'),
    }))
    const totalDone = moveQuantities.reduce((sum, q) => sum + (Number(q.quantity) || 0), 0)
    if (totalDone <= 0) {
      toast.error(ar ? 'لا يمكن الاعتماد وكميات التحويل = 0' : 'Cannot validate with all Done quantities at 0')
      return
    }

    const diffs = moves.filter((m) => {
      const demand = Number(m.demandQty || 0)
      const done = Number(doneEdits[m._id] != null ? doneEdits[m._id] : m.demandQty || 0)
      return Math.abs(demand - done) > 1e-9
    })
    const hasPartial = diffs.some((m) => {
      const demand = Number(m.demandQty || 0)
      const done = Number(doneEdits[m._id] != null ? doneEdits[m._id] : 0)
      return done > 0 && done < demand
    })

    let createBackorder = false
    const policy = transfer?.operationTypeId?.createBackorder || 'ask'
    if (hasPartial) {
      if (policy === 'always') createBackorder = true
      else if (policy === 'ask') {
        createBackorder = window.confirm(
          ar
            ? 'كمية جزئية.\nموافق = أمر متبقٍ · إلغاء = بدون أمر متبقٍ'
            : 'Partial qty.\nOK = Backorder · Cancel = No backorder',
        )
      }
    }

    actionMut.mutate({
      action: 'validate',
      body: { immediate: true, createBackorder, moveQuantities },
    })
  }

  const onCancelTransfer = () => {
    const reason = window.prompt(ar ? 'سبب الإلغاء (اختياري):' : 'Cancel reason (optional):')
    if (reason === null) return
    actionMut.mutate({ action: 'cancel', body: { reason: reason || undefined } })
  }

  const saveDraftMeta = () => {
    const values = getValues()
    if (!values.sourceLocationId || !values.destLocationId) {
      toast.error(ar ? 'المواقع مطلوبة' : 'Locations are required')
      return
    }
    if (String(values.sourceLocationId) === String(values.destLocationId)) {
      toast.error(ar ? 'المصدر والوجهة يجب أن يختلفا' : 'Source and destination must differ')
      return
    }
    patchMut.mutate({
      sourceLocationId: values.sourceLocationId,
      destLocationId: values.destLocationId,
      scheduledDate: values.scheduledDate || null,
      origin: values.origin || '',
      note: values.note || '',
      priority: values.priority || 'normal',
    })
  }

  const uiState = toDeliveryUiState(transfer?.state)
  const readOnly = ['done', 'cancelled'].includes(transfer?.state)
  const isDraft = transfer?.state === 'draft'
  const canEditDone = !readOnly && ['assigned', 'partiallyAvailable'].includes(transfer?.state)
  const busy = actionMut.isPending || createMut.isPending || patchMut.isPending || duplicateMut.isPending

  const metaReadonly = useMemo(() => {
    if (isNew || !transfer || isDraft) return null
    return (
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs text-slate-500">{ar ? 'نوع العملية' : 'Operation type'}</div>
          <div className="font-medium">{transfer?.operationTypeId?.name || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{ar ? 'الموعد' : 'Scheduled'}</div>
          <div className="font-medium">
            {transfer?.scheduledDate ? new Date(transfer.scheduledDate).toLocaleString() : '—'}
          </div>
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
  }, [isNew, transfer, ar, isDraft])

  if (!isNew && isLoading) {
    return <div className="p-6 text-sm text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 pb-10">
      <InternalHeader
        ar={ar}
        language={language}
        isNew={isNew}
        title={transfer?.name}
        transferState={transfer?.state}
        listPath={LIST_PATH}
        actionBar={(
          <InternalActionBar
            ar={ar}
            uiState={uiState}
            busy={busy}
            onSaveDraft={isDraft ? saveDraftMeta : undefined}
            onConfirm={() => actionMut.mutate({ action: 'confirm' })}
            onCheckAvailability={() => actionMut.mutate({ action: 'check-availability' })}
            onUnreserve={() => actionMut.mutate({ action: 'unreserve' })}
            onValidate={onValidate}
            onCancel={onCancelTransfer}
            onDuplicate={() => duplicateMut.mutate()}
            onPrint={(
              <TransferPrintButton transfer={transfer} code="internal" settingsHints={transfer?.settingsHints} />
            )}
          />
        )}
      />

      {isNew ? (
        <form
          onSubmit={onCreate}
          className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800"
        >
          <InternalFormFields
            ar={ar}
            register={register}
            errors={errors}
            opTypes={opTypes}
            warehouses={warehouses}
            locations={locations}
            values={formValues}
            onOperationTypeChange={(otId) => {
              setValue('operationTypeId', otId, { shouldDirty: true })
              applyOpTypeDefaults(otId)
            }}
          />
          <DeliveryDraftLines
            ar={ar}
            lines={lines}
            variantsEnabled={variantsEnabled}
            barcodeEnabled={barcodeEnabled !== false}
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
            onAddOrIncrementCreate={onAddOrIncrementCreate}
          />
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-dark-600">
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
              {ar ? 'حفظ المسودة' : 'Save Draft'}
            </button>
            <Link to={LIST_PATH} className="btn btn-secondary">{ar ? 'إلغاء' : 'Cancel'}</Link>
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800">
          {isDraft ? (
            <InternalFormFields
              ar={ar}
              register={register}
              errors={errors}
              opTypes={opTypes}
              warehouses={warehouses}
              locations={locations}
              values={{ ...formValues, _lockOperationType: true }}
              onOperationTypeChange={(otId) => {
                setValue('operationTypeId', otId, { shouldDirty: true })
                applyOpTypeDefaults(otId)
              }}
            />
          ) : metaReadonly}
          <div className="border-t border-slate-100 pt-4 dark:border-dark-600">
            <DeliveryLineItems
              ar={ar}
              language={language}
              moves={enrichedMoves}
              doneEdits={doneEdits}
              readOnly={readOnly}
              canEditDone={canEditDone || isDraft}
              uiState={uiState}
              onDoneChange={(moveId, value) => setDoneEdits((prev) => ({ ...prev, [moveId]: value }))}
              onFillRemaining={fillAllRemaining}
              barcodeEnabled={barcodeEnabled}
              onIncrementDone={incrementDone}
            />
          </div>
        </div>
      )}
    </div>
  )
}

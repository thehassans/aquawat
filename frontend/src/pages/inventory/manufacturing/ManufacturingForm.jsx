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
import {
  formatLocationLabel,
  findManufacturingDefaultLocations,
} from '../receipts/locationLabel'
import { enrichMovesWithReserved } from '../deliveries/deliveryState'
import { DeliveryDraftLines, DeliveryLineItems } from '../deliveries/DeliveryLineItems'
import { ManufacturingHeader, ManufacturingActionBar } from './ManufacturingHeader'
import { ManufacturingFormFields, LOCATION_DIFF_MSG } from './ManufacturingFormFields'
import { ManufacturingBomPicker } from './ManufacturingBomPicker'
import { toManufacturingUiState } from './manufacturingState'
import ReverseTransferModal from '../returns/ReverseTransferModal'
import { inventoryPathForOpCode } from '../returns/returnPaths'
import { useReturnedPartner } from '../useReturnedPartner'
import { isVariantPickCancelled, useForceVariantPick } from '../../../lib/useForceVariantPick'

const LIST_PATH = '/app/dashboard/inventory/manufacturing'

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

const mfgSchema = z.object({
  operationTypeId: z.string().min(1, 'Select operation type'),
  partnerId: z.string().optional(),
  sourceLocationId: z.string().min(1, 'From location is required'),
  destLocationId: z.string().min(1, 'To location is required'),
  scheduledDate: z.string().optional(),
  origin: z.string().optional(),
  note: z.string().optional(),
  priority: z.enum(['normal', 'urgent']).optional(),
  lines: z.array(draftLineSchema).refine(
    (rows) => rows.some((l) => l.productId && Number(l.demandQty) > 0),
    { message: 'Add at least one component' },
  ),
}).refine((v) => String(v.sourceLocationId) !== String(v.destLocationId), {
  message: LOCATION_DIFF_MSG,
  path: ['destLocationId'],
})

const emptyDefaults = {
  operationTypeId: '',
  partnerId: '',
  sourceLocationId: '',
  destLocationId: '',
  scheduledDate: '',
  origin: '',
  note: '',
  priority: 'normal',
  lines: [],
}

export default function ManufacturingForm() {
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
    queryKey: ['stock-op-types', 'manufacturing'],
    queryFn: () => api.get('/stock/operation-types', { params: { code: 'manufacturing' } }).then((r) => asInvList(r.data)),
    staleTime: 10 * 60 * 1000,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
    staleTime: 10 * 60 * 1000,
  })

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
    resolver: zodResolver(mfgSchema),
    defaultValues: emptyDefaults,
    mode: 'onChange',
  })

  const lines = watch('lines') || []
  const formValues = watch()
  const watchSource = watch('sourceLocationId')
  const watchDest = watch('destLocationId')
  const sameLocation = Boolean(watchSource && watchDest && String(watchSource) === String(watchDest))
  const [doneEdits, setDoneEdits] = useState({})
  const [returnOpen, setReturnOpen] = useState(false)
  const [showPartner, setShowPartner] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [finishedGood, setFinishedGood] = useState(null)
  const [produceQty, setProduceQty] = useState('1')

  useReturnedPartner({
    role: 'customer',
    setValue,
    setSelected: setSelectedPartner,
    showPartner: () => setShowPartner(true),
  })

  useDirtyGuard(isNew && isDirty, ar ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes')

  const barcodeEnabled = !!(settings?.groupStockBarcode || transfer?.settingsHints?.barcode)
  const variantsEnabled = !!(settings?.groupProductVariant || transfer?.settingsHints?.variantsEnabled)
  const { resolvePick, forceVariantModal } = useForceVariantPick({ ar, variantsEnabled })

  const enrichedMoves = useMemo(
    () => enrichMovesWithReserved(transfer?.moves || [], transfer?.moveLines || []),
    [transfer?.moves, transfer?.moveLines],
  )

  const applyOpTypeDefaults = (otId, otArg) => {
    const ot = otArg || opTypes.find((o) => String(o._id) === String(otId))
    if (!ot) return
    const whId = String(ot.warehouseId?._id || ot.warehouseId || '')
    const defaults = findManufacturingDefaultLocations(locations, whId)
    const src = ot.defaultSourceLocationId || defaults.sourceLocationId || ''
    const dest = ot.defaultDestLocationId || defaults.destLocationId || ''
    const srcId = typeof src === 'object' ? src._id : (src || '')
    let destId = typeof dest === 'object' ? dest._id : (dest || '')
    if (srcId && destId && String(srcId) === String(destId)) {
      destId = defaults.destLocationId && String(defaults.destLocationId) !== String(srcId)
        ? defaults.destLocationId
        : ''
    }
    setValue('sourceLocationId', srcId || '', { shouldDirty: true, shouldValidate: true })
    setValue('destLocationId', destId || '', { shouldDirty: true, shouldValidate: true })
  }

  useEffect(() => {
    if (!transfer) return
    const next = {}
    for (const m of transfer.moves || []) {
      const done = Number(m.doneQty || 0)
      next[m._id] = done > 0 ? String(m.doneQty) : String(m.demandQty ?? '0')
    }
    setDoneEdits(next)
    if (transfer.partner) {
      setSelectedPartner(transfer.partner)
      setShowPartner(true)
    }
    if (transfer.state === 'draft') {
      reset({
        operationTypeId: transfer.operationTypeId?._id || transfer.operationTypeId || '',
        partnerId: transfer.partnerId?._id || transfer.partnerId || transfer.partner?._id || '',
        sourceLocationId: transfer.sourceLocationId?._id || transfer.sourceLocationId || '',
        destLocationId: transfer.destLocationId?._id || transfer.destLocationId || '',
        scheduledDate: transfer.scheduledDate
          ? new Date(transfer.scheduledDate).toISOString().slice(0, 16)
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
      toast.success(ar ? 'تم إنشاء أمر التصنيع' : 'Manufacturing order created')
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

  const setLines = (next) => setValue('lines', next, { shouldDirty: true, shouldValidate: false })

  const buildLineFromProduct = async (product) => {
    const resolved = await resolvePick(product.kind || product.variantId ? product : {
      kind: 'product',
      productId: product._id || product.productId,
      productName: product.nameEn || product.name || product.productName,
      name: product.nameEn || product.name,
      nameAr: product.nameAr,
      sku: product.sku,
      uomId: product.uomId,
      unitOfMeasure: product.unitOfMeasure,
      productHasVariants: product.productHasVariants,
    })
    return {
      productId: resolved.productId,
      productName: ar && product.nameAr ? product.nameAr : resolved.productName,
      sku: resolved.sku,
      demandQty: '1',
      variantId: resolved.variantId,
      variantName: resolved.variantName,
      variants: resolved.variants,
      needsVariant: resolved.needsVariant,
      productHasVariants: resolved.productHasVariants,
      uomId: resolved.uomId || product.uomId || undefined,
      uomLabel: resolved.uomLabel || product.unitOfMeasure || '',
    }
  }

  const pickProduct = async (product, targetIdx = null) => {
    let nextLine
    try {
      nextLine = await buildLineFromProduct(product)
    } catch (e) {
      if (isVariantPickCancelled(e)) return
      throw e
    }
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
    if (String(values.sourceLocationId) === String(values.destLocationId)) {
      toast.error(ar ? 'يجب أن يختلف موقع المصدر عن الوجهة.' : LOCATION_DIFF_MSG)
      return
    }
    const cleanLines = (values.lines || []).filter((l) => l.productId && Number(l.demandQty) > 0)
    if (!cleanLines.length) {
      toast.error(ar ? 'أضف مكوناً واحداً على الأقل' : 'Add at least one component')
      return
    }
    for (const l of cleanLines) {
      if (l.needsVariant && !l.variantId) {
        toast.error(ar ? 'اختر المتغير لكل مكون' : 'Select a variant for each component')
        return
      }
    }
    createMut.mutate({
      operationTypeId: values.operationTypeId,
      partnerId: values.partnerId || undefined,
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

  const onProduce = () => {
    const moves = transfer?.moves || []
    const moveQuantities = moves.map((m) => ({
      moveId: m._id,
      quantity: doneEdits[m._id] != null ? doneEdits[m._id] : (m.demandQty || '0'),
    }))
    const totalDone = moveQuantities.reduce((sum, q) => sum + (Number(q.quantity) || 0), 0)
    if (totalDone <= 0) {
      toast.error(ar ? 'لا يمكن الإنتاج وكميات المنجز = 0' : 'Cannot produce with all Done quantities at 0')
      return
    }
    actionMut.mutate({
      action: 'validate',
      body: { immediate: true, createBackorder: false, moveQuantities },
    })
  }

  const onCancelTransfer = () => {
    const reason = window.prompt(ar ? 'سبب الإلغاء (اختياري):' : 'Cancel reason (optional):')
    if (reason === null) return
    actionMut.mutate({ action: 'cancel', body: { reason: reason || undefined } })
  }

  const onReturn = () => setReturnOpen(true)

  const onScrap = async () => {
    try {
      const scrapLocs = await api.get('/stock/locations', { params: { usage: 'scrap' } })
        .then((r) => asInvList(r.data))
      const scrapLocationId = scrapLocs[0]?._id
      if (!scrapLocationId) {
        toast.error(ar ? 'لا يوجد موقع خردة' : 'No scrap location configured')
        return
      }
      const sourceLocationId = transfer?.sourceLocationId?._id || transfer?.sourceLocationId
      const linesPayload = (transfer?.moves || [])
        .map((m) => {
          const qty = doneEdits[m._id] != null
            ? Number(doneEdits[m._id])
            : Number(m.doneQty || m.demandQty || 0)
          if (!(qty > 0)) return null
          return {
            productId: m.productId?._id || m.productId,
            quantity: String(qty),
            variantId: m.variantId?._id || m.variantId || undefined,
            uomId: m.uomId?._id || m.uomId || undefined,
          }
        })
        .filter(Boolean)
      if (!linesPayload.length) {
        toast.error(ar ? 'لا توجد كميات للخردة' : 'No quantities to scrap')
        return
      }
      const doc = await api.post('/stock/scraps', {
        sourceLocationId,
        scrapLocationId,
        reasonTag: `MO ${transfer?.name || id}`,
        lines: linesPayload,
      }).then((r) => r.data)
      const items = Array.isArray(doc?.items) ? doc.items : (Array.isArray(doc) ? doc : [doc]).filter(Boolean)
      toast.success(ar ? 'تم إنشاء خردة' : 'Scrap created')
      if (items[0]?._id) navigate(`/app/dashboard/inventory/scrap/${items[0]._id}`)
      else navigate('/app/dashboard/inventory/scrap')
    } catch (e) {
      toast.error(formatInvError(e, language))
    }
  }

  const saveDraftMeta = () => {
    const values = getValues()
    if (!values.sourceLocationId || !values.destLocationId) {
      toast.error(ar ? 'المواقع مطلوبة' : 'Locations are required')
      return
    }
    if (String(values.sourceLocationId) === String(values.destLocationId)) {
      toast.error(ar ? 'يجب أن يختلف موقع المصدر عن الوجهة.' : LOCATION_DIFF_MSG)
      return
    }
    patchMut.mutate({
      partnerId: values.partnerId || null,
      sourceLocationId: values.sourceLocationId,
      destLocationId: values.destLocationId,
      scheduledDate: values.scheduledDate || null,
      origin: values.origin || '',
      note: values.note || '',
      priority: values.priority || 'normal',
    })
  }

  const uiState = toManufacturingUiState(transfer?.state)
  // Delivery line highlight uses 'ready' — map manufacturing ready the same way
  const lineUiState = uiState === 'ready' ? 'ready' : uiState
  const readOnly = ['done', 'cancelled'].includes(transfer?.state)
  const isDraft = transfer?.state === 'draft'
  const canEditDone = !readOnly && !['draft', 'done', 'cancelled'].includes(transfer?.state)
  const busy = actionMut.isPending || createMut.isPending || patchMut.isPending
  const saveDisabled = sameLocation || createMut.isPending || patchMut.isPending

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
      {forceVariantModal}
      <ManufacturingHeader
        ar={ar}
        language={language}
        isNew={isNew}
        title={transfer?.name}
        transferState={transfer?.state}
        listPath={LIST_PATH}
        actionBar={(
          <ManufacturingActionBar
            ar={ar}
            uiState={uiState}
            busy={busy}
            saveDisabled={saveDisabled}
            onSaveDraft={isDraft ? saveDraftMeta : undefined}
            onConfirm={() => actionMut.mutate({ action: 'confirm' })}
            onCheckAvailability={() => actionMut.mutate({ action: 'check-availability' })}
            onProduce={onProduce}
            onCancel={onCancelTransfer}
            onReturn={onReturn}
            onScrap={onScrap}
            onPrint={(
              <TransferPrintButton transfer={transfer} code="manufacturing" settingsHints={transfer?.settingsHints} />
            )}
          />
        )}
      />

      {isNew ? (
        <form
          onSubmit={onCreate}
          className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800"
        >
          <ManufacturingFormFields
            ar={ar}
            language={language}
            register={register}
            errors={errors}
            setValue={setValue}
            opTypes={opTypes}
            warehouses={warehouses}
            locations={locations}
            values={formValues}
            watchSource={watchSource}
            watchDest={watchDest}
            selectedPartner={selectedPartner}
            onPartnerChange={setSelectedPartner}
            showPartner={showPartner}
            onTogglePartner={() => setShowPartner((v) => !v)}
            onOperationTypeChange={(otId) => {
              setValue('operationTypeId', otId, { shouldDirty: true })
              applyOpTypeDefaults(otId)
            }}
          />
          <ManufacturingBomPicker
            ar={ar}
            produceQty={produceQty}
            onProduceQtyChange={setProduceQty}
            selectedFinished={finishedGood}
            onFinishedChange={setFinishedGood}
            onBomLines={(bomLines) => setLines(bomLines)}
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
            <button type="submit" className="btn btn-primary" disabled={saveDisabled}>
              {ar ? 'حفظ المسودة' : 'Save Draft'}
            </button>
            <Link to={LIST_PATH} className="btn btn-secondary">{ar ? 'إلغاء' : 'Cancel'}</Link>
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800">
          {isDraft ? (
            <ManufacturingFormFields
              ar={ar}
              language={language}
              register={register}
              errors={errors}
              setValue={setValue}
              opTypes={opTypes}
              warehouses={warehouses}
              locations={locations}
              values={{ ...formValues, _lockOperationType: true }}
              watchSource={watchSource}
              watchDest={watchDest}
              selectedPartner={selectedPartner}
              onPartnerChange={setSelectedPartner}
              showPartner={showPartner}
              onTogglePartner={() => setShowPartner((v) => !v)}
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
              uiState={lineUiState}
              onDoneChange={(moveId, value) => setDoneEdits((prev) => ({ ...prev, [moveId]: value }))}
              onFillRemaining={fillAllRemaining}
              barcodeEnabled={barcodeEnabled}
              onIncrementDone={incrementDone}
            />
          </div>
        </div>
      )}

      <ReverseTransferModal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        transferId={id}
        transfer={transfer}
        ar={ar}
        language={language}
        onCreated={(ret) => {
          const path = inventoryPathForOpCode(ret.operationTypeId?.code || 'internal')
          navigate(`/app/dashboard/inventory/${path}/${ret._id}`)
        }}
      />
    </div>
  )
}

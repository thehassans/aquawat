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
import { formatLocationLabel } from './locationLabel'
import { toReceiptUiState } from './opTypeGroups'
import { ReceiptHeader, ReceiptActionBar } from './ReceiptHeader'
import { ReceiptFormFields } from './ReceiptFormFields'
import { ReceiptDraftLines, ReceiptLineItems } from './ReceiptLineItems'

const LIST_PATH = '/app/dashboard/inventory/receipts'

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

const receiptSchema = z.object({
  operationTypeId: z.string().min(1, 'Select operation type'),
  partnerId: z.string().optional(),
  sourceLocationId: z.string().optional(),
  destLocationId: z.string().optional(),
  scheduledDate: z.string().optional(),
  deadlineDate: z.string().optional(),
  origin: z.string().optional(),
  note: z.string().optional(),
  priority: z.enum(['normal', 'urgent']),
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
  scheduledDate: '',
  deadlineDate: '',
  origin: '',
  note: '',
  priority: 'normal',
  lines: [],
}

export default function ReceiptForm() {
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
    queryKey: ['stock-op-types', 'incoming'],
    queryFn: () => api.get('/stock/operation-types', { params: { code: 'incoming' } }).then((r) => asInvList(r.data)),
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

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-lite'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((r) => r.data?.suppliers || r.data || []),
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
    resolver: zodResolver(receiptSchema),
    defaultValues: emptyDefaults,
    mode: 'onSubmit',
  })

  const lines = watch('lines') || []
  const formValues = watch()

  useDirtyGuard(isNew && isDirty, ar ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes')

  const barcodeEnabled = !!(settings?.groupStockBarcode || transfer?.settingsHints?.barcode)
  const variantsEnabled = !!(settings?.groupProductVariant || transfer?.settingsHints?.variantsEnabled)

  const [doneEdits, setDoneEdits] = useState({})

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
        partnerId: transfer.partnerId?._id || transfer.partnerId || transfer.partner?._id || '',
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

  // Smart defaults when creating
  useEffect(() => {
    if (!isNew || !opTypes.length) return
    const current = getValues('operationTypeId')
    if (current) return
    const first = opTypes[0]
    setValue('operationTypeId', first._id)
    applyOpTypeDefaults(first._id, first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, opTypes])

  const applyOpTypeDefaults = (otId, otArg) => {
    const ot = otArg || opTypes.find((o) => String(o._id) === String(otId))
    if (!ot) return
    const src = ot.defaultSourceLocationId
      || locations.find((l) => l.usage === 'vendor')?._id
      || ''
    const dest = ot.defaultDestLocationId
      || locations.find((l) => l.usage === 'internal' && String(l.warehouseId) === String(ot.warehouseId?._id || ot.warehouseId))?._id
      || locations.find((l) => l.usage === 'internal')?._id
      || ''
    setValue('sourceLocationId', typeof src === 'object' ? src._id : (src || ''), { shouldDirty: true })
    setValue('destLocationId', typeof dest === 'object' ? dest._id : (dest || ''), { shouldDirty: true })
  }

  const createMut = useMutation({
    mutationFn: (body) => api.post('/stock/transfers', body).then((r) => r.data),
    onSuccess: (doc) => {
      toast.success(ar ? 'تم إنشاء الاستلام' : 'Receipt created')
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
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
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
        } else if (items.length > 1) {
          needsVariant = true
        }
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

  const setLines = (next) => setValue('lines', next, { shouldDirty: true, shouldValidate: false })

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
      toast.success(ar ? '+1' : '+1')
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
    toast.success(ar ? 'تمت الإضافة' : 'Added')
  }

  /** Optimistic fill-all-remaining */
  const fillAllRemaining = () => {
    const next = { ...doneEdits }
    for (const m of transfer?.moves || []) {
      next[m._id] = String(m.demandQty ?? '0')
    }
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
    for (const l of cleanLines) {
      if (l.needsVariant && !l.variantId) {
        toast.error(ar ? 'اختر المتغير لكل منتج متعدد المتغيرات' : 'Select a variant for each multi-variant product')
        return
      }
    }
    createMut.mutate({
      operationTypeId: values.operationTypeId,
      partnerId: values.partnerId || undefined,
      sourceLocationId: values.sourceLocationId || undefined,
      destLocationId: values.destLocationId || undefined,
      scheduledDate: values.scheduledDate || undefined,
      deadlineDate: values.deadlineDate || undefined,
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
      || formErrors?.lines?.message
      || formErrors?.lines?.[0]?.productId?.message
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
      const ok = window.confirm(
        ar
          ? 'جميع كميات الاستلام = 0. المتابعة وإنشاء مرتجع/backorder؟'
          : 'All received quantities are 0. Continue and create a backorder?',
      )
      if (!ok) return
    }

    const diffs = moves.filter((m) => {
      const demand = Number(m.demandQty || 0)
      const done = Number(doneEdits[m._id] != null ? doneEdits[m._id] : m.demandQty || 0)
      return Math.abs(demand - done) > 1e-9
    })

    if (diffs.length && totalDone > 0) {
      const summary = diffs
        .slice(0, 8)
        .map((m) => {
          const name = m.productId?.nameEn || m.productId?.sku || '—'
          const done = doneEdits[m._id] != null ? doneEdits[m._id] : m.demandQty
          return `${name}: demand ${m.demandQty} → done ${done}`
        })
        .join('\n')
      const ok = window.confirm(
        (ar ? 'فرق بين الطلب والمستلم:\n' : 'Difference between demand and done:\n')
          + summary
          + (ar ? '\n\nالمتابعة؟' : '\n\nContinue?'),
      )
      if (!ok) return
    }

    const policy = transfer?.operationTypeId?.createBackorder || 'ask'
    let createBackorder = false
    const hasPartial = diffs.some((m) => {
      const demand = Number(m.demandQty || 0)
      const done = Number(doneEdits[m._id] != null ? doneEdits[m._id] : 0)
      return done > 0 && done < demand
    })
    if (policy === 'always' || totalDone <= 0) {
      createBackorder = true
    } else if (policy === 'ask' && hasPartial) {
      createBackorder = window.confirm(
        ar
          ? 'كمية جزئية — إنشاء أمر متبقٍ (backorder)؟\nموافق = نعم · إلغاء = إسقاط المتبقي'
          : 'Partial qty — create a backorder for the remainder?\nOK = yes · Cancel = drop remainder',
      )
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

  const onReturn = async () => {
    try {
      const wiz = await api.get(`/stock/transfers/${id}/return-wizard`).then((r) => r.data)
      const retLines = (wiz.lines || []).map((l) => ({ moveId: l.moveId, quantity: l.quantity }))
      const ret = await api.post(`/stock/transfers/${id}/return`, { lines: retLines }).then((r) => r.data)
      toast.success(ar ? 'تم إنشاء المرتجع' : 'Return created')
      const retCode = ret.operationTypeId?.code || 'outgoing'
      const path = retCode === 'incoming' ? 'receipts' : retCode === 'outgoing' ? 'deliveries' : 'internal'
      navigate(`/app/dashboard/inventory/${path}/${ret._id}`)
    } catch (e) {
      toast.error(formatInvError(e, language))
    }
  }

  const uiState = toReceiptUiState(transfer?.state)
  const readOnly = ['done', 'cancelled'].includes(transfer?.state)
  const isDraft = transfer?.state === 'draft'
  const canEditDone = !readOnly && ['confirmed', 'assigned', 'waiting', 'partiallyAvailable'].includes(transfer?.state)
  const busy = actionMut.isPending || createMut.isPending || duplicateMut.isPending || patchMut.isPending

  const saveDraftMeta = () => {
    const values = getValues()
    patchMut.mutate({
      partnerId: values.partnerId || null,
      sourceLocationId: values.sourceLocationId || undefined,
      destLocationId: values.destLocationId || undefined,
      scheduledDate: values.scheduledDate || null,
      deadlineDate: values.deadlineDate || null,
      origin: values.origin || '',
      note: values.note || '',
      priority: values.priority || 'normal',
    })
  }

  const metaReadonly = useMemo(() => {
    if (isNew || !transfer) return null
    return (
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs text-slate-500">{ar ? 'نوع العملية' : 'Operation type'}</div>
          <div className="font-medium text-slate-800 dark:text-slate-100">
            {transfer?.operationTypeId?.name || '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{ar ? 'استلام من' : 'Receive From'}</div>
          <div className="font-medium text-slate-800 dark:text-slate-100">
            {transfer?.partner
              ? (ar && transfer.partner.nameAr
                ? transfer.partner.nameAr
                : (transfer.partner.name || transfer.partner.nameEn))
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{ar ? 'الموعد' : 'Scheduled'}</div>
          <div className="font-medium text-slate-800 dark:text-slate-100">
            {transfer?.scheduledDate ? new Date(transfer.scheduledDate).toLocaleString() : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{ar ? 'الأصل' : 'Origin'}</div>
          <div className="font-medium text-slate-800 dark:text-slate-100">{transfer?.origin || '—'}</div>
        </div>
        {multiLocations && (
          <>
            <div>
              <div className="text-xs text-slate-500">{ar ? 'المصدر' : 'Source'}</div>
              <div className="font-medium text-xs text-slate-700 dark:text-slate-200">
                {formatLocationLabel(
                  transfer?.sourceLocationId?.completePath,
                  transfer?.sourceLocationId?.name || '—',
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{ar ? 'الوجهة' : 'Destination'}</div>
              <div className="font-medium text-xs text-slate-700 dark:text-slate-200">
                {formatLocationLabel(
                  transfer?.destLocationId?.completePath,
                  transfer?.destLocationId?.name || '—',
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }, [isNew, transfer, ar, multiLocations])

  if (!isNew && isLoading) {
    return <div className="p-6 text-sm text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 pb-10">
      <ReceiptHeader
        ar={ar}
        language={language}
        isNew={isNew}
        title={transfer?.name}
        transferState={transfer?.state}
        listPath={LIST_PATH}
        actionBar={(
          <ReceiptActionBar
            ar={ar}
            uiState={uiState}
            busy={busy}
            onSaveDraft={isDraft ? saveDraftMeta : undefined}
            onConfirm={() => actionMut.mutate({ action: 'confirm' })}
            onValidate={onValidate}
            onFillRemaining={fillAllRemaining}
            onCancel={onCancelTransfer}
            onReturn={onReturn}
            onDuplicate={() => duplicateMut.mutate()}
            onPrint={(
              <TransferPrintButton transfer={transfer} code="incoming" settingsHints={transfer?.settingsHints} />
            )}
          />
        )}
      />

      {isNew ? (
        <form
          onSubmit={onCreate}
          className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800"
        >
          <ReceiptFormFields
            ar={ar}
            register={register}
            errors={errors}
            opTypes={opTypes}
            warehouses={warehouses}
            locations={locations}
            suppliers={suppliers}
            multiLocations={multiLocations}
            values={formValues}
            onOperationTypeChange={(otId) => {
              setValue('operationTypeId', otId, { shouldDirty: true })
              applyOpTypeDefaults(otId)
            }}
          />

          <ReceiptDraftLines
            ar={ar}
            lines={lines}
            variantsEnabled={variantsEnabled}
            barcodeEnabled={barcodeEnabled !== false}
            onAddLine={() => setLines([...lines, {
              productId: '',
              productName: '',
              sku: '',
              demandQty: '1',
              variantId: null,
              needsVariant: false,
              variants: [],
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

          {errors?.lines?.message && (
            <p className="text-xs text-rose-600">{errors.lines.message}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-dark-600">
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
              {ar ? 'حفظ المسودة' : 'Save Draft'}
            </button>
            <Link to={LIST_PATH} className="btn btn-secondary">
              {ar ? 'إلغاء' : 'Cancel'}
            </Link>
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-600 dark:bg-dark-800">
          {isDraft ? (
            <ReceiptFormFields
              ar={ar}
              register={register}
              errors={errors}
              opTypes={opTypes}
              warehouses={warehouses}
              locations={locations}
              suppliers={suppliers}
              multiLocations={multiLocations}
              values={{ ...formValues, _lockOperationType: true }}
              readOnly={false}
              onOperationTypeChange={(otId) => {
                setValue('operationTypeId', otId, { shouldDirty: true })
                applyOpTypeDefaults(otId)
              }}
            />
          ) : metaReadonly}
          <div className="border-t border-slate-100 pt-4 dark:border-dark-600">
            <ReceiptLineItems
              ar={ar}
              language={language}
              moves={transfer?.moves || []}
              doneEdits={doneEdits}
              readOnly={readOnly}
              canEditDone={canEditDone || isDraft}
              onDoneChange={(moveId, value) => setDoneEdits((prev) => ({ ...prev, [moveId]: value }))}
              onFillRemaining={fillAllRemaining}
              barcodeEnabled={barcodeEnabled}
              onIncrementDone={incrementDone}
            />
          </div>
          {!isDraft && transfer?.note ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-dark-900/40 dark:text-slate-300">
              {transfer.note}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

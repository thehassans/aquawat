import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import ProductChooser from '../../components/inventory/ProductChooser'
import { StatusChip } from './inventoryUi'
import { TransferPrintButton } from './TransferPrint'

const CODE_FROM_PATH = () => {
  const parts = window.location.pathname.split('/')
  const i = parts.indexOf('inventory')
  const seg = parts[i + 1]
  if (seg === 'receipts') return 'incoming'
  if (seg === 'deliveries') return 'outgoing'
  return 'internal'
}

const STEPS = ['draft', 'waiting', 'assigned', 'done']

export default function TransferForm() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const code = CODE_FROM_PATH()
  const listPath = `/app/dashboard/inventory/${
    code === 'incoming' ? 'receipts' : code === 'outgoing' ? 'deliveries' : 'internal'
  }`
  const partnerLabel = code === 'incoming'
    ? (ar ? 'استلام من' : 'Receive From')
    : code === 'outgoing'
      ? (ar ? 'تسليم إلى' : 'Deliver To')
      : (ar ? 'الشريك' : 'Partner')

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types', code],
    queryFn: () => api.get('/stock/operation-types', { params: { code } }).then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data),
    enabled: settings?.groupStockMultiLocations !== false,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-lite'],
    queryFn: () => api.get('/customers', { params: { limit: 200 } }).then((r) => r.data?.customers || r.data || []),
    enabled: code !== 'internal',
  })

  const { data: transfer, isLoading } = useQuery({
    queryKey: ['stock-transfer', id],
    enabled: !isNew,
    queryFn: () => api.get(`/stock/transfers/${id}`).then((r) => r.data),
  })

  const [form, setForm] = useState({
    operationTypeId: '',
    partnerId: '',
    sourceLocationId: '',
    destLocationId: '',
    scheduledDate: '',
    origin: '',
    note: '',
    priority: 'normal',
    lines: [],
  })
  const [tab, setTab] = useState('operations')
  const [logNote, setLogNote] = useState('')
  const [signedBy, setSignedBy] = useState('')
  const [barcodeBuf, setBarcodeBuf] = useState('')
  const [carrierId, setCarrierId] = useState('')
  const [trackingReference, setTrackingReference] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [ratePreview, setRatePreview] = useState(null)

  const hints = transfer?.settingsHints || {
    multiLocations: settings?.groupStockMultiLocations !== false,
    barcode: !!settings?.groupStockBarcode,
    signatureRequired: !!(settings?.signatureOnDelivery || settings?.groupStockSignDelivery),
    partnerWarnings: !!settings?.groupStockWarning,
    showDetailedOps: false,
    lotsEnabled: !!(settings?.groupProductionLot || settings?.groupStockTrackingLot),
    showLotsOnDeliverySlips: !!(settings?.showLotsOnDeliverySlips || settings?.groupLotOnDeliverySlip),
    variantsEnabled: !!settings?.groupProductVariant,
    deliveryMethods: !!settings?.groupDeliveryMethods,
  }

  const { data: carriersData } = useQuery({
    queryKey: ['delivery-carriers'],
    queryFn: () => api.get('/stock/delivery-carriers').then((r) => r.data),
    enabled: code === 'outgoing' && !!(hints.deliveryMethods || settings?.groupDeliveryMethods),
  })
  const carriers = carriersData?.items || []

  useEffect(() => {
    if (!transfer) return
    setCarrierId(transfer.carrierId?._id || transfer.carrierId || '')
    setTrackingReference(transfer.trackingReference || '')
    setShippingCost(transfer.shippingCost != null ? String(transfer.shippingCost) : '')
  }, [transfer?._id])

  const activeOpType = useMemo(
    () => opTypes.find((o) => o._id === (form.operationTypeId || transfer?.operationTypeId?._id || transfer?.operationTypeId)) || opTypes[0],
    [opTypes, form.operationTypeId, transfer],
  )

  useEffect(() => {
    if (!isNew || !activeOpType) return
    setForm((f) => ({
      ...f,
      operationTypeId: f.operationTypeId || activeOpType._id,
      sourceLocationId: f.sourceLocationId || activeOpType.defaultSourceLocationId || '',
      destLocationId: f.destLocationId || activeOpType.defaultDestLocationId || '',
    }))
  }, [isNew, activeOpType])

  const createMut = useMutation({
    mutationFn: (body) => api.post('/stock/transfers', body).then((r) => r.data),
    onSuccess: (doc) => {
      toast.success(ar ? 'تم الإنشاء' : 'Created')
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      navigate(`${listPath}/${doc._id}`)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const patchMut = useMutation({
    mutationFn: (body) => api.patch(`/stock/transfers/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['stock-transfer', id] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const actionMut = useMutation({
    mutationFn: ({ action, body }) => api.post(`/stock/transfers/${id}/${action}`, body || {}).then((r) => r.data),
    onSuccess: () => {
      toast.success(ar ? 'تم' : 'Done')
      qc.invalidateQueries({ queryKey: ['stock-transfer', id] })
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      qc.invalidateQueries({ queryKey: ['physical-inventory'] })
      qc.invalidateQueries({ queryKey: ['stock-report'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const applyOpType = (otId) => {
    const ot = opTypes.find((o) => String(o._id) === String(otId))
    setForm((f) => ({
      ...f,
      operationTypeId: otId,
      sourceLocationId: ot?.defaultSourceLocationId || f.sourceLocationId,
      destLocationId: ot?.defaultDestLocationId || f.destLocationId,
    }))
  }

  const onCreate = (e) => {
    e.preventDefault()
    const operationTypeId = form.operationTypeId || activeOpType?._id
    if (!operationTypeId) {
      toast.error(ar ? 'اختر نوع العملية' : 'Select operation type')
      return
    }
    const lines = form.lines.filter((l) => l.productId && l.demandQty)
    if (!lines.length) {
      toast.error(ar ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product')
      return
    }
    const partner = customers.find((c) => String(c._id) === String(form.partnerId))
    if (hints.partnerWarnings && partner?.stockWarn === 'block') {
      toast.error(partner.stockWarnMsg || (ar ? 'الشريك محظور' : 'Partner blocked'))
      return
    }
    if (hints.partnerWarnings && partner?.stockWarn === 'warning') {
      toast(partner.stockWarnMsg || (ar ? 'تحذير شريك' : 'Partner warning'), { icon: '⚠️' })
    }
    createMut.mutate({
      operationTypeId,
      partnerId: form.partnerId || undefined,
      sourceLocationId: form.sourceLocationId || undefined,
      destLocationId: form.destLocationId || undefined,
      scheduledDate: form.scheduledDate || undefined,
      origin: form.origin,
      note: form.note,
      priority: form.priority,
      carrierId: carrierId || undefined,
      trackingReference: trackingReference || undefined,
      shippingCost: shippingCost || undefined,
      lines: lines.map((l) => ({
        productId: l.productId,
        demandQty: l.demandQty,
        variantId: l.variantId || undefined,
      })),
    })
  }

  const quoteCarrier = async (id) => {
    if (!id) {
      setRatePreview(null)
      setShippingCost('')
      return
    }
    try {
      const rate = await api.post(`/stock/delivery-carriers/${id}/rate`, {}).then((r) => r.data)
      setRatePreview(rate)
      setShippingCost(rate.price)
    } catch (e) {
      setRatePreview(null)
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const pickProduct = async (product) => {
    let variantId = null
    let variantName = ''
    if (hints.variantsEnabled || settings?.groupProductVariant) {
      try {
        const { items = [] } = await api.get('/stock/variants', {
          params: { productId: product._id, limit: 50 },
        }).then((r) => r.data)
        if (items.length === 1) {
          variantId = items[0]._id
          variantName = items[0].name
        } else if (items.length > 1) {
          const labels = items.map((v, i) => `${i + 1}. ${v.name}`).join('\n')
          const choice = window.prompt(
            (ar ? 'اختر متغيرًا (رقم):\n' : 'Pick a variant (number):\n') + labels,
            '1',
          )
          const idx = Math.max(0, (Number(choice) || 1) - 1)
          if (items[idx]) {
            variantId = items[idx]._id
            variantName = items[idx].name
          }
        }
      } catch {
        /* variants optional */
      }
    }

    setForm((f) => {
      const lineKey = (l) => `${l.productId}:${l.variantId || ''}`
      const nextKey = `${product._id}:${variantId || ''}`
      const existing = f.lines.findIndex((l) => lineKey(l) === nextKey)
      if (existing >= 0) {
        const lines = [...f.lines]
        const nextQty = String(Number(lines[existing].demandQty || 0) + 1)
        lines[existing] = { ...lines[existing], demandQty: nextQty }
        return { ...f, lines }
      }
      return {
        ...f,
        lines: [
          ...f.lines,
          {
            productId: product._id,
            productName: ar && product.nameAr ? product.nameAr : product.name,
            sku: product.sku,
            demandQty: '1',
            variantId,
            variantName,
          },
        ],
      }
    })
  }

  const scanBarcode = async () => {
    const q = barcodeBuf.trim()
    if (!q) return
    try {
      if (hints.variantsEnabled || settings?.groupProductVariant) {
        const variants = await api.get('/stock/variants', { params: { q, limit: 5 } }).then((r) => r.data?.items || [])
        const hit = variants.find((v) => v.barcode === q || v.sku === q)
        if (hit?.productId) {
          const product = typeof hit.productId === 'object'
            ? hit.productId
            : { _id: hit.productId, name: hit.productId?.nameEn, sku: hit.productId?.sku }
          setForm((f) => {
            const nextKey = `${product._id || hit.productId}:${hit._id}`
            const existing = f.lines.findIndex((l) => `${l.productId}:${l.variantId || ''}` === nextKey)
            if (existing >= 0) {
              const lines = [...f.lines]
              lines[existing] = { ...lines[existing], demandQty: String(Number(lines[existing].demandQty || 0) + 1) }
              return { ...f, lines }
            }
            return {
              ...f,
              lines: [...f.lines, {
                productId: product._id || hit.productId,
                productName: product.nameEn || product.name || hit.name,
                sku: product.sku || hit.sku,
                demandQty: '1',
                variantId: hit._id,
                variantName: hit.name,
              }],
            }
          })
          setBarcodeBuf('')
          return
        }
      }
      const product = await api.get('/products/lookup', { params: { barcode: q } }).then((r) => r.data).catch(async () => {
        return api.get('/products/lookup', { params: { sku: q } }).then((r) => r.data)
      })
      if (!product?._id) {
        toast.error(ar ? 'غير موجود' : 'Not found')
        return
      }
      await pickProduct(product)
      setBarcodeBuf('')
    } catch {
      toast.error(ar ? 'غير موجود' : 'Not found')
    }
  }

  const late = transfer?.scheduledDate && new Date(transfer.scheduledDate) < new Date()
    && !['done', 'cancelled'].includes(transfer?.state)

  const readOnly = ['done', 'cancelled'].includes(transfer?.state)

  if (!isNew && isLoading) {
    return <div className="text-sm text-slate-400">…</div>
  }

  const tabs = [
    { id: 'operations', en: 'Operations', ar: 'العمليات' },
    { id: 'detailed', en: 'Detailed Operations', ar: 'عمليات تفصيلية' },
    { id: 'info', en: 'Additional Info', ar: 'معلومات إضافية' },
    { id: 'note', en: 'Note', ar: 'ملاحظة' },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={listPath} className="btn btn-secondary btn-sm">
            <ArrowLeft className="h-4 w-4" />
            {ar ? 'رجوع' : 'Back'}
          </Link>
          <div>
            <p className="text-xs text-slate-500">
              {ar ? 'المخزون' : 'Inventory'} / {activeOpType?.name || code} / {isNew ? (ar ? 'جديد' : 'New') : transfer?.name}
            </p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isNew ? (ar ? 'تحويل جديد' : 'New transfer') : transfer?.name}
            </h2>
            {!isNew && <StatusChip status={transfer?.state} language={language} />}
          </div>
        </div>
        {!isNew && (
          <div className="flex flex-wrap gap-2">
            <TransferPrintButton transfer={transfer} code={code} settingsHints={hints} />
            <Link to={`/app/dashboard/inventory/moves?transferId=${id}`} className="btn btn-ghost btn-sm">
              {ar ? 'الحركات' : 'Moves'} ({transfer?.moves?.length || 0})
            </Link>
            {hints.barcode && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('operations')}>
                {ar ? 'باركود' : 'Barcode'}
              </button>
            )}
            {transfer?.state === 'draft' && (
              <button type="button" className="btn btn-secondary text-sm" onClick={() => actionMut.mutate({ action: 'confirm' })}>
                {ar ? 'تعيين كمهمة' : 'Mark as Todo'}
              </button>
            )}
            {['confirmed', 'partiallyAvailable', 'assigned', 'waiting'].includes(transfer?.state) && (
              <>
                <button type="button" className="btn btn-secondary text-sm" onClick={() => actionMut.mutate({ action: 'check-availability' })}>
                  {ar ? 'تحقق التوفر' : 'Check Availability'}
                </button>
                <button type="button" className="btn btn-secondary text-sm" onClick={() => actionMut.mutate({ action: 'unreserve' })}>
                  {ar ? 'إلغاء الحجز' : 'Unreserve'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  onClick={() => {
                    if (hints.signatureRequired && code === 'outgoing' && !transfer?.signature) {
                      toast.error(ar ? 'التوقيع مطلوب قبل الاعتماد' : 'Signature required before validate')
                      setTab('info')
                      return
                    }
                    const policy = transfer?.operationTypeId?.createBackorder
                      || activeOpType?.createBackorder
                      || 'ask'
                    let createBackorder = false
                    if (policy === 'always') {
                      createBackorder = true
                    } else if (policy === 'ask') {
                      const ok = window.confirm(
                        ar
                          ? 'كمية جزئية — إنشاء أمر متبقٍ (backorder)؟\nموافق = نعم · إلغاء = إسقاط المتبقي'
                          : 'Partial qty — create a backorder for the remainder?\nOK = yes · Cancel = drop remainder',
                      )
                      createBackorder = ok
                    }
                    actionMut.mutate({ action: 'validate', body: { immediate: true, createBackorder } })
                  }}
                >
                  {ar ? 'اعتماد' : 'Validate'}
                </button>
              </>
            )}
            {transfer?.state === 'done' && (
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={async () => {
                  try {
                    const wiz = await api.get(`/stock/transfers/${id}/return-wizard`).then((r) => r.data)
                    const lines = (wiz.lines || []).map((l) => ({ moveId: l.moveId, quantity: l.quantity }))
                    const ret = await api.post(`/stock/transfers/${id}/return`, { lines }).then((r) => r.data)
                    toast.success(ar ? 'تم إنشاء المرتجع' : 'Return created')
                    const retCode = ret.operationTypeId?.code || CODE_FROM_PATH()
                    const path = retCode === 'incoming' ? 'receipts' : retCode === 'outgoing' ? 'deliveries' : 'internal'
                    navigate(`/app/dashboard/inventory/${path}/${ret._id}`)
                  } catch (e) {
                    toast.error(e.response?.data?.error || e.message)
                  }
                }}
              >
                {ar ? 'مرتجع' : 'Return'}
              </button>
            )}
            {transfer?.state !== 'done' && transfer?.state !== 'cancelled' && (
              <button type="button" className="btn btn-danger text-sm" onClick={() => actionMut.mutate({ action: 'cancel' })}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            )}
          </div>
        )}
      </div>

      {!isNew && (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-dark-700">
          {STEPS.map((s) => {
            const active =
              (s === 'assigned' && ['assigned', 'confirmed', 'partiallyAvailable'].includes(transfer?.state)) ||
              transfer?.state === s
            return (
              <div
                key={s}
                className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium capitalize ${
                  active ? 'bg-white text-primary-700 shadow-sm dark:bg-dark-800 dark:text-primary-300' : 'text-slate-400'
                }`}
              >
                {s === 'assigned' ? 'Ready' : s === 'waiting' ? 'Waiting' : s}
              </div>
            )
          })}
        </div>
      )}

      {isNew ? (
        <form onSubmit={onCreate} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="label">{ar ? 'نوع العملية' : 'Operation type'}</span>
              <select
                className="select mt-1 w-full"
                value={form.operationTypeId || activeOpType?._id || ''}
                onChange={(e) => applyOpType(e.target.value)}
              >
                {opTypes.map((o) => (
                  <option key={o._id} value={o._id}>{ar && o.nameAr ? o.nameAr : o.name}</option>
                ))}
              </select>
            </label>
            {code !== 'internal' && (
              <label className="block text-sm">
                <span className="label">{partnerLabel}</span>
                <select
                  className="select mt-1 w-full"
                  value={form.partnerId}
                  onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>{ar && c.nameAr ? c.nameAr : c.name}</option>
                  ))}
                </select>
              </label>
            )}
            {hints.multiLocations && (
              <>
                <label className="block text-sm">
                  <span className="label">{ar ? 'المصدر' : 'Source location'}</span>
                  <select
                    className="select mt-1 w-full"
                    value={form.sourceLocationId}
                    onChange={(e) => setForm((f) => ({ ...f, sourceLocationId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {(Array.isArray(locations) ? locations : []).map((l) => (
                      <option key={l._id} value={l._id}>{l.completePath}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="label">{ar ? 'الوجهة' : 'Destination location'}</span>
                  <select
                    className="select mt-1 w-full"
                    value={form.destLocationId}
                    onChange={(e) => setForm((f) => ({ ...f, destLocationId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {(Array.isArray(locations) ? locations : []).map((l) => (
                      <option key={l._id} value={l._id}>{l.completePath}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="block text-sm">
              <span className="label">{ar ? 'الموعد' : 'Scheduled date'}</span>
              <input
                type="datetime-local"
                className="input mt-1 w-full"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="label">{ar ? 'المستند المصدر' : 'Source document'}</span>
              <input className="input mt-1 w-full" value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} />
            </label>
          </div>

          {code === 'outgoing' && hints.deliveryMethods && (
            <div className="grid gap-3 rounded-xl border border-slate-200/80 p-3 sm:grid-cols-3 dark:border-dark-600">
              <label className="block text-sm sm:col-span-1">
                <span className="label">{ar ? 'طريقة التسليم' : 'Delivery method'}</span>
                <select
                  className="select mt-1 w-full"
                  value={carrierId}
                  onChange={(e) => {
                    const id = e.target.value
                    setCarrierId(id)
                    quoteCarrier(id)
                  }}
                >
                  <option value="">{ar ? '— بدون —' : '— None —'}</option>
                  {carriers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {(ar && c.nameAr) || c.name}
                      {c.carrierType === 'fixed' ? ` (${c.fixedPrice})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="label">{ar ? 'تكلفة الشحن' : 'Shipping cost'}</span>
                <input className="input mt-1 w-full" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} />
                {ratePreview ? (
                  <span className="text-xs text-slate-400">{ratePreview.source}: {ratePreview.price} {ratePreview.currency}</span>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="label">{ar ? 'رقم التتبع' : 'Tracking'}</span>
                <input className="input mt-1 w-full" value={trackingReference} onChange={(e) => setTrackingReference(e.target.value)} />
              </label>
            </div>
          )}

          {hints.barcode && (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder={ar ? 'امسح الباركود…' : 'Scan barcode…'}
                value={barcodeBuf}
                onChange={(e) => setBarcodeBuf(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); scanBarcode() } }}
              />
              <button type="button" className="btn btn-secondary" onClick={scanBarcode}>{ar ? 'إضافة' : 'Add'}</button>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-sm font-medium">{ar ? 'العمليات' : 'Operations'}</div>
            <ProductChooser
              remote
              onPick={pickProduct}
              placeholder={ar ? 'ابحث بالاسم أو الرمز أو الباركود…' : 'Search products by name, SKU, or barcode…'}
            />
            {form.lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400 dark:border-dark-600">
                {ar ? 'اختر منتجاً من الكتالوج أعلاه' : 'Pick a product from the catalog above'}
              </p>
            ) : (
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div key={`${line.productId}:${line.variantId || ''}`} className="grid items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 sm:grid-cols-[1fr_120px_40px] dark:border-dark-600 dark:bg-dark-900/40">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{line.productName}</div>
                      <div className="text-xs text-slate-400">
                        {line.sku ? `SKU ${line.sku}` : ''}
                        {line.variantName ? `${line.sku ? ' · ' : ''}${line.variantName}` : ''}
                      </div>
                    </div>
                    <input
                      className="input"
                      type="text"
                      inputMode="decimal"
                      value={line.demandQty}
                      onChange={(e) => {
                        const lines = [...form.lines]
                        lines[idx] = { ...lines[idx], demandQty: e.target.value }
                        setForm((f) => ({ ...f, lines }))
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon text-slate-400 hover:text-rose-600"
                      onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="block text-sm">
            <span className="label">{ar ? 'ملاحظة' : 'Note'}</span>
            <textarea className="input mt-1 w-full" rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </label>

          <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
            {ar ? 'حفظ' : 'Save'}
          </button>
        </form>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-xs text-slate-500">{ar ? 'النوع' : 'Operation type'}</div>
                <div className="font-medium">{transfer?.operationTypeId?.name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{partnerLabel}</div>
                <div className="font-medium">
                  {transfer?.partner
                    ? (ar && transfer.partner.nameAr ? transfer.partner.nameAr : transfer.partner.name)
                    : '—'}
                </div>
                {hints.partnerWarnings && transfer?.partner?.stockWarn === 'warning' && (
                  <p className="mt-1 text-xs text-amber-600">{transfer.partner.stockWarnMsg}</p>
                )}
              </div>
              <div>
                <div className="text-xs text-slate-500">{ar ? 'الموعد' : 'Scheduled'}</div>
                <div className={`font-medium ${late ? 'text-orange-600' : ''}`}>
                  {transfer?.scheduledDate ? new Date(transfer.scheduledDate).toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{ar ? 'الأصل' : 'Origin'}</div>
                <div className="font-medium">{transfer?.origin || '—'}</div>
              </div>
              {hints.multiLocations && (
                <>
                  <div>
                    <div className="text-xs text-slate-500">{ar ? 'المصدر' : 'Source'}</div>
                    <div className="font-medium text-xs">{String(transfer?.sourceLocationId || '—')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{ar ? 'الوجهة' : 'Destination'}</div>
                    <div className="font-medium text-xs">{String(transfer?.destLocationId || '—')}</div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2 dark:border-dark-600">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    tab === t.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300' : 'text-slate-500'
                  }`}
                  onClick={() => setTab(t.id)}
                >
                  {ar ? t.ar : t.en}
                </button>
              ))}
            </div>

            {tab === 'operations' && (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 text-start">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="py-2 text-start">{ar ? 'الطلب' : 'Demand'}</th>
                    <th className="py-2 text-start">{ar ? 'المنجز' : 'Done'}</th>
                    <th className="py-2 text-start">{ar ? 'الحالة' : 'State'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(transfer?.moves || []).map((m) => {
                    const pid = m.productId?._id || m.productId
                    const label = ar && m.productId?.nameAr
                      ? m.productId.nameAr
                      : m.productId?.nameEn || m.productId?.sku || '—'
                    return (
                      <tr key={m._id} className="border-t border-slate-100 dark:border-dark-600">
                        <td className="py-2">
                          {pid ? (
                            <Link className="font-medium text-primary-700 hover:underline dark:text-primary-300" to={`/app/dashboard/inventory/products/${pid}`}>
                              {label}
                            </Link>
                          ) : label}
                          {m.variantId?.name ? (
                            <div className="text-xs text-slate-400">{m.variantId.name}</div>
                          ) : null}
                        </td>
                        <td className="py-2 tabular-nums">{m.demandQty}</td>
                        <td className="py-2 tabular-nums">{m.doneQty}</td>
                        <td className="py-2"><StatusChip status={m.state} language={language} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {tab === 'detailed' && (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 text-start">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="py-2 text-start">{ar ? 'الكمية' : 'Qty'}</th>
                    {hints.lotsEnabled && <th className="py-2 text-start">{ar ? 'الدفعة' : 'Lot'}</th>}
                    {hints.packagesEnabled && <th className="py-2 text-start">{ar ? 'الطرد' : 'Package'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {(transfer?.moveLines || []).length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-slate-400">{ar ? 'لا بنود تفصيلية بعد' : 'No detailed lines yet'}</td></tr>
                  ) : (transfer.moveLines || []).map((l) => {
                    const move = (transfer.moves || []).find((m) => String(m._id) === String(l.moveId))
                    const label = move?.productId?.nameEn || move?.productId?.sku || String(l.productId)
                    return (
                      <tr key={l._id} className="border-t border-slate-100 dark:border-dark-600">
                        <td className="py-2">{label}</td>
                        <td className="py-2 tabular-nums">{l.quantity}</td>
                        {hints.lotsEnabled && <td className="py-2">{l.lotId?.name || l.lotName || '—'}</td>}
                        {hints.packagesEnabled && <td className="py-2">{l.packageId?.name || '—'}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {tab === 'info' && (
              <div className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">{ar ? 'الأولوية' : 'Priority'}</div>
                    <div className="font-medium">{transfer?.priority || 'normal'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{ar ? 'طلب متأخر من' : 'Backorder of'}</div>
                    <div className="font-medium">{transfer?.backorderOfId ? String(transfer.backorderOfId) : '—'}</div>
                  </div>
                </div>
                {code === 'outgoing' && hints.deliveryMethods && (
                  <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-dark-600">
                    <div className="text-xs font-medium text-slate-600">{ar ? 'الشحن' : 'Shipping'}</div>
                    {readOnly ? (
                      <div className="grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-slate-500">{ar ? 'الناقل' : 'Carrier'}</div>
                          <div className="font-medium">
                            {transfer?.carrierId?.name || (transfer?.carrierId ? String(transfer.carrierId) : '—')}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{ar ? 'التكلفة' : 'Cost'}</div>
                          <div className="font-medium tabular-nums">{transfer?.shippingCost ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{ar ? 'التتبع' : 'Tracking'}</div>
                          <div className="font-medium">{transfer?.trackingReference || '—'}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <select
                          className="select select-sm"
                          value={carrierId}
                          onChange={(e) => {
                            const id = e.target.value
                            setCarrierId(id)
                            quoteCarrier(id)
                          }}
                        >
                          <option value="">{ar ? '— بدون —' : '— None —'}</option>
                          {carriers.map((c) => (
                            <option key={c._id} value={c._id}>{(ar && c.nameAr) || c.name}</option>
                          ))}
                        </select>
                        <input className="input input-sm" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder={ar ? 'التكلفة' : 'Cost'} />
                        <input className="input input-sm" value={trackingReference} onChange={(e) => setTrackingReference(e.target.value)} placeholder={ar ? 'التتبع' : 'Tracking'} />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm sm:col-span-3"
                          onClick={() => patchMut.mutate({
                            carrierId: carrierId || null,
                            shippingCost: shippingCost || null,
                            trackingReference: trackingReference || '',
                          })}
                        >
                          {ar ? 'حفظ الشحن' : 'Save shipping'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {hints.signatureRequired && code === 'outgoing' && !readOnly && (
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-dark-600">
                    <div className="mb-2 text-xs font-medium text-slate-600">{ar ? 'توقيع التسليم' : 'Delivery signature'}</div>
                    {transfer?.signature ? (
                      <p className="text-xs text-emerald-600">
                        {ar ? 'موقّع بواسطة' : 'Signed by'} {transfer.signedBy || '—'} · {transfer.signedOn ? new Date(transfer.signedOn).toLocaleString() : ''}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="input input-sm flex-1"
                          placeholder={ar ? 'اسم الموقّع' : 'Signer name'}
                          value={signedBy}
                          onChange={(e) => setSignedBy(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => patchMut.mutate({
                            signature: `signed:${signedBy || 'recipient'}:${Date.now()}`,
                            signedBy: signedBy || undefined,
                          })}
                        >
                          {ar ? 'تسجيل التوقيع' : 'Capture signature'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'note' && (
              <div className="space-y-2">
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-dark-900 dark:text-slate-300">
                  {transfer?.note || (ar ? 'لا ملاحظات' : 'No notes')}
                </pre>
                {!readOnly && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const note = window.prompt(ar ? 'ملاحظة' : 'Note', transfer?.note || '')
                      if (note != null) patchMut.mutate({ note })
                    }}
                  >
                    {ar ? 'تعديل الملاحظة' : 'Edit note'}
                  </button>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{ar ? 'السجل' : 'Chatter'}</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
              <p>{ar ? 'تم إنشاء التحويل' : 'Transfer created'} · {transfer?.createdAt ? new Date(transfer.createdAt).toLocaleString() : ''}</p>
              <p>{ar ? 'الحالة' : 'State'}: {transfer?.state}</p>
              {transfer?.doneDate && <p>{ar ? 'اعتمد في' : 'Validated'} · {new Date(transfer.doneDate).toLocaleString()}</p>}
              {transfer?.signature && <p>{ar ? 'توقيع مسجّل' : 'Signature captured'}</p>}
              {(transfer?.note || '').split('\n').filter((l) => l.startsWith('[')).map((l, i) => (
                <p key={i} className="rounded bg-slate-50 px-2 py-1 dark:bg-dark-900">{l}</p>
              ))}
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-dark-600">
              <textarea
                className="input text-xs"
                rows={2}
                placeholder={ar ? 'سجّل ملاحظة…' : 'Log a note…'}
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm w-full"
                disabled={!logNote.trim() || patchMut.isPending}
                onClick={() => {
                  patchMut.mutate({ logNote: logNote.trim() })
                  setLogNote('')
                }}
              >
                {ar ? 'تسجيل ملاحظة' : 'Log note'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

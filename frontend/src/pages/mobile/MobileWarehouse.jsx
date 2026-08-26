import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Package, ArrowDownToLine, ListChecks, RefreshCw, Truck } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { formatInvError } from '../../lib/invError'
import BarcodeScanner from '../../components/ui/BarcodeScanner'

function MobileShell({ children, title, backTo = '/m' }) {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  return (
    <div className="min-h-dvh bg-slate-100 pb-safe dark:bg-dark-900" dir={ar ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 dark:border-dark-600 dark:bg-dark-800">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link to={backTo} className="text-sm font-medium text-primary-600">{ar ? 'رجوع' : 'Back'}</Link>
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900 dark:text-white">{title}</h1>
          <span className="w-10" />
        </div>
      </header>
      <main className="mx-auto max-w-lg p-4">{children}</main>
    </div>
  )
}

function ScanField({ label, value, onChange, onScan, ar, autoFocus }) {
  const inputRef = useRef(null)
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          className="input flex-1 text-lg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onScan?.(value) }}
        />
        <button type="button" className="btn btn-primary px-4" onClick={() => onScan?.(value)}>
          {ar ? 'مسح' : 'Scan'}
        </button>
      </div>
    </div>
  )
}

export function MobileHome() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const flows = [
    { to: '/m/receive', icon: ArrowDownToLine, en: 'Receive', ar: 'استلام', color: 'bg-emerald-600' },
    { to: '/m/pick', icon: ListChecks, en: 'Pick', ar: 'تجهيز', color: 'bg-blue-600' },
    { to: '/m/count', icon: RefreshCw, en: 'Count', ar: 'عد', color: 'bg-amber-600' },
    { to: '/m/transfer', icon: Truck, en: 'Transfer', ar: 'تحويل', color: 'bg-violet-600' },
  ]
  return (
    <MobileShell title={ar ? 'المستودع' : 'Warehouse'} backTo="/app/dashboard">
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-dark-800">
        <Package className="h-8 w-8 text-primary-600" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{ar ? 'تنفيذ المستودع' : 'Warehouse execution'}</p>
          <p className="text-xs text-slate-500">{ar ? 'مسح الباركود · بدون وضع عدم الاتصال' : 'Barcode scan · online only'}</p>
        </div>
      </div>
      <div className="grid gap-3">
        {flows.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className={`flex min-h-[4.5rem] items-center gap-4 rounded-2xl px-5 py-4 text-white shadow-md ${f.color}`}
          >
            <f.icon className="h-8 w-8 shrink-0" />
            <span className="text-lg font-semibold">{ar ? f.ar : f.en}</span>
          </Link>
        ))}
      </div>
    </MobileShell>
  )
}

export function MobileReceive() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [transferId, setTransferId] = useState('')
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('1')
  const [showCam, setShowCam] = useState(false)
  const [doneEdits, setDoneEdits] = useState({})

  const { data: transfers } = useQuery({
    queryKey: ['m-receipts'],
    queryFn: () => api.get('/stock/transfers', { params: { code: 'incoming', state: 'assigned', limit: 30 } }).then((r) => asInvList(r.data)),
  })

  const { data: transfer } = useQuery({
    queryKey: ['m-transfer', transferId],
    enabled: !!transferId,
    queryFn: () => api.get(`/stock/transfers/${transferId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (!transfer?.moves) return
    const next = {}
    for (const m of transfer.moves) {
      next[m._id] = String(m.doneQty || m.demandQty || '0')
    }
    setDoneEdits(next)
  }, [transfer?._id, transfer?.moves?.length])

  const scanAdd = useMutation({
    mutationFn: async () => {
      const product = await api.get('/products/lookup', { params: { barcode } }).then((r) => r.data)
      if (!product?._id) throw new Error(ar ? 'منتج غير موجود' : 'Product not found')
      const move = (transfer?.moves || []).find((m) => String(m.productId?._id || m.productId) === String(product._id))
      if (!move) throw new Error(ar ? 'المنتج ليس في هذا الاستلام' : 'Product not on this receipt')
      const add = Number(qty) || 1
      const cur = Number(doneEdits[move._id] || 0)
      setDoneEdits((prev) => ({ ...prev, [move._id]: String(cur + add) }))
      setBarcode('')
      setQty('1')
      if (navigator.vibrate) navigator.vibrate(30)
    },
    onError: (e) => toast.error(e.message || formatInvError(e, language)),
  })

  const validate = useMutation({
    mutationFn: () => api.post(`/stock/transfers/${transferId}/validate`, {
      immediate: true,
      moveQuantities: (transfer?.moves || []).map((m) => ({
        moveId: m._id,
        quantity: doneEdits[m._id] ?? m.demandQty ?? '0',
      })),
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم الاستلام' : 'Received')
      qc.invalidateQueries({ queryKey: ['m-receipts'] })
      setTransferId('')
      setDoneEdits({})
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <MobileShell title={ar ? 'استلام' : 'Receive'}>
      {showCam && (
        <BarcodeScanner
          onDetected={(code) => { setBarcode(code); setShowCam(false); scanAdd.mutate() }}
          onClose={() => setShowCam(false)}
        />
      )}
      <div className="space-y-4">
        <div>
          <label className="label text-xs">{ar ? 'إيصال الاستلام' : 'Receipt'}</label>
          <select className="input w-full" value={transferId} onChange={(e) => setTransferId(e.target.value)}>
            <option value="">{ar ? 'اختر…' : 'Select…'}</option>
            {(transfers || []).map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        </div>
        {transfer?.moves?.length > 0 && (
          <ul className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-dark-600 dark:bg-dark-800">
            {transfer.moves.map((m) => (
              <li key={m._id} className="flex items-center justify-between gap-2 border-b border-slate-50 py-2 last:border-0">
                <span className="min-w-0 truncate">{m.productId?.nameEn || m.productId?.sku}</span>
                <input
                  type="number"
                  className="input input-sm w-20 text-end"
                  value={doneEdits[m._id] ?? ''}
                  onChange={(e) => setDoneEdits((prev) => ({ ...prev, [m._id]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        )}
        <ScanField label={ar ? 'باركود المنتج' : 'Product barcode'} value={barcode} onChange={setBarcode} ar={ar} autoFocus />
        <div>
          <label className="label text-xs">{ar ? 'الكمية' : 'Qty'}</label>
          <input type="number" min="0.0001" step="any" className="input w-full text-lg" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowCam(true)}>{ar ? 'كamera' : 'Camera'}</button>
          <button type="button" className="btn btn-primary flex-1" disabled={!barcode || !transferId || scanAdd.isPending} onClick={() => scanAdd.mutate()}>
            {ar ? 'إضافة' : 'Add qty'}
          </button>
        </div>
        <button type="button" className="btn btn-primary w-full py-4 text-lg" disabled={!transferId || validate.isPending} onClick={() => validate.mutate()}>
          {ar ? 'اعتماد الاستلام' : 'Validate receipt'}
        </button>
      </div>
    </MobileShell>
  )
}

export function MobilePick() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const [transferId, setTransferId] = useState('')
  const [locationCode, setLocationCode] = useState('')
  const [barcode, setBarcode] = useState('')
  const [doneEdits, setDoneEdits] = useState({})

  const { data: deliveries } = useQuery({
    queryKey: ['m-deliveries'],
    queryFn: () => api.get('/stock/transfers', { params: { code: 'outgoing', state: 'assigned', limit: 30 } }).then((r) => asInvList(r.data)),
  })

  const { data: transfer } = useQuery({
    queryKey: ['m-transfer-pick', transferId],
    enabled: !!transferId,
    queryFn: () => api.get(`/stock/transfers/${transferId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (!transfer?.moves) return
    const next = {}
    for (const m of transfer.moves) {
      next[m._id] = String(m.doneQty || m.demandQty || '0')
    }
    setDoneEdits(next)
  }, [transfer?._id, transfer?.moves?.length])

  const verify = useMutation({
    mutationFn: async () => {
      const product = await api.get('/products/lookup', { params: { barcode } }).then((r) => r.data)
      if (!product?._id) throw new Error(ar ? 'منتج غير موجود' : 'Product not found')
      const move = (transfer?.moves || []).find((m) => String(m.productId?._id || m.productId) === String(product._id))
      if (!move) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
        throw new Error(ar ? 'المنتج لا يطابق أمر التسليم!' : 'Wrong product for this delivery!')
      }
      toast.success(ar ? 'تطابق ✓' : 'Match ✓')
      setBarcode('')
    },
    onError: (e) => toast.error(e.message || formatInvError(e, language)),
  })

  const validate = useMutation({
    mutationFn: () => api.post(`/stock/transfers/${transferId}/validate`, {
      immediate: true,
      moveQuantities: (transfer?.moves || []).map((m) => ({
        moveId: m._id,
        quantity: doneEdits[m._id] ?? m.demandQty ?? '0',
      })),
    }),
    onSuccess: () => toast.success(ar ? 'تم التسليم' : 'Delivered'),
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <MobileShell title={ar ? 'تجهيز' : 'Pick'}>
      <div className="space-y-4">
        <div>
          <label className="label text-xs">{ar ? 'أمر التسليم' : 'Delivery'}</label>
          <select className="input w-full" value={transferId} onChange={(e) => setTransferId(e.target.value)}>
            <option value="">{ar ? 'اختر…' : 'Select…'}</option>
            {(deliveries || []).map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        </div>
        {transfer?.moves?.length > 0 && (
          <ul className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-dark-600 dark:bg-dark-800">
            {transfer.moves.map((m) => (
              <li key={m._id} className="flex items-center justify-between gap-2 border-b border-slate-50 py-2 last:border-0">
                <span className="min-w-0 truncate">{m.productId?.nameEn || m.productId?.sku}</span>
                <input
                  type="number"
                  className="input input-sm w-20 text-end"
                  value={doneEdits[m._id] ?? ''}
                  onChange={(e) => setDoneEdits((prev) => ({ ...prev, [m._id]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        )}
        <ScanField label={ar ? 'موقع' : 'Location'} value={locationCode} onChange={setLocationCode} ar={ar} />
        <ScanField label={ar ? 'باركود المنتج' : 'Product barcode'} value={barcode} onChange={setBarcode} ar={ar} onScan={() => verify.mutate()} />
        <button type="button" className="btn btn-primary w-full py-4 text-lg" disabled={!transferId || validate.isPending} onClick={() => validate.mutate()}>
          {ar ? 'اعتماد التسليم' : 'Validate delivery'}
        </button>
      </div>
    </MobileShell>
  )
}

export function MobileCount() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const [locationId, setLocationId] = useState('')
  const [barcode, setBarcode] = useState('')
  const [counted, setCounted] = useState('')

  const { data: locations } = useQuery({
    queryKey: ['m-locations'],
    queryFn: () => api.get('/stock/locations', { params: { limit: 100 } }).then((r) => asInvList(r.data)),
  })

  const submit = useMutation({
    mutationFn: async () => {
      const product = await api.get('/products/lookup', { params: { barcode } }).then((r) => r.data)
      if (!product?._id) throw new Error(ar ? 'منتج غير موجود' : 'Product not found')
      await api.post('/stock/physical-inventory/set', {
        productId: product._id,
        locationId,
        countedQuantity: Number(counted),
      })
      toast.success(ar ? 'تم التسجيل' : 'Counted')
      setBarcode('')
      setCounted('')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <MobileShell title={ar ? 'عد' : 'Count'}>
      <div className="space-y-4">
        <div>
          <label className="label text-xs">{ar ? 'الموقع' : 'Location'}</label>
          <select className="input w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">{ar ? 'اختر…' : 'Select…'}</option>
            {(locations || []).map((l) => (
              <option key={l._id} value={l._id}>{l.completePath || l.name}</option>
            ))}
          </select>
        </div>
        <ScanField label={ar ? 'باركود' : 'Barcode'} value={barcode} onChange={setBarcode} ar={ar} />
        <div>
          <label className="label text-xs">{ar ? 'الكمية المعدودة' : 'Counted qty'}</label>
          <input type="number" className="input w-full text-2xl tabular-nums" value={counted} onChange={(e) => setCounted(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary w-full py-4 text-lg" disabled={!locationId || !barcode || submit.isPending} onClick={() => submit.mutate()}>
          {ar ? 'تسجيل العد' : 'Submit count'}
        </button>
      </div>
    </MobileShell>
  )
}

export function MobileTransfer() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const [sourceLoc, setSourceLoc] = useState('')
  const [destLoc, setDestLoc] = useState('')
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('1')

  const create = useMutation({
    mutationFn: async () => {
      const product = await api.get('/products/lookup', { params: { barcode } }).then((r) => r.data)
      if (!product?._id) throw new Error(ar ? 'منتج غير موجود' : 'Product not found')
      const t = await api.post('/stock/transfers', {
        code: 'internal',
        lines: [{
          productId: product._id,
          quantity: Number(qty) || 1,
          sourceLocationId: sourceLoc,
          destLocationId: destLoc,
        }],
      }).then((r) => r.data)
      await api.post(`/stock/transfers/${t._id}/confirm`, {})
      await api.post(`/stock/transfers/${t._id}/validate`, {})
      toast.success(ar ? 'تم التحويل' : 'Transferred')
      navigate('/m')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const { data: locations } = useQuery({
    queryKey: ['m-locations'],
    queryFn: () => api.get('/stock/locations', { params: { limit: 100 } }).then((r) => asInvList(r.data)),
  })

  return (
    <MobileShell title={ar ? 'تحويل' : 'Transfer'}>
      <div className="space-y-4">
        <div>
          <label className="label text-xs">{ar ? 'من موقع' : 'From location'}</label>
          <select className="input w-full" value={sourceLoc} onChange={(e) => setSourceLoc(e.target.value)}>
            <option value="">{ar ? 'اختر…' : 'Select…'}</option>
            {(locations || []).map((l) => (
              <option key={l._id} value={l._id}>{l.completePath || l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">{ar ? 'إلى موقع' : 'To location'}</label>
          <select className="input w-full" value={destLoc} onChange={(e) => setDestLoc(e.target.value)}>
            <option value="">{ar ? 'اختر…' : 'Select…'}</option>
            {(locations || []).map((l) => (
              <option key={l._id} value={l._id}>{l.completePath || l.name}</option>
            ))}
          </select>
        </div>
        <ScanField label={ar ? 'باركود' : 'Barcode'} value={barcode} onChange={setBarcode} ar={ar} />
        <input type="number" className="input w-full text-lg" value={qty} onChange={(e) => setQty(e.target.value)} />
        <button type="button" className="btn btn-primary w-full py-4 text-lg" disabled={!sourceLoc || !destLoc || !barcode || create.isPending} onClick={() => create.mutate()}>
          {ar ? 'تأكيد التحويل' : 'Confirm transfer'}
        </button>
      </div>
    </MobileShell>
  )
}

export default function MobileWarehouseRoutes() {
  return null
}

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  FileText,
  CheckCircle2,
  ShoppingCart,
  Truck,
  User,
  Phone,
  Calendar,
  Layers,
  Printer,
  Download,
  Plus,
  Trash2,
  FileSpreadsheet,
  Building2,
  Clock,
  ExternalLink,
  Receipt,
  FileCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { getUomLabel } from '../lib/uomOptions'
import { DELIVERY_WINDOWS, getDeliveryWindowLabel } from '../lib/deliveryWindows'
import { downloadDeliveryNotePdf } from '../lib/deliveryNotePdf'
import DocumentChatter from '../components/sales/DocumentChatter'
import RmaPanel from '../components/sales/RmaPanel'

function DeliveryNoteSourcePicker({ language, navigate }) {
  const [activeTab, setActiveTab] = useState('quotations')

  // Fetch approved quotations
  const { data: qData, isLoading: qLoading } = useQuery({
    queryKey: ['quotations-for-dn'],
    queryFn: () => api.get('/quotations', { params: { limit: 50 } }).then((res) => res.data),
  })

  // Fetch approved purchase/sales orders
  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ['purchase-orders-for-dn'],
    queryFn: () => api.get('/purchase-orders', { params: { limit: 50 } }).then((res) => res.data),
  })

  const quotations = (qData?.quotations || []).filter((q) =>
    ['approved', 'accepted', 'sent', 'draft'].includes(String(q.status || '').toLowerCase())
  )
  const orders = (poData?.purchaseOrders || []).filter((po) =>
    ['approved', 'sent', 'partially_received', 'confirmed'].includes(String(po.status || '').toLowerCase())
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {language === 'ar' ? 'إنشاء سند تسليم جديد' : 'New Delivery Note'}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {language === 'ar'
            ? 'اختر المستند المصدري (عرض سعر، أمر شراء/بيع) أو ابدأ بإدخال مباشر لتسليم البضائع.'
            : 'Select a source document (Quotation or Order) or start with direct manual item entry.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('quotations')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'quotations'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{language === 'ar' ? 'من عرض سعر (Quotation)' : 'From Quotation'}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {quotations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'orders'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>{language === 'ar' ? 'من أمر شراء / بيع (Order)' : 'From Order'}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/app/dashboard/delivery-notes/new?direct=1')}
          className="flex items-center gap-1.5 ms-auto rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{language === 'ar' ? 'إدخال مباشر بدون مستند' : 'Direct Entry'}</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'quotations' && (
        <div className="space-y-3">
          {qLoading ? (
            <div className="flex justify-center p-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : quotations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-dark-800">
              <FileText className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'لا توجد عروض أسعار متاحة حالياً.' : 'No quotations available.'}
              </p>
              <button
                type="button"
                className="mt-3 btn btn-primary btn-sm"
                onClick={() => navigate('/app/dashboard/quotations/new')}
              >
                <Plus className="h-3.5 w-3.5" />
                {language === 'ar' ? 'إنشاء عرض سعر جديد' : 'New Quotation'}
              </button>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {quotations.map((q) => {
                const customerName =
                  language === 'ar'
                    ? q.customerId?.nameAr || q.customerId?.nameEn || q.buyer?.nameAr || q.buyer?.name
                    : q.customerId?.nameEn || q.customerId?.nameAr || q.buyer?.name || q.buyer?.nameAr || '—'
                const itemsCount = (q.lineItems || []).length

                return (
                  <button
                    key={q._id}
                    type="button"
                    onClick={() => navigate(`/app/dashboard/delivery-notes/new?quotationId=${q._id}`)}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-start shadow-sm transition hover:border-primary-500 hover:shadow-md dark:border-white/10 dark:bg-dark-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{q.quotationNumber}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{customerName}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {q.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-white/5">
                      <span>{itemsCount} {language === 'ar' ? 'بنود' : 'items'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {q.grandTotal ? `${q.grandTotal.toLocaleString()} SAR` : ''}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-3">
          {poLoading ? (
            <div className="flex justify-center p-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-dark-800">
              <ShoppingCart className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'لا توجد أوامر شراء / بيع معتمدة.' : 'No approved orders found.'}
              </p>
              <button
                type="button"
                className="mt-3 btn btn-primary btn-sm"
                onClick={() => navigate('/app/dashboard/purchases/orders')}
              >
                <Plus className="h-3.5 w-3.5" />
                {language === 'ar' ? 'فتح أوامر الشراء' : 'Open Purchase Orders'}
              </button>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {orders.map((po) => {
                const partnerName =
                  language === 'ar'
                    ? po.customerId?.nameAr || po.supplierId?.nameAr || po.supplierId?.nameEn
                    : po.customerId?.nameEn || po.supplierId?.nameEn || po.supplierId?.nameAr || '—'
                const itemsCount = (po.lineItems || []).length

                return (
                  <button
                    key={po._id}
                    type="button"
                    onClick={() => navigate(`/app/dashboard/delivery-notes/new?poId=${po._id}`)}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-start shadow-sm transition hover:border-emerald-500 hover:shadow-md dark:border-white/10 dark:bg-dark-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <ShoppingCart className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{po.poNumber}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{partnerName}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {po.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-white/5">
                      <span>{itemsCount} {language === 'ar' ? 'بنود' : 'items'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {po.grandTotal ? `${po.grandTotal.toLocaleString()} SAR` : ''}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DeliveryNoteForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const poId = searchParams.get('poId')
  const quotationId = searchParams.get('quotationId')
  const isDirect = Boolean(searchParams.get('direct'))

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const [quantities, setQuantities] = useState({})
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dispatchTime, setDispatchTime] = useState(() => new Date().toTimeString().slice(0, 5))
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('14:00')
  const [deliveryWindow, setDeliveryWindow] = useState('same_day')
  const [shippingAddress, setShippingAddress] = useState('')
  const [destinationCity, setDestinationCity] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [warehouseId, setWarehouseId] = useState('')

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => (Array.isArray(r.data) ? r.data : r.data?.warehouses || [])),
    enabled: !isEdit,
  })

  const { data: engineStatus } = useQuery({
    queryKey: ['stock-engine-status'],
    queryFn: () => api.get('/stock/engine-status').then((r) => r.data).catch(() => ({ engineEnabled: false })),
    enabled: !isEdit,
  })
  const engineOn = Boolean(engineStatus?.engineEnabled)

  // Fetch Delivery Note if viewing/editing
  const { data: dn, isLoading: dnLoading } = useQuery({
    queryKey: ['delivery-note', id],
    queryFn: () => api.get(`/delivery-notes/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  // Fetch PO if creating from PO
  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ['purchase-order-for-dn', poId],
    queryFn: () => api.get(`/purchase-orders/${poId}`).then((res) => res.data),
    enabled: !isEdit && Boolean(poId),
  })

  // Fetch Quotation if creating from Quotation
  const { data: quotation, isLoading: qLoading } = useQuery({
    queryKey: ['quotation-for-dn', quotationId],
    queryFn: () => api.get(`/quotations/${quotationId}`).then((res) => res.data),
    enabled: !isEdit && Boolean(quotationId),
  })

  // Auto-fill from Quotation
  useEffect(() => {
    if (!quotation) return
    const initialQtys = {}
    ;(quotation?.lineItems || []).forEach((li, idx) => {
      const itemObjId = li._id || li.productId?._id || li.productId || idx
      initialQtys[itemObjId] = Number(li.quantity || 1)
    })
    setQuantities(initialQtys)

    if (quotation.buyer?.name || quotation.buyer?.nameAr) {
      setRecipientName(prev => prev || quotation.buyer?.name || quotation.buyer?.nameAr || '')
    }
    if (quotation.buyer?.contactPhone) {
      setRecipientPhone(prev => prev || quotation.buyer.contactPhone)
    }
    if (quotation.buyer?.address) {
      const addr = quotation.buyer.address
      const parts = [addr.buildingNumber, addr.street, addr.district, addr.city].filter(Boolean)
      if (parts.length) setShippingAddress(prev => prev || parts.join(', '))
      if (addr.city) setDestinationCity(prev => prev || addr.city)
    }
    if (quotation.notes) {
      setNotes(prev => prev || quotation.notes)
    }
  }, [quotation])

  // Auto-fill from PO
  useEffect(() => {
    if (!po) return
    const initialQtys = {}
    ;(po?.lineItems || []).forEach((li, idx) => {
      const itemObjId = li._id || li.productId?._id || li.productId || idx
      const remaining = Math.max(0, Number(li.quantityOrdered || 0) - Number(li.quantityDelivered || 0))
      initialQtys[itemObjId] = remaining > 0 ? remaining : Number(li.quantityOrdered || 1)
    })
    setQuantities(initialQtys)

    const customer = po.customerId || {}
    if (customer.nameEn || customer.nameAr) {
      setRecipientName(prev => prev || customer.nameEn || customer.nameAr || '')
    }
    if (customer.phone) {
      setRecipientPhone(prev => prev || customer.phone)
    }
    if (po.notes) {
      setNotes(prev => prev || po.notes)
    }
    const poWh = po.warehouseId?._id || po.warehouseId
    if (poWh) setWarehouseId((prev) => prev || String(poWh))
  }, [po])

  useEffect(() => {
    if (warehouseId || !warehouses.length) return
    const primary = warehouses.find((w) => w.isPrimary || w.isDefault) || warehouses[0]
    if (primary?._id) setWarehouseId(String(primary._id))
  }, [warehouses, warehouseId])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.post('/delivery-notes', payload),
    onSuccess: (res) => {
      if (res.data?.stockError) {
        toast.error(
          language === 'ar'
            ? `تم إنشاء السند لكن فشل خصم المخزون: ${res.data.stockError}`
            : `Delivery note created but stock failed: ${res.data.stockError}`,
          { duration: 8000 },
        )
      } else {
        toast.success(language === 'ar' ? 'تم إنشاء سند التسليم بنجاح' : 'Delivery Note created successfully')
      }
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      const newId = res.data?.deliveryNote?._id || res.data?._id
      if (newId) {
        navigate(`/app/dashboard/delivery-notes/${newId}`)
      } else {
        navigate('/app/dashboard/delivery-notes')
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.message || (language === 'ar' ? 'تعذر إنشاء سند التسليم' : 'Failed to create delivery note'))
    },
  })

  const markDeliveredMutation = useMutation({
    mutationFn: ({ createBackorder } = {}) =>
      api.post(`/delivery-notes/${id}/mark-delivered`, { createBackorder }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تأكيد التسليم' : 'Delivery marked as done')
      queryClient.invalidateQueries({ queryKey: ['delivery-note', id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-smart'] })
    },
    onError: async (err) => {
      const data = err?.response?.data
      if (err?.response?.status === 409 || data?.code === 'BACKORDER_REQUIRED') {
        const create = window.confirm(
          language === 'ar'
            ? 'أنت تُسلّم أقل من الكمية المطلوبة. إنشاء أمر تسليم متبقٍ (Backorder)؟'
            : (data?.message || 'You are processing less than the initial demand. Create a Backorder?'),
        )
        try {
          await api.post(`/delivery-notes/${id}/mark-delivered`, { createBackorder: create })
          toast.success(language === 'ar' ? 'تم تأكيد التسليم' : 'Delivery validated')
          queryClient.invalidateQueries({ queryKey: ['delivery-note', id] })
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
        } catch (e2) {
          toast.error(e2?.response?.data?.error || e2.message)
        }
        return
      }
      toast.error(data?.error || err.message)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    let lineItems = []

    if (poId && po) {
      lineItems = (po?.lineItems || [])
        .map((li) => {
          const itemObjId = li._id || li.productId?._id || li.productId
          const qty = Number(quantities[itemObjId] || 0)
          if (qty <= 0) return null
          return {
            productId: li.productId?._id || li.productId,
            poItemId: li._id,
            description: li.description || li.productName || li.productNameAr,
            unitCode: li.uom || li.unitCode || 'PCE',
            quantityDelivered: qty,
          }
        })
        .filter(Boolean)
    } else if (quotationId && quotation) {
      lineItems = (quotation?.lineItems || [])
        .map((li) => {
          const itemObjId = li._id || li.productId?._id || li.productId
          const qty = Number(quantities[itemObjId] || 0)
          if (qty <= 0) return null
          return {
            productId: li.productId?._id || li.productId,
            quotationItemId: li._id,
            description: li.productName || li.productNameAr || li.description,
            unitCode: li.unitCode || 'PCE',
            quantityDelivered: qty,
          }
        })
        .filter(Boolean)
    }

    if (!lineItems.length) {
      toast.error(language === 'ar' ? 'يجب تسليم بند واحد على الأقل بكمية أكبر من صفر' : 'At least one item must have a delivered quantity greater than 0')
      return
    }

    if (engineOn && !warehouseId) {
      toast.error(language === 'ar' ? 'اختر المستودع — محرك المخزون مفعّل' : 'Select a warehouse — inventory engine is enabled')
      return
    }

    const payload = {
      poId: poId || undefined,
      quotationId: quotationId || undefined,
      customerId: po?.customerId?._id || po?.customerId || quotation?.customerId?._id || quotation?.customerId || undefined,
      customerName: po?.customerId?.nameEn || po?.customerId?.nameAr || quotation?.buyer?.name || quotation?.buyer?.nameAr || recipientName || '',
      warehouseId: warehouseId || undefined,
      lineItems,
      driverName,
      driverPhone,
      vehicleNumber,
      carrier,
      trackingNumber,
      deliveryDate,
      dispatchDate,
      dispatchTime,
      estimatedDeliveryDate,
      estimatedDeliveryTime,
      deliveryWindow,
      shippingAddress,
      destinationCity,
      recipientName,
      recipientPhone,
      notes,
    }

    saveMutation.mutate(payload)
  }

  // If in list picker mode
  if (!isEdit && !poId && !quotationId && !isDirect) {
    return <DeliveryNoteSourcePicker language={language} navigate={navigate} />
  }

  if ((isEdit && dnLoading) || (!isEdit && poLoading) || (!isEdit && qLoading)) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  // ─── VIEW MODE (Display High-End Printable Delivery Note) ──────────────────────
  if (isEdit && dn) {
    const customer = dn.customerId || {}
    const customerName = language === 'ar' ? customer.nameAr || customer.nameEn || dn.customerName : customer.nameEn || customer.nameAr || dn.customerName || '—'

    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        {/* Actions Top Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/app/dashboard/delivery-notes')} className="btn btn-ghost btn-icon">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {dn.dnNumber}
                </h1>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                  {dn.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'ar' ? 'تاريخ التسليم:' : 'Delivery Date:'} {new Date(dn.deliveryDate || dn.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!['delivered', 'fully_invoiced', 'cancelled'].includes(String(dn.status || '').toLowerCase()) ? (
              <button
                type="button"
                disabled={markDeliveredMutation.isPending}
                onClick={() => markDeliveredMutation.mutate({})}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-800 shadow-sm transition hover:bg-sky-100 dark:border-sky-800/40 dark:bg-sky-950/40 dark:text-sky-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{language === 'ar' ? 'تأكيد التسليم' : 'Mark delivered'}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => downloadDeliveryNotePdf({ deliveryNote: dn, tenant, language })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/accounting/invoices/new?deliveryNoteId=${dn._id}`)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>{language === 'ar' ? 'تحويل إلى فاتورة' : 'Convert to Invoice'}</span>
            </button>
          </div>
        </div>

        {/* Printable Document Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-white/10 dark:bg-dark-800">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 border-b border-slate-100 pb-6 dark:border-white/10">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">
                {tenant?.business?.legalNameEn || tenant?.name || 'Company'}
              </h2>
              {tenant?.business?.legalNameAr && (
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{tenant.business.legalNameAr}</p>
              )}
              {tenant?.business?.vatNumber && (
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {language === 'ar' ? 'الرقم الضريبي:' : 'VAT No:'} {tenant.business.vatNumber}
                </p>
              )}
            </div>

            <div className="sm:text-end">
              <span className="inline-block rounded-full bg-slate-950 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white dark:bg-white dark:text-slate-950">
                {language === 'ar' ? 'سند تسليم بضائع' : 'DELIVERY NOTE'}
              </span>
              <p className="mt-1.5 font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{dn.dnNumber}</p>
            </div>
          </div>

          {/* Parties & Logistics Grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? 'المستلم / العميل' : 'Delivered To (Customer)'}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{customerName}</p>
              {dn.recipientName && dn.recipientName !== customerName && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5"><span className="text-slate-400">{language === 'ar' ? 'الشخص المستلم:' : 'Attn:'}</span> {dn.recipientName}</p>
              )}
              {(dn.recipientPhone || customer.phone) && (
                <p className="text-xs text-slate-500 mt-0.5">{dn.recipientPhone || customer.phone}</p>
              )}
              {(dn.shippingAddress || customer.address) && (
                <p className="text-xs text-slate-500 mt-0.5">{dn.shippingAddress || (typeof customer.address === 'string' ? customer.address : '')}</p>
              )}
              {customer.vatNumber && <p className="font-mono text-[11px] text-slate-400 mt-0.5">VAT: {customer.vatNumber}</p>}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? 'بيانات الشحن وموعد التسليم' : 'Logistics, Dispatch & Delivery Time'}
              </p>
              <div className="mt-1 text-xs space-y-1 text-slate-700 dark:text-slate-300">
                {(dn.estimatedDeliveryDate || dn.estimatedDeliveryTime) && (
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="text-slate-400">{language === 'ar' ? 'الوقت المتوقع للتسليم:' : 'Estimated Delivery:'}</span>{' '}
                    {dn.estimatedDeliveryDate ? new Date(dn.estimatedDeliveryDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}{' '}
                    {dn.estimatedDeliveryTime ? `(${dn.estimatedDeliveryTime})` : ''}
                  </p>
                )}
                {dn.dispatchTime && (
                  <p><span className="text-slate-400">{language === 'ar' ? 'وقت الانطلاق:' : 'Dispatch Time:'}</span> {dn.dispatchTime}</p>
                )}
                {dn.driverName && <p><span className="text-slate-400">{language === 'ar' ? 'السائق:' : 'Driver:'}</span> {dn.driverName} {dn.driverPhone ? `(${dn.driverPhone})` : ''}</p>}
                {dn.vehicleNumber && <p><span className="text-slate-400">{language === 'ar' ? 'المركبة:' : 'Vehicle:'}</span> {dn.vehicleNumber}</p>}
                {(dn.carrier || dn.trackingNumber) && (
                  <p><span className="text-slate-400">{language === 'ar' ? 'الشحن / التتبع:' : 'Carrier / Track:'}</span> {dn.carrier || ''} {dn.trackingNumber || ''}</p>
                )}
                {dn.quotationId && (
                  <p><span className="text-slate-400">{language === 'ar' ? 'عرض السعر المرجعي:' : 'Quotation Ref:'}</span> {dn.quotationId?.quotationNumber || dn.quotationId}</p>
                )}
                {dn.purchaseOrderId && (
                  <p><span className="text-slate-400">{language === 'ar' ? 'أمر الشراء المرجعي:' : 'PO Ref:'}</span> {dn.purchaseOrderId?.poNumber || dn.purchaseOrderId}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/10">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-start">#</th>
                  <th className="px-4 py-3 text-start">{language === 'ar' ? 'البند / الوصف' : 'Item Description'}</th>
                  <th className="px-4 py-3 text-center">{language === 'ar' ? 'الوحدة' : 'UOM'}</th>
                  <th className="px-4 py-3 text-end">{language === 'ar' ? 'الكمية المسلمة' : 'Qty Delivered'}</th>
                  <th className="px-4 py-3 text-end">{language === 'ar' ? 'الكمية المفوترة' : 'Qty Invoiced'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {(dn.lineItems || []).map((item, idx) => {
                  const name =
                    language === 'ar'
                      ? item.productId?.nameAr || item.productId?.nameEn || item.description
                      : item.productId?.nameEn || item.productId?.nameAr || item.description || '—'
                  const uom = getUomLabel(item.unitCode || item.productId?.unitOfMeasure || 'PCE', language)

                  return (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{name}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500">{uom}</td>
                      <td className="px-4 py-3 text-end font-bold text-slate-900 dark:text-white">{item.quantityDelivered}</td>
                      <td className="px-4 py-3 text-end text-slate-500">{item.quantityInvoiced || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {dn.notes && (
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-white/[0.02] dark:text-slate-400">
              <span className="font-bold text-slate-700 dark:text-slate-300">{language === 'ar' ? 'ملاحظات:' : 'Notes:'} </span>
              {dn.notes}
            </div>
          )}

          {/* Signatures Footer */}
          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-slate-100 pt-6 dark:border-white/10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? 'توقيع وختم المسلم (الشركة)' : 'Dispatched By (Sender)'}
              </p>
              <div className="mt-8 border-b border-dashed border-slate-300 dark:border-white/20" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? 'توقيع واستلام العميل' : 'Received By (Customer)'}
              </p>
              <div className="mt-8 border-b border-dashed border-slate-300 dark:border-white/20" />
            </div>
          </div>
        </div>

        <RmaPanel deliveryNote={dn} language={language} />
        <DocumentChatter docType="delivery_note" docId={dn._id} language={language} />
      </div>
    )
  }

  // ─── CREATE FORM ─────────────────────────────────────────────────────────────
  const sourceDoc = quotation || po
  const sourceDocNumber = quotation?.quotationNumber || po?.poNumber
  const sourcePartnerName =
    language === 'ar'
      ? quotation?.buyer?.nameAr || quotation?.buyer?.name || po?.customerId?.nameAr || po?.supplierId?.nameAr || po?.supplierId?.nameEn
      : quotation?.buyer?.name || quotation?.buyer?.nameAr || po?.customerId?.nameEn || po?.supplierId?.nameEn || po?.supplierId?.nameAr || '—'

  const lines = quotation?.lineItems || po?.lineItems || []

  const handleFillAll = () => {
    const allQtys = {}
    lines.forEach((li, index) => {
      const itemObjId = li._id || li.productId?._id || li.productId || index
      const ordered = Number(li.quantityOrdered || li.quantity || 1)
      allQtys[itemObjId] = ordered
    })
    setQuantities(allQtys)
    toast.success(language === 'ar' ? 'تمت تعبئة كامل الكميات تلقائياً' : 'All quantities auto-filled')
  }

  const handleClearAll = () => {
    setQuantities({})
    toast(language === 'ar' ? 'تم تفريغ الكميات' : 'Quantities cleared')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {language === 'ar' ? 'إنشاء سند تسليم' : 'Create Delivery Note'}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {sourceDocNumber ? (
              <>
                {language === 'ar' ? 'من المستند:' : 'From Document:'}{' '}
                <span className="font-bold text-primary-600">{sourceDocNumber}</span> ({sourcePartnerName})
              </>
            ) : (
              language === 'ar' ? 'إدخال بنود التسليم' : 'Enter delivery items and logistics details'
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logistics & Estimated Delivery Details Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                <Truck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'بيانات الشحن والتسليم وموعد الوصول المتوقع' : 'Logistics, Dispatch & Estimated Delivery'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'حدد وقت الإرسال، الموعد والوقت المتوقع للتسليم، وبيانات السائق وشركة النقل' : 'Configure dispatch time, estimated arrival, driver, and courier tracking'}
                </p>
              </div>
            </div>
          </div>

          {/* Timing Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الإرسال / التسليم' : 'Dispatch Date'} *</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => {
                  setDeliveryDate(e.target.value)
                  setDispatchDate(e.target.value)
                  if (!estimatedDeliveryDate) setEstimatedDeliveryDate(e.target.value)
                }}
                className="input mt-1 font-mono"
                required
              />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'وقت الانطلاق (Dispatch Time)' : 'Dispatch Time'}</label>
              <input
                type="time"
                value={dispatchTime}
                onChange={(e) => setDispatchTime(e.target.value)}
                className="input mt-1 font-mono"
              />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ التسليم المتوقع (Est. Delivered Date)' : 'Estimated Delivered Date'}</label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="input mt-1 font-mono"
              />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'الوقت المتوقع للتسليم' : 'Estimated Delivery Time'}</label>
              <input
                type="text"
                value={estimatedDeliveryTime}
                onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: 14:30 أو 2-4 ساعات' : 'e.g. 14:00 or 2-4 hours'}
                className="input mt-1"
              />
            </div>
          </div>

          {/* Delivery Window & Destination */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">
                {language === 'ar' ? 'المستودع' : 'Warehouse'}
                {engineOn && <span className="ms-1 text-rose-500">*</span>}
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="select mt-1 font-medium"
              >
                <option value="">
                  {engineOn
                    ? (language === 'ar' ? 'اختر المستودع…' : 'Select warehouse…')
                    : (language === 'ar' ? 'بدون تحديد' : 'Optional')}
                </option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {language === 'ar' ? (w.nameAr || w.nameEn) : w.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'فترة التسليم (Delivery Window)' : 'Delivery Window'}</label>
              <select
                value={deliveryWindow}
                onChange={(e) => setDeliveryWindow(e.target.value)}
                className="select mt-1 font-medium"
              >
                {DELIVERY_WINDOWS.map((win) => (
                  <option key={win.value} value={win.value}>
                    {language === 'ar' ? win.labelAr : win.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'الشخص المستلم / المستلم المسجل' : 'Recipient Person'}</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={language === 'ar' ? 'اسم المستلم' : 'Recipient Name'}
                className="input mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">{language === 'ar' ? 'هاتف المستلم' : 'Recipient Phone'}</label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                className="input mt-1 font-mono"
              />
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <label className="label">{language === 'ar' ? 'عنوان التسليم والوجهة (Destination Address)' : 'Destination / Shipping Address'}</label>
            <input
              type="text"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder={language === 'ar' ? 'العنوان التفصيلي، المبنى، الشارع، الحي، المدينة' : 'Building No, Street, District, City'}
              className="input mt-1"
            />
          </div>

          {/* Driver & Courier Details Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 pt-2 border-t border-slate-100 dark:border-white/5">
            <div>
              <label className="label">{language === 'ar' ? 'اسم السائق' : 'Driver Name'}</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder={language === 'ar' ? 'اسم السائق المسؤول' : 'Driver name'}
                className="input mt-1"
              />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رقم هاتف السائق' : 'Driver Phone'}</label>
              <input
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                className="input mt-1 font-mono"
              />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رقم لوحة المركبة' : 'Vehicle / Plate No.'}</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: أ ب ج 1234' : 'e.g. ABC 1234'}
                className="input mt-1"
              />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'شركة الشحن / التتبع' : 'Carrier & Tracking'}</label>
              <div className="flex gap-1.5 mt-1">
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder={language === 'ar' ? 'الناقل' : 'Carrier'}
                  className="input w-1/2"
                />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="AWB-xxx"
                  className="input w-1/2 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <FileCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'بنود التسليم والكميات (معبأة تلقائياً)' : 'Delivery Items & Quantities (Auto-filled)'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'تمت تعبئة الكميات تلقائياً، يمكنك تعديل أي كمية للتسليم الجزئي' : 'Quantities auto-filled from source document. Adjust for partial deliveries.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFillAll}
                className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
              >
                {language === 'ar' ? 'تعبئة الكل 100%' : 'Auto-fill All'}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 transition"
              >
                {language === 'ar' ? 'تفريغ' : 'Clear'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-start">{language === 'ar' ? 'البند' : 'Item'}</th>
                  <th className="px-4 py-3 text-center">{language === 'ar' ? 'الوحدة' : 'UOM'}</th>
                  <th className="px-4 py-3 text-center">{language === 'ar' ? 'الكمية المطلوبة' : 'Ordered Qty'}</th>
                  <th className="px-4 py-3 text-end w-48">{language === 'ar' ? 'الكمية المسلمة الآن' : 'Delivered Qty'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {lines.map((li, index) => {
                  const itemObjId = li._id || li.productId?._id || li.productId || index
                  const name =
                    language === 'ar'
                      ? li.productId?.nameAr || li.productNameAr || li.productName || li.description
                      : li.productId?.nameEn || li.productName || li.productNameAr || li.description || '—'
                  const ordered = Number(li.quantityOrdered || li.quantity || 1)
                  const uomCode = li.uom || li.unitCode || 'PCE'
                  const uomLabel = getUomLabel(uomCode, language)

                  return (
                    <tr key={itemObjId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {name}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500">
                        {uomLabel}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                        {ordered}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={quantities[itemObjId] ?? ''}
                            onChange={(e) =>
                              setQuantities((prev) => ({ ...prev, [itemObjId]: e.target.value }))
                            }
                            className="input w-28 text-end font-bold font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setQuantities((prev) => ({ ...prev, [itemObjId]: ordered }))}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                            title={language === 'ar' ? 'تسليم كامل الكمية' : 'All'}
                          >
                            {language === 'ar' ? 'الكل' : 'All'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-800 space-y-2">
          <label className="label font-bold text-slate-900 dark:text-white">
            {language === 'ar' ? 'ملاحظات وتعليمات التسليم' : 'Delivery Notes & Instructions'}
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={language === 'ar' ? 'أي ملاحظات خاصة بالتسليم أو تصريح الدخول...' : 'Special delivery instructions, gate pass details...'}
            className="input resize-none"
          />
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/delivery-notes')}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{language === 'ar' ? 'إنشاء سند التسليم الآن' : 'Save Delivery Note'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}


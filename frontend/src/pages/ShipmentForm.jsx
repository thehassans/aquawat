import { useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, useFieldArray } from 'react-hook-form'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Truck,
  Calendar,
  Plus,
  Trash2,
  Printer,
  FileText,
  CheckCircle2,
  XCircle,
  Building,
  Warehouse as WarehouseIcon,
  Package,
  Mail,
  Anchor,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import ShipmentDocumentPreview from '../components/shipments/ShipmentDocumentPreview'
import { buildElementImageBlob, printElementHtml } from '../lib/shipmentPrint'

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    const parts = result.split(',', 2)
    resolve(parts[1] || '')
  }
  reader.onerror = () => reject(reader.error || new Error('Failed to read attachment'))
  reader.readAsDataURL(blob)
})

export default function ShipmentForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const deliveryNoteRef = useRef(null)
  const shippingLabelRef = useRef(null)

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const hasEmailAddon = tenant?.subscription?.hasEmailAddon === true || (Array.isArray(tenant?.subscription?.features) && tenant.subscription.features.includes('email_automation'))
  const hasLandedCosts = true

  const formatDateForInput = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      shipmentNumber: '',
      type: 'inbound',
      status: 'draft',
      supplierId: '',
      purchaseOrderId: '',
      warehouseId: '',
      carrier: '',
      trackingNumber: '',
      shippedAt: '',
      expectedDelivery: '',
      notes: '',
      deliveryRecipient: {
        name: '',
        nameAr: '',
        company: '',
        phone: '',
        email: '',
        referenceNumber: '',
        instructions: '',
        address: {
          street: '',
          district: '',
          city: '',
          postalCode: '',
          country: 'SA',
          buildingNumber: '',
          additionalNumber: '',
        },
      },
      lineItems: [{ productId: '', description: '', quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  const shipmentType = watch('type')
  const shipmentStatus = watch('status')
  const warehouseId = watch('warehouseId')
  const watchedLineItems = watch('lineItems') || []
  const deliveryRecipientValues = watch('deliveryRecipient') || {}
  const requestedType = String(searchParams.get('type') || '').trim().toLowerCase()
  const requestedDocument = String(searchParams.get('document') || '').trim().toLowerCase()

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers),
  })

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders-lookup'],
    queryFn: () => api.get('/purchase-orders', { params: { page: 1, limit: 200 } }).then((res) => res.data.purchaseOrders),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => res.data),
  })

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((res) => res.data.products),
  })

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['shipment', id],
    queryFn: () => api.get(`/shipments/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      reset({
        shipmentNumber: data?.shipmentNumber || '',
        type: data?.type || 'inbound',
        status: data?.status || 'draft',
        supplierId: data?.supplierId?._id || data?.supplierId || '',
        purchaseOrderId: data?.purchaseOrderId?._id || data?.purchaseOrderId || '',
        warehouseId: data?.warehouseId?._id || data?.warehouseId || '',
        carrier: data?.carrier || '',
        trackingNumber: data?.trackingNumber || '',
        shippedAt: formatDateForInput(data?.shippedAt),
        expectedDelivery: formatDateForInput(data?.expectedDelivery),
        notes: data?.notes || '',
        deliveryRecipient: {
          name: data?.deliveryRecipient?.name || '',
          nameAr: data?.deliveryRecipient?.nameAr || '',
          company: data?.deliveryRecipient?.company || '',
          phone: data?.deliveryRecipient?.phone || '',
          email: data?.deliveryRecipient?.email || '',
          referenceNumber: data?.deliveryRecipient?.referenceNumber || '',
          instructions: data?.deliveryRecipient?.instructions || '',
          address: {
            street: data?.deliveryRecipient?.address?.street || '',
            district: data?.deliveryRecipient?.address?.district || '',
            city: data?.deliveryRecipient?.address?.city || '',
            postalCode: data?.deliveryRecipient?.address?.postalCode || '',
            country: data?.deliveryRecipient?.address?.country || 'SA',
            buildingNumber: data?.deliveryRecipient?.address?.buildingNumber || '',
            additionalNumber: data?.deliveryRecipient?.address?.additionalNumber || '',
          },
        },
        lineItems: (data?.lineItems || []).map((li) => ({
          productId: li?.productId?._id || li?.productId || '',
          description: li?.description || '',
          quantity: li?.quantity ?? 0,
        })),
      })
    },
  })

  const isLocked = isEdit && ['delivered', 'cancelled'].includes(shipment?.status)
  const isOutbound = shipmentType === 'outbound'

  const statusBadge = useMemo(() => {
    const status = shipment?.status || shipmentStatus
    if (status === 'delivered') return 'badge-success'
    if (status === 'in_transit') return 'badge-info'
    if (status === 'cancelled') return 'badge-danger'
    return 'badge-neutral'
  }, [shipment?.status, shipmentStatus])

  const statusLabel = (status) => {
    if (language === 'ar') {
      if (status === 'draft') return 'مسودة'
      if (status === 'in_transit') return 'بالطريق'
      if (status === 'delivered') return 'تم التسليم'
      if (status === 'cancelled') return 'ملغي'
      return status
    }
    return status
  }

  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/shipments/${id}`, data) : api.post('/shipments', data)),
    onSuccess: (res) => {
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث الشحنة'
            : 'Shipment updated'
          : language === 'ar'
            ? 'تم إنشاء الشحنة'
            : 'Shipment created'
      )
      queryClient.invalidateQueries(['shipments'])
      queryClient.invalidateQueries(['shipments-stats'])

      if (!isEdit) {
        navigate(`/app/dashboard/shipments/${res.data?._id}`)
      } else {
        queryClient.invalidateQueries(['shipment', id])
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const inTransitMutation = useMutation({
    mutationFn: () => api.post(`/shipments/${id}/mark-in-transit`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الحالة إلى بالطريق' : 'Marked in transit')
      queryClient.invalidateQueries(['shipments'])
      queryClient.invalidateQueries(['shipments-stats'])
      queryClient.invalidateQueries(['shipment', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const deliveredMutation = useMutation({
    mutationFn: () => api.post(`/shipments/${id}/mark-delivered`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الحالة إلى تم التسليم' : 'Marked delivered')
      queryClient.invalidateQueries(['shipments'])
      queryClient.invalidateQueries(['shipments-stats'])
      queryClient.invalidateQueries(['shipment', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/shipments/${id}/cancel`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إلغاء الشحنة' : 'Shipment cancelled')
      queryClient.invalidateQueries(['shipments'])
      queryClient.invalidateQueries(['shipments-stats'])
      queryClient.invalidateQueries(['shipment', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  useEffect(() => {
    if (!warehouseId && Array.isArray(warehouses) && warehouses.length > 0) {
      const primary = warehouses.find((w) => w.isPrimary)
      setValue('warehouseId', primary?._id || warehouses[0]._id)
    }
  }, [warehouseId, warehouses, setValue])

  useEffect(() => {
    if (isEdit) return
    if (requestedType === 'outbound' || requestedDocument === 'delivery-note') {
      setValue('type', 'outbound')
    }
  }, [isEdit, requestedDocument, requestedType, setValue])

  const documentShipment = useMemo(() => {
    const productMap = new Map((products || []).map((product) => [String(product._id), product]))
    const selectedWarehouse = (warehouses || []).find((warehouse) => String(warehouse._id) === String(warehouseId))

    return {
      ...(shipment || {}),
      shipmentNumber: watch('shipmentNumber') || shipment?.shipmentNumber || 'SHP-PREVIEW',
      type: shipmentType,
      status: shipment?.status || shipmentStatus || 'draft',
      carrier: watch('carrier') || shipment?.carrier || '',
      trackingNumber: watch('trackingNumber') || shipment?.trackingNumber || '',
      shippedAt: watch('shippedAt') || shipment?.shippedAt || new Date(),
      expectedDelivery: watch('expectedDelivery') || shipment?.expectedDelivery || undefined,
      notes: watch('notes') || shipment?.notes || '',
      deliveryRecipient: deliveryRecipientValues,
      warehouseId: selectedWarehouse || shipment?.warehouseId,
      lineItems: watchedLineItems.map((line) => ({
        ...line,
        productId: productMap.get(String(line?.productId || '')) || shipment?.lineItems?.find((item) => String(item?.productId?._id || item?.productId || '') === String(line?.productId || ''))?.productId,
      })),
    }
  }, [deliveryRecipientValues, products, shipment, shipmentStatus, shipmentType, warehouses, warehouseId, watchedLineItems, watch])

  const canPrintDeliveryDocuments = isOutbound && (documentShipment?.deliveryRecipient?.name || documentShipment?.deliveryRecipient?.company || documentShipment?.deliveryRecipient?.phone)

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error(language === 'ar' ? 'احفظ الشحنة أولاً' : 'Save the shipment first')
      const attachmentBlob = await buildElementImageBlob({ element: deliveryNoteRef.current })
      if (!(attachmentBlob instanceof Blob)) {
        throw new Error(language === 'ar' ? 'تعذر تجهيز إذن التسليم' : 'Unable to prepare delivery note attachment')
      }
      const contentBase64 = await blobToBase64(attachmentBlob)
      return await api.post(`/shipments/${id}/send-email`, {
        language,
        attachment: {
          filename: `${documentShipment?.shipmentNumber || 'delivery-note'}.png`,
          contentBase64,
          contentType: 'image/png',
          size: attachmentBlob.size,
        },
      }, { timeout: 120000 })
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال إذن التسليم عبر البريد' : 'Delivery note sent successfully')
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.message || (language === 'ar' ? 'تعذر إرسال إذن التسليم' : 'Unable to send delivery note'))
    },
  })

  const onSubmit = (data) => {
    const deliveryRecipient = data.type === 'outbound'
      ? {
          name: data?.deliveryRecipient?.name || undefined,
          nameAr: data?.deliveryRecipient?.nameAr || undefined,
          company: data?.deliveryRecipient?.company || undefined,
          phone: data?.deliveryRecipient?.phone || undefined,
          email: data?.deliveryRecipient?.email || undefined,
          referenceNumber: data?.deliveryRecipient?.referenceNumber || undefined,
          instructions: data?.deliveryRecipient?.instructions || undefined,
          address: {
            street: data?.deliveryRecipient?.address?.street || undefined,
            district: data?.deliveryRecipient?.address?.district || undefined,
            city: data?.deliveryRecipient?.address?.city || undefined,
            postalCode: data?.deliveryRecipient?.address?.postalCode || undefined,
            country: data?.deliveryRecipient?.address?.country || 'SA',
            buildingNumber: data?.deliveryRecipient?.address?.buildingNumber || undefined,
            additionalNumber: data?.deliveryRecipient?.address?.additionalNumber || undefined,
          },
        }
      : undefined

    const payload = {
      shipmentNumber: data.shipmentNumber || undefined,
      type: data.type,
      status: data.status,
      supplierId: data.supplierId || undefined,
      purchaseOrderId: data.purchaseOrderId || undefined,
      warehouseId: data.warehouseId || undefined,
      carrier: data.carrier || undefined,
      trackingNumber: data.trackingNumber || undefined,
      shippedAt: data.shippedAt ? new Date(data.shippedAt) : undefined,
      expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
      notes: data.notes || undefined,
      deliveryRecipient,
      lineItems: (data.lineItems || []).map((li) => ({
        productId: li.productId || undefined,
        description: li.description || undefined,
        quantity: Number(li.quantity || 0),
      })),
    }

    saveMutation.mutate(payload)
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-16 pt-6 lg:-mx-6 lg:px-6" style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-300/18 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-emerald-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700/80">{language === 'ar' ? 'التوريد' : 'Supply chain'}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {isEdit ? (language === 'ar' ? 'تعديل شحنة' : 'Edit shipment') : language === 'ar' ? 'إضافة شحنة' : 'New shipment'}
            </h1>
            {isEdit && (
              <p className="text-sm text-slate-500 mt-1">
                {language === 'ar' ? 'الحالة:' : 'Status:'} <span className={`badge ${statusBadge}`}>{statusLabel(shipment?.status)}</span>
              </p>
            )}
          </div>
        </div>

        {isEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {hasLandedCosts && (shipment?.type === 'inbound' || shipmentType === 'inbound') ? (
              <button
                type="button"
                onClick={() => navigate(`/app/dashboard/landed-costs/new?shipment=${id}`)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-40"
              >
                <Anchor className="w-4 h-4" />
                {language === 'ar' ? 'تكلفة مرسية' : 'Landed Cost'}
              </button>
            ) : null}
            {shipment?.type === 'outbound' && hasEmailAddon ? (
              <button
                type="button"
                onClick={() => sendEmailMutation.mutate()}
                disabled={sendEmailMutation.isPending || !canPrintDeliveryDocuments}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-40"
              >
                {sendEmailMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {language === 'ar' ? 'إرسال إذن التسليم' : 'Send Delivery Note'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                const printed = await printElementHtml({
                  element: deliveryNoteRef.current,
                  title: documentShipment?.shipmentNumber || 'delivery-note',
                })
                if (!printed) {
                  toast.error(language === 'ar' ? 'تعذر طباعة إذن التسليم' : 'Unable to print delivery note')
                }
              }}
              disabled={!canPrintDeliveryDocuments}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-40"
            >
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'إذن تسليم' : 'Delivery Note'}
            </button>
            <button
              type="button"
              onClick={async () => {
                const printed = await printElementHtml({
                  element: shippingLabelRef.current,
                  title: `${documentShipment?.shipmentNumber || 'shipping-label'}-label`,
                })
                if (!printed) {
                  toast.error(language === 'ar' ? 'تعذر طباعة الملصق' : 'Unable to print label')
                }
              }}
              disabled={!canPrintDeliveryDocuments}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              {language === 'ar' ? 'طباعة الملصق' : 'Print Label'}
            </button>
            <button
              type="button"
              onClick={() => inTransitMutation.mutate()}
              disabled={inTransitMutation.isPending || ['in_transit', 'delivered', 'cancelled'].includes(shipment?.status)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-40"
            >
              {inTransitMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  {language === 'ar' ? 'بالطريق' : 'In Transit'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => deliveredMutation.mutate()}
              disabled={deliveredMutation.isPending || ['delivered', 'cancelled'].includes(shipment?.status)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-40"
            >
              {deliveredMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'ar' ? 'تم التسليم' : 'Delivered'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || ['delivered', 'cancelled'].includes(shipment?.status)}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            >
              {cancelMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {isEdit && shipment?.type === 'outbound' ? (
        <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'مستندات الشحنة' : 'Shipment Documents'}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {language === 'ar'
                  ? 'بعد إنشاء الشحنة يمكنك إرسال إذن التسليم بالبريد أو طباعة ملصق الشحن من الأعلى.'
                  : 'After creating the shipment, you can send the delivery note by email or print the shipping label from the actions above.'}
              </p>
            </div>
            {!canPrintDeliveryDocuments ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {language === 'ar' ? 'أكمل بيانات المستلم لتفعيل المستندات.' : 'Complete recipient details to enable shipment documents.'}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Truck className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات الشحنة' : 'Shipment Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'رقم الشحنة' : 'Shipment #'}</label>
              <input
                {...register('shipmentNumber')}
                className="input"
                placeholder={language === 'ar' ? 'تلقائي إذا تركته فارغاً' : 'Auto if left empty'}
                disabled={isEdit}
              />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'النوع' : 'Type'}</label>
              <select {...register('type')} className="select" disabled={isLocked}>
                <option value="inbound">{language === 'ar' ? 'وارد' : 'Inbound'}</option>
                <option value="outbound">{language === 'ar' ? 'صادر' : 'Outbound'}</option>
              </select>
            </div>

            <div>
              <label className="label">{t('status')}</label>
              <select {...register('status')} className="select" disabled>
                <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
                <option value="in_transit">{language === 'ar' ? 'بالطريق' : 'In Transit'}</option>
                <option value="delivered">{language === 'ar' ? 'تم التسليم' : 'Delivered'}</option>
                <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
              </select>
            </div>

            {shipmentType === 'inbound' && (
              <div>
                <label className="label">{language === 'ar' ? 'المورد' : 'Supplier'}</label>
                <select {...register('supplierId')} className="select" disabled={isLocked}>
                  <option value="">{language === 'ar' ? 'اختياري' : 'Optional'}</option>
                  {(suppliers || []).map((s) => (
                    <option key={s._id} value={s._id}>
                      {(language === 'ar' ? s.nameAr || s.nameEn : s.nameEn) || s.code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {shipmentType === 'inbound' && (
              <div>
                <label className="label">{language === 'ar' ? 'طلب شراء' : 'Purchase Order'}</label>
                <select {...register('purchaseOrderId')} className="select" disabled={isLocked}>
                  <option value="">{language === 'ar' ? 'اختياري' : 'Optional'}</option>
                  {(purchaseOrders || []).map((po) => (
                    <option key={po._id} value={po._id}>
                      {po.poNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'} *</label>
              <select {...register('warehouseId', { required: true })} className="select" disabled={isLocked}>
                <option value="">{language === 'ar' ? 'اختر مستودع' : 'Select warehouse'}</option>
                {(warehouses || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
                  </option>
                ))}
              </select>
              {errors.warehouseId && <p className="text-xs text-red-600 mt-1">{language === 'ar' ? 'المستودع مطلوب' : 'Warehouse is required'}</p>}
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'شركة الشحن' : 'Carrier'}</label>
              <input {...register('carrier')} className="input" disabled={isLocked} />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'رقم التتبع' : 'Tracking Number'}</label>
              <input {...register('trackingNumber')} className="input" disabled={isLocked} />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الشحن' : 'Shipped At'}</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" {...register('shippedAt')} className="input ps-10" disabled={isLocked} />
              </div>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ متوقع' : 'Expected Delivery'}</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" {...register('expectedDelivery')} className="input ps-10" disabled={isLocked} />
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
              <textarea {...register('notes')} className="input" rows={3} disabled={isLocked} />
            </div>
          </div>
        </motion.div>

        {isOutbound && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.025 }} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <FileText className="w-5 h-5 text-slate-700 dark:text-slate-200" />
              </div>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'بيانات التسليم' : 'Delivery Details'}</h3>
            </div>

            {shipment?.deliveryNoteIds?.length > 0 && (
              <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-900/30">
                <h4 className="text-sm font-semibold text-primary-800 dark:text-primary-200 mb-2">
                  {language === 'ar' ? 'سندات التسليم المرتبطة' : 'Linked Delivery Notes'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {shipment.deliveryNoteIds.map((dn) => (
                    <span key={dn} className="badge badge-primary">
                      {dn.dnNumber || dn}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="label">{language === 'ar' ? 'اسم المستلم' : 'Recipient Name'}</label>
                <input {...register('deliveryRecipient.name')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'اسم المستلم بالعربية' : 'Recipient Name Arabic'}</label>
                <input {...register('deliveryRecipient.nameAr')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الشركة' : 'Company'}</label>
                <input {...register('deliveryRecipient.company')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
                <input {...register('deliveryRecipient.phone')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                <input type="email" {...register('deliveryRecipient.email')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'رقم المرجع' : 'Reference Number'}</label>
                <input {...register('deliveryRecipient.referenceNumber')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'رقم المبنى' : 'Building Number'}</label>
                <input {...register('deliveryRecipient.address.buildingNumber')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الرقم الإضافي' : 'Additional Number'}</label>
                <input {...register('deliveryRecipient.address.additionalNumber')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الشارع' : 'Street'}</label>
                <input {...register('deliveryRecipient.address.street')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الحي' : 'District'}</label>
                <input {...register('deliveryRecipient.address.district')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'المدينة' : 'City'}</label>
                <input {...register('deliveryRecipient.address.city')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label>
                <input {...register('deliveryRecipient.address.postalCode')} className="input" disabled={isLocked} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الدولة' : 'Country'}</label>
                <input {...register('deliveryRecipient.address.country')} className="input" disabled={isLocked} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="label">{language === 'ar' ? 'تعليمات التسليم' : 'Delivery Instructions'}</label>
                <textarea {...register('deliveryRecipient.instructions')} className="input" rows={3} disabled={isLocked} />
              </div>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'بنود الشحنة' : 'Shipment Items'}</h3>
            </div>

            {!isLocked && (
              <button type="button" onClick={() => append({ productId: '', description: '', quantity: 1 })} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800">
                <Plus className="w-4 h-4" />
                {language === 'ar' ? 'إضافة بند' : 'Add item'}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                  <div className="lg:col-span-5">
                    <label className="label">{language === 'ar' ? 'المنتج' : 'Product'}</label>
                    <select {...register(`lineItems.${index}.productId`)} className="select" disabled={isLocked}>
                      <option value="">{language === 'ar' ? 'اختياري' : 'Optional'}</option>
                      {(products || []).map((p) => (
                        <option key={p._id} value={p._id}>
                          {(language === 'ar' ? p.nameAr || p.nameEn : p.nameEn) || p.sku}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-3">
                    <label className="label">{t('quantity')} *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0 })}
                      className="input"
                      disabled={isLocked}
                    />
                  </div>

                  <div className="lg:col-span-4 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="label">{language === 'ar' ? 'وصف' : 'Description'}</label>
                      <input {...register(`lineItems.${index}.description`)} className="input" disabled={isLocked} />
                    </div>

                    {!isLocked && fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">
            {t('cancel')}
          </button>
          <button type="submit" disabled={saveMutation.isPending || isLocked} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(4,120,87,0.8)] hover:bg-emerald-800 disabled:opacity-50">
            {saveMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('save')}
              </>
            )}
          </button>
        </div>
      </form>

      {isOutbound ? (
        <div className="fixed left-[-10000px] top-0 opacity-0 pointer-events-none" aria-hidden="true">
          <div ref={deliveryNoteRef}>
            <ShipmentDocumentPreview shipment={documentShipment} tenant={tenant} language={language} documentType="delivery-note" />
          </div>
          <div ref={shippingLabelRef}>
            <ShipmentDocumentPreview shipment={documentShipment} tenant={tenant} language={language} documentType="shipping-label" />
          </div>
        </div>
      ) : null}

      {isEdit && shipment && (
        <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">{language === 'ar' ? 'المورد:' : 'Supplier:'}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {shipment.supplierId ? (language === 'ar' ? shipment.supplierId.nameAr || shipment.supplierId.nameEn : shipment.supplierId.nameEn || shipment.supplierId.nameAr) : '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <WarehouseIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">{language === 'ar' ? 'المستودع:' : 'Warehouse:'}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {shipment.warehouseId ? (language === 'ar' ? shipment.warehouseId.nameAr || shipment.warehouseId.nameEn : shipment.warehouseId.nameEn) : '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">{language === 'ar' ? 'النوع:' : 'Type:'}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {language === 'ar' ? (shipment.type === 'inbound' ? 'وارد' : 'صادر') : shipment.type}
              </span>
            </div>
            {shipment.type === 'outbound' && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">{language === 'ar' ? 'المستلم:' : 'Recipient:'}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {shipment.deliveryRecipient?.name || shipment.deliveryRecipient?.company || '-'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

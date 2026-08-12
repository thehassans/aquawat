import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, useFieldArray } from 'react-hook-form'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  Warehouse as WarehouseIcon,
  UserPlus,
  X,
  Printer,
  Download,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { autoTranslateText } from '../lib/builtInTranslator'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import { downloadPurchaseOrderPdf, printPurchaseOrderPdf } from '../lib/invoicePdf'
import Select from 'react-select'
import { ZATCA_UOM_OPTIONS } from '../lib/uomOptions'

const STATUS_PILL = {
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  partially_received: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  approved: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  sent: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
}

export default function PurchaseOrderForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const [receiveWarehouseId, setReceiveWarehouseId] = useState('')
  const [receiveQty, setReceiveQty] = useState({})
  const [manualModes, setManualModes] = useState([])
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(null)
  const [supplierForm, setSupplierForm] = useState({
    code: '',
    nameEn: '',
    nameAr: '',
    contactPerson: '',
    phone: '',
    email: '',
    type: 'company',
  })

  const toggleManualMode = (index) => {
    setManualModes((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

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
      poNumber: '',
      supplierId: '',
      orderDate: formatDateForInput(new Date()),
      expectedDate: '',
      currency: tenant?.settings?.currency || 'SAR',
      notes: '',
      lineItems: [{ productId: '', manualName: '', uom: '', description: '', quantityOrdered: 1, quantityReceived: 0, unitCost: 0, taxRate: 15 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const lineItems = watch('lineItems')

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers),
  })

  useEffect(() => {
    if (!isEdit && searchParams.get('supplierId')) {
      setValue('supplierId', searchParams.get('supplierId'), { shouldValidate: true })
    }
  }, [isEdit, searchParams, setValue, suppliers])

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((res) => res.data.products),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => res.data),
  })

  const addSupplierMutation = useMutation({
    mutationFn: (data) => api.post('/suppliers', data),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إضافة المورد' : 'Supplier added')
      queryClient.invalidateQueries(['suppliers-lookup'])
      queryClient.invalidateQueries(['suppliers'])
      setShowSupplierModal(false)
      setValue('supplierId', res.data._id, { shouldValidate: true })
      setSupplierForm({ code: '', nameEn: '', nameAr: '', contactPerson: '', phone: '', email: '', type: 'company' })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const submitInlineSupplier = () => {
    if (!supplierForm.nameEn?.trim() && !supplierForm.nameAr?.trim()) {
      toast.error(language === 'ar' ? 'اسم المورد مطلوب' : 'Supplier name is required')
      return
    }
    const payload = {
      ...supplierForm,
      nameEn: supplierForm.nameEn || supplierForm.nameAr,
      code: supplierForm.code || `SUP-${Math.floor(Date.now() / 1000).toString().slice(-5)}`,
    }
    addSupplierMutation.mutate(payload)
  }

  // Auto-translate logic for Quick Add Supplier
  useEffect(() => {
    const s = supplierForm.nameEn?.trim()
    if (!s || s.length < 2 || !showSupplierModal) return
    const timer = setTimeout(() => {
      if (supplierForm.nameAr?.trim()) return
      const translated = autoTranslateText(s, 'en', 'ar')
      if (translated) {
        setSupplierForm((p) => ({ ...p, nameAr: translated }))
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [supplierForm.nameEn, showSupplierModal])

  useEffect(() => {
    const s = supplierForm.nameAr?.trim()
    if (!s || s.length < 2 || !showSupplierModal) return
    const timer = setTimeout(() => {
      if (supplierForm.nameEn?.trim()) return
      const translated = autoTranslateText(s, 'ar', 'en')
      if (translated) {
        setSupplierForm((p) => ({ ...p, nameEn: translated }))
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [supplierForm.nameAr, showSupplierModal])

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => api.get(`/purchase-orders/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      reset({
        poNumber: data?.poNumber || '',
        supplierId: data?.supplierId?._id || data?.supplierId || '',
        orderDate: formatDateForInput(data?.orderDate),
        expectedDate: formatDateForInput(data?.expectedDate),
        currency: data?.currency || tenant?.settings?.currency || 'SAR',
        notes: data?.notes || '',
        lineItems: (data?.lineItems || []).map((li) => ({
          productId: li?.productId?._id || li?.productId || '',
          manualName: li?.manualName || '',
          uom: li?.uom || '',
          description: li?.description || '',
          quantityOrdered: li?.quantityOrdered ?? 0,
          quantityReceived: li?.quantityReceived ?? 0,
          unitCost: li?.unitCost ?? 0,
          taxRate: li?.taxRate ?? 15,
        })),
      })
    },
  })

  const isLocked = isEdit && ['partially_received', 'received', 'cancelled'].includes(order?.status)

  const totals = useMemo(() => {
    const items = Array.isArray(lineItems) ? lineItems : []
    let subtotal = 0
    let totalTax = 0

    items.forEach((li) => {
      const qty = Number(li?.quantityOrdered || 0)
      const unit = Number(li?.unitCost || 0)
      const taxRate = Number(li?.taxRate ?? 15)
      const lineSubtotal = qty * unit
      const lineTax = lineSubtotal * (taxRate / 100)
      subtotal += lineSubtotal
      totalTax += lineTax
    })

    return { subtotal, totalTax, grandTotal: subtotal + totalTax }
  }, [lineItems])

  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/purchase-orders/${id}`, data) : api.post('/purchase-orders', data)),
    onSuccess: (res) => {
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث طلب الشراء'
            : 'Purchase order updated'
          : language === 'ar'
            ? 'تم إنشاء طلب الشراء'
            : 'Purchase order created'
      )
      queryClient.invalidateQueries(['purchase-orders'])
      queryClient.invalidateQueries(['purchase-orders-stats'])
      if (isEdit) {
        queryClient.invalidateQueries(['purchase-order', id])
      } else {
        if (res.data?.offline) {
          navigate('/app/dashboard/purchase-orders')
        } else {
          navigate(`/app/dashboard/purchase-orders/${res.data?._id}`)
        }
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/approve`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم اعتماد طلب الشراء' : 'Purchase order approved')
      queryClient.invalidateQueries(['purchase-orders'])
      queryClient.invalidateQueries(['purchase-orders-stats'])
      queryClient.invalidateQueries(['purchase-order', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إلغاء طلب الشراء' : 'Purchase order cancelled')
      queryClient.invalidateQueries(['purchase-orders'])
      queryClient.invalidateQueries(['purchase-orders-stats'])
      queryClient.invalidateQueries(['purchase-order', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const receiveMutation = useMutation({
    mutationFn: (payload) => api.post(`/purchase-orders/${id}/receive`, payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تسجيل الاستلام وتحديث المخزون' : 'Received and stock updated')
      setReceiveQty({})
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['purchase-orders'])
      queryClient.invalidateQueries(['purchase-orders-stats'])
      queryClient.invalidateQueries(['purchase-order', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  useEffect(() => {
    if (!receiveWarehouseId && Array.isArray(warehouses) && warehouses.length > 0) {
      const primary = warehouses.find((w) => w.isPrimary)
      setReceiveWarehouseId(primary?._id || warehouses[0]._id)
    }
  }, [receiveWarehouseId, warehouses])

  const onSubmit = (data) => {
    const cleaned = {
      ...data,
      lineItems: (data.lineItems || []).map((li, index) => ({
        productId: manualModes[index] ? undefined : (li.productId || undefined),
        manualName: manualModes[index] ? (li.manualName || '') : '',
        uom: manualModes[index] ? (li.uom || '') : '',
        description: li.description,
        quantityOrdered: Number(li.quantityOrdered || 0),
        quantityReceived: Number(li.quantityReceived || 0),
        unitCost: Number(li.unitCost || 0),
        taxRate: Number(li.taxRate ?? 15),
      })),
    }
    saveMutation.mutate(cleaned)
  }

  const submitReceive = () => {
    const items = (order?.lineItems || [])
      .map((li) => {
        const productId = li?.productId?._id || li?.productId
        const qty = Number(receiveQty?.[productId] || 0)
        if (!productId || !qty || qty <= 0) return null
        return { productId, quantity: qty }
      })
      .filter(Boolean)

    if (!receiveWarehouseId) {
      toast.error(language === 'ar' ? 'اختر مستودع للاستلام' : 'Select a warehouse')
      return
    }

    if (items.length === 0) {
      toast.error(language === 'ar' ? 'أدخل كميات للاستلام' : 'Enter receiving quantities')
      return
    }

    receiveMutation.mutate({ warehouseId: receiveWarehouseId, items })
  }

  const resolveOrderForPdf = async () => {
    if (order?.lineItems?.length) return order
    const res = await api.get(`/purchase-orders/${id}`)
    return res.data
  }

  const handlePrintPdf = async () => {
    if (!isEdit || !id) return
    const toastId = toast.loading(language === 'ar' ? 'جاري التحضير للطباعة...' : 'Preparing print...')
    setPdfBusy('print')
    try {
      const full = await resolveOrderForPdf()
      await printPurchaseOrderPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'جاهز للطباعة' : 'Ready to print', { id: toastId })
    } catch (e) {
      toast.error(language === 'ar' ? 'فشل الطباعة' : 'Print failed', { id: toastId })
    } finally {
      setPdfBusy(null)
    }
  }

  const handleDownloadPdf = async () => {
    if (!isEdit || !id) return
    const toastId = toast.loading(language === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...')
    setPdfBusy('download')
    try {
      const full = await resolveOrderForPdf()
      await downloadPurchaseOrderPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'تم التنزيل' : 'Downloaded', { id: toastId })
    } catch (e) {
      toast.error(language === 'ar' ? 'فشل التنزيل' : 'Download failed', { id: toastId })
    } finally {
      setPdfBusy(null)
    }
  }

  const statusLabel = (status) => {
    if (language === 'ar') {
      if (status === 'draft') return 'مسودة'
      if (status === 'sent') return 'مرسل'
      if (status === 'approved') return 'معتمد'
      if (status === 'partially_received') return 'مستلم جزئياً'
      if (status === 'received') return 'مستلم'
      if (status === 'cancelled') return 'ملغي'
      return status
    }
    if (status === 'partially_received') return 'Partially received'
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : status
  }

  const shell = 'overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0c111a]'
  const ghostBtn =
    'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/[0.04]'
  const primaryBtn =
    'inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
  const inkBtn =
    'inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-white" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/purchase-orders')}
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              {language === 'ar' ? 'طلبات الشراء' : 'Purchase orders'}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[28px]">
              {isEdit
                ? language === 'ar'
                  ? 'تعديل طلب شراء'
                  : 'Edit purchase order'
                : language === 'ar'
                  ? 'طلب شراء جديد'
                  : 'New purchase order'}
            </h1>
            {isEdit && order && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{order.poNumber}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                    STATUS_PILL[order.status] || STATUS_PILL.draft
                  }`}
                >
                  {statusLabel(order.status)}
                </span>
              </div>
            )}
          </div>
        </div>

        {isEdit && order && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button type="button" onClick={handlePrintPdf} disabled={Boolean(pdfBusy)} className={ghostBtn}>
              {pdfBusy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 opacity-70" />}
              {language === 'ar' ? 'طباعة' : 'Print'}
            </button>
            <button type="button" onClick={handleDownloadPdf} disabled={Boolean(pdfBusy)} className={inkBtn}>
              {pdfBusy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 opacity-80" />}
              {language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/invoices/new/purchase?poId=${id}`)}
              className={ghostBtn}
            >
              <FileText className="h-4 w-4 opacity-70" />
              {language === 'ar' ? 'فاتورة شراء' : 'Purchase invoice'}
            </button>
            {order?.flow === 'sell' && (
              <button
                type="button"
                onClick={() => navigate(`/app/dashboard/delivery-notes/new?poId=${id}`)}
                className={ghostBtn}
              >
                <FileText className="h-4 w-4 opacity-70" />
                {language === 'ar' ? 'إذن تسليم' : 'Delivery note'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/invoices/new/sell?poId=${id}`)}
              className={ghostBtn}
            >
              <FileText className="h-4 w-4 opacity-70" />
              {language === 'ar' ? 'فاتورة بيع' : 'Sell invoice'}
            </button>
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || ['approved', 'received', 'cancelled', 'partially_received'].includes(order?.status)}
              className={ghostBtn}
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 opacity-70" />
                  {language === 'ar' ? 'اعتماد' : 'Approve'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || ['received', 'cancelled'].includes(order?.status)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200/80 bg-white px-3.5 py-2 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4 opacity-70" />
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <form id="po-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-5 sm:p-6`}>
          <div className="mb-5 border-b border-slate-100 pb-4 dark:border-white/[0.08]">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {language === 'ar' ? 'معلومات الطلب' : 'Order information'}
            </p>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              {language === 'ar' ? 'المورد والتواريخ والملاحظات' : 'Supplier, dates, and notes'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">{language === 'ar' ? 'رقم الطلب' : 'PO number'}</label>
              <input
                {...register('poNumber')}
                className="input"
                placeholder={language === 'ar' ? 'تلقائي إذا تركته فارغاً' : 'Auto if left empty'}
                disabled={isEdit}
              />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'المورد' : 'Supplier'} *</label>
              <div className="flex gap-2">
                <select {...register('supplierId', { required: true })} className="select flex-1" disabled={isLocked}>
                  <option value="">{language === 'ar' ? 'اختر مورد' : 'Select supplier'}</option>
                  {(suppliers || []).map((s) => (
                    <option key={s._id} value={s._id}>
                      {(language === 'ar' ? s.nameAr || s.nameEn : s.nameEn) || s.code}
                    </option>
                  ))}
                </select>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(true)}
                    className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                    title={language === 'ar' ? 'إضافة مورد جديد' : 'Add new supplier'}
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                )}
              </div>
              {errors.supplierId && (
                <p className="mt-1 text-xs text-rose-600">{language === 'ar' ? 'المورد مطلوب' : 'Supplier is required'}</p>
              )}
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'العملة' : 'Currency'}</label>
              <input {...register('currency')} className="input" disabled />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الطلب' : 'Order date'}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" {...register('orderDate')} className="input ps-10" disabled={isLocked} />
              </div>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ متوقع' : 'Expected date'}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" {...register('expectedDate')} className="input ps-10" disabled={isLocked} />
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
              <textarea {...register('notes')} className="input" rows={3} disabled={isLocked} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className={`${shell} p-5 sm:p-6`}
        >
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'بنود الطلب' : 'Line items'}
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'المنتجات والكميات والتكاليف' : 'Products, quantities, and costs'}
              </p>
            </div>

            {!isLocked && (
              <button
                type="button"
                onClick={() => {
                  append({
                    productId: '',
                    manualName: '',
                    uom: '',
                    description: '',
                    quantityOrdered: 1,
                    quantityReceived: 0,
                    unitCost: 0,
                    taxRate: 15,
                  })
                  setManualModes((p) => [...p, false])
                }}
                className={ghostBtn}
              >
                <Plus className="h-4 w-4 opacity-70" />
                {language === 'ar' ? 'إضافة بند' : 'Add item'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const current = lineItems?.[index] || {}
              const qty = Number(current?.quantityOrdered || 0)
              const received = Number(current?.quantityReceived || 0)
              const unit = Number(current?.unitCost || 0)
              const taxRate = Number(current?.taxRate ?? 15)
              const lineSubtotal = qty * unit
              const lineTax = lineSubtotal * (taxRate / 100)
              const lineTotal = lineSubtotal + lineTax
              const remaining = Math.max(0, qty - received)

              return (
                <div
                  key={field.id}
                  className="rounded-2xl border border-slate-100 p-4 dark:border-white/[0.08]"
                >
                  <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                      <div className="mb-1 flex items-center justify-between">
                        <label className="label mb-0">{language === 'ar' ? 'المنتج' : 'Product'} *</label>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => toggleManualMode(index)}
                            className="text-[11px] font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                          >
                            {manualModes[index]
                              ? language === 'ar'
                                ? 'اختر من قائمة'
                                : 'Select from list'
                              : language === 'ar'
                                ? 'كتابة يدوية'
                                : 'Type manually'}
                          </button>
                        )}
                      </div>
                      {manualModes[index] ? (
                        <div className="flex gap-2">
                          <input
                            {...register(`lineItems.${index}.manualName`, { required: true })}
                            placeholder={language === 'ar' ? 'اسم المنتج' : 'Product name'}
                            className="input flex-1"
                            disabled={isLocked}
                          />
                          <div className="w-48">
                            <Select
                              inputId={`uom-${index}`}
                              options={ZATCA_UOM_OPTIONS.map((u) => ({
                                value: u.code,
                                label: language === 'ar' ? u.labelAr : u.labelEn,
                              }))}
                              value={
                                ZATCA_UOM_OPTIONS.find((u) => u.code === watch(`lineItems.${index}.uom`))
                                  ? {
                                      value: watch(`lineItems.${index}.uom`),
                                      label:
                                        language === 'ar'
                                          ? ZATCA_UOM_OPTIONS.find((u) => u.code === watch(`lineItems.${index}.uom`))
                                              ?.labelAr
                                          : ZATCA_UOM_OPTIONS.find((u) => u.code === watch(`lineItems.${index}.uom`))
                                              ?.labelEn,
                                    }
                                  : null
                              }
                              onChange={(selected) => setValue(`lineItems.${index}.uom`, selected?.value || 'PCE')}
                              isSearchable
                              isDisabled={isLocked}
                              menuPortalTarget={document.body}
                              styles={{
                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                control: (base) => ({
                                  ...base,
                                  borderRadius: '0.75rem',
                                  borderColor: '#e2e8f0',
                                  padding: '0.125rem',
                                  minHeight: '42px',
                                }),
                              }}
                            />
                            <input type="hidden" {...register(`lineItems.${index}.uom`)} />
                          </div>
                        </div>
                      ) : (
                        <select
                          {...register(`lineItems.${index}.productId`, { required: !manualModes[index] })}
                          className="select"
                          disabled={isLocked}
                        >
                          <option value="">{language === 'ar' ? 'اختر منتج' : 'Select product'}</option>
                          {(products || []).map((p) => (
                            <option key={p._id} value={p._id}>
                              {(language === 'ar' ? p.nameAr || p.nameEn : p.nameEn) || p.sku}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="lg:col-span-2">
                      <label className="label">{language === 'ar' ? 'الكمية' : 'Qty'} *</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        {...register(`lineItems.${index}.quantityOrdered`, {
                          valueAsNumber: true,
                          required: true,
                          min: 0,
                        })}
                        className="input"
                        disabled={isLocked}
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="label">{language === 'ar' ? 'سعر الوحدة' : 'Unit cost'}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        {...register(`lineItems.${index}.unitCost`, { valueAsNumber: true, min: 0 })}
                        className="input"
                        disabled={isLocked}
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="label">{language === 'ar' ? 'الضريبة' : 'Tax'} %</label>
                      <select
                        {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })}
                        className="select"
                        disabled={isLocked}
                      >
                        <option value={15}>15%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:col-span-2">
                      <div className="flex-1 text-end">
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                          {t('total')}
                        </p>
                        <p className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">
                          <Money value={lineTotal} />
                        </p>
                        {isEdit && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {language === 'ar' ? 'متبقي' : 'Remaining'}: {remaining}
                          </p>
                        )}
                      </div>
                      {!isLocked && fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <input type="hidden" {...register(`lineItems.${index}.quantityReceived`, { valueAsNumber: true })} />

                  <div className="mt-4">
                    <label className="label">{language === 'ar' ? 'وصف' : 'Description'}</label>
                    <input {...register(`lineItems.${index}.description`)} className="input" disabled={isLocked} />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={`${shell} p-5 sm:p-6`}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="w-full space-y-2.5 md:w-72">
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">{t('subtotal')}</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-100">
                  <Money value={totals.subtotal} />
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">{t('tax')}</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-100">
                  <Money value={totals.totalTax} />
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-[15px] font-semibold dark:border-white/[0.08]">
                <span className="text-slate-900 dark:text-white">{t('total')}</span>
                <span className="tabular-nums text-slate-900 dark:text-white">
                  <Money value={totals.grandTotal} />
                </span>
              </div>
            </div>

            <div className="hidden gap-3 md:flex">
              <button type="button" onClick={() => navigate('/app/dashboard/purchase-orders')} className={ghostBtn}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={saveMutation.isPending || isLocked} className={primaryBtn}>
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 opacity-80" />
                    {t('save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </form>

      {/* Sticky primary save */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0c111a]/90 md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/purchase-orders')}
            className={`${ghostBtn} flex-1 justify-center`}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="po-form"
            disabled={saveMutation.isPending || isLocked}
            className={`${primaryBtn} flex-1 justify-center`}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 opacity-80" />
                {t('save')}
              </>
            )}
          </button>
        </div>
      </div>

      {isEdit && order && ['approved', 'partially_received'].includes(order.status) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-5 sm:p-6`}>
          <div className="mb-5 border-b border-slate-100 pb-4 dark:border-white/[0.08]">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {language === 'ar' ? 'استلام المخزون' : 'Receive stock'}
            </p>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              {language === 'ar' ? 'تسجيل الكميات الواردة وتحديث المخزون' : 'Record incoming quantities and update stock'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
              <select
                value={receiveWarehouseId}
                onChange={(e) => setReceiveWarehouseId(e.target.value)}
                className="select"
              >
                {(warehouses || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/[0.08]">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                          {language === 'ar' ? 'المنتج' : 'Product'}
                        </th>
                        <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                          {language === 'ar' ? 'المتبقي' : 'Remaining'}
                        </th>
                        <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                          {language === 'ar' ? 'استلام' : 'Receive'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.lineItems || []).map((li, rowIndex) => {
                        const productId = li?.productId?._id || li?.productId
                        const name = li?.manualName
                          ? `${li.manualName}${li.uom ? ` (${li.uom})` : ''}`
                          : language === 'ar'
                            ? li?.productId?.nameAr || li?.productId?.nameEn
                            : li?.productId?.nameEn || li?.productId?.nameAr
                        const remaining = Math.max(
                          0,
                          Number(li.quantityOrdered || 0) - Number(li.quantityReceived || 0)
                        )

                        return (
                          <tr key={productId || li?.manualName || rowIndex}>
                            <td className="text-[13px] font-medium text-slate-900 dark:text-white">{name || '—'}</td>
                            <td className="tabular-nums text-slate-600 dark:text-slate-300">{remaining}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                max={remaining}
                                value={receiveQty?.[productId] ?? ''}
                                onChange={(e) =>
                                  setReceiveQty((prev) => ({ ...prev, [productId]: e.target.value }))
                                }
                                className="input"
                                placeholder="0"
                                disabled={remaining <= 0}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={submitReceive}
                  disabled={receiveMutation.isPending}
                  className={primaryBtn}
                >
                  {receiveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <WarehouseIcon className="h-4 w-4 opacity-80" />
                      {language === 'ar' ? 'تسجيل الاستلام' : 'Receive'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${shell} w-full max-w-sm max-h-[90vh] overflow-y-auto p-6`}
          >
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/[0.08]">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {language === 'ar' ? 'الموردون' : 'Suppliers'}
                </p>
                <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إضافة مورد سريع' : 'Quick add supplier'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">{language === 'ar' ? 'الاسم (EN)' : 'Name (EN)'} *</label>
                <input
                  className="input"
                  value={supplierForm.nameEn}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, nameEn: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</label>
                <input
                  className="input"
                  dir="rtl"
                  value={supplierForm.nameAr}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, nameAr: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
                <input
                  className="input"
                  placeholder="+9665xxxxxxxx"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowSupplierModal(false)} className={ghostBtn}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitInlineSupplier}
                disabled={addSupplierMutation.isPending}
                className={primaryBtn}
              >
                {addSupplierMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 opacity-80" />
                    {language === 'ar' ? 'حفظ المورد' : 'Save supplier'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

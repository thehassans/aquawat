import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, useFieldArray } from 'react-hook-form'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  ShoppingCart,
  Building,
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
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { autoTranslateText } from '../lib/builtInTranslator'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import { downloadPurchaseOrderPdf, printPurchaseOrderPdf } from '../lib/invoicePdf'
import Select from 'react-select'
import { ZATCA_UOM_OPTIONS } from '../lib/uomOptions'
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
      code: supplierForm.code || `SUP-${Math.floor(Date.now() / 1000).toString().slice(-5)}`
    }
    addSupplierMutation.mutate(payload)
  }

  // Auto-translate logic for Quick Add Supplier
  useEffect(() => {
    const s = supplierForm.nameEn?.trim()
    if (!s || s.length < 2 || !showSupplierModal) return
    const timer = setTimeout(() => {
      if (supplierForm.nameAr?.trim()) return // Don't overwrite if user typed AR
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
      if (supplierForm.nameEn?.trim()) return // Don't overwrite if user typed EN
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
          navigate(`/purchase-orders/${res.data?._id}`)
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

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? (language === 'ar' ? 'تعديل طلب شراء' : 'Edit Purchase Order') : language === 'ar' ? 'إضافة طلب شراء' : 'Add Purchase Order'}
            </h1>
            {isEdit && (
              <p className="text-sm text-gray-500 mt-1">
                {language === 'ar' ? 'الحالة:' : 'Status:'}{' '}
                <span className={`badge ${order?.status === 'received' ? 'badge-success' : order?.status === 'partially_received' ? 'badge-warning' : order?.status === 'cancelled' ? 'badge-danger' : order?.status === 'approved' ? 'badge-info' : 'badge-neutral'}`}>
                  {language === 'ar'
                    ? order?.status === 'draft'
                      ? 'مسودة'
                      : order?.status === 'sent'
                        ? 'مرسل'
                        : order?.status === 'approved'
                          ? 'معتمد'
                          : order?.status === 'partially_received'
                            ? 'مستلم جزئياً'
                            : order?.status === 'received'
                              ? 'مستلم'
                              : order?.status === 'cancelled'
                                ? 'ملغي'
                                : order?.status
                    : order?.status}
                </span>
              </p>
            )}
          </div>
        </div>

        {isEdit && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={async () => {
                try {
                  await printPurchaseOrderPdf({ purchaseOrder: order, language, tenant })
                } catch (e) {
                  toast.error(language === 'ar' ? 'فشل الطباعة' : 'Print failed')
                }
              }}
              className="btn btn-secondary"
            >
              <Printer className="w-4 h-4" />
              {language === 'ar' ? 'طباعة' : 'Print'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await downloadPurchaseOrderPdf({ purchaseOrder: order, language, tenant })
                  toast.success(language === 'ar' ? 'تم التنزيل' : 'Downloaded')
                } catch (e) {
                  toast.error(language === 'ar' ? 'فشل التنزيل' : 'Download failed')
                }
              }}
              className="btn btn-secondary"
            >
              <Download className="w-4 h-4" />
              {language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/invoices/new/purchase?poId=${id}`)}
              className="btn btn-secondary"
            >
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء فاتورة شراء' : 'Create Purchase Invoice'}
            </button>
            {order?.flow === 'sell' && (
              <button
                type="button"
                onClick={() => navigate(`/app/dashboard/delivery-notes/new?poId=${id}`)}
                className="btn btn-secondary"
              >
                <FileText className="w-4 h-4" />
                {language === 'ar' ? 'إنشاء إذن تسليم' : 'Create Delivery Note'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/invoices/new/sell?poId=${id}`)}
              className="btn btn-secondary"
            >
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء فاتورة بيع' : 'Create Sell Invoice'}
            </button>
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || ['approved', 'received', 'cancelled', 'partially_received'].includes(order?.status)}
              className="btn btn-secondary"
            >
              {approveMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'ar' ? 'اعتماد' : 'Approve'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || ['received', 'cancelled'].includes(order?.status)}
              className="btn btn-danger"
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات الطلب' : 'Order Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'رقم الطلب' : 'PO Number'}</label>
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
                <select
                  {...register('supplierId', { required: true })}
                  className="select flex-1"
                  disabled={isLocked}
                >
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
                    className="btn btn-secondary shrink-0"
                    title={language === 'ar' ? 'إضافة مورد جديد' : 'Add new supplier'}
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
              {errors.supplierId && <p className="text-xs text-red-600 mt-1">{language === 'ar' ? 'المورد مطلوب' : 'Supplier is required'}</p>}
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'العملة' : 'Currency'}</label>
              <input {...register('currency')} className="input" disabled />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الطلب' : 'Order Date'}</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" {...register('orderDate')} className="input ps-10" disabled={isLocked} />
              </div>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ متوقع' : 'Expected Date'}</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" {...register('expectedDate')} className="input ps-10" disabled={isLocked} />
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
              <textarea {...register('notes')} className="input" rows={3} disabled={isLocked} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'بنود الطلب' : 'Line Items'}</h3>
            </div>

            {!isLocked && (
              <button
                type="button"
                onClick={() => { append({ productId: '', manualName: '', uom: '', description: '', quantityOrdered: 1, quantityReceived: 0, unitCost: 0, taxRate: 15 }); setManualModes((p) => [...p, false]); }}
                className="btn btn-secondary"
              >
                <Plus className="w-4 h-4" />
                {language === 'ar' ? 'إضافة بند' : 'Add item'}
              </button>
            )}
          </div>

          <div className="space-y-4">
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
                <div key={field.id} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                    <div className="lg:col-span-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="label mb-0">{language === 'ar' ? 'المنتج' : 'Product'} *</label>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => toggleManualMode(index)}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 underline underline-offset-2"
                          >
                            {manualModes[index]
                              ? (language === 'ar' ? 'اختر من قائمة' : 'Select from list')
                              : (language === 'ar' ? 'كتابة يدوية' : 'Type manually')}
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
                              options={ZATCA_UOM_OPTIONS.map(u => ({ value: u.code, label: language === 'ar' ? u.labelAr : u.labelEn }))}
                              value={ZATCA_UOM_OPTIONS.find(u => u.code === watch(`lineItems.${index}.uom`)) ? { value: watch(`lineItems.${index}.uom`), label: language === 'ar' ? ZATCA_UOM_OPTIONS.find(u => u.code === watch(`lineItems.${index}.uom`))?.labelAr : ZATCA_UOM_OPTIONS.find(u => u.code === watch(`lineItems.${index}.uom`))?.labelEn } : null}
                              onChange={(selected) => setValue(`lineItems.${index}.uom`, selected?.value || 'PCE')}
                              isSearchable
                              isDisabled={isLocked}
                              menuPortalTarget={document.body}
                              styles={{
                                menuPortal: base => ({ ...base, zIndex: 9999 }),
                                control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e5e7eb', padding: '0.125rem', minHeight: '42px' })
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
                        {...register(`lineItems.${index}.quantityOrdered`, { valueAsNumber: true, required: true, min: 0 })}
                        className="input"
                        disabled={isLocked}
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="label">{language === 'ar' ? 'سعر الوحدة' : 'Unit Cost'}</label>
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
                      <select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className="select" disabled={isLocked}>
                        <option value={15}>15%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>

                    <div className="lg:col-span-2 flex items-center justify-between gap-3">
                      <div className="text-end flex-1">
                        <p className="text-xs text-gray-500 mb-1">{t('total')}</p>
                        <p className="font-semibold"><Money value={lineTotal} /></p>
                        {isEdit && (
                          <p className="text-xs text-gray-500 mt-1">
                            {language === 'ar' ? 'متبقي' : 'Remaining'}: {remaining}
                          </p>
                        )}
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

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-2 md:w-72">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('subtotal')}</span>
                <span><Money value={totals.subtotal} /></span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('tax')}</span>
                <span><Money value={totals.totalTax} /></span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-dark-600">
                <span>{t('total')}</span>
                <span className="text-primary-600"><Money value={totals.grandTotal} /></span>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
                {t('cancel')}
              </button>
              <button type="submit" disabled={saveMutation.isPending || isLocked} className="btn btn-primary">
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
          </div>
        </motion.div>
      </form>

      {isEdit && order && ['approved', 'partially_received'].includes(order.status) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <WarehouseIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'استلام المخزون' : 'Receive Stock'}</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
              <select value={receiveWarehouseId} onChange={(e) => setReceiveWarehouseId(e.target.value)} className="select">
                {(warehouses || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th>{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                      <th>{language === 'ar' ? 'استلام' : 'Receive'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.lineItems || []).map((li) => {
                      const productId = li?.productId?._id || li?.productId
                      const name = li?.manualName
                        ? `${li.manualName}${li.uom ? ` (${li.uom})` : ''}`
                        : (language === 'ar' ? li?.productId?.nameAr || li?.productId?.nameEn : li?.productId?.nameEn || li?.productId?.nameAr)
                      const remaining = Math.max(0, Number(li.quantityOrdered || 0) - Number(li.quantityReceived || 0))

                      return (
                        <tr key={productId || li?.manualName || index}>
                          <td className="font-medium text-gray-900 dark:text-white">{name || '-'}</td>
                          <td>{remaining}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              max={remaining}
                              value={receiveQty?.[productId] ?? ''}
                              onChange={(e) => setReceiveQty((prev) => ({ ...prev, [productId]: e.target.value }))}
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

              <div className="mt-4 flex justify-end">
                <button type="button" onClick={submitReceive} disabled={receiveMutation.isPending} className="btn btn-primary">
                  {receiveMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <WarehouseIcon className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <UserPlus className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold">{language === 'ar' ? 'إضافة مورد سريع' : 'Quick Add Supplier'}</h3>
              </div>
              <button type="button" onClick={() => setShowSupplierModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                <X className="w-5 h-5" />
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

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowSupplierModal(false)} className="btn btn-secondary">
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitInlineSupplier}
                disabled={addSupplierMutation.isPending}
                className="btn btn-primary"
              >
                {addSupplierMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {language === 'ar' ? 'حفظ المورد' : 'Save Supplier'}
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

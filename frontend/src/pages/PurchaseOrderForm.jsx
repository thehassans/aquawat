import { useEffect, useMemo, useState, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
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
  Paperclip,
  Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { autoTranslateText } from '../lib/builtInTranslator'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import { downloadPurchaseOrderPdf, printPurchaseOrderPdf } from '../lib/invoicePdf'
import { getAvailableUomOptions } from '../lib/uomOptions'
import ProductTypeToggle from '../components/ui/ProductTypeToggle'
import PremiumFileDrop from '../components/ui/PremiumFileDrop'
import { normalizeProductType, productPickerLabel } from '../lib/productType'
import { computePurchaseLineTotals } from '../lib/purchaseLineTotals'
import PurchaseReceivingLedger from './purchases/PurchaseReceivingLedger'

const STATUS_PILL = {
  billed: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  partially_received: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  delayed: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
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
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [pendingBills, setPendingBills] = useState([])
  const [landedCostLines, setLandedCostLines] = useState([
    { type: 'freight', amount: '', description: '' },
    { type: 'customs_duty', amount: '', description: '' },
    { type: 'insurance', amount: '', description: '' },
    { type: 'other', amount: '', description: '' },
  ])
  const [includeLandedCost, setIncludeLandedCost] = useState(false)
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
  const [warehouseForm, setWarehouseForm] = useState({
    code: '',
    nameEn: '',
    nameAr: '',
    type: 'main',
    isPrimary: false,
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
      warehouseId: '',
      orderDate: formatDateForInput(new Date()),
      expectedDate: '',
      currency: tenant?.settings?.currency || 'SAR',
      notes: '',
      lineItems: [{ productId: '', manualName: '', uom: 'PCE', description: '', productType: 'goods', quantityOrdered: 1, quantityReceived: 0, quantityReturned: 0, unitCost: 0, taxRate: 15 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const lineItems = useWatch({ control, name: 'lineItems' })

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
    queryFn: async () => {
      try {
        const res = await api.get('/warehouses')
        return Array.isArray(res.data) ? res.data : res.data?.warehouses || []
      } catch {
        return []
      }
    },
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

  const addWarehouseMutation = useMutation({
    mutationFn: (data) => api.post('/warehouses', data),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إضافة المستودع' : 'Warehouse added')
      queryClient.invalidateQueries(['warehouses'])
      setShowWarehouseModal(false)
      setValue('warehouseId', res.data._id, { shouldValidate: true })
      setWarehouseForm({ code: '', nameEn: '', nameAr: '', type: 'main', isPrimary: false })
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

  useEffect(() => {
    const s = warehouseForm.nameEn?.trim()
    if (!s || s.length < 2 || !showWarehouseModal) return
    const timer = setTimeout(() => {
      if (warehouseForm.nameAr?.trim()) return
      const translated = autoTranslateText(s, 'en', 'ar')
      if (translated) setWarehouseForm((p) => ({ ...p, nameAr: translated }))
    }, 120)
    return () => clearTimeout(timer)
  }, [warehouseForm.nameEn, showWarehouseModal])

  useEffect(() => {
    const s = warehouseForm.nameAr?.trim()
    if (!s || s.length < 2 || !showWarehouseModal) return
    const timer = setTimeout(() => {
      if (warehouseForm.nameEn?.trim()) return
      const translated = autoTranslateText(s, 'ar', 'en')
      if (translated) setWarehouseForm((p) => ({ ...p, nameEn: translated }))
    }, 120)
    return () => clearTimeout(timer)
  }, [warehouseForm.nameAr, showWarehouseModal])

  const submitInlineWarehouse = () => {
    if (!warehouseForm.nameEn?.trim() && !warehouseForm.nameAr?.trim()) {
      toast.error(language === 'ar' ? 'اسم المستودع مطلوب' : 'Warehouse name is required')
      return
    }
    addWarehouseMutation.mutate({
      ...warehouseForm,
      nameEn: warehouseForm.nameEn || warehouseForm.nameAr,
      code: warehouseForm.code || `WH-${Math.floor(Date.now() / 1000).toString().slice(-5)}`,
    })
  }

  const uploadVendorBill = async (orderId, file) => {
    const body = new FormData()
    body.append('file', file)
    await api.post(`/purchase-orders/${orderId}/attachments`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
  }

  const applyProductToLine = (index, productId) => {
    const product = (products || []).find((row) => String(row._id) === String(productId))
    if (!product) return
    setValue(`lineItems.${index}.productType`, normalizeProductType(product.productType), { shouldDirty: true })
    setValue(`lineItems.${index}.uom`, product.unitOfMeasure || product.unitCode || 'PCE', { shouldDirty: true })
    if (product.costPrice != null && product.costPrice !== '') {
      setValue(`lineItems.${index}.unitCost`, Number(product.costPrice) || 0, { shouldDirty: true })
    }
    setValue(`lineItems.${index}.manualName`, '')
    setValue(`lineItems.${index}.nameEn`, product.nameEn || '')
    setValue(`lineItems.${index}.nameAr`, product.nameAr || '')
  }

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => api.get(`/purchase-orders/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!order) return
    const items = Array.isArray(order.lineItems) ? order.lineItems : []
    reset({
      poNumber: order.poNumber || '',
      supplierId: order.supplierId?._id || order.supplierId || '',
      warehouseId: order.warehouseId?._id || order.warehouseId || '',
      orderDate: formatDateForInput(order.orderDate),
      expectedDate: formatDateForInput(order.expectedDate),
      currency: order.currency || tenant?.settings?.currency || 'SAR',
      notes: order.notes || '',
      lineItems:
        items.length > 0
          ? items.map((li) => ({
              productId: li?.productId?._id || li?.productId || '',
              manualName: li?.manualName || '',
              uom: li?.uom || li?.productId?.unitOfMeasure || 'PCE',
              description: li?.description || '',
              productType: li?.productType || li?.productId?.productType || 'goods',
              quantityOrdered: li?.quantityOrdered ?? 0,
              quantityReceived: li?.quantityReceived ?? 0,
              quantityReturned: li?.quantityReturned ?? 0,
              unitCost: li?.unitCost ?? 0,
              taxRate: li?.taxRate ?? 15,
            }))
          : [{ productId: '', manualName: '', uom: 'PCE', description: '', productType: 'goods', quantityOrdered: 1, quantityReceived: 0, quantityReturned: 0, unitCost: 0, taxRate: 15 }],
    })
    setManualModes(items.map((li) => Boolean(li?.manualName && !li?.productId)))
    const existingLc = (order.related?.landedCosts || []).find((lc) => (lc.costLines || []).length) || order.related?.landedCosts?.[0]
    if (existingLc?.costLines?.length) {
      const byType = Object.fromEntries((existingLc.costLines || []).map((line) => [line.type, line]))
      setLandedCostLines((prev) => prev.map((row) => ({
        ...row,
        amount: byType[row.type]?.amount ?? row.amount,
        description: byType[row.type]?.description || row.description,
      })))
      setIncludeLandedCost((existingLc.costLines || []).some((line) => Number(line.amount) > 0))
    }
  }, [order, reset, tenant?.settings?.currency])

  const isLocked = isEdit && ['partially_received', 'received', 'billed', 'cancelled'].includes(order?.status)

  const totals = computePurchaseLineTotals(lineItems)

  const uomOptions = useMemo(() => getAvailableUomOptions(tenant), [tenant])

  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/purchase-orders/${id}`, data) : api.post('/purchase-orders', data)),
    onSuccess: async (res) => {
      const createdId = String(res.data?._id || res.data?.id || '')
      const orderId = isEdit ? id : createdId
      if (orderId && pendingBills.length) {
        try {
          for (const file of pendingBills) {
            await uploadVendorBill(orderId, file)
          }
          setPendingBills([])
        } catch (err) {
          toast.error(err.response?.data?.error || (language === 'ar' ? 'تم الحفظ وتعذر رفع الفاتورة' : 'Saved, but bill upload failed'))
        }
      }
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث طلب الشراء'
            : 'Purchase order updated'
          : language === 'ar'
            ? 'تم إنشاء طلب الشراء'
            : 'Purchase order created'
      )
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-open'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })
      navigate('/app/dashboard/purchases/orders', { replace: true })
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

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/send`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال طلب الشراء' : 'Purchase order sent')
      queryClient.invalidateQueries(['purchase-orders'])
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
        uom: li.uom || 'PCE',
        description: li.description,
        productType: normalizeProductType(li.productType),
        quantityOrdered: Number(li.quantityOrdered || 0),
        quantityReceived: Number(li.quantityReceived || 0),
        quantityReturned: Number(li.quantityReturned || 0),
        unitCost: Number(li.unitCost || 0),
        taxRate: Number(li.taxRate ?? 15),
      })),
    }
    saveMutation.mutate({
      ...cleaned,
      landedCostLines: includeLandedCost
        ? landedCostLines
          .map((line) => ({ ...line, amount: Number(line.amount || 0) }))
          .filter((line) => line.amount > 0)
        : [],
    })
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
    const data = res?.data
    const full = data?.purchaseOrder || data?.order || data
    if (!full?._id && !full?.poNumber) throw new Error('Purchase order not found')
    return full
  }

  const handlePrintPdf = async () => {
    if (!isEdit || !id) return
    const toastId = toast.loading(language === 'ar' ? 'جاري التحضير للطباعة...' : 'Preparing print...')
    setPdfBusy('print')
    try {
      const full = await resolveOrderForPdf()
      await printPurchaseOrderPdf({
        purchaseOrder: full,
        language,
        tenant,
      })
      toast.success(language === 'ar' ? 'جاهز للطباعة' : 'Ready to print', { id: toastId })
    } catch (e) {
      console.error('[PurchaseOrderForm] PDF print failed', e)
      toast.error(language === 'ar' ? 'فشل الطباعة' : 'Print failed', { id: toastId })
    } finally {
      setPdfBusy(null)
    }
  }

  const openVendorBill = async (file, { download = false } = {}) => {
    if (!id || !file) return
    const toastId = toast.loading(
      download
        ? (language === 'ar' ? 'جاري تنزيل الفاتورة...' : 'Downloading bill...')
        : (language === 'ar' ? 'جاري فتح الفاتورة...' : 'Opening bill...')
    )
    try {
      const files = order?.attachments || []
      const index = Math.max(0, files.findIndex((row) => (row.url && row.url === file.url) || (row.name && row.name === file.name)))
      const fileId = encodeURIComponent(file.key?.split('/').pop() || file.name || String(index))
      const res = await api.get(`/purchase-orders/${id}/attachments/${fileId}`, {
        responseType: 'blob',
        params: { inline: download ? 0 : 1 },
        timeout: 60000,
      })
      const blobType = res.data?.type || file.mimeType || 'application/octet-stream'
      if (String(blobType).includes('json')) {
        const parsed = JSON.parse(await res.data.text())
        throw new Error(parsed.error || 'Vendor bill not found')
      }
      const blob = new Blob([res.data], { type: file.mimeType || blobType })
      const url = URL.createObjectURL(blob)
      if (download) {
        const link = document.createElement('a')
        link.href = url
        link.download = file.name || 'vendor-bill'
        document.body.appendChild(link)
        link.click()
        link.remove()
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      toast.success(
        download
          ? (language === 'ar' ? 'تم تنزيل الفاتورة' : 'Bill downloaded')
          : (language === 'ar' ? 'تم فتح الفاتورة' : 'Bill opened'),
        { id: toastId }
      )
    } catch (err) {
      let message = language === 'ar' ? 'تعذر فتح الفاتورة. أعد رفعها.' : 'Could not open the bill. Please upload it again.'
      const data = err.response?.data
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text())
          if (parsed?.error) message = parsed.error
        } catch { /* keep fallback */ }
      } else if (err.response?.data?.error || err.message) {
        message = err.response?.data?.error || err.message
      }
      toast.error(message, { id: toastId })
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
      console.error('[PurchaseOrderForm] PDF download failed', e)
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
      if (status === 'billed') return 'مفوتر'
      if (status === 'cancelled') return 'ملغي'
      return status
    }
    if (status === 'partially_received') return 'Partially received'
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : status
  }

  const shell =
    'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
  const ghostBtn =
    'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/[0.04]'
  const primaryBtn =
    'inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'
  const inkBtn =
    'inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'

  const workflow = [
    { id: 'draft', label: language === 'ar' ? 'مسودة' : 'Draft' },
    { id: 'approved', label: language === 'ar' ? 'اعتماد' : 'Approved' },
    { id: 'partially_received', label: language === 'ar' ? 'استلام' : 'Receiving' },
    { id: 'received', label: language === 'ar' ? 'مكتمل' : 'Received' },
  ]
  const workflowIndex = (() => {
    const s = order?.status || 'draft'
    if (s === 'cancelled') return -1
    if (s === 'received') return 3
    if (s === 'partially_received') return 2
    if (s === 'approved' || s === 'sent') return 1
    return 0
  })()

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
            onClick={() => navigate('/app/dashboard/purchases/orders')}
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              {language === 'ar' ? 'طلبات الشراء' : 'Purchase orders'}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[28px]">
              {isEdit
                ? language === 'ar'
                  ? 'طلب شراء'
                  : 'Purchase order'
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
                {order.receivingLedger?.delayedCount > 0 && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL.delayed}`}>
                    {language === 'ar' ? `متأخر · ${order.receivingLedger.delayedCount}` : `Delayed · ${order.receivingLedger.delayedCount}`}
                  </span>
                )}
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
            {(order?.attachments || []).slice(-1).map((file) => (
              <Fragment key={file.url || file.name}>
                <button type="button" onClick={() => openVendorBill(file)} className={ghostBtn}>
                  <Eye className="h-4 w-4 opacity-70" />
                  {language === 'ar' ? 'عرض الفاتورة' : 'View bill'}
                </button>
                <button type="button" onClick={() => openVendorBill(file, { download: true })} className={ghostBtn}>
                  <Paperclip className="h-4 w-4 opacity-70" />
                  {language === 'ar' ? 'تنزيل الفاتورة' : 'Download bill'}
                </button>
              </Fragment>
            ))}
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/purchases/grn/new?poId=${id}`)}
              disabled={!['draft', 'approved', 'sent', 'partially_received'].includes(order?.status)}
              className={ghostBtn}
            >
              <WarehouseIcon className="h-4 w-4 opacity-70" />
              {language === 'ar' ? 'إنشاء إشعار استلام' : 'Create GRN'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/purchases/returns/new`)}
              disabled={!['partially_received', 'received', 'billed'].includes(order?.status)}
              className={ghostBtn}
            >
              <FileText className="h-4 w-4 opacity-70" />
              {language === 'ar' ? 'مرتجع' : 'Return'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/purchases/landed-costs/new?po=${id}`)}
              disabled={!['partially_received', 'received', 'billed'].includes(order?.status)}
              className={ghostBtn}
            >
              <FileText className="h-4 w-4 opacity-70" />
              {language === 'ar' ? 'تكلفة مرسية' : 'Landed cost'}
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
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !['draft'].includes(order?.status)}
              className={ghostBtn}
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 opacity-70" />}
              {language === 'ar' ? 'إرسال' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || ['approved', 'received', 'billed', 'cancelled', 'partially_received'].includes(order?.status)}
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

      {isEdit && order && order.status !== 'cancelled' && (
        <div className={`${shell} px-5 py-4`}>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {workflow.map((step, index) => {
              const done = workflowIndex >= index
              const current = workflowIndex === index
              return (
                <div key={step.id} className="flex items-center gap-2 sm:gap-3">
                  {index > 0 && <div className={`h-px w-6 sm:w-10 ${done ? 'bg-teal-600' : 'bg-slate-200 dark:bg-white/10'}`} />}
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                        done
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-slate-500'
                      } ${current ? 'ring-2 ring-teal-600/30' : ''}`}
                    >
                      {index + 1}
                    </span>
                    <span className={`text-[12px] font-medium ${done ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isEdit && order && (
        <PurchaseReceivingLedger order={order} language={language} />
      )}

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
              <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'} *</label>
              <div className="flex gap-2">
                <select {...register('warehouseId')} className="select flex-1" disabled={isLocked}>
                  <option value="">{language === 'ar' ? 'اختر مستودع' : 'Select warehouse'}</option>
                  {(Array.isArray(warehouses) ? warehouses : []).map((w) => (
                    <option key={w._id} value={w._id}>
                      {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
                    </option>
                  ))}
                </select>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setShowWarehouseModal(true)}
                    className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                    title={language === 'ar' ? 'إنشاء مستودع' : 'Create warehouse'}
                  >
                    <WarehouseIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
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
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'فاتورة المورد (PDF / صورة)' : 'Vendor bill (PDF / image)'}</label>
              <PremiumFileDrop
                language={language}
                disabled={isLocked}
                files={order?.attachments || []}
                pendingFiles={pendingBills}
                onAdd={(list) => {
                  const file = list[0]
                  if (!file) return
                  if (isEdit && id) {
                    uploadVendorBill(id, file)
                      .then(() => {
                        toast.success(language === 'ar' ? 'تم رفع المرفق' : 'Attachment uploaded')
                        queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })
                      })
                      .catch((err) => toast.error(err.response?.data?.error || (language === 'ar' ? 'فشل الرفع' : 'Upload failed')))
                  } else {
                    setPendingBills((prev) => [...prev, file])
                  }
                }}
                onRemovePending={(idx) => setPendingBills((prev) => prev.filter((_, i) => i !== idx))}
              />
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
                    uom: 'PCE',
                    description: '',
                    productType: 'goods',
                    quantityOrdered: 1,
                    quantityReceived: 0,
                    quantityReturned: 0,
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
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="label mb-0">{language === 'ar' ? 'المنتج' : 'Product'} *</label>
                        <div className="flex items-center gap-2">
                          <ProductTypeToggle
                            value={watch(`lineItems.${index}.productType`)}
                            onChange={(next) => setValue(`lineItems.${index}.productType`, next, { shouldDirty: true, shouldTouch: true })}
                            language={language}
                          />
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
                      </div>
                      <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                      {manualModes[index] ? (
                        <input
                          {...register(`lineItems.${index}.manualName`, { required: true })}
                          placeholder={language === 'ar' ? 'اسم المنتج' : 'Product name'}
                          className="input"
                          disabled={isLocked}
                        />
                      ) : (
                        <select
                          {...register(`lineItems.${index}.productId`, {
                            required: !manualModes[index],
                            onChange: (e) => applyProductToLine(index, e.target.value),
                          })}
                          className="select"
                          disabled={isLocked}
                        >
                          <option value="">{language === 'ar' ? 'اختر منتج' : 'Select product'}</option>
                          {(products || []).map((p) => (
                            <option key={p._id} value={p._id}>
                              {productPickerLabel(p, language) || p.sku}
                            </option>
                          ))}
                        </select>
                      )}
                      {(current?.nameEn || current?.nameAr) && (
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          <span dir="ltr">{current.nameEn || current.nameAr}</span>
                          {current.nameEn && current.nameAr ? <span className="mx-1 text-slate-300">·</span> : null}
                          {current.nameEn && current.nameAr ? <span dir="rtl">{current.nameAr}</span> : null}
                        </p>
                      )}
                    </div>

                    <div className="lg:col-span-2">
                      <label className="label">{language === 'ar' ? 'الوحدة' : 'UOM'}</label>
                      <select {...register(`lineItems.${index}.uom`)} className="select" disabled={isLocked}>
                        {uomOptions.map((uom) => (
                          <option key={uom.code} value={uom.code}>
                            {language === 'ar' ? uom.labelAr : uom.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="lg:col-span-1">
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

                    <div className="lg:col-span-1">
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
          transition={{ delay: 0.06 }}
          className={`${shell} p-5 sm:p-6`}
        >
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'التكلفة المرسية' : 'Landed cost'}
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'اختياري — الشحن والجمارك والتأمين تُوزَّع على بنود البضاعة عند الترحيل'
                  : 'Optional — freight, customs, and insurance allocate onto goods when posted'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIncludeLandedCost((prev) => !prev)}
              disabled={isLocked}
              className={`${includeLandedCost ? primaryBtn : ghostBtn} px-3.5 py-2 text-[12px]`}
            >
              {includeLandedCost
                ? (language === 'ar' ? 'إخفاء' : 'Hide')
                : (language === 'ar' ? 'إضافة تكلفة مرسية' : 'Add landed cost')}
            </button>
          </div>
          {includeLandedCost ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {landedCostLines.map((line, index) => (
                <label key={line.type} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {line.type === 'freight' ? (language === 'ar' ? 'شحن' : 'Freight')
                    : line.type === 'customs_duty' ? (language === 'ar' ? 'جمارك' : 'Customs')
                      : line.type === 'insurance' ? (language === 'ar' ? 'تأمين' : 'Insurance')
                        : (language === 'ar' ? 'أخرى' : 'Other')}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    disabled={isLocked}
                    placeholder="0.00"
                    onChange={(e) => setLandedCostLines((prev) => prev.map((row, i) => (i === index ? { ...row, amount: e.target.value } : row)))}
                    className="input mt-1.5 font-normal normal-case tracking-normal"
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400">
              {language === 'ar'
                ? 'يمكنك حفظ الطلب بدون تكلفة مرسية وإضافتها لاحقاً من صفحة التكاليف المرسية.'
                : 'Save the order without landed cost, or add it later from Landed cost.'}
            </p>
          )}
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
              <button type="button" onClick={() => navigate('/app/dashboard/purchases/orders')} className={ghostBtn}>
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
            onClick={() => navigate('/app/dashboard/purchases/orders')}
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
              {language === 'ar' ? 'إنشاء إشعار استلام وتحديث المخزون' : 'Create a GRN and post warehouse stock'}
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

      {isEdit && order?.related && (
        <div className={`${shell} p-5 sm:p-6`}>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            {language === 'ar' ? 'المستندات المرتبطة' : 'Related documents'}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: language === 'ar' ? 'إشعارات الاستلام' : 'GRNs', items: order.related.grns, href: (d) => `/app/dashboard/purchases/grn/${d._id}`, label: (d) => d.grnNumber },
              { title: language === 'ar' ? 'المرتجعات' : 'Returns', items: order.related.returns, href: (d) => `/app/dashboard/purchases/returns/${d._id}`, label: (d) => d.returnNumber },
              { title: language === 'ar' ? 'تكاليف مرسية' : 'Landed costs', items: order.related.landedCosts, href: (d) => `/app/dashboard/purchases/landed-costs/${d._id}`, label: (d) => d.lcNumber },
              { title: language === 'ar' ? 'فواتير الشراء' : 'Vendor bills', items: order.related.invoices, href: (d) => `/app/dashboard/invoices/${d._id}`, label: (d) => d.invoiceNumber },
            ].map((group) => (
              <div key={group.title}>
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{group.title}</p>
                {(group.items || []).length === 0 ? (
                  <p className="mt-2 text-[12px] text-slate-400">—</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {group.items.map((doc) => (
                      <li key={doc._id}>
                        <button type="button" onClick={() => navigate(group.href(doc))} className="font-mono text-[12px] text-teal-700 hover:underline">
                          {group.label(doc)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
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

      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${shell} w-full max-w-sm max-h-[90vh] overflow-y-auto p-6`}
          >
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/[0.08]">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {language === 'ar' ? 'المستودعات' : 'Warehouses'}
                </p>
                <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إنشاء مستودع' : 'Create warehouse'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">{language === 'ar' ? 'الرمز' : 'Code'}</label>
                <input
                  className="input"
                  placeholder="WH-001"
                  value={warehouseForm.code}
                  onChange={(e) => setWarehouseForm((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الاسم (EN)' : 'Name (EN)'} *</label>
                <input
                  className="input"
                  value={warehouseForm.nameEn}
                  onChange={(e) => setWarehouseForm((p) => ({ ...p, nameEn: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</label>
                <input
                  className="input"
                  dir="rtl"
                  value={warehouseForm.nameAr}
                  onChange={(e) => setWarehouseForm((p) => ({ ...p, nameAr: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'النوع' : 'Type'}</label>
                <select
                  className="select"
                  value={warehouseForm.type}
                  onChange={(e) => setWarehouseForm((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="main">{language === 'ar' ? 'رئيسي' : 'Main'}</option>
                  <option value="branch">{language === 'ar' ? 'فرع' : 'Branch'}</option>
                  <option value="distribution">{language === 'ar' ? 'توزيع' : 'Distribution'}</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowWarehouseModal(false)} className={ghostBtn}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitInlineWarehouse}
                disabled={addWarehouseMutation.isPending}
                className={primaryBtn}
              >
                {addWarehouseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 opacity-80" />
                    {language === 'ar' ? 'حفظ المستودع' : 'Save warehouse'}
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

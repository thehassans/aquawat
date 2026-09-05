import { useEffect, useMemo, useState, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
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
  Edit3,
  CreditCard,
  Building2,
  Package,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Receipt,
  AlertCircle,
  MessageCircle,
  Mail,
  Send,
  Phone,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { contactToSupplier, fetchContactsList } from '../lib/contactMappers'
import { autoTranslateText } from '../lib/builtInTranslator'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import { downloadPurchaseOrderPdf, printPurchaseOrderPdf, downloadVendorBillPdf, printVendorBillPdf } from '../lib/invoicePdfActions'
import { getAvailableUomOptions, getUomLabel } from '../lib/uomOptions'
import ProductTypeToggle from '../components/ui/ProductTypeToggle'
import PremiumFileDrop from '../components/ui/PremiumFileDrop'
import { normalizeProductType, productPickerLabel, isStockTrackedProductType } from '../lib/productType'
import { computePurchaseLineTotals } from '../lib/purchaseLineTotals'
import PurchaseReceivingLedger from './purchases/PurchaseReceivingLedger'
import RecordPoPaymentModal from '../components/purchases/RecordPoPaymentModal'
import PurchasePaymentsLedger from '../components/purchases/PurchasePaymentsLedger'
import { showArabicFields as isArabicTenantMarket } from '../lib/saudiTenant'
import VariantLineSelect from '../components/inventory/VariantLineSelect'
import PartnerCombobox from '../components/inventory/PartnerCombobox'
import { formatInvError, pickApiErrorPayload } from '../lib/invError'

const STATUS_PILL = {
  billed: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  refunded: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  partially_received: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  delayed: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  approved: 'bg-teal-50 text-teal-700 ring-teal-200/80 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20',
  sent: 'bg-blue-50 text-blue-700 ring-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20',
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
}

const PAYMENT_STATUS_PILL = {
  pending: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
}

export function formatLineItemName(li, language = 'en', productsList = []) {
  if (!li) return '—'
  const list = Array.isArray(productsList) ? productsList : []
  const product = (li.productId && typeof li.productId === 'object')
    ? li.productId
    : (list.find((p) => String(p?._id) === String(li.productId)) || null)

  if (language === 'ar') {
    if (product?.nameAr) return product.nameAr
    if (product?.nameEn) {
      const tr = autoTranslateText(product.nameEn, 'en', 'ar')
      if (tr) return tr
      return product.nameEn
    }
    if (li.manualNameAr) return li.manualNameAr
    if (li.manualName) {
      if (/[\u0600-\u06FF]/.test(li.manualName)) return li.manualName
      const tr = autoTranslateText(li.manualName, 'en', 'ar')
      if (tr) return tr
      return li.manualName
    }
    if (li.description) {
      if (/[\u0600-\u06FF]/.test(li.description)) return li.description
      const tr = autoTranslateText(li.description, 'en', 'ar')
      if (tr) return tr
      return li.description
    }
    return '—'
  }

  // English
  if (product?.nameEn) return product.nameEn
  if (product?.nameAr) {
    const tr = autoTranslateText(product.nameAr, 'ar', 'en')
    if (tr) return tr
    return product.nameAr
  }
  if (li.manualNameEn) return li.manualNameEn
  if (li.manualName) {
    if (!/[\u0600-\u06FF]/.test(li.manualName)) return li.manualName
    const tr = autoTranslateText(li.manualName, 'ar', 'en')
    if (tr) return tr
    return li.manualName
  }
  if (li.description) {
    if (!/[\u0600-\u06FF]/.test(li.description)) return li.description
    const tr = autoTranslateText(li.description, 'ar', 'en')
    if (tr) return tr
    return li.description
  }
  return '—'
}

function poReceiveLineKey(li, idx) {
  const productId = li?.productId?._id || li?.productId
  const variantId = li?.variantId?._id || li?.variantId
  if (!productId) return `line_${idx}`
  return `${productId}|${variantId || ''}`
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
  const showArabicFields = isArabicTenantMarket(tenant)

  const [isViewMode, setIsViewMode] = useState(isEdit)
  const [showLivePreviewModal, setShowLivePreviewModal] = useState(false)
  const [showVendorBillModal, setShowVendorBillModal] = useState(false)
  const [createdOrderForPreview, setCreatedOrderForPreview] = useState(null)
  const [showQuickReceiveModal, setShowQuickReceiveModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [whatsAppPhone, setWhatsAppPhone] = useState('')
  const [whatsAppText, setWhatsAppText] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  const paymentStatusLabel = (status) => {
    const ar = { pending: 'قيد الانتظار', partial: 'مدفوع جزئياً', paid: 'مدفوع', overdue: 'متأخر' }
    return language === 'ar' ? (ar[status] || status) : (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending')
  }

  const [receiveWarehouseId, setReceiveWarehouseId] = useState('')
  const [receiveQty, setReceiveQty] = useState({})
  const [receiveNotes, setReceiveNotes] = useState('')
  const [lineRemainingActions, setLineRemainingActions] = useState({})
  const [manualModes, setManualModes] = useState([])
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
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

  const formatDateForInput = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: formatDateForInput(new Date()),
    method: 'transfer',
    reference: '',
  })
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
    type: 'main',
    isPrimary: false,
  })
  const [showProductModal, setShowProductModal] = useState(false)
  const [productModalTargetIndex, setProductModalTargetIndex] = useState(null)
  const [productForm, setProductForm] = useState({
    sku: '',
    nameEn: '',
    nameAr: '',
    productType: 'goods',
    unitOfMeasure: 'PCE',
    costPrice: '',
    sellingPrice: '',
    taxRate: 15,
  })

  const toggleManualMode = (index) => {
    setManualModes((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '34px',
      height: '34px',
      fontSize: '12px',
      borderRadius: '0.75rem',
      borderColor: state.isFocused ? '#0d9488' : '#e2e8f0',
      boxShadow: state.isFocused ? '0 0 0 1px #0d9488' : 'none',
      backgroundColor: 'transparent',
      '&:hover': {
        borderColor: '#cbd5e1',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      height: '34px',
      padding: '0 8px',
    }),
    input: (base) => ({
      ...base,
      margin: '0',
      padding: '0',
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: '34px',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      padding: '4px',
    }),
    clearIndicator: (base) => ({
      ...base,
      padding: '4px',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 99999 }),
    menu: (base) => ({
      ...base,
      borderRadius: '0.75rem',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e2e8f0',
      zIndex: 99999,
      overflow: 'hidden',
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '12px',
      padding: '6px 12px',
      backgroundColor: state.isSelected ? '#0d9488' : state.isFocused ? '#f0fdfa' : 'transparent',
      color: state.isSelected ? '#ffffff' : state.isFocused ? '#0f766e' : '#1e293b',
      cursor: 'pointer',
    }),
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
      initialPaidAmount: '',
      initialPaymentMethod: 'transfer',
      initialPaymentReference: '',
      lineItems: [{ productId: '', variantId: '', manualName: '', uom: 'PCE', description: '', productType: 'goods', quantityOrdered: 1, quantityReceived: 0, quantityReturned: 0, unitCost: 0, taxRate: 15 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const lineItems = useWatch({ control, name: 'lineItems' })

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: async () => {
      try {
        const { contacts } = await fetchContactsList(api, { types: 'supplier', limit: 200, isActive: 'all' })
        return contacts.filter((c) => c.entityType === 'supplier').map(contactToSupplier)
      } catch {
        return []
      }
    },
  })
  const suppliers = Array.isArray(suppliersData) ? suppliersData : []

  const { data: supplierFinancialsData } = useQuery({
    queryKey: ['suppliers-financials'],
    queryFn: async () => {
      try {
        const res = await api.get('/suppliers/financials')
        return Array.isArray(res.data) ? res.data : []
      } catch {
        return []
      }
    },
  })
  const supplierFinancials = Array.isArray(supplierFinancialsData) ? supplierFinancialsData : []

  useEffect(() => {
    if (isEdit) return
    const fromParam = searchParams.get('partnerId') || searchParams.get('supplierId')
    if (!fromParam) return
    setValue('supplierId', fromParam, { shouldValidate: true })
    let cancelled = false
    api.get(`/suppliers/${fromParam}`).then((res) => {
      if (!cancelled && res.data) setSelectedSupplier(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isEdit, searchParams, setValue])

  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      try {
        const res = await api.get('/products', { params: { limit: 200 } })
        return Array.isArray(res.data?.products)
          ? res.data.products
          : Array.isArray(res.data)
            ? res.data
            : []
      } catch {
        return []
      }
    },
  })
  const products = Array.isArray(productsData) ? productsData : []

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      try {
        const res = await api.get('/warehouses')
        return Array.isArray(res.data) ? res.data : Array.isArray(res.data?.warehouses) ? res.data.warehouses : []
      } catch {
        return []
      }
    },
  })
  const warehouses = Array.isArray(warehousesData) ? warehousesData : []

  const addSupplierMutation = useMutation({
    mutationFn: (data) => api.post('/suppliers', data),
    onSuccess: (res) => {
      const created = res.data?.data || res.data
      toast.success(language === 'ar' ? 'تم إضافة المورد' : 'Supplier added')
      queryClient.setQueryData(['suppliers'], (prev) => {
        const list = Array.isArray(prev) ? prev : []
        if (!created?._id) return list
        if (list.some((s) => String(s._id) === String(created._id))) return list
        return [created, ...list]
      })
      queryClient.invalidateQueries({ queryKey: ['suppliers-lookup'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setShowSupplierModal(false)
      if (created?._id) {
        setValue('supplierId', created._id, { shouldValidate: true, shouldDirty: true })
        setSelectedSupplier(created)
      }
      setSupplierForm({ code: '', nameEn: '', nameAr: '', contactPerson: '', phone: '', email: '', type: 'company' })
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error'),
  })

  const addWarehouseMutation = useMutation({
    mutationFn: (data) => api.post('/warehouses', data),
    onSuccess: (res) => {
      const created = res.data?.data || res.data
      toast.success(language === 'ar' ? 'تم إضافة المستودع' : 'Warehouse added')
      queryClient.setQueryData(['warehouses'], (prev) => {
        const list = Array.isArray(prev) ? prev : []
        if (!created?._id) return list
        if (list.some((w) => String(w._id) === String(created._id))) return list
        return [...list, created]
      })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      setShowWarehouseModal(false)
      if (created?._id) {
        setValue('warehouseId', String(created._id), { shouldValidate: true, shouldDirty: true })
      }
      setWarehouseForm({ code: '', nameEn: '', nameAr: '', type: 'main', isPrimary: false })
    },
    onError: (err) => {
      const payload = err?.response?.data
      const msg = String(payload?.error || err?.message || '')
      if (err?.response?.status === 409 || /duplicate|E11000|already exists/i.test(msg)) {
        const existing = payload?.warehouse
        if (existing?._id) {
          queryClient.setQueryData(['warehouses'], (prev) => {
            const list = Array.isArray(prev) ? prev : []
            if (list.some((w) => String(w._id) === String(existing._id))) return list
            return [...list, existing]
          })
          setValue('warehouseId', String(existing._id), { shouldValidate: true, shouldDirty: true })
          setShowWarehouseModal(false)
          toast.success(language === 'ar' ? 'المستودع موجود — تم تحديده' : 'Warehouse already exists — selected')
          return
        }
        toast.error(language === 'ar' ? 'رمز المستودع مستخدم مسبقاً — غيّر الرمز' : 'Warehouse code already exists — use a different code')
        return
      }
      toast.error(formatInvError(err, language) || 'Error')
    },
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
    const code = String(warehouseForm.code || '').trim().toUpperCase()
      || `WH-${Math.floor(Date.now() / 1000).toString().slice(-5)}`
    // Already in list (e.g. prior save succeeded but UI stuck) — just select it
    const existing = warehouses.find((w) => String(w.code || '').toUpperCase() === code)
    if (existing?._id) {
      setValue('warehouseId', String(existing._id), { shouldValidate: true, shouldDirty: true })
      setShowWarehouseModal(false)
      toast.success(language === 'ar' ? 'تم تحديد المستودع' : 'Warehouse selected')
      return
    }
    addWarehouseMutation.mutate({
      ...warehouseForm,
      nameEn: (warehouseForm.nameEn || warehouseForm.nameAr || '').trim(),
      nameAr: (warehouseForm.nameAr || '').trim(),
      code,
      isActive: true,
    })
  }

  const addProductMutation = useMutation({
    mutationFn: (data) => api.post('/products', data),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إضافة المنتج بنجاح' : 'Product created successfully')
      queryClient.invalidateQueries({ queryKey: ['products-list'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-dropdown'] })
      setShowProductModal(false)
      const created = res.data
      if (productModalTargetIndex !== null && productModalTargetIndex !== undefined) {
        setValue(`lineItems.${productModalTargetIndex}.productId`, created._id, { shouldDirty: true, shouldValidate: true })
        setValue(`lineItems.${productModalTargetIndex}.productType`, normalizeProductType(created.productType), { shouldDirty: true })
        setValue(`lineItems.${productModalTargetIndex}.uom`, created.unitOfMeasure || created.unitCode || getDefaultUom(tenant) || '', { shouldDirty: true })
        if (created.costPrice != null && created.costPrice !== '') {
          setValue(`lineItems.${productModalTargetIndex}.unitCost`, Number(created.costPrice) || 0, { shouldDirty: true })
        }
        setValue(`lineItems.${productModalTargetIndex}.manualName`, '')
        setManualModes((prev) => {
          const next = [...prev]
          next[productModalTargetIndex] = false
          return next
        })
      }
      setProductForm({
        sku: '',
        nameEn: '',
        nameAr: '',
        productType: 'goods',
        unitOfMeasure: getDefaultUom(tenant) || '',
        costPrice: '',
        sellingPrice: '',
        taxRate: 15,
      })
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Failed to create product'),
  })

  const submitInlineProduct = () => {
    if (!productForm.nameEn?.trim() && !productForm.nameAr?.trim()) {
      toast.error(language === 'ar' ? 'اسم المنتج مطلوب' : 'Product name is required')
      return
    }
    const payload = {
      ...productForm,
      nameEn: productForm.nameEn?.trim() || productForm.nameAr?.trim(),
      nameAr: productForm.nameAr?.trim() || productForm.nameEn?.trim(),
      sku: productForm.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      productType: normalizeProductType(productForm.productType),
      costPrice: productForm.costPrice !== '' ? Number(productForm.costPrice) : 0,
      price: productForm.sellingPrice !== '' ? Number(productForm.sellingPrice) : 0,
      taxRate: Number(productForm.taxRate) || 15,
      unitOfMeasure: productForm.unitOfMeasure || 'PCE',
    }
    addProductMutation.mutate(payload)
  }

  useEffect(() => {
    const s = productForm.nameEn?.trim()
    if (!s || s.length < 2 || !showProductModal) return
    const timer = setTimeout(() => {
      if (productForm.nameAr?.trim()) return
      const translated = autoTranslateText(s, 'en', 'ar')
      if (translated) setProductForm((p) => ({ ...p, nameAr: translated }))
    }, 120)
    return () => clearTimeout(timer)
  }, [productForm.nameEn, showProductModal])

  useEffect(() => {
    const s = productForm.nameAr?.trim()
    if (!s || s.length < 2 || !showProductModal) return
    const timer = setTimeout(() => {
      if (productForm.nameEn?.trim()) return
      const translated = autoTranslateText(s, 'ar', 'en')
      if (translated) setProductForm((p) => ({ ...p, nameEn: translated }))
    }, 120)
    return () => clearTimeout(timer)
  }, [productForm.nameAr, showProductModal])

  const uploadVendorBill = async (orderId, file) => {
    const body = new FormData()
    body.append('file', file)
    await api.post(`/purchase-orders/${orderId}/attachments`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
  }

  const applyProductToLine = (index, productId) => {
    const product = (products || []).find((row) => String(row._id) === String(productId))
    if (!product) return
    setValue(`lineItems.${index}.productType`, normalizeProductType(product.productType), { shouldDirty: true })
    setValue(`lineItems.${index}.variantId`, '', { shouldDirty: true })
    setValue(`lineItems.${index}.uom`, product.unitOfMeasure || product.unitCode || getDefaultUom(tenant) || '', { shouldDirty: true })
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
    if (order.supplierId && typeof order.supplierId === 'object') {
      setSelectedSupplier(order.supplierId)
    }
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
              variantId: li?.variantId?._id || li?.variantId || '',
              manualName: li?.manualName || '',
              uom: li?.uom !== undefined ? (li.uom || '') : (li?.productId?.unitOfMeasure || getDefaultUom(tenant) || ''),
              description: li?.description || '',
              productType: li?.productType || li?.productId?.productType || 'goods',
              quantityOrdered: li?.quantityOrdered ?? 0,
              quantityReceived: li?.quantityReceived ?? 0,
              quantityReturned: li?.quantityReturned ?? 0,
              unitCost: li?.unitCost ?? 0,
              taxRate: li?.taxRate ?? 15,
            }))
          : [{ productId: '', variantId: '', manualName: '', uom: getDefaultUom(tenant) || '', description: '', productType: 'goods', quantityOrdered: 1, quantityReceived: 0, quantityReturned: 0, unitCost: 0, taxRate: 15 }],
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

  const isLocked = isEdit && ['approved', 'partially_received', 'received', 'billed', 'cancelled'].includes(order?.status)

  const totals = computePurchaseLineTotals(lineItems)

  const uomOptions = useMemo(() => getAvailableUomOptions(tenant), [tenant])

  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/purchase-orders/${id}`, data) : api.post('/purchase-orders', data)),
    onSuccess: async (res) => {
      const created = res.data?.purchaseOrder || res.data?.order || res.data
      const createdId = String(created?._id || created?.id || '')
      const orderId = isEdit ? id : createdId
      if (orderId && pendingBills.length) {
        try {
          for (const file of pendingBills) {
            await uploadVendorBill(orderId, file)
          }
          setPendingBills([])
        } catch (err) {
          toast.error(formatInvError(err, language) || (language === 'ar' ? 'تم الحفظ وتعذر رفع الفاتورة' : 'Saved, but bill upload failed'))
        }
      }
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث طلب الشراء'
            : 'Purchase order updated'
          : language === 'ar'
            ? 'تم إنشاء طلب الشراء بنجاح'
            : 'Purchase order created'
      )
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-open'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] })

      if (!isEdit && createdId) {
        // Show Live Preview Modal with options to Approve or Edit!
        setCreatedOrderForPreview(created)
        setShowLivePreviewModal(true)
        navigate(`/app/dashboard/purchases/orders/${createdId}`, { replace: true })
        setIsViewMode(true)
      } else {
        setIsViewMode(true)
      }
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error'),
  })

  const approveMutation = useMutation({
    mutationFn: (targetId) => api.post(`/purchase-orders/${targetId || id}/approve`),
    onSuccess: (res) => {
      const payload = res?.data || {}
      const orderId = String(id || payload._id || '')
      toast.success(language === 'ar' ? 'تم اعتماد طلب الشراء — استلم البضاعة من هذا الطلب' : 'Purchase order approved — receive goods from this order')

      if (orderId) {
        queryClient.setQueryData(['purchase-order', orderId], (prev) => ({
          ...(prev && typeof prev === 'object' ? prev : {}),
          ...payload,
          status: payload.status || 'approved',
          approvedAt: payload.approvedAt || new Date().toISOString(),
          related: payload.related || prev?.related,
          receivingLedger: payload.receivingLedger || prev?.receivingLedger,
        }))
        queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] })
      }
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] })
      queryClient.invalidateQueries({ queryKey: ['grn'] })
      queryClient.invalidateQueries({ queryKey: ['grn-list'] })
      queryClient.invalidateQueries({ queryKey: ['grn-upcoming'] })

      setCreatedOrderForPreview((prev) => {
        if (!prev && !payload._id) return prev
        return {
          ...(prev || {}),
          ...payload,
          status: payload.status || 'approved',
          approvedAt: payload.approvedAt || new Date().toISOString(),
        }
      })
      setIsViewMode(true)
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error'),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/send`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال طلب الشراء' : 'Purchase order sent')
      queryClient.invalidateQueries(['purchase-orders'])
      queryClient.invalidateQueries(['purchase-order', id])
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: (targetId) => api.post(`/purchase-orders/${targetId || id}/cancel`),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إلغاء طلب الشراء' : 'Purchase order cancelled')
      queryClient.invalidateQueries(['purchase-orders'])
      queryClient.invalidateQueries(['purchase-orders-stats'])
      queryClient.invalidateQueries(['purchase-order', id || res.data?._id])
      if (createdOrderForPreview) {
        setCreatedOrderForPreview((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
      }
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error'),
  })

  const recordPaymentMutation = useMutation({
    mutationFn: (payload) => api.post(`/purchase-orders/${id}/payment`, payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تسجيل الدفعة' : 'Payment recorded')
      setShowPaymentModal(false)
      setPaymentForm({ amount: '', date: formatDateForInput(new Date()), method: 'transfer', reference: '' })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] })
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error'),
  })

  const receiveMutation = useMutation({
    mutationFn: (payload) => api.post(`/purchase-orders/${id}/receive`, payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تسجيل الاستلام وتحديث المخزون' : 'Received and stock updated')
      setReceiveQty({})
      setShowQuickReceiveModal(false)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })
      queryClient.invalidateQueries({ queryKey: ['grn'] })
      queryClient.invalidateQueries({ queryKey: ['grn-list'] })
      queryClient.invalidateQueries({ queryKey: ['physical-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['stock-report'] })
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-counts'] })
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error'),
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
        variantId: manualModes[index] ? undefined : (li.variantId || undefined),
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
    const items = (orderLineItems || []).map((li, idx) => {
      const productId = li?.productId?._id || li?.productId
      const key = poReceiveLineKey(li, idx)
      const qty = Number(receiveQty?.[key] ?? 0)
      const action = lineRemainingActions[key] || 'backorder'
      return {
        productId: productId || undefined,
        variantId: li?.variantId?._id || li?.variantId || undefined,
        lineIndex: idx,
        quantity: Math.max(0, qty),
        remainingAction: action,
      }
    })

    const hasAnyPositiveReceive = items.some((it) => it.quantity > 0)
    const hasAnyRefundAction = items.some((it) => it.remainingAction === 'refund')

    if (!hasAnyPositiveReceive && !hasAnyRefundAction) {
      toast.error(language === 'ar' ? 'حدد كمية مستلمة أو اختر استرداد/تسوية للمتبقي' : 'Enter receiving quantity or select refund/settle for remainder')
      return
    }

    if (hasAnyPositiveReceive && !receiveWarehouseId) {
      toast.error(language === 'ar' ? 'اختر مستودع للاستلام' : 'Select a warehouse')
      return
    }

    receiveMutation.mutate({
      warehouseId: receiveWarehouseId || undefined,
      items,
      notes: receiveNotes,
    })
  }

  const resolveOrderForPdf = async (targetOrder) => {
    const o = targetOrder || order
    if (o?.supplierId && typeof o.supplierId === 'object' && (o.supplierId?.nameEn || o.supplierId?.nameAr)) {
      return o
    }
    const targetId = o?._id || id
    if (targetId) {
      try {
        const res = await api.get(`/purchase-orders/${targetId}`)
        const data = res?.data
        const full = data?.purchaseOrder || data?.order || data
        if (full?._id) return full
      } catch (err) {
        console.warn('[PurchaseOrderForm] fetch order for pdf error', err)
      }
    }
    if (o) {
      let supp = o.supplierId
      if (typeof supp === 'string' && Array.isArray(suppliers) && suppliers.length) {
        supp = suppliers.find((s) => String(s._id) === String(supp)) || supp
      }
      return {
        ...o,
        supplierId: supp,
      }
    }
    throw new Error('Purchase order not found')
  }

  const handlePrintPdf = async (targetOrder) => {
    const orderToUse = targetOrder || order
    if (!orderToUse) return
    const toastId = toast.loading(language === 'ar' ? 'جاري التحضير للطباعة...' : 'Preparing print...')
    setPdfBusy('print')
    try {
      const full = await resolveOrderForPdf(orderToUse)
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

  const handleDownloadPdf = async (targetOrder) => {
    const orderToUse = targetOrder || order
    if (!orderToUse) return
    const toastId = toast.loading(language === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...')
    setPdfBusy('download')
    try {
      const full = await resolveOrderForPdf(orderToUse)
      await downloadPurchaseOrderPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'تم التنزيل' : 'Downloaded', { id: toastId })
    } catch (e) {
      console.error('[PurchaseOrderForm] PDF download failed', e)
      toast.error(language === 'ar' ? 'فشل التنزيل' : 'Download failed', { id: toastId })
    } finally {
      setPdfBusy(null)
    }
  }

  const handlePrintVendorBill = async (targetOrder) => {
    const orderToUse = targetOrder || order
    if (!orderToUse) return
    const toastId = toast.loading(language === 'ar' ? 'جاري تجهيز فاتورة المورد للطباعة...' : 'Preparing vendor bill print...')
    setPdfBusy('print_bill')
    try {
      const full = await resolveOrderForPdf(orderToUse)
      await printVendorBillPdf({ purchaseOrder: full, language, tenant })
      toast.dismiss(toastId)
    } catch (e) {
      console.error('[PurchaseOrderForm] Vendor bill print failed', e)
      toast.error(language === 'ar' ? 'فشل فتح الطباعة' : 'Print failed', { id: toastId })
    } finally {
      setPdfBusy(null)
    }
  }

  const handleDownloadVendorBill = async (targetOrder) => {
    const orderToUse = targetOrder || order
    if (!orderToUse) return
    const toastId = toast.loading(language === 'ar' ? 'جاري إنشاء فاتورة المورد PDF...' : 'Generating vendor bill PDF...')
    setPdfBusy('download_bill')
    try {
      const full = await resolveOrderForPdf(orderToUse)
      await downloadVendorBillPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'تم تنزيل فاتورة المورد' : 'Vendor bill downloaded', { id: toastId })
    } catch (e) {
      console.error('[PurchaseOrderForm] Vendor bill PDF download failed', e)
      toast.error(language === 'ar' ? 'فشل التنزيل' : 'Download failed', { id: toastId })
    } finally {
      setPdfBusy(null)
    }
  }

  const generatePoShareText = (targetOrder) => {
    const o = targetOrder || order
    if (!o) return ''
    const tenantName = tenant?.business?.legalNameEn || tenant?.name || 'Company'
    const suppName = o.supplierId?.nameEn || o.supplierId?.nameAr || 'Supplier'
    const items = (o.lineItems || [])
      .map((li, idx) => {
        const pName = li.productId?.nameEn || li.productId?.nameAr || li.manualName || li.description || `Item ${idx + 1}`
        const qty = Number(li.quantityOrdered || 0)
        const unit = Number(li.unitCost || 0)
        return `• ${pName}: ${qty} ${li.uom || 'PCE'} x ${unit} = ${(qty * unit).toFixed(2)} SAR`
      })
      .join('\n')

    return (
      `*طلب شراء / PURCHASE ORDER*\n` +
      `🏢 *${tenantName}*\n\n` +
      `📄 رقم الطلب / PO Number: *${o.poNumber || ''}*\n` +
      `👤 المورد / Supplier: *${suppName}*\n` +
      `📅 التاريخ / Date: *${formatDateForInput(o.orderDate) || ''}*\n` +
      `📦 المستودع / Warehouse: *${o.warehouseId?.nameEn || o.warehouseId?.nameAr || ''}*\n\n` +
      `*البنود / Order Items:*\n${items}\n\n` +
      `💰 المجموع الفرعي / Subtotal: ${Number(o.subtotal || 0).toFixed(2)} SAR\n` +
      `🧾 الضريبة / VAT (15%): ${Number(o.totalTax || 0).toFixed(2)} SAR\n` +
      `⭐ *الإجمالي النهائي / Grand Total: ${Number(o.grandTotal || 0).toFixed(2)} SAR*\n\n` +
      `شكراً لتعاملكم معنا / Thank you for your business.`
    )
  }

  const openWhatsAppModal = (targetOrder) => {
    const o = targetOrder || order
    const phone = o?.supplierId?.phone || o?.supplierId?.mobile || ''
    setWhatsAppPhone(phone)
    setWhatsAppText(generatePoShareText(o))
    setShowWhatsAppModal(true)
  }

  const sendWhatsAppMessage = () => {
    const cleanPhone = whatsAppPhone.replace(/[^0-9]/g, '')
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsAppText)}`
    window.open(url, '_blank')
    if (order?.status === 'draft') {
      sendMutation.mutate()
    }
    setShowWhatsAppModal(false)
    toast.success(language === 'ar' ? 'تم فتح تطبيق واتساب' : 'Opening WhatsApp')
  }

  const openEmailModal = (targetOrder) => {
    const o = targetOrder || order
    const email = o?.supplierId?.email || ''
    const tenantName = tenant?.business?.legalNameEn || tenant?.name || 'Company'
    setEmailTo(email)
    setEmailSubject(`[Purchase Order ${o?.poNumber || ''}] from ${tenantName}`)
    setEmailBody(generatePoShareText(o))
    setShowEmailModal(true)
  }

  const sendEmailMessage = () => {
    if (!emailTo) {
      toast.error(language === 'ar' ? 'أدخل البريد الإلكتروني للمورد' : 'Please enter supplier email')
      return
    }
    const mailto = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    window.location.href = mailto
    if (order?.status === 'draft') {
      sendMutation.mutate()
    }
    setShowEmailModal(false)
    toast.success(language === 'ar' ? 'تم فتح برنامج البريد الإلكتروني' : 'Opening email client')
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
          if (parsed?.error) message = pickApiErrorPayload(parsed.error, language) || message
        } catch { /* keep fallback */ }
      } else if (err.response?.data?.error || err.message) {
        message = formatInvError(err, language) || err.message
      }
      toast.error(message, { id: toastId })
    }
  }

  const statusLabel = (status) => {
    if (language === 'ar') {
      if (status === 'draft') return 'مسودة'
      if (status === 'sent') return 'مرسل'
      if (status === 'approved') return 'معتمد'
      if (status === 'partially_received') return 'مستلم جزئياً'
      if (status === 'received') return 'مستلم بالكامل'
      if (status === 'refunded') return 'مسترد'
      if (status === 'billed') return 'مفوتر'
      if (status === 'cancelled') return 'ملغي'
      return status
    }
    if (status === 'partially_received') return 'Partially received'
    if (status === 'refunded') return 'Refunded'
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : status
  }

  const shell =
    'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
  const ghostBtn =
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/[0.04]'
  const primaryBtn =
    'inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'
  const inkBtn =
    'inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'

  const workflow = [
    { id: 'draft', label: language === 'ar' ? 'مسودة' : 'Draft' },
    { id: 'approved', label: language === 'ar' ? 'معتمد' : 'Approved' },
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

  // Quantities summary
  const orderLineItems = order?.lineItems || []
  const totalOrderedQty = orderLineItems.reduce((sum, li) => sum + Number(li.quantityOrdered || 0), 0)
  const totalReceivedQty = orderLineItems.reduce((sum, li) => sum + Number(li.quantityReceived || 0), 0)
  const totalReturnedQty = orderLineItems.reduce((sum, li) => sum + Number(li.quantityReturned || 0), 0)
  const totalBackorderQty = Math.max(0, totalOrderedQty - totalReceivedQty - totalReturnedQty)
  const isFullySettledOrReceived = (totalReceivedQty + totalReturnedQty) >= totalOrderedQty && totalOrderedQty > 0
  const fulfillmentPercent = totalOrderedQty > 0 ? Math.min(100, Math.round(((totalReceivedQty + totalReturnedQty) / totalOrderedQty) * 100)) : 0

  const supplierFin = Array.isArray(supplierFinancials)
    ? supplierFinancials.find(f => String(f?._id) === String(order?.supplierId?._id || order?.supplierId))
    : null

  // Financial amounts for Received, Refunded, and Backorder
  const receivedAmount = orderLineItems.reduce((sum, li) => {
    const qty = Number(li.quantityReceived || 0)
    const unit = Number(li.unitCost || 0)
    const taxRate = Number(li.taxRate ?? 15)
    return sum + (qty * unit * (1 + taxRate / 100))
  }, 0)

  const refundedAmount = orderLineItems.reduce((sum, li) => {
    const qty = Number(li.quantityReturned || 0)
    const unit = Number(li.unitCost || 0)
    const taxRate = Number(li.taxRate ?? 15)
    return sum + (qty * unit * (1 + taxRate / 100))
  }, 0)

  const backorderAmount = orderLineItems.reduce((sum, li) => {
    const ordered = Number(li.quantityOrdered || 0)
    const rec = Number(li.quantityReceived || 0)
    const ret = Number(li.quantityReturned || 0)
    const bo = Math.max(0, ordered - rec - ret)
    const unit = Number(li.unitCost || 0)
    const taxRate = Number(li.taxRate ?? 15)
    return sum + (bo * unit * (1 + taxRate / 100))
  }, 0)

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-white" />
      </div>
    )
  }

  if (isEdit && !order && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {language === 'ar' ? 'تعذر تحميل بيانات أمر الشراء' : 'Failed to load purchase order'}
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          {language === 'ar' ? 'تأكد من صحة الرابط أو حاول مرة أخرى' : 'Please check the URL or try again.'}
        </p>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries(['purchase-order', id])}
          className="btn btn-secondary text-xs"
        >
          {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/purchases/orders')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                {isEdit
                  ? language === 'ar' ? 'طلب شراء' : 'Purchase order'
                  : language === 'ar' ? 'طلب شراء جديد' : 'New purchase order'}
              </h1>
              {isEdit && order && (
                <span className="font-mono text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                  {order.poNumber}
                </span>
              )}
            </div>
            {isEdit && order && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL[order.status] || STATUS_PILL.draft}`}>
                  {statusLabel(order.status)}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PAYMENT_STATUS_PILL[order.paymentStatus || 'pending']}`}>
                  {paymentStatusLabel(order.paymentStatus || 'pending')}
                </span>
                {totalReceivedQty > 0 && (
                  <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300">
                    {language === 'ar' ? `استلام: ${totalReceivedQty}/${totalOrderedQty}` : `Received: ${totalReceivedQty}/${totalOrderedQty}`}
                  </span>
                )}
                {totalReturnedQty > 0 && (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300">
                    {language === 'ar' ? `مسترد: ${totalReturnedQty}` : `Refunded: ${totalReturnedQty}`}
                  </span>
                )}
                {totalReceivedQty === 0 && totalReturnedQty === 0 && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10">
                    {language === 'ar' ? `استلام: 0/${totalOrderedQty}` : `Received: 0/${totalOrderedQty}`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Header Action Ribbon */}
        {isEdit && order && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLivePreviewModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-1.5 text-[12px] font-semibold text-teal-800 transition hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300 dark:hover:bg-teal-500/20"
            >
              <Eye className="h-3.5 w-3.5" />
              {language === 'ar' ? 'معاينة حية' : 'Live preview'}
            </button>
            <button type="button" onClick={() => handlePrintPdf(order)} disabled={Boolean(pdfBusy)} className={ghostBtn}>
              {pdfBusy === 'print' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5 opacity-70" />}
              {language === 'ar' ? 'طباعة' : 'Print'}
            </button>
            <button type="button" onClick={() => handleDownloadPdf(order)} disabled={Boolean(pdfBusy)} className={ghostBtn}>
              {pdfBusy === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 opacity-80" />}
              {language === 'ar' ? 'تنزيل PDF' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={() => setShowQuickReceiveModal(true)}
              disabled={!['approved', 'partially_received'].includes(order?.status)}
              className={ghostBtn}
              title={['draft', 'sent'].includes(order?.status) ? (language === 'ar' ? 'يجب اعتماد الطلب أولاً قبل الاستلام' : 'Approve PO first to receive goods') : ''}
            >
              <WarehouseIcon className="h-3.5 w-3.5 opacity-70" />
              {language === 'ar' ? 'استلام البضاعة (GRN)' : 'Receive Goods (GRN)'}
            </button>
            <button
              type="button"
              onClick={() => setShowVendorBillModal(true)}
              disabled={order?.status === 'cancelled' || !['partially_received', 'received', 'billed'].includes(order?.status) || !(order?.lineItems || []).some(li => Number(li.quantityReceived || 0) > 0)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-1.5 text-[12px] font-semibold text-violet-800 transition hover:bg-violet-100 disabled:opacity-40 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
              title={
                !['partially_received', 'received', 'billed'].includes(order?.status) || !(order?.lineItems || []).some(li => Number(li.quantityReceived || 0) > 0)
                  ? (language === 'ar' ? 'يجب استلام البضاعة أولاً (GRN) لعرض وطباعة فاتورة المورد' : 'Receive goods via GRN first to preview and print vendor bill')
                  : ''
              }
            >
              <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              {language === 'ar' ? 'فاتورة المورد' : 'Vendor bill'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/accounting/bills/new?poId=${id}`)}
              disabled={!isEdit || order?.status === 'cancelled' || order?.status === 'draft'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-[12px] font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-40 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
              title={language === 'ar' ? 'إنشاء فاتورة مورد (قيد محاسبي: مخزون وسيط / ضريبة مدخلات / ذمم دائنة)' : 'Create vendor bill (GL: stock interim / VAT input / AP)'}
            >
              <Receipt className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              {language === 'ar' ? 'إنشاء فاتورة مورد' : 'Create Bill'}
            </button>
            <button
              type="button"
              onClick={() => openWhatsAppModal(order)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              title={language === 'ar' ? 'إرسال عبر الواتساب' : 'Send via WhatsApp'}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {language === 'ar' ? 'واتساب' : 'WhatsApp'}
            </button>
            <button
              type="button"
              onClick={() => openEmailModal(order)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-800 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
              title={language === 'ar' ? 'إرسال عبر البريد الإلكتروني' : 'Send via Email'}
            >
              <Mail className="h-3.5 w-3.5" />
              {language === 'ar' ? 'بريد' : 'Email'}
            </button>
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              disabled={order?.status === 'cancelled'}
              className={inkBtn}
              title={
                !order?.billedInvoiceId
                  ? (language === 'ar' ? 'يفضّل إنشاء فاتورة مورد أولاً — أو سجّل دفعة مقدمة' : 'Prefer Create Bill first — or record as supplier advance')
                  : undefined
              }
            >
              <CreditCard className="h-3.5 w-3.5 opacity-80" />
              {language === 'ar' ? 'تسجيل دفعة' : 'Record payment'}
            </button>
            {isViewMode ? (
              !isLocked && (
                <button
                  type="button"
                  onClick={() => setIsViewMode(false)}
                  className={ghostBtn}
                >
                  <Edit3 className="h-3.5 w-3.5 opacity-70" />
                  {language === 'ar' ? 'تعديل الطلب' : 'Edit order'}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setIsViewMode(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-800 dark:border-white/20 dark:bg-white/10 dark:text-white"
              >
                <Eye className="h-3.5 w-3.5 opacity-70" />
                {language === 'ar' ? 'عرض الملخص' : 'Summary view'}
              </button>
            )}
            {['draft', 'sent'].includes(order?.status) && (
              <>
                <button
                  type="button"
                  onClick={() => approveMutation.mutate(order._id)}
                  disabled={approveMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {language === 'ar' ? 'اعتماد طلب الشراء' : 'Approve PO'}
                </button>
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate(order._id)}
                  disabled={cancelMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-40 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300"
                >
                  {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  {language === 'ar' ? 'إلغاء الطلب' : 'Cancel PO'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ULTRA PREMIUM COMPACT EXECUTIVE DASHBOARD (Visible without scrolling down) */}
      {isEdit && order && isViewMode && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {order.status === 'cancelled' && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
              <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div>
                <p className="text-sm font-bold">
                  {language === 'ar' ? 'تم إلغاء طلب الشراء هذا' : 'This Purchase Order is Cancelled'}
                </p>
                <p className="text-xs opacity-80">
                  {language === 'ar' ? 'الطلب في حالة ملغاة ولا يمكن تعديله أو استلام بضائع أو فوترته.' : 'This order has been cancelled and cannot be modified, received, or billed.'}
                </p>
              </div>
            </div>
          )}

          {/* 4-Card Executive KPI Grid (Fits in 1 Row) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Financial Overview */}
            <div className={`${shell} p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/[0.08]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {language === 'ar' ? 'إجمالي الطلب والمالية' : 'Financials'}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">{order.currency || 'SAR'}</span>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                    <Money value={order.grandTotal} />
                  </div>
                  {refundedAmount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300">
                      {language === 'ar' ? 'مسترد:' : 'Refunded:'} <Money value={refundedAmount} />
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-2 text-center text-[11px] dark:bg-white/[0.03]">
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase">{language === 'ar' ? 'الأساسي' : 'Subtotal'}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200"><Money value={order.subtotal} /></span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase">{language === 'ar' ? 'الضريبة' : 'VAT (15%)'}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200"><Money value={order.totalTax} /></span>
                  </div>
                  <div className="border-s border-slate-200/60 dark:border-white/10">
                    <span className="block text-[9px] text-rose-500 uppercase">{language === 'ar' ? 'المتبقي' : 'Balance'}</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400"><Money value={order.balanceDue ?? order.grandTotal} /></span>
                  </div>
                </div>

                {/* Received, Refunded & Backorder Financial Strip */}
                {(receivedAmount > 0 || refundedAmount > 0) && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-[11px] dark:border-white/[0.05] dark:bg-white/[0.02]">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-teal-700 dark:text-teal-300">
                        {language === 'ar' ? 'المستلم:' : 'Received:'}
                      </span>
                      <span className="font-bold text-teal-800 dark:text-teal-200 tabular-nums">
                        <Money value={receivedAmount} />
                      </span>
                    </div>
                    {refundedAmount > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                          {language === 'ar' ? 'المسترد:' : 'Refunded:'}
                        </span>
                        <span className="font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                          <Money value={refundedAmount} />
                        </span>
                      </div>
                    )}
                    {backorderAmount > 0 && receivedAmount > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          {language === 'ar' ? 'المؤجل:' : 'Backorder:'}
                        </span>
                        <span className="font-bold text-amber-800 dark:text-amber-200 tabular-nums">
                          <Money value={backorderAmount} />
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Supplier Info & Financials */}
            <div className={`${shell} p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/[0.08]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {language === 'ar' ? 'المورد' : 'Supplier'}
                </span>
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="mt-2.5">
                <p className="font-semibold text-slate-900 dark:text-white text-[14px] line-clamp-1">
                  {language === 'ar' ? order.supplierId?.nameAr || order.supplierId?.nameEn : order.supplierId?.nameEn || order.supplierId?.nameAr || '—'}
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {order.supplierId?.phone || order.supplierId?.contactPerson || order.supplierId?.email || order.supplierId?.code || '—'}
                </p>
                {supplierFin && (
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 px-2.5 py-1.5 text-[11px] dark:border-blue-900/30 dark:bg-blue-950/20">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{language === 'ar' ? 'رصيد المورد:' : 'Supplier Pend:'}</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400"><Money value={supplierFin.balance || 0} /></span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Logistics, Warehouse & Dates */}
            <div className={`${shell} p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/[0.08]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {language === 'ar' ? 'المستودع والمواعيد' : 'Logistics & Dates'}
                </span>
                <WarehouseIcon className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="mt-2.5 space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'ar' ? 'المستودع:' : 'Warehouse:'}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'ar' ? order.warehouseId?.nameAr || order.warehouseId?.nameEn : order.warehouseId?.nameEn || order.warehouseId?.nameAr || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'ar' ? 'تاريخ الطلب:' : 'Order Date:'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateForInput(order.orderDate) || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'ar' ? 'المتوقع:' : 'Expected:'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateForInput(order.expectedDate) || '—'}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Receiving & Backorder Status */}
            <div className={`${shell} p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/[0.08]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {language === 'ar' ? 'حالة الاستلام والطلب المتبقي' : 'Receiving & Backorder'}
                </span>
                <Package className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {totalReceivedQty > 0 ? (
                      `${totalReceivedQty} / ${totalOrderedQty} ${language === 'ar' ? 'مستلم' : 'Received'}`
                    ) : totalReturnedQty > 0 ? (
                      `${totalReturnedQty} ${language === 'ar' ? 'مسترد / تسوية' : 'Refunded / Settled'}`
                    ) : (
                      `0 / ${totalOrderedQty} ${language === 'ar' ? 'مستلم' : 'Received'}`
                    )}
                  </span>
                  {totalBackorderQty > 0 ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300">
                      {language === 'ar' ? `متبقي: ${totalBackorderQty}` : `Backorder: ${totalBackorderQty}`}
                    </span>
                  ) : totalReturnedQty > 0 ? (
                    <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300">
                      {language === 'ar' ? `تسوية واسترداد (${totalReturnedQty})` : `Settled / Refunded (${totalReturnedQty})`}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {language === 'ar' ? 'مكتمل' : 'Fulfilled'}
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className={`h-full transition-all duration-500 ${isFullySettledOrReceived ? 'bg-emerald-500' : 'bg-teal-600'}`}
                    style={{ width: `${fulfillmentPercent}%` }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {fulfillmentPercent}% {isFullySettledOrReceived && totalReturnedQty > 0 ? (language === 'ar' ? 'تمت التسوية والإغلاق' : 'Settled & Closed') : (language === 'ar' ? 'منجز' : 'Fulfilled')}
                  </span>
                  {totalBackorderQty > 0 && ['approved', 'sent', 'partially_received'].includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => setShowQuickReceiveModal(true)}
                      className="text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-400"
                    >
                      {language === 'ar' ? 'استلام سريع' : 'Quick Receive'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Unified High-Density Line Items Table (Ultra-Clean & Compact) */}
          <div className={`${shell} p-4 sm:p-5`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-950 dark:text-white">
                  {language === 'ar' ? 'بنود طلب الشراء' : 'Order Line Items'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'الكميات، الاستلام، المتبقي والتكاليف' : 'Quantities, receiving progress, and costs'}
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {orderLineItems.length} {language === 'ar' ? 'بند' : 'Items'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/[0.08]">
              <table className="w-full text-start text-[12px]">
                <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-white/[0.03]">
                  <tr>
                    <th className="px-3.5 py-2.5 text-start w-10">#</th>
                    <th className="px-3.5 py-2.5 text-start">{language === 'ar' ? 'المنتج / الوصف' : 'Product / Description'}</th>
                    <th className="px-3.5 py-2.5 text-start">{language === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="px-3.5 py-2.5 text-center">{language === 'ar' ? 'الوحدة' : 'UOM'}</th>
                    <th className="px-3.5 py-2.5 text-center">{language === 'ar' ? 'المطلوب' : 'Ordered'}</th>
                    <th className="px-3.5 py-2.5 text-center">{language === 'ar' ? 'المستلم' : 'Received'}</th>
                    <th className="px-3.5 py-2.5 text-center">{language === 'ar' ? 'المسترد' : 'Refunded'}</th>
                    <th className="px-3.5 py-2.5 text-center">{language === 'ar' ? 'المتبقي' : 'Backorder'}</th>
                    <th className="px-3.5 py-2.5 text-end">{language === 'ar' ? 'سعر الوحدة' : 'Unit Cost'}</th>
                    <th className="px-3.5 py-2.5 text-center">{language === 'ar' ? 'الضريبة' : 'Tax'}</th>
                    <th className="px-3.5 py-2.5 text-end">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {orderLineItems.map((li, idx) => {
                    const ordered = Number(li.quantityOrdered || 0)
                    const rec = Number(li.quantityReceived || 0)
                    const ret = Number(li.quantityReturned || 0)
                    const backorder = Math.max(0, ordered - rec - ret)
                    const unit = Number(li.unitCost || 0)
                    const taxRate = Number(li.taxRate ?? 15)
                    const lineSub = ordered * unit
                    const lineTot = lineSub + (lineSub * taxRate / 100)
                    const name = formatLineItemName(li, language, products)

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="px-3.5 py-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="px-3.5 py-2">
                          <p className="font-semibold text-slate-900 dark:text-white text-[13px]">{name || '—'}</p>
                          {li.productId?.sku && (
                            <span className="font-mono text-[10px] text-slate-400">SKU: {li.productId.sku}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2">
                          <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {li.productType === 'service' ? (language === 'ar' ? 'خدمة' : 'Service') : (language === 'ar' ? 'بضاعة' : 'Goods')}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-center text-slate-500 font-medium">{li.uom || 'PCE'}</td>
                        <td className="px-3.5 py-2 text-center font-semibold text-slate-900 dark:text-white tabular-nums">{ordered}</td>
                        <td className="px-3.5 py-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{rec}</td>
                        <td className="px-3.5 py-2 text-center tabular-nums">
                          {ret > 0 ? (
                            <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300">
                              {ret}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono">0</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-center tabular-nums">
                          {backorder > 0 ? (
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300">
                              {backorder}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono">0</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-end text-slate-700 dark:text-slate-300 font-medium tabular-nums"><Money value={unit} /></td>
                        <td className="px-3.5 py-2 text-center text-slate-500">{taxRate}%</td>
                        <td className="px-3.5 py-2 text-end font-bold text-slate-900 dark:text-white tabular-nums"><Money value={lineTot} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Mini Shelf: Notes, Vendor Bill, Related Documents */}
            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-slate-100 pt-3 dark:border-white/[0.08] text-[12px]">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {language === 'ar' ? 'ملاحظات وتفاصيل الاسترداد' : 'Notes & Refund Settlement'}
                </span>
                {order.notes ? (
                  <div className="space-y-1">
                    {order.notes.split('|').map((chunk, cIdx) => {
                      const trimmed = chunk.trim()
                      if (trimmed.startsWith('[Refund:')) {
                        const cleanText = trimmed.replace(/^\[Refund:\s*/, '').replace(/\]$/, '')
                        return (
                          <div key={cIdx} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
                            <RotateCcw className="h-3 w-3 text-rose-500" />
                            <span>{language === 'ar' ? `استرداد/تسوية: ${cleanText}` : `Refund/Settlement: ${cleanText}`}</span>
                          </div>
                        )
                      }
                      return (
                        <p key={cIdx} className="text-slate-600 dark:text-slate-300 text-[11px] italic">
                          {trimmed}
                        </p>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[11px] italic">{language === 'ar' ? 'لا توجد ملاحظات' : 'No notes'}</p>
                )}
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {language === 'ar' ? 'فاتورة المورد المرفقة' : 'Vendor Bill Attachment'}
                </span>
                {(order?.attachments || []).length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openVendorBill(order.attachments[0])}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-400"
                    >
                      <Paperclip className="h-3 w-3" />
                      {order.attachments[0]?.name || (language === 'ar' ? 'عرض الفاتورة' : 'View Bill')}
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">{language === 'ar' ? 'لا يوجد مرفق' : 'No attachment'}</span>
                )}
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {language === 'ar' ? 'المستندات المرتبطة' : 'Linked Records'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(order.related?.grns || []).map((g) => (
                    <span
                      key={g._id}
                      className="inline-flex rounded-lg bg-teal-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
                    >
                      {g.grnNumber}
                    </span>
                  ))}
                  {(order.related?.invoices || []).map((inv) => (
                    <button
                      key={inv._id}
                      type="button"
                      onClick={() => navigate(`/app/dashboard/accounting/invoices/${inv._id}`)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                      title={language === 'ar' ? 'فاتورة المورد' : 'Vendor Bill'}
                    >
                      <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">{language === 'ar' ? 'فاتورة المورد:' : 'Vendor Bill:'}</span>
                      {inv.invoiceNumber}
                    </button>
                  ))}
                  {!(order.related?.grns?.length || order.related?.invoices?.length) && (
                    <span className="text-slate-400 text-[11px]">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* INTEGRATED RECEIVING & GRN LEDGER */}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/[0.08]">
              <PurchaseReceivingLedger
                order={order}
                language={language}
                onOpenReceive={() => setShowQuickReceiveModal(true)}
                onApprove={() => approveMutation.mutate(id)}
                isApproving={approveMutation.isPending}
              />
            </div>

            {/* INTEGRATED PAYMENTS & SETTLEMENTS LEDGER */}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/[0.08]">
              <PurchasePaymentsLedger
                order={order}
                isAr={language === 'ar'}
                onOpenRecordPayment={() => setShowPaymentModal(true)}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* FULL FORM EDITING VIEW (When creating new or toggled into edit mode) */}
      {(!isEdit || !isViewMode) && (
        <form id="po-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {language === 'ar' ? 'معلومات الطلب' : 'Order information'}
                </p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'المورد والمستودع والتواريخ' : 'Supplier, warehouse, and dates'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLivePreviewModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-[12px] font-semibold text-teal-800 transition hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'معاينة' : 'Preview'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label text-xs">{language === 'ar' ? 'رقم الطلب' : 'PO number'}</label>
                <input
                  {...register('poNumber')}
                  className="input !py-1.5 text-xs"
                  placeholder={language === 'ar' ? 'تلقائي إذا تركته فارغاً' : 'Auto if left empty'}
                  disabled={isEdit}
                />
              </div>

              <div>
                <label className="label text-xs">{language === 'ar' ? 'المورد' : 'Supplier'} *</label>
                <PartnerCombobox
                  role="vendor"
                  value={watch('supplierId') || ''}
                  selectedOption={selectedSupplier}
                  ar={language === 'ar'}
                  language={language}
                  disabled={isLocked}
                  onChange={(id, opt) => {
                    setValue('supplierId', id || '', { shouldValidate: true, shouldDirty: true })
                    setSelectedSupplier(opt || null)
                  }}
                />
                <input type="hidden" {...register('supplierId', { required: true })} />
                {errors.supplierId && (
                  <p className="mt-1 text-xs text-rose-600">{language === 'ar' ? 'المورد مطلوب' : 'Supplier is required'}</p>
                )}
              </div>

              <div>
                <label className="label text-xs">{language === 'ar' ? 'المستودع' : 'Warehouse'} *</label>
                <div className="flex gap-2">
                  <select {...register('warehouseId')} className="select flex-1 !py-1.5 text-xs" disabled={isLocked}>
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
                      className="inline-flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-300"
                      title={language === 'ar' ? 'إنشاء مستودع' : 'Create warehouse'}
                    >
                      <WarehouseIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="label text-xs">{language === 'ar' ? 'تاريخ الطلب' : 'Order date'}</label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input type="date" {...register('orderDate')} className="input ps-9 !py-1.5 text-xs" disabled={isLocked} />
                </div>
              </div>

              <div>
                <label className="label text-xs">{language === 'ar' ? 'تاريخ متوقع' : 'Expected date'}</label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input type="date" {...register('expectedDate')} className="input ps-9 !py-1.5 text-xs" disabled={isLocked} />
                </div>
              </div>

              <div>
                <label className="label text-xs">{language === 'ar' ? 'العملة' : 'Currency'}</label>
                <input {...register('currency')} className="input !py-1.5 text-xs" disabled />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="label text-xs">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                <textarea {...register('notes')} className="input text-xs" rows={2} disabled={isLocked} />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="label text-xs">{language === 'ar' ? 'فاتورة المورد (PDF / صورة)' : 'Vendor bill (PDF / image)'}</label>
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
                        .catch((err) => toast.error(formatInvError(err, language) || (language === 'ar' ? 'فشل الرفع' : 'Upload failed')))
                    } else {
                      setPendingBills((prev) => [...prev, file])
                    }
                  }}
                  onRemovePending={(idx) => setPendingBills((prev) => prev.filter((_, i) => i !== idx))}
                />
              </div>
            </div>
          </motion.div>

          {/* Line Items Card */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-4 sm:p-5`}>
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/[0.08]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {language === 'ar' ? 'بنود الطلب' : 'Line items'}
                </p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
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
                  <Plus className="h-3.5 w-3.5 opacity-70" />
                  {language === 'ar' ? 'إضافة بند' : 'Add item'}
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {fields.map((field, index) => {
                const current = lineItems?.[index] || {}
                const qty = Number(current?.quantityOrdered || 0)
                const unit = Number(current?.unitCost || 0)
                const taxRate = Number(current?.taxRate ?? 15)
                const lineSubtotal = qty * unit
                const lineTax = lineSubtotal * (taxRate / 100)
                const lineTotal = lineSubtotal + lineTax

                return (
                  <div key={field.id} className="rounded-xl border border-slate-100 p-3 dark:border-white/[0.08]">
                    <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-12">
                      <div className="lg:col-span-4">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="label mb-0 text-xs">{language === 'ar' ? 'المنتج' : 'Product'} *</label>
                          <div className="flex items-center gap-2">
                            <ProductTypeToggle
                              value={watch(`lineItems.${index}.productType`)}
                              onChange={(next) => setValue(`lineItems.${index}.productType`, next, { shouldDirty: true, shouldTouch: true })}
                              language={language}
                            />
                            {!isLocked && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProductModalTargetIndex(index)
                                    const typed = watch(`lineItems.${index}.manualName`) || ''
                                    setProductForm({
                                      sku: `SKU-${Date.now().toString().slice(-6)}`,
                                      nameEn: typed,
                                      nameAr: '',
                                      productType: watch(`lineItems.${index}.productType`) || 'goods',
                                      unitOfMeasure: watch(`lineItems.${index}.uom`) || 'PCE',
                                      costPrice: watch(`lineItems.${index}.unitCost`) || '',
                                      sellingPrice: '',
                                      taxRate: watch(`lineItems.${index}.taxRate`) ?? 15,
                                    })
                                    setShowProductModal(true)
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400"
                                  title={language === 'ar' ? 'إضافة منتج جديد للمخزون' : 'Add new product to catalog'}
                                >
                                  <Plus className="h-3 w-3" />
                                  {language === 'ar' ? 'منتج جديد' : 'New Product'}
                                </button>
                                <span className="text-slate-300 dark:text-white/20">|</span>
                                <button
                                  type="button"
                                  onClick={() => toggleManualMode(index)}
                                  className="text-[11px] font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800 dark:text-slate-400"
                                >
                                  {manualModes[index]
                                    ? language === 'ar' ? 'اختر من قائمة' : 'List'
                                    : language === 'ar' ? 'كتابة يدوية' : 'Custom'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                        <input type="hidden" {...register(`lineItems.${index}.productId`)} />

                        {manualModes[index] ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              {...register(`lineItems.${index}.manualName`, { required: true })}
                              placeholder={language === 'ar' ? 'اسم المنتج أو الصنف...' : 'Product or item name...'}
                              className="input !py-1.5 text-xs flex-1"
                              disabled={isLocked}
                            />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProductModalTargetIndex(index)
                                  const typed = watch(`lineItems.${index}.manualName`) || ''
                                  setProductForm({
                                    sku: `SKU-${Date.now().toString().slice(-6)}`,
                                    nameEn: typed,
                                    nameAr: '',
                                    productType: watch(`lineItems.${index}.productType`) || 'goods',
                                    unitOfMeasure: watch(`lineItems.${index}.uom`) || 'PCE',
                                    costPrice: watch(`lineItems.${index}.unitCost`) || '',
                                    sellingPrice: '',
                                    taxRate: watch(`lineItems.${index}.taxRate`) ?? 15,
                                  })
                                  setShowProductModal(true)
                                }}
                                className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100 whitespace-nowrap dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"
                                title={language === 'ar' ? 'حفظ كمنتج جديد في المخزون' : 'Save to inventory products'}
                              >
                                + {language === 'ar' ? 'حفظ كمنتج' : 'Save as product'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <CreatableSelect
                            className="react-select-container text-xs"
                            classNamePrefix="react-select"
                            isDisabled={isLocked}
                            isClearable
                            isSearchable
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            styles={customSelectStyles}
                            placeholder={language === 'ar' ? 'ابحث بالاسم أو الرمز، أو اكتب...' : 'Search product or type...'}
                            formatCreateLabel={(inputValue) =>
                              language === 'ar'
                                ? `+ استخدام "${inputValue}" كبند مخصص`
                                : `+ Use "${inputValue}" as custom item`
                            }
                            options={(products || []).map((p) => ({
                              value: p._id,
                              label: productPickerLabel(p, language) || p.nameEn || p.nameAr || p.sku,
                              product: p,
                            }))}
                            value={
                              watch(`lineItems.${index}.productId`)
                                ? {
                                    value: watch(`lineItems.${index}.productId`),
                                    label:
                                      productPickerLabel(
                                        (products || []).find((p) => p._id === watch(`lineItems.${index}.productId`)),
                                        language
                                      ) ||
                                      watch(`lineItems.${index}.manualName`) ||
                                      '—',
                                  }
                                : watch(`lineItems.${index}.manualName`)
                                ? {
                                    value: '',
                                    label: watch(`lineItems.${index}.manualName`),
                                  }
                                : null
                            }
                            onChange={(option) => {
                              if (!option) {
                                setValue(`lineItems.${index}.productId`, '', { shouldDirty: true, shouldValidate: true })
                                setValue(`lineItems.${index}.manualName`, '', { shouldDirty: true })
                                return
                              }
                              if (option.__isNew__) {
                                setValue(`lineItems.${index}.productId`, '', { shouldDirty: true, shouldValidate: true })
                                setValue(`lineItems.${index}.manualName`, option.value, { shouldDirty: true, shouldValidate: true })
                                toggleManualMode(index)
                              } else {
                                setValue(`lineItems.${index}.productId`, option.value, { shouldDirty: true, shouldValidate: true })
                                applyProductToLine(index, option.value)
                              }
                            }}
                          />
                        )}
                        {!manualModes[index] && watch(`lineItems.${index}.productId`) ? (
                          <div className="mt-2">
                            <VariantLineSelect
                              productId={watch(`lineItems.${index}.productId`)}
                              value={watch(`lineItems.${index}.variantId`)}
                              language={language}
                              onChange={(variantId, variant) => {
                                setValue(`lineItems.${index}.variantId`, variantId || '', { shouldDirty: true })
                                if (variant?.cost != null && Number(variant.cost) > 0) {
                                  setValue(`lineItems.${index}.unitCost`, Number(variant.cost), { shouldDirty: true })
                                }
                              }}
                            />
                            <input type="hidden" {...register(`lineItems.${index}.variantId`)} />
                          </div>
                        ) : null}
                      </div>

                      <div className="lg:col-span-2">
                        <label className="label text-xs">{language === 'ar' ? 'الوحدة' : 'UOM'}</label>
                        <Select
                          className="react-select-container text-xs"
                          classNamePrefix="react-select"
                          isDisabled={isLocked}
                          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                          styles={customSelectStyles}
                          isClearable
                          isSearchable
                          placeholder={language === 'ar' ? 'بدون وحدة' : 'None (Optional)'}
                          value={
                            watch(`lineItems.${index}.uom`)
                              ? {
                                  value: watch(`lineItems.${index}.uom`),
                                  label: getUomLabel(watch(`lineItems.${index}.uom`), language)
                                }
                              : null
                          }
                          onChange={(option) => setValue(`lineItems.${index}.uom`, option ? option.value : '', { shouldValidate: true })}
                          options={[
                            { value: '', label: language === 'ar' ? 'بدون وحدة (اختياري)' : 'None (Optional)' },
                            ...uomOptions.map((uom) => ({
                              value: uom.code,
                              label: language === 'ar' ? uom.labelAr : uom.labelEn
                            }))
                          ]}
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <label className="label text-xs">{language === 'ar' ? 'الكمية' : 'Qty'} *</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          {...register(`lineItems.${index}.quantityOrdered`, {
                            valueAsNumber: true,
                            required: true,
                            min: 1,
                          })}
                          className="input !py-1.5 text-xs text-center font-bold"
                          disabled={isLocked}
                        />
                      </div>

                      <div className="lg:col-span-2">
                        <label className="label text-xs">{language === 'ar' ? 'سعر الوحدة' : 'Unit cost'}</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          {...register(`lineItems.${index}.unitCost`, {
                            valueAsNumber: true,
                            min: {
                              value: 0.01,
                              message: language === 'ar' ? 'سعر الوحدة يجب أن يكون أكبر من صفر' : 'Unit cost must be greater than zero',
                            },
                            validate: (v) => Number(v) > 0 || (language === 'ar' ? 'سعر الوحدة مطلوب' : 'Unit cost is required'),
                          })}
                          className="input !py-1.5 text-xs text-end"
                          disabled={isLocked}
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <label className="label text-xs">{language === 'ar' ? 'الضريبة' : 'Tax'} %</label>
                        <select
                          {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })}
                          className="select !py-1.5 text-xs"
                          disabled={isLocked}
                        >
                          <option value={15}>15%</option>
                          <option value={0}>0%</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between gap-2 lg:col-span-2">
                        <div className="flex-1 text-end">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('total')}</p>
                          <p className="text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
                            <Money value={lineTotal} />
                          </p>
                        </div>
                        {!isLocked && fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Financial Summary & Save Actions */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-4 sm:p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="w-full space-y-1.5 md:w-80 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('subtotal')}</span>
                  <span className="tabular-nums text-slate-800 dark:text-slate-100 font-semibold"><Money value={totals.subtotal} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('tax')} (15%)</span>
                  <span className="tabular-nums text-slate-800 dark:text-slate-100 font-semibold"><Money value={totals.totalTax} /></span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-[14px] font-bold dark:border-white/[0.08]">
                  <span className="text-slate-900 dark:text-white">{t('total')}</span>
                  <span className="tabular-nums text-slate-900 dark:text-white"><Money value={totals.grandTotal} /></span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saveMutation.isPending || isLocked}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(13,148,136,0.6)] transition hover:bg-teal-700 disabled:opacity-40"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 opacity-90" />
                      {language === 'ar' ? 'تأكيد' : 'Confirm'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </form>
      )}

      {/* LIVE PREVIEW MODAL WITH APPROVE & EDIT OPTIONS */}
      <AnimatePresence>
        {showLivePreviewModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-[#0c111a] border border-slate-200 dark:border-white/10 flex flex-col"
            >
              {/* Modal Top Bar */}
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/90 px-6 py-3.5 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0c111a]/90">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                    <Eye className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                      {language === 'ar' ? 'معاينة طلب الشراء (Live Preview)' : 'Purchase Order Live Preview'}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openWhatsAppModal(createdOrderForPreview || order)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                    title={language === 'ar' ? 'إرسال عبر الواتساب' : 'Send via WhatsApp'}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEmailModal(createdOrderForPreview || order)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-blue-300 bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                    title={language === 'ar' ? 'إرسال بالبريد' : 'Send via Email'}
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintPdf(createdOrderForPreview || order)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
                    title={language === 'ar' ? 'طباعة' : 'Print'}
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(createdOrderForPreview || order)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
                    title={language === 'ar' ? 'تنزيل PDF' : 'PDF'}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLivePreviewModal(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Printable Document Style Card inside Modal */}
              <div className="p-6 sm:p-8 space-y-6 flex-1 text-slate-900 dark:text-slate-100">
                {/* Document Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                      {tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS'}
                    </h2>
                    {tenant?.business?.legalNameAr && (
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{tenant.business.legalNameAr}</p>
                    )}
                    {tenant?.business?.vatNumber && (
                      <p className="mt-1 text-xs font-mono text-slate-500">
                        {language === 'ar' ? 'الرقم الضريبي:' : 'VAT No:'} {tenant.business.vatNumber}
                      </p>
                    )}
                  </div>
                  <div className="sm:text-end">
                    <div className="flex items-center gap-1.5 justify-start sm:justify-end">
                      <span className="inline-block rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                        {language === 'ar' ? 'طلب شراء' : 'PURCHASE ORDER'}
                      </span>
                      {(() => {
                        const activePo = createdOrderForPreview || order
                        const currentStatus = activePo?.status || 'draft'
                        if (currentStatus === 'cancelled') {
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-800 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300">
                              <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                              {statusLabel('cancelled')}
                            </span>
                          )
                        }
                        if (['approved', 'received', 'partially_received', 'billed'].includes(currentStatus)) {
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              {statusLabel(currentStatus)}
                            </span>
                          )
                        }
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-white/10 dark:text-slate-300">
                            {statusLabel('draft')}
                          </span>
                        )
                      })()}
                    </div>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {watch('poNumber') || order?.poNumber || 'PO-DRAFT'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {language === 'ar' ? 'التاريخ:' : 'Date:'} {watch('orderDate') || new Date().toISOString().slice(0, 10)}
                    </p>
                  </div>
                </div>

                {/* Vendor & Delivery info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {language === 'ar' ? 'المورد / البائع' : 'Vendor / Supplier'}
                    </span>
                    {(() => {
                      const suppId = watch('supplierId') || order?.supplierId?._id || order?.supplierId
                      const supp = (Array.isArray(suppliers) ? suppliers : []).find(s => String(s?._id) === String(suppId)) || (typeof order?.supplierId === 'object' ? order.supplierId : null)
                      return (
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            {supp?.nameEn || supp?.nameAr || '—'}
                          </p>
                          {supp?.nameAr && supp?.nameEn && supp.nameAr !== supp.nameEn && (
                            <p className="text-slate-600 dark:text-slate-300">{supp.nameAr}</p>
                          )}
                          {supp?.phone && <p className="text-slate-500">{supp.phone}</p>}
                          {supp?.vatNumber && <p className="font-mono text-slate-500">VAT: {supp.vatNumber}</p>}
                        </div>
                      )
                    })()}
                  </div>

                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {language === 'ar' ? 'التسليم والمستودع' : 'Delivery & Warehouse'}
                    </span>
                    {(() => {
                      const whId = watch('warehouseId') || order?.warehouseId?._id || order?.warehouseId
                      const wh = (Array.isArray(warehouses) ? warehouses : []).find(w => String(w?._id) === String(whId)) || (typeof order?.warehouseId === 'object' ? order.warehouseId : null)
                      return (
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {wh?.nameEn || wh?.nameAr || '—'}
                          </p>
                          <p className="text-slate-500">
                            {language === 'ar' ? 'تاريخ التسليم المتوقع:' : 'Expected Date:'} {watch('expectedDate') || '—'}
                          </p>
                          <p className="text-slate-500">
                            {language === 'ar' ? 'العملة:' : 'Currency:'} {watch('currency') || 'SAR'}
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-100/70 font-bold uppercase tracking-wider text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                      <tr>
                        <th className="p-3 text-start">#</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                        <th className="p-3 text-center">{language === 'ar' ? 'الوحدة' : 'UOM'}</th>
                        <th className="p-3 text-center">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th className="p-3 text-end">{language === 'ar' ? 'سعر الوحدة' : 'Unit Cost'}</th>
                        <th className="p-3 text-center">{language === 'ar' ? 'الضريبة' : 'Tax'}</th>
                        <th className="p-3 text-end">{language === 'ar' ? 'المجموع' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {(lineItems || []).map((li, idx) => {
                        const name = formatLineItemName(li, language, products)
                        const qty = Number(li.quantityOrdered || 0)
                        const unit = Number(li.unitCost || 0)
                        const tax = Number(li.taxRate ?? 15)
                        const sub = qty * unit
                        const tot = sub + (sub * tax / 100)

                        return (
                          <tr key={idx}>
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{name}</td>
                            <td className="p-3 text-center text-slate-500">{li.uom || 'PCE'}</td>
                            <td className="p-3 text-center font-bold">{qty}</td>
                            <td className="p-3 text-end tabular-nums"><Money value={unit} /></td>
                            <td className="p-3 text-center text-slate-500">{tax}%</td>
                            <td className="p-3 text-end font-bold tabular-nums"><Money value={tot} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary box */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-xs rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                      <span className="font-semibold tabular-nums"><Money value={totals.subtotal} /></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</span>
                      <span className="font-semibold tabular-nums"><Money value={totals.totalTax} /></span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-950 dark:text-white dark:border-white/10">
                      <span>{language === 'ar' ? 'الإجمالي النهائي' : 'Grand Total'}</span>
                      <span className="tabular-nums"><Money value={totals.grandTotal} /></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Action Bar (Prominent Approve or Edit options) */}
              <div className="sticky bottom-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-white/90 px-6 py-4 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0c111a]/90">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {language === 'ar' ? 'حالة الطلب:' : 'Order Status:'}
                  </span>
                  {(() => {
                    const activePo = createdOrderForPreview || order
                    const currentStatus = activePo?.status || 'draft'
                    const isApprovedState = ['approved', 'received', 'partially_received', 'billed'].includes(currentStatus)
                    const isCancelledState = currentStatus === 'cancelled'

                    if (isCancelledState) {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-800 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300">
                          <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                          {statusLabel('cancelled')}
                        </span>
                      )
                    }

                    if (isApprovedState) {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          {statusLabel(currentStatus)}
                        </span>
                      )
                    }
                    return (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {statusLabel(currentStatus)}
                      </span>
                    )
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  {(() => {
                    const activePo = createdOrderForPreview || order
                    const currentStatus = activePo?.status || 'draft'
                    const isApprovedState = ['approved', 'received', 'partially_received', 'billed'].includes(currentStatus)
                    const isCancelledState = currentStatus === 'cancelled'

                    if (isApprovedState) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 me-2">
                            <CheckCircle2 className="h-4 w-4" />
                            {language === 'ar' ? 'معتمد وغير قابل للتعديل' : 'Approved (Locked)'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowLivePreviewModal(false)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                          >
                            {language === 'ar' ? 'إغلاق' : 'Close'}
                          </button>
                        </div>
                      )
                    }

                    if (isCancelledState) {
                      return (
                        <button
                          type="button"
                          onClick={() => setShowLivePreviewModal(false)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                        >
                          {language === 'ar' ? 'إغلاق' : 'Close'}
                        </button>
                      )
                    }

                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowLivePreviewModal(false)
                            setIsViewMode(false)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
                        >
                          <Edit3 className="h-4 w-4" />
                          {language === 'ar' ? 'تعديل الطلب' : 'Edit Order'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const targetId = createdOrderForPreview?._id || order?._id || id
                            if (targetId) {
                              cancelMutation.mutate(targetId)
                              setShowLivePreviewModal(false)
                            }
                          }}
                          disabled={cancelMutation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300"
                        >
                          {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          {language === 'ar' ? 'إلغاء الطلب' : 'Cancel PO'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowLivePreviewModal(false)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
                        >
                          {language === 'ar' ? 'إغلاق' : 'Close'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const targetId = createdOrderForPreview?._id || order?._id || id
                            if (targetId) {
                              approveMutation.mutate(targetId)
                            }
                          }}
                          disabled={approveMutation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          {language === 'ar' ? 'اعتماد طلب الشراء' : 'Approve PO'}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VENDOR BILL LIVE PREVIEW MODAL */}
      <AnimatePresence>
        {showVendorBillModal && order && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-[#0c111a] border border-slate-200 dark:border-white/10 flex flex-col"
            >
              {/* Modal Top Bar */}
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/90 px-6 py-3.5 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0c111a]/90">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                      {language === 'ar' ? 'معاينة فاتورة المورد (Live Preview)' : 'Vendor Bill Live Preview'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'ar' ? 'فاتورة البضائع المستلمة والمطابقة لأمر الشراء' : 'Billed goods received against purchase order'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintVendorBill(order)}
                    disabled={Boolean(pdfBusy)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
                  >
                    {pdfBusy === 'print_bill' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5 opacity-70" />}
                    {language === 'ar' ? 'طباعة الفاتورة' : 'Print Bill'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadVendorBill(order)}
                    disabled={Boolean(pdfBusy)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50"
                  >
                    {pdfBusy === 'download_bill' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowVendorBillModal(false)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Vendor Bill Paper Preview */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Paper Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {order.supplierId?.nameAr || order.supplierId?.nameEn || order.supplierId?.name || 'Supplier'}
                    </h2>
                    {order.supplierId?.nameEn && order.supplierId?.nameAr && order.supplierId?.nameEn !== order.supplierId?.nameAr && (
                      <p className="text-xs text-slate-500">{order.supplierId?.nameEn}</p>
                    )}
                    <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                      {order.supplierId?.vatNumber && <p className="font-mono">VAT: {order.supplierId.vatNumber}</p>}
                      {order.supplierId?.crNumber && <p className="font-mono">CR: {order.supplierId.crNumber}</p>}
                      {order.supplierId?.phone && <p>Tel: {order.supplierId.phone}</p>}
                      {order.supplierId?.email && <p>Email: {order.supplierId.email}</p>}
                    </div>
                  </div>

                  <div className="text-start sm:text-end space-y-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300">
                      <FileText className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'فاتورة المورد' : 'VENDOR BILL'}
                    </span>
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 pt-1">
                      {`BILL-${order.poNumber || 'PO'}`}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      PO: {order.poNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {language === 'ar' ? 'التاريخ:' : 'Date:'} {formatDateForInput(order.orderDate) || new Date().toISOString().slice(0, 10)}
                    </p>
                  </div>
                </div>

                {/* Billed To / Buyer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs rounded-2xl bg-slate-50/70 p-4 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {language === 'ar' ? 'فاتورة إلى (المشتري):' : 'Billed To (Buyer):'}
                    </span>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {tenant?.business?.legalNameAr || tenant?.business?.legalNameEn || tenant?.name || 'Company'}
                    </p>
                    {tenant?.business?.legalNameEn && tenant?.business?.legalNameAr && (
                      <p className="text-slate-500">{tenant.business.legalNameEn}</p>
                    )}
                    {tenant?.business?.vatNumber && <p className="font-mono text-slate-500">VAT: {tenant.business.vatNumber}</p>}
                    {tenant?.business?.crNumber && <p className="font-mono text-slate-500">CR: {tenant.business.crNumber}</p>}
                  </div>

                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {language === 'ar' ? 'تفاصيل الاستلام والعملة:' : 'Receiving & Currency:'}
                    </span>
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">{language === 'ar' ? 'المستودع:' : 'Warehouse:'} </span>
                      {order.warehouseId?.nameEn || order.warehouseId?.nameAr || '—'}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">{language === 'ar' ? 'العملة:' : 'Currency:'} </span>
                      {order.currency || 'SAR'}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">{language === 'ar' ? 'حالة الدفع:' : 'Payment:'} </span>
                      <span className="font-semibold">{paymentStatusLabel(order.paymentStatus || 'pending')}</span>
                    </p>
                  </div>
                </div>

                {/* Billed Items Table (Only Received Items if GRN happened, or ordered) */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-100/70 font-bold uppercase tracking-wider text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                      <tr>
                        <th className="p-3 text-start">#</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'المنتج / الوصف' : 'Product / Description'}</th>
                        <th className="p-3 text-center">{language === 'ar' ? 'الوحدة' : 'UOM'}</th>
                        <th className="p-3 text-center">{language === 'ar' ? 'الكمية المفوترة / المستلمة' : 'Billed / Rec Qty'}</th>
                        <th className="p-3 text-end">{language === 'ar' ? 'سعر الوحدة' : 'Unit Cost'}</th>
                        <th className="p-3 text-center">{language === 'ar' ? 'الضريبة' : 'Tax'}</th>
                        <th className="p-3 text-end">{language === 'ar' ? 'المجموع' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {(() => {
                        const rawLines = Array.isArray(order.lineItems) ? order.lineItems : []
                        const hasReceived = rawLines.some(li => Number(li?.quantityReceived || 0) > 0)
                        const linesToRender = hasReceived ? rawLines.filter(li => Number(li?.quantityReceived || 0) > 0) : rawLines

                        return linesToRender.map((li, idx) => {
                          const name = formatLineItemName(li, language, products)
                          const qty = hasReceived ? Number(li.quantityReceived || 0) : Number(li.quantityOrdered || 0)
                          const unit = Number(li.unitCost || 0)
                          const tax = Number(li.taxRate ?? 15)
                          const sub = qty * unit
                          const tot = sub + (sub * tax / 100)

                          return (
                            <tr key={idx}>
                              <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-3">
                                <p className="font-semibold text-slate-900 dark:text-white">{name}</p>
                                {li.productId?.sku && <span className="font-mono text-[10px] text-slate-400">SKU: {li.productId.sku}</span>}
                              </td>
                              <td className="p-3 text-center text-slate-500">{li.uom || 'PCE'}</td>
                              <td className="p-3 text-center font-bold tabular-nums text-teal-700 dark:text-teal-300">{qty}</td>
                              <td className="p-3 text-end tabular-nums"><Money value={unit} /></td>
                              <td className="p-3 text-center text-slate-500">{tax}%</td>
                              <td className="p-3 text-end font-bold tabular-nums"><Money value={tot} /></td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Financial Totals */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-2 text-xs rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                    {(() => {
                      const rawLines = Array.isArray(order.lineItems) ? order.lineItems : []
                      const hasReceived = rawLines.some(li => Number(li?.quantityReceived || 0) > 0)
                      const linesToSum = hasReceived ? rawLines.filter(li => Number(li?.quantityReceived || 0) > 0) : rawLines
                      const sub = linesToSum.reduce((s, li) => {
                        const q = hasReceived ? Number(li.quantityReceived || 0) : Number(li.quantityOrdered || 0)
                        return s + (q * Number(li.unitCost || 0))
                      }, 0)
                      const tax = linesToSum.reduce((s, li) => {
                        const q = hasReceived ? Number(li.quantityReceived || 0) : Number(li.quantityOrdered || 0)
                        const rate = Number(li.taxRate ?? 15)
                        return s + (q * Number(li.unitCost || 0) * rate / 100)
                      }, 0)
                      const grand = sub + tax

                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                            <span className="font-semibold tabular-nums"><Money value={sub} /></span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{language === 'ar' ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</span>
                            <span className="font-semibold tabular-nums"><Money value={tax} /></span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900 dark:text-white dark:border-white/10">
                            <span>{language === 'ar' ? 'إجمالي الفاتورة' : 'Bill Total'}</span>
                            <span className="tabular-nums text-violet-700 dark:text-violet-300"><Money value={grand} /></span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Scanned Vendor Bill Attachment Section */}
                <div className="border-t border-slate-100 pt-4 dark:border-white/[0.08]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {language === 'ar' ? 'مرفق فاتورة المورد الأصلية / Scanned Vendor Bill' : 'Original Vendor Bill Attachment'}
                  </h4>
                  {order.attachments && order.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {order.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          <span className="max-w-[200px] truncate">{att.name || `Attachment ${i + 1}`}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      {language === 'ar' ? 'لا يوجد ملف مرفق لفاتورة المورد.' : 'No scanned bill document attached yet.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-6 py-3.5 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0c111a]/95">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openWhatsAppModal(order)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {language === 'ar' ? 'واتساب' : 'WhatsApp'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEmailModal(order)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {language === 'ar' ? 'بريد' : 'Email'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVendorBillModal(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
                  >
                    {language === 'ar' ? 'إغلاق' : 'Close'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintVendorBill(order)}
                    disabled={Boolean(pdfBusy)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-100"
                  >
                    {pdfBusy === 'print_bill' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                    {language === 'ar' ? 'طباعة' : 'Print'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadVendorBill(order)}
                    disabled={Boolean(pdfBusy)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-700/20 hover:bg-violet-800 disabled:opacity-50"
                  >
                    {pdfBusy === 'download_bill' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SEND VIA WHATSAPP MODAL */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#0c111a] border border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إرسال طلب الشراء عبر الواتساب' : 'Send PO via WhatsApp'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowWhatsAppModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label">{language === 'ar' ? 'رقم جوال المورد (مع مفتاح الدولة)' : 'Supplier Phone (with country code)'} *</label>
                <input
                  type="text"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                  placeholder="9665xxxxxxxx"
                  className="input !py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="label">{language === 'ar' ? 'نص الرسالة' : 'Message Body'}</label>
                <textarea
                  rows={6}
                  value={whatsAppText}
                  onChange={(e) => setWhatsAppText(e.target.value)}
                  className="input text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.08]">
              <button type="button" onClick={() => setShowWhatsAppModal(false)} className={ghostBtn}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={sendWhatsAppMessage}
                disabled={!whatsAppPhone}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {language === 'ar' ? 'فتح وإرسال بالواتساب' : 'Open in WhatsApp'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SEND VIA EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#0c111a] border border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <Mail className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إرسال طلب الشراء بالبريد' : 'Send PO via Email'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowEmailModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label">{language === 'ar' ? 'البريد الإلكتروني للمورد' : 'Supplier Email'} *</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="supplier@example.com"
                  className="input !py-2 text-xs"
                />
              </div>

              <div>
                <label className="label">{language === 'ar' ? 'عنوان الرسالة' : 'Subject'}</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="input !py-2 text-xs"
                />
              </div>

              <div>
                <label className="label">{language === 'ar' ? 'محتوى الرسالة' : 'Email Content'}</label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="input text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.08]">
              <button type="button" onClick={() => setShowEmailModal(false)} className={ghostBtn}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={sendEmailMessage}
                disabled={!emailTo}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {language === 'ar' ? 'إرسال البريد الإلكتروني' : 'Send Email'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* INTEGRATED GOODS RECEIPT NOTE (GRN) MODAL */}
      {showQuickReceiveModal && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${shell} w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                  <WarehouseIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? 'إشعار استلام البضاعة (GRN)' : 'Goods Receipt Note (GRN)'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'ar'
                      ? `استلام وترحيل بنود الطلب ${order.poNumber || ''} مباشرة إلى المخزون`
                      : `Receive & post line items for PO ${order.poNumber || ''} to inventory`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickReceiveModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warehouse selector & Quick Fill */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-slate-50/70 p-3.5 rounded-2xl dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06]">
              <div className="flex-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {language === 'ar' ? 'مستودع الاستلام والترحيل' : 'Receiving Warehouse'} *
                </label>
                <select
                  value={receiveWarehouseId}
                  onChange={(e) => setReceiveWarehouseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-dark-800 dark:text-white"
                >
                  {(warehouses || []).map((w) => (
                    <option key={w._id} value={w._id}>
                      {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn || w.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  const all = {}
                  orderLineItems.forEach((li, idx) => {
                    const key = poReceiveLineKey(li, idx)
                    const rem = Math.max(0, Number(li.quantityOrdered || 0) - Number(li.quantityReceived || 0))
                    all[key] = rem
                  })
                  setReceiveQty(all)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300 whitespace-nowrap"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {language === 'ar' ? 'استلام كل المتبقي' : 'Receive all remaining'}
              </button>
            </div>

            {/* Items Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-transparent">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
                  <tr>
                    <th className="p-3 text-start">{language === 'ar' ? 'البند / المنتج' : 'Item / Product'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'المطلوب' : 'Ordered'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'المستلم' : 'Received'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'استلام الآن' : 'Receive Now'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'المتبقي / الإجراء' : 'Remainder / Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {orderLineItems.map((li, idx) => {
                    const productId = li?.productId?._id || li?.productId
                    const key = poReceiveLineKey(li, idx)
                    const name = formatLineItemName(li, language, products)
                    const ordered = Number(li.quantityOrdered || 0)
                    const alreadyRec = Number(li.quantityReceived || 0)
                    const remaining = Math.max(0, ordered - alreadyRec)
                    const currVal = receiveQty[key] ?? ''
                    const numVal = currVal === '' ? 0 : Number(currVal)
                    const lineBackorder = Math.max(0, remaining - numVal)
                    const currentLineAction = lineRemainingActions[key] || 'backorder'

                    return (
                      <tr key={key} className="hover:bg-slate-50/40 dark:hover:bg-white/[0.02]">
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                          <p className="font-semibold text-slate-900 dark:text-white">{name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{li.uom || 'PCE'}</span>
                        </td>
                        <td className="p-3 text-center font-bold tabular-nums text-slate-700 dark:text-slate-300">{ordered}</td>
                        <td className="p-3 text-center font-bold tabular-nums text-teal-600 dark:text-teal-400">{alreadyRec}</td>
                        <td className="p-3 text-center font-bold tabular-nums text-amber-600 dark:text-amber-400">{remaining}</td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={currVal}
                            onChange={(e) => {
                              const raw = e.target.value
                              if (raw === '') {
                                setReceiveQty((prev) => ({ ...prev, [key]: '' }))
                              } else {
                                const val = Math.max(0, parseFloat(raw) || 0)
                                setReceiveQty((prev) => ({ ...prev, [key]: val }))
                              }
                            }}
                            placeholder="0"
                            className="w-20 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-center font-bold text-slate-900 shadow-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-dark-800 dark:text-white mx-auto"
                          />
                        </td>
                        <td className="p-3 text-center tabular-nums">
                          {numVal > remaining ? (
                            <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300">
                              +{numVal - remaining} {language === 'ar' ? 'هدية' : 'Gift'}
                            </span>
                          ) : lineBackorder > 0 ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="font-bold text-amber-700 dark:text-amber-300 text-xs tabular-nums">
                                {lineBackorder}
                              </span>
                              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-white/10 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setLineRemainingActions((prev) => ({ ...prev, [key]: 'backorder' }))}
                                  className={`rounded-md px-2 py-0.5 font-semibold transition ${
                                    currentLineAction === 'backorder'
                                      ? 'bg-white text-teal-800 shadow-sm dark:bg-dark-800 dark:text-teal-300'
                                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                                  }`}
                                  title={language === 'ar' ? 'طلب مؤجل - توريد لاحقاً' : 'Keep on Backorder'}
                                >
                                  {language === 'ar' ? 'مؤجل' : 'Backorder'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLineRemainingActions((prev) => ({ ...prev, [key]: 'refund' }))}
                                  className={`rounded-md px-2 py-0.5 font-semibold transition ${
                                    currentLineAction === 'refund'
                                      ? 'bg-rose-500 text-white shadow-sm'
                                      : 'text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300'
                                  }`}
                                  title={language === 'ar' ? 'استرداد / تسوية وإلغاء المتبقي' : 'Refund / Settle'}
                                >
                                  {language === 'ar' ? 'استرداد' : 'Refund'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300">
                              0
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Notes / Delay reason */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {language === 'ar' ? 'ملاحظات الاستلام / أسباب التأخير (اختياري)' : 'Receiving Notes / Delay Reason (Optional)'}
              </label>
              <textarea
                rows={2}
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder={language === 'ar' ? 'أي ملاحظات أو أسباب تخص الشحنة...' : 'Any notes or delay reasons...'}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 shadow-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-dark-800 dark:text-white"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowQuickReceiveModal(false)}
                className={ghostBtn}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitReceive}
                disabled={receiveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-40"
              >
                {receiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WarehouseIcon className="h-4 w-4" />}
                {language === 'ar' ? 'اعتماد الاستلام وترحيل للمخزون' : 'Post Stock & Complete Receiving'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Inline Quick Add Supplier Modal */}
      <AnimatePresence>
        {showSupplierModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111827] border border-gray-100 dark:border-white/10 space-y-5 my-6 max-h-[92vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/10 via-emerald-500/15 to-teal-500/5 text-teal-700 dark:text-teal-300 ring-1 ring-inset ring-teal-500/20">
                    <UserPlus className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">
                      {language === 'ar' ? 'الموردون والمشتريات' : 'Vendors & Suppliers'}
                    </p>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      {language === 'ar' ? 'إضافة مورد سريع' : 'Quick Add Supplier'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 text-xs">
                {/* Names */}
                <div className={showArabicFields ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span>{showArabicFields ? (language === 'ar' ? 'الاسم (EN)' : 'Name (EN)') : (language === 'ar' ? 'الاسم' : 'Name')} *</span>
                      {showArabicFields ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">EN</span> : null}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                      placeholder="e.g. Al-Marai Foods"
                      value={supplierForm.nameEn}
                      onChange={(e) => setSupplierForm((p) => ({ ...p, nameEn: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  {showArabicFields ? (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                        <span>{language === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</span>
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">AR</span>
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                        placeholder="مثال: شركة المراعي للأغذية"
                        value={supplierForm.nameAr}
                        onChange={(e) => setSupplierForm((p) => ({ ...p, nameAr: e.target.value }))}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Contact: Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                      placeholder="+966 5X XXX XXXX"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-slate-400" />
                      <span>{language === 'ar' ? 'البريد الإلكتروني' : 'Email (Optional)'}</span>
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                      placeholder="supplier@example.com"
                      value={supplierForm.email || ''}
                      onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>

                {/* VAT Number */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span>{language === 'ar' ? 'الرقم الضريبي (اختياري)' : 'VAT Number (Optional)'}</span>
                    <span className="text-[10px] font-mono text-slate-400">15 digits</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                    placeholder="300000000000003"
                    value={supplierForm.vatNumber || ''}
                    onChange={(e) => setSupplierForm((p) => ({ ...p, vatNumber: e.target.value }))}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={submitInlineSupplier}
                  disabled={addSupplierMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition"
                >
                  {addSupplierMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-teal-400 dark:text-teal-600" />
                  )}
                  <span>{language === 'ar' ? 'حفظ وتحديد المورد' : 'Save & Select Supplier'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inline Quick Add Warehouse Modal */}
      <AnimatePresence>
        {showWarehouseModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111827] border border-gray-100 dark:border-white/10 space-y-5 my-6 max-h-[92vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 via-blue-500/15 to-indigo-500/5 text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/20">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-400">
                      {language === 'ar' ? 'المستودعات والمخازن' : 'Warehouses & Locations'}
                    </p>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      {language === 'ar' ? 'إنشاء مستودع جديد' : 'Create Warehouse'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 text-xs">
                {/* Code */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span>{language === 'ar' ? 'رمز المستودع' : 'Warehouse Code'}</span>
                    <span className="text-[10px] font-mono text-slate-400">e.g. WH-001</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                    placeholder="WH-001"
                    value={warehouseForm.code}
                    onChange={(e) => setWarehouseForm((p) => ({ ...p, code: e.target.value }))}
                  />
                </div>

                {/* Names */}
                <div className={showArabicFields ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span>{showArabicFields ? (language === 'ar' ? 'الاسم (EN)' : 'Name (EN)') : (language === 'ar' ? 'الاسم' : 'Name')} *</span>
                      {showArabicFields ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">EN</span> : null}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                      placeholder="e.g. Central Warehouse"
                      value={warehouseForm.nameEn}
                      onChange={(e) => setWarehouseForm((p) => ({ ...p, nameEn: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  {showArabicFields ? (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                        <span>{language === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</span>
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">AR</span>
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                        placeholder="مثال: المستودع المركزي"
                        value={warehouseForm.nameAr}
                        onChange={(e) => setWarehouseForm((p) => ({ ...p, nameAr: e.target.value }))}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={submitInlineWarehouse}
                  disabled={addWarehouseMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition"
                >
                  {addWarehouseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-indigo-400 dark:text-indigo-600" />
                  )}
                  <span>{language === 'ar' ? 'حفظ وتحديد المستودع' : 'Save & Select Warehouse'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inline Quick Add Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className={`${shell} w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">
                  {language === 'ar' ? 'المخزون والمنتجات' : 'Inventory Products'}
                </p>
                <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إضافة منتج جديد للمخزون' : 'Quick Add Product'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={showArabicFields ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                <div>
                  <label className="label">{showArabicFields ? (language === 'ar' ? 'اسم المنتج (EN)' : 'Product Name (EN)') : (language === 'ar' ? 'اسم المنتج' : 'Product Name')} *</label>
                  <input
                    type="text"
                    value={productForm.nameEn}
                    onChange={(e) => setProductForm((p) => ({ ...p, nameEn: e.target.value }))}
                    placeholder="e.g. Arabic Coffee 500g"
                    className="input !py-1.5 text-xs"
                    autoFocus
                  />
                </div>
                {showArabicFields ? (
                  <div>
                    <label className="label">{language === 'ar' ? 'اسم المنتج (AR)' : 'Product Name (AR)'}</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={productForm.nameAr}
                      onChange={(e) => setProductForm((p) => ({ ...p, nameAr: e.target.value }))}
                      placeholder="مثال: قهوة عربية 500 جرام"
                      className="input !py-1.5 text-xs"
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">{language === 'ar' ? 'رمز المنتج / SKU' : 'SKU / Barcode'}</label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))}
                    placeholder="SKU-XXXX"
                    className="input !py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'نوع المنتج' : 'Product Type'}</label>
                  <select
                    value={productForm.productType}
                    onChange={(e) => setProductForm((p) => ({ ...p, productType: e.target.value }))}
                    className="select !py-1.5 text-xs"
                  >
                    <option value="goods">{language === 'ar' ? 'بضائع / مخزون' : 'Goods / Stock'}</option>
                    <option value="service">{language === 'ar' ? 'خدمة' : 'Service'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">{language === 'ar' ? 'سعر الشراء / التكلفة' : 'Cost Price'} (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.costPrice}
                    onChange={(e) => setProductForm((p) => ({ ...p, costPrice: e.target.value }))}
                    placeholder="0.00"
                    className="input !py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'سعر البيع' : 'Selling Price'} (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.sellingPrice}
                    onChange={(e) => setProductForm((p) => ({ ...p, sellingPrice: e.target.value }))}
                    placeholder="0.00"
                    className="input !py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الوحدة (اختياري)' : 'UOM (Optional)'}</label>
                  <select
                    value={productForm.unitOfMeasure}
                    onChange={(e) => setProductForm((p) => ({ ...p, unitOfMeasure: e.target.value }))}
                    className="select !py-1.5 text-xs"
                  >
                    <option value="">{language === 'ar' ? 'بدون وحدة (اختياري)' : 'None (Optional)'}</option>
                    {uomOptions.map((u) => (
                      <option key={u.code} value={u.code}>
                        {language === 'ar' ? u.labelAr : u.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className={ghostBtn}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitInlineProduct}
                disabled={addProductMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-40"
              >
                {addProductMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {language === 'ar' ? 'إضافة واختيار المنتج' : 'Save & Select Product'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPoPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        order={order}
        isAr={language === 'ar'}
        onSuccess={() => {
          queryClient.invalidateQueries(['purchase-order', id])
          queryClient.invalidateQueries(['purchase-orders'])
          queryClient.invalidateQueries(['purchase-orders-stats'])
          queryClient.invalidateQueries(['suppliers-list'])
          queryClient.invalidateQueries(['suppliers-financials'])
        }}
      />
    </div>
  )
}

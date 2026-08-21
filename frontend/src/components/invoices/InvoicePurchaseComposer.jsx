import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Clock3, PackageCheck, Plus, Save, Trash2, UploadCloud, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../ui/Money'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { isGccArabicMarket } from '../../lib/invoiceLanguage'
import { isPakistanTenant, getTaxLabel, getTaxIdLabel, getTenantCountryCode, showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'
import { getAvailableUomOptions, getDefaultUom, getUomLabel } from '../../lib/uomOptions'
import { useLiveTranslation, useBilingualAddressFields, LineItemTranslator } from '../../lib/liveTranslation'
import InvoiceLivePreview from './InvoiceLivePreview'
import DocumentPreSaveModal from './DocumentPreSaveModal'
import InvoiceTemplateSelector from './InvoiceTemplateSelector'
import TravelInvoiceFields from './TravelInvoiceFields'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { formPaymentStatusFromInvoice, applyFormPaymentToPayload } from '../../lib/invoicePaymentTerms'
import { normalizeProductType, productPickerLabel } from '../../lib/productType'
import ProductTypeToggle from '../ui/ProductTypeToggle'
import RichTextNoteField from './RichTextNoteField'
import PurchaseReceivingLedger from '../../pages/purchases/PurchaseReceivingLedger'
import { PURCHASES_PATH, formatDay, ghostBtn, primaryBtn } from '../../pages/purchases/purchasesUi'

const getEmptyLine = (tenant) => ({
  productId: '',
  productName: '',
  productNameAr: '',
  productType: 'goods',
  unitCode: getDefaultUom(tenant) || '',
  quantity: 1,
  unitPrice: '',
  taxRate: 15,
})

const purchaseContexts = ['trading', 'construction', 'travel_agency', 'furniture', 'furniture_shop']

function BilingualLabel({ en, ar, showArabic = true }) {
  return (
    <label className="label flex items-baseline justify-between gap-2" dir="ltr">
      <span>{en}</span>
      {showArabic && ar ? <span dir="rtl" className="font-medium text-gray-500">{ar}</span> : null}
    </label>
  )
}

const buildPurchaseInvoiceFormValues = ({ invoice, tenant, defaultBusinessContext, hasTravel }) => {
  const empty = getEmptyLine(tenant)
  return {
    businessContext: invoice?.businessContext || defaultBusinessContext,
    invoiceSubtype: invoice?.invoiceSubtype || (hasTravel ? 'travel_ticket' : 'standard'),
    pdfTemplateId: invoice?.pdfTemplateId || getInvoiceTemplateId(tenant, invoice?.businessContext || defaultBusinessContext),
    transactionType: invoice?.transactionType || 'B2B',
    invoiceTypeCode: invoice?.invoiceTypeCode || (invoice?.transactionType === 'B2C' ? '0200000' : '0100000'),
    warehouseId: invoice?.warehouseId?._id || invoice?.warehouseId || '',
    supplierId: invoice?.supplierId?._id || invoice?.supplierId || '',
    sourcePurchaseOrderId: invoice?.sourcePurchaseOrderId?._id || invoice?.sourcePurchaseOrderId || '',
    seller: invoice?.seller || {},
    buyer: invoice?.buyer || {},
    travelDetails: invoice?.travelDetails || { passengerTitle: 'mr', layoverStay: '', hasReturnDate: false, segments: [{ from: '', to: '' }], passengers: [] },
    authorizedPersonName: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonName || '') : '',
    authorizedPersonNameAr: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonNameAr || '') : '',
    authorizedPersonDesignation: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonDesignation || '') : '',
    authorizedPersonDesignationAr: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonDesignationAr || '') : '',
    authorizedPersonSignature: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonSignature || '') : '',
    stampImage: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.stampImage || '') : '',
    paymentTerms: invoice?.paymentTerms || '',
    paymentMethod: invoice?.paymentMethod || 'cash',
    paymentStatus: formPaymentStatusFromInvoice(invoice),
    paidAmount: toNumber(invoice?.paidAmount, 0),
    invoiceDiscount: toNumber(invoice?.invoiceDiscount, 0),
    termsAndConditions: invoice?.termsAndConditions || '',
    notes: invoice?.notes || '',
    bankDetails: {
      bankName: invoice?.bankDetails?.bankName || '',
      accountName: invoice?.bankDetails?.accountName || '',
      accountNumber: invoice?.bankDetails?.accountNumber || '',
      iban: invoice?.bankDetails?.iban || '',
    },
    includeBankDetails: Boolean(invoice?.includeBankDetails || invoice?.bankDetails?.bankName || invoice?.bankDetails?.iban || invoice?.bankDetails?.accountNumber),
    lineItems: Array.isArray(invoice?.lineItems) && invoice.lineItems.length > 0
      ? invoice.lineItems.map((line) => ({
          ...empty,
          ...line,
          productId: line?.productId || '',
          productName: line?.productName || '',
          productNameAr: line?.productNameAr || '',
          productType: normalizeProductType(line?.productType),
          unitCode: line?.unitCode !== undefined ? (line.unitCode || '') : empty.unitCode,
          quantity: Math.max(0.0001, toNumber(line?.quantity, 1)),
          unitPrice: Math.max(0, toNumber(line?.unitPrice, 0)),
          taxRate: Math.max(0, toNumber(line?.taxRate, 15)),
        }))
      : [empty],
  }
}

function partyId(value) {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || '')
  return String(value)
}

function isFutureDate(value) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return date > today
}

export default function InvoicePurchaseComposer({ invoiceId = '', initialInvoice = null }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const poIdParam = String(searchParams.get('poId') || '').trim()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [transactionType, setTransactionType] = useState('B2B')
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const isEdit = Boolean(invoiceId)
  const [selectedPoId, setSelectedPoId] = useState(
    () => partyId(initialInvoice?.sourcePurchaseOrderId) || poIdParam
  )
  const filledPoIdRef = useRef('')
  const shouldFillFromPoRef = useRef(Boolean(poIdParam) && !isEdit)
  const [showAuthorizedPerson, setShowAuthorizedPerson] = useState(() => {
    return Boolean(
      initialInvoice?.authorizedPersonName ||
      initialInvoice?.authorizedPersonNameAr ||
      initialInvoice?.authorizedPersonDesignation ||
      initialInvoice?.authorizedPersonDesignationAr ||
      initialInvoice?.authorizedPersonSignature ||
      initialInvoice?.stampImage
    )
  })
  const [showTermsPanel, setShowTermsPanel] = useState(() => Boolean(initialInvoice?.termsAndConditions))
  const [showNotesPanel, setShowNotesPanel] = useState(() => Boolean(initialInvoice?.notes))
  const [showBankPanel, setShowBankPanel] = useState(() => Boolean(
    initialInvoice?.includeBankDetails ||
    initialInvoice?.bankDetails?.bankName ||
    initialInvoice?.bankDetails?.iban ||
    initialInvoice?.bankDetails?.accountNumber
  ))

  const handleToggleAuthorizedPerson = (enable) => {
    setShowAuthorizedPerson(enable)
    if (enable) {
      const currentName = getValues('authorizedPersonName')
      const currentSignature = getValues('authorizedPersonSignature')
      const currentStamp = getValues('stampImage')

      if (!currentName && tenant?.business?.legalNameEn) {
        setValue('authorizedPersonName', tenant.business.legalNameEn)
      }
      if (!getValues('authorizedPersonNameAr') && tenant?.business?.legalNameAr) {
        setValue('authorizedPersonNameAr', tenant.business.legalNameAr)
      }
      if (!currentSignature && (tenant?.settings?.invoiceBranding?.presetSignature || tenant?.settings?.invoiceBranding?.signatureImage)) {
        setValue('authorizedPersonSignature', tenant.settings.invoiceBranding.presetSignature || tenant.settings.invoiceBranding.signatureImage)
      }
      if (!currentStamp && (tenant?.settings?.invoiceBranding?.presetStamp || tenant?.settings?.invoiceBranding?.stampImage)) {
        setValue('stampImage', tenant.settings.invoiceBranding.presetStamp || tenant.settings.invoiceBranding.stampImage)
      }
    } else {
      setValue('authorizedPersonName', '')
      setValue('authorizedPersonNameAr', '')
      setValue('authorizedPersonDesignation', '')
      setValue('authorizedPersonDesignationAr', '')
      setValue('authorizedPersonSignature', '')
      setValue('stampImage', '')
    }
  }

  const handleToggleTerms = (enable) => {
    setShowTermsPanel(enable)
    if (enable) {
      const current = getValues('termsAndConditions')
      if (!current) {
        const defaultTerms = tenant?.settings?.invoiceBranding?.termsAndConditions ||
          tenant?.settings?.termsAndConditions ||
          tenant?.settings?.invoiceBranding?.defaultTermsAndConditions ||
          ''
        if (defaultTerms) setValue('termsAndConditions', defaultTerms)
      }
    } else {
      setValue('termsAndConditions', '')
    }
  }

  const handleToggleNotes = (enable) => {
    setShowNotesPanel(enable)
    if (enable) {
      const current = getValues('notes')
      if (!current) {
        const defaultNotes = tenant?.settings?.invoiceBranding?.defaultNotes ||
          tenant?.settings?.notes ||
          ''
        if (defaultNotes) setValue('notes', defaultNotes)
      }
    } else {
      setValue('notes', '')
    }
  }

  const handleToggleBankDetails = (enable) => {
    setShowBankPanel(enable)
    setValue('includeBankDetails', enable)
    if (enable) {
      const current = getValues('bankDetails') || {}
      const tenantBank = tenant?.business?.bankDetails || {}
      if (!current.bankName && tenantBank.bankName) setValue('bankDetails.bankName', tenantBank.bankName)
      if (!current.accountName && tenantBank.accountName) setValue('bankDetails.accountName', tenantBank.accountName)
      if (!current.accountNumber && tenantBank.accountNumber) setValue('bankDetails.accountNumber', tenantBank.accountNumber)
      if (!current.iban && tenantBank.iban) setValue('bankDetails.iban', tenantBank.iban)
    } else {
      setValue('bankDetails.bankName', '')
      setValue('bankDetails.accountName', '')
      setValue('bankDetails.accountNumber', '')
      setValue('bankDetails.iban', '')
    }
  }

  const defaultBusinessContext = useMemo(() => {
    const primary = getPrimaryBusinessType(tenant)
    if (purchaseContexts.includes(primary)) return primary
    return tenantBusinessTypes.find((type) => purchaseContexts.includes(type)) || 'trading'
  }, [tenant, tenantBusinessTypes])

  const { register, control, handleSubmit, watch, setValue, getValues, reset } = useForm({
    defaultValues: buildPurchaseInvoiceFormValues({
      invoice: initialInvoice,
      tenant,
      defaultBusinessContext,
      hasTravel: tenantBusinessTypes.includes('travel_agency'),
    })
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems' })
  const values = watch()
  const watchedLineItems = useWatch({ control, name: 'lineItems' })
  const watchedInvoiceDiscount = useWatch({ control, name: 'invoiceDiscount' })
  const lineItems = (Array.isArray(watchedLineItems) && watchedLineItems.length > 0)
    ? watchedLineItems
    : (Array.isArray(values.lineItems) ? values.lineItems : [])
  const businessContext = values.businessContext || defaultBusinessContext
  const invoiceSubtype = values.invoiceSubtype || 'standard'
  const selectedTemplateId = Number(values.pdfTemplateId || getInvoiceTemplateId(tenant, businessContext))
  const selectedWarehouseId = values.warehouseId || ''
  const showArabicFields = isArabicTenantMarket(tenant)
  const isPk = isPakistanTenant(tenant)
  const taxLabel = getTaxLabel(tenant)
  const taxIdLabel = getTaxIdLabel(tenant)
  const FieldLabel = (props) => <BilingualLabel {...props} showArabic={showArabicFields} />
  const skipBusinessContextResetRef = useRef(false)

  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'seller.name',
    targetField: 'seller.nameAr',
    sourceLang: 'en', targetLang: 'ar',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'seller.nameAr',
    targetField: 'seller.name',
    sourceLang: 'ar', targetLang: 'en',
  })

  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'buyer.name',
    targetField: 'buyer.nameAr',
    sourceLang: 'en', targetLang: 'ar',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'buyer.nameAr',
    targetField: 'buyer.name',
    sourceLang: 'ar', targetLang: 'en',
  })
  useBilingualAddressFields({
    control, watch, setValue,
    prefix: 'buyer.address',
    enabled: showArabicFields,
  })

  useEffect(() => {
    if (isEdit && initialInvoice?._id) return
    setValue('businessContext', defaultBusinessContext)
  }, [defaultBusinessContext, initialInvoice?._id, isEdit, setValue])

  useEffect(() => {
    if (!isEdit || !initialInvoice?._id) return
    skipBusinessContextResetRef.current = true
    setTransactionType(initialInvoice?.transactionType === 'B2C' ? 'B2C' : 'B2B')
    setShowAuthorizedPerson(
      Boolean(
        initialInvoice?.authorizedPersonName ||
        initialInvoice?.authorizedPersonNameAr ||
        initialInvoice?.authorizedPersonDesignation ||
        initialInvoice?.authorizedPersonDesignationAr ||
        initialInvoice?.authorizedPersonSignature ||
        initialInvoice?.stampImage
      )
    )
    reset(buildPurchaseInvoiceFormValues({
      invoice: initialInvoice,
      tenant,
      defaultBusinessContext,
      hasTravel: tenantBusinessTypes.includes('travel_agency'),
    }))
  }, [defaultBusinessContext, initialInvoice, isEdit, reset, tenant, tenantBusinessTypes])

  useEffect(() => {
    if (!isTravelContext && invoiceSubtype === 'travel_ticket') {
      setValue('invoiceSubtype', 'standard')
    }
  }, [invoiceSubtype, isTravelContext, setValue])

  useEffect(() => {
    if (skipBusinessContextResetRef.current) {
      skipBusinessContextResetRef.current = false
      return
    }
    setValue('pdfTemplateId', getInvoiceTemplateId(tenant, businessContext))
  }, [businessContext, setValue])

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((res) => res.data.products),
    enabled: isTradingContext,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => res.data),
    enabled: isTradingContext,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers),
    enabled: isTradingContext,
  })

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders', 'invoice-fill'],
    queryFn: () => api.get('/purchase-orders', { params: { page: 1, limit: 200 } })
      .then((res) => res.data?.purchaseOrders || res.data || []),
    enabled: isTradingContext,
  })

  const { data: selectedPo } = useQuery({
    queryKey: ['purchase-order', selectedPoId],
    queryFn: () => api.get(`/purchase-orders/${selectedPoId}`).then((res) => res.data),
    enabled: Boolean(selectedPoId) && isTradingContext,
  })

  const isSubmittedRef = useRef(false)
  const latestValues = useRef(values)

  useEffect(() => {
    latestValues.current = values
  }, [values])

  useEffect(() => {
    return () => {
      if (!isEdit && !isSubmittedRef.current) {
        const data = latestValues.current
        const hasData = data.seller?.name || data.supplierId || (data.lineItems && data.lineItems.some((l) => l.productName || l.unitPrice > 0))
        if (hasData) {
          const payload = {
            ...data,
            flow: 'purchase',
            businessContext: data.businessContext || 'trading',
            invoiceSubtype: data.invoiceSubtype || 'standard',
            pdfTemplateId: Number(data.pdfTemplateId) || 1,
            transactionType: data.transactionType || 'B2B',
            invoiceTypeCode: data.transactionType === 'B2C' ? '0200000' : '0100000',
            issueDate: new Date(),
            status: 'draft',
            lineItems: (data.lineItems || []).map((line, index) => ({
              ...line,
              lineNumber: index + 1,
              taxCategory: 'S',
            })),
          }
          api.post('/invoices/purchase', payload).catch(() => {})
        }
      }
    }
  }, [isEdit])

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit ? api.put(`/invoices/${invoiceId}`, payload) : api.post('/invoices/purchase', payload),
    onSuccess: (res) => {
      isSubmittedRef.current = true;
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث فاتورة الشراء بنجاح' : 'Purchase invoice updated successfully') : (language === 'ar' ? 'تم إنشاء فاتورة الشراء بنجاح' : 'Purchase invoice created successfully'))
      queryClient.invalidateQueries(['invoices'])
      if (isEdit) {
        queryClient.invalidateQueries(['invoice', invoiceId])
      }
      if (res.data?.offline) {
        navigate('/app/dashboard/invoices')
      } else {
        navigate(`/app/dashboard/invoices/${res.data?._id || invoiceId}`)
      }
    },
    onError: (error) => toast.error(error.response?.data?.error || (isEdit ? 'Failed to update purchase invoice' : 'Failed to create purchase invoice')),
  })

  const onSelectProduct = (index, productId) => {
    const product = (products || []).find((item) => item._id === productId)
    if (!product) return
    setValue(`lineItems.${index}.productId`, product._id)
    setValue(`lineItems.${index}.productName`, product.nameEn)
    setValue(`lineItems.${index}.productNameAr`, product.nameAr || product.nameEn)
    setValue(`lineItems.${index}.unitCode`, product.unitOfMeasure || 'PCE')
    setValue(`lineItems.${index}.taxRate`, typeof product.taxRate === 'number' ? product.taxRate : 15)
    setValue(`lineItems.${index}.productType`, normalizeProductType(product.productType))
    if (typeof product.costPrice === 'number' && product.costPrice > 0) {
      setValue(`lineItems.${index}.unitPrice`, product.costPrice)
    }
  }

  const fillSellerFromParty = (supplier) => {
    if (!supplier) return
    const id = partyId(supplier)
    if (id) setValue('supplierId', id)
    setValue('seller.name', supplier.nameEn || supplier.nameAr || '')
    setValue('seller.nameAr', supplier.nameAr || supplier.nameEn || '')
    setValue('seller.vatNumber', supplier.vatNumber || '')
    setValue('seller.crNumber', supplier.crNumber || '')
    setValue('seller.contactPhone', supplier.phone || '')
    setValue('seller.contactEmail', supplier.email || '')
    setValue('seller.address.city', supplier.address?.city || '')
    setValue('seller.address.cityAr', supplier.address?.cityAr || '')
    setValue('seller.address.district', supplier.address?.district || '')
    setValue('seller.address.districtAr', supplier.address?.districtAr || '')
    setValue('seller.address.street', supplier.address?.street || '')
    setValue('seller.address.streetAr', supplier.address?.streetAr || '')
    setValue('seller.address.postalCode', supplier.address?.postalCode || '')
    setValue('seller.address.country', supplier.address?.country || getTenantCountryCode(tenant))
    setValue('seller.address.buildingNumber', supplier.address?.buildingNumber || '')
    setValue('seller.address.additionalNumber', supplier.address?.additionalNumber || '')
  }

  const onSelectSupplier = (supplierId) => {
    const supplier = (suppliers || []).find((item) => item._id === supplierId)
    if (!supplier) return
    fillSellerFromParty(supplier)
  }

  const applyPurchaseOrder = (po) => {
    if (!po?._id) return
    setValue('sourcePurchaseOrderId', po._id)
    const warehouseId = partyId(po.warehouseId)
    if (warehouseId) setValue('warehouseId', warehouseId)
    const supplier = po.supplierId && typeof po.supplierId === 'object'
      ? po.supplierId
      : (suppliers || []).find((item) => item._id === partyId(po.supplierId))
    if (supplier) fillSellerFromParty(supplier)
    else if (partyId(po.supplierId)) setValue('supplierId', partyId(po.supplierId))
    if (po.notes) setValue('notes', po.notes)
    const items = (Array.isArray(po.lineItems) ? po.lineItems : []).map((li) => {
      const product = li?.productId && typeof li.productId === 'object' ? li.productId : null
      return {
        ...emptyLine,
        productId: product?._id || li?.productId || '',
        productName: product?.nameEn || li?.manualName || li?.description || '',
        productNameAr: product?.nameAr || '',
        productType: normalizeProductType(li?.productType || product?.productType),
        unitCode: li?.uom || product?.unitOfMeasure || 'PCE',
        quantity: Math.max(0.0001, toNumber(li?.quantityOrdered ?? li?.quantity, 1) - toNumber(li?.quantityReturned, 0)),
        unitPrice: Math.max(0, toNumber(li?.unitCost ?? li?.unitPrice, 0)),
        taxRate: Math.max(0, toNumber(li?.taxRate, 15)),
      }
    })
    replace(items.length ? items : [emptyLine])
    toast.success(language === 'ar' ? 'تم تعبئة الفاتورة من طلب الشراء' : 'Invoice filled from purchase order')
  }

  useEffect(() => {
    if (!selectedPo?._id) return
    setValue('sourcePurchaseOrderId', selectedPo._id)
    if (!shouldFillFromPoRef.current) return
    if (filledPoIdRef.current === String(selectedPo._id)) return
    filledPoIdRef.current = String(selectedPo._id)
    shouldFillFromPoRef.current = false
    applyPurchaseOrder(selectedPo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPo])

  const summary = useMemo(
    () => calculateInvoiceSummary({
      lineItems,
      invoiceDiscount: toNumber(watchedInvoiceDiscount ?? values.invoiceDiscount, 0),
    }),
    [lineItems, watchedInvoiceDiscount, values.invoiceDiscount]
  )
  const totals = summary
  const summarizedLines = summary.lines || []

  const getLineTotal = (index) => {
    const calc = summarizedLines[index]
    if (calc && typeof calc.lineTotalWithTax === 'number' && calc.lineTotalWithTax > 0) {
      return calc.lineTotalWithTax
    }
    const line = lineItems[index] || {}
    const q = toNumber(line.quantity, 1)
    const p = toNumber(line.unitPrice, 0)
    const tax = toNumber(line.taxRate, 15)
    const sub = q * p
    return Math.round((sub + (sub * tax / 100)) * 100) / 100
  }

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [pendingPayload, setPendingPayload] = useState(null)

  const buildPayload = (data) => {
    const namedLines = (data.lineItems || []).filter((line) => String(line?.productName || '').trim() || toNumber(line?.unitPrice, 0) > 0)
    if (!namedLines.length) {
      toast.error(language === 'ar' ? 'أضف بنداً واحداً على الأقل قبل الحفظ' : 'Add at least one line item before saving')
      return null
    }
    const computedTotals = calculateInvoiceSummary({
      lineItems: namedLines,
      invoiceDiscount: toNumber(data.invoiceDiscount, 0),
    })
    const sellerName = String(data.seller?.name || data.seller?.nameAr || '').trim() || (language === 'ar' ? 'مورد نقدي' : 'Cash Supplier')
    const payload = {
      ...data,
      flow: 'purchase',
      businessContext,
      invoiceSubtype,
      pdfTemplateId: selectedTemplateId,
      transactionType,
      invoiceTypeCode: transactionType === 'B2C' ? '0200000' : '0100000',
      status: 'approved',
      issueDate: isEdit ? (initialInvoice?.issueDate || new Date()) : new Date(),
      seller: {
        ...(data.seller || {}),
        name: sellerName,
      },
      lineItems: namedLines.map((line, index) => {
        const calc = computedTotals.lines[index] || {}
        return {
          ...line,
          lineNumber: index + 1,
          taxCategory: 'S',
          productId: isTradingContext ? line.productId || undefined : undefined,
          productType: normalizeProductType(line.productType),
          lineTotal: calc.lineTotal,
          taxAmount: calc.taxAmount,
          lineTotalWithTax: calc.lineTotalWithTax,
        }
      }),
      invoiceDiscount: toNumber(data.invoiceDiscount, 0),
      subtotal: computedTotals.subtotal,
      totalTax: computedTotals.totalTax,
      grandTotal: computedTotals.grandTotal,
    }
    applyFormPaymentToPayload(payload, {
      paymentStatus: data?.paymentStatus,
      paidAmount: data?.paidAmount,
      grandTotal: computedTotals.grandTotal,
    })

    if (!isTradingContext) {
      delete payload.warehouseId
      delete payload.supplierId
      delete payload.sourcePurchaseOrderId
    } else {
      if (!payload.warehouseId) delete payload.warehouseId
      if (!payload.supplierId) delete payload.supplierId
      payload.sourcePurchaseOrderId = selectedPoId || data.sourcePurchaseOrderId || undefined
      if (!payload.sourcePurchaseOrderId) delete payload.sourcePurchaseOrderId
    }
    if (invoiceSubtype !== 'travel_ticket') delete payload.travelDetails
    payload.showAuthorizedPerson = Boolean(showAuthorizedPerson)
    payload.hasAuthorizedPerson = Boolean(showAuthorizedPerson)
    payload.authorizedPersonName = showAuthorizedPerson ? (data?.authorizedPersonName || '') : ''
    payload.authorizedPersonNameAr = showAuthorizedPerson ? (data?.authorizedPersonNameAr || '') : ''
    payload.authorizedPersonDesignation = showAuthorizedPerson ? (data?.authorizedPersonDesignation || '') : ''
    payload.authorizedPersonDesignationAr = showAuthorizedPerson ? (data?.authorizedPersonDesignationAr || '') : ''
    payload.authorizedPersonSignature = showAuthorizedPerson ? (data?.authorizedPersonSignature || '') : ''
    payload.stampImage = showAuthorizedPerson ? (data?.stampImage || '') : ''
    payload.termsAndConditions = showTermsPanel ? (data?.termsAndConditions || '') : ''
    payload.notes = showNotesPanel ? (data?.notes || '') : ''
    payload.includeBankDetails = Boolean(showBankPanel)
    payload.bankDetails = showBankPanel
      ? {
          bankName: data?.bankDetails?.bankName || '',
          accountName: data?.bankDetails?.accountName || '',
          accountNumber: data?.bankDetails?.accountNumber || '',
          iban: data?.bankDetails?.iban || '',
        }
      : { bankName: '', accountName: '', accountNumber: '', iban: '' }
    return payload
  }

  const onSubmit = (data) => {
    const payload = buildPayload(data)
    if (!payload) return
    setPendingPayload(payload)
    setShowPreviewModal(true)
  }

  const handleConfirmSave = () => {
    const payload = pendingPayload || buildPayload(getValues())
    if (!payload) return
    saveMutation.mutate(payload)
  }

  const previewInvoice = {
    ...values,
    showAuthorizedPerson: Boolean(showAuthorizedPerson),
    hasAuthorizedPerson: Boolean(showAuthorizedPerson),
    authorizedPersonName: showAuthorizedPerson ? (values?.authorizedPersonName || '') : '',
    authorizedPersonNameAr: showAuthorizedPerson ? (values?.authorizedPersonNameAr || '') : '',
    authorizedPersonDesignation: showAuthorizedPerson ? (values?.authorizedPersonDesignation || '') : '',
    authorizedPersonDesignationAr: showAuthorizedPerson ? (values?.authorizedPersonDesignationAr || '') : '',
    authorizedPersonSignature: showAuthorizedPerson ? (values?.authorizedPersonSignature || '') : '',
    stampImage: showAuthorizedPerson ? (values?.stampImage || '') : '',
    termsAndConditions: showTermsPanel ? (values?.termsAndConditions || '') : '',
    notes: showNotesPanel ? (values?.notes || '') : '',
    includeBankDetails: Boolean(showBankPanel),
    bankDetails: showBankPanel
      ? {
          bankName: values?.bankDetails?.bankName || '',
          accountName: values?.bankDetails?.accountName || '',
          accountNumber: values?.bankDetails?.accountNumber || '',
          iban: values?.bankDetails?.iban || '',
        }
      : { bankName: '', accountName: '', accountNumber: '', iban: '' },
    invoiceNumber: initialInvoice?.invoiceNumber || 'DRAFT-PURCHASE',
    issueDate: initialInvoice?.issueDate || new Date(),
    createdByName: initialInvoice?.createdByName || [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    createdByNameAr: initialInvoice?.createdByNameAr || [user?.firstNameAr, user?.lastNameAr].filter(Boolean).join(' '),
    createdBy: initialInvoice?.createdBy || user,
    flow: 'purchase',
    transactionType,
    invoiceSubtype,
    pdfTemplateId: selectedTemplateId,
    subtotal: totals.subtotal,
    totalTax: totals.totalTax,
    grandTotal: totals.grandTotal,
    invoiceDiscount: totals.invoiceDiscount,
    totalDiscount: totals.totalDiscount,
    taxableAmount: totals.taxableAmount,
    buyer: {
      name: tenant?.business?.legalNameEn,
      nameAr: tenant?.business?.legalNameAr,
      vatNumber: tenant?.business?.vatNumber,
      address: tenant?.business?.address,
    },
    lineItems: (values.lineItems || []).map((line, index) => {
      const calc = summarizedLines[index] || {}
      return {
        ...line,
        lineNumber: index + 1,
        lineTotal: calc.lineTotal,
        taxAmount: calc.taxAmount,
        lineTotalWithTax: calc.lineTotalWithTax,
      }
    }),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(isEdit ? `/app/dashboard/invoices/${invoiceId}` : '/app/dashboard/invoices/new')} className="btn btn-ghost btn-icon"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isEdit ? (language === 'ar' ? 'تعديل فاتورة الشراء' : 'Edit Purchase Invoice') : (language === 'ar' ? 'فاتورة شراء جديدة' : 'New Purchase Invoice')}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{isEdit ? (language === 'ar' ? 'حدّث بيانات الفاتورة قبل حفظ التعديلات' : 'Update the invoice details before saving your changes') : (language === 'ar' ? 'تدعم الشراء التجاري والخدمي وفواتير السفر' : 'Supports trading, service, and travel purchase invoices')}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'سياق الشراء' : 'Purchase Context'}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {tenantBusinessTypes.filter((type) => purchaseContexts.includes(type)).map((type) => (
                <button key={type} type="button" onClick={() => setValue('businessContext', type)} className={`rounded-2xl border p-4 text-start ${businessContext === type ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}>
                  <p className="font-semibold text-gray-900 dark:text-white">{type === 'trading' ? (language === 'ar' ? 'تجارة' : 'Trading') : type === 'construction' ? (language === 'ar' ? 'مقاولات' : 'Construction') : (language === 'ar' ? 'سفر' : 'Travel Agency')}</p>
                </button>
              ))}
            </div>
            <input type="hidden" {...register('businessContext')} />
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'الإعدادات الأساسية' : 'Basic Settings'}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="label">{language === 'ar' ? 'النوع' : 'Type'}</label>
                <select value={transactionType} onChange={(e) => { setTransactionType(e.target.value); setValue('transactionType', e.target.value) }} className="select">
                  <option value="B2B">{t('b2bInvoice')}</option>
                  <option value="B2C">{t('b2cInvoice')}</option>
                </select>
              </div>
              {isTradingContext && (
                <>
                  <div>
                    <label className="label">{language === 'ar' ? 'طلب الشراء' : 'Purchase order'}</label>
                    <select
                      value={selectedPoId}
                      onChange={(e) => {
                        const next = e.target.value
                        setSelectedPoId(next)
                        setValue('sourcePurchaseOrderId', next)
                        filledPoIdRef.current = ''
                        shouldFillFromPoRef.current = Boolean(next)
                        if (!next) replace([emptyLine])
                      }}
                      className="select"
                    >
                      <option value="">{language === 'ar' ? 'اختر طلب شراء لتعبئة الفاتورة' : 'Select a purchase order to fill the invoice'}</option>
                      {(Array.isArray(purchaseOrders) ? purchaseOrders : []).map((po) => (
                        <option key={po._id} value={po._id}>
                          {po.poNumber} — {language === 'ar' ? (po.supplierId?.nameAr || po.supplierId?.nameEn || '') : (po.supplierId?.nameEn || po.supplierId?.nameAr || '')}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" {...register('sourcePurchaseOrderId')} />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
                    <select {...register('warehouseId')} className="select"><option value="">{language === 'ar' ? 'بدون تحديد حالياً' : 'No warehouse selected yet'}</option>{(Array.isArray(warehouses) ? warehouses : warehouses?.warehouses || []).map((item) => <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.nameEn) : item.nameEn}</option>)}</select>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn btn-secondary" onClick={() => setValue('warehouseId', '')} disabled={!selectedWarehouseId}>{language === 'ar' ? 'إلغاء التحديد' : 'Clear'}</button>
                      <button type="button" className="btn btn-action-dark" onClick={() => navigate(`/app/dashboard/warehouses/new?returnTo=${encodeURIComponent('/app/dashboard/invoices/new/purchase')}`)}>{language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}</button>
                    </div>
                  </div>
                  <div>
                    <label className="label flex items-baseline justify-between gap-2">
                      <span>{language === 'ar' ? 'المورد' : 'Supplier'}</span>
                      <span className="text-xs font-normal text-gray-500">({language === 'ar' ? 'اختياري' : 'Optional'})</span>
                    </label>
                    <select {...register('supplierId', { onChange: (e) => onSelectSupplier(e.target.value) })} className="select">
                      <option value="">{language === 'ar' ? 'اختر مورد (اختياري)' : 'Select supplier (Optional)'}</option>
                      {(suppliers || []).map((item) => <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.nameEn) : item.nameEn}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            {isTradingContext && selectedPo?._id ? (
              <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="grid flex-1 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'تاريخ الاستلام المتوقع' : 'Estimated receive date'}</p>
                      <p className="mt-1 text-[13px] font-medium text-slate-900 dark:text-white">{formatDay(selectedPo.expectedDate, language)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'الاستلام الجزئي' : 'Partial received'}</p>
                      <p className="mt-1 text-[13px] font-medium text-slate-900 dark:text-white">
                        {selectedPo.status === 'partially_received' || Number(selectedPo.receivingLedger?.receivedCount || 0) > 0
                          ? (language === 'ar' ? 'نعم' : 'Yes')
                          : (language === 'ar' ? 'لا' : 'No')}
                        {selectedPo.receivingLedger ? ` · ${selectedPo.receivingLedger.receivedCount || 0}/${(selectedPo.receivingLedger.lines || []).length}` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'تواريخ التأخير' : 'Delayed receive dates'}</p>
                      <p className="mt-1 text-[13px] font-medium text-slate-900 dark:text-white">
                        {(() => {
                          const dates = (selectedPo.receivingLedger?.lines || [])
                            .flatMap((line) => (line.delayedEvents || []).map((event) => event.delayedUntil))
                            .filter(Boolean)
                          if (!dates.length) return '—'
                          return [...new Set(dates.map((value) => formatDay(value, language)))].join(' · ')
                        })()}
                      </p>
                    </div>
                  </div>
                  {isFutureDate(selectedPo.expectedDate) ? (
                    <Link
                      to={`${PURCHASES_PATH.grn}/new?poId=${selectedPo._id}&early=1`}
                      className={primaryBtn.replace('px-4 py-2.5', 'px-3.5 py-2 text-[12px]')}
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'استلام قبل التاريخ المتوقع' : 'Receive before estimated date'}
                    </Link>
                  ) : (
                    <Link
                      to={`${PURCHASES_PATH.grn}/new?poId=${selectedPo._id}`}
                      className={ghostBtn.replace('px-3.5 py-2.5', 'px-3.5 py-2 text-[12px]')}
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'استلام' : 'Receive'}
                    </Link>
                  )}
                </div>
                <div className="mt-4">
                  <PurchaseReceivingLedger order={selectedPo} language={language} />
                </div>
              </div>
            ) : null}
            {isTravelContext && (
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <button type="button" onClick={() => setValue('invoiceSubtype', 'travel_ticket')} className={`rounded-2xl border p-4 text-start ${invoiceSubtype === 'travel_ticket' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}><p className="font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'فاتورة سفر / تذاكر' : 'Travel / Ticket Invoice'}</p></button>
                <button type="button" onClick={() => setValue('invoiceSubtype', 'standard')} className={`rounded-2xl border p-4 text-start ${invoiceSubtype === 'standard' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}><p className="font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'فاتورة قياسية' : 'Standard Invoice'}</p></button>
              </div>
            )}
            <input type="hidden" {...register('invoiceSubtype')} />
          </div>

          <input type="hidden" {...register('pdfTemplateId')} />

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'بيانات المورد / البائع' : 'Vendor / Seller Details'}</h3>
            {invoiceSubtype === 'travel_ticket' ? (
              <TravelInvoiceFields language={language} register={register} control={control} watch={watch} setValue={setValue} partyPrefix="seller" partyNameLabel={language === 'ar' ? 'اسم المورد / الجهة' : 'Vendor / Supplier Name'} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2" dir="ltr">
                <div>
                  <FieldLabel en="Name / Company" ar="الاسم / الشركة" />
                  <input {...register('seller.name')} className="input" placeholder={language === 'ar' ? 'اسم المورد أو الشركة' : 'Supplier or vendor name'} />
                </div>
                {showArabicFields ? (
                  <div>
                    <FieldLabel en="Name (Arabic)" ar="الاسم بالعربية" />
                    <input {...register('seller.nameAr')} className="input" dir="rtl" />
                  </div>
                ) : (
                  <input type="hidden" {...register('seller.nameAr')} />
                )}
                <div>
                  <FieldLabel en={isPk ? "NTN / STRN" : "VAT Number"} ar="الرقم الضريبي" />
                  <input {...register('seller.vatNumber')} className="input" />
                </div>
                <div>
                  <FieldLabel en="CR Number" ar="السجل التجاري" />
                  <input {...register('seller.crNumber')} className="input" />
                </div>
                <div>
                  <FieldLabel en="Phone Number" ar="رقم الهاتف" />
                  <input {...register('seller.contactPhone')} className="input" />
                </div>
                <div>
                  <FieldLabel en="Email" ar="البريد الإلكتروني" />
                  <input type="email" {...register('seller.contactEmail')} className="input" />
                </div>
                <div>
                  <FieldLabel en="City" ar="المدينة" />
                  <input {...register('seller.address.city')} className="input" />
                </div>
                {showArabicFields ? (
                  <div>
                    <FieldLabel en="City (Arabic)" ar="المدينة بالعربية" />
                    <input {...register('seller.address.cityAr')} className="input" dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <FieldLabel en="District" ar="الحي" />
                  <input {...register('seller.address.district')} className="input" />
                </div>
                {showArabicFields ? (
                  <div>
                    <FieldLabel en="District (Arabic)" ar="الحي بالعربية" />
                    <input {...register('seller.address.districtAr')} className="input" dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <FieldLabel en="Street" ar="الشارع" />
                  <input {...register('seller.address.street')} className="input" />
                </div>
                {showArabicFields ? (
                  <div>
                    <FieldLabel en="Street (Arabic)" ar="الشارع بالعربية" />
                    <input {...register('seller.address.streetAr')} className="input" dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <FieldLabel en="Postal Code" ar="الرمز البريدي" />
                  <input {...register('seller.address.postalCode')} className="input" />
                </div>
                <div>
                  <FieldLabel en="Country" ar="الدولة" />
                  <input {...register('seller.address.country')} className="input" placeholder={getTenantCountryCode(tenant)} />
                </div>
                <div>
                  <FieldLabel en="Building Number" ar="رقم المبنى" />
                  <input {...register('seller.address.buildingNumber')} className="input" />
                </div>
                <div>
                  <FieldLabel en="Additional Number" ar="الرقم الإضافي" />
                  <input {...register('seller.address.additionalNumber')} className="input" />
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'بنود الفاتورة' : 'Line Items'}</h3><button type="button" onClick={() => append(getEmptyLine(tenant))} className="btn btn-secondary"><Plus className="w-4 h-4" />{t('add')}</button></div>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <motion.div key={field.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-gray-50 p-4 dark:bg-dark-700">
                  <LineItemTranslator index={index} control={control} watch={watch} setValue={setValue} />
                  <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                  <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12" dir="ltr">
                    <div className={showArabicFields ? 'md:col-span-3' : 'md:col-span-4'}>
                      <div className="mb-1.5 flex items-center gap-2" dir="ltr">
                        <label htmlFor={`product-select-${index}`} className="label !mb-0 min-w-0 flex-1">
                          <span>Product Name *</span>
                          <span className="ms-1.5 font-medium text-gray-500" dir="rtl">اسم المنتج</span>
                        </label>
                        <ProductTypeToggle
                          value={watch(`lineItems.${index}.productType`)}
                          onChange={(next) => setValue(`lineItems.${index}.productType`, next, { shouldDirty: true, shouldTouch: true })}
                          language={language}
                        />
                      </div>
                      {isTradingContext ? (
                        <div className="mb-2">
                          <CreatableSelect
                            inputId={`product-select-${index}`}
                            name={`react-select-product-${index}`}
                            options={(products || []).map(p => ({ value: p._id, label: productPickerLabel(p, language) }))}
                            value={((products || []).find(p => p._id === watch(`lineItems.${index}.productId`))) ? { value: watch(`lineItems.${index}.productId`), label: productPickerLabel((products || []).find(p => p._id === watch(`lineItems.${index}.productId`)), language) } : null}
                            onChange={(selected) => {
                              if (selected) {
                                if (selected.__isNew__) {
                                  setValue(`lineItems.${index}.productId`, '')
                                  setValue(`lineItems.${index}.productName`, selected.value)
                                  setValue(`lineItems.${index}.productType`, 'goods')
                                } else {
                                  onSelectProduct(index, selected.value)
                                }
                              } else {
                                setValue(`lineItems.${index}.productId`, '')
                                setValue(`lineItems.${index}.productName`, '')
                                setValue(`lineItems.${index}.productType`, 'goods')
                              }
                            }}
                            formatCreateLabel={(inputValue) => language === 'ar' ? `إضافة "${inputValue}" كمنتج جديد` : `Add "${inputValue}" as new product`}
                            placeholder={t('selectProduct')}
                            isClearable
                            isSearchable
                            styles={{
                              control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e5e7eb', padding: '0.125rem' })
                            }}
                          />
                          <input type="hidden" {...register(`lineItems.${index}.productId`)} />
                          <input {...register(`lineItems.${index}.productName`, { required: true })} className="input mt-2" readOnly={Boolean(lineItems?.[index]?.productId)} placeholder={language === 'ar' ? 'اسم المنتج أو الخدمة' : 'Product or service name'} />
                        </div>
                      ) : (
                        <input id={`product-select-${index}`} {...register(`lineItems.${index}.productName`, { required: true })} className="input" placeholder={language === 'ar' ? 'اسم الخدمة' : 'Service name'} />
                      )}
                    </div>
                    {showArabicFields ? (
                      <div className="md:col-span-3">
                        <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                          <span>Arabic name</span>
                          <span dir="rtl" className="font-medium text-gray-500">اسم البند بالعربية</span>
                        </label>
                        <input {...register(`lineItems.${index}.productNameAr`)} className="input" dir="rtl" placeholder="اسم المنتج أو الخدمة" />
                      </div>
                    ) : (
                      <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                    )}
                    <div className="md:col-span-2">
                      <label htmlFor={`unit-${index}`} className="label">{language === 'ar' ? 'الوحدة (اختياري)' : 'UOM (Optional)'}</label>
                      <Select
                        className="react-select-container"
                        classNamePrefix="react-select"
                        isClearable
                        isSearchable
                        placeholder={language === 'ar' ? 'بدون وحدة' : 'None (Optional)'}
                        value={
                          watch(`lineItems.${index}.unitCode`)
                            ? {
                                value: watch(`lineItems.${index}.unitCode`),
                                label: getUomLabel(watch(`lineItems.${index}.unitCode`), language)
                              }
                            : null
                        }
                        onChange={(option) => setValue(`lineItems.${index}.unitCode`, option ? option.value : '', { shouldValidate: true })}
                        options={[
                          { value: '', label: language === 'ar' ? 'بدون وحدة (اختياري)' : 'None (Optional)' },
                          ...getAvailableUomOptions(tenant).map((uom) => ({
                            value: uom.code,
                            label: language === 'ar' ? uom.labelAr : uom.labelEn
                          }))
                        ]}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label htmlFor={`qty-${index}`} className="label">{t('quantity')}</label>
                      <input id={`qty-${index}`} type="number" min="0.0001" step="any" {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0.0001 })} className="input" />
                    </div>
                    <div className="md:col-span-2"><label htmlFor={`price-${index}`} className="label">{t('unitPrice')}</label><input id={`price-${index}`} type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })} className="input" /></div>
                    <div className="md:col-span-2"><label className="label">{t('tax')} %</label><select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className="select"><option value={15}>15%</option><option value={0}>0%</option></select></div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <div className="flex-1 text-end">
                        <p className="mb-1 text-xs text-gray-500">{t('total')}</p>
                        <p className="font-bold text-gray-900 dark:text-white">
                          <Money value={getLineTotal(index)} />
                        </p>
                      </div>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                {language === 'ar' ? 'معلومات إضافية' : 'Additional Information'}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {[
                  {
                    id: 'signature',
                    active: showAuthorizedPerson,
                    labelEn: '+ Add Signature',
                    labelAr: '+ إضافة توقيع',
                    onClick: () => handleToggleAuthorizedPerson(!showAuthorizedPerson),
                  },
                  {
                    id: 'terms',
                    active: showTermsPanel,
                    labelEn: '+ Add Terms & Conditions',
                    labelAr: '+ إضافة الشروط والأحكام',
                    onClick: () => handleToggleTerms(!showTermsPanel),
                  },
                  {
                    id: 'notes',
                    active: showNotesPanel,
                    labelEn: '+ Add Notes',
                    labelAr: '+ إضافة ملاحظات',
                    onClick: () => handleToggleNotes(!showNotesPanel),
                  },
                  {
                    id: 'bank',
                    active: showBankPanel,
                    labelEn: '+ Add Bank Details',
                    labelAr: '+ إضافة بيانات البنك',
                    onClick: () => handleToggleBankDetails(!showBankPanel),
                  },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={pill.onClick}
                    className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                      pill.active
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                        : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500 dark:border-dark-500 dark:bg-dark-800 dark:text-slate-100'
                    }`}
                  >
                    {language === 'ar' ? pill.labelAr : pill.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {showAuthorizedPerson && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-slate-200 pt-5 dark:border-dark-600"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {language === 'ar' ? 'الموثّق / المفوّض والختم' : 'Authorized Person & Stamp'}
                    </h4>
                    <button type="button" onClick={() => handleToggleAuthorizedPerson(false)} className="text-xs font-semibold text-slate-500 hover:text-red-600">
                      {language === 'ar' ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">{language === 'ar' ? 'الاسم' : 'Name'}</label>
                      <input {...register('authorizedPersonName')} className="input mt-1.5" placeholder={language === 'ar' ? 'مثال: Arthur Michael' : 'e.g. Arthur Michael'} />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                      <input {...register('authorizedPersonNameAr')} className="input mt-1.5" dir="rtl" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'المسمى الوظيفي' : 'Designation'}</label>
                      <input {...register('authorizedPersonDesignation')} className="input mt-1.5" placeholder={language === 'ar' ? 'مثال: Coordinator' : 'e.g. Coordinator'} />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'المسمى الوظيفي بالعربية' : 'Arabic Designation'}</label>
                      <input {...register('authorizedPersonDesignationAr')} className="input mt-1.5" dir="rtl" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'التوقيع' : 'Signature'}</label>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input type="file" accept="image/*" className="hidden" id="purchase-signature-upload" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 2MB' : 'Image must be less than 2MB')
                            return
                          }
                          const reader = new FileReader()
                          reader.onload = () => setValue('authorizedPersonSignature', String(reader.result || ''))
                          reader.readAsDataURL(file)
                        }} />
                        <label htmlFor="purchase-signature-upload" className="btn btn-secondary cursor-pointer">
                          <UploadCloud className="w-4 h-4" />
                          {language === 'ar' ? 'رفع توقيع' : 'Upload Signature'}
                        </label>
                        {values?.authorizedPersonSignature ? (
                          <div className="relative">
                            <img src={values.authorizedPersonSignature} alt="Signature" className="h-16 max-w-[200px] object-contain border rounded-lg p-1 bg-white" />
                            <button type="button" onClick={() => setValue('authorizedPersonSignature', '')} className="absolute -top-2 -end-2 p-1 bg-red-100 text-red-600 rounded-full">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">{language === 'ar' ? 'لم يتم رفع توقيع' : 'No signature uploaded'}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{language === 'ar' ? 'يجب أن تكون صورة التوقيع بخلفية شفافة أو بيضاء.' : 'Signature image should have a transparent or white background.'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'الختم' : 'Stamp'}</label>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input type="file" accept="image/*" className="hidden" id="purchase-stamp-upload" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 2MB' : 'Image must be less than 2MB')
                            return
                          }
                          const reader = new FileReader()
                          reader.onload = () => setValue('stampImage', String(reader.result || ''))
                          reader.readAsDataURL(file)
                        }} />
                        <label htmlFor="purchase-stamp-upload" className="btn btn-secondary cursor-pointer">
                          <UploadCloud className="w-4 h-4" />
                          {language === 'ar' ? 'رفع ختم' : 'Upload Stamp'}
                        </label>
                        {values?.stampImage ? (
                          <div className="relative">
                            <img src={values.stampImage} alt="Stamp" className="h-16 max-w-[200px] object-contain border rounded-lg p-1 bg-white" />
                            <button type="button" onClick={() => setValue('stampImage', '')} className="absolute -top-2 -end-2 p-1 bg-red-100 text-red-600 rounded-full">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">{language === 'ar' ? 'لم يتم رفع ختم' : 'No stamp uploaded'}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{language === 'ar' ? 'يجب أن يكون الختم بخلفية شفافة.' : 'Stamp image should have a transparent background.'}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showTermsPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-t border-slate-200 pt-5 dark:border-dark-600"
                >
                  <RichTextNoteField
                    label={language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
                    value={watch('termsAndConditions')}
                    onChange={(val) => setValue('termsAndConditions', val, { shouldDirty: true })}
                    onRemove={() => handleToggleTerms(false)}
                    placeholder={language === 'ar' ? 'أدخل الشروط والأحكام... حدد النص واضغط على عريض أو تمييز' : 'Enter terms and conditions... select text and click Bold or Highlight'}
                    rows={5}
                    language={language}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showNotesPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-t border-slate-200 pt-5 dark:border-dark-600"
                >
                  <RichTextNoteField
                    label={language === 'ar' ? 'ملاحظات' : 'Notes'}
                    value={watch('notes')}
                    onChange={(val) => setValue('notes', val, { shouldDirty: true })}
                    onRemove={() => handleToggleNotes(false)}
                    placeholder={language === 'ar' ? 'أدخل ملاحظات إضافية...' : 'Enter additional notes...'}
                    rows={4}
                    language={language}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showBankPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-t border-slate-200 pt-5 dark:border-dark-600"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <label className="label font-semibold">{language === 'ar' ? 'بيانات البنك' : 'Bank Details'}</label>
                    <button type="button" onClick={() => handleToggleBankDetails(false)} className="text-xs font-semibold text-slate-500 hover:text-red-600">
                      {language === 'ar' ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                    {language === 'ar'
                      ? 'تُؤخذ تلقائياً من ملف الشركة ويمكن تعديلها لهذه الفاتورة فقط.'
                      : 'Prefills from your company profile. You can edit values for this document only.'}
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2" dir="ltr">
                    <div>
                      <FieldLabel en="Bank Name" ar="اسم البنك" />
                      <input {...register('bankDetails.bankName')} className="input mt-1.5" placeholder={showArabicFields ? "Al Rajhi Bank / SNB" : "Habib Bank / Standard Chartered"} />
                    </div>
                    <div>
                      <FieldLabel en="Account Name" ar="اسم الحساب" />
                      <input {...register('bankDetails.accountName')} className="input mt-1.5" />
                    </div>
                    <div>
                      <FieldLabel en="Account Number" ar="رقم الحساب" />
                      <input {...register('bankDetails.accountNumber')} className="input mt-1.5 font-mono" />
                    </div>
                    <div>
                      <FieldLabel en={showArabicFields ? "IBAN" : "IBAN / Swift"} ar="الآيبان" />
                      <input {...register('bankDetails.iban')} className="input mt-1.5 font-mono" placeholder={showArabicFields ? "SA0000000000000000000000" : "PK00XXXX0000000000000000"} />
                    </div>
                  </div>
                  <input type="hidden" {...register('includeBankDetails')} />
                </motion.div>
              )}
            </AnimatePresence>
            {!showNotesPanel && <input type="hidden" {...register('notes')} />}
            {!showTermsPanel && <input type="hidden" {...register('termsAndConditions')} />}
            {!showBankPanel && (
              <>
                <input type="hidden" {...register('includeBankDetails')} />
                <input type="hidden" {...register('bankDetails.bankName')} />
                <input type="hidden" {...register('bankDetails.accountName')} />
                <input type="hidden" {...register('bankDetails.accountNumber')} />
                <input type="hidden" {...register('bankDetails.iban')} />
              </>
            )}
          </div>

          <div className="card p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3 md:w-80">
                <div>
                  <label className="label">{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</label>
                  <select {...register('paymentMethod')} className="select">
                    <option value="cash">{language === 'ar' ? 'نقداً' : 'Cash'}</option>
                    <option value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</option>
                    <option value="bank_transfer">{language === 'ar' ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                    <option value="credit">{language === 'ar' ? 'آجل / ذمم' : 'Credit / Split'}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'مدفوعة / غير مدفوعة' : 'Paid / Unpaid'}</label>
                  <select
                    {...register('paymentStatus')}
                    className="select"
                    onChange={(e) => {
                      const status = e.target.value
                      setValue('paymentStatus', status, { shouldDirty: true })
                      if (status === 'paid') {
                        setValue('paidAmount', totals.grandTotal, { shouldDirty: true })
                      } else {
                        const currentPaid = Number(getValues('paidAmount') || 0)
                        if (currentPaid >= totals.grandTotal) setValue('paidAmount', 0, { shouldDirty: true })
                      }
                    }}
                  >
                    <option value="paid">{language === 'ar' ? 'مدفوعة' : 'Paid'}</option>
                    <option value="pending">{language === 'ar' ? 'غير مدفوعة' : 'Unpaid'}</option>
                  </select>
                </div>
                {watch('paymentMethod') === 'credit' && watch('paymentStatus') !== 'paid' && (
                  <div>
                    <label className="label text-primary-600 font-semibold">{language === 'ar' ? 'المبلغ المدفوع (مقدم)' : 'Paid Amount (Advance)'}</label>
                    <input type="number" min="0" max={totals.grandTotal} step="0.01" {...register('paidAmount', { valueAsNumber: true, min: 0 })} className="input border-primary-300" placeholder="0.00" />
                  </div>
                )}
                <div>
                  <label className="label">{language === 'ar' ? 'خصم الفاتورة' : 'Invoice Discount'}</label>
                  <input type="number" min="0" step="0.01" {...register('invoiceDiscount', { valueAsNumber: true, min: 0 })} className="input" />
                </div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">{t('subtotal')}</span><span><Money value={totals.subtotal} /></span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">{t('discount')}</span><span><Money value={totals.totalDiscount} /></span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">{language === 'ar' ? 'المبلغ الخاضع للضريبة' : 'Taxable Amount'}</span><span><Money value={totals.taxableAmount} /></span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">{t('tax')}</span><span><Money value={totals.totalTax} /></span></div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold dark:border-dark-600"><span>{t('total')}</span><span className="text-primary-600"><Money value={totals.grandTotal} /></span></div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => navigate(isEdit ? `/app/dashboard/invoices/${invoiceId}` : '/app/dashboard/invoices/new')} className="btn btn-secondary">{t('cancel')}</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn btn-action-dark shadow-lg">
                  {saveMutation.isPending ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      {isEdit ? (language === 'ar' ? 'معاينة وتعديل الفاتورة' : 'Preview & Update Invoice') : (language === 'ar' ? 'معاينة وحفظ الفاتورة' : 'Preview & Save Invoice')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-4"><h3 className="text-base font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'المعاينة المباشرة' : 'Live Preview'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تعرض المعاينة شكل الطباعة النهائي تقريباً.' : 'The preview closely reflects the final printed layout.'}</p></div>
          <InvoiceLivePreview invoice={previewInvoice} tenant={tenant} language={language} templateId={selectedTemplateId} bilingual={previewInvoice?.invoiceSubtype === 'travel_ticket' || ['travel_agency', 'trading', 'construction'].includes(previewInvoice?.businessContext)} />
        </div>
      </div>

      <DocumentPreSaveModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmSave}
        isPending={saveMutation.isPending}
        document={previewInvoice}
        tenant={tenant}
        language={language}
        documentType="purchase_invoice"
        templateId={selectedTemplateId}
        title={language === 'ar' ? 'معاينة فاتورة الشراء قبل الحفظ' : 'Purchase Invoice Live Preview'}
      />
    </div>
  )
}

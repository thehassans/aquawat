import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Save, Trash2, UploadCloud, FileText, Receipt, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../ui/Money'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage, isGccArabicMarket } from '../../lib/invoiceLanguage'
import { useLiveTranslation, useBilingualAddressFields, LineItemTranslator } from '../../lib/liveTranslation'
import { INVOICE_PAYMENT_TERMS, computeDueDateFromPaymentTerms, isImmediatePaymentTerm, formPaymentStatusFromInvoice, applyFormPaymentToPayload } from '../../lib/invoicePaymentTerms'
import InvoiceLivePreview from './InvoiceLivePreview'
import DocumentPreSaveModal from './DocumentPreSaveModal'
import InvoiceTemplateSelector from './InvoiceTemplateSelector'
import TravelInvoiceFields from './TravelInvoiceFields'
import ThermalReceipt from '../ui/ThermalReceipt'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { getAvailableUomOptions, getDefaultUom, getUomLabel } from '../../lib/uomOptions'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { normalizeProductType, productPickerLabel } from '../../lib/productType'
import ProductTypeToggle from '../ui/ProductTypeToggle'
import RichTextNoteField from './RichTextNoteField'

const getEmptyLine = (tenant) => ({
  productId: '',
  productName: '',
  productNameAr: '',
  productType: 'goods',
  unitCode: getDefaultUom(tenant) || '',
  quantity: 1,
  unitPrice: '',
  customerPrice: '',
  taxRate: 15,
  agencyPrice: '',
  isTravelMargin: false,
})

const idOf = (value) => {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || value.id || '')
  return String(value)
}

const emptyBuyerAddress = {
  street: '', streetAr: '', district: '', districtAr: '', city: '', cityAr: '',
  postalCode: '', country: 'SA', buildingNumber: '', additionalNumber: '',
}

const mapSellLineItems = (invoice, tenant) => {
  const empty = getEmptyLine(tenant)
  const source = invoice?.lineItems || invoice?.items || invoice?.lines || []
  const raw = Array.isArray(source) ? source : []
  const mapped = raw.map((line) => {
    const plain = JSON.parse(JSON.stringify(line || {}))
    delete plain.id
    delete plain._id
    return {
      ...empty,
      ...plain,
      productId: idOf(plain?.productId),
      productName: plain?.productName || plain?.name || plain?.description || '',
      productNameAr: plain?.productNameAr || plain?.nameAr || '',
      unitCode: plain?.unitCode !== undefined ? (plain.unitCode || '') : empty.unitCode,
      quantity: Math.max(0.0001, toNumber(plain?.quantity, 1)),
      unitPrice: Math.max(0, toNumber(plain?.unitPrice ?? plain?.price, 0)),
      customerPrice: Math.max(0, toNumber(plain?.customerPrice, 0)),
      taxRate: Math.max(0, toNumber(plain?.taxRate, 15)),
      agencyPrice: Math.max(0, toNumber(plain?.agencyPrice, 0)),
      isTravelMargin: Boolean(plain?.isTravelMargin),
      productType: normalizeProductType(plain?.productType),
    }
  }).filter((line) => line.productName || line.unitPrice > 0 || line.productId)
  return mapped.length ? mapped : [{ ...empty }]
}
const selectableContexts = ['trading', 'construction', 'travel_agency', 'restaurant', 'manpower', 'furniture', 'furniture_shop']

/** High-contrast premium ERP form tokens */
const fieldLabelClass = 'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200'
const fieldControlClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-400'
const sectionCardClass = 'rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] sm:p-6 dark:border-dark-600 dark:bg-dark-800'
const sectionEyebrowClass = 'text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300'
const sectionTitleClass = 'mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white'
const bilingualPairGridClass = 'grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2'
/** Always EN left / AR right regardless of UI language */
const BilingualLabel = ({ en, ar, htmlFor, as = 'label' }) => {
  const Tag = as
  return (
    <Tag htmlFor={htmlFor} className={`${fieldLabelClass} !mb-1.5 !flex items-baseline justify-between gap-3`} dir="ltr">
      <span>{en}</span>
      <span className="font-medium text-slate-500 dark:text-slate-400" dir="rtl">{ar}</span>
    </Tag>
  )
}

const sanitizeTravelDetails = (travelDetails = {}) => ({
  passengerTitle: ['mr', 'mrs', 'ms'].includes(travelDetails?.passengerTitle) ? travelDetails.passengerTitle : 'mr',
  travelerName: String(travelDetails?.travelerName || '').trim(),
  passportNumber: String(travelDetails?.passportNumber || '').trim(),
  ticketNumber: String(travelDetails?.ticketNumber || '').trim(),
  pnr: String(travelDetails?.pnr || '').trim(),
  airlineName: String(travelDetails?.airlineName || '').trim(),
  routeFrom: String(travelDetails?.routeFrom || '').trim(),
  routeTo: String(travelDetails?.routeTo || '').trim(),
  segments: (Array.isArray(travelDetails?.segments) ? travelDetails.segments : [])
    .map((segment) => ({
      from: String(segment?.from || '').trim(),
      to: String(segment?.to || '').trim(),
    }))
    .filter((segment) => segment.from || segment.to),
  departureDate: travelDetails?.departureDate || '',
  hasReturnDate: Boolean(travelDetails?.hasReturnDate && travelDetails?.returnDate),
  returnDate: travelDetails?.hasReturnDate && travelDetails?.returnDate ? travelDetails.returnDate : '',
  layoverStay: String(travelDetails?.layoverStay || '').trim(),
  passengers: (Array.isArray(travelDetails?.passengers) ? travelDetails.passengers : [])
    .map((passenger) => ({
      title: ['mr', 'mrs', 'ms'].includes(passenger?.title) ? passenger.title : 'mr',
      name: String(passenger?.name || '').trim(),
      passportNumber: String(passenger?.passportNumber || '').trim(),
    }))
    .filter((passenger) => passenger.name || passenger.passportNumber),
})

const toDatetimeLocalInput = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

const buildSellInvoiceFormValues = ({ invoice, tenant, defaultBusinessContext, hasTravel }) => ({
  businessContext: invoice?.businessContext || defaultBusinessContext,
  invoiceSubtype: invoice?.invoiceSubtype || (hasTravel ? 'travel_ticket' : 'standard'),
  pdfTemplateId: invoice?.pdfTemplateId || getInvoiceTemplateId(tenant, invoice?.businessContext || defaultBusinessContext),
  issueDate: invoice?.issueDate ? toDatetimeLocalInput(invoice.issueDate) : '',
  transactionType: invoice?.transactionType || 'B2B',
  invoiceTypeCode: invoice?.invoiceTypeCode || (invoice?.transactionType === 'B2C' ? '0200000' : '0100000'),
  paymentMethod: invoice?.paymentMethod || 'cash',
  paidAmount: toNumber(invoice?.paidAmount, 0),
  paymentStatus: formPaymentStatusFromInvoice(invoice),
  customerId: invoice?.customerId || '',
  warehouseId: invoice?.warehouseId || '',
  restaurantOrderId: invoice?.restaurantOrderId || '',
  travelBookingId: invoice?.travelBookingId || '',
  manpowerAssignmentId: invoice?.manpowerAssignmentId || '',
  contractNumber: invoice?.contractNumber || '',
  notes: invoice?.notes || '',
  termsAndConditions: invoice?.termsAndConditions || '',
  includeBankDetails: Boolean(invoice?.includeBankDetails),
  bankDetails: {
    bankName: invoice?.bankDetails?.bankName || '',
    accountName: invoice?.bankDetails?.accountName || '',
    accountNumber: invoice?.bankDetails?.accountNumber || '',
    iban: invoice?.bankDetails?.iban || '',
  },
  invoiceDiscount: Math.max(0, toNumber(invoice?.invoiceDiscount, 0)),
  buyer: {
    name: invoice?.buyer?.name || '',
    nameAr: invoice?.buyer?.nameAr || '',
    vatNumber: invoice?.buyer?.vatNumber || '',
    crNumber: invoice?.buyer?.crNumber || '',
    contactPhone: invoice?.buyer?.contactPhone || '',
    contactEmail: invoice?.buyer?.contactEmail || '',
    address: {
      ...emptyBuyerAddress,
      ...(invoice?.buyer?.address || {}),
      street: invoice?.buyer?.address?.street || '',
      streetAr: invoice?.buyer?.address?.streetAr || '',
      district: invoice?.buyer?.address?.district || '',
      districtAr: invoice?.buyer?.address?.districtAr || '',
      city: invoice?.buyer?.address?.city || '',
      cityAr: invoice?.buyer?.address?.cityAr || '',
      postalCode: invoice?.buyer?.address?.postalCode || '',
      country: invoice?.buyer?.address?.country || 'SA',
      buildingNumber: invoice?.buyer?.address?.buildingNumber || '',
      additionalNumber: invoice?.buyer?.address?.additionalNumber || '',
    },
  },
  travelDetails: sanitizeTravelDetails(invoice?.travelDetails || { passengerTitle: 'mr', layoverStay: '', hasReturnDate: false, segments: [{ from: '', to: '' }], passengers: [] }),
  lineItems: mapSellLineItems(invoice, tenant),
  authorizedPersonName: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonName || '') : '',
  authorizedPersonNameAr: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonNameAr || '') : '',
  authorizedPersonDesignation: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonDesignation || '') : '',
  authorizedPersonDesignationAr: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonDesignationAr || '') : '',
  authorizedPersonSignature: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.authorizedPersonSignature || '') : '',
  stampImage: (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr || invoice?.authorizedPersonDesignation || invoice?.authorizedPersonSignature || invoice?.stampImage) ? (invoice?.stampImage || '') : '',
  paymentTerms: invoice?.paymentTerms || 'immediate',
  printFormat: invoice?.printFormat === 'thermal' ? 'thermal' : 'a4',
  dueDate: (() => {
    if (invoice?.dueDate) return toDatetimeLocalInput(invoice.dueDate).slice(0, 10)
    const issue = invoice?.issueDate ? new Date(invoice.issueDate) : new Date()
    const due = computeDueDateFromPaymentTerms(issue, invoice?.paymentTerms || 'immediate')
    return due ? due.toISOString().slice(0, 10) : ''
  })(),
})

export default function InvoiceSellComposer({ invoiceId = '', initialInvoice = null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const showArabicFields = isGccArabicMarket(tenant)
  const [invoiceType, setInvoiceType] = useState('B2B')
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const isEdit = Boolean(invoiceId)
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
  const [showNotesPanel, setShowNotesPanel] = useState(() => Boolean(String(initialInvoice?.notes || '').trim()))
  const [showTermsPanel, setShowTermsPanel] = useState(() => Boolean(String(initialInvoice?.termsAndConditions || '').trim()))
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
      if (!currentSignature && tenant?.settings?.invoiceBranding?.presetSignature) {
        setValue('authorizedPersonSignature', tenant.settings.invoiceBranding.presetSignature)
      }
      if (!currentStamp && tenant?.settings?.invoiceBranding?.presetStamp) {
        setValue('stampImage', tenant.settings.invoiceBranding.presetStamp)
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

  const defaultBusinessContext = useMemo(() => {
    const primary = getPrimaryBusinessType(tenant)
    if (selectableContexts.includes(primary)) return primary
    return tenantBusinessTypes.find((type) => selectableContexts.includes(type)) || 'trading'
  }, [tenant, tenantBusinessTypes])

  const { register, control, handleSubmit, watch, setValue, getValues, reset } = useForm({
    defaultValues: buildSellInvoiceFormValues({
      invoice: initialInvoice,
      tenant,
      defaultBusinessContext,
      hasTravel: tenantBusinessTypes.includes('travel_agency'),
    })
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems', keyName: 'fieldId' })
  const values = watch()
  const lineItems = Array.isArray(values.lineItems) ? values.lineItems : []
  const businessContext = values.businessContext || defaultBusinessContext
  const invoiceSubtype = values.invoiceSubtype || 'standard'
  const selectedTemplateId = Number(values.pdfTemplateId || getInvoiceTemplateId(tenant, businessContext))
  const selectedWarehouseId = values.warehouseId || ''
  const isTradingContext = businessContext === 'trading'
  const isTravelContext = businessContext === 'travel_agency'
  const isRestaurantContext = businessContext === 'restaurant'
  const isManpowerContext = businessContext === 'manpower'
  const [sourceId, setSourceId] = useState('')
  const skipBusinessContextResetRef = useRef(false)
  const isSubmittedRef = useRef(false)
  const hydratedInvoiceIdRef = useRef('')
  const recoveredLinesRef = useRef(false)

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

  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'buyer.name',
    targetField: 'buyer.nameAr',
    sourceLang: 'en', targetLang: 'ar',
    initialTargetValue: initialInvoice?.buyer?.nameAr || '',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'buyer.nameAr',
    targetField: 'buyer.name',
    sourceLang: 'ar', targetLang: 'en',
    initialTargetValue: initialInvoice?.buyer?.name || '',
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
    if (!isEdit || !initialInvoice?._id || isSubmittedRef.current) return
    const invoiceKey = String(initialInvoice._id)
    if (hydratedInvoiceIdRef.current === invoiceKey) return
    hydratedInvoiceIdRef.current = invoiceKey
    recoveredLinesRef.current = false
    skipBusinessContextResetRef.current = true
    setInvoiceType(initialInvoice?.transactionType === 'B2B' ? 'B2B' : 'B2C')
    setSourceId('')
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
    setShowNotesPanel(Boolean(String(initialInvoice?.notes || '').trim()))
    setShowTermsPanel(Boolean(String(initialInvoice?.termsAndConditions || '').trim()))
    setShowBankPanel(Boolean(
      initialInvoice?.includeBankDetails ||
      initialInvoice?.bankDetails?.bankName ||
      initialInvoice?.bankDetails?.iban ||
      initialInvoice?.bankDetails?.accountNumber
    ))
    const next = buildSellInvoiceFormValues({
      invoice: initialInvoice,
      tenant,
      defaultBusinessContext,
      hasTravel: tenantBusinessTypes.includes('travel_agency'),
    })
    reset(next)
  }, [defaultBusinessContext, initialInvoice, isEdit, reset, tenant, tenantBusinessTypes])

  useEffect(() => {
    if (!isEdit || fields.length > 0 || recoveredLinesRef.current) return
    recoveredLinesRef.current = true
    replace(mapSellLineItems(initialInvoice))
  }, [fields.length, initialInvoice, isEdit, replace])

  useEffect(() => {
    if (isTravelContext) {
      setValue('transactionType', invoiceType)
      setValue('invoiceTypeCode', invoiceType === 'B2B' ? '0100000' : '0200000')
      if (invoiceSubtype !== 'travel_ticket') {
        setValue('invoiceSubtype', 'travel_ticket')
      }
    } else if (invoiceSubtype === 'travel_ticket') {
      setValue('invoiceSubtype', 'standard')
    }
    if (isTravelContext && !invoiceSubtype) {
      setValue('invoiceSubtype', 'travel_ticket')
    }
  }, [invoiceSubtype, invoiceType, isTravelContext, setValue])

  // Auto-update PDF template when business context changes
  useEffect(() => {
    const newTemplateId = getInvoiceTemplateId(tenant, businessContext)
    setValue('pdfTemplateId', newTemplateId)
  }, [businessContext, tenant, setValue])

  useEffect(() => {
    if (!isTravelContext) return
    lineItems.forEach((line, index) => {
      // Travel agency invoices are VAT-exempt (0%).
      if (toNumber(line?.taxRate, 15) !== 15) {
        setValue(`lineItems.${index}.taxRate`, 15)
      }
      if (!line?.isTravelMargin) {
        setValue(`lineItems.${index}.isTravelMargin`, true)
      }
      // Travel invoices do not expose quantity; each line represents a single ticket/service.
      if (toNumber(line?.quantity, 1) !== 1) {
        setValue(`lineItems.${index}.quantity`, 1)
      }
    })
  }, [isTravelContext, lineItems, setValue])

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

  const { data: customers } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => api.get('/customers', { params: { limit: 200 } }).then((res) => res.data.customers),
  })

  const { data: restaurantOrders } = useQuery({
    queryKey: ['restaurant-orders-lookup'],
    queryFn: () => api.get('/restaurant/orders', { params: { page: 1, limit: 200 } }).then((res) => res.data.orders || []),
    enabled: tenantBusinessTypes.includes('restaurant') && isRestaurantContext,
  })

  const { data: travelBookings } = useQuery({
    queryKey: ['travel-bookings-lookup'],
    queryFn: () => api.get('/travel-bookings', { params: { page: 1, limit: 200 } }).then((res) => res.data.bookings || []),
    enabled: tenantBusinessTypes.includes('travel_agency') && isTravelContext,
  })

  const { data: manpowerAssignments } = useQuery({
    queryKey: ['manpower-assignments-lookup'],
    queryFn: () => api.get('/manpower/assignments', { params: { limit: 200 } }).then((res) => res.data || []),
    enabled: tenantBusinessTypes.includes('manpower') && isManpowerContext,
  })

  const importSourceMutation = useMutation({
    mutationFn: async () => {
      if (!sourceId) throw new Error('Missing sourceId')
      if (isRestaurantContext) {
        return api.get(`/restaurant/orders/${sourceId}`).then((res) => ({ type: 'restaurant', data: res.data }))
      }
      if (isTravelContext) {
        return api.get(`/travel-bookings/${sourceId}`).then((res) => ({ type: 'travel', data: res.data }))
      }
      if (isManpowerContext) {
        return api.get(`/manpower/assignments/${sourceId}`).then((res) => ({ type: 'manpower', data: res.data }))
      }
      throw new Error('Unsupported business context')
    },
    onSuccess: ({ type, data }) => {
      const nextTransactionType = type === 'travel' ? invoiceType : (invoiceType || 'B2B')
      setInvoiceType(nextTransactionType)
      setValue('transactionType', nextTransactionType)
      setValue('invoiceTypeCode', nextTransactionType === 'B2B' ? '0100000' : '0200000')

      if (type === 'restaurant') {
        const items = (Array.isArray(data?.lineItems) ? data.lineItems : []).map((li) => ({
          ...emptyLine,
          productName: li?.name || '',
          productNameAr: li?.nameAr || '',
          quantity: li?.quantity ?? 1,
          unitPrice: li?.unitPrice ?? 0,
          taxRate: li?.taxRate ?? 15,
          productType: 'service',
        }))
        replace(items.length ? items : [emptyLine])
        setValue('buyer.name', data?.customerName || 'Cash Customer')
        setValue('buyer.contactPhone', data?.customerPhone || '')
        setValue('restaurantOrderId', data?._id || '')
        setValue('travelBookingId', '')
        setValue('manpowerAssignmentId', '')
        setValue('contractNumber', data?.orderNumber || '')
        setValue('paymentMethod', data?.paymentMethod === 'transfer' ? 'bank_transfer' : data?.paymentMethod === 'card' ? 'card' : 'cash')
        toast.success(language === 'ar' ? 'تم استيراد الطلب' : 'Order imported')
        return
      }

      if (type === 'manpower') {
        const items = (Array.isArray(data?.workers) ? data.workers : []).map((w) => {
          const workerData = w.workerId || {}
          return {
            ...emptyLine,
            productName: `Manpower: ${workerData.name || w.workerName || ''} - ${workerData.trade || w.workerTrade || ''}`,
            productNameAr: `عمالة: ${workerData.nameAr || workerData.name || w.workerName || ''} - ${workerData.trade || w.workerTrade || ''}`,
            quantity: 1,
            unitPrice: Math.max(Number(w.monthlyRate || workerData.monthlyRate || 0), Number(w.dailyRate || workerData.dailyRate || 0)),
            taxRate: 15,
            productType: 'service',
          }
        })
        replace(items.length ? items : [emptyLine])
        if (data?.clientId?._id) {
            onSelectCustomer(data.clientId._id)
        }
        setValue('manpowerAssignmentId', data?._id || '')
        setValue('restaurantOrderId', '')
        setValue('travelBookingId', '')
        setValue('contractNumber', data?.assignmentNumber || '')
        toast.success(language === 'ar' ? 'تم استيراد العمالة' : 'Workers imported')
        return
      }

      const subtotal = Number(data?.subtotal) || 0
      const totalTax = Number(data?.totalTax) || 0
      const taxableAmount = subtotal > 0 ? subtotal : Math.max(0, (Number(data?.grandTotal) || 0) - totalTax)
      replace([{ ...emptyLine, productName: `Travel Booking ${data?.bookingNumber || ''}`.trim(), quantity: 1, unitPrice: taxableAmount, taxRate: 15, agencyPrice: 0, isTravelMargin: true, productType: 'service' }])
      setValue('invoiceSubtype', 'travel_ticket')
      setValue('buyer.name', data?.customerName || 'Cash Customer')
      setValue('buyer.contactEmail', data?.customerEmail || '')
      setValue('buyer.contactPhone', data?.customerPhone || '')
      setValue('travelBookingId', data?._id || '')
      setValue('restaurantOrderId', '')
      setValue('manpowerAssignmentId', '')
      setValue('contractNumber', data?.bookingNumber || '')
      setValue('travelDetails.travelerName', data?.travelerName || data?.customerName || '')
      setValue('travelDetails.passportNumber', data?.passportNumber || '')
      setValue('travelDetails.ticketNumber', data?.ticketNumber || '')
      setValue('travelDetails.pnr', data?.pnr || '')
      setValue('travelDetails.airlineName', data?.airlineName || '')
      setValue('travelDetails.routeFrom', data?.routeFrom || '')
      setValue('travelDetails.routeTo', data?.routeTo || '')
      setValue('travelDetails.segments', Array.isArray(data?.segments) && data.segments.length > 0 ? data.segments : [{ from: data?.routeFrom || '', to: data?.routeTo || '' }])
      setValue('travelDetails.departureDate', data?.departureDate ? String(data.departureDate).slice(0, 10) : '')
      setValue('travelDetails.hasReturnDate', Boolean(data?.hasReturnDate && data?.returnDate))
      setValue('travelDetails.returnDate', data?.hasReturnDate && data?.returnDate ? String(data.returnDate).slice(0, 10) : '')
      setValue('travelDetails.layoverStay', data?.layoverStay || '')
      setValue('travelDetails.passengerTitle', 'mr')
      setValue('travelDetails.passengers', Array.isArray(data?.passengers) ? data.passengers : [])
      toast.success(language === 'ar' ? 'تم استيراد الحجز' : 'Booking imported')
    },
    onError: (error) => toast.error(error?.response?.data?.error || error.message || 'Failed'),
  })

  const latestValues = useRef(values)

  useEffect(() => {
    latestValues.current = values
  }, [values])

  useEffect(() => {
    return () => {
      if (!isEdit && !isSubmittedRef.current) {
        const data = latestValues.current
        const hasData = data.buyer?.name || data.restaurantOrderId || data.travelBookingId || data.manpowerAssignmentId || (data.lineItems && data.lineItems.some(l => l.productName || l.unitPrice > 0))
        if (hasData) {
          const payload = {
            ...data,
            flow: 'sell',
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
            }))
          }
          api.post('/invoices/sell', payload).catch(() => {})
        }
      }
    }
  }, [isEdit])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/invoices/${invoiceId}`, data, { timeout: 120000 })
      : api.post('/invoices/sell', data, { timeout: 120000 }),
    onSuccess: (res) => {
      isSubmittedRef.current = true;
      toast.success(
        isEdit
          ? (language === 'ar' ? 'تم تحديث فاتورة البيع بنجاح' : 'Sell invoice updated successfully')
          : (language === 'ar' ? 'تم إنشاء فاتورة البيع بنجاح' : 'Sell invoice created successfully')
      )
      queryClient.invalidateQueries(['invoices'])
      if (isEdit) {
        queryClient.invalidateQueries(['invoice', invoiceId])
      }
      queryClient.invalidateQueries(['dashboard'])
      queryClient.invalidateQueries(['dashboard-revenue'])
      queryClient.invalidateQueries(['travel-bookings'])
      queryClient.invalidateQueries(['travel-bookings-lookup'])
      queryClient.invalidateQueries(['manpower-assignments-lookup'])
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['customers-lookup'])
      if (res.data?.offline) {
        navigate('/app/dashboard/invoices')
      } else {
        navigate(`/app/dashboard/invoices/${res.data?._id || invoiceId}`)
      }
    },
    onError: (error) => toast.error(error?.response?.data?.error || error?.userMessage || error?.message || (isEdit ? 'Failed to update invoice' : 'Failed to create invoice')),
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
    if (typeof product.sellingPrice === 'number') {
      setValue(`lineItems.${index}.unitPrice`, product.sellingPrice)
    }
  }

  const onSelectCustomer = (customerId) => {
    const customer = (customers || []).find((item) => item._id === customerId)
    if (!customer) return
    setValue('customerId', customer._id)
    setValue('buyer.name', customer.name)
    setValue('buyer.nameAr', customer.nameAr || customer.name)
    setValue('buyer.vatNumber', customer.vatNumber || '')
    setValue('buyer.crNumber', customer.crNumber || '')
    setValue('buyer.address.city', customer.address?.city || '')
    setValue('buyer.address.cityAr', customer.address?.cityAr || '')
    setValue('buyer.address.district', customer.address?.district || '')
    setValue('buyer.address.districtAr', customer.address?.districtAr || '')
    setValue('buyer.address.street', customer.address?.street || '')
    setValue('buyer.address.streetAr', customer.address?.streetAr || '')
    setValue('buyer.address.postalCode', customer.address?.postalCode || '')
    setValue('buyer.address.country', customer.address?.country || 'SA')
    setValue('buyer.address.buildingNumber', customer.address?.buildingNumber || '')
    setValue('buyer.address.additionalNumber', customer.address?.additionalNumber || '')
    setValue('buyer.contactPhone', customer.phone || getValues('buyer.contactPhone') || '')
    setValue('buyer.contactEmail', customer.email || getValues('buyer.contactEmail') || '')
  }

  const calculateLineTotal = (index) => {
    const summary = calculateInvoiceSummary({ lineItems, invoiceDiscount: values?.invoiceDiscount })
    const line = summary.lines[index]
    if (!line) return { subtotal: 0, tax: 0, total: 0 }
    return { subtotal: line.lineTotal, tax: line.taxAmount, total: line.lineTotalWithTax }
  }

  const totals = calculateInvoiceSummary({ lineItems, invoiceDiscount: values?.invoiceDiscount })

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [pendingPayload, setPendingPayload] = useState(null)

  const buildPayload = (data) => {
    const namedLines = (data.lineItems || []).filter((line) => String(line?.productName || '').trim())
    if (!namedLines.length) {
      toast.error(language === 'ar' ? 'أضف بنداً واحداً على الأقل قبل الحفظ' : 'Add at least one billing line before saving')
      return null
    }
    const namedTotals = calculateInvoiceSummary({ lineItems: namedLines, invoiceDiscount: Math.max(0, toNumber(data?.invoiceDiscount, 0)) })
    const transactionType = invoiceType
    const invoiceTypeCode = transactionType === 'B2C' ? '0200000' : '0100000'
    const payload = {
      ...data,
      flow: 'sell',
      businessContext,
      invoiceSubtype: isTravelContext ? 'travel_ticket' : invoiceSubtype,
      pdfTemplateId: selectedTemplateId,
      transactionType,
      invoiceTypeCode,
      invoiceDiscount: Math.max(0, toNumber(data?.invoiceDiscount, 0)),
      issueDate: (() => {
        const raw = typeof data?.issueDate === 'string' ? data.issueDate.trim() : ''
        if (raw) {
          const parsed = new Date(raw)
          if (!Number.isNaN(parsed.getTime())) return parsed
        }
        return isEdit ? (initialInvoice?.issueDate || new Date()) : new Date()
      })(),
      dueDate: (() => {
        const raw = typeof data?.dueDate === 'string' ? data.dueDate.trim() : ''
        if (raw) {
          const parsed = new Date(raw)
          if (!Number.isNaN(parsed.getTime())) return parsed
        }
        const issueRaw = typeof data?.issueDate === 'string' ? data.issueDate.trim() : ''
        const issue = issueRaw ? new Date(issueRaw) : new Date()
        return computeDueDateFromPaymentTerms(issue, data?.paymentTerms || 'immediate') || undefined
      })(),
      printFormat: data?.printFormat === 'thermal' ? 'thermal' : 'a4',
      paymentTerms: data?.paymentTerms || 'immediate',
      paymentMethod: data?.paymentMethod || 'cash',
      lineItems: namedLines.map((line, index) => {
        const summaryLine = namedTotals.lines[index] || {}
        const agencyPrice = Math.max(0, toNumber(line.agencyPrice, 0))
        const isTravelMargin = isTravelContext ? true : Boolean(line.isTravelMargin)
        const customerPriceRaw = Math.max(0, toNumber(line.customerPrice, 0))
        const unitPriceNum = Math.max(0, toNumber(line.unitPrice, 0))
        return {
          lineNumber: index + 1,
          taxCategory: 'S',
          productId: isTradingContext ? line.productId || undefined : undefined,
          productName: line.productName,
          productNameAr: line.productNameAr || '',
          productType: normalizeProductType(line.productType),
          description: line.description || '',
          descriptionAr: line.descriptionAr || '',
          unitCode: line.unitCode || 'PCE',
          quantity: Math.max(0.0001, toNumber(line.quantity, 1)),
          unitPrice: Math.max(0, toNumber(line.unitPrice, 0)),
          taxRate: isTravelContext ? Math.max(0, toNumber(line.taxRate, 15)) : toNumber(line.taxRate, 15),
          agencyPrice: isTravelContext ? agencyPrice : 0,
          customerPrice: isTravelContext ? (customerPriceRaw > 0 ? customerPriceRaw : unitPriceNum) : 0,
          isTravelMargin,
          marginTaxable: isTravelMargin ? Math.max(0, toNumber(summaryLine.marginTaxable, 0)) : 0,
          taxAmount: toNumber(summaryLine.taxAmount, 0),
          lineTotal: toNumber(summaryLine.lineTotal, 0),
          lineTotalWithTax: toNumber(summaryLine.lineTotalWithTax, 0),
        }
      }),
      subtotal: namedTotals.subtotal,
      totalDiscount: namedTotals.totalDiscount,
      taxableAmount: namedTotals.taxableAmount,
      totalTax: namedTotals.totalTax,
      grandTotal: namedTotals.grandTotal,
    }
    applyFormPaymentToPayload(payload, {
      paymentStatus: data?.paymentStatus,
      paidAmount: data?.paidAmount,
      grandTotal: namedTotals.grandTotal,
    })

    if (!payload.restaurantOrderId) delete payload.restaurantOrderId
    if (!payload.travelBookingId) delete payload.travelBookingId
    if (!payload.manpowerAssignmentId) delete payload.manpowerAssignmentId
    if (!payload.contractNumber) delete payload.contractNumber
    if (!isTradingContext) delete payload.warehouseId
    if (isTravelContext || invoiceSubtype === 'travel_ticket') {
      payload.travelDetails = sanitizeTravelDetails({
        ...data.travelDetails,
        travelerName: data?.buyer?.name || data?.travelDetails?.travelerName || '',
      })
    } else {
      delete payload.travelDetails
    }
    payload.showAuthorizedPerson = Boolean(showAuthorizedPerson)
    payload.hasAuthorizedPerson = Boolean(showAuthorizedPerson)
    payload.authorizedPersonName = showAuthorizedPerson ? (data?.authorizedPersonName || '') : ''
    payload.authorizedPersonNameAr = showAuthorizedPerson ? (data?.authorizedPersonNameAr || '') : ''
    payload.authorizedPersonDesignation = showAuthorizedPerson ? (data?.authorizedPersonDesignation || '') : ''
    payload.authorizedPersonDesignationAr = showAuthorizedPerson ? (data?.authorizedPersonDesignationAr || '') : ''
    payload.authorizedPersonSignature = showAuthorizedPerson ? (data?.authorizedPersonSignature || '') : ''
    payload.stampImage = showAuthorizedPerson ? (data?.stampImage || '') : ''
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
    includeBankDetails: Boolean(showBankPanel),
    bankDetails: showBankPanel
      ? {
          bankName: values?.bankDetails?.bankName || '',
          accountName: values?.bankDetails?.accountName || '',
          accountNumber: values?.bankDetails?.accountNumber || '',
          iban: values?.bankDetails?.iban || '',
        }
      : { bankName: '', accountName: '', accountNumber: '', iban: '' },
    notes: showNotesPanel ? (values?.notes || '') : '',
    termsAndConditions: showTermsPanel ? (values?.termsAndConditions || '') : '',
    invoiceNumber: initialInvoice?.invoiceNumber || 'DRAFT-PREVIEW',
    issueDate: (() => {
      const raw = typeof values?.issueDate === 'string' ? values.issueDate.trim() : ''
      if (raw) {
        const parsed = new Date(raw)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
      return initialInvoice?.issueDate || new Date()
    })(),
    dueDate: (() => {
      const raw = typeof values?.dueDate === 'string' ? values.dueDate.trim() : ''
      if (raw) {
        const parsed = new Date(raw)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
      const issueRaw = typeof values?.issueDate === 'string' ? values.issueDate.trim() : ''
      const issue = issueRaw ? new Date(issueRaw) : new Date()
      return computeDueDateFromPaymentTerms(issue, values?.paymentTerms || 'immediate') || undefined
    })(),
    printFormat: values?.printFormat === 'thermal' ? 'thermal' : 'a4',
    createdByName: initialInvoice?.createdByName || [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    createdByNameAr: initialInvoice?.createdByNameAr || [user?.firstNameAr, user?.lastNameAr].filter(Boolean).join(' '),
    createdBy: initialInvoice?.createdBy || user,
    flow: 'sell',
    transactionType: invoiceType,
    invoiceSubtype: isTravelContext ? 'travel_ticket' : invoiceSubtype,
    pdfTemplateId: selectedTemplateId,
    invoiceDiscount: Math.max(0, toNumber(values?.invoiceDiscount, 0)),
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableAmount: totals.taxableAmount,
    totalTax: totals.totalTax,
    grandTotal: totals.grandTotal,
    lineItems: totals.lines.map((line, index) => ({
      ...line.raw,
      lineNumber: index + 1,
      lineTotal: line.lineTotal,
      taxAmount: line.taxAmount,
      lineTotalWithTax: line.lineTotalWithTax,
    })),
    seller: {
      name: tenant?.business?.legalNameEn,
      nameAr: tenant?.business?.legalNameAr,
      vatNumber: tenant?.business?.vatNumber,
      address: tenant?.business?.address,
      contactPhone: tenant?.business?.contactPhone,
      contactEmail: tenant?.business?.contactEmail,
    },
    travelDetails: sanitizeTravelDetails({
      ...values.travelDetails,
      travelerName: values?.buyer?.name || values?.travelDetails?.travelerName || '',
    }),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(isEdit ? `/app/dashboard/invoices/${invoiceId}` : '/app/dashboard/invoices/new')} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isEdit ? (language === 'ar' ? 'تعديل فاتورة البيع' : 'Edit Sell Invoice') : (language === 'ar' ? 'فاتورة بيع جديدة' : 'New Sell Invoice')}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{isEdit ? (language === 'ar' ? 'حدّث بيانات الفاتورة وشاهد المعاينة المباشرة قبل الحفظ' : 'Update the invoice details and review the live preview before saving') : (language === 'ar' ? 'اختر صيغة الفاتورة وشروط الدفع وشاهد المعاينة قبل الحفظ' : 'Choose invoice format, payment terms, and see a live preview before saving')}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-8">
        <form onSubmit={handleSubmit(onSubmit, () => toast.error(language === 'ar' ? 'أكمل البنود المطلوبة قبل الحفظ' : 'Complete the billing lines before saving'))} className="space-y-8">
          <div className={`${sectionCardClass} space-y-5`}>
            <div className="mb-1 flex items-end justify-between gap-3">
              <div>
                <p className={sectionEyebrowClass}>
                  {isEdit ? (language === 'ar' ? 'تعديل' : 'Edit') : (language === 'ar' ? 'جديد' : 'New')}
                </p>
                <h2 className={sectionTitleClass}>
                  {language === 'ar' ? 'إنشاء فاتورة' : 'Create invoice'}
                </h2>
              </div>
              {showArabicFields && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold tracking-wide text-slate-700 dark:bg-dark-700 dark:text-slate-200">
                  EN · AR
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                {
                  id: 'a4',
                  Icon: FileText,
                  titleEn: 'A4 Invoice',
                  titleAr: 'فاتورة A4',
                  descEn: 'Full-page PDF for email, print, and archives.',
                  descAr: 'ملف PDF كامل للبريد والطباعة والأرشيف.',
                },
                {
                  id: 'thermal',
                  Icon: Receipt,
                  titleEn: 'Thermal Invoice',
                  titleAr: 'فاتورة حرارية',
                  descEn: '80mm receipt-style print for POS counters.',
                  descAr: 'طباعة إيصال 80 مم لنقاط البيع.',
                },
              ].map((fmt) => {
                const active = (values?.printFormat || 'a4') === fmt.id
                const Icon = fmt.Icon
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setValue('printFormat', fmt.id, { shouldDirty: true, shouldTouch: true })}
                    className={`group flex items-start gap-3 rounded-2xl border px-4 py-4 text-start transition ${
                      active
                        ? 'border-slate-900 bg-slate-950 text-white shadow-lg dark:border-white dark:bg-white dark:text-slate-950'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800'
                    }`}
                  >
                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/10 text-white dark:bg-slate-900/10 dark:text-slate-900' : 'bg-slate-50 text-slate-600 dark:bg-dark-700 dark:text-slate-300'}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span>
                      <span className={`block text-sm font-semibold ${active ? '' : 'text-slate-900 dark:text-white'}`}>{language === 'ar' ? fmt.titleAr : fmt.titleEn}</span>
                      <span className={`mt-1 block text-xs leading-relaxed ${active ? 'text-white/70 dark:text-slate-600' : 'text-slate-500'}`}>{language === 'ar' ? fmt.descAr : fmt.descEn}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <input type="hidden" {...register('printFormat')} />
            <input type="hidden" {...register('businessContext')} />
          </div>

          {(isRestaurantContext || isTravelContext || isManpowerContext) && (
            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'مصدر الفاتورة' : 'Invoice Source'}</h3>
              {isRestaurantContext && (
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
                  <div className="md:col-span-9">
                    <label className={fieldLabelClass}>{language === 'ar' ? 'طلب مطعم' : 'Restaurant Order'}</label>
                    <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`mt-1.5 ${fieldControlClass}`}>
                      <option value="">{language === 'ar' ? 'اختر طلب' : 'Select order'}</option>
                      {(restaurantOrders || []).map((item) => <option key={item._id} value={item._id}>{item.orderNumber} - {Number(item.grandTotal || 0).toFixed(2)}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button type="button" className="btn btn-secondary w-full" disabled={!sourceId || importSourceMutation.isPending} onClick={() => importSourceMutation.mutate()}>
                      {importSourceMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" /> : (language === 'ar' ? 'استيراد' : 'Import')}
                    </button>
                  </div>
                </div>
              )}
              {isTravelContext && (
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
                  <div className="md:col-span-9">
                    <label className={fieldLabelClass}>{language === 'ar' ? 'حجز سفر' : 'Travel Booking'}</label>
                    <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`mt-1.5 ${fieldControlClass}`}>
                      <option value="">{language === 'ar' ? 'اختر حجز' : 'Select booking'}</option>
                      {(travelBookings || []).map((item) => <option key={item._id} value={item._id}>{item.bookingNumber} - {Number(item.grandTotal || 0).toFixed(2)}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button type="button" className="btn btn-secondary w-full" disabled={!sourceId || importSourceMutation.isPending} onClick={() => importSourceMutation.mutate()}>
                      {importSourceMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" /> : (language === 'ar' ? 'استيراد' : 'Import')}
                    </button>
                  </div>
                </div>
              )}
              {isManpowerContext && (
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
                  <div className="md:col-span-9">
                    <label className={fieldLabelClass}>{language === 'ar' ? 'تعيين عمالة' : 'Manpower Assignment'}</label>
                    <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`mt-1.5 ${fieldControlClass}`}>
                      <option value="">{language === 'ar' ? 'اختر تعيين' : 'Select assignment'}</option>
                      {(manpowerAssignments || []).map((item) => <option key={item._id} value={item._id}>{item.assignmentNumber} - {item.clientId?.name || 'Customer'}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button type="button" className="btn btn-secondary w-full" disabled={!sourceId || importSourceMutation.isPending} onClick={() => importSourceMutation.mutate()}>
                      {importSourceMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" /> : (language === 'ar' ? 'استيراد العمالة' : 'Import Workers')}
                    </button>
                  </div>
                </div>
              )}
              <input type="hidden" {...register('restaurantOrderId')} />
              <input type="hidden" {...register('travelBookingId')} />
              <input type="hidden" {...register('manpowerAssignmentId')} />
              <input type="hidden" {...register('contractNumber')} />
            </div>
          )}

          <div className="space-y-4">
            <p className={sectionEyebrowClass}>
              {language === 'ar' ? 'النوع' : 'Type'}
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button type="button" onClick={() => setInvoiceType('B2B')} className={`rounded-2xl border px-4 py-4 text-start transition ${invoiceType === 'B2B' ? 'border-slate-900 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-800'}`}>
                <p className="text-sm font-semibold">{t('b2bInvoice')}</p>
                <p className={`mt-1 text-xs ${invoiceType === 'B2B' ? 'text-white/70 dark:text-slate-600' : 'text-slate-500'}`}>
                  {isTravelContext
                    ? (language === 'ar' ? 'فاتورة سفر ضريبية للشركات والعملاء المسجلين ضريبياً' : 'Tax travel invoice for companies and VAT-registered customers')
                    : (language === 'ar' ? 'فواتير الشركات والجهات' : 'Invoices for business customers')}
                </p>
              </button>
              <button type="button" onClick={() => setInvoiceType('B2C')} className={`rounded-2xl border px-4 py-4 text-start transition ${invoiceType === 'B2C' ? 'border-slate-900 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-800'}`}>
                <p className="text-sm font-semibold">{t('b2cInvoice')}</p>
                <p className={`mt-1 text-xs ${invoiceType === 'B2C' ? 'text-white/70 dark:text-slate-600' : 'text-slate-500'}`}>
                  {isTravelContext
                    ? (language === 'ar' ? 'فاتورة سفر مبسطة للأفراد' : 'Simplified travel invoice for individual customers')
                    : (language === 'ar' ? 'مبيعات نقدية أو مباشرة' : 'Cash or direct sale invoices')}
                </p>
              </button>
            </div>
            <input type="hidden" {...register('invoiceSubtype')} />
          </div>

          <input type="hidden" {...register('pdfTemplateId')} />

          {isTravelContext && (
            <div className="space-y-3 border-t border-slate-200/80 pt-6 dark:border-dark-600">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'تاريخ ووقت الفاتورة' : 'Invoice Date & Time'}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={fieldLabelClass}>
                    {language === 'ar' ? 'تاريخ ووقت الإصدار المخصص' : 'Custom Issue Date & Time'}
                  </label>
                  <input
                    type="datetime-local"
                    {...register('issueDate')}
                    className={`mt-1.5 ${fieldControlClass}`}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={`${sectionCardClass} space-y-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={sectionEyebrowClass}>
                  {language === 'ar' ? 'البائع' : 'Seller'}
                </p>
                <h3 className={sectionTitleClass}>
                  {language === 'ar' ? 'بيانات المنشأة' : 'Your company details'}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'تُؤخذ تلقائياً من ملف الشركة' : 'Prefilled from your company profile'}
                </p>
              </div>
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-slate-200/80 dark:ring-white/15">
                {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
                  <img
                    src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" dir="ltr">
              <div className={showArabicFields ? 'sm:col-span-2 lg:col-span-2' : ''}>
                <BilingualLabel en="Legal name" ar="الاسم القانوني" as="p" />
                <div className={`mt-1 grid gap-3 ${showArabicFields ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {tenant?.business?.legalNameEn || tenant?.name || '—'}
                  </p>
                  {showArabicFields ? (
                    <p className="text-sm font-semibold text-slate-900 dark:text-white" dir="rtl">
                      {tenant?.business?.legalNameAr || '—'}
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <BilingualLabel en="VAT Number" ar="الرقم الضريبي" as="p" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.vatNumber || '—'}</p>
              </div>
              <div>
                <BilingualLabel en="CR Number" ar="السجل التجاري" as="p" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.crNumber || '—'}</p>
              </div>
              <div>
                <BilingualLabel en="Phone" ar="الهاتف" as="p" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.contactPhone || '—'}</p>
              </div>
              <div>
                <BilingualLabel en="Email" ar="البريد" as="p" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.contactEmail || '—'}</p>
              </div>
              <div className={showArabicFields ? 'sm:col-span-2' : ''}>
                <BilingualLabel en="Address" ar="العنوان" as="p" />
                <div className={`mt-1 grid gap-3 ${showArabicFields ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {[
                      tenant?.business?.address?.street,
                      tenant?.business?.address?.district,
                      tenant?.business?.address?.city,
                      tenant?.business?.address?.postalCode,
                      tenant?.business?.address?.country || 'SA',
                    ].filter(Boolean).join(', ') || '—'}
                  </p>
                  {showArabicFields ? (
                    <p className="text-sm font-semibold text-slate-900 dark:text-white" dir="rtl">
                      {[
                        tenant?.business?.address?.streetAr,
                        tenant?.business?.address?.districtAr,
                        tenant?.business?.address?.cityAr,
                        tenant?.business?.address?.postalCode,
                        tenant?.business?.address?.country || 'SA',
                      ].filter(Boolean).join('، ') || '—'}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className={`${sectionCardClass} space-y-6`}>
            <div>
              <p className={sectionEyebrowClass}>
                {language === 'ar' ? 'المشتري' : 'Buyer'}
              </p>
              <h3 className={sectionTitleClass}>
                {language === 'ar' ? 'بيانات العميل' : 'Who is this for?'}
              </h3>
            </div>
            <div>
              <label className={fieldLabelClass}>{language === 'ar' ? 'اختر عميل موجود' : 'Select existing customer'}</label>
              <select onChange={(e) => onSelectCustomer(e.target.value)} className={`mt-1.5 ${fieldControlClass}`}>
                <option value="">{language === 'ar' ? 'اختياري: اختر عميل' : 'Optional: Select customer'}</option>
                {(customers || []).map((item) => <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.name) : item.name}</option>)}
              </select>
            </div>
            <input type="hidden" {...register('customerId')} />
            {invoiceSubtype === 'travel_ticket' ? (
              <>
                <TravelInvoiceFields language={language} register={register} control={control} watch={watch} setValue={setValue} />
                {invoiceType === 'B2B' && (
                  <div className={`mt-2 ${bilingualPairGridClass}`} dir="ltr">
                    <div>
                      <BilingualLabel en="VAT Number" ar="الرقم الضريبي" />
                      <input {...register('buyer.vatNumber')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    <div>
                      <BilingualLabel en="CR Number" ar="السجل التجاري" />
                      <input {...register('buyer.crNumber')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    <div>
                      <BilingualLabel en="City" ar="المدينة" />
                      <input {...register('buyer.address.city')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    {showArabicFields ? (
                      <div>
                        <BilingualLabel en="City (Arabic)" ar="المدينة بالعربية" />
                        <input {...register('buyer.address.cityAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                      </div>
                    ) : null}
                    <div>
                      <BilingualLabel en="District" ar="الحي" />
                      <input {...register('buyer.address.district')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    {showArabicFields ? (
                      <div>
                        <BilingualLabel en="District (Arabic)" ar="الحي بالعربية" />
                        <input {...register('buyer.address.districtAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                      </div>
                    ) : null}
                    <div>
                      <BilingualLabel en="Street" ar="الشارع" />
                      <input {...register('buyer.address.street')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    {showArabicFields ? (
                      <div>
                        <BilingualLabel en="Street (Arabic)" ar="الشارع بالعربية" />
                        <input {...register('buyer.address.streetAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                      </div>
                    ) : null}
                    <div>
                      <BilingualLabel en="Postal Code" ar="الرمز البريدي" />
                      <input {...register('buyer.address.postalCode')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    <div>
                      <BilingualLabel en="Country" ar="الدولة" />
                      <input {...register('buyer.address.country')} className={`mt-1.5 ${fieldControlClass}`} placeholder="SA" />
                    </div>
                    <div>
                      <BilingualLabel en="Building Number" ar="رقم المبنى" />
                      <input {...register('buyer.address.buildingNumber')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    <div>
                      <BilingualLabel en="Additional Number" ar="الرقم الإضافي" />
                      <input {...register('buyer.address.additionalNumber')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={bilingualPairGridClass} dir="ltr">
                <div>
                  <BilingualLabel en="Name / Company" ar="الاسم / الشركة" />
                  <input {...register('buyer.name', { required: invoiceType === 'B2B' })} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                {showArabicFields ? (
                  <div>
                    <BilingualLabel en="Name (Arabic)" ar="الاسم بالعربية" />
                    <input {...register('buyer.nameAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <BilingualLabel en="VAT Number" ar="الرقم الضريبي" />
                  <input {...register('buyer.vatNumber', { required: invoiceType === 'B2B' })} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                <div>
                  <BilingualLabel en="Phone Number" ar="رقم الهاتف" />
                  <input {...register('buyer.contactPhone')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                <div>
                  <BilingualLabel en="Email" ar="البريد الإلكتروني" />
                  <input type="email" {...register('buyer.contactEmail')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                <div>
                  <BilingualLabel en="CR Number" ar="السجل التجاري" />
                  <input {...register('buyer.crNumber')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                <div>
                  <BilingualLabel en="City" ar="المدينة" />
                  <input {...register('buyer.address.city')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                {showArabicFields ? (
                  <div>
                    <BilingualLabel en="City (Arabic)" ar="المدينة بالعربية" />
                    <input {...register('buyer.address.cityAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <BilingualLabel en="District" ar="الحي" />
                  <input {...register('buyer.address.district')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                {showArabicFields ? (
                  <div>
                    <BilingualLabel en="District (Arabic)" ar="الحي بالعربية" />
                    <input {...register('buyer.address.districtAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <BilingualLabel en="Street" ar="الشارع" />
                  <input {...register('buyer.address.street')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                {showArabicFields ? (
                  <div>
                    <BilingualLabel en="Street (Arabic)" ar="الشارع بالعربية" />
                    <input {...register('buyer.address.streetAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <BilingualLabel en="Postal Code" ar="الرمز البريدي" />
                  <input {...register('buyer.address.postalCode')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                <div>
                  <BilingualLabel en="Country" ar="الدولة" />
                  <input {...register('buyer.address.country')} className={`mt-1.5 ${fieldControlClass}`} placeholder="SA" />
                </div>
                <div>
                  <BilingualLabel en="Building Number" ar="رقم المبنى" />
                  <input {...register('buyer.address.buildingNumber')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
                <div>
                  <BilingualLabel en="Additional Number" ar="الرقم الإضافي" />
                  <input {...register('buyer.address.additionalNumber')} className={`mt-1.5 ${fieldControlClass}`} />
                </div>
              </div>
            )}
          </div>

          <div className={`${sectionCardClass} space-y-5`}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={sectionEyebrowClass}>
                  {language === 'ar' ? 'البنود' : 'Lines'}
                </p>
                <h3 className={sectionTitleClass}>
                  {language === 'ar' ? 'بنود الفاتورة' : 'What are you billing?'}
                </h3>
              </div>
              <button type="button" onClick={() => append(getEmptyLine(tenant))} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:border-teal-600 hover:text-teal-700 dark:border-dark-500 dark:bg-dark-700 dark:text-slate-100">
                <Plus className="w-3.5 h-3.5" />{t('add')}
              </button>
            </div>
            <div className="space-y-4">
              {fields.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center dark:border-dark-600 dark:bg-dark-900/40">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {language === 'ar' ? 'لا توجد بنود بعد' : 'No billing lines yet'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {language === 'ar' ? 'أضف بنداً للمنتجات أو الخدمات على هذه الفاتورة.' : 'Add a product or service line to this invoice.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => replace(mapSellLineItems(initialInvoice, tenant))}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {language === 'ar' ? 'تحميل البنود' : 'Load lines'}
                  </button>
                </div>
              ) : null}
              {fields.map((field, index) => (
                <div key={field.fieldId || field.id || `line-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 dark:border-dark-600 dark:bg-dark-900/50">
                  <LineItemTranslator index={index} control={control} watch={watch} setValue={setValue} initialNameAr={initialInvoice?.lineItems?.[index]?.productNameAr || ''} initialName={initialInvoice?.lineItems?.[index]?.productName || ''} />
                  <input type="hidden" {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} />
                  <input type="hidden" {...register(`lineItems.${index}.isTravelMargin`)} />
                  <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                  <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-12" dir="ltr">
                    <div className={isTravelContext
                      ? (showArabicFields ? 'lg:col-span-3' : 'lg:col-span-4')
                      : (showArabicFields ? 'lg:col-span-3' : 'lg:col-span-4')}>
                      <div className="mb-1.5 flex items-center gap-2" dir="ltr">
                        <label htmlFor={`product-select-${index}`} className="min-w-0 flex-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <span>Product Name *</span>
                          <span className="ms-1.5 font-medium text-slate-500 dark:text-slate-400" dir="rtl">اسم المنتج</span>
                        </label>
                        <ProductTypeToggle
                          value={watch(`lineItems.${index}.productType`)}
                          onChange={(next) => setValue(`lineItems.${index}.productType`, next, { shouldDirty: true, shouldTouch: true })}
                          language={language}
                        />
                      </div>
                      {isTradingContext ? (
                        <div>
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
                            placeholder={language === 'ar' ? 'اختياري: اختر منتج' : 'Optional: Select product'}
                            isClearable
                            isSearchable
                            styles={{
                              control: (base, state) => ({
                                ...base,
                                borderRadius: '0.75rem',
                                borderColor: state.isFocused ? '#0d9488' : '#cbd5e1',
                                boxShadow: state.isFocused ? '0 0 0 3px rgba(13,148,136,0.15)' : '0 1px 2px rgba(15,23,42,0.04)',
                                minHeight: '42px',
                                backgroundColor: '#fff',
                              }),
                              singleValue: (base) => ({ ...base, color: '#0f172a', fontWeight: 500 }),
                              placeholder: (base) => ({ ...base, color: '#94a3b8' })
                            }}
                          />
                          <input {...register(`lineItems.${index}.productName`)} className={`mt-2 ${fieldControlClass}`} readOnly={Boolean(lineItems?.[index]?.productId)} placeholder={language === 'ar' ? 'اسم المنتج أو الخدمة' : 'Product or service name'} />
                          <input type="hidden" {...register(`lineItems.${index}.productId`)} />
                        </div>
                      ) : (
                        <input id={`product-select-${index}`} {...register(`lineItems.${index}.productName`)} className={`mt-1.5 ${fieldControlClass}`} placeholder={language === 'ar' ? 'اسم الخدمة' : 'Service name'} />
                      )}
                    </div>
                    {showArabicFields ? (
                      <div className={isTravelContext ? 'lg:col-span-3' : 'lg:col-span-3'}>
                        <label className={`${fieldLabelClass} !flex items-baseline justify-between gap-3`} dir="ltr">
                          <span>Arabic name</span>
                          <span className="font-medium text-slate-500 dark:text-slate-400" dir="rtl">اسم البند بالعربية</span>
                        </label>
                        <input {...register(`lineItems.${index}.productNameAr`)} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" placeholder="اسم المنتج أو الخدمة" />
                      </div>
                    ) : (
                      <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                    )}
                    <div className="lg:col-span-2">
                      <label htmlFor={`unit-${index}`} className={fieldLabelClass}>{language === 'ar' ? 'الوحدة (اختياري)' : 'UOM (Optional)'}</label>
                      <Select
                        className="react-select-container mt-1.5"
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
                    {isTravelContext ? (
                      <input type="hidden" {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0.0001 })} />
                    ) : (
                      <div className="lg:col-span-1">
                        <label htmlFor={`qty-${index}`} className={fieldLabelClass}>{t('quantity')}</label>
                        <input id={`qty-${index}`} type="number" min="0.0001" step="any" {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0.0001 })} className={`mt-1.5 ${fieldControlClass}`} />
                      </div>
                    )}
                    <div className="lg:col-span-2">
                      <label htmlFor={`price-${index}`} className={fieldLabelClass}>
                        {isTravelContext
                          ? (language === 'ar' ? 'سعر التذكرة' : 'Unit Price')
                          : t('unitPrice')}
                      </label>
                      <input id={`price-${index}`} type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    {isTravelContext ? (
                      <>
                        <div className="lg:col-span-2">
                          <label htmlFor={`agencyprice-${index}`} className={fieldLabelClass}>{language === 'ar' ? 'سعر الوكالة' : 'Agency Price'}</label>
                          <input
                            id={`agencyprice-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${index}.agencyPrice`, { valueAsNumber: true, min: 0 })}
                            className={`mt-1.5 ${fieldControlClass}`}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label htmlFor={`custprice-${index}`} className={fieldLabelClass}>
                            {language === 'ar' ? 'سعر العميل' : 'Customer Price'}
                          </label>
                          <input
                            id={`custprice-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${index}.customerPrice`, { valueAsNumber: true, min: 0 })}
                            className={`mt-1.5 ${fieldControlClass}`}
                            placeholder="0.00"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="lg:col-span-1">
                        <label className={fieldLabelClass}>{t('tax')} %</label>
                        <select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className={`mt-1.5 ${fieldControlClass}`}><option value={15}>15%</option><option value={0}>0%</option></select>
                      </div>
                    )}
                    <div className="lg:col-span-2 flex items-center gap-2">
                      <div className="flex-1 text-end"><p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t('total')}</p><p className="text-base font-bold text-slate-900 dark:text-white"><Money value={calculateLineTotal(index).total} /></p></div>
                      {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </div>
                  {isTravelContext && (() => {
                    const line = lineItems?.[index] || {}
                    const summaryLine = totals.lines[index] || {}
                    const unitPriceNum = toNumber(line.unitPrice, 0)
                    const agencyPriceNum = Math.max(0, toNumber(line.agencyPrice, 0))
                    const qtyNum = Math.max(0, toNumber(line.quantity, 0))
                    const marginProfit = Math.max(0, unitPriceNum - agencyPriceNum) * qtyNum
                    const marginVat = toNumber(summaryLine.taxAmount, 0)
                    const netMarginProfit = Math.max(0, marginProfit - marginVat)
                    return (
                      <div className="mt-3 rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-3 dark:border-primary-900/40 dark:bg-primary-900/10">
                        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
                          <div className="md:col-span-6">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              {language === 'ar'
                                ? 'يتم احتساب الضريبة على هامش الربح فقط في فاتورة السفر'
                                : 'VAT is calculated only on the travel margin profit.'}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500">
                              {language === 'ar'
                                ? 'سعر العميل هو المبلغ الظاهر للعميل على الفاتورة. سعر الوحدة وسعر الوكالة مخفيان في الفاتورة المطبوعة.'
                                : 'Customer Price is what the buyer sees on the invoice. Unit Price and Agency Price are hidden on the printed invoice.'}
                            </p>
                          </div>
                          <div className="md:col-span-2 text-end">
                            <p className="mb-1 text-xs text-gray-500">{language === 'ar' ? 'هامش الربح' : 'Margin Profit'}</p>
                            <p className="font-semibold text-emerald-600"><Money value={marginProfit} /></p>
                          </div>
                          <div className="md:col-span-2 text-end">
                            <p className="mb-1 text-xs text-gray-500">{language === 'ar' ? 'الضريبة على الهامش' : 'VAT on Margin'}</p>
                            <p className="font-semibold text-amber-600"><Money value={marginVat} /></p>
                          </div>
                          <div className="md:col-span-2 text-end">
                            <p className="mb-1 text-xs text-gray-500">{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</p>
                            <p className="font-semibold text-primary-600"><Money value={netMarginProfit} /></p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>

          <div className={`${sectionCardClass} space-y-5`}>
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
                      <label className={fieldLabelClass}>{language === 'ar' ? 'الاسم' : 'Name'}</label>
                      <input {...register('authorizedPersonName')} className={`mt-1.5 ${fieldControlClass}`} placeholder={language === 'ar' ? 'مثال: Arthur Michael' : 'e.g. Arthur Michael'} />
                    </div>
                    <div>
                      <label className={fieldLabelClass}>{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                      <input {...register('authorizedPersonNameAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                    </div>
                    <div>
                      <label className={fieldLabelClass}>{language === 'ar' ? 'المسمى الوظيفي' : 'Designation'}</label>
                      <input {...register('authorizedPersonDesignation')} className={`mt-1.5 ${fieldControlClass}`} placeholder={language === 'ar' ? 'مثال: Coordinator' : 'e.g. Coordinator'} />
                    </div>
                    <div>
                      <label className={fieldLabelClass}>{language === 'ar' ? 'المسمى الوظيفي بالعربية' : 'Arabic Designation'}</label>
                      <input {...register('authorizedPersonDesignationAr')} className={`mt-1.5 ${fieldControlClass}`} dir="rtl" />
                    </div>
                    <div className="md:col-span-2">
                      <label className={fieldLabelClass}>{language === 'ar' ? 'التوقيع' : 'Signature'}</label>
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" className="hidden" id="invoice-signature-upload" onChange={(e) => {
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
                        <label htmlFor="invoice-signature-upload" className="btn btn-secondary cursor-pointer">
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
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{language === 'ar' ? 'لم يتم رفع توقيع' : 'No signature uploaded'}</span>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className={fieldLabelClass}>{language === 'ar' ? 'الختم' : 'Stamp'}</label>
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" className="hidden" id="invoice-stamp-upload" onChange={(e) => {
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
                        <label htmlFor="invoice-stamp-upload" className="btn btn-secondary cursor-pointer">
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
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{language === 'ar' ? 'لم يتم رفع ختم' : 'No stamp uploaded'}</span>
                        )}
                      </div>
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
                    onRemove={() => { setShowTermsPanel(false); setValue('termsAndConditions', '') }}
                    placeholder={language === 'ar' ? 'أدخل الشروط والأحكام... حدد النص واضغط على عريض أو تمييز' : 'Enter terms and conditions... select text and click Bold or Highlight'}
                    rows={5}
                    language={language}
                    fieldControlClass={fieldControlClass}
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
                    onRemove={() => { setShowNotesPanel(false); setValue('notes', '') }}
                    placeholder={language === 'ar' ? 'أدخل ملاحظات الفاتورة...' : 'Enter invoice notes...'}
                    rows={4}
                    language={language}
                    fieldControlClass={fieldControlClass}
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
                    <label className={fieldLabelClass}>{language === 'ar' ? 'بيانات البنك' : 'Bank Details'}</label>
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
                      <BilingualLabel en="Bank Name" ar="اسم البنك" />
                      <input {...register('bankDetails.bankName')} className={`mt-1.5 ${fieldControlClass}`} placeholder="Al Rajhi Bank / SNB" />
                    </div>
                    <div>
                      <BilingualLabel en="Account Name" ar="اسم الحساب" />
                      <input {...register('bankDetails.accountName')} className={`mt-1.5 ${fieldControlClass}`} />
                    </div>
                    <div>
                      <BilingualLabel en="Account Number" ar="رقم الحساب" />
                      <input {...register('bankDetails.accountNumber')} className={`mt-1.5 ${fieldControlClass} font-mono`} />
                    </div>
                    <div>
                      <BilingualLabel en="IBAN" ar="الآيبان" />
                      <input {...register('bankDetails.iban')} className={`mt-1.5 ${fieldControlClass} font-mono`} placeholder="SA0000000000000000000000" />
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

          <div className={`${sectionCardClass} space-y-8`}>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <p className={sectionEyebrowClass}>
                  {language === 'ar' ? 'شروط الدفع' : 'Payment Terms'}
                </p>
                <div className="mt-4 space-y-5">
                  <div>
                    <label className={fieldLabelClass}>{language === 'ar' ? 'شرط الدفع' : 'Payment Terms'}</label>
                    <select
                      {...register('paymentTerms')}
                      className={`mt-1.5 ${fieldControlClass}`}
                      onChange={(e) => {
                        const id = e.target.value
                        setValue('paymentTerms', id, { shouldDirty: true })
                        const issueRaw = getValues('issueDate')
                        const issue = issueRaw ? new Date(issueRaw) : new Date()
                        const due = computeDueDateFromPaymentTerms(issue, id)
                        if (due) setValue('dueDate', due.toISOString().slice(0, 10), { shouldDirty: true })
                        setValue('paymentStatus', isImmediatePaymentTerm(id) ? 'paid' : 'pending', { shouldDirty: true })
                        if (isImmediatePaymentTerm(id)) {
                          setValue('paidAmount', totals.grandTotal, { shouldDirty: true })
                        } else {
                          const currentPaid = Number(getValues('paidAmount') || 0)
                          if (currentPaid >= totals.grandTotal) setValue('paidAmount', 0, { shouldDirty: true })
                        }
                      }}
                    >
                      <optgroup label={language === 'ar' ? 'الأكثر استخداماً' : 'Most used'}>
                        {INVOICE_PAYMENT_TERMS.slice(0, 8).map((term) => (
                          <option key={term.id} value={term.id}>{language === 'ar' ? term.labelAr : term.labelEn}</option>
                        ))}
                      </optgroup>
                      <optgroup label={language === 'ar' ? 'المزيد...' : 'Search more...'}>
                        {INVOICE_PAYMENT_TERMS.slice(8).map((term) => (
                          <option key={term.id} value={term.id}>{language === 'ar' ? term.labelAr : term.labelEn}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabelClass}>{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                    <input type="date" {...register('dueDate')} className={`mt-1.5 ${fieldControlClass}`} />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>{language === 'ar' ? 'مدفوعة / غير مدفوعة' : 'Paid / Unpaid'}</label>
                    <select
                      {...register('paymentStatus')}
                      className={`mt-1.5 ${fieldControlClass}`}
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
                  <div>
                    <label className={fieldLabelClass}>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</label>
                    <select {...register('paymentMethod')} className={`mt-1.5 ${fieldControlClass}`}>
                      <option value="cash">{language === 'ar' ? 'نقداً' : 'Cash'}</option>
                      <option value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</option>
                      <option value="bank_transfer">{language === 'ar' ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                      <option value="credit">{language === 'ar' ? 'آجل / ذمم' : 'Credit / Split'}</option>
                    </select>
                  </div>
                  {watch('paymentMethod') === 'credit' && watch('paymentStatus') !== 'paid' && (
                    <div>
                      <label className={fieldLabelClass}>{language === 'ar' ? 'المبلغ المدفوع (مقدم)' : 'Paid Amount (Advance)'}</label>
                      <input type="number" min="0" max={totals.grandTotal} step="0.01" {...register('paidAmount', { valueAsNumber: true, min: 0 })} className={`mt-1.5 ${fieldControlClass}`} placeholder="0.00" />
                    </div>
                  )}
                  <div>
                    <label className={fieldLabelClass}>{language === 'ar' ? 'خصم الفاتورة' : 'Invoice Discount'}</label>
                    <input type="number" min="0" step="0.01" {...register('invoiceDiscount', { valueAsNumber: true, min: 0 })} className={`mt-1.5 ${fieldControlClass}`} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 px-5 py-5 text-white dark:bg-white dark:text-slate-950 lg:sticky lg:top-4 self-start">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50 dark:text-slate-400">
                  {language === 'ar' ? 'الملخص' : 'Summary'}
                </p>
                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-white/55 dark:text-slate-500">{t('subtotal')}</span><span><Money value={totals.subtotal} /></span></div>
                  <div className="flex justify-between"><span className="text-white/55 dark:text-slate-500">{t('discount')}</span><span><Money value={totals.totalDiscount} /></span></div>
                  <div className="flex justify-between"><span className="text-white/55 dark:text-slate-500">{language === 'ar' ? 'المبلغ الخاضع للضريبة' : 'Taxable Amount'}</span><span><Money value={totals.taxableAmount} /></span></div>
                  <div className="flex justify-between"><span className="text-white/55 dark:text-slate-500">{t('tax')}</span><span><Money value={totals.totalTax} /></span></div>
                  <div className="flex justify-between border-t border-white/15 pt-3 text-lg font-semibold dark:border-slate-200"><span>{t('total')}</span><span><Money value={totals.grandTotal} /></span></div>
                </div>
              </div>
            </div>

            {isTradingContext && (
              <div className="space-y-3 border-t border-slate-200/80 pt-6 dark:border-dark-600">
                <p className={sectionEyebrowClass}>
                  {language === 'ar' ? 'المستودع' : 'Warehouse'}
                </p>
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="flex-1">
                    <select {...register('warehouseId')} className={`mt-1.5 ${fieldControlClass}`}>
                      <option value="">{language === 'ar' ? 'بدون تحديد حالياً' : 'No warehouse selected yet'}</option>
                      {(warehouses || []).map((item) => <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.nameEn) : item.nameEn}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-dark-500" onClick={() => setValue('warehouseId', '')} disabled={!selectedWarehouseId}>
                      {language === 'ar' ? 'إلغاء التحديد' : 'Clear'}
                    </button>
                    <button type="button" className="rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900" onClick={() => navigate(`/app/dashboard/warehouses/new?returnTo=${encodeURIComponent('/app/dashboard/invoices/new/sell')}`)}>
                      {language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Live preview — bottom mid */}
            <div className="space-y-4 border-t border-slate-200/80 pt-8 dark:border-dark-600">
              <div className="text-center">
                <p className={sectionEyebrowClass}>
                  {language === 'ar' ? 'المعاينة' : 'Preview'}
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {language === 'ar' ? 'المعاينة المباشرة' : 'Live Preview'}
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  {values?.printFormat === 'thermal'
                    ? (language === 'ar' ? 'معاينة بصيغة الإيصال الحراري (80 مم).' : 'Thermal 80mm receipt layout.')
                    : (language === 'ar' ? 'معاينة فاتورة A4 — تتحدث مع تغيير البيانات.' : 'A4 invoice preview — updates as you edit.')}
                </p>
              </div>
              <div className={`mx-auto w-full ${values?.printFormat === 'thermal' ? 'max-w-[340px]' : 'max-w-3xl'}`}>
                {values?.printFormat === 'thermal' ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-dark-600">
                    <ThermalReceipt
                      order={{
                        ...previewInvoice,
                        receiptNumber: previewInvoice.invoiceNumber,
                        customerName: previewInvoice.buyer?.name || previewInvoice.buyer?.nameAr || (language === 'ar' ? 'عميل نقدي' : 'Cash Customer'),
                        customerPhone: previewInvoice.buyer?.contactPhone || previewInvoice.buyer?.phone,
                        grandTotal: previewInvoice.grandTotal,
                        totalVat: previewInvoice.totalTax,
                        subtotal: previewInvoice.subtotal,
                        paymentMethod: previewInvoice.paymentMethod || 'cash',
                        createdAt: previewInvoice.issueDate,
                        zatcaQrCode: previewInvoice.zatca?.qrCodeData || generateZatcaQrValue({
                          sellerName: tenant?.business?.legalNameEn || tenant?.name,
                          vatNumber: tenant?.business?.vatNumber,
                          timestamp: previewInvoice.issueDate,
                          totalWithVat: previewInvoice.grandTotal,
                          vatTotal: previewInvoice.totalTax,
                        }),
                        items: (previewInvoice.lineItems || []).map((item) => ({
                          nameEn: item.productName || item.name,
                          nameAr: item.productNameAr || item.nameAr,
                          quantity: item.quantity,
                          unitPrice: item.unitPrice,
                          total: item.lineTotalWithTax || item.lineTotal || (Number(item.quantity || 0) * Number(item.unitPrice || 0)),
                        })),
                      }}
                      type={previewInvoice?.businessContext || tenantBusinessTypes[0] || 'trading'}
                    />
                  </div>
                ) : (
                  <InvoiceLivePreview
                    invoice={previewInvoice}
                    tenant={tenant}
                    language={language}
                    templateId={selectedTemplateId}
                    bilingual={resolveInvoiceBilingual(tenant, previewInvoice?.invoiceSubtype === 'travel_ticket' || ['travel_agency', 'trading', 'construction'].includes(previewInvoice?.businessContext))}
                    secondaryLanguage={getInvoiceSecondaryLanguage(tenant) || undefined}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => navigate(isEdit ? `/app/dashboard/invoices/${invoiceId}` : '/app/dashboard/invoices/new')} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-dark-500 dark:text-slate-300">{t('cancel')}</button>
              <button type="submit" disabled={saveMutation.isPending} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900 shadow-lg hover:opacity-95 transition">
                {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <><Eye className="w-4 h-4" />{isEdit ? (language === 'ar' ? 'معاينة وتعديل الفاتورة' : 'Preview & Update Invoice') : (language === 'ar' ? 'معاينة وحفظ الفاتورة' : 'Preview & Save Invoice')}</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      <DocumentPreSaveModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmSave}
        isPending={saveMutation.isPending}
        document={previewInvoice}
        tenant={tenant}
        language={language}
        documentType="invoice"
        templateId={selectedTemplateId}
        title={language === 'ar' ? 'معاينة الفاتورة قبل الحفظ' : 'Invoice Live Preview'}
      />
    </div>
  )
 }


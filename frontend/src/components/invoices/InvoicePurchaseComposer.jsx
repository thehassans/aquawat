import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock3, PackageCheck, Plus, Trash2, UploadCloud, FileText, Receipt, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { contactToSupplier, fetchContactsList } from '../../lib/contactMappers'
import { useTranslation } from '../../lib/translations'
import Money from '../ui/Money'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { isPakistanTenant, getTaxLabel, getTaxIdLabel, getTenantCountryCode, showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'
import { getAvailableUomOptions, getDefaultUom, getUomLabel } from '../../lib/uomOptions'
import { useLiveTranslation, useBilingualAddressFields, LineItemTranslator } from '../../lib/liveTranslation'
import DocumentPreSaveModal from './DocumentPreSaveModal'
import TravelInvoiceFields from './TravelInvoiceFields'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { INVOICE_PAYMENT_TERMS, computeDueDateFromPaymentTerms, isImmediatePaymentTerm, formPaymentStatusFromInvoice, applyFormPaymentToPayload } from '../../lib/invoicePaymentTerms'
import { normalizeProductType, productPickerLabel, productDisplayName, resolveProductPurchasePrice, hasArabicScript } from '../../lib/productType'
import VariantLineSelect from '../inventory/VariantLineSelect'
import RichTextNoteField from './RichTextNoteField'
import PurchaseReceivingLedger from '../../pages/purchases/PurchaseReceivingLedger'
import PartnerCombobox from '../inventory/PartnerCombobox'
import CustomerSummaryCard from '../sales/CustomerSummaryCard'
import { PURCHASES_PATH, formatDay, ghostBtn, primaryBtn } from '../../pages/purchases/purchasesUi'
import {
  fieldControlClass,
  fieldLabelClass,
  sectionCardClass,
} from '../../pages/sales/salesUi'
import { normalizeGrnList } from '../../lib/grnApi'
import InvoiceJournalItemsPanel, { InvoiceDocumentReferencesBar } from './InvoiceJournalItemsPanel'
import AccountingDocumentShell from '../accounting/AccountingDocumentShell'
import VendorBillOcrPanel from '../accounting/VendorBillOcrPanel'
import {
  BILL_STATUS_STEPS,
  isVendorRefund,
  resolveInvoiceRibbonStep,
  VENDOR_REFUND_STATUS_STEPS,
} from '../../lib/accountingDocumentStatus'

const denseControlClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-400'
const lineGhostInputClass =
  'w-full rounded-md border-0 bg-transparent px-1.5 py-1.5 text-[13px] font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:bg-slate-50 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/5'
const compactFieldClass = `mt-0.5 ${denseControlClass}`
const lineSelectStyles = {
  control: (base, state) => ({
    ...base,
    border: 'none',
    boxShadow: 'none',
    minHeight: 32,
    backgroundColor: state.isFocused ? 'rgba(248,250,252,0.9)' : 'transparent',
    borderRadius: '0.375rem',
    cursor: 'pointer',
  }),
  valueContainer: (base) => ({ ...base, padding: '0 4px' }),
  indicatorsContainer: (base) => ({ ...base, height: 32 }),
  dropdownIndicator: (base) => ({ ...base, padding: 4, color: '#94a3b8' }),
  clearIndicator: (base) => ({ ...base, padding: 4 }),
  indicatorSeparator: () => ({ display: 'none' }),
  singleValue: (base) => ({ ...base, color: '#0f172a', fontWeight: 500, fontSize: '0.8125rem' }),
  placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.8125rem' }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    overflow: 'hidden',
    boxShadow: '0 12px 40px -12px rgba(15,23,42,0.28)',
    minWidth: 160,
  }),
}

const toDateInput = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const getEmptyLine = (tenant) => ({
  productId: '',
  variantId: '',
  productName: '',
  productNameAr: '',
  productType: 'goods',
  unitCode: getDefaultUom(tenant) || '',
  quantity: 1,
  unitPrice: '',
  taxRate: 15,
  sourcePoItemId: '',
  expenseAccountId: '',
  analyticAccountId: '',
})

const purchaseContexts = ['trading', 'construction', 'travel_agency', 'furniture', 'furniture_shop']

function BilingualLabel({ en, ar, showArabic = true }) {
  return (
    <label className={`${fieldLabelClass} !mb-0.5 !flex items-baseline justify-between gap-2 text-[11px]`} dir="ltr">
      <span>{en}</span>
      {showArabic && ar ? <span dir="rtl" className="font-medium text-slate-500 dark:text-slate-400">{ar}</span> : null}
    </label>
  )
}

const buildPurchaseInvoiceFormValues = ({ invoice, tenant, defaultBusinessContext, hasTravel }) => {
  const empty = getEmptyLine(tenant)
  return {
    businessContext: invoice?.businessContext || defaultBusinessContext,
    invoiceSubtype: invoice?.invoiceSubtype || (hasTravel ? 'travel_ticket' : 'standard'),
    pdfTemplateId: invoice?.pdfTemplateId || getInvoiceTemplateId(tenant, invoice?.businessContext || defaultBusinessContext),
    transactionType: 'B2B',
    invoiceTypeCode: '0100000',
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
    paymentTerms: invoice?.paymentTerms || 'immediate',
    contractNumber: invoice?.contractNumber || '',
    issueDate: toDateInput(invoice?.issueDate) || toDateInput(new Date()),
    accountingDate: toDateInput(invoice?.accountingDate) || toDateInput(invoice?.issueDate) || toDateInput(new Date()),
    printFormat: invoice?.printFormat === 'thermal' ? 'thermal' : 'a4',
    dueDate: (() => {
      if (invoice?.dueDate) return toDateInput(invoice.dueDate)
      const issue = invoice?.issueDate ? new Date(invoice.issueDate) : new Date()
      const due = computeDueDateFromPaymentTerms(issue, invoice?.paymentTerms || 'immediate')
      return due ? due.toISOString().slice(0, 10) : ''
    })(),
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
          variantId: line?.variantId || '',
          productName: line?.productName || '',
          productNameAr: line?.productNameAr || '',
          productType: normalizeProductType(line?.productType),
          unitCode: line?.unitCode !== undefined ? (line.unitCode || '') : empty.unitCode,
          quantity: Math.max(0.0001, toNumber(line?.quantity, 1)),
          unitPrice: Math.max(0, toNumber(line?.unitPrice, 0)),
          taxRate: Math.max(0, toNumber(line?.taxRate, 15)),
          sourcePoItemId: line?.sourcePoItemId || '',
          expenseAccountId: line?.expenseAccountId || '',
          analyticAccountId: line?.analyticAccountId || '',
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
  const partnerIdParam = String(searchParams.get('partnerId') || '').trim()
  const isEdit = Boolean(invoiceId)
  const isManualRefund = !isEdit && ['1', 'true', 'refund', '381'].includes(String(searchParams.get('refund') || '').toLowerCase())
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [transactionType, setTransactionType] = useState('B2B')
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const [selectedSupplier, setSelectedSupplier] = useState(() => {
    const s = initialInvoice?.supplierId
    return s && typeof s === 'object' ? s : null
  })
  const [selectedPoId, setSelectedPoId] = useState(
    () => partyId(initialInvoice?.sourcePurchaseOrderId) || poIdParam
  )
  const filledPoIdRef = useRef('')
  const shouldFillFromPoRef = useRef(Boolean(poIdParam) && !isEdit)
  const [documentReferences, setDocumentReferences] = useState(
    () => (Array.isArray(initialInvoice?.documentReferences) ? initialInvoice.documentReferences : [])
  )
  const [accountingLines, setAccountingLines] = useState(
    () => (Array.isArray(initialInvoice?.accountingLines) ? initialInvoice.accountingLines : [])
  )
  const [sourceGrnIds, setSourceGrnIds] = useState(
    () => (Array.isArray(initialInvoice?.sourceGrnIds)
      ? initialInvoice.sourceGrnIds.map((id) => (id && typeof id === 'object' ? String(id._id) : String(id))).filter(Boolean)
      : [])
  )
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
  const isTradingContext = businessContext === 'trading'
  const isTravelContext = businessContext === 'travel_agency'
  const isRestaurantContext = businessContext === 'restaurant'
  const isManpowerContext = businessContext === 'manpower'
  const emptyLine = useMemo(() => getEmptyLine(tenant), [tenant])
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
    setTransactionType('B2B')
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

  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 200 } })
      const list = res.data?.products ?? res.data?.items ?? res.data
      return Array.isArray(list) ? list : []
    },
    enabled: isTradingContext,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses')
      const list = res.data?.warehouses ?? res.data?.items ?? res.data
      return Array.isArray(list) ? list : []
    },
    enabled: isTradingContext,
  })

  const productList = Array.isArray(products) ? products : []
  const warehouseList = Array.isArray(warehouses) ? warehouses : []

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: async () => {
      const { contacts } = await fetchContactsList(api, { types: 'supplier', limit: 200, isActive: 'all' })
      return contacts.filter((c) => c.entityType === 'supplier').map(contactToSupplier)
    },
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

  const { data: relatedGrns = [] } = useQuery({
    queryKey: ['grn', 'by-po', selectedPoId],
    queryFn: () => api.get('/grn', {
      params: { purchaseOrderId: selectedPoId, limit: 50 },
    }).then((res) => normalizeGrnList(res.data)),
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
            transactionType: 'B2B',
            invoiceTypeCode: '0100000',
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
      setShowPreviewModal(false)
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث فاتورة الشراء بنجاح' : 'Purchase invoice updated successfully') : (language === 'ar' ? 'تم إنشاء فاتورة الشراء بنجاح' : 'Purchase invoice created successfully'))
      queryClient.invalidateQueries(['invoices'])
      if (isEdit) {
        queryClient.invalidateQueries(['invoice', invoiceId])
      }
      if (res.data?.offline) {
        navigate('/app/dashboard/accounting/invoices')
      } else {
        navigate(`/app/dashboard/accounting/invoices/${res.data?._id || invoiceId}`)
      }
    },
    onError: (error) => {
      const data = error.response?.data
      if (data?.code === 'THREE_WAY_MATCH' && Array.isArray(data.exceptions) && data.exceptions.length) {
        const first = data.exceptions[0]
        toast.error(
          `${data.error}: ${first.message || first.type}${data.exceptions.length > 1 ? ` (+${data.exceptions.length - 1})` : ''}`,
          { duration: 8000 },
        )
        return
      }
      if (data?.code === 'DUPLICATE_BILL_REFERENCE' || data?.code === 'BILL_REFERENCE_REQUIRED') {
        toast.error(data.error || (language === 'ar' ? 'مرجع الفاتورة مكرر أو ناقص' : 'Bill reference missing or duplicate'))
        return
      }
      toast.error(data?.error || (isEdit ? 'Failed to update purchase invoice' : 'Failed to create purchase invoice'))
    },
  })

  const billLinesForMatch = useMemo(
    () => (lineItems || [])
      .filter((line) => line?.productId && toNumber(line.quantity, 0) > 0)
      .map((line) => ({
        productId: line.productId,
        variantId: line.variantId || undefined,
        quantity: toNumber(line.quantity, 0),
        unitPrice: toNumber(line.unitPrice, 0),
      })),
    [lineItems],
  )

  const threeWayQuery = useQuery({
    queryKey: ['three-way-match', selectedPoId, JSON.stringify(billLinesForMatch)],
    queryFn: () => api.post('/invoices/three-way-match', {
      purchaseOrderId: selectedPoId,
      billLines: billLinesForMatch,
    }).then((r) => r.data),
    enabled: Boolean(isTradingContext && selectedPoId && billLinesForMatch.length > 0),
    staleTime: 5_000,
  })

  const lineMatchWarnings = useMemo(() => {
    const map = {}
    for (const ex of threeWayQuery.data?.exceptions || []) {
      if (!ex?.productId) continue
      const key = String(ex.productId)
      const prev = map[key] || { productId: key, types: [] }
      prev.types = [...new Set([...(prev.types || []), ex.type].filter(Boolean))]
      map[key] = { ...prev, ...ex, type: ex.type === 'price_mismatch' && prev.type === 'qty_mismatch' ? 'qty_mismatch' : (ex.type || prev.type) }
      if (ex.type === 'qty_mismatch') {
        map[key].qty = ex
        map[key].type = map[key].price ? 'qty_mismatch' : 'qty_mismatch'
      }
      if (ex.type === 'price_mismatch') {
        map[key].price = ex
      }
      if (ex.type === 'unknown_product') {
        map[key].type = 'unknown_product'
      }
    }
    return map
  }, [threeWayQuery.data])

  const activeSupplierId = watch('supplierId') || selectedSupplier?._id || ''

  const { data: vendorPredictions } = useQuery({
    queryKey: ['vendor-account-predictions', activeSupplierId],
    queryFn: () => api.get('/invoices/purchase/vendor-account-predictions', {
      params: { supplierId: activeSupplierId },
    }).then((r) => r.data),
    enabled: Boolean(activeSupplierId),
    staleTime: 120_000,
  })

  const { data: expenseAccounts = [] } = useQuery({
    queryKey: ['accounting-accounts-active'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    staleTime: 60_000,
  })

  const { data: analyticAccounts = [] } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
    staleTime: 60_000,
  })

  const isBillPosted = isEdit && initialInvoice && !['draft', 'pending'].includes(String(initialInvoice.status || ''))

  const onSelectProduct = (index, productId) => {
    const product = productList.find((item) => item._id === productId)
    if (!product) return
    const opts = { shouldDirty: true, shouldTouch: true }
    setValue(`lineItems.${index}.productId`, product._id, opts)
    setValue(`lineItems.${index}.variantId`, '', opts)
    setValue(`lineItems.${index}.productName`, productDisplayName(product, 'en'), opts)
    setValue(`lineItems.${index}.productNameAr`, hasArabicScript(product.nameAr) ? String(product.nameAr).trim() : '', opts)
    setValue(`lineItems.${index}.unitCode`, product.unitOfMeasure || 'PCE', opts)
    setValue(`lineItems.${index}.taxRate`, typeof product.purchaseTaxRate === 'number' ? product.purchaseTaxRate : (typeof product.taxRate === 'number' ? product.taxRate : 15), opts)
    setValue(`lineItems.${index}.productType`, normalizeProductType(product.productType), opts)
    setValue(`lineItems.${index}.unitPrice`, resolveProductPurchasePrice(product), opts)
    const predictedAccount = vendorPredictions?.byProduct?.[productId] || vendorPredictions?.defaultAccountId
    if (predictedAccount) {
      setValue(`lineItems.${index}.expenseAccountId`, predictedAccount, opts)
    }
    if (product.expenseAccountId) {
      setValue(`lineItems.${index}.expenseAccountId`, product.expenseAccountId, opts)
    }
  }

  const fillSellerFromParty = (supplier) => {
    if (!supplier) return
    const id = partyId(supplier)
    if (id) setValue('supplierId', id)
    setValue('seller.name', supplier.nameEn || supplier.nameAr || supplier.name || '')
    setValue('seller.nameAr', supplier.nameAr || supplier.nameEn || supplier.name || '')
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
    setSelectedSupplier(supplier)
  }

  const onSelectSupplier = (supplierId, opt) => {
    if (!supplierId) {
      setValue('supplierId', '')
      setSelectedSupplier(null)
      return
    }
    if (opt) {
      fillSellerFromParty(opt)
      return
    }
    const supplier = (suppliers || []).find((item) => item._id === supplierId)
    if (supplier) {
      fillSellerFromParty(supplier)
      return
    }
    api.get(`/suppliers/${supplierId}`).then((res) => {
      if (res.data) fillSellerFromParty(res.data)
    }).catch(() => {})
  }

  useEffect(() => {
    if (!partnerIdParam || isEdit) return
    let cancelled = false
    api.get(`/suppliers/${partnerIdParam}`).then((res) => {
      if (cancelled || !res.data) return
      fillSellerFromParty(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerIdParam, isEdit])

  useEffect(() => {
    const s = initialInvoice?.supplierId
    if (!s) return
    if (typeof s === 'object') {
      setSelectedSupplier(s)
      return
    }
    let cancelled = false
    api.get(`/suppliers/${s}`).then((res) => {
      if (!cancelled && res.data) setSelectedSupplier(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [initialInvoice?.supplierId])

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
        quantity: (() => {
          const received = toNumber(li?.quantityReceived, 0)
          if (received > 0) return Math.max(0.0001, received)
          return Math.max(0.0001, toNumber(li?.quantityOrdered ?? li?.quantity, 1) - toNumber(li?.quantityReturned, 0))
        })(),
        unitPrice: Math.max(0, toNumber(li?.unitCost ?? li?.unitPrice, 0)),
        taxRate: Math.max(0, toNumber(li?.taxRate, 15)),
        sourcePoItemId: li?._id || '',
      }
    })
    replace(items.length ? items : [emptyLine])
    const grnList = Array.isArray(relatedGrns) ? relatedGrns : []
    const grnIds = grnList.map((g) => g._id).filter(Boolean)
    setSourceGrnIds(grnIds)
    setDocumentReferences([
      {
        kind: 'purchase_order',
        docId: po._id,
        number: po.poNumber || '',
        label: po.poNumber || '',
      },
      ...grnList.map((g) => ({
        kind: 'grn',
        docId: g._id,
        number: g.grnNumber || '',
        label: g.grnNumber || '',
      })),
    ])
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

  useEffect(() => {
    if (!selectedPoId || !selectedPo?._id) return
    const grnList = Array.isArray(relatedGrns) ? relatedGrns : []
    const grnIds = grnList.map((g) => g._id).filter(Boolean)
    setSourceGrnIds(grnIds)
    setDocumentReferences((prev) => {
      const withoutGrns = (Array.isArray(prev) ? prev : []).filter((r) => r.kind !== 'grn')
      const hasPo = withoutGrns.some((r) => r.kind === 'purchase_order')
      const next = [...withoutGrns]
      if (!hasPo) {
        next.unshift({
          kind: 'purchase_order',
          docId: selectedPo._id,
          number: selectedPo.poNumber || '',
          label: selectedPo.poNumber || '',
        })
      }
      return [
        ...next,
        ...grnList.map((g) => ({
          kind: 'grn',
          docId: g._id,
          number: g.grnNumber || '',
          label: g.grnNumber || '',
        })),
      ]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedGrns, selectedPoId, selectedPo?._id, selectedPo?.poNumber])

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
  const [formTab, setFormTab] = useState('lines')
  const [pendingPayload, setPendingPayload] = useState(null)
  const [showOcrPanel, setShowOcrPanel] = useState(false)
  const [ocrAttachment, setOcrAttachment] = useState(null)

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
    const issueDate = (() => {
      const raw = typeof data?.issueDate === 'string' ? data.issueDate.trim() : ''
      if (raw) return new Date(`${raw}T12:00:00`)
      return isEdit ? (initialInvoice?.issueDate || new Date()) : new Date()
    })()
    const accountingDate = (() => {
      const raw = typeof data?.accountingDate === 'string' ? data.accountingDate.trim() : ''
      if (raw) return new Date(`${raw}T12:00:00`)
      return issueDate
    })()
    const payload = {
      ...data,
      flow: 'purchase',
      businessContext,
      invoiceSubtype,
      pdfTemplateId: selectedTemplateId,
      transactionType: 'B2B',
      invoiceTypeCode: '0100000',
      invoiceType: isManualRefund || isVendorRefund(initialInvoice || {}) ? '381' : (initialInvoice?.invoiceType || '388'),
      status: 'approved',
      issueDate,
      accountingDate,
      printFormat: data?.printFormat === 'thermal' ? 'thermal' : 'a4',
      paymentTerms: data?.paymentTerms || 'immediate',
      dueDate: (() => {
        const raw = typeof data?.dueDate === 'string' ? data.dueDate.trim() : ''
        if (raw) return new Date(`${raw}T12:00:00`)
        return computeDueDateFromPaymentTerms(issueDate, data?.paymentTerms || 'immediate') || undefined
      })(),
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
      if (selectedPo?.poNumber || data.purchaseOrderNumber) {
        payload.purchaseOrderNumber = selectedPo?.poNumber || data.purchaseOrderNumber
      }
      if (Array.isArray(sourceGrnIds) && sourceGrnIds.length) {
        payload.sourceGrnIds = sourceGrnIds
      }
      if (Array.isArray(documentReferences) && documentReferences.length) {
        payload.documentReferences = documentReferences
      }
      if (Array.isArray(accountingLines) && accountingLines.length) {
        payload.accountingLines = accountingLines
      }
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
    if (isBillPosted) {
      toast.error(language === 'ar' ? 'الفاتورة مرحّلة — للعرض فقط' : 'Posted bill is read-only')
      return
    }
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

  const availablePurchaseContexts = tenantBusinessTypes.filter((type) => purchaseContexts.includes(type))
  const segmentWrapClass =
    'inline-flex items-center rounded-xl border border-slate-200/90 bg-slate-50/80 p-0.5 dark:border-white/10 dark:bg-dark-900/50'
  const segmentBtnClass = (active) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-700 dark:text-white'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
    }`
  const companyLine = [
    tenant?.business?.legalNameEn || tenant?.name,
    tenant?.business?.vatNumber || tenant?.fbr?.ntn || tenant?.business?.ntn
      ? `${isPk ? 'NTN' : 'VAT'} ${tenant?.business?.vatNumber || tenant?.fbr?.ntn || tenant?.business?.ntn}`
      : null,
    tenant?.business?.crNumber ? `CR ${tenant.business.crNumber}` : null,
  ].filter(Boolean).join(' · ')

  const setTxnType = () => {
    // Vendor bills are always B2B — B2C path is disabled.
    setTransactionType('B2B')
    setValue('transactionType', 'B2B', { shouldDirty: true })
    setValue('invoiceTypeCode', '0100000', { shouldDirty: true })
  }

  const isRefundDoc = isManualRefund || isVendorRefund(initialInvoice || {})
  const ribbonStep = resolveInvoiceRibbonStep(initialInvoice || { status: 'draft', flow: 'purchase', invoiceType: isRefundDoc ? '381' : '388' })
  const statusSteps = isRefundDoc ? VENDOR_REFUND_STATUS_STEPS : BILL_STATUS_STEPS
  const lineCount = (lineItems || []).filter((line) => line?.productName || line?.productId || Number(line?.unitPrice) > 0).length

  const applyOcrToForm = (extracted) => {
    if (!extracted) return
    const supplier = extracted.supplier || {}
    if (supplier.name || supplier.nameAr) {
      setValue('seller.name', supplier.name || supplier.nameEn || '')
      setValue('seller.nameAr', supplier.nameAr || supplier.name || '')
      setValue('seller.vatNumber', supplier.vatNumber || '')
    }
    if (extracted.issueDate) setValue('issueDate', extracted.issueDate)
    if (extracted.notes) setValue('notes', extracted.notes)
    if (extracted.grandTotal || extracted.totalAmount) {
      /* totals recalc from lines when present */
    }
    const ocrLines = Array.isArray(extracted.lineItems) ? extracted.lineItems : []
    if (ocrLines.length) {
      replace(ocrLines.map((line, index) => ({
        productName: line.name || line.productName || '',
        productNameAr: line.nameAr || line.productNameAr || '',
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unitPrice) || 0,
        taxRate: Number(line.taxRate) || 15,
        unitCode: line.unitCode || 'PCE',
        productType: 'goods',
        lineNumber: index + 1,
      })))
    }
    setShowOcrPanel(false)
    toast.success(language === 'ar' ? 'تم تطبيق بيانات OCR' : 'OCR data applied to draft')
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-6xl space-y-2.5">
        <AccountingDocumentShell
          language={language}
          backTo={isEdit ? `/app/dashboard/accounting/invoices/${invoiceId}` : (isRefundDoc ? '/app/dashboard/accounting/vendor-refunds' : '/app/dashboard/accounting/vendor-bills')}
          eyebrow={isRefundDoc ? (language === 'ar' ? 'مرتجع مورد' : 'Vendor refund') : (language === 'ar' ? 'فاتورة مورد' : 'Vendor bill')}
          title={initialInvoice?.invoiceNumber || (language === 'ar' ? 'مسودة جديدة' : 'New draft')}
          subtitle={language === 'ar' ? 'منشئ المستند' : 'Document builder'}
          statusSteps={statusSteps}
          activeStatusStep={ribbonStep}
          tabs={[
            { id: 'lines', labelEn: isRefundDoc ? 'Refund lines' : 'Bill lines', labelAr: isRefundDoc ? 'بنود المرتجع' : 'بنود الفاتورة', count: lineCount || undefined },
            { id: 'journal', labelEn: 'Journal items', labelAr: 'بنود القيد' },
            { id: 'other', labelEn: 'Other info', labelAr: 'معلومات أخرى' },
          ]}
          activeTab={formTab}
          onTabChange={setFormTab}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isBillPosted) {
              toast.error(language === 'ar' ? 'الفاتورة مرحّلة — للعرض فقط' : 'Posted bill is read-only')
              return
            }
            handleSubmit(onSubmit, () => toast.error(language === 'ar' ? 'أكمل البنود المطلوبة قبل الحفظ' : 'Complete the billing lines before saving'))()
          }}
          className="space-y-2.5"
        >
          {isBillPosted ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {language === 'ar' ? 'فاتورة مرحّلة — التعديل مقفل (عرض وبنود القيد فقط).' : 'Posted bill — editing is locked (view and journal items only).'}
            </div>
          ) : null}
          <div className={`${sectionCardClass} !p-3 space-y-2`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {isRefundDoc
                  ? (language === 'ar' ? 'مرتجع مورد · B2B' : 'Vendor refund · B2B')
                  : (language === 'ar' ? 'فاتورة مورد · B2B' : 'Vendor bill · B2B')}
              </span>
              <div className="ms-auto flex min-w-0 max-w-full items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
                  <img
                    src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-lg border border-slate-200/80 object-contain bg-white p-0.5 dark:border-white/10"
                  />
                ) : null}
                <span className="truncate font-medium text-slate-700 dark:text-slate-200" title={companyLine}>
                  {companyLine || (language === 'ar' ? 'بيانات المنشأة' : 'Company')}
                </span>
              </div>
            </div>
            <input type="hidden" {...register('printFormat')} value="a4" />
            <input type="hidden" {...register('businessContext')} />
            <input type="hidden" {...register('invoiceSubtype')} />
            <input type="hidden" {...register('pdfTemplateId')} />
            <input type="hidden" {...register('transactionType')} value="B2B" />
          </div>

          {availablePurchaseContexts.length > 1 ? (
            <div className={`${sectionCardClass} !p-2.5`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {language === 'ar' ? 'السياق' : 'Context'}
                </span>
                <div className={segmentWrapClass}>
                  {availablePurchaseContexts.map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={isBillPosted}
                      onClick={() => setValue('businessContext', type, { shouldDirty: true })}
                      className={segmentBtnClass(businessContext === type)}
                    >
                      {type === 'trading'
                        ? (language === 'ar' ? 'تجارة' : 'Trading')
                        : type === 'construction'
                          ? (language === 'ar' ? 'مقاولات' : 'Construction')
                          : type === 'furniture' || type === 'furniture_shop'
                            ? (language === 'ar' ? 'أثاث' : 'Furniture')
                            : (language === 'ar' ? 'سفر' : 'Travel')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {formTab === 'lines' && (
          <>
          {!isEdit ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowOcrPanel((v) => !v)}
              >
                {language === 'ar' ? 'رفع فاتورة PDF (OCR)' : 'Upload bill PDF (OCR)'}
              </button>
              {vendorPredictions?.sampleSize > 0 ? (
                <span className="text-[11px] text-sky-700 dark:text-sky-300">
                  {language === 'ar'
                    ? `توقع الحسابات من ${vendorPredictions.sampleSize} فاتورة سابقة`
                    : `Account prediction from ${vendorPredictions.sampleSize} past bills`}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className={showOcrPanel && !isEdit ? 'grid gap-3 lg:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.2fr)]' : ''}>
          {showOcrPanel && !isEdit ? (
            <div className="lg:sticky lg:top-3 lg:self-start">
              <VendorBillOcrPanel
                language={language}
                onApply={(data, file) => {
                  setOcrAttachment(file)
                  applyOcrToForm(data)
                }}
                onClose={() => setShowOcrPanel(false)}
              />
            </div>
          ) : null}
          <div className="min-w-0 space-y-2.5">
          {threeWayQuery.data?.ok === false && (threeWayQuery.data?.exceptions || []).length ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-2 text-xs text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200">
              {language === 'ar' ? 'تحذير مطابقة ثلاثية:' : '3-way match warning:'}{' '}
              {(threeWayQuery.data.exceptions || []).slice(0, 2).map((ex) => ex.message).join(' · ')}
            </div>
          ) : null}
          <div className={`${sectionCardClass} grid grid-cols-1 gap-3 !p-3.5 md:grid-cols-3`}>
            <div>
              <label className={fieldLabelClass}>{language === 'ar' ? 'تاريخ الفاتورة' : 'Bill date'}</label>
              <input type="date" {...register('issueDate')} disabled={isBillPosted} className={`mt-1 ${denseControlClass} disabled:opacity-60`} />
            </div>
            <div>
              <label className={fieldLabelClass}>{language === 'ar' ? 'تاريخ المحاسبة' : 'Accounting date'}</label>
              <input type="date" {...register('accountingDate')} disabled={isBillPosted} className={`mt-1 ${denseControlClass} disabled:opacity-60`} title={language === 'ar' ? 'يمكن أن يختلف عن تاريخ الفاتورة' : 'May differ from bill date'} />
            </div>
            <div>
              <label className={fieldLabelClass}>
                {language === 'ar' ? 'مرجع المورد' : 'Bill reference'}
                <span className="ms-0.5 text-rose-500" aria-hidden>*</span>
              </label>
              <input
                {...register('contractNumber', { required: true })}
                disabled={isBillPosted}
                required
                aria-required="true"
                className={`mt-1 ${denseControlClass} disabled:opacity-60`}
                placeholder={language === 'ar' ? 'رقم فاتورة المورد' : 'Supplier invoice number'}
              />
            </div>
          </div>

          <div className={`${sectionCardClass} space-y-2.5 !p-3.5`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'المورد' : 'Supplier'}
              </h3>
            </div>

            {isTravelContext ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className={segmentWrapClass}>
                  <button
                    type="button"
                    onClick={() => setValue('invoiceSubtype', 'travel_ticket', { shouldDirty: true })}
                    className={segmentBtnClass(invoiceSubtype === 'travel_ticket')}
                  >
                    {language === 'ar' ? 'سفر / تذاكر' : 'Travel / Ticket'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('invoiceSubtype', 'standard', { shouldDirty: true })}
                    className={segmentBtnClass(invoiceSubtype === 'standard')}
                  >
                    {language === 'ar' ? 'قياسية' : 'Standard'}
                  </button>
                </div>
              </div>
            ) : null}

            {isTradingContext ? (
              <>
                <PartnerCombobox
                  role="vendor"
                  value={values?.supplierId || ''}
                  selectedOption={selectedSupplier}
                  ar={language === 'ar'}
                  language={language}
                  onChange={onSelectSupplier}
                  showNewButton
                />
                {selectedSupplier?._id ? (
                  <CustomerSummaryCard
                    customer={{
                      ...selectedSupplier,
                      name: selectedSupplier.nameEn || selectedSupplier.name || selectedSupplier.nameAr,
                    }}
                    language={language}
                    onClear={() => onSelectSupplier('', null)}
                  />
                ) : (
                  <p className="text-[11px] text-slate-400">
                    {language === 'ar'
                      ? 'اختر مورداً من القائمة أو أنشئ مورداً جديداً'
                      : 'Pick a supplier or tap New to create one'}
                  </p>
                )}
                <input type="hidden" {...register('supplierId')} />
                <input type="hidden" {...register('warehouseId')} />

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {language === 'ar' ? 'طلب الشراء' : 'Purchase order'}
                  </label>
                  <select
                    value={selectedPoId}
                    onChange={(e) => {
                      const next = e.target.value
                      setSelectedPoId(next)
                      setValue('sourcePurchaseOrderId', next)
                      filledPoIdRef.current = ''
                      shouldFillFromPoRef.current = Boolean(next)
                      if (!next) {
                        replace([emptyLine])
                        setDocumentReferences([])
                        setSourceGrnIds([])
                      }
                    }}
                    className={`mt-1 ${denseControlClass}`}
                  >
                    <option value="">{language === 'ar' ? 'اختر طلب شراء…' : 'Select a purchase order…'}</option>
                    {(Array.isArray(purchaseOrders) ? purchaseOrders : []).map((po) => (
                      <option key={po._id} value={po._id}>
                        {po.poNumber} — {language === 'ar' ? (po.supplierId?.nameAr || po.supplierId?.nameEn || '') : (po.supplierId?.nameEn || po.supplierId?.nameAr || '')}
                      </option>
                    ))}
                  </select>
                  <input type="hidden" {...register('sourcePurchaseOrderId')} />
                </div>

                {documentReferences.length ? (
                  <InvoiceDocumentReferencesBar references={documentReferences} language={language} />
                ) : null}

                {selectedPo?._id ? (
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="grid flex-1 gap-2 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'تاريخ الاستلام المتوقع' : 'Estimated receive date'}</p>
                            <p className="mt-0.5 text-[13px] font-medium text-slate-900 dark:text-white">{formatDay(selectedPo.expectedDate, language)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'الاستلام الجزئي' : 'Partial received'}</p>
                            <p className="mt-0.5 text-[13px] font-medium text-slate-900 dark:text-white">
                              {selectedPo.status === 'partially_received' || Number(selectedPo.receivingLedger?.receivedCount || 0) > 0
                                ? (language === 'ar' ? 'نعم' : 'Yes')
                                : (language === 'ar' ? 'لا' : 'No')}
                              {selectedPo.receivingLedger ? ` · ${selectedPo.receivingLedger.receivedCount || 0}/${(selectedPo.receivingLedger.lines || []).length}` : ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'تواريخ التأخير' : 'Delayed receive dates'}</p>
                            <p className="mt-0.5 text-[13px] font-medium text-slate-900 dark:text-white">
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
                            className={primaryBtn.replace('px-4 py-2.5', 'px-3 py-1.5 text-[12px]')}
                          >
                            <Clock3 className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'استلام مبكر' : 'Receive early'}
                          </Link>
                        ) : (
                          <Link
                            to={`${PURCHASES_PATH.grn}/new?poId=${selectedPo._id}`}
                            className={ghostBtn.replace('px-3.5 py-2.5', 'px-3 py-1.5 text-[12px]')}
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'استلام' : 'Receive'}
                          </Link>
                        )}
                      </div>
                      <div className="mt-3">
                        <PurchaseReceivingLedger order={selectedPo} language={language} />
                      </div>
                    </div>
                    {!isEdit && billLinesForMatch.length > 0 ? (
                      <div
                        className={`rounded-xl border p-3 ${
                          threeWayQuery.data?.ok === false
                            ? 'border-rose-200 bg-rose-50/80 dark:border-rose-500/30 dark:bg-rose-500/10'
                            : threeWayQuery.data?.ok
                              ? 'border-teal-200 bg-teal-50/70 dark:border-teal-500/30 dark:bg-teal-500/10'
                              : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {language === 'ar' ? 'مطابقة ثلاثية (طلب ↔ استلام ↔ فاتورة)' : 'Three-way match (PO ↔ received ↔ bill)'}
                          </p>
                          {threeWayQuery.isFetching ? (
                            <span className="text-xs text-slate-500">{language === 'ar' ? 'جارٍ التحقق…' : 'Checking…'}</span>
                          ) : threeWayQuery.data?.ok ? (
                            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                              {language === 'ar' ? 'مطابقة ناجحة' : 'Match OK'}
                            </span>
                          ) : threeWayQuery.data?.ok === false ? (
                            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                              {language === 'ar' ? 'محظورة حتى الإصلاح' : 'Blocked until fixed'}
                            </span>
                          ) : null}
                        </div>
                        {Array.isArray(threeWayQuery.data?.exceptions) && threeWayQuery.data.exceptions.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-sm text-rose-800 dark:text-rose-200">
                            {threeWayQuery.data.exceptions.map((ex, i) => (
                              <li key={`${ex.type}-${ex.productId}-${i}`}>
                                • {ex.message || ex.type}
                                {ex.billedQty != null && ex.remainingBillable != null
                                  ? ` (${language === 'ar' ? 'المفوتر' : 'billed'} ${ex.billedQty} / ${language === 'ar' ? 'المتبقي' : 'remaining'} ${ex.remainingBillable})`
                                  : ''}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="mt-1.5 text-xs text-slate-500">
                          {language === 'ar'
                            ? 'الفوترة فوق الكمية المستلمة تُرفض عند الحفظ.'
                            : 'Billing more than received quantity is rejected on save.'}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {invoiceSubtype === 'travel_ticket' ? (
              <TravelInvoiceFields
                language={language}
                register={register}
                control={control}
                watch={watch}
                setValue={setValue}
                partyPrefix="seller"
                partyNameLabel={language === 'ar' ? 'اسم المورد / الجهة' : 'Vendor / Supplier Name'}
              />
            ) : (
              <>
                <input type="hidden" {...register('seller.name')} />
                <input type="hidden" {...register('seller.nameAr')} />
                <input type="hidden" {...register('seller.vatNumber')} />
                <input type="hidden" {...register('seller.crNumber')} />
                <input type="hidden" {...register('seller.contactPhone')} />
                <input type="hidden" {...register('seller.contactEmail')} />
                <input type="hidden" {...register('seller.address.city')} />
                <input type="hidden" {...register('seller.address.cityAr')} />
                <input type="hidden" {...register('seller.address.district')} />
                <input type="hidden" {...register('seller.address.districtAr')} />
                <input type="hidden" {...register('seller.address.street')} />
                <input type="hidden" {...register('seller.address.streetAr')} />
                <input type="hidden" {...register('seller.address.postalCode')} />
                <input type="hidden" {...register('seller.address.country')} />
                <input type="hidden" {...register('seller.address.buildingNumber')} />
                <input type="hidden" {...register('seller.address.additionalNumber')} />
              </>
            )}

          </div>

          <div className={`${sectionCardClass} !p-0 overflow-hidden`}>
            <div className="px-4 py-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {language === 'ar' ? 'البنود' : 'Lines'}
              </h3>
            </div>

            {fields.length === 0 ? (
              <div className="mx-4 mb-4 rounded-xl border border-dashed border-slate-200/90 px-3 py-8 text-center dark:border-white/10">
                <p className="text-xs text-slate-400">
                  {language === 'ar' ? 'لا توجد بنود بعد' : 'No lines yet'}
                </p>
                <button
                  type="button"
                  disabled={isBillPosted}
                  onClick={() => append(getEmptyLine(tenant))}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'إضافة بند' : 'Add a line'}
                </button>
              </div>
            ) : (
              <div className="mx-4 mb-3 w-auto overflow-x-auto rounded-lg border border-slate-200/80 dark:border-white/10">
                <div
                  className="hidden min-w-[1200px] gap-2 border-b border-slate-100 px-4 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:border-white/5 lg:grid lg:grid-cols-[minmax(280px,2fr)_minmax(180px,1fr)_minmax(160px,0.9fr)_minmax(100px,5rem)_minmax(100px,5rem)_minmax(100px,7rem)_minmax(100px,6rem)_minmax(100px,7rem)_auto]"
                  dir="ltr"
                >
                  <div>{language === 'ar' ? 'المنتج / الوصف' : 'Product / description'}</div>
                  <div>{language === 'ar' ? 'الحساب' : 'Account'}</div>
                  <div>{language === 'ar' ? 'تحليلي' : 'Analytic'}</div>
                  <div className="text-center">{language === 'ar' ? 'وحدة' : 'UoM'}</div>
                  <div className="text-end">{t('quantity')}</div>
                  <div className="text-end">{t('unitPrice')}</div>
                  <div className="text-center">{t('tax')} %</div>
                  <div className="text-end">{t('total')}</div>
                  <div className="text-center">{language === 'ar' ? 'إجراءات' : 'Actions'}</div>
                </div>

                <div className="min-w-[1200px] divide-y divide-slate-100 dark:divide-white/5">
                  {fields.map((field, index) => {
                    const lineProductId = watch(`lineItems.${index}.productId`)
                    const matchWarning = lineProductId ? lineMatchWarnings[String(lineProductId)] : null
                    return (
                    <div
                      key={field.id}
                      className={`group px-3 py-2 transition sm:px-4 ${
                        matchWarning
                          ? 'bg-orange-50/90 ring-1 ring-inset ring-orange-300 hover:bg-orange-50 dark:bg-orange-950/25 dark:ring-orange-800'
                          : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'
                      }`}
                      title={matchWarning?.message || undefined}
                    >
                      <LineItemTranslator index={index} control={control} watch={watch} setValue={setValue} />
                      <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                      <div
                        className="grid grid-cols-2 items-start gap-2 lg:grid-cols-[minmax(280px,2fr)_minmax(180px,1fr)_minmax(160px,0.9fr)_minmax(100px,5rem)_minmax(100px,5rem)_minmax(100px,7rem)_minmax(100px,6rem)_minmax(100px,7rem)_auto]"
                        dir="ltr"
                      >
                        <div className="col-span-2 min-w-[280px] lg:col-span-1">
                          {isTradingContext ? (
                            <div className="space-y-1">
                              <CreatableSelect
                                inputId={`product-select-${index}`}
                                name={`react-select-product-${index}`}
                                options={productList.map((p) => ({
                                  value: p._id,
                                  label: productPickerLabel(p, language, { includeType: true }),
                                }))}
                                value={(() => {
                                  const pid = watch(`lineItems.${index}.productId`)
                                  const product = productList.find((p) => p._id === pid)
                                  if (product) {
                                    return {
                                      value: product._id,
                                      label: productDisplayName(product, language),
                                    }
                                  }
                                  const typed = watch(`lineItems.${index}.productName`)
                                  if (typed && !pid) {
                                    return { value: typed, label: typed, __isNew__: true }
                                  }
                                  return null
                                })()}
                                onChange={(selected) => {
                                  if (selected) {
                                    if (selected.__isNew__) {
                                      setValue(`lineItems.${index}.productId`, '', { shouldDirty: true })
                                      setValue(`lineItems.${index}.productName`, selected.value, { shouldDirty: true })
                                      setValue(`lineItems.${index}.productNameAr`, '', { shouldDirty: true })
                                    } else {
                                      onSelectProduct(index, selected.value)
                                    }
                                  } else {
                                    setValue(`lineItems.${index}.productId`, '', { shouldDirty: true })
                                    setValue(`lineItems.${index}.productName`, '', { shouldDirty: true })
                                    setValue(`lineItems.${index}.productNameAr`, '', { shouldDirty: true })
                                    setValue(`lineItems.${index}.variantId`, '', { shouldDirty: true })
                                    setValue(`lineItems.${index}.unitPrice`, 0, { shouldDirty: true })
                                  }
                                }}
                                formatCreateLabel={(inputValue) => language === 'ar' ? `إضافة "${inputValue}"` : `Add "${inputValue}"`}
                                placeholder={language === 'ar' ? 'منتج أو خدمة…' : 'Product or service…'}
                                isClearable
                                isSearchable
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                menuShouldScrollIntoView={false}
                                styles={{
                                  ...lineSelectStyles,
                                  container: (base) => ({ ...base, width: '100%', minWidth: 0 }),
                                  control: (base, state) => ({
                                    ...lineSelectStyles.control(base, state),
                                    minHeight: 36,
                                    minWidth: 0,
                                  }),
                                  menu: (base) => ({
                                    ...lineSelectStyles.menu(base),
                                    minWidth: 320,
                                    maxWidth: 'min(92vw, 480px)',
                                  }),
                                  option: (base, state) => ({
                                    ...base,
                                    fontSize: '0.8125rem',
                                    backgroundColor: state.isFocused ? '#f1f5f9' : '#fff',
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                  }),
                                }}
                              />
                              <input type="hidden" {...register(`lineItems.${index}.productName`)} />
                              <input type="hidden" {...register(`lineItems.${index}.productId`)} />
                              <input type="hidden" {...register(`lineItems.${index}.variantId`)} />
                              {(() => {
                                const pid = watch(`lineItems.${index}.productId`)
                                const product = productList.find((p) => p._id === pid)
                                const sku = product?.sku || product?.productId || ''
                                const nameAr = watch(`lineItems.${index}.productNameAr`) || product?.nameAr || ''
                                if (!sku && !nameAr) return null
                                return (
                                  <div className="px-0.5">
                                    {sku ? <p className="text-[11px] font-medium text-slate-500">[{sku}]</p> : null}
                                    {nameAr ? <p className="text-xs text-slate-400" dir="auto">{nameAr}</p> : null}
                                  </div>
                                )
                              })()}
                              {showArabicFields ? (
                                <input
                                  {...register(`lineItems.${index}.productNameAr`)}
                                  className={`${lineGhostInputClass} text-xs`}
                                  dir="auto"
                                  placeholder="الاسم بالعربي"
                                  aria-label="Arabic name"
                                />
                              ) : (
                                <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                              )}
                              {watch(`lineItems.${index}.productId`) ? (
                                <VariantLineSelect
                                  productId={watch(`lineItems.${index}.productId`)}
                                  value={watch(`lineItems.${index}.variantId`) || ''}
                                  language={language}
                                  onChange={(variantId) => setValue(`lineItems.${index}.variantId`, variantId || '', { shouldDirty: true })}
                                />
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <input
                                id={`product-select-${index}`}
                                {...register(`lineItems.${index}.productName`, { required: true })}
                                className={lineGhostInputClass}
                                placeholder={language === 'ar' ? 'اسم الخدمة' : 'Service name'}
                              />
                              {showArabicFields ? (
                                <input
                                  {...register(`lineItems.${index}.productNameAr`)}
                                  className={`${lineGhostInputClass} text-xs`}
                                  dir="auto"
                                  placeholder="اسم البند"
                                  aria-label="Arabic name"
                                />
                              ) : (
                                <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 min-w-[180px] lg:col-auto">
                          <select
                            {...register(`lineItems.${index}.expenseAccountId`)}
                            disabled={isBillPosted}
                            className={`${lineGhostInputClass} cursor-pointer disabled:opacity-60`}
                          >
                            <option value="">{language === 'ar' ? 'حساب…' : 'Account…'}</option>
                            {expenseAccounts.map((a) => (
                              <option key={a._id} value={a._id}>
                                {a.code} — {language === 'ar' ? (a.nameAr || a.name) : a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 min-w-[160px] lg:col-auto">
                          <select
                            {...register(`lineItems.${index}.analyticAccountId`)}
                            disabled={isBillPosted}
                            className={`${lineGhostInputClass} cursor-pointer disabled:opacity-60`}
                          >
                            <option value="">{language === 'ar' ? 'تحليلي…' : 'Analytic…'}</option>
                            {analyticAccounts.map((a) => (
                              <option key={a._id} value={a._id}>
                                {a.code ? `${a.code} — ` : ''}{language === 'ar' ? (a.nameAr || a.name) : a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1 min-w-[4.5rem] lg:col-span-1">
                          <Select
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                            isSearchable
                            placeholder="—"
                            styles={lineSelectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                            value={
                              watch(`lineItems.${index}.unitCode`)
                                ? {
                                    value: watch(`lineItems.${index}.unitCode`),
                                    label: getUomLabel(watch(`lineItems.${index}.unitCode`), language),
                                  }
                                : null
                            }
                            onChange={(option) => setValue(`lineItems.${index}.unitCode`, option ? option.value : '', { shouldValidate: true })}
                            options={[
                              { value: '', label: '—' },
                              ...getAvailableUomOptions(tenant).map((uom) => ({
                                value: uom.code,
                                label: language === 'ar' ? uom.labelAr : uom.labelEn,
                              })),
                            ]}
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          <input
                            id={`qty-${index}`}
                            type="number"
                            min="0"
                            step="any"
                            {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0 })}
                            className={`${lineGhostInputClass} tabular-nums ${matchWarning?.qty || matchWarning?.type === 'qty_mismatch' ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-400 dark:bg-rose-950/30' : ''}`}
                          />
                          {(matchWarning?.qty || matchWarning?.type === 'qty_mismatch') ? (
                            <p className="mt-0.5 text-[9px] font-medium text-rose-700 dark:text-rose-300">
                              {language === 'ar'
                                ? `مستلم ${(matchWarning.qty || matchWarning).received ?? '—'} · قابل للفوترة ${(matchWarning.qty || matchWarning).remainingBillable ?? '—'}`
                                : `Recv ${(matchWarning.qty || matchWarning).received ?? '—'} · billable ${(matchWarning.qty || matchWarning).remainingBillable ?? '—'}`}
                            </p>
                          ) : null}
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          <input
                            id={`price-${index}`}
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })}
                            className={`${lineGhostInputClass} tabular-nums ${matchWarning?.price || matchWarning?.type === 'price_mismatch' ? 'ring-1 ring-orange-400' : ''}`}
                          />
                          {(matchWarning?.price || matchWarning?.type === 'price_mismatch') ? (
                            <p className="mt-0.5 text-[9px] font-medium text-orange-700 dark:text-orange-300">
                              {language === 'ar'
                                ? `سعر الطلب ${Number((matchWarning.price || matchWarning).poPrice || 0).toFixed(2)}`
                                : `PO ${Number((matchWarning.price || matchWarning).poPrice || 0).toFixed(2)}`}
                            </p>
                          ) : null}
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          {(() => {
                            const pkRate = Number(tenant?.fbr?.defaultSalesTaxRate || 18)
                            return (
                              <select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className={`${lineGhostInputClass} cursor-pointer`}>
                                {isPk ? (
                                  <>
                                    <option value={pkRate}>{pkRate}%</option>
                                    {pkRate !== 16 && <option value={16}>16%</option>}
                                    {pkRate !== 15 && <option value={15}>15%</option>}
                                    <option value={0}>0%</option>
                                  </>
                                ) : (
                                  <>
                                    <option value={15}>15%</option>
                                    <option value={0}>0%</option>
                                  </>
                                )}
                              </select>
                            )
                          })()}
                        </div>
                        <div className="col-span-1 flex items-center justify-end lg:col-span-1">
                          <p className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">
                            <Money value={getLineTotal(index)} />
                          </p>
                        </div>
                        <div className="col-span-1 flex items-center justify-center lg:col-span-1">
                          {fields.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => !isBillPosted && remove(index)}
                              disabled={isBillPosted}
                              className="rounded-md p-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            )}

            {fields.length > 0 && !isBillPosted ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => append(getEmptyLine(tenant))}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  {language === 'ar' ? 'إضافة بند' : 'Add a line'}
                </button>
                <button
                  type="button"
                  onClick={() => append({
                    ...getEmptyLine(tenant),
                    productName: language === 'ar' ? 'قسم' : 'Section',
                    productNameAr: language === 'ar' ? 'قسم' : '',
                    quantity: 0,
                    unitPrice: 0,
                    taxRate: 0,
                  })}
                  className="text-[12px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:hover:text-slate-300"
                >
                  {language === 'ar' ? 'إضافة قسم' : 'Add a section'}
                </button>
                <button
                  type="button"
                  onClick={() => append({
                    ...getEmptyLine(tenant),
                    productName: language === 'ar' ? 'ملاحظة' : 'Note',
                    productNameAr: language === 'ar' ? 'ملاحظة' : '',
                    quantity: 0,
                    unitPrice: 0,
                    taxRate: 0,
                  })}
                  className="text-[12px] font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:hover:text-slate-300"
                >
                  {language === 'ar' ? 'إضافة ملاحظة' : 'Add a note'}
                </button>
              </div>
            ) : null}
          </div>

          </div>
          </div>
          </>
          )}

          {formTab === 'journal' && (
          <InvoiceJournalItemsPanel
            flow="purchase"
            language={language}
            totals={totals}
            lineItems={totals.lines || []}
            sourcePurchaseOrderId={selectedPoId || watch('sourcePurchaseOrderId')}
            sourceGrnIds={sourceGrnIds}
            paymentTerms={watch('paymentTerms')}
            issueDate={watch('billDate') || watch('issueDate')}
            dueDate={watch('dueDate')}
            value={accountingLines}
            onChange={setAccountingLines}
            suggestedAccounts={vendorPredictions}
            lineItemsRaw={lineItems}
            readOnly={isBillPosted}
          />
          )}

          {formTab === 'other' && (
          <>
          <div className={`${sectionCardClass} !p-0 overflow-hidden`}>
            <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5 dark:border-white/5">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {language === 'ar' ? 'إضافات' : 'Extras'}
              </span>
              <div className="ms-auto flex rounded-xl bg-slate-100/90 p-0.5 dark:bg-white/5">
                {[
                  {
                    id: 'signature',
                    active: showAuthorizedPerson,
                    labelEn: 'Signature',
                    labelAr: 'توقيع',
                    onClick: () => handleToggleAuthorizedPerson(!showAuthorizedPerson),
                  },
                  {
                    id: 'terms',
                    active: showTermsPanel,
                    labelEn: 'Terms',
                    labelAr: 'شروط',
                    onClick: () => handleToggleTerms(!showTermsPanel),
                  },
                  {
                    id: 'notes',
                    active: showNotesPanel,
                    labelEn: 'Notes',
                    labelAr: 'ملاحظات',
                    onClick: () => handleToggleNotes(!showNotesPanel),
                  },
                  {
                    id: 'bank',
                    active: showBankPanel,
                    labelEn: 'Bank',
                    labelAr: 'بنك',
                    onClick: () => handleToggleBankDetails(!showBankPanel),
                  },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={pill.onClick}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                      pill.active
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {language === 'ar' ? pill.labelAr : pill.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3.5 pb-3.5 pt-2">
              <AnimatePresence>
                {showAuthorizedPerson && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-slate-100 pt-4 dark:border-white/5"
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
                        <div className="mt-1.5 flex items-center gap-3">
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
                              <img src={values.authorizedPersonSignature} alt="Signature" className="h-16 max-w-[200px] rounded-lg border bg-white object-contain p-1" />
                              <button type="button" onClick={() => setValue('authorizedPersonSignature', '')} className="absolute -top-2 -end-2 rounded-full bg-red-100 p-1 text-red-600">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{language === 'ar' ? 'لم يتم رفع توقيع' : 'No signature uploaded'}</span>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className={fieldLabelClass}>{language === 'ar' ? 'الختم' : 'Stamp'}</label>
                        <div className="mt-1.5 flex items-center gap-3">
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
                              <img src={values.stampImage} alt="Stamp" className="h-16 max-w-[200px] rounded-lg border bg-white object-contain p-1" />
                              <button type="button" onClick={() => setValue('stampImage', '')} className="absolute -top-2 -end-2 rounded-full bg-red-100 p-1 text-red-600">
                                <Trash2 className="h-3 w-3" />
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
                    className="overflow-hidden border-t border-slate-100 pt-4 dark:border-white/5"
                  >
                    <RichTextNoteField
                      label={language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
                      value={watch('termsAndConditions')}
                      onChange={(val) => setValue('termsAndConditions', val, { shouldDirty: true })}
                      onRemove={() => handleToggleTerms(false)}
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
                    className="overflow-hidden border-t border-slate-100 pt-4 dark:border-white/5"
                  >
                    <RichTextNoteField
                      label={language === 'ar' ? 'ملاحظات' : 'Notes'}
                      value={watch('notes')}
                      onChange={(val) => setValue('notes', val, { shouldDirty: true })}
                      onRemove={() => handleToggleNotes(false)}
                      placeholder={language === 'ar' ? 'أدخل ملاحظات إضافية...' : 'Enter additional notes...'}
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
                    className="overflow-hidden border-t border-slate-100 pt-4 dark:border-white/5"
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
                        <FieldLabel en="Bank Name" ar="اسم البنك" />
                        <input {...register('bankDetails.bankName')} className={`mt-1.5 ${fieldControlClass}`} placeholder={showArabicFields ? 'Al Rajhi Bank / SNB' : 'Habib Bank / Standard Chartered'} />
                      </div>
                      <div>
                        <FieldLabel en="Account Name" ar="اسم الحساب" />
                        <input {...register('bankDetails.accountName')} className={`mt-1.5 ${fieldControlClass}`} />
                      </div>
                      <div>
                        <FieldLabel en="Account Number" ar="رقم الحساب" />
                        <input {...register('bankDetails.accountNumber')} className={`mt-1.5 ${fieldControlClass} font-mono`} />
                      </div>
                      <div>
                        <FieldLabel en={showArabicFields ? 'IBAN' : 'IBAN / Swift'} ar="الآيبان" />
                        <input {...register('bankDetails.iban')} className={`mt-1.5 ${fieldControlClass} font-mono`} placeholder={showArabicFields ? 'SA0000000000000000000000' : 'PK00XXXX0000000000000000'} />
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
          </div>

          <div className={`${sectionCardClass} !p-0 overflow-hidden`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch">
              <div className="flex flex-col border-b border-slate-100 px-5 py-5 dark:border-white/5 lg:border-b-0 lg:border-e">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {language === 'ar' ? 'شروط الدفع' : 'Payment terms'}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-white/5">
                  {INVOICE_PAYMENT_TERMS.slice(0, 5).map((term) => {
                    const active = watch('paymentTerms') === term.id
                    return (
                      <button
                        key={term.id}
                        type="button"
                        onClick={() => {
                          setValue('paymentTerms', term.id, { shouldDirty: true })
                          const due = computeDueDateFromPaymentTerms(new Date(), term.id)
                          if (due) setValue('dueDate', due.toISOString().slice(0, 10), { shouldDirty: true })
                          setValue('paymentStatus', isImmediatePaymentTerm(term.id) ? 'paid' : 'pending', { shouldDirty: true })
                          if (isImmediatePaymentTerm(term.id)) {
                            setValue('paidAmount', totals.grandTotal, { shouldDirty: true })
                          }
                        }}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {language === 'ar' ? term.labelAr : term.labelEn}
                      </button>
                    )
                  })}
                  <select
                    {...register('paymentTerms')}
                    aria-label={language === 'ar' ? 'شروط أخرى' : 'More terms'}
                    className={`ms-auto max-w-[9.5rem] truncate rounded-lg border-0 bg-transparent py-1.5 pe-6 ps-2 text-[11px] font-semibold outline-none ${
                      INVOICE_PAYMENT_TERMS.slice(0, 5).some((term) => term.id === watch('paymentTerms'))
                        ? 'text-slate-400'
                        : 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                    }`}
                    onChange={(e) => {
                      const id = e.target.value
                      setValue('paymentTerms', id, { shouldDirty: true })
                      const due = computeDueDateFromPaymentTerms(new Date(), id)
                      if (due) setValue('dueDate', due.toISOString().slice(0, 10), { shouldDirty: true })
                      setValue('paymentStatus', isImmediatePaymentTerm(id) ? 'paid' : 'pending', { shouldDirty: true })
                    }}
                  >
                    {INVOICE_PAYMENT_TERMS.map((term) => (
                      <option key={term.id} value={term.id}>{language === 'ar' ? term.labelAr : term.labelEn}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{language === 'ar' ? 'الاستحقاق' : 'Due'}</label>
                    <input type="date" {...register('dueDate')} className={`mt-1.5 ${fieldControlClass} !rounded-xl !border-slate-200/70 !bg-slate-50/60 !px-2.5 !py-2 !text-[13px]`} />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{language === 'ar' ? 'الحالة' : 'Status'}</label>
                    <select
                      {...register('paymentStatus')}
                      className={`mt-1.5 ${fieldControlClass} !rounded-xl !border-slate-200/70 !bg-slate-50/60 !px-2.5 !py-2 !text-[13px]`}
                      onChange={(e) => {
                        const status = e.target.value
                        setValue('paymentStatus', status, { shouldDirty: true })
                        if (status === 'paid') setValue('paidAmount', totals.grandTotal, { shouldDirty: true })
                      }}
                    >
                      <option value="paid">{language === 'ar' ? 'مدفوعة' : 'Paid'}</option>
                      <option value="pending">{language === 'ar' ? 'غير مدفوعة' : 'Unpaid'}</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{language === 'ar' ? 'الطريقة' : 'Method'}</label>
                    <select {...register('paymentMethod')} className={`mt-1.5 ${fieldControlClass} !rounded-xl !border-slate-200/70 !bg-slate-50/60 !px-2.5 !py-2 !text-[13px]`}>
                      <option value="cash">{language === 'ar' ? 'نقداً' : 'Cash'}</option>
                      <option value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</option>
                      <option value="bank_transfer">{language === 'ar' ? 'تحويل' : 'Transfer'}</option>
                      <option value="credit">{language === 'ar' ? 'آجل' : 'Credit'}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  {watch('paymentMethod') === 'credit' && watch('paymentStatus') !== 'paid' ? (
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{language === 'ar' ? 'مقدم' : 'Advance'}</label>
                      <input type="number" min="0" max={totals.grandTotal} step="0.01" {...register('paidAmount', { valueAsNumber: true, min: 0 })} className={`mt-1.5 ${fieldControlClass} !rounded-xl !border-slate-200/70 !bg-slate-50/60 !px-2.5 !py-2 !text-[13px]`} placeholder="0.00" />
                    </div>
                  ) : <div />}
                  <div className={watch('paymentMethod') === 'credit' && watch('paymentStatus') !== 'paid' ? '' : 'col-span-2 max-w-[220px]'}>
                    <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{language === 'ar' ? 'خصم الفاتورة' : 'Invoice discount'}</label>
                    <input type="number" min="0" step="0.01" {...register('invoiceDiscount', { valueAsNumber: true, min: 0 })} className={`mt-1.5 ${fieldControlClass} !rounded-xl !border-slate-200/70 !bg-slate-50/60 !px-2.5 !py-2 !text-[13px]`} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {language === 'ar' ? 'الملخص' : 'Summary'}
                </p>
                <div className="mt-3 flex flex-1 flex-col justify-between space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <div className="space-y-2.5">
                    <div className="flex justify-between"><span>{t('subtotal')}</span><span className="tabular-nums text-slate-900 dark:text-white"><Money value={totals.subtotal} /></span></div>
                    <div className="flex justify-between"><span>{t('discount')}</span><span className="tabular-nums text-slate-900 dark:text-white"><Money value={totals.totalDiscount} /></span></div>
                    <div className="flex justify-between"><span>{language === 'ar' ? 'الخاضع للضريبة' : 'Taxable'}</span><span className="tabular-nums text-slate-900 dark:text-white"><Money value={totals.taxableAmount} /></span></div>
                    <div className="flex justify-between"><span>{isPk ? 'GST' : t('tax')}</span><span className="tabular-nums text-slate-900 dark:text-white"><Money value={totals.totalTax} /></span></div>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900 dark:border-white/10 dark:text-white">
                    <span>{t('total')}</span>
                    <span className="tabular-nums"><Money value={totals.grandTotal} /></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'اضغط معاينة لمراجعة الفاتورة قبل الحفظ'
                  : 'Tap Preview to review before saving'}
              </p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => navigate(isEdit ? `/app/dashboard/accounting/invoices/${invoiceId}` : (isRefundDoc ? '/app/dashboard/accounting/vendor-refunds' : '/app/dashboard/accounting/vendor-bills'))} className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-dark-500 dark:bg-transparent dark:text-slate-300">{t('cancel')}</button>
                <button type="submit" disabled={saveMutation.isPending || isBillPosted} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-50 dark:bg-white dark:text-slate-900">
                  {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <><Eye className="w-4 h-4" />{language === 'ar' ? 'معاينة' : 'Preview'}</>}
                </button>
              </div>
            </div>
          </div>
          </>
          )}
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
        documentType="purchase_invoice"
        templateId={selectedTemplateId}
        title={language === 'ar' ? 'معاينة فاتورة الشراء قبل الحفظ' : 'Purchase Invoice Live Preview'}
      />
    </div>
  )
}

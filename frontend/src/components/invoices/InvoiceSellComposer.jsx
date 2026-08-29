import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { normalizeProductType, productPickerLabel, productDisplayName, resolveProductSalePrice, hasArabicScript } from '../../lib/productType'
import ProductTypeToggle from '../ui/ProductTypeToggle'
import RichTextNoteField from './RichTextNoteField'
import MarqueeEventFields from '../marquee/MarqueeEventFields'
import { isAppAccessValid } from '../../lib/appStoreTrial'
import { isPakistanTenant, isSaudiTenant, getTaxLabel, getTaxIdLabel, getTenantCountryCode, showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'
import { LineRelationSuggestions } from '../inventory/ProductRelationSuggestions'
import VariantLineSelect from '../inventory/VariantLineSelect'
import PartnerCombobox from '../inventory/PartnerCombobox'
import CustomerSummaryCard from '../sales/CustomerSummaryCard'
import { formatInvError } from '../../lib/invError'
import {
  backBtnClass,
  fieldControlClass,
  fieldLabelClass,
  pageTitleClass,
  sectionCardClass,
  sectionEyebrowClass,
  sectionTitleClass,
} from '../../pages/sales/salesUi'
import SalesEnhancementBar from '../sales/SalesEnhancementBar'
import { canViewSalesMargin } from '../../lib/salesPermissions'
import { useSalesSettings } from '../../context/SalesSettingsContext'

const getEmptyLine = (tenant) => {
  const currency = String(tenant?.settings?.currency || 'SAR').trim().toUpperCase()
  let defaultRate = tenant?.settings?.taxRate !== undefined && tenant?.settings?.taxRate !== null
    ? Number(tenant.settings.taxRate)
    : NaN

  if (isNaN(defaultRate)) {
    if (currency === 'AED' || currency === 'OMR') defaultRate = 5
    else if (currency === 'BHD') defaultRate = 10
    else if (currency === 'KWD' || currency === 'QAR') defaultRate = 0
    else if (currency === 'PKR' || isPakistanTenant(tenant)) defaultRate = Number(tenant?.fbr?.defaultSalesTaxRate || 18)
    else if (currency === 'BDT') defaultRate = Number(tenant?.nbr?.defaultVatRate || 15)
    else defaultRate = 15
  }

  return {
    productId: '',
    variantId: '',
    productName: '',
    productNameAr: '',
    productType: 'goods',
    unitCode: getDefaultUom(tenant) || '',
    quantity: 1,
    unitPrice: '',
    customerPrice: '',
    taxRate: defaultRate,
    agencyPrice: '',
    isTravelMargin: false,
    sourcePoItemId: '',
    sourceDnItemId: '',
  }
}

const idOf = (value) => {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || value.id || '')
  return String(value)
}

const getEmptyBuyerAddress = (tenant) => ({
  street: '', streetAr: '', district: '', districtAr: '', city: '', cityAr: '',
  postalCode: '', country: getTenantCountryCode(tenant), buildingNumber: '', additionalNumber: '', shortAddress: '',
})

const mapSellLineItems = (invoice, tenant) => {
  const empty = getEmptyLine(tenant)
  const isPk = String(tenant?.settings?.currency || '').toUpperCase() === 'PKR' || (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
  const defaultRate = isPk ? Number(tenant?.fbr?.defaultSalesTaxRate || 18) : Number(tenant?.settings?.taxRate ?? 15)
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
      variantId: idOf(plain?.variantId),
      productName: plain?.productName || plain?.name || plain?.description || '',
      productNameAr: plain?.productNameAr || plain?.nameAr || '',
      unitCode: plain?.unitCode !== undefined ? (plain.unitCode || '') : empty.unitCode,
      quantity: Math.max(0.0001, toNumber(plain?.quantity, 1)),
      unitPrice: Math.max(0, toNumber(plain?.unitPrice ?? plain?.price, 0)),
      customerPrice: Math.max(0, toNumber(plain?.customerPrice, 0)),
      taxRate: Math.max(0, toNumber(plain?.taxRate, defaultRate)),
      agencyPrice: Math.max(0, toNumber(plain?.agencyPrice, 0)),
      isTravelMargin: Boolean(plain?.isTravelMargin),
      productType: normalizeProductType(plain?.productType),
    }
  }).filter((line) => line.productName || line.unitPrice > 0 || line.productId)
  return mapped.length ? mapped : [{ ...empty }]
}
const selectableContexts = ['trading', 'marquee', 'construction', 'travel_agency', 'restaurant', 'manpower', 'furniture', 'furniture_shop']

const bilingualPairGridClass = 'grid grid-cols-1 gap-x-3 gap-y-1.5 md:grid-cols-2'
const denseControlClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-400'
const compactFieldClass = `mt-0.5 ${denseControlClass}`
const denseSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#64748b' : '#cbd5e1',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(15,23,42,0.08)' : 'none',
    minHeight: '34px',
    backgroundColor: '#fff',
  }),
  valueContainer: (base) => ({ ...base, padding: '0 8px' }),
  indicatorsContainer: (base) => ({ ...base, height: '32px' }),
  singleValue: (base) => ({ ...base, color: '#0f172a', fontWeight: 500, fontSize: '0.875rem' }),
  placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
}

/** Always EN left / AR right regardless of UI language for Arabic markets; English only for others */
const BilingualLabel = ({ en, ar, htmlFor, as = 'label', showArabic = true }) => {
  const Tag = as
  return (
    <Tag htmlFor={htmlFor} className={`${fieldLabelClass} !mb-0.5 !flex items-baseline justify-between gap-2 text-[11px]`} dir="ltr">
      <span>{en}</span>
      {showArabic && ar ? (
        <span className="font-medium text-slate-500 dark:text-slate-400" dir="rtl">{ar}</span>
      ) : null}
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
  customerId: (invoice?.customerId && typeof invoice.customerId === 'object')
    ? (invoice.customerId._id || '')
    : (invoice?.customerId || ''),
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
      ...getEmptyBuyerAddress(tenant),
      ...(invoice?.buyer?.address || {}),
      street: invoice?.buyer?.address?.street || '',
      streetAr: invoice?.buyer?.address?.streetAr || '',
      district: invoice?.buyer?.address?.district || '',
      districtAr: invoice?.buyer?.address?.districtAr || '',
      city: invoice?.buyer?.address?.city || '',
      cityAr: invoice?.buyer?.address?.cityAr || '',
      postalCode: invoice?.buyer?.address?.postalCode || '',
      country: invoice?.buyer?.address?.country || getTenantCountryCode(tenant),
      buildingNumber: invoice?.buyer?.address?.buildingNumber || '',
      additionalNumber: invoice?.buyer?.address?.additionalNumber || '',
      shortAddress: invoice?.buyer?.address?.shortAddress || '',
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
  const [searchParams] = useSearchParams()
  const isProformaCreate = searchParams.get('proforma') === '1'
  const partnerIdParam = String(searchParams.get('partnerId') || '').trim()
  const deliveryNoteIdParam = String(searchParams.get('deliveryNoteId') || '').trim()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { settings: salesSettings } = useSalesSettings()
  const { t } = useTranslation(language)
  const showArabicFields = isArabicTenantMarket(tenant)
  const isPk = isPakistanTenant(tenant)
  const taxLabel = getTaxLabel(tenant)
  const taxIdLabel = getTaxIdLabel(tenant)
  const [invoiceType, setInvoiceType] = useState('B2B')
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const isEdit = Boolean(invoiceId)
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    const c = initialInvoice?.customerId
    return c && typeof c === 'object' ? c : null
  })
  const FieldLabel = (props) => <BilingualLabel {...props} showArabic={showArabicFields} />
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
      invoice: initialInvoice || (isProformaCreate ? { invoiceSubtype: 'proforma' } : null),
      tenant,
      defaultBusinessContext,
      hasTravel: tenantBusinessTypes.includes('travel_agency'),
    })
  })

  useEffect(() => {
    if (invoiceId || !salesSettings) return
    if (!getValues('termsAndConditions') && salesSettings.invoiceDefaultTerms) {
      setValue('termsAndConditions', salesSettings.invoiceDefaultTerms)
      setShowTermsPanel(true)
    }
    if (!getValues('notes') && salesSettings.invoiceDefaultNotes) {
      setValue('notes', salesSettings.invoiceDefaultNotes)
      setShowNotesPanel(true)
    }
  }, [salesSettings, invoiceId, getValues, setValue])

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
  const emptyLine = useMemo(() => getEmptyLine(tenant), [tenant])
  const isMarqueeContext =
    businessContext === 'marquee' ||
    tenantBusinessTypes.includes('marquee') ||
    isAppAccessValid(tenant?.settings?.installedApps?.marquee_management)
  const [sourceId, setSourceId] = useState('')
  const skipBusinessContextResetRef = useRef(false)
  const isSubmittedRef = useRef(false)
  const hydratedInvoiceIdRef = useRef('')
  const recoveredLinesRef = useRef(false)

  const handleApplyMarqueePackage = (pkg) => {
    const count = Number(getValues('guestCount') || 100)
    const defaultTaxRate = Number(tenant?.settings?.taxRate ?? 15)

    if (Array.isArray(pkg.items) && pkg.items.length > 0) {
      const lines = pkg.items.map((item, idx) => ({
        ...getEmptyLine(tenant),
        productId: '',
        productName: idx === 0 ? `${pkg.name} — ${item.itemName}` : item.itemName,
        productNameAr: idx === 0 && pkg.nameAr ? `${pkg.nameAr} — ${item.itemNameAr || item.itemName}` : (item.itemNameAr || ''),
        productType: 'services',
        quantity: count,
        unitPrice: idx === 0 ? Number(pkg.ratePerHead || 0) : 0,
        taxRate: defaultTaxRate,
        description: item.portionSize ? `Portion: ${item.portionSize}` : '',
      }))

      if (pkg.hallBaseRent > 0) {
        lines.push({
          ...getEmptyLine(tenant),
          productId: '',
          productName: 'Hall Base Rental & Stage Setup',
          productNameAr: 'إيجار وتجهيز القاعة الأساسي',
          productType: 'services',
          quantity: 1,
          unitPrice: Number(pkg.hallBaseRent || 0),
          taxRate: defaultTaxRate,
          description: 'Fixed Hall Rent',
        })
      }

      replace(lines)
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

  const handleToggleTerms = (enable) => {
    setShowTermsPanel(enable)
    if (enable) {
      const current = getValues('termsAndConditions')
      if (!current) {
        const defaultTerms = salesSettings?.invoiceDefaultTerms ||
          tenant?.settings?.invoiceBranding?.termsAndConditions ||
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
        const defaultNotes = salesSettings?.invoiceDefaultNotes ||
          tenant?.settings?.invoiceBranding?.defaultNotes ||
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
    setInvoiceType(initialInvoice?.transactionType === 'B2C' ? 'B2C' : 'B2B')
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

  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 500 } })
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

  const { data: stockSettings } = useQuery({
    queryKey: ['stock-engine-status'],
    queryFn: () => api.get('/stock/engine-status').then((r) => r.data).catch(() => ({ engineEnabled: false })),
    enabled: isTradingContext,
  })
  const engineRequiresWarehouse = Boolean(isTradingContext && stockSettings?.engineEnabled)

  useEffect(() => {
    if (!engineRequiresWarehouse || selectedWarehouseId) return
    const list = Array.isArray(warehouses) ? warehouses : []
    if (!list.length) return
    const primary = list.find((w) => w.isPrimary || w.isDefault) || list[0]
    if (primary?._id) setValue('warehouseId', String(primary._id))
  }, [engineRequiresWarehouse, warehouses, selectedWarehouseId, setValue])

  const productList = Array.isArray(products) ? products : []
  const warehouseList = Array.isArray(warehouses) ? warehouses : []

  useEffect(() => {
    if (!partnerIdParam || isEdit) return
    let cancelled = false
    api.get(`/customers/${partnerIdParam}`).then((res) => {
      if (cancelled || !res.data) return
      fillBuyerFromParty(res.data)
      setSelectedCustomer(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerIdParam, isEdit])

  useEffect(() => {
    if (!deliveryNoteIdParam || isEdit) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: dn } = await api.get(`/delivery-notes/${deliveryNoteIdParam}`)
        if (cancelled || !dn) return
        const poId = dn.purchaseOrderId?._id || dn.purchaseOrderId
        let po = null
        if (poId) {
          try {
            po = (await api.get(`/purchase-orders/${poId}`)).data
          } catch { /* optional */ }
        }
        const cust = dn.customerId && typeof dn.customerId === 'object' ? dn.customerId : null
        if (cust) {
          fillBuyerFromParty(cust)
          setSelectedCustomer(cust)
        } else if (dn.customerId) {
          try {
            const c = (await api.get(`/customers/${dn.customerId}`)).data
            if (c) {
              fillBuyerFromParty(c)
              setSelectedCustomer(c)
            }
          } catch { /* optional */ }
        }
        setValue('sourcePurchaseOrderId', poId || '')
        setValue('sourceDeliveryNoteId', dn._id)
        const lines = (dn.lineItems || []).map((li) => {
          const remaining = Math.max(0, Number(li.quantityDelivered || 0) - Number(li.quantityInvoiced || 0))
          const poItem = (po?.lineItems || []).find((p) => String(p._id) === String(li.poItemId))
          return {
            ...emptyLine,
            productId: li.productId?._id || li.productId || '',
            productName: poItem?.manualName || li.productName || li.productId?.nameEn || 'Item',
            quantity: remaining || Number(li.quantityDelivered || 0),
            unitPrice: Number(poItem?.unitCost ?? li.unitPrice ?? 0),
            taxRate: Number(poItem?.taxRate ?? li.taxRate ?? 15),
            productType: poItem?.productType || 'goods',
            sourcePoItemId: li.poItemId || poItem?._id || '',
            sourceDnItemId: li._id || '',
          }
        }).filter((l) => Number(l.quantity) > 0)
        replace(lines.length ? lines : [emptyLine])
        toast.success(language === 'ar' ? 'تم تحميل سند التسليم' : 'Delivery note loaded')
      } catch (e) {
        toast.error(e?.response?.data?.error || e.message)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryNoteIdParam, isEdit])

  useEffect(() => {
    const c = initialInvoice?.customerId
    if (!c) return
    if (typeof c === 'object') {
      setSelectedCustomer(c)
      return
    }
    let cancelled = false
    api.get(`/customers/${c}`).then((res) => {
      if (!cancelled && res.data) setSelectedCustomer(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [initialInvoice?.customerId])

  const fillBuyerFromParty = (customer) => {
    if (!customer) return
    setValue('customerId', customer._id)
    setValue('buyer.name', customer.name || customer.nameEn || '')
    setValue('buyer.nameAr', customer.nameAr || customer.name || customer.nameEn || '')
    setValue('buyer.vatNumber', customer.vatNumber || '')
    setValue('buyer.crNumber', customer.crNumber || '')
    setValue('buyer.address.city', customer.address?.city || '')
    setValue('buyer.address.cityAr', customer.address?.cityAr || '')
    setValue('buyer.address.district', customer.address?.district || '')
    setValue('buyer.address.districtAr', customer.address?.districtAr || '')
    setValue('buyer.address.street', customer.address?.street || '')
    setValue('buyer.address.streetAr', customer.address?.streetAr || '')
    setValue('buyer.address.postalCode', customer.address?.postalCode || '')
    setValue('buyer.address.country', customer.address?.country || getTenantCountryCode(tenant))
    setValue('buyer.address.buildingNumber', customer.address?.buildingNumber || '')
    setValue('buyer.address.additionalNumber', customer.address?.additionalNumber || '')
    setValue('buyer.address.shortAddress', customer.address?.shortAddress || '')
    setValue('buyer.contactPhone', customer.phone || customer.mobile || getValues('buyer.contactPhone') || '')
    setValue('buyer.contactEmail', customer.email || getValues('buyer.contactEmail') || '')
  }

  const onSelectCustomer = (customerId, opt) => {
    if (!customerId) {
      setValue('customerId', '')
      setSelectedCustomer(null)
      return
    }
    if (opt) {
      fillBuyerFromParty(opt)
      setSelectedCustomer(opt)
      return
    }
    api.get(`/customers/${customerId}`).then((res) => {
      if (!res.data) return
      fillBuyerFromParty(res.data)
      setSelectedCustomer(res.data)
    }).catch(() => {})
  }

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
            onSelectCustomer(data.clientId._id, data.clientId)
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
    onError: (error) => toast.error(formatInvError(error, language) || 'Failed'),
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
      setShowPreviewModal(false)
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
    onError: (error) => toast.error(formatInvError(error, language) || (isEdit ? 'Failed to update invoice' : 'Failed to create invoice')),
  })

  const onSelectProduct = (index, productId) => {
    const product = productList.find((item) => item._id === productId)
    if (!product) return
    const nameEn = productDisplayName(product, 'en')
    const nameAr = hasArabicScript(product.nameAr) ? String(product.nameAr).trim() : ''
    const tax = typeof product.saleTaxRate === 'number'
      ? product.saleTaxRate
      : (typeof product.taxRate === 'number' ? product.taxRate : 15)
    const opts = { shouldDirty: true, shouldTouch: true }
    setValue(`lineItems.${index}.productId`, product._id, opts)
    setValue(`lineItems.${index}.variantId`, '', opts)
    setValue(`lineItems.${index}.productName`, nameEn, opts)
    setValue(`lineItems.${index}.productNameAr`, nameAr, opts)
    setValue(`lineItems.${index}.unitCode`, product.unitOfMeasure || 'PCE', opts)
    setValue(`lineItems.${index}.taxRate`, tax, opts)
    setValue(`lineItems.${index}.productType`, normalizeProductType(product.productType), opts)
    setValue(`lineItems.${index}.unitPrice`, resolveProductSalePrice(product), opts)
    const qty = Number(getValues(`lineItems.${index}.quantity`))
    if (!Number.isFinite(qty) || qty <= 0) {
      setValue(`lineItems.${index}.quantity`, 1, opts)
    }
  }

  const resolveRelatedProduct = (row) => {
    const rel = row?.relatedProductId
    const id = String(rel?._id || rel || '')
    if (!id) return null
    return productList.find((p) => String(p._id) === id) || (typeof rel === 'object' ? rel : null)
  }

  const appendRelatedProduct = (row) => {
    const product = resolveRelatedProduct(row)
    if (!product?._id) return
    const already = (getValues('lineItems') || []).some((l) => String(l.productId) === String(product._id))
    if (already) {
      toast(language === 'ar' ? 'المنتج موجود في البنود' : 'Product already on the invoice')
      return
    }
    append({
      ...getEmptyLine(tenant),
      productId: product._id,
      productName: productDisplayName(product, 'en'),
      productNameAr: hasArabicScript(product.nameAr) ? String(product.nameAr).trim() : '',
      unitCode: product.unitOfMeasure || 'PCE',
      taxRate: typeof product.saleTaxRate === 'number' ? product.saleTaxRate : (typeof product.taxRate === 'number' ? product.taxRate : 15),
      unitPrice: resolveProductSalePrice(product),
      productType: normalizeProductType(product.productType),
      quantity: 1,
    })
  }

  const swapLineProduct = (index, row) => {
    const product = resolveRelatedProduct(row)
    if (!product?._id) return
    onSelectProduct(index, product._id)
  }

  const calculateLineTotal = (index) => {
    const summary = calculateInvoiceSummary({ lineItems, invoiceDiscount: values?.invoiceDiscount })
    const line = summary.lines[index]
    if (!line) return { subtotal: 0, tax: 0, total: 0 }
    return { subtotal: line.lineTotal, tax: line.taxAmount, total: line.lineTotalWithTax }
  }

  const totals = calculateInvoiceSummary({ lineItems, invoiceDiscount: values?.invoiceDiscount })
  const showMargin = canViewSalesMargin(user)
  const estimatedMargin = useMemo(() => {
    if (!showMargin) return 0
    return lineItems.reduce((sum, line, index) => {
      const summaryLine = totals.lines[index] || {}
      const revenue = Number(summaryLine.lineTotal || 0)
      const cost = Number(line.unitCost || line.costPrice || 0) * Number(line.quantity || 0)
      return sum + (revenue - cost)
    }, 0)
  }, [showMargin, lineItems, totals.lines])

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
          variantId: isTradingContext && line.variantId ? line.variantId : undefined,
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
          sourcePoItemId: line.sourcePoItemId || undefined,
          sourceDnItemId: line.sourceDnItemId || undefined,
        }
      }),
      subtotal: namedTotals.subtotal,
      totalDiscount: namedTotals.totalDiscount,
      taxableAmount: namedTotals.taxableAmount,
      totalTax: namedTotals.totalTax,
      grandTotal: namedTotals.grandTotal,
      sourcePurchaseOrderId: data?.sourcePurchaseOrderId || undefined,
      sourceDeliveryNoteId: data?.sourceDeliveryNoteId || undefined,
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
    if (engineRequiresWarehouse && !payload.warehouseId && data?.status !== 'draft' && invoiceSubtype !== 'proforma') {
      toast.error(language === 'ar' ? 'اختر المستودع — محرك المخزون مفعّل' : 'Select a warehouse — inventory engine is enabled')
      return null
    }
    if (isTravelContext || invoiceSubtype === 'travel_ticket') {
      payload.travelDetails = sanitizeTravelDetails({
        ...data.travelDetails,
        travelerName: data?.buyer?.name || data?.travelDetails?.travelerName || '',
      })
    } else {
      delete payload.travelDetails
    }
    if (data?.eventDate || data?.marqueePackageId || isMarqueeContext) {
      payload.eventDate = data?.eventDate || ''
      payload.eventShift = data?.eventShift || 'dinner'
      payload.guestCount = Number(data?.guestCount || 100)
      payload.hallName = data?.hallName || ''
      payload.advancePaid = Number(data?.advancePaid || 0)
      payload.marqueePackageId = data?.marqueePackageId || ''
      payload.packageName = data?.packageName || ''
      payload.ratePerHead = Number(data?.ratePerHead || 0)
      payload.hallBaseRent = Number(data?.hallBaseRent || 0)
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
    lineItems: (Array.isArray(totals.lines) ? totals.lines : []).map((line, index) => ({
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

  const segmentWrapClass =
    'inline-flex items-center rounded-xl border border-slate-200/90 bg-slate-50/80 p-0.5 dark:border-white/10 dark:bg-dark-900/50'
  const segmentBtnClass = (active) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-700 dark:text-white'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
    }`

  const sellerLine = [
    tenant?.business?.legalNameEn || tenant?.name,
    tenant?.business?.vatNumber || tenant?.fbr?.ntn || tenant?.business?.ntn
      ? `${isPk ? 'NTN' : 'VAT'} ${tenant?.business?.vatNumber || tenant?.fbr?.ntn || tenant?.business?.ntn}`
      : null,
    tenant?.business?.crNumber ? `CR ${tenant.business.crNumber}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-6xl space-y-2.5">
        <form onSubmit={handleSubmit(onSubmit, () => toast.error(language === 'ar' ? 'أكمل البنود المطلوبة قبل الحفظ' : 'Complete the billing lines before saving'))} className="space-y-2.5">
          <div className={`${sectionCardClass} !p-3 space-y-2`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className={segmentWrapClass}>
                {[
                  { id: 'a4', labelEn: 'A4', labelAr: 'A4', Icon: FileText },
                  { id: 'thermal', labelEn: 'Thermal', labelAr: 'حراري', Icon: Receipt },
                ].map((fmt) => {
                  const active = (values?.printFormat || 'a4') === fmt.id
                  const Icon = fmt.Icon
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setValue('printFormat', fmt.id, { shouldDirty: true, shouldTouch: true })}
                      className={`${segmentBtnClass(active)} inline-flex items-center gap-1.5`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {language === 'ar' ? fmt.labelAr : fmt.labelEn}
                    </button>
                  )
                })}
              </div>

              <div className={segmentWrapClass}>
                <button type="button" onClick={() => setInvoiceType('B2B')} className={segmentBtnClass(invoiceType === 'B2B')}>
                  B2B
                </button>
                <button type="button" onClick={() => setInvoiceType('B2C')} className={segmentBtnClass(invoiceType === 'B2C')}>
                  B2C
                </button>
              </div>

              <div className="ms-auto flex min-w-0 max-w-full items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
                  <img
                    src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-lg border border-slate-200/80 object-contain bg-white p-0.5 dark:border-white/10"
                  />
                ) : null}
                <span className="truncate font-medium text-slate-700 dark:text-slate-200" title={sellerLine}>
                  {sellerLine || (language === 'ar' ? 'بيانات المنشأة' : 'Company')}
                </span>
              </div>
            </div>
            <input type="hidden" {...register('printFormat')} />
            <input type="hidden" {...register('businessContext')} />
            <input type="hidden" {...register('invoiceSubtype')} />
            <input type="hidden" {...register('pdfTemplateId')} />
          </div>

          {(isRestaurantContext || isTravelContext || isManpowerContext) && (
            <div className={`${sectionCardClass} !py-3`}>
              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
                <div className="md:col-span-9">
                  <label className={fieldLabelClass}>
                    {isRestaurantContext
                      ? (language === 'ar' ? 'طلب مطعم' : 'Restaurant order')
                      : isTravelContext
                        ? (language === 'ar' ? 'حجز سفر' : 'Travel booking')
                        : (language === 'ar' ? 'تعيين عمالة' : 'Manpower assignment')}
                  </label>
                  <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`mt-1 ${fieldControlClass}`}>
                    <option value="">{language === 'ar' ? 'اختر…' : 'Select…'}</option>
                    {isRestaurantContext
                      ? (Array.isArray(restaurantOrders) ? restaurantOrders : []).map((item) => <option key={item._id} value={item._id}>{item.orderNumber} - {Number(item.grandTotal || 0).toFixed(2)}</option>)
                      : null}
                    {isTravelContext
                      ? (Array.isArray(travelBookings) ? travelBookings : []).map((item) => <option key={item._id} value={item._id}>{item.bookingNumber} - {Number(item.grandTotal || 0).toFixed(2)}</option>)
                      : null}
                    {isManpowerContext
                      ? (Array.isArray(manpowerAssignments) ? manpowerAssignments : []).map((item) => <option key={item._id} value={item._id}>{item.assignmentNumber} - {item.clientId?.name || 'Customer'}</option>)
                      : null}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <button type="button" className="btn btn-secondary w-full" disabled={!sourceId || importSourceMutation.isPending} onClick={() => importSourceMutation.mutate()}>
                    {importSourceMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" /> : (language === 'ar' ? 'استيراد' : 'Import')}
                  </button>
                </div>
              </div>
              <input type="hidden" {...register('restaurantOrderId')} />
              <input type="hidden" {...register('travelBookingId')} />
              <input type="hidden" {...register('manpowerAssignmentId')} />
              <input type="hidden" {...register('contractNumber')} />
            </div>
          )}

          {isTravelContext && (
            <div className={`${sectionCardClass} !py-3`}>
              <label className={fieldLabelClass}>
                {language === 'ar' ? 'تاريخ ووقت الإصدار' : 'Issue date & time'}
              </label>
              <input type="datetime-local" {...register('issueDate')} className={`mt-1 max-w-sm ${fieldControlClass}`} />
            </div>
          )}

          <div className={`${sectionCardClass} space-y-2.5 !p-3.5`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'العميل' : 'Customer'}
              </h3>
              {invoiceType === 'B2C' ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {language === 'ar' ? 'نقدي / تجزئة' : 'Cash / retail'}
                </span>
              ) : null}
            </div>
            <PartnerCombobox
              role="customer"
              value={values?.customerId || ''}
              selectedOption={selectedCustomer}
              ar={language === 'ar'}
              language={language}
              onChange={onSelectCustomer}
              showNewButton
            />
            {selectedCustomer?._id ? (
              <CustomerSummaryCard
                customer={selectedCustomer}
                language={language}
                onEdit={() => {
                  const returnTo = `${window.location.pathname}${window.location.search}`
                  navigate(`/app/dashboard/customers/${selectedCustomer._id}?returnTo=${encodeURIComponent(returnTo)}`)
                }}
                onClear={() => onSelectCustomer('', null)}
              />
            ) : (
              <p className="text-[11px] text-slate-400">
                {language === 'ar'
                  ? 'اختر عميلاً من القائمة أو أنشئ عميلاً جديداً في النافذة المنبثقة'
                  : 'Pick a customer or tap New to create one in a pop-out'}
              </p>
            )}
            <input type="hidden" {...register('customerId')} />
            {/* Party data lives on the contact — kept as hidden for submit/ZATCA */}
            <input type="hidden" {...register('buyer.name', { required: invoiceType === 'B2B' && invoiceSubtype !== 'travel_ticket' })} />
            <input type="hidden" {...register('buyer.nameAr')} />
            <input type="hidden" {...register('buyer.vatNumber', { required: invoiceType === 'B2B' && invoiceSubtype !== 'travel_ticket' })} />
            <input type="hidden" {...register('buyer.crNumber')} />
            <input type="hidden" {...register('buyer.contactPhone')} />
            <input type="hidden" {...register('buyer.contactEmail')} />
            <input type="hidden" {...register('buyer.address.city')} />
            <input type="hidden" {...register('buyer.address.cityAr')} />
            <input type="hidden" {...register('buyer.address.district')} />
            <input type="hidden" {...register('buyer.address.districtAr')} />
            <input type="hidden" {...register('buyer.address.street')} />
            <input type="hidden" {...register('buyer.address.streetAr')} />
            <input type="hidden" {...register('buyer.address.postalCode')} />
            <input type="hidden" {...register('buyer.address.country')} />
            <input type="hidden" {...register('buyer.address.buildingNumber')} />
            <input type="hidden" {...register('buyer.address.additionalNumber')} />
            <input type="hidden" {...register('buyer.address.shortAddress')} />
            {invoiceSubtype === 'travel_ticket' ? (
              <TravelInvoiceFields language={language} register={register} control={control} watch={watch} setValue={setValue} />
            ) : null}
            {invoiceType === 'B2C' && !selectedCustomer?._id ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" dir="ltr">
                <div>
                  <FieldLabel en="Walk-in name" ar="اسم نقدي" />
                  <input
                    className={compactFieldClass}
                    placeholder={language === 'ar' ? 'عميل نقدي' : 'Cash customer'}
                    value={watch('buyer.name') || ''}
                    onChange={(e) => setValue('buyer.name', e.target.value, { shouldDirty: true })}
                  />
                </div>
                <div>
                  <FieldLabel en="Phone" ar="الهاتف" />
                  <input
                    className={compactFieldClass}
                    value={watch('buyer.contactPhone') || ''}
                    onChange={(e) => setValue('buyer.contactPhone', e.target.value, { shouldDirty: true })}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {isMarqueeContext && (
            <MarqueeEventFields
              values={values}
              setValue={setValue}
              register={register}
              currency={tenant?.settings?.currency || 'SAR'}
              language={language}
              onApplyPackageItems={handleApplyMarqueePackage}
            />
          )}

          <div className={`${sectionCardClass} space-y-2 !p-0 overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/90 px-3.5 py-2.5 dark:border-dark-600">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'البنود' : 'Lines'}
              </h3>
              <button type="button" onClick={() => append(getEmptyLine(tenant))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200">
                <Plus className="w-3.5 h-3.5" />{t('add')}
              </button>
            </div>
            <div className="space-y-1.5 px-3.5 pb-3.5 pt-1">
              {fields.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center dark:border-dark-600 dark:bg-dark-900/40">
                  <p className="text-xs font-medium text-slate-500">
                    {language === 'ar' ? 'لا توجد بنود بعد' : 'No lines yet'}
                  </p>
                  <button
                    type="button"
                    onClick={() => replace(mapSellLineItems(initialInvoice, tenant))}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {language === 'ar' ? 'تحميل البنود' : 'Load lines'}
                  </button>
                </div>
              ) : null}
              {fields.map((field, index) => (
                <div key={field.fieldId || field.id || `line-${index}`} className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-2.5 dark:border-dark-600 dark:bg-dark-900/40">
                  <LineItemTranslator
                    index={index}
                    control={control}
                    watch={watch}
                    setValue={setValue}
                    enabled={!watch(`lineItems.${index}.productId`)}
                    initialNameAr={initialInvoice?.lineItems?.[index]?.productNameAr || ''}
                    initialName={initialInvoice?.lineItems?.[index]?.productName || ''}
                  />
                  <input type="hidden" {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} />
                  <input type="hidden" {...register(`lineItems.${index}.isTravelMargin`)} />
                  <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                  <div className="grid grid-cols-2 items-end gap-2 lg:grid-cols-12" dir="ltr">
                    <div className={`col-span-2 ${isTravelContext
                      ? (showArabicFields ? 'lg:col-span-3' : 'lg:col-span-4')
                      : (showArabicFields ? 'lg:col-span-3' : 'lg:col-span-4')}`}>
                      {isTradingContext ? (
                        <div className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white pe-1 ps-1 dark:border-white/10 dark:bg-dark-800">
                          <ProductTypeToggle
                            value={watch(`lineItems.${index}.productType`)}
                            onChange={(next) => {
                              const opts = { shouldDirty: true, shouldTouch: true }
                              setValue(`lineItems.${index}.productType`, next, opts)
                              const pid = watch(`lineItems.${index}.productId`)
                              if (!pid) return
                              const selected = productList.find((p) => p._id === pid)
                              if (selected && normalizeProductType(selected.productType) !== next) {
                                setValue(`lineItems.${index}.productId`, '', opts)
                                setValue(`lineItems.${index}.variantId`, '', opts)
                                setValue(`lineItems.${index}.productName`, '', opts)
                                setValue(`lineItems.${index}.productNameAr`, '', opts)
                                setValue(`lineItems.${index}.unitPrice`, 0, opts)
                              }
                            }}
                            language={language}
                            bare
                          />
                          <div className="h-5 w-px shrink-0 bg-slate-200/90 dark:bg-white/10" aria-hidden />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <CreatableSelect
                              inputId={`product-select-${index}`}
                              name={`react-select-product-${index}`}
                              options={productList
                                .filter((p) => normalizeProductType(p.productType) === normalizeProductType(watch(`lineItems.${index}.productType`)))
                                .map((p) => ({
                                  value: p._id,
                                  label: productPickerLabel(p, language, { includeType: false }),
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
                              placeholder={
                                normalizeProductType(watch(`lineItems.${index}.productType`)) === 'service'
                                  ? (language === 'ar' ? 'اختر خدمة…' : 'Select service…')
                                  : (language === 'ar' ? 'اختر منتج…' : 'Select product…')
                              }
                              isClearable
                              isSearchable
                              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                              menuPosition="fixed"
                              menuShouldScrollIntoView={false}
                              styles={{
                                ...denseSelectStyles,
                                container: (base) => ({ ...base, width: '100%', minWidth: 0 }),
                                control: (base, state) => ({
                                  ...(denseSelectStyles.control?.(base, state) || base),
                                  border: 'none',
                                  boxShadow: 'none',
                                  background: 'transparent',
                                  minHeight: 34,
                                  minWidth: 0,
                                  padding: 0,
                                  cursor: 'text',
                                }),
                                valueContainer: (base) => ({
                                  ...base,
                                  padding: '0 4px',
                                  minWidth: 0,
                                  overflow: 'hidden',
                                }),
                                input: (base) => ({ ...base, margin: 0, padding: 0, minWidth: '2ch' }),
                                placeholder: (base) => ({
                                  ...base,
                                  color: '#94a3b8',
                                  fontSize: '0.8125rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                }),
                                singleValue: (base) => ({
                                  ...base,
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontWeight: 500,
                                  color: '#0f172a',
                                }),
                                indicatorsContainer: (base) => ({ ...base, height: 34, flexShrink: 0 }),
                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                menu: (base) => ({
                                  ...base,
                                  minWidth: 320,
                                  width: 'max(320px, 100%)',
                                  maxWidth: 'min(92vw, 480px)',
                                  borderRadius: '0.75rem',
                                  overflow: 'hidden',
                                  boxShadow: '0 12px 40px -12px rgba(15,23,42,0.28)',
                                }),
                                option: (base, state) => ({
                                  ...base,
                                  fontSize: '0.875rem',
                                  backgroundColor: state.isFocused ? '#f1f5f9' : '#fff',
                                  color: '#0f172a',
                                  cursor: 'pointer',
                                }),
                              }}
                            />
                          </div>
                          <input type="hidden" {...register(`lineItems.${index}.productName`)} />
                          <input type="hidden" {...register(`lineItems.${index}.productId`)} />
                          <input type="hidden" {...register(`lineItems.${index}.variantId`)} />
                        </div>
                      ) : (
                        <div className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white pe-1 ps-1 dark:border-white/10 dark:bg-dark-800">
                          <ProductTypeToggle
                            value={watch(`lineItems.${index}.productType`)}
                            onChange={(next) => setValue(`lineItems.${index}.productType`, next, { shouldDirty: true, shouldTouch: true })}
                            language={language}
                            bare
                          />
                          <div className="h-5 w-px shrink-0 bg-slate-200/90 dark:bg-white/10" aria-hidden />
                          <input id={`product-select-${index}`} {...register(`lineItems.${index}.productName`)} className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm outline-none" placeholder={language === 'ar' ? 'اسم الخدمة' : 'Service name'} />
                        </div>
                      )}
                      {isTradingContext && watch(`lineItems.${index}.productId`) ? (
                        <div className="mt-1">
                          <VariantLineSelect
                            productId={watch(`lineItems.${index}.productId`)}
                            value={watch(`lineItems.${index}.variantId`)}
                            language={language}
                            onChange={(variantId, variant) => {
                              setValue(`lineItems.${index}.variantId`, variantId || '', { shouldDirty: true })
                              if (variant?.name) {
                                setValue(`lineItems.${index}.productName`, variant.name, { shouldDirty: true })
                              }
                              if (variant?.price != null && Number(variant.price) > 0) {
                                setValue(`lineItems.${index}.unitPrice`, Number(variant.price), { shouldDirty: true })
                              }
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    {showArabicFields ? (
                      <div className={`col-span-2 ${isTravelContext ? 'lg:col-span-3' : 'lg:col-span-3'}`}>
                        <input
                          {...register(`lineItems.${index}.productNameAr`)}
                          className={denseControlClass}
                          dir="auto"
                          placeholder="اسم البند"
                          aria-label="Arabic name"
                        />
                      </div>
                    ) : (
                      <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                    )}
                    <div className="col-span-1 lg:col-span-2">
                      <label htmlFor={`unit-${index}`} className={`${fieldLabelClass} !mb-0.5 text-[11px]`}>{language === 'ar' ? 'وحدة' : 'UOM'}</label>
                      <Select
                        className="react-select-container"
                        classNamePrefix="react-select"
                        isClearable
                        isSearchable
                        placeholder="—"
                        styles={denseSelectStyles}
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
                          { value: '', label: '—' },
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
                      <div className="col-span-1 lg:col-span-1">
                        <label htmlFor={`qty-${index}`} className={`${fieldLabelClass} !mb-0.5 text-[11px]`}>{t('quantity')}</label>
                        <input id={`qty-${index}`} type="number" min="0.0001" step="any" {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0.0001 })} className={denseControlClass} />
                      </div>
                    )}
                    <div className="col-span-1 lg:col-span-2">
                      <label htmlFor={`price-${index}`} className={`${fieldLabelClass} !mb-0.5 text-[11px]`}>
                        {isTravelContext
                          ? (language === 'ar' ? 'سعر التذكرة' : 'Unit Price')
                          : t('unitPrice')}
                      </label>
                      <input id={`price-${index}`} type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })} className={denseControlClass} />
                    </div>
                    {isTravelContext ? (
                      <>
                        <div className="col-span-1 lg:col-span-2">
                          <label htmlFor={`agencyprice-${index}`} className={`${fieldLabelClass} !mb-0.5 text-[11px]`}>{language === 'ar' ? 'سعر الوكالة' : 'Agency'}</label>
                          <input
                            id={`agencyprice-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${index}.agencyPrice`, { valueAsNumber: true, min: 0 })}
                            className={denseControlClass}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-2">
                          <label htmlFor={`custprice-${index}`} className={`${fieldLabelClass} !mb-0.5 text-[11px]`}>
                            {language === 'ar' ? 'سعر العميل' : 'Customer'}
                          </label>
                          <input
                            id={`custprice-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${index}.customerPrice`, { valueAsNumber: true, min: 0 })}
                            className={denseControlClass}
                            placeholder="0.00"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-1 lg:col-span-1">
                        <label className={`${fieldLabelClass} !mb-0.5 text-[11px]`}>{t('tax')} %</label>
                        {(() => {
                          const isPkTax = String(tenant?.settings?.currency || '').toUpperCase() === 'PKR' || (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
                          const pkRate = Number(tenant?.fbr?.defaultSalesTaxRate || 18)
                          return (
                            <select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className={denseControlClass}>
                              {isPkTax ? (
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
                    )}
                    <div className="col-span-2 flex items-center justify-end gap-1.5 lg:col-span-2">
                      <div className="text-end">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('total')}</p>
                        <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white"><Money value={calculateLineTotal(index).total} /></p>
                      </div>
                      {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                  {isTradingContext && lineItems?.[index]?.productId ? (
                    <div className="mt-1.5">
                      <LineRelationSuggestions
                        productId={lineItems[index].productId}
                        currentUnitPrice={lineItems[index].unitPrice}
                        products={productList}
                        language={language}
                        onAdd={appendRelatedProduct}
                        onSwap={(row) => swapLineProduct(index, row)}
                      />
                    </div>
                  ) : null}
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
                      <div className="mt-1.5 rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-2 dark:border-primary-900/40 dark:bg-primary-900/10">
                        <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-12">
                          <div className="col-span-2 md:col-span-6">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                              {language === 'ar'
                                ? 'الضريبة على هامش الربح فقط'
                                : 'VAT on travel margin only'}
                            </p>
                          </div>
                          <div className="md:col-span-2 text-end">
                            <p className="text-[10px] text-gray-500">{language === 'ar' ? 'هامش' : 'Margin'}</p>
                            <p className="text-sm font-semibold text-emerald-600"><Money value={marginProfit} /></p>
                          </div>
                          <div className="md:col-span-2 text-end">
                            <p className="text-[10px] text-gray-500">{language === 'ar' ? 'ضريبة' : 'VAT'}</p>
                            <p className="text-sm font-semibold text-amber-600"><Money value={marginVat} /></p>
                          </div>
                          <div className="md:col-span-2 text-end">
                            <p className="text-[10px] text-gray-500">{language === 'ar' ? 'صافي' : 'Net'}</p>
                            <p className="text-sm font-semibold text-primary-600"><Money value={netMarginProfit} /></p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>

          <SalesEnhancementBar
            subtotal={totals.subtotal}
            customerId={values?.customerId}
            incoterm={values?.incoterm || ''}
            onIncotermChange={(v) => setValue('incoterm', v)}
            onApplyDiscountLine={(line) => append({
              ...getEmptyLine(tenant),
              productName: line.productName,
              quantity: line.quantity || 1,
              unitPrice: line.unitPrice,
              productType: line.productType || 'service',
            })}
            onAddLines={(lines) => {
              for (const line of lines) {
                append({
                  ...getEmptyLine(tenant),
                  productId: line.productId || '',
                  variantId: line.variantId || '',
                  productName: line.productName,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                })
              }
            }}
            onAddShippingLine={(line) => append({
              ...getEmptyLine(tenant),
              productName: line.productName,
              quantity: 1,
              unitPrice: line.unitPrice,
              productType: 'service',
            })}
          />

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
                  className="overflow-hidden border-t border-slate-100 pt-4 dark:border-white/5"
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
                  className="overflow-hidden border-t border-slate-100 pt-4 dark:border-white/5"
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
                      <input {...register('bankDetails.bankName')} className={`mt-1.5 ${fieldControlClass}`} placeholder={showArabicFields ? "Al Rajhi Bank / SNB" : "Habib Bank / Standard Chartered"} />
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
                      <FieldLabel en={showArabicFields ? "IBAN" : "IBAN / Swift"} ar="الآيبان" />
                      <input {...register('bankDetails.iban')} className={`mt-1.5 ${fieldControlClass} font-mono`} placeholder={showArabicFields ? "SA0000000000000000000000" : "PK00XXXX0000000000000000"} />
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
                          const issueRaw = getValues('issueDate')
                          const issue = issueRaw ? new Date(issueRaw) : new Date()
                          const due = computeDueDateFromPaymentTerms(issue, term.id)
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
                      INVOICE_PAYMENT_TERMS.slice(0, 5).some((t) => t.id === watch('paymentTerms'))
                        ? 'text-slate-400'
                        : 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                    }`}
                    onChange={(e) => {
                      const id = e.target.value
                      setValue('paymentTerms', id, { shouldDirty: true })
                      const issueRaw = getValues('issueDate')
                      const issue = issueRaw ? new Date(issueRaw) : new Date()
                      const due = computeDueDateFromPaymentTerms(issue, id)
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
                    {showMargin ? (
                      <div className="flex justify-between"><span>{language === 'ar' ? 'الهامش' : 'Margin'}</span><span className="tabular-nums text-slate-900 dark:text-white"><Money value={estimatedMargin} /></span></div>
                    ) : null}
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900 dark:border-white/10 dark:text-white">
                    <span>{t('total')}</span>
                    <span className="tabular-nums"><Money value={totals.grandTotal} /></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warehouse auto-selected in background when inventory engine requires it */}
            <input type="hidden" {...register('warehouseId', {
              required: engineRequiresWarehouse
                ? (language === 'ar' ? 'المستودع مطلوب' : 'Warehouse required')
                : false,
            })} />

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'اضغط معاينة لمراجعة الفاتورة قبل الحفظ'
                  : 'Tap Preview to review the invoice before saving'}
              </p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => navigate(isEdit ? `/app/dashboard/invoices/${invoiceId}` : '/app/dashboard/invoices')} className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-dark-500 dark:bg-transparent dark:text-slate-300">{t('cancel')}</button>
                <button type="submit" disabled={saveMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 dark:bg-white dark:text-slate-900">
                  {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <><Eye className="w-4 h-4" />{language === 'ar' ? 'معاينة' : 'Preview'}</>}
                </button>
              </div>
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


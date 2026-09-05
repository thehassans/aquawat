import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Save, Trash2, UploadCloud, FileText, Receipt, Eye, RotateCcw } from 'lucide-react'
import InvoicePrePostChecklist from './InvoicePrePostChecklist'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../ui/Money'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage, isGccArabicMarket } from '../../lib/invoiceLanguage'
import { useLiveTranslation, useBilingualAddressFields, LineItemTranslator } from '../../lib/liveTranslation'
import { INVOICE_PAYMENT_TERMS, computeDueDateFromPaymentTerms, computeDueDateOnlyFromPaymentTerms, isImmediatePaymentTerm, formPaymentStatusFromInvoice, applyFormPaymentToPayload } from '../../lib/invoicePaymentTerms'
import { extractDateOnly, dateOnlyToUtcNoon } from '../../lib/dateOnly'
import { isValidSaudiVat, saudiVatErrorMessage, normalizeSaudiVatDigits } from '../../lib/saudiVat'
import { resolveTransactionTypeFromParty, invoiceTypeCodeForTransaction, zatcaInvoiceKindForTransaction, transactionTypeBadgeLabel, transactionTypeReasonLine, isWalkInOrCashCustomer, partyHasValidVat } from '../../lib/transactionType'
import DocumentPreSaveModal from './DocumentPreSaveModal'
import InvoiceTemplateSelector from './InvoiceTemplateSelector'
import TravelInvoiceFields from './TravelInvoiceFields'
import BoutiqueInvoiceFields, {
  boutiqueDetailsFromInvoice,
  emptyBoutiqueDetails,
  sanitizeBoutiqueDetails,
} from './BoutiqueInvoiceFields'
import CreatableSelect from 'react-select/creatable'
import { getAvailableUomOptions, getDefaultUom } from '../../lib/uomOptions'
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
  ghostActionClass,
  pageTitleClass,
  primaryActionClass,
  sectionCardClass,
  sectionEyebrowClass,
  sectionTitleClass,
} from '../../pages/sales/salesUi'
import SalesEnhancementBar from '../sales/SalesEnhancementBar'
import { canViewSalesMargin } from '../../lib/salesPermissions'
import { useSalesSettings } from '../../context/SalesSettingsContext'
import { resolveInvoiceLineColumnSettings, sellLineProductColSpan, SELL_PRODUCT_COL_CLASS } from '../../lib/invoiceLineColumns'
import InvoiceJournalItemsPanel, { InvoiceDocumentReferencesBar } from './InvoiceJournalItemsPanel'
import AccountingDocumentShell from '../accounting/AccountingDocumentShell'
import CancelInvoiceModal from '../accounting/CancelInvoiceModal'
import {
  CREDIT_NOTE_STATUS_STEPS,
  INVOICE_STATUS_STEPS,
  canCancelInvoice,
  canResetInvoiceToDraft,
  canRegisterPaymentOnInvoice,
  invoiceRemainingBalance,
  resolveInvoiceRibbonStep,
} from '../../lib/accountingDocumentStatus'
import { INCOTERMS } from '../../pages/sales/salesConfig.menu'

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
    costPrice: '',
    unitCost: '',
    isTravelMargin: false,
    sourcePoItemId: '',
    sourceDnItemId: '',
    incomeAccountId: '',
    analyticAccountId: '',
  }
}

const idOf = (value) => {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || value.id || '')
  return String(value)
}

function sellLineHasContent(line) {
  if (!line || typeof line !== 'object') return false
  if (String(line.productId || '').trim()) return true
  if (String(line.productName || '').trim()) return true
  if (String(line.productNameAr || '').trim()) return true
  if (Number(line.unitPrice) > 0) return true
  return false
}

function describeSellFormErrors(errs, language = 'en', selectedCustomer = null) {
  if (!errs || typeof errs !== 'object') {
    return language === 'ar' ? 'أكمل الحقول المطلوبة قبل الحفظ' : 'Complete the required fields before saving'
  }
  if (errs.buyer?.vatNumber || errs.buyer?.crNumber || errs.buyer?.name) {
    if (selectedCustomer?._id) {
      const missing = []
      if (errs.buyer?.name) missing.push(language === 'ar' ? 'الاسم' : 'name')
      if (errs.buyer?.vatNumber) missing.push(language === 'ar' ? 'الضريبة' : 'VAT')
      if (errs.buyer?.crNumber) missing.push(language === 'ar' ? 'السجل التجاري' : 'CR')
      return language === 'ar'
        ? `بيانات العميل ناقصة (${missing.join('، ')}) — حدّث ملف العميل أو استخدم B2C`
        : `Customer profile is missing ${missing.join(', ')} — update the customer record or switch to B2C`
    }
    return language === 'ar'
      ? 'فاتورة B2B تتطلب اسم العميل ورقم الضريبة والسجل التجاري'
      : 'B2B invoices require customer name, VAT, and CR — switch to B2C for walk-in sales'
  }
  if (errs.lineItems) {
    return language === 'ar' ? 'تحقق من بنود الفاتورة (الكمية والسعر)' : 'Check invoice lines (quantity and price)'
  }
  return language === 'ar' ? 'أكمل الحقول المطلوبة قبل الحفظ' : 'Complete the required fields before saving'
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
      costPrice: Math.max(0, toNumber(plain?.costPrice ?? plain?.unitCost, 0)),
      unitCost: Math.max(0, toNumber(plain?.unitCost ?? plain?.costPrice, 0)),
      isTravelMargin: Boolean(plain?.isTravelMargin),
      productType: normalizeProductType(plain?.productType),
      incomeAccountId: idOf(plain?.incomeAccountId),
      analyticAccountId: idOf(plain?.analyticAccountId),
    }
  }).filter((line) => line.productName || line.unitPrice > 0 || line.productId)
  return mapped.length ? mapped : [{ ...empty }]
}
const selectableContexts = ['trading', 'marquee', 'construction', 'travel_agency', 'restaurant', 'manpower', 'furniture', 'furniture_shop', 'boutique']
const SELL_ORDER_FILL_STATUSES = new Set(['approved', 'partially_delivered', 'delivered'])

const bilingualPairGridClass = 'grid grid-cols-1 gap-x-3 gap-y-1.5 md:grid-cols-2'
const denseControlClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-400'
const lineGhostInputClass =
  'w-full min-w-0 rounded-md border-0 bg-transparent px-1 py-1.5 text-[12px] font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:bg-slate-50 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/5'
/** Fluid 12-col grid — all columns stay on screen (no horizontal scroll). */
const sellStandardLineGridClass = 'lg:grid-cols-12'
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
  transactionType: invoice?.transactionType || 'B2C',
  invoiceTypeCode: invoice?.invoiceTypeCode || (invoice?.transactionType === 'B2B' ? '0100000' : '0200000'),
  paymentMethod: invoice?.paymentMethod || 'cash',
  paidAmount: toNumber(invoice?.paidAmount, 0),
  paymentStatus: formPaymentStatusFromInvoice(invoice),
  customerId: (invoice?.customerId && typeof invoice.customerId === 'object')
    ? (invoice.customerId._id || '')
    : (invoice?.customerId || ''),
  warehouseId: invoice?.warehouseId || '',
  sourcePurchaseOrderId: (invoice?.sourcePurchaseOrderId && typeof invoice.sourcePurchaseOrderId === 'object')
    ? (invoice.sourcePurchaseOrderId._id || '')
    : (invoice?.sourcePurchaseOrderId || ''),
  sourceDeliveryNoteId: (invoice?.sourceDeliveryNoteId && typeof invoice.sourceDeliveryNoteId === 'object')
    ? (invoice.sourceDeliveryNoteId._id || '')
    : (invoice?.sourceDeliveryNoteId || ''),
  deliveryNoteIds: Array.isArray(invoice?.deliveryNoteIds)
    ? invoice.deliveryNoteIds.map((id) => (id && typeof id === 'object' ? id._id : id)).filter(Boolean)
    : [],
  restaurantOrderId: invoice?.restaurantOrderId || '',
  travelBookingId: invoice?.travelBookingId || '',
  manpowerAssignmentId: invoice?.manpowerAssignmentId || '',
  contractNumber: invoice?.contractNumber || '',
  customerReference: invoice?.customerReference || '',
  incoterm: invoice?.incoterm || '',
  salespersonId: idOf(invoice?.salespersonId),
  fiscalPosition: invoice?.fiscalPosition || '',
  internalNotes: invoice?.internalNotes || '',
  notes: invoice?.notes || '',
  termsAndConditions: invoice?.termsAndConditions || '',
  termsAndConditionsAr: invoice?.termsAndConditionsAr || '',
  notesAr: invoice?.notesAr || '',
  includeBankDetails: Boolean(invoice?.includeBankDetails),
  bankDetails: {
    bankName: invoice?.bankDetails?.bankName || '',
    accountName: invoice?.bankDetails?.accountName || '',
    accountNumber: invoice?.bankDetails?.accountNumber || '',
    iban: invoice?.bankDetails?.iban || '',
    swift: invoice?.bankDetails?.swift || '',
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
  boutiqueDetails: boutiqueDetailsFromInvoice(invoice),
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
    if (invoice?.dueDate) return extractDateOnly(invoice.dueDate) || ''
    const issue = invoice?.issueDate || new Date()
    return computeDueDateOnlyFromPaymentTerms(issue, invoice?.paymentTerms || 'immediate') || ''
  })(),
})

export default function InvoiceSellComposer({ invoiceId = '', initialInvoice = null }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isProformaCreate = searchParams.get('proforma') === '1'
  const partnerIdParam = String(searchParams.get('partnerId') || '').trim()
  const deliveryNoteIdParam = String(searchParams.get('deliveryNoteId') || '').trim()
  const soIdParam = String(searchParams.get('soId') || '').trim()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { settings: salesSettings } = useSalesSettings()
  const { showAccount: showAccountColumnSetting, showAnalytic: showAnalyticColumn } = resolveInvoiceLineColumnSettings(salesSettings)
  const [forceShowAccountColumn, setForceShowAccountColumn] = useState(false)
  const showAccountColumn = showAccountColumnSetting || forceShowAccountColumn
  const sellProductColSpan = sellLineProductColSpan({ showAccount: showAccountColumn, showAnalytic: showAnalyticColumn })
  const sellProductColClass = SELL_PRODUCT_COL_CLASS[sellProductColSpan] || SELL_PRODUCT_COL_CLASS[3]
  const { t } = useTranslation(language)
  const showArabicFields = isArabicTenantMarket(tenant)
  const isPk = isPakistanTenant(tenant)
  const taxLabel = getTaxLabel(tenant)
  const taxIdLabel = getTaxIdLabel(tenant)
  const [invoiceType, setInvoiceType] = useState(() => (
    initialInvoice?.transactionType === 'B2B' ? 'B2B' : 'B2C'
  ))
  /** Manual B2B↔B2C override (cleared when customer changes). */
  const [typeOverride, setTypeOverride] = useState(null)
  const typeOverrideRef = useRef(null)
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const isEdit = Boolean(invoiceId)
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    const c = initialInvoice?.customerId
    return c && typeof c === 'object' ? c : null
  })
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState(
    () => idOf(initialInvoice?.sourcePurchaseOrderId) || soIdParam
  )
  const filledSoIdRef = useRef('')
  const shouldFillFromSoRef = useRef(Boolean(soIdParam) && !isEdit && !deliveryNoteIdParam)
  const [documentReferences, setDocumentReferences] = useState(
    () => (Array.isArray(initialInvoice?.documentReferences) ? initialInvoice.documentReferences : [])
  )
  const [accountingLines, setAccountingLines] = useState(
    () => (Array.isArray(initialInvoice?.accountingLines) ? initialInvoice.accountingLines : [])
  )
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
  const [showNotesPanel, setShowNotesPanel] = useState(() => Boolean(
    String(initialInvoice?.notes || '').trim() || String(initialInvoice?.notesAr || '').trim()
  ))
  const [showTermsPanel, setShowTermsPanel] = useState(() => Boolean(
    String(initialInvoice?.termsAndConditions || '').trim() || String(initialInvoice?.termsAndConditionsAr || '').trim()
  ))
  const [showBankPanel, setShowBankPanel] = useState(() => Boolean(
    initialInvoice?.includeBankDetails ||
    initialInvoice?.bankDetails?.bankName ||
    initialInvoice?.bankDetails?.iban ||
    initialInvoice?.bankDetails?.accountNumber
  ))
  const [showRentalPanel, setShowRentalPanel] = useState(() => Boolean(
    initialInvoice?.businessContext === 'boutique' ||
    initialInvoice?.boutiqueDetails?.transactionType === 'rental' ||
    initialInvoice?.boutiqueDetails?.startDate ||
    initialInvoice?.rentalId
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

  const { register, control, handleSubmit, watch, setValue, getValues, reset, clearErrors, formState: { errors } } = useForm({
    defaultValues: buildSellInvoiceFormValues({
      invoice: initialInvoice || (isProformaCreate ? { invoiceSubtype: 'proforma' } : null),
      tenant,
      defaultBusinessContext,
      hasTravel: tenantBusinessTypes.includes('travel_agency'),
    })
  })

  useEffect(() => {
    if (invoiceId || !salesSettings) return
    const personal = user?.invoiceSettings || {}
    const defaultTerms = personal.termsAndConditions || salesSettings.invoiceDefaultTerms
    const defaultTermsAr = personal.termsAndConditionsAr || salesSettings.invoiceDefaultTermsAr
    const defaultNotes = personal.notes || salesSettings.invoiceDefaultNotes
    const defaultNotesAr = personal.notesAr || salesSettings.invoiceDefaultNotesAr
    if (!getValues('termsAndConditions') && defaultTerms) {
      setValue('termsAndConditions', defaultTerms)
      setShowTermsPanel(true)
    }
    if (!getValues('termsAndConditionsAr') && defaultTermsAr) {
      setValue('termsAndConditionsAr', defaultTermsAr)
      setShowTermsPanel(true)
    }
    if (!getValues('notes') && defaultNotes) {
      setValue('notes', defaultNotes)
      setShowNotesPanel(true)
    }
    if (!getValues('notesAr') && defaultNotesAr) {
      setValue('notesAr', defaultNotesAr)
      setShowNotesPanel(true)
    }
  }, [salesSettings, invoiceId, getValues, setValue, user?.invoiceSettings])

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems', keyName: 'fieldId' })
  // Scoped watches — avoid full-form watch() re-rendering the whole composer on every keystroke
  const lineItemsRaw = useWatch({ control, name: 'lineItems' })
  const lineItems = Array.isArray(lineItemsRaw) ? lineItemsRaw : []
  const businessContext = useWatch({ control, name: 'businessContext' }) || defaultBusinessContext
  const invoiceSubtype = useWatch({ control, name: 'invoiceSubtype' }) || 'standard'
  const pdfTemplateIdWatched = useWatch({ control, name: 'pdfTemplateId' })
  const selectedTemplateId = Number(pdfTemplateIdWatched || getInvoiceTemplateId(tenant, businessContext))
  const invoiceDiscountWatched = useWatch({ control, name: 'invoiceDiscount' })
  const paidAmountWatched = useWatch({ control, name: 'paidAmount' })
  const paymentStatusWatched = useWatch({ control, name: 'paymentStatus' })
  const paymentMethodWatched = useWatch({ control, name: 'paymentMethod' })
  const printFormatWatched = useWatch({ control, name: 'printFormat' })
  const issueDateWatched = useWatch({ control, name: 'issueDate' })
  const buyerWatched = useWatch({ control, name: 'buyer' })
  const travelDetailsWatched = useWatch({ control, name: 'travelDetails' })
  const boutiqueDetailsWatched = useWatch({ control, name: 'boutiqueDetails' })
  const notesWatched = useWatch({ control, name: 'notes' })
  const termsWatched = useWatch({ control, name: 'termsAndConditions' })
  const includeBankWatched = useWatch({ control, name: 'includeBankDetails' })
  const bankDetailsWatched = useWatch({ control, name: 'bankDetails' })
  const customerIdWatched = useWatch({ control, name: 'customerId' })
  const values = useMemo(() => ({
    lineItems,
    businessContext,
    invoiceSubtype,
    pdfTemplateId: selectedTemplateId,
    invoiceDiscount: invoiceDiscountWatched,
    paidAmount: paidAmountWatched,
    paymentStatus: paymentStatusWatched,
    paymentMethod: paymentMethodWatched,
    printFormat: printFormatWatched,
    issueDate: issueDateWatched,
    buyer: buyerWatched,
    travelDetails: travelDetailsWatched,
    boutiqueDetails: boutiqueDetailsWatched,
    notes: notesWatched,
    termsAndConditions: termsWatched,
    includeBankDetails: includeBankWatched,
    bankDetails: bankDetailsWatched,
    customerId: customerIdWatched,
  }), [
    lineItems, businessContext, invoiceSubtype, selectedTemplateId,
    invoiceDiscountWatched, paidAmountWatched, paymentStatusWatched, paymentMethodWatched,
    printFormatWatched, issueDateWatched, buyerWatched, travelDetailsWatched,
    boutiqueDetailsWatched, notesWatched, termsWatched, includeBankWatched,
    bankDetailsWatched, customerIdWatched,
  ])
  const isTradingContext = businessContext === 'trading'
  const isTravelContext = businessContext === 'travel_agency'
  const isRestaurantContext = businessContext === 'restaurant'
  const isManpowerContext = businessContext === 'manpower'
  const isBoutiqueContext = businessContext === 'boutique' || showRentalPanel
  const tenantHasBoutique = tenantBusinessTypes.includes('boutique')
  const enableInvoiceRental = salesSettings?.enableInvoiceRental === true
  const showRentalExtra = enableInvoiceRental || showRentalPanel || (
    tenantHasBoutique && Boolean(initialInvoice?.boutiqueDetails || initialInvoice?.rentalId)
  )
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
      if (!current.swift && tenantBank.swift) setValue('bankDetails.swift', tenantBank.swift)
    } else {
      setValue('bankDetails.bankName', '')
      setValue('bankDetails.accountName', '')
      setValue('bankDetails.accountNumber', '')
      setValue('bankDetails.iban', '')
      setValue('bankDetails.swift', '')
    }
  }

  useEffect(() => {
    if (invoiceId || initialInvoice) return
    const tenantBank = tenant?.business?.bankDetails || {}
    if (!(tenantBank.iban || tenantBank.bankName || tenantBank.accountNumber)) return
    handleToggleBankDetails(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once for new invoices when company bank exists
  }, [tenant?.business?.bankDetails?.iban, tenant?.business?.bankDetails?.bankName, invoiceId])

  const handleToggleTerms = (enable) => {
    setShowTermsPanel(enable)
    if (enable) {
      const personal = user?.invoiceSettings || {}
      if (!getValues('termsAndConditions')) {
        const defaultTerms = personal.termsAndConditions ||
          salesSettings?.invoiceDefaultTerms ||
          tenant?.settings?.invoiceBranding?.termsAndConditions ||
          tenant?.settings?.termsAndConditions ||
          tenant?.settings?.invoiceBranding?.defaultTermsAndConditions ||
          ''
        if (defaultTerms) setValue('termsAndConditions', defaultTerms)
      }
      if (!getValues('termsAndConditionsAr')) {
        const defaultTermsAr = personal.termsAndConditionsAr ||
          salesSettings?.invoiceDefaultTermsAr ||
          tenant?.settings?.invoiceBranding?.termsAndConditionsAr ||
          tenant?.settings?.termsAndConditionsAr ||
          ''
        if (defaultTermsAr) setValue('termsAndConditionsAr', defaultTermsAr)
      }
    } else {
      setValue('termsAndConditions', '')
      setValue('termsAndConditionsAr', '')
    }
  }

  const handleToggleNotes = (enable) => {
    setShowNotesPanel(enable)
    if (enable) {
      const personal = user?.invoiceSettings || {}
      if (!getValues('notes')) {
        const defaultNotes = personal.notes ||
          salesSettings?.invoiceDefaultNotes ||
          tenant?.settings?.invoiceBranding?.defaultNotes ||
          tenant?.settings?.notes ||
          ''
        if (defaultNotes) setValue('notes', defaultNotes)
      }
      if (!getValues('notesAr')) {
        const defaultNotesAr = personal.notesAr || salesSettings?.invoiceDefaultNotesAr || ''
        if (defaultNotesAr) setValue('notesAr', defaultNotesAr)
      }
    } else {
      setValue('notes', '')
      setValue('notesAr', '')
    }
  }

  const rentalContextBeforeRef = useRef(null)
  const handleToggleRental = (enable) => {
    setShowRentalPanel(enable)
    if (enable) {
      const currentCtx = getValues('businessContext') || defaultBusinessContext
      if (currentCtx !== 'boutique') {
        rentalContextBeforeRef.current = currentCtx
        setValue('businessContext', 'boutique', { shouldDirty: true })
      }
      const current = getValues('boutiqueDetails') || {}
      const defaults = emptyBoutiqueDetails({
        ...current,
        transactionType: current.transactionType === 'sale' ? 'sale' : 'rental',
        amountPaid: Number(getValues('paidAmount') ?? current.amountPaid) || 0,
        paymentMethod: getValues('paymentMethod') || current.paymentMethod || 'cash',
      })
      Object.entries(defaults).forEach(([key, value]) => {
        setValue(`boutiqueDetails.${key}`, value, { shouldDirty: true })
      })
    } else {
      const restoreCtx = rentalContextBeforeRef.current || defaultBusinessContext
      rentalContextBeforeRef.current = null
      if (getValues('businessContext') === 'boutique' && restoreCtx !== 'boutique') {
        setValue('businessContext', restoreCtx, { shouldDirty: true })
      }
      const cleared = emptyBoutiqueDetails({ transactionType: 'rental', startDate: '', endDate: '' })
      Object.entries(cleared).forEach(([key, value]) => {
        setValue(`boutiqueDetails.${key}`, value, { shouldDirty: true })
      })
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
    if (showRentalPanel) {
      setValue('businessContext', 'boutique')
      return
    }
    setValue('businessContext', defaultBusinessContext)
  }, [defaultBusinessContext, initialInvoice?._id, isEdit, setValue, showRentalPanel])

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
    setShowRentalPanel(Boolean(
      initialInvoice?.businessContext === 'boutique' ||
      initialInvoice?.boutiqueDetails?.transactionType === 'rental' ||
      initialInvoice?.boutiqueDetails?.startDate ||
      initialInvoice?.rentalId
    ))
    setSelectedSalesOrderId(idOf(initialInvoice?.sourcePurchaseOrderId) || '')
    setDocumentReferences(Array.isArray(initialInvoice?.documentReferences) ? initialInvoice.documentReferences : [])
    setAccountingLines(Array.isArray(initialInvoice?.accountingLines) ? initialInvoice.accountingLines : [])
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

  const applyTransactionType = (nextType, { clearBuyerTax = true } = {}) => {
    const type = nextType === 'B2C' ? 'B2C' : 'B2B'
    setInvoiceType(type)
    setValue('transactionType', type, { shouldDirty: true })
    setValue('invoiceTypeCode', invoiceTypeCodeForTransaction(type), { shouldDirty: true })
    if (type === 'B2C') {
      clearErrors(['buyer.name', 'buyer.vatNumber', 'buyer.crNumber'])
      if (clearBuyerTax) {
        const vat = normalizeSaudiVatDigits(getValues('buyer.vatNumber'))
        if (!isValidSaudiVat(vat)) {
          setValue('buyer.vatNumber', '', { shouldDirty: true })
          setValue('buyer.crNumber', '', { shouldDirty: true })
        } else {
          setValue('buyer.vatNumber', vat, { shouldDirty: true })
        }
      }
      if (!String(getValues('buyer.name') || '').trim()) {
        setValue(
          'buyer.name',
          selectedCustomer?.name || selectedCustomer?.nameEn || 'Cash Customer',
          { shouldValidate: false },
        )
      }
    }
  }

  const clearTypeOverride = () => {
    typeOverrideRef.current = null
    setTypeOverride(null)
  }

  const syncTxnFromParty = (customer) => {
    if (!customer) return
    if (typeOverrideRef.current) return
    const next = resolveTransactionTypeFromParty(customer)
    if (next !== invoiceType) applyTransactionType(next, { clearBuyerTax: next === 'B2C' })
    else {
      setValue('transactionType', next, { shouldDirty: false })
      setValue('invoiceTypeCode', invoiceTypeCodeForTransaction(next), { shouldDirty: false })
    }
  }

  const toggleTransactionType = () => {
    const next = invoiceType === 'B2B' ? 'B2C' : 'B2B'
    const override = {
      from: invoiceType,
      to: next,
      reason: next === 'B2B'
        ? (language === 'ar' ? 'تبديل يدوي إلى قياسية (B2B)' : 'Manual switch to Standard (B2B)')
        : (language === 'ar' ? 'تبديل يدوي إلى مبسطة (B2C)' : 'Manual switch to Simplified (B2C)'),
      at: new Date().toISOString(),
    }
    typeOverrideRef.current = override
    setTypeOverride(override)
    applyTransactionType(next, { clearBuyerTax: next === 'B2C' })
  }

  const fillBuyerFromParty = (customer) => {
    if (!customer) return
    syncTxnFromParty(customer)
    const nextTxn = typeOverrideRef.current?.to || resolveTransactionTypeFromParty(customer)
    const buyerOpts = { shouldDirty: true, shouldValidate: nextTxn === 'B2B' }
    setValue('customerId', customer._id, buyerOpts)
    setValue('buyer.name', customer.name || customer.nameEn || '', buyerOpts)
    setValue('buyer.nameAr', customer.nameAr || customer.name || customer.nameEn || '', buyerOpts)
    const rawVat = customer.vatNumber || customer.taxNumber || customer.vat || customer.trn || ''
    const vatNorm = normalizeSaudiVatDigits(rawVat)
    setValue(
      'buyer.vatNumber',
      nextTxn === 'B2C' && !isValidSaudiVat(vatNorm) ? '' : (vatNorm || rawVat || ''),
      { ...buyerOpts, shouldDirty: true },
    )
    setValue(
      'buyer.crNumber',
      nextTxn === 'B2C' && !isValidSaudiVat(vatNorm)
        ? ''
        : (customer.crNumber || customer.commercialRegistration?.crNumber || customer.cr || ''),
      { ...buyerOpts, shouldDirty: true },
    )
    setValue('buyer.address.city', customer.address?.city || '', buyerOpts)
    setValue('buyer.address.cityAr', customer.address?.cityAr || '', buyerOpts)
    setValue('buyer.address.district', customer.address?.district || '', buyerOpts)
    setValue('buyer.address.districtAr', customer.address?.districtAr || '', buyerOpts)
    setValue('buyer.address.street', customer.address?.street || '', buyerOpts)
    setValue('buyer.address.streetAr', customer.address?.streetAr || '', buyerOpts)
    setValue('buyer.address.postalCode', customer.address?.postalCode || '', buyerOpts)
    setValue('buyer.address.country', customer.address?.country || getTenantCountryCode(tenant), buyerOpts)
    setValue('buyer.address.buildingNumber', customer.address?.buildingNumber || '', buyerOpts)
    setValue('buyer.address.additionalNumber', customer.address?.additionalNumber || '', buyerOpts)
    setValue('buyer.address.shortAddress', customer.address?.shortAddress || '', buyerOpts)
    setValue('buyer.contactPhone', customer.phone || customer.mobile || getValues('buyer.contactPhone') || '', buyerOpts)
    setValue('buyer.contactEmail', customer.email || getValues('buyer.contactEmail') || '', buyerOpts)
    const terms = String(customer.paymentTermsCustomer || customer.paymentTerms || '').trim()
    if (terms) {
      setValue('paymentTerms', terms, { shouldDirty: true })
      const issueRaw = getValues('issueDate')
      const dueOnly = computeDueDateOnlyFromPaymentTerms(issueRaw || new Date(), terms)
      if (dueOnly) setValue('dueDate', dueOnly, { shouldDirty: true })
    }
    setSelectedCustomer(customer)
    clearErrors(['buyer.name', 'buyer.vatNumber', 'buyer.crNumber'])
  }

  useEffect(() => {
    setValue('transactionType', invoiceType)
    setValue('invoiceTypeCode', invoiceTypeCodeForTransaction(invoiceType))
    if (isTravelContext) {
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
    queryKey: ['products', { limit: 100, for: 'invoice-sell' }],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 100, isActive: true } })
      const list = res.data?.products ?? res.data?.items ?? res.data
      return Array.isArray(list) ? list : []
    },
    enabled: isTradingContext,
    staleTime: 5 * 60_000,
  })

  const productList = Array.isArray(products) ? products : []

  const { data: incomeAccounts = [] } = useQuery({
    queryKey: ['accounting-accounts-active'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    staleTime: 60_000,
    enabled: showAccountColumn,
  })

  const { data: analyticAccounts = [] } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
    staleTime: 60_000,
    enabled: showAnalyticColumn,
  })

  const { data: salesUsers = [] } = useQuery({
    queryKey: ['invoice-salesperson-users'],
    queryFn: () => api.get('/users', { params: { limit: 50, isActive: true } }).then((r) => r.data?.users || []),
    staleTime: 120_000,
  })

  const { data: fiscalPositionsData } = useQuery({
    queryKey: ['accounting-fiscal-positions'],
    queryFn: () => api.get('/accounting/fiscal-positions').then((r) => r.data),
    staleTime: 120_000,
  })
  const fiscalPositions = fiscalPositionsData?.positions || []

  useEffect(() => {
    if (isEdit || !fiscalPositions.length) return
    const current = watch('fiscalPosition')
    if (String(current || '').trim()) return
    const def = fiscalPositions.find((p) => p.isDefault) || fiscalPositions[0]
    if (def?.code) setValue('fiscalPosition', def.code, { shouldDirty: false })
  }, [fiscalPositions, isEdit, setValue, watch])

  const { data: paymentTermsCatalog } = useQuery({
    queryKey: ['accounting-payment-terms'],
    queryFn: () => api.get('/accounting/payment-terms').then((r) => r.data),
    staleTime: 120_000,
  })
  const paymentTermsList = useMemo(() => {
    const enabled = (paymentTermsCatalog?.terms || []).filter((t) => t.enabled !== false)
    if (enabled.length) return enabled.map((t) => ({ id: t.id, labelEn: t.labelEn, labelAr: t.labelAr }))
    return INVOICE_PAYMENT_TERMS
  }, [paymentTermsCatalog])

  const { data: incotermsCatalog } = useQuery({
    queryKey: ['accounting-incoterms'],
    queryFn: () => api.get('/accounting/incoterms').then((r) => r.data),
    staleTime: 120_000,
  })
  const incotermsList = useMemo(() => {
    const enabled = (incotermsCatalog?.terms || []).filter((t) => t.enabled !== false).map((t) => t.code)
    return enabled.length ? enabled : INCOTERMS
  }, [incotermsCatalog])

  const isInvoicePosted = isEdit && initialInvoice && !['draft', 'pending'].includes(String(initialInvoice.status || ''))
  const originalTransactionType = initialInvoice?.transactionType === 'B2C' ? 'B2C' : 'B2B'
  const transactionTypeDirty = isEdit && invoiceType !== originalTransactionType

  const saveTransactionTypeOnly = () => {
    if (invoiceType === 'B2B' && invoiceSubtype !== 'travel_ticket') {
      const buyerErrs = {}
      if (!String(getValues('buyer.name') || '').trim()) buyerErrs.name = { type: 'required' }
      const vat = String(getValues('buyer.vatNumber') || '').trim()
      if (!vat) buyerErrs.vatNumber = { type: 'required' }
      else if (!isValidSaudiVat(vat)) buyerErrs.vatNumber = { type: 'validate', message: saudiVatErrorMessage(language) }
      if (!String(getValues('buyer.crNumber') || '').trim()) buyerErrs.crNumber = { type: 'required' }
      if (Object.keys(buyerErrs).length) {
        toast.error(describeSellFormErrors({ buyer: buyerErrs }, language, selectedCustomer))
        return
      }
    }
    if (invoiceType === 'B2C' && !String(getValues('buyer.name') || '').trim()) {
      setValue(
        'buyer.name',
        selectedCustomer?.name || selectedCustomer?.nameEn || 'Cash Customer',
        { shouldValidate: false },
      )
    }
    saveMutation.mutate({
      transactionType: invoiceType,
      invoiceTypeCode: invoiceType === 'B2C' ? '0200000' : '0100000',
      zatca: {
        invoiceType: zatcaInvoiceKindForTransaction(invoiceType),
      },
      buyer: getValues('buyer'),
      customerId: getValues('customerId') || undefined,
      transactionTypeOverridden: Boolean(typeOverrideRef.current),
      transactionTypeOverrideReason: typeOverrideRef.current?.reason || undefined,
      transactionTypeOverrideFrom: typeOverrideRef.current?.from || undefined,
      transactionTypeOverrideTo: typeOverrideRef.current?.to || undefined,
    })
  }

  const { data: sellOrdersRaw = [] } = useQuery({
    queryKey: ['sell-orders', 'invoice-fill'],
    queryFn: () => api.get('/purchase-orders', { params: { flow: 'sell', page: 1, limit: 100 } })
      .then((res) => res.data?.purchaseOrders || res.data || []),
  })
  const sellOrders = useMemo(() => {
    const list = Array.isArray(sellOrdersRaw) ? sellOrdersRaw : []
    return list.filter((so) => SELL_ORDER_FILL_STATUSES.has(String(so.status || '')) || Boolean(so.isLocked))
  }, [sellOrdersRaw])

  const { data: selectedSalesOrder } = useQuery({
    queryKey: ['sell-order', selectedSalesOrderId],
    queryFn: () => api.get(`/purchase-orders/${selectedSalesOrderId}`).then((res) => res.data),
    enabled: Boolean(selectedSalesOrderId),
  })

  const { data: relatedDeliveryNotes = [] } = useQuery({
    queryKey: ['delivery-notes', 'by-so', selectedSalesOrderId],
    queryFn: () => api.get('/delivery-notes', {
      params: { purchaseOrderId: selectedSalesOrderId, limit: 50 },
    }).then((res) => res.data?.deliveryNotes || res.data || []),
    enabled: Boolean(selectedSalesOrderId),
  })

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
        setValue('deliveryNoteIds', [dn._id])
        if (poId) setSelectedSalesOrderId(String(poId))
        const refs = []
        if (poId) {
          refs.push({
            kind: 'sales_order',
            docId: poId,
            number: po?.poNumber || dn.purchaseOrderId?.poNumber || '',
            label: po?.poNumber || dn.purchaseOrderId?.poNumber || '',
          })
        }
        refs.push({
          kind: 'delivery_note',
          docId: dn._id,
          number: dn.dnNumber || dn.deliveryNoteNumber || '',
          label: dn.dnNumber || dn.deliveryNoteNumber || '',
        })
        setDocumentReferences(refs)
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

  const applySalesOrder = (so) => {
    if (!so?._id) return
    setValue('sourcePurchaseOrderId', so._id)
    const customer = so.customerId && typeof so.customerId === 'object'
      ? so.customerId
      : null
    if (customer) {
      fillBuyerFromParty(customer)
    } else if (so.customerId) {
      const cid = idOf(so.customerId)
      if (cid) {
        setValue('customerId', cid)
        api.get(`/customers/${cid}`).then((res) => {
          if (res.data) fillBuyerFromParty(res.data)
        }).catch(() => {})
      }
    }
    if (so.notes) {
      setValue('notes', so.notes)
      setShowNotesPanel(true)
    }
    const items = (Array.isArray(so.lineItems) ? so.lineItems : []).map((li) => {
      const product = li?.productId && typeof li.productId === 'object' ? li.productId : null
      const qtyOrdered = toNumber(li?.quantityOrdered ?? li?.quantity, 0)
      const qtyInvoiced = toNumber(li?.quantityInvoiced, 0)
      const remaining = Math.max(0, qtyOrdered - qtyInvoiced)
      return {
        ...emptyLine,
        productId: product?._id || li?.productId || '',
        variantId: idOf(li?.variantId) || '',
        productName: product?.nameEn || li?.manualName || li?.description || '',
        productNameAr: product?.nameAr || li?.manualNameAr || '',
        productType: normalizeProductType(li?.productType || product?.productType),
        unitCode: li?.uom || product?.unitOfMeasure || emptyLine.unitCode || 'PCE',
        quantity: Math.max(0.0001, remaining > 0 ? remaining : qtyOrdered || 1),
        unitPrice: Math.max(0, toNumber(li?.unitCost ?? li?.unitPrice, 0)),
        taxRate: Math.max(0, toNumber(li?.taxRate, emptyLine.taxRate)),
        sourcePoItemId: li?._id || '',
      }
    }).filter((line) => line.productName || line.unitPrice > 0 || line.productId)
    replace(items.length ? items : [{ ...emptyLine }])
    setDocumentReferences([{
      kind: 'sales_order',
      docId: so._id,
      number: so.poNumber || '',
      label: so.poNumber || '',
    }])
    toast.success(language === 'ar' ? 'تم تعبئة الفاتورة من أمر البيع' : 'Invoice filled from sales order')
  }

  useEffect(() => {
    if (!selectedSalesOrder?._id) return
    setValue('sourcePurchaseOrderId', selectedSalesOrder._id)
    if (!shouldFillFromSoRef.current) return
    if (filledSoIdRef.current === String(selectedSalesOrder._id)) return
    filledSoIdRef.current = String(selectedSalesOrder._id)
    shouldFillFromSoRef.current = false
    applySalesOrder(selectedSalesOrder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSalesOrder])

  useEffect(() => {
    if (!selectedSalesOrderId || !Array.isArray(relatedDeliveryNotes)) return
    const dns = relatedDeliveryNotes.filter((dn) => dn?._id)
    if (!dns.length) return
    const dnIds = dns.map((dn) => dn._id)
    const existingDnIds = getValues('deliveryNoteIds')
    if (!Array.isArray(existingDnIds) || !existingDnIds.length) {
      setValue('deliveryNoteIds', dnIds)
    }
    if (!getValues('sourceDeliveryNoteId')) {
      setValue('sourceDeliveryNoteId', dnIds[0])
    }
    setDocumentReferences((prev) => {
      const existing = Array.isArray(prev) ? prev.filter((r) => r.kind !== 'delivery_note') : []
      const hasSo = existing.some((r) => r.kind === 'sales_order')
      const next = [...existing]
      if (!hasSo && selectedSalesOrder?._id) {
        next.unshift({
          kind: 'sales_order',
          docId: selectedSalesOrder._id,
          number: selectedSalesOrder.poNumber || '',
          label: selectedSalesOrder.poNumber || '',
        })
      }
      const dnRefs = dns.map((dn) => ({
        kind: 'delivery_note',
        docId: dn._id,
        number: dn.dnNumber || dn.deliveryNoteNumber || '',
        label: dn.dnNumber || dn.deliveryNoteNumber || '',
      }))
      return [...next, ...dnRefs]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedDeliveryNotes, selectedSalesOrderId, selectedSalesOrder?._id])

  const onSelectCustomer = (customerId, opt) => {
    if (!customerId) {
      setValue('customerId', '')
      setSelectedCustomer(null)
      clearTypeOverride()
      applyTransactionType('B2C')
      setValue('buyer.name', 'Cash Customer', { shouldDirty: true })
      setValue('buyer.vatNumber', '', { shouldDirty: true })
      setValue('buyer.crNumber', '', { shouldDirty: true })
      return
    }
    clearTypeOverride()
    if (opt) setSelectedCustomer(opt)
    api.get(`/customers/${customerId}`).then((res) => {
      if (res.data) fillBuyerFromParty(res.data)
    }).catch(() => {
      if (opt) fillBuyerFromParty(opt)
    })
  }

  useEffect(() => {
    if (invoiceType !== 'B2B') return
    if (typeOverrideRef.current) return
    const cid = getValues('customerId')
    if (!cid) return
    let cancelled = false
    api.get(`/customers/${cid}`).then((res) => {
      if (!cancelled && res.data) fillBuyerFromParty(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceType])

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
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      }
      // Defer non-critical caches so navigation to the invoice feels instant
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        if (isTravelContext) {
          queryClient.invalidateQueries({ queryKey: ['travel-bookings'] })
          queryClient.invalidateQueries({ queryKey: ['travel-bookings-lookup'] })
        }
        if (isManpowerContext) {
          queryClient.invalidateQueries({ queryKey: ['manpower-assignments-lookup'] })
        }
      }, 0)
      if (res.data?.offline) {
        navigate('/app/dashboard/accounting/invoices')
      } else {
        navigate(`/app/dashboard/accounting/invoices/${res.data?._id || invoiceId}`)
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
    const unitCost = Number(product.averageLandedCost) > 0
      ? Number(product.averageLandedCost)
      : Number(product.costPrice || product.cost || 0)
    setValue(`lineItems.${index}.costPrice`, Number.isFinite(unitCost) ? unitCost : 0, opts)
    setValue(`lineItems.${index}.unitCost`, Number.isFinite(unitCost) ? unitCost : 0, opts)
    if (product.incomeAccountId) {
      setValue(`lineItems.${index}.incomeAccountId`, product.incomeAccountId, opts)
    }
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
      const product = line.productId
        ? productList.find((p) => String(p._id) === String(line.productId))
        : null
      const unitCost = Number(line.unitCost || line.costPrice || 0)
        || Number(product?.averageLandedCost || 0)
        || Number(product?.costPrice || 0)
      const cost = unitCost * Number(line.quantity || 0)
      return sum + (revenue - cost)
    }, 0)
  }, [showMargin, lineItems, totals.lines, productList])

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewConfirmAttempted, setPreviewConfirmAttempted] = useState(false)
  const [formTab, setFormTab] = useState('lines')
  const [pendingPayload, setPendingPayload] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelPending, setCancelPending] = useState(false)
  const [resetDraftPending, setResetDraftPending] = useState(false)
  const [prePostDebounced, setPrePostDebounced] = useState(null)

  // Live pre-post checklist (server evaluates lock date, credit, income accounts, duplicates)
  useEffect(() => {
    if (isInvoicePosted) {
      setPrePostDebounced(null)
      return undefined
    }
    const t = setTimeout(() => {
      const namedLines = (lineItems || []).filter((line) =>
        String(line?.productName || line?.description || '').trim()
        || Number(line?.unitPrice) > 0
        || line?.productId,
      )
      const namedTotals = calculateInvoiceSummary({
        lineItems: namedLines.length ? namedLines : lineItems,
        invoiceDiscount: Math.max(0, toNumber(values?.invoiceDiscount, 0)),
      })
      setPrePostDebounced({
        customerId: values?.customerId || selectedCustomer?._id || '',
        buyer: values?.buyer || {},
        lineItems: (namedLines.length ? namedLines : lineItems || []).map((line, index) => {
          const summaryLine = namedTotals.lines[index] || {}
          return {
            productId: line.productId || undefined,
            productName: line.productName || '',
            description: line.description || '',
            productType: line.productType || 'goods',
            categoryId: line.categoryId || undefined,
            unitPrice: toNumber(line.unitPrice, 0),
            quantity: toNumber(line.quantity, 1),
            taxRate: line.taxRate,
            taxCategory: line.taxCategory || 'S',
            incomeAccountId: line.incomeAccountId || undefined,
            lineTotalWithTax: toNumber(summaryLine.lineTotalWithTax, 0),
          }
        }),
        transactionType: invoiceType,
        issueDate: values?.issueDate || new Date(),
        grandTotal: namedTotals.grandTotal,
        excludeInvoiceId: isEdit ? invoiceId : undefined,
        status: 'approved',
      })
    }, 400)
    return () => clearTimeout(t)
  }, [
    isInvoicePosted,
    isEdit,
    invoiceId,
    invoiceType,
    selectedCustomer?._id,
    values?.customerId,
    values?.buyer,
    values?.issueDate,
    values?.invoiceDiscount,
    lineItems,
  ])

  const { data: prePostResult, isFetching: prePostLoading } = useQuery({
    queryKey: ['invoice-pre-post-check', prePostDebounced],
    queryFn: () => api.post('/invoices/sell/pre-post-check', prePostDebounced).then((r) => r.data),
    enabled: Boolean(prePostDebounced) && !isInvoicePosted,
    staleTime: 5_000,
    retry: 1,
  })

  const prePostCanPost = Boolean(prePostResult?.canPost)
  const prePostHasWarnings = Boolean(prePostResult?.hasWarnings)
  const prePostChecks = Array.isArray(prePostResult?.checks) ? prePostResult.checks : []

  const scrollAndFocus = (selector, { highlight = true } = {}) => {
    const el = typeof document !== 'undefined' ? document.querySelector(selector) : null
    if (!el) return null
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (highlight) {
      el.classList.add('ring-2', 'ring-teal-500/60', 'ring-offset-2', 'dark:ring-offset-[#0b0f16]')
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-teal-500/60', 'ring-offset-2', 'dark:ring-offset-[#0b0f16]')
      }, 1800)
    }
    const focusable = el.matches('input,select,textarea,button,[tabindex]')
      ? el
      : el.querySelector('input,select,textarea,button,[tabindex]')
    if (focusable && typeof focusable.focus === 'function') {
      window.setTimeout(() => focusable.focus({ preventScroll: true }), 280)
    }
    return el
  }

  const handlePrePostFix = (check) => {
    if (!check?.id) return
    setFormTab('lines')
    const detail = check.detail || {}
    const firstBadLine = Array.isArray(detail.badLines) && detail.badLines[0]
      ? detail.badLines[0]
      : (Array.isArray(detail.incomeMissing) && detail.incomeMissing[0]
        ? detail.incomeMissing[0]
        : (Array.isArray(detail.taxMissing) && detail.taxMissing[0]
          ? detail.taxMissing[0]
          : null))

    window.setTimeout(() => {
      switch (check.id) {
        case 'customer':
        case 'credit_limit':
          scrollAndFocus('#invoice-customer-section')
          break
        case 'b2b_vat':
          scrollAndFocus('#invoice-customer-section')
          toast(
            language === 'ar'
              ? 'حدّث الرقم الضريبي / السجل التجاري من ملف العميل'
              : 'Update VAT / CR on the customer profile',
            { icon: 'ℹ' },
          )
          break
        case 'seller_vat':
          toast(
            language === 'ar'
              ? 'حدّث الرقم الضريبي للمنشأة من الملف التعريفي'
              : 'Update company VAT in Company Profile',
            { icon: 'ℹ' },
          )
          navigate('/app/dashboard/profile')
          break
        case 'lines':
          scrollAndFocus('#invoice-lines-section')
          if (!(lineItems || []).some((l) => String(l?.productName || '').trim() || Number(l?.unitPrice) > 0)) {
            append(getEmptyLine(tenant))
          }
          break
        case 'line_detail':
        case 'total':
          scrollAndFocus(firstBadLine ? `#invoice-line-${firstBadLine - 1}` : '#invoice-lines-section')
          break
        case 'income_account':
          setForceShowAccountColumn(true)
          window.setTimeout(() => {
            scrollAndFocus(
              firstBadLine
                ? `#invoice-line-${firstBadLine - 1}-income`
                : '#invoice-lines-section',
            )
          }, 50)
          break
        case 'tax':
          scrollAndFocus(firstBadLine ? `#invoice-line-${firstBadLine - 1}` : '#invoice-lines-section')
          toast(
            language === 'ar'
              ? 'عيّن نسبة الضريبة على البند'
              : 'Set a tax rate on the line',
            { icon: 'ℹ' },
          )
          break
        case 'lock_date':
          scrollAndFocus('#invoice-issue-date')
          break
        case 'duplicate':
          toast(
            language === 'ar'
              ? 'تكرار محتمل — يمكنك الترحيل على أي حال'
              : 'Possible duplicate — you can still Post anyway',
            { icon: '⚠' },
          )
          break
        default:
          scrollAndFocus('#invoice-sell-form')
      }
    }, 60)
  }

  const buildPayload = (data) => {
    const namedLines = (data.lineItems || []).filter((line) => String(line?.productName || '').trim())
    if (!namedLines.length) {
      toast.error(language === 'ar' ? 'أضف بنداً واحداً على الأقل قبل الحفظ' : 'Add at least one billing line before saving')
      return null
    }
    const namedTotals = calculateInvoiceSummary({ lineItems: namedLines, invoiceDiscount: Math.max(0, toNumber(data?.invoiceDiscount, 0)) })
    const transactionType = invoiceType
    const invoiceTypeCode = invoiceTypeCodeForTransaction(transactionType)
    const buyerPayload = { ...(data.buyer || {}) }
    if (transactionType === 'B2C') {
      const vat = normalizeSaudiVatDigits(buyerPayload.vatNumber)
      if (!isValidSaudiVat(vat)) {
        buyerPayload.vatNumber = ''
        buyerPayload.crNumber = buyerPayload.crNumber || ''
      } else {
        buyerPayload.vatNumber = vat
      }
    } else {
      const vat = normalizeSaudiVatDigits(buyerPayload.vatNumber)
      if (vat) buyerPayload.vatNumber = vat
    }
    const existingZatca = initialInvoice?.zatca && typeof initialInvoice.zatca === 'object'
      ? (initialInvoice.zatca.toObject?.() || initialInvoice.zatca)
      : {}
    const payload = {
      ...data,
      buyer: buyerPayload,
      flow: 'sell',
      businessContext,
      invoiceSubtype: isTravelContext ? 'travel_ticket' : invoiceSubtype,
      pdfTemplateId: selectedTemplateId,
      transactionType,
      invoiceTypeCode,
      zatca: {
        ...existingZatca,
        invoiceType: zatcaInvoiceKindForTransaction(transactionType),
      },
      transactionTypeOverridden: Boolean(typeOverrideRef.current),
      transactionTypeOverrideReason: typeOverrideRef.current?.reason || undefined,
      transactionTypeOverrideFrom: typeOverrideRef.current?.from || undefined,
      transactionTypeOverrideTo: typeOverrideRef.current?.to || undefined,
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
          const only = extractDateOnly(raw)
          if (only) return dateOnlyToUtcNoon(only)
        }
        const issueRaw = typeof data?.issueDate === 'string' ? data.issueDate.trim() : ''
        return computeDueDateFromPaymentTerms(issueRaw || new Date(), data?.paymentTerms || 'immediate') || undefined
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
          productId: line.productId || undefined,
          variantId: line.variantId || undefined,
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
          costPrice: Math.max(0, toNumber(line.costPrice ?? line.unitCost, 0)),
          isTravelMargin,
          marginTaxable: isTravelMargin ? Math.max(0, toNumber(summaryLine.marginTaxable, 0)) : 0,
          taxAmount: toNumber(summaryLine.taxAmount, 0),
          lineTotal: toNumber(summaryLine.lineTotal, 0),
          lineTotalWithTax: toNumber(summaryLine.lineTotalWithTax, 0),
          sourcePoItemId: line.sourcePoItemId || undefined,
          sourceDnItemId: line.sourceDnItemId || undefined,
          incomeAccountId: line.incomeAccountId || undefined,
          analyticAccountId: line.analyticAccountId || undefined,
        }
      }),
      subtotal: namedTotals.subtotal,
      totalDiscount: namedTotals.totalDiscount,
      taxableAmount: namedTotals.taxableAmount,
      totalTax: namedTotals.totalTax,
      grandTotal: namedTotals.grandTotal,
      sourcePurchaseOrderId: data?.sourcePurchaseOrderId || selectedSalesOrderId || undefined,
      sourceDeliveryNoteId: data?.sourceDeliveryNoteId || undefined,
      deliveryNoteIds: Array.isArray(data?.deliveryNoteIds) && data.deliveryNoteIds.length
        ? data.deliveryNoteIds
        : undefined,
      documentReferences: Array.isArray(documentReferences) && documentReferences.length
        ? documentReferences
        : undefined,
      accountingLines: Array.isArray(accountingLines) && accountingLines.length
        ? accountingLines
        : undefined,
    }
    applyFormPaymentToPayload(payload, {
      paymentStatus: data?.paymentStatus,
      paidAmount: data?.paidAmount,
      grandTotal: namedTotals.grandTotal,
    })

    if (!payload.sourcePurchaseOrderId) delete payload.sourcePurchaseOrderId
    if (!payload.sourceDeliveryNoteId) delete payload.sourceDeliveryNoteId
    if (!payload.deliveryNoteIds?.length) delete payload.deliveryNoteIds
    if (!payload.documentReferences?.length) delete payload.documentReferences
    if (!payload.accountingLines?.length) delete payload.accountingLines
    if (!payload.restaurantOrderId) delete payload.restaurantOrderId
    if (!payload.travelBookingId) delete payload.travelBookingId
    if (!payload.manpowerAssignmentId) delete payload.manpowerAssignmentId
    if (!payload.contractNumber) delete payload.contractNumber
    if (!payload.customerReference) delete payload.customerReference
    if (!payload.incoterm) delete payload.incoterm
    if (!payload.salespersonId) delete payload.salespersonId
    if (!payload.fiscalPosition) delete payload.fiscalPosition
    if (!payload.internalNotes) delete payload.internalNotes
    // Invoices never move stock (delivery notes / GRNs do) — warehouse is optional metadata
    if (!isTradingContext || !payload.warehouseId) delete payload.warehouseId

    if (isTravelContext || invoiceSubtype === 'travel_ticket') {
      payload.travelDetails = sanitizeTravelDetails({
        ...data.travelDetails,
        travelerName: data?.buyer?.name || data?.travelDetails?.travelerName || '',
      })
    } else {
      delete payload.travelDetails
    }

    if (showRentalPanel || businessContext === 'boutique') {
      payload.businessContext = 'boutique'
      const paid = Number(payload.paidAmount ?? data?.paidAmount ?? data?.boutiqueDetails?.amountPaid ?? 0) || 0
      const grand = Number(namedTotals.grandTotal || 0)
      payload.boutiqueDetails = sanitizeBoutiqueDetails({
        ...(data.boutiqueDetails || {}),
        transactionType: data.boutiqueDetails?.transactionType || 'rental',
        amountPaid: paid,
        paymentMethod: data.paymentMethod || data.boutiqueDetails?.paymentMethod || 'cash',
        paymentStatus: grand > 0 && paid >= grand ? 'paid' : (paid > 0 ? 'partial' : (data.boutiqueDetails?.paymentStatus || 'pending')),
        totalAmount: grand,
      })
      if (payload.boutiqueDetails.rentalId) {
        payload.rentalId = payload.boutiqueDetails.rentalId
      }
      if (payload.boutiqueDetails.rentalNumber) {
        payload.rentalNumber = payload.boutiqueDetails.rentalNumber
      }
    } else {
      delete payload.boutiqueDetails
      delete payload.rentalId
      delete payload.rentalNumber
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
          swift: data?.bankDetails?.swift || '',
        }
      : { bankName: '', accountName: '', accountNumber: '', iban: '', swift: '' }
    payload.termsAndConditions = showTermsPanel ? (data?.termsAndConditions || '') : ''
    payload.termsAndConditionsAr = showTermsPanel ? (data?.termsAndConditionsAr || '') : ''
    payload.notes = showNotesPanel ? (data?.notes || '') : ''
    payload.notesAr = showNotesPanel ? (data?.notesAr || '') : ''
    // Confirm / Post — lift draft and run server pre-post gate
    payload.confirmPost = true
    if (payload.status === 'draft') delete payload.status
    return payload
  }

  const onSubmit = (data) => {
    const payload = buildPayload(data)
    if (!payload) return
    setPendingPayload(payload)
    setPreviewConfirmAttempted(false)
    setShowPreviewModal(true)
  }

  const handleConfirmSave = () => {
    if (!isInvoicePosted && prePostResult && !prePostResult.canPost) {
      setPreviewConfirmAttempted(true)
      return
    }
    const payload = pendingPayload || buildPayload(getValues())
    if (!payload) return
    payload.confirmPost = true
    if (payload.status === 'draft') delete payload.status
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
          swift: values?.bankDetails?.swift || '',
        }
      : { bankName: '', accountName: '', accountNumber: '', iban: '', swift: '' },
    notes: showNotesPanel ? (values?.notes || '') : '',
    notesAr: showNotesPanel ? (values?.notesAr || '') : '',
    termsAndConditions: showTermsPanel ? (values?.termsAndConditions || '') : '',
    termsAndConditionsAr: showTermsPanel ? (values?.termsAndConditionsAr || '') : '',
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
        const only = extractDateOnly(raw)
        if (only) return dateOnlyToUtcNoon(only)
      }
      const issueRaw = typeof values?.issueDate === 'string' ? values.issueDate.trim() : ''
      return computeDueDateFromPaymentTerms(issueRaw || new Date(), values?.paymentTerms || 'immediate') || undefined
    })(),
    printFormat: values?.printFormat === 'thermal' ? 'thermal' : 'a4',
    createdByName: initialInvoice?.createdByName || [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    createdByNameAr: initialInvoice?.createdByNameAr || [user?.firstNameAr, user?.lastNameAr].filter(Boolean).join(' '),
    createdBy: initialInvoice?.createdBy || user,
    flow: 'sell',
    transactionType: invoiceType,
    invoiceTypeCode: invoiceType === 'B2C' ? '0200000' : '0100000',
    zatca: {
      ...(initialInvoice?.zatca || {}),
      invoiceType: zatcaInvoiceKindForTransaction(invoiceType),
    },
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
      name: tenant?.business?.legalNameEn || initialInvoice?.seller?.name || '',
      nameAr: tenant?.business?.legalNameAr || initialInvoice?.seller?.nameAr || '',
      vatNumber: tenant?.business?.vatNumber || initialInvoice?.seller?.vatNumber || '',
      crNumber: tenant?.business?.crNumber || tenant?.business?.commercialRegistration?.crNumber || initialInvoice?.seller?.crNumber || '',
      address: tenant?.business?.address || initialInvoice?.seller?.address || {},
      contactPhone: tenant?.business?.contactPhone || initialInvoice?.seller?.contactPhone || '',
      contactEmail: tenant?.business?.contactEmail || initialInvoice?.seller?.contactEmail || '',
    },
    buyer: {
      ...(initialInvoice?.buyer || {}),
      ...(values?.buyer || {}),
      name: values?.buyer?.name || selectedCustomer?.name || selectedCustomer?.nameEn || initialInvoice?.buyer?.name || '',
      nameAr: values?.buyer?.nameAr || selectedCustomer?.nameAr || initialInvoice?.buyer?.nameAr || '',
      vatNumber: values?.buyer?.vatNumber || selectedCustomer?.vatNumber || selectedCustomer?.taxNumber || initialInvoice?.buyer?.vatNumber || '',
      crNumber: values?.buyer?.crNumber || selectedCustomer?.crNumber || initialInvoice?.buyer?.crNumber || '',
      contactPhone: values?.buyer?.contactPhone || selectedCustomer?.phone || selectedCustomer?.mobile || initialInvoice?.buyer?.contactPhone || '',
      contactEmail: values?.buyer?.contactEmail || selectedCustomer?.email || initialInvoice?.buyer?.contactEmail || '',
      address: {
        ...(initialInvoice?.buyer?.address || {}),
        ...(selectedCustomer?.address || {}),
        ...(values?.buyer?.address || {}),
      },
    },
    travelDetails: sanitizeTravelDetails({
      ...values.travelDetails,
      travelerName: values?.buyer?.name || values?.travelDetails?.travelerName || '',
    }),
    businessContext: showRentalPanel ? 'boutique' : (values?.businessContext || businessContext),
    boutiqueDetails: showRentalPanel || values?.businessContext === 'boutique' || businessContext === 'boutique'
      ? sanitizeBoutiqueDetails({
          ...(values?.boutiqueDetails || {}),
          transactionType: values?.boutiqueDetails?.transactionType || 'rental',
          amountPaid: Number(values?.paidAmount ?? values?.boutiqueDetails?.amountPaid ?? 0) || 0,
          paymentMethod: values?.paymentMethod || values?.boutiqueDetails?.paymentMethod || 'cash',
          totalAmount: totals.grandTotal,
        })
      : undefined,
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

  const isCreditNoteDoc = String(initialInvoice?.invoiceType || '') === '381'
  const ribbonStep = resolveInvoiceRibbonStep(initialInvoice || { status: 'draft' })
  const statusSteps = isCreditNoteDoc ? CREDIT_NOTE_STATUS_STEPS : INVOICE_STATUS_STEPS
  const lineCount = (lineItems || []).filter(sellLineHasContent).length

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-6xl space-y-2.5">
        <AccountingDocumentShell
          language={language}
          backTo={isEdit ? `/app/dashboard/accounting/invoices/${invoiceId}` : '/app/dashboard/accounting/invoices'}
          eyebrow={isCreditNoteDoc ? (language === 'ar' ? 'إشعار دائن' : 'Credit note') : (language === 'ar' ? 'فاتورة مبيعات' : 'Customer invoice')}
          title={initialInvoice?.invoiceNumber || (language === 'ar' ? 'مسودة جديدة' : 'New draft')}
          subtitle={language === 'ar' ? 'منشئ المستند' : 'Document builder'}
          statusSteps={statusSteps}
          activeStatusStep={ribbonStep}
          tabs={[
            { id: 'lines', labelEn: 'Invoice lines', labelAr: 'بنود الفاتورة', count: lineCount || undefined },
            { id: 'journal', labelEn: 'Journal items', labelAr: 'بنود القيد' },
            { id: 'other', labelEn: 'Other info', labelAr: 'معلومات أخرى' },
          ]}
          activeTab={formTab}
          onTabChange={setFormTab}
          actionBar={(
            <>
              {!isInvoicePosted ? (
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
                  <InvoicePrePostChecklist
                    checks={prePostChecks}
                    canPost={prePostCanPost}
                    hasWarnings={prePostHasWarnings}
                    loading={prePostLoading && !prePostResult}
                    language={language}
                    className="min-w-[240px] w-full max-w-md sm:w-[320px]"
                    onFix={handlePrePostFix}
                  />
                  <button
                    type="button"
                    className={primaryActionClass}
                    onClick={() => {
                      const form = document.getElementById('invoice-sell-form')
                      form?.requestSubmit()
                    }}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {prePostHasWarnings && prePostCanPost
                      ? (language === 'ar' ? 'ترحيل على أي حال' : 'Post anyway')
                      : (language === 'ar' ? 'تأكيد / ترحيل' : 'Confirm / Post')}
                  </button>
                </div>
              ) : transactionTypeDirty ? (
                <button
                  type="button"
                  className={primaryActionClass}
                  onClick={saveTransactionTypeOnly}
                  disabled={saveMutation.isPending}
                >
                  <Save className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'حفظ نوع الفاتورة' : 'Save document type'}
                </button>
              ) : null}
              {isInvoicePosted && canRegisterPaymentOnInvoice(initialInvoice) ? (
                <button
                  type="button"
                  className={ghostActionClass}
                  onClick={() => navigate(`/app/dashboard/accounting/invoices/${invoiceId}?pay=1`)}
                >
                  {language === 'ar' ? 'تسجيل دفعة' : 'Register payment'}
                </button>
              ) : null}
              {isInvoicePosted && !isCreditNoteDoc ? (
                <button
                  type="button"
                  className={ghostActionClass}
                  onClick={() => navigate(`/app/dashboard/accounting/invoices/new/sell?invoiceType=381&originalInvoiceId=${invoiceId}`)}
                >
                  {language === 'ar' ? 'إضافة إشعار دائن' : 'Add credit note'}
                </button>
              ) : null}
              {isEdit && canResetInvoiceToDraft(initialInvoice, tenant?.zatca?.phase || 2) ? (
                <button
                  type="button"
                  className={ghostActionClass}
                  disabled={resetDraftPending}
                  onClick={async () => {
                    const paid = Number(initialInvoice?.paidAmount || 0) > 0.005
                      || (Array.isArray(initialInvoice?.payments) && initialInvoice.payments.length > 0)
                    const ok = window.confirm(
                      language === 'ar'
                        ? (paid
                          ? 'إعادة الفاتورة إلى مسودة؟ سيتم عكس القيود والمدفوعات المرتبطة.'
                          : 'إعادة الفاتورة إلى مسودة؟ سيتم عكس القيود المرتبطة.')
                        : (paid
                          ? 'Reset this invoice to draft? Linked journal entries and payments will be reversed.'
                          : 'Reset this invoice to draft? Linked journal entries will be reversed.'),
                    )
                    if (!ok) return
                    setResetDraftPending(true)
                    try {
                      await api.post(`/invoices/${invoiceId}/reset-to-draft`)
                      toast.success(language === 'ar' ? 'أُعيدت إلى مسودة' : 'Reset to draft')
                      queryClient.invalidateQueries(['invoices'])
                      queryClient.invalidateQueries(['invoice', invoiceId])
                      queryClient.invalidateQueries(['customer-payments'])
                      queryClient.invalidateQueries(['vendor-payments'])
                      navigate(`/app/dashboard/accounting/invoices/${invoiceId}/edit`)
                    } catch (error) {
                      toast.error(error?.response?.data?.error || (language === 'ar' ? 'فشلت إعادة المسودة' : 'Reset to draft failed'))
                    } finally {
                      setResetDraftPending(false)
                    }
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'إعادة إلى مسودة' : 'Reset to draft'}
                </button>
              ) : null}
              {isEdit && canCancelInvoice(initialInvoice, tenant?.zatca?.phase || 2) ? (
                <button
                  type="button"
                  className={ghostActionClass}
                  onClick={() => setCancelOpen(true)}
                >
                  {language === 'ar' ? 'إلغاء الفاتورة' : 'Cancel invoice'}
                </button>
              ) : null}
              {isInvoicePosted && invoiceRemainingBalance(initialInvoice) > 0 ? (
                <span className="ms-auto text-xs font-medium text-slate-500">
                  {language === 'ar' ? 'المتبقي' : 'Due'}: <Money value={invoiceRemainingBalance(initialInvoice)} />
                </span>
              ) : null}
            </>
          )}
        />
        <form
          id="invoice-sell-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (isInvoicePosted) {
              saveTransactionTypeOnly()
              return
            }
            const lines = getValues('lineItems') || []
            const kept = lines.filter(sellLineHasContent)
            if (!kept.length) {
              toast.error(language === 'ar' ? 'أضف بنداً واحداً على الأقل قبل الحفظ' : 'Add at least one billing line before saving')
              return
            }
            const runSubmit = () => {
              clearErrors(['buyer.name', 'buyer.vatNumber', 'buyer.crNumber'])
              if (invoiceType === 'B2C') {
                if (!String(getValues('buyer.name') || '').trim()) {
                  setValue(
                    'buyer.name',
                    selectedCustomer?.name || selectedCustomer?.nameEn || 'Cash Customer',
                    { shouldValidate: false },
                  )
                }
              } else if (invoiceSubtype !== 'travel_ticket') {
                const buyerErrs = {}
                if (!String(getValues('buyer.name') || '').trim()) buyerErrs.name = { type: 'required' }
                const vatVal = String(getValues('buyer.vatNumber') || '').trim()
                if (!vatVal) buyerErrs.vatNumber = { type: 'required' }
                else if (!isValidSaudiVat(vatVal)) buyerErrs.vatNumber = { type: 'validate', message: saudiVatErrorMessage(language) }
                if (!String(getValues('buyer.crNumber') || '').trim()) buyerErrs.crNumber = { type: 'required' }
                if (Object.keys(buyerErrs).length) {
                  toast.error(describeSellFormErrors({ buyer: buyerErrs }, language, selectedCustomer))
                  return
                }
              }
              handleSubmit(
                onSubmit,
                (errs) => toast.error(describeSellFormErrors(errs, language, selectedCustomer)),
              )()
            }
            if (kept.length !== lines.length) {
              replace(kept)
              setTimeout(runSubmit, 0)
              return
            }
            runSubmit()
          }}
          className="space-y-2.5"
        >
          {isInvoicePosted ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {language === 'ar'
                ? 'فاتورة مرحّلة — البنود مقفلة؛ يمكنك تغيير نوع الفاتورة (مع سبب) ثم الحفظ.'
                : 'Posted invoice — lines are locked; you can change document type and save.'}
            </div>
          ) : null}
          <div className={`${sectionCardClass} !p-3 space-y-2`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 max-w-full items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
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

          {formTab === 'lines' && (
          <>
          <fieldset disabled={isInvoicePosted} className="min-w-0 space-y-2.5 border-0 p-0 m-0 disabled:opacity-60">
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
              <input type="datetime-local" id="invoice-issue-date" {...register('issueDate')} className={`mt-1 max-w-sm ${fieldControlClass}`} />
            </div>
          )}
          </fieldset>

          <div id="invoice-customer-section" className={`${sectionCardClass} space-y-2.5 !p-3.5`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'العميل' : 'Customer'}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {!isTravelContext ? (
                <div className="min-w-[9.5rem]">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400" htmlFor="invoice-issue-date">
                    {language === 'ar' ? 'تاريخ الإصدار' : 'Issue date'}
                  </label>
                  <input
                    id="invoice-issue-date"
                    type="date"
                    className={`mt-1 ${fieldControlClass} !rounded-xl !border-slate-200/70 !bg-slate-50/60 !px-2.5 !py-1.5 !text-[12px]`}
                    value={extractDateOnly(values?.issueDate) || ''}
                    onChange={(e) => {
                      const only = e.target.value
                      if (!only) {
                        setValue('issueDate', '', { shouldDirty: true })
                        return
                      }
                      setValue('issueDate', `${only}T12:00`, { shouldDirty: true })
                      const dueOnly = computeDueDateOnlyFromPaymentTerms(only, getValues('paymentTerms') || 'immediate')
                      if (dueOnly) setValue('dueDate', dueOnly, { shouldDirty: true })
                    }}
                    disabled={isInvoicePosted}
                  />
                </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-white/10 dark:bg-dark-900/40">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    invoiceType === 'B2B'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200'
                  }`}
                >
                  {transactionTypeBadgeLabel(invoiceType, language)}
                </span>
                {typeOverride ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    {language === 'ar' ? 'تعديل يدوي' : 'Manual override'}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={toggleTransactionType}
                  className="ms-auto text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {language === 'ar' ? 'تغيير النوع' : 'Change type'}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {transactionTypeReasonLine(invoiceType, {
                  language,
                  hasValidVat: partyHasValidVat(selectedCustomer || values?.buyer || {}),
                  isWalkIn: !selectedCustomer?._id || isWalkInOrCashCustomer(selectedCustomer),
                })}
              </p>
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
            <input type="hidden" {...register('buyer.name')} />
            <input type="hidden" {...register('buyer.nameAr')} />
            <input type="hidden" {...register('transactionType')} />
            <input type="hidden" {...register('invoiceTypeCode')} />
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
            <input type="hidden" {...register('buyer.vatNumber')} />
            <input type="hidden" {...register('buyer.crNumber')} />
            {invoiceSubtype === 'travel_ticket' ? (
              <TravelInvoiceFields language={language} register={register} control={control} watch={watch} setValue={setValue} />
            ) : null}
          </div>

          <fieldset disabled={isInvoicePosted} className="min-w-0 space-y-2.5 border-0 p-0 m-0 disabled:opacity-60">
            <div className={`${sectionCardClass} space-y-2.5 !p-3.5 !pt-0`}>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]">
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {language === 'ar' ? 'أمر البيع' : 'Sales order'}
              </label>
              <select
                value={selectedSalesOrderId}
                onChange={(e) => {
                  const next = e.target.value
                  setSelectedSalesOrderId(next)
                  setValue('sourcePurchaseOrderId', next)
                  filledSoIdRef.current = ''
                  shouldFillFromSoRef.current = Boolean(next)
                  if (!next) {
                    setDocumentReferences([])
                    setValue('sourceDeliveryNoteId', '')
                    setValue('deliveryNoteIds', [])
                    replace([{ ...emptyLine }])
                  }
                }}
                className={`mt-1 ${denseControlClass}`}
              >
                <option value="">{language === 'ar' ? 'اختر أمر بيع…' : 'Select a sales order…'}</option>
                {sellOrders.map((so) => (
                  <option key={so._id} value={so._id}>
                    {so.poNumber}
                    {so.customerId?.name || so.customerId?.nameEn
                      ? ` — ${language === 'ar' ? (so.customerId?.nameAr || so.customerId?.name || so.customerId?.nameEn || '') : (so.customerId?.nameEn || so.customerId?.name || so.customerId?.nameAr || '')}`
                      : ''}
                  </option>
                ))}
              </select>
              <input type="hidden" {...register('sourcePurchaseOrderId')} />
              <input type="hidden" {...register('sourceDeliveryNoteId')} />
            </div>
            {documentReferences.length ? (
              <InvoiceDocumentReferencesBar references={documentReferences} language={language} />
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

          <div id="invoice-lines-section" className={`${sectionCardClass} !p-0 overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {language === 'ar' ? 'البنود' : 'Lines'}
              </h3>
              <button
                type="button"
                onClick={() => append(getEmptyLine(tenant))}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                {t('add')}
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="mx-4 mb-4 rounded-xl border border-dashed border-slate-200/90 px-3 py-8 text-center dark:border-white/10">
                <p className="text-xs text-slate-400">
                  {language === 'ar' ? 'لا توجد بنود بعد' : 'No lines yet'}
                </p>
                <button
                  type="button"
                  onClick={() => replace(mapSellLineItems(initialInvoice, tenant))}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'تحميل البنود' : 'Load lines'}
                </button>
              </div>
            ) : (
              <div className="w-full min-w-0 rounded-lg border border-slate-100 dark:border-white/5">
                <div
                  className={`hidden gap-1 border-b border-slate-100 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:border-white/5 lg:grid ${
                    isTravelContext ? 'lg:grid-cols-12' : sellStandardLineGridClass
                  }`}
                  dir="ltr"
                >
                  <div className={sellProductColClass}>{language === 'ar' ? 'المنتج / الوصف' : 'Product / description'}</div>
                  {!isTravelContext ? (
                    <>
                      {showAccountColumn ? (
                        <div className="lg:col-span-2">{language === 'ar' ? 'الحساب' : 'Account'}</div>
                      ) : null}
                      {showAnalyticColumn ? (
                        <div className="lg:col-span-2">{language === 'ar' ? 'تحليلي' : 'Analytic'}</div>
                      ) : null}
                      <div className="text-center lg:col-span-1">{language === 'ar' ? 'وحدة' : 'UoM'}</div>
                      <div className="text-end lg:col-span-1">{t('quantity')}</div>
                      <div className="text-end lg:col-span-1">{t('unitPrice')}</div>
                      <div className="text-center lg:col-span-1">{t('tax')} %</div>
                    </>
                  ) : (
                    <>
                      <div className="lg:col-span-2">{isTravelContext ? (language === 'ar' ? 'سعر التذكرة' : 'Price') : t('unitPrice')}</div>
                      <div className="lg:col-span-1">{language === 'ar' ? 'وكالة' : 'Agency'}</div>
                      <div className="lg:col-span-1">{language === 'ar' ? 'عميل' : 'Customer'}</div>
                    </>
                  )}
                  <div className="text-end lg:col-span-1">{t('total')}</div>
                </div>

                <div className="min-w-0 divide-y divide-slate-100 dark:divide-white/5">
                  {fields.map((field, index) => (
                <div
                  key={field.fieldId || field.id || `line-${index}`}
                  id={`invoice-line-${index}`}
                  className="group px-3 py-2.5 transition hover:bg-slate-50/70 dark:hover:bg-white/[0.02] sm:px-4"
                >
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
                  <div
                    className={`grid grid-cols-2 items-start gap-1.5 ${
                      isTravelContext ? 'lg:grid-cols-12' : sellStandardLineGridClass
                    }`}
                    dir="ltr"
                  >
                    <div className={`col-span-2 min-w-0 ${sellProductColClass}`}>
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
                              value={watch(`lineItems.${index}.variantId`)}
                              language={language}
                              required
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
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input id={`product-select-${index}`} {...register(`lineItems.${index}.productName`)} className={lineGhostInputClass} placeholder={language === 'ar' ? 'اسم الخدمة' : 'Service name'} />
                          {showArabicFields ? (
                            <input
                              {...register(`lineItems.${index}.productNameAr`)}
                              className={`${lineGhostInputClass} text-xs`}
                              dir="auto"
                              placeholder="اسم البند"
                            />
                          ) : (
                            <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                          )}
                        </div>
                      )}
                    </div>
                    {!isTravelContext ? (
                      <>
                        {showAccountColumn ? (
                          <div className="col-span-2 min-w-0 lg:col-span-2">
                            <select
                              id={`invoice-line-${index}-income`}
                              {...register(`lineItems.${index}.incomeAccountId`)}
                              disabled={isInvoicePosted}
                              className={`${lineGhostInputClass} cursor-pointer truncate disabled:opacity-60`}
                            >
                              <option value="">{language === 'ar' ? 'حساب…' : 'Account…'}</option>
                              {incomeAccounts.map((a) => (
                                <option key={a._id} value={a._id}>
                                  {a.code} — {language === 'ar' ? (a.nameAr || a.name) : a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        {showAnalyticColumn ? (
                          <div className="col-span-2 min-w-0 lg:col-span-2">
                            <select
                              {...register(`lineItems.${index}.analyticAccountId`)}
                              disabled={isInvoicePosted}
                              className={`${lineGhostInputClass} cursor-pointer truncate disabled:opacity-60`}
                            >
                              <option value="">{language === 'ar' ? 'تحليلي…' : 'Analytic…'}</option>
                              {analyticAccounts.map((a) => (
                                <option key={a._id} value={a._id}>
                                  {a.code ? `${a.code} — ` : ''}{language === 'ar' ? (a.nameAr || a.name) : a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {!isTravelContext ? (
                      <div className="col-span-1 min-w-0 lg:col-span-1">
                        <select
                          {...register(`lineItems.${index}.unitCode`)}
                          className={`${lineGhostInputClass} cursor-pointer tabular-nums`}
                          aria-label={language === 'ar' ? 'وحدة' : 'UOM'}
                        >
                          <option value="">—</option>
                          {getAvailableUomOptions(tenant).map((uom) => (
                            <option key={uom.code} value={uom.code}>
                              {language === 'ar' ? (uom.shortAr || uom.code) : (uom.shortEn || uom.code)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {isTravelContext ? (
                      <input
                        type="hidden"
                        {...register(`lineItems.${index}.quantity`, {
                          valueAsNumber: true,
                          required: sellLineHasContent(watch(`lineItems.${index}`)),
                          min: sellLineHasContent(watch(`lineItems.${index}`)) ? 0.0001 : undefined,
                        })}
                      />
                    ) : (
                      <div className="col-span-1 min-w-0 lg:col-span-1">
                        <input
                          id={`qty-${index}`}
                          type="number"
                          min="0.0001"
                          step="any"
                          {...register(`lineItems.${index}.quantity`, {
                            valueAsNumber: true,
                            required: sellLineHasContent(watch(`lineItems.${index}`)),
                            min: sellLineHasContent(watch(`lineItems.${index}`)) ? 0.0001 : undefined,
                          })}
                          className={`${lineGhostInputClass} tabular-nums`}
                        />
                      </div>
                    )}
                    <div className={`col-span-1 min-w-0 ${isTravelContext ? 'lg:col-span-2' : 'lg:col-span-1'}`}>
                      <input
                        id={`price-${index}`}
                        type="number"
                        step="0.01"
                        {...register(`lineItems.${index}.unitPrice`, {
                          valueAsNumber: true,
                          required: sellLineHasContent(watch(`lineItems.${index}`)),
                          min: 0,
                        })}
                        className={`${lineGhostInputClass} tabular-nums`}
                      />
                    </div>
                    {isTravelContext ? (
                      <>
                        <div className="col-span-1 lg:col-span-1">
                          <input
                            id={`agencyprice-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${index}.agencyPrice`, { valueAsNumber: true, min: 0 })}
                            className={`${lineGhostInputClass} tabular-nums`}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          <input
                            id={`custprice-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${index}.customerPrice`, { valueAsNumber: true, min: 0 })}
                            className={`${lineGhostInputClass} tabular-nums`}
                            placeholder="0.00"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-1 min-w-0 lg:col-span-1">
                        {(() => {
                          const isPkTax = String(tenant?.settings?.currency || '').toUpperCase() === 'PKR' || (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
                          const pkRate = Number(tenant?.fbr?.defaultSalesTaxRate || 18)
                          return (
                            <select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className={`${lineGhostInputClass} cursor-pointer`}>
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
                    <div className="col-span-2 flex min-w-0 items-center justify-end gap-1 lg:col-span-1">
                      <p className="truncate text-[12px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        <Money value={calculateLineTotal(index).total} />
                      </p>
                      {fields.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded-md p-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
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
            )}
          </div>

          <SalesEnhancementBar
            subtotal={totals.subtotal}
            customerId={values?.customerId}
            language={language}
            showMatrix={isTradingContext}
            matrixProductId={lineItems.find((l) => l?.productId)?.productId || ''}
            matrixProductLabel={lineItems.find((l) => l?.productId)?.productName || ''}
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
                  ...(showRentalExtra
                    ? [{
                        id: 'rental',
                        active: showRentalPanel,
                        labelEn: 'Rental',
                        labelAr: 'إيجار',
                        onClick: () => handleToggleRental(!showRentalPanel),
                      }]
                    : []),
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
                    label={language === 'ar' ? 'الشروط والأحكام (EN)' : 'Terms & Conditions (EN)'}
                    value={watch('termsAndConditions')}
                    onChange={(val) => setValue('termsAndConditions', val, { shouldDirty: true })}
                    onRemove={() => {
                      setShowTermsPanel(false)
                      setValue('termsAndConditions', '')
                      setValue('termsAndConditionsAr', '')
                    }}
                    placeholder={language === 'ar' ? 'أدخل الشروط والأحكام بالإنجليزية...' : 'Enter terms and conditions in English...'}
                    rows={4}
                    language={language}
                    fieldControlClass={fieldControlClass}
                  />
                  <div className="mt-3">
                    <RichTextNoteField
                      label={language === 'ar' ? 'الشروط والأحكام (AR)' : 'Terms & Conditions (AR)'}
                      value={watch('termsAndConditionsAr')}
                      onChange={(val) => setValue('termsAndConditionsAr', val, { shouldDirty: true })}
                      placeholder={language === 'ar' ? 'أدخل الشروط والأحكام بالعربية...' : 'Enter terms and conditions in Arabic...'}
                      rows={4}
                      language="ar"
                      fieldControlClass={fieldControlClass}
                    />
                  </div>
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
                    label={language === 'ar' ? 'ملاحظات (EN)' : 'Notes (EN)'}
                    value={watch('notes')}
                    onChange={(val) => setValue('notes', val, { shouldDirty: true })}
                    onRemove={() => {
                      setShowNotesPanel(false)
                      setValue('notes', '')
                      setValue('notesAr', '')
                    }}
                    placeholder={language === 'ar' ? 'أدخل ملاحظات الفاتورة...' : 'Enter invoice notes...'}
                    rows={3}
                    language={language}
                    fieldControlClass={fieldControlClass}
                  />
                  <div className="mt-3">
                    <RichTextNoteField
                      label={language === 'ar' ? 'ملاحظات (AR)' : 'Notes (AR)'}
                      value={watch('notesAr')}
                      onChange={(val) => setValue('notesAr', val, { shouldDirty: true })}
                      placeholder={language === 'ar' ? 'أدخل الملاحظات بالعربية...' : 'Enter notes in Arabic...'}
                      rows={3}
                      language="ar"
                      fieldControlClass={fieldControlClass}
                    />
                  </div>
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
                    <div>
                      <FieldLabel en="SWIFT / BIC" ar="سويفت" />
                      <input {...register('bankDetails.swift')} className={`mt-1.5 ${fieldControlClass} font-mono`} placeholder="RJHISARI" maxLength={11} />
                    </div>
                  </div>
                  <input type="hidden" {...register('includeBankDetails')} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showRentalPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-t border-slate-100 pt-4 dark:border-white/5"
                >
                  <BoutiqueInvoiceFields
                    language={language}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    fieldControlClass={fieldControlClass}
                    fieldLabelClass={fieldLabelClass}
                    dense
                    onRemove={() => handleToggleRental(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            {!showTermsPanel && (
              <>
                <input type="hidden" {...register('termsAndConditions')} />
                <input type="hidden" {...register('termsAndConditionsAr')} />
              </>
            )}
            {!showNotesPanel && (
              <>
                <input type="hidden" {...register('notes')} />
                <input type="hidden" {...register('notesAr')} />
              </>
            )}
            {!showBankPanel && (
              <>
                <input type="hidden" {...register('includeBankDetails')} />
                <input type="hidden" {...register('bankDetails.bankName')} />
                <input type="hidden" {...register('bankDetails.accountName')} />
                <input type="hidden" {...register('bankDetails.accountNumber')} />
                <input type="hidden" {...register('bankDetails.iban')} />
                <input type="hidden" {...register('bankDetails.swift')} />
              </>
            )}
            {!showRentalPanel && (
              <>
                <input type="hidden" {...register('boutiqueDetails.transactionType')} />
                <input type="hidden" {...register('boutiqueDetails.startDate')} />
                <input type="hidden" {...register('boutiqueDetails.endDate')} />
                <input type="hidden" {...register('boutiqueDetails.totalDeposit', { valueAsNumber: true })} />
                <input type="hidden" {...register('boutiqueDetails.amountPaid', { valueAsNumber: true })} />
                <input type="hidden" {...register('boutiqueDetails.paymentMethod')} />
                <input type="hidden" {...register('boutiqueDetails.depositStatus')} />
                <input type="hidden" {...register('boutiqueDetails.amountRefunded', { valueAsNumber: true })} />
                <input type="hidden" {...register('boutiqueDetails.totalLateFee', { valueAsNumber: true })} />
                <input type="hidden" {...register('boutiqueDetails.totalDamageFee', { valueAsNumber: true })} />
                <input type="hidden" {...register('boutiqueDetails.totalCleaningFee', { valueAsNumber: true })} />
                <input type="hidden" {...register('boutiqueDetails.rentalId')} />
                <input type="hidden" {...register('boutiqueDetails.rentalNumber')} />
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
                  {paymentTermsList.slice(0, 5).map((term) => {
                    const active = watch('paymentTerms') === term.id
                    return (
                      <button
                        key={term.id}
                        type="button"
                        onClick={() => {
                          setValue('paymentTerms', term.id, { shouldDirty: true })
                          const issueRaw = getValues('issueDate')
                          const dueOnly = computeDueDateOnlyFromPaymentTerms(issueRaw || new Date(), term.id)
                          if (dueOnly) setValue('dueDate', dueOnly, { shouldDirty: true })
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
                      paymentTermsList.slice(0, 5).some((t) => t.id === watch('paymentTerms'))
                        ? 'text-slate-400'
                        : 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                    }`}
                    onChange={(e) => {
                      const id = e.target.value
                      setValue('paymentTerms', id, { shouldDirty: true })
                      const issueRaw = getValues('issueDate')
                      const dueOnly = computeDueDateOnlyFromPaymentTerms(issueRaw || new Date(), id)
                      if (dueOnly) setValue('dueDate', dueOnly, { shouldDirty: true })
                      setValue('paymentStatus', isImmediatePaymentTerm(id) ? 'paid' : 'pending', { shouldDirty: true })
                    }}
                  >
                    {paymentTermsList.map((term) => (
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

            {/* Optional warehouse metadata only — stock moves via delivery notes */}
            <input type="hidden" {...register('warehouseId')} />

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-slate-400">
                  {language === 'ar'
                    ? 'اضغط معاينة لمراجعة الفاتورة قبل الحفظ'
                    : 'Tap Preview to review the invoice before saving'}
                </p>
                <div className={segmentWrapClass} title={language === 'ar' ? 'تنسيق الطباعة / PDF' : 'Print / PDF format'}>
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
                        disabled={isInvoicePosted}
                        onClick={() => setValue('printFormat', fmt.id, { shouldDirty: true, shouldTouch: true })}
                        className={`${segmentBtnClass(active)} inline-flex items-center gap-1.5`}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {language === 'ar' ? fmt.labelAr : fmt.labelEn}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => navigate(isEdit ? `/app/dashboard/accounting/invoices/${invoiceId}` : '/app/dashboard/accounting/invoices')} className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-dark-500 dark:bg-transparent dark:text-slate-300">{t('cancel')}</button>
                <button type="submit" disabled={saveMutation.isPending || isInvoicePosted} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-50 dark:bg-white dark:text-slate-900">
                  {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <><Eye className="w-4 h-4" />{language === 'ar' ? 'معاينة' : 'Preview'}</>}
                </button>
              </div>
            </div>
          </div>
          </fieldset>
          </>
          )}

          {formTab === 'journal' && (
          <InvoiceJournalItemsPanel
            flow="sell"
            language={language}
            totals={totals}
            lineItems={totals.lines || []}
            sourcePurchaseOrderId={watch('sourcePurchaseOrderId')}
            paymentTerms={watch('paymentTerms')}
            issueDate={watch('issueDate')}
            dueDate={watch('dueDate')}
            value={accountingLines}
            onChange={setAccountingLines}
            readOnly={isInvoicePosted}
          />
          )}

          {formTab === 'other' && (
          <>
          <div className={`${sectionCardClass} space-y-4`}>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'معلومات المحاسبة' : 'Accounting metadata'}
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={fieldLabelClass}>{language === 'ar' ? 'مندوب المبيعات' : 'Salesperson'}</label>
                <select {...register('salespersonId')} disabled={isInvoicePosted} className={`mt-1.5 ${fieldControlClass} disabled:opacity-60`}>
                  <option value="">{language === 'ar' ? '—' : '—'}</option>
                  {salesUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>{language === 'ar' ? 'شروط التجارة (Incoterm)' : 'Incoterm'}</label>
                <select {...register('incoterm')} disabled={isInvoicePosted} className={`mt-1.5 ${fieldControlClass} disabled:opacity-60`}>
                  <option value="">—</option>
                  {incotermsList.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>{language === 'ar' ? 'مرجع العميل' : 'Customer reference'}</label>
                <input {...register('customerReference')} disabled={isInvoicePosted} className={`mt-1.5 ${fieldControlClass} disabled:opacity-60`} placeholder={language === 'ar' ? 'PO / مرجع العميل' : 'Customer PO / reference'} />
              </div>
              <div>
                <label className={fieldLabelClass}>{language === 'ar' ? 'المركز الضريبي' : 'Fiscal position'}</label>
                <select {...register('fiscalPosition')} disabled={isInvoicePosted} className={`mt-1.5 ${fieldControlClass} disabled:opacity-60`}>
                  <option value="">{language === 'ar' ? '—' : '—'}</option>
                  {values?.fiscalPosition && !fiscalPositions.some((pos) => pos.code === values.fiscalPosition) ? (
                    <option value={values.fiscalPosition}>{values.fiscalPosition}</option>
                  ) : null}
                  {fiscalPositions.map((pos) => (
                    <option key={pos.code} value={pos.code}>
                      {language === 'ar' ? (pos.nameAr || pos.name || pos.code) : (pos.name || pos.code)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={fieldLabelClass}>{language === 'ar' ? 'ملاحظات داخلية' : 'Internal notes'}</label>
                <textarea {...register('internalNotes')} disabled={isInvoicePosted} rows={2} className={`mt-1.5 ${fieldControlClass} min-h-[4rem] disabled:opacity-60`} />
              </div>
            </div>
          </div>

          
          </>
          )}
        </form>
      </div>

      <DocumentPreSaveModal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false)
          setPreviewConfirmAttempted(false)
        }}
        onConfirm={handleConfirmSave}
        isPending={saveMutation.isPending}
        document={previewInvoice}
        tenant={tenant}
        language={language}
        documentType="invoice"
        templateId={selectedTemplateId}
        title={language === 'ar' ? 'معاينة الفاتورة قبل الحفظ' : 'Invoice Live Preview'}
        printFormat={values?.printFormat === 'thermal' ? 'thermal' : 'a4'}
        showPrintFormatToggle={!isInvoicePosted}
        onPrintFormatChange={(fmt) => setValue('printFormat', fmt === 'thermal' ? 'thermal' : 'a4', { shouldDirty: true })}
        confirmDisabled={false}
        confirmLabel={
          prePostHasWarnings && prePostCanPost
            ? (language === 'ar' ? 'ترحيل على أي حال' : 'Post anyway')
            : (language === 'ar' ? 'تأكيد / ترحيل' : 'Confirm / Post')
        }
        warningText={
          prePostHasWarnings && prePostCanPost
            ? (language === 'ar'
              ? (prePostResult?.warnings?.[0]?.messageAr || prePostResult?.warnings?.[0]?.message)
              : (prePostResult?.warnings?.[0]?.message))
            : undefined
        }
        errorChecks={
          previewConfirmAttempted && !prePostCanPost
            ? prePostChecks.filter((c) => !c.ok && c.blocking)
            : []
        }
        onFixCheck={(check) => {
          setShowPreviewModal(false)
          setPreviewConfirmAttempted(false)
          handlePrePostFix(check)
        }}
      />
      <CancelInvoiceModal
        isOpen={cancelOpen}
        onClose={() => { if (!cancelPending) setCancelOpen(false) }}
        invoice={initialInvoice}
        language={language}
        isPending={cancelPending}
        onConfirm={async (reason) => {
          setCancelPending(true)
          try {
            await api.post(`/invoices/${invoiceId}/cancel`, { reason })
            toast.success(language === 'ar' ? 'تم إلغاء الفاتورة' : 'Invoice cancelled')
            setCancelOpen(false)
            queryClient.invalidateQueries(['invoices'])
            queryClient.invalidateQueries(['invoice', invoiceId])
            navigate(`/app/dashboard/accounting/invoices/${invoiceId}`)
          } catch (error) {
            toast.error(error?.response?.data?.error || (language === 'ar' ? 'فشل الإلغاء' : 'Cancel failed'))
          } finally {
            setCancelPending(false)
          }
        }}
      />
    </div>
  )
}

                        
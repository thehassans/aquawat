import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Save, Trash2, Upload, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../ui/Money'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { LETTERHEAD_TEMPLATE_ID, resolveQuotationTemplateId } from '../../lib/invoiceTemplates'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage, isGccArabicMarket } from '../../lib/invoiceLanguage'
import { isPakistanTenant, getTenantCountryCode, showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'
import { getAvailableUomOptions, getDefaultUom, getUomLabel } from '../../lib/uomOptions'
import { useLiveTranslation, useBilingualAddressFields, LineItemTranslator } from '../../lib/liveTranslation'
import InvoiceLivePreview from '../invoices/InvoiceLivePreview'
import DocumentPreSaveModal from '../invoices/DocumentPreSaveModal'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  normalizeProductType,
  productPickerLabel,
  productDisplayName,
  resolveProductSalePrice,
  hasArabicScript,
} from '../../lib/productType'
import ProductTypeToggle from '../ui/ProductTypeToggle'
import RichTextNoteField from '../invoices/RichTextNoteField'
import MarqueeEventFields from '../marquee/MarqueeEventFields'
import { isAppAccessValid } from '../../lib/appStoreTrial'
import { LineRelationSuggestions } from '../inventory/ProductRelationSuggestions'
import VariantLineSelect from '../inventory/VariantLineSelect'
import PartnerCombobox from '../inventory/PartnerCombobox'
import { formatInvError } from '../../lib/invError'
import {
  backBtnClass,
  pageSubtitleClass,
  pageTitleClass,
  sectionCardClass,
} from '../../pages/sales/salesUi'
import SalesEnhancementBar from '../sales/SalesEnhancementBar'
import CustomerSummaryCard from '../sales/CustomerSummaryCard'
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
    else if (currency === 'PKR') defaultRate = Number(tenant?.fbr?.defaultSalesTaxRate || 18)
    else if (currency === 'BDT') defaultRate = Number(tenant?.nbr?.defaultVatRate || 15)
    else defaultRate = 15
  }

  return {
    productId: '',
    variantId: '',
    productName: '',
    productNameAr: '',
    productType: 'goods',
    description: '',
    descriptionAr: '',
    unitCode: getDefaultUom(tenant) || '',
    quantity: 1,
    unitPrice: '',
    taxRate: defaultRate,
    discount: 0,
    discountType: 'fixed',
  }
}

const selectableContexts = ['trading', 'marquee', 'construction', 'travel_agency', 'restaurant']

const lineGhostInputClass =
  'w-full rounded-md border-0 bg-transparent px-1.5 py-1.5 text-[13px] font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:bg-slate-50 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/5'
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

const formatDateForInput = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const buildQuotationFormValues = ({ quotation, tenant, defaultBusinessContext, defaultTemplateId }) => {
  const empty = getEmptyLine(tenant)
  return {
    businessContext: quotation?.businessContext || defaultBusinessContext,
    pdfTemplateId: resolveQuotationTemplateId(
      quotation?.pdfTemplateId || defaultTemplateId || LETTERHEAD_TEMPLATE_ID,
    ),
    issueDate: formatDateForInput(quotation?.issueDate) || formatDateForInput(new Date()),
    validUntil: formatDateForInput(quotation?.validUntil),
    transactionType: quotation?.transactionType || 'B2B',
    customerId: quotation?.customerId?._id || quotation?.customerId || '',
    salesTeamId: quotation?.salesTeamId?._id || quotation?.salesTeamId || '',
    subject: quotation?.subject || '',
    subjectAr: quotation?.subjectAr || '',
    notes: quotation?.notes || '',
    termsAndConditions: quotation?.termsAndConditions || '',
    includeBankDetails: Boolean(quotation?.includeBankDetails),
    bankDetails: {
      bankName: quotation?.bankDetails?.bankName || '',
      accountName: quotation?.bankDetails?.accountName || '',
      accountNumber: quotation?.bankDetails?.accountNumber || '',
      iban: quotation?.bankDetails?.iban || '',
    },
    invoiceDiscount: Math.max(0, toNumber(quotation?.invoiceDiscount, 0)),
    buyer: {
      address: {
        country: getTenantCountryCode(tenant),
      },
      ...(quotation?.buyer || {}),
    },
    authorizedPersonName: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonName || '') : '',
    authorizedPersonNameAr: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonNameAr || '') : '',
    authorizedPersonDesignation: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonDesignation || '') : '',
    authorizedPersonDesignationAr: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonDesignationAr || '') : '',
    authorizedPersonSignature: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonSignature || '') : '',
    stampImage: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.stampImage || '') : '',
    lineItems: Array.isArray(quotation?.lineItems) && quotation.lineItems.length > 0
      ? quotation.lineItems.map((line) => ({
          ...empty,
          ...line,
          productId: line?.productId?._id || line?.productId || '',
          variantId: line?.variantId?._id || line?.variantId || '',
          productName: line?.productName || '',
          productNameAr: line?.productNameAr || '',
          productType: normalizeProductType(line?.productType),
          description: line?.description || '',
          descriptionAr: line?.descriptionAr || '',
          unitCode: line?.unitCode !== undefined ? (line.unitCode || '') : empty.unitCode,
          quantity: Math.max(1, toNumber(line?.quantity, 1)),
          unitPrice: Math.max(0, toNumber(line?.unitPrice, 0)),
          taxRate: Math.max(0, toNumber(line?.taxRate, 15)),
          discount: Math.max(0, toNumber(line?.discount, 0)),
          discountType: line?.discountType || 'fixed',
        }))
      : [empty],
  }
}

export default function QuotationComposer({ quotationId = '', initialQuotation = null }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const partnerIdParam = String(searchParams.get('partnerId') || '').trim()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { settings: salesSettings } = useSalesSettings()
  const { t } = useTranslation(language)
  const isEdit = Boolean(quotationId)
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    const c = initialQuotation?.customerId
    return c && typeof c === 'object' ? c : null
  })
  const [showAuthorizedPerson, setShowAuthorizedPerson] = useState(() => {
    return Boolean(
      initialQuotation?.authorizedPersonName ||
      initialQuotation?.authorizedPersonNameAr ||
      initialQuotation?.authorizedPersonDesignation ||
      initialQuotation?.authorizedPersonDesignationAr ||
      initialQuotation?.authorizedPersonSignature ||
      initialQuotation?.stampImage
    )
  })
  const [showSubjectPanel, setShowSubjectPanel] = useState(() => Boolean(
    String(initialQuotation?.subject || '').trim() || String(initialQuotation?.subjectAr || '').trim()
  ))
  const [showNotesPanel, setShowNotesPanel] = useState(() => Boolean(String(initialQuotation?.notes || '').trim()))
  const [showTermsPanel, setShowTermsPanel] = useState(() => Boolean(String(initialQuotation?.termsAndConditions || '').trim()))
  const [showBankPanel, setShowBankPanel] = useState(() => Boolean(
    initialQuotation?.includeBankDetails ||
    initialQuotation?.bankDetails?.bankName ||
    initialQuotation?.bankDetails?.iban ||
    initialQuotation?.bankDetails?.accountNumber
  ))
  const showArabicFields = isArabicTenantMarket(tenant)
  const isPk = isPakistanTenant(tenant)

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

  const defaultTemplateId = resolveQuotationTemplateId(
    salesSettings?.defaultQuotationTemplateId || LETTERHEAD_TEMPLATE_ID,
  )

  const { register, control, handleSubmit, watch, setValue, getValues, reset } = useForm({
    defaultValues: buildQuotationFormValues({
      quotation: initialQuotation,
      tenant,
      defaultBusinessContext,
      defaultTemplateId,
    }),
  })

  useEffect(() => {
    if (isEdit || !salesSettings) return
    if (!getValues('validUntil') && salesSettings.quotationValidityDays) {
      const issue = getValues('issueDate') ? new Date(getValues('issueDate')) : new Date()
      const until = new Date(issue)
      until.setDate(until.getDate() + Number(salesSettings.quotationValidityDays || 30))
      setValue('validUntil', formatDateForInput(until))
    }
    if (!getValues('termsAndConditions') && salesSettings.quotationDefaultTerms) {
      setValue('termsAndConditions', salesSettings.quotationDefaultTerms)
      setShowTermsPanel(true)
    }
    if (!getValues('notes') && salesSettings.quotationDefaultNotes) {
      setValue('notes', salesSettings.quotationDefaultNotes)
      setShowNotesPanel(true)
    }
  }, [salesSettings, isEdit, getValues, setValue])

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
        const defaultTerms = salesSettings?.quotationDefaultTerms ||
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
        const defaultNotes = salesSettings?.quotationDefaultNotes ||
          tenant?.settings?.invoiceBranding?.defaultNotes ||
          tenant?.settings?.notes ||
          ''
        if (defaultNotes) setValue('notes', defaultNotes)
      }
    } else {
      setValue('notes', '')
    }
  }

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems' })
  const values = watch()
  const lineItems = Array.isArray(values?.lineItems) ? values.lineItems : []
  const businessContext = values?.businessContext || defaultBusinessContext
  const selectedTemplateId = resolveQuotationTemplateId(values?.pdfTemplateId || LETTERHEAD_TEMPLATE_ID)
  const isTradingContext = businessContext === 'trading'
  const isMarqueeContext =
    businessContext === 'marquee' ||
    tenantBusinessTypes.includes('marquee') ||
    isAppAccessValid(tenant?.settings?.installedApps?.marquee_management)
  const [customerLookupId, setCustomerLookupId] = useState('')

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
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'subject',
    targetField: 'subjectAr',
    sourceLang: 'en', targetLang: 'ar',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'subjectAr',
    targetField: 'subject',
    sourceLang: 'ar', targetLang: 'en',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'authorizedPersonName',
    targetField: 'authorizedPersonNameAr',
    sourceLang: 'en', targetLang: 'ar',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'authorizedPersonNameAr',
    targetField: 'authorizedPersonName',
    sourceLang: 'ar', targetLang: 'en',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'authorizedPersonDesignation',
    targetField: 'authorizedPersonDesignationAr',
    sourceLang: 'en', targetLang: 'ar',
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: 'authorizedPersonDesignationAr',
    targetField: 'authorizedPersonDesignation',
    sourceLang: 'ar', targetLang: 'en',
  })

  useEffect(() => {
    if (!isEdit || !initialQuotation?._id) return
    reset(buildQuotationFormValues({
      quotation: initialQuotation,
      tenant,
      defaultBusinessContext,
      defaultTemplateId: initialQuotation?.pdfTemplateId || LETTERHEAD_TEMPLATE_ID,
    }))
  }, [defaultBusinessContext, initialQuotation, isEdit, reset, tenant])

  useEffect(() => {
    if (isEdit && initialQuotation?._id) return
    setValue('businessContext', defaultBusinessContext)
  }, [defaultBusinessContext, initialQuotation?._id, isEdit, setValue])

  useEffect(() => {
    if (isEdit) return
    setValue('pdfTemplateId', defaultTemplateId, { shouldDirty: false })
  }, [defaultTemplateId, isEdit, setValue])

  useEffect(() => {
    const customerId = initialQuotation?.customerId?._id || initialQuotation?.customerId || ''
    if (!customerId) return
    setCustomerLookupId(String(customerId))
    if (typeof initialQuotation?.customerId === 'object') {
      setSelectedCustomer(initialQuotation.customerId)
      return
    }
    let cancelled = false
    api.get(`/customers/${customerId}`).then((res) => {
      if (!cancelled && res.data) setSelectedCustomer(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [initialQuotation?.customerId])

  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 200 } })
      const list = res.data?.products ?? res.data?.items ?? res.data
      return Array.isArray(list) ? list : []
    },
    enabled: isTradingContext,
  })
  const productList = Array.isArray(products) ? products : []

  const { data: salesTeamsRaw = [] } = useQuery({
    queryKey: ['sales-teams-picker'],
    queryFn: async () => {
      const res = await api.get('/sales/teams')
      const list = res.data?.items ?? res.data
      return Array.isArray(list) ? list : []
    },
  })
  const salesTeams = useMemo(
    () => (Array.isArray(salesTeamsRaw) ? salesTeamsRaw : []).filter((team) => team?.isActive !== false),
    [salesTeamsRaw]
  )

  const fillBuyerFromParty = (customer) => {
    if (!customer) return
    setCustomerLookupId(String(customer._id))
    setValue('customerId', customer._id)
    setValue('buyer.name', customer.name || customer.nameEn || '')
    setValue('buyer.nameAr', customer.nameAr || customer.name || customer.nameEn || '')
    setValue('buyer.vatNumber', customer.vatNumber || '')
    setValue('buyer.crNumber', customer.crNumber || '')
    setValue('buyer.contactPhone', customer.phone || customer.mobile || '')
    setValue('buyer.contactEmail', customer.email || '')
    setValue('buyer.address.city', customer.address?.city || '')
    setValue('buyer.address.district', customer.address?.district || '')
    setValue('buyer.address.street', customer.address?.street || '')
    setValue('buyer.address.postalCode', customer.address?.postalCode || '')
    setValue('buyer.address.country', customer.address?.country || getTenantCountryCode(tenant))
    setValue('buyer.address.buildingNumber', customer.address?.buildingNumber || '')
    setValue('buyer.address.additionalNumber', customer.address?.additionalNumber || '')
  }

  const onSelectCustomer = (customerId, opt) => {
    if (!customerId) {
      setCustomerLookupId('')
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

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit
      ? api.put(`/quotations/${quotationId}`, payload, { timeout: 120000 })
      : api.post('/quotations', payload, { timeout: 120000 }),
    onSuccess: (res) => {
      setShowPreviewModal(false)
      toast.success(isEdit
        ? (language === 'ar' ? 'تم تحديث عرض السعر بنجاح' : 'Quotation updated successfully')
        : (language === 'ar' ? 'تم إنشاء عرض السعر بنجاح' : 'Quotation created successfully'))
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers-lookup'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] })
      }
      if (res.data?.offline) {
        navigate('/app/dashboard/quotations')
      } else {
        navigate(`/app/dashboard/quotations/${res.data?._id || quotationId}`)
      }
    },
    onError: (error) => {
      toast.error(formatInvError(error, language) || (language === 'ar' ? 'تعذر حفظ عرض السعر' : 'Failed to save quotation'))
    },
  })

  const onSelectProduct = (index, productId) => {
    const product = productList.find((item) => String(item._id) === String(productId))
    if (!product) return
    setValue(`lineItems.${index}.productId`, product._id, { shouldDirty: true })
    setValue(`lineItems.${index}.variantId`, '', { shouldDirty: true })
    setValue(`lineItems.${index}.productName`, productDisplayName(product, 'en'), { shouldDirty: true })
    setValue(`lineItems.${index}.productNameAr`, hasArabicScript(product.nameAr) ? String(product.nameAr).trim() : '', { shouldDirty: true })
    setValue(`lineItems.${index}.description`, product.descriptionEn || '', { shouldDirty: true })
    setValue(`lineItems.${index}.descriptionAr`, product.descriptionAr || '', { shouldDirty: true })
    setValue(`lineItems.${index}.unitCode`, product.unitOfMeasure || 'PCE', { shouldDirty: true })
    setValue(`lineItems.${index}.taxRate`, typeof product.saleTaxRate === 'number' ? product.saleTaxRate : (typeof product.taxRate === 'number' ? product.taxRate : 15), { shouldDirty: true })
    setValue(`lineItems.${index}.unitPrice`, resolveProductSalePrice(product), { shouldDirty: true })
    setValue(`lineItems.${index}.productType`, normalizeProductType(product.productType), { shouldDirty: true })
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
      toast(language === 'ar' ? 'المنتج موجود في البنود' : 'Product already on the quotation')
      return
    }
    append({
      ...getEmptyLine(tenant),
      productId: product._id,
      productName: product.nameEn || product.name || '',
      productNameAr: product.nameAr || product.nameEn || '',
      description: product.descriptionEn || '',
      descriptionAr: product.descriptionAr || '',
      unitCode: product.unitOfMeasure || 'PCE',
      taxRate: typeof product.saleTaxRate === 'number' ? product.saleTaxRate : (typeof product.taxRate === 'number' ? product.taxRate : 15),
      unitPrice: typeof product.sellingPrice === 'number' ? product.sellingPrice : 0,
      productType: normalizeProductType(product.productType),
      quantity: 1,
    })
  }

  const swapLineProduct = (index, row) => {
    const product = resolveRelatedProduct(row)
    if (!product?._id) return
    onSelectProduct(index, product._id)
  }

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [pendingPayload, setPendingPayload] = useState(null)

  const totals = calculateInvoiceSummary({ lineItems, invoiceDiscount: values?.invoiceDiscount })

  const calculateLineTotal = (index) => {
    const line = totals.lines[index]
    if (!line) return { subtotal: 0, tax: 0, total: 0 }
    return { subtotal: line.lineTotal, tax: line.taxAmount, total: line.lineTotalWithTax }
  }

  const buildPayload = (data) => {
    return {
      ...data,
      businessContext,
      pdfTemplateId: selectedTemplateId,
      transactionType: data?.transactionType === 'B2B' ? 'B2B' : 'B2C',
      issueDate: data?.issueDate ? new Date(data.issueDate) : new Date(),
      validUntil: data?.validUntil ? new Date(data.validUntil) : undefined,
      invoiceDiscount: Math.max(0, toNumber(data?.invoiceDiscount, 0)),
      salesTeamId: data?.salesTeamId || null,
      lineItems: (data.lineItems || []).map((line, index) => {
        const summaryLine = totals.lines[index] || {}
        return {
          ...line,
          lineNumber: index + 1,
          productId: isTradingContext ? (line.productId || undefined) : undefined,
          variantId: isTradingContext && line.variantId ? line.variantId : undefined,
          productName: line.productName || line.productNameAr || (language === 'ar' ? 'بند' : 'Item'),
          productNameAr: line.productNameAr || line.productName || undefined,
          productType: normalizeProductType(line.productType),
          quantity: Math.max(1, toNumber(line.quantity, 1)),
          unitPrice: Math.max(0, toNumber(line.unitPrice, 0)),
          taxRate: Math.max(0, toNumber(line.taxRate, 15)),
          discount: Math.max(0, toNumber(line.discount, 0)),
          discountType: line.discountType === 'percentage' ? 'percentage' : 'fixed',
          taxCategory: 'S',
          taxAmount: toNumber(summaryLine.taxAmount, 0),
          lineTotal: toNumber(summaryLine.lineTotal, 0),
          lineTotalWithTax: toNumber(summaryLine.lineTotalWithTax, 0),
        }
      }),
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      taxableAmount: totals.taxableAmount,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
      subject: data?.subject || '',
      subjectAr: data?.subjectAr || '',
      termsAndConditions: data?.termsAndConditions || '',
      includeBankDetails: Boolean(showBankPanel),
      bankDetails: showBankPanel
        ? {
            bankName: data?.bankDetails?.bankName || '',
            accountName: data?.bankDetails?.accountName || '',
            accountNumber: data?.bankDetails?.accountNumber || '',
            iban: data?.bankDetails?.iban || '',
          }
        : { bankName: '', accountName: '', accountNumber: '', iban: '' },
      showAuthorizedPerson: Boolean(showAuthorizedPerson),
      hasAuthorizedPerson: Boolean(showAuthorizedPerson),
      authorizedPersonName: showAuthorizedPerson ? (data?.authorizedPersonName || '') : '',
      authorizedPersonNameAr: showAuthorizedPerson ? (data?.authorizedPersonNameAr || '') : '',
      authorizedPersonDesignation: showAuthorizedPerson ? (data?.authorizedPersonDesignation || '') : '',
      authorizedPersonDesignationAr: showAuthorizedPerson ? (data?.authorizedPersonDesignationAr || '') : '',
      authorizedPersonSignature: showAuthorizedPerson ? (data?.authorizedPersonSignature || '') : '',
      stampImage: showAuthorizedPerson ? (data?.stampImage || '') : '',
      eventDate: data?.eventDate || undefined,
      eventShift: data?.eventShift || undefined,
      guestCount: data?.guestCount ? Number(data.guestCount) : undefined,
      hallName: data?.hallName || undefined,
      advancePaid: data?.advancePaid ? Number(data.advancePaid) : undefined,
      marqueePackageId: data?.marqueePackageId || undefined,
      packageName: data?.packageName || undefined,
      ratePerHead: data?.ratePerHead ? Number(data.ratePerHead) : undefined,
      hallBaseRent: data?.hallBaseRent ? Number(data.hallBaseRent) : undefined,
      status: initialQuotation?.status || 'draft',
    }
  }

  const onSubmit = (data) => {
    const payload = buildPayload(data)
    setPendingPayload(payload)
    setShowPreviewModal(true)
  }

  const handleConfirmSave = () => {
    const payload = pendingPayload || buildPayload(getValues())
    saveMutation.mutate(payload)
  }

  const previewQuotation = {
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
    quotationNumber: initialQuotation?.quotationNumber || 'PREVIEW-1234',
    issueDate: values?.issueDate ? new Date(values.issueDate) : new Date(),
    validUntil: values?.validUntil ? new Date(values.validUntil) : undefined,
    ...totals,
    seller: {
      name: tenant?.business?.legalNameEn,
      nameAr: tenant?.business?.legalNameAr,
      vatNumber: tenant?.business?.vatNumber,
      crNumber: tenant?.business?.crNumber,
      address: tenant?.business?.address,
      contactPhone: tenant?.business?.contactPhone,
      contactEmail: tenant?.business?.contactEmail,
    },
  }

  const sectionShell = sectionCardClass

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('businessContext')} />
          <input type="hidden" {...register('pdfTemplateId')} />

          <div className={`${sectionCardClass} !p-3`}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[9.5rem]">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {language === 'ar' ? 'الإصدار' : 'Issue'}
                </label>
                <input type="date" {...register('issueDate')} className={`${lineGhostInputClass} mt-0.5 border border-slate-200/80 bg-slate-50/60 px-2 dark:border-white/10 dark:bg-white/[0.03]`} />
              </div>
              <div className="min-w-[9.5rem]">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {language === 'ar' ? 'صالح حتى' : 'Valid until'}
                </label>
                <input type="date" {...register('validUntil')} className={`${lineGhostInputClass} mt-0.5 border border-slate-200/80 bg-slate-50/60 px-2 dark:border-white/10 dark:bg-white/[0.03]`} />
              </div>
              <div className="ms-auto inline-flex rounded-xl bg-slate-100/90 p-0.5 dark:bg-white/5">
                {['B2B', 'B2C'].map((type) => {
                  const active = watch('transactionType') === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setValue('transactionType', type, { shouldDirty: true })}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
              <input type="hidden" {...register('transactionType')} />
            </div>
          </div>

          <div className={`${sectionCardClass} space-y-2.5 !p-3.5`}>
            <PartnerCombobox
              role="customer"
              value={customerLookupId || values?.customerId || ''}
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
                  ? 'اختر عميلاً أو أنشئ عميلاً جديداً'
                  : 'Select a customer or tap New to create one'}
              </p>
            )}
            {salesTeams.length > 0 ? (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {language === 'ar' ? 'فريق المبيعات' : 'Sales team'}
                </label>
                <select {...register('salesTeamId')} className={`${lineGhostInputClass} mt-0.5 border border-slate-200/80 bg-slate-50/60 px-2 dark:border-white/10 dark:bg-white/[0.03]`}>
                  <option value="">{language === 'ar' ? 'بدون فريق' : 'No team'}</option>
                  {salesTeams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {language === 'ar' && team.nameAr ? team.nameAr : (team.name || team.code || team._id)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" {...register('salesTeamId')} />
            )}
            <input type="hidden" {...register('customerId')} />
            <input type="hidden" {...register('buyer.name', { required: values?.transactionType === 'B2B' })} />
            <input type="hidden" {...register('buyer.nameAr')} />
            <input type="hidden" {...register('buyer.vatNumber')} />
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

          <div className={`${sectionCardClass} !p-0 overflow-hidden`}>
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
                  onClick={() => append(getEmptyLine(tenant))}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'إضافة بند' : 'Add line'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="hidden gap-1 border-y border-slate-100 px-4 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:border-white/5 lg:grid lg:grid-cols-12"
                  dir="ltr"
                >
                  <div className={showArabicFields ? 'lg:col-span-5' : 'lg:col-span-7'}>
                    {language === 'ar' ? 'المنتج' : 'Product'}
                  </div>
                  {showArabicFields ? <div className="lg:col-span-2">عربي</div> : null}
                  <div className="lg:col-span-1">{language === 'ar' ? 'وحدة' : 'UOM'}</div>
                  <div className="lg:col-span-1">{t('quantity')}</div>
                  <div className="lg:col-span-1">{t('unitPrice')}</div>
                  <div className="lg:col-span-1">{t('tax')} %</div>
                  <div className="text-end lg:col-span-1">{t('total')}</div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {fields.map((field, index) => (
                    <div key={field.id} className="group px-3 py-2 transition hover:bg-slate-50/70 dark:hover:bg-white/[0.02] sm:px-4">
                      <LineItemTranslator
                        index={index}
                        control={control}
                        watch={watch}
                        setValue={setValue}
                        enabled={!watch(`lineItems.${index}.productId`)}
                        initialNameAr={initialQuotation?.lineItems?.[index]?.productNameAr || ''}
                        initialName={initialQuotation?.lineItems?.[index]?.productName || ''}
                      />
                      <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                      <input type="hidden" {...register(`lineItems.${index}.description`)} />
                      <input type="hidden" {...register(`lineItems.${index}.descriptionAr`)} />
                      <input type="hidden" {...register(`lineItems.${index}.discount`, { valueAsNumber: true })} />
                      <input type="hidden" {...register(`lineItems.${index}.discountType`)} />
                      <div className="grid grid-cols-2 items-center gap-1.5 lg:grid-cols-12" dir="ltr">
                        <div className={`col-span-2 ${showArabicFields ? 'lg:col-span-5' : 'lg:col-span-7'}`}>
                          {isTradingContext ? (
                            <div className="flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-50/80 pe-0.5 ps-1 dark:bg-white/[0.03]">
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
                              <div className="h-4 w-px shrink-0 bg-slate-200/80 dark:bg-white/10" aria-hidden />
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
                                      ? (language === 'ar' ? 'خدمة…' : 'Service…')
                                      : (language === 'ar' ? 'منتج…' : 'Product…')
                                  }
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
                                      minHeight: 32,
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
                              </div>
                              <input type="hidden" {...register(`lineItems.${index}.productName`)} />
                              <input type="hidden" {...register(`lineItems.${index}.productId`)} />
                              <input type="hidden" {...register(`lineItems.${index}.variantId`)} />
                            </div>
                          ) : (
                            <div className="flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-50/80 pe-0.5 ps-1 dark:bg-white/[0.03]">
                              <ProductTypeToggle
                                value={watch(`lineItems.${index}.productType`)}
                                onChange={(next) => setValue(`lineItems.${index}.productType`, next, { shouldDirty: true, shouldTouch: true })}
                                language={language}
                                bare
                              />
                              <div className="h-4 w-px shrink-0 bg-slate-200/80 dark:bg-white/10" aria-hidden />
                              <input
                                id={`product-select-${index}`}
                                {...register(`lineItems.${index}.productName`)}
                                className={`${lineGhostInputClass} flex-1`}
                                placeholder={language === 'ar' ? 'اسم الخدمة' : 'Service name'}
                              />
                            </div>
                          )}
                          {isTradingContext && watch(`lineItems.${index}.productId`) ? (
                            <div className="mt-1 ps-1">
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
                          <div className="col-span-2 lg:col-span-2">
                            <input
                              {...register(`lineItems.${index}.productNameAr`)}
                              className={lineGhostInputClass}
                              dir="auto"
                              placeholder="اسم البند"
                              aria-label="Arabic name"
                            />
                          </div>
                        ) : (
                          <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                        )}
                        <div className="col-span-1 lg:col-span-1">
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
                          <input type="hidden" {...register(`lineItems.${index}.unitCode`)} />
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          <input
                            id={`qty-${index}`}
                            type="number"
                            min="0.0001"
                            step="any"
                            {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0.0001 })}
                            className={`${lineGhostInputClass} tabular-nums`}
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          <input
                            id={`price-${index}`}
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })}
                            className={`${lineGhostInputClass} tabular-nums`}
                          />
                        </div>
                        <div className="col-span-1 lg:col-span-1">
                          {(() => {
                            const isPkTax = isPk || String(tenant?.settings?.currency || '').toUpperCase() === 'PKR' || (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
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
                        <div className="col-span-2 flex items-center justify-end gap-1 lg:col-span-1">
                          <p className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">
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
                            includeOptional
                            onAdd={appendRelatedProduct}
                            onSwap={(row) => swapLineProduct(index, row)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                    id: 'subject',
                    active: showSubjectPanel,
                    labelEn: 'Subject',
                    labelAr: 'موضوع',
                    onClick: () => setShowSubjectPanel((v) => !v),
                  },
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
              {showSubjectPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden border-t border-slate-100 pt-4 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {language === 'ar' ? 'موضوع عرض السعر' : 'Quotation subject'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSubjectPanel(false)
                        setValue('subject', '')
                        setValue('subjectAr', '')
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-red-600"
                    >
                      {language === 'ar' ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                  <div className={showArabicFields ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'grid grid-cols-1 gap-3'} dir="ltr">
                    <input
                      {...register('subject')}
                      className="input"
                      placeholder={language === 'ar' ? 'مثال: أعمال استبدال ملفات الغاز...' : 'e.g. Coil replacement job…'}
                    />
                    {showArabicFields ? (
                      <input {...register('subjectAr')} className="input" dir="rtl" placeholder="الموضوع بالعربية" />
                    ) : (
                      <input type="hidden" {...register('subjectAr')} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {!showSubjectPanel ? (
              <>
                <input type="hidden" {...register('subject')} />
                <input type="hidden" {...register('subjectAr')} />
              </>
            ) : null}

            <AnimatePresence>
              {showAuthorizedPerson && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{language === 'ar' ? 'الموثّق / المفوّض والختم' : 'Authorized Person & Stamp'}</h4>
                    <button type="button" onClick={() => handleToggleAuthorizedPerson(false)} className="text-xs font-semibold text-slate-500 hover:text-red-600">{language === 'ar' ? 'إزالة' : 'Remove'}</button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="label">{language === 'ar' ? 'الاسم' : 'Name'}</label><input {...register('authorizedPersonName')} className="input" /></div>
                    <div><label className="label">{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label><input {...register('authorizedPersonNameAr')} className="input" dir="rtl" /></div>
                    <div><label className="label">{language === 'ar' ? 'المسمى الوظيفي' : 'Designation'}</label><input {...register('authorizedPersonDesignation')} className="input" /></div>
                    <div><label className="label">{language === 'ar' ? 'المسمى الوظيفي بالعربية' : 'Arabic Designation'}</label><input {...register('authorizedPersonDesignationAr')} className="input" dir="rtl" /></div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'التوقيع' : 'Signature'}</label>
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" className="hidden" id="quotation-signature-upload" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 2 * 1024 * 1024) { toast.error(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 2MB' : 'Image must be less than 2MB'); return }
                          const reader = new FileReader()
                          reader.onload = () => setValue('authorizedPersonSignature', String(reader.result || ''))
                          reader.readAsDataURL(file)
                        }} />
                        <label htmlFor="quotation-signature-upload" className="btn btn-secondary cursor-pointer"><Upload className="w-4 h-4" />{language === 'ar' ? 'رفع توقيع' : 'Upload Signature'}</label>
                        {values?.authorizedPersonSignature ? (
                          <div className="relative">
                            <img src={values.authorizedPersonSignature} alt="Signature" className="h-16 max-w-[200px] rounded-lg border border-slate-200 bg-white object-contain p-1 dark:border-white/10" />
                            <button type="button" onClick={() => setValue('authorizedPersonSignature', '')} className="absolute -top-2 -end-2 rounded-full bg-red-100 p-1 text-red-600"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">{language === 'ar' ? 'لم يتم رفع توقيع' : 'No signature uploaded'}</span>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'الختم' : 'Stamp'}</label>
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" className="hidden" id="quotation-stamp-upload" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 2 * 1024 * 1024) { toast.error(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 2MB' : 'Image must be less than 2MB'); return }
                          const reader = new FileReader()
                          reader.onload = () => setValue('stampImage', String(reader.result || ''))
                          reader.readAsDataURL(file)
                        }} />
                        <label htmlFor="quotation-stamp-upload" className="btn btn-secondary cursor-pointer"><Upload className="w-4 h-4" />{language === 'ar' ? 'رفع ختم' : 'Upload Stamp'}</label>
                        {values?.stampImage ? (
                          <div className="relative">
                            <img src={values.stampImage} alt="Stamp" className="h-16 max-w-[200px] rounded-lg border border-slate-200 bg-white object-contain p-1 dark:border-white/10" />
                            <button type="button" onClick={() => setValue('stampImage', '')} className="absolute -top-2 -end-2 rounded-full bg-red-100 p-1 text-red-600"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">{language === 'ar' ? 'لم يتم رفع ختم' : 'No stamp uploaded'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showTermsPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
                  <RichTextNoteField
                    label={language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
                    value={watch('termsAndConditions')}
                    onChange={(val) => setValue('termsAndConditions', val, { shouldDirty: true })}
                    onRemove={() => { setShowTermsPanel(false); setValue('termsAndConditions', '') }}
                    placeholder={language === 'ar' ? 'أدخل الشروط والأحكام... حدد النص واضغط على عريض أو تمييز' : 'Enter terms and conditions... select text and click Bold or Highlight'}
                    rows={5}
                    language={language}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showNotesPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
                  <RichTextNoteField
                    label={language === 'ar' ? 'ملاحظات' : 'Notes'}
                    value={watch('notes')}
                    onChange={(val) => setValue('notes', val, { shouldDirty: true })}
                    onRemove={() => { setShowNotesPanel(false); setValue('notes', '') }}
                    placeholder={language === 'ar' ? 'أدخل ملاحظات عرض السعر...' : 'Enter quotation notes...'}
                    rows={4}
                    language={language}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showBankPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="label">{language === 'ar' ? 'بيانات البنك' : 'Bank Details'}</label>
                    <button type="button" onClick={() => handleToggleBankDetails(false)} className="text-xs font-semibold text-slate-500 hover:text-red-600">{language === 'ar' ? 'إزالة' : 'Remove'}</button>
                  </div>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                    {language === 'ar'
                      ? 'تُؤخذ تلقائياً من ملف الشركة ويمكن تعديلها لهذا العرض فقط.'
                      : 'Prefills from your company profile. You can edit values for this quotation only.'}
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2" dir="ltr">
                    <div>
                      <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                        <span>Bank Name</span>
                        <span dir="rtl" className="font-medium text-slate-500">اسم البنك</span>
                      </label>
                      <input {...register('bankDetails.bankName')} className="input" placeholder="Al Rajhi Bank / SNB" />
                    </div>
                    <div>
                      <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                        <span>Account Name</span>
                        <span dir="rtl" className="font-medium text-slate-500">اسم الحساب</span>
                      </label>
                      <input {...register('bankDetails.accountName')} className="input" />
                    </div>
                    <div>
                      <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                        <span>Account Number</span>
                        <span dir="rtl" className="font-medium text-slate-500">رقم الحساب</span>
                      </label>
                      <input {...register('bankDetails.accountNumber')} className="input font-mono" />
                    </div>
                    <div>
                      <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                        <span>IBAN</span>
                        <span dir="rtl" className="font-medium text-slate-500">الآيبان</span>
                      </label>
                      <input {...register('bankDetails.iban')} className="input font-mono" placeholder="SA0000000000000000000000" />
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

          <div className={sectionShell}>
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{language === 'ar' ? 'الملخص' : 'Summary'}</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{language === 'ar' ? 'الخصم والإجمالي' : 'Discount & Totals'}</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">{language === 'ar' ? 'خصم المستند' : 'Document Discount'}</label>
                <input type="number" min="0" step="0.01" {...register('invoiceDiscount')} className="input" />
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-dark-900/50">
                <div className="flex items-center justify-between text-sm"><span className="text-slate-500">{language === 'ar' ? 'الإجمالي الفرعي' : 'Subtotal'}</span><span className="font-semibold">{totals.subtotal.toFixed(2)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-slate-500">{language === 'ar' ? 'الضريبة' : 'Tax'}</span><span className="font-semibold">{totals.totalTax.toFixed(2)}</span></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold dark:border-white/10"><span>{language === 'ar' ? 'الإجمالي النهائي' : 'Grand Total'}</span><span>{totals.grandTotal.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {language === 'ar'
                ? 'اضغط معاينة لمراجعة العرض قبل الحفظ'
                : 'Tap Preview to review the quotation before saving'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/app/dashboard/quotations')}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-dark-800"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-slate-900"
              >
                {saveMutation.isPending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {language === 'ar' ? 'معاينة' : 'Preview'}
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
        document={previewQuotation}
        tenant={tenant}
        language={language}
        documentType="quotation"
        templateId={selectedTemplateId}
        title={language === 'ar' ? 'معاينة عرض السعر' : 'Quotation preview'}
      />
    </div>
  )
}

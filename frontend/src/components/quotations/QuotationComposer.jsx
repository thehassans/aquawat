import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Save, Trash2, Upload, X, Store, HardHat, Plane, UtensilsCrossed, CalendarDays, UserRound, Sparkles, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { LETTERHEAD_TEMPLATE_ID, QUOTATION_TEMPLATE_IDS, resolveQuotationTemplateId } from '../../lib/invoiceTemplates'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage, isGccArabicMarket } from '../../lib/invoiceLanguage'
import { getAvailableUomOptions, getUomLabel } from '../../lib/uomOptions'
import { useLiveTranslation, useBilingualAddressFields, LineItemTranslator } from '../../lib/liveTranslation'
import InvoiceLivePreview from '../invoices/InvoiceLivePreview'
import DocumentPreSaveModal from '../invoices/DocumentPreSaveModal'
import InvoiceTemplateSelector from '../invoices/InvoiceTemplateSelector'
import Select from 'react-select'
import { useForm, useFieldArray } from 'react-hook-form'
import { normalizeProductType, productPickerLabel } from '../../lib/productType'
import ProductTypeToggle from '../ui/ProductTypeToggle'

const emptyLine = {
  productId: '',
  productName: '',
  productNameAr: '',
  productType: 'goods',
  description: '',
  descriptionAr: '',
  unitCode: 'PCE',
  quantity: 1,
  unitPrice: '',
  taxRate: 15,
  discount: 0,
  discountType: 'fixed',
}

const selectableContexts = ['trading', 'construction', 'travel_agency', 'restaurant']

const CONTEXT_META = {
  trading: { Icon: Store, descEn: 'Products & inventory quotes', descAr: 'عروض للمنتجات والمخزون', accent: 'from-emerald-500 to-teal-600' },
  construction: { Icon: HardHat, descEn: 'Project & service quotes', descAr: 'عروض المشاريع والخدمات', accent: 'from-amber-500 to-orange-600' },
  travel_agency: { Icon: Plane, descEn: 'Travel & ticket quotes', descAr: 'عروض السفر والتذاكر', accent: 'from-sky-500 to-blue-600' },
  restaurant: { Icon: UtensilsCrossed, descEn: 'F&B and catering quotes', descAr: 'عروض المطاعم والضيافة', accent: 'from-rose-500 to-red-600' },
}

const formatDateForInput = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const buildQuotationFormValues = ({ quotation, tenant, defaultBusinessContext }) => ({
  businessContext: quotation?.businessContext || defaultBusinessContext,
  pdfTemplateId: resolveQuotationTemplateId(quotation?.pdfTemplateId || LETTERHEAD_TEMPLATE_ID),
  issueDate: formatDateForInput(quotation?.issueDate) || formatDateForInput(new Date()),
  validUntil: formatDateForInput(quotation?.validUntil),
  transactionType: quotation?.transactionType || 'B2B',
  customerId: quotation?.customerId?._id || quotation?.customerId || '',
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
  buyer: quotation?.buyer || {},
  authorizedPersonName: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonName || '') : '',
  authorizedPersonNameAr: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonNameAr || '') : '',
  authorizedPersonDesignation: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonDesignation || '') : '',
  authorizedPersonDesignationAr: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonDesignationAr || '') : '',
  authorizedPersonSignature: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.authorizedPersonSignature || '') : '',
  stampImage: (quotation?.authorizedPersonName || quotation?.authorizedPersonNameAr || quotation?.authorizedPersonDesignation || quotation?.authorizedPersonSignature || quotation?.stampImage) ? (quotation?.stampImage || '') : '',
  lineItems: Array.isArray(quotation?.lineItems) && quotation.lineItems.length > 0
    ? quotation.lineItems.map((line) => ({
        ...emptyLine,
        ...line,
        productId: line?.productId?._id || line?.productId || '',
        productName: line?.productName || '',
        productNameAr: line?.productNameAr || '',
        productType: normalizeProductType(line?.productType),
        description: line?.description || '',
        descriptionAr: line?.descriptionAr || '',
        unitCode: line?.unitCode || 'PCE',
        quantity: Math.max(1, toNumber(line?.quantity, 1)),
        unitPrice: Math.max(0, toNumber(line?.unitPrice, 0)),
        taxRate: Math.max(0, toNumber(line?.taxRate, 15)),
        discount: Math.max(0, toNumber(line?.discount, 0)),
        discountType: line?.discountType || 'fixed',
      }))
    : [emptyLine],
})

export default function QuotationComposer({ quotationId = '', initialQuotation = null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isEdit = Boolean(quotationId)
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
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
  const [showNotesPanel, setShowNotesPanel] = useState(() => Boolean(String(initialQuotation?.notes || '').trim()))
  const [showTermsPanel, setShowTermsPanel] = useState(() => Boolean(String(initialQuotation?.termsAndConditions || '').trim()))
  const [showBankPanel, setShowBankPanel] = useState(() => Boolean(
    initialQuotation?.includeBankDetails ||
    initialQuotation?.bankDetails?.bankName ||
    initialQuotation?.bankDetails?.iban ||
    initialQuotation?.bankDetails?.accountNumber
  ))
  const showArabicFields = isGccArabicMarket(tenant)

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
    defaultValues: buildQuotationFormValues({
      quotation: initialQuotation,
      tenant,
      defaultBusinessContext,
    }),
  })

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

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const values = watch()
  const lineItems = Array.isArray(values?.lineItems) ? values.lineItems : []
  const businessContext = values?.businessContext || defaultBusinessContext
  const selectedTemplateId = resolveQuotationTemplateId(values?.pdfTemplateId || LETTERHEAD_TEMPLATE_ID)
  const isTradingContext = businessContext === 'trading'
  const [customerLookupId, setCustomerLookupId] = useState('')

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
    reset(buildQuotationFormValues({ quotation: initialQuotation, tenant, defaultBusinessContext }))
  }, [defaultBusinessContext, initialQuotation, isEdit, reset, tenant])

  useEffect(() => {
    if (isEdit && initialQuotation?._id) return
    setValue('businessContext', defaultBusinessContext)
  }, [defaultBusinessContext, initialQuotation?._id, isEdit, setValue])

  useEffect(() => {
    const customerId = initialQuotation?.customerId?._id || initialQuotation?.customerId || ''
    if (!customerId) return
    setCustomerLookupId(String(customerId))
  }, [initialQuotation?.customerId])

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((res) => res.data.products),
    enabled: isTradingContext,
  })

  const { data: customers } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => api.get('/customers', { params: { limit: 200 } }).then((res) => res.data.customers),
  })

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit
      ? api.put(`/quotations/${quotationId}`, payload, { timeout: 120000 })
      : api.post('/quotations', payload, { timeout: 120000 }),
    onSuccess: (res) => {
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
      toast.error(error?.response?.data?.error || error?.message || (language === 'ar' ? 'تعذر حفظ عرض السعر' : 'Failed to save quotation'))
    },
  })

  const onSelectProduct = (index, productId) => {
    const product = (products || []).find((item) => String(item._id) === String(productId))
    if (!product) return
    setValue(`lineItems.${index}.productId`, product._id)
    setValue(`lineItems.${index}.productName`, product.nameEn || '')
    setValue(`lineItems.${index}.productNameAr`, product.nameAr || product.nameEn || '')
    setValue(`lineItems.${index}.description`, product.descriptionEn || '')
    setValue(`lineItems.${index}.descriptionAr`, product.descriptionAr || '')
    setValue(`lineItems.${index}.unitCode`, product.unitOfMeasure || 'PCE')
    setValue(`lineItems.${index}.taxRate`, typeof product.taxRate === 'number' ? product.taxRate : 15)
    setValue(`lineItems.${index}.unitPrice`, typeof product.sellingPrice === 'number' ? product.sellingPrice : 0)
    setValue(`lineItems.${index}.productType`, normalizeProductType(product.productType))
  }

  const onSelectCustomer = (customerId) => {
    setCustomerLookupId(customerId)
    const customer = (customers || []).find((item) => String(item._id) === String(customerId))
    if (!customer) return
    setValue('customerId', customer._id)
    setValue('buyer.name', customer.name || '')
    setValue('buyer.nameAr', customer.nameAr || customer.name || '')
    setValue('buyer.vatNumber', customer.vatNumber || '')
    setValue('buyer.crNumber', customer.crNumber || '')
    setValue('buyer.contactPhone', customer.phone || customer.mobile || '')
    setValue('buyer.contactEmail', customer.email || '')
    setValue('buyer.address.city', customer.address?.city || '')
    setValue('buyer.address.district', customer.address?.district || '')
    setValue('buyer.address.street', customer.address?.street || '')
    setValue('buyer.address.postalCode', customer.address?.postalCode || '')
    setValue('buyer.address.country', customer.address?.country || 'SA')
    setValue('buyer.address.buildingNumber', customer.address?.buildingNumber || '')
    setValue('buyer.address.additionalNumber', customer.address?.additionalNumber || '')
  }

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [pendingPayload, setPendingPayload] = useState(null)

  const totals = calculateInvoiceSummary({ lineItems, invoiceDiscount: values?.invoiceDiscount })

  const buildPayload = (data) => {
    return {
      ...data,
      businessContext,
      pdfTemplateId: selectedTemplateId,
      transactionType: data?.transactionType === 'B2B' ? 'B2B' : 'B2C',
      issueDate: data?.issueDate ? new Date(data.issueDate) : new Date(),
      validUntil: data?.validUntil ? new Date(data.validUntil) : undefined,
      invoiceDiscount: Math.max(0, toNumber(data?.invoiceDiscount, 0)),
      lineItems: (data.lineItems || []).map((line, index) => {
        const summaryLine = totals.lines[index] || {}
        return {
          ...line,
          lineNumber: index + 1,
          productId: isTradingContext ? (line.productId || undefined) : undefined,
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

  const sectionShell = 'rounded-[1.5rem] border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-dark-800'

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 h-48 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_70%)]"
      />

      <div className="relative flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(isEdit ? `/app/dashboard/quotations/${quotationId}` : '/app/dashboard/quotations')}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            {language === 'ar' ? 'عروض الأسعار' : 'Quotations'}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {isEdit ? (language === 'ar' ? 'تعديل عرض السعر' : 'Edit Quotation') : (language === 'ar' ? 'عرض سعر جديد' : 'New Quotation')}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'عرض السعر على ورق رسمي: السجل التجاري والضريبة أعلى الصفحة، والعنوان والبريد والهاتف في التذييل. نزّل PDF قابلاً للتعديل في Foxit.'
              : 'Create a quotation on formal letterhead — C.R. and VAT on top, address, email and phone in the footer. Download an editable PDF for Foxit or Word.'}
          </p>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className={sectionShell}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                  {language === 'ar' ? 'البائع' : 'Seller'}
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'بيانات المنشأة' : 'Your company details'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'تُؤخذ تلقائياً من ملف الشركة' : 'Prefilled from your company profile'}
                </p>
              </div>
              {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
                <img
                  src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo}
                  alt="Tenant"
                  className="h-14 w-14 rounded-2xl object-contain bg-white p-1.5 shadow-md ring-1 ring-slate-200/80 dark:ring-white/15"
                />
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" dir="ltr">
              <div className={showArabicFields ? 'sm:col-span-2' : ''}>
                <p className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Legal name</span>
                  <span dir="rtl" className="font-medium text-slate-500">الاسم القانوني</span>
                </p>
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
                <p className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>VAT Number</span>
                  <span dir="rtl" className="font-medium text-slate-500">الرقم الضريبي</span>
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.vatNumber || '—'}</p>
              </div>
              <div>
                <p className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>CR Number</span>
                  <span dir="rtl" className="font-medium text-slate-500">السجل التجاري</span>
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.crNumber || '—'}</p>
              </div>
              <div>
                <p className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Phone</span>
                  <span dir="rtl" className="font-medium text-slate-500">الهاتف</span>
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.contactPhone || '—'}</p>
              </div>
              <div>
                <p className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Email</span>
                  <span dir="rtl" className="font-medium text-slate-500">البريد</span>
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.business?.contactEmail || '—'}</p>
              </div>
              <div className={showArabicFields ? 'sm:col-span-2' : ''}>
                <p className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Address</span>
                  <span dir="rtl" className="font-medium text-slate-500">العنوان</span>
                </p>
                <div className={`mt-1 grid gap-3 ${showArabicFields ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {[
                      tenant?.business?.address?.street,
                      tenant?.business?.address?.district,
                      tenant?.business?.address?.city,
                      tenant?.business?.address?.country || 'SA',
                    ].filter(Boolean).join(', ') || '—'}
                  </p>
                  {showArabicFields ? (
                    <p className="text-sm font-semibold text-slate-900 dark:text-white" dir="rtl">
                      {[
                        tenant?.business?.address?.streetAr,
                        tenant?.business?.address?.districtAr,
                        tenant?.business?.address?.cityAr,
                        tenant?.business?.address?.country || 'SA',
                      ].filter(Boolean).join('، ') || '—'}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className={sectionShell}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'الخطوة الأولى' : 'Step one'}
              </p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                {language === 'ar' ? 'سياق عرض السعر' : 'Quotation Context'}
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {tenantBusinessTypes.filter((type) => selectableContexts.includes(type)).map((type) => {
                const active = businessContext === type
                const meta = CONTEXT_META[type]
                const Icon = meta?.Icon || Store
                const labels = {
                  trading: language === 'ar' ? 'تجارة' : 'Trading',
                  construction: language === 'ar' ? 'مقاولات' : 'Construction',
                  travel_agency: language === 'ar' ? 'سفر' : 'Travel Agency',
                  restaurant: language === 'ar' ? 'مطعم' : 'Restaurant',
                }
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setValue('businessContext', type)}
                    className={`group flex items-start gap-3 rounded-2xl border p-4 text-start transition ${
                      active
                        ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-500/10 dark:ring-emerald-400/20'
                        : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 dark:border-white/10 dark:bg-dark-900/40 dark:hover:border-white/20'
                    }`}
                  >
                    <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta?.accent || 'from-emerald-500 to-teal-600'} text-white shadow-sm`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900 dark:text-white">{labels[type]}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {language === 'ar' ? meta?.descAr : meta?.descEn}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <input type="hidden" {...register('businessContext')} />
          </div>

          <div className={sectionShell}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'القالب' : 'Template'}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'تنسيق عرض السعر' : 'Quotation layout'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {language === 'ar'
                  ? 'اختر أساسي أو ورق رسمي. الورق الرسمي يطابق خطاب الشركة: السجل التجاري والضريبة في الترويسة، والعنوان والبريد والهاتف في التذييل.'
                  : 'Choose Essential or Letterhead. Letterhead matches the official company letter: C.R. # and VAT # in the header, address, email and phone in the footer.'}
              </p>
            </div>
            <InvoiceTemplateSelector
              language={language}
              value={selectedTemplateId}
              allowedIds={QUOTATION_TEMPLATE_IDS}
              tenant={tenant}
              onChange={(id) => setValue('pdfTemplateId', resolveQuotationTemplateId(id))}
              onLockedClick={() => navigate('/app/dashboard/app-store')}
            />
            <input type="hidden" {...register('pdfTemplateId')} />
          </div>

          <div className={sectionShell}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'التوقيت والنوع' : 'Timing & type'}
              </p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <CalendarDays className="h-4 w-4 text-emerald-500" />
                {language === 'ar' ? 'التواريخ ونوع العميل' : 'Dates & Customer Type'}
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="label">{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</label>
                  <input type="date" {...register('issueDate')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'صالح حتى' : 'Valid Until'}</label>
                  <input type="date" {...register('validUntil')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'نوع العميل' : 'Customer Type'}</label>
                  <select {...register('transactionType')} className="select">
                    <option value="B2B">{t('b2bInvoice')}</option>
                    <option value="B2C">{t('b2cInvoice')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className={sectionShell}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'العنوان' : 'Headline'}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'موضوع عرض السعر' : 'Quotation Subject'}
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" dir="ltr">
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Subject</span>
                  <span dir="rtl" className="font-medium text-slate-500">الموضوع</span>
                </label>
                <input {...register('subject')} className="input" placeholder={language === 'ar' ? 'مثال: أعمال استبدال ملفات الغاز...' : 'e.g. Coil replacement job in Ghazlan Power Plant'} />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Subject (Arabic)</span>
                  <span dir="rtl" className="font-medium text-slate-500">الموضوع بالعربية</span>
                </label>
                <input {...register('subjectAr')} className="input" dir="rtl" />
              </div>
            </div>
          </div>

          <div className={sectionShell}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'المشتري' : 'Buyer'}
              </p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <UserRound className="h-4 w-4 text-emerald-500" />
                {language === 'ar' ? 'بيانات العميل' : 'Who is this for?'}
              </h3>
            </div>
            <div className="mb-4">
              <label className="label">{language === 'ar' ? 'اختر عميل موجود' : 'Select Existing Customer'}</label>
              <select value={customerLookupId} onChange={(e) => onSelectCustomer(e.target.value)} className="select">
                <option value="">{language === 'ar' ? 'اختياري: اختر عميل' : 'Optional: Select customer'}</option>
                {(customers || []).map((item) => (
                  <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.name) : item.name}</option>
                ))}
              </select>
            </div>
            <input type="hidden" {...register('customerId')} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" dir="ltr">
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Name / Company</span>
                  <span dir="rtl" className="font-medium text-slate-500">الاسم / الشركة</span>
                </label>
                <input {...register('buyer.name', { required: values?.transactionType === 'B2B' })} className="input" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Name (Arabic)</span>
                  <span dir="rtl" className="font-medium text-slate-500">الاسم بالعربية</span>
                </label>
                <input {...register('buyer.nameAr')} className="input" dir="rtl" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>VAT Number</span>
                  <span dir="rtl" className="font-medium text-slate-500">الرقم الضريبي</span>
                </label>
                <input {...register('buyer.vatNumber')} className="input" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>CR Number</span>
                  <span dir="rtl" className="font-medium text-slate-500">السجل التجاري</span>
                </label>
                <input {...register('buyer.crNumber')} className="input" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Phone</span>
                  <span dir="rtl" className="font-medium text-slate-500">الهاتف</span>
                </label>
                <input {...register('buyer.contactPhone')} className="input" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Email</span>
                  <span dir="rtl" className="font-medium text-slate-500">البريد الإلكتروني</span>
                </label>
                <input type="email" {...register('buyer.contactEmail')} className="input" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>City</span>
                  <span dir="rtl" className="font-medium text-slate-500">المدينة</span>
                </label>
                <input {...register('buyer.address.city')} className="input" />
              </div>
              {showArabicFields ? (
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>City (Arabic)</span>
                    <span dir="rtl" className="font-medium text-slate-500">المدينة بالعربية</span>
                  </label>
                  <input {...register('buyer.address.cityAr')} className="input" dir="rtl" />
                </div>
              ) : null}
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>District</span>
                  <span dir="rtl" className="font-medium text-slate-500">الحي</span>
                </label>
                <input {...register('buyer.address.district')} className="input" />
              </div>
              {showArabicFields ? (
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>District (Arabic)</span>
                    <span dir="rtl" className="font-medium text-slate-500">الحي بالعربية</span>
                  </label>
                  <input {...register('buyer.address.districtAr')} className="input" dir="rtl" />
                </div>
              ) : null}
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Street</span>
                  <span dir="rtl" className="font-medium text-slate-500">الشارع</span>
                </label>
                <input {...register('buyer.address.street')} className="input" />
              </div>
              {showArabicFields ? (
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Street (Arabic)</span>
                    <span dir="rtl" className="font-medium text-slate-500">الشارع بالعربية</span>
                  </label>
                  <input {...register('buyer.address.streetAr')} className="input" dir="rtl" />
                </div>
              ) : null}
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Postal Code</span>
                  <span dir="rtl" className="font-medium text-slate-500">الرمز البريدي</span>
                </label>
                <input {...register('buyer.address.postalCode')} className="input" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Country</span>
                  <span dir="rtl" className="font-medium text-slate-500">الدولة</span>
                </label>
                <input {...register('buyer.address.country')} className="input" placeholder="SA" />
              </div>
            </div>
          </div>

          <div className={sectionShell}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {language === 'ar' ? 'التسعير' : 'Pricing'}
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'بنود عرض السعر' : 'Quotation Items'}
                </h3>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-dark-900 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                onClick={() => append(emptyLine)}
              >
                <Plus className="h-4 w-4" />
                {language === 'ar' ? 'إضافة بند' : 'Add Item'}
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const summaryLine = totals.lines[index] || { lineTotalWithTax: 0 }
                return (
                  <div
                    key={field.id}
                    className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 transition hover:border-emerald-300/80 hover:bg-emerald-50/30 dark:border-white/10 dark:bg-dark-900/50 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/5"
                  >
                    <LineItemTranslator index={index} control={control} watch={watch} setValue={setValue} />
                    <input type="hidden" {...register(`lineItems.${index}.productType`)} />
                    <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12" dir="ltr">
                      <div className={showArabicFields ? 'md:col-span-6' : 'md:col-span-12'}>
                        <div className="mb-1.5 flex items-center gap-2" dir="ltr">
                          <label className="label !mb-0 min-w-0 flex-1">
                            <span>Item Name *</span>
                            <span className="ms-1.5 font-medium text-gray-500" dir="rtl">اسم البند</span>
                          </label>
                          <ProductTypeToggle
                            value={watch(`lineItems.${index}.productType`)}
                            onChange={(next) => setValue(`lineItems.${index}.productType`, next, { shouldDirty: true, shouldTouch: true })}
                            language={language}
                          />
                        </div>
                        {isTradingContext ? (
                          <div className="mb-2">
                            <Select
                              className="react-select-container"
                              classNamePrefix="react-select"
                              value={
                                values?.lineItems?.[index]?.productId
                                  ? {
                                      value: values.lineItems[index].productId,
                                      label: productPickerLabel(
                                        (products || []).find((p) => p._id === values.lineItems[index].productId) || {},
                                        language
                                      )
                                    }
                                  : null
                              }
                              onChange={(option) => onSelectProduct(index, option ? option.value : '')}
                              options={(products || []).map((item) => ({
                                value: item._id,
                                label: productPickerLabel(item, language)
                              }))}
                              placeholder={language === 'ar' ? 'ابحث عن منتج...' : 'Search for a product...'}
                              isClearable
                              isSearchable
                            />
                          </div>
                        ) : null}
                        <input {...register(`lineItems.${index}.productName`)} className="input" placeholder={language === 'ar' ? 'اسم المنتج أو الخدمة' : 'Product or service name'} />
                      </div>
                      {showArabicFields ? (
                        <div className="md:col-span-6">
                          <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                            <span>Arabic name</span>
                            <span dir="rtl" className="font-medium text-gray-500">اسم البند بالعربية</span>
                          </label>
                          <input {...register(`lineItems.${index}.productNameAr`)} className="input" dir="rtl" placeholder="اسم المنتج أو الخدمة" />
                        </div>
                      ) : (
                        <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12" dir="ltr">
                      <div className="md:col-span-3">
                        <label className="label">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                        <textarea {...register(`lineItems.${index}.description`)} className="input min-h-[80px]" placeholder={language === 'ar' ? '• النقطة الأولى\n• النقطة الثانية' : '• First point\n• Second point'} />
                      </div>
                      <div className="md:col-span-3">
                        <label className="label">{language === 'ar' ? 'الوصف بالعربية' : 'Arabic Description'}</label>
                        <textarea {...register(`lineItems.${index}.descriptionAr`)} className="input min-h-[80px]" dir="rtl" placeholder={'• النقطة الأولى\n• النقطة الثانية'} />
                      </div>
                      <div className="md:col-span-3">
                        <label className="label">{language === 'ar' ? 'الوحدة' : 'UOM'}</label>
                        <Select
                          className="react-select-container w-full"
                          classNamePrefix="react-select"
                          value={
                            watch(`lineItems.${index}.unitCode`)
                              ? {
                                  value: watch(`lineItems.${index}.unitCode`),
                                  label: getUomLabel(watch(`lineItems.${index}.unitCode`), language)
                                }
                              : { value: 'PCE', label: getUomLabel('PCE', language) }
                          }
                          onChange={(option) => setValue(`lineItems.${index}.unitCode`, option ? option.value : 'PCE')}
                          options={getAvailableUomOptions(tenant).map((uom) => ({
                            value: uom.code,
                            label: language === 'ar' ? uom.labelAr : uom.labelEn
                          }))}
                          isSearchable
                        />
                        <input type="hidden" {...register(`lineItems.${index}.unitCode`)} />
                      </div>
                      <div className="md:col-span-1">
                        <label className="label">{language === 'ar' ? 'الكمية' : 'Qty'}</label>
                        <input type="number" min="1" step="1" {...register(`lineItems.${index}.quantity`)} className="input" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</label>
                        <input type="number" min="0" step="0.01" {...register(`lineItems.${index}.unitPrice`)} className="input" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      <div className="md:col-span-3">
                        <label className="label">{language === 'ar' ? 'خصم البند' : 'Line Discount'}</label>
                        <input type="number" min="0" step="0.01" {...register(`lineItems.${index}.discount`)} className="input" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="label">{language === 'ar' ? 'نوع الخصم' : 'Discount Type'}</label>
                        <select {...register(`lineItems.${index}.discountType`)} className="select">
                          <option value="fixed">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                          <option value="percentage">{language === 'ar' ? 'نسبة مئوية' : 'Percentage'}</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">{language === 'ar' ? 'الضريبة %' : 'Tax %'}</label>
                        <input type="number" min="0" step="0.01" {...register(`lineItems.${index}.taxRate`)} className="input" />
                      </div>
                      <div className="md:col-span-4 flex items-end">
                        <button
                          type="button"
                          className="btn btn-ghost text-sm"
                          onClick={() => append({ ...emptyLine, lineNumber: fields.length + 1 })}
                        >
                          <Plus className="w-4 h-4" />
                          {language === 'ar' ? 'تكرار البند' : 'Duplicate Item'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/70 pt-3 dark:border-white/10">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {language === 'ar' ? 'إجمالي السطر' : 'Line Total'}: <span className="font-semibold text-slate-900 dark:text-white">{Number(summaryLine.lineTotalWithTax || 0).toFixed(2)}</span>
                      </p>
                      <button type="button" className="btn btn-ghost text-red-600" onClick={() => remove(index)} disabled={fields.length === 1}>
                        <Trash2 className="w-4 h-4" />
                        {language === 'ar' ? 'حذف' : 'Remove'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className={sectionShell}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {language === 'ar' ? 'معلومات إضافية' : 'Additional Information'}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {[
                { id: 'signature', active: showAuthorizedPerson, labelEn: '+ Add Signature', labelAr: '+ إضافة توقيع', onClick: () => handleToggleAuthorizedPerson(!showAuthorizedPerson) },
                { id: 'terms', active: showTermsPanel, labelEn: '+ Add Terms & Conditions', labelAr: '+ إضافة الشروط والأحكام', onClick: () => setShowTermsPanel((v) => !v) },
                { id: 'notes', active: showNotesPanel, labelEn: '+ Add Notes', labelAr: '+ إضافة ملاحظات', onClick: () => setShowNotesPanel((v) => !v) },
                { id: 'bank', active: showBankPanel, labelEn: '+ Add Bank Details', labelAr: '+ إضافة بيانات البنك', onClick: () => handleToggleBankDetails(!showBankPanel) },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={pill.onClick}
                  className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                    pill.active
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 dark:border-white/15 dark:bg-dark-900 dark:text-slate-100'
                  }`}
                >
                  {language === 'ar' ? pill.labelAr : pill.labelEn}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {showAuthorizedPerson && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
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
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="label">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</label>
                    <button type="button" onClick={() => { setShowTermsPanel(false); setValue('termsAndConditions', '') }} className="text-xs font-semibold text-slate-500 hover:text-red-600">{language === 'ar' ? 'إزالة' : 'Remove'}</button>
                  </div>
                  <textarea {...register('termsAndConditions')} rows="5" className="input min-h-[140px]" placeholder={language === 'ar' ? 'أدخل الشروط والأحكام...' : 'Enter terms and conditions...'} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showNotesPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                    <button type="button" onClick={() => { setShowNotesPanel(false); setValue('notes', '') }} className="text-xs font-semibold text-slate-500 hover:text-red-600">{language === 'ar' ? 'إزالة' : 'Remove'}</button>
                  </div>
                  <textarea {...register('notes')} rows="4" className="input min-h-[120px]" />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showBankPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden border-t border-slate-100 pt-5 dark:border-white/10">
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(5,150,105,0.65)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saveMutation.isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isEdit ? (language === 'ar' ? 'معاينة وتعديل عرض السعر' : 'Preview & Update Quotation') : (language === 'ar' ? 'معاينة وحفظ عرض السعر' : 'Preview & Save Quotation')}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className={`${sectionShell} !p-4`}>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Eye className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'المعاينة المباشرة' : 'Live Preview'}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'تتحدث المعاينة فوراً مع تغيير القالب والبيانات.' : 'Preview updates instantly as you change the template and form data.'}
                </p>
              </div>
            </div>
          </div>
          <InvoiceLivePreview invoice={previewQuotation} tenant={tenant} language={language} templateId={selectedTemplateId} bilingual={resolveInvoiceBilingual(tenant, true)} secondaryLanguage={getInvoiceSecondaryLanguage(tenant) || undefined} documentType="quotation" />
        </div>
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
        title={language === 'ar' ? 'معاينة عرض السعر قبل الحفظ' : 'Quotation Live Preview'}
      />
    </div>
  )
}

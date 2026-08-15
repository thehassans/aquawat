import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Save, Trash2, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../ui/Money'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { isGccArabicMarket } from '../../lib/invoiceLanguage'
import { getAvailableUomOptions, getUomLabel } from '../../lib/uomOptions'
import { useLiveTranslation, useBilingualAddressFields, LineItemTranslator } from '../../lib/liveTranslation'
import InvoiceLivePreview from './InvoiceLivePreview'
import InvoiceTemplateSelector from './InvoiceTemplateSelector'
import TravelInvoiceFields from './TravelInvoiceFields'
import ZatcaPreValidationPanel from '../zatca/ZatcaPreValidationPanel'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { formPaymentStatusFromInvoice, applyFormPaymentToPayload } from '../../lib/invoicePaymentTerms'
import { normalizeProductType, productPickerLabel } from '../../lib/productType'
import ProductTypeToggle from '../ui/ProductTypeToggle'

const emptyLine = { productId: '', productName: '', productNameAr: '', productType: 'goods', unitCode: 'PCE', quantity: 1, unitPrice: '', taxRate: 15 }
const purchaseContexts = ['trading', 'construction', 'travel_agency', 'furniture', 'furniture_shop']

const buildPurchaseInvoiceFormValues = ({ invoice, tenant, defaultBusinessContext, hasTravel }) => ({
  businessContext: invoice?.businessContext || defaultBusinessContext,
  invoiceSubtype: invoice?.invoiceSubtype || (hasTravel ? 'travel_ticket' : 'standard'),
  pdfTemplateId: invoice?.pdfTemplateId || getInvoiceTemplateId(tenant, invoice?.businessContext || defaultBusinessContext),
  transactionType: invoice?.transactionType || 'B2B',
  invoiceTypeCode: invoice?.invoiceTypeCode || (invoice?.transactionType === 'B2C' ? '0200000' : '0100000'),
  warehouseId: invoice?.warehouseId || '',
  supplierId: invoice?.supplierId || '',
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
  notes: invoice?.notes || '',
  lineItems: Array.isArray(invoice?.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems.map((line) => ({
        ...emptyLine,
        ...line,
        productId: line?.productId || '',
        productName: line?.productName || '',
        productNameAr: line?.productNameAr || '',
        productType: normalizeProductType(line?.productType),
        unitCode: line?.unitCode || 'PCE',
        quantity: Math.max(0.0001, toNumber(line?.quantity, 1)),
        unitPrice: Math.max(0, toNumber(line?.unitPrice, 0)),
        taxRate: Math.max(0, toNumber(line?.taxRate, 15)),
      }))
    : [emptyLine],
})

export default function InvoicePurchaseComposer({ invoiceId = '', initialInvoice = null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [transactionType, setTransactionType] = useState('B2B')
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
  const lineItems = Array.isArray(values.lineItems) ? values.lineItems : []
  const businessContext = values.businessContext || defaultBusinessContext
  const invoiceSubtype = values.invoiceSubtype || 'standard'
  const selectedTemplateId = Number(values.pdfTemplateId || getInvoiceTemplateId(tenant, businessContext))
  const selectedWarehouseId = values.warehouseId || ''
  const isTradingContext = businessContext === 'trading'
  const isTravelContext = businessContext === 'travel_agency'
  const showArabicFields = isGccArabicMarket(tenant)
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

  const onSelectSupplier = (supplierId) => {
    const supplier = (suppliers || []).find((item) => item._id === supplierId)
    if (!supplier) return
    setValue('supplierId', supplier._id)
    setValue('seller.name', supplier.nameEn)
    setValue('seller.nameAr', supplier.nameAr || supplier.nameEn)
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
    setValue('seller.address.country', supplier.address?.country || 'SA')
    setValue('seller.address.buildingNumber', supplier.address?.buildingNumber || '')
    setValue('seller.address.additionalNumber', supplier.address?.additionalNumber || '')
  }

  const summary = useMemo(
    () => calculateInvoiceSummary({
      lineItems,
      invoiceDiscount: toNumber(values.invoiceDiscount, 0),
    }),
    [lineItems, values.invoiceDiscount]
  )
  const totals = summary
  const summarizedLines = summary.lines || []

  const onSubmit = (data) => {
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
      lineItems: (data.lineItems || []).map((line, index) => {
        const calc = summarizedLines[index] || {}
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
      subtotal: totals.subtotal,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
    }
    applyFormPaymentToPayload(payload, {
      paymentStatus: data?.paymentStatus,
      paidAmount: data?.paidAmount,
      grandTotal: totals.grandTotal,
    })

    if (!isTradingContext) {
      delete payload.warehouseId
      delete payload.supplierId
    } else {
      if (!payload.warehouseId) delete payload.warehouseId
      if (!payload.supplierId) delete payload.supplierId
    }
    if (invoiceSubtype !== 'travel_ticket') delete payload.travelDetails
    payload.authorizedPersonName = showAuthorizedPerson ? (data?.authorizedPersonName || '') : ''
    payload.authorizedPersonNameAr = showAuthorizedPerson ? (data?.authorizedPersonNameAr || '') : ''
    payload.authorizedPersonDesignation = showAuthorizedPerson ? (data?.authorizedPersonDesignation || '') : ''
    payload.authorizedPersonDesignationAr = showAuthorizedPerson ? (data?.authorizedPersonDesignationAr || '') : ''
    payload.authorizedPersonSignature = showAuthorizedPerson ? (data?.authorizedPersonSignature || '') : ''
    payload.stampImage = showAuthorizedPerson ? (data?.stampImage || '') : ''
    saveMutation.mutate(payload)
  }

  const previewInvoice = {
    ...values,
    authorizedPersonName: showAuthorizedPerson ? (values?.authorizedPersonName || '') : '',
    authorizedPersonNameAr: showAuthorizedPerson ? (values?.authorizedPersonNameAr || '') : '',
    authorizedPersonDesignation: showAuthorizedPerson ? (values?.authorizedPersonDesignation || '') : '',
    authorizedPersonDesignationAr: showAuthorizedPerson ? (values?.authorizedPersonDesignationAr || '') : '',
    authorizedPersonSignature: showAuthorizedPerson ? (values?.authorizedPersonSignature || '') : '',
    stampImage: showAuthorizedPerson ? (values?.stampImage || '') : '',
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
                    <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
                    <select {...register('warehouseId')} className="select"><option value="">{language === 'ar' ? 'بدون تحديد حالياً' : 'No warehouse selected yet'}</option>{(warehouses || []).map((item) => <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.nameEn) : item.nameEn}</option>)}</select>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn btn-secondary" onClick={() => setValue('warehouseId', '')} disabled={!selectedWarehouseId}>{language === 'ar' ? 'إلغاء التحديد' : 'Clear'}</button>
                      <button type="button" className="btn btn-action-dark" onClick={() => navigate(`/app/dashboard/warehouses/new?returnTo=${encodeURIComponent('/app/dashboard/invoices/new/purchase')}`)}>{language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}</button>
                    </div>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'المورد' : 'Supplier'} *</label>
                    <select {...register('supplierId', { required: isTradingContext, onChange: (e) => onSelectSupplier(e.target.value) })} className="select"><option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>{(suppliers || []).map((item) => <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.nameEn) : item.nameEn}</option>)}</select>
                  </div>
                </>
              )}
            </div>
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
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Name / Company</span>
                    <span dir="rtl" className="font-medium text-gray-500">الاسم / الشركة</span>
                  </label>
                  <input {...register('seller.name', { required: true })} className="input" />
                </div>
                {showArabicFields ? (
                  <div>
                    <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                      <span>Name (Arabic)</span>
                      <span dir="rtl" className="font-medium text-gray-500">الاسم بالعربية</span>
                    </label>
                    <input {...register('seller.nameAr')} className="input" dir="rtl" />
                  </div>
                ) : (
                  <input type="hidden" {...register('seller.nameAr')} />
                )}
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>VAT Number</span>
                    <span dir="rtl" className="font-medium text-gray-500">الرقم الضريبي</span>
                  </label>
                  <input {...register('seller.vatNumber')} className="input" />
                </div>
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>CR Number</span>
                    <span dir="rtl" className="font-medium text-gray-500">السجل التجاري</span>
                  </label>
                  <input {...register('seller.crNumber')} className="input" />
                </div>
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Phone Number</span>
                    <span dir="rtl" className="font-medium text-gray-500">رقم الهاتف</span>
                  </label>
                  <input {...register('seller.contactPhone')} className="input" />
                </div>
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Email</span>
                    <span dir="rtl" className="font-medium text-gray-500">البريد الإلكتروني</span>
                  </label>
                  <input type="email" {...register('seller.contactEmail')} className="input" />
                </div>
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>City</span>
                    <span dir="rtl" className="font-medium text-gray-500">المدينة</span>
                  </label>
                  <input {...register('seller.address.city')} className="input" />
                </div>
                {showArabicFields ? (
                  <div>
                    <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                      <span>City (Arabic)</span>
                      <span dir="rtl" className="font-medium text-gray-500">المدينة بالعربية</span>
                    </label>
                    <input {...register('seller.address.cityAr')} className="input" dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>District</span>
                    <span dir="rtl" className="font-medium text-gray-500">الحي</span>
                  </label>
                  <input {...register('seller.address.district')} className="input" />
                </div>
                {showArabicFields ? (
                  <div>
                    <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                      <span>District (Arabic)</span>
                      <span dir="rtl" className="font-medium text-gray-500">الحي بالعربية</span>
                    </label>
                    <input {...register('seller.address.districtAr')} className="input" dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Street</span>
                    <span dir="rtl" className="font-medium text-gray-500">الشارع</span>
                  </label>
                  <input {...register('seller.address.street')} className="input" />
                </div>
                {showArabicFields ? (
                  <div>
                    <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                      <span>Street (Arabic)</span>
                      <span dir="rtl" className="font-medium text-gray-500">الشارع بالعربية</span>
                    </label>
                    <input {...register('seller.address.streetAr')} className="input" dir="rtl" />
                  </div>
                ) : null}
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Postal Code</span>
                    <span dir="rtl" className="font-medium text-gray-500">الرمز البريدي</span>
                  </label>
                  <input {...register('seller.address.postalCode')} className="input" />
                </div>
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Country</span>
                    <span dir="rtl" className="font-medium text-gray-500">الدولة</span>
                  </label>
                  <input {...register('seller.address.country')} className="input" placeholder="SA" />
                </div>
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Building Number</span>
                    <span dir="rtl" className="font-medium text-gray-500">رقم المبنى</span>
                  </label>
                  <input {...register('seller.address.buildingNumber')} className="input" />
                </div>
                <div>
                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                    <span>Additional Number</span>
                    <span dir="rtl" className="font-medium text-gray-500">الرقم الإضافي</span>
                  </label>
                  <input {...register('seller.address.additionalNumber')} className="input" />
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'بنود الفاتورة' : 'Line Items'}</h3><button type="button" onClick={() => append({ ...emptyLine })} className="btn btn-secondary"><Plus className="w-4 h-4" />{t('add')}</button></div>
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
                      <label htmlFor={`unit-${index}`} className="label">{language === 'ar' ? 'الوحدة' : 'UOM'}</label>
                      <select
                        {...register(`lineItems.${index}.unitCode`)}
                        className="select"
                      >
                        {getAvailableUomOptions(tenant).map((uom) => (
                          <option key={uom.code} value={uom.code}>
                            {language === 'ar' ? uom.labelAr : uom.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label htmlFor={`qty-${index}`} className="label">{t('quantity')}</label>
                      <input id={`qty-${index}`} type="number" min="0.0001" step="any" {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0.0001 })} className="input" />
                    </div>
                    <div className="md:col-span-2"><label htmlFor={`price-${index}`} className="label">{t('unitPrice')}</label><input id={`price-${index}`} type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })} className="input" /></div>
                    <div className="md:col-span-2"><label className="label">{t('tax')} %</label><select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className="select"><option value={15}>15%</option><option value={0}>0%</option></select></div>
                    <div className="md:col-span-2 flex items-center gap-2"><div className="flex-1 text-end"><p className="mb-1 text-xs text-gray-500">{t('total')}</p><p className="font-semibold"><Money value={summarizedLines[index]?.lineTotalWithTax} /></p></div>{fields.length > 1 && <button type="button" onClick={() => remove(index)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {language === 'ar' ? 'الموثّق / المفوّض والختم' : 'Authorized Person & Stamp'}
                  </h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    showAuthorizedPerson 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {showAuthorizedPerson ? (language === 'ar' ? 'مفعّل' : 'Active') : (language === 'ar' ? 'معطّل' : 'Disabled')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {language === 'ar' 
                    ? 'إضافة المفوض بالتوقيع والختم الرسمي على مستند فاتورة الشراء' 
                    : 'Include signatory name, designation, signature and official stamp on document.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showAuthorizedPerson}
                onClick={() => handleToggleAuthorizedPerson(!showAuthorizedPerson)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showAuthorizedPerson ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showAuthorizedPerson ? (language === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <AnimatePresence>
              {showAuthorizedPerson && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pt-5 border-t border-gray-100 dark:border-gray-800 mt-4"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">{language === 'ar' ? 'الاسم' : 'Name'}</label>
                      <input {...register('authorizedPersonName')} className="input" placeholder={language === 'ar' ? 'مثال: Arthur Michael' : 'e.g. Arthur Michael'} />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                      <input {...register('authorizedPersonNameAr')} className="input" dir="rtl" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'المسمى الوظيفي' : 'Designation'}</label>
                      <input {...register('authorizedPersonDesignation')} className="input" placeholder={language === 'ar' ? 'مثال: Coordinator' : 'e.g. Coordinator'} />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'المسمى الوظيفي بالعربية' : 'Arabic Designation'}</label>
                      <input {...register('authorizedPersonDesignationAr')} className="input" dir="rtl" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'التوقيع' : 'Signature'}</label>
                      <div className="flex items-center gap-3">
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
                      <div className="flex items-center gap-3">
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
          </div>

          <div className="card p-6">
            <div><label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label><textarea {...register('notes')} className="input" rows={3} /></div>
            <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
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
              <div className="mb-4">
                <ZatcaPreValidationPanel invoiceData={previewInvoice} language={language} />
              </div>
              <div className="flex gap-3"><button type="button" onClick={() => navigate(isEdit ? `/app/dashboard/invoices/${invoiceId}` : '/app/dashboard/invoices/new')} className="btn btn-secondary">{t('cancel')}</button><button type="submit" disabled={saveMutation.isPending} className="btn btn-action-dark">{saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save className="w-4 h-4" />{isEdit ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : t('save')}</>}</button></div>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-4"><h3 className="text-base font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'المعاينة المباشرة' : 'Live Preview'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تعرض المعاينة شكل الطباعة النهائي تقريباً.' : 'The preview closely reflects the final printed layout.'}</p></div>
          <InvoiceLivePreview invoice={previewInvoice} tenant={tenant} language={language} templateId={selectedTemplateId} bilingual={previewInvoice?.invoiceSubtype === 'travel_ticket' || ['travel_agency', 'trading', 'construction'].includes(previewInvoice?.businessContext)} />
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm } from 'react-hook-form'
import { ArrowLeft, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { useLiveTranslation, LineItemTranslator } from '../../lib/liveTranslation'
import InvoiceLivePreview from '../invoices/InvoiceLivePreview'
import InvoiceTemplateSelector from '../invoices/InvoiceTemplateSelector'
import Select from 'react-select'
import { ZATCA_UOM_OPTIONS } from '../../lib/uomOptions'
const emptyLine = {
  productId: '',
  productName: '',
  productNameAr: '',
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

const formatDateForInput = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const buildQuotationFormValues = ({ quotation, tenant, defaultBusinessContext }) => ({
  businessContext: quotation?.businessContext || defaultBusinessContext,
  pdfTemplateId: quotation?.pdfTemplateId || getInvoiceTemplateId(tenant, quotation?.businessContext || defaultBusinessContext),
  issueDate: formatDateForInput(quotation?.issueDate) || formatDateForInput(new Date()),
  validUntil: formatDateForInput(quotation?.validUntil),
  transactionType: quotation?.transactionType || 'B2C',
  customerId: quotation?.customerId?._id || quotation?.customerId || '',
  subject: quotation?.subject || '',
  subjectAr: quotation?.subjectAr || '',
  notes: quotation?.notes || '',
  termsAndConditions: quotation?.termsAndConditions || '',
  invoiceDiscount: Math.max(0, toNumber(quotation?.invoiceDiscount, 0)),
  buyer: quotation?.buyer || {},
  authorizedPersonName: quotation?.authorizedPersonName || '',
  authorizedPersonNameAr: quotation?.authorizedPersonNameAr || '',
  authorizedPersonDesignation: quotation?.authorizedPersonDesignation || '',
  authorizedPersonDesignationAr: quotation?.authorizedPersonDesignationAr || '',
  authorizedPersonDesignationAr: quotation?.authorizedPersonDesignationAr || '',
  authorizedPersonSignature: quotation?.authorizedPersonSignature || '',
  stampImage: quotation?.stampImage || '',
  lineItems: Array.isArray(quotation?.lineItems) && quotation.lineItems.length > 0
    ? quotation.lineItems.map((line) => ({
        ...emptyLine,
        ...line,
        productId: line?.productId?._id || line?.productId || '',
        productName: line?.productName || '',
        productNameAr: line?.productNameAr || '',
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

  const defaultBusinessContext = useMemo(() => {
    const primary = getPrimaryBusinessType(tenant)
    if (selectableContexts.includes(primary)) return primary
    return tenantBusinessTypes.find((type) => selectableContexts.includes(type)) || 'trading'
  }, [tenant, tenantBusinessTypes])

  const { register, control, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: buildQuotationFormValues({
      quotation: initialQuotation,
      tenant,
      defaultBusinessContext,
    }),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const values = watch()
  const lineItems = Array.isArray(values?.lineItems) ? values.lineItems : []
  const businessContext = values?.businessContext || defaultBusinessContext
  const selectedTemplateId = Number(values?.pdfTemplateId || getInvoiceTemplateId(tenant, businessContext))
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

  const totals = calculateInvoiceSummary({ lineItems, invoiceDiscount: values?.invoiceDiscount })

  const onSubmit = (data) => {
    const payload = {
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
      authorizedPersonName: data?.authorizedPersonName || '',
      authorizedPersonNameAr: data?.authorizedPersonNameAr || '',
      authorizedPersonDesignation: data?.authorizedPersonDesignation || '',
      authorizedPersonDesignationAr: data?.authorizedPersonDesignationAr || '',
      authorizedPersonSignature: data?.authorizedPersonSignature || '',
      stampImage: data?.stampImage || '',
      status: initialQuotation?.status || 'draft',
    }

    saveMutation.mutate(payload)
  }

  const previewQuotation = {
    ...values,
    quotationNumber: initialQuotation?.quotationNumber || 'PREVIEW-1234',
    issueDate: values?.issueDate ? new Date(values.issueDate) : new Date(),
    validUntil: values?.validUntil ? new Date(values.validUntil) : undefined,
    ...totals,
    seller: {
      name: tenant?.business?.legalNameEn,
      nameAr: tenant?.business?.legalNameAr,
      vatNumber: tenant?.business?.vatNumber,
      address: tenant?.business?.address,
      contactPhone: tenant?.business?.contactPhone,
      contactEmail: tenant?.business?.contactEmail,
    },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(isEdit ? `/app/dashboard/quotations/${quotationId}` : '/app/dashboard/quotations')} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? (language === 'ar' ? 'تعديل عرض السعر' : 'Edit Quotation') : (language === 'ar' ? 'عرض سعر جديد' : 'New Quotation')}
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {language === 'ar'
              ? 'أنشئ عرض سعر مبسط بسرعة مع نموذج واحد ثابت للبنود والتسعير.'
              : 'Create a streamlined quotation quickly with one fixed template for pricing and line items.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'سياق عرض السعر' : 'Quotation Context'}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {tenantBusinessTypes.filter((type) => selectableContexts.includes(type)).map((type) => {
                const active = businessContext === type
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
                    className={`rounded-2xl border p-4 text-start ${active ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                  >
                    <p className="font-semibold text-gray-900 dark:text-white">{labels[type]}</p>
                  </button>
                )
              })}
            </div>
            <input type="hidden" {...register('businessContext')} />
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'التواريخ ونوع العميل' : 'Dates & Customer Type'}</h3>
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
                    <option value="B2C">{t('b2cInvoice')}</option>
                    <option value="B2B">{t('b2bInvoice')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'موضوع عرض السعر' : 'Quotation Subject'}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">{language === 'ar' ? 'الموضوع' : 'Subject'}</label>
                <input {...register('subject')} className="input" placeholder={language === 'ar' ? 'مثال: أعمال استبدال ملفات الغاز...' : 'e.g. Coil replacement job in Ghazlan Power Plant'} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الموضوع بالعربية' : 'Arabic Subject'}</label>
                <input {...register('subjectAr')} className="input" dir="rtl" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'بيانات العميل' : 'Customer Details'}</h3>
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">{language === 'ar' ? 'الاسم / الشركة' : 'Name / Company'}</label>
                <input {...register('buyer.name', { required: values?.transactionType === 'B2B' })} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                <input {...register('buyer.nameAr')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}</label>
                <input {...register('buyer.vatNumber')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'السجل التجاري' : 'CR Number'}</label>
                <input {...register('buyer.crNumber')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
                <input {...register('buyer.contactPhone')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                <input type="email" {...register('buyer.contactEmail')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'المدينة' : 'City'}</label>
                <input {...register('buyer.address.city')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الحي' : 'District'}</label>
                <input {...register('buyer.address.district')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الشارع' : 'Street'}</label>
                <input {...register('buyer.address.street')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label>
                <input {...register('buyer.address.postalCode')} className="input" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الدولة' : 'Country'}</label>
                <input {...register('buyer.address.country')} className="input" placeholder="SA" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'بنود عرض السعر' : 'Quotation Items'}</h3>
              <button type="button" className="btn btn-secondary" onClick={() => append(emptyLine)}>
                <Plus className="w-4 h-4" />
                {language === 'ar' ? 'إضافة بند' : 'Add Item'}
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const summaryLine = totals.lines[index] || { lineTotalWithTax: 0 }
                return (
                  <div key={field.id} className="rounded-2xl border border-gray-200 dark:border-dark-600 p-4 space-y-4">
                    <LineItemTranslator index={index} control={control} watch={watch} setValue={setValue} />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      {isTradingContext ? (
                        <div className="md:col-span-4">
                          <label className="label">{language === 'ar' ? 'المنتج' : 'Product'}</label>
                          <select className="select" value={values?.lineItems?.[index]?.productId || ''} onChange={(e) => onSelectProduct(index, e.target.value)}>
                            <option value="">{language === 'ar' ? 'اختر منتج' : 'Select product'}</option>
                            {(products || []).map((item) => (
                              <option key={item._id} value={item._id}>{language === 'ar' ? (item.nameAr || item.nameEn) : item.nameEn}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <div className={isTradingContext ? 'md:col-span-4' : 'md:col-span-6'}>
                        <label className="label">{language === 'ar' ? 'اسم البند' : 'Item Name'}</label>
                        <input {...register(`lineItems.${index}.productName`)} className="input" />
                      </div>
                      <div className={isTradingContext ? 'md:col-span-4' : 'md:col-span-6'}>
                        <label className="label">{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                        <input {...register(`lineItems.${index}.productNameAr`)} className="input" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
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
                          inputId={`unit-${index}`}
                          options={ZATCA_UOM_OPTIONS.map(u => ({ value: u.code, label: language === 'ar' ? u.labelAr : u.labelEn }))}
                          value={ZATCA_UOM_OPTIONS.find(u => u.code === watch(`lineItems.${index}.unitCode`)) ? { value: watch(`lineItems.${index}.unitCode`), label: language === 'ar' ? ZATCA_UOM_OPTIONS.find(u => u.code === watch(`lineItems.${index}.unitCode`))?.labelAr : ZATCA_UOM_OPTIONS.find(u => u.code === watch(`lineItems.${index}.unitCode`))?.labelEn } : null}
                          onChange={(selected) => setValue(`lineItems.${index}.unitCode`, selected?.value || 'PCE')}
                          isSearchable
                          menuPortalTarget={document.body}
                          styles={{
                            menuPortal: base => ({ ...base, zIndex: 9999 }),
                            control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e5e7eb', padding: '0.125rem', minHeight: '42px' })
                          }}
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

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {language === 'ar' ? 'إجمالي السطر' : 'Line Total'}: <span className="font-semibold text-gray-900 dark:text-white">{Number(summaryLine.lineTotalWithTax || 0).toFixed(2)}</span>
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

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'الموثّق / المفوّض' : 'Authorized Person'}</h3>
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
                  <input type="file" accept="image/*" className="hidden" id="quotation-signature-upload" onChange={(e) => {
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
                  <label htmlFor="quotation-signature-upload" className="btn btn-secondary cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {language === 'ar' ? 'رفع توقيع' : 'Upload Signature'}
                  </label>
                  {values?.authorizedPersonSignature ? (
                    <div className="relative">
                      <img src={values.authorizedPersonSignature} alt="Signature" className="h-16 max-w-[200px] object-contain border rounded-lg p-1 bg-white" />
                      <button type="button" onClick={() => setValue('authorizedPersonSignature', '')} className="absolute -top-2 -end-2 p-1 bg-red-100 text-red-600 rounded-full">
                        <X className="w-3 h-3" />
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
                  <input type="file" accept="image/*" className="hidden" id="quotation-stamp-upload" onChange={(e) => {
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
                  <label htmlFor="quotation-stamp-upload" className="btn btn-secondary cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {language === 'ar' ? 'رفع ختم' : 'Upload Stamp'}
                  </label>
                  {values?.stampImage ? (
                    <div className="relative">
                      <img src={values.stampImage} alt="Stamp" className="h-16 max-w-[200px] object-contain border rounded-lg p-1 bg-white" />
                      <button type="button" onClick={() => setValue('stampImage', '')} className="absolute -top-2 -end-2 p-1 bg-red-100 text-red-600 rounded-full">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">{language === 'ar' ? 'لم يتم رفع ختم' : 'No stamp uploaded'}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">{language === 'ar' ? 'يجب أن يكون الختم بخلفية شفافة.' : 'Stamp image should have a transparent background.'}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'الملاحظات والملخص' : 'Notes & Summary'}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                <textarea {...register('notes')} rows="5" className="input min-h-[132px]" />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">{language === 'ar' ? 'خصم المستند' : 'Document Discount'}</label>
                  <input type="number" min="0" step="0.01" {...register('invoiceDiscount')} className="input" />
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-dark-600 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{language === 'ar' ? 'الإجمالي الفرعي' : 'Subtotal'}</span>
                    <span className="font-semibold">{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{language === 'ar' ? 'إجمالي الخصم' : 'Total Discount'}</span>
                    <span className="font-semibold">{totals.totalDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{language === 'ar' ? 'الضريبة' : 'Tax'}</span>
                    <span className="font-semibold">{totals.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 dark:border-dark-600 pt-3 text-base font-bold">
                    <span>{language === 'ar' ? 'الإجمالي النهائي' : 'Grand Total'}</span>
                    <span>{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</h3>
            <textarea {...register('termsAndConditions')} rows="6" className="input min-h-[160px]" placeholder={language === 'ar' ? 'أدخل الشروط والأحكام...' : 'Enter terms and conditions...'} />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEdit ? (language === 'ar' ? 'تحديث عرض السعر' : 'Update Quotation') : (language === 'ar' ? 'حفظ عرض السعر' : 'Save Quotation')}
            </button>
          </div>
        </form>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="card p-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'المعاينة المباشرة' : 'Live Preview'}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تتحدث المعاينة فوراً مع تغيير القالب والبيانات.' : 'Preview updates instantly as you change the template and form data.'}</p>
          </div>
          <InvoiceLivePreview invoice={previewQuotation} tenant={tenant} language={language} templateId={selectedTemplateId} documentType="quotation" />
        </div>
      </div>
    </div>
  )
}

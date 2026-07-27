import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../ui/Money'
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../../lib/businessTypes'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { useLiveTranslation, LineItemTranslator } from '../../lib/liveTranslation'
import InvoiceLivePreview from './InvoiceLivePreview'
import InvoiceTemplateSelector from './InvoiceTemplateSelector'
import TravelInvoiceFields from './TravelInvoiceFields'
import ZatcaPreValidationPanel from '../zatca/ZatcaPreValidationPanel'
import SmartInvoiceModal from '../../components/invoices/SmartInvoiceModal'
import BulkInvoiceModal from '../../components/invoices/BulkInvoiceModal'
import { ScanLine, UploadCloud } from 'lucide-react'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'

const emptyLine = { productId: '', productName: '', productNameAr: '', unitCode: 'PCE', quantity: 1, unitPrice: '', taxRate: 15 }
const purchaseContexts = ['trading', 'construction', 'travel_agency', 'furniture', 'furniture_shop']
const toNumber = (value, fallback = 0) => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

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
  notes: invoice?.notes || '',
  lineItems: Array.isArray(invoice?.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems.map((line) => ({
        ...emptyLine,
        ...line,
        productId: line?.productId || '',
        productName: line?.productName || '',
        productNameAr: line?.productNameAr || '',
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
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const isEdit = Boolean(invoiceId)
  const defaultBusinessContext = useMemo(() => {
    const primary = getPrimaryBusinessType(tenant)
    if (purchaseContexts.includes(primary)) return primary
    return tenantBusinessTypes.find((type) => purchaseContexts.includes(type)) || 'trading'
  }, [tenant, tenantBusinessTypes])

  const { register, control, handleSubmit, watch, setValue, reset } = useForm({
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
  const skipBusinessContextResetRef = useRef(false)

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

  useEffect(() => {
    if (isEdit && initialInvoice?._id) return
    setValue('businessContext', defaultBusinessContext)
  }, [defaultBusinessContext, initialInvoice?._id, isEdit, setValue])

  useEffect(() => {
    if (!isEdit || !initialInvoice?._id) return
    skipBusinessContextResetRef.current = true
    setTransactionType(initialInvoice?.transactionType === 'B2C' ? 'B2C' : 'B2B')
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
    setValue('seller.address.district', supplier.address?.district || '')
    setValue('seller.address.street', supplier.address?.street || '')
    setValue('seller.address.postalCode', supplier.address?.postalCode || '')
    setValue('seller.address.country', supplier.address?.country || 'SA')
    setValue('seller.address.buildingNumber', supplier.address?.buildingNumber || '')
    setValue('seller.address.additionalNumber', supplier.address?.additionalNumber || '')
  }

  const calculateLineTotal = (index) => {
    const line = lineItems[index]
    if (!line) return { subtotal: 0, tax: 0, total: 0 }
    const subtotal = toNumber(line.quantity) * toNumber(line.unitPrice)
    const tax = subtotal * (toNumber(line.taxRate, 0) / 100)
    return { subtotal, tax, total: subtotal + tax }
  }

  const totals = lineItems.reduce((acc, _, index) => {
    const calc = calculateLineTotal(index)
    acc.subtotal += calc.subtotal
    acc.totalTax += calc.tax
    acc.grandTotal += calc.total
    return acc
  }, { subtotal: 0, totalTax: 0, grandTotal: 0 })

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
        const calc = calculateLineTotal(index)
        return {
          ...line,
          lineNumber: index + 1,
          taxCategory: 'S',
          productId: isTradingContext ? line.productId || undefined : undefined,
          lineTotal: calc.subtotal,
          taxAmount: calc.tax,
          lineTotalWithTax: calc.total
        }
      }),
    }

    if (!isTradingContext) {
      delete payload.warehouseId
      delete payload.supplierId
    } else {
      if (!payload.warehouseId) delete payload.warehouseId
      if (!payload.supplierId) delete payload.supplierId
    }
    if (invoiceSubtype !== 'travel_ticket') delete payload.travelDetails
    saveMutation.mutate(payload)
  }

  const previewInvoice = {
    ...values,
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
    buyer: {
      name: tenant?.business?.legalNameEn,
      nameAr: tenant?.business?.legalNameAr,
      vatNumber: tenant?.business?.vatNumber,
      address: tenant?.business?.address,
    },
    lineItems: (values.lineItems || []).map((line, index) => {
      const calc = calculateLineTotal(index)
      return {
        ...line,
        lineNumber: index + 1,
        lineTotal: calc.subtotal,
        taxAmount: calc.tax,
        lineTotalWithTax: calc.total
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
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setIsSmartModalOpen(true)} className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 border-0">
            <ScanLine className="w-4 h-4" />
            {language === 'ar' ? 'مسح ذكي (OCR)' : 'Smart OCR'}
          </button>
          <button type="button" onClick={() => setIsBulkModalOpen(true)} className="btn btn-secondary">
            <UploadCloud className="w-4 h-4" />
            {language === 'ar' ? 'رفع مجمع' : 'Bulk Add'}
          </button>
        </div>
      </div>

      <SmartInvoiceModal 
        isOpen={isSmartModalOpen} 
        onClose={() => setIsSmartModalOpen(false)} 
        language={language}
        onSuccess={(data) => {
          if (data.supplier) {
            setValue('seller.name', data.supplier.name || '')
            setValue('seller.nameAr', data.supplier.nameAr || '')
            setValue('seller.vatNumber', data.supplier.vatNumber || '')
          }
          if (data.lineItems && Array.isArray(data.lineItems)) {
            replace(data.lineItems.map(item => ({
              ...emptyLine,
              productId: '',
              productName: item.name || '',
              productNameAr: item.nameAr || '',
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              taxRate: item.taxRate || 15,
            })))
          }
        }}
      />
      <BulkInvoiceModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
        language={language} 
        t={t}
        mode="populate"
        onPopulate={(data) => {
          if (data.party) {
            setValue('seller.name', data.party.name || '')
            setValue('seller.nameAr', data.party.nameAr || '')
            setValue('seller.vatNumber', data.party.vatNumber || '')
          }
          if (data.lineItems && data.lineItems.length > 0) {
            replace(data.lineItems.map(item => ({
              ...emptyLine,
              productName: item.productName || '',
              productNameAr: item.productNameAr || '',
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              taxRate: item.taxRate || 15,
              unitCode: item.unitCode || 'PCE'
            })))
          }
        }}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><label className="label">{language === 'ar' ? 'الاسم / الشركة' : 'Name / Company'}</label><input {...register('seller.name', { required: true })} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}</label><input {...register('seller.vatNumber')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label><input {...register('seller.contactPhone')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label><input type="email" {...register('seller.contactEmail')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'المدينة' : 'City'}</label><input {...register('seller.address.city')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'الحي' : 'District'}</label><input {...register('seller.address.district')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'الشارع' : 'Street'}</label><input {...register('seller.address.street')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label><input {...register('seller.address.postalCode')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'الدولة' : 'Country'}</label><input {...register('seller.address.country')} className="input" placeholder="SA" /></div>
                <div><label className="label">{language === 'ar' ? 'رقم المبنى' : 'Building Number'}</label><input {...register('seller.address.buildingNumber')} className="input" /></div>
                <div><label className="label">{language === 'ar' ? 'الرقم الإضافي' : 'Additional Number'}</label><input {...register('seller.address.additionalNumber')} className="input" /></div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'بنود الفاتورة' : 'Line Items'}</h3><button type="button" onClick={() => append({ ...emptyLine })} className="btn btn-secondary"><Plus className="w-4 h-4" />{t('add')}</button></div>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <motion.div key={field.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-gray-50 p-4 dark:bg-dark-700">
                  <LineItemTranslator index={index} control={control} watch={watch} setValue={setValue} />
                  <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                  <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <label htmlFor={`product-select-${index}`} className="label">{language === 'ar' ? 'الوصف *' : 'Description *'}</label>
                      {isTradingContext ? (
                        <div className="mb-2">
                          <CreatableSelect
                            inputId={`product-select-${index}`}
                            name={`react-select-product-${index}`}
                            options={(products || []).map(p => ({ value: p._id, label: language === 'ar' ? (p.nameAr || p.nameEn) : p.nameEn }))}
                            value={((products || []).find(p => p._id === watch(`lineItems.${index}.productId`))) ? { value: watch(`lineItems.${index}.productId`), label: language === 'ar' ? ((products || []).find(p => p._id === watch(`lineItems.${index}.productId`))?.nameAr || (products || []).find(p => p._id === watch(`lineItems.${index}.productId`))?.nameEn) : ((products || []).find(p => p._id === watch(`lineItems.${index}.productId`))?.nameEn) } : null}
                            onChange={(selected) => {
                              if (selected) {
                                if (selected.__isNew__) {
                                  setValue(`lineItems.${index}.productId`, '')
                                  setValue(`lineItems.${index}.productName`, selected.value)
                                } else {
                                  onSelectProduct(index, selected.value)
                                }
                              } else {
                                setValue(`lineItems.${index}.productId`, '')
                                setValue(`lineItems.${index}.productName`, '')
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
                    <div className="md:col-span-1"><label htmlFor={`unit-${index}`} className="label">{language === 'ar' ? 'الوحدة' : 'UOM'}</label><input id={`unit-${index}`} {...register(`lineItems.${index}.unitCode`)} className="input" placeholder="PCE" /></div>
                    <div className="md:col-span-2"><label htmlFor={`qty-${index}`} className="label">{t('quantity')}</label><input id={`qty-${index}`} type="number" min="0.0001" step="any" {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 0.0001 })} className="input" /></div>
                    <div className="md:col-span-2"><label htmlFor={`price-${index}`} className="label">{t('unitPrice')}</label><input id={`price-${index}`} type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })} className="input" /></div>
                    <div className="md:col-span-2"><label className="label">{t('tax')} %</label><select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className="select"><option value={15}>15%</option><option value={0}>0%</option></select></div>
                    <div className="md:col-span-2 flex items-center gap-2"><div className="flex-1 text-end"><p className="mb-1 text-xs text-gray-500">{t('total')}</p><p className="font-semibold"><Money value={calculateLineTotal(index).total} /></p></div>{fields.length > 1 && <button type="button" onClick={() => remove(index)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div><label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label><textarea {...register('notes')} className="input" rows={3} /></div>
            <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2 md:w-64"><div className="flex justify-between text-sm"><span className="text-gray-500">{t('subtotal')}</span><span><Money value={totals.subtotal} /></span></div><div className="flex justify-between text-sm"><span className="text-gray-500">{t('tax')}</span><span><Money value={totals.totalTax} /></span></div><div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold dark:border-dark-600"><span>{t('total')}</span><span className="text-primary-600"><Money value={totals.grandTotal} /></span></div></div>
              <div className="mb-4">
                <ZatcaPreValidationPanel invoiceData={previewInvoice} language={language} />
              </div>
              <div className="flex gap-3"><button type="button" onClick={() => navigate(isEdit ? `/app/dashboard/invoices/${invoiceId}` : '/app/dashboard/invoices/new')} className="btn btn-secondary">{t('cancel')}</button><button type="submit" disabled={saveMutation.isPending} className="btn btn-action-dark">{saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save className="w-4 h-4" />{isEdit ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : t('save')}</>}</button></div>
            </div>
          </div>
        </form>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="card p-4"><h3 className="text-base font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'المعاينة المباشرة' : 'Live Preview'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تعرض المعاينة شكل الطباعة النهائي تقريباً.' : 'The preview closely reflects the final printed layout.'}</p></div>
          <InvoiceLivePreview invoice={previewInvoice} tenant={tenant} language={language} templateId={selectedTemplateId} bilingual={previewInvoice?.invoiceSubtype === 'travel_ticket' || ['travel_agency', 'trading', 'construction'].includes(previewInvoice?.businessContext)} />
        </div>
      </div>
    </div>
  )
}

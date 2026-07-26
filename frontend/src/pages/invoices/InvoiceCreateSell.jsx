import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, useFieldArray } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import SmartInvoiceModal from '../../components/invoices/SmartInvoiceModal'
import BulkInvoiceModal from '../../components/invoices/BulkInvoiceModal'
import { Mic, UploadCloud, ScanLine } from 'lucide-react'

export default function InvoiceCreateSell() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isProforma = searchParams.get('proforma') === '1'
  const poId = searchParams.get('poId')
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [invoiceType, setInvoiceType] = useState('B2C')
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)

  const businessType = tenant?.businessType || 'trading'
  const isTrading = businessType === 'trading'

  const { register, control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      transactionType: 'B2C',
      invoiceTypeCode: '0200000',
      warehouseId: '',
      restaurantOrderId: '',
      travelBookingId: '',
      contractNumber: '',
      buyer: {},
      lineItems: [{ productId: '', productName: '', productNameAr: '', unitCode: 'PCE', quantity: 1, unitPrice: 0, taxRate: 15 }]
    }
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems' })
  const lineItems = watch('lineItems')

  const location = useLocation()
  const prefillData = location.state?.prefillData

  useEffect(() => {
    if (prefillData) {
      if (prefillData.buyer) {
        setValue('buyer.name', prefillData.buyer.name || '')
        setValue('buyer.vatNumber', prefillData.buyer.vatNumber || '')
        if (prefillData.buyer.address) {
          setValue('buyer.address.city', prefillData.buyer.address.city || '')
          setValue('buyer.address.street', prefillData.buyer.address.street || '')
        }
      }
      if (prefillData.lineItems && Array.isArray(prefillData.lineItems)) {
        replace(prefillData.lineItems.map(item => ({
          productId: '',
          productName: item.name || '',
          productNameAr: '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          taxRate: 15,
          unitCode: 'PCE'
        })))
      }
    }
  }, [prefillData, setValue, replace])

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then(res => res.data.products),
    enabled: isTrading,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(res => res.data),
    enabled: isTrading,
  })

  const { data: customers } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => api.get('/customers', { params: { limit: 200 } }).then(res => res.data.customers)
  })

  const [sourceId, setSourceId] = useState('')

  useEffect(() => {
    setSourceId('')
    setValue('restaurantOrderId', '')
    setValue('travelBookingId', '')
    setValue('contractNumber', '')
  }, [businessType, setValue])

  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: () => api.get(`/purchase-orders/${poId}`).then(res => res.data),
    enabled: !!poId,
  })

  useEffect(() => {
    if (purchaseOrder) {
      // Pre-fill from PO
      const items = (Array.isArray(purchaseOrder?.lineItems) ? purchaseOrder.lineItems : []).map((li) => ({
        productId: li?.productId?._id || li?.productId || '',
        productName: li?.productName || '',
        productNameAr: li?.productNameAr || '',
        unitCode: li?.unitCode || 'PCE',
        quantity: li?.quantity ?? 1,
        unitPrice: li?.unitPrice ?? 0,
        taxRate: li?.taxRate ?? 15,
      }))
      replace(items.length ? items : [{ productId: '', productName: '', productNameAr: '', unitCode: 'PCE', quantity: 1, unitPrice: 0, taxRate: 15 }])

      if (purchaseOrder.supplierId) {
        setValue('buyer.name', purchaseOrder.supplierId.nameEn || purchaseOrder.supplierId.nameAr || 'Supplier')
        setValue('buyer.nameAr', purchaseOrder.supplierId.nameAr || purchaseOrder.supplierId.nameEn)
        setValue('buyer.vatNumber', purchaseOrder.supplierId.vatNumber || '')
      }
      
      toast.success(language === 'ar' ? 'تم استيراد بيانات طلب الشراء' : 'PO data imported')
    }
  }, [purchaseOrder, replace, setValue, language])

  const { data: restaurantOrders } = useQuery({
    queryKey: ['restaurant-orders-lookup'],
    queryFn: () => api.get('/restaurant/orders', { params: { page: 1, limit: 200 } }).then((res) => res.data.orders || []),
    enabled: businessType === 'restaurant',
  })

  const { data: travelBookings } = useQuery({
    queryKey: ['travel-bookings-lookup'],
    queryFn: () => api.get('/travel-bookings', { params: { page: 1, limit: 200 } }).then((res) => res.data.bookings || []),
    enabled: businessType === 'travel_agency',
  })

  const importSourceMutation = useMutation({
    mutationFn: async () => {
      if (!sourceId) throw new Error('Missing sourceId')

      if (businessType === 'restaurant') {
        return api.get(`/restaurant/orders/${sourceId}`).then((res) => ({ type: 'restaurant', data: res.data }))
      }
      if (businessType === 'travel_agency') {
        return api.get(`/travel-bookings/${sourceId}`).then((res) => ({ type: 'travel', data: res.data }))
      }

      throw new Error('Unsupported business type')
    },
    onSuccess: ({ type, data }) => {
      setInvoiceType('B2C')

      if (type === 'restaurant') {
        const items = (Array.isArray(data?.lineItems) ? data.lineItems : []).map((li) => ({
          productId: '',
          productName: li?.name || '',
          productNameAr: li?.nameAr || '',
          unitCode: 'PCE',
          quantity: li?.quantity ?? 1,
          unitPrice: li?.unitPrice ?? 0,
          taxRate: li?.taxRate ?? 15,
        }))

        replace(items.length ? items : [{ productId: '', productName: '', productNameAr: '', unitCode: 'PCE', quantity: 1, unitPrice: 0, taxRate: 15 }])

        setValue('buyer.name', data?.customerName || 'Cash Customer')
        setValue('buyer.contactPhone', data?.customerPhone || '')
        setValue('restaurantOrderId', data?._id || '')
        setValue('travelBookingId', '')
        setValue('contractNumber', data?.orderNumber || '')

        toast.success(language === 'ar' ? 'تم استيراد الطلب' : 'Order imported')
        return
      }

      if (type === 'travel') {
        const subtotal = Number(data?.subtotal) || 0
        const totalTax = Number(data?.totalTax) || 0
        const grandTotal = Number(data?.grandTotal) || subtotal + totalTax
        const taxableAmount = subtotal > 0 ? subtotal : Math.max(0, grandTotal - totalTax)
        const taxRate = taxableAmount > 0 ? Math.round((totalTax / taxableAmount) * 10000) / 100 : 0

        replace([
          {
            productId: '',
            productName: `Travel Booking ${data?.bookingNumber || ''}`.trim(),
            productNameAr: '',
            unitCode: 'PCE',
            quantity: 1,
            unitPrice: taxableAmount,
            taxRate,
          },
        ])

        setValue('buyer.name', data?.customerName || 'Cash Customer')
        setValue('buyer.contactEmail', data?.customerEmail || '')
        setValue('buyer.contactPhone', data?.customerPhone || '')
        setValue('travelBookingId', data?._id || '')
        setValue('restaurantOrderId', '')
        setValue('contractNumber', data?.bookingNumber || '')

        toast.success(language === 'ar' ? 'تم استيراد الحجز' : 'Booking imported')
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error.message || 'Failed')
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/invoices/sell', data, { timeout: 120000 }),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إنشاء فاتورة البيع بنجاح' : 'Sell invoice created successfully')
      navigate(`/app/dashboard/invoices/${res.data._id}`)
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.userMessage || error?.message || 'Failed to create invoice')
    }
  })

  const onSelectProduct = (index, productId) => {
    const product = (products || []).find((p) => p._id === productId)
    if (!product) return

    setValue(`lineItems.${index}.productId`, product._id)
    setValue(`lineItems.${index}.productName`, product.nameEn)
    setValue(`lineItems.${index}.productNameAr`, product.nameAr || product.nameEn)
    setValue(`lineItems.${index}.unitCode`, product.unitOfMeasure || 'PCE')
    setValue(`lineItems.${index}.taxRate`, typeof product.taxRate === 'number' ? product.taxRate : 15)
    if (typeof product.sellingPrice === 'number') {
      setValue(`lineItems.${index}.unitPrice`, product.sellingPrice)
    }
  }

  const onSelectCustomer = (customerId) => {
    const customer = (customers || []).find((c) => c._id === customerId)
    if (!customer) return

    setValue('customerId', customer._id)
    setValue('buyer.name', customer.name)
    setValue('buyer.nameAr', customer.nameAr || customer.name)
    setValue('buyer.vatNumber', customer.vatNumber || '')
    setValue('buyer.crNumber', customer.crNumber || '')
    setValue('buyer.address.city', customer.address?.city || '')
    setValue('buyer.address.district', customer.address?.district || '')
    setValue('buyer.address.street', customer.address?.street || '')
    setValue('buyer.address.postalCode', customer.address?.postalCode || '')
  }

  const calculateLineTotal = (index) => {
    const line = lineItems[index]
    if (!line) return { subtotal: 0, tax: 0, total: 0 }
    const subtotal = (line.quantity || 0) * (line.unitPrice || 0)
    const tax = subtotal * ((line.taxRate || 15) / 100)
    return { subtotal, tax, total: subtotal + tax }
  }

  const calculateTotals = () => {
    let subtotal = 0, totalTax = 0
    lineItems.forEach((_, index) => {
      const calc = calculateLineTotal(index)
      subtotal += calc.subtotal
      totalTax += calc.tax
    })
    return { subtotal, totalTax, grandTotal: subtotal + totalTax }
  }

  const totals = calculateTotals()

  const onSubmit = (data) => {
    const invoiceData = {
      ...data,
      flow: 'sell',
      transactionType: invoiceType,
      invoiceTypeCode: invoiceType === 'B2C' ? '0200000' : '0100000',
      invoiceSubtype: isProforma ? 'proforma' : 'standard',
      sourcePurchaseOrderId: poId || undefined,
      issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
      lineItems: data.lineItems.map((line, i) => ({
        ...line,
        lineNumber: i + 1,
        taxCategory: 'S'
      }))
    }

    if (!invoiceData.restaurantOrderId) delete invoiceData.restaurantOrderId
    if (!invoiceData.travelBookingId) delete invoiceData.travelBookingId
    if (!invoiceData.contractNumber) delete invoiceData.contractNumber

    if (!isTrading) {
      delete invoiceData.warehouseId
      invoiceData.lineItems = (invoiceData.lineItems || []).map((li) => ({
        ...li,
        productId: undefined,
      }))
    }
    createMutation.mutate(invoiceData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/dashboard/invoices/new')} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isProforma 
                ? (language === 'ar' ? 'فاتورة مبدئية جديدة' : 'New Proforma Invoice') 
                : (language === 'ar' ? 'فاتورة بيع جديدة' : 'New Sell Invoice')}
            </h1>
            {isProforma && (
              <span className="badge badge-info">{language === 'ar' ? 'مبدئية' : 'Proforma'}</span>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isProforma
              ? (language === 'ar' ? 'الفاتورة المبدئية لا تخفض المخزون ولا ترفع للزكاة' : 'Proforma invoices do not deduct inventory or require ZATCA signing')
              : (language === 'ar' ? 'إنشاء فاتورة مبيعات مع تخفيض المخزون عند التوقيع' : 'Create a sales invoice (inventory decreases on signing)')}
          </p>
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
          if (data.buyer) {
            setValue('buyer.name', data.buyer.name || '')
            setValue('buyer.nameAr', data.buyer.nameAr || '')
            setValue('buyer.vatNumber', data.buyer.vatNumber || '')
          }
          if (data.lineItems && Array.isArray(data.lineItems)) {
            replace(data.lineItems.map(item => ({
              productId: '',
              productName: item.name || '',
              productNameAr: item.nameAr || '',
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              taxRate: item.taxRate || 15,
              unitCode: 'PCE'
            })))
          }
        }}
      />
      <BulkInvoiceModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
        language={language} 
        t={t} 
      />

      {poId && (
        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm mb-6 border border-blue-100 dark:border-blue-900/50">
          {language === 'ar' ? 'تم تعبئة البيانات تلقائياً من طلب الشراء' : 'Data pre-filled automatically from Purchase Order'} <strong>{purchaseOrder?.poNumber}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {(businessType === 'restaurant' || businessType === 'travel_agency') && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {language === 'ar' ? 'مصدر الفاتورة (اختياري)' : 'Invoice Source (Optional)'}
            </h3>

            {businessType === 'restaurant' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-9">
                  <label className="label">{language === 'ar' ? 'طلب مطعم' : 'Restaurant Order'}</label>
                  <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="select">
                    <option value="">{language === 'ar' ? 'اختر طلب' : 'Select order'}</option>
                    {(restaurantOrders || []).map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.orderNumber} - {Number(o.grandTotal || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <button
                    type="button"
                    className="btn btn-secondary w-full"
                    disabled={!sourceId || importSourceMutation.isPending}
                    onClick={() => importSourceMutation.mutate()}
                  >
                    {importSourceMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      language === 'ar' ? 'استيراد' : 'Import'
                    )}
                  </button>
                </div>
              </div>
            )}

            {businessType === 'travel_agency' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-9">
                  <label className="label">{language === 'ar' ? 'حجز سفر' : 'Travel Booking'}</label>
                  <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="select">
                    <option value="">{language === 'ar' ? 'اختر حجز' : 'Select booking'}</option>
                    {(travelBookings || []).map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bookingNumber} - {Number(b.grandTotal || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <button
                    type="button"
                    className="btn btn-secondary w-full"
                    disabled={!sourceId || importSourceMutation.isPending}
                    onClick={() => importSourceMutation.mutate()}
                  >
                    {importSourceMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      language === 'ar' ? 'استيراد' : 'Import'
                    )}
                  </button>
                </div>
              </div>
            )}

            <input type="hidden" {...register('restaurantOrderId')} />
            <input type="hidden" {...register('travelBookingId')} />
            <input type="hidden" {...register('contractNumber')} />
          </div>
        )}

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {language === 'ar' ? 'نوع الفاتورة' : 'Invoice Type'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setInvoiceType('B2C')}
              className={`p-4 rounded-xl border-2 text-start transition-all ${
                invoiceType === 'B2C'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900 dark:text-white">{t('b2cInvoice')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {language === 'ar' ? 'للمبيعات النقدية - إبلاغ خلال 24 ساعة' : 'For cash sales - Reporting within 24 hours'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setInvoiceType('B2B')}
              className={`p-4 rounded-xl border-2 text-start transition-all ${
                invoiceType === 'B2B'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900 dark:text-white">{t('b2bInvoice')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {language === 'ar' ? 'للشركات - اعتماد فوري من هيئة الزكاة' : 'For businesses - Immediate clearance from ZATCA'}
              </p>
            </button>
          </div>

          <div className="mt-6">
            <label className="label">{language === 'ar' ? 'تاريخ الفاتورة (اختياري لتاريخ قديم)' : 'Invoice Date (Optional for old date)'}</label>
            <input type="datetime-local" {...register('issueDate')} className="input" />
          </div>

          {isTrading && (
            <div className="mt-6">
              <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
              <select {...register('warehouseId')} className="select">
                <option value="">{language === 'ar' ? 'اختر (اختياري)' : 'Select (Optional)'}</option>
                {(warehouses || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {language === 'ar' ? (w.nameAr || w.nameEn) : w.nameEn}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <motion.div
          initial={false}
          animate={{ 
            opacity: invoiceType === 'B2B' ? 1 : 0,
            height: invoiceType === 'B2B' ? 'auto' : 0,
            marginBottom: invoiceType === 'B2B' ? 24 : 0
          }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('customer')}</h3>
                <p className="text-sm text-gray-500">{language === 'ar' ? 'بيانات العميل للفوترة بين الشركات' : 'Customer details for B2B invoicing'}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">{language === 'ar' ? 'اختر عميل موجود' : 'Select Existing Customer'}</label>
              <select
                onChange={(e) => onSelectCustomer(e.target.value)}
                className="select"
              >
                <option value="">{language === 'ar' ? 'اختياري: اختر عميل' : 'Optional: Select customer'}</option>
                {(customers || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.customerCode ? `[${c.customerCode}] ` : ''}{language === 'ar' ? (c.nameAr || c.name) : c.name} {c.vatNumber ? `(${c.vatNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{language === 'ar' ? 'اسم الشركة' : 'Company Name'} *</label>
                <input {...register('buyer.name', { required: invoiceType === 'B2B' })} className="input" placeholder={language === 'ar' ? 'اسم الشركة' : 'Company name'} />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'} *</label>
                <input {...register('buyer.vatNumber', { required: invoiceType === 'B2B' })} className="input" placeholder="3XXXXXXXXXX00003" />
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
            </div>
          </div>
        </motion.div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {language === 'ar' ? 'بنود الفاتورة' : 'Line Items'}
            </h3>
            <button
              type="button"
              onClick={() => append({ productId: '', productName: '', productNameAr: '', unitCode: 'PCE', quantity: 1, unitPrice: 0, taxRate: 15 })}
              className="btn btn-secondary"
            >
              <Plus className="w-4 h-4" />
              {t('add')}
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl"
              >
                <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                <input type="hidden" {...register(`lineItems.${index}.unitCode`)} />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="label">{t('productName')} *</label>
                    <select
                      {...register(`lineItems.${index}.productId`, {
                        onChange: (e) => onSelectProduct(index, e.target.value),
                      })}
                      className="select"
                    >
                      <option value="">{language === 'ar' ? 'اختياري: اختر منتج' : 'Optional: Select product'}</option>
                      {(products || []).map((p) => (
                        <option key={p._id} value={p._id}>
                          {language === 'ar' ? (p.nameAr || p.nameEn) : p.nameEn}
                        </option>
                      ))}
                    </select>

                    <input
                      {...register(`lineItems.${index}.productName`, { required: true })}
                      className="input mt-2"
                      placeholder={language === 'ar' ? 'اسم المنتج أو الخدمة' : 'Product or service name'}
                      readOnly={Boolean(lineItems?.[index]?.productId)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">{t('quantity')}</label>
                    <input
                      type="number"
                      min="1"
                      {...register(`lineItems.${index}.quantity`, { valueAsNumber: true, required: true, min: 1 })}
                      className="input"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">{t('unitPrice')}</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true, required: true, min: 0 })}
                      className="input"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">{t('tax')} %</label>
                    <select {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })} className="select">
                      <option value={15}>15%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <div className="flex-1 text-end">
                      <p className="text-xs text-gray-500 mb-1">{t('total')}</p>
                      <p className="font-semibold"><Money value={calculateLineTotal(index).total} /></p>
                    </div>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-2 md:w-64">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('subtotal')}</span>
                <span><Money value={totals.subtotal} /></span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('tax')} (15%)</span>
                <span><Money value={totals.totalTax} /></span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-dark-600">
                <span>{t('total')}</span>
                <span className="text-primary-600"><Money value={totals.grandTotal} /></span>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => navigate('/app/dashboard/invoices/new')} className="btn btn-secondary">
                {t('cancel')}
              </button>
              <button type="submit" disabled={createMutation.isPending} className="btn btn-primary">
                {createMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

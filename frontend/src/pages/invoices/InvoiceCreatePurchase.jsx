import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

export default function InvoiceCreatePurchase() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const poId = searchParams.get('poId')
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [transactionType, setTransactionType] = useState('B2B')
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)

  const { register, control, handleSubmit, watch, setValue, replace } = useForm({
    defaultValues: {
      transactionType: 'B2B',
      invoiceTypeCode: '0100000',
      warehouseId: '',
      supplierId: '',
      seller: {},
      lineItems: [{ productId: '', productName: '', productNameAr: '', unitCode: 'PCE', quantity: 1, unitPrice: 0, taxRate: 15 }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const lineItems = watch('lineItems')

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then(res => res.data.products)
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(res => res.data)
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then(res => res.data.suppliers)
  })

  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: () => api.get(`/purchase-orders/${poId}`).then(res => res.data),
    enabled: !!poId,
  })

  useEffect(() => {
    if (purchaseOrder) {
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
        setValue('supplierId', purchaseOrder.supplierId._id || purchaseOrder.supplierId)
      }
      toast.success(language === 'ar' ? 'تم استيراد بيانات طلب الشراء' : 'PO data imported')
    }
  }, [purchaseOrder, replace, setValue, language])

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return api.post('/invoices/purchase', payload)
    },
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إنشاء فاتورة الشراء بنجاح' : 'Purchase invoice created successfully')
      navigate(`/app/dashboard/invoices/${res.data._id}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create purchase invoice')
    }
  })

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

  const onSelectProduct = (index, productId) => {
    const product = (products || []).find((p) => p._id === productId)
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

  const onSubmit = (data) => {
    const payload = {
      ...data,
      flow: 'purchase',
      transactionType,
      invoiceTypeCode: transactionType === 'B2C' ? '0200000' : '0100000',
      sourcePurchaseOrderId: poId || undefined,
      issueDate: new Date(),
      lineItems: (data.lineItems || []).map((line, i) => ({
        ...line,
        lineNumber: i + 1,
        taxCategory: 'S'
      }))
    }

    createMutation.mutate(payload)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {poId
              ? (language === 'ar' ? 'فاتورة المورد (Vendor Bill)' : 'Vendor Bill')
              : (language === 'ar' ? 'فاتورة شراء جديدة' : 'New Purchase Invoice')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {poId
              ? (language === 'ar' ? 'إصدار فاتورة مورد لطلب الشراء واستلام البضاعة' : 'Billing vendor invoice for purchase order')
              : (language === 'ar' ? 'إنشاء فاتورة مشتريات وتحديث المخزون مباشرة' : 'Create a purchase invoice and update inventory')}
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
          if (data.supplier) {
            // Can't auto select supplier dropdown if it's not in the list, but we can if we had a free-text option.
            // For now, if the supplier name matches, we could find it, or we just let user select.
            // Purchase invoices require a registered Supplier ID in this system by default.
            const matchedSupplier = suppliers?.find(s => s.vatNumber === data.supplier.vatNumber || s.name === data.supplier.name || s.nameAr === data.supplier.nameAr)
            if (matchedSupplier) {
              setValue('supplierId', matchedSupplier._id)
            }
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
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {language === 'ar' ? 'الإعدادات الأساسية' : 'Basic Settings'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'النوع' : 'Type'}</label>
              <select
                value={transactionType}
                onChange={(e) => {
                  setTransactionType(e.target.value)
                  setValue('transactionType', e.target.value)
                }}
                className="select"
              >
                <option value="B2B">{t('b2bInvoice')}</option>
                <option value="B2C">{t('b2cInvoice')}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
              <select {...register('warehouseId')} className="select">
                <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                {(warehouses || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {language === 'ar' ? (w.nameAr || w.nameEn) : w.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'المورد' : 'Supplier'} *</label>
              <select {...register('supplierId', { required: true })} className="select">
                <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                {(suppliers || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {language === 'ar' ? (s.nameAr || s.nameEn) : s.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

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
                <input type="hidden" {...register(`lineItems.${index}.productName`, { required: true })} />
                <input type="hidden" {...register(`lineItems.${index}.productNameAr`)} />
                <input type="hidden" {...register(`lineItems.${index}.unitCode`)} />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="label">{language === 'ar' ? 'المنتج' : 'Product'} *</label>
                    <select
                      {...register(`lineItems.${index}.productId`, {
                        required: true,
                        onChange: (e) => onSelectProduct(index, e.target.value),
                      })}
                      className="select"
                    >
                      <option value="">{language === 'ar' ? 'اختر المنتج' : 'Select product'}</option>
                      {(products || []).map((p) => (
                        <option key={p._id} value={p._id}>
                          {language === 'ar' ? (p.nameAr || p.nameEn) : p.nameEn}
                        </option>
                      ))}
                    </select>
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
              <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
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

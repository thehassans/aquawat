import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Building, Phone, Mail, MapPin, Edit, PackagePlus, X, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import ExportMenu from '../components/ui/ExportMenu'

export default function Suppliers() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [stockInModal, setStockInModal] = useState(null)
  const [stockForm, setStockForm] = useState({ productId: '', quantity: 1, costPrice: '', warehouseId: '', expiryDate: '', batchNumber: '' })

  const isBakala = tenant?.businessType === 'bakala' || (tenant?.businessTypes || []).includes('bakala')

  const [isAddition, setIsAddition] = useState('')

  const exportColumns = [
    {
      key: 'code',
      label: language === 'ar' ? 'الرمز' : 'Code',
      value: (r) => r?.code || ''
    },
    {
      key: 'name',
      label: language === 'ar' ? 'الاسم' : 'Name',
      value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || ''
    },
    {
      key: 'vatNumber',
      label: language === 'ar' ? 'الرقم الضريبي' : 'VAT Number',
      value: (r) => r?.vatNumber || ''
    },
    {
      key: 'phone',
      label: language === 'ar' ? 'الهاتف' : 'Phone',
      value: (r) => r?.phone || ''
    },
    {
      key: 'email',
      label: language === 'ar' ? 'البريد' : 'Email',
      value: (r) => r?.email || ''
    },
    {
      key: 'city',
      label: language === 'ar' ? 'المدينة' : 'City',
      value: (r) => r?.address?.city || ''
    },
    {
      key: 'status',
      label: t('status'),
      value: (r) => (r?.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive'))
    },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/suppliers', { params: { page: currentPage, limit, search, isAddition } })
      const batch = res.data?.suppliers || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search, isAddition],
    queryFn: () => api.get('/suppliers', { params: { page, search, isAddition, limit: 25 } }).then((res) => res.data)
  })

  const { data: stats } = useQuery({
    queryKey: ['suppliers-stats'],
    queryFn: () => api.get('/suppliers/stats').then((res) => res.data)
  })

  const { data: products } = useQuery({
    queryKey: ['stock-in-products', isBakala],
    queryFn: () => isBakala
      ? api.get('/bakala-products', { params: { limit: 200 } }).then((res) => res.data.products || res.data)
      : api.get('/products', { params: { limit: 200 } }).then((res) => res.data.products || res.data),
    enabled: !!stockInModal,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['stock-in-warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => res.data),
    enabled: !!stockInModal && !isBakala,
  })

  const stockInMutation = useMutation({
    mutationFn: ({ productId, payload }) => isBakala
      ? api.post(`/bakala-products/${productId}/add-stock`, payload)
      : api.post(`/products/${productId}/stock`, payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إضافة المخزون' : 'Stock added successfully')
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['bakala-products'])
      setStockInModal(null)
      setStockForm({ productId: '', quantity: 1, costPrice: '', warehouseId: '', expiryDate: '', batchNumber: '' })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const submitStockIn = () => {
    if (!stockForm.productId) {
      toast.error(language === 'ar' ? 'اختر منتج' : 'Select a product')
      return
    }
    if (!stockForm.quantity || stockForm.quantity <= 0) {
      toast.error(language === 'ar' ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be greater than zero')
      return
    }
    const payload = isBakala
      ? { quantity: Number(stockForm.quantity), costPrice: stockForm.costPrice || undefined, expiryDate: stockForm.expiryDate || undefined, batchNumber: stockForm.batchNumber || undefined }
      : { warehouseId: stockForm.warehouseId, quantity: Number(stockForm.quantity), type: 'add' }
    stockInMutation.mutate({ productId: stockForm.productId, payload })
  }

  const suppliers = data?.suppliers || []
  const pagination = data?.pagination

  const totals = stats?.totals?.[0]
  const totalSuppliers = totals?.total || 0
  const activeSuppliers = totals?.active || 0
  const additionsCount = totals?.additions || 0
  const companyCount = stats?.byType?.find((x) => x._id === 'company')?.count || 0
  const individualCount = stats?.byType?.find((x) => x._id === 'individual')?.count || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'الموردين' : 'Suppliers'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة الموردين وسجلهم' : 'Manage suppliers and vendor records'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={suppliers}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'الموردين' : 'Suppliers'}
            title={language === 'ar' ? 'الموردين' : 'Suppliers'}
            disabled={isLoading || suppliers.length === 0}
          />
          <Link to="/suppliers/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Building className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي الموردين' : 'Total Suppliers'}</p>
            <p className="text-2xl font-bold">{totalSuppliers}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <Building className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إضافات الموردين' : 'Supplier Additions'}</p>
            <p className="text-2xl font-bold text-emerald-600">{additionsCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Building className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'موردين نشطين' : 'Active Suppliers'}</p>
            <p className="text-2xl font-bold text-blue-600">{activeSuppliers}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Building className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'شركات' : 'Companies'}</p>
            <p className="text-2xl font-bold">{companyCount}</p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث بالاسم / الرمز / الرقم الضريبي...' : 'Search by name / code / VAT...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="input ps-10"
            />
          </div>
          <select
            value={isAddition}
            onChange={(e) => {
              setIsAddition(e.target.value)
              setPage(1)
            }}
            className="select w-full sm:w-56"
          >
            <option value="">{language === 'ar' ? 'كل الموردين' : 'All Suppliers'}</option>
            <option value="true">{language === 'ar' ? 'إضافات الموردين فقط' : 'Supplier Additions Only'}</option>
            <option value="false">{language === 'ar' ? 'الموردين المباشرين فقط' : 'Direct Suppliers Only'}</option>
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'الرمز' : 'Code'}</th>
                  <th>{language === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th>{language === 'ar' ? 'الهاتف' : 'Phone'}</th>
                  <th>{language === 'ar' ? 'البريد' : 'Email'}</th>
                  <th>{language === 'ar' ? 'المدينة' : 'City'}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id}>
                    <td className="font-mono text-sm">{s.code}</td>
                    <td>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {language === 'ar' ? s.nameAr || s.nameEn : s.nameEn}
                          </p>
                          {s.isAddition && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                              {language === 'ar' ? 'إضافة' : 'Addition'}
                            </span>
                          )}
                        </div>
                        {s.vatNumber && (
                          <p className="text-xs text-gray-500">VAT: {s.vatNumber}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      {s.phone ? (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {s.phone}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {s.email ? (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {s.email}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {s.address?.city ? (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {s.address.city}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${s.isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {s.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link to={`/suppliers/${s._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg" title={language === 'ar' ? 'تعديل' : 'Edit'}>
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Link>
                        <Link
                          to={`/purchase-orders/new?supplierId=${s._id}`}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                          title={language === 'ar' ? 'طلب شراء جديد' : 'New Purchase Order'}
                        >
                          <ShoppingCart className="w-4 h-4 text-blue-600" />
                        </Link>
                        <button
                          onClick={() => { setStockInModal(s); setStockForm({ productId: '', quantity: 1, costPrice: '', warehouseId: '', expiryDate: '', batchNumber: '' }) }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                          title={language === 'ar' ? 'إضافة مخزون سريع' : 'Quick Stock In'}
                        >
                          <PackagePlus className="w-4 h-4 text-emerald-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-sm text-gray-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      {stockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <PackagePlus className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{language === 'ar' ? 'إضافة مخزون سريع' : 'Quick Stock In'}</h3>
                  <p className="text-sm text-gray-500">
                    {language === 'ar' ? 'المورد:' : 'Supplier:'} {language === 'ar' ? stockInModal.nameAr || stockInModal.nameEn : stockInModal.nameEn}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setStockInModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">{language === 'ar' ? 'المنتج' : 'Product'} *</label>
                <select
                  className="select"
                  value={stockForm.productId}
                  onChange={(e) => setStockForm((p) => ({ ...p, productId: e.target.value }))}
                >
                  <option value="">{language === 'ar' ? 'اختر منتج' : 'Select product'}</option>
                  {(products || []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {(language === 'ar' ? p.nameAr || p.nameEn : p.nameEn) || p.sku || p.primaryBarcode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{language === 'ar' ? 'الكمية' : 'Quantity'} *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="input"
                    value={stockForm.quantity}
                    onChange={(e) => setStockForm((p) => ({ ...p, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'سعر التكلفة' : 'Cost Price'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={stockForm.costPrice}
                    onChange={(e) => setStockForm((p) => ({ ...p, costPrice: e.target.value }))}
                  />
                </div>
              </div>

              {!isBakala && (
                <div>
                  <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'} *</label>
                  <select
                    className="select"
                    value={stockForm.warehouseId}
                    onChange={(e) => setStockForm((p) => ({ ...p, warehouseId: e.target.value }))}
                  >
                    <option value="">{language === 'ar' ? 'اختر مستودع' : 'Select warehouse'}</option>
                    {(warehouses || []).map((w) => (
                      <option key={w._id} value={w._id}>
                        {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isBakala && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
                      <input
                        type="date"
                        className="input"
                        value={stockForm.expiryDate}
                        onChange={(e) => setStockForm((p) => ({ ...p, expiryDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم التشغيلة' : 'Batch Number'}</label>
                      <input
                        className="input"
                        value={stockForm.batchNumber}
                        onChange={(e) => setStockForm((p) => ({ ...p, batchNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setStockInModal(null)} className="btn btn-secondary">
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitStockIn}
                disabled={stockInMutation.isPending}
                className="btn btn-primary"
              >
                {stockInMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <PackagePlus className="w-4 h-4" />
                    {language === 'ar' ? 'إضافة المخزون' : 'Add Stock'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

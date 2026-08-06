import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Package, AlertTriangle, Eye, Edit, QrCode } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'

import { getUomLabel } from '../../lib/uomOptions'

export default function Products() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ category: '', status: '' })
  const [page, setPage] = useState(1)

  const queryClient = useQueryClient()
  const [stockModal, setStockModal] = useState({ isOpen: false, productId: null, productName: '' })
  const [stockWarehouseId, setStockWarehouseId] = useState('')
  const [stockQuantity, setStockQuantity] = useState(1)

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(res => res.data)
  })
  const warehouseOptions = Array.isArray(warehouses) ? warehouses : []

  const addStockMutation = useMutation({
    mutationFn: (data) => api.post(`/products/${data.productId}/stock`, {
      warehouseId: data.warehouseId,
      quantity: Number(data.quantity),
      type: 'add'
    }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تمت إضافة المخزون' : 'Stock added successfully')
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['products-stats'])
      setStockModal({ isOpen: false, productId: null, productName: '' })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Failed to add stock'))
    }
  })

  const openStockModal = (product) => {
    setStockModal({
      isOpen: true,
      productId: product._id,
      productName: language === 'ar' ? product.nameAr || product.nameEn : product.nameEn
    })
    setStockQuantity(1)
    if (warehouseOptions.length > 0) {
      setStockWarehouseId(warehouseOptions[0]._id)
    }
  }

  const handleAddStock = (e) => {
    e.preventDefault()
    if (!stockWarehouseId || stockQuantity <= 0) return
    addStockMutation.mutate({
      productId: stockModal.productId,
      warehouseId: stockWarehouseId,
      quantity: stockQuantity
    })
  }

  const exportColumns = [
    {
      key: 'name',
      label: t('productName'),
      value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || ''
    },
    {
      key: 'sku',
      label: t('sku'),
      value: (r) => r?.sku || ''
    },
    {
      key: 'barcode',
      label: t('barcode'),
      value: (r) => r?.barcode || ''
    },
    {
      key: 'category',
      label: t('category'),
      value: (r) => r?.category || ''
    },
    {
      key: 'unitOfMeasure',
      label: language === 'ar' ? 'وحدة القياس (UOM)' : 'UOM',
      value: (r) => getUomLabel(r?.unitOfMeasure, language) || r?.unitOfMeasure || 'EA'
    },
    {
      key: 'costPrice',
      label: t('costPrice'),
      value: (r) => r?.costPrice ?? ''
    },
    {
      key: 'sellingPrice',
      label: t('sellingPrice'),
      value: (r) => r?.sellingPrice ?? ''
    },
    {
      key: 'totalStock',
      label: t('quantity'),
      value: (r) => r?.totalStock ?? ''
    },
    {
      key: 'status',
      label: t('status'),
      value: (r) => r?.status || ''
    },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, filters],
    queryFn: () => api.get('/products', { params: { page, search, ...filters } }).then(res => res.data)
  })

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/products', {
        params: { page: currentPage, limit, search, ...filters }
      })
      const batch = res.data?.products || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  const { data: stats } = useQuery({
    queryKey: ['products-stats'],
    queryFn: () => api.get('/products/stats').then(res => res.data)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('products')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة المنتجات والمخزون' : 'Manage products and inventory'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={data?.products || []}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'المنتجات' : 'Products'}
            title={language === 'ar' ? 'المنتجات' : 'Products'}
            disabled={isLoading || (data?.products || []).length === 0}
          />
          <Link to="/products/new" className="btn btn-action-dark">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة منتج' : 'Add Product'}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</p>
            <p className="text-2xl font-bold">{stats?.totals?.[0]?.totalProducts || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي المخزون' : 'Total Stock'}</p>
            <p className="text-2xl font-bold">{stats?.totals?.[0]?.totalStock?.toLocaleString() || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Package className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'سماح بالسالب' : 'Negative Stock OK'}</p>
            <p className="text-2xl font-bold text-purple-600">{stats?.allowNegativeStock?.[0]?.count || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('lowStock')}</p>
            <p className="text-2xl font-bold text-amber-600">{stats?.lowStock?.[0]?.count || 0}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder={`${t('search')} / ${t('barcode')}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="input ps-10" />
          </div>
          <select value={filters.allowNegativeStock || ''} onChange={(e) => setFilters({ ...filters, allowNegativeStock: e.target.value })} className="select w-full sm:w-48">
            <option value="">{language === 'ar' ? 'كل أنواع المخزون' : 'All Stock Types'}</option>
            <option value="true">{language === 'ar' ? 'سماح بالسالب فقط' : 'Negative Allowed Only'}</option>
            <option value="false">{language === 'ar' ? 'مخزون عادي فقط' : 'Standard Stock Only'}</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="select w-full sm:w-40">
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
            <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
            <option value="inactive">{language === 'ar' ? 'غير نشط' : 'Inactive'}</option>
            <option value="out_of_stock">{t('outOfStock')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('productName')}</th>
                  <th>{t('sku')}</th>
                  <th>{t('category')}</th>
                  <th>{language === 'ar' ? 'الوحدة (UOM)' : 'UOM'}</th>
                  <th>{t('costPrice')}</th>
                  <th>{t('sellingPrice')}</th>
                  <th>{t('quantity')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.products?.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center">
                          {product.images?.[0] ? (
                            <img src={product.images[0].url} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">{language === 'ar' ? product.nameAr || product.nameEn : product.nameEn}</p>
                            {product.allowNegativeStock && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                                {language === 'ar' ? 'سماح بالسالب' : 'Negative OK'}
                              </span>
                            )}
                          </div>
                          {product.barcode && <p className="text-xs text-gray-500 flex items-center gap-1"><QrCode className="w-3 h-3" />{product.barcode}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{product.sku}</td>
                    <td>{product.category || '-'}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-dark-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-dark-600 shadow-2xs">
                        {getUomLabel(product.unitOfMeasure, language) || product.unitOfMeasure || 'EA'}
                      </span>
                    </td>
                    <td><Money value={product.costPrice} /></td>
                    <td className="font-semibold"><Money value={product.sellingPrice} /></td>
                    <td>
                      <div className="flex items-baseline gap-1">
                        <span className={`font-semibold ${product.totalStock <= 10 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                          {product.totalStock}
                        </span>
                        <span className="text-xs text-gray-400">
                          {product.unitOfMeasure || 'EA'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${product.status === 'active' ? 'badge-success' : product.status === 'out_of_stock' ? 'badge-danger' : 'badge-neutral'}`}>
                        {product.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openStockModal(product)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-emerald-600" title={language === 'ar' ? 'إضافة مخزون' : 'Add Stock'}>
                          <Plus className="w-4 h-4" />
                        </button>
                        <Link to={`/products/${product._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"><Eye className="w-4 h-4 text-gray-600" /></Link>
                        <Link to={`/products/${product._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"><Edit className="w-4 h-4 text-gray-600" /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Add Stock Modal */}
      {stockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'إضافة مخزون' : 'Add Stock'} - {stockModal.productName}
              </h3>
              <form onSubmit={handleAddStock} className="space-y-4">
                <div>
                  <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
                  <select
                    className="select"
                    value={stockWarehouseId}
                    onChange={(e) => setStockWarehouseId(e.target.value)}
                    required
                  >
                    <option value="">{language === 'ar' ? 'اختر المستودع' : 'Select warehouse'}</option>
                    {warehouseOptions.map(w => (
                      <option key={w._id} value={w._id}>
                        {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الكمية المراد إضافتها' : 'Quantity to Add'}</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    className="input"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setStockModal({ isOpen: false, productId: null, productName: '' })} className="btn btn-secondary">
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={addStockMutation.isPending} className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-none text-white">
                    {addStockMutation.isPending ? '...' : (language === 'ar' ? 'إضافة' : 'Add')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

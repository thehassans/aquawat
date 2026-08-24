import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus, Search } from 'lucide-react'
import api from '../../lib/api'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import { INVENTORY_PATH, primaryBtn } from './inventoryUi'

export default function StockProducts() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-product-templates', search, page],
    queryFn: () =>
      api.get('/stock/products/templates', { params: { search: search || undefined, page, limit: 80 } }).then((r) => r.data),
  })

  const items = data?.items || []

  const columns = [
    {
      key: 'name',
      label: isAr ? 'المنتج' : 'Product',
      render: (row) => (
        <Link to={INVENTORY_PATH.product(row._id)} className="font-medium text-teal-700 dark:text-teal-400">
          {row.name}
        </Link>
      ),
    },
    { key: 'defaultCode', label: isAr ? 'الرمز' : 'Code', render: (r) => r.defaultCode || '—' },
    { key: 'uom', label: isAr ? 'الوحدة' : 'UoM', render: (r) => r.uomId?.name || '—' },
    { key: 'listPrice', label: isAr ? 'سعر البيع' : 'List price', render: (r) => r.listPrice },
    { key: 'standardPrice', label: isAr ? 'التكلفة' : 'Cost', render: (r) => r.standardPrice },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'المنتجات' : 'Products'}</h1>
          <p className="text-gray-500 mt-1">{isAr ? 'قوالب وم variants المخزون' : 'Stock product templates & variants'}</p>
        </div>
        <Link to={INVENTORY_PATH.productNew} className={primaryBtn}>
          <Plus className="w-4 h-4" />
          {isAr ? 'منتج جديد' : 'New product'}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link to={INVENTORY_PATH.lots} className="btn btn-ghost">{isAr ? 'الدفعات / التسلسل' : 'Lots / Serials'}</Link>
        <Link to={INVENTORY_PATH.packages} className="btn btn-ghost">{isAr ? 'الطرود' : 'Packages'}</Link>
        <Link to={INVENTORY_PATH.movesHistory} className="btn btn-ghost">{isAr ? 'سجل الحركات' : 'Moves History'}</Link>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-10"
          placeholder={isAr ? 'بحث...' : 'Search...'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      <ResponsiveDataList columns={columns} data={items} loading={isLoading} />
    </div>
  )
}

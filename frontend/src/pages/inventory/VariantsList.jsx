import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Search } from 'lucide-react'
import api from '../../lib/api'
import InventoryDataTable from './InventoryDataTable'
import { INVENTORY_PATH, stockProductLabel } from './inventoryUi'

export default function VariantsList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [search, setSearch] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-variants-list', search],
    queryFn: () =>
      api.get('/stock/products/variants', { params: { search: search || undefined, limit: 200 } }).then((r) => r.data),
  })

  const columns = [
    {
      key: 'name',
      label: isAr ? 'القالب' : 'Template',
      render: (row) => (
        <Link
          to={row.templateId?._id ? INVENTORY_PATH.product(row.templateId._id) : INVENTORY_PATH.products}
          className="font-medium text-teal-700 dark:text-teal-400"
        >
          {stockProductLabel(row)}
        </Link>
      ),
    },
    { key: 'defaultCode', label: isAr ? 'الرمز' : 'Code', render: (r) => r.defaultCode || '—' },
    { key: 'barcode', label: isAr ? 'باركود' : 'Barcode', render: (r) => r.barcode || '—' },
    {
      key: 'attrs',
      label: isAr ? 'الخصائص' : 'Attributes',
      render: (r) => (r.attributeValueIds?.length ? `${r.attributeValueIds.length} values` : (isAr ? 'افتراضي' : 'Default')),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'متغيرات المنتج' : 'Product Variants'}</h1>
        <p className="text-gray-500 mt-1">{isAr ? 'كل المتغيرات النشطة في المحرك' : 'All active stock variants'}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link to={INVENTORY_PATH.products} className="btn btn-ghost">{isAr ? 'القوالب' : 'Templates'}</Link>
        <Link to={INVENTORY_PATH.lots} className="btn btn-ghost">{isAr ? 'الدفعات' : 'Lots'}</Link>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-10"
          placeholder={isAr ? 'بحث...' : 'Search...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <InventoryDataTable columns={columns} data={items} loading={isLoading} />
    </div>
  )
}

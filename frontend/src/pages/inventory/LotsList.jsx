import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import { INVENTORY_PATH } from './inventoryUi'

export default function LotsList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['stock-lots', search],
    queryFn: () => api.get('/stock/lots', { params: { search: search || undefined } }).then((r) => r.data),
  })

  const columns = [
    {
      key: 'name',
      label: isAr ? 'الدفعة / التسلسل' : 'Lot / Serial',
      render: (row) => (
        <Link to={INVENTORY_PATH.lot(row._id)} className="font-medium text-teal-700 dark:text-teal-400">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'product',
      label: isAr ? 'المنتج' : 'Product',
      render: (r) => r.productId?.defaultCode || String(r.productId?._id || '').slice(-6) || '—',
    },
    {
      key: 'expirationDate',
      label: isAr ? 'انتهاء الصلاحية' : 'Expiration',
      render: (r) => (r.expirationDate ? new Date(r.expirationDate).toLocaleDateString() : '—'),
    },
    {
      key: 'removalDate',
      label: isAr ? 'تاريخ الإزالة' : 'Removal',
      render: (r) => (r.removalDate ? new Date(r.removalDate).toLocaleDateString() : '—'),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAr ? 'الدفعات / الأرقام التسلسلية' : 'Lots / Serial Numbers'}
        </h1>
      </div>
      <input
        className="input max-w-md"
        placeholder={isAr ? 'بحث...' : 'Search...'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ResponsiveDataList columns={columns} data={data?.items || []} loading={isLoading} />
    </div>
  )
}

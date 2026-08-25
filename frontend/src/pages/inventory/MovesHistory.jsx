import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import InventoryDataTable from './InventoryDataTable'

export default function MovesHistory() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-moves-history', page],
    queryFn: () => api.get('/stock/reports/moves-history', { params: { page, limit: 80 } }).then((r) => r.data),
  })

  const columns = [
    {
      key: 'date',
      label: isAr ? 'التاريخ' : 'Date',
      render: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'),
    },
    { key: 'reference', label: isAr ? 'المرجع' : 'Reference', render: (r) => r.reference || r.pickingId?.name || '—' },
    {
      key: 'product',
      label: isAr ? 'المنتج' : 'Product',
      render: (r) => r.productId?.defaultCode || String(r.productId?._id || '').slice(-6) || '—',
    },
    { key: 'from', label: isAr ? 'من' : 'From', render: (r) => r.locationId?.completeName || '—' },
    { key: 'to', label: isAr ? 'إلى' : 'To', render: (r) => r.locationDestId?.completeName || '—' },
    { key: 'lot', label: isAr ? 'الدفعة' : 'Lot', render: (r) => r.lotId?.name || r.lotName || '—' },
    { key: 'qty', label: isAr ? 'الكمية' : 'Qty', render: (r) => r.quantityProduct || r.quantity },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAr ? 'سجل الحركات' : 'Moves History'}
        </h1>
        <p className="text-gray-500 mt-1">{isAr ? 'سطور الحركات المنجزة' : 'Done move lines'}</p>
      </div>
      <InventoryDataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        pagination={{
          page,
          total: data?.total || 0,
          limit: 80,
          onPageChange: setPage,
        }}
      />
    </div>
  )
}

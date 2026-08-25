import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import InventoryDataTable from './InventoryDataTable'
import { INVENTORY_PATH } from './inventoryUi'

export default function StockReport() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const fromUrl = searchParams.get('search')
    if (fromUrl != null) {
      setSearch(fromUrl)
      setPage(1)
    }
  }, [searchParams])

  const { data, isLoading } = useQuery({
    queryKey: ['stock-report', search, page],
    queryFn: () =>
      api.get('/stock/reports/stock', { params: { search: search || undefined, page, limit: 80 } }).then((r) => r.data),
  })

  const rows = data?.rows || []

  const columns = [
    {
      key: 'productName',
      label: isAr ? 'المنتج' : 'Product',
      render: (r) => (
        <Link
          to={`${INVENTORY_PATH.forecastReport}?productId=${r.productId}`}
          className="font-medium text-teal-700 dark:text-teal-400"
        >
          {r.productName}
        </Link>
      ),
    },
    { key: 'defaultCode', label: isAr ? 'الرمز' : 'Code', render: (r) => r.defaultCode || '—' },
    { key: 'onHand', label: isAr ? 'باليد' : 'On hand' },
    { key: 'freeToUse', label: isAr ? 'متاح' : 'Free to use' },
    { key: 'reserved', label: isAr ? 'محجوز' : 'Reserved' },
    { key: 'incoming', label: isAr ? 'وارد' : 'Incoming' },
    { key: 'outgoing', label: isAr ? 'صادر' : 'Outgoing' },
    { key: 'forecasted', label: isAr ? 'متوقع' : 'Forecasted' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'تقرير المخزون' : 'Stock Report'}</h1>
        <p className="text-gray-500 mt-1">{isAr ? 'الرصيد والتوقعات' : 'On-hand, reserved, and forecasted quantities'}</p>
      </div>
      <input
        className="input max-w-md"
        placeholder={isAr ? 'بحث...' : 'Search products...'}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
      />
      <InventoryDataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        pagination={{
          page,
          total: data?.total || rows.length,
          limit: 80,
          onPageChange: setPage,
        }}
      />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import { fieldControlClass, INVENTORY_PATH } from './inventoryUi'

export default function ForecastReport() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [searchParams] = useSearchParams()
  const [productId, setProductId] = useState(searchParams.get('productId') || '')

  useEffect(() => {
    const fromUrl = searchParams.get('productId')
    if (fromUrl) setProductId(fromUrl)
  }, [searchParams])

  const { data: variants = [] } = useQuery({
    queryKey: ['stock-variants-pick'],
    queryFn: () => api.get('/stock/products/variants', { params: { limit: 200 } }).then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['stock-forecast-timeline', productId],
    queryFn: () => api.get(`/stock/reports/forecast/${productId}`).then((r) => r.data),
    enabled: Boolean(productId),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAr ? 'المخزون المتوقع' : 'Forecasted Inventory'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isAr ? 'جدول زمني للوارد والصادر مع الرصيد الجاري' : 'Incoming/outgoing timeline with running balance'}
        </p>
      </div>

      <div className="max-w-md">
        <label className="label">{isAr ? 'المنتج' : 'Product'}</label>
        <select className={fieldControlClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">—</option>
          {variants.map((v) => (
            <option key={v._id} value={v._id}>
              {v.templateId?.name || v.defaultCode || v._id}
            </option>
          ))}
        </select>
      </div>

      {productId && data && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="btn btn-ghost">{isAr ? 'باليد' : 'On hand'}: {data.onHand}</span>
          <span className="btn btn-ghost">{isAr ? 'وارد' : 'In'}: {data.incoming}</span>
          <span className="btn btn-ghost">{isAr ? 'صادر' : 'Out'}: {data.outgoing}</span>
          <span className="btn btn-ghost">{isAr ? 'متوقع' : 'Forecast'}: {data.forecasted}</span>
          {data.firstNegativeDate && (
            <span className="badge-danger px-2 py-1 rounded-lg">
              {isAr ? 'أول عجز' : 'First shortage'}: {new Date(data.firstNegativeDate).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {isLoading && <p>…</p>}

      {productId && data?.timeline && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'المرجع' : 'Reference'}</th>
                  <th>{isAr ? 'النوع' : 'Type'}</th>
                  <th>{isAr ? 'الكمية' : 'Qty'}</th>
                  <th>{isAr ? 'الرصيد' : 'Balance'}</th>
                </tr>
              </thead>
              <tbody>
                {data.timeline.map((row, i) => (
                  <tr key={i} className={row.negative ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                    <td>{row.date ? new Date(row.date).toLocaleDateString() : '—'}</td>
                    <td>
                      {row.pickingId ? (
                        <Link to={INVENTORY_PATH.picking(row.pickingId)} className="text-teal-700 dark:text-teal-400">
                          {row.reference}
                        </Link>
                      ) : row.reference}
                    </td>
                    <td>{row.direction}</td>
                    <td>{row.direction === 'out' ? `−${row.qty}` : row.qty}</td>
                    <td className={row.negative ? 'text-red-700 dark:text-red-400 font-medium' : ''}>{row.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

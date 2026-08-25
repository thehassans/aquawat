import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import { fieldControlClass } from './inventoryUi'

export default function LocationsReport() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['stock-locations-report', search],
    queryFn: () =>
      api.get('/stock/reports/locations', { params: { search: search || undefined } }).then((r) => r.data),
  })

  const groups = data?.groups || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'تقرير المواقع' : 'Locations Report'}</h1>
        <p className="text-gray-500 mt-1">{isAr ? 'الكميات حسب الموقع مع الدفعات والطرود' : 'Quants by location with lot/package breakdown'}</p>
      </div>
      <input
        className={`${fieldControlClass} max-w-md`}
        placeholder={isAr ? 'بحث موقع...' : 'Search location...'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isLoading && <p>…</p>}
      {!isLoading && !groups.length && (
        <p className="text-slate-500">{isAr ? 'لا أرصدة داخلية' : 'No internal stock'}</p>
      )}
      {groups.map((g) => (
        <div key={g.locationId} className="card overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap justify-between gap-2">
            <div className="font-medium">{g.completeName}</div>
            <div className="text-sm text-slate-500">
              {isAr ? 'باليد' : 'On hand'}: {g.onHand} · {isAr ? 'محجوز' : 'Reserved'}: {g.reserved}
            </div>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? 'المنتج' : 'Product'}</th>
                  <th>{isAr ? 'دفعة' : 'Lot'}</th>
                  <th>{isAr ? 'طرد' : 'Package'}</th>
                  <th>{isAr ? 'كمية' : 'Qty'}</th>
                  <th>{isAr ? 'محجوز' : 'Reserved'}</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((line) => (
                  <tr key={line.quantId}>
                    <td>{line.productName}</td>
                    <td>{line.lotName || '—'}</td>
                    <td>{line.packageName || '—'}</td>
                    <td>{line.quantity}</td>
                    <td>{line.reservedQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

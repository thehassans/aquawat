import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'

export default function PackagesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['stock-packages'],
    queryFn: () => api.get('/stock/packages').then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'الطرود' : 'Packages'}</h1>
      </div>
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'النوع' : 'Type'}</th>
                <th>{isAr ? 'الموقع' : 'Location'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={3} className="text-center py-6">…</td></tr>}
              {!isLoading && packages.length === 0 && (
                <tr><td colSpan={3} className="text-center py-6 text-slate-500">{isAr ? 'لا توجد طرود' : 'No packages'}</td></tr>
              )}
              {packages.map((p) => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>{p.packageTypeId?.name || '—'}</td>
                  <td>{p.locationId?.completeName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

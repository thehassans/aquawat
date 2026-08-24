import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'

export default function ProcurementGroupsList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-proc-groups'],
    queryFn: () => api.get('/stock/procurement-groups').then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAr ? 'مجموعات التوريد' : 'Procurement Groups'}
        </h1>
        <p className="text-gray-500 mt-1">{isAr ? 'المراجع التي تربط الحركات المتسلسلة' : 'References tying chained moves'}</p>
      </div>
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>Move type</th>
                <th>{isAr ? 'تاريخ' : 'Created'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={3} className="text-center py-6">…</td></tr>}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={3} className="text-center py-6 text-slate-500">{isAr ? 'لا مجموعات بعد' : 'No groups yet'}</td></tr>
              )}
              {items.map((g) => (
                <tr key={g._id}>
                  <td>{g.name}</td>
                  <td>{g.moveType}</td>
                  <td>{g.createdAt ? new Date(g.createdAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

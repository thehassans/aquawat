import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'

export default function UomList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-uom'],
    queryFn: () => api.get('/stock/uom').then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'وحدات القياس' : 'Units of Measure'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr ? 'وحدات مرجعية من تهيئة المحرك (قراءة فقط)' : 'Seeded from stock bootstrap (read-only)'}
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'الفئة' : 'Category'}</th>
                <th>{isAr ? 'النوع' : 'Type'}</th>
                <th>{isAr ? 'المعامل' : 'Factor'}</th>
                <th>{isAr ? 'التقريب' : 'Rounding'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="text-center py-6">…</td></tr>}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-500">{isAr ? 'لا وحدات' : 'No UoMs'}</td></tr>
              )}
              {items.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.categoryId?.name || '—'}</td>
                  <td>{u.uomType}</td>
                  <td>{u.factor}</td>
                  <td>{u.rounding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

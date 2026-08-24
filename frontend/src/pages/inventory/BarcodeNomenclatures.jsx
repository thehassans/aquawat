import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, ghostBtn, primaryBtn } from './inventoryUi'

export default function BarcodeNomenclatures() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [testCode, setTestCode] = useState('')
  const [parseResult, setParseResult] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-barcode-noms'],
    queryFn: () => api.get('/stock/barcode-nomenclatures').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: () => api.post('/stock/barcode-nomenclatures', { name: 'Default Nomenclature' }),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      queryClient.invalidateQueries(['stock-barcode-noms'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const parse = useMutation({
    mutationFn: (barcode) => api.post('/stock/barcode/parse', { barcode }),
    onSuccess: (res) => setParseResult(res.data),
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{isAr ? 'تسمية الباركود' : 'Barcode Nomenclatures'}</h1>
        </div>
        <button type="button" className={primaryBtn} onClick={() => create.mutate()} disabled={items.length > 0}>
          {isAr ? 'إنشاء افتراضي' : 'Create default'}
        </button>
      </div>

      <div className="card p-4 space-y-2">
        {isLoading && <p>…</p>}
        {items.map((n) => (
          <div key={n._id}>
            <h3 className="font-semibold">{n.name}</h3>
            <ul className="text-sm text-slate-600 mt-2 space-y-1">
              {(n.rules || []).map((r) => (
                <li key={r._id || r.name}>{r.sequence}. {r.name} — {r.type} / <code>{r.pattern}</code></li>
              ))}
            </ul>
          </div>
        ))}
        {!items.length && !isLoading && <p className="text-slate-500">{isAr ? 'لا توجد تسميات' : 'No nomenclatures'}</p>}
      </div>

      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label">{isAr ? 'اختبار باركود' : 'Test barcode'}</label>
          <input className={fieldControlClass} value={testCode} onChange={(e) => setTestCode(e.target.value)} />
        </div>
        <button type="button" className={ghostBtn} onClick={() => parse.mutate(testCode)}>{isAr ? 'تحليل' : 'Parse'}</button>
        {parseResult && (
          <pre className="w-full text-xs bg-slate-50 dark:bg-dark-800 p-3 rounded-xl overflow-auto">
            {JSON.stringify(parseResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

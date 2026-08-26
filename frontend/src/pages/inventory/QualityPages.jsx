import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { StatusChip } from './inventoryUi'
import { formatInvError } from '../../lib/invError'

export function QualityPointsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [operationTypeId, setOperationTypeId] = useState('')
  const [instructions, setInstructions] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['quality-points'],
    queryFn: () => api.get('/stock/quality-points', { params: { active: 'false' } }).then((r) => asInvList(r.data)),
  })
  const items = data || []

  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types-all'],
    queryFn: () => api.get('/stock/operation-types').then((r) => asInvList(r.data)),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/quality-points', {
      name,
      operationTypeId,
      instructions: instructions || undefined,
      testType: 'passFail',
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم' : 'Created')
      setName('')
      setInstructions('')
      qc.invalidateQueries({ queryKey: ['quality-points'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'نقاط الجودة' : 'Quality points'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'عند التأكيد تُنشأ فحوصات — يجب اجتيازها قبل الاعتماد'
            : 'Checks are created on confirm — all must pass before validate'}
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); createMut.mutate() }}
      >
        <div>
          <label className="label text-xs">{ar ? 'الاسم' : 'Name'}</label>
          <input className="input input-sm" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'نوع العملية' : 'Operation type'}</label>
          <select className="select select-sm" required value={operationTypeId} onChange={(e) => setOperationTypeId(e.target.value)}>
            <option value="">{ar ? '— اختر —' : '— Select —'}</option>
            {(Array.isArray(opTypes) ? opTypes : []).map((o) => (
              <option key={o._id} value={o._id}>{(ar && o.nameAr) || o.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] grow">
          <label className="label text-xs">{ar ? 'تعليمات' : 'Instructions'}</label>
          <input className="input input-sm w-full" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>
          <Plus className="h-4 w-4" /> {ar ? 'نقطة' : 'Point'}
        </button>
      </form>

      {isLoading ? <div className="text-sm text-slate-500">…</div> : !items.length ? (
        <EmptyState
          title={ar ? 'لا نقاط' : 'No quality points'}
          description={ar ? 'فعّل الجودة من الإعدادات أولاً' : 'Enable Quality checks in Settings first'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2">{ar ? 'العملية' : 'Operation'}</th>
                <th className="px-3 py-2">{ar ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2">{ar ? 'نشط' : 'Active'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((p) => (
                <tr key={p._id}>
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {p.operationTypeId
                      ? ((ar && p.operationTypeId.nameAr) || p.operationTypeId.name)
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5">{p.testType}</td>
                  <td className="px-3 py-2.5">{p.active !== false ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Inline panel for TransferForm Additional / Quality tab */
export function TransferQualityPanel({ transferId, readOnly, language }) {
  const ar = language === 'ar'
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transfer-quality', transferId],
    queryFn: () => api.get(`/stock/transfers/${transferId}/quality-checks`).then((r) => asInvList(r.data)),
    enabled: Boolean(transferId),
  })
  const items = data || []

  const ensureMut = useMutation({
    mutationFn: () => api.post(`/stock/transfers/${transferId}/quality-checks/ensure`).then((r) => r.data),
    onSuccess: () => {
      toast.success(ar ? 'تم مزامنة الفحوصات' : 'Checks synced')
      qc.invalidateQueries({ queryKey: ['transfer-quality', transferId] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const resolveMut = useMutation({
    mutationFn: ({ id, state }) => api.patch(`/stock/quality-checks/${id}`, { state }).then((r) => r.data),
    onSuccess: () => {
      toast.success(ar ? 'تم' : 'Updated')
      qc.invalidateQueries({ queryKey: ['transfer-quality', transferId] })
      qc.invalidateQueries({ queryKey: ['stock-transfer', transferId] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  if (isLoading) return <div className="text-sm text-slate-500">…</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {ar
            ? 'يجب اجتياز كل الفحوصات قبل الاعتماد'
            : 'All checks must pass before validate'}
        </p>
        {!readOnly && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={ensureMut.isPending} onClick={() => ensureMut.mutate()}>
            {ar ? 'مزامنة النقاط' : 'Sync points'}
          </button>
        )}
      </div>
      {!items.length ? (
        <EmptyState
          title={ar ? 'لا فحوصات' : 'No checks'}
          description={ar ? 'أكّد التحويل أو زامن نقاط الجودة' : 'Confirm the transfer or sync quality points'}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c._id} className="rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{c.pointId?.name || '—'}</div>
                  {c.pointId?.instructions ? (
                    <p className="mt-1 text-xs text-slate-500">{c.pointId.instructions}</p>
                  ) : null}
                </div>
                <StatusChip status={c.state === 'none' ? 'waiting' : c.state} language={language} />
              </div>
              {!readOnly && c.state !== 'pass' && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={resolveMut.isPending}
                    onClick={() => resolveMut.mutate({ id: c._id, state: 'pass' })}
                  >
                    {ar ? 'اجتياز' : 'Pass'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={resolveMut.isPending}
                    onClick={() => resolveMut.mutate({ id: c._id, state: 'fail' })}
                  >
                    {ar ? 'فشل' : 'Fail'}
                  </button>
                </div>
              )}
              {c.state === 'fail' && !readOnly && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mt-1"
                  onClick={() => resolveMut.mutate({ id: c._id, state: 'none' })}
                >
                  {ar ? 'إعادة فتح' : 'Reopen'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="text-xs text-slate-400 hover:underline" onClick={() => refetch()}>
        {ar ? 'تحديث' : 'Refresh'}
      </button>
    </div>
  )
}

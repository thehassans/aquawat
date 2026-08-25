import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { StatusChip } from './inventoryUi'

export function BatchTransfersPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [operationTypeId, setOperationTypeId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['batch-transfers'],
    queryFn: () => api.get('/stock/batch-transfers').then((r) => asInvList(r.data)),
  })
  const items = data || []

  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types-all'],
    queryFn: () => api.get('/stock/operation-types').then((r) => asInvList(r.data)),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/batch-transfers', {
      name: name || undefined,
      operationTypeId: operationTypeId || undefined,
    }).then((r) => r.data),
    onSuccess: (doc) => {
      toast.success(ar ? 'تم إنشاء الدفعة' : 'Batch created')
      qc.invalidateQueries({ queryKey: ['batch-transfers'] })
      navigate(`/app/dashboard/inventory/batches/${doc._id}`)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'تحويلات مجمّعة' : 'Batch transfers'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'تجميع تحويلات وتأكيدها/اعتمادها دفعة واحدة — عبر محرك المخزون فقط'
            : 'Group pickings and confirm/validate together — via the stock engine only'}
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); createMut.mutate() }}
      >
        <div>
          <label className="label text-xs">{ar ? 'الاسم' : 'Name'}</label>
          <input className="input input-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="BATCH/…" />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'نوع العملية' : 'Operation type'}</label>
          <select className="select select-sm" value={operationTypeId} onChange={(e) => setOperationTypeId(e.target.value)}>
            <option value="">{ar ? '— أي —' : '— Any —'}</option>
            {(Array.isArray(opTypes) ? opTypes : []).map((o) => (
              <option key={o._id} value={o._id}>{(ar && o.nameAr) || o.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>
          <Plus className="h-4 w-4" /> {ar ? 'دفعة' : 'Batch'}
        </button>
      </form>

      {isLoading ? <div className="text-sm text-slate-500">…</div> : !items.length ? (
        <EmptyState
          title={ar ? 'لا دفعات' : 'No batches'}
          description={ar ? 'فعّل Batch Transfers من الإعدادات إن لزم' : 'Enable Batch Transfers in Settings if needed'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2">{ar ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2">{ar ? 'الحالة' : 'State'}</th>
                <th className="px-3 py-2">{ar ? 'التحويلات' : 'Pickings'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((b) => (
                <tr key={b._id}>
                  <td className="px-3 py-2.5">
                    <Link className="font-medium text-primary-600 hover:underline" to={`/app/dashboard/inventory/batches/${b._id}`}>
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {b.operationTypeId ? ((ar && b.operationTypeId.nameAr) || b.operationTypeId.name) : '—'}
                  </td>
                  <td className="px-3 py-2.5"><StatusChip status={b.state} language={language} /></td>
                  <td className="px-3 py-2.5 tabular-nums">{(b.pickingIds || []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function BatchTransferDetailPage() {
  const { id } = useParams()
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [selected, setSelected] = useState([])
  const [actionLog, setActionLog] = useState(null)

  const { data: batch, isLoading } = useQuery({
    queryKey: ['batch-transfer', id],
    queryFn: () => api.get(`/stock/batch-transfers/${id}`).then((r) => r.data),
  })

  const code = batch?.operationTypeId?.code
  const { data: candidates } = useQuery({
    queryKey: ['batch-candidates', code, id],
    queryFn: () => api.get('/stock/transfers', {
      params: {
        code: code || undefined,
        operationTypeId: batch?.operationTypeId?._id || batch?.operationTypeId || undefined,
        limit: 40,
      },
    }).then((r) => r.data),
    enabled: Boolean(batch),
  })

  const inBatch = new Set((batch?.pickingIds || []).map(String))
  const openCandidates = (candidates?.data || []).filter(
    (t) => !inBatch.has(String(t._id)) && !['done', 'cancelled'].includes(t.state),
  )

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['batch-transfer', id] })
    qc.invalidateQueries({ queryKey: ['batch-transfers'] })
  }

  const actionMut = useMutation({
    mutationFn: ({ action, body }) => api.post(`/stock/batch-transfers/${id}/${action}`, body || {}).then((r) => r.data),
    onSuccess: (res, vars) => {
      setActionLog(res)
      toast.success(
        vars.action === 'add-pickings'
          ? (ar ? `أُضيف ${res.added}` : `Added ${res.added}`)
          : (ar ? `تم · نجح ${res.okCount || 0}` : `Done · ok ${res.okCount || 0}`),
      )
      invalidate()
      setSelected([])
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const closed = batch?.state === 'done' || batch?.state === 'cancelled'
  const pickingPath = (t) => {
    const c = t.operationTypeId?.code || code
    const seg = c === 'incoming' ? 'receipts' : c === 'outgoing' ? 'deliveries' : 'internal'
    return `/app/dashboard/inventory/${seg}/${t._id}`
  }

  if (isLoading) return <div className="text-sm text-slate-500">…</div>
  if (!batch) return <EmptyState title={ar ? 'غير موجود' : 'Not found'} />

  return (
    <div className="mx-auto max-w-5xl space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate('/app/dashboard/inventory/batches')}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{batch.name}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <StatusChip status={batch.state} language={language} />
              {batch.operationTypeId ? ((ar && batch.operationTypeId.nameAr) || batch.operationTypeId.name) : null}
            </div>
          </div>
        </div>
        {!closed && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={actionMut.isPending} onClick={() => actionMut.mutate({ action: 'confirm' })}>
              {ar ? 'تأكيد الكل' : 'Confirm all'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={actionMut.isPending} onClick={() => actionMut.mutate({ action: 'check-availability' })}>
              {ar ? 'توفّر' : 'Check availability'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={actionMut.isPending} onClick={() => actionMut.mutate({ action: 'validate' })}>
              {ar ? 'اعتماد الكل' : 'Validate all'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-rose-600"
              disabled={actionMut.isPending}
              onClick={() => {
                if (window.confirm(ar ? 'إلغاء الدفعة والتحويلات المفتوحة؟' : 'Cancel batch and open pickings?')) {
                  actionMut.mutate({ action: 'cancel' })
                }
              }}
            >
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
        <h3 className="mb-2 text-sm font-semibold">{ar ? 'التحويلات في الدفعة' : 'Pickings in batch'}</h3>
        {!(batch.pickings || []).length ? (
          <p className="text-sm text-slate-500">{ar ? 'فارغة — أضف تحويلات أدناه' : 'Empty — add pickings below'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 text-start">{ar ? 'المرجع' : 'Reference'}</th>
                <th className="py-2 text-start">{ar ? 'الحالة' : 'State'}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(batch.pickings || []).map((t) => (
                <tr key={t._id} className="border-t border-slate-100 dark:border-dark-600">
                  <td className="py-2">
                    <Link className="font-medium text-primary-600 hover:underline" to={pickingPath(t)}>{t.name}</Link>
                  </td>
                  <td className="py-2"><StatusChip status={t.state} language={language} /></td>
                  <td className="py-2 text-end">
                    {!closed && !['done', 'cancelled'].includes(t.state) && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => actionMut.mutate({ action: 'remove-picking', body: { pickingId: t._id } })}
                      >
                        {ar ? 'إزالة' : 'Remove'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!closed && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <h3 className="mb-2 text-sm font-semibold">{ar ? 'إضافة تحويلات مفتوحة' : 'Add open pickings'}</h3>
          {!openCandidates.length ? (
            <p className="text-sm text-slate-500">{ar ? 'لا مرشحين' : 'No candidates'}</p>
          ) : (
            <>
              <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto text-sm">
                {openCandidates.map((t) => (
                  <li key={t._id}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(t._id)}
                        onChange={(e) => {
                          setSelected((prev) => (e.target.checked
                            ? [...prev, t._id]
                            : prev.filter((x) => x !== t._id)))
                        }}
                      />
                      <span className="font-medium">{t.name}</span>
                      <StatusChip status={t.state} language={language} />
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!selected.length || actionMut.isPending}
                onClick={() => actionMut.mutate({ action: 'add-pickings', body: { pickingIds: selected } })}
              >
                {ar ? `إضافة (${selected.length})` : `Add (${selected.length})`}
              </button>
            </>
          )}
        </div>
      )}

      {actionLog?.results && (
        <pre className="overflow-auto rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs dark:border-dark-600 dark:bg-dark-900">
          {JSON.stringify({ okCount: actionLog.okCount, failCount: actionLog.failCount, results: actionLog.results }, null, 2)}
        </pre>
      )}
    </div>
  )
}

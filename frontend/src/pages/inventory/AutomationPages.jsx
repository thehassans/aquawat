import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Play, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import toast from 'react-hot-toast'
import { formatInvError } from '../../lib/invError'
import ReplenishmentWorksheet from './ReplenishmentWorksheet'

export default function ReplenishmentPage() {
  return <ReplenishmentWorksheet />
}

export function RoutesRulesPage() {
  const { language } = useSelector((s) => s.ui)
  const [routeId, setRouteId] = useState('')

  const { data: routesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ['inv-routes'],
    queryFn: () => api.get('/stock/routes').then((r) => asInvList(r.data)),
  })
  const { data: rulesData, isLoading: loadingRules } = useQuery({
    queryKey: ['inv-rules', routeId],
    queryFn: () =>
      api.get('/stock/rules', { params: { routeId: routeId || undefined } }).then((r) => asInvList(r.data)),
  })

  const routes = routesData || []
  const rules = rulesData || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'المسارات والقواعد' : 'Routes & Rules'}
        </h2>
        <p className="text-sm text-slate-500">
          {language === 'ar'
            ? 'مسارات التوريد والسحب والدفع بين المواقع'
            : 'Pull, push, buy, and resupply paths between locations'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/80 p-4 dark:border-dark-600">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {language === 'ar' ? 'المسارات' : 'Routes'}
          </h3>
          {loadingRoutes ? (
            <div className="text-sm text-slate-400">…</div>
          ) : !routes.length ? (
            <EmptyState
              title={language === 'ar' ? 'لا مسارات' : 'No routes yet'}
              description={language === 'ar'
                ? 'أعد حساب مسارات المستودع من إعدادات الخطوات'
                : 'Recompute warehouse routes from step settings'}
            />
          ) : (
            <ul className="space-y-1">
              {routes.map((r) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => setRouteId(r._id === routeId ? '' : r._id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm transition-colors ${
                      routeId === r._id
                        ? 'bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-200'
                        : 'hover:bg-slate-50 dark:hover:bg-dark-800'
                    }`}
                  >
                    <span className={r.active ? '' : 'line-through opacity-50'}>{r.name}</span>
                    <span className="text-xs text-slate-400">#{r.sequence}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/80 p-4 dark:border-dark-600">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {language === 'ar' ? 'القواعد' : 'Rules'}
            {routeId && <span className="ms-2 font-normal normal-case text-slate-400">(filtered)</span>}
          </h3>
          {loadingRules ? (
            <div className="text-sm text-slate-400">…</div>
          ) : !rules.length ? (
            <p className="text-sm text-slate-500">{language === 'ar' ? 'لا قواعد' : 'No rules'}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-dark-700">
              {rules.map((rule) => (
                <li key={rule._id} className="py-2.5 text-sm">
                  <div className="font-medium text-slate-900 dark:text-white">{rule.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {rule.action} · {rule.procureMethod}
                    {rule.sourceLocationId?.completePath && (
                      <> · {rule.sourceLocationId.completePath} → {rule.destLocationId?.completePath}</>
                    )}
                    {!rule.sourceLocationId && rule.destLocationId?.completePath && (
                      <> · → {rule.destLocationId.completePath}</>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export function SchedulerPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['inv-scheduler'],
    queryFn: () => api.get('/stock/scheduler').then((r) => r.data),
  })

  const { data: runsData } = useQuery({
    queryKey: ['inv-scheduler-runs'],
    queryFn: () => api.get('/stock/scheduler/runs').then((r) => asInvList(r.data)),
  })

  const runMut = useMutation({
    mutationFn: () => api.post('/stock/scheduler/run'),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'اكتمل التشغيل' : 'Scheduler finished')
      qc.invalidateQueries({ queryKey: ['inv-scheduler'] })
      qc.invalidateQueries({ queryKey: ['inv-scheduler-runs'] })
      qc.invalidateQueries({ queryKey: ['replenishment'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const runs = runsData || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'مجدول المخزون' : 'Inventory Scheduler'}
          </h2>
          <p className="text-sm text-slate-500">
            {language === 'ar'
              ? 'تقييم قواعد إعادة الطلب وإعادة الحجز'
              : 'Evaluate reorder rules and retry reservations'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={runMut.isPending}
          onClick={() => runMut.mutate()}
        >
          <Play className="h-4 w-4" />
          {language === 'ar' ? 'تشغيل الآن' : 'Run now'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: language === 'ar' ? 'مفعّل' : 'Enabled',
            value: status?.schedulerEnabled
              ? (language === 'ar' ? 'نعم' : 'Yes')
              : (language === 'ar' ? 'لا (يدوي)' : 'No (manual)'),
          },
          {
            label: language === 'ar' ? 'آخر حالة' : 'Last status',
            value: status?.lastRun?.status || '—',
          },
          {
            label: language === 'ar' ? 'توريدات آخر تشغيل' : 'Last procurements',
            value: status?.lastRun?.procurementsCreated ?? '—',
          },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200/80 px-4 py-3 dark:border-dark-600">
            <div className="text-xs uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{c.value}</div>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {language === 'ar' ? 'سجل التشغيل' : 'Run history'}
        </h3>
        {!runs.length ? (
          <p className="text-sm text-slate-500">{language === 'ar' ? 'لا تشغيلات بعد' : 'No runs yet'}</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 dark:divide-dark-700 dark:border-dark-600">
            {runs.map((run) => (
              <li key={run._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">{run.status}</span>
                  <span className="ms-2 text-slate-400">{run.trigger}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {run.rulesEvaluated ?? 0} rules · {run.procurementsCreated ?? 0} procure ·{' '}
                  {run.reservationsRetried ?? 0} reserve
                  {run.startedAt && ` · ${new Date(run.startedAt).toLocaleString()}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function PutawayPage() {
  const { language } = useSelector((s) => s.ui)

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['putaway-rules'],
    queryFn: () => api.get('/stock/putaway-rules').then((r) => asInvList(r.data)),
  })
  const { data: catsData } = useQuery({
    queryKey: ['storage-categories'],
    queryFn: () => api.get('/stock/storage-categories').then((r) => asInvList(r.data)),
  })

  const rules = rulesData || []
  const cats = catsData || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'التخزين والتصنيف' : 'Putaway & Storage'}
        </h2>
        <p className="text-sm text-slate-500">
          {language === 'ar'
            ? 'توجيه الاستلام إلى مواقع فرعية حسب المنتج أو الفئة'
            : 'Route receipts into bins by product or category'}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200/80 p-4 dark:border-dark-600">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {language === 'ar' ? 'قواعد التخزين' : 'Putaway rules'}
        </h3>
        {isLoading ? (
          <div className="text-sm text-slate-400">…</div>
        ) : !rules.length ? (
          <EmptyState title={language === 'ar' ? 'لا قواعد' : 'No putaway rules'} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-dark-700">
            {rules.map((r) => (
              <li key={r._id} className="py-2 text-sm">
                <span className="font-medium">#{r.sequence}</span>
                {' · '}
                {r.fromLocationId?.completePath || '—'}
                {' → '}
                {r.toLocationId?.completePath || '—'}
                {r.productId && (
                  <span className="text-slate-500"> · {r.productId.nameEn || r.productId.sku}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200/80 p-4 dark:border-dark-600">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {language === 'ar' ? 'فئات التخزين' : 'Storage categories'}
        </h3>
        {!cats.length ? (
          <p className="text-sm text-slate-500">{language === 'ar' ? 'لا فئات' : 'None yet'}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {cats.map((c) => (
              <li key={c._id} className="text-slate-800 dark:text-slate-200">
                {c.name}
                <span className="ms-2 text-xs text-slate-400">{c.allowNewProduct}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

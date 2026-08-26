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

export default function ReplenishmentPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [warehouseId, setWarehouseId] = useState('')

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['replenishment', warehouseId],
    queryFn: () =>
      api.get('/stock/replenishment', {
        params: { warehouseId: warehouseId || undefined },
      }).then((r) => r.data),
  })

  const orderMut = useMutation({
    mutationFn: (row) =>
      api.post('/stock/replenishment/order', {
        productId: row.productId?._id || row.productId,
        locationId: row.locationId?._id || row.locationId,
        warehouseId: row.warehouseId?._id || row.warehouseId,
        qty: row.qtyToOrder,
        routeId: row.routeId?._id || row.routeId,
      }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إنشاء التوريد' : 'Procurement created')
      qc.invalidateQueries({ queryKey: ['replenishment'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const snoozeMut = useMutation({
    mutationFn: ({ id, preset }) => api.post(`/stock/reorder-rules/${id}/snooze`, { preset }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم التأجيل' : 'Snoozed')
      qc.invalidateQueries({ queryKey: ['replenishment'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const items = data?.items || []
  const needOrder = items.filter((r) => Number(r.qtyToOrder) > 0 && !r.snoozed)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'إعادة التوريد' : 'Replenishment'}
          </h2>
          <p className="text-sm text-slate-500">
            {language === 'ar'
              ? 'قواعد الحد الأدنى والتوقعات السالبة'
              : 'Reorder rules and negative forecast suggestions'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input input-sm min-w-[10rem]"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">{language === 'ar' ? 'كل المستودعات' : 'All warehouses'}</option>
            {(warehouses || []).map((w) => (
              <option key={w._id} value={w._id}>{w.name || w.code}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <Link to="/app/dashboard/inventory/scheduler" className="btn btn-secondary btn-sm">
            {language === 'ar' ? 'المجدول' : 'Scheduler'}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState
          title={language === 'ar' ? 'لا توجد بنود' : 'Nothing to replenish'}
          description={language === 'ar' ? 'أضف قواعد إعادة الطلب أو انتظر توقعات سالبة' : 'Add reorder rules or wait for negative forecasts'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="px-3 py-2">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'متاح' : 'On hand'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'متوقع' : 'Forecast'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'للطلب' : 'To order'}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row) => {
                const pid = row.productId?._id || row.productId
                const name = row.productId?.nameEn || row.productId?.sku || String(pid)
                const whName = row.warehouseId?.name || row.warehouseId?.code || '—'
                return (
                  <tr key={row._id} className={row.snoozed ? 'opacity-50' : ''}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900 dark:text-white">{name}</div>
                      <div className="text-xs text-slate-400">
                        {row.kind === 'virtual'
                          ? (language === 'ar' ? 'افتراضي' : 'Virtual')
                          : (language === 'ar' ? 'دائم' : 'Rule')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{whName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.qtyOnHand}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.qtyForecast}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-primary-700 dark:text-primary-300">
                      {row.qtyToOrder}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {Number(row.qtyToOrder) > 0 && !row.snoozed && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={orderMut.isPending}
                          onClick={() => orderMut.mutate(row)}
                        >
                          {language === 'ar' ? 'اطلب' : 'Order'}
                        </button>
                      )}
                      {row.kind === 'permanent' && !String(row._id).startsWith('virtual') && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm ms-1"
                          onClick={() => snoozeMut.mutate({ id: row._id, preset: '1w' })}
                        >
                          {language === 'ar' ? 'تأجيل' : 'Snooze'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {needOrder.length > 0 && (
        <p className="text-xs text-slate-500">
          {language === 'ar'
            ? `${needOrder.length} بند يحتاج توريد`
            : `${needOrder.length} line(s) need ordering`}
        </p>
      )}
    </div>
  )
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

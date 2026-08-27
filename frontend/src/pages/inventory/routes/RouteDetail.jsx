import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Plus, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import EmptyState from '../../../components/ui/EmptyState'
import { invTableClass, invThClass, invTdClass } from '../inventoryUi'
import { ConfigModal } from '../ConfigModal'

const ACTIONS = [
  { value: 'pull', en: 'Pull From', ar: 'سحب من' },
  { value: 'push', en: 'Push To', ar: 'دفع إلى' },
  { value: 'buy', en: 'Buy', ar: 'شراء' },
  { value: 'manufacture', en: 'Manufacture', ar: 'تصنيع' },
]

const SUPPLY = [
  { value: 'makeToStock', en: 'Take From Stock', ar: 'من المخزون' },
  { value: 'makeToOrder', en: 'Trigger Another Rule', ar: 'تشغيل قاعدة أخرى' },
]

const APPLICABLE = [
  { key: 'categorySelectable', en: 'Product Categories', ar: 'فئات المنتجات' },
  { key: 'productSelectable', en: 'Products', ar: 'المنتجات' },
  { key: 'warehouseSelectable', en: 'Warehouses', ar: 'المستودعات' },
  { key: 'saleOrderSelectable', en: 'Sales Order Lines', ar: 'بنود أوامر البيع' },
]

function actionLabel(action, ar) {
  const m = ACTIONS.find((a) => a.value === action)
  return m ? (ar ? m.ar : m.en) : action
}

function supplyLabel(method, ar) {
  const m = SUPPLY.find((a) => a.value === method)
  return m ? (ar ? m.ar : m.en) : method
}

function emptyRuleForm() {
  return {
    action: 'pull',
    operationTypeId: '',
    sourceLocationId: '',
    destLocationId: '',
    procureMethod: 'makeToStock',
    name: '',
  }
}

/**
 * Route detail — Applicable On toggles + nested logistics rules grid.
 */
export default function RouteDetail() {
  const { routeId } = useParams()
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [flags, setFlags] = useState({
    categorySelectable: true,
    productSelectable: true,
    warehouseSelectable: true,
    saleOrderSelectable: false,
  })
  const [dirty, setDirty] = useState(false)
  const [ruleModal, setRuleModal] = useState(false)
  const [ruleForm, setRuleForm] = useState(emptyRuleForm())

  const { data: route, isLoading } = useQuery({
    queryKey: ['inv-route', routeId],
    queryFn: () => api.get(`/stock/routes/${routeId}`).then((r) => r.data),
    enabled: Boolean(routeId),
  })

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['inv-rules', routeId],
    queryFn: () => api.get('/stock/rules', { params: { routeId } }).then((r) => asInvList(r.data)),
    enabled: Boolean(routeId),
  })

  const { data: opTypes = [] } = useQuery({
    queryKey: ['inv-operation-types'],
    queryFn: () => api.get('/stock/operation-types').then((r) => asInvList(r.data)),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inv-locations-all-active'],
    queryFn: () => api.get('/stock/locations', { params: { active: 'true' } }).then((r) => asInvList(r.data)),
  })

  useEffect(() => {
    if (!route) return
    setName(route.name || '')
    setActive(route.active !== false)
    setFlags({
      categorySelectable: route.categorySelectable !== false,
      productSelectable: route.productSelectable !== false,
      warehouseSelectable: route.warehouseSelectable !== false,
      saleOrderSelectable: !!route.saleOrderSelectable,
    })
    setDirty(false)
  }, [route])

  const saveMut = useMutation({
    mutationFn: () => api.patch(`/stock/routes/${routeId}`, {
      name,
      active,
      ...flags,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم حفظ المسار' : 'Route saved')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['inv-route', routeId] })
      qc.invalidateQueries({ queryKey: ['inv-routes'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const createRuleMut = useMutation({
    mutationFn: () => api.post('/stock/rules', {
      routeId,
      name: ruleForm.name || undefined,
      action: ruleForm.action,
      operationTypeId: ruleForm.operationTypeId || null,
      sourceLocationId: ruleForm.sourceLocationId || null,
      destLocationId: ruleForm.destLocationId || null,
      procureMethod: ruleForm.procureMethod,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تمت إضافة القاعدة' : 'Rule added')
      setRuleModal(false)
      setRuleForm(emptyRuleForm())
      qc.invalidateQueries({ queryKey: ['inv-rules', routeId] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const locLabel = (l) => l.completePath || l.name || String(l._id)
  const opLabel = (o) => o.name || o.code || String(o._id)

  if (isLoading && !route) {
    return <div className="text-sm text-slate-400">…</div>
  }

  if (!route && !isLoading) {
    return (
      <div className="space-y-3">
        <EmptyState title={ar ? 'المسار غير موجود' : 'Route not found'} />
        <div className="text-center">
          <Link to="/app/dashboard/inventory/routes" className="text-sm text-sky-800 hover:underline">
            {ar ? 'العودة للمسارات' : 'Back to routes'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col gap-5" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-icon mt-0.5"
            onClick={() => navigate('/app/dashboard/inventory/routes')}
            aria-label={ar ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {ar ? 'إعداد المسار' : 'Route configuration'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {ar
                ? 'حدد أين يُطبَّق المسار، ثم أضف قواعد السحب/الدفع/الشراء.'
                : 'Set where this route applies, then add pull / push / buy rules.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!dirty || saveMut.isPending || !name.trim()}
          onClick={() => saveMut.mutate()}
        >
          <Save className="h-4 w-4" />
          {ar ? 'حفظ المسار' : 'Save route'}
        </button>
      </div>

      {/* Header + Applicable On */}
      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label text-xs">{ar ? 'اسم المسار' : 'Route name'}</label>
            <input
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setDirty(true)
              }}
              placeholder={ar ? 'Cross-Dock' : 'Cross-Dock'}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={active}
                onChange={(e) => {
                  setActive(e.target.checked)
                  setDirty(true)
                }}
              />
              {ar ? 'المسار نشط' : 'Route is active'}
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {ar ? 'ينطبق على' : 'Applicable on'}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {APPLICABLE.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800 dark:border-dark-600 dark:bg-dark-900/40 dark:text-slate-100"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={!!flags[item.key]}
                  onChange={(e) => {
                    setFlags((f) => ({ ...f, [item.key]: e.target.checked }))
                    setDirty(true)
                  }}
                />
                {ar ? item.ar : item.en}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Nested rules grid — visually distinct */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300/80 bg-slate-100/90 dark:border-dark-500 dark:bg-dark-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-dark-600">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {ar ? 'قواعد المسار' : 'Route rules'}
            </h3>
            <p className="text-xs text-slate-500">
              {ar ? 'خطوات اللوجستيات داخل هذا المسار' : 'Logistics steps nested under this route'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setRuleForm(emptyRuleForm())
              setRuleModal(true)
            }}
          >
            <Plus className="h-4 w-4" />
            {ar ? 'إضافة قاعدة' : 'Add rule'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingRules ? (
            <div className="px-4 py-6 text-sm text-slate-400">…</div>
          ) : !rules.length ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {ar ? 'لا قواعد بعد — أضف قاعدة لوجستية.' : 'No rules yet — add a logistics rule.'}
            </p>
          ) : (
            <table className={`${invTableClass} min-w-[900px]`}>
              <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-200/80 text-start text-xs uppercase tracking-wide text-slate-600 backdrop-blur dark:border-dark-600 dark:bg-dark-800/95 dark:text-slate-400">
                <tr>
                  <th className={invThClass}>{ar ? 'الإجراء' : 'Action'}</th>
                  <th className={invThClass}>{ar ? 'نوع العملية' : 'Operation type'}</th>
                  <th className={invThClass}>{ar ? 'المصدر' : 'Source'}</th>
                  <th className={invThClass}>{ar ? 'الوجهة' : 'Destination'}</th>
                  <th className={invThClass}>{ar ? 'طريقة التوريد' : 'Supply method'}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule._id} className="border-b border-slate-200/60 bg-white/70 dark:border-dark-700 dark:bg-dark-800/50">
                    <td className={`${invTdClass} font-medium text-slate-900 dark:text-slate-100`}>
                      {actionLabel(rule.action, ar)}
                      {rule.name ? <div className="text-xs font-normal text-slate-400">{rule.name}</div> : null}
                    </td>
                    <td className={invTdClass}>
                      {rule.operationTypeId?.name || rule.operationTypeId?.code || '—'}
                    </td>
                    <td className={invTdClass}>
                      {rule.sourceLocationId?.completePath || rule.sourceLocationId?.name || '—'}
                    </td>
                    <td className={invTdClass}>
                      {rule.destLocationId?.completePath || rule.destLocationId?.name || '—'}
                    </td>
                    <td className={invTdClass}>{supplyLabel(rule.procureMethod, ar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ConfigModal
        open={ruleModal}
        onClose={() => setRuleModal(false)}
        ar={ar}
        wide
        title={ar ? 'إضافة قاعدة لوجستية' : 'Add logistics rule'}
        subtitle={name}
        footer={(
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRuleModal(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={
                createRuleMut.isPending
                || (!ruleForm.destLocationId && ruleForm.action !== 'buy' && ruleForm.action !== 'manufacture')
              }
              onClick={() => createRuleMut.mutate()}
            >
              {ar ? 'إضافة' : 'Add'}
            </button>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label text-xs">{ar ? 'الإجراء' : 'Action'}</label>
            <select
              className="select"
              value={ruleForm.action}
              onChange={(e) => setRuleForm((f) => ({ ...f, action: e.target.value }))}
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{ar ? a.ar : a.en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">{ar ? 'نوع العملية' : 'Operation type'}</label>
            <select
              className="select"
              value={ruleForm.operationTypeId}
              onChange={(e) => setRuleForm((f) => ({ ...f, operationTypeId: e.target.value }))}
            >
              <option value="">{ar ? '— اختياري —' : '— Optional —'}</option>
              {opTypes.map((o) => (
                <option key={o._id} value={o._id}>{opLabel(o)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">{ar ? 'موقع المصدر' : 'Source location'}</label>
            <select
              className="select"
              value={ruleForm.sourceLocationId}
              onChange={(e) => setRuleForm((f) => ({ ...f, sourceLocationId: e.target.value }))}
            >
              <option value="">{ar ? '— —' : '— —'}</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{locLabel(l)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">{ar ? 'موقع الوجهة' : 'Destination location'}</label>
            <select
              className="select"
              value={ruleForm.destLocationId}
              onChange={(e) => setRuleForm((f) => ({ ...f, destLocationId: e.target.value }))}
            >
              <option value="">{ar ? '— —' : '— —'}</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{locLabel(l)}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label text-xs">{ar ? 'طريقة التوريد' : 'Supply method'}</label>
            <select
              className="select"
              value={ruleForm.procureMethod}
              onChange={(e) => setRuleForm((f) => ({ ...f, procureMethod: e.target.value }))}
            >
              {SUPPLY.map((s) => (
                <option key={s.value} value={s.value}>{ar ? s.ar : s.en}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label text-xs">{ar ? 'اسم القاعدة (اختياري)' : 'Rule name (optional)'}</label>
            <input
              className="input"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={ar ? 'مثلاً: سحب من المخزون' : 'e.g. Pull from stock'}
            />
          </div>
        </div>
      </ConfigModal>
    </div>
  )
}

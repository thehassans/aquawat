import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  Search, CreditCard, Trash2, RefreshCw, Building2, ExternalLink, Wallet, Pencil, Check, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatSubscriptionDate, toIsoDay } from '../../lib/subscriptionState'
import { TenantLogoAvatar } from '../../components/super-admin/SuperAdminPortal'
import DayMonthYearInput from '../../components/ui/DayMonthYearInput'

const methodLabel = (method, isAr) => {
  switch (String(method || '').toLowerCase()) {
    case 'bank_transfer':
      return isAr ? 'تحويل بنكي' : 'Bank transfer'
    case 'cash':
      return isAr ? 'نقداً' : 'Cash'
    case 'card':
      return isAr ? 'بطاقة' : 'Card'
    case 'stc_pay':
      return 'STC Pay'
    default:
      return method || (isAr ? 'أخرى' : 'Other')
  }
}

export default function TenantPayments() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [billingCycle, setBillingCycle] = useState('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({ periodStart: '', periodEnd: '' })

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['tenant-payments', page, search, plan, billingCycle],
    queryFn: async () => {
      const res = await api.get('/super-admin/tenant-payments', {
        params: {
          page,
          limit: 25,
          search: search || undefined,
          plan: plan || undefined,
          billingCycle: billingCycle || undefined,
        },
      })
      return res.data
    },
    staleTime: 30 * 1000,
  })

  const payments = data?.payments || []
  const pagination = data?.pagination || { page: 1, pages: 0, total: 0 }
  const stats = data?.stats || { count: 0, totalAmount: 0 }

  const removeMutation = useMutation({
    mutationFn: (paymentId) => api.delete(`/super-admin/tenant-payments/${paymentId}`).then((res) => res.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الدفعة' : 'Payment removed')
      queryClient.invalidateQueries({ queryKey: ['tenant-payments'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to remove payment'),
  })

  const updatePeriodMutation = useMutation({
    mutationFn: ({ paymentId, periodStart, periodEnd }) =>
      api.patch(`/super-admin/tenant-payments/${paymentId}`, { periodStart, periodEnd }).then((res) => res.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث الفترة' : 'Period updated')
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['tenant-payments'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update period'),
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'مدفوعات المستأجرين' : 'Tenant Payments'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isAr
              ? 'سجل باقات الاشتراك المدفوعة لكل مستأجر — المصدر الوحيد لمدفوعات المنصة.'
              : 'SaaS package payments for every tenant — the source of truth for platform billing.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">{isAr ? 'إجمالي المسجّل' : 'Total recorded'}</p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                {Number(stats.totalAmount || 0).toFixed(2)} SAR
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-2 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">{isAr ? 'عدد الدفعات' : 'Payments'}</p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{stats.count || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">{isAr ? 'هذه الصفحة' : 'This page'}</p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{payments.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder={isAr ? 'بحث بالاسم أو المعرف…' : 'Search tenant name or slug…'}
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
          />
        </div>
        <select
          className="input w-auto"
          value={plan}
          onChange={(e) => {
            setPage(1)
            setPlan(e.target.value)
          }}
        >
          <option value="">{isAr ? 'كل الخطط' : 'All plans'}</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select
          className="input w-auto"
          value={billingCycle}
          onChange={(e) => {
            setPage(1)
            setBillingCycle(e.target.value)
          }}
        >
          <option value="">{isAr ? 'كل الدورات' : 'All billing'}</option>
          <option value="monthly">{isAr ? 'شهري' : 'Monthly'}</option>
          <option value="yearly">{isAr ? 'سنوي' : 'Yearly'}</option>
        </select>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-800"
      >
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700 dark:text-gray-200">
              {isAr ? 'لا توجد مدفوعات مسجّلة' : 'No tenant payments yet'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {isAr
                ? 'سجّل دفعة من صفحة المستأجرين (تسجيل دفعة / تجديد). السجل القديميم أُزيل.'
                : 'Record a payment from Tenants (Record payment / renew). Legacy history was cleared.'}
            </p>
            <Link to="/super-admin/tenants" className="btn btn-primary mt-4 inline-flex">
              <Building2 className="h-4 w-4" />
              {isAr ? 'المستأجرون' : 'Go to tenants'}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>{isAr ? 'المستأجر' : 'Tenant'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th>{isAr ? 'الخطة' : 'Plan'}</th>
                  <th>{isAr ? 'الفترة' : 'Period'}</th>
                  <th>{isAr ? 'الطريقة' : 'Method'}</th>
                  <th>{isAr ? 'المرجع' : 'Reference'}</th>
                  <th className="w-12">{isAr ? 'حذف' : 'Remove'}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => {
                  const tenant = row.tenantId && typeof row.tenantId === 'object' ? row.tenantId : null
                  const cycles = Math.max(1, Number(row.cycles) || 1)
                  const unit = Number.isFinite(Number(row.unitPrice))
                    ? Number(row.unitPrice)
                    : (Number(row.amount) || 0) / cycles
                  return (
                    <tr key={row._id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <TenantLogoAvatar tenant={tenant} className="h-8 w-8" letterClassName="text-white text-xs font-bold" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900 dark:text-white">
                              {tenant?.name || '—'}
                            </p>
                            <p className="truncate text-xs text-gray-400">{tenant?.slug || ''}</p>
                          </div>
                          {tenant?._id ? (
                            <Link
                              to={`/super-admin/tenants/${tenant._id}`}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-dark-700"
                              title={isAr ? 'تعديل المستأجر' : 'Edit tenant'}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {row.recordedAt ? formatSubscriptionDate(row.recordedAt, language) : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        <p className="font-semibold tabular-nums">
                          {Number(row.amount || 0).toFixed(2)} {row.currency || 'SAR'}
                        </p>
                        <p className="text-xs tabular-nums text-gray-400">
                          {unit.toFixed(2)}/{row.billingCycle === 'yearly' ? (isAr ? 'سنة' : 'yr') : (isAr ? 'شهر' : 'mo')}
                          {' · '}
                          {cycles} {isAr ? 'دورة' : `cycle${cycles > 1 ? 's' : ''}`}
                        </p>
                      </td>
                      <td className="capitalize whitespace-nowrap">
                        {row.plan || '—'}
                        <span className="text-gray-400"> · {row.billingCycle || '—'}</span>
                      </td>
                      <td className="min-w-[14rem] text-xs text-gray-600 dark:text-gray-300">
                        {editingId === row._id ? (
                          <div className="flex flex-col gap-1.5 py-1">
                            <div className="flex items-center gap-1.5">
                              <DayMonthYearInput
                                className="input input-sm py-1 text-xs w-[7.5rem] tabular-nums"
                                value={draft.periodStart}
                                onChange={(iso) => setDraft((d) => ({ ...d, periodStart: iso }))}
                              />
                              <span className="text-gray-400">→</span>
                              <DayMonthYearInput
                                className="input input-sm py-1 text-xs w-[7.5rem] tabular-nums"
                                value={draft.periodEnd}
                                onChange={(iso) => setDraft((d) => ({ ...d, periodEnd: iso }))}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700 disabled:opacity-50"
                                disabled={updatePeriodMutation.isPending || !draft.periodStart || !draft.periodEnd}
                                onClick={() => updatePeriodMutation.mutate({
                                  paymentId: row._id,
                                  periodStart: draft.periodStart,
                                  periodEnd: draft.periodEnd,
                                })}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="tabular-nums">
                              {row.periodStart || row.periodEnd
                                ? `${formatSubscriptionDate(row.periodStart, language)} → ${formatSubscriptionDate(row.periodEnd, language)}`
                                : '—'}
                            </span>
                            <button
                              type="button"
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-dark-700"
                              title={isAr ? 'تعديل الفترة' : 'Edit period'}
                              onClick={() => {
                                setEditingId(row._id)
                                setDraft({
                                  periodStart: toIsoDay(row.periodStart),
                                  periodEnd: toIsoDay(row.periodEnd),
                                })
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>{methodLabel(row.method, isAr)}</td>
                      <td className="max-w-[10rem] truncate font-mono text-xs" title={row.reference || ''}>
                        {row.reference || '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                          title={isAr ? 'حذف الدفعة' : 'Remove payment'}
                          disabled={removeMutation.isPending && removeMutation.variables === row._id}
                          onClick={() => {
                            if (!window.confirm(isAr ? 'حذف هذه الدفعة؟' : 'Remove this payment?')) return
                            removeMutation.mutate(row._id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-dark-700">
            <p className="text-sm text-gray-500">
              {isAr ? `صفحة ${pagination.page} من ${pagination.pages}` : `Page ${pagination.page} of ${pagination.pages}`}
              {' · '}
              {pagination.total} {isAr ? 'سجل' : 'total'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {isAr ? 'السابق' : 'Prev'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}

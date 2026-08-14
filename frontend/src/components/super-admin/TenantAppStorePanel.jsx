import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Search, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import App3DIcon from '../ui/App3DIcon'

const FEATURED_APP_IDS = [
  'email_suite',
  'sms_marketing',
  'iot_devices',
  'weight_scale_driver',
  'multi_branch',
  'delivery_platforms',
  'restaurant_mess',
  'restaurant_combos',
  'qr_menu_ordering',
]

export default function TenantAppStorePanel({ tenantId, language = 'en' }) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-tenant-apps', tenantId],
    queryFn: () => api.get(`/super-admin/tenants/${tenantId}/apps`).then((res) => res.data),
    enabled: Boolean(tenantId),
  })

  const apps = data?.apps || []

  const toggleMutation = useMutation({
    mutationFn: ({ appId, action }) =>
      api.put(`/super-admin/tenants/${tenantId}/apps/${appId}`, { action }).then((res) => res.data),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === 'uninstall'
          ? (isAr ? 'تم إلغاء تثبيت التطبيق' : 'App uninstalled')
          : (isAr ? 'تم تثبيت التطبيق' : 'App installed')
      )
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenant-apps', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update app'),
    onSettled: () => setBusyId(''),
  })

  const featured = useMemo(
    () => FEATURED_APP_IDS.map((id) => apps.find((app) => app.appId === id)).filter(Boolean),
    [apps]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((app) =>
      [app.nameEn, app.nameAr, app.taglineEn, app.taglineAr, app.appId, app.badge]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
  }, [apps, search])

  const handleToggle = (app) => {
    const action = app.isInstalled ? 'uninstall' : 'install'
    setBusyId(app.appId)
    toggleMutation.mutate({ appId: app.appId, action })
  }

  const renderCard = (app, featuredCard = false) => {
    const installing = busyId === app.appId
    return (
      <div
        key={app.appId}
        className={`flex flex-col gap-3 rounded-2xl border p-4 ${
          app.isInstalled
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20'
            : featuredCard
              ? 'border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-800'
              : 'border-slate-200/80 bg-white/80 dark:border-dark-700 dark:bg-dark-800/70'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-dark-700">
            <App3DIcon appId={app.appId} icon={app.icon} path={app.defaultRoute} label={app.nameEn} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {isAr ? app.nameAr : app.nameEn}
              </h4>
              {app.badge ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {app.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {isAr ? app.taglineAr : app.taglineEn}
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          {app.isInstalled ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              {app.trialActive
                ? (isAr ? `تجربة · ${app.trialDaysRemaining} يوم` : `Trial · ${app.trialDaysRemaining}d left`)
                : (isAr ? 'مثبت' : 'Installed')}
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              {app.trialExpired || app.trialUsed
                ? (isAr ? 'التجربة مستخدمة' : 'Trial used')
                : (isAr ? 'غير مثبت' : 'Not installed')}
            </span>
          )}
          <button
            type="button"
            disabled={installing}
            onClick={() => handleToggle(app)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
              app.isInstalled
                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-dark-600 dark:bg-dark-900 dark:text-slate-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {installing
              ? (isAr ? 'جاري...' : 'Working...')
              : app.isInstalled
                ? (isAr ? 'إلغاء التثبيت' : 'Uninstall')
                : (isAr ? 'تثبيت' : 'Install')}
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="md:col-span-3 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isAr ? 'متجر التطبيقات' : 'App Store'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAr
                ? 'ثبّت أو ألغِ تثبيت التطبيقات لهذا المستأجر. الصلاحيات تُفعَّل من المتجر وليس من قائمة إضافات.'
                : 'Install or uninstall apps for this tenant. Entitlements come from the App Store, not a checklist of add-ons.'}
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input ps-9"
            placeholder={isAr ? 'بحث في الكتالوج...' : 'Search catalog...'}
          />
        </div>
      </div>

      {!search && featured.length > 0 ? (
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
            {isAr ? 'التطبيقات الأساسية' : 'Core apps'}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((app) => renderCard(app, true))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
          {search ? (isAr ? 'نتائج البحث' : 'Search results') : (isAr ? 'كل التطبيقات' : 'Full catalog')}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((app) => renderCard(app))}
        </div>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{isAr ? 'لا توجد تطبيقات مطابقة' : 'No matching apps'}</p>
        ) : null}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Download, Database, Search, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

async function downloadBackup(path) {
  const res = await api.get(path, { responseType: 'blob', timeout: 600000 })
  const cd = res.headers['content-disposition'] || ''
  const match = /filename="?([^";]+)"?/i.exec(cd)
  const filename = match ? match[1] : `backup-${new Date().toISOString().slice(0, 10)}.jsonl.gz`
  const blob = new Blob([res.data], { type: 'application/gzip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function SuperAdminBackups() {
  const { language } = useSelector((s) => s.ui)
  const isArabic = language === 'ar'
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-backup-tenants', search],
    queryFn: () => api.get('/super-admin/tenants', { params: { page: 1, limit: 50, search } }).then((r) => r.data),
    staleTime: 30 * 1000,
  })

  const tenants = Array.isArray(data?.tenants) ? data.tenants : []

  const runDownload = async (key, path) => {
    setBusy(key)
    try {
      await downloadBackup(path)
      toast.success(isArabic ? 'بدأ التنزيل' : 'Download started')
    } catch (err) {
      toast.error(err.response?.data?.error || (isArabic ? 'فشل التنزيل' : 'Download failed'))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
          {isArabic ? 'المشرف العام' : 'Super Admin'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {isArabic ? 'النسخ الاحتياطي' : 'Backups'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isArabic
            ? 'تنزيل نسخة كاملة لكل المستأجرين أو لمستأجر محدد.'
            : 'Download a full gzip archive for every tenant, or one tenant at a time.'}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-white/10 dark:bg-[#0c111a]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-white/5 dark:text-slate-200">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {isArabic ? 'كل المستأجرين' : 'All tenants'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isArabic ? 'ملف واحد مضغوط يشمل بيانات كل الشركات.' : 'One compressed file with every company’s data.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy === 'all'}
            onClick={() => runDownload('all', '/super-admin/backups/download-all')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d28] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163322] disabled:opacity-60"
          >
            {busy === 'all' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isArabic ? 'تنزيل الكل' : 'Download all'}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0c111a]">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {isArabic ? 'مستأجر محدد' : 'Specific tenant'}
          </h2>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? 'بحث بالاسم أو النطاق' : 'Search by name or slug'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-800/40 dark:border-white/10 dark:bg-white/[0.04]"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {isLoading ? (
            <p className="px-6 py-8 text-sm text-slate-400">{isArabic ? 'جاري التحميل…' : 'Loading…'}</p>
          ) : tenants.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-400">{isArabic ? 'لا توجد نتائج' : 'No tenants found'}</p>
          ) : (
            tenants.map((tenant) => (
              <div key={tenant._id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {tenant.business?.legalNameEn || tenant.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">{tenant.slug}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy === tenant._id}
                  onClick={() => runDownload(tenant._id, `/super-admin/tenants/${tenant._id}/backup/download`)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-60"
                >
                  {busy === tenant._id ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {isArabic ? 'تنزيل' : 'Download'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

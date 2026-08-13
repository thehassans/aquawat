import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import { Save, Ruler, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { updateTenant, getMe } from '../store/slices/authSlice'
import { UOM_GROUPS, ZATCA_UOM_OPTIONS } from '../lib/uomOptions'

export default function Uom() {
  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isArabic = language === 'ar'
  const [hiddenUoms, setHiddenUoms] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    setHiddenUoms(tenant?.settings?.hiddenUoms || [])
  }, [tenant?.settings?.hiddenUoms])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ZATCA_UOM_OPTIONS
    return ZATCA_UOM_OPTIONS.filter((u) =>
      u.code.toLowerCase().includes(q)
      || u.labelEn.toLowerCase().includes(q)
      || u.labelAr.includes(search.trim())
    )
  }, [search])

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/tenants/current', data),
    onSuccess: (res) => {
      const updated = res?.data
      toast.success(isArabic ? 'تم حفظ وحدات القياس' : 'Units of measure saved')
      if (updated) {
        queryClient.setQueryData(['tenant-settings'], updated)
        dispatch(updateTenant(updated))
      }
      dispatch(getMe())
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving'),
  })

  const toggle = (code, enabled) => {
    setHiddenUoms((prev) => (enabled ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            {isArabic ? 'المخزون' : 'Inventory'}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            <Ruler className="h-6 w-6 text-slate-400" />
            {isArabic ? 'وحدات القياس' : 'Units of measure'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {isArabic
              ? 'حدد الوحدات الظاهرة في القوائم. الوحدات غير المحددة تُخفى من أوامر الشراء والفواتير.'
              : 'Choose which units appear in dropdowns. Unselected units are hidden from purchase orders and invoices.'}
          </p>
        </div>
        <button
          type="button"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate({ settings: { ...(tenant?.settings || {}), hiddenUoms } })}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d28] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163322] disabled:opacity-60"
        >
          {updateMutation.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isArabic ? 'حفظ' : 'Save'}
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isArabic ? 'بحث (مثل MT أو طن متري)' : 'Search (e.g. MT or Metric Ton)'}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-800/40 dark:border-white/10 dark:bg-[#0c111a]"
        />
      </div>

      {UOM_GROUPS.map((group) => {
        const items = filtered.filter((u) => u.group === group.id)
        if (!items.length) return null
        return (
          <section key={group.id}>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {isArabic ? group.labelAr : group.labelEn}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {items.map((uom) => {
                const enabled = !hiddenUoms.includes(uom.code)
                return (
                  <label
                    key={uom.code}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      enabled
                        ? 'border-emerald-800/30 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-950/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#0c111a] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => toggle(uom.code, e.target.checked)}
                      className="h-4 w-4 accent-emerald-800"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{uom.code}</span>
                      <span className="block text-xs text-slate-500">{isArabic ? uom.labelAr : uom.labelEn}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  BarChart3,
  Settings,
  PackagePlus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { StatusChip } from './inventoryUi'

const cards = [
  { code: 'incoming', path: '/app/dashboard/inventory/receipts', icon: ArrowDownToLine, en: 'Receipts', ar: 'الاستلامات', accent: 'from-teal-500/20 to-teal-500/5' },
  { code: 'outgoing', path: '/app/dashboard/inventory/deliveries', icon: ArrowUpFromLine, en: 'Delivery Orders', ar: 'أوامر التسليم', accent: 'from-sky-500/20 to-sky-500/5' },
  { code: 'internal', path: '/app/dashboard/inventory/internal', icon: ArrowLeftRight, en: 'Internal Transfers', ar: 'تحويلات داخلية', accent: 'from-violet-500/20 to-violet-500/5' },
  { code: 'pos', path: '/app/dashboard/inventory/pos', icon: Boxes, en: 'PoS Orders', ar: 'نقطة البيع', accent: 'from-orange-500/20 to-orange-500/5' },
  { code: 'manufacturing', path: '/app/dashboard/inventory/manufacturing', icon: PackagePlus, en: 'Manufacturing', ar: 'التصنيع', accent: 'from-amber-500/20 to-amber-500/5' },
]

const quickLinks = [
  { path: '/app/dashboard/inventory/stock', icon: Boxes, en: 'Stock report', ar: 'تقرير المخزون', subEn: 'On hand, free to use, forecast', subAr: 'الكميات المتوقعة والمتاحة' },
  { path: '/app/dashboard/inventory/reports', icon: BarChart3, en: 'Reports', ar: 'تقارير', subEn: 'Moves analysis & KPIs', subAr: 'تحليل الحركات ومؤشرات الأداء' },
  { path: '/app/dashboard/inventory/replenishment', icon: PackagePlus, en: 'Replenish', ar: 'توريد', subEn: 'Reorder rules & order once', subAr: 'قواعد إعادة الطلب' },
  { path: '/app/dashboard/inventory/settings', icon: Settings, en: 'Settings', ar: 'إعدادات', subEn: 'Engine flags & lead times', subAr: 'إعدادات المحرك وأوقات التوريد' },
]

export default function InventoryOverview() {
  const { language } = useSelector((s) => s.ui)
  const { user } = useSelector((s) => s.auth)
  const qc = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const { data: health } = useQuery({
    queryKey: ['stock-health'],
    queryFn: () => api.get('/stock/health').then((r) => r.data),
    staleTime: 60_000,
    enabled: !!settings?.engineEnabled,
  })

  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types'],
    queryFn: () => api.get('/stock/operation-types').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const countsQuery = useQuery({
    queryKey: ['stock-transfer-counts'],
    queryFn: async () => {
      try {
        return await api.get('/stock/transfer-counts').then((r) => r.data)
      } catch {
        const states = ['draft', 'assigned', 'waiting', 'confirmed']
        const codes = ['incoming', 'outgoing', 'internal']
        const entries = await Promise.all(
          codes.flatMap((code) =>
            states.map(async (state) => {
              const res = await api.get('/stock/transfers', { params: { code, state, limit: 1 } })
              return [code, state, res.data.total || 0]
            }),
          ),
        )
        const result = {}
        for (const [code, state, total] of entries) {
          if (!result[code]) result[code] = {}
          result[code][state] = total
        }
        return result
      }
    },
    staleTime: 60_000,
  })

  const enable = useMutation({
    mutationFn: () => api.post('/stock/enable'),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تفعيل المحرك' : 'Engine enabled')
      qc.invalidateQueries({ queryKey: ['stock-settings'] })
      qc.invalidateQueries({ queryKey: ['inventory-menu'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const counts = countsQuery.data || {}
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {settings?.engineEnabled
              ? (language === 'ar' ? 'محرك المخزون مفعّل' : 'Inventory engine active')
              : (language === 'ar' ? 'المحرك غير مفعّل — فعّله من الإعدادات' : 'Engine off — enable from Settings')}
          </p>
          {settings?.engineEnabled && health && (
            <p className={`mt-0.5 text-xs ${
              health.status === 'critical' ? 'text-rose-600'
                : health.status === 'warning' ? 'text-amber-600'
                  : 'text-emerald-700'
            }`}
            >
              {language === 'ar' ? 'الصحة' : 'Health'}: {health.status}
              {' · '}v{health.engineVersion}
              {health.waitingPastDeadline > 0
                ? ` · ${health.waitingPastDeadline} ${language === 'ar' ? 'متأخر' : 'past deadline'}`
                : ''}
              {health.lastSchedulerRun?.status
                ? ` · ${language === 'ar' ? 'مجدول' : 'scheduler'} ${health.lastSchedulerRun.status}`
                : ''}
            </p>
          )}
          {settings?.engineEnabled && !health && (
            <p className="mt-0.5 text-xs text-slate-400">
              {language === 'ar' ? 'الصيانة (تهيئة / ترحيل / مزامنة) في الإعدادات' : 'Maintenance (bootstrap / migrate / sync) lives under Settings'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!settings?.engineEnabled && (
            <button type="button" className="btn btn-primary text-sm" onClick={() => enable.mutate()} disabled={enable.isPending}>
              {language === 'ar' ? 'تفعيل المحرك' : 'Enable engine'}
            </button>
          )}
          {isAdmin && (
            <Link to="/app/dashboard/inventory/settings" className="btn btn-secondary text-sm">
              <Settings className="h-4 w-4" />
              {language === 'ar' ? 'الإعدادات' : 'Settings'}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, i) => {
          const Icon = card.icon
          const c = counts[card.code] || {}
          const ot = opTypes.find((o) => o.code === card.code)
          return (
            <motion.div
              key={card.code}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br ${card.accent} p-5 dark:border-dark-600 dark:from-dark-800 dark:to-dark-900`}
              style={ot?.cardColor ? { boxShadow: `inset 3px 0 0 ${ot.cardColor}` } : undefined}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    {language === 'ar' ? card.ar : card.en}
                  </h2>
                </div>
                <Link to={card.path} className="btn btn-primary btn-sm text-xs">
                  {language === 'ar' ? 'فتح' : 'Open'}
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <Link to={`${card.path}?state=draft`} className="flex items-center gap-1.5">
                  <StatusChip status="draft" language={language} />
                  <span className="font-medium tabular-nums">{c.draft ?? '—'}</span>
                </Link>
                <Link to={`${card.path}?state=assigned`} className="flex items-center gap-1.5">
                  <StatusChip status="assigned" language={language} />
                  <span className="font-medium tabular-nums">{c.assigned ?? '—'}</span>
                </Link>
                <Link to={`${card.path}?state=waiting`} className="flex items-center gap-1.5">
                  <StatusChip status="waiting" language={language} />
                  <span className="font-medium tabular-nums">{c.waiting ?? '—'}</span>
                </Link>
                <Link to={`${card.path}?state=confirmed`} className="flex items-center gap-1.5">
                  <StatusChip status="confirmed" language={language} />
                  <span className="font-medium tabular-nums">{c.confirmed ?? '—'}</span>
                </Link>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {quickLinks.map((link, i) => {
          const Icon = link.icon
          return (
            <motion.div key={link.path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.04 }}>
              <Link
                to={link.path}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:border-primary-300 dark:border-dark-600 dark:bg-dark-800"
              >
                <Icon className="h-6 w-6 shrink-0 text-primary-600" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {language === 'ar' ? link.ar : link.en}
                  </div>
                  <div className="text-sm text-slate-500">
                    {language === 'ar' ? link.subAr : link.subEn}
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

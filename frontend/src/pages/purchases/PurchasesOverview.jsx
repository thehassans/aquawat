import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  PackageCheck,
  CircleDot,
  Wallet,
  Truck,
  RotateCcw,
  BarChart3,
  Users,
  Plus,
  ArrowRight,
} from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import { PURCHASES_PATH, partyName, formatDay, statusLabel, STATUS_PILL } from './purchasesUi'

const QUICK = [
  {
    href: PURCHASES_PATH.orders,
    icon: ShoppingCart,
    en: 'Purchase orders',
    ar: 'طلبات الشراء',
    subEn: 'Issue and track supplier orders',
    subAr: 'إصدار وتتبع طلبات الموردين',
    accent: 'from-teal-500/20 to-teal-500/5',
  },
  {
    href: PURCHASES_PATH.grn,
    icon: PackageCheck,
    en: 'Receipts (GRN)',
    ar: 'إشعارات الاستلام',
    subEn: 'Receive stock into warehouses',
    subAr: 'استلام المخزون إلى المستودعات',
    accent: 'from-sky-500/20 to-sky-500/5',
  },
  {
    href: PURCHASES_PATH.returns,
    icon: RotateCcw,
    en: 'Purchase returns',
    ar: 'مرتجعات المشتريات',
    subEn: 'Return goods to suppliers',
    subAr: 'إرجاع البضاعة للموردين',
    accent: 'from-rose-500/20 to-rose-500/5',
  },
  {
    href: PURCHASES_PATH.suppliers,
    icon: Users,
    en: 'Suppliers',
    ar: 'الموردون',
    subEn: 'Partners and open POs',
    subAr: 'الشركاء والطلبات المفتوحة',
    accent: 'from-violet-500/20 to-violet-500/5',
  },
  {
    href: PURCHASES_PATH.reports,
    icon: BarChart3,
    en: 'Reports',
    ar: 'التقارير',
    subEn: 'Spend and fulfillment',
    subAr: 'الإنفاق والتنفيذ',
    accent: 'from-amber-500/20 to-amber-500/5',
  },
  {
    href: PURCHASES_PATH.landed,
    icon: Truck,
    en: 'Landed costs',
    ar: 'التكلفة المرسية',
    subEn: 'Freight and customs on receipts',
    subAr: 'الشحن والجمارك على الاستلام',
    accent: 'from-orange-500/20 to-orange-500/5',
  },
]

export default function PurchasesOverview() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'

  const { data: stats, isLoading } = useQuery({
    queryKey: ['purchase-orders-stats', 'purchase'],
    queryFn: () => api.get('/purchase-orders/stats', { params: { flow: 'purchase' } }).then((r) => r.data),
  })

  const { data: recentData } = useQuery({
    queryKey: ['purchase-orders', 'overview-recent'],
    queryFn: () =>
      api
        .get('/purchase-orders', { params: { flow: 'purchase', page: 1, limit: 6 } })
        .then((r) => r.data),
  })

  const { data: grnData } = useQuery({
    queryKey: ['grn', 'overview-count'],
    queryFn: () => api.get('/grn', { params: { page: 1, limit: 1 } }).then((r) => r.data).catch(() => ({})),
  })

  const totals = stats?.totals?.[0]
  const totalOrders = totals?.count || 0
  const openOrders = totals?.openCount || 0
  const totalValue = totals?.totalValue || 0
  const receivedCount = stats?.byStatus?.find((x) => x._id === 'received')?.count || 0
  const grnTotal = grnData?.pagination?.total ?? grnData?.total ?? (Array.isArray(grnData?.grns) ? grnData.grns.length : 0)

  const recent = useMemo(() => {
    const list = recentData?.purchaseOrders || recentData?.items || []
    return Array.isArray(list) ? list : []
  }, [recentData])

  const kpis = [
    { labelEn: 'Total POs', labelAr: 'إجمالي الطلبات', value: totalOrders, icon: ShoppingCart, href: PURCHASES_PATH.orders },
    { labelEn: 'Open', labelAr: 'مفتوحة', value: openOrders, icon: CircleDot, href: PURCHASES_PATH.orders },
    { labelEn: 'Committed', labelAr: 'القيمة', value: totalValue, icon: Wallet, money: true, href: PURCHASES_PATH.orders },
    { labelEn: 'Received', labelAr: 'مستلمة', value: receivedCount, icon: PackageCheck, href: `${PURCHASES_PATH.orders}?status=received` },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAr ? 'سلسلة التوريد · مشتريات' : 'Supply chain · Purchases'}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'نظرة عامة' : 'Overview'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${PURCHASES_PATH.orders}/new`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'طلب شراء جديد' : 'New purchase order'}
          </Link>
          <Link
            to={PURCHASES_PATH.orders}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200"
          >
            <PackageCheck className="h-3.5 w-3.5" />
            {isAr ? 'استلام من طلب' : 'Receive from PO'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Link
              key={k.labelEn}
              to={k.href}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800 dark:hover:border-dark-500"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {isAr ? k.labelAr : k.labelEn}
                </p>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
                {isLoading ? '—' : k.money ? <Money value={k.value || 0} /> : k.value}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to={card.href}
                className={`group block overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br ${card.accent} p-5 transition hover:border-slate-300 dark:border-dark-600 dark:from-white/[0.04] dark:to-transparent`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-slate-700 shadow-sm dark:bg-dark-800 dark:text-slate-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  {isAr ? card.ar : card.en}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? card.subAr : card.subEn}
                </p>
                {card.href === PURCHASES_PATH.grn ? (
                  <p className="mt-3 text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
                    {grnTotal} {isAr ? 'إشعار' : 'receipts'}
                  </p>
                ) : null}
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isAr ? 'أحدث طلبات الشراء' : 'Recent purchase orders'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {isAr ? 'آخر أوامر الشراء للموردين' : 'Latest supplier purchase orders'}
            </p>
          </div>
          <Link
            to={PURCHASES_PATH.orders}
            className="text-xs font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300"
          >
            {isAr ? 'الكل' : 'View all'}
          </Link>
        </div>
        <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          {!recent.length ? (
            <div className="flex flex-col items-center py-10 text-center">
              <ShoppingCart className="mb-2 h-5 w-5 text-slate-300" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {isAr ? 'لا طلبات شراء بعد' : 'No purchase orders yet'}
              </p>
              <Link
                to={`${PURCHASES_PATH.orders}/new`}
                className="mt-3 text-sm font-semibold text-primary-700 dark:text-primary-300"
              >
                {isAr ? 'إنشاء طلب شراء' : 'Create purchase order'}
              </Link>
            </div>
          ) : null}
          {recent.map((po) => (
            <Link
              key={po._id}
              to={`${PURCHASES_PATH.orders}/${po._id}`}
              className="flex items-center justify-between py-3 text-sm transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{po.poNumber || '—'}</p>
                <p className="truncate text-xs text-slate-500">
                  {partyName(po.supplierId, language)}
                  {' · '}
                  {formatDay(po.orderDate, language)}
                </p>
              </div>
              <div className="text-end">
                <p className="font-semibold tabular-nums"><Money value={po.grandTotal} /></p>
                <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_PILL[po.status] || STATUS_PILL.draft}`}>
                  {statusLabel(po.status, language)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

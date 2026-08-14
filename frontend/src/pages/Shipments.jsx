import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Truck, Building, Warehouse as WarehouseIcon, Calendar, Edit, Anchor } from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import ExportMenu from '../components/ui/ExportMenu'

export default function Shipments() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const hasLandedCosts = true
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ status: '', type: '', supplierId: '', warehouseId: '' })

  const exportColumns = [
    {
      key: 'shipmentNumber',
      label: language === 'ar' ? 'رقم الشحنة' : 'Shipment #',
      value: (r) => r?.shipmentNumber || ''
    },
    {
      key: 'type',
      label: language === 'ar' ? 'النوع' : 'Type',
      value: (r) => r?.type || ''
    },
    {
      key: 'supplier',
      label: language === 'ar' ? 'المورد' : 'Supplier',
      value: (r) => {
        const s = r?.supplierId
        return s ? (language === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr) : ''
      }
    },
    {
      key: 'warehouse',
      label: language === 'ar' ? 'المستودع' : 'Warehouse',
      value: (r) => {
        const w = r?.warehouseId
        return w ? (language === 'ar' ? w.nameAr || w.nameEn : w.nameEn || w.nameAr) : ''
      }
    },
    {
      key: 'carrier',
      label: language === 'ar' ? 'الشحن' : 'Carrier',
      value: (r) => r?.carrier || ''
    },
    {
      key: 'trackingNumber',
      label: language === 'ar' ? 'رقم التتبع' : 'Tracking #',
      value: (r) => r?.trackingNumber || ''
    },
    {
      key: 'status',
      label: t('status'),
      value: (r) => r?.status || ''
    },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/shipments', {
        params: {
          page: currentPage,
          limit,
          search,
          status: filters.status,
          type: filters.type,
          supplierId: filters.supplierId,
          warehouseId: filters.warehouseId,
        },
      })
      const batch = res.data?.shipments || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  const { data, isLoading } = useQuery({
    queryKey: ['shipments', page, search, filters],
    queryFn: () =>
      api
        .get('/shipments', {
          params: {
            page,
            limit: 25,
            search,
            status: filters.status,
            type: filters.type,
            supplierId: filters.supplierId,
            warehouseId: filters.warehouseId,
          },
        })
        .then((res) => res.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['shipments-stats'],
    queryFn: () => api.get('/shipments/stats').then((res) => res.data),
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => res.data),
  })

  const totals = stats?.totals?.[0]
  const totalShipments = totals?.total || 0
  const deliveredCount = totals?.delivered || 0
  const inTransitCount = totals?.inTransit || 0
  const inboundCount = stats?.byType?.find((x) => x._id === 'inbound')?.count || 0

  const shipments = data?.shipments || []
  const pagination = data?.pagination

  const statusBadge = (status) => {
    if (status === 'delivered') return 'badge-success'
    if (status === 'in_transit') return 'badge-info'
    if (status === 'cancelled') return 'badge-danger'
    return 'badge-neutral'
  }

  const statusLabel = (status) => {
    if (language === 'ar') {
      if (status === 'draft') return 'مسودة'
      if (status === 'in_transit') return 'بالطريق'
      if (status === 'delivered') return 'تم التسليم'
      if (status === 'cancelled') return 'ملغي'
      return status
    }
    return status
  }

  const typeLabel = (type) => {
    if (language === 'ar') {
      if (type === 'inbound') return 'وارد'
      if (type === 'outbound') return 'صادر'
      return type
    }
    return type
  }

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-16 pt-6 lg:-mx-6 lg:px-6" style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-300/18 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700/80">{language === 'ar' ? 'التوريد' : 'Supply chain'}</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>{language === 'ar' ? 'الشحنات' : 'Shipments'}</h1>
          <p className="mt-2 max-w-xl text-[15px] text-slate-500">{language === 'ar' ? 'متابعة الوارد والصادر مع التتبع والمستودعات.' : 'Track inbound and outbound freight with carriers, warehouses, and landed cost.'}</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={shipments}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'الشحنات' : 'Shipments'}
            title={language === 'ar' ? 'الشحنات' : 'Shipments'}
            disabled={isLoading || shipments.length === 0}
          />
          <Link to="/app/dashboard/shipments/new" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(4,120,87,0.8)] hover:bg-emerald-800">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة شحنة' : 'New shipment'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: language === 'ar' ? 'إجمالي الشحنات' : 'Total', value: totalShipments, well: 'bg-emerald-50 text-emerald-700', icon: Truck },
          { label: language === 'ar' ? 'بالطريق' : 'In transit', value: inTransitCount, well: 'bg-sky-50 text-sky-700', icon: Truck },
          { label: language === 'ar' ? 'تم التسليم' : 'Delivered', value: deliveredCount, well: 'bg-teal-50 text-teal-800', icon: Truck },
          { label: language === 'ar' ? 'شحنات واردة' : 'Inbound', value: inboundCount, well: 'bg-amber-50 text-amber-800', icon: Truck },
        ].map((card) => (
          <div key={card.label} className="rounded-[1.4rem] border border-white/80 bg-white/85 p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-dark-800/80">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{card.label}</p>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${card.well}`}><Truck className="w-4 h-4" /></span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-dark-800/80">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث برقم الشحنة / رقم التتبع...' : 'Search by shipment / tracking...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 ps-10 pe-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-dark-900"
            />
          </div>

          <select
            value={filters.type}
            onChange={(e) => {
              setFilters((f) => ({ ...f, type: e.target.value }))
              setPage(1)
            }}
            className="w-full lg:w-40 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-dark-900"
          >
            <option value="">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
            <option value="inbound">{language === 'ar' ? 'وارد' : 'Inbound'}</option>
            <option value="outbound">{language === 'ar' ? 'صادر' : 'Outbound'}</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => {
              setFilters((f) => ({ ...f, status: e.target.value }))
              setPage(1)
            }}
            className="w-full lg:w-44 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-dark-900"
          >
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
            <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
            <option value="in_transit">{language === 'ar' ? 'بالطريق' : 'In Transit'}</option>
            <option value="delivered">{language === 'ar' ? 'تم التسليم' : 'Delivered'}</option>
            <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
          </select>

          <select
            value={filters.supplierId}
            onChange={(e) => {
              setFilters((f) => ({ ...f, supplierId: e.target.value }))
              setPage(1)
            }}
            className="w-full lg:w-60 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-dark-900"
          >
            <option value="">{language === 'ar' ? 'كل الموردين' : 'All Suppliers'}</option>
            {(suppliers || []).map((s) => (
              <option key={s._id} value={s._id}>
                {(language === 'ar' ? s.nameAr || s.nameEn : s.nameEn) || s.code}
              </option>
            ))}
          </select>

          <select
            value={filters.warehouseId}
            onChange={(e) => {
              setFilters((f) => ({ ...f, warehouseId: e.target.value }))
              setPage(1)
            }}
            className="w-full lg:w-56 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-dark-900"
          >
            <option value="">{language === 'ar' ? 'كل المستودعات' : 'All Warehouses'}</option>
            {(warehouses || []).map((w) => (
              <option key={w._id} value={w._id}>
                {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-dark-800">
        {isLoading ? (
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : shipments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Truck className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700">{language === 'ar' ? 'لا توجد شحنات' : 'No shipments yet'}</p>
            <p className="mt-1 text-xs text-slate-400">{language === 'ar' ? 'أضف شحنة واردة أو صادرة للبدء.' : 'Add an inbound or outbound shipment to begin.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="px-5 py-3.5 text-start">{language === 'ar' ? 'رقم الشحنة' : 'Shipment #'}</th>
                  <th className="px-5 py-3.5 text-start">{language === 'ar' ? 'النوع' : 'Type'}</th>
                  <th className="px-5 py-3.5 text-start">{language === 'ar' ? 'المورد' : 'Supplier'}</th>
                  <th className="px-5 py-3.5 text-start">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                  <th className="px-5 py-3.5 text-start">{language === 'ar' ? 'الشحن' : 'Carrier / Tracking'}</th>
                  <th className="px-5 py-3.5 text-start">{t('status')}</th>
                  <th className="px-5 py-3.5 text-start">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {shipments.map((s) => (
                  <tr key={s._id} className="hover:bg-emerald-50/40 dark:hover:bg-white/[0.03]">
                    <td className="px-5 py-3.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">{s.shipmentNumber}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <Truck className="w-4 h-4 text-slate-400" />
                        {typeLabel(s.type)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {s.supplierId ? (
                        <span className="inline-flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-900 dark:text-white">
                            {language === 'ar'
                              ? s.supplierId?.nameAr || s.supplierId?.nameEn
                              : s.supplierId?.nameEn || s.supplierId?.nameAr}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.warehouseId ? (
                        <span className="inline-flex items-center gap-2">
                          <WarehouseIcon className="w-4 h-4 text-slate-400" />
                          {language === 'ar' ? s.warehouseId?.nameAr || s.warehouseId?.nameEn : s.warehouseId?.nameEn}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.carrier || s.trackingNumber ? (
                        <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {(s.carrier || '—') + (s.trackingNumber ? ` · ${s.trackingNumber}` : '')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${statusBadge(s.status)}`}>{statusLabel(s.status)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <Link to={`/app/dashboard/shipments/${s._id}`} className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-emerald-700">
                          <Edit className="w-4 h-4" />
                        </Link>
                        {hasLandedCosts && s.type === 'inbound' && (
                          <Link
                            to={`/app/dashboard/landed-costs/new?shipment=${s._id}`}
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-emerald-700"
                            title={language === 'ar' ? 'تكلفة مرسية' : 'Landed cost'}
                          >
                            <Anchor className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between">
          <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-sm text-slate-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

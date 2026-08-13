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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'الشحنات' : 'Shipments'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{language === 'ar' ? 'متابعة الشحنات' : 'Track shipments'}</p>
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
          <Link to="/shipments/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة شحنة' : 'Add Shipment'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Truck className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي الشحنات' : 'Total Shipments'}</p>
            <p className="text-2xl font-bold">{totalShipments}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'بالطريق' : 'In Transit'}</p>
            <p className="text-2xl font-bold text-blue-600">{inTransitCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <Truck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'تم التسليم' : 'Delivered'}</p>
            <p className="text-2xl font-bold text-emerald-600">{deliveredCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Truck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'شحنات واردة' : 'Inbound'}</p>
            <p className="text-2xl font-bold">{inboundCount}</p>
          </div>
        </div>
      </div>

      <div className="card p-4">
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
              className="input ps-10"
            />
          </div>

          <select
            value={filters.type}
            onChange={(e) => {
              setFilters((f) => ({ ...f, type: e.target.value }))
              setPage(1)
            }}
            className="select w-full lg:w-40"
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
            className="select w-full lg:w-44"
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
            className="select w-full lg:w-60"
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
            className="select w-full lg:w-56"
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

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'رقم الشحنة' : 'Shipment #'}</th>
                  <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                  <th>{language === 'ar' ? 'المورد' : 'Supplier'}</th>
                  <th>{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                  <th>{language === 'ar' ? 'الشحن' : 'Carrier / Tracking'}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s._id}>
                    <td className="font-mono text-sm">{s.shipmentNumber}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        {typeLabel(s.type)}
                      </span>
                    </td>
                    <td>
                      {s.supplierId ? (
                        <span className="inline-flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {language === 'ar'
                              ? s.supplierId?.nameAr || s.supplierId?.nameEn
                              : s.supplierId?.nameEn || s.supplierId?.nameAr}
                          </span>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {s.warehouseId ? (
                        <span className="inline-flex items-center gap-2">
                          <WarehouseIcon className="w-4 h-4 text-gray-400" />
                          {language === 'ar' ? s.warehouseId?.nameAr || s.warehouseId?.nameEn : s.warehouseId?.nameEn}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {s.carrier || s.trackingNumber ? (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {(s.carrier || '-') + (s.trackingNumber ? ` · ${s.trackingNumber}` : '')}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(s.status)}`}>{statusLabel(s.status)}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link to={`/app/dashboard/shipments/${s._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Link>
                        {hasLandedCosts && s.type === 'inbound' && (
                          <Link
                            to={`/app/dashboard/landed-costs/new?shipment=${s._id}`}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                            title={language === 'ar' ? 'تكلفة مرسية' : 'Landed cost'}
                          >
                            <Anchor className="w-4 h-4 text-gray-600" />
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
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-sm text-gray-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}

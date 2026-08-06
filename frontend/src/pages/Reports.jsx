import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { getTenantBusinessTypes, getBusinessTypeOptions } from '../lib/businessTypes'
import Money from '../components/ui/Money'
import ExportMenu from '../components/ui/ExportMenu'
import { downloadBusinessReportPdf } from '../lib/businessReportPdf'
import { downloadVatReturnReportPdf } from '../lib/vatReturnReportPdf'
import { downloadAuditReportPdf } from '../lib/auditReportPdf'
import { downloadMasterReportPdf } from '../lib/masterReportPdf'
import { exportReportToCsv, exportReportToExcel } from '../lib/masterReportSpreadsheet'
import InternalAuditView from '../components/reports/InternalAuditView'
import ExternalAuditView from '../components/reports/ExternalAuditView'
import { Clock3, Download, Mail, Trash2, TrendingUp, ShoppingCart, Receipt, Tag, BarChart3, FileText, AlertCircle, Calendar, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Users, Package, Boxes, ShieldCheck, Landmark, FileSpreadsheet, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

const OPS_PREFIX = 'ops:'

const KPI_ICONS = [TrendingUp, ShoppingCart, Receipt, Tag, BarChart3, Package, Users, Boxes]
const KPI_ICON_BG = [
  'bg-gradient-to-br from-emerald-400 to-emerald-600',
  'bg-gradient-to-br from-blue-400 to-blue-600',
  'bg-gradient-to-br from-primary-400 to-primary-700',
  'bg-gradient-to-br from-amber-400 to-amber-600',
  'bg-gradient-to-br from-rose-400 to-rose-600',
  'bg-gradient-to-br from-slate-400 to-slate-600',
]

const localized = (value, language) => {
  if (value && typeof value === 'object') return value[language] || value.en || value.ar || ''
  return value ?? ''
}

const formatInputDate = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatTimeInput = (hour = 8, minute = 0) => `${String(Number(hour) || 0).padStart(2, '0')}:${String(Number(minute) || 0).padStart(2, '0')}`

const parseTimeInput = (value) => {
  const [hour, minute] = String(value || '08:00').split(':')
  return {
    sendAtHour: Math.max(0, Math.min(23, Number(hour) || 8)),
    sendAtMinute: Math.max(0, Math.min(59, Number(minute) || 0)),
  }
}

const formatDateTime = (value, language) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')
}

// ─── Skeleton helpers ────────────────────────────────────────────────────────
function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-dark-600 rounded-lg ${className}`} />
  )
}

// ─── Premium KPI card ────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, iconBg, label, value, valueClass = 'text-gray-900 dark:text-white', sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${iconBg}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-none ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 truncate">{sub}</p>}
      {/* subtle decorative circle */}
      <div className="pointer-events-none absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-5 bg-current" />
    </motion.div>
  )
}

// ─── Section card wrapper ────────────────────────────────────────────────────
function SectionCard({ title, children, delay = 0, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-dark-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
        {action}
      </div>
      {children}
    </motion.div>
  )
}

// ─── Premium table ────────────────────────────────────────────────────────────
function PremiumTable({ headers, rows, emptyText }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-dark-700">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-gray-50 dark:border-dark-700/50 hover:bg-gray-50 dark:hover:bg-dark-700/40 transition-colors"
              >
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-6 py-3.5 text-gray-700 dark:text-gray-300 ${ci === 0 ? 'font-medium' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Operations (per business type) report ──────────────────────────────────
function OperationsSection({ section, language, t }) {
  const money = (value) => <Money value={value} minimumFractionDigits={2} maximumFractionDigits={2} />

  const formatCell = (value, format) => {
    if (format === 'money') return money(value)
    if (format === 'percent') return `${Number(value || 0).toFixed(0)}%`
    if (format === 'number') return Number(value || 0).toLocaleString()
    return value === undefined || value === null || value === '' ? '-' : String(value)
  }

  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700">
        <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('noData')}</p>
      </div>
    )
  }

  const kpis = Array.isArray(section.kpis) ? section.kpis : []
  const tables = Array.isArray(section.tables) ? section.tables : []

  return (
    <div className="space-y-6">
      {section.error && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 px-5 py-4 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {section.error}
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, i) => (
            <KpiCard
              key={kpi.key || i}
              icon={KPI_ICONS[i % KPI_ICONS.length]}
              iconBg={KPI_ICON_BG[i % KPI_ICON_BG.length]}
              label={localized(kpi.label, language)}
              value={formatCell(kpi.value, kpi.format)}
              delay={0.04 * i}
            />
          ))}
        </div>
      )}

      {tables.map((table, ti) => {
        const columns = Array.isArray(table.columns) ? table.columns : []
        const rows = Array.isArray(table.rows) ? table.rows : []
        return (
          <SectionCard
            key={table.key || ti}
            title={localized(table.title, language)}
            delay={0.1 + ti * 0.05}
            action={
              <ExportMenu
                language={language}
                t={t}
                rows={rows}
                columns={columns.map((col) => ({
                  key: col.key,
                  label: localized(col.label, language),
                  value: (row) => row[col.key],
                }))}
                fileBaseName={`${section.key}_${table.key || 'report'}`}
                title={localized(table.title, language)}
                disabled={rows.length === 0}
              />
            }
          >
            <PremiumTable
              headers={columns.map((col) => localized(col.label, language))}
              rows={rows.map((row) => columns.map((col) => formatCell(row[col.key], col.format)))}
              emptyText={t('noData')}
            />
          </SectionCard>
        )
      })}
    </div>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-dark-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function Reports() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const now = new Date()
  const [startDate, setStartDate] = useState(formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [endDate, setEndDate] = useState(formatInputDate(now))

  const [reportType, setReportType] = useState('vat')
  const [downloadingReportPdf, setDownloadingReportPdf] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadingCsv, setDownloadingCsv] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    reportType: 'vat',
    rangePreset: 'this_month',
    frequency: 'weekly',
    dayOfWeek: '1',
    dayOfMonth: '1',
    time: '08:00',
    recipients: tenant?.business?.contactEmail || '',
    language,
    enabled: true,
  })
  const hasInvalidRange = Boolean(startDate && endDate && new Date(startDate) > new Date(endDate))
  const hasEmailAddon = Boolean(tenant?.subscription?.hasEmailAddon || tenant?.subscription?.features?.includes('email_automation'))
  const canManageSchedules = user?.role === 'admin' || user?.role === 'super_admin'

  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const businessTypeMeta = getBusinessTypeOptions(language)
  const isOps = reportType.startsWith(OPS_PREFIX)
  const opsType = isOps ? reportType.slice(OPS_PREFIX.length) : null

  const coreTabs = [
    { value: 'vat', label: 'VAT' },
    { value: 'business', label: language === 'ar' ? 'الأعمال' : 'Business' },
    { value: 'internal_audit', label: language === 'ar' ? 'التدقيق الداخلي' : 'Internal Audit' },
    { value: 'external_audit', label: language === 'ar' ? 'التدقيق الخارجي' : 'External Audit' },
    { value: 'daily', label: language === 'ar' ? 'اليومية' : 'Daily' },
    { value: 'sales', label: language === 'ar' ? 'مبيعات العملاء' : 'Customer Sales' },
    { value: 'ops:restaurant', label: language === 'ar' ? 'المطعم' : 'Restaurant' },
    { value: 'ops:trading', label: language === 'ar' ? 'التجارة والمخزون' : 'Trading' },
  ]

  const otherBusinessTabs = tenantBusinessTypes
    .filter((type) => type !== 'restaurant' && type !== 'trading')
    .map((type) => ({
      value: `${OPS_PREFIX}${type}`,
      label: businessTypeMeta.find((meta) => meta.id === type)?.label || type,
    }))

  const reportTabs = [...coreTabs, ...otherBusinessTabs]

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', reportType, startDate, endDate],
    queryFn: () => {
      if (isOps) {
        return api
          .get('/reports/operations', { params: { startDate, endDate, businessType: opsType } })
          .then((res) => res.data)
      }
      if (reportType === 'internal_audit') {
        return api.get('/reports/audit/internal', { params: { startDate, endDate } }).then((res) => res.data)
      }
      if (reportType === 'external_audit') {
        return api.get('/reports/audit/external', { params: { startDate, endDate } }).then((res) => res.data)
      }
      const url = reportType === 'business'
        ? '/reports/business-summary'
        : reportType === 'daily'
          ? '/reports/daily-invoices'
          : reportType === 'sales'
            ? '/reports/customer-sales'
            : '/reports/vat-return'
      return api.get(url, { params: { startDate, endDate } }).then((res) => res.data)
    },
    enabled: !!startDate && !!endDate && !hasInvalidRange,
  })

  const opsSection = isOps ? (data?.sections || []).find((section) => section.key === opsType) || data?.sections?.[0] : null

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['report-schedules'],
    queryFn: () => api.get('/reports/schedules').then((res) => res.data),
    enabled: hasEmailAddon,
  })

  const createScheduleMutation = useMutation({
    mutationFn: (payload) => api.post('/reports/schedules', { schedule: payload }).then((res) => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إنشاء الجدولة' : 'Report schedule created')
      queryClient.invalidateQueries(['report-schedules'])
      setShowScheduleForm(false)
      setScheduleForm((current) => ({
        ...current,
        name: '',
      }))
    },
    onError: (err) => toast.error(err?.response?.data?.error || (language === 'ar' ? 'فشل إنشاء الجدولة' : 'Failed to create schedule')),
  })

  const toggleScheduleMutation = useMutation({
    mutationFn: (schedule) => api.put(`/reports/schedules/${schedule._id}`, {
      schedule: {
        ...schedule,
        enabled: !schedule.enabled,
      },
    }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['report-schedules'])
    },
    onError: (err) => toast.error(err?.response?.data?.error || (language === 'ar' ? 'فشل تحديث الجدولة' : 'Failed to update schedule')),
  })

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => api.delete(`/reports/schedules/${id}`).then((res) => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حذف الجدولة' : 'Report schedule deleted')
      queryClient.invalidateQueries(['report-schedules'])
    },
    onError: (err) => toast.error(err?.response?.data?.error || (language === 'ar' ? 'فشل حذف الجدولة' : 'Failed to delete schedule')),
  })

  const money = (value) => <Money value={value} minimumFractionDigits={2} maximumFractionDigits={2} />

  const totals = data?.totals
  const byCategory = totals?.byCategory
  const schedules = schedulesData?.schedules || []

  const [exportTable, setExportTable] = useState('byCategory')

  const categories = [
    {
      key: 'standardRated',
      label: language === 'ar' ? 'خاضع للضريبة (Standard)' : 'Standard Rated'
    },
    {
      key: 'zeroRated',
      label: language === 'ar' ? 'صفرية (Zero)' : 'Zero Rated'
    },
    {
      key: 'exempt',
      label: language === 'ar' ? 'معفاة (Exempt)' : 'Exempt'
    },
    {
      key: 'outOfScope',
      label: language === 'ar' ? 'خارج النطاق (Out of Scope)' : 'Out of Scope'
    }
  ]

  const handleCreateSchedule = () => {
    const { sendAtHour, sendAtMinute } = parseTimeInput(scheduleForm.time)
    createScheduleMutation.mutate({
      name: scheduleForm.name,
      reportType: scheduleForm.reportType,
      rangePreset: scheduleForm.rangePreset,
      frequency: scheduleForm.frequency,
      dayOfWeek: Number(scheduleForm.dayOfWeek || 1),
      dayOfMonth: Number(scheduleForm.dayOfMonth || 1),
      sendAtHour,
      sendAtMinute,
      recipients: scheduleForm.recipients
        .split(/[\n,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
      language: scheduleForm.language,
      enabled: scheduleForm.enabled,
    })
  }

  const handleExportPdf = async () => {
    try {
      setDownloadingReportPdf(true)
      await downloadMasterReportPdf({ reportType, report: data, tenant, language })
      toast.success(language === 'ar' ? 'تم تنزيل تقرير PDF بنجاح' : 'PDF Report downloaded successfully')
    } catch (e) {
      console.error(e)
      toast.error(language === 'ar' ? 'فشل تحميل PDF' : 'Failed to download PDF')
    } finally {
      setDownloadingReportPdf(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      setDownloadingExcel(true)
      await exportReportToExcel({ reportType, report: data, tenant, language })
      toast.success(language === 'ar' ? 'تم تصدير ملف Excel بنجاح' : 'Excel spreadsheet exported successfully')
    } catch (e) {
      console.error(e)
      toast.error(language === 'ar' ? 'فشل تصدير Excel' : 'Failed to export Excel')
    } finally {
      setDownloadingExcel(false)
    }
  }

  const handleExportCsv = async () => {
    try {
      setDownloadingCsv(true)
      await exportReportToCsv({ reportType, report: data, tenant, language })
      toast.success(language === 'ar' ? 'تم تصدير ملف CSV بنجاح' : 'CSV exported successfully')
    } catch (e) {
      console.error(e)
      toast.error(language === 'ar' ? 'فشل تصدير CSV' : 'Failed to export CSV')
    } finally {
      setDownloadingCsv(false)
    }
  }

  const periodText = data?.period?.startDate && data?.period?.endDate && !hasInvalidRange
    ? (language === 'ar'
      ? `${new Date(data.period.startDate).toLocaleDateString('ar-SA')} — ${new Date(data.period.endDate).toLocaleDateString('ar-SA')}`
      : `${new Date(data.period.startDate).toLocaleDateString('en-US')} — ${new Date(data.period.endDate).toLocaleDateString('en-US')}`)
    : null

  // ── Skeleton loading ──────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-5">
            <SkeletonBlock className="w-10 h-10 rounded-xl mb-3" />
            <SkeletonBlock className="h-3 w-24 mb-2" />
            <SkeletonBlock className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-dark-700">
          <SkeletonBlock className="h-4 w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-6 px-6 py-4 border-b border-gray-50 dark:border-dark-700/50">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-7" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── Premium Header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-200 dark:shadow-primary-900/40">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('reports')}</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {isOps
                ? `${localized(opsSection?.label, language) || (businessTypeMeta.find((meta) => meta.id === opsType)?.label || opsType)} ${language === 'ar' ? 'تقرير' : 'Report'}`
                : reportType === 'business'
                  ? (language === 'ar' ? 'تقرير الأعمال' : 'Business Report')
                  : reportType === 'daily'
                    ? (language === 'ar' ? 'تقرير المبيعات اليومية' : 'Daily Sales Report')
                    : reportType === 'sales'
                      ? (language === 'ar' ? 'تقرير مبيعات العملاء' : 'Customer Sales Report')
                      : (language === 'ar' ? 'تقرير إقرار ضريبة القيمة المضافة' : 'VAT Return Report')}
            </p>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Report type pill toggle */}
          <div className="flex flex-wrap items-center p-1 bg-gray-100 dark:bg-dark-700 rounded-xl gap-1">
            {reportTabs.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setReportType(value)
                  setExportTable(value === 'business' ? 'salesByTransactionType' : 'byCategory')
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  reportType === value
                    ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <span className="text-gray-400 text-sm font-medium">—</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Universal Export Controls for All Reports */}
          {data && !isLoading && !error && !hasInvalidRange && (
            <div className="flex flex-wrap items-center gap-2">
              {/* PDF Button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={handleExportPdf}
                disabled={downloadingReportPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60"
                title={language === 'ar' ? 'تحميل تقرير PDF احترافي بنمط الفاتورة' : 'Download Invoice-Style PDF'}
              >
                {downloadingReportPdf ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>PDF</span>
              </motion.button>

              {/* Excel Button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={handleExportExcel}
                disabled={downloadingExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60"
                title={language === 'ar' ? 'تصدير جدول إكسيل XLSX' : 'Export Excel (.xlsx)'}
              >
                {downloadingExcel ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>Excel</span>
              </motion.button>

              {/* CSV Button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={handleExportCsv}
                disabled={downloadingCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60"
                title={language === 'ar' ? 'تصدير ملف CSV' : 'Export CSV'}
              >
                {downloadingCsv ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>CSV</span>
              </motion.button>

              {/* Print Button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-all"
                title={language === 'ar' ? 'طباعة التقرير' : 'Print Report'}
              >
                <Printer className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Period badge ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {periodText && (
          <motion.div
            key="period-badge"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40 text-xs font-medium text-primary-700 dark:text-primary-300"
          >
            <Calendar className="w-3.5 h-3.5" />
            {periodText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Invalid date range ────────────────────────────────────────────── */}
      {hasInvalidRange && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 px-5 py-4 text-sm text-amber-700 dark:text-amber-300"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          {language === 'ar' ? 'يجب أن يكون تاريخ البداية قبل أو يساوي تاريخ النهاية' : 'The from date must be before or equal to the to date'}
        </motion.div>
      )}

      {/* ── Scheduled Reports Section ─────────────────────────────────────── */}
      {hasEmailAddon ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden"
        >
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-6 py-5 border-b border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {language === 'ar' ? 'جدولة التقارير بالبريد' : 'Scheduled Report Delivery'}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {language === 'ar'
                    ? 'أرسل تقارير VAT أو الأعمال تلقائياً إلى بريدك حسب الجدول.'
                    : 'Automatically email VAT or business reports on a recurring schedule.'}
                </p>
              </div>
            </div>
            {canManageSchedules && (
              <button
                type="button"
                onClick={() => setShowScheduleForm((value) => !value)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all"
              >
                <Clock3 className="w-4 h-4" />
                {showScheduleForm
                  ? (language === 'ar' ? 'إخفاء النموذج' : 'Hide Form')
                  : (language === 'ar' ? 'جدولة جديدة' : 'New Schedule')}
                {showScheduleForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Schedule Form */}
          <AnimatePresence>
            {showScheduleForm && canManageSchedules && (
              <motion.div
                key="schedule-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 py-5 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-700/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        {language === 'ar' ? 'اسم الجدولة' : 'Schedule Name'}
                      </label>
                      <input
                        value={scheduleForm.name}
                        onChange={(e) => setScheduleForm((current) => ({ ...current, name: e.target.value }))}
                        className="input"
                        placeholder={language === 'ar' ? 'مثال: تقرير VAT الشهري' : 'Example: Monthly VAT Report'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        {language === 'ar' ? 'نوع التقرير' : 'Report Type'}
                      </label>
                      <select
                        value={scheduleForm.reportType}
                        onChange={(e) => setScheduleForm((current) => ({ ...current, reportType: e.target.value }))}
                        className="select"
                      >
                        <option value="vat">VAT</option>
                        <option value="business">{language === 'ar' ? 'الأعمال' : 'Business'}</option>
                        <option value="internal_audit">{language === 'ar' ? 'التدقيق الداخلي' : 'Internal Audit'}</option>
                        <option value="external_audit">{language === 'ar' ? 'التدقيق الخارجي' : 'External Audit'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        {language === 'ar' ? 'النطاق' : 'Range Preset'}
                      </label>
                      <select
                        value={scheduleForm.rangePreset}
                        onChange={(e) => setScheduleForm((current) => ({ ...current, rangePreset: e.target.value }))}
                        className="select"
                      >
                        <option value="this_month">{language === 'ar' ? 'هذا الشهر' : 'This Month'}</option>
                        <option value="last_month">{language === 'ar' ? 'الشهر الماضي' : 'Last Month'}</option>
                        <option value="this_week">{language === 'ar' ? 'هذا الأسبوع' : 'This Week'}</option>
                        <option value="last_7_days">{language === 'ar' ? 'آخر 7 أيام' : 'Last 7 Days'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        {language === 'ar' ? 'التكرار' : 'Frequency'}
                      </label>
                      <select
                        value={scheduleForm.frequency}
                        onChange={(e) => setScheduleForm((current) => ({ ...current, frequency: e.target.value }))}
                        className="select"
                      >
                        <option value="daily">{language === 'ar' ? 'يومي' : 'Daily'}</option>
                        <option value="weekly">{language === 'ar' ? 'أسبوعي' : 'Weekly'}</option>
                        <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                      </select>
                    </div>
                    {scheduleForm.frequency === 'weekly' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                          {language === 'ar' ? 'يوم الأسبوع' : 'Day of Week'}
                        </label>
                        <select
                          value={scheduleForm.dayOfWeek}
                          onChange={(e) => setScheduleForm((current) => ({ ...current, dayOfWeek: e.target.value }))}
                          className="select"
                        >
                          <option value="0">{language === 'ar' ? 'الأحد' : 'Sunday'}</option>
                          <option value="1">{language === 'ar' ? 'الاثنين' : 'Monday'}</option>
                          <option value="2">{language === 'ar' ? 'الثلاثاء' : 'Tuesday'}</option>
                          <option value="3">{language === 'ar' ? 'الأربعاء' : 'Wednesday'}</option>
                          <option value="4">{language === 'ar' ? 'الخميس' : 'Thursday'}</option>
                          <option value="5">{language === 'ar' ? 'الجمعة' : 'Friday'}</option>
                          <option value="6">{language === 'ar' ? 'السبت' : 'Saturday'}</option>
                        </select>
                      </div>
                    )}
                    {scheduleForm.frequency === 'monthly' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                          {language === 'ar' ? 'يوم الشهر' : 'Day of Month'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={scheduleForm.dayOfMonth}
                          onChange={(e) => setScheduleForm((current) => ({ ...current, dayOfMonth: e.target.value }))}
                          className="input"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        {language === 'ar' ? 'وقت الإرسال' : 'Send Time'}
                      </label>
                      <input
                        type="time"
                        value={scheduleForm.time}
                        onChange={(e) => setScheduleForm((current) => ({ ...current, time: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        {language === 'ar' ? 'لغة البريد' : 'Email Language'}
                      </label>
                      <select
                        value={scheduleForm.language}
                        onChange={(e) => setScheduleForm((current) => ({ ...current, language: e.target.value }))}
                        className="select"
                      >
                        <option value="en">English</option>
                        <option value="ar">العربية</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        {language === 'ar' ? 'المستلمون' : 'Recipients'}
                      </label>
                      <textarea
                        value={scheduleForm.recipients}
                        onChange={(e) => setScheduleForm((current) => ({ ...current, recipients: e.target.value }))}
                        className="input min-h-[80px]"
                        placeholder="admin@example.com, finance@example.com"
                      />
                    </div>
                    <div className="md:col-span-2 xl:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                        <ToggleSwitch
                          checked={scheduleForm.enabled}
                          onChange={() => setScheduleForm((current) => ({ ...current, enabled: !current.enabled }))}
                        />
                        {language === 'ar' ? 'تفعيل الجدولة فوراً' : 'Enable schedule immediately'}
                      </label>
                      <button
                        type="button"
                        onClick={handleCreateSchedule}
                        disabled={createScheduleMutation.isPending}
                        className="btn btn-primary"
                      >
                        {createScheduleMutation.isPending
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : (language === 'ar' ? 'حفظ الجدولة' : 'Save Schedule')}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Schedule list */}
          <div className="p-6 space-y-3">
            {schedulesLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-gray-100 dark:border-dark-700 p-4">
                    <SkeletonBlock className="h-4 w-48 mb-2" />
                    <SkeletonBlock className="h-3 w-64" />
                  </div>
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-dark-600">
                <Mail className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {language === 'ar' ? 'لا توجد جدولة تقارير حالياً.' : 'No scheduled reports yet.'}
                </p>
              </div>
            ) : (
              schedules.map((schedule, idx) => (
                <motion.div
                  key={schedule._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50/40 dark:bg-dark-700/20 px-5 py-4 hover:bg-gray-100/60 dark:hover:bg-dark-700/40 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">{schedule.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        schedule.enabled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-dark-600 dark:text-gray-400'
                      }`}>
                        {schedule.enabled ? (language === 'ar' ? 'مفعل' : 'Enabled') : (language === 'ar' ? 'متوقف' : 'Disabled')}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                        {schedule.reportType === 'internal_audit'
                          ? (language === 'ar' ? 'التدقيق الداخلي' : 'Internal Audit')
                          : schedule.reportType === 'external_audit'
                          ? (language === 'ar' ? 'التدقيق الخارجي' : 'External Audit')
                          : schedule.reportType === 'business'
                          ? (language === 'ar' ? 'الأعمال' : 'Business')
                          : 'VAT'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {language === 'ar'
                        ? `النطاق: ${schedule.rangePreset} • التكرار: ${schedule.frequency}`
                        : `Range: ${schedule.rangePreset} • Frequency: ${schedule.frequency}`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {language === 'ar' ? 'التالي:' : 'Next run:'} {formatDateTime(schedule.nextRunAt, language)}
                      {' · '}
                      {language === 'ar' ? 'آخر تشغيل:' : 'Last run:'} {formatDateTime(schedule.lastRunAt, language)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 break-all">{schedule.recipients.join(', ')}</p>
                    {schedule.lastError ? <p className="text-xs text-red-500">{schedule.lastError}</p> : null}
                  </div>
                  {canManageSchedules && (
                    <div className="flex items-center gap-3">
                      <ToggleSwitch
                        checked={schedule.enabled}
                        onChange={() => toggleScheduleMutation.mutate(schedule)}
                        disabled={toggleScheduleMutation.isPending}
                      />
                      <button
                        type="button"
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        disabled={deleteScheduleMutation.isPending}
                        onClick={() => deleteScheduleMutation.mutate(schedule._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl bg-gray-50 dark:bg-dark-800 border border-gray-100 dark:border-dark-700 px-5 py-4 text-sm text-gray-400 dark:text-gray-500"
        >
          <Mail className="w-4 h-4 shrink-0" />
          {language === 'ar'
            ? 'تحتاج إلى إضافة البريد الإلكتروني لتفعيل جدولة التقارير.'
            : 'You need the email add-on enabled to use scheduled report delivery.'}
        </motion.div>
      )}

      {/* ── Main report content ───────────────────────────────────────────── */}
      {!hasInvalidRange && (
        <>
          {isLoading ? renderSkeleton() : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/20 mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">
                {language === 'ar' ? 'فشل تحميل التقرير' : 'Failed to load report'}
              </p>
              <p className="text-sm text-gray-400">
                {language === 'ar' ? 'حاول مرة أخرى أو تحقق من الاتصال' : 'Please try again or check your connection'}
              </p>
            </motion.div>
          ) : isOps ? (
            <OperationsSection section={opsSection} language={language} t={t} />
          ) : reportType === 'internal_audit' ? (
            <InternalAuditView data={data} language={language} t={t} tenant={tenant} />
          ) : reportType === 'external_audit' ? (
            <ExternalAuditView data={data} language={language} t={t} tenant={tenant} />
          ) : data ? (
            <>
              {/* Export toolbar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {language === 'ar' ? 'تصدير جداول التقرير' : 'Export report tables'}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    value={exportTable}
                    onChange={(e) => setExportTable(e.target.value)}
                    className="select sm:w-56"
                  >
                    {reportType === 'business' ? (
                      <>
                        <option value="salesByTransactionType">{language === 'ar' ? 'المبيعات حسب النوع' : 'Sales by Type'}</option>
                        <option value="expensesByCategory">{language === 'ar' ? 'المصاريف حسب التصنيف' : 'Expenses by Category'}</option>
                        <option value="topCustomers">{language === 'ar' ? 'أفضل العملاء' : 'Top Customers'}</option>
                      </>
                    ) : (
                      <>
                        <option value="byCategory">{language === 'ar' ? 'ملخص حسب التصنيف' : 'Summary by Category'}</option>
                        <option value="byTransactionType">{language === 'ar' ? 'حسب نوع المعاملة' : 'By Transaction Type'}</option>
                        <option value="byTaxCategory">{language === 'ar' ? 'تفاصيل حسب فئة الضريبة' : 'Details by Tax Category'}</option>
                      </>
                    )}
                  </select>

                  <ExportMenu
                    language={language}
                    t={t}
                    rows={
                      reportType === 'business'
                        ? exportTable === 'expensesByCategory'
                          ? (data?.breakdown?.expensesByCategory || []).map((row) => ({
                            category: row._id,
                            count: row.count || 0,
                            totalAmount: row.totalAmount || 0,
                          }))
                          : exportTable === 'topCustomers'
                            ? (data?.breakdown?.topCustomers || []).map((row) => ({
                              customer: row._id,
                              invoiceCount: row.invoiceCount || 0,
                              revenue: row.revenue || 0,
                            }))
                            : (data?.breakdown?.salesByTransactionType || []).map((row) => ({
                              type: row._id,
                              invoiceCount: row.invoiceCount || 0,
                              discount: row.discount || 0,
                              revenue: row.revenue || 0,
                              tax: row.tax || 0,
                            }))
                        : exportTable === 'byTransactionType'
                          ? (data?.breakdown?.byTransactionType || []).map((row) => ({
                            type: row._id,
                            invoiceCount: row.invoiceCount || 0,
                            totalDiscount: row.totalDiscount || 0,
                            totalTax: row.totalTax || 0,
                          }))
                          : exportTable === 'byTaxCategory'
                            ? (data?.breakdown?.byTaxCategory || []).map((row) => ({
                              category: row._id?.taxCategory || '-',
                              rate: row._id?.taxRate ?? 0,
                              taxableAmount: row.taxableAmount || 0,
                              taxAmount: row.taxAmount || 0,
                            }))
                            : categories.map((c) => ({
                              category: c.label,
                              taxableAmount: byCategory?.[c.key]?.taxableAmount || 0,
                              taxAmount: byCategory?.[c.key]?.taxAmount || 0,
                            }))
                    }
                    columns={
                      reportType === 'business'
                        ? exportTable === 'expensesByCategory'
                          ? [
                            { key: 'category', label: language === 'ar' ? 'التصنيف' : 'Category', value: (r) => r.category },
                            { key: 'count', label: language === 'ar' ? 'العدد' : 'Count', value: (r) => r.count },
                            { key: 'totalAmount', label: language === 'ar' ? 'الإجمالي' : 'Total', value: (r) => r.totalAmount },
                          ]
                          : exportTable === 'topCustomers'
                            ? [
                              { key: 'customer', label: language === 'ar' ? 'العميل' : 'Customer', value: (r) => r.customer },
                              { key: 'invoiceCount', label: language === 'ar' ? 'عدد الفواتير' : 'Invoices', value: (r) => r.invoiceCount },
                              { key: 'revenue', label: language === 'ar' ? 'الإيراد' : 'Revenue', value: (r) => r.revenue },
                            ]
                            : [
                              { key: 'type', label: language === 'ar' ? 'النوع' : 'Type', value: (r) => r.type },
                              { key: 'invoiceCount', label: language === 'ar' ? 'عدد الفواتير' : 'Invoices', value: (r) => r.invoiceCount },
                              { key: 'discount', label: language === 'ar' ? 'الخصم' : 'Discount', value: (r) => r.discount },
                              { key: 'revenue', label: language === 'ar' ? 'الإيراد' : 'Revenue', value: (r) => r.revenue },
                              { key: 'tax', label: language === 'ar' ? 'الضريبة' : 'Tax', value: (r) => r.tax },
                            ]
                        : exportTable === 'byTransactionType'
                          ? [
                            { key: 'type', label: language === 'ar' ? 'النوع' : 'Type', value: (r) => r.type },
                            { key: 'invoiceCount', label: language === 'ar' ? 'عدد الفواتير' : 'Invoices', value: (r) => r.invoiceCount },
                            { key: 'totalDiscount', label: language === 'ar' ? 'الخصم' : 'Discount', value: (r) => r.totalDiscount },
                            { key: 'totalTax', label: language === 'ar' ? 'الضريبة' : 'VAT', value: (r) => r.totalTax },
                          ]
                          : exportTable === 'byTaxCategory'
                            ? [
                              { key: 'category', label: language === 'ar' ? 'الفئة' : 'Category', value: (r) => r.category },
                              { key: 'rate', label: language === 'ar' ? 'النسبة' : 'Rate', value: (r) => `${r.rate}%` },
                              { key: 'taxableAmount', label: language === 'ar' ? 'خاضع للضريبة' : 'Taxable', value: (r) => r.taxableAmount },
                              { key: 'taxAmount', label: language === 'ar' ? 'الضريبة' : 'VAT', value: (r) => r.taxAmount },
                            ]
                            : [
                              { key: 'category', label: language === 'ar' ? 'التصنيف' : 'Category', value: (r) => r.category },
                              { key: 'taxableAmount', label: language === 'ar' ? 'خاضع للضريبة' : 'Taxable', value: (r) => r.taxableAmount },
                              { key: 'taxAmount', label: language === 'ar' ? 'الضريبة' : 'VAT', value: (r) => r.taxAmount },
                            ]
                    }
                    fileBaseName={
                      reportType === 'business'
                        ? exportTable === 'expensesByCategory'
                          ? (language === 'ar' ? 'تقرير_المصاريف_حسب_التصنيف' : 'Business_Expenses_By_Category')
                          : exportTable === 'topCustomers'
                            ? (language === 'ar' ? 'تقرير_أفضل_العملاء' : 'Business_Top_Customers')
                            : (language === 'ar' ? 'تقرير_المبيعات_حسب_النوع' : 'Business_Sales_By_Type')
                        : exportTable === 'byTransactionType'
                          ? (language === 'ar' ? 'تقرير_حسب_نوع_المعاملة' : 'VAT_Return_By_TransactionType')
                          : exportTable === 'byTaxCategory'
                            ? (language === 'ar' ? 'تفاصيل_حسب_فئة_الضريبة' : 'VAT_Return_By_TaxCategory')
                            : (language === 'ar' ? 'تقرير_الضريبة_حسب_التصنيف' : 'VAT_Return_By_Category')
                    }
                    title={
                      reportType === 'business'
                        ? exportTable === 'expensesByCategory'
                          ? (language === 'ar' ? 'المصاريف حسب التصنيف' : 'Expenses by Category')
                          : exportTable === 'topCustomers'
                            ? (language === 'ar' ? 'أفضل العملاء' : 'Top Customers')
                            : (language === 'ar' ? 'المبيعات حسب النوع' : 'Sales by Type')
                        : exportTable === 'byTransactionType'
                          ? (language === 'ar' ? 'حسب نوع المعاملة' : 'By Transaction Type')
                          : exportTable === 'byTaxCategory'
                            ? (language === 'ar' ? 'تفاصيل حسب فئة الضريبة' : 'Details by Tax Category')
                            : (language === 'ar' ? 'ملخص حسب التصنيف' : 'Summary by Category')
                    }
                    disabled={false}
                  />
                </div>
              </motion.div>

              {/* ── Daily Invoices Report ─────────────────────────────────── */}
              {reportType === 'daily' ? (
                <div className="space-y-6">
                  {/* Daily KPIs */}
                  {(() => {
                    const rows = Array.isArray(data) ? data : []
                    const totalDays = rows.length
                    const totalInvoices = rows.reduce((acc, r) => acc + (r.invoiceCount || 0), 0)
                    const totalTax = rows.reduce((acc, r) => acc + (r.totalTax || 0), 0)
                    const totalAmount = rows.reduce((acc, r) => acc + (r.totalAmount || 0), 0)
                    const avgDaily = totalDays > 0 ? (totalAmount / totalDays) : 0

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <KpiCard
                            title={language === 'ar' ? 'أيام النشاط' : 'Trading Days'}
                            value={totalDays}
                            icon={Calendar}
                            iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
                            isCurrency={false}
                          />
                          <KpiCard
                            title={language === 'ar' ? 'إجمالي الفواتير الصادرة' : 'Invoices Issued'}
                            value={totalInvoices}
                            icon={Receipt}
                            iconBg="bg-gradient-to-br from-indigo-500 to-indigo-700"
                            isCurrency={false}
                          />
                          <KpiCard
                            title={language === 'ar' ? 'إجمالي ضريبة القيمة المضافة (15%)' : 'Total VAT (15%)'}
                            value={totalTax}
                            icon={ShieldCheck}
                            iconBg="bg-gradient-to-br from-amber-500 to-amber-700"
                          />
                          <KpiCard
                            title={language === 'ar' ? 'إجمالي المبيعات المحققة' : 'Gross Sales Revenue'}
                            value={totalAmount}
                            icon={TrendingUp}
                            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
                          />
                        </div>

                        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
                          <div className="px-6 py-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-5 h-5 text-primary-500" />
                              <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                  {language === 'ar' ? 'سجل المبيعات اليومية التفصيلي' : 'Daily Sales Revenue Ledger'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {language === 'ar' ? `المتوسط اليومي: ` : `Daily Average: `}
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    <Money value={avgDaily} />
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right">
                              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-dark-700/50">
                                <tr>
                                  <th className="px-6 py-4">{language === 'ar' ? 'التاريخ' : 'Date (YYYY-MM-DD)'}</th>
                                  <th className="px-6 py-4">{language === 'ar' ? 'عدد الفواتير' : 'Invoices Count'}</th>
                                  <th className="px-6 py-4">{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT Amount (15%)'}</th>
                                  <th className="px-6 py-4">{language === 'ar' ? 'الإجمالي الشامل' : 'Grand Total'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {rows.length > 0 ? (
                                  rows.map((row) => (
                                    <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row._id}</td>
                                      <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200">
                                          {row.invoiceCount}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                        <Money value={row.totalTax} />
                                      </td>
                                      <td className="px-6 py-4 font-bold text-primary-600 dark:text-primary-400">
                                        <Money value={row.totalAmount} />
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-500">
                                      {language === 'ar' ? 'لا توجد بيانات للفترة المحددة' : 'No sales records found for this period'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              {rows.length > 0 && (
                                <tfoot className="bg-gray-50/80 dark:bg-dark-700/80 font-bold border-t border-gray-200 dark:border-dark-600">
                                  <tr>
                                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                                      {language === 'ar' ? 'الإجمالي الكلي' : 'Total'}
                                    </td>
                                    <td className="px-6 py-4">{totalInvoices}</td>
                                    <td className="px-6 py-4 text-amber-600 dark:text-amber-400">
                                      <Money value={totalTax} />
                                    </td>
                                    <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400">
                                      <Money value={totalAmount} />
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : reportType === 'sales' ? (
                <div className="space-y-6">
                  {/* Customer Sales KPIs */}
                  {(() => {
                    const rows = Array.isArray(data) ? data : []
                    const totalCustomers = rows.length
                    const totalInvoices = rows.reduce((acc, r) => acc + (r.invoiceCount || 0), 0)
                    const totalRevenue = rows.reduce((acc, r) => acc + (r.totalAmount || 0), 0)
                    const avgPerCust = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <KpiCard
                            title={language === 'ar' ? 'العملاء النشطون' : 'Active Accounts'}
                            value={totalCustomers}
                            icon={Users}
                            iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
                            isCurrency={false}
                          />
                          <KpiCard
                            title={language === 'ar' ? 'إجمالي الفواتير للعملاء' : 'Billed Invoices'}
                            value={totalInvoices}
                            icon={Receipt}
                            iconBg="bg-gradient-to-br from-indigo-500 to-indigo-700"
                            isCurrency={false}
                          />
                          <KpiCard
                            title={language === 'ar' ? 'إجمالي المبيعات' : 'Customer Sales Revenue'}
                            value={totalRevenue}
                            icon={TrendingUp}
                            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
                          />
                          <KpiCard
                            title={language === 'ar' ? 'متوسط الإيراد لكل عميل' : 'Avg Revenue / Account'}
                            value={avgPerCust}
                            icon={BarChart3}
                            iconBg="bg-gradient-to-br from-purple-500 to-purple-700"
                          />
                        </div>

                        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
                          <div className="px-6 py-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Users className="w-5 h-5 text-primary-500" />
                              <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                  {language === 'ar' ? 'تقرير تحليل مبيعات العملاء' : 'Customer Revenue Breakdown'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {language === 'ar' ? 'مرتب حسب أعلى قيمة مبيعات مع نسبة الحصة من الإيرادات' : 'Ranked by total billed revenue with revenue share percentage'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right">
                              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-dark-700/50">
                                <tr>
                                  <th className="px-6 py-4 w-16 text-center">#</th>
                                  <th className="px-6 py-4">{language === 'ar' ? 'اسم العميل' : 'Customer Name'}</th>
                                  <th className="px-6 py-4">{language === 'ar' ? 'عدد الفواتير' : 'Invoices Count'}</th>
                                  <th className="px-6 py-4">{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales (SAR)'}</th>
                                  <th className="px-6 py-4">{language === 'ar' ? 'نسبة المساهمة' : 'Revenue Share'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {rows.length > 0 ? (
                                  rows.map((row, idx) => {
                                    const share = totalRevenue > 0 ? ((row.totalAmount / totalRevenue) * 100).toFixed(1) : '0.0'
                                    return (
                                      <tr key={row._id || idx} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                        <td className="px-6 py-4 text-center">
                                          <span
                                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                              idx === 0
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                : idx === 1
                                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                  : idx === 2
                                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                                                    : 'text-gray-400'
                                            }`}
                                          >
                                            {idx + 1}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                                          {row.customerName || (language === 'ar' ? 'عميل نقدي عام' : 'Walk-in Customer')}
                                        </td>
                                        <td className="px-6 py-4">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200">
                                            {row.invoiceCount}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                                          <Money value={row.totalAmount} />
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 w-20 bg-gray-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                              <div
                                                className="bg-primary-500 h-1.5 rounded-full"
                                                style={{ width: `${Math.min(100, Math.max(2, parseFloat(share)))}%` }}
                                              />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-500">{share}%</span>
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                      {language === 'ar' ? 'لا توجد بيانات عملاء' : 'No customer sales found'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              {rows.length > 0 && (
                                <tfoot className="bg-gray-50/80 dark:bg-dark-700/80 font-bold border-t border-gray-200 dark:border-dark-600">
                                  <tr>
                                    <td colSpan="2" className="px-6 py-4 text-gray-900 dark:text-white">
                                      {language === 'ar' ? 'الإجمالي الكلي' : 'Total'}
                                    </td>
                                    <td className="px-6 py-4">{totalInvoices}</td>
                                    <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400">
                                      <Money value={totalRevenue} />
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">100%</td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : reportType === 'business' ? (
                <>
                  {/* ── Travel Agency mode ──────────────────────────────── */}
                  {totals?.travelMargin?.isTravelAgency ? (
                    <>
                      {/* Travel-aware banner */}
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-3"
                      >
                        <span className="text-lg">✈️</span>
                        <div>
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                            {language === 'ar' ? 'تقرير وكالة السفر — نظام هامش الربح' : 'Travel Agency Report — Margin Scheme P&L'}
                          </p>
                          <p className="text-xs text-blue-600/80 dark:text-blue-400 mt-0.5">
                            {language === 'ar'
                              ? 'يُظهر هذا التقرير الهامش الفعلي المكتسب (السعر للعميل − تكلفة الوكالة)، وليس إجمالي الفوترة'
                              : 'This report shows your actual earned margin (customer price − agency cost), not the gross billing amount'}
                          </p>
                        </div>
                      </motion.div>

                      {/* 6-card travel KPI grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <KpiCard
                          icon={TrendingUp}
                          iconBg="bg-gradient-to-br from-slate-400 to-slate-600"
                          label={language === 'ar' ? 'إجمالي الفوترة' : 'Customer Billed'}
                          value={money(totals?.sales?.grandTotal || 0)}
                          valueClass="text-slate-700 dark:text-slate-300"
                          sub={language === 'ar' ? 'المبلغ الكلي للعملاء' : 'Total invoiced to clients'}
                          delay={0.05}
                        />
                        <KpiCard
                          icon={ShoppingCart}
                          iconBg="bg-gradient-to-br from-rose-400 to-rose-600"
                          label={language === 'ar' ? 'تكلفة الوكالة' : 'Agency Cost'}
                          value={money(totals?.travelMargin?.agencyCost || 0)}
                          valueClass="text-rose-600 dark:text-rose-400"
                          sub={language === 'ar' ? 'ما دُفع للموردين' : 'Paid to suppliers'}
                          delay={0.1}
                        />
                        <KpiCard
                          icon={BarChart3}
                          iconBg="bg-gradient-to-br from-emerald-400 to-emerald-600"
                          label={language === 'ar' ? 'الهامش الإجمالي' : 'Gross Margin'}
                          value={money(totals?.travelMargin?.marginTaxable || 0)}
                          valueClass="text-emerald-600 dark:text-emerald-400"
                          sub={language === 'ar' ? 'الإيراد الفعلي للوكالة (خاضع للضريبة)' : 'Actual agency revenue (taxable)'}
                          delay={0.15}
                        />
                        <KpiCard
                          icon={Receipt}
                          iconBg="bg-gradient-to-br from-primary-400 to-primary-600"
                          label={language === 'ar' ? 'ضريبة الهامش' : 'VAT on Margin'}
                          value={money(totals?.travelMargin?.vatOnMargin || 0)}
                          valueClass="text-primary-600 dark:text-primary-400"
                          sub={language === 'ar' ? 'ضريبة 15% على الهامش فقط' : '15% VAT on margin only'}
                          delay={0.2}
                        />
                        <KpiCard
                          icon={Tag}
                          iconBg="bg-gradient-to-br from-orange-400 to-orange-600"
                          label={language === 'ar' ? 'المصاريف' : 'Expenses'}
                          value={money(totals?.expenses?.totalAmount || 0)}
                          sub={language === 'ar' ? `قبل الضريبة: ${money((totals?.expenses?.totalAmount || 0) - (totals?.expenses?.taxAmount || 0))}` : `Pre-tax: ${money((totals?.expenses?.totalAmount || 0) - (totals?.expenses?.taxAmount || 0))}`}
                          delay={0.22}
                        />
                        <KpiCard
                          icon={TrendingUp}
                          iconBg={`bg-gradient-to-br ${(totals?.net || 0) >= 0 ? 'from-primary-400 to-primary-700' : 'from-red-400 to-red-600'}`}
                          label={language === 'ar' ? 'صافي الربح' : 'Net Profit'}
                          value={money(totals?.net || 0)}
                          valueClass={(totals?.net || 0) >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-red-600 dark:text-red-400'}
                          sub={language === 'ar' ? 'الهامش − المصاريف' : 'Margin − Expenses'}
                          delay={0.25}
                        />
                      </div>

                      {/* Travel agency P&L summary card */}
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden"
                      >
                        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-dark-700">
                          <span className="text-base">✈️</span>
                          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {language === 'ar' ? 'بيان الربح والخسارة — وكالة السفر' : 'Travel Agency P&L Statement'}
                          </h3>
                        </div>
                        <div className="p-6">
                          <div className="space-y-2 text-sm">
                            {[
                              {
                                label: language === 'ar' ? 'إجمالي الفوترة للعملاء' : 'Gross Billing to Clients',
                                value: totals?.sales?.grandTotal || 0,
                                class: 'text-slate-700 dark:text-slate-300',
                                indent: false,
                              },
                              {
                                label: language === 'ar' ? 'تكلفة الوكالة (مدفوعة للموردين)' : 'Agency Cost (paid to suppliers)',
                                value: -(totals?.travelMargin?.agencyCost || 0),
                                class: 'text-rose-600 dark:text-rose-400',
                                indent: true,
                              },
                              null, // divider
                              {
                                label: language === 'ar' ? 'الهامش الإجمالي (الإيراد الفعلي)' : 'Gross Margin (Actual Revenue)',
                                value: totals?.travelMargin?.marginTaxable || 0,
                                class: 'text-emerald-700 dark:text-emerald-400 font-bold',
                                indent: false,
                              },
                              {
                                label: language === 'ar' ? 'ضريبة القيمة المضافة على الهامش (15%)' : 'VAT on Margin (15%)',
                                value: -(totals?.travelMargin?.vatOnMargin || 0),
                                class: 'text-primary-600 dark:text-primary-400',
                                indent: true,
                              },
                              {
                                label: language === 'ar' ? 'المصاريف التشغيلية (قبل الضريبة)' : 'Operating Expenses (pre-tax)',
                                value: -Math.max(0, (totals?.expenses?.totalAmount || 0) - (totals?.expenses?.taxAmount || 0)),
                                class: 'text-orange-600 dark:text-orange-400',
                                indent: true,
                              },
                              null, // divider
                              {
                                label: language === 'ar' ? 'صافي الربح' : 'Net Profit',
                                value: totals?.net || 0,
                                class: (totals?.net || 0) >= 0 ? 'text-primary-600 dark:text-primary-400 font-bold text-base' : 'text-red-600 dark:text-red-400 font-bold text-base',
                                indent: false,
                              },
                            ].map((row, i) =>
                              row === null ? (
                                <div key={i} className="border-t border-gray-100 dark:border-dark-700 my-3" />
                              ) : (
                                <div key={i} className={`flex items-center justify-between py-1 ${row.indent ? 'pl-5 text-gray-500 dark:text-gray-400' : ''}`}>
                                  <span className={row.indent ? '' : 'font-semibold text-gray-700 dark:text-gray-200'}>{row.label}</span>
                                  <span className={row.class}>{money(row.value)}</span>
                                </div>
                              )
                            )}
                          </div>

                          {/* Margin % badge */}
                          {(totals?.travelMargin?.customerNet || 0) > 0 && (
                            <div className="mt-5 flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 px-4 py-3">
                              <div>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                                  {language === 'ar' ? 'نسبة هامش الربح' : 'Margin Rate'}
                                </p>
                                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                                  {(((totals?.travelMargin?.marginTaxable || 0) / (totals?.travelMargin?.customerNet || 1)) * 100).toFixed(1)}%
                                </p>
                              </div>
                              <div className="ml-auto text-right">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                  {language === 'ar' ? 'الهامش ÷ إجمالي الفوترة' : 'Margin ÷ Gross Billing'}
                                </p>
                                <p className="text-xs text-emerald-500 mt-0.5">
                                  {money(totals?.travelMargin?.marginTaxable || 0)} / {money(totals?.travelMargin?.customerNet || 0)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  ) : (
                    /* ── Regular business KPI grid ──────────────────────── */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <KpiCard
                        icon={TrendingUp}
                        iconBg="bg-gradient-to-br from-emerald-400 to-emerald-600"
                        label={language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}
                        value={money(totals?.sales?.grandTotal || 0)}
                        valueClass="text-emerald-600 dark:text-emerald-400"
                        sub={language === 'ar' ? `صافي: ${money(totals?.sales?.taxableAmount || 0)}` : `Ex-VAT: ${money(totals?.sales?.taxableAmount || 0)}`}
                        delay={0.05}
                      />
                      <KpiCard
                        icon={ShoppingCart}
                        iconBg="bg-gradient-to-br from-blue-400 to-blue-600"
                        label={language === 'ar' ? 'المشتريات' : 'Purchases'}
                        value={money(totals?.purchases?.grandTotal || 0)}
                        sub={language === 'ar' ? `صافي: ${money(totals?.purchases?.taxableAmount || 0)}` : `Ex-VAT: ${money(totals?.purchases?.taxableAmount || 0)}`}
                        delay={0.1}
                      />
                      <KpiCard
                        icon={Receipt}
                        iconBg="bg-gradient-to-br from-orange-400 to-orange-600"
                        label={language === 'ar' ? 'المصاريف' : 'Expenses'}
                        value={money(totals?.expenses?.totalAmount || 0)}
                        sub={language === 'ar' ? `قبل الضريبة: ${money((totals?.expenses?.totalAmount || 0) - (totals?.expenses?.taxAmount || 0))}` : `Pre-tax: ${money((totals?.expenses?.totalAmount || 0) - (totals?.expenses?.taxAmount || 0))}`}
                        delay={0.15}
                      />
                      <KpiCard
                        icon={Tag}
                        iconBg="bg-gradient-to-br from-amber-400 to-amber-600"
                        label={language === 'ar' ? 'خصومات المبيعات' : 'Sales Discounts'}
                        value={money(totals?.sales?.totalDiscount || 0)}
                        valueClass="text-amber-600 dark:text-amber-400"
                        delay={0.2}
                      />
                      <KpiCard
                        icon={BarChart3}
                        iconBg={`bg-gradient-to-br ${(totals?.net || 0) >= 0 ? 'from-primary-400 to-primary-700' : 'from-red-400 to-red-600'}`}
                        label={language === 'ar' ? 'صافي الربح' : 'Net Profit'}
                        value={money(totals?.net || 0)}
                        valueClass={(totals?.net || 0) >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-red-600 dark:text-red-400'}
                        sub={language === 'ar' ? 'مبيعات − مشتريات − مصاريف (بدون ضريبة)' : 'Sales − Purchases − Expenses (ex-VAT)'}
                        delay={0.25}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard
                      title={language === 'ar' ? 'المبيعات حسب النوع' : 'Sales by Type'}
                      delay={0.15}
                    >
                      <PremiumTable
                        headers={[
                          language === 'ar' ? 'النوع' : 'Type',
                          language === 'ar' ? 'عدد الفواتير' : 'Invoices',
                          language === 'ar' ? 'الخصم' : 'Discount',
                          language === 'ar' ? 'الإيراد' : 'Revenue',
                        ]}
                        rows={(data?.breakdown?.salesByTransactionType || []).map((row) => [
                          row._id,
                          (row.invoiceCount || 0).toLocaleString(),
                          money(row.discount || 0),
                          money(row.revenue || 0),
                        ])}
                        emptyText={t('noData')}
                      />
                    </SectionCard>

                    <SectionCard
                      title={language === 'ar' ? 'المصاريف حسب التصنيف' : 'Expenses by Category'}
                      delay={0.2}
                    >
                      <PremiumTable
                        headers={[
                          language === 'ar' ? 'التصنيف' : 'Category',
                          language === 'ar' ? 'العدد' : 'Count',
                          language === 'ar' ? 'الإجمالي' : 'Total',
                        ]}
                        rows={(data?.breakdown?.expensesByCategory || []).map((row) => [
                          row._id,
                          (row.count || 0).toLocaleString(),
                          money(row.totalAmount || 0),
                        ])}
                        emptyText={t('noData')}
                      />
                    </SectionCard>
                  </div>

                  <SectionCard
                    title={language === 'ar' ? 'أفضل العملاء' : 'Top Customers'}
                    delay={0.25}
                  >
                    <PremiumTable
                      headers={[
                        language === 'ar' ? 'العميل' : 'Customer',
                        language === 'ar' ? 'عدد الفواتير' : 'Invoices',
                        language === 'ar' ? 'الإيراد' : 'Revenue',
                      ]}
                      rows={(data?.breakdown?.topCustomers || []).map((row, i) => [
                        row._id,
                        (row.invoiceCount || 0).toLocaleString(),
                        money(row.revenue || 0),
                      ])}
                      emptyText={t('noData')}
                    />
                  </SectionCard>
                </>
              ) : (
                /* ── VAT Return Report ────────────────────────────────── */
                <>
                  {/* KPI grid — 5 cards (VAT) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard
                      icon={FileText}
                      iconBg="bg-gradient-to-br from-slate-400 to-slate-600"
                      label={language === 'ar' ? 'عدد الفواتير' : 'Invoices'}
                      value={(totals?.invoiceCount || 0).toLocaleString()}
                      delay={0.05}
                    />
                    <KpiCard
                      icon={Tag}
                      iconBg="bg-gradient-to-br from-amber-400 to-amber-600"
                      label={language === 'ar' ? 'الخصومات' : 'Discounts'}
                      value={money(totals?.totalDiscount || 0)}
                      valueClass="text-amber-600 dark:text-amber-400"
                      delay={0.1}
                    />
                    <KpiCard
                      icon={BarChart3}
                      iconBg="bg-gradient-to-br from-blue-400 to-blue-600"
                      label={language === 'ar' ? 'المبلغ الخاضع للضريبة' : 'Taxable Amount'}
                      value={money(totals?.taxableAmount || 0)}
                      delay={0.15}
                    />
                    <KpiCard
                      icon={Receipt}
                      iconBg="bg-gradient-to-br from-primary-400 to-primary-700"
                      label={language === 'ar' ? 'إجمالي ضريبة القيمة المضافة' : 'Total VAT'}
                      value={money(totals?.totalTax || 0)}
                      valueClass="text-primary-600 dark:text-primary-400"
                      delay={0.2}
                    />
                    <KpiCard
                      icon={TrendingUp}
                      iconBg="bg-gradient-to-br from-emerald-400 to-emerald-600"
                      label={language === 'ar' ? 'الإجمالي' : 'Grand Total'}
                      value={money(totals?.grandTotal || 0)}
                      delay={0.25}
                    />
                  </div>

                  {/* Summary by category + by transaction type */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard
                      title={language === 'ar' ? 'ملخص حسب التصنيف' : 'Summary by Category'}
                      delay={0.15}
                    >
                      <PremiumTable
                        headers={[
                          language === 'ar' ? 'التصنيف' : 'Category',
                          language === 'ar' ? 'خاضع للضريبة' : 'Taxable',
                          language === 'ar' ? 'الضريبة' : 'VAT',
                        ]}
                        rows={categories.map((c) => [
                          c.label,
                          money(byCategory?.[c.key]?.taxableAmount || 0),
                          money(byCategory?.[c.key]?.taxAmount || 0),
                        ])}
                        emptyText={t('noData')}
                      />
                    </SectionCard>

                    <SectionCard
                      title={language === 'ar' ? 'حسب نوع المعاملة' : 'By Transaction Type'}
                      delay={0.2}
                    >
                      <PremiumTable
                        headers={[
                          language === 'ar' ? 'النوع' : 'Type',
                          language === 'ar' ? 'عدد الفواتير' : 'Invoices',
                          language === 'ar' ? 'الخصم' : 'Discount',
                          language === 'ar' ? 'الضريبة' : 'VAT',
                        ]}
                        rows={(data?.breakdown?.byTransactionType || []).map((row) => [
                          row._id,
                          (row.invoiceCount || 0).toLocaleString(),
                          money(row.totalDiscount || 0),
                          money(row.totalTax || 0),
                        ])}
                        emptyText={t('noData')}
                      />
                    </SectionCard>
                  </div>

                  {/* Travel Margin scheme */}
                  {(totals?.travelMargin?.lineCount || 0) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-200/60 dark:border-primary-800/30 p-6"
                    >
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
                        {language === 'ar' ? 'وكالات السفر — نظام هامش الربح' : 'Travel Agency — Margin Scheme'}
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        {language === 'ar'
                          ? 'ضريبة القيمة المضافة محسوبة على هامش الربح فقط (سعر البيع - سعر الوكالة)'
                          : 'VAT is calculated on profit margin only (Unit Price - Agency Price)'}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                          { label: language === 'ar' ? 'عدد البنود' : 'Margin Lines', value: (totals.travelMargin.lineCount || 0).toLocaleString(), color: '' },
                          { label: language === 'ar' ? 'صافي العميل' : 'Customer Net', value: money(totals.travelMargin.customerNet || 0), color: '' },
                          { label: language === 'ar' ? 'تكلفة الوكالة' : 'Agency Cost', value: money(totals.travelMargin.agencyCost || 0), color: '' },
                          { label: language === 'ar' ? 'هامش الربح (خاضع للضريبة)' : 'Profit Margin (Taxable)', value: money(totals.travelMargin.marginTaxable || 0), color: 'text-emerald-600' },
                          { label: language === 'ar' ? 'ضريبة على الربح 15%' : 'VAT on Profit (15%)', value: money(totals.travelMargin.taxAmount || 0), color: 'text-primary-600' },
                        ].map((item, i) => (
                          <div key={i}>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{item.label}</p>
                            <p className={`text-lg font-bold ${item.color || 'text-gray-800 dark:text-gray-100'}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Details by tax category */}
                  <SectionCard
                    title={language === 'ar' ? 'تفاصيل حسب فئة الضريبة' : 'Details by Tax Category'}
                    delay={0.25}
                  >
                    <PremiumTable
                      headers={[
                        language === 'ar' ? 'الفئة' : 'Category',
                        language === 'ar' ? 'النسبة' : 'Rate',
                        language === 'ar' ? 'خاضع للضريبة' : 'Taxable',
                        language === 'ar' ? 'الضريبة' : 'VAT',
                      ]}
                      rows={(data?.breakdown?.byTaxCategory || []).map((row, i) => [
                        row._id?.taxCategory || '-',
                        `${row._id?.taxRate ?? 0}%`,
                        money(row.taxableAmount || 0),
                        money(row.taxAmount || 0),
                      ])}
                      emptyText={t('noData')}
                    />
                  </SectionCard>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

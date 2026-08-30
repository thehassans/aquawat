import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Activity,
  KeyRound, RefreshCw, FileSearch, Link2, Zap, Download, Upload,
  ChevronDown, ChevronRight, Loader2, Clock, ZapOff, RotateCcw,
  Building2, FileText,
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { formatSubscriptionDate } from '../../lib/subscriptionState'
import { useZatcaQueueStream } from '../../hooks/useZatcaQueueStream'
import ZatcaComplianceCalendar from '../../components/zatca/ZatcaComplianceCalendar'
import ZatcaOnboardingWizard from '../../components/zatca/ZatcaOnboardingWizard'

const STATUS_COLORS = {
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  reported: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cleared: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

const SEVERITY_COLORS = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function StatCard({ icon: Icon, label, value, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </motion.div>
  )
}

function TenantRow({ tenant, onAction, onOnboard }) {
  const [expanded, setExpanded] = useState(false)
  const { language } = useSelector((state) => state.ui)

  const { data: status } = useQuery({
    queryKey: ['zatca-tenant-status', tenant._id],
    queryFn: () => api.get(`/super-admin/zatca/tenant/${tenant._id}/status`).then(res => res.data),
    enabled: expanded,
  })

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-700">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
          {tenant.name}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {tenant.slug}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${tenant.zatca?.phase === 2 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
            Phase {tenant.zatca?.phase || 1}
          </span>
        </td>
        <td className="px-4 py-3">
          {tenant.zatca?.isOnboarded ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Onboarded
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <XCircle className="w-3.5 h-3.5" /> Not Onboarded
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${tenant.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {tenant.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onAction('verify-chain', tenant._id)}
              className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              title="Verify Chain"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAction('verify-qr', tenant._id)}
              className="p-1.5 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-600 dark:text-violet-400"
              title="Verify QR"
            >
              <FileSearch className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAction('rotate-keys', tenant._id)}
              className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400"
              title="Rotate Keys"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAction('backup-keys', tenant._id)}
              className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              title="Backup Keys"
            >
              <Download className="w-4 h-4" />
            </button>
            {!tenant.zatca?.isOnboarded && onOnboard && (
              <button
                onClick={() => onOnboard(tenant)}
                className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                title="Onboard (Phase 2 Wizard)"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {expanded && status && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 dark:bg-dark-800"
          >
            <td colSpan={7} className="px-8 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Invoice Stats</p>
                  {Object.entries(status.invoiceStats || {}).map(([key, val]) => (
                    <p key={key} className="text-sm text-gray-700 dark:text-gray-300">
                      {key}: <span className="font-medium">{val}</span>
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">QR Integrity</p>
                  {status.qrIntegrity ? (
                    <p className={`text-sm font-medium ${status.qrIntegrity.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                      {status.qrIntegrity.valid ? 'Valid' : 'Invalid'}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">No QR data</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Invoice</p>
                  {status.lastInvoice ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {status.lastInvoice.invoiceNumber}<br />
                      <span className="text-xs text-gray-400">{formatSubscriptionDate(status.lastInvoice.issueDate, language)}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">None</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Recent Events</p>
                  {(status.recentLogs || []).slice(0, 3).map((log, i) => (
                    <p key={i} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${log.severity === 'critical' ? 'bg-red-500' : log.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      {log.message}
                    </p>
                  ))}
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
}

export default function ZatcaManagement() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [auditFilters, setAuditFilters] = useState({ action: '', severity: '', page: 1 })
  const [actionLoading, setActionLoading] = useState(null)
  const [actionResult, setActionResult] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(null)
  const liveQueue = useZatcaQueueStream()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['zatca-stats'],
    queryFn: () => api.get('/super-admin/zatca/stats').then(res => res.data),
  })

  const { data: queueStatus } = useQuery({
    queryKey: ['zatca-queue-status'],
    queryFn: () => api.get('/super-admin/zatca/queue/status').then(res => res.data),
    refetchInterval: 10000,
  })

  const { data: tenantsData } = useQuery({
    queryKey: ['zatca-tenants'],
    queryFn: () => api.get('/super-admin/tenants', { params: { limit: 100 } }).then(res => res.data),
  })

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['zatca-audit-logs', auditFilters],
    queryFn: () => api.get('/super-admin/zatca/audit-logs', { params: { ...auditFilters, limit: 50 } }).then(res => res.data),
    enabled: activeTab === 'audit',
  })

  const handleAction = async (action, tenantId) => {
    setActionLoading(`${action}-${tenantId}`)
    setActionResult(null)
    try {
      const endpoint = `/super-admin/zatca/tenant/${tenantId}/${action}`
      const res = await api.post(endpoint, action === 'rebuild-chain' ? { dryRun: true } : {})
      setActionResult({ action, tenantId, success: true, data: res.data })
      queryClient.invalidateQueries({ queryKey: ['zatca-stats'] })
      queryClient.invalidateQueries({ queryKey: ['zatca-tenant-status', tenantId] })
    } catch (error) {
      setActionResult({ action, tenantId, success: false, error: error.response?.data?.error || error.message })
    } finally {
      setActionLoading(null)
    }
  }

  const processQueueMutation = useMutation({
    mutationFn: () => api.post('/super-admin/zatca/queue/process', { batchSize: 25 }).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zatca-queue-status'] })
    },
  })

  const tenants = tenantsData?.tenants || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary-600" />
            {language === 'ar' ? 'إدارة ZATCA' : 'ZATCA Management'}
          </h1>
          <p className="text-gray-500 mt-1">
            {language === 'ar' ? 'الأمان، التعافي من الكوارث، ومراقبة الامتثال' : 'Security, disaster recovery & compliance monitoring'}
          </p>
        </div>
      </div>

      {actionResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border ${actionResult.success ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}
        >
          <div className="flex items-start gap-3">
            {actionResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${actionResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {actionResult.action.replace(/-/g, ' ')} {actionResult.success ? 'completed' : 'failed'}
              </p>
              {actionResult.success && actionResult.data?.message && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{actionResult.data.message}</p>
              )}
              {actionResult.success && actionResult.data?.results && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {actionResult.data.results.validCount || 0} valid, {actionResult.data.results.invalidCount || actionResult.data.results.brokenLinks || 0} issues
                </p>
              )}
              {!actionResult.success && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{actionResult.error}</p>
              )}
            </div>
            <button onClick={() => setActionResult(null)} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-700">
        {[
          { id: 'overview', label: language === 'ar' ? 'نظرة عامة' : 'Overview' },
          { id: 'tenants', label: language === 'ar' ? 'المستأجرون' : 'Tenants' },
          { id: 'queue', label: language === 'ar' ? 'الطابور' : 'Queue' },
          { id: 'audit', label: language === 'ar' ? 'سجل التدقيق' : 'Audit Logs' },
          { id: 'calendar', label: language === 'ar' ? 'التقويم' : 'Calendar' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Building2} label={language === 'ar' ? 'إجمالي المستأجرين' : 'Total Tenants'} value={stats?.tenants?.total || 0} color="from-primary-500 to-primary-600" delay={0} />
            <StatCard icon={CheckCircle2} label={language === 'ar' ? 'تم الربط' : 'Onboarded'} value={stats?.tenants?.onboarded || 0} color="from-emerald-500 to-emerald-600" delay={0.1} />
            <StatCard icon={FileText} label={language === 'ar' ? 'فواتير ZATCA' : 'ZATCA Invoices'} value={stats?.invoices?.total || 0} color="from-violet-500 to-violet-600" delay={0.2} />
            <StatCard icon={AlertTriangle} label={language === 'ar' ? 'فواتير فاشلة' : 'Failed Invoices'} value={stats?.invoices?.failed || 0} color="from-red-500 to-red-600" delay={0.3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Sync Status</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Synced</span>
                  <span className="font-medium text-emerald-600">{stats?.invoices?.synced || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pending</span>
                  <span className="font-medium text-amber-600">{stats?.invoices?.pending || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Failed</span>
                  <span className="font-medium text-red-600">{stats?.invoices?.failed || 0}</span>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Queue Status</h3>
                {liveQueue.connected && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Queued</span>
                  <span className="font-medium text-blue-600">{(liveQueue.data?.queue?.queued ?? queueStatus?.queue?.queued) || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Processing</span>
                  <span className="font-medium text-amber-600">{(liveQueue.data?.queue?.processing ?? queueStatus?.queue?.processing) || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Failed</span>
                  <span className="font-medium text-red-600">{queueStatus?.queue?.failed || 0}</span>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <ZapOff className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Circuit Breakers</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Active</span>
                  <span className="font-medium text-gray-600">{queueStatus?.circuitBreakers?.total || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tripped</span>
                  <span className={`font-medium ${queueStatus?.circuitBreakers?.tripped > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {queueStatus?.circuitBreakers?.tripped || 0}
                  </span>
                </div>
                <button
                  onClick={() => processQueueMutation.mutate()}
                  disabled={processQueueMutation.isPending}
                  className="mt-2 w-full btn btn-primary btn-sm flex items-center justify-center gap-1.5"
                >
                  {processQueueMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Process Queue
                </button>
              </div>
            </div>
          </div>

          {stats?.recentAlerts?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Alerts</h3>
              </div>
              <div className="space-y-2">
                {stats.recentAlerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info}`}>
                      {alert.severity}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {alert.tenantId?.name || 'Unknown'} - {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'tenants' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarded</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {tenants.map((tenant) => (
                    <TenantRow key={tenant._id} tenant={tenant} onAction={handleAction} onOnboard={(t) => setShowOnboarding({ tenantId: t._id, tenantName: t.name })} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'queue' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {['queued', 'processing', 'reported', 'cleared', 'failed', 'cancelled'].map((status) => (
              <div key={status} className="card p-4">
                <p className="text-xs text-gray-500 capitalize mb-1">{status}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {queueStatus?.queue?.[status] || 0}
                </p>
              </div>
            ))}
          </div>

          {queueStatus?.circuitBreakers?.tripped > 0 && (
            <div className="card p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <ZapOff className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Tripped Circuit Breakers</h3>
              </div>
              {queueStatus.circuitBreakers.details.map((cb, i) => (
                <div key={i} className="text-xs text-red-600 dark:text-red-400">
                  Tenant {cb.tenantId}: {cb.failures} failures, resets in {Math.ceil(cb.timeUntilReset / 1000 / 60)} min
                </div>
              ))}
            </div>
          )}

          {queueStatus?.recentFailed?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Failed Submissions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Retries</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                    {queueStatus.recentFailed.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{item.invoiceNumber}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{item.tenantId?.name || 'Unknown'}</td>
                        <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400 max-w-xs truncate">{item.lastError}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{item.retryCount}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{formatSubscriptionDate(item.updatedAt, language)}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={async () => {
                              try {
                                await api.post(`/super-admin/zatca/queue/${item._id}/retry`)
                                queryClient.invalidateQueries({ queryKey: ['zatca-queue-status'] })
                              } catch (err) { console.error(err) }
                            }}
                            className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'audit' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <select
              value={auditFilters.action}
              onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value, page: 1 })}
              className="input text-sm py-1.5"
            >
              <option value="">All Actions</option>
              <option value="key_rotation">Key Rotation</option>
              <option value="chain_recovery">Chain Recovery</option>
              <option value="chain_verification">Chain Verification</option>
              <option value="qr_integrity_check">QR Integrity Check</option>
              <option value="disaster_recovery">Disaster Recovery</option>
              <option value="manual_sync">Manual Sync</option>
              <option value="config_update">Config Update</option>
              <option value="security_alert">Security Alert</option>
            </select>
            <select
              value={auditFilters.severity}
              onChange={(e) => setAuditFilters({ ...auditFilters, severity: e.target.value, page: 1 })}
              className="input text-sm py-1.5"
            >
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {auditLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                    {(auditLogs?.logs || []).map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.info}`}>
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{log.action.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : log.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md truncate">{log.message}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{log.tenantId?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {auditLogs?.pagination && auditLogs.pagination.pages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-dark-700">
                  <p className="text-xs text-gray-500">
                    Page {auditLogs.pagination.page} of {auditLogs.pagination.pages} ({auditLogs.pagination.total} total)
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setAuditFilters({ ...auditFilters, page: auditFilters.page - 1 })}
                      disabled={auditFilters.page <= 1}
                      className="btn btn-secondary btn-sm disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setAuditFilters({ ...auditFilters, page: auditFilters.page + 1 })}
                      disabled={auditFilters.page >= auditLogs.pagination.pages}
                      className="btn btn-secondary btn-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'calendar' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ZatcaComplianceCalendar />
        </motion.div>
      )}

      {showOnboarding && (
        <ZatcaOnboardingWizard
          tenantId={showOnboarding.tenantId}
          tenantName={showOnboarding.tenantName}
          onClose={() => setShowOnboarding(null)}
          onComplete={() => {
            setShowOnboarding(null)
            queryClient.invalidateQueries({ queryKey: ['zatca-tenants'] })
            queryClient.invalidateQueries({ queryKey: ['zatca-stats'] })
          }}
        />
      )}
    </div>
  )
}

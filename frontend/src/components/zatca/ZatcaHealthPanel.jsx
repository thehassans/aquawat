import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Activity,
  KeyRound, FileText, Zap, TrendingUp, Clock,
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'

const STATUS_CONFIG = {
  healthy: { color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  warning: { color: 'from-amber-500 to-amber-600', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  critical: { color: 'from-red-500 to-red-600', text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: XCircle },
}

export default function ZatcaHealthPanel() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const { data: health, isLoading } = useQuery({
    queryKey: ['zatca-health'],
    queryFn: () => api.get('/tenant/compliance/config/zatca-health').then(res => res.data),
    refetchInterval: 30000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!health) return null

  const statusConfig = STATUS_CONFIG[health.status] || STATUS_CONFIG.healthy
  const StatusIcon = statusConfig.icon

  const stats = [
    { label: t('Total Invoices', 'إجمالي الفواتير'), value: health.invoices.total, icon: FileText, color: 'from-blue-500 to-blue-600' },
    { label: t('Synced', 'مزامنة'), value: health.invoices.synced, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600' },
    { label: t('Pending', 'قيد الانتظار'), value: health.invoices.pending, icon: Clock, color: 'from-amber-500 to-amber-600' },
    { label: t('Failed', 'فشل'), value: health.invoices.failed, icon: XCircle, color: 'from-red-500 to-red-600' },
  ]

  return (
    <div className="space-y-4">
      <div className={`card p-5 border ${statusConfig.border} ${statusConfig.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${statusConfig.color} shadow-lg`}>
              <StatusIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('ZATCA Health', 'صحة ZATCA')}
              </h3>
              <p className={`text-sm font-medium ${statusConfig.text}`}>
                {health.status === 'healthy' ? t('All systems operational', 'جميع الأنظمة تعمل') : t('Issues detected', 'تم اكتشاف مشاكل')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t('Health Score', 'درجة الصحة')}</p>
            <p className={`text-3xl font-bold ${statusConfig.text}`}>{health.healthScore}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary-600" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('Configuration', 'التكوين')}
            </h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('Phase', 'المرحلة')}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {health.tenant.phase === 1 ? 'Phase 1 (Standard TLV)' : `Phase ${health.tenant.phase}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('Onboarded', 'تم الربط')}</span>
              <span className={`font-medium ${health.tenant.isOnboarded ? 'text-emerald-600' : 'text-gray-400'}`}>
                {health.tenant.phase === 1 ? t('Phase 1 Active', 'مفعّل (المرحلة 1)') : (health.tenant.isOnboarded ? t('Yes', 'نعم') : t('No', 'لا'))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('Environment', 'البيئة')}</span>
              <span className="font-medium text-gray-900 dark:text-white capitalize">{health.tenant.environment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{health.tenant.phase === 1 ? t('QR Engine', 'محرك QR') : t('Key Encrypted', 'المفتاح مشفر')}</span>
              <span className={`font-medium ${health.tenant.keyEncrypted ? 'text-emerald-600' : 'text-amber-600'}`}>
                {health.tenant.phase === 1 ? t('TLV Ready', 'جاهز (TLV)') : (health.tenant.keyEncrypted ? t('Yes', 'نعم') : t('No', 'لا'))}
              </span>
            </div>
            {health.tenant.onboardedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('Onboarded At', 'تاريخ الربط')}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">
                  {new Date(health.tenant.onboardedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('Last Invoice', 'آخر فاتورة')}
            </h4>
          </div>
          {health.lastInvoice ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('Number', 'الرقم')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{health.lastInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('Date', 'التاريخ')}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">
                  {new Date(health.lastInvoice.issueDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('Status', 'الحالة')}</span>
                <span className={`font-medium capitalize ${health.tenant.phase === 1 || health.lastInvoice.zatca?.submissionStatus === 'reported' || health.lastInvoice.zatca?.submissionStatus === 'cleared' ? 'text-emerald-600' : health.lastInvoice.zatca?.submissionStatus === 'failed' || health.lastInvoice.zatca?.submissionStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
                  {health.tenant.phase === 1 ? t('Phase 1 Compliant (QR)', 'متوافقة (المرحلة 1)') : (health.lastInvoice.zatca?.submissionStatus || 'pending')}
                </span>
              </div>
              {health.qrIntegrity && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('QR Integrity', 'سلامة QR')}</span>
                  <span className={`font-medium ${health.qrIntegrity.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                    {health.qrIntegrity.valid ? t('Valid', 'صالح') : t('Invalid', 'غير صالح')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t('No invoices yet', 'لا توجد فواتير')}</p>
          )}
        </div>
      </div>

      {health.issues && health.issues.length > 0 && (
        <div className={`card p-4 border ${statusConfig.border} ${statusConfig.bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('Active Issues', 'المشاكل النشطة')}
            </h4>
          </div>
          <ul className="space-y-1">
            {health.issues.map((issue, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {health.queue && Object.keys(health.queue).length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('Submission Queue', 'طابور الإرسال')}
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(health.queue).map(([status, count]) => (
              <span key={status} className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-300 capitalize">
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

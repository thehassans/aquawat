import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  Calendar, AlertTriangle, Clock, KeyRound, FileWarning,
  ShieldCheck, ChevronRight,
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { formatSubscriptionDate } from '../../lib/subscriptionState'

const EVENT_CONFIG = {
  cert_expiry: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  cert_renewal_due: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
  key_rotation: { icon: KeyRound, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  failed_invoices: { icon: FileWarning, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
}

const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

function formatDate(dateStr, language = 'en') {
  const d = new Date(dateStr)
  const today = new Date()
  const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return language === 'ar' ? 'اليوم' : 'Today'
  if (diffDays === 1) return language === 'ar' ? 'غداً' : 'Tomorrow'
  if (diffDays < 0) return language === 'ar' ? `منذ ${Math.abs(diffDays)}ي` : `${Math.abs(diffDays)}d ago`
  if (diffDays < 30) return language === 'ar' ? `خلال ${diffDays}ي` : `In ${diffDays}d`
  return formatSubscriptionDate(dateStr, language)
}

export default function ZatcaComplianceCalendar() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const { data, isLoading } = useQuery({
    queryKey: ['zatca-compliance-calendar'],
    queryFn: () => api.get('/super-admin/zatca/compliance-calendar', { params: { months: 6 } }).then(res => res.data),
  })

  const events = data?.events || []

  const groupedByMonth = events.reduce((acc, event) => {
    const d = new Date(event.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!acc[key]) acc[key] = []
    acc[key].push(event)
    return acc
  }, {})

  const monthKeys = Object.keys(groupedByMonth).sort()

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {language === 'ar' ? 'تقويم الامتثال' : 'Compliance Calendar'}
        </h3>
        <span className="text-xs text-gray-400">
          {events.length} {language === 'ar' ? 'حدث' : 'events'} · {data?.totalTenants || 0} {language === 'ar' ? 'مستأجر' : 'tenants'}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
          <p className="text-sm text-gray-400">
            {language === 'ar' ? 'لا توجد أحداث قادمة. كل شيء على ما يرام.' : 'No upcoming events. All clear.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthKeys.map((monthKey) => {
            const [year, month] = monthKey.split('-')
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
            const monthEvents = groupedByMonth[monthKey]

            return (
              <div key={monthKey}>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{monthName}</h4>
                <div className="space-y-2">
                  {monthEvents.map((event, i) => {
                    const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.key_rotation
                    const Icon = config.icon
                    return (
                      <motion.div
                        key={`${monthKey}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex items-start gap-3 p-3 rounded-xl border ${config.border} ${config.bg}`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{event.title}</p>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${SEVERITY_BADGE[event.severity] || SEVERITY_BADGE.info}`}>
                              {event.severity}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                          {formatDate(event.date, language)}
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

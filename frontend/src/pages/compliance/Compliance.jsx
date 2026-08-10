import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  Shield, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Users, Globe, Zap, Clock, ChevronRight, ExternalLink
} from 'lucide-react'
import api from '../../lib/api'

const NATIONALITY_FLAGS = {
  SA: '🇸🇦', IN: '🇮🇳', PK: '🇵🇰', EG: '🇪🇬', BD: '🇧🇩',
  PH: '🇵🇭', NP: '🇳🇵', SY: '🇸🇾', SD: '🇸🇩', YE: '🇾🇪',
  JO: '🇯🇴', LB: '🇱🇧', MA: '🇲🇦', TN: '🇹🇳', ET: '🇪🇹',
  US: '🇺🇸', GB: '🇬🇧', DEFAULT: '🌍'
}

function getFlag(nat) {
  return NATIONALITY_FLAGS[nat] || NATIONALITY_FLAGS.DEFAULT
}

function getDaysLabel(days, isAr) {
  if (days <= 0) return isAr ? `منتهية منذ ${Math.abs(days)} يوم` : `${Math.abs(days)} days overdue`
  if (days === 1) return isAr ? 'غداً' : 'Tomorrow'
  return isAr ? `خلال ${days} يوم` : `${days} days`
}

function UrgencyBadge({ days }) {
  const cls = days <= 14 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
    days <= 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{days <= 14 ? 'CRITICAL' : days <= 30 ? 'WARNING' : 'UPCOMING'}</span>
}

function SaudizationGauge({ percent, target = 30 }) {
  const capped = Math.min(100, percent)
  const isMeeting = percent >= target
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-4xl font-black text-gray-900 dark:text-white">{percent.toFixed(1)}<span className="text-xl font-semibold text-gray-500">%</span></p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Saudization Rate</p>
        </div>
        <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${isMeeting ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {isMeeting ? '✓ On Target' : '↑ Below Target'}
        </div>
      </div>
      <div className="relative h-4 bg-gray-100 dark:bg-dark-600 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${capped}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full rounded-full ${isMeeting ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`}
        />
        {/* Target marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-gray-800 dark:bg-white opacity-40" style={{ left: `${target}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>0%</span>
        <span className="font-semibold text-gray-600 dark:text-gray-300">Target: {target}% (Vision 2030)</span>
        <span>100%</span>
      </div>
    </div>
  )
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' } })
}

export default function Compliance() {
  const navigate = useNavigate()
  const { language } = useSelector(s => s.ui)
  const { tenant } = useSelector(s => s.auth)
  const isAr = language === 'ar'
  const t = (en, ar) => isAr ? ar : en
  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true)
      const { data: overview } = await api.get('/compliance/overview')
      setData(overview)
      setLastRefreshed(new Date())
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (isSarCurrencyTenant) fetchOverview()
    else setLoading(false)
  }, [fetchOverview, isSarCurrencyTenant])

  if (!isSarCurrencyTenant) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-6">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center mx-auto mb-5">
          <Shield className="w-7 h-7 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {t('Not Applicable For Your Tenant Currency', 'غير متاح لعملة منشأتك الحالية')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {t(
            'Balady/Iqama compliance and Saudization tracking are Saudi Arabian requirements that only apply to SAR-denominated businesses.',
            'الامتثال البلدي والإقامة وتتبع نسب السعودة متطلبات سعودية تنطبق فقط على المنشآت التي تتعامل بالريال السعودي.'
          )}
        </p>
      </div>
    )
  }

  const iqama = data?.iqamaAlerts || { critical: [], warning: [], upcoming: [] }
  const zatca = data?.zatcaStatus || {}
  const workforce = data?.workforceSummary || {}
  const registrations = data?.registrationExpiries || []

  // Consolidated action items
  const allActions = [
    ...(iqama.critical || []).map(e => ({ type: 'iqama', urgency: 'critical', days: e.daysUntilExpiry, name: `${e.firstNameEn} ${e.lastNameEn}`, detail: 'Iqama', id: e._id })),
    ...(iqama.warning || []).map(e => ({ type: 'iqama', urgency: 'warning', days: e.daysUntilExpiry, name: `${e.firstNameEn} ${e.lastNameEn}`, detail: 'Iqama', id: e._id })),
    ...(iqama.upcoming || []).map(e => ({ type: 'iqama', urgency: 'upcoming', days: e.daysUntilExpiry, name: `${e.firstNameEn} ${e.lastNameEn}`, detail: 'Iqama', id: e._id })),
    ...(registrations || []).map(r => ({ type: 'fleet', urgency: r.daysUntilExpiry <= 14 ? 'critical' : 'upcoming', days: r.daysUntilExpiry, name: r.name, detail: 'Registration', id: r._id })),
  ].sort((a, b) => a.days - b.days)

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-dark-600 rounded w-72" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-200 dark:bg-dark-600 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-gray-200 dark:bg-dark-600 rounded-2xl" />
    </div>
  )

  const iqamaColumns = [
    { key: 'critical', label: t('CRITICAL', 'حرج'), items: iqama.critical, borderColor: 'border-red-400 dark:border-red-600', headerBg: 'bg-red-50 dark:bg-red-900/20', headerText: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', glow: 'shadow-red-100 dark:shadow-red-900/20' },
    { key: 'warning', label: t('WARNING', 'تحذير'), items: iqama.warning, borderColor: 'border-amber-400 dark:border-amber-600', headerBg: 'bg-amber-50 dark:bg-amber-900/20', headerText: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', glow: 'shadow-amber-100 dark:shadow-amber-900/20' },
    { key: 'upcoming', label: t('UPCOMING', 'قادم'), items: iqama.upcoming, borderColor: 'border-blue-400 dark:border-blue-600', headerBg: 'bg-blue-50 dark:bg-blue-900/20', headerText: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-400', glow: 'shadow-blue-100 dark:shadow-blue-900/20' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            🇸🇦 {t('Saudi Compliance Dashboard', 'لوحة الامتثال السعودية')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('Iqama, ZATCA, Qiwa & Saudization monitoring', 'متابعة الإقامة وزاتكا وقوى والسعودة')}
            {lastRefreshed && <span className="ml-2">· {t('Refreshed', 'آخر تحديث')} {lastRefreshed.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={fetchOverview} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
          <RefreshCw className="w-4 h-4" /> {t('Refresh', 'تحديث')}
        </button>
      </motion.div>

      {/* Iqama Alerts Panel */}
      <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants} className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-700">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> {t('Iqama & Document Alerts', 'تنبيهات الإقامة والوثائق')}
            <span className="ml-2 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
              {(iqama.critical?.length || 0) + (iqama.warning?.length || 0) + (iqama.upcoming?.length || 0)} {t('expiring', 'تنتهي')}
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-dark-700">
          {iqamaColumns.map(col => (
            <div key={col.key} className="p-4">
              <div className={`flex items-center gap-2 mb-3 p-2 rounded-xl ${col.headerBg}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${col.dot} ring-2 ring-white dark:ring-dark-800`} />
                <span className={`text-xs font-black tracking-widest uppercase ${col.headerText}`}>{col.label}</span>
                <span className={`ml-auto text-xs font-bold ${col.headerText}`}>{col.items?.length || 0}</span>
              </div>
              {!col.items?.length ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 dark:text-gray-500">{t('All clear', 'كل شيء على ما يرام')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {col.items.map(emp => (
                    <motion.button
                      key={emp._id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => navigate(`/app/dashboard/employees/${emp._id}`)}
                      className="w-full text-start p-3 rounded-xl border border-gray-100 dark:border-dark-700 hover:border-primary-200 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            {emp.firstNameEn} {emp.lastNameEn}
                          </p>
                          <p className="text-xs text-gray-400">{emp.employeeId} · {emp.nationality}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{emp.nationalIdExpiry ? new Date(emp.nationalIdExpiry).toLocaleDateString() : '—'}</p>
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap ${col.headerText}`}>{getDaysLabel(emp.daysUntilExpiry, isAr)}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ZATCA + Workforce Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ZATCA Status */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="font-bold text-gray-900 dark:text-white">{t('ZATCA Phase 2', 'زاتكا المرحلة 2')}</h2>
          </div>
          <div className="flex items-center gap-6 mb-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 ${zatca.isOnboarded ? 'bg-emerald-100 dark:bg-emerald-900/20' : 'bg-amber-100 dark:bg-amber-900/20'}`}>
              {zatca.isOnboarded
                ? <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                : <XCircle className="w-10 h-10 text-amber-600 dark:text-amber-400" />}
            </div>
            <div>
              <p className={`text-2xl font-black ${zatca.isOnboarded ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {zatca.isOnboarded ? t('ONBOARDED', 'مُدمج') : t('PENDING', 'معلق')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {zatca.isOnboarded ? t('Certificate active', 'الشهادة نشطة') : t('Setup required', 'مطلوب الإعداد')}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-dark-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('Invoice Counter', 'عداد الفواتير')}</span>
              <span className="font-bold text-gray-900 dark:text-white">{zatca.invoiceCounter?.toLocaleString() || 0}</span>
            </div>
            {zatca.onboardedAt && (
              <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-dark-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('Onboarded', 'تاريخ الدمج')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{new Date(zatca.onboardedAt).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('Production Certificate', 'شهادة الإنتاج')}</span>
              <span className={`font-semibold text-sm ${zatca.hasProductionCsid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {zatca.hasProductionCsid ? t('Issued', 'صادرة') : t('Not Issued', 'غير صادرة')}
              </span>
            </div>
          </div>
          <button onClick={() => navigate('/app/dashboard/settings')}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
            <ExternalLink className="w-4 h-4" /> {t('Configure ZATCA', 'إعداد زاتكا')}
          </button>
        </motion.div>

        {/* Saudization / Workforce */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-gray-900 dark:text-white">{t('Workforce / Saudization', 'القوى العاملة / السعودة')}</h2>
            <span className="ml-auto text-sm font-semibold text-gray-500 dark:text-gray-400">{workforce.total || 0} {t('employees', 'موظف')}</span>
          </div>

          <SaudizationGauge percent={workforce.saudizationPercent || 0} target={30} />

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold">🇸🇦 {t('Saudi', 'سعودي')}</p>
              <p className="text-2xl font-black text-green-700 dark:text-green-300 mt-1">{workforce.saudi || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-dark-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">🌍 {t('Non-Saudi', 'غير سعودي')}</p>
              <p className="text-2xl font-black text-gray-700 dark:text-gray-300 mt-1">{workforce.nonSaudi || 0}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action Items */}
      {allActions.length > 0 && (
        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-500" /> {t('Action Items', 'إجراءات مطلوبة')}
            </h2>
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{allActions.length} {t('items', 'بند')}</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-dark-700">
            {allActions.slice(0, 10).map((item, idx) => (
              <div key={idx} className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-dark-700/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.urgency === 'critical' ? 'bg-red-500' : item.urgency === 'warning' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.detail} {t('expiring', 'تنتهي')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <UrgencyBadge days={item.days} />
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{getDaysLabel(item.days, isAr)}</span>
                  {item.type === 'iqama' && (
                    <button onClick={() => navigate(`/app/dashboard/employees/${item.id}`)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 hover:text-primary-600 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {allActions.length > 10 && (
            <div className="px-6 py-3 border-t border-gray-100 dark:border-dark-700">
              <button onClick={() => navigate('/app/dashboard/compliance/iqama')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
                {t(`View all ${allActions.length} items →`, `عرض جميع ${allActions.length} بند ←`)}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {allActions.length === 0 && !loading && (
        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{t('All Clear!', 'كل شيء على ما يرام!')}</h3>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">{t('No compliance issues in the next 60 days.', 'لا توجد مشكلات امتثال في الـ 60 يوماً القادمة.')}</p>
        </motion.div>
      )}
    </div>
  )
}

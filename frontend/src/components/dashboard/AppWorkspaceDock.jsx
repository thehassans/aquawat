import React from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { 
  ArrowUpRight, 
  Sparkles, 
  Activity, 
  ExternalLink,
  Layers,
  CheckCircle2,
  ChevronRight,
  Plus
} from 'lucide-react'
import { App3DIcon } from '../ui/App3DIcon'
import Money from '../ui/Money'

export function AppWorkspaceDock({ 
  installedApps = [], 
  appsOverview = {}, 
  language = 'en',
  onSelectAppTab 
}) {
  const navigate = useNavigate()
  const isAr = language === 'ar'

  if (!installedApps || installedApps.length === 0) return null

  // Function to extract specific live metrics for each app
  const getAppMetrics = (app) => {
    const grant = app.businessTypeGrant || app.appId
    const data = appsOverview[grant] || appsOverview[app.appId] || {}
    
    switch (grant) {
      case 'bakala': {
        const total = data.totals?.[0]?.total || data.totalProducts || 0
        const low = data.totals?.[0]?.lowStock || 0
        return [
          { label: isAr ? 'المنتجات' : 'Products', value: total },
          { label: isAr ? 'مخزون منخفض' : 'Low Stock', value: low, alert: low > 0 },
        ]
      }
      case 'pharmacy': {
        const total = data.totals?.[0]?.total || data.totalProducts || 0
        const low = data.totals?.[0]?.lowStock || 0
        return [
          { label: isAr ? 'الأدوية' : 'Medicines', value: total },
          { label: isAr ? 'مخزون منخفض' : 'Low Stock', value: low, alert: low > 0 },
        ]
      }
      case 'restaurant': {
        const open = data.totals?.[0]?.open || 0
        const rev = data.totals?.[0]?.todayRevenue || data.totals?.[0]?.revenue || 0
        return [
          { label: isAr ? 'طلبات مفتوحة' : 'Open Orders', value: open },
          { label: isAr ? 'إيرادات اليوم' : 'Today Rev', value: rev, isCurrency: true },
        ]
      }
      case 'car_rental': {
        const active = data.totals?.[0]?.activeCount || 0
        const total = data.totals?.[0]?.total || 0
        return [
          { label: isAr ? 'عقود نشطة' : 'Active Leases', value: active },
          { label: isAr ? 'إجمالي العقود' : 'Total Leases', value: total },
        ]
      }
      case 'laundry': {
        const inWash = data.totals?.[0]?.inWash || 0
        const ready = data.totals?.[0]?.ready || 0
        return [
          { label: isAr ? 'قيد الغسيل' : 'In Wash', value: inWash },
          { label: isAr ? 'جاهز للاستلام' : 'Ready', value: ready, success: ready > 0 },
        ]
      }
      case 'saloon': {
        const today = data.totals?.[0]?.todayOrders || 0
        const rev = data.totals?.[0]?.revenue || 0
        return [
          { label: isAr ? 'طلبات اليوم' : 'Today Services', value: today },
          { label: isAr ? 'الإيرادات' : 'Revenue', value: rev, isCurrency: true },
        ]
      }
      case 'khayyat': {
        const prog = data.totals?.[0]?.inProgress || 0
        const ready = data.totals?.[0]?.readyForFitting || 0
        return [
          { label: isAr ? 'قيد الخياطة' : 'In Stitching', value: prog },
          { label: isAr ? 'جاهز للبروفة' : 'Fitting Ready', value: ready, success: ready > 0 },
        ]
      }
      case 'manpower': {
        const dep = data.totals?.[0]?.deployed || 0
        const avail = data.totals?.[0]?.available || 0
        return [
          { label: isAr ? 'عمالة مسندة' : 'Deployed', value: dep },
          { label: isAr ? 'متاح للعمل' : 'Available', value: avail },
        ]
      }
      case 'manufacturing': {
        const active = data.totals?.[0]?.active || 0
        const comp = data.totals?.[0]?.completed || 0
        return [
          { label: isAr ? 'أوامر إنتاج نشطة' : 'Active Orders', value: active },
          { label: isAr ? 'مكتملة' : 'Completed', value: comp },
        ]
      }
      case 'car_workshop': {
        const open = data.totals?.[0]?.openCards || 0
        const rev = data.totals?.[0]?.revenue || 0
        return [
          { label: isAr ? 'بطاقات مفتوحة' : 'Open Cards', value: open },
          { label: isAr ? 'الإيرادات' : 'Revenue', value: rev, isCurrency: true },
        ]
      }
      case 'boutique': {
        const active = data.totals?.[0]?.activeRentals || 0
        return [
          { label: isAr ? 'فساتين مستأجرة' : 'Active Rentals', value: active },
        ]
      }
      case 'bookstore': {
        const total = data.totals?.[0]?.total || 0
        return [
          { label: isAr ? 'الكتب والقرطاسية' : 'Catalog Titles', value: total },
        ]
      }
      case 'furniture_shop': {
        const prod = data.totals?.[0]?.inProduction || 0
        return [
          { label: isAr ? 'قيد التصنيع' : 'In Production', value: prod },
        ]
      }
      case 'construction': {
        const active = data.totals?.[0]?.active || 0
        const avg = Math.round(data.totals?.[0]?.avgProgress || 0)
        return [
          { label: isAr ? 'مشاريع نشطة' : 'Active Projects', value: active },
          { label: isAr ? 'متوسط الإنجاز' : 'Avg Progress', value: `${avg}%` },
        ]
      }
      case 'travel_agency': {
        const open = data.totals?.[0]?.open || 0
        const ticketed = data.totals?.[0]?.ticketed || 0
        return [
          { label: isAr ? 'حجوزات مفتوحة' : 'Open Bookings', value: open },
          { label: isAr ? 'تم الإصدار' : 'Ticketed', value: ticketed },
        ]
      }
      default:
        return [
          { label: isAr ? 'الحالة' : 'Status', value: isAr ? 'نشط' : 'Active', success: true }
        ]
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/30 dark:from-primary-400/20 dark:to-primary-500/30 flex items-center justify-center border border-primary-500/30">
            <Layers className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {isAr ? 'مركز التطبيقات ومساحات العمل النشطة' : 'Active App Workspaces & Modules'}
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                {installedApps.length} {isAr ? 'تطبيق نشط' : 'Installed'}
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAr ? 'إدارة ومتابعة مؤشرات الأداء الحية لكل قطاع وتطبيق مفعّل' : 'Real-time operational KPIs and instant 1-click launch for all installed modules'}
            </p>
          </div>
        </div>

        <Link
          to="/app/dashboard/app-store"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-xl transition-all border border-primary-200/60 dark:border-primary-800/60"
        >
          <Plus className="w-3.5 h-3.5" />
          {isAr ? 'متجر التطبيقات' : 'App Store'}
        </Link>
      </div>

      {/* Grid of Installed Apps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {installedApps.map((app, index) => {
          const metrics = getAppMetrics(app)
          const appName = isAr ? app.nameAr || app.nameEn : app.nameEn || app.nameAr
          const targetRoute = app.defaultRoute || '/app/dashboard'
          const grant = app.businessTypeGrant || app.appId

          return (
            <motion.div
              key={app.appId || index}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative bg-white dark:bg-dark-800/90 rounded-2xl p-4.5 border border-gray-200/80 dark:border-dark-700/80 shadow-sm hover:shadow-md hover:border-primary-500/40 dark:hover:border-primary-500/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Top Bar: Icon + Title + Status Pill */}
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center p-1 bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600 group-hover:scale-105 transition-transform">
                      <App3DIcon 
                        appId={app.appId} 
                        icon={app.icon} 
                        path={targetRoute}
                        label={appName}
                        className="w-10 h-10" 
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {appName}
                      </h3>
                      <span className="inline-block mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize">
                        {app.badge || app.category || (isAr ? 'قطاع متخصص' : 'Vertical App')}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {isAr ? 'نشط' : 'Active'}
                  </span>
                </div>

                {/* Live Metrics Chips */}
                <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-gray-50/80 dark:bg-dark-750/50 border border-gray-100 dark:border-dark-700/60">
                  {metrics.map((m, mIdx) => (
                    <div key={mIdx} className="text-start">
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">
                        {m.label}
                      </p>
                      <p className={`text-xs font-bold ${
                        m.alert ? 'text-amber-600 dark:text-amber-400' :
                        m.success ? 'text-emerald-600 dark:text-emerald-400' :
                        'text-gray-900 dark:text-white'
                      }`}>
                        {m.isCurrency ? (
                          <Money value={m.value} minimumFractionDigits={0} maximumFractionDigits={0} />
                        ) : (
                          m.value
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: View App Dashboard or Open Module */}
              <div className="pt-2 border-t border-gray-100 dark:border-dark-700/60 flex items-center justify-between gap-2 mt-1">
                {onSelectAppTab && (
                  <button
                    onClick={() => onSelectAppTab(grant)}
                    className="flex-1 py-1.5 px-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-xl transition-colors text-center truncate"
                  >
                    {isAr ? 'مؤشرات الأداء' : 'Insights'}
                  </button>
                )}

                <button
                  onClick={() => navigate(targetRoute)}
                  className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-sm shadow-primary-500/20 rounded-xl transition-all"
                >
                  <span>{isAr ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default AppWorkspaceDock

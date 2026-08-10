import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from '../lib/translations'
import { setHiddenMenuItemsForTenant } from '../store/slices/uiSlice'
import { getNavSections } from '../lib/sidebarConfig'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import { Eye, ArrowLeft, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function HiddenNavbars() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { language, hiddenMenuItems } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [searchQuery, setSearchQuery] = useState('')

  if (!tenant) return null

  const si = tenant?.settings?.saudiIntegrations || {}
  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'
  const isZatcaPhase1 = (tenant?.zatca?.phase || 1) === 1
  const business = tenant?.business || {}
  const isZatcaPhase1Ready = isZatcaPhase1 && !!business.vatNumber && !!(business.legalNameEn || business.legalNameAr) && !!(business.address?.city && business.address?.country)
  const hasZatca = isSarCurrencyTenant && (si.zatcaConnectionStatus === 'connected' || tenant?.zatca?.isOnboarded || isZatcaPhase1Ready)
  const hasElm = isSarCurrencyTenant && si.elmConnectionStatus === 'connected'
  const hasQiwa = isSarCurrencyTenant && si.qiwaConnectionStatus === 'connected'
  const hasGosi = isSarCurrencyTenant && si.gosiConnectionStatus === 'connected'

  const govChildren = []
  if (hasZatca) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/zatca', label: language === 'ar' ? `بوابة زاتكا ${isZatcaPhase1 ? '(المرحلة 1)' : ''}` : `ZATCA${isZatcaPhase1 ? ' Phase 1' : ''} Portal` })
  if (hasElm) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/elm', label: language === 'ar' ? 'بوابة علم / يقين' : 'Elm Portal' })
  if (hasQiwa) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/qiwa', label: language === 'ar' ? 'بوابة قوى' : 'Qiwa Portal' })
  if (hasGosi) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/gosi', label: language === 'ar' ? 'بوابة التأمينات / مدد' : 'GOSI/Mudad Portal' })

  const businessTypes = getTenantBusinessTypes(tenant)
  const navSections = getNavSections({ language, t, tenant, businessTypes, govChildren })

  const hiddenSet = new Set(hiddenMenuItems || [])

  const allItems = []
  navSections.forEach((section) => {
    const items = Array.isArray(section.items) ? section.items : []
    items.forEach((item) => {
      if (item.path && hiddenSet.has(item.path)) {
        allItems.push({ ...item, sectionTitle: section.title })
      }
      if (Array.isArray(item.children)) {
        item.children.forEach((child) => {
          if (child.path && hiddenSet.has(child.path)) {
            allItems.push({ ...child, sectionTitle: section.title, parentLabel: item.label })
          }
        })
      }
    })
  })

  const filteredItems = searchQuery
    ? allItems.filter((item) => {
        const label = typeof item.label === 'string' ? item.label.toLowerCase() : ''
        return label.includes(searchQuery.toLowerCase())
      })
    : allItems

  const restoreItem = (path) => {
    const items = (hiddenMenuItems || []).filter((p) => p !== path)
    dispatch(setHiddenMenuItemsForTenant({ tenantId: tenant._id, items }))
  }

  const restoreAll = () => {
    dispatch(setHiddenMenuItemsForTenant({ tenantId: tenant._id, items: [] }))
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/app/dashboard/settings')}
          className="p-2 rounded-xl border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Menu className="w-6 h-6 text-primary-500" />
            {language === 'ar' ? 'القوائم المخفية' : 'Hidden Navbars'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'ar' ? 'استعد عناصر القائمة التي أخفيتها سابقًا.' : 'Restore menu items you previously hid.'}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث في العناصر المخفية...' : 'Search hidden items...'}
            className="input w-full md:w-1/2"
          />
          {allItems.length > 0 && (
            <button
              onClick={restoreAll}
              className="btn btn-primary text-sm"
            >
              {language === 'ar' ? 'إظهار الكل' : 'Show All'}
            </button>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>{language === 'ar' ? 'لا توجد عناصر مخفية.' : 'No hidden items.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.path}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-primary-500" />}
                    <div>
                      <span className="font-medium text-sm">{item.label}</span>
                      <p className="text-xs text-gray-500">
                        {item.sectionTitle}
                        {item.parentLabel ? ` › ${item.parentLabel}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => restoreItem(item.path)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-dark-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    {language === 'ar' ? 'إظهار' : 'Show'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

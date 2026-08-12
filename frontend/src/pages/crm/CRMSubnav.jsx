import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'

const LINKS = [
  { to: '/app/dashboard/crm', end: true, en: 'Overview', ar: 'نظرة عامة' },
  { to: '/app/dashboard/crm/leads', en: 'Leads', ar: 'العملاء المحتملون' },
  { to: '/app/dashboard/crm/contacts', en: 'Contacts', ar: 'جهات الاتصال' },
  { to: '/app/dashboard/crm/deals', en: 'Deals', ar: 'الصفقات' },
  { to: '/app/dashboard/crm/activities', en: 'Activities', ar: 'الأنشطة' },
  { to: '/app/dashboard/crm/campaigns', en: 'Campaigns', ar: 'الحملات' },
]

export default function CRMSubnav() {
  const { language } = useSelector((state) => state.ui)

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200/80 pb-px dark:border-white/10">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition ${
              isActive
                ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`
          }
        >
          {language === 'ar' ? link.ar : link.en}
        </NavLink>
      ))}
    </nav>
  )
}

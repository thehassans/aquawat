import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDown, FileText, Menu, X } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'

function labelOf(item, language) {
  return language === 'ar' ? item.labelAr || item.label : item.label
}

/** Solid panel — never use translucent bg on dropdowns (page content must not show through). */
export function AppMenuDropdownPanel({ items, language, onNavigate }) {
  return (
    <div className="absolute start-0 z-[60] mt-1 min-w-[14rem] max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-dark-600 dark:bg-dark-900">
      {items.map((item) => {
        if (item.type === 'section') {
          return (
            <div
              key={item.id}
              className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
            >
              {labelOf(item, language)}
            </div>
          )
        }
        return (
          <Link
            key={item.id}
            to={item.href}
            onClick={onNavigate}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-800"
          >
            {labelOf(item, language)}
          </Link>
        )
      })}
    </div>
  )
}

function buildSalesMenu(businessTypes) {
  const trading = businessTypes.includes('trading') || businessTypes.includes('furniture_shop')
  return [
    {
      id: 'invoices',
      label: 'Invoices',
      labelAr: 'الفواتير',
      children: [
        { type: 'section', id: 'sec-inv', label: 'Documents', labelAr: 'المستندات' },
        { id: 'inv-all', label: 'All Invoices', labelAr: 'كل الفواتير', href: '/app/dashboard/invoices' },
        { id: 'inv-sell', label: 'New Sale Invoice', labelAr: 'فاتورة بيع جديدة', href: '/app/dashboard/invoices/new/sell' },
        ...(trading
          ? [{ id: 'inv-purchase', label: 'New Purchase Invoice', labelAr: 'فاتورة شراء جديدة', href: '/app/dashboard/invoices/new/purchase' }]
          : []),
      ],
    },
    {
      id: 'quotations',
      label: 'Quotations',
      labelAr: 'عروض الأسعار',
      children: [
        { type: 'section', id: 'sec-quo', label: 'Documents', labelAr: 'المستندات' },
        { id: 'quo-all', label: 'All Quotations', labelAr: 'كل العروض', href: '/app/dashboard/quotations' },
        { id: 'quo-new', label: 'New Quotation', labelAr: 'عرض سعر جديد', href: '/app/dashboard/quotations/new' },
      ],
    },
  ]
}

export default function SalesLayout() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const location = useLocation()
  const [openId, setOpenId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef(null)
  const businessTypes = getTenantBusinessTypes(tenant)
  const hideQuotations = businessTypes.includes('bakala')
  const dropdowns = buildSalesMenu(businessTypes).filter((n) => !(hideQuotations && n.id === 'quotations'))

  useEffect(() => {
    setOpenId(null)
    setMobileOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    const onDoc = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenId(null)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpenId(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const sectionActiveLoose = (node) => {
    if (node.id === 'invoices') return location.pathname.includes('/invoices')
    if (node.id === 'quotations') return location.pathname.includes('/quotations')
    return false
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="border-b border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-900">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-0 pt-2">
          <div className="flex items-center gap-3 px-3 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {language === 'ar' ? 'المبيعات' : 'Sales'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'فواتير وعروض أسعار' : 'Invoices and quotations'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm me-3 mb-2 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            {language === 'ar' ? 'القائمة' : 'Menu'}
          </button>

          <nav ref={navRef} className="hidden flex-wrap items-center gap-1 px-2 lg:flex">
            {dropdowns.map((node) => {
              const active = sectionActiveLoose(node) || openId === node.id
              return (
                <div key={node.id} className="relative">
                  <button
                    type="button"
                    className={`relative inline-flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'text-primary-700 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary-500 dark:text-primary-300'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                    aria-expanded={openId === node.id}
                    onClick={() => setOpenId((id) => (id === node.id ? null : node.id))}
                  >
                    {labelOf(node, language)}
                    <ChevronDown className={`h-3.5 w-3.5 transition ${openId === node.id ? 'rotate-180' : ''}`} />
                  </button>
                  {openId === node.id && (
                    <AppMenuDropdownPanel
                      items={node.children || []}
                      language={language}
                      onNavigate={() => setOpenId(null)}
                    />
                  )}
                </div>
              )
            })}
          </nav>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-100 bg-white px-3 py-3 lg:hidden dark:border-dark-600 dark:bg-dark-900">
            {dropdowns.map((node) => (
              <div key={node.id} className="mt-2">
                <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {labelOf(node, language)}
                </div>
                {(node.children || []).map((item) => {
                  if (item.type === 'section') {
                    return (
                      <div key={item.id} className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {labelOf(item, language)}
                      </div>
                    )
                  }
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      className="block rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                      onClick={() => setMobileOpen(false)}
                    >
                      {labelOf(item, language)}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-1 py-6">
        <Outlet />
      </div>
    </div>
  )
}

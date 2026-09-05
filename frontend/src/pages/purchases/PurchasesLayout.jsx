import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDown, Menu, Truck, X } from 'lucide-react'
import { PortalDropdown } from '../inventory/PortalDropdown'
import { PURCHASES_MENU } from './purchases.menu'
import { PURCHASES_PATH } from './purchasesUi'

function labelOf(item, language) {
  return language === 'ar' ? item.labelAr || item.label : item.label
}

function pathActive(pathname, href, end = false) {
  if (!href) return false
  const path = href.split('?')[0]
  if (end) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

const HUB_ROOTS = {
  orders: [PURCHASES_PATH.orders],
  receipts: [PURCHASES_PATH.grn],
  returns: [PURCHASES_PATH.returns],
  partners: [PURCHASES_PATH.suppliers, PURCHASES_PATH.bills],
  reporting: [PURCHASES_PATH.reports, PURCHASES_PATH.landed],
}

function hubActive(node, pathname) {
  const roots = HUB_ROOTS[node.id]
  if (roots?.length) return roots.some((root) => pathActive(pathname, root, false))
  return (node.children || []).some((c) => c.href && pathActive(pathname, c.href, Boolean(c.end)))
}

function DropdownItems({ items, language, pathname, onNavigate }) {
  return items.map((item) => {
    const active = item.href && pathActive(pathname, item.href, Boolean(item.end))
    return (
      <Link
        key={item.id}
        to={item.href}
        onClick={onNavigate}
        className={`block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-dark-800 ${
          active
            ? 'font-semibold text-primary-700 dark:text-primary-300'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {labelOf(item, language)}
      </Link>
    )
  })
}

function TopLink({ to, end, children, active }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={() =>
        `relative px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? 'text-primary-700 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary-500 dark:text-primary-300'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function NavDropdown({ node, language, pathname, open, onToggle, onClose }) {
  const btnRef = useRef(null)
  const active = hubActive(node, pathname) || open

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`relative inline-flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? 'text-primary-700 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary-500 dark:text-primary-300'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
        }`}
        aria-expanded={open}
        onClick={onToggle}
      >
        {labelOf(node, language)}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={onClose} anchorRef={btnRef} align="start">
        <DropdownItems
          items={node.children || []}
          language={language}
          pathname={pathname}
          onNavigate={onClose}
        />
      </PortalDropdown>
    </div>
  )
}

export default function PurchasesLayout() {
  const { language } = useSelector((s) => s.ui)
  const location = useLocation()
  const path = location.pathname
  const [openId, setOpenId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setOpenId(null)
    setMobileOpen(false)
  }, [path])

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="relative z-10 border-b border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-900">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-0 pt-2">
          <div className="flex items-center gap-3 px-3 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <Truck className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {language === 'ar' ? 'المشتريات' : 'Purchases'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'طلبات واستلام وموردون' : 'Orders, receipts, and suppliers'}
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

          <nav className="hidden flex-wrap items-center gap-1 px-2 lg:flex">
            {PURCHASES_MENU.map((node) => {
              if (node.id === 'overview' || (node.href && !node.children?.length)) {
                return (
                  <TopLink
                    key={node.id}
                    to={node.href}
                    end={Boolean(node.end)}
                    active={
                      node.id === 'overview'
                        ? pathActive(path, node.href, true)
                        : hubActive(node, path) || pathActive(path, node.href, Boolean(node.end))
                    }
                  >
                    {labelOf(node, language)}
                  </TopLink>
                )
              }
              return (
                <NavDropdown
                  key={node.id}
                  node={node}
                  language={language}
                  pathname={path}
                  open={openId === node.id}
                  onToggle={() => setOpenId((id) => (id === node.id ? null : node.id))}
                  onClose={() => setOpenId(null)}
                />
              )
            })}
          </nav>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-100 bg-white px-3 py-3 lg:hidden dark:border-dark-600 dark:bg-dark-900">
            {PURCHASES_MENU.map((node) => {
              if (node.href && !node.children?.length) {
                return (
                  <Link
                    key={node.id}
                    to={node.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-100"
                    onClick={() => setMobileOpen(false)}
                  >
                    {labelOf(node, language)}
                  </Link>
                )
              }
              return (
                <div key={node.id} className="mt-2">
                  <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {labelOf(node, language)}
                  </div>
                  <DropdownItems
                    items={node.children || []}
                    language={language}
                    pathname={path}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="px-1 py-6">
        <Outlet />
      </div>
    </div>
  )
}

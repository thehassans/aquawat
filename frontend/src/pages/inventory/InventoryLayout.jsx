import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ChevronDown, Menu, Package, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { filterInventoryMenu } from './inventory.menu'
import { PortalDropdown } from './PortalDropdown'
import { formatInvError } from '../../lib/invError'

function labelOf(item, language) {
  return language === 'ar' ? item.labelAr || item.label : item.label
}

function pathActive(pathname, href, end) {
  if (!href) return false
  const path = href.split('?')[0]
  if (end) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

function DropdownItems({ items, language, onNavigate, onAction }) {
  return items.map((item) => {
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
    if (item.action) {
      return (
        <button
          key={item.id}
          type="button"
          className="block w-full px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-800"
          onClick={() => onAction(item)}
        >
          {labelOf(item, language)}
        </button>
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

function NavDropdown({ node, language, open, onToggle, onClose, onAction }) {
  const btnRef = useRef(null)
  const location = useLocation()
  const active = (node.children || []).some(
    (c) => c.href && pathActive(location.pathname, c.href.split('?')[0], false),
  ) || open

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
          onNavigate={onClose}
          onAction={onAction}
        />
      </PortalDropdown>
    </div>
  )
}

export default function InventoryLayout() {
  const { language } = useSelector((s) => s.ui)
  const { user } = useSelector((s) => s.auth)
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [openId, setOpenId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: menuPayload } = useQuery({
    queryKey: ['inventory-menu'],
    queryFn: () => api.get('/inventory/menu').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const items = useMemo(() => {
    if (Array.isArray(menuPayload?.items) && menuPayload.items.length) return menuPayload.items
    return filterInventoryMenu(settings || {}, user)
  }, [menuPayload, settings, user])

  const overview = items.find((i) => i.id === 'overview')
  const dropdowns = items.filter((i) => i.id !== 'overview')

  useEffect(() => {
    setOpenId(null)
    setMobileOpen(false)
  }, [location.pathname, location.search])

  const runScheduler = async () => {
    try {
      // Fire-and-forget style: async queue preferred; still OK if sync
      api.post('/stock/scheduler/run', { async: true }).catch(() => {})
      toast.success(
        language === 'ar'
          ? 'المجدول يعمل في الخلفية'
          : 'Scheduler is running in the background.',
      )
      qc.invalidateQueries({ queryKey: ['inv-jobs'] })
      qc.invalidateQueries({ queryKey: ['inv-scheduler'] })
    } catch (e) {
      toast.error(formatInvError(e, language))
    }
  }

  const onAction = async (item) => {
    setOpenId(null)
    setMobileOpen(false)
    if (item.action === 'runScheduler') await runScheduler()
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="relative z-10 border-b border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-900">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-0 pt-2">
          <div className="flex items-center gap-3 px-3 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {language === 'ar' ? 'المخزون' : 'Inventory'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'حركات ومواقع وكميات' : 'Moves, locations, and on-hand'}
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
            {overview && (
              <TopLink
                to={overview.href}
                end={overview.end}
                active={pathActive(location.pathname, overview.href, true)}
              >
                {labelOf(overview, language)}
              </TopLink>
            )}
            {dropdowns.map((node) => (
              <NavDropdown
                key={node.id}
                node={node}
                language={language}
                open={openId === node.id}
                onToggle={() => setOpenId((id) => (id === node.id ? null : node.id))}
                onClose={() => setOpenId(null)}
                onAction={onAction}
              />
            ))}
          </nav>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-100 bg-white px-3 py-3 lg:hidden dark:border-dark-600 dark:bg-dark-900">
            {overview && (
              <Link
                to={overview.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-100"
                onClick={() => setMobileOpen(false)}
              >
                {labelOf(overview, language)}
              </Link>
            )}
            {dropdowns.map((node) => (
              <div key={node.id} className="mt-2">
                <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {labelOf(node, language)}
                </div>
                <DropdownItems
                  items={node.children || []}
                  language={language}
                  onNavigate={() => setMobileOpen(false)}
                  onAction={onAction}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-1 py-6">
        <Outlet context={{ navigate, language }} />
      </div>
    </div>
  )
}

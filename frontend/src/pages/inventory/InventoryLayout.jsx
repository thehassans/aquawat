import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ChevronDown, Menu, Package, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { filterInventoryMenu, INVENTORY_MENU_TREE } from './inventory.menu'

function labelOf(item, language) {
  return language === 'ar' ? item.labelAr || item.label : item.label
}

function pathActive(pathname, href, end) {
  if (!href) return false
  const path = href.split('?')[0]
  if (end) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

function DropdownPanel({ items, language, onNavigate, onAction }) {
  return (
    <div className="absolute start-0 z-40 mt-1 min-w-[14rem] max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800">
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
        if (item.action) {
          return (
            <button
              key={item.id}
              type="button"
              className="block w-full px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-700"
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
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-700"
          >
            {labelOf(item, language)}
          </Link>
        )
      })}
    </div>
  )
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

export default function InventoryLayout() {
  const { language } = useSelector((s) => s.ui)
  const { user } = useSelector((s) => s.auth)
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [openId, setOpenId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef(null)

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

  const sectionActive = (node) => {
    if (!node?.children) return false
    return node.children.some(
      (c) => c.href && pathActive(location.pathname, c.href.split('?')[0], false),
    )
  }

  const runScheduler = async () => {
    const ok = window.confirm(
      language === 'ar'
        ? 'تشغيل مجدول التوريد الآن؟'
        : 'Run the procurement scheduler now?',
    )
    if (!ok) return
    try {
      const res = await api.post('/stock/scheduler/run')
      const run = res.data || {}
      toast.success(
        language === 'ar'
          ? `تم — توريدات: ${run.procurementsCreated ?? 0}`
          : `Done — procurements: ${run.procurementsCreated ?? 0}`,
      )
      qc.invalidateQueries({ queryKey: ['replenishment'] })
    } catch (e) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const onAction = async (item) => {
    setOpenId(null)
    setMobileOpen(false)
    if (item.action === 'runScheduler') await runScheduler()
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm dark:border-dark-600 dark:bg-dark-900/80">
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

          <nav ref={navRef} className="hidden flex-wrap items-center gap-1 px-2 lg:flex">
            {overview && (
              <TopLink
                to={overview.href}
                end={overview.end}
                active={pathActive(location.pathname, overview.href, true)}
              >
                {labelOf(overview, language)}
              </TopLink>
            )}
            {dropdowns.map((node) => {
              const active = sectionActive(node) || openId === node.id
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
                    <DropdownPanel
                      items={node.children || []}
                      language={language}
                      onNavigate={() => setOpenId(null)}
                      onAction={onAction}
                    />
                  )}
                </div>
              )
            })}
          </nav>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-100 px-3 py-3 lg:hidden dark:border-dark-600">
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
                {(node.children || []).map((item) => {
                  if (item.type === 'section') {
                    return (
                      <div key={item.id} className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {labelOf(item, language)}
                      </div>
                    )
                  }
                  if (item.action) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-start text-sm text-slate-700 dark:text-slate-200"
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
        <Outlet context={{ navigate, language }} />
      </div>
    </div>
  )
}

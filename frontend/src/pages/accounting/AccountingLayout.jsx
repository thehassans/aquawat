import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Calculator, ChevronDown, Menu, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { PortalDropdown } from '../inventory/PortalDropdown'
import SalesComposerChrome from '../../components/sales/SalesComposerChrome'
import { ACCOUNTING_MENU, hubIsActive } from './accounting.menu'
import { AccountingPageActionsProvider, useAccountingPageActions } from './AccountingPageActionsContext'

function AccountingPageActionsSlot() {
  const { pageActions } = useAccountingPageActions()
  if (!pageActions) return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 bg-white/80 px-4 py-2 dark:border-dark-600 dark:bg-dark-900/80">
      {pageActions}
    </div>
  )
}

function pathActive(pathname, href, end = false) {
  if (!href) return false
  const path = href.split('?')[0]
  if (end) return pathname === path || pathname === `${path}/`
  return pathname === path || pathname.startsWith(`${path}/`)
}

function labelOf(item, isAr) {
  return isAr ? (item.labelAr || item.labelEn) : (item.labelEn || item.label)
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

function DropdownItems({ items, isAr, pathname, onClose, onAction }) {
  return items.map((item, idx) => {
    if (item.group) {
      return (
        <div
          key={`group-${item.labelEn || idx}`}
          className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 first:pt-1"
        >
          {labelOf(item, isAr)}
        </div>
      )
    }
    if (item.action) {
      return (
        <button
          key={item.id || item.action}
          type="button"
          onClick={() => {
            onAction?.(item)
            onClose()
          }}
          className="block w-full px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-800"
        >
          {labelOf(item, isAr)}
        </button>
      )
    }
    const active = pathActive(pathname, item.href, Boolean(item.end))
    return (
      <Link
        key={`${item.href}-${item.labelEn || idx}`}
        to={item.href}
        onClick={onClose}
        className={`block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-dark-800 ${
          active
            ? 'font-semibold text-primary-700 dark:text-primary-300'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {labelOf(item, isAr)}
      </Link>
    )
  })
}

function NavDropdown({ label, items, isAr, open, onToggle, onClose, onAction, active, pathname }) {
  const btnRef = useRef(null)

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
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={onClose} anchorRef={btnRef} align="start">
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto py-1">
          <DropdownItems
            items={items}
            isAr={isAr}
            pathname={pathname}
            onClose={onClose}
            onAction={onAction}
          />
        </div>
      </PortalDropdown>
    </div>
  )
}

/** True when path is a document composer under accounting (hide module chrome). */
export function isAccountingInvoiceComposerPath(pathname = '') {
  return /\/accounting\/(invoices\/(new|[^/]+\/edit)|general-voucher\/new|journal-books\/new)/.test(pathname)
}

export default function AccountingLayout() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const location = useLocation()
  const queryClient = useQueryClient()
  const isAr = language === 'ar'
  const path = location.pathname
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [mobileHubId, setMobileHubId] = useState(null)
  const composerMode = isAccountingInvoiceComposerPath(path)

  const { data: firmData } = useQuery({
    queryKey: ['accounting-firm-clients'],
    queryFn: () => api.get('/accounting/firm/clients').then((r) => r.data),
    staleTime: 60_000,
  })

  const switchFirm = useMutation({
    mutationFn: (tenantId) => api.post('/accounting/firm/switch', { tenantId }).then((r) => r.data),
    onSuccess: (payload) => {
      localStorage.setItem('token', payload.token)
      if (payload?.user) localStorage.setItem('auth_user', JSON.stringify(payload.user))
      if (payload?.tenant) localStorage.setItem('auth_tenant', JSON.stringify(payload.tenant))
      toast.success(isAr ? 'تم تبديل دفاتر العميل' : 'Switched client books')
      window.location.href = '/app/dashboard/accounting'
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Switch failed'),
  })

  const seedMutation = useMutation({
    mutationFn: () => api.post('/accounting/accounts/seed'),
    onSuccess: () => {
      toast.success(isAr ? 'تم تجهيز دليل الحسابات' : 'Chart of accounts ready')
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  useEffect(() => {
    setMobileOpen(false)
    setOpenId(null)
    setMobileHubId(null)
  }, [path])

  const handleMenuAction = (item) => {
    if (item.action === 'seed-chart') seedMutation.mutate()
  }

  const hubs = ACCOUNTING_MENU.map((hub) => ({
    ...hub,
    active: hubIsActive(hub, path) || openId === hub.id,
  }))

  if (composerMode) {
    return (
      <AccountingPageActionsProvider>
        <div className="min-h-[calc(100vh-4rem)]">
          <SalesComposerChrome pathname={path} search={location.search} />
          <div className="px-1 py-4 sm:px-2">
            <Outlet />
          </div>
        </div>
      </AccountingPageActionsProvider>
    )
  }

  return (
    <AccountingPageActionsProvider>
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="relative z-10 border-b border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-900">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-0 pt-2">
          <div className="flex items-center gap-3 px-3 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <Calculator className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {isAr ? 'المحاسبة' : 'Accounting'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'عملاء وموردون ودفتر وتقارير' : 'Customers, vendors, ledger, and reports'}
              </p>
            </div>
            {firmData?.firmMode ? (
              <label className="ms-2 hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:block">
                {isAr ? 'دفاتر العميل' : 'Client books'}
                <select
                  className="mt-1 block min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 dark:border-dark-600 dark:bg-dark-800 dark:text-white"
                  value={String(firmData?.activeTenantId || tenant?._id || '')}
                  disabled={switchFirm.isPending}
                  onChange={(e) => {
                    const next = e.target.value
                    if (next && next !== String(firmData?.activeTenantId || '')) switchFirm.mutate(next)
                  }}
                >
                  {firmData?.home ? (
                    <option value={String(firmData.home._id)}>
                      {isAr ? 'المكتب' : 'Firm'} — {firmData.home.name}
                    </option>
                  ) : null}
                  {(firmData?.clients || []).map((c) => (
                    <option key={c._id} value={String(c._id)}>{c.name || c.slug}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm me-3 mb-2 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            {isAr ? 'القائمة' : 'Menu'}
          </button>

          <nav className="hidden flex-wrap items-center gap-0.5 px-2 lg:flex">
            {hubs.map((hub) => {
              if (!hub.children?.length && hub.href) {
                return (
                  <TopLink
                    key={hub.id}
                    to={hub.href}
                    end={Boolean(hub.end)}
                    active={hubIsActive(hub, path)}
                  >
                    {labelOf(hub, isAr)}
                  </TopLink>
                )
              }
              return (
                <NavDropdown
                  key={hub.id}
                  label={labelOf(hub, isAr)}
                  items={hub.children || []}
                  isAr={isAr}
                  pathname={path}
                  active={hub.active}
                  open={openId === hub.id}
                  onToggle={() => setOpenId((id) => (id === hub.id ? null : hub.id))}
                  onClose={() => setOpenId(null)}
                  onAction={handleMenuAction}
                />
              )
            })}
          </nav>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-100 bg-white px-3 py-3 lg:hidden dark:border-dark-600 dark:bg-dark-900">
            {hubs.map((hub) => {
              if (!hub.children?.length && hub.href) {
                return (
                  <Link
                    key={hub.id}
                    to={hub.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-100"
                    onClick={() => setMobileOpen(false)}
                  >
                    {labelOf(hub, isAr)}
                  </Link>
                )
              }
              const expanded = mobileHubId === hub.id
              return (
                <div key={hub.id} className="mt-1">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
                    onClick={() => setMobileHubId((id) => (id === hub.id ? null : hub.id))}
                  >
                    {labelOf(hub, isAr)}
                    <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded ? (
                    <div className="pb-2">
                      {(hub.children || []).map((item, idx) => {
                        if (item.group) {
                          return (
                            <div
                              key={`m-group-${item.labelEn || idx}`}
                              className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                            >
                              {labelOf(item, isAr)}
                            </div>
                          )
                        }
                        if (item.action) {
                          return (
                            <button
                              key={item.id || item.action}
                              type="button"
                              onClick={() => {
                                handleMenuAction(item)
                                setMobileOpen(false)
                              }}
                              className="block w-full px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-800"
                            >
                              {labelOf(item, isAr)}
                            </button>
                          )
                        }
                        return (
                          <Link
                            key={`${item.href}-${idx}`}
                            to={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-800"
                          >
                            {labelOf(item, isAr)}
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
        <AccountingPageActionsSlot />
      </div>

      <div className="px-1 py-6">
        <Outlet />
      </div>
    </div>
    </AccountingPageActionsProvider>
  )
}

/** Redirect helpers for legacy /invoices paths */
export function RedirectInvoicesIndex() {
  return <Navigate to="/app/dashboard/accounting/invoices" replace />
}

export function RedirectInvoicePath() {
  const location = useLocation()
  const rest = location.pathname.replace(/^\/app\/dashboard\/invoices/, '') || ''
  return <Navigate to={`/app/dashboard/accounting/invoices${rest}${location.search}${location.hash}`} replace />
}

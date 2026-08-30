import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Calculator, ChevronDown, Menu, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { PortalDropdown } from '../inventory/PortalDropdown'
import SalesComposerChrome from '../../components/sales/SalesComposerChrome'

const LEDGER_ITEMS = [
  { href: '/app/dashboard/accounting/chart-of-accounts', labelEn: 'Chart of Accounts', labelAr: 'دليل الحسابات' },
  { href: '/app/dashboard/accounting/journal-books', labelEn: 'Journal books', labelAr: 'دفاتر القيود' },
  { href: '/app/dashboard/accounting/defaults', labelEn: 'Default accounts', labelAr: 'الحسابات الافتراضية' },
  { href: '/app/dashboard/accounting/taxes', labelEn: 'Taxes', labelAr: 'الضريبة' },
  { href: '/app/dashboard/accounting/bank-recon', labelEn: 'Bank reconciliation', labelAr: 'التسوية البنكية' },
  { href: '/app/dashboard/accounting/analytic-accounts', labelEn: 'Analytic accounts', labelAr: 'الحسابات التحليلية' },
  { href: '/app/dashboard/accounting/period-close', labelEn: 'Period close', labelAr: 'إقفال الفترة' },
  { href: '/app/dashboard/accounting/journals-board', labelEn: 'Journals board', labelAr: 'لوحة القيود' },
  { href: '/app/dashboard/accounting/firm-clients', labelEn: 'Firm clients', labelAr: 'عملاء المكتب' },
  { href: '/app/dashboard/accounting/daily-restriction', labelEn: 'Daily Restriction', labelAr: 'القيود اليومية' },
  { href: '/app/dashboard/accounting/general-voucher', labelEn: 'General Voucher', labelAr: 'سند قيد عام' },
  { href: '/app/dashboard/accounting/receipt-voucher', labelEn: 'Receipt Voucher', labelAr: 'سند قبض' },
  { href: '/app/dashboard/accounting/payment-voucher', labelEn: 'Payment Voucher', labelAr: 'سند صرف' },
  { href: '/app/dashboard/accounting/ledger-search', labelEn: 'Search', labelAr: 'بحث' },
  { id: 'seed-chart', action: 'seed-chart', labelEn: 'Seed chart of accounts', labelAr: 'تجهيز دليل الحسابات' },
]

const REPORT_ITEMS = [
  { href: '/app/dashboard/accounting/account-report', labelEn: 'Account report', labelAr: 'تقرير الحساب' },
  { href: '/app/dashboard/accounting/balance-sheet', labelEn: 'Balance sheet', labelAr: 'الميزانية' },
  { href: '/app/dashboard/accounting/cash-flow', labelEn: 'Cash flow', labelAr: 'التدفقات النقدية' },
  { href: '/app/dashboard/accounting/aged-ar', labelEn: 'Aged receivables', labelAr: 'أعمار المدينين' },
  { href: '/app/dashboard/accounting/aged-ap', labelEn: 'Aged payables', labelAr: 'أعمار الدائنين' },
  { href: '/app/dashboard/accounting/customer-account', labelEn: 'Customer account', labelAr: 'كشف العميل' },
  { href: '/app/dashboard/accounting/customer-summary', labelEn: 'Customer summary', labelAr: 'ملخص العملاء' },
  { href: '/app/dashboard/accounting/supplier-account', labelEn: 'Supplier account', labelAr: 'كشف المورد' },
  { href: '/app/dashboard/accounting/supplier-summary', labelEn: 'Supplier summary', labelAr: 'ملخص الموردين' },
  { href: '/app/dashboard/accounting/trial', labelEn: 'Trial balance', labelAr: 'ميزان المراجعة' },
  { href: '/app/dashboard/accounting/pnl', labelEn: 'Profit & Loss', labelAr: 'الأرباح والخسائر' },
  { href: '/app/dashboard/accounting/analytic-report', labelEn: 'Analytic report', labelAr: 'تقرير تحليلي' },
]

const INVOICE_ITEMS = [
  { href: '/app/dashboard/accounting/invoices', labelEn: 'All invoices', labelAr: 'كل الفواتير', end: true },
  { href: '/app/dashboard/accounting/invoices/new/sell', labelEn: 'New sales invoice', labelAr: 'فاتورة مبيعات' },
  { href: '/app/dashboard/accounting/invoices/new/purchase', labelEn: 'New purchase invoice', labelAr: 'فاتورة مشتريات' },
  { href: '/app/dashboard/accounting/invoices/settings', labelEn: 'Settings', labelAr: 'الإعدادات' },
]

function pathActive(pathname, href, end = false) {
  if (!href) return false
  const path = href.split('?')[0]
  if (end) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

function labelOf(item, isAr) {
  return isAr ? item.labelAr : item.labelEn
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
  return items.map((item) => {
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
        key={item.href}
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
        <DropdownItems
          items={items}
          isAr={isAr}
          pathname={pathname}
          onClose={onClose}
          onAction={onAction}
        />
      </PortalDropdown>
    </div>
  )
}

/** True when path is an invoice composer under accounting (hide module chrome). */
export function isAccountingInvoiceComposerPath(pathname = '') {
  return /\/accounting\/invoices\/(new|[^/]+\/edit)/.test(pathname)
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
  }, [path])

  const handleMenuAction = (item) => {
    if (item.action === 'seed-chart') seedMutation.mutate()
  }

  const hubs = [
    {
      id: 'invoices',
      labelEn: 'Invoices',
      labelAr: 'الفواتير',
      items: INVOICE_ITEMS,
      active:
        path.includes('/accounting/invoices'),
    },
    {
      id: 'ledger',
      labelEn: 'Ledger',
      labelAr: 'الدفتر',
      items: LEDGER_ITEMS,
      active:
        !path.includes('/accounting/invoices')
        && path !== '/app/dashboard/accounting'
        && LEDGER_ITEMS.some((i) => i.href && pathActive(path, i.href)),
    },
    {
      id: 'reports',
      labelEn: 'Reports',
      labelAr: 'التقارير',
      items: REPORT_ITEMS,
      active: REPORT_ITEMS.some((i) => i.href && path.startsWith(i.href)),
    },
  ]

  if (composerMode) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        <SalesComposerChrome pathname={path} search={location.search} />
        <div className="px-1 py-4 sm:px-2">
          <Outlet />
        </div>
      </div>
    )
  }

  return (
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
                {isAr ? 'فواتير ودفتر وتقارير' : 'Invoices, ledger, and reports'}
              </p>
            </div>
            {(firmData?.firmMode || (firmData?.clients || []).length > 0) ? (
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

          <nav className="hidden flex-wrap items-center gap-1 px-2 lg:flex">
            <TopLink
              to="/app/dashboard/accounting"
              end
              active={path === '/app/dashboard/accounting'}
            >
              {isAr ? 'نظرة عامة' : 'Overview'}
            </TopLink>
            {hubs.map((hub) => (
              <NavDropdown
                key={hub.id}
                label={labelOf(hub, isAr)}
                items={hub.items}
                isAr={isAr}
                pathname={path}
                active={hub.active || openId === hub.id}
                open={openId === hub.id}
                onToggle={() => setOpenId((id) => (id === hub.id ? null : hub.id))}
                onClose={() => setOpenId(null)}
                onAction={handleMenuAction}
              />
            ))}
          </nav>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-100 bg-white px-3 py-3 lg:hidden dark:border-dark-600 dark:bg-dark-900">
            <Link
              to="/app/dashboard/accounting"
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-100"
              onClick={() => setMobileOpen(false)}
            >
              {isAr ? 'نظرة عامة' : 'Overview'}
            </Link>
            {hubs.map((hub) => (
              <div key={hub.id} className="mt-2">
                <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {labelOf(hub, isAr)}
                </div>
                {hub.items.map((item) => (
                  item.action ? (
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
                  ) : (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-800"
                    >
                      {labelOf(item, isAr)}
                    </Link>
                  )
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="px-1 py-6">
        <Outlet />
      </div>
    </div>
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

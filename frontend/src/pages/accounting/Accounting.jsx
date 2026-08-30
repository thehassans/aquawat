import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Plus, RefreshCw, Scale, TrendingUp, Landmark,
  FileSpreadsheet, CheckCircle2, XCircle, ArrowUpRight, Receipt, Wallet, Users, Truck, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'
import Vouchers from '../finance/Vouchers'
import {
  AccountReportPanel,
  AccountingDefaultsPanel,
  AccountingLockDatesPanel,
  AgedPayablesPanel,
  AgedReceivablesPanel,
  AnalyticAccountsPanel,
  AnalyticReportPanel,
  BankReconPanel,
  CashFlowPanel,
  CustomerAccountPanel,
  CustomerSummaryPanel,
  DailyRestrictionPanel,
  FirmClientsPanel,
  GeneralVoucherPanel,
  JournalBooksPanel,
  JournalsBoardPanel,
  LedgerSearchPanel,
  PeriodClosePanel,
  SupplierAccountPanel,
  SupplierSummaryPanel,
  TaxesPanel,
} from './AccountingModules'

const TABS = [
  { id: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة', icon: Landmark },
  { id: 'chart-of-accounts', labelEn: 'Chart of Accounts', labelAr: 'دليل الحسابات', icon: BookOpen },
  { id: 'journal-books', labelEn: 'Journal Books', labelAr: 'دفاتر القيود', icon: FileSpreadsheet },
  { id: 'defaults', labelEn: 'Default Accounts', labelAr: 'الحسابات الافتراضية', icon: Landmark },
  { id: 'taxes', labelEn: 'Taxes', labelAr: 'الضريبة', icon: Scale },
  { id: 'analytic-accounts', labelEn: 'Analytic accounts', labelAr: 'الحسابات التحليلية', icon: Users },
  { id: 'analytic-report', labelEn: 'Analytic report', labelAr: 'تقرير تحليلي', icon: TrendingUp },
  { id: 'period-close', labelEn: 'Period close', labelAr: 'إقفال الفترة', icon: Scale },
  { id: 'journals-board', labelEn: 'Journals board', labelAr: 'لوحة القيود', icon: FileSpreadsheet },
  { id: 'firm-clients', labelEn: 'Firm clients', labelAr: 'عملاء المكتب', icon: Users },
  { id: 'bank-recon', labelEn: 'Bank reconciliation', labelAr: 'التسوية البنكية', icon: Wallet },
  { id: 'daily-restriction', labelEn: 'Daily Restriction', labelAr: 'القيود اليومية', icon: FileSpreadsheet },
  { id: 'general-voucher', labelEn: 'General Voucher', labelAr: 'سند قيد عام', icon: FileText },
  { id: 'receipt-voucher', labelEn: 'Receipt Voucher', labelAr: 'سند قبض', icon: Receipt },
  { id: 'payment-voucher', labelEn: 'Payment Voucher', labelAr: 'سند صرف', icon: Wallet },
  { id: 'account-report', labelEn: 'Account of Report', labelAr: 'تقرير الحساب', icon: BookOpen },
  { id: 'balance-sheet', labelEn: 'Balance Sheet', labelAr: 'الميزانية العمومية', icon: Scale },
  { id: 'cash-flow', labelEn: 'Cash flow', labelAr: 'التدفقات النقدية', icon: Wallet },
  { id: 'aged-ar', labelEn: 'Aged receivables', labelAr: 'أعمار المدينين', icon: Users },
  { id: 'aged-ap', labelEn: 'Aged payables', labelAr: 'أعمار الدائنين', icon: Truck },
  { id: 'customer-account', labelEn: 'Customer Account', labelAr: 'كشف حساب العميل', icon: Users },
  { id: 'customer-summary', labelEn: 'Customer Summary', labelAr: 'ملخص العملاء', icon: Users },
  { id: 'supplier-account', labelEn: 'Supplier Account', labelAr: 'كشف حساب المورد', icon: Truck },
  { id: 'supplier-summary', labelEn: 'Supplier Summary', labelAr: 'ملخص الموردين', icon: Truck },
  { id: 'ledger-search', labelEn: 'Search', labelAr: 'بحث', icon: FileSpreadsheet },
  { id: 'trial', labelEn: 'Trial Balance', labelAr: 'ميزان المراجعة', icon: Scale },
  { id: 'pnl', labelEn: 'Profit & Loss', labelAr: 'الأرباح والخسائر', icon: TrendingUp },
]

const emptyLine = () => ({ accountId: '', debit: '', credit: '', description: '', analyticAccountId: '' })

const asMoney = (value) => Number(value || 0).toFixed(2)

const journalExportColumns = (isAr) => [
  { key: 'entryNumber', label: isAr ? 'رقم القيد' : 'Entry' },
  { key: 'entryDate', label: isAr ? 'التاريخ' : 'Date', value: (row) => (row.entryDate ? new Date(row.entryDate).toLocaleDateString() : '') },
  { key: 'type', label: isAr ? 'النوع' : 'Type' },
  { key: 'memo', label: isAr ? 'البيان' : 'Memo' },
  { key: 'status', label: isAr ? 'الحالة' : 'Status' },
  { key: 'totalDebit', label: isAr ? 'مدين' : 'Debit', value: (row) => asMoney(row.totalDebit) },
  { key: 'totalCredit', label: isAr ? 'دائن' : 'Credit', value: (row) => asMoney(row.totalCredit) },
]

const fontPage = { fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" }
const fontDisplay = { fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }

export default function Accounting() {
  const { language } = useSelector((s) => s.ui)
  const queryClient = useQueryClient()
  const { section } = useParams()
  const tab = TABS.some((item) => item.id === section) ? section : 'overview'
  const activeTab = TABS.find((item) => item.id === tab) || TABS[0]
  const [showJournalForm, setShowJournalForm] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')
  const [journalForm, setJournalForm] = useState({
    memo: '',
    entryDate: new Date().toISOString().slice(0, 10),
    journalId: '',
    lines: [emptyLine(), emptyLine()],
  })
  const isAr = language === 'ar'

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: () => api.get('/accounting/dashboard').then((r) => r.data),
  })

  const { data: recentInvoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['accounting-overview-invoices'],
    queryFn: async () => {
      const { data } = await api.get('/invoices', { params: { limit: 8, page: 1 } })
      return data
    },
    enabled: tab === 'overview',
  })

  const recentInvoices = useMemo(() => {
    const list = recentInvoicesData?.invoices || recentInvoicesData?.items || recentInvoicesData || []
    return Array.isArray(list) ? list : []
  }, [recentInvoicesData])

  const invoiceStats = useMemo(() => {
    const list = recentInvoices
    const sell = list.filter((i) => String(i.flow || 'sell') !== 'purchase')
    const purchase = list.filter((i) => String(i.flow || '') === 'purchase')
    const draft = list.filter((i) => String(i.status || '').toLowerCase() === 'draft').length
    const outstanding = list.reduce((s, i) => s + Number(i.balanceDue ?? i.amountDue ?? 0), 0)
    const revenue = sell.reduce((s, i) => s + Number(i.grandTotal || 0), 0)
    return { count: list.length, sell: sell.length, purchase: purchase.length, draft, outstanding, revenue }
  }, [recentInvoices])

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data),
    enabled: ['chart-of-accounts', 'daily-restriction', 'general-voucher', 'overview', 'defaults', 'journal-books'].includes(tab) || showJournalForm,
  })

  const { data: journalBooks = [] } = useQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books').then((r) => r.data || []),
    enabled: showJournalForm || tab === 'journal-books' || tab === 'overview',
  })

  const { data: analyticAccounts = [] } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
    enabled: showJournalForm || tab === 'analytic-accounts' || tab === 'analytic-report',
  })

  const { refetch: refetchJournals } = useQuery({
    queryKey: ['accounting-journals'],
    queryFn: () => api.get('/accounting/journals', { params: { limit: 50 } }).then((r) => r.data),
    enabled: tab === 'daily-restriction' || tab === 'general-voucher' || tab === 'overview',
  })

  const { data: trial } = useQuery({
    queryKey: ['accounting-trial'],
    queryFn: () => api.get('/accounting/reports/trial-balance').then((r) => r.data),
    enabled: tab === 'trial',
  })

  const { data: pnl } = useQuery({
    queryKey: ['accounting-pnl'],
    queryFn: () => api.get('/accounting/reports/profit-and-loss').then((r) => r.data),
    enabled: tab === 'pnl',
  })

  const { data: balance } = useQuery({
    queryKey: ['accounting-balance'],
    queryFn: () => api.get('/accounting/reports/balance-sheet').then((r) => r.data),
    enabled: tab === 'balance-sheet',
  })

  const createJournalMutation = useMutation({
    mutationFn: (payload) => api.post('/accounting/journals', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء القيد' : 'Journal created')
      setShowJournalForm(false)
      setJournalForm({ memo: '', entryDate: new Date().toISOString().slice(0, 10), journalId: '', lines: [emptyLine(), emptyLine()] })
      refetchJournals()
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-daily'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-general-vouchers'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const postJournalMutation = useMutation({
    mutationFn: async (id) => {
      try {
        return await api.post(`/accounting/journals/${id}/post`)
      } catch {
        return api.post(`/accounting/journals/${id}/post-simple`)
      }
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم ترحيل القيد' : 'Journal posted')
      refetchJournals()
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-daily'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-general-vouchers'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to post'),
  })

  const reverseJournalMutation = useMutation({
    mutationFn: (id) => api.post(`/accounting/journals/${id}/reverse`, {
      reason: isAr ? 'عكس قيد' : 'Manual reversal',
    }),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء قيد عكسي' : 'Reversal entry created')
      refetchJournals()
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-daily'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-general-vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-ledger-search'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to reverse'),
  })

  const journalTotals = useMemo(() => {
    const debit = journalForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const credit = journalForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.009 && debit > 0 }
  }, [journalForm.lines])

  const submitJournal = () => {
    createJournalMutation.mutate({
      memo: journalForm.memo,
      entryDate: journalForm.entryDate,
      type: 'manual',
      status: 'draft',
      journalId: journalForm.journalId || undefined,
      lines: journalForm.lines
        .filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
        .map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || '',
          analyticAccountId: l.analyticAccountId || undefined,
        })),
    })
  }

  const exportColumns = useMemo(() => {
    if (tab === 'chart-of-accounts') {
      return [
        { key: 'code', label: isAr ? 'الرمز' : 'Code' },
        { key: 'name', label: isAr ? 'الاسم' : 'Name', value: (row) => (isAr ? (row.nameAr || row.name) : row.name) },
        { key: 'type', label: isAr ? 'النوع' : 'Type' },
        { key: 'balance', label: isAr ? 'الرصيد' : 'Balance', value: (row) => asMoney(row.balance) },
      ]
    }
    if (tab === 'trial') {
      return [
        { key: 'code', label: isAr ? 'الرمز' : 'Code' },
        { key: 'name', label: isAr ? 'الحساب' : 'Account', value: (row) => (isAr ? (row.nameAr || row.name) : row.name) },
        { key: 'debit', label: isAr ? 'مدين' : 'Debit', value: (row) => asMoney(row.debit) },
        { key: 'credit', label: isAr ? 'دائن' : 'Credit', value: (row) => asMoney(row.credit) },
      ]
    }
    if (tab === 'pnl' || tab === 'balance-sheet') {
      return [
        { key: 'section', label: isAr ? 'القسم' : 'Section' },
        { key: 'name', label: isAr ? 'الحساب' : 'Account' },
        { key: 'amount', label: isAr ? 'المبلغ' : 'Amount', value: (row) => asMoney(row.amount) },
      ]
    }
    if (tab === 'customer-summary' || tab === 'supplier-summary') {
      return [
        { key: 'name', label: isAr ? 'الاسم' : 'Name' },
        { key: 'invoiced', label: isAr ? 'الفواتير' : 'Invoiced', value: (row) => asMoney(row.invoiced || row.total || row.amount) },
        { key: 'paid', label: isAr ? 'المدفوع' : 'Paid', value: (row) => asMoney(row.paid) },
        { key: 'balance', label: isAr ? 'الرصيد' : 'Balance', value: (row) => asMoney(row.balance) },
      ]
    }
    return journalExportColumns(isAr)
  }, [isAr, tab])

  const getExportRows = async () => {
    if (tab === 'chart-of-accounts') {
      if (accounts.length) return accounts
      return api.get('/accounting/accounts').then((r) => r.data || [])
    }
    if (tab === 'trial') {
      const data = trial || await api.get('/accounting/reports/trial-balance').then((r) => r.data)
      return data?.rows || []
    }
    if (tab === 'pnl') {
      const data = pnl || await api.get('/accounting/reports/profit-and-loss').then((r) => r.data)
      return [
        ...(data?.revenue || []).map((row) => ({ section: isAr ? 'إيرادات' : 'Revenue', name: isAr ? (row.nameAr || row.name) : row.name, amount: row.amount })),
        ...(data?.expenses || []).map((row) => ({ section: isAr ? 'مصروفات' : 'Expenses', name: isAr ? (row.nameAr || row.name) : row.name, amount: row.amount })),
        { section: isAr ? 'صافي الدخل' : 'Net income', name: '', amount: data?.netIncome || 0 },
      ]
    }
    if (tab === 'balance-sheet') {
      const data = balance || await api.get('/accounting/reports/balance-sheet').then((r) => r.data)
      const pack = (section, rows) => (rows || []).map((row) => ({ section, name: isAr ? (row.nameAr || row.name) : row.name, amount: row.balance }))
      return [
        ...pack(isAr ? 'الأصول' : 'Assets', data?.assets),
        ...pack(isAr ? 'الالتزامات' : 'Liabilities', data?.liabilities),
        ...pack(isAr ? 'حقوق الملكية' : 'Equity', data?.equity),
      ]
    }
    if (tab === 'receipt-voucher' || tab === 'payment-voucher') {
      const type = tab === 'receipt-voucher' ? 'receive' : 'payment'
      const data = await api.get('/vouchers', { params: { type, limit: 200 } }).then((r) => r.data)
      const rows = Array.isArray(data) ? data : (data?.rows || data?.vouchers || [])
      return rows.map((row) => ({
        entryNumber: row.voucherNumber || row.number || row.entryNumber,
        entryDate: row.date || row.entryDate,
        type: row.type || type,
        memo: row.narration || row.memo || row.notes || '',
        status: row.status || '',
        totalDebit: row.amount || row.totalDebit || 0,
        totalCredit: row.amount || row.totalCredit || 0,
      }))
    }
    if (tab === 'customer-summary') {
      const data = await api.get('/accounting/reports/customer-summary').then((r) => r.data).catch(() => null)
      return data?.rows || data || []
    }
    if (tab === 'supplier-summary') {
      const data = await api.get('/accounting/reports/supplier-summary').then((r) => r.data).catch(() => null)
      return data?.rows || data || []
    }
    if (tab === 'customer-account' || tab === 'account-report') {
      const data = await api.get('/accounting/journals', { params: { limit: 200 } }).then((r) => r.data)
      return data?.rows || []
    }
    if (tab === 'daily-restriction') {
      const day = new Date().toISOString().slice(0, 10)
      const data = await api.get('/accounting/journals', { params: { from: day, to: day, limit: 200 } }).then((r) => r.data)
      return data?.rows || []
    }
    if (tab === 'general-voucher') {
      const data = await api.get('/accounting/journals', { params: { type: 'manual', limit: 200 } }).then((r) => r.data)
      return data?.rows || []
    }
    return dashboard?.recent || []
  }

  const kpis = [
    { key: 'cash', labelEn: 'Cash & Bank', labelAr: 'النقد والبنك', value: dashboard?.cashBalance, icon: Landmark },
    { key: 'ar', labelEn: 'Receivables', labelAr: 'الذمم المدينة', value: dashboard?.arBalance, icon: ArrowUpRight },
    { key: 'ap', labelEn: 'Payables', labelAr: 'الذمم الدائنة', value: dashboard?.apBalance, icon: ArrowUpRight },
    { key: 'ni', labelEn: 'Net Income', labelAr: 'صافي الدخل', value: dashboard?.netIncome, icon: TrendingUp },
  ]

  return (
    <div className="space-y-6" style={fontPage}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? activeTab.labelAr : activeTab.labelEn}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isAr
              ? 'دفتر مزدوج القيد مع الفواتير والتقارير'
              : 'Double-entry ledger with invoices and reports'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu
            language={language}
            rows={[]}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={`maqder-accounting-${tab}`}
            title={isAr ? activeTab.labelAr : activeTab.labelEn}
          />
          <button
            type="button"
            onClick={() => setShowJournalForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'قيد جديد' : 'New journal'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {kpis.map((k) => {
                const Icon = k.icon
                return (
                  <div
                    key={k.key}
                    className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {isAr ? k.labelAr : k.labelEn}
                      </p>
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
                      {dashLoading ? '—' : <Money value={k.value || 0} />}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { labelEn: 'Invoices', labelAr: 'فواتير', value: invoiceStats.count },
                { labelEn: 'Sales invoices', labelAr: 'مبيعات', value: invoiceStats.sell },
                { labelEn: 'Drafts', labelAr: 'مسودات', value: invoiceStats.draft },
                { labelEn: 'Outstanding', labelAr: 'مستحق', value: invoiceStats.outstanding, money: true },
              ].map((item) => (
                <div
                  key={item.labelEn}
                  className="rounded-xl border border-slate-200/70 bg-slate-50/90 px-3.5 py-3 dark:border-dark-600 dark:bg-dark-900/50"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {isAr ? item.labelAr : item.labelEn}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-800 dark:text-slate-100">
                    {invoicesLoading ? '—' : item.money ? <Money value={item.value || 0} /> : item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {[
                {
                  key: 'ar',
                  titleEn: 'Aged receivables',
                  titleAr: 'أعمار المدينين',
                  href: '/app/dashboard/accounting/aged-ar',
                  data: dashboard?.agedAr,
                },
                {
                  key: 'ap',
                  titleEn: 'Aged payables',
                  titleAr: 'أعمار الدائنين',
                  href: '/app/dashboard/accounting/aged-ap',
                  data: dashboard?.agedAp,
                },
              ].map((block) => (
                <div key={block.key} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isAr ? block.titleAr : block.titleEn}
                    </h3>
                    <Link to={block.href} className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                      {isAr ? 'التفاصيل' : 'Details'}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {dashLoading
                      ? '—'
                      : `${block.data?.openCount ?? 0} ${isAr ? 'فاتورة مفتوحة' : 'open invoices'} · `}
                    {!dashLoading ? <Money value={block.data?.buckets?.total || 0} /> : null}
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      ['d0_30', isAr ? '٠–٣٠' : '0–30'],
                      ['d31_60', isAr ? '٣١–٦٠' : '31–60'],
                      ['d61_90', isAr ? '٦١–٩٠' : '61–90'],
                      ['d90_plus', isAr ? '٩٠+' : '90+'],
                    ].map(([key, label]) => (
                      <div key={key} className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-dark-900">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums">
                          {dashLoading ? '—' : <Money value={block.data?.buckets?.[key] || 0} />}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isAr ? 'أحدث الفواتير' : 'Recent invoices'}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {isAr ? 'فواتير البيع والشراء' : 'Sales and purchase invoices'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/app/dashboard/accounting/invoices"
                      className="text-xs font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300"
                    >
                      {isAr ? 'الكل' : 'View all'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => { refetchInvoices(); refetchDash() }}
                      className="rounded-lg border border-slate-200/80 p-1.5 text-slate-400 hover:text-slate-700 dark:border-dark-600"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                  {!invoicesLoading && recentInvoices.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <Receipt className="mb-2 h-5 w-5 text-slate-300" />
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {isAr ? 'لا فواتير بعد' : 'No invoices yet'}
                      </p>
                      <Link
                        to="/app/dashboard/accounting/invoices"
                        className="mt-3 text-sm font-semibold text-primary-700 dark:text-primary-300"
                      >
                        {isAr ? 'فتح الفواتير' : 'Open invoices'}
                      </Link>
                    </div>
                  ) : null}
                  {recentInvoices.map((inv) => (
                    <Link
                      key={inv._id}
                      to={`/app/dashboard/accounting/invoices/${inv._id}`}
                      className="flex items-center justify-between py-3 text-sm transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {inv.invoiceNumber || '—'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {inv.buyer?.name || inv.customerId?.name || inv.supplierId?.name || inv.seller?.name || '—'}
                          {' · '}
                          {String(inv.flow || 'sell') === 'purchase'
                            ? (isAr ? 'مشتريات' : 'Purchase')
                            : (isAr ? 'مبيعات' : 'Sales')}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-semibold tabular-nums"><Money value={inv.grandTotal} /></p>
                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${
                          inv.status === 'paid' || inv.paymentStatus === 'paid'
                            ? 'text-emerald-600'
                            : inv.status === 'draft'
                              ? 'text-amber-600'
                              : 'text-slate-500'
                        }`}
                        >
                          {inv.status || inv.paymentStatus || '—'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{isAr ? 'صحة الدفتر' : 'Ledger health'}</h3>
                <div className="mt-4 space-y-3 text-sm">
                  {[
                    [isAr ? 'الحسابات' : 'Accounts', dashboard?.accountCount || 0],
                    [isAr ? 'مسودات' : 'Drafts', dashboard?.draftCount || 0],
                    [isAr ? 'مرحّلة' : 'Posted', dashboard?.postedCount || 0],
                    [isAr ? 'فواتير' : 'Invoices', invoiceStats.count],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-dark-600">
                    <span className="text-slate-500">{isAr ? 'ميزان متوازن' : 'Trial balanced'}</span>
                    {dashboard?.trialBalanced
                      ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{isAr ? 'متوازن' : 'Balanced'}</span>
                      : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600"><XCircle className="h-3.5 w-3.5" />{isAr ? 'غير متوازن' : 'Review'}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{isAr ? 'أحدث القيود' : 'Recent journals'}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{isAr ? 'آخر الحركات' : 'Latest entries'}</p>
                </div>
                <button type="button" onClick={() => refetchDash()} className="rounded-lg border border-slate-200/80 p-1.5 text-slate-400 hover:text-slate-700 dark:border-dark-600">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                {(dashboard?.recent || []).length === 0 && (
                  <div className="flex flex-col items-center py-8 text-center">
                    <FileSpreadsheet className="mb-2 h-5 w-5 text-slate-300" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{isAr ? 'لا قيود بعد' : 'No journals yet'}</p>
                    <button type="button" onClick={() => setShowJournalForm(true)} className="mt-3 text-sm font-semibold text-primary-700 dark:text-primary-300">
                      {isAr ? 'قيد جديد' : 'New journal'}
                    </button>
                  </div>
                )}
                {(dashboard?.recent || []).map((j) => (
                  <div key={j._id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{j.entryNumber}</p>
                      <p className="text-xs text-slate-500">{j.memo || j.type}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold tabular-nums"><Money value={j.totalDebit} /></p>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${j.status === 'posted' ? 'text-emerald-600' : j.status === 'void' || j.status === 'reversed' ? 'text-rose-500' : 'text-amber-600'}`}>{j.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <AccountingLockDatesPanel language={language} />
            <AccountingDefaultsPanel language={language} />
          </motion.div>
        )}

          {tab === 'journal-books' && (
            <motion.div key="journal-books" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <JournalBooksPanel language={language} />
            </motion.div>
          )}

          {tab === 'defaults' && (
            <motion.div key="defaults" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountingDefaultsPanel language={language} />
            </motion.div>
          )}

          {tab === 'taxes' && (
            <motion.div key="taxes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <TaxesPanel language={language} />
            </motion.div>
          )}

          {tab === 'analytic-accounts' && (
            <motion.div key="analytic-accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AnalyticAccountsPanel language={language} />
            </motion.div>
          )}

          {tab === 'analytic-report' && (
            <motion.div key="analytic-report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AnalyticReportPanel language={language} />
            </motion.div>
          )}

          {tab === 'period-close' && (
            <motion.div key="period-close" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <PeriodClosePanel language={language} />
            </motion.div>
          )}

          {tab === 'journals-board' && (
            <motion.div key="journals-board" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <JournalsBoardPanel language={language} />
            </motion.div>
          )}

          {tab === 'firm-clients' && (
            <motion.div key="firm-clients" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FirmClientsPanel language={language} />
            </motion.div>
          )}

          {tab === 'cash-flow' && (
            <motion.div key="cash-flow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CashFlowPanel language={language} />
            </motion.div>
          )}

          {tab === 'aged-ar' && (
            <motion.div key="aged-ar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AgedReceivablesPanel language={language} />
            </motion.div>
          )}

          {tab === 'aged-ap' && (
            <motion.div key="aged-ap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AgedPayablesPanel language={language} />
            </motion.div>
          )}

          {tab === 'bank-recon' && (
            <motion.div key="bank-recon" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <BankReconPanel language={language} />
            </motion.div>
          )}

          {tab === 'chart-of-accounts' && (
            <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
              <div className="border-b border-slate-100 px-5 py-3 dark:border-white/10">
                <input
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder={isAr ? 'بحث بالرمز أو الاسم…' : 'Search code or name…'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-dark-900"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900">
                    <tr>
                      <th className="px-5 py-3.5">{isAr ? 'الرمز' : 'Code'}</th>
                      <th className="px-5 py-3.5">{isAr ? 'الاسم' : 'Name'}</th>
                      <th className="px-5 py-3.5">{isAr ? 'النوع' : 'Type'}</th>
                      <th className="px-5 py-3.5 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {accounts.filter((a) => {
                      const q = accountSearch.trim().toLowerCase()
                      if (!q) return true
                      return [a.code, a.name, a.nameAr].some((v) => String(v || '').toLowerCase().includes(q))
                    }).map((a) => (
                      <tr key={a._id} className="hover:bg-emerald-50/40 dark:hover:bg-white/[0.03]">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">{a.code}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900 dark:text-white">{isAr ? (a.nameAr || a.name) : a.name}</p>
                          {a.nameAr && !isAr ? <p className="text-xs text-slate-400" dir="rtl">{a.nameAr}</p> : null}
                        </td>
                        <td className="px-5 py-3.5 capitalize text-slate-500">{a.type}</td>
                        <td className="px-5 py-3.5 text-end font-semibold"><Money value={a.balance || 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {tab === 'daily-restriction' && (
            <motion.div key="daily-restriction" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <DailyRestrictionPanel
                language={language}
                onNew={() => setShowJournalForm(true)}
                onPost={(id) => postJournalMutation.mutate(id)}
                posting={postJournalMutation.isPending}
                onReverse={(id) => reverseJournalMutation.mutate(id)}
                reversing={reverseJournalMutation.isPending}
              />
            </motion.div>
          )}

          {tab === 'general-voucher' && (
            <motion.div key="general-voucher" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <GeneralVoucherPanel
                language={language}
                onNew={() => setShowJournalForm(true)}
                onPost={(id) => postJournalMutation.mutate(id)}
                posting={postJournalMutation.isPending}
                onReverse={(id) => reverseJournalMutation.mutate(id)}
                reversing={reverseJournalMutation.isPending}
              />
            </motion.div>
          )}

          {tab === 'receipt-voucher' && (
            <motion.div key="receipt-voucher" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Vouchers forcedType="receive" embedded />
            </motion.div>
          )}

          {tab === 'payment-voucher' && (
            <motion.div key="payment-voucher" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Vouchers forcedType="payment" embedded />
            </motion.div>
          )}

          {tab === 'account-report' && (
            <motion.div key="account-report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountReportPanel language={language} />
            </motion.div>
          )}

          {tab === 'customer-account' && (
            <motion.div key="customer-account" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CustomerAccountPanel language={language} />
            </motion.div>
          )}

          {tab === 'customer-summary' && (
            <motion.div key="customer-summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CustomerSummaryPanel language={language} />
            </motion.div>
          )}

          {tab === 'supplier-account' && (
            <motion.div key="supplier-account" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <SupplierAccountPanel language={language} />
            </motion.div>
          )}

          {tab === 'supplier-summary' && (
            <motion.div key="supplier-summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <SupplierSummaryPanel language={language} />
            </motion.div>
          )}

          {tab === 'ledger-search' && (
            <motion.div key="ledger-search" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <LedgerSearchPanel
                language={language}
                onPost={(id) => postJournalMutation.mutate(id)}
                posting={postJournalMutation.isPending}
                onReverse={(id) => reverseJournalMutation.mutate(id)}
                reversing={reverseJournalMutation.isPending}
              />
            </motion.div>
          )}

          {tab === 'trial' && trial && (
            <motion.div key="trial" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-semibold" style={fontDisplay}>{isAr ? 'ميزان المراجعة' : 'Trial Balance'}</h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${trial.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {trial.balanced ? (isAr ? 'متوازن' : 'Balanced') : (isAr ? 'غير متوازن' : 'Out of balance')}
                </span>
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
                  <tr>
                    <th className="px-5 py-3 text-start">Code</th>
                    <th className="px-5 py-3 text-start">Account</th>
                    <th className="px-5 py-3 text-end">Debit</th>
                    <th className="px-5 py-3 text-end">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {trial.rows.map((r) => (
                    <tr key={r.code}>
                      <td className="px-5 py-2.5 font-mono text-xs text-emerald-800">{r.code}</td>
                      <td className="px-5 py-2.5">{isAr ? (r.nameAr || r.name) : r.name}</td>
                      <td className="px-5 py-2.5 text-end"><Money value={r.debit} /></td>
                      <td className="px-5 py-2.5 text-end"><Money value={r.credit} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 font-semibold dark:border-white/10">
                  <tr>
                    <td className="px-5 py-3" colSpan={2}>{isAr ? 'الإجمالي' : 'Total'}</td>
                    <td className="px-5 py-3 text-end"><Money value={trial.totalDebit} /></td>
                    <td className="px-5 py-3 text-end"><Money value={trial.totalCredit} /></td>
                  </tr>
                </tfoot>
              </table>
            </motion.div>
          )}

          {tab === 'pnl' && pnl && (
            <motion.div key="pnl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                <h3 className="font-semibold text-emerald-800" style={fontDisplay}>{isAr ? 'الإيرادات' : 'Revenue'}</h3>
                <div className="mt-4 space-y-2">
                  {pnl.revenue.map((a) => (
                    <div key={a._id} className="flex justify-between text-sm">
                      <span>{isAr ? (a.nameAr || a.name) : a.name}</span>
                      <span className="font-semibold"><Money value={a.amount} /></span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-white/10">
                    <span>{isAr ? 'إجمالي الإيرادات' : 'Total revenue'}</span>
                    <Money value={pnl.totalRevenue} />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                <h3 className="font-semibold text-rose-700" style={fontDisplay}>{isAr ? 'المصروفات' : 'Expenses'}</h3>
                <div className="mt-4 space-y-2">
                  {pnl.expenses.map((a) => (
                    <div key={a._id} className="flex justify-between text-sm">
                      <span>{isAr ? (a.nameAr || a.name) : a.name}</span>
                      <span className="font-semibold"><Money value={a.amount} /></span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-white/10">
                    <span>{isAr ? 'إجمالي المصروفات' : 'Total expenses'}</span>
                    <Money value={pnl.totalExpenses} />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-primary-500/5 p-5 lg:col-span-2 dark:border-primary-500/20 dark:bg-primary-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800/70 dark:text-emerald-300">
                    {isAr ? 'صافي الدخل' : 'Net income'}
                  </span>
                  <span className="text-2xl font-semibold text-emerald-950 dark:text-white" style={fontDisplay}><Money value={pnl.netIncome} /></span>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'balance-sheet' && balance && (
            <motion.div key="balance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {[
                { titleEn: 'Assets', titleAr: 'الأصول', rows: balance.assets, total: balance.totalAssets, tone: 'text-emerald-800' },
                { titleEn: 'Liabilities', titleAr: 'الالتزامات', rows: balance.liabilities, total: balance.totalLiabilities, tone: 'text-amber-800' },
                { titleEn: 'Equity', titleAr: 'حقوق الملكية', rows: balance.equity, total: balance.totalEquity, tone: 'text-sky-800' },
              ].map((col) => (
                <div key={col.titleEn} className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                  <h3 className={`font-semibold ${col.tone} dark:text-white`} style={fontDisplay}>{isAr ? col.titleAr : col.titleEn}</h3>
                  <div className="mt-4 space-y-2.5 text-sm">
                    {col.rows.map((r) => (
                      <div key={r.code} className="flex justify-between gap-3">
                        <span className="text-slate-600 dark:text-slate-300">{isAr ? (r.nameAr || r.name) : r.name}</span>
                        <span className="font-semibold"><Money value={r.balance} /></span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-white/10">
                      <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                      <Money value={col.total} />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      <AnimatePresence>
        {showJournalForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-white/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-dark-800"
              style={fontPage}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">{isAr ? 'دفتر الأستاذ' : 'General ledger'}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white" style={fontDisplay}>{isAr ? 'قيد يومية جديد' : 'New journal entry'}</h3>
                </div>
                <button type="button" onClick={() => setShowJournalForm(false)} className="rounded-xl px-2 text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{isAr ? 'التاريخ' : 'Date'}</label>
                  <input type="date" value={journalForm.entryDate} onChange={(e) => setJournalForm((f) => ({ ...f, entryDate: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{isAr ? 'البيان' : 'Memo'}</label>
                  <input value={journalForm.memo} onChange={(e) => setJournalForm((f) => ({ ...f, memo: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{isAr ? 'دفتر القيد' : 'Journal book'}</label>
                  <select
                    value={journalForm.journalId}
                    onChange={(e) => {
                      const id = e.target.value
                      const book = (Array.isArray(journalBooks) ? journalBooks : []).find((b) => String(b._id) === id)
                      setJournalForm((f) => {
                        const next = { ...f, journalId: id }
                        if (book && f.lines?.length) {
                          const lines = [...f.lines]
                          const debitId = book.defaultDebitAccountId?._id || book.defaultDebitAccountId
                          const creditId = book.defaultCreditAccountId?._id || book.defaultCreditAccountId
                          if (debitId && !lines[0]?.accountId) lines[0] = { ...lines[0], accountId: String(debitId) }
                          if (creditId && lines[1] && !lines[1]?.accountId) lines[1] = { ...lines[1], accountId: String(creditId) }
                          next.lines = lines
                        }
                        return next
                      })
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900"
                  >
                    <option value="">{isAr ? 'بدون دفتر (JE)' : 'No book (JE)'}</option>
                    {(Array.isArray(journalBooks) ? journalBooks : []).map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.code} — {isAr ? (b.nameAr || b.name) : b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {journalForm.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-12 dark:bg-dark-900">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800 md:col-span-4"
                      value={line.accountId}
                      onChange={(e) => {
                        const next = [...journalForm.lines]
                        next[idx] = { ...next[idx], accountId: e.target.value }
                        setJournalForm((f) => ({ ...f, lines: next }))
                      }}
                    >
                      <option value="">{isAr ? 'اختر حساب' : 'Select account'}</option>
                      {accounts.filter((a) => a.isPostable !== false).map((a) => (
                        <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800 md:col-span-2"
                      value={line.analyticAccountId || ''}
                      onChange={(e) => {
                        const next = [...journalForm.lines]
                        next[idx] = { ...next[idx], analyticAccountId: e.target.value }
                        setJournalForm((f) => ({ ...f, lines: next }))
                      }}
                    >
                      <option value="">{isAr ? 'تحليلي' : 'Analytic'}</option>
                      {(Array.isArray(analyticAccounts) ? analyticAccounts : []).map((a) => (
                        <option key={a._id} value={a._id}>{a.code}</option>
                      ))}
                    </select>
                    <input type="number" min="0" step="0.01" placeholder="Debit" value={line.debit} onChange={(e) => {
                      const next = [...journalForm.lines]
                      next[idx] = { ...next[idx], debit: e.target.value, credit: e.target.value ? '' : next[idx].credit }
                      setJournalForm((f) => ({ ...f, lines: next }))
                    }} className="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800 md:col-span-2" />
                    <input type="number" min="0" step="0.01" placeholder="Credit" value={line.credit} onChange={(e) => {
                      const next = [...journalForm.lines]
                      next[idx] = { ...next[idx], credit: e.target.value, debit: e.target.value ? '' : next[idx].debit }
                      setJournalForm((f) => ({ ...f, lines: next }))
                    }} className="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800 md:col-span-2" />
                    <input placeholder="Note" value={line.description} onChange={(e) => {
                      const next = [...journalForm.lines]
                      next[idx] = { ...next[idx], description: e.target.value }
                      setJournalForm((f) => ({ ...f, lines: next }))
                    }} className="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800 md:col-span-2" />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => setJournalForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))} className="text-xs font-semibold text-emerald-700">
                  + {isAr ? 'سطر' : 'Add line'}
                </button>
                <p className={`text-xs font-semibold ${journalTotals.balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Dr <Money value={journalTotals.debit} /> · Cr <Money value={journalTotals.credit} />
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setShowJournalForm(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button
                  type="button"
                  disabled={!journalTotals.balanced || createJournalMutation.isPending}
                  onClick={submitJournal}
                  className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {isAr ? 'حفظ المسودة' : 'Save draft'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

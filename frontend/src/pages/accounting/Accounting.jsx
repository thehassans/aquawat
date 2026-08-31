import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
  AccountingComingSoonPanel,
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
  FollowUpReportsPanel,
  FiscalPositionsPanel,
  ExecutiveSummaryPanel,
  InvoiceAnalysisPanel,
  PaymentTermsPanel,
  IncotermsPanel,
  BankAccountsPanel,
  CurrenciesPanel,
  FollowUpLevelsPanel,
  AnalyticItemsPanel,
  FixedAssetsPanel,
  DepreciationSchedulePanel,
  DeferredAccountsPanel,
  DeferredModelsPanel,
  AssetModelsPanel,
  AnalyticPlansPanel,
  AccountTagsPanel,
  AccountGroupsPanel,
  TaxGroupsPanel,
  ProductCategoriesBridgePanel,
  AccountingReportsConfigPanel,
  HorizontalGroupsPanel,
  TaxUnitsPanel,
  AnalyticDistributionModelsPanel,
  AutomaticTransfersPanel,
  ChartOfAccountsPanel,
  OnlineSyncPanel,
  PaymentProvidersPanel,
  ReconciliationModelsPanel,
  JournalGroupsPanel,
  SimpleStatusPanel,
  GeneralVoucherPanel,
  JournalBooksPanel,
  JournalItemsPanel,
  JournalsBoardPanel,
  LedgerSearchPanel,
  OpeningBalancesPanel,
  PartnerLedgerPanel,
  PeriodClosePanel,
  SupplierAccountPanel,
  SupplierSummaryPanel,
  TaxesPanel,
  VatTaxReportPanel,
} from './AccountingModules'
import {
  BalanceSheetPanel,
  ProfitAndLossPanel,
  TrialBalancePanel,
  JournalAuditReportPanel,
} from './AccountingReportPanels'
import CreditNotesPanel from './documents/CreditNotesPanel'
import CustomerPaymentsPanel from './documents/CustomerPaymentsPanel'
import VendorBillsPanel from './documents/VendorBillsPanel'
import VendorRefundsPanel from './documents/VendorRefundsPanel'
import VendorPaymentsPanel from './documents/VendorPaymentsPanel'
import AccountingCustomersPanel from './documents/AccountingCustomersPanel'
import AccountingProductsPanel from './documents/AccountingProductsPanel'
import { ACCOUNTING_COMING_SOON_SECTIONS } from './accounting.menu'
import { useRegisterAccountingPageActions } from './AccountingPageActionsContext'

/** Only journal entry board / overview may expose "+ New entry" — never bleed to vouchers, items, books, etc. */
const NEW_ENTRY_TABS = new Set(['overview', 'journals-board'])

/** Tabs that own their own primary CTA — never show layout-level journal button here. */
const HIDE_JOURNAL_CTA_TABS = new Set([
  'credit-notes',
  'customer-payments',
  'follow-up-reports',
  'aged-ar',
  'aged-ap',
  'vendor-bills',
  'vendor-refunds',
  'vendor-payments',
  'customers',
  'products',
  'customer-summary',
  'customer-account',
  'supplier-summary',
  'supplier-account',
  'journal-items',
  'journal-books',
  'daily-restriction',
  'general-voucher',
  'receipt-voucher',
  'payment-voucher',
  'ledger-search',
])

const JOURNAL_ENTRY_TABS = NEW_ENTRY_TABS

const TABS = [
  { id: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة', icon: Landmark },
  { id: 'chart-of-accounts', labelEn: 'Chart of Accounts', labelAr: 'دليل الحسابات', icon: BookOpen },
  { id: 'journal-books', labelEn: 'Journal Books', labelAr: 'دفاتر القيود', icon: FileSpreadsheet },
  { id: 'defaults', labelEn: 'Default Accounts', labelAr: 'الحسابات الافتراضية', icon: Landmark },
  { id: 'taxes', labelEn: 'Taxes', labelAr: 'الضريبة', icon: Scale },
  { id: 'tax-report', labelEn: 'Tax report', labelAr: 'تقرير الضريبة', icon: Scale },
  { id: 'analytic-accounts', labelEn: 'Analytic accounts', labelAr: 'الحسابات التحليلية', icon: Users },
  { id: 'analytic-report', labelEn: 'Analytic report', labelAr: 'تقرير تحليلي', icon: TrendingUp },
  { id: 'period-close', labelEn: 'Period close', labelAr: 'إقفال الفترة', icon: Scale },
  { id: 'lock-dates', labelEn: 'Lock Dates', labelAr: 'تواريخ الإقفال', icon: Scale },
  { id: 'opening-balances', labelEn: 'Opening balances', labelAr: 'أرصدة افتتاحية', icon: Landmark },
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
  { id: 'credit-notes', labelEn: 'Credit Notes', labelAr: 'إشعارات الدائن', icon: FileText },
  { id: 'customer-payments', labelEn: 'Customer Payments', labelAr: 'مدفوعات العملاء', icon: Wallet },
  { id: 'customers', labelEn: 'Customers', labelAr: 'العملاء', icon: Users },
  { id: 'products', labelEn: 'Products', labelAr: 'المنتجات', icon: FileText },
  { id: 'vendor-bills', labelEn: 'Vendor Bills', labelAr: 'فواتير الموردين', icon: FileText },
  { id: 'vendor-refunds', labelEn: 'Vendor Refunds', labelAr: 'مرتجعات الموردين', icon: FileText },
  { id: 'vendor-payments', labelEn: 'Vendor Payments', labelAr: 'مدفوعات الموردين', icon: Wallet },
  { id: 'aged-ap', labelEn: 'Aged payables', labelAr: 'أعمار الدائنين', icon: Truck },
  { id: 'follow-up-reports', labelEn: 'Follow-up Reports', labelAr: 'تقارير المتابعة', icon: Users },
  { id: 'journal-items', labelEn: 'Journal Items', labelAr: 'بنود القيود', icon: FileSpreadsheet },
  { id: 'executive-summary', labelEn: 'Executive Summary', labelAr: 'الملخص التنفيذي', icon: TrendingUp },
  { id: 'fiscal-positions', labelEn: 'Fiscal Positions', labelAr: 'المراكز الضريبية', icon: Scale },
  { id: 'invoice-analysis', labelEn: 'Invoice Analysis', labelAr: 'تحليل الفواتير', icon: TrendingUp },
  { id: 'payment-terms', labelEn: 'Payment Terms', labelAr: 'شروط الدفع', icon: FileText },
  { id: 'incoterms', labelEn: 'Incoterms', labelAr: 'شروط التجارة الدولية', icon: FileText },
  { id: 'bank-accounts', labelEn: 'Bank Accounts', labelAr: 'الحسابات البنكية', icon: Landmark },
  { id: 'journal-report', labelEn: 'Journal Report', labelAr: 'تقرير القيود', icon: FileSpreadsheet },
  { id: 'currencies', labelEn: 'Currencies', labelAr: 'العملات', icon: Landmark },
  { id: 'follow-up-levels', labelEn: 'Follow-up Levels', labelAr: 'مستويات المتابعة', icon: Users },
  { id: 'analytic-items', labelEn: 'Analytic Items', labelAr: 'البنود التحليلية', icon: FileSpreadsheet },
  { id: 'assets', labelEn: 'Assets', labelAr: 'الأصول', icon: Landmark },
  { id: 'depreciation-schedule', labelEn: 'Depreciation Schedule', labelAr: 'جدول الإهلاك', icon: Scale },
  { id: 'deferred-revenues', labelEn: 'Deferred Revenues', labelAr: 'إيرادات مؤجلة', icon: Wallet },
  { id: 'deferred-expenses', labelEn: 'Deferred Expenses', labelAr: 'مصروفات مؤجلة', icon: Wallet },
  { id: 'asset-models', labelEn: 'Asset Models', labelAr: 'نماذج الأصول', icon: Landmark },
  { id: 'analytic-plans', labelEn: 'Analytic Plans', labelAr: 'الخطط التحليلية', icon: Users },
  { id: 'account-tags', labelEn: 'Account Tags', labelAr: 'وسوم الحسابات', icon: FileText },
  { id: 'account-groups', labelEn: 'Account Groups', labelAr: 'مجموعات الحسابات', icon: BookOpen },
  { id: 'horizontal-groups', labelEn: 'Horizontal Groups', labelAr: 'مجموعات أفقية', icon: BookOpen },
  { id: 'tax-groups', labelEn: 'Tax Groups', labelAr: 'مجموعات الضريبة', icon: Scale },
  { id: 'tax-units', labelEn: 'Tax Units', labelAr: 'وحدات الضريبة', icon: Scale },
  { id: 'analytic-distribution-models', labelEn: 'Analytic Distribution Models', labelAr: 'نماذج التوزيع التحليلي', icon: Users },
  { id: 'product-categories', labelEn: 'Product Categories', labelAr: 'فئات المنتجات', icon: FileText },
  { id: 'accounting-reports-config', labelEn: 'Accounting Reports', labelAr: 'تقارير المحاسبة', icon: TrendingUp },
  { id: 'journal-groups', labelEn: 'Journal Groups', labelAr: 'مجموعات الدفاتر', icon: FileSpreadsheet },
  { id: 'reconciliation-models', labelEn: 'Reconciliation Models', labelAr: 'نماذج التسوية', icon: Wallet },
  { id: 'online-sync', labelEn: 'Online Synchronization', labelAr: 'مزامنة عبر الإنترنت', icon: RefreshCw },
  { id: 'payment-providers', labelEn: 'Payment Providers', labelAr: 'بوابات الدفع', icon: Wallet },
  { id: 'automatic-transfers', labelEn: 'Automatic Transfers', labelAr: 'تحويلات تلقائية', icon: ArrowUpRight },
  { id: 'deferred-revenue-models', labelEn: 'Deferred Revenue Models', labelAr: 'نماذج الإيرادات المؤجلة', icon: Wallet },
  { id: 'deferred-expense-models', labelEn: 'Deferred Expense Models', labelAr: 'نماذج المصروفات المؤجلة', icon: Wallet },
  { id: 'general-ledger', labelEn: 'General Ledger', labelAr: 'دفتر الأستاذ العام', icon: BookOpen },
  { id: 'partner-ledger', labelEn: 'Partner Ledger', labelAr: 'دفتر الشريك', icon: Users },
  { id: 'customer-account', labelEn: 'Customer Account', labelAr: 'كشف حساب العميل', icon: Users },
  { id: 'customer-summary', labelEn: 'Customer Summary', labelAr: 'ملخص العملاء', icon: Users },
  { id: 'supplier-account', labelEn: 'Supplier Account', labelAr: 'كشف حساب المورد', icon: Truck },
  { id: 'supplier-summary', labelEn: 'Supplier Summary', labelAr: 'ملخص الموردين', icon: Truck },
  { id: 'ledger-search', labelEn: 'Search', labelAr: 'بحث', icon: FileSpreadsheet },
  { id: 'trial', labelEn: 'Trial Balance', labelAr: 'ميزان المراجعة', icon: Scale },
  { id: 'pnl', labelEn: 'Profit & Loss', labelAr: 'الأرباح والخسائر', icon: TrendingUp },
  ...ACCOUNTING_COMING_SOON_SECTIONS.map((item) => ({
    ...item,
    icon: FileSpreadsheet,
    comingSoon: true,
  })),
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

const PANEL_EXPORT_TABS = new Set([
  'trial',
  'pnl',
  'balance-sheet',
  'general-ledger',
  'account-report',
  'cash-flow',
  'executive-summary',
  'tax-report',
  'invoice-analysis',
  'journal-report',
  'aged-ar',
  'aged-ap',
  'follow-up-reports',
  'analytic-report',
  'partner-ledger',
  'assets',
  'depreciation-schedule',
])

const fontPage = { fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" }
const fontDisplay = { fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }

export default function Accounting() {
  const { language } = useSelector((s) => s.ui)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { section } = useParams()
  const tab = TABS.some((item) => item.id === section) ? section : 'overview'
  const activeTab = TABS.find((item) => item.id === tab) || TABS[0]
  const [showJournalForm, setShowJournalForm] = useState(false)
  const [journalForm, setJournalForm] = useState({
    memo: '',
    entryDate: new Date().toISOString().slice(0, 10),
    journalId: '',
    type: 'manual',
    lines: [emptyLine(), emptyLine()],
  })
  const isAr = language === 'ar'
  const showNewEntry = NEW_ENTRY_TABS.has(tab) && !HIDE_JOURNAL_CTA_TABS.has(tab)

  useRegisterAccountingPageActions(
    (tab === 'receipt-voucher' || tab === 'payment-voucher')
      ? null
      : (
      <div className="flex flex-wrap items-center gap-2">
        {tab === 'credit-notes' ? (
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/accounting/invoices/new/sell?invoiceType=381')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'إشعار دائن جديد' : 'New credit note'}
          </button>
        ) : null}
        {tab === 'follow-up-reports' ? (
          <button
            type="button"
            onClick={() => document.getElementById('follow-up-remind-actions')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            {isAr ? 'إرسال تذكيرات المتأخرين' : 'Send overdue reminders'}
          </button>
        ) : null}
        {tab === 'journal-books' ? (
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/accounting/journal-books/new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'دفتر جديد' : 'New book'}
          </button>
        ) : null}
        {tab === 'general-voucher' ? (
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/accounting/general-voucher/new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'سند قيد جديد' : 'New voucher'}
          </button>
        ) : null}
        {showNewEntry ? (
          <button
            type="button"
            onClick={() => setShowJournalForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'قيد جديد' : 'New entry'}
          </button>
        ) : null}
      </div>
      ),
    [tab, isAr, navigate],
  )

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

  const createJournalMutation = useMutation({
    mutationFn: async (payload) => {
      const { postAfter, ...body } = payload
      const created = await api.post('/accounting/journals', body).then((r) => r.data)
      if (postAfter && created?._id) {
        try {
          await api.post(`/accounting/journals/${created._id}/post`)
        } catch {
          await api.post(`/accounting/journals/${created._id}/post-simple`)
        }
      }
      return { created, postAfter }
    },
    onSuccess: (result) => {
      toast.success(result?.postAfter ? (isAr ? 'تم الحفظ والترحيل' : 'Saved & posted') : (isAr ? 'تم إنشاء القيد' : 'Journal created'))
      setShowJournalForm(false)
      setJournalForm({ memo: '', entryDate: new Date().toISOString().slice(0, 10), journalId: '', type: 'manual', lines: [emptyLine(), emptyLine()] })
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
      type: journalForm.type === 'opening' ? 'opening' : 'manual',
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
      const data = await api.get('/accounting/reports/trial-balance').then((r) => r.data)
      return data?.rows || []
    }
    if (tab === 'pnl') {
      const data = await api.get('/accounting/reports/profit-and-loss').then((r) => r.data)
      return [
        ...(data?.revenue || []).map((row) => ({ section: isAr ? 'إيرادات' : 'Revenue', name: isAr ? (row.nameAr || row.name) : row.name, amount: row.amount })),
        ...(data?.expenses || []).map((row) => ({ section: isAr ? 'مصروفات' : 'Expenses', name: isAr ? (row.nameAr || row.name) : row.name, amount: row.amount })),
        { section: isAr ? 'صافي الدخل' : 'Net income', name: '', amount: data?.netIncome || 0 },
      ]
    }
    if (tab === 'balance-sheet') {
      const data = await api.get('/accounting/reports/balance-sheet').then((r) => r.data)
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
          {!PANEL_EXPORT_TABS.has(tab) ? (
            <ExportMenu
              language={language}
              rows={[]}
              getRows={getExportRows}
              columns={exportColumns}
              fileBaseName={`maqder-accounting-${tab}`}
              title={isAr ? activeTab.labelAr : activeTab.labelEn}
            />
          ) : null}
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

          {tab === 'tax-report' && (
            <motion.div key="tax-report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <VatTaxReportPanel language={language} />
            </motion.div>
          )}

          {tab === 'opening-balances' && (
            <motion.div key="opening-balances" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <OpeningBalancesPanel
                language={language}
                onNewOpening={() => {
                  setJournalForm({
                    memo: isAr ? 'أرصدة افتتاحية' : 'Opening balances',
                    entryDate: new Date().toISOString().slice(0, 10),
                    journalId: '',
                    type: 'opening',
                    lines: [emptyLine(), emptyLine()],
                  })
                  setShowJournalForm(true)
                }}
              />
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

          {tab === 'lock-dates' && (
            <motion.div key="lock-dates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountingLockDatesPanel language={language} />
            </motion.div>
          )}

          {activeTab?.comingSoon && (
            <motion.div key={`soon-${tab}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountingComingSoonPanel
                language={language}
                titleEn={activeTab.labelEn}
                titleAr={activeTab.labelAr}
              />
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

          {tab === 'credit-notes' && (
            <motion.div key="credit-notes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CreditNotesPanel language={language} />
            </motion.div>
          )}

          {tab === 'customer-payments' && (
            <motion.div key="customer-payments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CustomerPaymentsPanel language={language} />
            </motion.div>
          )}

          {tab === 'customers' && (
            <motion.div key="customers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountingCustomersPanel language={language} />
            </motion.div>
          )}

          {tab === 'products' && (
            <motion.div key="products" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountingProductsPanel language={language} />
            </motion.div>
          )}

          {tab === 'vendor-bills' && (
            <motion.div key="vendor-bills" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <VendorBillsPanel language={language} />
            </motion.div>
          )}

          {tab === 'vendor-refunds' && (
            <motion.div key="vendor-refunds" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <VendorRefundsPanel language={language} />
            </motion.div>
          )}

          {tab === 'vendor-payments' && (
            <motion.div key="vendor-payments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <VendorPaymentsPanel language={language} />
            </motion.div>
          )}

          {tab === 'aged-ap' && (
            <motion.div key="aged-ap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AgedPayablesPanel language={language} />
            </motion.div>
          )}

          {tab === 'follow-up-reports' && (
            <motion.div key="follow-up-reports" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FollowUpReportsPanel language={language} />
            </motion.div>
          )}

          {tab === 'general-ledger' && (
            <motion.div key="general-ledger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountReportPanel language={language} />
            </motion.div>
          )}

          {tab === 'partner-ledger' && (
            <motion.div key="partner-ledger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <PartnerLedgerPanel language={language} />
            </motion.div>
          )}

          {tab === 'journal-items' && (
            <motion.div key="journal-items" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <JournalItemsPanel language={language} />
            </motion.div>
          )}

          {tab === 'executive-summary' && (
            <motion.div key="executive-summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ExecutiveSummaryPanel language={language} />
            </motion.div>
          )}

          {tab === 'fiscal-positions' && (
            <motion.div key="fiscal-positions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FiscalPositionsPanel language={language} />
            </motion.div>
          )}

          {tab === 'invoice-analysis' && (
            <motion.div key="invoice-analysis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <InvoiceAnalysisPanel language={language} />
            </motion.div>
          )}

          {tab === 'payment-terms' && (
            <motion.div key="payment-terms" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <PaymentTermsPanel language={language} />
            </motion.div>
          )}

          {tab === 'incoterms' && (
            <motion.div key="incoterms" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <IncotermsPanel language={language} />
            </motion.div>
          )}

          {tab === 'bank-accounts' && (
            <motion.div key="bank-accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <BankAccountsPanel language={language} />
            </motion.div>
          )}

          {tab === 'journal-report' && (
            <motion.div key="journal-report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <JournalAuditReportPanel language={language} />
            </motion.div>
          )}

          {tab === 'currencies' && (
            <motion.div key="currencies" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CurrenciesPanel language={language} />
            </motion.div>
          )}

          {tab === 'follow-up-levels' && (
            <motion.div key="follow-up-levels" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FollowUpLevelsPanel language={language} />
            </motion.div>
          )}

          {tab === 'analytic-items' && (
            <motion.div key="analytic-items" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AnalyticItemsPanel language={language} />
            </motion.div>
          )}

          {tab === 'assets' && (
            <motion.div key="assets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FixedAssetsPanel language={language} />
            </motion.div>
          )}

          {tab === 'depreciation-schedule' && (
            <motion.div key="depreciation-schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <DepreciationSchedulePanel language={language} />
            </motion.div>
          )}

          {tab === 'deferred-revenues' && (
            <motion.div key="deferred-revenues" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <DeferredAccountsPanel language={language} kind="revenue" />
            </motion.div>
          )}

          {tab === 'deferred-expenses' && (
            <motion.div key="deferred-expenses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <DeferredAccountsPanel language={language} kind="expense" />
            </motion.div>
          )}

          {tab === 'asset-models' && (
            <motion.div key="asset-models" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AssetModelsPanel language={language} />
            </motion.div>
          )}

          {tab === 'analytic-plans' && (
            <motion.div key="analytic-plans" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AnalyticPlansPanel language={language} />
            </motion.div>
          )}

          {tab === 'account-tags' && (
            <motion.div key="account-tags" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountTagsPanel language={language} />
            </motion.div>
          )}

          {tab === 'account-groups' && (
            <motion.div key="account-groups" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountGroupsPanel language={language} />
            </motion.div>
          )}

          {tab === 'tax-groups' && (
            <motion.div key="tax-groups" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <TaxGroupsPanel language={language} />
            </motion.div>
          )}

          {tab === 'product-categories' && (
            <motion.div key="product-categories" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ProductCategoriesBridgePanel language={language} />
            </motion.div>
          )}

          {tab === 'accounting-reports-config' && (
            <motion.div key="accounting-reports-config" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AccountingReportsConfigPanel language={language} />
            </motion.div>
          )}

          {tab === 'horizontal-groups' && (
            <motion.div key="horizontal-groups" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <HorizontalGroupsPanel language={language} />
            </motion.div>
          )}

          {tab === 'tax-units' && (
            <motion.div key="tax-units" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <TaxUnitsPanel language={language} />
            </motion.div>
          )}

          {tab === 'analytic-distribution-models' && (
            <motion.div key="analytic-distribution-models" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AnalyticDistributionModelsPanel language={language} />
            </motion.div>
          )}

          {tab === 'journal-groups' && (
            <motion.div key="journal-groups" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <JournalGroupsPanel language={language} />
            </motion.div>
          )}

          {tab === 'reconciliation-models' && (
            <motion.div key="reconciliation-models" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ReconciliationModelsPanel language={language} />
            </motion.div>
          )}

          {tab === 'online-sync' && (
            <motion.div key="online-sync" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <OnlineSyncPanel language={language} />
            </motion.div>
          )}

          {tab === 'payment-providers' && (
            <motion.div key="payment-providers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <PaymentProvidersPanel language={language} />
            </motion.div>
          )}

          {tab === 'automatic-transfers' && (
            <motion.div key="automatic-transfers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AutomaticTransfersPanel language={language} />
            </motion.div>
          )}

          {tab === 'deferred-revenue-models' && (
            <motion.div key="deferred-revenue-models" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <DeferredModelsPanel language={language} kind="revenue" />
            </motion.div>
          )}

          {tab === 'deferred-expense-models' && (
            <motion.div key="deferred-expense-models" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <DeferredModelsPanel language={language} kind="expense" />
            </motion.div>
          )}

          {tab === 'bank-recon' && (
            <motion.div key="bank-recon" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <BankReconPanel language={language} />
            </motion.div>
          )}

          {tab === 'chart-of-accounts' && (
            <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ChartOfAccountsPanel language={language} />
            </motion.div>
          )}

          {tab === 'daily-restriction' && (
            <motion.div key="daily-restriction" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <DailyRestrictionPanel
                language={language}
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

          {tab === 'trial' && (
            <motion.div key="trial" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <TrialBalancePanel language={language} />
            </motion.div>
          )}

          {tab === 'pnl' && (
            <motion.div key="pnl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ProfitAndLossPanel language={language} />
            </motion.div>
          )}

          {tab === 'balance-sheet' && (
            <motion.div key="balance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <BalanceSheetPanel language={language} />
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
                  <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white" style={fontDisplay}>
                    {journalForm.type === 'opening'
                      ? (isAr ? 'قيد أرصدة افتتاحية' : 'Opening balance entry')
                      : (isAr ? 'قيد يومية جديد' : 'New journal entry')}
                  </h3>
                </div>
                <button type="button" onClick={() => setShowJournalForm(false)} className="rounded-xl px-2 text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{isAr ? 'التاريخ المحاسبي' : 'Accounting date'}</label>
                  <input type="date" value={journalForm.entryDate} onChange={(e) => setJournalForm((f) => ({ ...f, entryDate: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
                  <p className="mt-1 text-[10px] text-slate-400">{isAr ? 'يخضع لتواريخ الإقفال' : 'Subject to lock dates'}</p>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{isAr ? 'النوع' : 'Type'}</label>
                  <select
                    value={journalForm.type || 'manual'}
                    onChange={(e) => setJournalForm((f) => ({ ...f, type: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900"
                  >
                    <option value="manual">{isAr ? 'يدوي' : 'Manual'}</option>
                    <option value="opening">{isAr ? 'افتتاحي' : 'Opening'}</option>
                  </select>
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
                  {journalTotals.balanced
                    ? (isAr ? 'متوازن · ' : 'Balanced · ')
                    : (isAr ? 'غير متوازن — لا يمكن الترحيل · ' : 'Unbalanced — cannot post · ')}
                  Dr <Money value={journalTotals.debit} /> · Cr <Money value={journalTotals.credit} />
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setShowJournalForm(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button
                  type="button"
                  disabled={!journalTotals.balanced || createJournalMutation.isPending}
                  onClick={submitJournal}
                  className="rounded-2xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 disabled:opacity-40"
                >
                  {isAr ? 'حفظ المسودة' : 'Save draft'}
                </button>
                <button
                  type="button"
                  disabled={!journalTotals.balanced || createJournalMutation.isPending}
                  onClick={() => {
                    createJournalMutation.mutate({
                      memo: journalForm.memo,
                      entryDate: journalForm.entryDate,
                      type: journalForm.type === 'opening' ? 'opening' : 'manual',
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
                      postAfter: true,
                    })
                  }}
                  className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {isAr ? 'حفظ وترحيل' : 'Save & Post'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

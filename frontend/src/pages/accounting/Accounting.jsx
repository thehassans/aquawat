import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Plus, RefreshCw, Scale, TrendingUp, Landmark,
  FileSpreadsheet, CheckCircle2, XCircle, ArrowUpRight, Receipt, Wallet, Users, Truck
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import Vouchers from '../finance/Vouchers'
import {
  AccountReportPanel,
  CustomerAccountPanel,
  CustomerSummaryPanel,
  DailyRestrictionPanel,
  GeneralVoucherPanel,
  SupplierSummaryPanel,
} from './AccountingModules'

const TABS = [
  { id: 'overview', labelEn: 'Accounting', labelAr: 'المحاسبة', icon: Landmark },
  { id: 'chart-of-accounts', labelEn: 'Chart of Accounts', labelAr: 'دليل الحسابات', icon: BookOpen },
  { id: 'daily-restriction', labelEn: 'Daily Restriction', labelAr: 'القيود اليومية', icon: FileSpreadsheet },
  { id: 'general-voucher', labelEn: 'General Voucher', labelAr: 'سند قيد عام', icon: FileSpreadsheet },
  { id: 'receipt-voucher', labelEn: 'Receipt Voucher', labelAr: 'سند قبض', icon: Receipt },
  { id: 'payment-voucher', labelEn: 'Payment Voucher', labelAr: 'سند صرف', icon: Wallet },
  { id: 'account-report', labelEn: 'Account of Report', labelAr: 'تقرير الحساب', icon: BookOpen },
  { id: 'balance-sheet', labelEn: 'Account Balance Sheet', labelAr: 'الميزانية العمومية', icon: Scale },
  { id: 'customer-account', labelEn: 'Customer Account Report', labelAr: 'كشف حساب العميل', icon: Users },
  { id: 'customer-summary', labelEn: 'Customer Summary Report', labelAr: 'ملخص العملاء', icon: Users },
  { id: 'supplier-summary', labelEn: 'Supplier Summary Report', labelAr: 'ملخص الموردين', icon: Truck },
  { id: 'trial', labelEn: 'Trial Balance', labelAr: 'ميزان المراجعة', icon: Scale },
  { id: 'pnl', labelEn: 'Profit & Loss', labelAr: 'الأرباح والخسائر', icon: TrendingUp },
]

const emptyLine = () => ({ accountId: '', debit: '', credit: '', description: '' })

export default function Accounting() {
  const { language } = useSelector((s) => s.ui)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { section } = useParams()
  const tab = TABS.some((item) => item.id === section) ? section : 'overview'
  const setTab = (id) => navigate(id === 'overview' ? '/app/dashboard/accounting' : `/app/dashboard/accounting/${id}`)
  const [showJournalForm, setShowJournalForm] = useState(false)
  const [journalForm, setJournalForm] = useState({
    memo: '',
    entryDate: new Date().toISOString().slice(0, 10),
    lines: [emptyLine(), emptyLine()],
  })

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: () => api.get('/accounting/dashboard').then((r) => r.data),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data),
    enabled: ['chart-of-accounts', 'daily-restriction', 'general-voucher', 'overview'].includes(tab) || showJournalForm,
  })

  const { data: journalsData, refetch: refetchJournals } = useQuery({
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

  const seedMutation = useMutation({
    mutationFn: () => api.post('/accounting/accounts/seed'),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تجهيز دليل الحسابات' : 'Chart of accounts ready')
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const createJournalMutation = useMutation({
    mutationFn: (payload) => api.post('/accounting/journals', payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إنشاء القيد' : 'Journal created')
      setShowJournalForm(false)
      setJournalForm({ memo: '', entryDate: new Date().toISOString().slice(0, 10), lines: [emptyLine(), emptyLine()] })
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
      toast.success(language === 'ar' ? 'تم ترحيل القيد' : 'Journal posted')
      refetchJournals()
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-daily'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-general-vouchers'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to post'),
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
      lines: journalForm.lines
        .filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
        .map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || '',
        })),
    })
  }

  const kpis = [
    { labelEn: 'Cash & Bank', labelAr: 'النقد والبنك', value: dashboard?.cashBalance, icon: Landmark },
    { labelEn: 'Receivables', labelAr: 'الذمم المدينة', value: dashboard?.arBalance, icon: ArrowUpRight },
    { labelEn: 'Payables', labelAr: 'الذمم الدائنة', value: dashboard?.apBalance, icon: ArrowUpRight },
    { labelEn: 'Net Income', labelAr: 'صافي الدخل', value: dashboard?.netIncome, icon: TrendingUp },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16 animate-fade-in">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[#0b1220] px-6 py-8 text-white shadow-[0_40px_80px_-48px_rgba(15,23,42,0.65)] sm:px-10 dark:border-white/10">
        <div className="pointer-events-none absolute -top-24 end-10 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
              {language === 'ar' ? 'المحاسبة' : 'Accounting'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {language === 'ar' ? 'دفتر الأستاذ العام' : 'General Ledger'}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/55">
              {language === 'ar'
                ? 'دليل حسابات مزدوج القيد، قيود يومية، ميزان مراجعة، وقوائم مالية متكاملة مع الفواتير والمصروفات.'
                : 'Double-entry chart of accounts, journals, trial balance, and statements — integrated with invoices, expenses, and vouchers.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium backdrop-blur hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
              {language === 'ar' ? 'تجهيز الدليل' : 'Seed COA'}
            </button>
            <button
              type="button"
              onClick={() => setShowJournalForm(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
            >
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'قيد جديد' : 'New journal'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition sm:text-sm ${
                active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {language === 'ar' ? item.labelAr : item.labelEn}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((k) => {
                const Icon = k.icon
                return (
                  <div key={k.labelEn} className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {language === 'ar' ? k.labelAr : k.labelEn}
                      </p>
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {dashLoading ? '—' : <Money value={k.value || 0} />}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{language === 'ar' ? 'أحدث القيود' : 'Recent journals'}</h3>
                  <button type="button" onClick={() => refetchDash()} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-dark-600">
                  {(dashboard?.recent || []).length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-400">{language === 'ar' ? 'لا قيود بعد' : 'No journals yet'}</p>
                  )}
                  {(dashboard?.recent || []).map((j) => (
                    <div key={j._id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{j.entryNumber}</p>
                        <p className="text-xs text-slate-500">{j.memo || j.type}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-semibold"><Money value={j.totalDebit} /></p>
                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${j.status === 'posted' ? 'text-emerald-600' : j.status === 'void' ? 'text-rose-500' : 'text-amber-600'}`}>{j.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                <h3 className="font-semibold text-slate-900 dark:text-white">{language === 'ar' ? 'حالة الدفتر' : 'Ledger health'}</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">{language === 'ar' ? 'الحسابات' : 'Accounts'}</span><span className="font-semibold">{dashboard?.accountCount || 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{language === 'ar' ? 'مسودات' : 'Drafts'}</span><span className="font-semibold">{dashboard?.draftCount || 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{language === 'ar' ? 'مرحّلة' : 'Posted'}</span><span className="font-semibold">{dashboard?.postedCount || 0}</span></div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-dark-600">
                    <span className="text-slate-500">{language === 'ar' ? 'ميزان متوازن' : 'Trial balanced'}</span>
                    {dashboard?.trialBalanced ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'chart-of-accounts' && (
          <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900">
                  <tr>
                    <th className="px-4 py-3">{language === 'ar' ? 'الرمز' : 'Code'}</th>
                    <th className="px-4 py-3">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th className="px-4 py-3">{language === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="px-4 py-3 text-end">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
                  {accounts.map((a) => (
                    <tr key={a._id} className="hover:bg-slate-50/70 dark:hover:bg-dark-700/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{a.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{language === 'ar' ? (a.nameAr || a.name) : a.name}</p>
                        {a.nameAr && language !== 'ar' ? <p className="text-xs text-slate-400" dir="rtl">{a.nameAr}</p> : null}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-500">{a.type}</td>
                      <td className="px-4 py-3 text-end font-semibold"><Money value={a.balance || 0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {tab === 'daily-restriction' && (
          <motion.div key="daily-restriction" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <DailyRestrictionPanel language={language} onNew={() => setShowJournalForm(true)} onPost={(id) => postJournalMutation.mutate(id)} posting={postJournalMutation.isPending} />
          </motion.div>
        )}

        {tab === 'general-voucher' && (
          <motion.div key="general-voucher" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <GeneralVoucherPanel language={language} onNew={() => setShowJournalForm(true)} onPost={(id) => postJournalMutation.mutate(id)} posting={postJournalMutation.isPending} />
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

        {tab === 'supplier-summary' && (
          <motion.div key="supplier-summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <SupplierSummaryPanel language={language} />
          </motion.div>
        )}

        {tab === 'legacy-journals' && (
          <motion.div key="journals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {(journalsData?.rows || []).map((j) => (
              <div key={j._id} className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{j.entryNumber}</p>
                    <p className="text-sm text-slate-500">{j.memo || '—'}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(j.entryDate).toLocaleDateString()} · {j.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      j.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : j.status === 'void' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                    }`}>{j.status}</span>
                    {j.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => postJournalMutation.mutate(j._id)}
                        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
                      >
                        {language === 'ar' ? 'ترحيل' : 'Post'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="py-1 text-start">{language === 'ar' ? 'الحساب' : 'Account'}</th>
                        <th className="py-1 text-end">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                        <th className="py-1 text-end">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(j.lines || []).map((line, idx) => (
                        <tr key={idx} className="border-t border-slate-50 dark:border-dark-700">
                          <td className="py-2">{line.accountCode} · {line.accountName}</td>
                          <td className="py-2 text-end"><Money value={line.debit || 0} /></td>
                          <td className="py-2 text-end"><Money value={line.credit || 0} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {(journalsData?.rows || []).length === 0 && (
              <p className="py-12 text-center text-sm text-slate-400">{language === 'ar' ? 'لا توجد قيود' : 'No journal entries yet'}</p>
            )}
          </motion.div>
        )}

        {tab === 'trial' && trial && (
          <motion.div key="trial" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-dark-600">
              <h3 className="font-semibold">{language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance'}</h3>
              <span className={`text-xs font-semibold ${trial.balanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trial.balanced ? (language === 'ar' ? 'متوازن' : 'Balanced') : (language === 'ar' ? 'غير متوازن' : 'Out of balance')}
              </span>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="px-4 py-3 text-start">Code</th>
                  <th className="px-4 py-3 text-start">Account</th>
                  <th className="px-4 py-3 text-end">Debit</th>
                  <th className="px-4 py-3 text-end">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
                {trial.rows.map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-2.5">{language === 'ar' ? (r.nameAr || r.name) : r.name}</td>
                    <td className="px-4 py-2.5 text-end"><Money value={r.debit} /></td>
                    <td className="px-4 py-2.5 text-end"><Money value={r.credit} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 font-semibold dark:border-dark-500">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>{language === 'ar' ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-4 py-3 text-end"><Money value={trial.totalDebit} /></td>
                  <td className="px-4 py-3 text-end"><Money value={trial.totalCredit} /></td>
                </tr>
              </tfoot>
            </table>
          </motion.div>
        )}

        {tab === 'pnl' && pnl && (
          <motion.div key="pnl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
              <h3 className="font-semibold text-emerald-700">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</h3>
              <div className="mt-4 space-y-2">
                {pnl.revenue.map((a) => (
                  <div key={a._id} className="flex justify-between text-sm">
                    <span>{language === 'ar' ? (a.nameAr || a.name) : a.name}</span>
                    <span className="font-semibold"><Money value={a.amount} /></span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-dark-600">
                  <span>{language === 'ar' ? 'إجمالي الإيرادات' : 'Total revenue'}</span>
                  <Money value={pnl.totalRevenue} />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
              <h3 className="font-semibold text-rose-700">{language === 'ar' ? 'المصروفات' : 'Expenses'}</h3>
              <div className="mt-4 space-y-2">
                {pnl.expenses.map((a) => (
                  <div key={a._id} className="flex justify-between text-sm">
                    <span>{language === 'ar' ? (a.nameAr || a.name) : a.name}</span>
                    <span className="font-semibold"><Money value={a.amount} /></span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-dark-600">
                  <span>{language === 'ar' ? 'إجمالي المصروفات' : 'Total expenses'}</span>
                  <Money value={pnl.totalExpenses} />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-5 text-white lg:col-span-2 dark:bg-white dark:text-slate-950">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-white/50 dark:text-slate-400">
                  {language === 'ar' ? 'صافي الدخل' : 'Net income'}
                </span>
                <span className="text-2xl font-semibold"><Money value={pnl.netIncome} /></span>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'balance-sheet' && balance && (
          <motion.div key="balance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { titleEn: 'Assets', titleAr: 'الأصول', rows: balance.assets, total: balance.totalAssets },
              { titleEn: 'Liabilities', titleAr: 'الالتزامات', rows: balance.liabilities, total: balance.totalLiabilities },
              { titleEn: 'Equity', titleAr: 'حقوق الملكية', rows: balance.equity, total: balance.totalEquity },
            ].map((col) => (
              <div key={col.titleEn} className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
                <h3 className="font-semibold text-slate-900 dark:text-white">{language === 'ar' ? col.titleAr : col.titleEn}</h3>
                <div className="mt-4 space-y-2 text-sm">
                  {col.rows.map((r) => (
                    <div key={r.code} className="flex justify-between gap-3">
                      <span className="text-slate-600 dark:text-slate-300">{language === 'ar' ? (r.nameAr || r.name) : r.name}</span>
                      <span className="font-semibold"><Money value={r.balance} /></span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-dark-600">
                    <span>{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-dark-800"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{language === 'ar' ? 'قيد يومية جديد' : 'New journal entry'}</h3>
                <button type="button" onClick={() => setShowJournalForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'التاريخ' : 'Date'}</label>
                  <input type="date" value={journalForm.entryDate} onChange={(e) => setJournalForm((f) => ({ ...f, entryDate: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{language === 'ar' ? 'البيان' : 'Memo'}</label>
                  <input value={journalForm.memo} onChange={(e) => setJournalForm((f) => ({ ...f, memo: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {journalForm.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-12 dark:bg-dark-900">
                    <select
                      className="md:col-span-5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800"
                      value={line.accountId}
                      onChange={(e) => {
                        const next = [...journalForm.lines]
                        next[idx] = { ...next[idx], accountId: e.target.value }
                        setJournalForm((f) => ({ ...f, lines: next }))
                      }}
                    >
                      <option value="">{language === 'ar' ? 'اختر حساب' : 'Select account'}</option>
                      {accounts.filter((a) => a.isPostable !== false).map((a) => (
                        <option key={a._id} value={a._id}>{a.code} — {language === 'ar' ? (a.nameAr || a.name) : a.name}</option>
                      ))}
                    </select>
                    <input type="number" min="0" step="0.01" placeholder="Debit" value={line.debit} onChange={(e) => {
                      const next = [...journalForm.lines]
                      next[idx] = { ...next[idx], debit: e.target.value, credit: e.target.value ? '' : next[idx].credit }
                      setJournalForm((f) => ({ ...f, lines: next }))
                    }} className="md:col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800" />
                    <input type="number" min="0" step="0.01" placeholder="Credit" value={line.credit} onChange={(e) => {
                      const next = [...journalForm.lines]
                      next[idx] = { ...next[idx], credit: e.target.value, debit: e.target.value ? '' : next[idx].debit }
                      setJournalForm((f) => ({ ...f, lines: next }))
                    }} className="md:col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800" />
                    <input placeholder="Note" value={line.description} onChange={(e) => {
                      const next = [...journalForm.lines]
                      next[idx] = { ...next[idx], description: e.target.value }
                      setJournalForm((f) => ({ ...f, lines: next }))
                    }} className="md:col-span-3 rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-800" />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => setJournalForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))} className="text-xs font-semibold text-slate-600">
                  + {language === 'ar' ? 'سطر' : 'Add line'}
                </button>
                <p className={`text-xs font-semibold ${journalTotals.balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Dr <Money value={journalTotals.debit} /> · Cr <Money value={journalTotals.credit} />
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setShowJournalForm(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold">{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                <button
                  type="button"
                  disabled={!journalTotals.balanced || createJournalMutation.isPending}
                  onClick={submitJournal}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
                >
                  {language === 'ar' ? 'حفظ المسودة' : 'Save draft'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

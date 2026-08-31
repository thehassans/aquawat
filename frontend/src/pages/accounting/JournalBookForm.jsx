import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const JOURNAL_TYPES = ['sales', 'purchase', 'cash', 'bank', 'stock', 'miscellaneous']

export default function JournalBookForm() {
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const [draft, setDraft] = useState({
    code: '',
    name: '',
    nameAr: '',
    type: 'miscellaneous',
    sequencePrefix: '',
    defaultDebitAccountId: '',
    defaultCreditAccountId: '',
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data?.accounts || r.data || []),
  })
  const postable = (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false)
  const requiresDefaults = draft.type === 'cash' || draft.type === 'bank'
  const canSave =
    draft.code.trim() &&
    draft.name.trim() &&
    (!requiresDefaults || (draft.defaultDebitAccountId && draft.defaultCreditAccountId))

  const create = useMutation({
    mutationFn: () =>
      api
        .post('/accounting/journal-books', {
          ...draft,
          sequencePrefix: draft.sequencePrefix || draft.code,
          defaultDebitAccountId: draft.defaultDebitAccountId || null,
          defaultCreditAccountId: draft.defaultCreditAccountId || null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء الدفتر' : 'Journal book created')
      navigate('/app/dashboard/accounting/journal-books')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const field =
    'mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900'

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">
            {isAr ? 'التكوين' : 'Configuration'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'دفتر قيد جديد' : 'New journal book'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'النقد والبنك يتطلبان حساباً مديناً ودائناً افتراضياً.'
              : 'Cash and bank books require default debit and credit accounts.'}
          </p>
        </div>
        <Link
          to="/app/dashboard/accounting/journal-books"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-dark-600"
        >
          {isAr ? 'العودة للقائمة' : 'Back to list'}
        </Link>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800 sm:grid-cols-2">
        {[
          ['code', isAr ? 'الرمز' : 'Code', true],
          ['name', isAr ? 'الاسم' : 'Name', true],
          ['nameAr', isAr ? 'الاسم عربي' : 'Arabic name', false],
          ['sequencePrefix', isAr ? 'بادئة الترقيم' : 'Sequence prefix', false],
        ].map(([key, label, required]) => (
          <label key={key} className="text-xs font-medium text-slate-500">
            {label}
            {required ? ' *' : ''}
            <input
              value={draft[key]}
              onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
              className={field}
            />
          </label>
        ))}
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'النوع' : 'Type'} *
          <select
            value={draft.type}
            onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
            className={field}
          >
            {JOURNAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div />
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'حساب مدين افتراضي' : 'Default debit account'}
          {requiresDefaults ? ' *' : ''}
          <select
            value={draft.defaultDebitAccountId}
            onChange={(e) => setDraft((p) => ({ ...p, defaultDebitAccountId: e.target.value }))}
            className={field}
          >
            <option value="">—</option>
            {postable.map((a) => (
              <option key={a._id} value={a._id}>
                {a.code} — {isAr ? a.nameAr || a.name : a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'حساب دائن افتراضي' : 'Default credit account'}
          {requiresDefaults ? ' *' : ''}
          <select
            value={draft.defaultCreditAccountId}
            onChange={(e) => setDraft((p) => ({ ...p, defaultCreditAccountId: e.target.value }))}
            className={field}
          >
            <option value="">—</option>
            {postable.map((a) => (
              <option key={a._id} value={a._id}>
                {a.code} — {isAr ? a.nameAr || a.name : a.name}
              </option>
            ))}
          </select>
        </label>
        {requiresDefaults && (!draft.defaultDebitAccountId || !draft.defaultCreditAccountId) ? (
          <p className="sm:col-span-2 text-xs font-medium text-amber-700">
            {isAr
              ? 'دفاتر النقد والبنك تتطلب حساب مدين وحساب دائن افتراضيين.'
              : 'Cash and bank journals require both default debit and credit ledgers.'}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/accounting/journal-books')}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-dark-600"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <button
          type="button"
          disabled={!canSave || create.isPending}
          onClick={() => create.mutate()}
          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {create.isPending ? '…' : isAr ? 'إنشاء الدفتر' : 'Create book'}
        </button>
      </div>
    </div>
  )
}

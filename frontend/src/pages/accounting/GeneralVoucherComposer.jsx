import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

const emptyLine = () => ({ accountId: '', debit: '', credit: '', description: '', analyticAccountId: '' })

export default function GeneralVoucherComposer() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const [form, setForm] = useState({
    memo: '',
    entryDate: new Date().toISOString().slice(0, 10),
    journalId: '',
    type: 'manual',
    lines: [emptyLine(), emptyLine()],
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data?.accounts || r.data || []),
  })
  const { data: journalBooks = [] } = useQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books').then((r) => r.data || []),
  })
  const { data: analyticAccounts = [] } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
  })

  const totals = useMemo(() => {
    const debit = form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const credit = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.009 && debit > 0 }
  }, [form.lines])

  const create = useMutation({
    mutationFn: async ({ postAfter }) => {
      const payload = {
        memo: form.memo,
        entryDate: form.entryDate,
        type: form.type === 'opening' ? 'opening' : 'manual',
        status: 'draft',
        journalId: form.journalId || undefined,
        lines: form.lines
          .filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
          .map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || '',
            analyticAccountId: l.analyticAccountId || undefined,
          })),
      }
      const created = await api.post('/accounting/journals', payload).then((r) => r.data)
      if (postAfter && created?._id) {
        try {
          await api.post(`/accounting/journals/${created._id}/post`)
        } catch {
          await api.post(`/accounting/journals/${created._id}/post-simple`)
        }
      }
      return created
    },
    onSuccess: (_data, vars) => {
      toast.success(vars?.postAfter ? (isAr ? 'تم الحفظ والترحيل' : 'Saved & posted') : (isAr ? 'تم حفظ المسودة' : 'Draft saved'))
      queryClient.invalidateQueries({ queryKey: ['accounting-general-vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-journal-items'] })
      navigate('/app/dashboard/accounting/general-voucher')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const updateLine = (idx, patch) => {
    setForm((f) => {
      const lines = [...f.lines]
      lines[idx] = { ...lines[idx], ...patch }
      return { ...f, lines }
    })
  }

  const postable = (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false)

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">
            {isAr ? 'سند قيد عام' : 'General voucher'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'منشئ قيد محاسبي' : 'Journal document builder'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr ? 'قيد مزدوج القيد على account.move — يتطلب توازناً قبل الترحيل.' : 'Double-entry document on account.move — must balance before posting.'}
          </p>
        </div>
        <Link
          to="/app/dashboard/accounting/general-voucher"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-dark-600"
        >
          {isAr ? 'العودة للقائمة' : 'Back to list'}
        </Link>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800 md:grid-cols-4">
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'التاريخ المحاسبي' : 'Accounting date'}
          <input
            type="date"
            value={form.entryDate}
            onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'النوع' : 'Type'}
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900"
          >
            <option value="manual">{isAr ? 'يدوي' : 'Manual'}</option>
            <option value="opening">{isAr ? 'افتتاحي' : 'Opening'}</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 md:col-span-2">
          {isAr ? 'البيان' : 'Memo'}
          <input
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500 md:col-span-2">
          {isAr ? 'دفتر القيد' : 'Journal book'}
          <select
            value={form.journalId}
            onChange={(e) => {
              const id = e.target.value
              const book = (Array.isArray(journalBooks) ? journalBooks : []).find((b) => String(b._id) === id)
              setForm((f) => {
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
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-600 dark:bg-dark-900"
          >
            <option value="">{isAr ? 'بدون دفتر (JE)' : 'No book (JE)'}</option>
            {(Array.isArray(journalBooks) ? journalBooks : []).map((b) => (
              <option key={b._id} value={b._id}>
                {b.code} — {isAr ? b.nameAr || b.name : b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <div className="w-full overflow-x-auto border-b border-slate-100 dark:border-dark-600">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-3 py-2.5 text-start dark:bg-dark-900">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="min-w-[120px] px-3 py-2.5 text-start">{isAr ? 'تحليلي' : 'Analytic'}</th>
                <th className="min-w-[250px] px-3 py-2.5 text-start">{isAr ? 'البيان' : 'Label'}</th>
                <th className="min-w-[120px] px-3 py-2.5 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                <th className="min-w-[120px] px-3 py-2.5 text-end">{isAr ? 'دائن' : 'Credit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {form.lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="sticky left-0 z-10 bg-white px-2 py-2 dark:bg-dark-800">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
                    >
                      <option value="">{isAr ? 'اختر حساب' : 'Select account'}</option>
                      {postable.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.code} — {isAr ? a.nameAr || a.name : a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={line.analyticAccountId || ''}
                      onChange={(e) => updateLine(idx, { analyticAccountId: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
                    >
                      <option value="">—</option>
                      {(Array.isArray(analyticAccounts) ? analyticAccounts : []).map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={(e) =>
                        updateLine(idx, {
                          debit: e.target.value,
                          credit: e.target.value ? '' : line.credit,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-end text-sm tabular-nums dark:border-dark-600 dark:bg-dark-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={(e) =>
                        updateLine(idx, {
                          credit: e.target.value,
                          debit: e.target.value ? '' : line.debit,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-end text-sm tabular-nums dark:border-dark-600 dark:bg-dark-900"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
            className="text-xs font-semibold text-emerald-700"
          >
            + {isAr ? 'سطر' : 'Add line'}
          </button>
          <p className={`text-sm font-semibold ${totals.balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
            {totals.balanced
              ? isAr
                ? 'متوازن · '
                : 'Balanced · '
              : isAr
                ? 'غير متوازن — لا يمكن الترحيل · '
                : 'Unbalanced — cannot post · '}
            Dr <Money value={totals.debit} /> · Cr <Money value={totals.credit} />
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/accounting/general-voucher')}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-dark-600"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <button
          type="button"
          disabled={!totals.balanced || create.isPending}
          onClick={() => create.mutate({ postAfter: false })}
          className="rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 disabled:opacity-40"
        >
          {isAr ? 'حفظ مسودة' : 'Save draft'}
        </button>
        <button
          type="button"
          disabled={!totals.balanced || create.isPending}
          onClick={() => create.mutate({ postAfter: true })}
          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {isAr ? 'حفظ وترحيل' : 'Save & Post'}
        </button>
      </div>
    </div>
  )
}

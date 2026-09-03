import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import AccountingDocumentShell from '../../../components/accounting/AccountingDocumentShell'
import { PAYMENT_STATUS_STEPS, resolvePaymentRibbonStep } from '../../../lib/accountingDocumentStatus'
import { printVendorCheck } from '../../../lib/vendorApTools'
import {
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  listShellClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  salesTableClass,
  softChipClass,
} from '../../sales/salesUi'

const emptyForm = () => ({
  partyName: '',
  amount: '',
  method: 'bank_transfer',
  memo: '',
  date: new Date().toISOString().slice(0, 10),
})

export default function VendorPaymentsPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState('details')
  const [form, setForm] = useState(emptyForm)

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['vendor-payments', search],
    queryFn: () => api.get('/vouchers', {
      params: { type: 'payment', partyType: 'supplier', limit: 100 },
    }).then((r) => r.data),
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return vouchers.filter((v) =>
      (v.voucherNumber || '').toLowerCase().includes(q)
      || (v.partyName || '').toLowerCase().includes(q)
      || (v.description || '').toLowerCase().includes(q),
    )
  }, [vouchers, search])

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/vouchers', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم تسجيل الدفعة' : 'Payment recorded')
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] })
      queryClient.invalidateQueries({ queryKey: ['vouchers'] })
      setShowForm(false)
      setForm(emptyForm())
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الحفظ' : 'Save failed')),
  })

  const handleCreate = async () => {
    const amount = Number(form.amount)
    if (!form.partyName.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error(isAr ? 'أكمل المورد والمبلغ' : 'Complete vendor and amount')
      return
    }
    const payeeName = form.partyName.trim()
    const method = form.method
    const memo = form.memo
    const date = form.date
    createMutation.mutate({
      type: 'payment',
      partyType: 'supplier',
      partyName: payeeName,
      amount,
      currency: 'SAR',
      date,
      description: memo,
      paymentMethod: method === 'bank_transfer' ? 'bank_transfer' : method,
      status: 'approved',
    }, {
      onSuccess: async () => {
        if (method === 'cheque') {
          try {
            await printVendorCheck({ payeeName, amount, memo, paymentDate: date })
          } catch {
            /* optional print */
          }
        }
      },
    })
  }

  if (showForm) {
    return (
      <AccountingDocumentShell
        language={language}
        eyebrow={isAr ? 'مدفوعات الموردين' : 'Vendor payments'}
        title={isAr ? 'دفعة جديدة' : 'New payment'}
        subtitle={isAr ? 'إرسال / Send' : 'Send payment'}
        onBack={() => setShowForm(false)}
        statusSteps={PAYMENT_STATUS_STEPS}
        activeStatusStep="draft"
        actionBar={(
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? (isAr ? 'جارٍ التأكيد…' : 'Confirming…') : (isAr ? 'تأكيد' : 'Confirm')}
            </button>
          </>
        )}
        tabs={[
          { id: 'details', labelEn: 'Payment details', labelAr: 'تفاصيل الدفعة' },
          { id: 'journal', labelEn: 'Journal items', labelAr: 'بنود القيد' },
        ]}
        activeTab={formTab}
        onTabChange={setFormTab}
      >
        {formTab === 'details' ? (
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-dark-800 md:grid-cols-2">
            <div>
              <label className="label">{isAr ? 'نوع الدفعة' : 'Payment type'}</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="radio" checked readOnly />
                  {isAr ? 'إرسال' : 'Send'}
                </label>
                <label className="flex items-center gap-2 text-slate-400">
                  <input type="radio" disabled />
                  {isAr ? 'استلام' : 'Receive'}
                </label>
              </div>
            </div>
            <div>
              <label className="label">{isAr ? 'التاريخ' : 'Date'}</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">{isAr ? 'المورد' : 'Vendor'}</label>
              <input
                value={form.partyName}
                onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
                className="input"
                placeholder={isAr ? 'اسم المورد' : 'Vendor name'}
              />
            </div>
            <div>
              <label className="label">{isAr ? 'المبلغ' : 'Amount'}</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">{isAr ? 'طريقة الدفع' : 'Payment method'}</label>
              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className="select">
                <option value="bank_transfer">{isAr ? 'تحويل بنكي' : 'Bank transfer'}</option>
                <option value="cheque">{isAr ? 'شيك' : 'Check'}</option>
                <option value="cash">{isAr ? 'نقداً' : 'Cash'}</option>
                <option value="card">{isAr ? 'بطاقة' : 'Card'}</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">{isAr ? 'مذكرة / رقم الشيك' : 'Memo / check number'}</label>
              <div className="flex gap-2">
                <input value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} className="input flex-1" />
                {form.method === 'cheque' ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm inline-flex items-center gap-1"
                    onClick={() => printVendorCheck({
                      payeeName: form.partyName,
                      amount: Number(form.amount) || 0,
                      memo: form.memo,
                      paymentDate: form.date,
                    }).catch((err) => toast.error(err.message))}
                  >
                    <Printer className="h-4 w-4" />
                    {isAr ? 'طباعة' : 'Print'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.02]">
            {isAr
              ? 'يُنشأ قيد اليومية عند التأكيد (مدين: ذمم دائنة — دائن: بنك / مدفوعات معلقة).'
              : 'Journal entry is generated on confirm (Debit: AP — Credit: Bank / Outstanding Payments).'}
          </div>
        )}
      </AccountingDocumentShell>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          {isAr ? 'دفعة جديدة' : 'New payment'}
        </button>
      </div>

      <div className={filterBarClass}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? 'بحث…' : 'Search…'} className={`${fieldControlClass} ps-10`} />
        </div>
      </div>

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={filtered}
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد مدفوعات' : 'No vendor payments yet'}</p>}
            renderCard={(row) => (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <p className="font-semibold">{row.voucherNumber}</p>
                <p className="text-sm text-slate-500">{row.partyName}</p>
                <div className="flex items-center justify-between text-sm">
                  <Money value={row.amount} currency={row.currency} />
                  <span className={softChipClass}>{isAr ? 'مرحّلة' : 'Posted'}</span>
                </div>
              </div>
            )}
          >
            <table className={salesTableClass}>
              <thead>
                <tr>
                  <th className={salesThClass}>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
                  <th className={salesThClass}>{isAr ? 'اليومية' : 'Journal'}</th>
                  <th className={salesThClass}>{isAr ? 'طريقة الدفع' : 'Method'}</th>
                  <th className={salesThClass}>{isAr ? 'المورد' : 'Vendor'}</th>
                  <th className={salesThClass}>{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row._id} className={salesTrClass}>
                    <td className={salesTdClass}>
                      {row.date ? new Date(row.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                    </td>
                    <td className={salesTdClass}>{row.voucherNumber || '—'}</td>
                    <td className={salesTdClass}>{isAr ? 'بنك / نقد' : 'Bank / Cash'}</td>
                    <td className={salesTdClass}>{row.paymentMethod || (isAr ? 'يدوي' : 'Manual')}</td>
                    <td className={salesTdClass}>{row.partyName || '—'}</td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      <Money value={row.amount} currency={row.currency} />
                    </td>
                    <td className={salesTdClass}>
                      <span className={softChipClass}>
                        {resolvePaymentRibbonStep(row) === 'draft' ? (isAr ? 'مسودة' : 'Draft') : (isAr ? 'مرحّلة' : 'Posted')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveDataList>
        )}
      </div>
    </div>
  )
}

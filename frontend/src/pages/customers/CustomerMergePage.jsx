import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, CheckCircle2, GitMerge, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

const FIELD_META = [
  { key: 'name', en: 'Display name', ar: 'الاسم' },
  { key: 'nameEn', en: 'Name (EN)', ar: 'الاسم إنجليزي' },
  { key: 'nameAr', en: 'Name (AR)', ar: 'الاسم عربي' },
  { key: 'vatNumber', en: 'VAT', ar: 'الرقم الضريبي' },
  { key: 'crNumber', en: 'CR', ar: 'السجل التجاري' },
  { key: 'email', en: 'Email', ar: 'البريد' },
  { key: 'phone', en: 'Phone', ar: 'الهاتف' },
  { key: 'mobile', en: 'Mobile', ar: 'الجوال' },
  { key: 'customerCode', en: 'Customer code', ar: 'رمز العميل' },
  { key: 'creditLimit', en: 'Credit limit', ar: 'حد الائتمان' },
  { key: 'paymentTermsCustomer', en: 'Payment terms', ar: 'شروط الدفع' },
  { key: 'notes', en: 'Notes', ar: 'ملاحظات' },
]

const ADDR_META = [
  { key: 'street', en: 'Street', ar: 'الشارع' },
  { key: 'city', en: 'City', ar: 'المدينة' },
  { key: 'district', en: 'District', ar: 'الحي' },
  { key: 'postalCode', en: 'Postal', ar: 'الرمز البريدي' },
  { key: 'buildingNumber', en: 'Building', ar: 'المبنى' },
  { key: 'country', en: 'Country', ar: 'الدولة' },
]

function displayVal(customer, key) {
  if (!customer) return '—'
  const v = customer[key]
  if (v == null || v === '') return '—'
  return String(v)
}

function addrVal(customer, key) {
  const v = customer?.address?.[key]
  if (v == null || v === '') return '—'
  return String(v)
}

/**
 * Merge duplicate customers — pick primary + per-field values, preview, confirm.
 */
export default function CustomerMergePage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const initialIds = useMemo(() => {
    const raw = searchParams.get('ids') || ''
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }, [searchParams])

  const [selectedIds, setSelectedIds] = useState(initialIds)
  const [primaryId, setPrimaryId] = useState(initialIds[0] || '')
  const [fieldChoices, setFieldChoices] = useState({})
  const [addressChoices, setAddressChoices] = useState({})
  const [step, setStep] = useState('pick') // pick | fields | preview

  useEffect(() => {
    if (initialIds.length) {
      setSelectedIds(initialIds)
      setPrimaryId(initialIds[0])
    }
  }, [initialIds])

  const { data: dupData } = useQuery({
    queryKey: ['customer-duplicates'],
    queryFn: () => api.get('/accounting/customers/duplicates').then((r) => r.data),
    staleTime: 30_000,
  })

  const secondaryIds = selectedIds.filter((id) => id !== primaryId)

  const previewMutation = useMutation({
    mutationFn: ({ primary, secondaries }) => api.post('/accounting/customers/merge/preview', {
      primaryId: primary,
      secondaryIds: secondaries,
    }).then((r) => r.data),
    onSuccess: (data) => {
      const pid = String(data.primaryId)
      setPrimaryId(pid)
      setSelectedIds([pid, ...data.secondaryIds.map(String)])
      const next = {}
      FIELD_META.forEach((f) => { next[f.key] = pid })
      for (const c of data.customers || []) {
        for (const f of FIELD_META) {
          const pv = data.customers.find((x) => String(x._id) === pid)
          if ((!pv?.[f.key] || pv[f.key] === '') && c[f.key]) {
            next[f.key] = String(c._id)
          }
        }
      }
      setFieldChoices(next)
      const addr = {}
      ADDR_META.forEach((f) => { addr[f.key] = pid })
      setAddressChoices(addr)
      setStep('fields')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Preview failed'),
  })

  useEffect(() => {
    if (initialIds.length >= 2 && step === 'pick') {
      const primary = initialIds[0]
      const secondaries = initialIds.slice(1)
      previewMutation.mutate({ primary, secondaries })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIds.join(',')])

  const { data: livePreview } = useQuery({
    queryKey: ['customer-merge-preview', primaryId, secondaryIds.join(',')],
    queryFn: () => api.post('/accounting/customers/merge/preview', {
      primaryId,
      secondaryIds,
    }).then((r) => r.data),
    enabled: Boolean(primaryId && secondaryIds.length && (step === 'fields' || step === 'preview')),
  })

  const mergeMutation = useMutation({
    mutationFn: () => api.post('/accounting/customers/merge', {
      primaryId,
      secondaryIds,
      fieldChoices,
      addressChoices,
    }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(isAr
        ? `تم الدمج — الرصيد ${Number(data.resulting?.openResidual || 0).toFixed(2)} · ${data.resulting?.invoiceCount || 0} فاتورة`
        : `Merged — balance ${Number(data.resulting?.openResidual || 0).toFixed(2)} · ${data.resulting?.invoiceCount || 0} invoices`)
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['customer-duplicates'])
      queryClient.invalidateQueries(['accounting-customers-directory'])
      queryClient.invalidateQueries(['contacts'])
      navigate(`/app/dashboard/customers/${primaryId}`)
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Merge failed'),
  })

  const customers = livePreview?.customers || []
  const transfer = livePreview?.transfer

  const toggleId = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id)
        if (String(primaryId) === String(id) && next.length) setPrimaryId(next[0])
        return next
      }
      return [...prev, id]
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/customers')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-dark-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            {isAr ? 'العملاء' : 'Customers'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {isAr ? 'دمج العملاء المكررين' : 'Merge duplicate customers'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'اختر السجل الأساسي، الحقول، ثم راجع ما سينتقل قبل التأكيد'
              : 'Pick the primary record, choose field values, preview the transfer, then confirm'}
          </p>
        </div>
      </div>

      {/* Step: pick from duplicate groups if no ids */}
      {step === 'pick' && (
        <div className="space-y-4">
          {(dupData?.groups || []).map((g) => (
            <div key={g.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-dark-900">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                {(g.reasons || []).join(' · ') || 'duplicate'}
              </p>
              <div className="space-y-2">
                {g.customers.map((c) => {
                  const id = String(c._id)
                  const checked = selectedIds.includes(id)
                  return (
                    <label key={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-white/5">
                      <input type="checkbox" checked={checked} onChange={() => toggleId(id)} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{isAr ? (c.nameAr || c.name) : (c.nameEn || c.name)}</p>
                        <p className="text-xs text-slate-500">
                          {[c.vatNumber && `VAT ${c.vatNumber}`, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      {checked ? (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setPrimaryId(id) }}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            String(primaryId) === id
                              ? 'bg-teal-700 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-white/10'
                          }`}
                        >
                          {String(primaryId) === id
                            ? (isAr ? 'أساسي' : 'Primary')
                            : (isAr ? 'اجعله أساسي' : 'Set primary')}
                        </button>
                      ) : null}
                    </label>
                  )
                })}
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                disabled={previewMutation.isPending}
                onClick={() => {
                  const groupIds = g.customers.map((c) => String(c._id))
                  const inGroup = selectedIds.filter((id) => groupIds.includes(id))
                  if (inGroup.length < 2) {
                    toast.error(isAr ? 'اختر سجلين على الأقل من هذه المجموعة' : 'Select at least two records in this group')
                    return
                  }
                  const primary = inGroup.includes(String(primaryId)) ? String(primaryId) : inGroup[0]
                  const secondaries = inGroup.filter((id) => id !== primary)
                  previewMutation.mutate({ primary, secondaries })
                }}
              >
                <GitMerge className="h-4 w-4" />
                {isAr ? 'متابعة' : 'Continue'}
              </button>
            </div>
          ))}
          {!dupData?.groups?.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center dark:border-white/10">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 font-semibold text-slate-800 dark:text-white">
                {isAr ? 'لا توجد تكرارات محتملة' : 'No possible duplicates found'}
              </p>
              <Link to="/app/dashboard/customers" className="mt-2 inline-block text-sm text-teal-700 underline">
                {isAr ? 'العودة للدليل' : 'Back to directory'}
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {(step === 'fields' || step === 'preview') && customers.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => setPrimaryId(String(c._id))}
                className={`rounded-2xl border p-4 text-start transition ${
                  String(c._id) === String(primaryId)
                    ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-600/30 dark:bg-teal-950/30'
                    : 'border-slate-200 bg-white dark:border-white/10 dark:bg-dark-900'
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {String(c._id) === String(primaryId) ? (isAr ? 'أساسي' : 'Primary') : (isAr ? 'سيُؤرشف' : 'Will archive')}
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">{isAr ? (c.nameAr || c.name) : c.name}</p>
                <p className="mt-2 text-sm tabular-nums text-slate-600" dir="ltr">
                  <Money value={c.balance} /> SAR
                </p>
              </button>
            ))}
          </div>

          {step === 'fields' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-dark-900">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-semibold">{isAr ? 'اختر قيمة كل حقل' : 'Choose value per field'}</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {FIELD_META.map((f) => (
                  <div key={f.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[140px_1fr]">
                    <p className="text-xs font-semibold text-slate-500">{isAr ? f.ar : f.en}</p>
                    <div className="flex flex-wrap gap-2">
                      {customers.map((c) => {
                        const val = displayVal(c, f.key)
                        const active = String(fieldChoices[f.key]) === String(c._id)
                        return (
                          <button
                            key={`${f.key}-${c._id}`}
                            type="button"
                            disabled={val === '—'}
                            onClick={() => setFieldChoices((prev) => ({ ...prev, [f.key]: String(c._id) }))}
                            className={`max-w-full truncate rounded-lg border px-2.5 py-1.5 text-xs ${
                              active
                                ? 'border-teal-600 bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950/40 dark:text-teal-100'
                                : 'border-slate-200 text-slate-600 disabled:opacity-30 dark:border-white/10'
                            }`}
                            title={val}
                          >
                            {val}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {ADDR_META.map((f) => (
                  <div key={`addr-${f.key}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[140px_1fr]">
                    <p className="text-xs font-semibold text-slate-500">{isAr ? f.ar : f.en}</p>
                    <div className="flex flex-wrap gap-2">
                      {customers.map((c) => {
                        const val = addrVal(c, f.key)
                        const active = String(addressChoices[f.key]) === String(c._id)
                        return (
                          <button
                            key={`addr-${f.key}-${c._id}`}
                            type="button"
                            disabled={val === '—'}
                            onClick={() => setAddressChoices((prev) => ({ ...prev, [f.key]: String(c._id) }))}
                            className={`max-w-full truncate rounded-lg border px-2.5 py-1.5 text-xs ${
                              active
                                ? 'border-teal-600 bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950/40'
                                : 'border-slate-200 text-slate-600 disabled:opacity-30 dark:border-white/10'
                            }`}
                          >
                            {val}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/10">
                <button type="button" className="rounded-xl px-4 py-2 text-sm text-slate-500" onClick={() => setStep('pick')}>
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => setStep('preview')}
                >
                  {isAr ? 'معاينة الدمج' : 'Preview merge'}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && transfer && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-500/30 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="space-y-2 text-sm text-amber-950 dark:text-amber-100">
                  <p className="font-semibold">
                    {isAr ? livePreview?.summary?.ar : livePreview?.summary?.en}
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-[13px]">
                    <li>{transfer.invoices} {isAr ? 'فاتورة' : 'invoices'}</li>
                    <li>{transfer.payments} {isAr ? 'دفعة' : 'payments'}</li>
                    <li>{transfer.creditNotes} {isAr ? 'إشعار دائن' : 'credit notes'}</li>
                    <li>{transfer.journalEntries} {isAr ? 'قيد يومية' : 'journal entries'}</li>
                    <li>
                      {isAr ? 'الرصيد الناتج' : 'Resulting receivable'}:{' '}
                      <span className="font-bold tabular-nums" dir="ltr">
                        <Money value={livePreview?.balances?.resulting} /> SAR
                      </span>
                    </li>
                  </ul>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
                    {isAr
                      ? 'السجلات المكررة ستُؤرشف مع علامة "merged into" ولن تُحذف.'
                      : 'Duplicates will be archived with a "merged into" flag — not deleted.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="rounded-xl px-4 py-2 text-sm" onClick={() => setStep('fields')}>
                  {isAr ? 'تعديل الحقول' : 'Edit fields'}
                </button>
                <button
                  type="button"
                  disabled={mergeMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
                  onClick={() => {
                    if (!window.confirm(isAr ? 'تأكيد دمج العملاء؟' : 'Confirm customer merge?')) return
                    mergeMutation.mutate()
                  }}
                >
                  <GitMerge className="h-4 w-4" />
                  {mergeMutation.isPending ? (isAr ? 'جاري الدمج…' : 'Merging…') : (isAr ? 'تأكيد الدمج' : 'Confirm merge')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

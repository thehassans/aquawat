import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Download,
  Mail,
  MessageCircle,
  Printer,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import PartnerCombobox from '../../components/inventory/PartnerCombobox'
import CustomerStatementDocument from '../../components/customers/CustomerStatementDocument'

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
const ghostBtn =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200'
const primaryBtn =
  'inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950'

function toYmd(d) {
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function periodPresets() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const thisMonthStart = new Date(y, m, 1)
  const thisMonthEnd = new Date(y, m + 1, 0)
  const lastMonthStart = new Date(y, m - 1, 1)
  const lastMonthEnd = new Date(y, m, 0)
  const q = Math.floor(m / 3)
  const quarterStart = new Date(y, q * 3, 1)
  const quarterEnd = new Date(y, q * 3 + 3, 0)
  return {
    this_month: { start: toYmd(thisMonthStart), end: toYmd(thisMonthEnd) },
    last_month: { start: toYmd(lastMonthStart), end: toYmd(lastMonthEnd) },
    this_quarter: { start: toYmd(quarterStart), end: toYmd(quarterEnd) },
    all_time: { start: '1970-01-01', end: toYmd(now) },
  }
}

export default function CustomerStatement({ embeddedCustomerId = null, compact = false } = {}) {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const { id: routeCustomerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const lockedId = embeddedCustomerId || routeCustomerId || ''

  const presets = useMemo(() => periodPresets(), [])
  const [customerId, setCustomerId] = useState(lockedId || searchParams.get('customerId') || '')
  const [startDate, setStartDate] = useState(presets.this_month.start)
  const [endDate, setEndDate] = useState(presets.this_month.end)
  const [preset, setPreset] = useState('this_month')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPreview, setBulkPreview] = useState(null)
  const [bulkChannels, setBulkChannels] = useState({ email: true, whatsapp: false })

  useEffect(() => {
    if (lockedId) setCustomerId(lockedId)
  }, [lockedId])

  const { data: selectedCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.get(`/customers/${customerId}`).then((r) => r.data),
    enabled: Boolean(customerId),
  })

  const { data: statementData, isLoading, refetch } = useQuery({
    queryKey: ['customer-statement', customerId, startDate, endDate],
    queryFn: () => api.get('/reports/customer-statement', {
      params: { customerId, startDate, endDate },
    }).then((r) => r.data),
    enabled: Boolean(customerId),
  })

  const { data: directoryCustomers } = useQuery({
    queryKey: ['accounting-customers-soa-bulk'],
    queryFn: () => api.get('/accounting/customers', { params: { limit: 200 } })
      .then((r) => r.data?.rows || r.data?.customers || r.data || []),
    enabled: !compact,
    staleTime: 60_000,
  })

  const applyPreset = (key) => {
    const p = presets[key]
    if (!p) return
    setPreset(key)
    setStartDate(p.start)
    setEndDate(p.end)
  }

  const selectCustomer = (value) => {
    setCustomerId(value)
    if (lockedId) return
    const next = new URLSearchParams(searchParams)
    if (value) next.set('customerId', value)
    else next.delete('customerId')
    setSearchParams(next, { replace: true })
  }

  const downloadPdf = async () => {
    if (!customerId) return
    try {
      const res = await api.get('/reports/customer-statement/pdf', {
        params: { customerId, startDate, endDate },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `SOA-${customerId}-${endDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err?.response?.data?.error || (isAr ? 'تعذر تنزيل PDF' : 'PDF download failed'))
    }
  }

  const emailMutation = useMutation({
    mutationFn: () => api.post('/reports/customer-statement/send-email', {
      customerId, startDate, endDate, language,
    }),
    onSuccess: () => toast.success(isAr ? 'تم إرسال الكشف بالبريد' : 'Statement emailed'),
    onError: (err) => toast.error(err?.response?.data?.error || (isAr ? 'فشل الإرسال' : 'Email failed')),
  })

  const waMutation = useMutation({
    mutationFn: () => api.post('/reports/customer-statement/send-whatsapp', {
      customerId, startDate, endDate, language,
    }),
    onSuccess: (res) => {
      if (res.data?.waMe) window.open(res.data.waMe, '_blank', 'noopener,noreferrer')
      toast.success(isAr ? 'تم تجهيز واتساب' : 'WhatsApp ready')
    },
    onError: (err) => toast.error(err?.response?.data?.error || (isAr ? 'فشل واتساب' : 'WhatsApp failed')),
  })

  const bulkPreviewMutation = useMutation({
    mutationFn: (ids) => api.post('/reports/customer-statement/bulk-preview', {
      customerIds: ids, startDate, endDate,
    }).then((r) => r.data),
    onSuccess: (data) => {
      setBulkPreview(data)
      setBulkOpen(true)
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Preview failed'),
  })

  const bulkSendMutation = useMutation({
    mutationFn: () => api.post('/reports/customer-statement/bulk-send', {
      customerIds: selectedIds,
      startDate,
      endDate,
      language,
      channels: [
        bulkChannels.email ? 'email' : null,
        bulkChannels.whatsapp ? 'whatsapp' : null,
      ].filter(Boolean),
    }),
    onSuccess: (res) => {
      toast.success(isAr
        ? `تم إرسال ${res.data?.sent || 0} كشف`
        : `Sent ${res.data?.sent || 0} statement(s)`)
      setBulkOpen(false)
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Bulk send failed'),
  })

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const customerList = Array.isArray(directoryCustomers) ? directoryCustomers : []

  return (
    <div className={`space-y-5 ${compact ? '' : 'pb-16'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {!compact ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between print:hidden">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              {isAr ? 'العملاء' : 'Customers'}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[28px]">
              {isAr ? 'كشف حساب العميل' : 'Customer statement'}
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              {isAr
                ? 'أرصدة من دفتر الأستاذ (1200) — مطابقة لمستحقات الدليل وأعمار الدين'
                : 'GL-backed AR (1200) — matches directory receivable and aged AR'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => window.print()} disabled={!statementData}>
              <Printer className="h-4 w-4" /> {isAr ? 'طباعة' : 'Print'}
            </button>
            <button type="button" className={ghostBtn} onClick={downloadPdf} disabled={!customerId}>
              <Download className="h-4 w-4" /> {isAr ? 'PDF' : 'Download PDF'}
            </button>
            <button type="button" className={ghostBtn} onClick={() => emailMutation.mutate()} disabled={!customerId || emailMutation.isPending}>
              <Mail className="h-4 w-4" /> {isAr ? 'بريد' : 'Email'}
            </button>
            <button type="button" className={ghostBtn} onClick={() => waMutation.mutate()} disabled={!customerId || waMutation.isPending}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className={ghostBtn} onClick={() => window.print()} disabled={!statementData}>
            <Printer className="h-4 w-4" /> {isAr ? 'طباعة' : 'Print'}
          </button>
          <button type="button" className={ghostBtn} onClick={downloadPdf} disabled={!customerId}>
            <Download className="h-4 w-4" /> PDF
          </button>
          <button type="button" className={ghostBtn} onClick={() => emailMutation.mutate()} disabled={!customerId || emailMutation.isPending}>
            <Mail className="h-4 w-4" /> {isAr ? 'بريد' : 'Email'}
          </button>
          <button type="button" className={ghostBtn} onClick={() => waMutation.mutate()} disabled={!customerId || waMutation.isPending}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
        </div>
      )}

      <div className={`${shell} p-5 print:hidden`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {!lockedId ? (
            <div className="lg:col-span-2">
              <label className="label">{isAr ? 'العميل' : 'Customer'}</label>
              <PartnerCombobox
                role="customer"
                value={customerId || null}
                selectedOption={selectedCustomer || null}
                language={language}
                ar={isAr}
                placeholder={isAr ? 'اختر العميل…' : 'Select customer…'}
                queryKeyPrefix="customer-statement-filter"
                onChange={(opt) => selectCustomer(opt?._id || '')}
              />
            </div>
          ) : null}
          <div>
            <label className="label">{isAr ? 'من' : 'From'}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setPreset('custom'); setStartDate(e.target.value) }}
              className="input"
            />
          </div>
          <div>
            <label className="label">{isAr ? 'إلى' : 'To'}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setPreset('custom'); setEndDate(e.target.value) }}
              className="input"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: 'this_month', en: 'This month', ar: 'هذا الشهر' },
            { id: 'last_month', en: 'Last month', ar: 'الشهر الماضي' },
            { id: 'this_quarter', en: 'This quarter', ar: 'هذا الربع' },
            { id: 'all_time', en: 'All time', ar: 'كل الفترة' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                preset === p.id
                  ? 'bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300'
              }`}
            >
              {isAr ? p.ar : p.en}
            </button>
          ))}
          {customerId ? (
            <button type="button" className="ms-auto text-xs font-semibold text-teal-700" onClick={() => refetch()}>
              {isAr ? 'تحديث' : 'Refresh'}
            </button>
          ) : null}
        </div>
      </div>

      {!compact && customerList.length > 0 ? (
        <div className={`${shell} p-5 print:hidden`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                {isAr ? 'إرسال جماعي' : 'Bulk send'}
              </p>
              <p className="text-[13px] text-slate-500">
                {isAr ? 'اختر عملاء ثم عاين قبل الإرسال' : 'Select customers, preview, then send'}
              </p>
            </div>
            <button
              type="button"
              className={primaryBtn}
              disabled={!selectedIds.length || bulkPreviewMutation.isPending}
              onClick={() => bulkPreviewMutation.mutate(selectedIds)}
            >
              <Users className="h-4 w-4" />
              {isAr ? `معاينة (${selectedIds.length})` : `Preview (${selectedIds.length})`}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {customerList.slice(0, 100).map((row) => {
              const id = String(row._id || row.partnerId || row.customerId || '')
              if (!id) return null
              const name = isAr ? (row.nameAr || row.name || row.partnerName) : (row.name || row.nameEn || row.partnerName)
              return (
                <label key={id} className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(id)}
                    onChange={() => toggleSelect(id)}
                    className="rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">{name}</span>
                  <span className="tabular-nums text-slate-500" dir="ltr">
                    <Money value={row.outstanding ?? row.openResidual ?? 0} />
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ) : null}

      {!customerId ? (
        <div className={`${shell} px-6 py-16 text-center print:hidden`}>
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-[15px] font-semibold text-slate-800 dark:text-white">
            {isAr ? 'اختر عميلاً لعرض الكشف' : 'Select a customer to view the statement'}
          </p>
        </div>
      ) : isLoading ? (
        <div className={`${shell} flex justify-center py-20`}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      ) : (
        <div className="print:block">
          <CustomerStatementDocument data={statementData} language={language} />
          {selectedCustomer?._id && !compact ? (
            <p className="mt-3 text-center text-xs text-slate-400 print:hidden">
              <Link className="underline" to={`/app/dashboard/customers/${selectedCustomer._id}`}>
                {isAr ? 'صفحة العميل' : 'Customer detail'}
              </Link>
            </p>
          ) : null}
        </div>
      )}

      {bulkOpen && bulkPreview && typeof document !== 'undefined'
        ? createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/10">
                <h3 className="text-sm font-semibold">{isAr ? 'معاينة الإرسال الجماعي' : 'Bulk send preview'}</h3>
                <button type="button" onClick={() => setBulkOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-slate-400">
                      <th className="py-2">{isAr ? 'العميل' : 'Customer'}</th>
                      <th className="py-2">{isAr ? 'رصيد' : 'Closing'}</th>
                      <th className="py-2">Email</th>
                      <th className="py-2">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bulkPreview.previews || []).map((p) => (
                      <tr key={p.customerId} className="border-t border-slate-100 dark:border-white/5">
                        <td className="py-2 font-medium">{isAr ? (p.nameAr || p.name) : p.name}</td>
                        <td className="py-2 tabular-nums" dir="ltr">
                          {p.error ? <span className="text-rose-600">{p.error}</span> : <Money value={p.closingBalance} />}
                        </td>
                        <td className="py-2 text-xs text-slate-500">{p.email || '—'}</td>
                        <td className="py-2 text-xs text-slate-500">{p.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-white/10">
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={bulkChannels.email} onChange={(e) => setBulkChannels((c) => ({ ...c, email: e.target.checked }))} />
                    Email
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={bulkChannels.whatsapp} onChange={(e) => setBulkChannels((c) => ({ ...c, whatsapp: e.target.checked }))} />
                    WhatsApp
                  </label>
                </div>
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={bulkSendMutation.isPending || (!bulkChannels.email && !bulkChannels.whatsapp)}
                  onClick={() => bulkSendMutation.mutate()}
                >
                  {bulkSendMutation.isPending
                    ? (isAr ? 'جاري الإرسال…' : 'Sending…')
                    : (isAr ? 'إرسال للكل' : 'Send all')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .soa-print, .soa-print * { visibility: visible !important; }
          .soa-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}

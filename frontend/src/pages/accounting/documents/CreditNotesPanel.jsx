import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, FileText, Plus, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import CreditNoteFromInvoiceModal from '../../../components/accounting/CreditNoteFromInvoiceModal'
import { documentStatusLabel } from '../../../lib/accountingDocumentStatus'
import { resolveInvoiceListNumber } from '../../../lib/commercialDocumentLabels'
import {
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  filterControlClass,
  listShellClass,
  rowActionBtnClass,
  rowActionsWrapClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  salesTableClass,
  softChipClass,
} from '../../sales/salesUi'

const trimName = (party) => {
  const en = String(party?.name || party?.nameEn || '').trim()
  const ar = String(party?.nameAr || '').trim()
  if (en && ar && en !== ar) return `${en} / ${ar}`
  return en || ar || '—'
}

const CREDIT_NOTE_REASONS = [
  { id: 'return', en: 'Goods returned', ar: 'إرجاع بضاعة' },
  { id: 'damage', en: 'Damaged goods', ar: 'بضاعة تالفة' },
  { id: 'price_correction', en: 'Price correction', ar: 'تصحيح سعر' },
  { id: 'partial_refund', en: 'Partial refund', ar: 'استرداد جزئي' },
  { id: 'full_refund', en: 'Full refund', ar: 'استرداد كامل' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

function InvoicePickerModal({ isOpen, onClose, language, onSelect }) {
  const isAr = language === 'ar'
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['credit-note-source-invoices', search],
    enabled: isOpen,
    queryFn: () => api.get('/invoices', {
      params: {
        limit: 30,
        flow: 'sell',
        invoiceType: '388',
        search: search || undefined,
        status: undefined,
      },
    }).then((r) => r.data),
  })

  const rows = (data?.invoices || []).filter((row) => {
    const st = String(row.status || '').toLowerCase()
    return !['draft', 'cancelled', 'credited'].includes(st)
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-dark-800">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isAr ? 'اختر فاتورة لإشعار دائن' : 'Select invoice for credit note'}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr ? 'الإشعار يُنشأ من فاتورة مبيعات مرحّلة فقط' : 'Credit notes are issued from a posted sales invoice'}
          </p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث برقم الفاتورة أو العميل…' : 'Search invoice number or customer…'}
              className={`${fieldControlClass} !py-2 ps-10`}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
          ) : rows.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {rows.map((row) => (
                <li key={row._id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-start hover:bg-emerald-50/60 dark:hover:bg-white/[0.04]"
                    onClick={() => onSelect(row)}
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold text-emerald-800 dark:text-emerald-300">{row.invoiceNumber}</p>
                      <p className="text-sm text-slate-500">{trimName(row.buyer)}</p>
                    </div>
                    <div className="text-end">
                      <Money value={row.grandTotal} />
                      <p className="text-[11px] text-slate-400">
                        {row.issueDate ? new Date(row.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              {isAr ? 'لا توجد فواتير مناسبة' : 'No eligible invoices'}
            </p>
          )}
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-end dark:border-dark-600">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CreditNotesPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sourceInvoice, setSourceInvoice] = useState(null)
  const [cnModalOpen, setCnModalOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['credit-notes', search, statusFilter],
    queryFn: () => api.get('/invoices', {
      params: {
        limit: 100,
        flow: 'sell',
        invoiceType: '381',
        search: search || undefined,
        status: statusFilter || undefined,
      },
    }).then((r) => r.data),
  })

  const rows = data?.invoices || []

  useEffect(() => {
    const open = () => setPickerOpen(true)
    window.addEventListener('accounting:new-credit-note', open)
    return () => window.removeEventListener('accounting:new-credit-note', open)
  }, [])

  const selectInvoice = async (row) => {
    try {
      const { data: full } = await api.get(`/invoices/${row._id}`)
      setSourceInvoice(full)
      setPickerOpen(false)
      setCnModalOpen(true)
    } catch (err) {
      toast.error(err?.response?.data?.error || (isAr ? 'تعذر فتح الفاتورة' : 'Could not open invoice'))
    }
  }

  const createCn = useMutation({
    mutationFn: (payload) => api.post(`/invoices/${sourceInvoice._id}/credit-note`, {
      ...payload,
      reason: payload.reason || CREDIT_NOTE_REASONS[0].en,
    }),
    onSuccess: (res) => {
      const cn = res.data?.creditNote || res.data
      toast.success(isAr ? 'تم إنشاء إشعار الدائن' : 'Credit note created')
      setCnModalOpen(false)
      setSourceInvoice(null)
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      if (cn?._id) navigate(`/app/dashboard/accounting/invoices/${cn._id}`)
    },
    onError: (err) => toast.error(err?.response?.data?.error || (isAr ? 'فشل الإنشاء' : 'Create failed')),
  })

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-dark-700">
        <FileText className="h-7 w-7" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {isAr ? 'لا توجد إشعارات دائن بعد' : 'No credit notes yet'}
        </p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {isAr
            ? 'أنشئ إشعار دائن من فاتورة مبيعات لتصحيح السعر أو الاسترداد أو الإرجاع.'
            : 'Issue a credit note from a sales invoice for refunds, returns, or price corrections.'}
        </p>
      </div>
      <button type="button" className="btn btn-primary btn-sm mt-1" onClick={() => setPickerOpen(true)}>
        <Plus className="h-4 w-4" />
        {isAr ? 'إشعار دائن جديد' : 'New credit note'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className={filterBarClass}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث…' : 'Search…'}
            className={`${fieldControlClass} !py-2 ps-10`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={filterControlClass}
        >
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="issued">{isAr ? 'مرحّلة' : 'Posted'}</option>
          <option value="approved">{isAr ? 'معتمدة' : 'Approved'}</option>
          <option value="cancelled">{isAr ? 'ملغاة' : 'Cancelled'}</option>
        </select>
      </div>

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={rows}
            empty={emptyState}
            renderCard={(row) => {
              const numberMeta = resolveInvoiceListNumber(row, language)
              return (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <button
                  type="button"
                  className={`${docLinkClass} text-base`}
                  onClick={() => navigate(`/app/dashboard/accounting/invoices/${row._id}`)}
                >
                  {numberMeta.isDraft ? (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {numberMeta.label}
                    </span>
                  ) : numberMeta.label}
                </button>
                <p className="text-sm text-slate-500">{trimName(row.buyer)}</p>
                <div className="flex items-center justify-between text-sm">
                  <Money value={Math.abs(Number(row.grandTotal || 0))} />
                  <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                </div>
              </div>
              )
            }}
          >
            <div className="overflow-x-auto">
              <table className={`${salesTableClass} min-w-[980px]`}>
                <thead>
                  <tr>
                    <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
                    <th className={salesThClass}>{isAr ? 'العميل' : 'Customer'}</th>
                    <th className={salesThClass}>{isAr ? 'الفاتورة الأصلية' : 'Original invoice'}</th>
                    <th className={salesThClass}>{isAr ? 'تاريخ الإشعار' : 'Credit note date'}</th>
                    <th className={salesThClass}>{isAr ? 'بدون ضريبة' : 'Tax excl.'}</th>
                    <th className={salesThClass}>{isAr ? 'الإجمالي' : 'Total'}</th>
                    <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                    <th className={salesThClass} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const original = row.originalInvoiceId
                    const originalId = original?._id || original
                    const originalNumber = original?.invoiceNumber || row.originalInvoiceNumber || null
                    const numberMeta = resolveInvoiceListNumber(row, language)
                    return (
                      <tr key={row._id} className={salesTrClass}>
                        <td className={salesTdClass}>
                          <button
                            type="button"
                            className={docLinkClass}
                            onClick={() => navigate(`/app/dashboard/accounting/invoices/${row._id}`)}
                          >
                            {numberMeta.isDraft ? (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {numberMeta.label}
                              </span>
                            ) : numberMeta.label}
                          </button>
                        </td>
                        <td className={salesTdClass}>{trimName(row.buyer)}</td>
                        <td className={salesTdClass}>
                          {originalId ? (
                            <button
                              type="button"
                              className={docLinkClass}
                              onClick={() => navigate(`/app/dashboard/accounting/invoices/${originalId}`)}
                            >
                              {originalNumber || (isAr ? 'عرض الفاتورة' : 'View invoice')}
                            </button>
                          ) : '—'}
                        </td>
                        <td className={salesTdClass}>
                          {row.issueDate ? new Date(row.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                        </td>
                        <td className={`${salesTdClass} tabular-nums`}>
                          <Money value={Math.abs(Number(row.taxableAmount ?? row.subtotal ?? 0))} />
                        </td>
                        <td className={`${salesTdClass} tabular-nums`}>
                          <Money value={Math.abs(Number(row.grandTotal || 0))} />
                        </td>
                        <td className={salesTdClass}>
                          <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                        </td>
                        <td className={salesTdClass}>
                          <div className={rowActionsWrapClass}>
                            <button
                              type="button"
                              className={rowActionBtnClass}
                              onClick={() => navigate(`/app/dashboard/accounting/invoices/${row._id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </ResponsiveDataList>
        )}
      </div>

      <InvoicePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        language={language}
        onSelect={selectInvoice}
      />

      <CreditNoteFromInvoiceModal
        isOpen={cnModalOpen}
        onClose={() => { setCnModalOpen(false); setSourceInvoice(null) }}
        invoice={sourceInvoice}
        language={language}
        allowPartialLines
        onSubmit={(payload) => createCn.mutate(payload)}
        isPending={createCn.isPending}
      />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import { Plus, Receipt, ArrowUpRight, ArrowDownRight, Edit, Trash2, Download } from 'lucide-react'
import Money from '../../components/ui/Money'
import toast from 'react-hot-toast'
import SmartFilterBar from '../../components/accounting/SmartFilterBar'
import UniversalExportModal from '../../components/accounting/UniversalExportModal'
import { useRegisterAccountingPageActions } from '../accounting/AccountingPageActionsContext'

const fontPage = { fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" }
const fontDisplay = { fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }

export default function Vouchers({ forcedType, embedded = false }) {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [activeTab, setActiveTab] = useState(forcedType || 'receive')
  const [searchTerm, setSearchTerm] = useState('')
  const [tokens, setTokens] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const voucherType = forcedType || activeTab

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['vouchers', voucherType, from, to],
    queryFn: () =>
      api
        .get('/vouchers', {
          params: {
            type: voucherType,
            startDate: from || undefined,
            endDate: to || undefined,
          },
        })
        .then((res) => res.data),
  })

  const filteredVouchers = useMemo(() => {
    const q = searchTerm.toLowerCase()
    return vouchers.filter((v) => {
      if (statusFilter && String(v.status || '') !== statusFilter) return false
      if (!q) return true
      return (
        (v.voucherNumber || '').toLowerCase().includes(q) ||
        (v.partyName && v.partyName.toLowerCase().includes(q))
      )
    })
  }, [vouchers, searchTerm, statusFilter])

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/vouchers/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحذف' : 'Deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['vouchers'] })
    },
  })

  const openNew = () => {
    setEditingVoucher(null)
    setShowForm(true)
  }

  useRegisterAccountingPageActions(
    embedded ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!selected.size && !filteredVouchers.length}
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-dark-600"
        >
          <Download className="h-3.5 w-3.5" />
          {isAr ? 'تصدير' : 'Export'}
        </button>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          <Plus className="h-3.5 w-3.5" />
          {isAr ? 'سند جديد' : 'New voucher'}
        </button>
      </div>
    ) : null,
    [embedded, isAr, selected.size, filteredVouchers.length],
  )

  const filterOptions = [
    { id: 'status:approved', label: isAr ? 'الحالة: معتمد' : 'Status: Approved', kind: 'status', value: 'approved' },
    { id: 'status:draft', label: isAr ? 'الحالة: مسودة' : 'Status: Draft', kind: 'status', value: 'draft' },
    { id: 'from', label: isAr ? 'من تاريخ…' : 'From date…', kind: 'from' },
    { id: 'to', label: isAr ? 'إلى تاريخ…' : 'To date…', kind: 'to' },
  ]

  const applyToken = (opt) => {
    if (opt.kind === 'status') {
      setStatusFilter(opt.value)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'status'), { id: opt.id, label: opt.label, kind: 'status', value: opt.value }])
      return
    }
    if (opt.kind === 'from') {
      const v = window.prompt(isAr ? 'من تاريخ' : 'From date', from || new Date().toISOString().slice(0, 10))
      if (!v) return
      setFrom(v)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'from'), { id: 'from', label: `${isAr ? 'من' : 'From'}: ${v}`, kind: 'from', value: v }])
      return
    }
    if (opt.kind === 'to') {
      const v = window.prompt(isAr ? 'إلى تاريخ' : 'To date', to || new Date().toISOString().slice(0, 10))
      if (!v) return
      setTo(v)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'to'), { id: 'to', label: `${isAr ? 'إلى' : 'To'}: ${v}`, kind: 'to', value: v }])
    }
  }

  const removeToken = (id) => {
    const token = tokens.find((t) => t.id === id)
    setTokens((prev) => prev.filter((t) => t.id !== id))
    if (!token) return
    if (token.kind === 'status') setStatusFilter('')
    if (token.kind === 'from') setFrom('')
    if (token.kind === 'to') setTo('')
  }

  const exportFields = [
    { key: 'voucherNumber', label: isAr ? 'الرقم' : 'Number' },
    { key: 'date', label: isAr ? 'التاريخ' : 'Date', value: (r) => (r.date ? new Date(r.date).toISOString().slice(0, 10) : '') },
    { key: 'partyName', label: isAr ? 'الطرف' : 'Party' },
    { key: 'amount', label: isAr ? 'المبلغ' : 'Amount', value: (r) => Number(r.amount || 0).toFixed(2) },
    { key: 'description', label: isAr ? 'البيان' : 'Description' },
    { key: 'status', label: isAr ? 'الحالة' : 'Status' },
    { key: 'paymentMethod', label: isAr ? 'طريقة الدفع' : 'Payment method' },
  ]

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={embedded ? 'space-y-5' : 'relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-16 pt-6 lg:-mx-6 lg:px-6'} style={fontPage} dir={isAr ? 'rtl' : 'ltr'}>
      {!embedded && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-300/18 blur-[120px]" />
        </div>
      )}

      <div className={`relative ${embedded ? '' : 'mx-auto max-w-7xl'} space-y-6`}>
        {!embedded && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700/80">{isAr ? 'المالية' : 'Finance'}</p>
              <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white" style={fontDisplay}>
                {isAr ? 'السندات' : 'Vouchers'}
              </h1>
              <p className="mt-2 max-w-xl text-[15px] text-slate-500">
                {isAr ? 'سندات القبض والصرف مرتبطة بدفتر الأستاذ.' : 'Receipt and payment vouchers, posted into the general ledger.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-dark-600"
              >
                <Download className="h-4 w-4" />
                {isAr ? 'تصدير' : 'Export'}
              </button>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(4,120,87,0.8)] hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                {isAr ? 'سند جديد' : 'New voucher'}
              </button>
            </div>
          </div>
        )}

        {!forcedType ? (
          <div className="flex rounded-2xl bg-slate-100/80 p-1 dark:bg-dark-900">
            <button
              type="button"
              onClick={() => setActiveTab('receive')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                activeTab === 'receive' ? 'bg-white text-emerald-800 shadow-sm dark:bg-dark-800 dark:text-emerald-300' : 'text-slate-500'
              }`}
            >
              <ArrowDownRight className="h-4 w-4" />
              {isAr ? 'سندات القبض' : 'Receipt'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payment')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                activeTab === 'payment' ? 'bg-white text-amber-800 shadow-sm dark:bg-dark-800 dark:text-amber-300' : 'text-slate-500'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              {isAr ? 'سندات الصرف' : 'Payment'}
            </button>
          </div>
        ) : null}

        <SmartFilterBar
          language={language}
          query={searchTerm}
          onQueryChange={setSearchTerm}
          placeholder={isAr ? 'بحث بالطرف أو الرقم…' : 'Search party or number…'}
          tokens={tokens}
          onRemoveToken={removeToken}
          filterOptions={filterOptions}
          onAddFilter={applyToken}
          groupBy="none"
          onGroupByChange={() => {}}
          groupOptions={[{ id: 'none', label: isAr ? 'بدون تجميع' : 'No grouping' }]}
        />

        <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-dark-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="px-4 py-3.5" />
                  <th className="px-6 py-3.5">{isAr ? 'رقم السند' : 'Number'}</th>
                  <th className="px-6 py-3.5">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-6 py-3.5">{isAr ? 'الطرف' : 'Party'}</th>
                  <th className="px-6 py-3.5">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="px-6 py-3.5">{isAr ? 'البيان' : 'Description'}</th>
                  <th className="px-6 py-3.5 text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-14 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    </td>
                  </tr>
                ) : filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{isAr ? 'لا توجد سندات' : 'No vouchers yet'}</p>
                      <button type="button" onClick={openNew} className="mt-4 text-sm font-semibold text-emerald-700">
                        {isAr ? 'سند جديد' : 'New voucher'}
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher) => (
                    <tr key={voucher._id} className="hover:bg-emerald-50/40 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <input type="checkbox" checked={selected.has(voucher._id)} onChange={() => toggleRow(voucher._id)} className="rounded border-slate-300" />
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{voucher.voucherNumber}</td>
                      <td className="px-6 py-4 text-slate-500">{new Date(voucher.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{voucher.partyName || '—'}</td>
                      <td className="px-6 py-4 font-semibold"><Money value={voucher.amount} /></td>
                      <td className="max-w-xs truncate px-6 py-4 text-slate-500">{voucher.description || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => { setEditingVoucher(voucher); setShowForm(true) }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-emerald-700">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(isAr ? 'هل أنت متأكد؟' : 'Are you sure?')) deleteMutation.mutate(voucher._id)
                            }}
                            className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <UniversalExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        language={language}
        title={isAr ? 'تصدير السندات' : 'Export vouchers'}
        fileBaseName={`maqder-${voucherType}-vouchers`}
        entityKey={`vouchers-${voucherType}`}
        availableFields={exportFields}
        getRows={async () => (selected.size ? filteredVouchers.filter((v) => selected.has(v._id)) : filteredVouchers)}
      />

      <AnimatePresence>
        {showForm && (
          <VoucherFormModal
            voucher={editingVoucher}
            defaultType={voucherType}
            onClose={() => { setShowForm(false); setEditingVoucher(null) }}
            language={language}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function VoucherFormModal({ voucher, defaultType, onClose, language }) {
  const queryClient = useQueryClient()
  const isAr = language === 'ar'
  const isEditing = !!voucher
  const [formData, setFormData] = useState({
    type: voucher?.type || defaultType,
    date: voucher?.date ? new Date(voucher.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    amount: voucher?.amount || '',
    partyType: voucher?.partyType || 'customer',
    partyId: voucher?.partyId || '',
    partyName: voucher?.partyName || '',
    paymentMethod: voucher?.paymentMethod || 'cash',
    reference: voucher?.reference || '',
    description: voucher?.description || '',
  })
  const [allocations, setAllocations] = useState({})

  const { data: parties = [] } = useQuery({
    queryKey: ['voucher-parties', formData.partyType],
    queryFn: () => api.get(`/vouchers/parties/${formData.partyType}`).then((r) => r.data || []),
    enabled: formData.partyType === 'customer' || formData.partyType === 'supplier',
  })

  const { data: openInvoices = [] } = useQuery({
    queryKey: ['voucher-open-invoices', formData.partyId, formData.type],
    queryFn: () =>
      api
        .get('/invoices', {
          params: {
            customerId: formData.partyId,
            flow: 'sell',
            paymentStatus: 'unpaid',
            limit: 50,
          },
        })
        .then((r) => r.data?.invoices || r.data?.rows || r.data || []),
    enabled: formData.type === 'receive' && formData.partyType === 'customer' && Boolean(formData.partyId),
  })

  const openRows = Array.isArray(openInvoices) ? openInvoices : []

  const mutation = useMutation({
    mutationFn: async (data) => {
      const saved = isEditing
        ? await api.put(`/vouchers/${voucher._id}`, data).then((r) => r.data)
        : await api.post('/vouchers', data).then((r) => r.data)

      const allocEntries = Object.entries(allocations)
        .map(([invoiceId, amount]) => ({ invoiceId, amount: Number(amount) || 0 }))
        .filter((a) => a.amount > 0)

      for (const a of allocEntries) {
        await api.post(`/invoices/${a.invoiceId}/payments`, {
          amount: a.amount,
          paymentDate: data.date,
          method: data.paymentMethod,
          reference: saved?.voucherNumber || data.reference,
          note: isAr ? 'تخصيص من سند قبض' : 'Allocated from receipt voucher',
        })
      }
      return saved
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved successfully')
      queryClient.invalidateQueries({ queryKey: ['vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving'),
  })

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0)
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-dark-600 dark:bg-dark-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" dir={isAr ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-white/80 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-800"
        style={fontPage}
      >
        <div className="px-6 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">{isAr ? 'المالية' : 'Finance'}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white" style={fontDisplay}>
            {isEditing ? (isAr ? 'تعديل سند' : 'Edit voucher') : (isAr ? 'سند جديد' : 'New voucher')}
          </h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate(formData)
          }}
          className="space-y-4 px-6 pb-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'النوع' : 'Type'}
              <select required value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className={`${field} mt-1.5`} disabled={isEditing}>
                <option value="receive">{isAr ? 'قبض' : 'Receive'}</option>
                <option value="payment">{isAr ? 'صرف' : 'Payment'}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'التاريخ' : 'Date'}
              <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={`${field} mt-1.5`} />
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'المبلغ' : 'Amount'}
              <input type="number" step="0.01" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className={`${field} mt-1.5`} />
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'طريقة الدفع' : 'Payment method'}
              <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className={`${field} mt-1.5`}>
                <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                <option value="bank_transfer">{isAr ? 'حوالة بنكية' : 'Bank transfer'}</option>
                <option value="card">{isAr ? 'بطاقة' : 'Card'}</option>
                <option value="cheque">{isAr ? 'شيك' : 'Cheque'}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'نوع الطرف' : 'Party type'}
              <select
                value={formData.partyType}
                onChange={(e) => setFormData({ ...formData, partyType: e.target.value, partyId: '', partyName: '' })}
                className={`${field} mt-1.5`}
              >
                <option value="customer">{isAr ? 'عميل' : 'Customer'}</option>
                <option value="supplier">{isAr ? 'مورد' : 'Supplier'}</option>
                <option value="employee">{isAr ? 'موظف' : 'Employee'}</option>
                <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'الطرف' : 'Party'}
              {parties.length ? (
                <select
                  required
                  value={formData.partyId || ''}
                  onChange={(e) => {
                    const id = e.target.value
                    const p = parties.find((x) => String(x._id) === id)
                    setFormData({
                      ...formData,
                      partyId: id,
                      partyName: p ? (isAr ? p.nameAr || p.name || p.companyName : p.name || p.companyName) : '',
                    })
                    setAllocations({})
                  }}
                  className={`${field} mt-1.5`}
                >
                  <option value="">{isAr ? 'اختر…' : 'Select…'}</option>
                  {parties.map((p) => (
                    <option key={p._id} value={p._id}>
                      {isAr ? p.nameAr || p.name || p.companyName : p.name || p.companyName}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" required value={formData.partyName} onChange={(e) => setFormData({ ...formData, partyName: e.target.value })} className={`${field} mt-1.5`} />
              )}
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-500">
            {isAr ? 'البيان' : 'Description'}
            <textarea rows="2" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${field} mt-1.5`} />
          </label>

          {formData.type === 'receive' && formData.partyType === 'customer' && formData.partyId ? (
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  {isAr ? 'فواتير مفتوحة' : 'Open invoices'}
                </p>
                <p className="text-xs text-slate-500">
                  {isAr ? 'مخصص' : 'Allocated'}: <Money value={allocatedTotal} />
                </p>
              </div>
              <div className="mt-3 max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-1 text-start">{isAr ? 'فاتورة' : 'Invoice'}</th>
                      <th className="py-1 text-end">{isAr ? 'المستحق' : 'Due'}</th>
                      <th className="py-1 text-end">{isAr ? 'تخصيص' : 'Allocate'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openRows.map((inv) => {
                      const due = Number(inv.balanceDue ?? inv.amountDue ?? ((inv.grandTotal || 0) - (inv.paidAmount || 0))) || 0
                      return (
                        <tr key={inv._id} className="border-t border-emerald-100/80 dark:border-emerald-900/40">
                          <td className="py-2 font-medium">{inv.invoiceNumber || inv.number || inv._id}</td>
                          <td className="py-2 text-end"><Money value={due} /></td>
                          <td className="py-2 text-end">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              max={due}
                              value={allocations[inv._id] || ''}
                              onChange={(e) => setAllocations((prev) => ({ ...prev, [inv._id]: e.target.value }))}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-end dark:border-dark-600 dark:bg-dark-900"
                            />
                          </td>
                        </tr>
                      )
                    })}
                    {!openRows.length ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">
                          {isAr ? 'لا فواتير مفتوحة' : 'No open invoices'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" disabled={mutation.isPending} className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {mutation.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

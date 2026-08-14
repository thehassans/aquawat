import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import { Plus, Search, Receipt, ArrowUpRight, ArrowDownRight, Edit, Trash2 } from 'lucide-react'
import Money from '../../components/ui/Money'
import toast from 'react-hot-toast'

const fontPage = { fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" }
const fontDisplay = { fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }

export default function Vouchers({ forcedType, embedded = false }) {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [activeTab, setActiveTab] = useState(forcedType || 'receive')
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState(null)
  const voucherType = forcedType || activeTab

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['vouchers', voucherType],
    queryFn: () => api.get('/vouchers', { params: { type: voucherType } }).then((res) => res.data),
  })

  const filteredVouchers = useMemo(() => {
    const q = searchTerm.toLowerCase()
    return vouchers.filter((v) =>
      (v.voucherNumber || '').toLowerCase().includes(q) ||
      (v.partyName && v.partyName.toLowerCase().includes(q))
    )
  }, [vouchers, searchTerm])

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
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(4,120,87,0.8)] hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" />
              {isAr ? 'سند جديد' : 'New voucher'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/80 bg-white/80 p-3 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-dark-800/80">
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
          ) : (
            <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              <Plus className="h-4 w-4" />
              {isAr ? 'سند جديد' : 'New voucher'}
            </button>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isAr ? 'بحث بالرقم أو الطرف…' : 'Search number or party…'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-dark-900"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-dark-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 bg-slate-50/80 dark:bg-dark-900">
                <tr>
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
                    <td colSpan="6" className="px-6 py-14 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    </td>
                  </tr>
                ) : filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{isAr ? 'لا توجد سندات' : 'No vouchers yet'}</p>
                      <p className="mt-1 text-xs text-slate-400">{isAr ? 'أنشئ سند قبض أو صرف للبدء.' : 'Create a receipt or payment voucher to begin.'}</p>
                      <button type="button" onClick={openNew} className="mt-4 text-sm font-semibold text-emerald-700">
                        {isAr ? 'سند جديد' : 'New voucher'}
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher) => (
                    <tr key={voucher._id} className="hover:bg-emerald-50/40 dark:hover:bg-white/[0.03]">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{voucher.voucherNumber}</td>
                      <td className="px-6 py-4 text-slate-500">{new Date(voucher.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{voucher.partyName || '—'}</td>
                      <td className="px-6 py-4 font-semibold"><Money value={voucher.amount} /></td>
                      <td className="px-6 py-4 max-w-xs truncate text-slate-500">{voucher.description || '—'}</td>
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
    partyName: voucher?.partyName || '',
    paymentMethod: voucher?.paymentMethod || 'cash',
    reference: voucher?.reference || '',
    description: voucher?.description || '',
  })

  const mutation = useMutation({
    mutationFn: (data) => (isEditing ? api.put(`/vouchers/${voucher._id}`, data) : api.post('/vouchers', data)),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved successfully')
      queryClient.invalidateQueries({ queryKey: ['vouchers'] })
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving'),
  })

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-dark-600 dark:bg-dark-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" dir={isAr ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-800"
        style={fontPage}
      >
        <div className="px-6 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">{isAr ? 'المالية' : 'Finance'}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white" style={fontDisplay}>
            {isEditing ? (isAr ? 'تعديل سند' : 'Edit voucher') : (isAr ? 'سند جديد' : 'New voucher')}
          </h2>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData) }} className="space-y-4 px-6 pb-6">
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
              <select value={formData.partyType} onChange={(e) => setFormData({ ...formData, partyType: e.target.value })} className={`${field} mt-1.5`}>
                <option value="customer">{isAr ? 'عميل' : 'Customer'}</option>
                <option value="supplier">{isAr ? 'مورد' : 'Supplier'}</option>
                <option value="employee">{isAr ? 'موظف' : 'Employee'}</option>
                <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'اسم الطرف' : 'Party name'}
              <input type="text" required value={formData.partyName} onChange={(e) => setFormData({ ...formData, partyName: e.target.value })} className={`${field} mt-1.5`} />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-500">
            {isAr ? 'البيان' : 'Description'}
            <textarea rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${field} mt-1.5`} />
          </label>
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

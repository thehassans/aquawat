import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, MessageCircle, Mail, Send, FileText, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

const DS = [
  { id: 'prospecting', label: 'Prospecting', color: 'bg-gray-400', ar: 'استكشاف' },
  { id: 'qualification', label: 'Qualification', color: 'bg-indigo-500', ar: 'تأهيل' },
  { id: 'proposal', label: 'Proposal', color: 'bg-sky-500', ar: 'عرض' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-500', ar: 'تفاوض' },
  { id: 'closed_won', label: 'Won', color: 'bg-emerald-500', ar: 'فوز' },
  { id: 'closed_lost', label: 'Lost', color: 'bg-rose-500', ar: 'خسارة' },
]
const iD = () => ({ title: '', description: '', stage: 'prospecting', value: 0, probability: 10, expectedCloseDate: '', leadId: '', customerId: '', assignedTo: '' })

export default function CRMDealsTab({ preview }) {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => language === 'ar' ? ar : en
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iD())
  const [commDeal, setCommDeal] = useState(null)
  const [commType, setCommType] = useState('')
  const [commMsg, setCommMsg] = useState('')
  const [commSubject, setCommSubject] = useState('')

  const { data: dd = {} } = useQuery({ queryKey: ['crm-deals', search], queryFn: async () => (await api.get('/crm/deals', { params: { search } })).data })
  const deals = dd.deals || []
  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: async () => (await api.get('/crm/users')).data })

  const save = useMutation({
    mutationFn: () => editing ? api.put(`/crm/deals/${editing._id}`, form) : api.post('/crm/deals', form),
    onSuccess: () => { toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء')); qc.invalidateQueries({ queryKey: ['crm-deals'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); close() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })
  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/deals/${id}`),
    onSuccess: () => { toast.success(t('Deleted', 'تم الحذف')); qc.invalidateQueries({ queryKey: ['crm-deals'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }) },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const close = () => { setShow(false); setEditing(null); setForm(iD()) }
  const open = (d) => { if (d) { setEditing(d); setForm({ ...iD(), ...d }) } else { setEditing(null); setForm(iD()) } setShow(true) }
  const openComm = (d, type) => { setCommDeal(d); setCommType(type); setCommMsg(''); setCommSubject(''); }
  const closeComm = () => { setCommDeal(null); setCommType(''); setCommMsg(''); setCommSubject(''); }

  const sendComm = useMutation({
    mutationFn: () => commType === 'whatsapp'
      ? api.post(`/crm/deals/${commDeal._id}/send-whatsapp`, { message: commMsg })
      : api.post(`/crm/deals/${commDeal._id}/send-email`, { subject: commSubject, body: commMsg }),
    onSuccess: (res) => { toast.success(`${t('Sent to', 'تم الإرسال إلى')} ${res.data?.sentTo}`); qc.invalidateQueries({ queryKey: ['crm-activities'] }); closeComm() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const pipe = useMemo(() => {
    const m = DS.reduce((acc, s) => { acc[s.id] = { stage: s, deals: [], total: 0 }; return acc }, {})
    deals.forEach(d => { if (m[d.stage]) { m[d.stage].deals.push(d); m[d.stage].total += d.value || 0 } })
    return Object.values(m)
  }, [deals])

  const F = ({ l: label, t: type = 'text', v, onChange, p = '', r = 0, o = null }) => (
    <div>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {r ? <textarea value={v} onChange={onChange} rows={r} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
        : o ? <select value={v} onChange={onChange} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm">{o}</select>
          : <input type={type} value={v} onChange={onChange} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />}
    </div>
  )

  return (
    <div className="space-y-3">
      {!preview && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Deals', 'الصفقات')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('Track your sales pipeline and opportunities', 'تتبع خط المبيعات والفرص')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search deals...', 'البحث في الصفقات...')} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
            </div>
            <button onClick={() => open(null)} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> {t('New Deal', 'صفقة جديدة')}</button>
          </div>
        </>
      )}
      {preview && <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Deal Pipeline', 'خط الأنابيب')}</h3>}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${preview ? 'xl:grid-cols-6' : 'xl:grid-cols-6'} gap-3`}>
        {pipe.map(p => (
          <div key={p.stage.id} className="bg-white dark:bg-dark-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${p.stage.color}`} />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t(p.stage.label, p.stage.ar)}</span>
              <span className="ms-auto text-xs font-bold bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded">{p.deals.length}</span>
            </div>
            <div className="space-y-2 min-h-[60px]">
              <AnimatePresence>
                {p.deals.map(d => (
                  <motion.div key={d._id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-gray-50 dark:bg-dark-700 rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => open(d)}>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{d.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{d.value?.toLocaleString?.() ?? '0'} SAR</p>
                    <p className="text-[10px] text-gray-400">{d.assignedTo?.name || '-'}</p>
                    {!preview && (
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">{d.probability}%</span>
                          {d.leadId?.phone && <button onClick={e => { e.stopPropagation(); openComm(d, 'whatsapp') }} className="text-green-600 hover:text-green-700"><MessageCircle className="w-3 h-3" /></button>}
                          {d.leadId?.email && <button onClick={e => { e.stopPropagation(); openComm(d, 'email') }} className="text-blue-600 hover:text-blue-700"><Mail className="w-3 h-3" /></button>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); if (window.confirm(t('Delete deal?', 'حذف الصفقة؟'))) del.mutate(d._id) }} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {show && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? t('Edit Deal', 'تعديل صفقة') : t('New Deal', 'صفقة جديدة')}</h3>
                <button onClick={close} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F l={t('Title', 'العنوان')} v={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  <F l={t('Value', 'القيمة')} type="number" v={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} />
                  <F l={t('Stage', 'المرحلة')} o={DS.map(s => <option key={s.id} value={s.id}>{t(s.label, s.ar)}</option>)} v={form.stage} onChange={e => {
                    const stage = e.target.value;
                    const pmap = { prospecting: 10, qualification: 25, proposal: 50, negotiation: 75, closed_won: 100, closed_lost: 0 };
                    setForm(f => ({ ...f, stage, probability: pmap[stage] ?? f.probability }));
                  }} />
                  <F l={t('Probability (%)', 'الاحتمالية')} type="number" v={form.probability} onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))} />
                  <F l={t('Expected Close Date', 'تاريخ الإغلاق')} type="date" v={form.expectedCloseDate?.slice?.(0, 10) || ''} onChange={e => setForm(f => ({ ...f, expectedCloseDate: e.target.value }))} />
                  <F l={t('Assigned To', 'مسؤول')} o={[<option key="" value="">{t('Unassigned', 'غير معين')}</option>, ...users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)]} v={form.assignedTo || ''} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
                  <div className="sm:col-span-2"><F l={t('Description', 'الوصف')} r={2} v={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-2">
                  {editing && editing.customerId && (
                    <>
                      <button onClick={() => navigate('/app/dashboard/quotations/new', { state: { customerId: editing.customerId._id || editing.customerId, sourceDealId: editing._id } })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {t('Quote', 'عرض سعر')}</button>
                      <button onClick={() => navigate('/app/dashboard/invoices/new/sell', { state: { customerId: editing.customerId._id || editing.customerId, sourceDealId: editing._id } })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> {t('Invoice', 'فاتورة')}</button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={close} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">{t('Cancel', 'إلغاء')}</button>
                  <button onClick={() => save.mutate()} disabled={save.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4" /> {save.isPending ? t('Saving...', 'جاري الحفظ...') : t('Save', 'حفظ')}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commDeal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeComm}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{commType === 'whatsapp' ? t('Send WhatsApp', 'إرسال واتساب') : t('Send Email', 'إرسال بريد')} — {commDeal.title}</h3>
                <button onClick={closeComm} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                {commType === 'email' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">{t('Subject', 'الموضوع')}</label>
                    <input value={commSubject} onChange={e => setCommSubject(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-500">{t('Message', 'الرسالة')}</label>
                  <textarea value={commMsg} onChange={e => setCommMsg(e.target.value)} rows={4} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
                </div>
                <p className="text-[10px] text-gray-400">{t('Sending to', 'الإرسال إلى')}: {commType === 'whatsapp' ? commDeal.leadId?.phone : commDeal.leadId?.email}</p>
              </div>
              <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 dark:border-dark-700">
                <button onClick={closeComm} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">{t('Cancel', 'إلغاء')}</button>
                <button onClick={() => sendComm.mutate()} disabled={sendComm.isPending || !commMsg.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"><Send className="w-4 h-4" /> {sendComm.isPending ? t('Sending...', 'جاري الإرسال...') : t('Send', 'إرسال')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

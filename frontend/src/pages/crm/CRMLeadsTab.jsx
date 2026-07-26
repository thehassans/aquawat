import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, MessageCircle, Mail, Send } from 'lucide-react'
import api from '../../lib/api'

const LS = [
  { id: 'new', label: 'New', ar: 'جديد', color: 'bg-slate-100 text-slate-700' },
  { id: 'contacted', label: 'Contacted', ar: 'تم التواصل', color: 'bg-blue-100 text-blue-700' },
  { id: 'qualified', label: 'Qualified', ar: 'مؤهل', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'proposal_sent', label: 'Proposal Sent', ar: 'عرض مرسل', color: 'bg-sky-100 text-sky-700' },
  { id: 'negotiation', label: 'Negotiation', ar: 'تفاوض', color: 'bg-amber-100 text-amber-700' },
  { id: 'converted', label: 'Converted', ar: 'محول', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'lost', label: 'Lost', ar: 'مفقود', color: 'bg-rose-100 text-rose-700' },
]
const SRC = [
  { id: 'website', label: 'Website', ar: 'موقع' }, { id: 'referral', label: 'Referral', ar: 'إحالة' },
  { id: 'social_media', label: 'Social Media', ar: 'تواصل' }, { id: 'email_campaign', label: 'Email', ar: 'بريد' },
  { id: 'whatsapp', label: 'WhatsApp', ar: 'واتساب' }, { id: 'phone', label: 'Phone', ar: 'هاتف' },
  { id: 'walk_in', label: 'Walk-in', ar: 'زيارة' }, { id: 'other', label: 'Other', ar: 'أخرى' },
]
const iL = () => ({ name: '', email: '', phone: '', company: '', source: 'other', status: 'new', estimatedValue: 0, notes: '', tags: '', assignedTo: '' })

export default function CRMLeadsTab() {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => language === 'ar' ? ar : en
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iL())
  const [commLead, setCommLead] = useState(null)
  const [commType, setCommType] = useState('') // 'whatsapp' | 'email'
  const [commMsg, setCommMsg] = useState('')
  const [commSubject, setCommSubject] = useState('')

  const { data: ld = {} } = useQuery({ queryKey: ['crm-leads', search], queryFn: async () => (await api.get('/crm/leads', { params: { search } })).data })
  const leads = ld.leads || []
  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: async () => (await api.get('/crm/users')).data })

  const save = useMutation({
    mutationFn: () => editing ? api.put(`/crm/leads/${editing._id}`, form) : api.post('/crm/leads', form),
    onSuccess: () => { toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء')); qc.invalidateQueries({ queryKey: ['crm-leads'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); close() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })
  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/leads/${id}`),
    onSuccess: () => { toast.success(t('Deleted', 'تم الحذف')); qc.invalidateQueries({ queryKey: ['crm-leads'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }) },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })
  const convert = useMutation({
    mutationFn: (id) => api.post(`/crm/leads/${id}/convert`, {}),
    onSuccess: () => { toast.success(t('Converted to deal', 'تم التحويل إلى صفقة')); qc.invalidateQueries({ queryKey: ['crm-leads'] }); qc.invalidateQueries({ queryKey: ['crm-deals'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }) },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const close = () => { setShow(false); setEditing(null); setForm(iL()) }
  const open = (l) => { if (l) { setEditing(l); setForm({ ...iL(), ...l }) } else { setEditing(null); setForm(iL()) } setShow(true) }
  const openComm = (l, type) => { setCommLead(l); setCommType(type); setCommMsg(''); setCommSubject(''); }
  const closeComm = () => { setCommLead(null); setCommType(''); setCommMsg(''); setCommSubject(''); }

  const sendComm = useMutation({
    mutationFn: () => commType === 'whatsapp'
      ? api.post(`/crm/leads/${commLead._id}/send-whatsapp`, { message: commMsg })
      : api.post(`/crm/leads/${commLead._id}/send-email`, { subject: commSubject, body: commMsg }),
    onSuccess: (res) => { toast.success(`${t('Sent to', 'تم الإرسال إلى')} ${res.data?.sentTo}`); qc.invalidateQueries({ queryKey: ['crm-activities'] }); closeComm() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const F = ({ l: label, t: type = 'text', v, onChange, p = '', r = 0, o = null }) => (
    <div>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {r ? <textarea value={v} onChange={onChange} rows={r} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
        : o ? <select value={v} onChange={onChange} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm">{o}</select>
          : <input type={type} value={v} onChange={onChange} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{t('Leads', 'العملاء المحتملون')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('Manage and track potential customers', 'إدارة وتتبع العملاء المحتملين')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search leads...', 'البحث في العملاء...')} className="w-full pl-9 pr-4 py-2.5 bg-white/70 dark:bg-dark-800/70 backdrop-blur-md border border-gray-200 dark:border-dark-700/50 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm" />
          </div>
          <button onClick={() => open(null)} className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> {t('New Lead', 'عميل جديد')}</button>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-white/40 dark:border-dark-700/50 overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-gradient-to-bl from-primary-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 dark:bg-dark-700/30 border-b border-gray-100 dark:border-dark-700"><tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('Name', 'الاسم')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('Contact', 'التواصل')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('Status', 'الحالة')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('Assigned', 'المسؤول')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('Source', 'المصدر')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('Value', 'القيمة')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('Actions', 'إجراءات')}</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
              {leads.map(l => { const st = LS.find(s => s.id === l.status) || LS[0]; const sr = SRC.find(s => s.id === l.source) || SRC[7]; return (
                <tr key={l._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="px-4 py-3"><p className="font-medium text-gray-900 dark:text-white">{l.name}</p><p className="text-xs text-gray-500">{l.company || '-'}</p></td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{l.phone && <span className="block">{l.phone}</span>}{l.email && <span className="block">{l.email}</span>}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{t(st.label, st.ar)}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{l.assignedTo?.name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{t(sr.label, sr.ar)}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">{l.estimatedValue?.toLocaleString?.() ?? '0'} SAR</td>
                  <td className="px-4 py-3 text-right">
                    {l.phone && <button onClick={() => openComm(l, 'whatsapp')} title="WhatsApp" className="text-green-600 hover:text-green-700 text-xs font-medium mr-2"><MessageCircle className="w-3.5 h-3.5 inline" /></button>}
                    {l.email && <button onClick={() => openComm(l, 'email')} title="Email" className="text-blue-600 hover:text-blue-700 text-xs font-medium mr-2"><Mail className="w-3.5 h-3.5 inline" /></button>}
                    {l.status !== 'converted' && l.status !== 'lost' && <button onClick={() => convert.mutate(l._id)} className="text-emerald-600 hover:underline text-xs font-medium mr-3">{t('Convert', 'تحويل')}</button>}
                    <button onClick={() => open(l)} className="text-primary-600 hover:underline text-xs font-medium mr-3">{t('Edit', 'تعديل')}</button>
                    <button onClick={() => { if (window.confirm(t('Delete lead?', 'حذف العميل المحتمل؟'))) del.mutate(l._id) }} className="text-red-600 hover:underline text-xs font-medium">{t('Delete', 'حذف')}</button>
                  </td>
                </tr>
              )})}
              {leads.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">{t('No leads yet', 'لا يوجد عملاء محتملون بعد')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {show && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-dark-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? t('Edit Lead', 'تعديل عميل') : t('New Lead', 'عميل جديد')}</h3>
                <button onClick={close} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <F l={t('Name', 'الاسم')} v={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <F l={t('Phone', 'الهاتف')} v={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  <F l={t('Email', 'البريد')} v={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <F l={t('Company', 'الشركة')} v={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                  <F l={t('Status', 'الحالة')} o={LS.map(s => <option key={s.id} value={s.id}>{t(s.label, s.ar)}</option>)} v={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} />
                  <F l={t('Source', 'المصدر')} o={SRC.map(s => <option key={s.id} value={s.id}>{t(s.label, s.ar)}</option>)} v={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
                  <F l={t('Estimated Value', 'القيمة المتوقعة')} type="number" v={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: Number(e.target.value) }))} />
                  <F l={t('Tags', 'الوسوم')} v={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} p={t('comma separated', 'مفصولة بفواصل')} />
                  <F l={t('Assigned To', 'مسؤول')} o={[<option key="" value="">{t('Unassigned', 'غير معين')}</option>, ...users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)]} v={form.assignedTo || ''} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
                  <div className="sm:col-span-2"><F l={t('Notes', 'ملاحظات')} r={2} v={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </div>
              </div>
              <div className="sticky bottom-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md flex items-center justify-end gap-3 p-6 border-t border-gray-100 dark:border-dark-700">
                <button onClick={close} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">{t('Cancel', 'إلغاء')}</button>
                <button onClick={() => save.mutate()} disabled={save.isPending} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2">
                  <Save className="w-4 h-4" /> {save.isPending ? t('Saving...', 'جاري الحفظ...') : t('Save', 'حفظ')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commLead && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeComm}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-dark-700/50 w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{commType === 'whatsapp' ? t('Send WhatsApp', 'إرسال واتساب') : t('Send Email', 'إرسال بريد')} — {commLead.name}</h3>
                <button onClick={closeComm} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-4">
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
                <p className="text-[10px] text-gray-400">{t('Sending to', 'الإرسال إلى')}: {commType === 'whatsapp' ? commLead.phone : commLead.email}</p>
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

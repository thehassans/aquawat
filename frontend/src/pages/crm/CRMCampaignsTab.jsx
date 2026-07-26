import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, Megaphone, Play, Clock } from 'lucide-react'
import api from '../../lib/api'

const ST = [
  { id: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { id: 'running', label: 'Running', color: 'bg-blue-100 text-blue-700' },
  { id: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
]

const AU = [
  { id: 'all_leads', label: 'All Leads', ar: 'جميع العملاء المحتملين' },
  { id: 'all_contacts', label: 'All Contacts', ar: 'جميع جهات الاتصال' },
]

const iC = () => ({ name: '', type: 'email', audience: 'all_leads', subject: '', message: '' })

export default function CRMCampaignsTab() {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => language === 'ar' ? ar : en
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iC())

  const { data: cd = {} } = useQuery({ queryKey: ['crm-campaigns', search], queryFn: async () => (await api.get('/crm/campaigns', { params: { search } })).data })
  const campaigns = cd.campaigns || []

  const save = useMutation({
    mutationFn: () => editing ? api.put(`/crm/campaigns/${editing._id}`, form) : api.post('/crm/campaigns', form),
    onSuccess: () => { toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء')); qc.invalidateQueries({ queryKey: ['crm-campaigns'] }); close() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/campaigns/${id}`),
    onSuccess: () => { toast.success(t('Deleted', 'تم الحذف')); qc.invalidateQueries({ queryKey: ['crm-campaigns'] }) },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const send = useMutation({
    mutationFn: (id) => api.post(`/crm/campaigns/${id}/send`),
    onSuccess: () => { toast.success(t('Campaign started', 'بدأت الحملة')); qc.invalidateQueries({ queryKey: ['crm-campaigns'] }) },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const close = () => { setShow(false); setEditing(null); setForm(iC()) }
  const open = (c) => { if (c) { setEditing(c); setForm({ ...iC(), ...c }) } else { setEditing(null); setForm(iC()) } setShow(true) }

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Campaigns', 'الحملات')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('Manage mass email and WhatsApp outreach', 'إدارة حملات البريد والواتساب')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search campaigns...', 'البحث في الحملات...')} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
        </div>
        <button onClick={() => open(null)} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> {t('New Campaign', 'حملة جديدة')}</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {campaigns.map(c => {
          const st = ST.find(s => s.id === c.status) || ST[0];
          return (
            <motion.div key={c._id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-dark-700">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                <span className="text-xs text-gray-400 bg-gray-50 dark:bg-dark-900 px-2 py-1 rounded font-mono">{c.type.toUpperCase()}</span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{c.name}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('Audience:', 'الجمهور:')} {AU.find(a => a.id === c.audience)?.label || c.audience}</p>
              
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-gray-50 dark:bg-dark-900 p-2 rounded">
                  <p className="text-gray-500 font-medium">{t('Sent', 'المرسل')}</p>
                  <p className="font-bold text-gray-900 dark:text-white mt-1">{c.stats?.sent || 0}</p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-900 p-2 rounded">
                  <p className="text-gray-500 font-medium">{t('Delivered', 'المستلم')}</p>
                  <p className="font-bold text-emerald-600 mt-1">{c.stats?.delivered || 0}</p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-900 p-2 rounded">
                  <p className="text-gray-500 font-medium">{t('Failed', 'فشل')}</p>
                  <p className="font-bold text-red-600 mt-1">{c.stats?.failed || 0}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-50 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {c.status === 'draft' && (
                    <button onClick={() => { if (window.confirm(t('Start campaign now?', 'بدء الحملة الآن؟'))) send.mutate(c._id) }} className="px-2 py-1.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1">
                      <Play className="w-3.5 h-3.5" /> {t('Start', 'بدء')}
                    </button>
                  )}
                  {c.status === 'running' && (
                    <span className="text-xs font-medium text-blue-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {t('Running...', 'جاري...')}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => open(c)} className="text-primary-600 hover:text-primary-700 text-xs font-medium">{t('Edit', 'تعديل')}</button>
                  <button onClick={() => { if (window.confirm(t('Delete campaign?', 'حذف الحملة؟'))) del.mutate(c._id) }} className="text-red-600 hover:text-red-700 text-xs font-medium">{t('Delete', 'حذف')}</button>
                </div>
              </div>
            </motion.div>
          )
        })}
        {campaigns.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 text-sm">{t('No campaigns yet', 'لا توجد حملات بعد')}</div>
        )}
      </div>

      <AnimatePresence>
        {show && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? t('Edit Campaign', 'تعديل حملة') : t('New Campaign', 'حملة جديدة')}</h3>
                <button onClick={close} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F l={t('Name', 'الاسم')} v={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <F l={t('Type', 'النوع')} o={[<option key="email" value="email">Email</option>, <option key="whatsapp" value="whatsapp">WhatsApp</option>]} v={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                  <F l={t('Audience', 'الجمهور')} o={AU.map(a => <option key={a.id} value={a.id}>{t(a.label, a.ar)}</option>)} v={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} />
                  {form.type === 'email' && <div className="sm:col-span-2"><F l={t('Subject', 'الموضوع')} v={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>}
                  <div className="sm:col-span-2"><F l={t('Message', 'الرسالة')} r={4} v={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} p={t('Use {{name}} for dynamic tags', 'استخدم {{name}} للوسوم')} /></div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 dark:border-dark-700">
                <button onClick={close} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">{t('Cancel', 'إلغاء')}</button>
                <button onClick={() => save.mutate()} disabled={save.isPending} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                  <Save className="w-4 h-4" /> {save.isPending ? t('Saving...', 'جاري الحفظ...') : t('Save', 'حفظ')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

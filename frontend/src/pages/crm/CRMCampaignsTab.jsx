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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{t('Campaigns', 'الحملات')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('Manage mass email and WhatsApp outreach', 'إدارة حملات البريد والواتساب')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search campaigns...', 'البحث في الحملات...')} className="w-full pl-9 pr-4 py-2.5 bg-white/70 dark:bg-dark-800/70 backdrop-blur-md border border-gray-200 dark:border-dark-700/50 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm" />
          </div>
          <button onClick={() => open(null)} className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> {t('New Campaign', 'حملة جديدة')}</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 rounded-3xl blur-3xl -z-10 pointer-events-none" />
        {campaigns.map(c => {
          const st = ST.find(s => s.id === c.status) || ST[0];
          return (
            <motion.div key={c._id} layout initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200 }} className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-white/40 dark:border-dark-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-gradient-to-br from-primary-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[10px] font-black tracking-wider px-2.5 py-1 rounded-lg shadow-sm ${st.color}`}>{st.label.toUpperCase()}</span>
                <span className="text-[10px] text-gray-500 font-bold bg-gray-100 dark:bg-dark-700 px-2 py-1 rounded-lg tracking-widest">{c.type.toUpperCase()}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-2">{c.name}</h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('Audience:', 'الجمهور:')} <span className="text-gray-700 dark:text-gray-300">{AU.find(a => a.id === c.audience)?.label || c.audience}</span></p>
              
              <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs flex-1">
                <div className="bg-gradient-to-b from-gray-50 to-white dark:from-dark-700 dark:to-dark-800 p-3 rounded-xl border border-gray-100 dark:border-dark-600 shadow-sm">
                  <p className="text-gray-500 font-semibold">{t('Sent', 'المرسل')}</p>
                  <p className="font-black text-gray-900 dark:text-white mt-1.5 text-lg">{c.stats?.sent || 0}</p>
                </div>
                <div className="bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-dark-800 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                  <p className="text-gray-500 font-semibold">{t('Delivered', 'المستلم')}</p>
                  <p className="font-black text-emerald-600 mt-1.5 text-lg">{c.stats?.delivered || 0}</p>
                </div>
                <div className="bg-gradient-to-b from-red-50 to-white dark:from-red-900/20 dark:to-dark-800 p-3 rounded-xl border border-red-100 dark:border-red-900/30 shadow-sm">
                  <p className="text-gray-500 font-semibold">{t('Failed', 'فشل')}</p>
                  <p className="font-black text-red-600 mt-1.5 text-lg">{c.stats?.failed || 0}</p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {c.status === 'draft' && (
                    <button onClick={() => { if (window.confirm(t('Start campaign now?', 'بدء الحملة الآن؟'))) send.mutate(c._id) }} className="px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 shadow-sm">
                      <Play className="w-3.5 h-3.5" /> {t('Start', 'بدء')}
                    </button>
                  )}
                  {c.status === 'running' && (
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><Clock className="w-3.5 h-3.5 animate-pulse" /> {t('Running...', 'جاري...')}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => open(c)} className="p-2 bg-gray-50 dark:bg-dark-700 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors text-xs font-medium"><Search className="w-4 h-4" /></button>
                  <button onClick={() => { if (window.confirm(t('Delete campaign?', 'حذف الحملة؟'))) del.mutate(c._id) }} className="p-2 bg-gray-50 dark:bg-dark-700 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs font-medium"><Trash2 className="w-4 h-4" /></button>
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
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-dark-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? t('Edit Campaign', 'تعديل حملة') : t('New Campaign', 'حملة جديدة')}</h3>
                <button onClick={close} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <F l={t('Name', 'الاسم')} v={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <F l={t('Type', 'النوع')} o={[<option key="email" value="email">Email</option>, <option key="whatsapp" value="whatsapp">WhatsApp</option>]} v={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                  <F l={t('Audience', 'الجمهور')} o={AU.map(a => <option key={a.id} value={a.id}>{t(a.label, a.ar)}</option>)} v={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} />
                  {form.type === 'email' && <div className="sm:col-span-2"><F l={t('Subject', 'الموضوع')} v={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>}
                  <div className="sm:col-span-2"><F l={t('Message', 'الرسالة')} r={4} v={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} p={t('Use {{name}} for dynamic tags', 'استخدم {{name}} للوسوم')} /></div>
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
    </div>
  )
}

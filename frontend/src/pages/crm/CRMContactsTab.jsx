import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, MessageCircle, Mail, UserCircle } from 'lucide-react'
import api from '../../lib/api'

const SRC = [
  { id: 'website', label: 'Website', ar: 'موقع' }, { id: 'referral', label: 'Referral', ar: 'إحالة' },
  { id: 'social_media', label: 'Social Media', ar: 'تواصل' }, { id: 'email_campaign', label: 'Email', ar: 'بريد' },
  { id: 'whatsapp', label: 'WhatsApp', ar: 'واتساب' }, { id: 'phone', label: 'Phone', ar: 'هاتف' },
  { id: 'walk_in', label: 'Walk-in', ar: 'زيارة' }, { id: 'other', label: 'Other', ar: 'أخرى' },
]

const iC = () => ({ name: '', email: '', phone: '', company: '', jobTitle: '', source: 'other', notes: '', assignedTo: '' })

export default function CRMContactsTab() {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => language === 'ar' ? ar : en
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iC())

  const { data: cd = {} } = useQuery({ queryKey: ['crm-contacts', search], queryFn: async () => (await api.get('/crm/contacts', { params: { search } })).data })
  const contacts = cd.contacts || []
  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: async () => (await api.get('/crm/users')).data })

  const save = useMutation({
    mutationFn: () => editing ? api.put(`/crm/contacts/${editing._id}`, form) : api.post('/crm/contacts', form),
    onSuccess: () => { toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء')); qc.invalidateQueries({ queryKey: ['crm-contacts'] }); close() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/contacts/${id}`),
    onSuccess: () => { toast.success(t('Deleted', 'تم الحذف')); qc.invalidateQueries({ queryKey: ['crm-contacts'] }) },
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
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{t('Contacts', 'جهات الاتصال')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('Manage your unified contacts and customers', 'إدارة جهات الاتصال والعملاء')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search contacts...', 'البحث في جهات الاتصال...')} className="w-full pl-9 pr-4 py-2.5 bg-white/70 dark:bg-dark-800/70 backdrop-blur-md border border-gray-200 dark:border-dark-700/50 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm" />
          </div>
          <button onClick={() => open(null)} className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> {t('New Contact', 'جهة اتصال جديدة')}</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 rounded-3xl blur-3xl -z-10 pointer-events-none" />
        {contacts.map(c => {
          const sr = SRC.find(s => s.id === c.source) || SRC[7];
          return (
            <motion.div key={c._id} layout initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200 }} className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-white/40 dark:border-dark-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-gradient-to-br from-primary-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/50 dark:border-dark-700">
                  <UserCircle className="w-7 h-7 text-primary-500 drop-shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{c.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{c.jobTitle ? `${c.jobTitle} @ ` : ''}{c.company || '-'}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{c.email || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="truncate">{c.phone || '-'}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-50 dark:border-dark-700 flex items-center justify-between">
                <span className="text-[10px] bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded text-gray-500">{t(sr.label, sr.ar)}</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => open(c)} className="text-primary-600 hover:text-primary-700 text-xs font-medium">{t('Edit', 'تعديل')}</button>
                  <button onClick={() => { if (window.confirm(t('Delete contact?', 'حذف جهة الاتصال؟'))) del.mutate(c._id) }} className="text-red-600 hover:text-red-700 text-xs font-medium">{t('Delete', 'حذف')}</button>
                </div>
              </div>
            </motion.div>
          )
        })}
        {contacts.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 text-sm">{t('No contacts yet', 'لا توجد جهات اتصال بعد')}</div>
        )}
      </div>

      <AnimatePresence>
        {show && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-dark-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? t('Edit Contact', 'تعديل جهة اتصال') : t('New Contact', 'جهة اتصال جديدة')}</h3>
                <button onClick={close} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <F l={t('Name', 'الاسم')} v={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <F l={t('Email', 'البريد')} v={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <F l={t('Phone', 'الهاتف')} v={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  <F l={t('Company', 'الشركة')} v={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                  <F l={t('Job Title', 'المسمى الوظيفي')} v={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
                  <F l={t('Source', 'المصدر')} o={SRC.map(s => <option key={s.id} value={s.id}>{t(s.label, s.ar)}</option>)} v={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
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
    </div>
  )
}

import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, X, Save, Trash2, Users, PhoneCall, Mail, FileText, CheckCircle } from 'lucide-react'
import api from '../../lib/api'

const AT = [
  { id: 'call', label: 'Call', icon: PhoneCall, ar: 'مكالمة' }, { id: 'meeting', label: 'Meeting', icon: Users, ar: 'اجتماع' },
  { id: 'email', label: 'Email', icon: Mail, ar: 'بريد' }, { id: 'note', label: 'Note', icon: FileText, ar: 'ملاحظة' },
  { id: 'task', label: 'Task', icon: CheckCircle, ar: 'مهمة' }, { id: 'whatsapp', label: 'WhatsApp', icon: PhoneCall, ar: 'واتساب' },
]
const iA = () => ({ type: 'call', subject: '', description: '', leadId: '', dealId: '', customerId: '', dueDate: '' })

export default function CRMActivitiesTab({ preview }) {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => language === 'ar' ? ar : en
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iA())

  const { data: ad = {} } = useQuery({ queryKey: ['crm-activities'], queryFn: async () => (await api.get('/crm/activities')).data })
  const activities = ad.activities || []

  const save = useMutation({
    mutationFn: () => editing ? api.put(`/crm/activities/${editing._id}`, form) : api.post('/crm/activities', form),
    onSuccess: () => { toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء')); qc.invalidateQueries({ queryKey: ['crm-activities'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); close() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })
  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/activities/${id}`),
    onSuccess: () => { toast.success(t('Deleted', 'تم الحذف')); qc.invalidateQueries({ queryKey: ['crm-activities'] }) },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const close = () => { setShow(false); setEditing(null); setForm(iA()) }
  const open = (a) => { if (a) { setEditing(a); setForm({ ...iA(), ...a }) } else { setEditing(null); setForm(iA()) } setShow(true) }

  const F = ({ l: label, t: type = 'text', v, onChange, p = '', r = 0, o = null }) => (
    <div>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {r ? <textarea value={v} onChange={onChange} rows={r} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
        : o ? <select value={v} onChange={onChange} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm">{o}</select>
          : <input type={type} value={v} onChange={onChange} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />}
    </div>
  )

  const list = preview ? activities.slice(0, 5) : activities

  return (
    <div className="space-y-3">
      {!preview && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{t('Activities', 'الأنشطة')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('Track calls, emails, meetings, and tasks', 'تتبع المكالمات والبريد والاجتماعات والمهام')}</p>
          </div>
          <button onClick={() => open(null)} className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2 w-fit"><Plus className="w-4 h-4" /> {t('New Activity', 'نشاط جديد')}</button>
        </div>
      )}
      {preview && <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center justify-between">{t('Recent Activities', 'أحدث الأنشطة')} <button onClick={() => open(null)} className="p-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"><Plus className="w-4 h-4" /></button></h3>}
      <div className="space-y-3 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 dark:from-primary-500/10 dark:to-purple-500/10 rounded-3xl blur-3xl -z-10 pointer-events-none" />
        {list.map(a => { const atype = AT.find(t => t.id === a.type) || AT[3]; const AIcon = atype.icon; return (
          <motion.div key={a._id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] border border-white/40 dark:border-dark-700/50 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/50 dark:border-dark-700"><AIcon className="w-5 h-5 text-primary-600 drop-shadow-sm" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between"><p className="text-sm font-bold text-gray-900 dark:text-white">{a.subject}</p><span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-dark-700 px-2 py-1 rounded-md">{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : ''}</span></div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{a.description || '-'}</p>
            </div>
            {!preview && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => open(a)} className="p-2 bg-gray-50 dark:bg-dark-700 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"><FileText className="w-4 h-4" /></button>
                <button onClick={() => { if (window.confirm(t('Delete activity?', 'حذف النشاط؟'))) del.mutate(a._id) }} className="p-2 bg-gray-50 dark:bg-dark-700 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </motion.div>
        )})}
        {list.length === 0 && <div className="text-center text-gray-400 text-sm py-8">{t('No activities yet', 'لا توجد أنشطة بعد')}</div>}
      </div>

      <AnimatePresence>
        {show && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-dark-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? t('Edit Activity', 'تعديل نشاط') : t('New Activity', 'نشاط جديد')}</h3>
                <button onClick={close} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <F l={t('Type', 'النوع')} o={AT.map(s => <option key={s.id} value={s.id}>{t(s.label, s.ar)}</option>)} v={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                  <F l={t('Subject', 'الموضوع')} v={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                  <F l={t('Due Date', 'تاريخ الاستحقاق')} type="date" v={form.dueDate?.slice?.(0, 10) || ''} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                  <div className="sm:col-span-2"><F l={t('Description', 'الوصف')} r={2} v={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
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

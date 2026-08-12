import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, X, Save, Trash2, Users, PhoneCall, Mail, FileText, CheckCircle, Pencil } from 'lucide-react'
import api from '../../lib/api'
import CRMSubnav from './CRMSubnav'
import {
  crmShell,
  crmInkBtn,
  crmGhostBtn,
  crmLabel,
  crmModalBackdrop,
  crmModalPanel,
  CrmField,
} from './crmUi'

const AT = [
  { id: 'call', label: 'Call', icon: PhoneCall, ar: 'مكالمة' },
  { id: 'meeting', label: 'Meeting', icon: Users, ar: 'اجتماع' },
  { id: 'email', label: 'Email', icon: Mail, ar: 'بريد' },
  { id: 'note', label: 'Note', icon: FileText, ar: 'ملاحظة' },
  { id: 'task', label: 'Task', icon: CheckCircle, ar: 'مهمة' },
  { id: 'whatsapp', label: 'WhatsApp', icon: PhoneCall, ar: 'واتساب' },
]

const iA = () => ({
  type: 'call',
  subject: '',
  description: '',
  leadId: '',
  dealId: '',
  customerId: '',
  dueDate: '',
})

export default function CRMActivitiesTab({ preview }) {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => (language === 'ar' ? ar : en)
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iA())

  const { data: ad = {} } = useQuery({
    queryKey: ['crm-activities'],
    queryFn: async () => (await api.get('/crm/activities')).data,
  })
  const activities = ad.activities || []

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/crm/activities/${editing._id}`, form) : api.post('/crm/activities', form)),
    onSuccess: () => {
      toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء'))
      qc.invalidateQueries({ queryKey: ['crm-activities'] })
      qc.invalidateQueries({ queryKey: ['crm-stats'] })
      close()
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/activities/${id}`),
    onSuccess: () => {
      toast.success(t('Deleted', 'تم الحذف'))
      qc.invalidateQueries({ queryKey: ['crm-activities'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const close = () => {
    setShow(false)
    setEditing(null)
    setForm(iA())
  }
  const open = (a) => {
    if (a) {
      setEditing(a)
      setForm({ ...iA(), ...a })
    } else {
      setEditing(null)
      setForm(iA())
    }
    setShow(true)
  }

  const list = preview ? activities.slice(0, 5) : activities

  return (
    <div className="space-y-5">
      {!preview && <CRMSubnav />}

      {!preview ? (
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className={crmLabel}>{t('CRM', 'إدارة العملاء')}</p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight text-slate-900 dark:text-white">
              {t('Activities', 'الأنشطة')}
            </h1>
          </div>
          <button type="button" onClick={() => open(null)} className={crmInkBtn}>
            <Plus className="h-4 w-4" /> {t('New Activity', 'نشاط جديد')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className={crmLabel}>{t('Overview', 'نظرة عامة')}</p>
            <h3 className="mt-1 text-lg font-medium text-slate-900 dark:text-white">
              {t('Recent Activities', 'أحدث الأنشطة')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => open(null)}
            className="rounded-xl border border-slate-200/80 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`${crmShell} divide-y divide-slate-100 dark:divide-white/[0.06]`}>
        {list.map((a) => {
          const atype = AT.find((x) => x.id === a.type) || AT[3]
          const AIcon = atype.icon
          return (
            <motion.div
              key={a._id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group flex items-start gap-3.5 px-4 py-3.5 transition hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                <AIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-900 dark:text-white">{a.subject}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-400">{a.description || '—'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : ''}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t(atype.label, atype.ar)}
                </p>
              </div>
              {!preview && (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => open(a)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('Delete activity?', 'حذف النشاط؟'))) del.mutate(a._id)
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          )
        })}
        {list.length === 0 && (
          <div className="px-4 py-14 text-center">
            <p className="text-[13px] text-slate-400">{t('No activities yet', 'لا توجد أنشطة بعد')}</p>
            {!preview && (
              <button type="button" onClick={() => open(null)} className={`${crmGhostBtn} mt-4`}>
                <Plus className="h-4 w-4" /> {t('Add activity', 'إضافة نشاط')}
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {show && (
          <motion.div className={crmModalBackdrop} onClick={close}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className={`${crmModalPanel} max-w-2xl`}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0c111a]">
                <div>
                  <p className={crmLabel}>{t('Activity', 'نشاط')}</p>
                  <h3 className="mt-0.5 text-lg font-medium text-slate-900 dark:text-white">
                    {editing ? t('Edit Activity', 'تعديل نشاط') : t('New Activity', 'نشاط جديد')}
                  </h3>
                </div>
                <button type="button" onClick={close} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CrmField label={t('Type', 'النوع')} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    {AT.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(s.label, s.ar)}
                      </option>
                    ))}
                  </CrmField>
                  <CrmField label={t('Subject', 'الموضوع')} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
                  <CrmField
                    label={t('Due Date', 'تاريخ الاستحقاق')}
                    type="date"
                    value={form.dueDate?.slice?.(0, 10) || ''}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                  <div className="sm:col-span-2">
                    <CrmField label={t('Description', 'الوصف')} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200/80 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0c111a]">
                <button type="button" onClick={close} className={crmGhostBtn}>
                  {t('Cancel', 'إلغاء')}
                </button>
                <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className={crmInkBtn}>
                  <Save className="h-4 w-4" /> {save.isPending ? t('Saving...', 'جاري الحفظ...') : t('Save', 'حفظ')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

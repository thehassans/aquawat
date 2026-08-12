import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, Mail, Phone } from 'lucide-react'
import api from '../../lib/api'
import CRMSubnav from './CRMSubnav'
import {
  CRM_SOURCES,
  crmShell,
  crmInkBtn,
  crmGhostBtn,
  crmInput,
  crmLabel,
  crmModalBackdrop,
  crmModalPanel,
  CrmField,
} from './crmUi'

const iC = () => ({
  name: '',
  email: '',
  phone: '',
  company: '',
  jobTitle: '',
  source: 'other',
  notes: '',
  assignedTo: '',
})

const initials = (name) =>
  name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

export default function CRMContactsTab() {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => (language === 'ar' ? ar : en)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iC())

  const { data: cd = {} } = useQuery({
    queryKey: ['crm-contacts', search],
    queryFn: async () => (await api.get('/crm/contacts', { params: { search } })).data,
  })
  const contacts = cd.contacts || []
  const { data: users = [] } = useQuery({
    queryKey: ['crm-users'],
    queryFn: async () => (await api.get('/crm/users')).data,
  })

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/crm/contacts/${editing._id}`, form) : api.post('/crm/contacts', form)),
    onSuccess: () => {
      toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء'))
      qc.invalidateQueries({ queryKey: ['crm-contacts'] })
      close()
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/contacts/${id}`),
    onSuccess: () => {
      toast.success(t('Deleted', 'تم الحذف'))
      qc.invalidateQueries({ queryKey: ['crm-contacts'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const close = () => {
    setShow(false)
    setEditing(null)
    setForm(iC())
  }
  const open = (c) => {
    if (c) {
      setEditing(c)
      setForm({ ...iC(), ...c })
    } else {
      setEditing(null)
      setForm(iC())
    }
    setShow(true)
  }

  return (
    <div className="space-y-5">
      <CRMSubnav />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className={crmLabel}>{t('CRM', 'إدارة العملاء')}</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-slate-900 dark:text-white">
            {t('Contacts', 'جهات الاتصال')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search contacts...', 'البحث في جهات الاتصال...')}
              className={`${crmInput} pl-9`}
            />
          </div>
          <button type="button" onClick={() => open(null)} className={crmInkBtn}>
            <Plus className="h-4 w-4" /> {t('New Contact', 'جهة اتصال جديدة')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {contacts.map((c) => {
          const sr = CRM_SOURCES.find((s) => s.id === c.source) || CRM_SOURCES[7]
          return (
            <motion.div
              key={c._id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${crmShell} group p-4 transition hover:border-slate-300 dark:hover:border-white/20`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                  {initials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[13px] font-medium text-slate-900 dark:text-white">{c.name}</h3>
                  <p className="mt-0.5 truncate text-[12px] text-slate-400">
                    {[c.jobTitle, c.company].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{c.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{c.phone || '—'}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t(sr.label, sr.ar)}
                </span>
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => open(c)}
                    className="px-2 py-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    {t('Edit', 'تعديل')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('Delete contact?', 'حذف جهة الاتصال؟'))) del.mutate(c._id)
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
        {contacts.length === 0 && (
          <div className={`${crmShell} col-span-full px-4 py-14 text-center`}>
            <p className="text-[13px] text-slate-400">{t('No contacts yet', 'لا توجد جهات اتصال بعد')}</p>
            <button type="button" onClick={() => open(null)} className={`${crmGhostBtn} mt-4`}>
              <Plus className="h-4 w-4" /> {t('Add contact', 'إضافة جهة اتصال')}
            </button>
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
                  <p className={crmLabel}>{t('Contact', 'جهة اتصال')}</p>
                  <h3 className="mt-0.5 text-lg font-medium text-slate-900 dark:text-white">
                    {editing ? t('Edit Contact', 'تعديل جهة اتصال') : t('New Contact', 'جهة اتصال جديدة')}
                  </h3>
                </div>
                <button type="button" onClick={close} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CrmField label={t('Name', 'الاسم')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  <CrmField label={t('Email', 'البريد')} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  <CrmField label={t('Phone', 'الهاتف')} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  <CrmField label={t('Company', 'الشركة')} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
                  <CrmField label={t('Job Title', 'المسمى الوظيفي')} value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />
                  <CrmField label={t('Source', 'المصدر')} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                    {CRM_SOURCES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(s.label, s.ar)}
                      </option>
                    ))}
                  </CrmField>
                  <CrmField label={t('Assigned To', 'مسؤول')} value={form.assignedTo || ''} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                    <option value="">{t('Unassigned', 'غير معين')}</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                  </CrmField>
                  <div className="sm:col-span-2">
                    <CrmField label={t('Notes', 'ملاحظات')} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
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

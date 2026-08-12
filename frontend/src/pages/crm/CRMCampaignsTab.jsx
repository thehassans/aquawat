import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, Play } from 'lucide-react'
import api from '../../lib/api'
import CRMSubnav from './CRMSubnav'
import {
  crmShell,
  crmInkBtn,
  crmGhostBtn,
  crmInput,
  crmLabel,
  crmModalBackdrop,
  crmModalPanel,
  CrmField,
} from './crmUi'

const ST = [
  { id: 'draft', label: 'Draft', ar: 'مسودة' },
  { id: 'running', label: 'Running', ar: 'جارية' },
  { id: 'completed', label: 'Completed', ar: 'مكتملة' },
  { id: 'failed', label: 'Failed', ar: 'فشلت' },
]

const AU = [
  { id: 'all_leads', label: 'All leads', ar: 'جميع العملاء المحتملين' },
  { id: 'all_contacts', label: 'All contacts', ar: 'جميع جهات الاتصال' },
]

const iC = () => ({ name: '', type: 'email', audience: 'all_leads', subject: '', message: '' })

export default function CRMCampaignsTab() {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => (language === 'ar' ? ar : en)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iC())

  const { data: cd = {} } = useQuery({
    queryKey: ['crm-campaigns', search],
    queryFn: async () => (await api.get('/crm/campaigns', { params: { search } })).data,
  })
  const campaigns = cd.campaigns || []

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/crm/campaigns/${editing._id}`, form) : api.post('/crm/campaigns', form)),
    onSuccess: () => {
      toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء'))
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] })
      close()
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/campaigns/${id}`),
    onSuccess: () => {
      toast.success(t('Deleted', 'تم الحذف'))
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const send = useMutation({
    mutationFn: (id) => api.post(`/crm/campaigns/${id}/send`),
    onSuccess: () => {
      toast.success(t('Campaign started', 'بدأت الحملة'))
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] })
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
            {t('Campaigns', 'الحملات')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search campaigns...', 'البحث في الحملات...')}
              className={`${crmInput} pl-9`}
            />
          </div>
          <button type="button" onClick={() => open(null)} className={crmInkBtn}>
            <Plus className="h-4 w-4" /> {t('New campaign', 'حملة جديدة')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const st = ST.find((s) => s.id === c.status) || ST[0]
          return (
            <div key={c._id} className={`${crmShell} group p-4 transition hover:border-slate-300 dark:hover:border-white/20`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-medium text-slate-900 dark:text-white">{c.name}</h3>
                  <p className="mt-0.5 text-[12px] text-slate-400">
                    {c.type === 'whatsapp' ? 'WhatsApp' : t('Email', 'بريد')} · {t(AU.find((a) => a.id === c.audience)?.label || c.audience, AU.find((a) => a.id === c.audience)?.ar || c.audience)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 shrink-0 text-[12px] text-slate-600 dark:text-slate-300">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      c.status === 'completed'
                        ? 'bg-emerald-500'
                        : c.status === 'running'
                          ? 'bg-slate-900 dark:bg-white'
                          : c.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                    }`}
                  />
                  {t(st.label, st.ar)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.08]">
                {[
                  { label: t('Sent', 'مرسل'), value: c.stats?.sent || 0 },
                  { label: t('Delivered', 'مستلم'), value: c.stats?.delivered || 0 },
                  { label: t('Failed', 'فشل'), value: c.stats?.failed || 0 },
                ].map((item) => (
                  <div key={item.label} className="bg-white px-3 py-2.5 dark:bg-[#0c111a]">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                    <p className="mt-1 text-[15px] font-medium tabular-nums text-slate-900 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div>
                  {c.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('Start campaign now?', 'بدء الحملة الآن؟'))) send.mutate(c._id)
                      }}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      <Play className="h-3.5 w-3.5" /> {t('Start', 'بدء')}
                    </button>
                  )}
                </div>
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
                      if (window.confirm(t('Delete campaign?', 'حذف الحملة؟'))) del.mutate(c._id)
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {campaigns.length === 0 && (
          <div className={`${crmShell} col-span-full px-4 py-14 text-center`}>
            <p className="text-[13px] text-slate-400">{t('No campaigns yet', 'لا توجد حملات بعد')}</p>
            <button type="button" onClick={() => open(null)} className={`${crmGhostBtn} mt-4`}>
              <Plus className="h-4 w-4" /> {t('New campaign', 'حملة جديدة')}
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
                  <p className={crmLabel}>{t('Campaign', 'حملة')}</p>
                  <h3 className="mt-0.5 text-lg font-medium text-slate-900 dark:text-white">
                    {editing ? t('Edit campaign', 'تعديل حملة') : t('New campaign', 'حملة جديدة')}
                  </h3>
                </div>
                <button type="button" onClick={close} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CrmField label={t('Name', 'الاسم')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  <CrmField label={t('Type', 'النوع')} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </CrmField>
                  <CrmField label={t('Audience', 'الجمهور')} value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}>
                    {AU.map((a) => (
                      <option key={a.id} value={a.id}>
                        {t(a.label, a.ar)}
                      </option>
                    ))}
                  </CrmField>
                  {form.type === 'email' && (
                    <div className="sm:col-span-2">
                      <CrmField label={t('Subject', 'الموضوع')} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <CrmField
                      label={t('Message', 'الرسالة')}
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder={t('Use {{name}} for dynamic tags', 'استخدم {{name}} للوسوم')}
                    />
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

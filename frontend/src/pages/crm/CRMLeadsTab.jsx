import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, MessageCircle, Mail, Send } from 'lucide-react'
import api from '../../lib/api'
import CRMSubnav from './CRMSubnav'
import {
  LEAD_STATUSES,
  CRM_SOURCES,
  crmShell,
  crmInkBtn,
  crmGhostBtn,
  crmInput,
  crmLabel,
  crmModalBackdrop,
  crmModalPanel,
  formatMoney,
  CrmField,
} from './crmUi'

const iL = () => ({
  name: '',
  email: '',
  phone: '',
  company: '',
  source: 'other',
  status: 'new',
  estimatedValue: 0,
  notes: '',
  tags: '',
  assignedTo: '',
})

export default function CRMLeadsTab() {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => (language === 'ar' ? ar : en)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(iL())
  const [commLead, setCommLead] = useState(null)
  const [commType, setCommType] = useState('')
  const [commMsg, setCommMsg] = useState('')
  const [commSubject, setCommSubject] = useState('')

  const { data: ld = {} } = useQuery({
    queryKey: ['crm-leads', search],
    queryFn: async () => (await api.get('/crm/leads', { params: { search } })).data,
  })
  const leads = ld.leads || []
  const { data: users = [] } = useQuery({
    queryKey: ['crm-users'],
    queryFn: async () => (await api.get('/crm/users')).data,
  })

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/crm/leads/${editing._id}`, form) : api.post('/crm/leads', form)),
    onSuccess: () => {
      toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء'))
      qc.invalidateQueries({ queryKey: ['crm-leads'] })
      qc.invalidateQueries({ queryKey: ['crm-stats'] })
      close()
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/leads/${id}`),
    onSuccess: () => {
      toast.success(t('Deleted', 'تم الحذف'))
      qc.invalidateQueries({ queryKey: ['crm-leads'] })
      qc.invalidateQueries({ queryKey: ['crm-stats'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const convert = useMutation({
    mutationFn: (id) => api.post(`/crm/leads/${id}/convert`, {}),
    onSuccess: () => {
      toast.success(t('Converted to deal', 'تم التحويل إلى صفقة'))
      qc.invalidateQueries({ queryKey: ['crm-leads'] })
      qc.invalidateQueries({ queryKey: ['crm-deals'] })
      qc.invalidateQueries({ queryKey: ['crm-stats'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const close = () => {
    setShow(false)
    setEditing(null)
    setForm(iL())
  }
  const open = (l) => {
    if (l) {
      setEditing(l)
      setForm({ ...iL(), ...l })
    } else {
      setEditing(null)
      setForm(iL())
    }
    setShow(true)
  }
  const openComm = (l, type) => {
    setCommLead(l)
    setCommType(type)
    setCommMsg('')
    setCommSubject('')
  }
  const closeComm = () => {
    setCommLead(null)
    setCommType('')
    setCommMsg('')
    setCommSubject('')
  }

  const sendComm = useMutation({
    mutationFn: () =>
      commType === 'whatsapp'
        ? api.post(`/crm/leads/${commLead._id}/send-whatsapp`, { message: commMsg })
        : api.post(`/crm/leads/${commLead._id}/send-email`, { subject: commSubject, body: commMsg }),
    onSuccess: (res) => {
      toast.success(`${t('Sent to', 'تم الإرسال إلى')} ${res.data?.sentTo}`)
      qc.invalidateQueries({ queryKey: ['crm-activities'] })
      closeComm()
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  return (
    <div className="space-y-5">
      <CRMSubnav />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className={crmLabel}>{t('CRM', 'إدارة العملاء')}</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-slate-900 dark:text-white">
            {t('Leads', 'العملاء المحتملون')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search leads...', 'البحث في العملاء...')}
              className={`${crmInput} pl-9`}
            />
          </div>
          <button type="button" onClick={() => open(null)} className={crmInkBtn}>
            <Plus className="h-4 w-4" /> {t('New Lead', 'عميل جديد')}
          </button>
        </div>
      </div>

      <div className={crmShell}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-white/10">
                {[
                  t('Name', 'الاسم'),
                  t('Contact', 'التواصل'),
                  t('Status', 'الحالة'),
                  t('Assigned', 'المسؤول'),
                  t('Source', 'المصدر'),
                  t('Value', 'القيمة'),
                  t('Actions', 'إجراءات'),
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 ${
                      i === 6 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {leads.map((l) => {
                const st = LEAD_STATUSES.find((s) => s.id === l.status) || LEAD_STATUSES[0]
                const sr = CRM_SOURCES.find((s) => s.id === l.source) || CRM_SOURCES[7]
                return (
                  <tr key={l._id} className="transition hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-white">{l.name}</p>
                      <p className="mt-0.5 text-[12px] text-slate-400">{l.company || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-600 dark:text-slate-300">
                      {l.phone && <span className="block">{l.phone}</span>}
                      {l.email && <span className="block text-slate-400">{l.email}</span>}
                      {!l.phone && !l.email && '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            l.status === 'converted'
                              ? 'bg-emerald-500'
                              : l.status === 'lost'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                          }`}
                        />
                        {t(st.label, st.ar)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-600 dark:text-slate-300">
                      {l.assignedTo?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-500">{t(sr.label, sr.ar)}</td>
                    <td className="px-4 py-3.5 tabular-nums text-[12px] text-slate-700 dark:text-slate-300">
                      {formatMoney(l.estimatedValue)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {l.phone && (
                          <button
                            type="button"
                            title="WhatsApp"
                            onClick={() => openComm(l, 'whatsapp')}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-white/[0.06]"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {l.email && (
                          <button
                            type="button"
                            title="Email"
                            onClick={() => openComm(l, 'email')}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-white/[0.06]"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {l.status !== 'converted' && l.status !== 'lost' && (
                          <button
                            type="button"
                            onClick={() => convert.mutate(l._id)}
                            className="px-2 py-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                          >
                            {t('Convert', 'تحويل')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => open(l)}
                          className="px-2 py-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        >
                          {t('Edit', 'تعديل')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('Delete lead?', 'حذف العميل المحتمل؟'))) del.mutate(l._id)
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-[13px] text-slate-400">
                    {t('No leads yet', 'لا يوجد عملاء محتملون بعد')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                  <p className={crmLabel}>{t('Lead', 'عميل محتمل')}</p>
                  <h3 className="mt-0.5 text-lg font-medium text-slate-900 dark:text-white">
                    {editing ? t('Edit Lead', 'تعديل عميل') : t('New Lead', 'عميل جديد')}
                  </h3>
                </div>
                <button type="button" onClick={close} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CrmField label={t('Name', 'الاسم')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  <CrmField label={t('Phone', 'الهاتف')} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  <CrmField label={t('Email', 'البريد')} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  <CrmField label={t('Company', 'الشركة')} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
                  <CrmField label={t('Status', 'الحالة')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(s.label, s.ar)}
                      </option>
                    ))}
                  </CrmField>
                  <CrmField label={t('Source', 'المصدر')} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                    {CRM_SOURCES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(s.label, s.ar)}
                      </option>
                    ))}
                  </CrmField>
                  <CrmField label={t('Estimated Value', 'القيمة المتوقعة')} type="number" value={form.estimatedValue} onChange={(e) => setForm((f) => ({ ...f, estimatedValue: Number(e.target.value) }))} />
                  <CrmField label={t('Tags', 'الوسوم')} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder={t('comma separated', 'مفصولة بفواصل')} />
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

      <AnimatePresence>
        {commLead && (
          <motion.div className={crmModalBackdrop} onClick={closeComm}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className={`${crmModalPanel} max-w-lg`}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
                <div>
                  <p className={crmLabel}>{commType === 'whatsapp' ? 'WhatsApp' : t('Email', 'بريد')}</p>
                  <h3 className="mt-0.5 text-lg font-medium text-slate-900 dark:text-white">
                    {commType === 'whatsapp' ? t('Send WhatsApp', 'إرسال واتساب') : t('Send Email', 'إرسال بريد')}
                  </h3>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">{commLead.name}</p>
                </div>
                <button type="button" onClick={closeComm} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-6">
                {commType === 'email' && (
                  <CrmField label={t('Subject', 'الموضوع')} value={commSubject} onChange={(e) => setCommSubject(e.target.value)} />
                )}
                <CrmField label={t('Message', 'الرسالة')} rows={4} value={commMsg} onChange={(e) => setCommMsg(e.target.value)} />
                <p className="text-[11px] text-slate-400">
                  {t('Sending to', 'الإرسال إلى')}:{' '}
                  <span className="text-slate-600 dark:text-slate-300">
                    {commType === 'whatsapp' ? commLead.phone : commLead.email}
                  </span>
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 px-6 py-4 dark:border-white/10">
                <button type="button" onClick={closeComm} className={crmGhostBtn}>
                  {t('Cancel', 'إلغاء')}
                </button>
                <button type="button" onClick={() => sendComm.mutate()} disabled={sendComm.isPending || !commMsg.trim()} className={crmInkBtn}>
                  <Send className="h-4 w-4" /> {sendComm.isPending ? t('Sending...', 'جاري الإرسال...') : t('Send', 'إرسال')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

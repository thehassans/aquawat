import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, MessageCircle, Mail, Send, FileText, Receipt, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import CRMSubnav from './CRMSubnav'
import {
  DEAL_STAGES,
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

const iD = () => ({
  title: '',
  description: '',
  stage: 'prospecting',
  value: 0,
  probability: 10,
  expectedCloseDate: '',
  leadId: '',
  customerId: '',
  assignedTo: '',
})

const initials = (name) =>
  name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

export default function CRMDealsTab({ preview }) {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => (language === 'ar' ? ar : en)
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

  const { data: dd = {} } = useQuery({
    queryKey: ['crm-deals', search],
    queryFn: async () => (await api.get('/crm/deals', { params: { search } })).data,
  })
  const deals = dd.deals || []
  const { data: users = [] } = useQuery({
    queryKey: ['crm-users'],
    queryFn: async () => (await api.get('/crm/users')).data,
  })

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/crm/deals/${editing._id}`, form) : api.post('/crm/deals', form)),
    onSuccess: () => {
      toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء'))
      qc.invalidateQueries({ queryKey: ['crm-deals'] })
      qc.invalidateQueries({ queryKey: ['crm-stats'] })
      close()
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/deals/${id}`),
    onSuccess: () => {
      toast.success(t('Deleted', 'تم الحذف'))
      qc.invalidateQueries({ queryKey: ['crm-deals'] })
      qc.invalidateQueries({ queryKey: ['crm-stats'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const updateStage = useMutation({
    mutationFn: ({ id, stage }) => {
      const pmap = {
        prospecting: 10,
        qualification: 25,
        proposal: 50,
        negotiation: 75,
        closed_won: 100,
        closed_lost: 0,
      }
      return api.put(`/crm/deals/${id}`, { stage, probability: pmap[stage] })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] })
      qc.invalidateQueries({ queryKey: ['crm-stats'] })
    },
  })

  const close = () => {
    setShow(false)
    setEditing(null)
    setForm(iD())
  }
  const open = (d) => {
    if (d) {
      setEditing(d)
      setForm({ ...iD(), ...d })
    } else {
      setEditing(null)
      setForm(iD())
    }
    setShow(true)
  }
  const openComm = (d, type) => {
    setCommDeal(d)
    setCommType(type)
    setCommMsg('')
    setCommSubject('')
  }
  const closeComm = () => {
    setCommDeal(null)
    setCommType('')
    setCommMsg('')
    setCommSubject('')
  }

  const sendComm = useMutation({
    mutationFn: () =>
      commType === 'whatsapp'
        ? api.post(`/crm/deals/${commDeal._id}/send-whatsapp`, { message: commMsg })
        : api.post(`/crm/deals/${commDeal._id}/send-email`, { subject: commSubject, body: commMsg }),
    onSuccess: (res) => {
      toast.success(`${t('Sent to', 'تم الإرسال إلى')} ${res.data?.sentTo}`)
      qc.invalidateQueries({ queryKey: ['crm-activities'] })
      closeComm()
    },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل')),
  })

  const pipe = useMemo(() => {
    const m = DEAL_STAGES.reduce((acc, s) => {
      acc[s.id] = { stage: s, deals: [], total: 0 }
      return acc
    }, {})
    deals.forEach((d) => {
      if (m[d.stage]) {
        m[d.stage].deals.push(d)
        m[d.stage].total += d.value || 0
      }
    })
    return Object.values(m)
  }, [deals])

  return (
    <div className={preview ? 'space-y-4' : 'flex h-[calc(100vh-8rem)] flex-col space-y-5'}>
      {!preview && <CRMSubnav />}

      <div className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className={crmLabel}>{preview ? t('Overview', 'نظرة عامة') : t('CRM', 'إدارة العملاء')}</p>
          <h1 className={`${preview ? 'text-[15px]' : 'text-2xl'} mt-1 font-medium tracking-tight text-slate-900 dark:text-white`}>
            {preview ? t('Deals pipeline', 'مسار الصفقات') : t('Deals', 'الصفقات')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search deals...', 'البحث في الصفقات...')}
              className={`${crmInput} pl-9`}
            />
          </div>
          <button type="button" onClick={() => open(null)} className={crmInkBtn}>
            <Plus className="h-4 w-4" /> {t('New Deal', 'صفقة جديدة')}
          </button>
        </div>
      </div>

      <div className={`relative flex gap-3 overflow-x-auto pb-2 ${preview ? 'h-[400px]' : 'min-h-0 flex-1'}`}>
        {pipe.map(({ stage, deals: stageDeals, total: stageValue }) => (
          <div
            key={stage.id}
            className={`${crmShell} flex w-72 shrink-0 flex-col`}
          >
            <div className="flex shrink-0 flex-col gap-1.5 border-b border-slate-200/80 px-3.5 py-3 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[13px] font-medium text-slate-900 dark:text-white">
                  <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                  {t(stage.label, stage.ar)}
                </h3>
                <span className="text-[11px] tabular-nums text-slate-400">{stageDeals.length}</span>
              </div>
              <p className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                {formatMoney(stageValue)}
              </p>
            </div>
            <div
              className="min-h-[120px] flex-1 space-y-2 overflow-y-auto p-2.5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const dealId = e.dataTransfer.getData('dealId')
                if (dealId) updateStage.mutate({ id: dealId, stage: stage.id })
              }}
            >
              {stageDeals.map((deal) => (
                <motion.div
                  layoutId={deal._id}
                  key={deal._id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('dealId', deal._id)}
                  className="group cursor-grab rounded-xl border border-slate-200/80 bg-white p-3 transition hover:border-slate-300 active:cursor-grabbing dark:border-white/10 dark:bg-[#0c111a] dark:hover:border-white/20"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h4 className="truncate text-[13px] font-medium text-slate-900 dark:text-white">{deal.title}</h4>
                    {!preview && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => open(deal)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('Delete deal?', 'حذف الصفقة؟'))) del.mutate(deal._id)
                          }}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mb-2.5 flex items-center justify-between text-[12px]">
                    <span className="tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(deal.value)}</span>
                    <span className="tabular-nums text-slate-400">{deal.probability}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-[9px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                      {initials(deal.assignedTo?.name)}
                    </div>
                    {!preview && (
                      <div className="ml-auto flex items-center gap-0.5">
                        {deal.leadId?.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openComm(deal, 'whatsapp')
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-white/[0.06]"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {deal.leadId?.email && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openComm(deal, 'email')
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-white/[0.06]"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
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
                  <p className={crmLabel}>{t('Deal', 'صفقة')}</p>
                  <h3 className="mt-0.5 text-lg font-medium text-slate-900 dark:text-white">
                    {editing ? t('Edit Deal', 'تعديل صفقة') : t('New Deal', 'صفقة جديدة')}
                  </h3>
                </div>
                <button type="button" onClick={close} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CrmField label={t('Title', 'العنوان')} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  <CrmField label={t('Value', 'القيمة')} type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))} />
                  <CrmField
                    label={t('Stage', 'المرحلة')}
                    value={form.stage}
                    onChange={(e) => {
                      const stage = e.target.value
                      const pmap = { prospecting: 10, qualification: 25, proposal: 50, negotiation: 75, closed_won: 100, closed_lost: 0 }
                      setForm((f) => ({ ...f, stage, probability: pmap[stage] ?? f.probability }))
                    }}
                  >
                    {DEAL_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(s.label, s.ar)}
                      </option>
                    ))}
                  </CrmField>
                  <CrmField label={t('Probability (%)', 'الاحتمالية')} type="number" value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: Number(e.target.value) }))} />
                  <CrmField label={t('Expected Close Date', 'تاريخ الإغلاق')} type="date" value={form.expectedCloseDate?.slice?.(0, 10) || ''} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} />
                  <CrmField label={t('Assigned To', 'مسؤول')} value={form.assignedTo || ''} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                    <option value="">{t('Unassigned', 'غير معين')}</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                  </CrmField>
                  <div className="sm:col-span-2">
                    <CrmField label={t('Description', 'الوصف')} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-slate-200/80 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0c111a]">
                <div className="flex items-center gap-2">
                  {editing?.customerId && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/app/dashboard/quotations/new', {
                            state: { customerId: editing.customerId._id || editing.customerId, sourceDealId: editing._id },
                          })
                        }
                        className={crmGhostBtn}
                      >
                        <FileText className="h-4 w-4" /> {t('Quote', 'عرض سعر')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/app/dashboard/accounting/invoices/new/sell', {
                            state: { customerId: editing.customerId._id || editing.customerId, sourceDealId: editing._id },
                          })
                        }
                        className={crmGhostBtn}
                      >
                        <Receipt className="h-4 w-4" /> {t('Invoice', 'فاتورة')}
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={close} className={crmGhostBtn}>
                    {t('Cancel', 'إلغاء')}
                  </button>
                  <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className={crmInkBtn}>
                    <Save className="h-4 w-4" /> {save.isPending ? t('Saving...', 'جاري الحفظ...') : t('Save', 'حفظ')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commDeal && (
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
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">{commDeal.title}</p>
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
                    {commType === 'whatsapp' ? commDeal.leadId?.phone : commDeal.leadId?.email}
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

import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Search, X, Save, Trash2, MessageCircle, Mail, Send, FileText, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

const DS = [
  { id: 'prospecting', label: 'Prospecting', color: 'bg-gray-400', ar: 'استكشاف' },
  { id: 'qualification', label: 'Qualification', color: 'bg-indigo-500', ar: 'تأهيل' },
  { id: 'proposal', label: 'Proposal', color: 'bg-sky-500', ar: 'عرض' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-500', ar: 'تفاوض' },
  { id: 'closed_won', label: 'Won', color: 'bg-emerald-500', ar: 'فوز' },
  { id: 'closed_lost', label: 'Lost', color: 'bg-rose-500', ar: 'خسارة' },
]
const iD = () => ({ title: '', description: '', stage: 'prospecting', value: 0, probability: 10, expectedCloseDate: '', leadId: '', customerId: '', assignedTo: '' })

export default function CRMDealsTab({ preview }) {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => language === 'ar' ? ar : en
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

  const { data: dd = {} } = useQuery({ queryKey: ['crm-deals', search], queryFn: async () => (await api.get('/crm/deals', { params: { search } })).data })
  const deals = dd.deals || []
  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: async () => (await api.get('/crm/users')).data })

  const save = useMutation({
    mutationFn: () => editing ? api.put(`/crm/deals/${editing._id}`, form) : api.post('/crm/deals', form),
    onSuccess: () => { toast.success(editing ? t('Updated', 'تم التحديث') : t('Created', 'تم الإنشاء')); qc.invalidateQueries({ queryKey: ['crm-deals'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); close() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })
  const del = useMutation({
    mutationFn: (id) => api.delete(`/crm/deals/${id}`),
    onSuccess: () => { toast.success(t('Deleted', 'تم الحذف')); qc.invalidateQueries({ queryKey: ['crm-deals'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }) },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const close = () => { setShow(false); setEditing(null); setForm(iD()) }
  const open = (d) => { if (d) { setEditing(d); setForm({ ...iD(), ...d }) } else { setEditing(null); setForm(iD()) } setShow(true) }
  const openComm = (d, type) => { setCommDeal(d); setCommType(type); setCommMsg(''); setCommSubject(''); }
  const closeComm = () => { setCommDeal(null); setCommType(''); setCommMsg(''); setCommSubject(''); }

  const sendComm = useMutation({
    mutationFn: () => commType === 'whatsapp'
      ? api.post(`/crm/deals/${commDeal._id}/send-whatsapp`, { message: commMsg })
      : api.post(`/crm/deals/${commDeal._id}/send-email`, { subject: commSubject, body: commMsg }),
    onSuccess: (res) => { toast.success(`${t('Sent to', 'تم الإرسال إلى')} ${res.data?.sentTo}`); qc.invalidateQueries({ queryKey: ['crm-activities'] }); closeComm() },
    onError: (e) => toast.error(e.response?.data?.error || t('Failed', 'فشل'))
  })

  const pipe = useMemo(() => {
    const m = DS.reduce((acc, s) => { acc[s.id] = { stage: s, deals: [], total: 0 }; return acc }, {})
    deals.forEach(d => { if (m[d.stage]) { m[d.stage].deals.push(d); m[d.stage].total += d.value || 0 } })
    return Object.values(m)
  }, [deals])

  const F = ({ l: label, t: type = 'text', v, onChange, p = '', r = 0, o = null }) => (
    <div>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {r ? <textarea value={v} onChange={onChange} rows={r} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />
        : o ? <select value={v} onChange={onChange} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm">{o}</select>
          : <input type={type} value={v} onChange={onChange} placeholder={p} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm" />}
    </div>
  )

  return (
    <div className={preview ? "space-y-4" : "space-y-6 h-[calc(100vh-8rem)] flex flex-col"}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className={`${preview ? 'text-xl' : 'text-3xl'} font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent`}>{t('Deals Pipeline', 'مسار الصفقات')}</h1>
          {!preview && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('Track and manage your sales opportunities', 'تتبع وإدارة فرص المبيعات')}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search deals...', 'البحث في الصفقات...')} className="w-full pl-9 pr-4 py-2.5 bg-white/70 dark:bg-dark-800/70 backdrop-blur-md border border-gray-200 dark:border-dark-700/50 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm" />
          </div>
          <button onClick={() => open(null)} className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> {t('New Deal', 'صفقة جديدة')}</button>
        </div>
      </div>

      <div className={`flex gap-5 overflow-x-auto pb-4 ${preview ? 'h-[400px]' : 'flex-1'} snap-x snap-mandatory hide-scrollbar relative`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 rounded-3xl blur-3xl -z-10 pointer-events-none" />
        {pipe.map(({ stage, deals: stageDeals, total: stageValue }) => (
          <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col bg-gray-50/50 dark:bg-dark-800/30 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-dark-700/50 snap-center">
            <div className="p-4 border-b border-gray-200/50 dark:border-dark-700/50 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${stage.color}`} />
                  {t(stage.label, stage.ar)}
                </h3>
                <span className="bg-white dark:bg-dark-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">{stageDeals.length}</span>
              </div>
              <div className="text-sm font-black text-gray-700 dark:text-gray-300 tracking-tight">{stageValue.toLocaleString()} SAR</div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]" onDragOver={e => e.preventDefault()} onDrop={e => {
              const dealId = e.dataTransfer.getData('dealId');
              if (dealId) updateStage.mutate({ id: dealId, stage: stage.id });
            }}>
              {stageDeals.map(deal => (
                <motion.div layoutId={deal._id} key={deal._id} draggable onDragStart={e => e.dataTransfer.setData('dealId', deal._id)} className="bg-white/90 dark:bg-dark-700/90 backdrop-blur-md rounded-xl p-4 shadow-[0_4px_12px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgb(0,0,0,0.1)] border border-white/50 dark:border-dark-600/50 cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate pr-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{deal.title}</h4>
                    {!preview && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => open(deal)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-500 hover:text-primary-600 transition-colors"><Search className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { if(window.confirm(t('Delete deal?', 'حذف الصفقة؟'))) del.mutate(deal._id) }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-black text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-600 px-2 py-1 rounded-md">{deal.value.toLocaleString()} SAR</span>
                    <span className="text-gray-500 font-medium">{deal.probability}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-dark-600 dark:to-dark-500 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-400">
                      {deal.assignedTo?.name?.split(' ').map(n => n[0]).join('') || '?'}
                    </div>
                    {!preview && (
                      <div className="flex items-center ml-auto gap-1">
                        {deal.leadId?.phone && <button onClick={e => { e.stopPropagation(); openComm(deal, 'whatsapp') }} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><MessageCircle className="w-3.5 h-3.5" /></button>}
                        {deal.leadId?.email && <button onClick={e => { e.stopPropagation(); openComm(deal, 'email') }} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Mail className="w-3.5 h-3.5" /></button>}
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
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-dark-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? t('Edit Deal', 'تعديل صفقة') : t('New Deal', 'صفقة جديدة')}</h3>
                <button onClick={close} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <F l={t('Title', 'العنوان')} v={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  <F l={t('Value', 'القيمة')} type="number" v={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} />
                  <F l={t('Stage', 'المرحلة')} o={DS.map(s => <option key={s.id} value={s.id}>{t(s.label, s.ar)}</option>)} v={form.stage} onChange={e => {
                    const stage = e.target.value;
                    const pmap = { prospecting: 10, qualification: 25, proposal: 50, negotiation: 75, closed_won: 100, closed_lost: 0 };
                    setForm(f => ({ ...f, stage, probability: pmap[stage] ?? f.probability }));
                  }} />
                  <F l={t('Probability (%)', 'الاحتمالية')} type="number" v={form.probability} onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))} />
                  <F l={t('Expected Close Date', 'تاريخ الإغلاق')} type="date" v={form.expectedCloseDate?.slice?.(0, 10) || ''} onChange={e => setForm(f => ({ ...f, expectedCloseDate: e.target.value }))} />
                  <F l={t('Assigned To', 'مسؤول')} o={[<option key="" value="">{t('Unassigned', 'غير معين')}</option>, ...users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)]} v={form.assignedTo || ''} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
                  <div className="sm:col-span-2"><F l={t('Description', 'الوصف')} r={2} v={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                </div>
              </div>
              <div className="sticky bottom-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md flex items-center justify-between p-6 border-t border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-2">
                  {editing && editing.customerId && (
                    <>
                      <button onClick={() => navigate('/app/dashboard/quotations/new', { state: { customerId: editing.customerId._id || editing.customerId, sourceDealId: editing._id } })} className="px-4 py-2 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 hover:-translate-y-0.5 transition-all shadow-sm flex items-center gap-1.5"><FileText className="w-4 h-4" /> {t('Quote', 'عرض سعر')}</button>
                      <button onClick={() => navigate('/app/dashboard/invoices/new/sell', { state: { customerId: editing.customerId._id || editing.customerId, sourceDealId: editing._id } })} className="px-4 py-2 rounded-xl text-sm font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 hover:-translate-y-0.5 transition-all shadow-sm flex items-center gap-1.5"><Receipt className="w-4 h-4" /> {t('Invoice', 'فاتورة')}</button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={close} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">{t('Cancel', 'إلغاء')}</button>
                  <button onClick={() => save.mutate()} disabled={save.isPending} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4" /> {save.isPending ? t('Saving...', 'جاري الحفظ...') : t('Save', 'حفظ')}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commDeal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeComm}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-dark-700/50 w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{commType === 'whatsapp' ? t('Send WhatsApp', 'إرسال واتساب') : t('Send Email', 'إرسال بريد')} — {commDeal.title}</h3>
                <button onClick={closeComm} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-5 space-y-3">
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
                <p className="text-xs text-gray-400 font-medium">{t('Sending to', 'الإرسال إلى')}: <span className="text-gray-700 dark:text-gray-300">{commType === 'whatsapp' ? commDeal.leadId?.phone : commDeal.leadId?.email}</span></p>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 dark:border-dark-700">
                <button onClick={closeComm} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">{t('Cancel', 'إلغاء')}</button>
                <button onClick={() => sendComm.mutate()} disabled={sendComm.isPending || !commMsg.trim()} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"><Send className="w-4 h-4" /> {sendComm.isPending ? t('Sending...', 'جاري الإرسال...') : t('Send', 'إرسال')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

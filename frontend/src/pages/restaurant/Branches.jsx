import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Edit3, Trash2, Users, X, Phone, Mail, MapPin, User, Eye, EyeOff,
  Sparkles, PhoneCall, Crown, MapPinned, ChevronRight, Loader2, ArrowRight, ShieldCheck, Store, Globe
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { autoTranslateText } from '../../lib/builtInTranslator'
import { useTranslation } from '../../lib/translations'
import { tenantHasEntitlement } from '../../lib/appEntitlements'

const tCache = new Map()
function useAutoTranslate({ source, sourceLang, targetLang, enabled = true, debounceMs = 120, minLength = 2 }) {
  const [translated, setTranslated] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const timerRef = useRef(null)
  useEffect(() => {
    if (!enabled) return
    const s = String(source || '').trim()
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (!s || s.length < minLength) { setTranslated(''); return }
    const key = `${sourceLang}:${targetLang}:${s}`
    const cached = tCache.get(key)
    if (cached) { setTranslated(cached); return }
    timerRef.current = setTimeout(() => {
      try {
        setIsTranslating(true)
        const t = autoTranslateText(s, sourceLang, targetLang)
        if (t) {
          tCache.set(key, t)
          setTranslated(t)
        }
      } catch (_) { } finally { setIsTranslating(false) }
    }, debounceMs)
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  }, [source, sourceLang, targetLang, enabled, debounceMs, minLength])
  return { translated, isTranslating }
}

export default function RestaurantBranches() {
  const { language } = useSelector(s => s.ui)
  const { tenant, user } = useSelector(s => s.auth)
  const isRtl = language === 'ar'
  const qc = useQueryClient()
  const { t } = useTranslation(language)

  const hasAddon = tenantHasEntitlement(tenant, { appId: 'multi_branch', flag: 'hasBranchAddon' })
  const maxB = tenant?.subscription?.maxBranches || 0
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', nameAr: '', phone: '', email: '', managerName: '', address: { street: '', district: '', city: '', cityAr: '' } })
  const [showUser, setShowUser] = useState(null)
  const [uForm, setUForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'manager' })
  const [showPw, setShowPw] = useState(false)
  const [showUsers, setShowUsers] = useState(null)
  const [autoOn, setAutoOn] = useState(true)

  const { translated: autoAr, isTranslating: tLoading } = useAutoTranslate({
    source: form.name, sourceLang: 'en', targetLang: 'ar',
    enabled: autoOn && !isRtl && !editing && !form.nameAr,
  })
  useEffect(() => { if (autoAr) setForm(p => ({ ...p, nameAr: autoAr })) }, [autoAr])

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'], queryFn: () => api.get('/branches').then(r => r.data), enabled: hasAddon,
  })
  const { data: bUsers = [] } = useQuery({
    queryKey: ['branch-users', showUsers?._id],
    queryFn: () => api.get(`/branches/${showUsers._id}/users`).then(r => r.data),
    enabled: !!showUsers,
  })

  const createM = useMutation({
    mutationFn: (d) => editing ? api.put(`/branches/${editing._id}`, d) : api.post('/branches', d),
    onSuccess: () => {
      toast.success(t('saved'))
      qc.invalidateQueries(['branches'])
      setShowForm(false); setEditing(null)
      setForm({ name: '', nameAr: '', phone: '', email: '', managerName: '', address: { street: '', district: '', city: '', cityAr: '' } })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  })
  const deleteM = useMutation({
    mutationFn: (id) => api.delete(`/branches/${id}`),
    onSuccess: () => { toast.success(t('branchDeleted')); qc.invalidateQueries(['branches']) },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  })
  const createUM = useMutation({
    mutationFn: ({ branchId, data }) => api.post(`/branches/${branchId}/users`, data),
    onSuccess: () => {
      toast.success(t('userCreated'))
      qc.invalidateQueries(['branch-users', showUser?._id])
      setShowUser(null)
      setUForm({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'manager' })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  })
  const deleteUM = useMutation({
    mutationFn: ({ branchId, userId }) => api.delete(`/branches/${branchId}/users/${userId}`),
    onSuccess: () => { toast.success(t('userDeactivated')); qc.invalidateQueries(['branch-users', showUsers?._id]) },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  })

  const openEdit = (b) => {
    setEditing(b)
    setForm({
      name: b.name || '', nameAr: b.nameAr || '', phone: b.phone || '', email: b.email || '',
      managerName: b.managerName || '',
      address: { street: b.address?.street || '', district: b.address?.district || '', city: b.address?.city || '', cityAr: b.address?.cityAr || '' },
    })
    setShowForm(true)
  }
  const openNew = () => {
    setEditing(null)
    setForm({ name: '', nameAr: '', phone: '', email: '', managerName: '', address: { street: '', district: '', city: '', cityAr: '' } })
    setShowForm(true)
  }
  const onSave = () => createM.mutate(form)
  const onSaveUser = () => createUM.mutate({ branchId: showUser._id, data: uForm })

  if (!hasAddon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-amber-50/90 to-orange-50/90 dark:from-dark-800/90 dark:to-dark-900/90 backdrop-blur-xl border border-amber-200/60 dark:border-dark-700/60 rounded-[2.5rem] p-12 max-w-2xl shadow-2xl shadow-amber-500/10 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-400/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-orange-400/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative">
            <div className="w-28 h-28 mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full opacity-20 animate-pulse" />
              <div className="relative w-full h-full bg-white dark:bg-dark-800 rounded-full shadow-xl flex items-center justify-center border border-amber-100 dark:border-dark-700">
                <Building2 className="w-14 h-14 text-amber-600" />
                <div className="absolute -top-1 -right-1 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full p-2 shadow-lg">
                  <Crown className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
              {isRtl ? 'إدارة الفروع المتعددة' : 'Multi-Branch Management'}
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
              {isRtl
                ? 'نظام إدارة الفروع هو خدمة إضافية متميزة. يتيح لك إدارة القوائم، المخزون، والتقارير لكل فرع على حدة من لوحة تحكم واحدة مركزية.'
                : 'Multi-Branch Management is a premium add-on service. Manage menus, inventory, and reports for each branch independently from a single centralized dashboard.'}
            </p>
            <a href="mailto:support@maqder.com"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white font-bold text-lg px-10 py-4 rounded-2xl shadow-xl shadow-amber-500/25 transition-all hover:scale-105 active:scale-95">
              <PhoneCall className="w-5 h-5" />
              {isRtl ? 'تواصل مع فريق مقدر' : 'Contact Maqder Team'}
            </a>
            <div className="mt-10 pt-8 border-t border-amber-200/40 dark:border-dark-700/40 grid grid-cols-3 gap-6">
              {[
                { n: '01', t: isRtl ? 'تقارير مجمعة' : 'Consolidated Reports' },
                { n: '02', t: isRtl ? 'مخزون مركزي' : 'Centralized Inventory' },
                { n: '03', t: isRtl ? 'قوائم مخصصة' : 'Branch-Specific Menus' },
              ].map((item) => (
                <div key={item.n} className="flex flex-col items-center gap-2">
                  <span className="text-amber-600 font-black text-sm">{item.n}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{item.t}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Ultra Premium Header - Light Theme */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} 
        className="relative overflow-hidden rounded-[2rem] bg-white p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        {/* Dynamic Background Effects */}
        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-gradient-to-br from-emerald-50 via-teal-50 to-transparent rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-gradient-to-tr from-green-50 to-transparent rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                <Store className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-emerald-600 text-sm font-bold tracking-[0.2em] uppercase">{isRtl ? t('branchManagementAr') : t('branchManagement')}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-2">
              {t('branchManagement')}
            </h1>
            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
              <span>{t('activeBranches')}</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
              <span className="text-gray-500"><strong className="text-gray-900 text-base">{branches.length}</strong> / {maxB || '∞'}</span>
            </div>
          </div>
          {isAdmin && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={openNew}
              className="relative overflow-hidden inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-bold px-6 py-4 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.35)] transition-all">
              <Plus className="w-5 h-5" />
              <span className="text-base tracking-wide">{t('addBranch')}</span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>
      ) : branches.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-[2.5rem] bg-white p-12 sm:p-24 text-center min-h-[50vh] flex flex-col items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          {/* Rich Ambient Lighting for Empty State */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-full bg-gradient-to-b from-emerald-50 via-teal-50/50 to-transparent rounded-[100%] blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 w-32 h-32 mx-auto mb-10 group">
            <div className="absolute inset-0 bg-emerald-100 rounded-[2.5rem] blur-xl group-hover:bg-emerald-200/60 transition-all duration-500" />
            <div className="absolute inset-0 rounded-[2.5rem] border-2 border-emerald-200 border-dashed animate-[spin_15s_linear_infinite]" />
            <div className="relative w-full h-full bg-white rounded-[2.5rem] shadow-xl shadow-emerald-900/5 flex items-center justify-center border border-gray-50 overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 blur-xl translate-x-1/2 -translate-y-1/2" />
              <Building2 className="w-12 h-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]" />
            </div>
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-4 -right-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full p-2.5 shadow-lg shadow-emerald-500/20 border border-white">
               <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
          </div>
          
          <h3 className="text-3xl sm:text-4xl font-black text-gray-900 mb-5 tracking-tight relative z-10">{t('noBranchesYet')}</h3>
          <p className="text-gray-500 max-w-lg mx-auto mb-12 leading-relaxed text-lg sm:text-xl relative z-10 font-medium">
             {isRtl ? 'قم بإضافة فرعك الأول لبدء إدارة الفروع المتعددة وتوسيع نطاق أعمالك بذكاء.' : 'Add your first branch to start managing multiple locations and scale your business effortlessly.'}
          </p>
          
          {isAdmin && (
             <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={openNew} 
               className="relative z-10 bg-gray-900 text-white px-10 py-5 rounded-2xl font-black shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.2)] flex items-center gap-3 overflow-hidden group transition-all">
               <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
               <Plus className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform relative z-10" />
               <span className="relative z-10 text-lg tracking-wide uppercase">{t('addBranch')}</span>
             </motion.button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {branches.map((b, i) => (
            <motion.div key={b._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="group relative bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-emerald-50 dark:from-primary-900/30 dark:to-emerald-900/20 flex items-center justify-center shadow-inner">
                        <Building2 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-dark-800 flex items-center justify-center">
                        <ShieldCheck className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{b.name}</h3>
                      {b.nameAr && <p className="text-sm text-gray-400 mt-0.5" dir="rtl">{b.nameAr}</p>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(b)} className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl text-gray-400 hover:text-primary-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm(t('confirmDeleteBranch'))) deleteM.mutate(b._id) }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  {b.phone && <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400"><div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-dark-700 flex items-center justify-center"><Phone className="w-3.5 h-3.5" /></div><span className="font-mono">{b.phone}</span></div>}
                  {b.email && <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400"><div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-dark-700 flex items-center justify-center"><Mail className="w-3.5 h-3.5" /></div><span className="truncate">{b.email}</span></div>}
                  {b.address?.city && <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400"><div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-dark-700 flex items-center justify-center"><MapPinned className="w-3.5 h-3.5" /></div><span>{b.address.city}{b.address.district ? `, ${b.address.district}` : ''}</span></div>}
                  {b.managerName && <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400"><div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-dark-700 flex items-center justify-center"><User className="w-3.5 h-3.5" /></div><span>{b.managerName}</span></div>}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-50 dark:border-dark-700/50 flex items-center gap-2">
                  <button onClick={() => setShowUsers(b)} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/50 rounded-xl py-2.5 transition-colors"><Users className="w-4 h-4" />{t('branchUsers')}</button>
                  {isAdmin && <button onClick={() => { setShowUser(b); setUForm({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'manager' }) }} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl py-2.5 transition-colors"><Plus className="w-4 h-4" />{t('addBranchUser')}</button>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Branch Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 sm:p-6" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white dark:bg-dark-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl shadow-primary-500/10 border border-gray-100/50 dark:border-dark-700/50"
              onClick={e => e.stopPropagation()}>
              
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-8 border-b border-gray-100">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-100/50 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
                      <Store className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">{editing ? t('editBranch') : t('newBranch')}</h3>
                      <p className="text-gray-500 text-sm font-medium mt-1">
                        {editing ? (isRtl ? 'تحديث تفاصيل الفرع' : 'Update branch details and settings') : (isRtl ? 'إعداد فرع جديد' : 'Configure your new branch location')}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all shadow-sm">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="label flex items-center justify-between text-gray-700 dark:text-gray-300 font-semibold mb-2">
                      <span>{t('branchName')}</span>
                      {!isRtl && !editing && (
                        <button onClick={() => setAutoOn(p => !p)} className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 transition-all shadow-sm ${autoOn ? 'bg-gradient-to-r from-primary-100 to-emerald-100 text-primary-700 dark:from-primary-900/40 dark:to-emerald-900/40 dark:text-primary-300 border border-primary-200/50' : 'bg-gray-100 text-gray-500 border border-transparent'}`}>
                          <Sparkles className="w-3.5 h-3.5" />{autoOn ? 'Auto-Translate' : 'Manual'}
                        </button>
                      )}
                    </label>
                    <input className="input w-full bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 rounded-xl py-3 focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" placeholder="e.g. Downtown Branch" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label flex items-center gap-2 text-gray-700 dark:text-gray-300 font-semibold mb-2">
                      {t('branchNameAr')} 
                      {tLoading && <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin" />}
                    </label>
                    <input className="input w-full bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 rounded-xl py-3 focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" placeholder="مثال: فرع وسط المدينة" value={form.nameAr} onChange={e => { setAutoOn(false); setForm(p => ({ ...p, nameAr: e.target.value })) }} dir="rtl" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="label text-gray-700 dark:text-gray-300 font-semibold mb-2">{t('branchPhone')}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input className="input w-full pl-10 bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 rounded-xl py-3 focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" placeholder="+966 50 000 0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label text-gray-700 dark:text-gray-300 font-semibold mb-2">{t('branchEmail')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input className="input w-full pl-10 bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 rounded-xl py-3 focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" type="email" placeholder="branch@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label text-gray-700 dark:text-gray-300 font-semibold mb-2">{t('managerName')}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input className="input w-full pl-10 bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 rounded-xl py-3 focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" placeholder="Manager full name" value={form.managerName} onChange={e => setForm(p => ({ ...p, managerName: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white dark:bg-dark-800 p-6 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm">
                  <div>
                    <label className="label text-gray-700 dark:text-gray-300 font-semibold mb-2">{t('city')}</label>
                    <div className="relative">
                       <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                       <input className="input w-full pl-10 bg-gray-50 dark:bg-dark-900 border-gray-200 dark:border-dark-700 rounded-xl py-3 focus:ring-2 focus:ring-primary-500/50 transition-all" placeholder="City" value={form.address.city} onChange={e => setForm(p => ({ ...p, address: { ...p.address, city: e.target.value } }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label text-gray-700 dark:text-gray-300 font-semibold mb-2">{t('district')}</label>
                    <input className="input w-full bg-gray-50 dark:bg-dark-900 border-gray-200 dark:border-dark-700 rounded-xl py-3 focus:ring-2 focus:ring-primary-500/50 transition-all" placeholder="District or Area" value={form.address.district} onChange={e => setForm(p => ({ ...p, address: { ...p.address, district: e.target.value } }))} />
                  </div>
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onSave} disabled={createM.isPending}
                  className="w-full relative overflow-hidden bg-gradient-to-r from-primary-600 to-emerald-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary-500/25 transition-all disabled:opacity-60 flex items-center justify-center gap-2 group border-none">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  {createM.isPending ? <Loader2 className="w-6 h-6 animate-spin relative z-10" /> : <><ArrowRight className="w-5 h-5 relative z-10" /><span className="relative z-10 text-lg">{t('saveBranch')}</span></>}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {showUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowUser(null)}>
            <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-dark-800 w-full max-w-md rounded-3xl shadow-2xl shadow-black/20 border border-gray-100 dark:border-dark-700 overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="relative bg-gradient-to-r from-violet-600 to-purple-500 p-6 pb-8">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"><User className="w-5 h-5 text-white" /></div>
                    <div><h3 className="text-lg font-bold text-white">{t('newBranchUser')}</h3><p className="text-white/70 text-xs">{showUser.name}</p></div>
                  </div>
                  <button onClick={() => setShowUser(null)} className="p-2 hover:bg-white/20 rounded-xl text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">{t('firstName')}</label><input className="input mt-1" value={uForm.firstName} onChange={e => setUForm(p => ({ ...p, firstName: e.target.value }))} /></div>
                  <div><label className="label">{t('lastName')}</label><input className="input mt-1" value={uForm.lastName} onChange={e => setUForm(p => ({ ...p, lastName: e.target.value }))} /></div>
                </div>
                <div><label className="label">{t('email')}</label><input className="input mt-1" type="email" value={uForm.email} onChange={e => setUForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div><label className="label">{t('password')}</label>
                  <div className="relative mt-1">
                    <input className="input pe-10" type={showPw ? 'text' : 'password'} value={uForm.password} onChange={e => setUForm(p => ({ ...p, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPw(p => !p)} className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">{t('branchPhone')}</label><input className="input mt-1" value={uForm.phone} onChange={e => setUForm(p => ({ ...p, phone: e.target.value }))} /></div>
                  <div><label className="label">{t('role')}</label>
                    <select className="select mt-1" value={uForm.role} onChange={e => setUForm(p => ({ ...p, role: e.target.value }))}>
                      <option value="manager">{t('branchManager')}</option>
                      <option value="sales">{t('branchSales')}</option>
                      <option value="kitchen_staff">{t('branchKitchen')}</option>
                      <option value="viewer">{t('branchViewer')}</option>
                    </select>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={onSaveUser} disabled={createUM.isPending}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-violet-500/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {createUM.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-4 h-4" />{t('addBranchUser')}</>}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users List Modal */}
      <AnimatePresence>
        {showUsers && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowUsers(null)}>
            <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-dark-800 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-3xl shadow-2xl shadow-black/20 border border-gray-100 dark:border-dark-700"
              onClick={e => e.stopPropagation()}>
              <div className="relative bg-gradient-to-r from-gray-800 to-gray-900 p-6 pb-8">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
                    <div><h3 className="text-lg font-bold text-white">{showUsers.name}</h3><p className="text-white/60 text-xs">{bUsers.length} {t('branchUsers')}</p></div>
                  </div>
                  <button onClick={() => setShowUsers(null)} className="p-2 hover:bg-white/20 rounded-xl text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6">
                {bUsers.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 dark:bg-dark-700 rounded-2xl flex items-center justify-center"><Users className="w-8 h-8 text-gray-300 dark:text-gray-600" /></div>
                    <p className="text-gray-400 font-medium">{t('noBranchUsers')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bUsers.map(u => (
                      <div key={u._id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50 dark:bg-dark-700/30 border border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-100 to-emerald-50 dark:from-primary-900/30 dark:to-emerald-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${u.isActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400'}`}>{u.isActive ? <ShieldCheck className="w-3 h-3" /> : null}{u.role}</span>
                          {isAdmin && u.isActive && <button onClick={() => deleteUM.mutate({ branchId: showUsers._id, userId: u._id })} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowUser(showUsers); setUForm({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'manager' }); setShowUsers(null) }}
                    className="w-full mt-5 flex items-center justify-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/50 border border-gray-200 dark:border-dark-600 rounded-xl py-3 transition-colors">
                    <Plus className="w-4 h-4" />{t('addBranchUser')}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

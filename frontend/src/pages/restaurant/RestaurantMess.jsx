import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Loader2, Users, Calendar, DollarSign,
  UtensilsCrossed, CheckCircle, Clock, TrendingUp,
  QrCode, FileText, Trash2, Edit3, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

const MEAL_LABELS = {
  breakfast: { en: 'Breakfast', ar: 'فطور' },
  lunch: { en: 'Lunch', ar: 'غداء' },
  dinner: { en: 'Dinner', ar: 'عشاء' },
  snack: { en: 'Snack', ar: 'سناك' },
}

const BILLING_MODE_LABELS = {
  fixed: { en: 'Fixed', ar: 'ثابت' },
  attendance_based: { en: 'Per Meal', ar: 'لكل وجبة' },
  hybrid: { en: 'Base + Per Meal', ar: 'أساسي + لكل وجبة' },
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
  { id: 'plans', label: 'Plans', icon: UtensilsCrossed },
  { id: 'subscribers', label: 'Subscribers', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'billing', label: 'Billing', icon: DollarSign },
]

function PlanModal({ onClose, editPlan }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: editPlan?.name || '',
    nameAr: editPlan?.nameAr || '',
    description: editPlan?.description || '',
    meals: editPlan?.meals || ['lunch', 'dinner'],
    billingCycle: editPlan?.billingCycle || 'monthly',
    pricePerCycle: editPlan?.pricePerCycle || 0,
    pricePerMeal: editPlan?.pricePerMeal || 0,
    billingMode: editPlan?.billingMode || 'fixed',
    basePrice: editPlan?.basePrice || 0,
    maxSubscribers: editPlan?.maxSubscribers || 0,
  })

  const mutation = useMutation({
    mutationFn: (data) => editPlan
      ? api.put(`/restaurant/mess/plans/${editPlan._id}`, data)
      : api.post('/restaurant/mess/plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mess-plans'] })
      toast.success(editPlan ? 'Plan updated' : 'Plan created')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const handleSubmit = () => {
    if (!form.name) return toast.error('Name required')
    mutation.mutate({
      ...form,
      pricePerCycle: Number(form.pricePerCycle) || 0,
      pricePerMeal: Number(form.pricePerMeal) || 0,
      basePrice: Number(form.basePrice) || 0,
      maxSubscribers: Number(form.maxSubscribers) || 0,
    })
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700 sticky top-0 bg-white dark:bg-dark-800 z-10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{editPlan ? 'Edit Plan' : 'New Meal Plan'}</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Monthly Full Board" />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" dir="rtl" />
              </div>
            </div>
            <div>
              <label className="label">Meals Included</label>
              <div className="flex gap-2">
                {Object.entries(MEAL_LABELS).map(([key, val]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, meals: f.meals.includes(key) ? f.meals.filter(m => m !== key) : [...f.meals, key] }))}
                    className={`px-3 py-1.5 rounded-lg text-sm ${form.meals.includes(key) ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-500'}`}>
                    {val.en}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Billing Cycle</label>
                <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className="select">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label className="label">Billing Mode</label>
                <select value={form.billingMode} onChange={(e) => setForm({ ...form, billingMode: e.target.value })} className="select">
                  <option value="fixed">Fixed (pay full)</option>
                  <option value="attendance_based">Per Meal (attendance)</option>
                  <option value="hybrid">Base + Per Meal</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Price per Cycle</label>
                <input type="number" step="0.01" min="0" value={form.pricePerCycle} onChange={(e) => setForm({ ...form, pricePerCycle: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Price per Meal</label>
                <input type="number" step="0.01" min="0" value={form.pricePerMeal} onChange={(e) => setForm({ ...form, pricePerMeal: e.target.value })} className="input" />
              </div>
            </div>
            {form.billingMode === 'hybrid' && (
              <div>
                <label className="label">Base Price</label>
                <input type="number" step="0.01" min="0" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="input" />
              </div>
            )}
            <div>
              <label className="label">Max Subscribers (0=unlimited)</label>
              <input type="number" min="0" value={form.maxSubscribers} onChange={(e) => setForm({ ...form, maxSubscribers: e.target.value })} className="input" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-dark-700 sticky bottom-0 bg-white dark:bg-dark-800">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={mutation.isPending} className="btn btn-action-dark flex items-center gap-1.5">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editPlan ? 'Update' : 'Create'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function SubscriberModal({ plans, onClose, editSubscriber }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    planId: editSubscriber?.planId?._id || editSubscriber?.planId || '',
    name: editSubscriber?.name || '',
    nameAr: editSubscriber?.nameAr || '',
    phone: editSubscriber?.phone || '',
    employeeId: editSubscriber?.employeeId || '',
    idNumber: editSubscriber?.idNumber || '',
    companyName: editSubscriber?.companyName || '',
    sponsorName: editSubscriber?.sponsorName || '',
    sponsorPhone: editSubscriber?.sponsorPhone || '',
    startDate: editSubscriber?.startDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    endDate: editSubscriber?.endDate?.split('T')[0] || '',
    billingMode: editSubscriber?.billingMode || 'fixed',
    dietaryRestrictions: editSubscriber?.dietaryRestrictions || '',
    notes: editSubscriber?.notes || '',
  })

  const mutation = useMutation({
    mutationFn: (data) => editSubscriber
      ? api.put(`/restaurant/mess/subscribers/${editSubscriber._id}`, data)
      : api.post('/restaurant/mess/subscribers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mess-subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['mess-dashboard'] })
      toast.success(editSubscriber ? 'Subscriber updated' : 'Subscriber enrolled')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const handleSubmit = () => {
    if (!form.name) return toast.error('Name required')
    if (!form.planId) return toast.error('Plan required')
    mutation.mutate({
      ...form,
      startDate: new Date(form.startDate),
      endDate: form.endDate ? new Date(form.endDate) : undefined,
    })
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700 sticky top-0 bg-white dark:bg-dark-800 z-10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{editSubscriber ? 'Edit Subscriber' : 'Enroll Subscriber'}</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Meal Plan *</label>
              <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} className="select">
                <option value="">Select plan...</option>
                {plans.map(p => <option key={p._id} value={p._id}>{p.name} — {p.pricePerCycle}/{p.billingCycle}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Employee ID</label>
                <input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">ID / Iqama Number</label>
                <input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Company Name</label>
                <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sponsor Name</label>
                <input value={form.sponsorName} onChange={(e) => setForm({ ...form, sponsorName: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Sponsor Phone</label>
                <input value={form.sponsorPhone} onChange={(e) => setForm({ ...form, sponsorPhone: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Date *</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">End Date (optional)</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Billing Mode</label>
              <select value={form.billingMode} onChange={(e) => setForm({ ...form, billingMode: e.target.value })} className="select">
                <option value="fixed">Fixed</option>
                <option value="attendance_based">Per Meal (attendance)</option>
                <option value="hybrid">Base + Per Meal</option>
              </select>
            </div>
            <div>
              <label className="label">Dietary Restrictions</label>
              <input value={form.dietaryRestrictions} onChange={(e) => setForm({ ...form, dietaryRestrictions: e.target.value })} className="input" placeholder="Vegetarian, allergies, etc." />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-dark-700 sticky bottom-0 bg-white dark:bg-dark-800">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={mutation.isPending} className="btn btn-action-dark flex items-center gap-1.5">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editSubscriber ? 'Update' : 'Enroll'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function RestaurantMess() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()
  const isRtl = language === 'ar'
  
  const hasMessAddon = tenant?.subscription?.hasMessAddon;
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editPlan, setEditPlan] = useState(null)
  const [showSubModal, setShowSubModal] = useState(false)
  const [editSubscriber, setEditSubscriber] = useState(null)
  const [search, setSearch] = useState('')
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0])
  const [attMeal, setAttMeal] = useState('lunch')
  const [billingMonth, setBillingMonth] = useState(new Date().getMonth())
  const [billingYear, setBillingYear] = useState(new Date().getFullYear())

  // Dashboard
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['mess-dashboard'],
    queryFn: () => api.get('/restaurant/mess/dashboard').then(res => res.data),
    enabled: activeTab === 'dashboard',
  })

  // Plans
  const { data: plans = [] } = useQuery({
    queryKey: ['mess-plans'],
    queryFn: () => api.get('/restaurant/mess/plans').then(res => res.data),
  })

  // Subscribers
  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['mess-subscribers', search],
    queryFn: () => api.get('/restaurant/mess/subscribers', { params: { search, limit: 100 } }).then(res => res.data),
    enabled: activeTab === 'subscribers',
  })

  // Attendance
  const { data: attData, isLoading: attLoading } = useQuery({
    queryKey: ['mess-attendance', attDate, attMeal],
    queryFn: () => api.get('/restaurant/mess/attendance', { params: { date: attDate, meal: attMeal } }).then(res => res.data),
    enabled: activeTab === 'attendance',
  })

  // Billing
  const { data: billData, isLoading: billLoading } = useQuery({
    queryKey: ['mess-billing'],
    queryFn: () => api.get('/restaurant/mess/billing', { params: { limit: 100 } }).then(res => res.data),
    enabled: activeTab === 'billing',
  })

  // Mutations
  const deletePlanMutation = useMutation({
    mutationFn: (id) => api.delete(`/restaurant/mess/plans/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mess-plans'] }); toast.success('Plan deactivated') },
  })

  const deleteSubMutation = useMutation({
    mutationFn: (id) => api.delete(`/restaurant/mess/subscribers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mess-subscribers'] }); queryClient.invalidateQueries({ queryKey: ['mess-dashboard'] }); toast.success('Subscriber cancelled') },
  })

  const attMutation = useMutation({
    mutationFn: (entries) => api.post('/restaurant/mess/attendance', { entries }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mess-attendance'] }); toast.success('Attendance updated') },
  })

  const generateBillingMutation = useMutation({
    mutationFn: () => api.post('/restaurant/mess/billing/generate', { month: billingMonth, year: billingYear }),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['mess-billing'] }); toast.success(res.data?.message || 'Billing generated') },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const payMutation = useMutation({
    mutationFn: (id) => api.put(`/restaurant/mess/billing/${id}/pay`, { paymentMethod: 'cash' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mess-billing'] }); toast.success('Marked as paid') },
  })

  const togglePresent = (subscriberId, planId, currentStatus) => {
    const newStatus = currentStatus === 'present' ? 'absent' : 'present'
    attMutation.mutate([{ subscriberId, planId, date: attDate, meal: attMeal, status: newStatus }])
  }

  const markAllPresent = () => {
    const entries = (attData?.attendance || [])
      .filter(a => a.status !== 'present')
      .map(a => ({ subscriberId: a.subscriberId, planId: a.planId || plans[0]?._id, date: attDate, meal: attMeal, status: 'present' }))
    if (entries.length === 0) return toast.success('All already present')
    attMutation.mutate(entries)
  }

  const summary = dashData?.summary || {}
  const subscribers = subData?.subscribers || []
  const billings = billData?.billings || []
  const billSummary = billData?.summary || {}

  if (!hasMessAddon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-gradient-to-b from-gray-50 to-white dark:from-dark-900 dark:to-dark-800 rounded-3xl border border-gray-100 dark:border-dark-700 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative w-24 h-24 mb-6 rounded-full bg-white dark:bg-dark-800 shadow-2xl flex items-center justify-center border border-gray-100 dark:border-dark-600">
           <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-dashed animate-[spin_10s_linear_infinite] opacity-20" />
           <UtensilsCrossed className="w-10 h-10 text-indigo-500" />
        </div>
        
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
          {isRtl ? 'إضافة المطعم الجماعي' : 'Mess & Cafeteria Add-on'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
          {isRtl 
            ? 'احصل على نظام متكامل لإدارة الاشتراكات، الحضور، والفوترة الشهرية للوجبات الجماعية.' 
            : 'Unlock a comprehensive system for managing meal subscriptions, daily attendance, and automated billing for your cafeteria.'}
        </p>
        
        <a href="mailto:support@maqder.com" className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition-all hover:scale-105">
           <Plus className="w-5 h-5" />
           {isRtl ? 'تواصل معنا للتفعيل' : 'Contact Sales to Enable'}
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isRtl ? 'نظام المطعم الجماعي' : 'Mess / Cafeteria'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {isRtl ? 'إدارة الاشتراكات والحضور والفوترة' : 'Subscription, attendance & billing for mess/cafeteria'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-dark-700 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          {dashLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Plans', value: summary.plans || 0, icon: UtensilsCrossed, color: 'from-violet-500 to-violet-600' },
                  { label: 'Subscribers', value: summary.activeSubscribers || 0, icon: Users, color: 'from-blue-500 to-blue-600' },
                  { label: 'Today Meals', value: summary.todayAttendance || 0, icon: CheckCircle, color: 'from-emerald-500 to-emerald-600' },
                  { label: 'Pending Bills', value: summary.pendingBillings || 0, icon: Clock, color: 'from-amber-500 to-amber-600' },
                  { label: 'Revenue', value: <Money value={summary.monthlyRevenue || 0} />, icon: DollarSign, color: 'from-emerald-600 to-teal-600' },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} shadow-sm w-fit mb-2`}>
                      <s.icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Plan Distribution */}
              {dashData?.planDistribution?.length > 0 && (
                <div className="card p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Subscribers by Plan</h3>
                  <div className="space-y-2">
                    {dashData.planDistribution.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.planName}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Subscribers */}
              {dashData?.recentSubscribers?.length > 0 && (
                <div className="card p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Recent Enrollments</h3>
                  <div className="space-y-2">
                    {dashData.recentSubscribers.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</span>
                          {s.phone && <span className="text-xs text-gray-400 ml-2">{s.phone}</span>}
                        </div>
                        <span className="text-xs text-gray-400">{s.planId?.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => { setEditPlan(null); setShowPlanModal(true) }} className="btn btn-action-dark flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(p => (
              <div key={p._id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
                    {p.nameAr && <p className="text-xs text-gray-400" dir="rtl">{p.nameAr}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditPlan(p); setShowPlanModal(true) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Deactivate plan?')) deletePlanMutation.mutate(p._id) }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {p.description && <p className="text-xs text-gray-500 mb-3">{p.description}</p>}
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.meals?.map(m => <span key={m} className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs">{MEAL_LABELS[m]?.en || m}</span>)}
                </div>
                <div className="flex items-end justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                  <div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white"><Money value={p.pricePerCycle} /></span>
                    <span className="text-xs text-gray-400">/{p.billingCycle}</span>
                  </div>
                  <span className="text-xs text-gray-400">{BILLING_MODE_LABELS[p.billingMode]?.en}</span>
                </div>
              </div>
            ))}
            {plans.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">No plans yet</div>}
          </div>
        </>
      )}

      {/* Subscribers Tab */}
      {activeTab === 'subscribers' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, ID..." className="input pl-10" />
            </div>
            <button onClick={() => { setEditSubscriber(null); setShowSubModal(true) }} className="btn btn-action-dark flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Enroll
            </button>
          </div>
          {subLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Phone</th><th>Employee ID</th><th>Company</th><th>Plan</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map(s => (
                      <tr key={s._id}>
                        <td className="font-medium text-gray-900 dark:text-white">{s.name}</td>
                        <td className="text-sm text-gray-500">{s.phone || '-'}</td>
                        <td className="text-sm text-gray-500">{s.employeeId || '-'}</td>
                        <td className="text-sm text-gray-500">{s.companyName || '-'}</td>
                        <td className="text-sm">{s.planId?.name || '-'}</td>
                        <td>
                          <span className={`badge ${s.status === 'active' ? 'badge-success' : s.status === 'paused' ? 'badge-warning' : 'badge-neutral'}`}>{s.status}</span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditSubscriber(s); setShowSubModal(true) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { if (confirm('Cancel subscription?')) deleteSubMutation.mutate(s._id) }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {subscribers.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">No subscribers</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className="input w-auto" />
            </div>
            <div className="flex gap-1">
              {Object.entries(MEAL_LABELS).map(([key, val]) => (
                <button key={key} onClick={() => setAttMeal(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${attMeal === key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-500'}`}>
                  {val.en}
                </button>
              ))}
            </div>
            <button onClick={markAllPresent} disabled={attMutation.isPending} className="btn btn-secondary btn-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border-transparent ml-auto">
              <CheckCircle className="w-4 h-4" /> Mark All Present
            </button>
          </div>

          {attLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-3 text-center"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-gray-900 dark:text-white">{attData?.summary?.total || 0}</p></div>
                <div className="card p-3 text-center"><p className="text-xs text-gray-500">Present</p><p className="text-lg font-bold text-emerald-600">{attData?.summary?.present || 0}</p></div>
                <div className="card p-3 text-center"><p className="text-xs text-gray-500">Absent</p><p className="text-lg font-bold text-red-500">{attData?.summary?.absent || 0}</p></div>
              </div>

              <div className="card overflow-hidden">
                <div className="divide-y divide-gray-200 dark:divide-dark-700">
                  {(attData?.attendance || []).map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${a.status === 'present' ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-dark-600 text-gray-500'}`}>
                          {a.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.employeeId || a.phone || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.checkInTime && <span className="text-xs text-gray-400">{new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        <button onClick={() => togglePresent(a.subscriberId, a.planId, a.status)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${a.status === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 dark:bg-dark-700 text-gray-500'}`}>
                          {a.status === 'present' ? 'Present' : 'Absent'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {(attData?.attendance || []).length === 0 && <div className="p-8 text-center text-gray-400">No subscribers</div>}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select value={billingMonth} onChange={(e) => setBillingMonth(Number(e.target.value))} className="select w-auto">
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={billingYear} onChange={(e) => setBillingYear(Number(e.target.value))} className="select w-auto">
              {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => generateBillingMutation.mutate()} disabled={generateBillingMutation.isPending}
              className="btn btn-action-dark flex items-center gap-1.5">
              {generateBillingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generate Billing
            </button>
          </div>

          {/* Billing Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-3 text-center"><p className="text-xs text-gray-500">Pending</p><p className="text-lg font-bold text-amber-600">{billSummary.pending?.count || 0}</p><p className="text-xs text-gray-400"><Money value={billSummary.pending?.totalAmount || 0} /></p></div>
            <div className="card p-3 text-center"><p className="text-xs text-gray-500">Paid</p><p className="text-lg font-bold text-emerald-600">{billSummary.paid?.count || 0}</p><p className="text-xs text-gray-400"><Money value={billSummary.paid?.totalAmount || 0} /></p></div>
            <div className="card p-3 text-center"><p className="text-xs text-gray-500">Overdue</p><p className="text-lg font-bold text-red-600">{billSummary.overdue?.count || 0}</p><p className="text-xs text-gray-400"><Money value={billSummary.overdue?.totalAmount || 0} /></p></div>
          </div>

          {billLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Subscriber</th><th>Period</th><th>Meals</th><th>Mode</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {billings.map(b => (
                      <tr key={b._id}>
                        <td className="font-medium text-gray-900 dark:text-white">{b.subscriberId?.name || '-'}</td>
                        <td className="text-sm text-gray-500">{b.periodLabel}</td>
                        <td className="text-sm text-gray-500">{b.totalMeals}</td>
                        <td className="text-sm text-gray-500">{b.billingMode}</td>
                        <td className="font-semibold"><Money value={b.totalAmount} /></td>
                        <td><span className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'overdue' ? 'badge-danger' : 'badge-warning'}`}>{b.status}</span></td>
                        <td>
                          {b.status === 'pending' && (
                            <button onClick={() => payMutation.mutate(b._id)} disabled={payMutation.isPending}
                              className="text-xs text-emerald-600 hover:underline">Mark Paid</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {billings.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">No billing records</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showPlanModal && <PlanModal onClose={() => { setShowPlanModal(false); setEditPlan(null) }} editPlan={editPlan} />}
      {showSubModal && <SubscriberModal plans={plans} onClose={() => { setShowSubModal(false); setEditSubscriber(null) }} editSubscriber={editSubscriber} />}
    </div>
  )
}

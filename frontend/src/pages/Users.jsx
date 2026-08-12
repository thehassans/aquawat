import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, X, Save, Shield, CheckCircle2,
  UserPlus, Users as UsersIcon, UserCheck, AlertTriangle,
  ChevronRight, Eye, EyeOff, Mail, Phone,
  Lock, Fingerprint, Sliders
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { getTenantBusinessTypes } from '../lib/businessTypes'

const MODULES = [
  { key: 'invoicing', labelEn: 'Invoicing', labelAr: 'الفوترة', icon: '🧾' },
  { key: 'inventory', labelEn: 'Inventory', labelAr: 'المخزون', icon: '📦' },
  { key: 'supply_chain', labelEn: 'Supply Chain', labelAr: 'سلسلة التوريد', icon: '🔗' },
  { key: 'travel', labelEn: 'Travel', labelAr: 'السفر', icon: '✈️' },
  { key: 'restaurant', labelEn: 'Restaurant', labelAr: 'المطعم', icon: '🍽️' },
  { key: 'project_management', labelEn: 'Project Mgmt', labelAr: 'إدارة المشاريع', icon: '📋' },
  { key: 'hr', labelEn: 'HR', labelAr: 'الموارد البشرية', icon: '👥' },
  { key: 'payroll', labelEn: 'Payroll', labelAr: 'الرواتب', icon: '💰' },
  { key: 'finance', labelEn: 'Finance', labelAr: 'المالية', icon: '📊' },
  { key: 'job_costing', labelEn: 'Job Costing', labelAr: 'تكلفة الأعمال', icon: '🏗️' },
  { key: 'mrp', labelEn: 'MRP', labelAr: 'MRP', icon: '⚙️' },
  { key: 'iot', labelEn: 'IoT', labelAr: 'إنترنت الأشياء', icon: '📡' },
  { key: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات', icon: '🔧' },
]

const ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'export']

const ACTION_COLORS = {
  create: 'from-emerald-500 to-green-500',
  read: 'from-blue-500 to-sky-500',
  update: 'from-amber-500 to-yellow-500',
  delete: 'from-red-500 to-rose-500',
  approve: 'from-violet-500 to-purple-500',
  export: 'from-cyan-500 to-teal-500',
}

const ROLE_PRESETS = {
  admin: 'ALL',
  manager: {
    invoicing: ['create', 'read', 'update', 'approve', 'export'],
    inventory: ['create', 'read', 'update', 'export'],
    supply_chain: ['create', 'read', 'update', 'export'],
    travel: ['create', 'read', 'update', 'export'],
    restaurant: ['create', 'read', 'update', 'export'],
    project_management: ['create', 'read', 'update', 'export'],
    hr: ['read', 'update', 'export'],
    payroll: ['read', 'update', 'approve', 'export'],
    finance: ['create', 'read', 'update', 'approve', 'export'],
    job_costing: ['create', 'read', 'update', 'export'],
    mrp: ['read', 'update'],
    iot: ['read'],
    settings: ['read'],
  },
  accountant: {
    invoicing: ['create', 'read', 'update', 'approve', 'export'],
    finance: ['create', 'read', 'update', 'approve', 'export'],
    payroll: ['read', 'export'],
    settings: ['read'],
  },
  hr_manager: {
    hr: ['create', 'read', 'update', 'delete', 'export'],
    payroll: ['create', 'read', 'update', 'approve', 'export'],
    settings: ['read'],
  },
  inventory_manager: {
    inventory: ['create', 'read', 'update', 'delete', 'export'],
    supply_chain: ['create', 'read', 'update', 'export'],
    mrp: ['read', 'update'],
    settings: ['read'],
  },
  sales: {
    invoicing: ['create', 'read', 'update', 'export'],
    inventory: ['read'],
    travel: ['create', 'read', 'update'],
  },
  kitchen_staff: {
    restaurant: ['read', 'update'],
  },
  viewer: {
    invoicing: ['read'],
    inventory: ['read'],
    hr: ['read'],
    finance: ['read'],
  },
}

const ROLE_COLORS = {
  admin: 'from-rose-500 to-pink-500',
  manager: 'from-violet-500 to-purple-500',
  accountant: 'from-blue-500 to-sky-500',
  hr_manager: 'from-amber-500 to-orange-500',
  inventory_manager: 'from-emerald-500 to-green-500',
  sales: 'from-cyan-500 to-teal-500',
  kitchen_staff: 'from-orange-500 to-red-500',
  viewer: 'from-gray-400 to-gray-500',
}

function Avatar({ user, size = 'md' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }
  const role = user?.role || 'viewer'
  const gradient = ROLE_COLORS[role] || 'from-gray-400 to-gray-500'
  return (
    <div className={`${sizes[size]} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0`}>
      {user?.firstName?.[0]}{user?.lastName?.[0]}
    </div>
  )
}

function PermToggle({ active, label, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all duration-200 overflow-hidden ${
        active
          ? 'text-white border-transparent shadow-md scale-[1.02]'
          : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-dark-500'
      }`}
    >
      {active && (
        <span className={`absolute inset-0 bg-gradient-to-r ${color} opacity-100`} />
      )}
      <span className="relative z-10 uppercase tracking-wide">{label}</span>
    </button>
  )
}

export default function Users() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [activeSection, setActiveSection] = useState('info') // 'info' | 'permissions'

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      firstName: '', lastName: '', firstNameAr: '', lastNameAr: '',
      email: '', phone: '', password: '', role: 'viewer',
      isActive: true, permissions: [], sendWelcomeEmail: true,
    },
  })

  const permissions = watch('permissions')
  const watchedRole = watch('role')

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-users', page, search],
    queryFn: () => api.get('/users', { params: { page, limit: 25, search } }).then((res) => res.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['tenant-users-stats'],
    queryFn: () => api.get('/users/stats').then((res) => res.data),
  })

  const users = data?.users || []
  const pagination = data?.pagination
  const maxUsers = Number(stats?.maxUsers ?? 0)
  const activeUsers = Number(stats?.activeUsers ?? 0)
  const isLimitEnabled = Number.isFinite(maxUsers) && maxUsers > 0
  const isAtLimit = isLimitEnabled && activeUsers >= maxUsers
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)

  const enabledModules = useMemo(() => {
    const blocked = new Set()
    if (!tenantBusinessTypes.includes('travel_agency')) blocked.add('travel')
    if (!tenantBusinessTypes.includes('restaurant')) blocked.add('restaurant')
    return MODULES.filter((module) => !blocked.has(module.key))
  }, [tenantBusinessTypes])

  const roles = useMemo(
    () =>
      [
        { key: 'admin', label: language === 'ar' ? 'مشرف' : 'Admin' },
        { key: 'manager', label: language === 'ar' ? 'مدير' : 'Manager' },
        { key: 'accountant', label: language === 'ar' ? 'محاسب' : 'Accountant' },
        { key: 'hr_manager', label: language === 'ar' ? 'مدير موارد بشرية' : 'HR Manager' },
        { key: 'inventory_manager', label: language === 'ar' ? 'مدير مخزون' : 'Inventory Manager' },
        { key: 'kitchen_staff', label: language === 'ar' ? 'طاقم مطبخ' : 'Kitchen Staff' },
        { key: 'sales', label: language === 'ar' ? 'مبيعات' : 'Sales' },
        { key: 'viewer', label: language === 'ar' ? 'مشاهدة فقط' : 'Viewer' },
      ].filter((role) => role.key !== 'kitchen_staff' || tenantBusinessTypes.includes('restaurant')),
    [language, tenantBusinessTypes]
  )

  const openPanel = (u = null) => {
    setEditingUser(u)
    setActiveSection('info')
    if (u) {
      reset({
        firstName: u?.firstName || '', lastName: u?.lastName || '',
        firstNameAr: u?.firstNameAr || '', lastNameAr: u?.lastNameAr || '',
        email: u?.email || '', phone: u?.phone || '', password: '',
        role: u?.role || 'viewer',
        isActive: typeof u?.isActive === 'boolean' ? u.isActive : true,
        permissions: Array.isArray(u?.permissions) ? u.permissions : [],
        sendWelcomeEmail: false,
      })
    } else {
      reset({
        firstName: '', lastName: '', firstNameAr: '', lastNameAr: '',
        email: '', phone: '', password: '',
        role: roles[0]?.key || 'viewer',
        isActive: true,
        permissions: [],
        sendWelcomeEmail: true,
      })
    }
    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    setEditingUser(null)
    reset({ firstName: '', lastName: '', firstNameAr: '', lastNameAr: '', email: '', phone: '', password: '', role: roles[0]?.key || 'viewer', isActive: true, permissions: [], sendWelcomeEmail: true })
  }

  const mutation = useMutation({
    mutationFn: (payload) => (editingUser ? api.put(`/users/${editingUser._id}`, payload) : api.post('/users', payload)),
    onSuccess: (res) => {
      const data = res?.data || res
      if (editingUser) {
        toast.success(language === 'ar' ? 'تم تحديث المستخدم' : 'User updated')
      } else if (data?.inviteEmailSent) {
        toast.success(language === 'ar' ? 'تم إنشاء المستخدم وإرسال دعوة بالبريد' : 'User created and welcome email sent')
      } else if (data?.inviteEmailError) {
        toast.success(language === 'ar' ? 'تم إنشاء المستخدم (تعذر إرسال البريد)' : 'User created (welcome email failed)')
      } else {
        toast.success(language === 'ar' ? 'تم إنشاء المستخدم' : 'User created')
      }
      queryClient.invalidateQueries(['tenant-users'])
      queryClient.invalidateQueries(['tenant-users-stats'])
      closePanel()
    },
    onError: (err) => toast.error(err.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إلغاء تفعيل المستخدم' : 'User deactivated')
      queryClient.invalidateQueries(['tenant-users'])
      queryClient.invalidateQueries(['tenant-users-stats'])
    },
    onError: (err) => toast.error(err.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error')),
  })

  const permMap = useMemo(() => {
    const list = Array.isArray(permissions) ? permissions : []
    const map = new Map()
    for (const p of list) {
      if (!p?.module) continue
      map.set(String(p.module), new Set(Array.isArray(p.actions) ? p.actions : []))
    }
    return map
  }, [permissions])

  const setPermMap = (nextMap) => {
    const next = []
    for (const [module, actionsSet] of nextMap.entries()) {
      const actions = [...actionsSet]
      if (actions.length === 0) continue
      next.push({ module, actions })
    }
    setValue('permissions', next, { shouldDirty: true })
  }

  const toggleAction = (module, action) => {
    const next = new Map(permMap)
    const set = next.get(module) ? new Set(next.get(module)) : new Set()
    if (set.has(action)) set.delete(action)
    else set.add(action)
    if (set.size === 0) next.delete(module)
    else next.set(module, set)
    setPermMap(next)
  }

  const toggleAllForModule = (module, enabled) => {
    const next = new Map(permMap)
    if (!enabled) next.delete(module)
    else next.set(module, new Set(ACTIONS))
    setPermMap(next)
  }

  const totalPermCount = useMemo(() => {
    let count = 0
    for (const set of permMap.values()) count += set.size
    return count
  }, [permMap])

  const onSubmit = (form) => {
    const payload = {
      ...form,
      email: String(form.email || '').trim().toLowerCase(),
      permissions: Array.isArray(form.permissions) ? form.permissions : [],
      sendWelcomeEmail: editingUser ? false : Boolean(form.sendWelcomeEmail),
      inviteLanguage: language === 'ar' ? 'ar' : 'en',
    }
    if (!payload.password) delete payload.password
    mutation.mutate(payload)
  }

  const roleGradient = ROLE_COLORS[watchedRole] || 'from-gray-400 to-gray-500'

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-teal-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <UsersIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('users')}</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm ms-12">
            {language === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'Manage users and permissions'}
          </p>
        </div>
        <button
          onClick={() => openPanel()}
          disabled={isAtLimit}
          className="btn btn-primary"
        >
          <UserPlus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{language === 'ar' ? 'المستخدمون النشطون' : 'Active Users'}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeUsers}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{language === 'ar' ? 'الحد الأقصى' : 'Max Users'}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{isLimitEnabled ? maxUsers : '∞'}</p>
          </div>
        </div>
        <div className={`card p-4 flex items-center gap-4 ${isAtLimit ? 'border-amber-300 dark:border-amber-600' : ''}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAtLimit ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
            {isAtLimit
              ? <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            }
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</p>
            <p className={`text-sm font-bold mt-0.5 ${isAtLimit ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {isAtLimit ? (language === 'ar' ? 'الحد مكتمل' : 'Limit Reached') : (language === 'ar' ? 'متاح' : 'Available')}
            </p>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1">
        {/* Users List */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-3 space-y-4">
          {/* Search */}
          <div className="card p-4">
            <div className="relative">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`${t('search')}...`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="input ps-10"
              />
            </div>
          </div>

          {/* User Cards */}
          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-dark-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 dark:bg-dark-600 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <AnimatePresence>
                {users.map((u, i) => (
                  <motion.div
                    key={u._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`card p-4 cursor-pointer transition-all hover:shadow-md group ${
                      panelOpen && editingUser?._id === u._id
                        ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10'
                        : 'hover:border-gray-200 dark:hover:border-dark-600'
                    }`}
                    onClick={() => openPanel(u)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar user={u} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                            {u.firstName} {u.lastName}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-gradient-to-r ${ROLE_COLORS[u.role] || 'from-gray-400 to-gray-500'} flex-shrink-0`}>
                            {u.role}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <button
                          onClick={(e) => { e.stopPropagation(); if (u.isActive) deleteMutation.mutate(u._id) }}
                          disabled={deleteMutation.isPending || !u.isActive}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-30"
                          title={language === 'ar' ? 'إلغاء تفعيل' : 'Deactivate'}
                        >
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </button>
                        <ChevronRight className={`w-4 h-4 transition-transform ${panelOpen && editingUser?._id === u._id ? 'text-primary-500 rotate-90' : 'text-gray-300 dark:text-gray-600'}`} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {!isLoading && users.length === 0 && (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-dark-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UsersIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-4">{language === 'ar' ? 'لا يوجد مستخدمون' : 'No users yet'}</p>
                <button onClick={() => openPanel()} className="btn btn-primary">
                  <UserPlus className="w-4 h-4" />
                  {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                </button>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination?.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn btn-secondary">
                {language === 'ar' ? 'السابق' : 'Previous'}
              </button>
              <span className="text-sm text-gray-500">
                {language === 'ar' ? `${pagination.page} / ${pagination.pages}` : `${pagination.page} / ${pagination.pages}`}
              </span>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} className="btn btn-secondary">
                {language === 'ar' ? 'التالي' : 'Next'}
              </button>
            </div>
          )}
        </motion.div>

        {/* Side Panel */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-2">
          <div className="card sticky top-6 overflow-hidden">
            <AnimatePresence mode="wait">
              {!panelOpen ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 text-center"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500/10 to-teal-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Fingerprint className="w-8 h-8 text-primary-500" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">
                    {language === 'ar' ? 'إدارة الصلاحيات' : 'Manage Access'}
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
                    {language === 'ar'
                      ? 'اختر مستخدماً من القائمة لتحرير بياناته وصلاحياته'
                      : 'Select a user from the list to edit their details and permissions'}
                  </p>
                  <button onClick={() => openPanel()} disabled={isAtLimit} className="btn btn-primary w-full">
                    <UserPlus className="w-4 h-4" />
                    {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {/* Panel Header */}
                  <div className="relative overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-r ${roleGradient} opacity-10`} />
                    <div className="relative p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {editingUser ? (
                          <Avatar user={{ ...editingUser, role: watchedRole }} size="md" />
                        ) : (
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleGradient} flex items-center justify-center shadow-lg`}>
                            <UserPlus className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {editingUser ? (language === 'ar' ? 'تعديل مستخدم' : 'Edit User') : (language === 'ar' ? 'مستخدم جديد' : 'New User')}
                          </p>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">
                            {editingUser ? `${editingUser.firstName} ${editingUser.lastName}` : (language === 'ar' ? 'إنشاء مستخدم' : 'Create User')}
                          </p>
                        </div>
                      </div>
                      <button onClick={closePanel} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex border-t border-gray-100 dark:border-dark-700">
                      <button
                        type="button"
                        onClick={() => setActiveSection('info')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all ${
                          activeSection === 'info'
                            ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {language === 'ar' ? 'المعلومات' : 'Info'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSection('permissions')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all ${
                          activeSection === 'permissions'
                            ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
                        {totalPermCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-primary-500 text-white rounded-full text-[10px] font-bold">
                            {totalPermCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                      <AnimatePresence mode="wait">
                        {activeSection === 'info' ? (
                          <motion.div
                            key="info"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-5 space-y-4"
                          >
                            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-white/10 dark:from-dark-900/60 dark:to-dark-800">
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
                                {language === 'ar' ? 'الهوية' : 'Identity'}
                              </p>
                              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" dir="ltr">
                                <div>
                                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                                    <span>First Name *</span>
                                    <span dir="rtl" className="font-medium text-gray-500">الاسم الأول</span>
                                  </label>
                                  <input {...register('firstName', { required: true })} className="input text-sm" placeholder="Ahmed" />
                                </div>
                                <div>
                                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                                    <span>First Name (AR)</span>
                                    <span dir="rtl" className="font-medium text-gray-500">الاسم الأول بالعربية</span>
                                  </label>
                                  <input {...register('firstNameAr')} className="input text-sm" dir="rtl" placeholder="أحمد" />
                                </div>
                                <div>
                                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                                    <span>Last Name *</span>
                                    <span dir="rtl" className="font-medium text-gray-500">اسم العائلة</span>
                                  </label>
                                  <input {...register('lastName', { required: true })} className="input text-sm" placeholder="Alharbi" />
                                </div>
                                <div>
                                  <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                                    <span>Last Name (AR)</span>
                                    <span dir="rtl" className="font-medium text-gray-500">اسم العائلة بالعربية</span>
                                  </label>
                                  <input {...register('lastNameAr')} className="input text-sm" dir="rtl" placeholder="الحربي" />
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="label">
                                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{language === 'ar' ? 'البريد الإلكتروني (Gmail / Work)' : 'Email (Gmail / Work)'} *</span>
                              </label>
                              <input type="email" {...register('email', { required: true })} className="input text-sm" placeholder="name@gmail.com" autoComplete="off" />
                              <p className="mt-1 text-[11px] text-gray-400">
                                {language === 'ar' ? 'سيُستخدم لتسجيل الدخول واستلام الدعوة.' : 'Used for login and the welcome invite email.'}
                              </p>
                            </div>

                            <div>
                              <label className="label">
                                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{language === 'ar' ? 'الهاتف' : 'Phone'}</span>
                              </label>
                              <input {...register('phone')} className="input text-sm" placeholder="+9665xxxxxxxx" />
                            </div>

                            <div>
                              <label className="label">
                                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{language === 'ar' ? 'كلمة المرور' : 'Password'}{editingUser ? '' : ' *'}</span>
                              </label>
                              <div className="relative">
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  {...register('password', { required: !editingUser })}
                                  className="input text-sm pe-10"
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(v => !v)}
                                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              {editingUser && (
                                <p className="text-[11px] text-gray-400 mt-1">
                                  {language === 'ar' ? 'اتركها فارغة للحفاظ على كلمة المرور الحالية.' : 'Leave empty to keep current password.'}
                                </p>
                              )}
                            </div>

                            {!editingUser && (
                              <label className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 cursor-pointer dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <input type="checkbox" {...register('sendWelcomeEmail')} className="mt-1 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500" />
                                <span>
                                  <span className="block text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                                    {language === 'ar' ? 'إرسال دعوة بالبريد من المنشأة' : 'Send welcome email from company'}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                                    {language === 'ar'
                                      ? 'يصل المستخدم بريد دعوة من إعدادات البريد الخاصة بالمنشأة مع رابط تسجيل الدخول.'
                                      : 'Sends an invite from your tenant email settings with login link and temporary password.'}
                                  </span>
                                </span>
                              </label>
                            )}

                            <div>
                              <label className="label">
                                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />{language === 'ar' ? 'الدور' : 'Role'}</span>
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {roles.map((r) => {
                                  const grad = ROLE_COLORS[r.key] || 'from-gray-400 to-gray-500'
                                  const isActive = watchedRole === r.key
                                  return (
                                    <label
                                      key={r.key}
                                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                                        isActive
                                          ? 'border-transparent ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                          : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        value={r.key}
                                        {...register('role', {
                                          onChange: (e) => {
                                            const nextRole = e.target.value
                                            const preset = ROLE_PRESETS[nextRole]
                                            if (!preset) return
                                            if (preset === 'ALL') {
                                              const all = enabledModules.map((m) => ({ module: m.key, actions: [...ACTIONS] }))
                                              setValue('permissions', all, { shouldDirty: true })
                                              return
                                            }
                                            const next = Object.entries(preset)
                                              .map(([module, actions]) => ({ module, actions: [...actions] }))
                                              .filter((p) => enabledModules.some((m) => m.key === p.module))
                                            setValue('permissions', next, { shouldDirty: true })
                                          }
                                        })}
                                        className="sr-only"
                                      />
                                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${grad} flex-shrink-0`} />
                                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{r.label}</span>
                                    </label>
                                  )
                                })}
                              </div>
                              <p className="mt-2 text-[11px] text-gray-400">
                                {language === 'ar'
                                  ? 'يقوم تغيير الدور بتحديد صلاحيات افتراضية تلقائياً.'
                                  : 'Changing role auto-selects default permissions.'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'الحساب نشط' : 'Account Active'}</p>
                                <p className="text-xs text-gray-400">{language === 'ar' ? 'يمكن للمستخدم تسجيل الدخول' : 'User can sign in'}</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" {...register('isActive')} className="sr-only peer" />
                                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-dark-600 peer-checked:after:translate-x-full peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                              </label>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="permissions"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-5 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {language === 'ar' ? 'الصلاحيات التفصيلية' : 'Granular Permissions'}
                              </p>
                              <span className="text-xs text-gray-400">{totalPermCount} {language === 'ar' ? 'صلاحية' : 'active'}</span>
                            </div>
                            {enabledModules.map((m) => {
                              const set = permMap.get(m.key) || new Set()
                              const allOn = ACTIONS.every((a) => set.has(a))
                              const someOn = ACTIONS.some((a) => set.has(a))
                              const label = language === 'ar' ? m.labelAr : m.labelEn
                              return (
                                <div
                                  key={m.key}
                                  className={`rounded-xl border p-3.5 transition-all ${
                                    someOn
                                      ? 'border-primary-200 dark:border-primary-800/50 bg-primary-50/50 dark:bg-primary-900/10'
                                      : 'border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">{m.icon}</span>
                                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{label}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleAllForModule(m.key, !allOn)}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                        allOn
                                          ? 'bg-primary-500 text-white'
                                          : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600'
                                      }`}
                                    >
                                      {language === 'ar' ? 'الكل' : 'All'}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ACTIONS.map((a) => (
                                      <PermToggle
                                        key={a}
                                        active={set.has(a)}
                                        label={a}
                                        color={ACTION_COLORS[a] || 'from-gray-400 to-gray-500'}
                                        onClick={() => toggleAction(m.key, a)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-100 dark:border-dark-700 flex gap-3">
                      <button type="button" onClick={closePanel} className="btn btn-secondary flex-1">
                        {t('cancel')}
                      </button>
                      <button type="submit" disabled={mutation.isPending} className="btn btn-primary flex-1">
                        {mutation.isPending ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            {t('save')}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

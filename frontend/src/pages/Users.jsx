import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, Save, Shield, CheckCircle2,
  UserPlus, Users as UsersIcon, UserCheck, AlertTriangle,
  ChevronRight, Eye, EyeOff, Mail, Phone,
  Lock, Fingerprint, Sliders, Sparkles,
  Receipt, Package, Truck, Plane, UtensilsCrossed,
  FolderKanban, Wallet, Landmark, HardHat, Cog, Cpu, Settings,
  Anchor, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { getTenantBusinessTypes } from '../lib/businessTypes'

const MODULES = [
  { key: 'invoicing', labelEn: 'Invoicing', labelAr: 'الفوترة', Icon: Receipt },
  { key: 'inventory', labelEn: 'Inventory', labelAr: 'المخزون', Icon: Package },
  { key: 'supply_chain', labelEn: 'Supply Chain', labelAr: 'سلسلة التوريد', Icon: Truck },
  { key: 'landed_costs', labelEn: 'Landed Costs', labelAr: 'التكاليف المرسية', Icon: Anchor },
  { key: 'travel', labelEn: 'Travel', labelAr: 'السفر', Icon: Plane },
  { key: 'restaurant', labelEn: 'Restaurant', labelAr: 'المطعم', Icon: UtensilsCrossed },
  { key: 'project_management', labelEn: 'Projects', labelAr: 'المشاريع', Icon: FolderKanban },
  { key: 'hr', labelEn: 'HR', labelAr: 'الموارد البشرية', Icon: UsersIcon },
  { key: 'payroll', labelEn: 'Payroll', labelAr: 'الرواتب', Icon: Wallet },
  { key: 'finance', labelEn: 'Finance', labelAr: 'المالية', Icon: Landmark },
  { key: 'job_costing', labelEn: 'Job Costing', labelAr: 'تكلفة الأعمال', Icon: HardHat },
  { key: 'mrp', labelEn: 'MRP', labelAr: 'MRP', Icon: Cog },
  { key: 'iot', labelEn: 'IoT', labelAr: 'إنترنت الأشياء', Icon: Cpu },
  { key: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات', Icon: Settings },
]

const ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'export']

const fieldClass =
  'w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/10 dark:bg-[#0c111a] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white/25'

const inkBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'

const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-white/10 dark:bg-[#0c111a] dark:text-slate-200 dark:hover:border-white/20'

function generateInvitePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
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
    landed_costs: ['create', 'read', 'update', 'export'],
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
    landed_costs: ['create', 'read', 'update', 'export'],
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

function Avatar({ user, size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.trim() || 'U'
  return (
    <div className={`${sizes[size]} flex flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white font-semibold tracking-tight dark:bg-white dark:text-slate-900`}>
      {initials}
    </div>
  )
}

function PermToggle({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
          : 'border-slate-200/80 bg-white text-slate-400 hover:border-slate-300 dark:border-white/10 dark:bg-[#0c111a] dark:text-slate-500'
      }`}
    >
      {label}
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
  const watchedFirstName = watch('firstName')
  const watchedLastName = watch('lastName')

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
        email: u?.email || '', phone: String(u?.phone || '').replace(/^\+966\s?/, ''), password: '',
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
    const rawPhone = String(form.phone || '').trim()
    const phone = !rawPhone
      ? ''
      : rawPhone.startsWith('+')
        ? rawPhone
        : `+966${rawPhone.replace(/^0+/, '')}`
    const payload = {
      ...form,
      phone,
      email: String(form.email || '').trim().toLowerCase(),
      permissions: Array.isArray(form.permissions) ? form.permissions : [],
      sendWelcomeEmail: editingUser ? false : Boolean(form.sendWelcomeEmail),
      inviteLanguage: language === 'ar' ? 'ar' : 'en',
    }
    if (!payload.password) delete payload.password
    mutation.mutate(payload)
  }

  const displayName = [watchedFirstName, watchedLastName].filter(Boolean).join(' ')
    || (editingUser ? `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim() : '')

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            {language === 'ar' ? 'الوصول' : 'Access'}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[28px]">
            {t('users')}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'Manage users and permissions'}
          </p>
        </div>
        <button
          onClick={() => openPanel()}
          disabled={isAtLimit}
          className={inkBtn}
        >
          <UserPlus className="h-4 w-4" />
          {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: language === 'ar' ? 'النشطون' : 'Active', value: activeUsers, Icon: UserCheck },
          { label: language === 'ar' ? 'الحد' : 'Seat limit', value: isLimitEnabled ? maxUsers : '∞', Icon: Shield },
          {
            label: language === 'ar' ? 'الحالة' : 'Seats',
            value: isAtLimit ? (language === 'ar' ? 'مكتمل' : 'Full') : (language === 'ar' ? 'متاح' : 'Open'),
            Icon: isAtLimit ? AlertTriangle : CheckCircle2,
            warn: isAtLimit,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-[#0c111a]">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className={`text-xl font-semibold tracking-tight ${item.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                {item.value}
              </p>
              <item.Icon className={`h-4 w-4 ${item.warn ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`${t('search')}...`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className={`${fieldClass} ps-10`}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0c111a]">
            {isLoading ? (
              <div className="space-y-0 divide-y divide-slate-100 dark:divide-white/5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-1/3 rounded bg-slate-100 dark:bg-white/10" />
                      <div className="h-3 w-1/2 rounded bg-slate-50 dark:bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <UsersIcon className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  {language === 'ar' ? 'لا يوجد مستخدمون' : 'No users yet'}
                </p>
                <button onClick={() => openPanel()} className={`${inkBtn} mt-4`}>
                  <UserPlus className="h-4 w-4" />
                  {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {users.map((u) => {
                  const selected = panelOpen && editingUser?._id === u._id
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => openPanel(u)}
                      className={`group flex w-full items-center gap-3 px-4 py-3.5 text-start transition ${
                        selected ? 'bg-slate-50 dark:bg-white/[0.04]' : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <Avatar user={u} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                            {u.firstName} {u.lastName}
                          </p>
                          <span className="flex-shrink-0 rounded-md border border-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                            {u.role?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="truncate text-[12px] text-slate-400">{u.email}</p>
                      </div>
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => { e.stopPropagation(); if (u.isActive) deleteMutation.mutate(u._id) }}
                        className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-500/10"
                        title={language === 'ar' ? 'إلغاء تفعيل' : 'Deactivate'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                      <ChevronRight className={`h-4 w-4 flex-shrink-0 text-slate-300 transition ${selected ? 'rotate-90 text-slate-500' : ''}`} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {pagination?.pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={ghostBtn}>
                {language === 'ar' ? 'السابق' : 'Previous'}
              </button>
              <span className="text-[12px] text-slate-400">
                {pagination.page} / {pagination.pages}
              </span>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} className={ghostBtn}>
                {language === 'ar' ? 'التالي' : 'Next'}
              </button>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-2">
          <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0c111a]">
            <AnimatePresence mode="wait">
              {!panelOpen ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-8 py-14 text-center"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/80 dark:border-white/10">
                    <Fingerprint className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="mt-4 text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    {language === 'ar' ? 'مستخدم جديد' : 'Invite a teammate'}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-[240px] text-[13px] leading-relaxed text-slate-400">
                    {language === 'ar'
                      ? 'أضف مستخدماً بالهوية الثنائية والصلاحيات الدقيقة، أو اختر شخصاً من القائمة للتعديل.'
                      : 'Create a bilingual identity, assign a role, then fine-tune access — or pick someone from the list.'}
                  </p>
                  <button onClick={() => openPanel()} disabled={isAtLimit} className={`${inkBtn} mt-6 w-full`}>
                    <UserPlus className="h-4 w-4" />
                    {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="panel"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
                    <div className="flex items-center gap-3 min-w-0">
                      {editingUser ? (
                        <Avatar user={{ ...editingUser, firstName: watchedFirstName || editingUser.firstName, lastName: watchedLastName || editingUser.lastName }} />
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                          <UserPlus className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                          {editingUser ? (language === 'ar' ? 'تعديل' : 'Edit') : (language === 'ar' ? 'دعوة' : 'Invite')}
                        </p>
                        <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                          {displayName || (language === 'ar' ? 'مستخدم جديد' : 'New user')}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={closePanel} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-white/5">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-100 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setActiveSection('info')}
                      className={`flex items-center justify-center gap-2 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                        activeSection === 'info'
                          ? 'border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white'
                          : 'border-b-2 border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'الهوية' : 'Identity'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('permissions')}
                      className={`flex items-center justify-center gap-2 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                        activeSection === 'permissions'
                          ? 'border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white'
                          : 'border-b-2 border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'الصلاحيات' : 'Access'}
                      {totalPermCount > 0 && (
                        <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-white dark:text-slate-900">
                          {totalPermCount}
                        </span>
                      )}
                    </button>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                      <AnimatePresence mode="wait">
                        {activeSection === 'info' ? (
                          <motion.div
                            key="info"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="space-y-5 p-5"
                          >
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                                {language === 'ar' ? 'الاسم' : 'Name'}
                              </p>
                              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" dir="ltr">
                                <div>
                                  <label className="mb-1.5 flex items-baseline justify-between text-[11px] font-medium text-slate-500">
                                    <span>First name</span>
                                    <span dir="rtl">الاسم الأول</span>
                                  </label>
                                  <input {...register('firstName', { required: true })} className={fieldClass} placeholder="Ahmed" />
                                </div>
                                <div>
                                  <label className="mb-1.5 flex items-baseline justify-between text-[11px] font-medium text-slate-500">
                                    <span>First name (AR)</span>
                                    <span dir="rtl">بالعربية</span>
                                  </label>
                                  <input {...register('firstNameAr')} className={fieldClass} dir="rtl" placeholder="أحمد" />
                                </div>
                                <div>
                                  <label className="mb-1.5 flex items-baseline justify-between text-[11px] font-medium text-slate-500">
                                    <span>Last name</span>
                                    <span dir="rtl">اسم العائلة</span>
                                  </label>
                                  <input {...register('lastName', { required: true })} className={fieldClass} placeholder="Alharbi" />
                                </div>
                                <div>
                                  <label className="mb-1.5 flex items-baseline justify-between text-[11px] font-medium text-slate-500">
                                    <span>Last name (AR)</span>
                                    <span dir="rtl">بالعربية</span>
                                  </label>
                                  <input {...register('lastNameAr')} className={fieldClass} dir="rtl" placeholder="الحربي" />
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                <Mail className="h-3.5 w-3.5" />
                                {language === 'ar' ? 'البريد (تسجيل الدخول)' : 'Email (login)'}
                              </label>
                              <input type="email" {...register('email', { required: true })} className={fieldClass} placeholder="name@company.com" autoComplete="off" />
                            </div>

                            <div>
                              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                <Phone className="h-3.5 w-3.5" />
                                {language === 'ar' ? 'الهاتف' : 'Phone'}
                              </label>
                              <div className="flex overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10">
                                <span className="flex items-center border-e border-slate-200/80 bg-slate-50 px-3 text-[12px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/5">+966</span>
                                <input {...register('phone')} className="w-full bg-transparent px-3.5 py-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" placeholder="5xxxxxxxx" />
                              </div>
                            </div>

                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                  <Lock className="h-3.5 w-3.5" />
                                  {language === 'ar' ? 'كلمة المرور' : 'Password'}{editingUser ? '' : ' *'}
                                </label>
                                {!editingUser && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setValue('password', generateInvitePassword(), { shouldDirty: true })
                                      setShowPassword(true)
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    {language === 'ar' ? 'توليد' : 'Generate'}
                                  </button>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  {...register('password', { required: !editingUser })}
                                  className={`${fieldClass} pe-10`}
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((v) => !v)}
                                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              {editingUser && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {language === 'ar' ? 'اتركها فارغة للحفاظ على كلمة المرور الحالية.' : 'Leave empty to keep the current password.'}
                                </p>
                              )}
                            </div>

                            {!editingUser && (
                              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 p-3.5 dark:border-white/10">
                                <input type="checkbox" {...register('sendWelcomeEmail')} className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400" />
                                <span>
                                  <span className="block text-[13px] font-medium text-slate-900 dark:text-white">
                                    {language === 'ar' ? 'إرسال دعوة بالبريد' : 'Send welcome email'}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                                    {language === 'ar'
                                      ? 'دعوة من بريد المنشأة مع رابط الدخول وكلمة المرور المؤقتة.'
                                      : 'Invite from your company email with login link and temporary password.'}
                                  </span>
                                </span>
                              </label>
                            )}

                            <div>
                              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                                {language === 'ar' ? 'الدور' : 'Role'}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {roles.map((r) => {
                                  const isActive = watchedRole === r.key
                                  return (
                                    <label
                                      key={r.key}
                                      className={`cursor-pointer rounded-xl border px-3 py-2.5 text-[12px] font-medium transition ${
                                        isActive
                                          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                                          : 'border-slate-200/80 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'
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
                                      {r.label}
                                    </label>
                                  )
                                })}
                              </div>
                              <p className="mt-2 text-[11px] text-slate-400">
                                {language === 'ar'
                                  ? 'تغيير الدور يضبط الصلاحيات الافتراضية. يمكنك تعديلها من تبويب الوصول.'
                                  : 'Role sets a default access map. Refine it in Access.'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3.5 py-3 dark:border-white/10">
                              <div>
                                <p className="text-[13px] font-medium text-slate-900 dark:text-white">{language === 'ar' ? 'الحساب نشط' : 'Account active'}</p>
                                <p className="text-[11px] text-slate-400">{language === 'ar' ? 'يمكن للمستخدم تسجيل الدخول' : 'Can sign in to this tenant'}</p>
                              </div>
                              <label className="relative inline-flex cursor-pointer items-center">
                                <input type="checkbox" {...register('isActive')} className="peer sr-only" />
                                <div className="h-6 w-10 rounded-full bg-slate-200 after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-slate-900 peer-checked:after:translate-x-4 dark:bg-white/10 dark:peer-checked:bg-white dark:peer-checked:after:bg-slate-900" />
                              </label>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="permissions"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="space-y-2.5 p-5"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                                {language === 'ar' ? 'الصلاحيات' : 'Modules'}
                              </p>
                              <span className="text-[11px] text-slate-400">{totalPermCount} {language === 'ar' ? 'صلاحية' : 'grants'}</span>
                            </div>
                            {enabledModules.map((m) => {
                              const set = permMap.get(m.key) || new Set()
                              const allOn = ACTIONS.every((a) => set.has(a))
                              const someOn = ACTIONS.some((a) => set.has(a))
                              const label = language === 'ar' ? m.labelAr : m.labelEn
                              const Icon = m.Icon || FileText
                              return (
                                <div
                                  key={m.key}
                                  className={`rounded-xl border p-3.5 ${
                                    someOn
                                      ? 'border-slate-900/20 bg-slate-50/80 dark:border-white/20 dark:bg-white/[0.04]'
                                      : 'border-slate-200/80 dark:border-white/10'
                                  }`}
                                >
                                  <div className="mb-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                                      <p className="text-[13px] font-medium text-slate-900 dark:text-white">{label}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleAllForModule(m.key, !allOn)}
                                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                                        allOn
                                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                          : 'text-slate-400 hover:text-slate-700'
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

                    <div className="flex gap-2 border-t border-slate-100 p-4 dark:border-white/10">
                      <button type="button" onClick={closePanel} className={`${ghostBtn} flex-1`}>
                        {t('cancel')}
                      </button>
                      <button type="submit" disabled={mutation.isPending} className={`${inkBtn} flex-1`}>
                        {mutation.isPending ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-slate-400 dark:border-t-slate-900" />
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {editingUser ? (language === 'ar' ? 'حفظ' : 'Save') : (language === 'ar' ? 'إنشاء المستخدم' : 'Create user')}
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

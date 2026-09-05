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
  Anchor, FileText, Activity, Clock, ShieldCheck, History,
  Filter, Download, RefreshCw, KeyRound, MessageCircle,
  ExternalLink, Layers, Check, ArrowRight, Boxes
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import { isAppAccessValid } from '../lib/appStoreTrial'
import ExportMenu from '../components/ui/ExportMenu'

const ALL_MODULE_DEFINITIONS = [
  // Core Operations
  { key: 'invoicing', labelEn: 'Invoicing & ZATCA', labelAr: 'الفوترة والضريبة', Icon: Receipt, group: 'core' },
  { key: 'inventory', labelEn: 'Inventory & Stock', labelAr: 'المخزون والمنتجات', Icon: Package, group: 'core' },
  { key: 'supply_chain', labelEn: 'Supply Chain & POs', labelAr: 'المشتريات والموردين', Icon: Truck, group: 'core' },
  { key: 'landed_costs', labelEn: 'Landed Costs', labelAr: 'التكاليف الإضافية', Icon: Anchor, group: 'core' },
  { key: 'finance', labelEn: 'Finance & Accounts', labelAr: 'المالية والحسابات', Icon: Landmark, group: 'core' },
  { key: 'settings', labelEn: 'Settings & Security', labelAr: 'الإعدادات والأمان', Icon: Settings, group: 'core' },

  // HR & Payroll
  { key: 'hr', labelEn: 'HR & Employees', labelAr: 'الموارد البشرية', Icon: UsersIcon, group: 'hr' },
  { key: 'payroll', labelEn: 'Payroll & Wages', labelAr: 'الرواتب والأجور', Icon: Wallet, group: 'hr' },

  // Projects & Job Costing
  { key: 'project_management', labelEn: 'Projects', labelAr: 'إدارة المشاريع', Icon: FolderKanban, group: 'projects' },
  { key: 'job_costing', labelEn: 'Job Costing', labelAr: 'تكلفة الأعمال والبطاقات', Icon: HardHat, group: 'projects' },

  // Manufacturing / MRP
  { key: 'mrp', labelEn: 'Manufacturing & MRP', labelAr: 'التصنيع والإنتاج', Icon: Cog, group: 'manufacturing' },

  // Industry Vertical Suites
  { key: 'restaurant', labelEn: 'Restaurant & Kitchen', labelAr: 'المطعم والمطبخ', Icon: UtensilsCrossed, group: 'vertical' },
  { key: 'travel', labelEn: 'Travel & Bookings', labelAr: 'السياحة والحجوزات', Icon: Plane, group: 'vertical' },
  { key: 'gym', labelEn: 'Gym & Fitness', labelAr: 'الصالة الرياضية', Icon: Sparkles, group: 'vertical' },
  { key: 'bakala', labelEn: 'Supermarket POS', labelAr: 'نقطة بيع السوبرماركت', Icon: Package, group: 'vertical' },
  { key: 'car_workshop', labelEn: 'Car Workshop', labelAr: 'صيانة السيارات', Icon: HardHat, group: 'vertical' },
  { key: 'car_rental', labelEn: 'Car Rental', labelAr: 'تأجير السيارات', Icon: Truck, group: 'vertical' },
  { key: 'laundry', labelEn: 'Laundry & Dry Clean', labelAr: 'المغسلة والتنظيف', Icon: Sparkles, group: 'vertical' },
  { key: 'boutique', labelEn: 'Boutique & Tailor', labelAr: 'البوتيك والخياطة', Icon: Sparkles, group: 'vertical' },
  { key: 'marquee', labelEn: 'Marquee & Event Halls', labelAr: 'قاعات الأفراح والمناسبات', Icon: Boxes, group: 'vertical' },

  // Installed Add-ons & Apps
  { key: 'crm', labelEn: 'CRM & Leads', labelAr: 'إدارة العملاء والفرص', Icon: UsersIcon, group: 'apps' },
  { key: 'whatsapp', labelEn: 'WhatsApp Hub', labelAr: 'مركز الواتساب', Icon: MessageCircle, group: 'apps' },
  { key: 'iot', labelEn: 'Hardware & IoT', labelAr: 'الأجهزة وإنترنت الأشياء', Icon: Cpu, group: 'apps' },
]

export function getTenantActiveModules(tenant) {
  const businessTypes = getTenantBusinessTypes(tenant)
  const installedApps = tenant?.settings?.installedApps || {}
  const isAppOn = (id) => isAppAccessValid(installedApps[id])

  // Core base modules that all tenants have
  const activeKeys = new Set(['invoicing', 'inventory', 'settings'])

  // Supply chain / Purchases
  if (
    businessTypes.some((t) =>
      ['trading', 'bakala', 'pharmacy', 'furniture_shop', 'manufacturing', 'construction'].includes(t)
    ) ||
    isAppOn('purchases')
  ) {
    activeKeys.add('supply_chain')
  }

  // Finance / Accounting
  if (
    isAppOn('accounting') ||
    isAppOn('finance') ||
    isAppOn('etimad_procurement') ||
    tenant?.subscription?.hasAccountingAddon === true ||
    tenant?.settings?.enableFinanceModule === true ||
    tenant?.settings?.hasAccounting === true
  ) {
    activeKeys.add('finance')
  }

  // Landed costs
  if (
    isAppOn('landed_costs') ||
    isAppOn('multicourier_shipping') ||
    tenant?.settings?.enableLandedCosts === true
  ) {
    activeKeys.add('landed_costs')
  }

  // HR & Payroll (App Store app: hr_payroll_pro, qiwa_hr_integration, gosi_mudad_compliance, or manpower business)
  const hasHrInstalled =
    isAppOn('hr_payroll_pro') ||
    isAppOn('qiwa_hr_integration') ||
    isAppOn('hr_suite') ||
    isAppOn('hr') ||
    businessTypes.includes('manpower') ||
    tenant?.subscription?.hasHrAddon === true

  if (hasHrInstalled) {
    activeKeys.add('hr')
  }

  const hasPayrollInstalled =
    isAppOn('hr_payroll_pro') ||
    isAppOn('gosi_mudad_compliance') ||
    isAppOn('payroll') ||
    businessTypes.includes('manpower') ||
    tenant?.subscription?.hasPayrollAddon === true

  if (hasPayrollInstalled) {
    activeKeys.add('payroll')
  }

  // Projects & Job Costing
  if (
    businessTypes.includes('construction') ||
    isAppOn('construction_projects') ||
    isAppOn('projects')
  ) {
    activeKeys.add('project_management')
  }

  if (
    businessTypes.includes('construction') ||
    isAppOn('construction_projects') ||
    isAppOn('job_costing') ||
    isAppOn('manufacturing_mes')
  ) {
    activeKeys.add('job_costing')
  }

  // Manufacturing / MRP
  if (businessTypes.includes('manufacturing') || isAppOn('manufacturing_mes') || isAppOn('mrp_manufacturing')) {
    activeKeys.add('mrp')
  }

  // Industry Vertical Suites
  if (
    businessTypes.includes('restaurant') ||
    isAppOn('restaurant_cafe') ||
    isAppOn('restaurant_pos') ||
    isAppOn('restaurant_mess') ||
    isAppOn('qr_menu_ordering')
  ) {
    activeKeys.add('restaurant')
  }

  if (businessTypes.includes('travel_agency') || isAppOn('travel_agency')) {
    activeKeys.add('travel')
  }

  if (businessTypes.includes('gym') || isAppOn('gym_fitness_club') || isAppOn('gym')) {
    activeKeys.add('gym')
  }

  if (businessTypes.includes('bakala') || isAppOn('bakala_supermarket') || isAppOn('bakala_pos')) {
    activeKeys.add('bakala')
  }

  if (businessTypes.includes('car_workshop') || isAppOn('car_workshop')) {
    activeKeys.add('car_workshop')
  }

  if (businessTypes.includes('car_rental') || isAppOn('car_rental')) {
    activeKeys.add('car_rental')
  }

  if (businessTypes.includes('laundry') || isAppOn('laundry_cleaning') || isAppOn('laundry_suite')) {
    activeKeys.add('laundry')
  }

  if (
    businessTypes.includes('boutique') ||
    businessTypes.includes('khayyat') ||
    isAppOn('boutique_rental') ||
    isAppOn('tailor_khayyat')
  ) {
    activeKeys.add('boutique')
  }

  if (businessTypes.includes('marquee') || isAppOn('marquee_management') || isAppOn('marquee')) {
    activeKeys.add('marquee')
  }

  // Extension Apps
  if (isAppOn('crm_sales_pipeline') || isAppOn('crm') || isAppOn('queries_crm')) {
    activeKeys.add('crm')
  }

  const isWhatsAppConfigured =
    Boolean(tenant?.settings?.whatsappAccessToken && tenant?.settings?.whatsappPhoneNumberId) ||
    tenant?.settings?.whatsappConnectionStatus === 'connected' ||
    tenant?.settings?.whatsappQrConnected === true

  if (isAppOn('whatsapp_cloud_auto') || isAppOn('whatsapp') || isWhatsAppConfigured) {
    activeKeys.add('whatsapp')
  }

  if (
    isAppOn('iot_devices') ||
    isAppOn('payment_terminal') ||
    isAppOn('thermal_printer_driver') ||
    isAppOn('weight_scale_driver')
  ) {
    activeKeys.add('iot')
  }

  return ALL_MODULE_DEFINITIONS.filter((m) => activeKeys.has(m.key))
}

const ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'export']

const fieldClass =
  'w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-white/10 dark:bg-[#0c111a] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white'

const inkBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'

const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-bold text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-white/10 dark:bg-[#0c111a] dark:text-slate-200 dark:hover:border-white/20'

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
    crm: ['create', 'read', 'update', 'export'],
    whatsapp: ['create', 'read', 'update'],
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
    crm: ['create', 'read', 'update'],
    whatsapp: ['read', 'create'],
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
    <div
      className={`${sizes[size]} flex flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold tracking-tight shadow-2xs dark:from-white dark:to-slate-200 dark:text-slate-950`}
    >
      {initials}
    </div>
  )
}

function PermToggle({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-2xs dark:border-white dark:bg-white dark:text-slate-900'
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
  const isAr = language === 'ar'

  const [mainTab, setMainTab] = useState('directory') // 'directory' | 'logs'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [activeSection, setActiveSection] = useState('info') // 'info' | 'permissions' | 'userLogs'
  const [selectedLogDetail, setSelectedLogDetail] = useState(null)

  // Logs filters
  const [logSearch, setLogSearch] = useState('')
  const [logPage, setLogPage] = useState(1)
  const [logModuleFilter, setLogModuleFilter] = useState('')
  const [logActionFilter, setLogActionFilter] = useState('')
  const [logUserFilter, setLogUserFilter] = useState('')

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      firstNameAr: '',
      lastNameAr: '',
      email: '',
      phone: '',
      password: '',
      role: 'viewer',
      isActive: true,
      permissions: [],
      warehouseIds: [],
      sendWelcomeEmail: true,
      accessScope: {
        productVisibility: 'all',
        canAddProducts: false,
        invoiceVisibility: 'own',
        canManageOwnInvoiceSettings: false,
      },
    },
  })

  const permissions = watch('permissions')
  const warehouseIds = watch('warehouseIds') || []
  const accessScope = watch('accessScope') || {}
  const watchedRole = watch('role')
  const watchedFirstName = watch('firstName')
  const watchedLastName = watch('lastName')

  // Fetch tenant users
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-users', page, search],
    queryFn: () => api.get('/users', { params: { page, limit: 25, search } }).then((res) => res.data),
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-for-users'],
    queryFn: () => api.get('/warehouses').then((res) => res.data?.warehouses || res.data || []),
  })
  const warehouses = Array.isArray(warehousesData) ? warehousesData : []

  // Fetch users stats
  const { data: stats } = useQuery({
    queryKey: ['tenant-users-stats'],
    queryFn: () => api.get('/users/stats').then((res) => res.data),
  })

  // Fetch audit logs
  const { data: logsData, isLoading: loadingLogs } = useQuery({
    queryKey: ['tenant-audit-logs', logPage, logSearch, logModuleFilter, logActionFilter, logUserFilter],
    queryFn: () =>
      api
        .get('/users/logs', {
          params: {
            page: logPage,
            limit: 25,
            search: logSearch || undefined,
            module: logModuleFilter || undefined,
            action: logActionFilter || undefined,
            userId: logUserFilter || undefined,
          },
        })
        .then((res) => res.data),
    enabled: mainTab === 'logs',
  })

  // Fetch audit log stats
  const { data: logStats } = useQuery({
    queryKey: ['tenant-audit-log-stats'],
    queryFn: () => api.get('/users/logs/stats').then((res) => res.data),
    enabled: mainTab === 'logs',
  })

  // Fetch per-user logs when drawer is open on logs tab
  const { data: userLogsData, isLoading: loadingUserLogs } = useQuery({
    queryKey: ['single-user-logs', editingUser?._id],
    queryFn: () => api.get(`/users/${editingUser._id}/logs`).then((res) => res.data),
    enabled: Boolean(editingUser?._id && activeSection === 'userLogs'),
  })

  const users = data?.users || []
  const pagination = data?.pagination
  const maxUsers = Number(stats?.maxUsers ?? 0)
  const activeUsers = Number(stats?.activeUsers ?? 0)
  const isLimitEnabled = Number.isFinite(maxUsers) && maxUsers > 0
  const isAtLimit = isLimitEnabled && activeUsers >= maxUsers
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)

  // Dynamically resolve ONLY active modules for this tenant
  const enabledModules = useMemo(() => {
    return getTenantActiveModules(tenant)
  }, [tenant])

  const roles = useMemo(
    () =>
      [
        { key: 'admin', label: isAr ? 'مشرف عام' : 'Admin' },
        { key: 'manager', label: isAr ? 'مدير عمليات' : 'Manager' },
        { key: 'accountant', label: isAr ? 'محاسب مالي' : 'Accountant' },
        { key: 'hr_manager', label: isAr ? 'مدير موارد بشرية' : 'HR Manager' },
        { key: 'inventory_manager', label: isAr ? 'مدير مخزون' : 'Inventory Manager' },
        { key: 'kitchen_staff', label: isAr ? 'طاقم مطبخ' : 'Kitchen Staff' },
        { key: 'sales', label: isAr ? 'مبيعات' : 'Sales' },
        { key: 'viewer', label: isAr ? 'مشاهدة فقط' : 'Viewer' },
      ].filter((role) => role.key !== 'kitchen_staff' || tenantBusinessTypes.includes('restaurant')),
    [isAr, tenantBusinessTypes]
  )

  const openPanel = (u = null) => {
    setEditingUser(u)
    setActiveSection('info')
    const defaultScope = {
      productVisibility: 'all',
      canAddProducts: false,
      invoiceVisibility: 'own',
      canManageOwnInvoiceSettings: false,
    }
    if (u) {
      reset({
        firstName: u?.firstName || '',
        lastName: u?.lastName || '',
        firstNameAr: u?.firstNameAr || '',
        lastNameAr: u?.lastNameAr || '',
        email: u?.email || '',
        phone: String(u?.phone || '').replace(/^\+966\s?/, ''),
        password: '',
        role: u?.role || 'viewer',
        isActive: typeof u?.isActive === 'boolean' ? u.isActive : true,
        permissions: Array.isArray(u?.permissions) ? u.permissions : [],
        warehouseIds: Array.isArray(u?.warehouseIds) ? u.warehouseIds.map((id) => String(id?._id || id)) : [],
        sendWelcomeEmail: false,
        accessScope: {
          ...defaultScope,
          ...(u?.accessScope || {}),
          productVisibility: u?.accessScope?.productVisibility === 'own' ? 'own' : 'all',
          invoiceVisibility: u?.accessScope?.invoiceVisibility === 'all' ? 'all' : 'own',
          canAddProducts: Boolean(u?.accessScope?.canAddProducts),
          canManageOwnInvoiceSettings: Boolean(u?.accessScope?.canManageOwnInvoiceSettings),
        },
      })
    } else {
      reset({
        firstName: '',
        lastName: '',
        firstNameAr: '',
        lastNameAr: '',
        email: '',
        phone: '',
        password: '',
        role: roles[0]?.key || 'viewer',
        isActive: true,
        permissions: [],
        warehouseIds: [],
        sendWelcomeEmail: true,
        accessScope: defaultScope,
      })
    }
    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    setEditingUser(null)
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      editingUser ? api.put(`/users/${editingUser._id}`, payload) : api.post('/users', payload),
    onSuccess: (res) => {
      const data = res?.data || res
      if (editingUser) {
        toast.success(isAr ? 'تم تحديث بيانات وصلاحيات المستخدم بنجاح' : 'User updated successfully')
      } else if (data?.inviteEmailSent) {
        toast.success(isAr ? 'تم إنشاء المستخدم وإرسال دعوة بالبريد' : 'User created & welcome email sent')
      } else {
        toast.success(isAr ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully')
      }
      queryClient.invalidateQueries(['tenant-users'])
      queryClient.invalidateQueries(['tenant-users-stats'])
      queryClient.invalidateQueries(['tenant-audit-logs'])
      closePanel()
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'حدث خطأ' : 'Error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إلغاء تفعيل المستخدم' : 'User deactivated')
      queryClient.invalidateQueries(['tenant-users'])
      queryClient.invalidateQueries(['tenant-users-stats'])
      queryClient.invalidateQueries(['tenant-audit-logs'])
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'حدث خطأ' : 'Error')),
  })

  const handleRolePreset = (roleKey) => {
    setValue('role', roleKey)
    const preset = ROLE_PRESETS[roleKey]
    if (preset === 'ALL') {
      const allPerms = enabledModules.map((m) => ({ module: m.key, actions: [...ACTIONS] }))
      setValue('permissions', allPerms)
      setValue('accessScope', {
        productVisibility: 'all',
        canAddProducts: true,
        invoiceVisibility: 'all',
        canManageOwnInvoiceSettings: true,
      })
    } else if (preset) {
      const mapped = []
      enabledModules.forEach((m) => {
        if (preset[m.key]) {
          mapped.push({ module: m.key, actions: preset[m.key] })
        }
      })
      setValue('permissions', mapped)
      const canAdd = Boolean(preset.inventory?.includes('create'))
      setValue('accessScope', {
        productVisibility: 'all',
        canAddProducts: canAdd,
        invoiceVisibility: ['manager', 'accountant'].includes(roleKey) ? 'all' : 'own',
        canManageOwnInvoiceSettings: ['manager', 'sales', 'accountant'].includes(roleKey),
      })
    } else {
      setValue('permissions', [])
      setValue('accessScope', {
        productVisibility: 'all',
        canAddProducts: false,
        invoiceVisibility: 'own',
        canManageOwnInvoiceSettings: false,
      })
    }
  }

  const toggleAction = (moduleKey, action) => {
    const list = Array.isArray(permissions) ? [...permissions] : []
    const idx = list.findIndex((p) => p.module === moduleKey)
    if (idx === -1) {
      list.push({ module: moduleKey, actions: [action] })
    } else {
      const actions = Array.isArray(list[idx].actions) ? [...list[idx].actions] : []
      const aIdx = actions.indexOf(action)
      if (aIdx === -1) actions.push(action)
      else actions.splice(aIdx, 1)

      if (actions.length === 0) list.splice(idx, 1)
      else list[idx] = { ...list[idx], actions }
    }
    setValue('permissions', list)
  }

  const toggleAllModuleActions = (moduleKey) => {
    const list = Array.isArray(permissions) ? [...permissions] : []
    const idx = list.findIndex((p) => p.module === moduleKey)
    if (idx !== -1 && list[idx]?.actions?.length === ACTIONS.length) {
      list.splice(idx, 1)
    } else {
      if (idx === -1) list.push({ module: moduleKey, actions: [...ACTIONS] })
      else list[idx] = { module: moduleKey, actions: [...ACTIONS] }
    }
    setValue('permissions', list)
  }

  const hasModuleAction = (moduleKey, action) => {
    if (watchedRole === 'admin') return true
    const perm = (permissions || []).find((p) => p.module === moduleKey)
    return Boolean(perm?.actions?.includes(action))
  }

  const isModuleAllActive = (moduleKey) => {
    if (watchedRole === 'admin') return true
    const perm = (permissions || []).find((p) => p.module === moduleKey)
    return perm?.actions?.length === ACTIONS.length
  }

  const setAccessScopeField = (key, value) => {
    setValue('accessScope', { ...(accessScope || {}), [key]: value })
    if (key === 'canAddProducts' && value === true) {
      const list = Array.isArray(permissions) ? [...permissions] : []
      const idx = list.findIndex((p) => p.module === 'inventory')
      if (idx === -1) {
        list.push({ module: 'inventory', actions: ['create', 'read'] })
      } else {
        const actions = new Set(list[idx].actions || [])
        actions.add('create')
        actions.add('read')
        list[idx] = { ...list[idx], actions: Array.from(actions) }
      }
      setValue('permissions', list)
    }
  }

  const onSubmit = (formData) => {
    const payload = {
      ...formData,
      phone: formData.phone ? `+966${formData.phone}` : undefined,
      accessScope: formData.accessScope || {
        productVisibility: 'all',
        canAddProducts: false,
        invoiceVisibility: 'own',
        canManageOwnInvoiceSettings: false,
      },
    }
    if (!payload.password) delete payload.password
    mutation.mutate(payload)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Mode Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'المستخدمين والصلاحيات وسجلات النشاط' : 'Users, Access & Audit Logs'}
            </h1>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300">
              {activeUsers} / {isLimitEnabled ? maxUsers : '∞'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'إدارة صلاحيات الوصول بحسب التطبيقات المثبتة للمنشأة، ومتابعة سجلات النشاط والعمليات الفورية.'
              : 'Role-based access control scoped to installed tenant apps with comprehensive real-time audit logging.'}
          </p>
        </div>

        {/* Top Actions & Tab Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Glass Segmented Switcher */}
          <div className="inline-flex rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1.5 shadow-2xs backdrop-blur-md dark:border-white/10 dark:bg-dark-800/80">
            <button
              type="button"
              onClick={() => setMainTab('directory')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                mainTab === 'directory'
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <UsersIcon className="h-3.5 w-3.5" />
              <span>{isAr ? 'فريق العمل' : 'Team Directory'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMainTab('logs')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                mainTab === 'logs'
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>{isAr ? 'سجل العمليات' : 'Audit Logs'}</span>
            </button>
          </div>

          {mainTab === 'directory' && (
            <button
              type="button"
              onClick={() => openPanel(null)}
              disabled={isAtLimit}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <UserPlus className="h-4 w-4 stroke-[2.5]" />
              <span>{isAr ? 'إضافة مستخدم جديد' : 'Add User'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── TAB 1: TEAM DIRECTORY ─── */}
      {mainTab === 'directory' && (
        <div className="space-y-6">
          {/* Top KPI Bento Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
                  <UsersIcon className="h-5 w-5 stroke-[2.2]" />
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  {isAr ? 'المستخدمين النشطين' : 'Active Seats'}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'المستخدمين الفعليين' : 'Active Accounts'}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {activeUsers}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  {isAr ? 'حسابات مسجلة ومفعلة' : 'Verified active logins'}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <ShieldCheck className="h-5 w-5 stroke-[2.2]" />
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {isAr ? 'الحد المسموح' : 'Seat Limit'}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'السعة الإجمالية للباقة' : 'Max Allowed Seats'}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {isLimitEnabled ? maxUsers : (isAr ? 'غير محدود' : 'Unlimited')}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  {isAtLimit
                    ? isAr
                      ? 'تم الوصول إلى الحد الأقصى'
                      : 'Seat limit reached'
                    : isAr
                    ? `متبقي ${isLimitEnabled ? maxUsers - activeUsers : '∞'} مقعد متاح`
                    : `${isLimitEnabled ? maxUsers - activeUsers : '∞'} available seats`}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-sm">
                  <Layers className="h-5 w-5 stroke-[2.2]" />
                </div>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                  {isAr ? 'التطبيقات المتاحة' : 'Active Modules'}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'الوحدات والتطبيقات المفعلة' : 'Scoped Tenant Modules'}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {enabledModules.length}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  {isAr ? 'مطابقة لباقة وتطبيقات المنشأة' : 'Filtered to installed apps'}
                </p>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
            <div className="relative flex-1">
              <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isAr ? 'right-3.5' : 'left-3.5'}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder={
                  isAr ? 'بحث بالاسم، البريد الإلكتروني، أو الهاتف...' : 'Search by name, email, or phone...'
                }
                className={`h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-slate-900 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800/60 dark:text-white dark:focus:border-white ${
                  isAr ? 'pr-10 pl-9' : 'pl-10 pr-9'
                }`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white ${
                    isAr ? 'left-3.5' : 'right-3.5'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
            {isLoading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-700 dark:border-t-white" />
                <p className="text-xs text-slate-400">{isAr ? 'جاري تحميل المستخدمين...' : 'Loading users...'}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-dark-800 dark:text-slate-500">
                  <UsersIcon className="h-8 w-8 stroke-[1.8]" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                  {isAr ? 'لم يتم العثور على أي مستخدمين' : 'No Users Found'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {search
                    ? isAr
                      ? 'لا توجد نتائج تطابق بحثك. جرب كلمة بحث أخرى.'
                      : 'No user accounts match your search.'
                    : isAr
                    ? 'ابدأ بإضافة أول عضو في فريق العمل وحدد صلاحياته.'
                    : 'Get started by inviting your first team member.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                      <th className="py-3.5 px-5 text-start">{isAr ? 'المستخدم' : 'User'}</th>
                      <th className="py-3.5 px-4 text-start">{isAr ? 'الدور الوظيفي' : 'Role'}</th>
                      <th className="py-3.5 px-4 text-start">{isAr ? 'الصلاحيات النشطة' : 'Permissions'}</th>
                      <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                      <th className="py-3.5 px-5 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {users.map((u) => {
                      const name = isAr
                        ? [u.firstNameAr, u.lastNameAr].filter(Boolean).join(' ') || `${u.firstName} ${u.lastName}`
                        : `${u.firstName} ${u.lastName}`
                      const roleMeta = roles.find((r) => r.key === u.role) || { label: u.role }
                      const permCount = u.role === 'admin' ? enabledModules.length : (u.permissions || []).length

                      return (
                        <tr
                          key={u._id}
                          onClick={() => openPanel(u)}
                          className="group cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <Avatar user={u} size="md" />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400 transition-colors">
                                  {name}
                                </p>
                                <p className="text-[11px] text-slate-400">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                                u.role === 'admin'
                                  ? 'border-purple-500/20 bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300'
                                  : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300'
                              }`}
                            >
                              {roleMeta.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {u.role === 'admin' ? (isAr ? 'وصول شامل' : 'Full Access') : `${permCount} ${isAr ? 'وحدة' : 'modules'}`}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                u.isActive !== false
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${u.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {u.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 text-end whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openPanel(u)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                              >
                                {isAr ? 'تعديل الصلاحيات' : 'Edit Access'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: AUDIT & ACTIVITY LOGS ─── */}
      {mainTab === 'logs' && (
        <div className="space-y-6">
          {/* Logs Bento Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-sm">
                  <Activity className="h-5 w-5 stroke-[2.2]" />
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {isAr ? 'السجل الشامل' : 'Total Logs'}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'إجمالي العمليات المسجلة' : 'Recorded Operations'}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {logStats?.totalLogs || logsData?.pagination?.total || 0}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <Clock className="h-5 w-5 stroke-[2.2]" />
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {isAr ? 'اليوم' : 'Today'}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'عمليات اليوم' : 'Operations Today'}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {logStats?.todayLogs || 0}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-sm">
                  <UsersIcon className="h-5 w-5 stroke-[2.2]" />
                </div>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                  {isAr ? 'نشاط الفريق' : 'Active Users'}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'المستخدمين النشطين اليوم' : 'Active Users Today'}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {logStats?.activeUsersToday || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isAr ? 'right-3.5' : 'left-3.5'}`} />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value)
                    setLogPage(1)
                  }}
                  placeholder={isAr ? 'بحث في سجل العمليات...' : 'Search activity logs...'}
                  className={`h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-slate-900 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800/60 dark:text-white ${
                    isAr ? 'pr-10 pl-9' : 'pl-10 pr-9'
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={logModuleFilter}
                  onChange={(e) => {
                    setLogModuleFilter(e.target.value)
                    setLogPage(1)
                  }}
                  className="h-10 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                >
                  <option value="">{isAr ? 'جميع الوحدات' : 'All Modules'}</option>
                  <option value="invoicing">{isAr ? 'الفوترة' : 'Invoicing'}</option>
                  <option value="quotations">{isAr ? 'عروض الأسعار' : 'Quotations'}</option>
                  <option value="customers">{isAr ? 'العملاء' : 'Customers'}</option>
                  <option value="users">{isAr ? 'المستخدمين' : 'Users'}</option>
                  <option value="auth">{isAr ? 'تسجيل الدخول' : 'Authentication'}</option>
                </select>

                <select
                  value={logActionFilter}
                  onChange={(e) => {
                    setLogActionFilter(e.target.value)
                    setLogPage(1)
                  }}
                  className="h-10 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                >
                  <option value="">{isAr ? 'جميع الإجراءات' : 'All Actions'}</option>
                  <option value="login">{isAr ? 'دخول' : 'Login'}</option>
                  <option value="create">{isAr ? 'إنشاء' : 'Create'}</option>
                  <option value="update">{isAr ? 'تعديل' : 'Update'}</option>
                  <option value="delete">{isAr ? 'حذف / تعطيل' : 'Delete'}</option>
                  <option value="sign">{isAr ? 'توقيع' : 'Sign'}</option>
                  <option value="approve">{isAr ? 'اعتماد' : 'Approve'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Logs Stream Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
            {loadingLogs ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-700 dark:border-t-white" />
                <p className="text-xs text-slate-400">{isAr ? 'جاري تحميل سجل النشاط...' : 'Loading audit logs...'}</p>
              </div>
            ) : logsData?.logs?.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-dark-800 dark:text-slate-500">
                  <History className="h-8 w-8 stroke-[1.8]" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                  {isAr ? 'لا توجد سجلات نشاط مسجلة' : 'No Activity Logs'}
                </h3>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                      <th className="py-3.5 px-5 text-start">{isAr ? 'المستخدم' : 'User'}</th>
                      <th className="py-3.5 px-4 text-start">{isAr ? 'الإجراء' : 'Action'}</th>
                      <th className="py-3.5 px-4 text-start">{isAr ? 'الوحدة / المورد' : 'Module / Target'}</th>
                      <th className="py-3.5 px-4 text-start">{isAr ? 'التفاصيل' : 'Description'}</th>
                      <th className="py-3.5 px-4 text-start">{isAr ? 'الوقت والتاريخ' : 'Timestamp'}</th>
                      <th className="py-3.5 px-5 text-end">{isAr ? 'IP الجهاز' : 'IP'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {logsData?.logs?.map((log) => {
                      const isCreate = log.action === 'create' || log.action === 'sign' || log.action === 'approve'
                      const isDelete = log.action === 'delete' || log.action === 'reject'
                      const isLogin = log.action === 'login'

                      return (
                        <tr
                          key={log._id}
                          onClick={() => setSelectedLogDetail(log)}
                          className="group cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                        >
                          <td className="py-3.5 px-5">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{log.userName}</p>
                              <p className="text-[11px] text-slate-400">{log.userEmail}</p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase ${
                                isCreate
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : isDelete
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                  : isLogin
                                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700 dark:bg-white/10 dark:text-slate-300">
                                {log.module}
                              </span>
                              {log.resourceName && (
                                <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                  {log.resourceName}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <p className="text-xs text-slate-700 dark:text-slate-300">
                              {isAr ? log.descriptionAr || log.description : log.description}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleString(isAr ? 'ar-SA' : 'en-US')}
                          </td>

                          <td className="py-3.5 px-5 text-end whitespace-nowrap font-mono text-[11px] text-slate-400">
                            {log.ipAddress || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── SLIDE-OVER DRAWER (Create / Edit User & Access & Logs) ─── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: isAr ? -560 : 560 }}
              animate={{ x: 0 }}
              exit={{ x: isAr ? -560 : 560 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className={`fixed top-0 bottom-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-[#0c111a] ${
                isAr ? 'left-0 border-r border-slate-200 dark:border-white/10' : 'right-0 border-l border-slate-200 dark:border-white/10'
              }`}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/10">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingUser
                      ? isAr
                        ? `تعديل المستخدم: ${editingUser.firstName} ${editingUser.lastName}`
                        : `Edit User: ${editingUser.firstName} ${editingUser.lastName}`
                      : isAr
                      ? 'إضافة مستخدم جديد'
                      : 'Invite New User'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {isAr
                      ? 'الوصول محدد بحسب التطبيقات المفعلة للمنشأة.'
                      : 'Permissions are strictly scoped to installed tenant modules.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Tabs */}
              <div className="flex border-b border-slate-100 px-6 dark:border-white/10">
                {[
                  { id: 'info', en: 'Identity', ar: 'البيانات الشخصية' },
                  { id: 'permissions', en: 'Access & Permissions', ar: 'الصلاحيات والوصول' },
                  ...(editingUser ? [{ id: 'userLogs', en: 'Activity Logs', ar: 'سجل النشاط' }] : []),
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveSection(t.id)}
                    className={`border-b-2 py-3 px-4 text-xs font-bold transition-all ${
                      activeSection === t.id
                        ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                  >
                    {isAr ? t.ar : t.en}
                  </button>
                ))}
              </div>

              {/* Drawer Content */}
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* SECTION 1: IDENTITY */}
                  {activeSection === 'info' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                            {isAr ? 'الاسم الأول (En)' : 'First Name (En)'}
                          </label>
                          <input {...register('firstName', { required: true })} className={fieldClass} placeholder="John" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                            {isAr ? 'اسم العائلة (En)' : 'Last Name (En)'}
                          </label>
                          <input {...register('lastName', { required: true })} className={fieldClass} placeholder="Doe" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                            {isAr ? 'الاسم الأول (عربي)' : 'First Name (Ar)'}
                          </label>
                          <input {...register('firstNameAr')} className={fieldClass} placeholder="محمد" dir="rtl" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                            {isAr ? 'اسم العائلة (عربي)' : 'Last Name (Ar)'}
                          </label>
                          <input {...register('lastNameAr')} className={fieldClass} placeholder="الغامدي" dir="rtl" />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                        </label>
                        <input
                          type="email"
                          {...register('email', { required: true })}
                          className={fieldClass}
                          placeholder="user@company.com"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {isAr ? 'رقم الهاتف' : 'Phone Number'}
                        </label>
                        <div className="flex gap-2">
                          <span className="flex items-center rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-dark-800">
                            +966
                          </span>
                          <input {...register('phone')} className={fieldClass} placeholder="5xxxxxxxx" />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                            {editingUser
                              ? isAr
                                ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)'
                                : 'New Password (leave empty to keep current)'
                              : isAr
                              ? 'كلمة المرور'
                              : 'Password'}
                          </label>
                          {!editingUser && (
                            <button
                              type="button"
                              onClick={() => setValue('password', generateInvitePassword())}
                              className="text-[11px] font-bold text-emerald-600 hover:underline"
                            >
                              {isAr ? 'توليد تلقائي' : 'Generate'}
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            {...register('password', { required: !editingUser })}
                            className={fieldClass}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute top-1/2 end-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Active Status */}
                      {editingUser && (
                        <div className="pt-2">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-slate-900" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {isAr ? 'الحساب نشط ويمكنه تسجيل الدخول' : 'Account is active'}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 2: PERMISSIONS & ACCESS */}
                  {activeSection === 'permissions' && (
                    <div className="space-y-6">
                      {/* Role Presets Bar */}
                      <div>
                        <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {isAr ? 'الدور الوظيفي المحدد مسبقاً' : 'Role Preset'}
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {roles.map((r) => {
                            const isSelected = watchedRole === r.key
                            return (
                              <button
                                key={r.key}
                                type="button"
                                onClick={() => handleRolePreset(r.key)}
                                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all ${
                                  isSelected
                                    ? 'border-slate-900 bg-slate-900 text-white shadow-2xs dark:border-white dark:bg-white dark:text-slate-950'
                                    : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300'
                                }`}
                              >
                                {r.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Warehouse scope */}
                      {warehouses.length > 0 && (
                        <div>
                          <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300">
                            {isAr ? 'مستودعات مسموح بها' : 'Allowed warehouses'}
                          </label>
                          <p className="mb-2 text-[11px] text-slate-400">
                            {isAr
                              ? 'اترك الكل فارغاً للوصول لكل المستودعات. يُطبَّق عند تفعيل تقييد المستودع في إعدادات المخزون.'
                              : 'Leave empty for all warehouses. Enforced when warehouse restriction is on in Inventory Settings.'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {warehouses.map((w) => {
                              const id = String(w._id)
                              const checked = warehouseIds.includes(id)
                              return (
                                <label
                                  key={id}
                                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                                    checked
                                      ? 'border-primary-400 bg-primary-50 text-primary-800 dark:border-primary-600 dark:bg-primary-950/40 dark:text-primary-200'
                                      : 'border-slate-200 text-slate-600 dark:border-dark-600 dark:text-slate-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-primary-600"
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked
                                        ? warehouseIds.filter((x) => x !== id)
                                        : [...warehouseIds, id]
                                      setValue('warehouseIds', next)
                                    }}
                                  />
                                  {w.nameEn || w.name || w.code}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Data access scopes */}
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-dark-800">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {isAr ? 'نطاق البيانات' : 'Data access scopes'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {isAr
                            ? 'تحكم في المنتجات والفواتير والإعدادات الشخصية لهذا المستخدم.'
                            : 'Control product catalog, invoice visibility, and personal invoice defaults for this user.'}
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {isAr ? 'المنتجات في الفواتير' : 'Products on invoices'}
                            </label>
                            <select
                              className={fieldClass}
                              value={accessScope.productVisibility || 'all'}
                              onChange={(e) => setAccessScopeField('productVisibility', e.target.value)}
                              disabled={watchedRole === 'admin'}
                            >
                              <option value="all">{isAr ? 'كل منتجات الشركة' : 'All company products'}</option>
                              <option value="own">{isAr ? 'منتجاته فقط' : 'Only products they created'}</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {isAr ? 'رؤية الفواتير' : 'Invoice visibility'}
                            </label>
                            <select
                              className={fieldClass}
                              value={accessScope.invoiceVisibility || 'own'}
                              onChange={(e) => setAccessScopeField('invoiceVisibility', e.target.value)}
                              disabled={watchedRole === 'admin'}
                            >
                              <option value="own">{isAr ? 'فواتيره فقط' : 'Only their invoices'}</option>
                              <option value="all">{isAr ? 'كل فواتير الشركة' : 'All company invoices'}</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-2">
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:border-white/5 dark:text-slate-200">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-slate-900"
                              checked={Boolean(accessScope.canAddProducts) || watchedRole === 'admin'}
                              disabled={watchedRole === 'admin'}
                              onChange={(e) => setAccessScopeField('canAddProducts', e.target.checked)}
                            />
                            {isAr ? 'السماح بإضافة منتجات' : 'Allow adding products'}
                          </label>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:border-white/5 dark:text-slate-200">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-slate-900"
                              checked={Boolean(accessScope.canManageOwnInvoiceSettings) || watchedRole === 'admin'}
                              disabled={watchedRole === 'admin'}
                              onChange={(e) => setAccessScopeField('canManageOwnInvoiceSettings', e.target.checked)}
                            />
                            {isAr
                              ? 'إدارة إعدادات فواتيره (شروط، ملاحظات…)'
                              : 'Manage own invoice settings (terms, notes…)'}
                          </label>
                        </div>
                      </div>

                      {/* Scoped Modules Checklist */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {isAr ? 'الصلاحيات بحسب التطبيقات المفعلة' : 'Installed Tenant Module Permissions'}
                          </p>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {enabledModules.length} {isAr ? 'تطبيق مفعل' : 'modules'}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {enabledModules.map((m) => {
                            const Icon = m.Icon
                            const allActive = isModuleAllActive(m.key)

                            return (
                              <div
                                key={m.key}
                                className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-dark-800"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white">
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                                        {isAr ? m.labelAr : m.labelEn}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => toggleAllModuleActions(m.key)}
                                    className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold uppercase transition ${
                                      allActive
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-400'
                                    }`}
                                  >
                                    {allActive ? (isAr ? 'الكل مفعل' : 'All') : isAr ? 'تحديد الكل' : 'Select All'}
                                  </button>
                                </div>

                                {/* Action Pills */}
                                <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                                  {ACTIONS.map((act) => {
                                    const active = hasModuleAction(m.key, act)
                                    return (
                                      <PermToggle
                                        key={act}
                                        label={act}
                                        active={active}
                                        onClick={() => toggleAction(m.key, act)}
                                      />
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: USER AUDIT LOGS */}
                  {activeSection === 'userLogs' && editingUser && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500">
                        {isAr ? 'سجل العمليات والنشاطات الأخيرة لهذا المستخدم' : 'Recent audit history for this user'}
                      </p>

                      {loadingUserLogs ? (
                        <div className="flex h-32 items-center justify-center">
                          <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                      ) : userLogsData?.logs?.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          {isAr ? 'لا توجد عمليات مسجلة لهذا المستخدم حتى الآن.' : 'No recorded activity yet.'}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {userLogsData?.logs?.map((l) => (
                            <div
                              key={l._id}
                              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-white/5 dark:bg-dark-800"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold uppercase text-slate-900 dark:text-white">
                                  {l.action} · {l.module}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(l.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="mt-1 text-slate-600 dark:text-slate-300">
                                {isAr ? l.descriptionAr || l.description : l.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 p-6 dark:border-white/10">
                  <button type="button" onClick={closePanel} className={ghostBtn}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>

                  <button type="submit" disabled={mutation.isPending} className={inkBtn}>
                    {mutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>{editingUser ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : isAr ? 'إنشاء المستخدم' : 'Create User'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── LOG DETAIL MODAL ─── */}
      <AnimatePresence>
        {selectedLogDetail && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLogDetail(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0c111a]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isAr ? 'تفاصيل العملية وسجل النشاط' : 'Audit Log Detail'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedLogDetail(null)}
                    className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-dark-800">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {isAr ? selectedLogDetail.descriptionAr || selectedLogDetail.description : selectedLogDetail.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-slate-400">{isAr ? 'المستخدم' : 'User'}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLogDetail.userName}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">{isAr ? 'الوحدة' : 'Module'}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLogDetail.module}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">{isAr ? 'الإجراء' : 'Action'}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLogDetail.action}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">{isAr ? 'عنوان IP' : 'IP Address'}</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{selectedLogDetail.ipAddress || '—'}</span>
                    </div>
                  </div>

                  {selectedLogDetail.details && Object.keys(selectedLogDetail.details).length > 0 && (
                    <div className="pt-2">
                      <span className="block mb-1 text-slate-400">{isAr ? 'بيانات إضافية (Metadata)' : 'Metadata'}</span>
                      <pre className="max-h-40 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
                        {JSON.stringify(selectedLogDetail.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedLogDetail(null)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-950"
                  >
                    {isAr ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

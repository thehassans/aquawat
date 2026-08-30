import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Building2, Edit, Users, LogIn, AlertCircle, RefreshCw, Trash2, RotateCcw, Send, X, XCircle, FileSpreadsheet, FileText, Eraser, Sliders, Ban, Play, Activity, Server, Database, Cpu, Download, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { addBillingCycle, formatSubscriptionDate, getSubscriptionState, previewRenewedEndDate, toIsoDay } from '../../lib/subscriptionState'
import {
  getAliasSlugFromHost,
  getTenantAliasHandoffUrl,
  issueHandoffCode,
} from '../../lib/tenantHost'
import { normalizeCheckoutPlan, resolveCheckoutLane, resolvePlanPrice } from '../../lib/checkoutPricing'
import { getPrimaryBusinessType } from '../../lib/businessTypes'
import TenantPaymentHistory from '../../components/super-admin/TenantPaymentHistory'
import SuperAdminPortal, { SA_BACKDROP_Z, SA_MODAL_Z, TenantLogoAvatar } from '../../components/super-admin/SuperAdminPortal'
import DayMonthYearInput from '../../components/ui/DayMonthYearInput'

const FALLBACK_CONTINUE_PLANS = [
  {
    id: 'starter',
    nameEn: 'Starter',
    nameAr: 'البداية',
    priceMonthlyUsd: 29.99,
    priceYearlyUsd: 299,
    priceMonthlySar: 49.99,
    priceYearlySar: 499,
  },
  {
    id: 'professional',
    nameEn: 'Professional',
    nameAr: 'الاحترافية',
    priceMonthlyUsd: 59.99,
    priceYearlyUsd: 599,
    priceMonthlySar: 99.99,
    priceYearlySar: 999,
  },
  {
    id: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'المؤسسات',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    priceMonthlySar: 0,
    priceYearlySar: 0,
  },
]

function previewContinuedEndDate(currentEndDate, billingCycle = 'monthly', cycles = 1) {
  const count = Math.max(1, Math.min(36, Number(cycles) || 1))
  let end = previewRenewedEndDate(currentEndDate, billingCycle)
  for (let i = 1; i < count; i += 1) {
    end = addBillingCycle(end, billingCycle)
  }
  return end
}

/** Period end from an explicit period start + N billing cycles. */
function previewPeriodEndFromStart(periodStart, billingCycle = 'monthly', cycles = 1) {
  const count = Math.max(1, Math.min(36, Number(cycles) || 1))
  let end = periodStart ? new Date(periodStart) : new Date()
  if (Number.isNaN(end.getTime())) end = new Date()
  // Normalize to local noon to avoid UTC day shift on yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(periodStart || ''))) {
    const [y, m, d] = String(periodStart).split('-').map(Number)
    end = new Date(y, m - 1, d, 12, 0, 0, 0)
  }
  for (let i = 0; i < count; i += 1) {
    end = addBillingCycle(end, billingCycle)
  }
  return end
}

function subscriptionBadge(tenant, language) {
  const state = getSubscriptionState(tenant)
  const isAr = language === 'ar'
  if (state.isTrialEnded || tenant?.subscription?.status === 'trial_ended') {
    return { label: isAr ? 'انتهت التجربة' : 'Trial Ended', cls: 'badge-warning' }
  }
  if (state.isExpired || tenant?.subscription?.status === 'expired') {
    return { label: isAr ? 'منتهي' : 'Expired', cls: 'badge-danger' }
  }
  if (tenant?.subscription?.status === 'terminated') {
    return { label: isAr ? 'موقوف' : 'Terminated', cls: 'badge-danger' }
  }
  if (state.isExpiringSoon) {
    return { label: isAr ? `ينتهي خلال ${state.daysLeft}ي` : `Ends in ${state.daysLeft}d`, cls: 'badge-warning' }
  }
  if (state.isActive) {
    return { label: isAr ? 'نشط' : 'Active', cls: 'badge-success' }
  }
  return { label: tenant?.subscription?.status || '—', cls: 'badge-neutral' }
}

export default function TenantManagement() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', plan: '', businessType: '', subStatus: '', demo: '' })
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [continueTenant, setContinueTenant] = useState(null)
  const [historyTenant, setHistoryTenant] = useState(null)
  const [continueForm, setContinueForm] = useState({
    plan: 'professional',
    billingCycle: 'monthly',
    cycles: 1,
    amount: '',
    currency: 'SAR',
    method: 'bank_transfer',
    reference: '',
    note: '',
    periodStart: '',
    periodEnd: '',
  })
  const [backupTenant, setBackupTenant] = useState(null)
  const [backupForm, setBackupForm] = useState({ period: 'monthly', startDate: '', endDate: '', email: '', formats: ['excel', 'pdf'] })
  const [backupErrorCode, setBackupErrorCode] = useState(null)
  const [terminationTenant, setTerminationTenant] = useState(null)
  const [terminationForm, setTerminationForm] = useState({ date: '', reason: '' })
  const [monitoringTenant, setMonitoringTenant] = useState(null)

  const { data: historyPaymentsData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['tenant', historyTenant?._id, 'payments'],
    queryFn: () => api.get(`/super-admin/tenants/${historyTenant._id}/payments`).then((res) => res.data),
    enabled: Boolean(historyTenant?._id),
  })
  const historyTenantData = historyPaymentsData
    ? { tenant: historyPaymentsData.tenant }
    : null

  const { data: websiteSettingsData } = useQuery({
    queryKey: ['website-settings'],
    queryFn: () => api.get('/super-admin/settings/website').then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: monitoringData, isLoading: isLoadingMonitoring } = useQuery({
    queryKey: ['tenantMonitoring', monitoringTenant?._id],
    queryFn: () => api.get(`/super-admin/tenants/${monitoringTenant._id}/monitoring`).then(res => res.data),
    enabled: !!monitoringTenant,
  })

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tenants', page, search, filters],
    queryFn: () => api.get('/super-admin/tenants', { params: { page, search, ...filters } }).then(res => res.data),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const tenants = Array.isArray(data?.tenants) ? data.tenants : []
  const hasTenants = tenants.length > 0
  const pageIds = tenants.map((t) => String(t._id))
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id))

  useEffect(() => {
    setSelectedIds([])
  }, [page, search, filters.status, filters.plan, filters.businessType, filters.subStatus, filters.demo])

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
      return
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])])
  }

  const toggleSelectOne = (tenantId) => {
    const id = String(tenantId)
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const loginAsMutation = useMutation({
    mutationFn: (tenantId) => api.post(`/super-admin/tenants/${tenantId}/login-as`),
    onSuccess: async (res) => {
      const token = res.data?.token
      const tenant = res.data?.tenant
      const slug = String(tenant?.slug || '').trim().toLowerCase()
      const lang = language === 'ar' ? 'ar' : 'en'

      if (!token) {
        toast.error(language === 'ar' ? 'تعذر إنشاء جلسة المستأجر' : 'Could not create tenant session')
        return
      }

      // Prefer the tenant alias host ({slug}.maqder.com) — same handoff as apex login.
      const alreadyOnThisTenant = Boolean(slug) && getAliasSlugFromHost() === slug
      if (slug && !alreadyOnThisTenant) {
        const codeOrToken = res.data?.handoffCode || null
        try {
          const code = codeOrToken || await issueHandoffCode(api, token)
          toast.success(
            language === 'ar'
              ? `جاري فتح مساحة ${tenant?.name || slug}…`
              : `Opening ${tenant?.name || slug} workspace…`,
          )
          window.location.replace(getTenantAliasHandoffUrl(slug, code, { lang }))
          return
        } catch {
          toast.success(
            language === 'ar'
              ? `جاري فتح مساحة ${tenant?.name || slug}…`
              : `Opening ${tenant?.name || slug} workspace…`,
          )
          window.location.replace(getTenantAliasHandoffUrl(slug, token, { lang }))
          return
        }
      }

      // Already on the tenant subdomain (or tenant has no slug) — stay here.
      localStorage.setItem('token', token)
      if (res.data?.user) {
        localStorage.setItem('auth_user', JSON.stringify(res.data.user))
      } else {
        localStorage.removeItem('auth_user')
      }
      if (tenant) {
        localStorage.setItem('auth_tenant', JSON.stringify(tenant))
      } else {
        localStorage.removeItem('auth_tenant')
      }
      toast.success(language === 'ar' ? 'تم تسجيل الدخول كمستأجر' : 'Logged in as tenant')
      window.location.href = '/app/dashboard'
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Login failed')
  })

  const clearInvoicesMutation = useMutation({
    mutationFn: (tenantId) => api.delete(`/super-admin/tenants/${tenantId}/invoices`, { timeout: 120000 }).then(res => res.data),
    onSuccess: (result) => {
      toast.success(
        language === 'ar'
          ? `تم حذف ${result?.deletedInvoices || 0} فاتورة`
          : `Cleared ${result?.deletedInvoices || 0} invoices`
      )
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-revenue'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['travel-bookings'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to clear invoices')
  })

  const handleClearInvoices = (tenant) => {
    const label = tenant?.name || tenant?.business?.legalNameEn || ''
    const confirmMsg = language === 'ar'
      ? `سيتم حذف جميع الفواتير للمستأجر "${label}" نهائياً وإعادة تعيين التقارير ولوحة التحكم. هل أنت متأكد؟`
      : `This will permanently delete ALL invoices for "${label}" and reset dashboards and reports. Continue?`
    if (!window.confirm(confirmMsg)) return
    clearInvoicesMutation.mutate(tenant._id)
  }

  const resetPanelMutation = useMutation({
    mutationFn: (tenantId) => api.post(`/super-admin/tenants/${tenantId}/reset`, {}, { timeout: 120000 }).then(res => res.data),
    onSuccess: (result) => {
      const totals = result?.totalRemoved
        ?? Object.values(result?.deleted || {}).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
      toast.success(
        language === 'ar'
          ? `تم تصفير المستأجر بالكامل (${totals} سجلاً)`
          : `Tenant fully reset — ${totals} records removed`
      )
      queryClient.invalidateQueries()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to reset panel')
  })

  const deleteTenantMutation = useMutation({
    mutationFn: (tenantId) => api.delete(`/super-admin/tenants/${tenantId}`, { timeout: 120000 }).then(res => res.data),
    onSuccess: (data, tenantId) => {
      toast.success(language === 'ar' ? 'تم حذف المستأجر بالكامل بنجاح' : 'Tenant completely deleted successfully')
      setSelectedIds((prev) => prev.filter((id) => id !== String(tenantId)))
      queryClient.invalidateQueries()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete tenant')
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => api.post('/super-admin/tenants/bulk-delete', { ids }, { timeout: 300000 }).then((res) => res.data),
    onSuccess: (result) => {
      const deletedCount = result?.deletedCount || 0
      const failedCount = result?.failedCount || 0
      if (deletedCount > 0) {
        toast.success(
          language === 'ar'
            ? `تم حذف ${deletedCount} مستأجر`
            : `Deleted ${deletedCount} tenant${deletedCount === 1 ? '' : 's'}`,
        )
      }
      if (failedCount > 0) {
        toast.error(
          language === 'ar'
            ? `فشل حذف ${failedCount} مستأجر`
            : `Failed to delete ${failedCount} tenant${failedCount === 1 ? '' : 's'}`,
        )
      }
      setSelectedIds([])
      queryClient.invalidateQueries()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete tenants'),
  })

  const handleDeleteTenant = (tenant) => {
    const label = tenant?.name || tenant?.business?.legalNameEn || ''
    const confirmMsg = language === 'ar'
      ? `تحذير نهائي: سيتم حذف المستأجر "${label}" وكافة المستخدمين والبيانات التابعة له بشكل لا يمكن التراجع عنه. هل أنت متأكد تماماً؟`
      : `FINAL WARNING: This will permanently delete the tenant "${label}" and ALL of its users and data. This action cannot be undone. Are you absolutely sure?`
    
    if (!window.confirm(confirmMsg)) return
    
    const doubleConfirmMsg = language === 'ar'
      ? `أنت على وشك حذف المستأجر بالكامل. اضغط "موافق" للتأكيد النهائي.`
      : `You are about to completely delete this tenant. Click "OK" to final confirm.`
      
    if (window.confirm(doubleConfirmMsg)) {
      deleteTenantMutation.mutate(tenant._id)
    }
  }

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return
    const confirmMsg = language === 'ar'
      ? `تحذير نهائي: سيتم حذف ${selectedIds.length} مستأجر وكافة بياناتهم بشكل لا يمكن التراجع عنه. هل أنت متأكد تماماً؟`
      : `FINAL WARNING: This will permanently delete ${selectedIds.length} tenant(s) and ALL of their data. This cannot be undone. Are you absolutely sure?`
    if (!window.confirm(confirmMsg)) return

    const doubleConfirmMsg = language === 'ar'
      ? `اضغط "موافق" للتأكيد النهائي لحذف ${selectedIds.length} مستأجر.`
      : `Click "OK" to finally delete ${selectedIds.length} tenant(s).`
    if (!window.confirm(doubleConfirmMsg)) return

    bulkDeleteMutation.mutate(selectedIds)
  }

  const sendBackupMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => api.post(`/super-admin/tenants/${tenantId}/send-backup`, payload).then(res => res.data),
    onSuccess: (data) => {
      toast.success(language === 'ar' ? `تم إرسال النسخة الاحتياطية إلى ${data.message?.split('to ')[1] || 'البريد'}` : data.message || 'Backup sent successfully')
      setBackupTenant(null)
    },
    onError: (err) => {
      const code = err.response?.data?.code
      const msg = err.response?.data?.error || (language === 'ar' ? 'فشل الإرسال' : 'Failed to send backup')
      if (code === 'EMAIL_DISABLED' || code === 'EMAIL_NOT_CONFIGURED') {
        setBackupErrorCode(code)
      } else {
        toast.error(msg)
      }
    }
  })

  const downloadTenantBackup = async (tenant) => {
    const toastId = toast.loading(language === 'ar' ? 'جاري تجهيز النسخة…' : 'Preparing backup…')
    try {
      const res = await api.get(`/super-admin/tenants/${tenant._id}/backup/download`, { responseType: 'blob', timeout: 600000 })
      const cd = res.headers['content-disposition'] || ''
      const match = /filename="?([^";]+)"?/i.exec(cd)
      const filename = match ? match[1] : `backup_${tenant.slug || tenant._id}.jsonl.gz`
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/gzip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(language === 'ar' ? 'بدأ التنزيل' : 'Download started', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'فشل التنزيل' : 'Download failed'), { id: toastId })
    }
  }

  const terminationMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => api.put(`/super-admin/tenants/${tenantId}/termination`, payload).then(res => res.data),
    onSuccess: (data) => {
      toast.success(language === 'ar' ? 'تم تحديث إشعار الإنهاء' : 'Termination notice updated')
      setTerminationTenant(null)
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update termination notice')
  })

  const toggleStatusMutation = useMutation({
    mutationFn: (tenantId) => api.put(`/super-admin/tenants/${tenantId}/toggle-status`).then(res => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تغيير حالة المستأجر بنجاح' : 'Tenant status updated successfully')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to toggle status')
  })

  const resumeMutation = useMutation({
    mutationFn: ({ tenantId, days, billingCycle, cycles }) =>
      api.post(`/super-admin/tenants/${tenantId}/resume`, { days, billingCycle, cycles }).then((res) => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم استئناف المستأجر بنجاح' : 'Tenant resumed successfully')
      setTerminationTenant(null)
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to resume tenant')
  })

  const continueMutation = useMutation({
    mutationFn: ({ tenantId, payload }) =>
      api.post(`/super-admin/tenants/${tenantId}/accept-payment`, payload, { timeout: 60000 }).then((res) => res.data),
    onSuccess: () => {
      toast.success(
        language === 'ar'
          ? 'تم تفعيل/تجديد الاشتراك بنجاح'
          : 'Subscription continued / renewed successfully',
      )
      setContinueTenant(null)
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-payments'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to continue subscription'),
  })

  const removePaymentMutation = useMutation({
    mutationFn: (paymentId) => api.delete(`/super-admin/tenant-payments/${paymentId}`).then((res) => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حذف الدفعة' : 'Payment removed')
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-payments'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to remove payment'),
  })

  const updatePaymentPeriodMutation = useMutation({
    mutationFn: ({ paymentId, periodStart, periodEnd }) =>
      api.patch(`/super-admin/tenant-payments/${paymentId}`, { periodStart, periodEnd }).then((res) => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الفترة' : 'Period updated')
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-payments'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update period'),
  })

  const getPricingPlansForTenant = (tenant) => {
    const website = websiteSettingsData?.website
    const businessType = getPrimaryBusinessType(tenant)
    const byType = Array.isArray(website?.pricing?.plansByBusinessType)
      ? website.pricing.plansByBusinessType.find((row) => row?.businessType === businessType)?.plans
      : null
    const source = (Array.isArray(byType) && byType.length > 0)
      ? byType
      : (Array.isArray(website?.pricing?.plans) && website.pricing.plans.length > 0
        ? website.pricing.plans
        : FALLBACK_CONTINUE_PLANS)
    const lane = resolveCheckoutLane(tenant)
    return source
      .map((plan) => {
        const fallback = FALLBACK_CONTINUE_PLANS.find((p) => p.id === plan.id) || {}
        return normalizeCheckoutPlan(plan, fallback, lane)
      })
      .filter((plan) => ['starter', 'professional', 'enterprise'].includes(String(plan.id || '').toLowerCase()))
  }

  const resolveContinueUnitPrice = (tenant, planId, billingCycle, currency) => {
    const plans = getPricingPlansForTenant(tenant)
    const plan = plans.find((p) => String(p.id).toLowerCase() === String(planId).toLowerCase())
      || FALLBACK_CONTINUE_PLANS.find((p) => p.id === planId)
      || FALLBACK_CONTINUE_PLANS[1]
    const lane = String(currency || resolveCheckoutLane(tenant) || 'SAR').toUpperCase() === 'USD' ? 'USD' : 'SAR'
    return resolvePlanPrice(plan, billingCycle, lane)
  }

  const openContinueModal = (tenant) => {
    const sub = tenant?.subscription || {}
    const currency = String(tenant?.settings?.currency || tenant?.paymentCurrency || 'SAR').toUpperCase() === 'USD' ? 'USD' : 'SAR'
    const plan = ['starter', 'professional', 'enterprise'].includes(String(sub.plan || '').toLowerCase())
      ? String(sub.plan).toLowerCase()
      : 'professional'
    const billingCycle = sub.billingCycle === 'yearly' ? 'yearly' : 'monthly'
    const unit = resolveContinueUnitPrice(tenant, plan, billingCycle, currency)
    const cycles = 1
    // New payment period starts today (same as accept-payment forceFromPaymentDate)
    const periodStart = toIsoDay(new Date())
    const periodEnd = toIsoDay(previewPeriodEndFromStart(periodStart, billingCycle, cycles))
    setContinueForm({
      plan,
      billingCycle,
      cycles,
      amount: String(unit),
      currency,
      method: 'bank_transfer',
      reference: '',
      note: '',
      periodStart,
      periodEnd,
    })
    setContinueTenant(tenant)
  }

  const updateContinueField = (field, value) => {
    setContinueForm((prev) => {
      const next = { ...prev, [field]: value }
      if (!continueTenant) return next
      if (field === 'plan' || field === 'billingCycle' || field === 'currency') {
        const unit = resolveContinueUnitPrice(
          continueTenant,
          field === 'plan' ? value : next.plan,
          field === 'billingCycle' ? value : next.billingCycle,
          field === 'currency' ? value : next.currency,
        )
        next.amount = String(unit)
      }
      if (field === 'billingCycle' || field === 'cycles' || field === 'periodStart') {
        const cycle = field === 'billingCycle' ? value : next.billingCycle
        const cycles = Math.max(1, Math.min(36, Number(field === 'cycles' ? value : next.cycles) || 1))
        const base = field === 'periodStart' ? value : next.periodStart
        if (base) {
          next.periodEnd = toIsoDay(previewPeriodEndFromStart(base, cycle, cycles))
        }
      }
      return next
    })
  }

  const handleContinueSubmit = () => {
    if (!continueTenant) return
    const cycles = Math.max(1, Math.min(36, Number(continueForm.cycles) || 1))
    const amount = Number(continueForm.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error(language === 'ar' ? 'أدخل سعراً صالحاً' : 'Enter a valid price')
      return
    }
    if (!continueForm.periodStart || !continueForm.periodEnd) {
      toast.error(language === 'ar' ? 'حدد فترة البداية والنهاية' : 'Set period start and end dates')
      return
    }
    continueMutation.mutate({
      tenantId: continueTenant._id,
      payload: {
        plan: continueForm.plan,
        billingCycle: continueForm.billingCycle,
        cycles,
        amount,
        currency: continueForm.currency,
        method: continueForm.method,
        reference: continueForm.reference,
        note: continueForm.note || (language === 'ar' ? 'تجديد من لوحة المشرف' : 'Continued from Super Admin'),
        forceFromPaymentDate: true,
        periodStart: continueForm.periodStart,
        periodEnd: continueForm.periodEnd,
      },
    })
  }

  const openTerminationModal = (tenant) => {
    setTerminationForm({
      date: tenant.terminationNotice?.date ? new Date(tenant.terminationNotice.date).toISOString().split('T')[0] : '',
      reason: tenant.terminationNotice?.reason || ''
    })
    setTerminationTenant(tenant)
  }

  const handleSetTermination = () => {
    if (!terminationForm.date || !terminationForm.reason) {
      toast.error(language === 'ar' ? 'التاريخ والسبب مطلوبان' : 'Date and reason are required')
      return
    }
    terminationMutation.mutate({
      tenantId: terminationTenant._id,
      payload: { date: terminationForm.date, reason: terminationForm.reason, clear: false }
    })
  }

  const handleClearTermination = () => {
    terminationMutation.mutate({
      tenantId: terminationTenant._id,
      payload: { clear: true }
    })
  }

  const openBackupModal = (tenant) => {
    setBackupForm({ period: 'monthly', startDate: '', endDate: '', email: tenant.business?.email || '', formats: ['excel', 'pdf'] })
    setBackupErrorCode(null)
    setBackupTenant(tenant)
  }

  const toggleFormat = (fmt) => {
    setBackupForm(prev => ({
      ...prev,
      formats: prev.formats.includes(fmt) ? prev.formats.filter(f => f !== fmt) : [...prev.formats, fmt]
    }))
  }

  const handleSendBackup = () => {
    if (!backupForm.email.trim()) {
      toast.error(language === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Recipient email is required')
      return
    }
    if (backupForm.formats.length === 0) {
      toast.error(language === 'ar' ? 'اختر تنسيقاً واحداً على الأقل' : 'Select at least one format')
      return
    }
    sendBackupMutation.mutate({
      tenantId: backupTenant._id,
      payload: {
        period: backupForm.period,
        startDate: backupForm.period === 'custom' ? backupForm.startDate : undefined,
        endDate: backupForm.period === 'custom' ? backupForm.endDate : undefined,
        email: backupForm.email,
        formats: backupForm.formats,
      }
    })
  }

  const handleResetPanel = (tenant) => {
    const label = tenant?.name || tenant?.business?.legalNameEn || ''
    const firstConfirm = language === 'ar'
      ? `تحذير: سيتم حذف كل بيانات التشغيل للمستأجر "${label}" (طلبات الشراء، إشعارات الاستلام، أوامر البيع، المخزون، المنتجات، الفواتير، عروض الأسعار، العملاء، الموردين، المستودعات، ...). سيبدأ المستأجر من الصفر. هل أنت متأكد؟`
      : `WARNING: This will permanently erase ALL operational data for "${label}" — purchase orders, GRNs, sales orders, inventory stock, products, invoices, quotations, customers, suppliers, warehouses, and more. The tenant will start from zero. Continue?`
    if (!window.confirm(firstConfirm)) return
    const confirmText = label ? label.trim() : 'RESET'
    const typed = window.prompt(
      language === 'ar'
        ? `للتأكيد، اكتب اسم المستأجر بالضبط: ${confirmText}`
        : `To confirm, type the tenant name exactly: ${confirmText}`
    )
    if (typed !== confirmText) {
      toast.error(language === 'ar' ? 'التأكيد غير صحيح' : 'Confirmation did not match')
      return
    }
    resetPanelMutation.mutate(tenant._id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tenants')}</h1>
          <p className="text-gray-500 mt-1">{language === 'ar' ? 'إدارة جميع المستأجرين والاشتراكات' : 'Manage all tenants and subscriptions'}</p>
        </div>
        <Link to="/super-admin/tenants/new" className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 text-white">
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة مستأجر' : 'Add Tenant'}
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder={`${t('search')}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="input ps-10" />
          </div>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="select w-full sm:w-40">
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
            <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
            <option value="inactive">{language === 'ar' ? 'غير نشط' : 'Inactive'}</option>
          </select>
          <select value={filters.plan} onChange={(e) => setFilters({ ...filters, plan: e.target.value })} className="select w-full sm:w-40">
            <option value="">{language === 'ar' ? 'كل الخطط' : 'All Plans'}</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={filters.subStatus} onChange={(e) => { setFilters({ ...filters, subStatus: e.target.value }); setPage(1) }} className="select w-full sm:w-44">
            <option value="">{language === 'ar' ? 'كل الاشتراكات' : 'All subscriptions'}</option>
            <option value="active">{language === 'ar' ? 'اشتراك نشط' : 'Sub Active'}</option>
            <option value="ending_soon">{language === 'ar' ? 'ينتهي قريباً' : 'Ending soon'}</option>
            <option value="expired">{language === 'ar' ? 'منتهي' : 'Expired'}</option>
            <option value="trial_ended">{language === 'ar' ? 'انتهت التجربة' : 'Trial Ended'}</option>
          </select>
          <select value={filters.businessType} onChange={(e) => { setFilters({ ...filters, businessType: e.target.value }); setPage(1) }} className="select w-full sm:w-40">
            <option value="">{language === 'ar' ? 'كل الأنشطة' : 'All Types'}</option>
            <option value="trading">{language === 'ar' ? 'تجارة' : 'Trading'}</option>
            <option value="construction">{language === 'ar' ? 'مقاولات' : 'Construction'}</option>
            <option value="restaurant">{language === 'ar' ? 'مطعم' : 'Restaurant'}</option>
            <option value="travel_agency">{language === 'ar' ? 'وكالة سفر' : 'Travel Agency'}</option>
            <option value="car_rental">{language === 'ar' ? 'تأجير سيارات' : 'Car Rental'}</option>
            <option value="laundry">{language === 'ar' ? 'مغسلة' : 'Laundry'}</option>
            <option value="khayyat">{language === 'ar' ? 'خياط' : 'Khayyat'}</option>
            <option value="saloon">{language === 'ar' ? 'صالون' : 'Saloon'}</option>
            <option value="bakala">{language === 'ar' ? 'بقالة' : 'Bakala'}</option>
            <option value="pharmacy">{language === 'ar' ? 'صيدلية' : 'Pharmacy'}</option>
          </select>
          <select value={filters.demo} onChange={(e) => { setFilters({ ...filters, demo: e.target.value }); setPage(1) }} className="select w-full sm:w-40">
            <option value="">{language === 'ar' ? 'الكل (ديمو/حي)' : 'All (Demo/Live)'}</option>
            <option value="demo">{language === 'ar' ? 'ديمو فقط' : 'Demo only'}</option>
            <option value="live">{language === 'ar' ? 'بدون ديمو' : 'Live only'}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'تعذر تحميل المستأجرين' : 'Unable to load tenants'}</h3>
              <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">{error?.userMessage || error?.response?.data?.error || error?.message || (language === 'ar' ? 'حدث خطأ أثناء تحميل بيانات المستأجرين.' : 'An error occurred while loading tenants.')}</p>
            </div>
            <button onClick={() => refetch()} className="btn btn-secondary">
              <RefreshCw className="w-4 h-4" />
              {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : !hasTenants ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'لا يوجد مستأجرون حتى الآن' : 'No tenants yet'}</h3>
              <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'ابدأ بإضافة أول مستأجر ليظهر هنا في قائمة الإدارة.' : 'Create your first tenant and it will appear here in the management list.'}</p>
            </div>
            <Link to="/super-admin/tenants/new" className="btn btn-primary">
              <Plus className="w-4 h-4" />
              {language === 'ar' ? 'إضافة مستأجر' : 'Add Tenant'}
            </Link>
          </div>
        ) : (
          <>
            {selectedIds.length > 0 && (
              <div className="flex flex-col gap-3 border-b border-rose-100 bg-rose-50/80 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
                  {language === 'ar'
                    ? `تم تحديد ${selectedIds.length} مستأجر`
                    : `${selectedIds.length} tenant${selectedIds.length === 1 ? '' : 's'} selected`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="btn btn-secondary"
                    disabled={bulkDeleteMutation.isPending}
                  >
                    {language === 'ar' ? 'إلغاء التحديد' : 'Clear selection'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    className="btn inline-flex items-center gap-2 bg-rose-600 text-white hover:bg-rose-700 border-rose-600 hover:border-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {bulkDeleteMutation.isPending
                      ? (language === 'ar' ? 'جاري الحذف…' : 'Deleting…')
                      : (language === 'ar' ? `حذف المحدد (${selectedIds.length})` : `Delete selected (${selectedIds.length})`)}
                  </button>
                </div>
              </div>
            )}
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected && !allPageSelected
                        }}
                        onChange={toggleSelectAllPage}
                        aria-label={language === 'ar' ? 'تحديد الكل في الصفحة' : 'Select all on page'}
                      />
                    </th>
                    <th>{language === 'ar' ? 'المستأجر' : 'Tenant'}</th>
                    <th>{language === 'ar' ? 'النشاط' : 'Business Type'}</th>
                    <th>{language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}</th>
                    <th>{language === 'ar' ? 'الخطة' : 'Plan'}</th>
                    <th>{language === 'ar' ? 'أساس الفوترة' : 'Billing'}</th>
                    <th>{language === 'ar' ? 'المدفوع' : 'Total paid'}</th>
                    <th>{language === 'ar' ? 'الاشتراك' : 'Subscription'}</th>
                    <th>{language === 'ar' ? 'المستخدمين' : 'Users'}</th>
                    <th>{language === 'ar' ? 'الفواتير' : 'Invoices'}</th>
                    <th>{t('status')}</th>
                    <th>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</th>
                    <th>{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiring Date'}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant._id} className={selectedIds.includes(String(tenant._id)) ? 'bg-rose-50/40 dark:bg-rose-950/10' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          checked={selectedIds.includes(String(tenant._id))}
                          onChange={() => toggleSelectOne(tenant._id)}
                          aria-label={language === 'ar' ? `تحديد ${tenant.name}` : `Select ${tenant.name}`}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <TenantLogoAvatar tenant={tenant} />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setHistoryTenant(tenant)}
                                className="font-medium text-gray-900 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-start"
                                title={language === 'ar' ? 'عرض سجل المدفوعات' : 'View payment history'}
                              >
                                {tenant.name}
                              </button>
                              {tenant.isDemo ? (
                                <span className="badge badge-warning">{language === 'ar' ? 'ديمو' : 'Demo'}</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-500">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const bt = Array.isArray(tenant.businessTypes) && tenant.businessTypes.length > 0
                            ? tenant.businessTypes[0]
                            : tenant.businessType;
                          if (!bt) return '-';
                          const labelEn = bt.charAt(0).toUpperCase() + bt.slice(1).replace('_', ' ');
                          const labelAr = bt === 'trading' ? 'تجارة' : bt === 'construction' ? 'مقاولات' : bt === 'restaurant' ? 'مطعم' : bt === 'laundry' ? 'مغسلة' : bt === 'travel_agency' ? 'وكالة سفر' : labelEn;
                          return <span className="badge badge-neutral">{language === 'ar' ? labelAr : labelEn}</span>
                        })()}
                      </td>
                      <td className="font-mono text-sm">{tenant.business?.vatNumber || '-'}</td>
                      <td>
                        <span className={`badge ${
                          tenant.subscription?.plan === 'enterprise' ? 'badge-info' :
                          tenant.subscription?.plan === 'professional' ? 'badge-success' :
                          tenant.subscription?.plan === 'starter' ? 'badge-warning' :
                          'badge-neutral'
                        }`}>
                          {tenant.subscription?.plan}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-sm capitalize text-gray-600 dark:text-gray-300">
                        {(tenant.subscription?.billingCycle || 'monthly') === 'yearly'
                          ? (language === 'ar' ? 'سنوي' : 'Yearly')
                          : (language === 'ar' ? 'شهري' : 'Monthly')}
                      </td>
                      <td className="whitespace-nowrap tabular-nums text-sm font-medium text-gray-800 dark:text-gray-100">
                        {Number(tenant.totalPaid || 0).toFixed(2)}{' '}
                        <span className="text-xs font-normal text-gray-400">
                          {tenant.paymentCurrency || tenant.settings?.currency || 'SAR'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const badge = subscriptionBadge(tenant, language)
                          return <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        })()}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{tenant.userCount || 0}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span>{tenant.invoiceCount || 0}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${tenant.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {tenant.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                        </span>
                      </td>
                      <td className="text-gray-500 whitespace-nowrap">{formatSubscriptionDate(tenant.createdAt, language)}</td>
                      <td className="text-gray-500 whitespace-nowrap">{tenant.subscription?.endDate ? formatSubscriptionDate(tenant.subscription.endDate, language) : '-'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => loginAsMutation.mutate(tenant._id)}
                            disabled={!tenant.isActive || loginAsMutation.isPending}
                            className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-primary-600 disabled:opacity-50"
                            title={language === 'ar' ? 'تسجيل الدخول كمستأجر' : 'Login as Tenant'}
                          >
                            <LogIn className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatusMutation.mutate(tenant._id)}
                            disabled={toggleStatusMutation.isPending}
                            className={`p-2 rounded-lg disabled:opacity-50 ${tenant.isActive ? 'hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-900/20' : 'hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-900/20'}`}
                            title={tenant.isActive ? (language === 'ar' ? 'إيقاف المستأجر' : 'Stop Tenant') : (language === 'ar' ? 'تفعيل المستأجر' : 'Start Tenant')}
                          >
                            {tenant.isActive ? <Ban className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <Link to={`/super-admin/tenants/${tenant._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </Link>
                          <Link to={`/super-admin/tenants/${tenant._id}/customization`} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" title={language === 'ar' ? 'تخصيص البيانات' : 'Data Customization'}>
                            <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleClearInvoices(tenant)}
                            disabled={clearInvoicesMutation.isPending}
                            className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg text-orange-600 disabled:opacity-50"
                            title={language === 'ar' ? 'حذف جميع الفواتير' : 'Clear all invoices'}
                          >
                            <Eraser className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openTerminationModal(tenant)}
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-rose-600 disabled:opacity-50"
                            title={language === 'ar' ? 'إشعار إنهاء' : 'Termination Notice'}
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                          {tenant.terminationNotice?.date && tenant.isActive && tenant.subscription?.status !== 'terminated' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(language === 'ar' ? 'هل تريد إلغاء إشعار الإنهاء لهذا المستأجر؟' : 'Cancel the termination notice for this tenant?')) {
                                  terminationMutation.mutate({ tenantId: tenant._id, payload: { clear: true } })
                                }
                              }}
                              disabled={terminationMutation.isPending}
                              className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-600 disabled:opacity-50"
                              title={language === 'ar' ? 'إلغاء إشعار الإنهاء' : 'Cancel Termination'}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {(!tenant.isActive || tenant.subscription?.status === 'terminated' || getSubscriptionState(tenant).isExpired) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(language === 'ar' ? 'هل أنت متأكد أنك تريد استئناف هذا المستأجر؟' : 'Are you sure you want to resume this tenant?')) {
                                  resumeMutation.mutate({ tenantId: tenant._id, days: 0 });
                                }
                              }}
                              disabled={resumeMutation.isPending}
                              className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-600 font-bold disabled:opacity-50"
                              title={language === 'ar' ? 'استئناف الحساب فوراً' : 'Resume Account Instantly'}
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openContinueModal(tenant)}
                            className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-700 disabled:opacity-50"
                            title={
                              getSubscriptionState(tenant).isExpired
                                ? (language === 'ar' ? 'متابعة / تجديد الاشتراك المنتهي' : 'Continue / renew expired subscription')
                                : (language === 'ar' ? 'تجديد الاشتراك (شهري/سنوي)' : 'Renew subscription (monthly/yearly)')
                            }
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMonitoringTenant(tenant)}
                            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-600 disabled:opacity-50"
                            title={language === 'ar' ? 'مراقبة الموارد' : 'Resource Monitoring'}
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPanel(tenant)}
                            disabled={resetPanelMutation.isPending}
                            className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg text-amber-600 disabled:opacity-50"
                            title={language === 'ar' ? 'تصفير لوحة المستأجر بالكامل' : 'Reset entire tenant panel'}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTenant(tenant)}
                            disabled={deleteTenantMutation.isPending}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 disabled:opacity-50"
                            title={language === 'ar' ? 'حذف المستأجر بالكامل' : 'Delete entire tenant'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadTenantBackup(tenant)}
                            className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-slate-600 disabled:opacity-50"
                            title={language === 'ar' ? 'تنزيل نسخة احتياطية' : 'Download backup'}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openBackupModal(tenant)}
                            className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-700 disabled:opacity-50"
                            title={language === 'ar' ? 'إرسال نسخة احتياطية' : 'Send data backup'}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data?.pagination && (
              <div className="p-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {language === 'ar' ? `عرض ${tenants.length} من ${data.pagination.total}` : `Showing ${tenants.length} of ${data.pagination.total}`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary">
                    {language === 'ar' ? 'السابق' : 'Previous'}
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.pages} className="btn btn-secondary">
                    {language === 'ar' ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      <SuperAdminPortal>
      {/* ── Send Backup Modal ── */}
      <AnimatePresence>
        {backupTenant && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBackupTenant(null)} className={`fixed inset-0 bg-black/50 ${SA_BACKDROP_Z}`} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`fixed inset-0 m-auto h-fit w-[min(100%-2rem,32rem)] max-h-[90vh] bg-white dark:bg-dark-800 rounded-2xl shadow-xl ${SA_MODAL_Z} overflow-hidden`}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'إرسال نسخة احتياطية' : 'Send Data Backup'}
                    </h3>
                    <p className="text-sm text-gray-500">{backupTenant.name}</p>
                  </div>
                </div>
                <button onClick={() => setBackupTenant(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 pt-5 pb-2 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>

                {/* Email config warning */}
                {backupErrorCode && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-3">
                    <span className="text-amber-500 mt-0.5 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        {backupErrorCode === 'EMAIL_DISABLED'
                          ? (language === 'ar' ? 'إرسال البريد معطل' : 'Email delivery is disabled')
                          : (language === 'ar' ? 'البريد غير مهيأ' : 'Email is not configured')}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        {language === 'ar' ? 'يرجى تفعيل البريد من ' : 'Please enable it in '}
                        <a href="/super-admin/email" target="_blank" rel="noreferrer" className="underline font-semibold hover:text-amber-900">
                          {language === 'ar' ? 'إعدادات البريد' : 'Email Settings'}
                        </a>
                      </p>
                    </div>
                  </div>
                )}


                {/* Period */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    {language === 'ar' ? 'الفترة الزمنية' : 'Period'}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[['weekly', language === 'ar' ? 'أسبوعي' : 'Weekly'], ['monthly', language === 'ar' ? 'شهري' : 'Monthly'], ['custom', language === 'ar' ? 'مخصص' : 'Custom']].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBackupForm(p => ({ ...p, period: val }))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                          backupForm.period === val
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-dark-700 border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:border-emerald-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom date range */}
                {backupForm.period === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{language === 'ar' ? 'من' : 'From'}</label>
                      <input type="date" value={backupForm.startDate} onChange={e => setBackupForm(p => ({ ...p, startDate: e.target.value }))} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'إلى' : 'To'}</label>
                      <input type="date" value={backupForm.endDate} onChange={e => setBackupForm(p => ({ ...p, endDate: e.target.value }))} className="input" />
                    </div>
                  </div>
                )}

                {/* Format */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">{language === 'ar' ? 'التنسيق' : 'Format'}</p>
                  <div className="flex gap-3">
                    {[['excel', <FileSpreadsheet key="excel" className="w-4 h-4" />, 'Excel (.xlsx)'], ['pdf', <FileText key="pdf" className="w-4 h-4" />, 'PDF']].map(([fmt, icon, label]) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => toggleFormat(fmt)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                          backupForm.formats.includes(fmt)
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-dark-700 border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-emerald-400'
                        }`}
                      >
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient email */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    {language === 'ar' ? 'البريد الإلكتروني للمستلم' : 'Recipient Email'}
                  </p>
                  <input
                    type="email"
                    value={backupForm.email}
                    onChange={e => setBackupForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="customer@gmail.com"
                    className="input"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    {language === 'ar' ? 'سيتم إرسال الملفات المرفقة إلى هذا البريد' : 'The backup files will be sent as email attachments to this address'}
                  </p>
                </div>

                {/* What will be included */}
                <div className="flex flex-wrap gap-2 pb-1">
                  {[
                    language === 'ar' ? 'الفواتير' : 'Invoices',
                    language === 'ar' ? 'المصروفات' : 'Expenses',
                    language === 'ar' ? 'الموظفون' : 'Employees',
                    language === 'ar' ? 'الرواتب' : 'Payroll',
                  ].map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-dark-700">
                <button type="button" onClick={() => setBackupTenant(null)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSendBackup}
                  disabled={sendBackupMutation.isPending}
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700"
                >
                  {sendBackupMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{language === 'ar' ? 'جارٍ الإرسال...' : 'Sending...'}</>
                  ) : (
                    <><Send className="w-4 h-4" />{language === 'ar' ? 'إرسال النسخة الاحتياطية' : 'Send Backup'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Tenant Payment History Modal ── */}
      <AnimatePresence>
        {historyTenant && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setHistoryTenant(null)} className={`fixed inset-0 bg-black/50 ${SA_BACKDROP_Z}`} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`fixed inset-0 m-auto h-fit w-[min(100%-2rem,64rem)] max-h-[90vh] ${SA_MODAL_Z} overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-dark-800`}
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <TenantLogoAvatar tenant={historyTenantData?.tenant || historyTenant} />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'سجل مدفوعات الاشتراك' : 'Subscription payment history'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {historyTenant.name}
                      {historyTenant.slug ? ` · ${historyTenant.slug}` : ''}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setHistoryTenant(null)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-dark-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(90vh - 160px)' }}>
                {(() => {
                  const detail = historyTenantData?.tenant || historyTenant
                  const badge = subscriptionBadge(detail, language)
                  const sub = detail?.subscription || {}
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-dark-600 dark:bg-dark-700/40">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">{language === 'ar' ? 'الخطة' : 'Plan'}</p>
                        <p className="mt-1 font-semibold capitalize text-gray-900 dark:text-white">{sub.plan || '—'}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-dark-600 dark:bg-dark-700/40">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">{language === 'ar' ? 'أساس الفوترة' : 'Billing basis'}</p>
                        <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                          {(sub.billingCycle || 'monthly') === 'yearly'
                            ? (language === 'ar' ? 'سنوي' : 'Yearly')
                            : (language === 'ar' ? 'شهري' : 'Monthly')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-dark-600 dark:bg-dark-700/40">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">{language === 'ar' ? 'تاريخ البدء' : 'Start date'}</p>
                        <p className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-white">
                          {formatSubscriptionDate(sub.startDate, language)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-dark-600 dark:bg-dark-700/40">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">{language === 'ar' ? 'تاريخ الانتهاء' : 'End date'}</p>
                        <p className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-white">
                          {formatSubscriptionDate(sub.endDate || detail?.demoTrialEndsAt, language)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-dark-600 dark:bg-dark-700/40">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">{language === 'ar' ? 'إجمالي المدفوع' : 'Total paid'}</p>
                        <p className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-white">
                          {Number(historyPaymentsData?.stats?.totalAmount ?? historyTenant.totalPaid ?? 0).toFixed(2)}{' '}
                          <span className="text-xs font-normal text-gray-400">
                            {historyTenant.paymentCurrency || detail?.settings?.currency || 'SAR'}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-dark-600 dark:bg-dark-700/40">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">{language === 'ar' ? 'الاشتراك' : 'Subscription'}</p>
                        <p className="mt-1"><span className={`badge ${badge.cls}`}>{badge.label}</span></p>
                        <p className="mt-1 text-xs text-gray-500">
                          {Number(sub.price || 0).toFixed(2)} {detail?.settings?.currency || 'SAR'}
                          {' / '}
                          {(sub.billingCycle || 'monthly') === 'yearly'
                            ? (language === 'ar' ? 'سنة' : 'yr')
                            : (language === 'ar' ? 'شهر' : 'mo')}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {isLoadingHistory ? (
                  <div className="flex justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                  </div>
                ) : (
                  <TenantPaymentHistory
                    history={historyPaymentsData?.payments || []}
                    language={language}
                    removingId={removePaymentMutation.isPending ? removePaymentMutation.variables : null}
                    updatingId={updatePaymentPeriodMutation.isPending ? updatePaymentPeriodMutation.variables?.paymentId : null}
                    onRemove={(row) => {
                      if (!row?._id) return
                      if (!window.confirm(language === 'ar' ? 'حذف هذه الدفعة؟' : 'Remove this payment?')) return
                      removePaymentMutation.mutate(row._id)
                    }}
                    onUpdatePeriod={(row, { periodStart, periodEnd }) => {
                      if (!row?._id) return
                      updatePaymentPeriodMutation.mutate({
                        paymentId: row._id,
                        periodStart,
                        periodEnd,
                      })
                    }}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-dark-700">
                <Link
                  to={`/super-admin/tenants/${historyTenant._id}`}
                  className="btn btn-secondary"
                  onClick={() => setHistoryTenant(null)}
                >
                  <Edit className="h-4 w-4" />
                  {language === 'ar' ? 'تعديل المستأجر' : 'Edit tenant'}
                </Link>
                <button
                  type="button"
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700"
                  onClick={() => {
                    const tenantForContinue = historyTenantData?.tenant || historyTenant
                    setHistoryTenant(null)
                    openContinueModal({
                      ...tenantForContinue,
                      totalPaid: historyPaymentsData?.stats?.totalAmount ?? historyTenant.totalPaid ?? 0,
                      paymentCount: historyPaymentsData?.stats?.count ?? historyTenant.paymentCount ?? 0,
                      paymentCurrency: historyTenant.paymentCurrency || tenantForContinue?.settings?.currency || 'SAR',
                    })
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  {language === 'ar' ? 'تسجيل دفعة / تجديد' : 'Record payment / renew'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Continue / Renew Subscription Modal ── */}
      <AnimatePresence>
        {continueTenant && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContinueTenant(null)} className={`fixed inset-0 bg-black/50 ${SA_BACKDROP_Z}`} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`fixed inset-0 m-auto h-fit w-[min(100%-2rem,32rem)] max-h-[90vh] bg-white dark:bg-dark-800 rounded-2xl shadow-xl ${SA_MODAL_Z} overflow-hidden`}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {getSubscriptionState(continueTenant).isExpired
                        ? (language === 'ar' ? 'متابعة اشتراك منتهٍ' : 'Continue expired subscription')
                        : (language === 'ar' ? 'تجديد الاشتراك' : 'Renew subscription')}
                    </h3>
                    <p className="text-sm text-gray-500">{continueTenant.name}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setContinueTenant(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-dark-600 dark:bg-dark-700/40 space-y-1.5">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {language === 'ar' ? 'الحالة الحالية' : 'Current status'}:{' '}
                    {subscriptionBadge(continueTenant, language).label}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {language === 'ar' ? 'تاريخ البدء الحالي:' : 'Existing start date:'}{' '}
                    <span className="font-medium tabular-nums">
                      {formatSubscriptionDate(continueTenant.subscription?.startDate, language)}
                    </span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {language === 'ar' ? 'تاريخ الانتهاء الحالي:' : 'Existing end date:'}{' '}
                    <span className="font-medium tabular-nums">
                      {formatSubscriptionDate(
                        continueTenant.subscription?.endDate || continueTenant.demoTrialEndsAt,
                        language,
                      )}
                    </span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {language === 'ar' ? 'أساس الفوترة:' : 'Billing basis:'}{' '}
                    <span className="font-medium capitalize">
                      {(continueTenant.subscription?.billingCycle || 'monthly') === 'yearly'
                        ? (language === 'ar' ? 'سنوي' : 'Yearly')
                        : (language === 'ar' ? 'شهري' : 'Monthly')}
                    </span>
                    {' · '}
                    <span className="capitalize">{continueTenant.subscription?.plan || 'trial'}</span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {language === 'ar' ? 'إجمالي المدفوع:' : 'Total price paid:'}{' '}
                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {Number(continueTenant.totalPaid || 0).toFixed(2)}{' '}
                      {continueTenant.paymentCurrency || continueTenant.settings?.currency || 'SAR'}
                    </span>
                    {continueTenant.paymentCount ? (
                      <span className="text-gray-400">
                        {' '}({continueTenant.paymentCount} {language === 'ar' ? 'دفعة' : `payment${continueTenant.paymentCount === 1 ? '' : 's'}`})
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">{language === 'ar' ? 'الخطة' : 'Plan'}</label>
                    <select className="select" value={continueForm.plan} onChange={(e) => updateContinueField('plan', e.target.value)}>
                      {getPricingPlansForTenant(continueTenant).map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {language === 'ar' ? (plan.nameAr || plan.id) : (plan.nameEn || plan.id)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'دورة الفوترة' : 'Billing cycle'}</label>
                    <select className="select" value={continueForm.billingCycle} onChange={(e) => updateContinueField('billingCycle', e.target.value)}>
                      <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                      <option value="yearly">{language === 'ar' ? 'سنوي' : 'Yearly'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'بداية الفترة' : 'Period start'}</label>
                    <DayMonthYearInput
                      className="input tabular-nums"
                      value={continueForm.periodStart}
                      onChange={(iso) => updateContinueField('periodStart', iso)}
                    />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'نهاية الفترة' : 'Period end'}</label>
                    <DayMonthYearInput
                      className="input tabular-nums"
                      value={continueForm.periodEnd}
                      onChange={(iso) => updateContinueField('periodEnd', iso)}
                    />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'عدد الدورات' : 'Cycles'}</label>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      className="input"
                      value={continueForm.cycles}
                      onChange={(e) => updateContinueField('cycles', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">
                      {language === 'ar'
                        ? (continueForm.billingCycle === 'yearly' ? 'السعر السنوي' : 'السعر الشهري')
                        : (continueForm.billingCycle === 'yearly' ? 'Yearly price' : 'Monthly price')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input pe-14"
                        value={continueForm.amount}
                        onChange={(e) => updateContinueField('amount', e.target.value)}
                      />
                      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                        {continueForm.currency}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'العملة' : 'Currency'}</label>
                    <select className="select" value={continueForm.currency} onChange={(e) => updateContinueField('currency', e.target.value)}>
                      <option value="SAR">SAR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'طريقة الدفع' : 'Method'}</label>
                    <select className="select" value={continueForm.method} onChange={(e) => updateContinueField('method', e.target.value)}>
                      <option value="bank_transfer">{language === 'ar' ? 'تحويل بنكي' : 'Bank transfer'}</option>
                      <option value="cash">{language === 'ar' ? 'نقداً' : 'Cash'}</option>
                      <option value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</option>
                      <option value="stc_pay">STC Pay</option>
                      <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">{language === 'ar' ? 'المرجع' : 'Reference'}</label>
                    <input
                      className="input"
                      value={continueForm.reference}
                      onChange={(e) => updateContinueField('reference', e.target.value)}
                      placeholder={language === 'ar' ? 'رقم التحويل…' : 'Transfer ref…'}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                    {language === 'ar' ? 'الملخص' : 'Summary'}
                  </p>
                  <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                    {(Number(continueForm.amount) || 0).toFixed(2)} {continueForm.currency}
                    {' × '}
                    {Math.max(1, Number(continueForm.cycles) || 1)}
                    {' ('}
                    {continueForm.billingCycle === 'yearly'
                      ? (language === 'ar' ? 'سنوي' : 'yearly')
                      : (language === 'ar' ? 'شهري' : 'monthly')}
                    {') = '}
                    <span className="font-bold">
                      {((Number(continueForm.amount) || 0) * Math.max(1, Number(continueForm.cycles) || 1)).toFixed(2)} {continueForm.currency}
                    </span>
                  </p>
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {language === 'ar' ? 'فترة الدفع:' : 'Payment period:'}{' '}
                    {formatSubscriptionDate(continueForm.periodStart, language)}
                    {' → '}
                    {formatSubscriptionDate(continueForm.periodEnd, language)}
                  </p>
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                    {language === 'ar' ? 'ساري حتى:' : 'Valid until:'}{' '}
                    <span className="font-semibold tabular-nums">
                      {formatSubscriptionDate(continueForm.periodEnd, language)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-dark-700">
                <button type="button" onClick={() => setContinueTenant(null)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleContinueSubmit}
                  disabled={continueMutation.isPending}
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  {continueMutation.isPending
                    ? '…'
                    : (language === 'ar' ? 'تفعيل ومتابعة' : 'Activate & continue')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Termination Modal ── */}
      <AnimatePresence>
        {terminationTenant && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTerminationTenant(null)} className={`fixed inset-0 bg-black/50 ${SA_BACKDROP_Z}`} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`fixed inset-0 m-auto h-fit w-[min(100%-2rem,28rem)] max-h-[90vh] bg-white dark:bg-dark-800 rounded-2xl shadow-xl ${SA_MODAL_Z} overflow-hidden`}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'إشعار إنهاء المستأجر' : 'Tenant Termination Notice'}
                    </h3>
                    <p className="text-sm text-gray-500">{terminationTenant.name}</p>
                  </div>
                </div>
                <button onClick={() => setTerminationTenant(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="label">{language === 'ar' ? 'تاريخ الإنهاء' : 'Termination Date'}</label>
                  <input
                    type="date"
                    value={terminationForm.date}
                    onChange={e => setTerminationForm(p => ({ ...p, date: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'سبب الإنهاء' : 'Termination Reason'}</label>
                  <textarea
                    value={terminationForm.reason}
                    onChange={e => setTerminationForm(p => ({ ...p, reason: e.target.value }))}
                    className="input min-h-[100px] resize-none"
                    placeholder={language === 'ar' ? 'اكتب سبب الإنهاء هنا...' : 'Enter termination reason here...'}
                  />
                </div>
              </div>

              <div className="px-6 pb-4 border-t border-gray-100 dark:border-dark-700 pt-4 mt-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <h4 className="text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    {language === 'ar' ? 'استئناف المستأجر (إلغاء الإنهاء وتمديد)' : 'Resume Tenant (Clear Notice & Extend)'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {[3, 7, 14].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => resumeMutation.mutate({ tenantId: terminationTenant._id, days })}
                        disabled={resumeMutation.isPending}
                        className="btn btn-secondary text-sm bg-white dark:bg-dark-800 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 text-emerald-700 dark:text-emerald-400 flex-1"
                      >
                        {language === 'ar' ? `+ ${days} أيام` : `+ ${days} Days`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-dark-700">
                {terminationTenant.terminationNotice && (
                  <button
                    type="button"
                    onClick={handleClearTermination}
                    disabled={terminationMutation.isPending}
                    className="btn btn-secondary text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 mr-auto"
                  >
                    {language === 'ar' ? 'إلغاء الإنهاء' : 'Clear Notice'}
                  </button>
                )}
                <button type="button" onClick={() => setTerminationTenant(null)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSetTermination}
                  disabled={terminationMutation.isPending}
                  className="btn btn-primary bg-rose-600 hover:bg-rose-700 border-rose-600 hover:border-rose-700"
                >
                  {terminationMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    language === 'ar' ? 'حفظ' : 'Save'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Monitoring Modal ── */}
      <AnimatePresence>
        {monitoringTenant && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setMonitoringTenant(null)} 
              className={`fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-md ${SA_BACKDROP_Z}`} 
            />
            <div className={`fixed inset-0 ${SA_MODAL_Z} flex items-center justify-center p-4 sm:p-6 pointer-events-none`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-lg bg-white/80 dark:bg-dark-900/80 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] border border-white/40 dark:border-white/10 pointer-events-auto overflow-hidden"
              >
                <div className="relative p-6 sm:p-8">
                  {/* Premium Header */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 p-[1px] shadow-lg shadow-indigo-500/20">
                        <div className="w-full h-full bg-white dark:bg-dark-800 rounded-[15px] flex items-center justify-center">
                          <Activity className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                          {language === 'ar' ? 'مراقبة الموارد' : 'Resource Monitor'}
                        </h3>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{monitoringTenant.name}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setMonitoringTenant(null)} 
                      className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-dark-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {isLoadingMonitoring ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full" />
                          <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
                        </div>
                        <p className="mt-4 text-sm text-gray-500 font-medium animate-pulse">
                          {language === 'ar' ? 'جاري الفحص...' : 'Scanning resources...'}
                        </p>
                      </div>
                    ) : !monitoringData ? (
                      <div className="text-center py-12 text-gray-500 bg-gray-50/50 dark:bg-dark-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-dark-700">
                        {language === 'ar' ? 'تعذر جلب البيانات' : 'Failed to fetch data'}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 p-4 rounded-2xl text-sm border border-blue-100/50 dark:border-blue-800/30 font-medium">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          {monitoringData.status === 'mocked' ? 'Using Internal Metrics (Integration Disabled)' : 'Live Data from External Integration'}
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          {[
                            {
                              label: language === 'ar' ? 'الجلسات النشطة (24س)' : 'Active Sessions',
                              value: monitoringData.activeSessions || 0,
                              icon: Users,
                              color: 'from-indigo-500 to-purple-500',
                              bg: 'bg-indigo-50 dark:bg-indigo-900/10'
                            },
                            {
                              label: language === 'ar' ? 'مساحة التخزين' : 'Storage Used',
                              value: monitoringData.resources?.disk || '0 MB',
                              icon: Database,
                              color: 'from-emerald-400 to-teal-500',
                              bg: 'bg-emerald-50 dark:bg-emerald-900/10'
                            },
                            {
                              label: language === 'ar' ? 'الذاكرة (RAM)' : 'Memory Used',
                              value: monitoringData.resources?.memory || '0 MB',
                              icon: Server,
                              color: 'from-amber-400 to-orange-500',
                              bg: 'bg-amber-50 dark:bg-amber-900/10'
                            },
                            {
                              label: language === 'ar' ? 'المعالج' : 'CPU Load',
                              value: monitoringData.resources?.cpu || '0%',
                              icon: Cpu,
                              color: 'from-rose-400 to-red-500',
                              bg: 'bg-rose-50 dark:bg-rose-900/10'
                            }
                          ].map((stat, idx) => (
                            <div 
                              key={idx} 
                              className="relative group p-5 bg-white/60 dark:bg-dark-800/60 hover:bg-white dark:hover:bg-dark-800 transition-all duration-300 rounded-2xl border border-gray-100 dark:border-dark-700/50 shadow-sm hover:shadow-md overflow-hidden"
                            >
                              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-[0.03] dark:opacity-[0.05] rounded-bl-full transition-transform group-hover:scale-110`} />
                              <div className={`inline-flex p-2.5 rounded-xl ${stat.bg} mb-4`}>
                                <stat.icon className={`w-5 h-5 bg-gradient-to-br ${stat.color} text-transparent bg-clip-text drop-shadow-sm`} />
                              </div>
                              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
                                {stat.value}
                              </p>
                              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {stat.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      </SuperAdminPortal>
    </div>
  )
}

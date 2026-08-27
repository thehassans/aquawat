import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Receipt, CheckCircle2, DollarSign, XCircle, FolderKanban, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import PartnerCombobox from '../components/inventory/PartnerCombobox'
import { useLiveTranslation } from '../lib/liveTranslation'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import { showArabicFields as isArabicTenantMarket } from '../lib/saudiTenant'

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
const fieldControlClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-400'
const ghostBtn =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20'
const primaryBtn =
  'inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_12px_24px_-16px_rgba(15,118,110,0.85)] transition hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400'

const statusMeta = {
  draft: { badge: 'badge-neutral', en: 'Draft', ar: 'Ù…Ø³ÙˆØ¯Ø©' },
  pending_approval: { badge: 'badge-warning', en: 'Pending Approval', ar: 'Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø©' },
  approved: { badge: 'badge-info', en: 'Approved', ar: 'Ù…Ø¹ØªÙ…Ø¯' },
  paid: { badge: 'badge-success', en: 'Paid', ar: 'Ù…Ø¯ÙÙˆØ¹' },
  cancelled: { badge: 'badge-danger', en: 'Cancelled', ar: 'Ù…Ù„ØºÙŠ' },
}

const formatDateForInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const categories = [
  { value: 'utilities', en: 'Utilities', ar: 'Ù…Ø±Ø§ÙÙ‚' },
  { value: 'rent', en: 'Rent', ar: 'Ø¥ÙŠØ¬Ø§Ø±' },
  { value: 'travel', en: 'Travel', ar: 'Ø³ÙØ±' },
  { value: 'marketing', en: 'Marketing', ar: 'ØªØ³ÙˆÙŠÙ‚' },
  { value: 'supplies', en: 'Supplies', ar: 'Ù…Ø³ØªÙ„Ø²Ù…Ø§Øª' },
  { value: 'maintenance', en: 'Maintenance', ar: 'ØµÙŠØ§Ù†Ø©' },
  { value: 'other', en: 'Other', ar: 'Ø£Ø®Ø±Ù‰' },
]

export default function ExpenseForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const location = useLocation()
  const projectIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return String(params.get('projectId') || '').trim()
  }, [location.search])

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const showProjects = getTenantBusinessTypes(tenant).includes('construction')
  const showArabicFields = isArabicTenantMarket(tenant)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      expenseNumber: '',
      expenseDate: formatDateForInput(new Date()),
      category: 'other',
      categoryAr: '',
      description: '',
      descriptionAr: '',
      projectId: projectIdFromQuery,
      payeeType: 'supplier',
      supplierId: '',
      employeeId: '',
      customerId: '',
      payeeName: '',
      currency: tenant?.settings?.currency || 'SAR',
      amount: 0,
      taxAmount: 0,
      paymentMethod: 'bank_transfer',
      paymentReference: '',
      paymentDate: '',
      notes: '',
      productId: '',
    },
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'description',
    targetField: 'descriptionAr',
    sourceLang: 'en',
    targetLang: 'ar',
    enabled: showArabicFields,
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'descriptionAr',
    targetField: 'description',
    sourceLang: 'ar',
    targetLang: 'en',
    enabled: showArabicFields,
  })

  const payeeType = watch('payeeType')

  const { data: projects } = useQuery({
    queryKey: ['projects-lookup'],
    queryFn: () => api.get('/projects', { params: { limit: 200 } }).then((res) => res.data.projects),
    enabled: showProjects,
    retry: false,
  })

  useEffect(() => {
    if (payeeType === 'supplier') {
      setValue('employeeId', '')
      setValue('customerId', '')
      setValue('payeeName', '')
    } else if (payeeType === 'employee') {
      setValue('supplierId', '')
      setValue('customerId', '')
      setValue('payeeName', '')
    } else if (payeeType === 'customer') {
      setValue('supplierId', '')
      setValue('employeeId', '')
      setValue('payeeName', '')
    } else {
      setValue('supplierId', '')
      setValue('employeeId', '')
      setValue('customerId', '')
    }
  }, [payeeType, setValue])

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.get(`/expenses/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      const initialPayeeType = data?.supplierId
        ? 'supplier'
        : data?.employeeId
          ? 'employee'
          : data?.customerId
            ? 'customer'
            : 'other'

      reset({
        expenseNumber: data?.expenseNumber || '',
        expenseDate: formatDateForInput(data?.expenseDate),
        category: data?.category || 'other',
        categoryAr: data?.categoryAr || '',
        description: data?.description || '',
        descriptionAr: data?.descriptionAr || '',
        projectId: data?.projectId?._id || data?.projectId || projectIdFromQuery,
        payeeType: initialPayeeType,
        supplierId: data?.supplierId?._id || data?.supplierId || '',
        employeeId: data?.employeeId?._id || data?.employeeId || '',
        customerId: data?.customerId?._id || data?.customerId || '',
        payeeName: data?.payeeName || '',
        currency: data?.currency || tenant?.settings?.currency || 'SAR',
        amount: data?.amount ?? 0,
        taxAmount: data?.taxAmount ?? 0,
        paymentMethod: data?.paymentMethod || 'bank_transfer',
        paymentReference: data?.paymentReference || '',
        paymentDate: formatDateForInput(data?.paymentDate),
        notes: data?.notes || '',
        productId: data?.productId?._id || data?.productId || '',
      })
      setSelectedSupplier(data?.supplierId && typeof data.supplierId === 'object' ? data.supplierId : null)
      setSelectedCustomer(data?.customerId && typeof data.customerId === 'object' ? data.customerId : null)
    },
  })

  const currentStatus = expense?.status || (isEdit ? 'draft' : 'draft')
  const statusLabel = statusMeta[currentStatus] || statusMeta.draft

  const isLocked = isEdit && ['paid', 'cancelled'].includes(currentStatus)

  const { data: expenseProducts } = useQuery({
    queryKey: ['expense-products'],
    queryFn: () => api.get('/products', { params: { limit: 200, canBeExpensed: true } }).then((res) => {
      const rows = res.data?.products || res.data?.items || res.data || []
      return Array.isArray(rows) ? rows.filter((p) => p.canBeExpensed === true) : []
    }),
    staleTime: 60_000,
    retry: false,
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-lookup'],
    queryFn: () => api.get('/employees', { params: { limit: 200 } }).then((res) => res.data.employees),
    enabled: payeeType === 'employee',
    retry: false,
  })

  const saveMutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/expenses/${id}`, payload) : api.post('/expenses', payload)),
    onSuccess: (res) => {
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…ØµØ±ÙˆÙ'
            : 'Expense updated'
          : language === 'ar'
            ? 'ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù…ØµØ±ÙˆÙ'
            : 'Expense created'
      )
      queryClient.invalidateQueries(['expenses'])
      queryClient.invalidateQueries(['expense-stats'])
      queryClient.invalidateQueries(['dashboard-expenses'])
      queryClient.invalidateQueries(['finance-expenses'])
      queryClient.invalidateQueries(['expense', id])

      if (!isEdit) {
        const newId = res?.data?._id
        if (newId) navigate(`/app/dashboard/expenses/${newId}`)
        else navigate('/app/dashboard/expenses')
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const submitMutation = useMutation({
    mutationFn: () => api.put(`/expenses/${id}/submit`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…ØµØ±ÙˆÙ Ù„Ù„Ù…ÙˆØ§ÙÙ‚Ø©' : 'Submitted for approval')
      queryClient.invalidateQueries(['expense', id])
      queryClient.invalidateQueries(['expenses'])
      queryClient.invalidateQueries(['expense-stats'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.put(`/expenses/${id}/approve`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'ØªÙ… Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ù…ØµØ±ÙˆÙ' : 'Expense approved')
      queryClient.invalidateQueries(['expense', id])
      queryClient.invalidateQueries(['expenses'])
      queryClient.invalidateQueries(['expense-stats'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const payMutation = useMutation({
    mutationFn: (payload) => api.put(`/expenses/${id}/pay`, payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯ÙØ¹' : 'Marked as paid')
      queryClient.invalidateQueries(['expense', id])
      queryClient.invalidateQueries(['expenses'])
      queryClient.invalidateQueries(['expense-stats'])
      queryClient.invalidateQueries(['dashboard-expenses'])
      queryClient.invalidateQueries(['finance-expenses'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/expenses/${id}/cancel`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ù…ØµØ±ÙˆÙ' : 'Expense cancelled')
      queryClient.invalidateQueries(['expense', id])
      queryClient.invalidateQueries(['expenses'])
      queryClient.invalidateQueries(['expense-stats'])
      queryClient.invalidateQueries(['dashboard-expenses'])
      queryClient.invalidateQueries(['finance-expenses'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const amount = Number(watch('amount') || 0)
  const taxAmount = Number(watch('taxAmount') || 0)

  const totals = useMemo(() => {
    const total = amount + taxAmount
    return {
      amount,
      taxAmount,
      total,
    }
  }, [amount, taxAmount])

  const canSubmit = isEdit && currentStatus === 'draft'
  const canApprove = isEdit && ['draft', 'pending_approval'].includes(currentStatus)
  const canPay = isEdit && currentStatus === 'approved'
  const canCancel = isEdit && !['paid', 'cancelled'].includes(currentStatus)

  const onSubmit = (data) => {
    const payload = {
      expenseNumber: data.expenseNumber,
      expenseDate: data.expenseDate,
      category: data.category,
      categoryAr: data.categoryAr,
      description: data.description,
      descriptionAr: data.descriptionAr,
      projectId: showProjects && String(data.projectId || '').trim() ? String(data.projectId).trim() : '',
      currency: data.currency,
      amount: Number(data.amount || 0),
      taxAmount: Number(data.taxAmount || 0),
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      paymentDate: data.paymentDate || undefined,
      notes: data.notes,
      productId: data.productId || null,
      supplierId: data.payeeType === 'supplier' ? data.supplierId : undefined,
      employeeId: data.payeeType === 'employee' ? data.employeeId : undefined,
      customerId: data.payeeType === 'customer' ? data.customerId : undefined,
      payeeName: data.payeeType === 'other' ? data.payeeName : undefined,
    }

    saveMutation.mutate(payload)
  }

  const triggerPay = () => {
    const values = getValues()
    payMutation.mutate({
      paymentMethod: values.paymentMethod,
      paymentReference: values.paymentReference,
      paymentDate: values.paymentDate || undefined,
    })
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
      </div>
    )
  }

  const sectionHead = (kicker, title) => (
    <div className="mb-5 border-b border-slate-100 pb-4 dark:border-white/[0.08]">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">{kicker}</p>
      <p className="mt-1 text-[13px] text-slate-500">{title}</p>
    </div>
  )

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/expenses')}
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              {language === 'ar' ? 'Ø§Ù„Ù…ØµØ±ÙˆÙØ§Øª' : 'Expenses'}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[28px]">
              {isEdit ? (language === 'ar' ? 'ØªØ¹Ø¯ÙŠÙ„ Ù…ØµØ±ÙˆÙ' : 'Edit expense') : language === 'ar' ? 'Ù…ØµØ±ÙˆÙ Ø¬Ø¯ÙŠØ¯' : 'New expense'}
            </h1>
            {isEdit && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {expense?.expenseNumber && <span className="font-mono text-[12px] text-slate-500">{expense.expenseNumber}</span>}
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                  currentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' :
                  currentStatus === 'cancelled' ? 'bg-rose-50 text-rose-700 ring-rose-200/70' :
                  currentStatus === 'approved' ? 'bg-teal-50 text-teal-800 ring-teal-200/80' :
                  'bg-slate-50 text-slate-500 ring-slate-200/70'
                }`}>
                  {language === 'ar' ? statusLabel.ar : statusLabel.en}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <button type="button" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} className={ghostBtn}>
              <XCircle className="h-4 w-4" />
              {language === 'ar' ? 'Ø¥Ù„ØºØ§Ø¡' : 'Cancel'}
            </button>
          )}
          {canSubmit && (
            <button type="button" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className={ghostBtn}>
              <Receipt className="h-4 w-4" />
              {language === 'ar' ? 'Ø¥Ø±Ø³Ø§Ù„' : 'Submit'}
            </button>
          )}
          {canApprove && (
            <button type="button" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className={ghostBtn}>
              <CheckCircle2 className="h-4 w-4" />
              {language === 'ar' ? 'Ø§Ø¹ØªÙ…Ø§Ø¯' : 'Approve'}
            </button>
          )}
          {canPay && (
            <button type="button" onClick={triggerPay} disabled={payMutation.isPending} className={ghostBtn}>
              <DollarSign className="h-4 w-4" />
              {language === 'ar' ? 'ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯ÙØ¹' : 'Mark paid'}
            </button>
          )}
          {!isLocked && (
            <button type="button" onClick={handleSubmit(onSubmit)} disabled={saveMutation.isPending} className={primaryBtn}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-5 sm:p-6`}>
          {sectionHead(language === 'ar' ? 'Ø§Ù„ØªÙØ§ØµÙŠÙ„' : 'Details', language === 'ar' ? 'Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ§Ù„ÙØ¦Ø© ÙˆØ§Ù„ÙˆØµÙ' : 'Date, category, and description')}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">{language === 'ar' ? 'ØªØ§Ø±ÙŠØ® Ø§Ù„Ù…ØµØ±ÙˆÙ' : 'Expense date'} *</label>
              <input type="date" {...register('expenseDate', { required: true })} className={fieldControlClass} disabled={isLocked} />
              {errors.expenseDate && <p className="mt-1 text-sm text-red-500">{language === 'ar' ? 'Ù…Ø·Ù„ÙˆØ¨' : 'Required'}</p>}
            </div>
            {showProjects && (
              <div>
                <label className="label">
                  <span className="inline-flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-slate-400" />
                    {language === 'ar' ? 'Ø§Ù„Ù…Ø´Ø±ÙˆØ¹' : 'Project'}
                  </span>
                </label>
                <select {...register('projectId')} className={`select ${fieldControlClass}`} disabled={isLocked}>
                  <option value="">{language === 'ar' ? 'Ø¨Ø¯ÙˆÙ† Ù…Ø´Ø±ÙˆØ¹' : 'No project'}</option>
                  {(projects || []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {(language === 'ar' ? p.nameAr || p.nameEn : p.nameEn) || p.code}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={showArabicFields ? '' : 'md:col-span-2'}>
              <label className="label">{language === 'ar' ? 'الفئة' : 'Category'}</label>
              <select {...register('category')} className={`select ${fieldControlClass}`} disabled={isLocked}>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{language === 'ar' ? c.ar : c.en}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">
                {language === 'ar' ? 'منتج مصروف (اختياري)' : 'Expense product (optional)'}
              </label>
              <select {...register('productId')} className={`select ${fieldControlClass}`} disabled={isLocked}>
                <option value="">{language === 'ar' ? '— بدون منتج —' : '— No product —'}</option>
                {(expenseProducts || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {(language === 'ar' ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)) || p.sku || p.productId}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {language === 'ar'
                  ? 'يحدد حساب المصروف من المنتج أو فئته عند الدفع'
                  : 'Uses the product/category expense account when paid'}
              </p>
            </div>
            {showArabicFields ? (
              <div>
                <label className="label">{language === 'ar' ? 'الفئة (عربي)' : 'Category (AR)'}</label>
                <input {...register('categoryAr')} className={fieldControlClass} dir="rtl" disabled={isLocked} />
              </div>
            ) : (
              <input type="hidden" {...register('categoryAr')} />
            )}
            <div className={showArabicFields ? 'md:col-span-2' : 'md:col-span-3'}>
              <label className="label">{language === 'ar' ? 'الوصف' : 'Description'}</label>
              <input {...register('description')} className={fieldControlClass} disabled={isLocked} />
            </div>
            {showArabicFields ? (
              <div>
                <label className="label">{language === 'ar' ? 'الوصف (عربي)' : 'Description (AR)'}</label>
                <input {...register('descriptionAr')} className={fieldControlClass} dir="rtl" disabled={isLocked} />
              </div>
            ) : (
              <input type="hidden" {...register('descriptionAr')} />
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-5 sm:p-6`}>
          {sectionHead(language === 'ar' ? 'Ø§Ù„Ø¬Ù‡Ø©' : 'Payee', language === 'ar' ? 'Ø§Ù„Ù…ÙˆØ±Ø¯ Ø£Ùˆ Ø§Ù„Ù…ÙˆØ¸Ù  Ø£Ùˆ Ø§Ù„Ø¹Ù…ÙŠÙ„' : 'Supplier, employee, or customer')}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">{language === 'ar' ? 'Ù†ÙˆØ¹ Ø§Ù„Ø¬Ù‡Ø©' : 'Payee type'}</label>
              <select {...register('payeeType')} className={`select ${fieldControlClass}`} disabled={isLocked}>
                <option value="supplier">{language === 'ar' ? 'Ù…ÙˆØ±Ø¯' : 'Supplier'}</option>
                <option value="employee">{language === 'ar' ? 'Ù…ÙˆØ¸Ù' : 'Employee'}</option>
                <option value="customer">{language === 'ar' ? 'Ø¹Ù…ÙŠÙ„' : 'Customer'}</option>
                <option value="other">{language === 'ar' ? 'Ø£Ø®Ø±Ù‰' : 'Other'}</option>
              </select>
            </div>
            {payeeType === 'supplier' && (
              <div className="md:col-span-2">
                <label className="label">{language === 'ar' ? 'المورد' : 'Supplier'}</label>
                <PartnerCombobox
                  role="vendor"
                  value={watch('supplierId') || ''}
                  selectedOption={selectedSupplier}
                  ar={language === 'ar'}
                  language={language}
                  disabled={isLocked}
                  onChange={(id, opt) => {
                    setValue('supplierId', id || '', { shouldDirty: true })
                    setSelectedSupplier(opt || null)
                  }}
                />
                <input type="hidden" {...register('supplierId')} />
              </div>
            )}
            {payeeType === 'employee' && (
              <div className="md:col-span-2">
                <label className="label">{language === 'ar' ? 'الموظف' : 'Employee'}</label>
                <select {...register('employeeId')} className={`select ${fieldControlClass}`} disabled={isLocked}>
                  <option value="">{language === 'ar' ? 'اختر موظف' : 'Select employee'}</option>
                  {(employees || []).map((e) => {
                    const en = `${e.firstNameEn || ''} ${e.lastNameEn || ''}`.trim()
                    const ar = `${e.firstNameAr || ''} ${e.lastNameAr || ''}`.trim()
                    return (
                      <option key={e._id} value={e._id}>
                        {(language === 'ar' ? ar || en : en || ar) + (e.employeeId ? ` (${e.employeeId})` : '')}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}
            {payeeType === 'customer' && (
              <div className="md:col-span-2">
                <label className="label">{language === 'ar' ? 'العميل' : 'Customer'}</label>
                <PartnerCombobox
                  role="customer"
                  value={watch('customerId') || ''}
                  selectedOption={selectedCustomer}
                  ar={language === 'ar'}
                  language={language}
                  disabled={isLocked}
                  onChange={(id, opt) => {
                    setValue('customerId', id || '', { shouldDirty: true })
                    setSelectedCustomer(opt || null)
                  }}
                />
                <input type="hidden" {...register('customerId')} />
              </div>
            )}
            {payeeType === 'other' && (
              <div className="md:col-span-2">
                <label className="label">{language === 'ar' ? 'Ø§Ø³Ù… Ø§Ù„Ø¬Ù‡Ø©' : 'Payee name'}</label>
                <input {...register('payeeName')} className={fieldControlClass} disabled={isLocked} />
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${shell} p-5 sm:p-6`}>
          {sectionHead(language === 'ar' ? 'Ø§Ù„Ù…Ø¨Ù„Øº ÙˆØ§Ù„Ø¯ÙØ¹' : 'Amount & payment', language === 'ar' ? 'Ø§Ù„Ù‚ÙŠÙ…Ø© ÙˆØ§Ù„Ø¶Ø±ÙŠØ¨Ø© ÙˆØ·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø³Ø¯Ø§Ø¯' : 'Value, tax, and settlement')}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">{language === 'ar' ? 'Ø§Ù„Ø¹Ù…Ù„Ø©' : 'Currency'}</label>
              <input {...register('currency')} className={fieldControlClass} disabled />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'Ø§Ù„Ù…Ø¨Ù„Øº' : 'Amount'} *</label>
              <input type="number" step="0.01" {...register('amount', { required: true, min: 0 })} className={fieldControlClass} disabled={isLocked} />
              {errors.amount && <p className="mt-1 text-sm text-red-500">{language === 'ar' ? 'Ù…Ø·Ù„ÙˆØ¨' : 'Required'}</p>}
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'Ø§Ù„Ø¶Ø±ÙŠØ¨Ø©' : 'Tax'}</label>
              <input type="number" step="0.01" {...register('taxAmount', { min: 0 })} className={fieldControlClass} disabled={isLocked} />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                <span className="text-[13px] text-slate-500">{language === 'ar' ? 'Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ' : 'Total'}</span>
                <span className="text-[18px] font-semibold tabular-nums text-slate-950 dark:text-white">
                  <Money value={totals.total} />
                </span>
              </div>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹' : 'Payment method'}</label>
              <select {...register('paymentMethod')} className={`select ${fieldControlClass}`} disabled={isLocked}>
                <option value="bank_transfer">{language === 'ar' ? 'ØªØ­ÙˆÙŠÙ„ Ø¨Ù†ÙƒÙŠ' : 'Bank transfer'}</option>
                <option value="cash">{language === 'ar' ? 'Ù†Ù‚Ø¯Ø§Ù‹' : 'Cash'}</option>
                <option value="cheque">{language === 'ar' ? 'Ø´ÙŠÙƒ' : 'Cheque'}</option>
                <option value="card">{language === 'ar' ? 'Ø¨Ø·Ø§Ù‚Ø©' : 'Card'}</option>
                <option value="other">{language === 'ar' ? 'Ø£Ø®Ø±Ù‰' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'Ù…Ø±Ø¬Ø¹ Ø§Ù„Ø¯ÙØ¹' : 'Payment reference'}</label>
              <input {...register('paymentReference')} className={fieldControlClass} disabled={isLocked} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¯ÙØ¹' : 'Payment date'}</label>
              <input type="date" {...register('paymentDate')} className={fieldControlClass} disabled={isLocked} />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'Ù…Ù„Ø§Ø­Ø¸Ø§Øª' : 'Notes'}</label>
              <textarea {...register('notes')} className={fieldControlClass} rows={3} disabled={isLocked} />
            </div>
          </div>
        </motion.div>
      </form>
    </div>
  )
}

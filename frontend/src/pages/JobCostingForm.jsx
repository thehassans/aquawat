import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Briefcase,
  FolderKanban,
  Calendar,
  Coins,
  Plus,
  Trash2,
  Edit3,
  XCircle,
  HelpCircle,
  Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import { useLiveTranslation } from '../lib/liveTranslation'
import { showArabicFields as isArabicTenantMarket } from '../lib/saudiTenant'

export default function JobCostingForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const showArabicFields = isArabicTenantMarket(tenant)

  const [costsPage, setCostsPage] = useState(1)
  const [costsType, setCostsType] = useState('')
  const [editingCostId, setEditingCostId] = useState(null)

  const formatDateForInput = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      code: '',
      jobType: 'project',
      nameEn: '',
      nameAr: '',
      description: '',
      status: 'planned',
      projectId: '',
      startDate: '',
      dueDate: '',
      budget: 0,
      currency: tenant?.settings?.currency || 'SAR',
      notes: '',
    },
  })

  const importExpensesMutation = useMutation({
    mutationFn: () => api.post(`/job-costing/jobs/${id}/import-expenses`).then((res) => res.data),
    onSuccess: (res) => {
      const created = res?.created || 0
      const skipped = res?.skipped || 0
      toast.success(
        language === 'ar'
          ? `تم الاستيراد: ${created} / تم التخطي: ${skipped}`
          : `Imported: ${created} / Skipped: ${skipped}`
      )
      queryClient.invalidateQueries(['job-costing-costs', id])
      queryClient.invalidateQueries(['job-costing-job', id])
      queryClient.invalidateQueries(['job-costing-stats'])
      queryClient.invalidateQueries(['job-costing'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameEn',
    targetField: 'nameAr',
    sourceLang: 'en',
    targetLang: 'ar',
    enabled: showArabicFields,
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameAr',
    targetField: 'nameEn',
    sourceLang: 'ar',
    targetLang: 'en',
    enabled: showArabicFields,
  })

  const {
    register: registerCost,
    handleSubmit: handleSubmitCost,
    reset: resetCost,
    watch: watchCost,
  } = useForm({
    defaultValues: {
      date: '',
      type: 'material',
      description: '',
      quantity: 1,
      unitCost: 0,
      reference: '',
      notes: '',
    },
  })

  const budgetValue = watch('budget')
  const costQuantity = watchCost('quantity')
  const costUnitCost = watchCost('unitCost')

  const costPreview = useMemo(() => {
    const q = Number(costQuantity)
    const u = Number(costUnitCost)
    const safeQ = Number.isFinite(q) ? q : 0
    const safeU = Number.isFinite(u) ? u : 0
    return Math.max(0, safeQ) * Math.max(0, safeU)
  }, [costQuantity, costUnitCost])

  const { data: projects } = useQuery({
    queryKey: ['projects-lookup'],
    queryFn: () => api.get('/projects', { params: { limit: 200 } }).then((res) => res.data.projects),
  })

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-costing-job', id],
    queryFn: () => api.get(`/job-costing/jobs/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      reset({
        code: data?.code || '',
        jobType: data?.jobType || 'project',
        nameEn: data?.nameEn || '',
        nameAr: data?.nameAr || '',
        description: data?.description || '',
        status: data?.status || 'planned',
        projectId: data?.projectId?._id || data?.projectId || '',
        startDate: formatDateForInput(data?.startDate),
        dueDate: formatDateForInput(data?.dueDate),
        budget: data?.budget ?? 0,
        currency: data?.currency || tenant?.settings?.currency || 'SAR',
        notes: data?.notes || '',
      })
    },
  })

  const jobTypeValue = watch('jobType')

  const { data: costsData, isLoading: costsLoading } = useQuery({
    queryKey: ['job-costing-costs', id, costsPage, costsType],
    queryFn: () =>
      api
        .get(`/job-costing/jobs/${id}/costs`, { params: { page: costsPage, limit: 25, type: costsType || undefined } })
        .then((res) => res.data),
    enabled: isEdit,
  })

  const costs = costsData?.costs || []
  const costsPagination = costsData?.pagination

  const totalCost = job?.costSummary?.totals?.totalCost || 0
  const costEntries = job?.costSummary?.totals?.entries || 0

  const variance = useMemo(() => {
    const b = Number(budgetValue)
    const safeBudget = Number.isFinite(b) ? b : 0
    return safeBudget - (Number(totalCost) || 0)
  }, [budgetValue, totalCost])

  const saveMutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/job-costing/jobs/${id}`, payload) : api.post('/job-costing/jobs', payload)),
    onSuccess: (res) => {
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث العمل'
            : 'Job updated'
          : language === 'ar'
            ? 'تم إنشاء العمل'
            : 'Job created'
      )

      queryClient.invalidateQueries(['job-costing'])
      queryClient.invalidateQueries(['job-costing-stats'])

      if (isEdit) {
        queryClient.invalidateQueries(['job-costing-job', id])
      } else {
        navigate(`/job-costing/${res.data?._id}`)
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/job-costing/jobs/${id}`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تعطيل العمل' : 'Job deactivated')
      queryClient.invalidateQueries(['job-costing'])
      queryClient.invalidateQueries(['job-costing-stats'])
      navigate('/job-costing')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const createCostMutation = useMutation({
    mutationFn: (payload) => api.post(`/job-costing/jobs/${id}/costs`, payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تمت إضافة التكلفة' : 'Cost added')
      setEditingCostId(null)
      resetCost({ date: '', type: 'material', description: '', quantity: 1, unitCost: 0, reference: '', notes: '' })
      queryClient.invalidateQueries(['job-costing-costs', id])
      queryClient.invalidateQueries(['job-costing-job', id])
      queryClient.invalidateQueries(['job-costing-stats'])
      queryClient.invalidateQueries(['job-costing'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const updateCostMutation = useMutation({
    mutationFn: ({ costId, payload }) => api.put(`/job-costing/costs/${costId}`, payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث التكلفة' : 'Cost updated')
      setEditingCostId(null)
      resetCost({ date: '', type: 'material', description: '', quantity: 1, unitCost: 0, reference: '', notes: '' })
      queryClient.invalidateQueries(['job-costing-costs', id])
      queryClient.invalidateQueries(['job-costing-job', id])
      queryClient.invalidateQueries(['job-costing-stats'])
      queryClient.invalidateQueries(['job-costing'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const deleteCostMutation = useMutation({
    mutationFn: (costId) => api.delete(`/job-costing/costs/${costId}`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حذف بند التكلفة' : 'Cost entry removed')
      queryClient.invalidateQueries(['job-costing-costs', id])
      queryClient.invalidateQueries(['job-costing-job', id])
      queryClient.invalidateQueries(['job-costing-stats'])
      queryClient.invalidateQueries(['job-costing'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const onSubmit = (data) => {
    const payload = {
      code: data.code || undefined,
      jobType: data.jobType || 'project',
      nameEn: data.nameEn,
      nameAr: data.nameAr || undefined,
      description: data.description || undefined,
      status: data.status,
      projectId: data.jobType === 'project' ? (data.projectId || undefined) : undefined,
      startDate: data.startDate || undefined,
      dueDate: data.dueDate || undefined,
      budget: Number(data.budget || 0),
      currency: data.currency || tenant?.settings?.currency || 'SAR',
      notes: data.notes || undefined,
    }

    saveMutation.mutate(payload)
  }

  const onSubmitCost = (data) => {
    const payload = {
      date: data.date || undefined,
      type: data.type,
      description: data.description || undefined,
      quantity: Number(data.quantity || 0),
      unitCost: Number(data.unitCost || 0),
      reference: data.reference || undefined,
      notes: data.notes || undefined,
    }

    if (editingCostId) {
      updateCostMutation.mutate({ costId: editingCostId, payload })
    } else {
      createCostMutation.mutate(payload)
    }
  }

  const statusBadge = (value) => {
    if (value === 'completed') return 'badge-success'
    if (value === 'active') return 'badge-info'
    if (value === 'on_hold') return 'badge-warning'
    if (value === 'cancelled') return 'badge-danger'
    return 'badge-neutral'
  }

  const statusLabel = (value) => {
    if (language === 'ar') {
      if (value === 'planned') return 'مخطط'
      if (value === 'active') return 'نشط'
      if (value === 'on_hold') return 'متوقف'
      if (value === 'completed') return 'مكتمل'
      if (value === 'cancelled') return 'ملغي'
      return value
    }
    return value
  }

  const costTypeLabel = (value) => {
    if (language === 'ar') {
      if (value === 'material') return 'مواد'
      if (value === 'labor') return 'عمالة'
      if (value === 'overhead') return 'مصروفات عامة'
      if (value === 'subcontract') return 'مقاول فرعي'
      if (value === 'other') return 'أخرى'
      return value
    }
    return value
  }

  const startEditCost = (cost) => {
    setEditingCostId(cost._id)
    resetCost({
      date: formatDateForInput(cost?.date),
      type: cost?.type || 'material',
      description: cost?.description || '',
      quantity: cost?.quantity ?? 0,
      unitCost: cost?.unitCost ?? 0,
      reference: cost?.reference || '',
      notes: cost?.notes || '',
    })
  }

  const cancelEditCost = () => {
    setEditingCostId(null)
    resetCost({ date: '', type: 'material', description: '', quantity: 1, unitCost: 0, reference: '', notes: '' })
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? (language === 'ar' ? 'تعديل عمل' : 'Edit Job') : language === 'ar' ? 'إضافة عمل' : 'Add Job'}
            </h1>
            {isEdit && (
              <p className="text-sm text-gray-500 mt-1">
                {language === 'ar' ? 'الحالة:' : 'Status:'}{' '}
                <span className={`badge ${statusBadge(job?.status)}`}>{statusLabel(job?.status)}</span>
              </p>
            )}
          </div>
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(language === 'ar' ? 'تعطيل هذا العمل؟' : 'Deactivate this job?')) {
                deactivateMutation.mutate()
              }
            }}
            disabled={deactivateMutation.isPending}
            className="btn btn-danger"
          >
            {deactivateMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {language === 'ar' ? 'تعطيل' : 'Deactivate'}
              </>
            )}
          </button>
        )}
      </div>

      {isEdit && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <Briefcase className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'الميزانية' : 'Budget'}</p>
              <p className="text-xl font-bold">
                <Money value={Number(budgetValue || 0)} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <Coins className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'التكلفة' : 'Cost'}</p>
              <p className="text-xl font-bold text-emerald-600">
                <Money value={totalCost} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
              <p className="text-xs text-gray-500">{costEntries} {language === 'ar' ? 'بنود' : 'entries'}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Coins className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'الفرق' : 'Variance'}</p>
              <p className={`text-xl font-bold ${variance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                <Money value={variance} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
            </div>
          </div>

          <div className="card p-4">
            <p className="text-sm text-gray-500">{language === 'ar' ? 'الكود' : 'Code'}</p>
            <p className="text-xl font-bold font-mono">{job?.code}</p>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 dark:bg-dark-700 rounded-xl">
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'ما فائدة تكلفة الأعمال؟' : 'What is Job Costing for?'}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {language === 'ar'
                  ? 'استخدم هذه الشاشة لتجميع كل تكاليف العمل (مواد/عمالة/مصروفات) ثم قارنها مع الميزانية. يمكن أيضاً استيراد مصروفات المشروع المرتبطة كتكاليف.'
                  : 'Use this screen to collect all job costs (materials/labor/overhead) and compare to budget. You can also import linked project expenses as job costs.'}
              </div>
            </div>
          </div>

          {isEdit && (job?.jobType || 'project') === 'project' && job?.projectId && (
            <button
              type="button"
              onClick={() => importExpensesMutation.mutate()}
              disabled={importExpensesMutation.isPending}
              className="btn btn-secondary"
              title={language === 'ar' ? 'استيراد مصروفات المشروع' : 'Import project expenses'}
            >
              {importExpensesMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {language === 'ar' ? 'استيراد مصروفات المشروع' : 'Import Project Expenses'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Briefcase className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات العمل' : 'Job Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الكود' : 'Code'}</label>
              <input
                {...register('code')}
                className="input"
                placeholder={language === 'ar' ? 'تلقائي إذا تركته فارغاً' : 'Auto if left empty'}
                disabled={isEdit}
              />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'نوع العمل' : 'Job Type'}</label>
              <select {...register('jobType')} className="select" disabled={isEdit && (job?.jobType === 'manufacturing')}>
                <option value="project">{language === 'ar' ? 'مشروع' : 'Project'}</option>
                <option value="manufacturing">{language === 'ar' ? 'تصنيع' : 'Manufacturing'}</option>
              </select>
            </div>

            <div>
              <label className="label">{t('status')}</label>
              <select {...register('status')} className="select">
                <option value="planned">{language === 'ar' ? 'مخطط' : 'Planned'}</option>
                <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
                <option value="on_hold">{language === 'ar' ? 'متوقف' : 'On Hold'}</option>
                <option value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</option>
                <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'المشروع' : 'Project'}</label>
              <select {...register('projectId')} className="select" disabled={jobTypeValue !== 'project'}>
                <option value="">{language === 'ar' ? (jobTypeValue === 'project' ? 'اختياري' : 'غير متاح للتصنيع') : (jobTypeValue === 'project' ? 'Optional' : 'Not for manufacturing')}</option>
                {(projects || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {(language === 'ar' ? p.nameAr || p.nameEn : p.nameEn) || p.code}
                  </option>
                ))}
              </select>
            </div>

            <div className={showArabicFields ? 'md:col-span-2' : 'md:col-span-2 lg:col-span-3'}>
              <label className="label">{showArabicFields ? (language === 'ar' ? 'الاسم (EN)' : 'Name (EN)') : (language === 'ar' ? 'الاسم' : 'Name')} *</label>
              <input {...register('nameEn', { required: true })} className="input" />
              {errors.nameEn && <p className="text-xs text-red-600 mt-1">{language === 'ar' ? 'الاسم مطلوب' : 'Name is required'}</p>}
            </div>

            {showArabicFields ? (
              <div>
                <label className="label">{language === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</label>
                <input {...register('nameAr')} className="input" dir="rtl" />
              </div>
            ) : (
              <input type="hidden" {...register('nameAr')} />
            )}

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'الوصف' : 'Description'}</label>
              <textarea {...register('description')} className="input" rows={3} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'الجدول والميزانية' : 'Schedule & Budget'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ البداية' : 'Start Date'}</label>
              <input type="date" {...register('startDate')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'Due Date'}</label>
              <input type="date" {...register('dueDate')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'الميزانية' : 'Budget'}</label>
              <input type="number" min="0" step="0.01" {...register('budget', { valueAsNumber: true })} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'العملة' : 'Currency'}</label>
              <input {...register('currency')} className="input" disabled />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
              <textarea {...register('notes')} className="input" rows={3} />
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            {t('cancel')}
          </button>
          <button type="submit" disabled={saveMutation.isPending} className="btn btn-primary">
            {saveMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('save')}
              </>
            )}
          </button>
        </div>
      </form>

      {isEdit && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Coins className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'بنود التكلفة' : 'Cost Entries'}</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">
                    {editingCostId ? (language === 'ar' ? 'تعديل بند' : 'Edit entry') : language === 'ar' ? 'إضافة بند' : 'Add entry'}
                  </h4>

                  {editingCostId && (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={cancelEditCost}>
                      <XCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <form onSubmit={handleSubmitCost(onSubmitCost)} className="space-y-3">
                  <div>
                    <label className="label">{language === 'ar' ? 'التاريخ' : 'Date'}</label>
                    <input type="date" {...registerCost('date')} className="input" />
                  </div>

                  <div>
                    <label className="label">{language === 'ar' ? 'النوع' : 'Type'}</label>
                    <select {...registerCost('type')} className="select">
                      <option value="material">{language === 'ar' ? 'مواد' : 'Material'}</option>
                      <option value="labor">{language === 'ar' ? 'عمالة' : 'Labor'}</option>
                      <option value="overhead">{language === 'ar' ? 'مصروفات عامة' : 'Overhead'}</option>
                      <option value="subcontract">{language === 'ar' ? 'مقاول فرعي' : 'Subcontract'}</option>
                      <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                    <input {...registerCost('description')} className="input" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('quantity')}</label>
                      <input type="number" min="0" step="0.01" {...registerCost('quantity', { valueAsNumber: true })} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit cost'}</label>
                      <input type="number" min="0" step="0.01" {...registerCost('unitCost', { valueAsNumber: true })} className="input" />
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">
                    {language === 'ar' ? 'الإجمالي:' : 'Total:'}{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      <Money value={costPreview} minimumFractionDigits={2} maximumFractionDigits={2} />
                    </span>
                  </div>

                  <div>
                    <label className="label">{language === 'ar' ? 'مرجع' : 'Reference'}</label>
                    <input {...registerCost('reference')} className="input" />
                  </div>

                  <div>
                    <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                    <textarea {...registerCost('notes')} className="input" rows={3} />
                  </div>

                  <button
                    type="submit"
                    disabled={createCostMutation.isPending || updateCostMutation.isPending}
                    className="btn btn-primary w-full"
                  >
                    {createCostMutation.isPending || updateCostMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        {editingCostId ? (language === 'ar' ? 'تحديث' : 'Update') : language === 'ar' ? 'إضافة' : 'Add'}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">{language === 'ar' ? 'التصنيف' : 'Type'}</label>
                  <select
                    value={costsType}
                    onChange={(e) => {
                      setCostsType(e.target.value)
                      setCostsPage(1)
                    }}
                    className="select w-48"
                  >
                    <option value="">{language === 'ar' ? 'الكل' : 'All'}</option>
                    <option value="material">{language === 'ar' ? 'مواد' : 'Material'}</option>
                    <option value="labor">{language === 'ar' ? 'عمالة' : 'Labor'}</option>
                    <option value="overhead">{language === 'ar' ? 'مصروفات عامة' : 'Overhead'}</option>
                    <option value="subcontract">{language === 'ar' ? 'مقاول فرعي' : 'Subcontract'}</option>
                    <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                  </select>
                </div>

                <div className="text-sm text-gray-500">
                  {language === 'ar' ? 'إجمالي:' : 'Total:'}{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    <Money value={totalCost} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </span>
                </div>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                      <th>{language === 'ar' ? 'الوصف' : 'Description'}</th>
                      <th>{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th>{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center">
                          <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </td>
                      </tr>
                    ) : costs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-gray-500 py-10">
                          {t('noData')}
                        </td>
                      </tr>
                    ) : (
                      costs.map((c) => (
                        <tr key={c._id}>
                          <td>
                            {c.date ? (
                              <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {new Date(c.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                              <Briefcase className="w-4 h-4 text-gray-400" />
                              {costTypeLabel(c.type)}
                            </span>
                          </td>
                          <td>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{c.description || '-'}</p>
                              {c.reference && <p className="text-xs text-gray-500">{c.reference}</p>}
                            </div>
                          </td>
                          <td className="font-mono text-sm">{Number(c.quantity || 0).toLocaleString()}</td>
                          <td className="font-semibold">
                            <Money value={c.totalCost || 0} minimumFractionDigits={2} maximumFractionDigits={2} />
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                                onClick={() => startEditCost(c)}
                              >
                                <Edit3 className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                type="button"
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                onClick={() => {
                                  if (window.confirm(language === 'ar' ? 'حذف بند التكلفة؟' : 'Remove cost entry?')) {
                                    deleteCostMutation.mutate(c._id)
                                  }
                                }}
                                disabled={deleteCostMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {costsPagination?.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <button
                    className="btn btn-secondary"
                    disabled={costsPage <= 1}
                    onClick={() => setCostsPage((p) => Math.max(1, p - 1))}
                  >
                    {language === 'ar' ? 'السابق' : 'Previous'}
                  </button>
                  <div className="text-sm text-gray-500">
                    {language === 'ar' ? 'صفحة' : 'Page'} {costsPage} / {costsPagination.pages}
                  </div>
                  <button
                    className="btn btn-secondary"
                    disabled={costsPage >= costsPagination.pages}
                    onClick={() => setCostsPage((p) => Math.min(costsPagination.pages, p + 1))}
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

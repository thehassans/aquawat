import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, ClipboardList, FolderKanban, Calendar, User, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { showArabicFields as isArabicTenantMarket } from '../lib/saudiTenant'

export default function TaskForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const showArabicFields = isArabicTenantMarket(tenant)

  const formatDateForInput = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      taskNumber: '',
      projectId: '',
      status: 'todo',
      priority: 'medium',
      titleEn: '',
      titleAr: '',
      assigneeName: '',
      startDate: '',
      dueDate: '',
      tagsText: '',
      description: '',
    },
  })

  const status = watch('status')

  const { data: projects } = useQuery({
    queryKey: ['projects-lookup'],
    queryFn: () => api.get('/projects', { params: { limit: 200 } }).then((res) => res.data.projects),
  })

  const { isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get(`/tasks/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      reset({
        taskNumber: data?.taskNumber || '',
        projectId: data?.projectId?._id || data?.projectId || '',
        status: data?.status || 'todo',
        priority: data?.priority || 'medium',
        titleEn: data?.titleEn || '',
        titleAr: data?.titleAr || '',
        assigneeName: data?.assigneeName || '',
        startDate: formatDateForInput(data?.startDate),
        dueDate: formatDateForInput(data?.dueDate),
        tagsText: Array.isArray(data?.tags) ? data.tags.join(', ') : '',
        description: data?.description || '',
      })
    },
  })

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/tasks/${id}`, payload) : api.post('/tasks', payload)),
    onSuccess: () => {
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث المهمة'
            : 'Task updated'
          : language === 'ar'
            ? 'تم إضافة المهمة'
            : 'Task added'
      )
      queryClient.invalidateQueries(['tasks'])
      queryClient.invalidateQueries(['tasks-stats'])
      navigate('/tasks')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const onSubmit = (data) => {
    const tags = String(data.tagsText || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

    const payload = {
      taskNumber: data.taskNumber || undefined,
      projectId: data.projectId || undefined,
      status: data.status,
      priority: data.priority,
      titleEn: data.titleEn,
      titleAr: data.titleAr || undefined,
      assigneeName: data.assigneeName || undefined,
      startDate: data.startDate || undefined,
      dueDate: data.dueDate || undefined,
      tags,
      description: data.description || undefined,
    }

    mutation.mutate(payload)
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statusBadge = () => {
    if (status === 'done') return 'badge-success'
    if (status === 'in_progress') return 'badge-info'
    if (status === 'blocked') return 'badge-warning'
    if (status === 'cancelled') return 'badge-danger'
    return 'badge-neutral'
  }

  const statusLabel = () => {
    if (language === 'ar') {
      if (status === 'todo') return 'للعمل'
      if (status === 'in_progress') return 'قيد التنفيذ'
      if (status === 'blocked') return 'معطل'
      if (status === 'done') return 'مكتمل'
      if (status === 'cancelled') return 'ملغي'
      return status
    }
    return status
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? (language === 'ar' ? 'تعديل مهمة' : 'Edit Task') : language === 'ar' ? 'إضافة مهمة' : 'Add Task'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'ar' ? 'الحالة:' : 'Status:'} <span className={`badge ${statusBadge()}`}>{statusLabel()}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <ClipboardList className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات المهمة' : 'Task Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'رقم المهمة' : 'Task #'}</label>
              <input
                {...register('taskNumber')}
                className="input"
                placeholder={language === 'ar' ? 'تلقائي إذا تركته فارغاً' : 'Auto if left empty'}
                disabled={isEdit}
              />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'المشروع' : 'Project'}</label>
              <select {...register('projectId')} className="select">
                <option value="">{language === 'ar' ? 'بدون مشروع' : 'No project'}</option>
                {(projects || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {(language === 'ar' ? p.nameAr || p.nameEn : p.nameEn) || p.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t('status')}</label>
              <select {...register('status')} className="select">
                <option value="todo">{language === 'ar' ? 'للعمل' : 'To do'}</option>
                <option value="in_progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</option>
                <option value="blocked">{language === 'ar' ? 'معطل' : 'Blocked'}</option>
                <option value="done">{language === 'ar' ? 'مكتمل' : 'Done'}</option>
                <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'الأولوية' : 'Priority'}</label>
              <select {...register('priority')} className="select">
                <option value="urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</option>
                <option value="high">{language === 'ar' ? 'عالي' : 'High'}</option>
                <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                <option value="low">{language === 'ar' ? 'منخفض' : 'Low'}</option>
              </select>
            </div>

            <div className={showArabicFields ? 'md:col-span-2' : 'md:col-span-3'}>
              <label className="label">{showArabicFields ? (language === 'ar' ? 'العنوان (EN)' : 'Title (EN)') : (language === 'ar' ? 'العنوان' : 'Title')} *</label>
              <input {...register('titleEn', { required: true })} className="input" />
              {errors.titleEn && <p className="text-xs text-red-600 mt-1">{language === 'ar' ? 'العنوان مطلوب' : 'Title is required'}</p>}
            </div>

            {showArabicFields ? (
              <div>
                <label className="label">{language === 'ar' ? 'العنوان (AR)' : 'Title (AR)'}</label>
                <input {...register('titleAr')} className="input" dir="rtl" />
              </div>
            ) : (
              <input type="hidden" {...register('titleAr')} />
            )}

            <div>
              <label className="label">{language === 'ar' ? 'المكلّف' : 'Assignee'}</label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input {...register('assigneeName')} className="input ps-10" />
              </div>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ البداية' : 'Start Date'}</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" {...register('startDate')} className="input ps-10" />
              </div>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'Due Date'}</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" {...register('dueDate')} className="input ps-10" />
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'الوصف' : 'Description'}</label>
              <textarea {...register('description')} className="input" rows={3} />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">
                <span className="inline-flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-400" />
                  {language === 'ar' ? 'وسوم (مفصولة بفواصل)' : 'Tags (comma separated)'}
                </span>
              </label>
              <input {...register('tagsText')} className="input" placeholder={language === 'ar' ? 'مثال: عاجل, مراجعة' : 'e.g. urgent, review'} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FolderKanban className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'إجراءات' : 'Actions'}</h3>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
              {t('cancel')}
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
              {mutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t('save')}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </form>
    </div>
  )
}

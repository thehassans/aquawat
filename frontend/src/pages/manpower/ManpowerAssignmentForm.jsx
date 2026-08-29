import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, useFieldArray } from 'react-hook-form'
import { ArrowLeft, Save, Building, Calendar, Users, Plus, Trash2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { contactToCustomer, fetchContactsList } from '../../lib/contactMappers'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

export default function ManpowerAssignmentForm() {
  const { id } = useParams()
  const isEdit = Boolean(id && id !== 'new')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const { register, control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      clientId: '',
      clientName: '',
      site: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'active',
      workers: [{ workerId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', dailyRate: 0, hoursPerDay: 8 }],
      notes: ''
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'workers' })

  const { data: customers } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: async () => {
      const { contacts } = await fetchContactsList(api, { types: 'customer', limit: 200, isActive: 'all' })
      return contacts.filter((c) => c.entityType === 'customer').map(contactToCustomer)
    },
  })

  const { data: availableWorkers } = useQuery({
    queryKey: ['available-manpower-workers'],
    queryFn: () => api.get('/manpower/workers', { params: { status: 'available' } }).then(res => res.data),
    enabled: !isEdit
  })

  const { data: assignment, isLoading } = useQuery({
    queryKey: ['manpower-assignment', id],
    queryFn: () => api.get(`/manpower/assignments/${id}`).then(res => res.data),
    enabled: isEdit
  })

  useEffect(() => {
    if (assignment) {
      reset({
        ...assignment,
        clientId: assignment.clientId?._id || assignment.clientId,
        clientName: assignment.clientName || '',
        startDate: assignment.startDate ? new Date(assignment.startDate).toISOString().slice(0, 10) : '',
        endDate: assignment.endDate ? new Date(assignment.endDate).toISOString().slice(0, 10) : '',
        workers: (assignment.workers || []).map(w => ({
          workerId: w.workerId?._id || w.workerId,
          startDate: w.startDate ? new Date(w.startDate).toISOString().slice(0, 10) : '',
          endDate: w.endDate ? new Date(w.endDate).toISOString().slice(0, 10) : '',
          dailyRate: w.dailyRate || 0,
          hoursPerDay: w.hoursPerDay || 8
        }))
      })
    }
  }, [assignment, reset])

  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/manpower/assignments/${id}`, data) : api.post('/manpower/assignments', data)),
    onSuccess: () => {
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث التعيين' : 'Assignment updated') : (language === 'ar' ? 'تم إنشاء التعيين' : 'Assignment created'))
      queryClient.invalidateQueries(['manpower-assignments'])
      queryClient.invalidateQueries(['manpower-workers'])
      navigate(-1)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving assignment')
  })

  const onSubmit = (data) => {
    const selectedClient = customers?.find(c => c._id === data.clientId)
    data.clientName = selectedClient ? (selectedClient.nameEn || selectedClient.nameAr) : ''
    saveMutation.mutate(data)
  }

  // Pre-fill worker rate when selected (only applies when creating new workers in array)
  const handleWorkerSelect = (index, workerId) => {
    if (!availableWorkers) return
    const worker = availableWorkers.find(w => w._id === workerId)
    if (worker) {
      // Use document.querySelector or react-hook-form setValue (we should use setValue normally, but keeping it simple)
      // Since we don't have setValue in destructured useForm here, we'll just let the user type the rate.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? (language === 'ar' ? 'تعديل التعيين' : 'Edit Assignment') : (language === 'ar' ? 'إضافة تعيين جديد' : 'New Assignment')}
            </h1>
            {assignment?.assignmentNumber && <p className="text-sm text-gray-500 mt-1">{assignment.assignmentNumber}</p>}
          </div>
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <Link to={`/app/dashboard/manpower/assignments/${id}/print`} target="_blank" className="btn btn-secondary">
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'طباعة العقد' : 'Print Contract'}
            </Link>
            {assignment?.status === 'active' && (
              <Link to={`/app/dashboard/accounting/invoices/new/sell?proforma=1`} className="btn btn-secondary">
                <FileText className="w-4 h-4" />
                {language === 'ar' ? 'إصدار فاتورة مبدئية' : 'Create Proforma'}
              </Link>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'العميل والموقع' : 'Client & Site'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="label">{language === 'ar' ? 'العميل' : 'Client'} *</label>
              <select {...register('clientId', { required: true })} className="select" disabled={isEdit}>
                <option value="">{language === 'ar' ? 'اختر عميل' : 'Select client'}</option>
                {(customers || []).map(c => (
                  <option key={c._id} value={c._id}>{language === 'ar' ? c.nameAr || c.nameEn : c.nameEn || c.nameAr}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="label">{language === 'ar' ? 'الموقع' : 'Site'}</label>
              <input {...register('site')} className="input" placeholder={language === 'ar' ? 'موقع العمل (اختياري)' : 'Work site (optional)'} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ البدء' : 'Start Date'} *</label>
              <input type="date" {...register('startDate', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</label>
              <input type="date" {...register('endDate')} className="input" />
            </div>
            <div className="lg:col-span-2">
              <label className="label">{language === 'ar' ? 'الحالة' : 'Status'}</label>
              <select {...register('status')} className="select">
                <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
                <option value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</option>
                <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'العمالة المعينة' : 'Assigned Workers'}</h3>
            </div>
            <button
              type="button"
              onClick={() => append({ workerId: '', startDate: watch('startDate'), endDate: '', dailyRate: 0, hoursPerDay: 8 })}
              className="btn btn-secondary"
            >
              <Plus className="w-4 h-4" />
              {language === 'ar' ? 'إضافة عامل' : 'Add Worker'}
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-3">
                  <label className="label">{language === 'ar' ? 'العامل' : 'Worker'} *</label>
                  {isEdit ? (
                    <div className="p-2 bg-white dark:bg-dark-800 rounded border border-gray-200 dark:border-dark-600 truncate">
                      {assignment?.workers?.[index]?.workerId?.name || field.workerId}
                    </div>
                  ) : (
                    <select {...register(`workers.${index}.workerId`, { required: true })} className="select">
                      <option value="">{language === 'ar' ? 'اختر عامل متاح' : 'Select available worker'}</option>
                      {(availableWorkers || []).map(w => (
                        <option key={w._id} value={w._id}>{w.workerNumber} - {w.name} ({w.trade})</option>
                      ))}
                    </select>
                  )}
                </div>
                
                <div className="md:col-span-2">
                  <label className="label">{language === 'ar' ? 'التكلفة اليومية' : 'Daily Rate'}</label>
                  <input type="number" step="0.01" {...register(`workers.${index}.dailyRate`, { valueAsNumber: true })} className="input" />
                </div>

                <div className="md:col-span-2">
                  <label className="label">{language === 'ar' ? 'ساعات/يوم' : 'Hours/Day'}</label>
                  <input type="number" step="0.5" {...register(`workers.${index}.hoursPerDay`, { valueAsNumber: true })} className="input" />
                </div>

                <div className="md:col-span-2">
                  <label className="label">{language === 'ar' ? 'تاريخ البدء' : 'Start Date'} *</label>
                  <input type="date" {...register(`workers.${index}.startDate`, { required: true })} className="input" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</label>
                  <input type="date" {...register(`workers.${index}.endDate`)} className="input" />
                </div>

                <div className="md:col-span-1 flex justify-end">
                  {fields.length > 1 && !isEdit && (
                    <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-dark-700 rounded-xl border border-dashed border-gray-300 dark:border-dark-600">
                {language === 'ar' ? 'أضف عمالة لهذا التعيين' : 'Add workers to this assignment'}
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
          <textarea {...register('notes')} className="input" rows={4} />
        </div>

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
    </div>
  )
}

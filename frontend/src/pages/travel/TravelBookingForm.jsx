import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useFieldArray, useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Plane, FileText, Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import CurrencySymbol from '../../components/ui/CurrencySymbol'
import { getTenantCurrency } from '../../lib/saudiTenant'

export default function TravelBookingForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const tenantCurrency = getTenantCurrency(tenant)

  const { register, control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      status: 'confirmed',
      serviceType: 'flight',
      currency: tenantCurrency,
      subtotal: 0,
      totalTax: 0,
      grandTotal: 0,
      hasReturnDate: false,
      segments: [{ from: '', to: '' }],
    },
  })
  const { fields: segmentFields, append: appendSegment, remove: removeSegment } = useFieldArray({ control, name: 'segments' })
  const hasReturnDate = Boolean(watch('hasReturnDate'))
  const routeSegments = watch('segments') || []

  const createInvoiceMutation = useMutation({
    mutationFn: () => api.post(`/travel-bookings/${id}/create-invoice`).then((res) => res.data),
    onSuccess: (data) => {
      const invoiceId = data?.invoice?._id
      if (invoiceId) {
        toast.success(language === 'ar' ? 'تم إنشاء الفاتورة' : 'Invoice created')
        queryClient.invalidateQueries(['travel-booking', id])
        queryClient.invalidateQueries(['travel-bookings'])
        queryClient.invalidateQueries(['travel-bookings-lookup'])
        queryClient.invalidateQueries(['invoices'])
        queryClient.invalidateQueries(['dashboard'])
        queryClient.invalidateQueries(['dashboard-revenue'])
        queryClient.invalidateQueries(['customers'])
        queryClient.invalidateQueries(['customers-lookup'])
        navigate(`/app/dashboard/invoices/${invoiceId}`)
      } else {
        toast.error(language === 'ar' ? 'لم يتم إنشاء الفاتورة' : 'Invoice not created')
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const subtotal = watch('subtotal')
  const totalTax = watch('totalTax')

  useEffect(() => {
    const s = Number(subtotal) || 0
    const tx = Number(totalTax) || 0
    const gt = s + tx
    setValue('grandTotal', gt)
  }, [subtotal, totalTax, setValue])

  useEffect(() => {
    const safeSegments = Array.isArray(routeSegments) ? routeSegments : []
    const firstSegment = safeSegments[0]
    const lastSegment = safeSegments[safeSegments.length - 1]
    setValue('routeFrom', firstSegment?.from || '')
    setValue('routeTo', lastSegment?.to || '')
  }, [routeSegments, setValue])

  useEffect(() => {
    if (!hasReturnDate) {
      setValue('returnDate', '')
    }
  }, [hasReturnDate, setValue])

  const { isLoading } = useQuery({
    queryKey: ['travel-booking', id],
    queryFn: () => api.get(`/travel-bookings/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      reset({
        ...data,
        departureDate: data?.departureDate ? String(data.departureDate).slice(0, 10) : '',
        hasReturnDate: Boolean(data?.hasReturnDate && data?.returnDate),
        returnDate: data?.hasReturnDate && data?.returnDate ? String(data.returnDate).slice(0, 10) : '',
        segments: Array.isArray(data?.segments) && data.segments.length > 0 ? data.segments : [{ from: data?.routeFrom || '', to: data?.routeTo || '' }],
      })
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data }
      if (payload.departureDate) payload.departureDate = new Date(payload.departureDate)
      else delete payload.departureDate
      payload.hasReturnDate = Boolean(payload.hasReturnDate && payload.returnDate)
      if (payload.hasReturnDate && payload.returnDate) payload.returnDate = new Date(payload.returnDate)
      else delete payload.returnDate

      payload.subtotal = Number(payload.subtotal) || 0
      payload.totalTax = Number(payload.totalTax) || 0
      payload.grandTotal = Number(payload.grandTotal) || payload.subtotal + payload.totalTax

      return isEdit ? api.put(`/travel-bookings/${id}`, payload) : api.post('/travel-bookings', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث الحجز' : 'Booking updated') : (language === 'ar' ? 'تم إنشاء الحجز' : 'Booking created'))
      queryClient.invalidateQueries(['travel-bookings'])
      queryClient.invalidateQueries(['dashboard-travel-stats'])
      navigate('/app/dashboard/travel-bookings')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const headerTitle = useMemo(() => {
    if (isEdit) return language === 'ar' ? 'تعديل حجز' : 'Edit Booking'
    return language === 'ar' ? 'حجز جديد' : 'New Booking'
  }, [isEdit, language])

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{headerTitle}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Plane className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'تفاصيل الحجز' : 'Booking Details'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الحالة' : 'Status'}</label>
              <select {...register('status')} className="select">
                <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
                <option value="confirmed">{language === 'ar' ? 'مؤكد' : 'Confirmed'}</option>
                <option value="ticketed">{language === 'ar' ? 'تم إصدار التذكرة' : 'Ticketed'}</option>
                <option value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</option>
                <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'نوع الخدمة' : 'Service Type'}</label>
              <select {...register('serviceType')} className="select">
                <option value="flight">{language === 'ar' ? 'طيران' : 'Flight'}</option>
                <option value="hotel">{language === 'ar' ? 'فندق' : 'Hotel'}</option>
                <option value="package">{language === 'ar' ? 'باقة' : 'Package'}</option>
                <option value="visa">{language === 'ar' ? 'تأشيرة' : 'Visa'}</option>
                <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'العملة' : 'Currency'}</label>
              <input {...register('currency')} className="input" defaultValue="SAR" />
            </div>

            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'اسم العميل' : 'Customer Name'} *</label>
              <input {...register('customerName', { required: true })} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'رقم الجوال' : 'Phone'}</label>
              <input {...register('customerPhone')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'اسم المسافر' : 'Traveler Name'}</label>
              <input {...register('travelerName')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" {...register('customerEmail')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'رقم الجواز' : 'Passport Number'}</label>
              <input {...register('passportNumber')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'رقم التذكرة' : 'Ticket Number'}</label>
              <input {...register('ticketNumber')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'رقم PNR' : 'PNR'}</label>
              <input {...register('pnr')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'شركة الطيران / المورد' : 'Airline / Vendor'}</label>
              <input {...register('airlineName')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ المغادرة' : 'Departure Date'}</label>
              <input type="date" {...register('departureDate')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'خيار العودة' : 'Return Trip'}</label>
              <label className="flex h-11 items-center gap-3 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-700 dark:border-dark-600 dark:text-gray-200">
                <input type="checkbox" {...register('hasReturnDate')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span>{language === 'ar' ? 'تضمين تاريخ العودة' : 'Include return date'}</span>
              </label>
            </div>

            <div className={hasReturnDate ? '' : 'opacity-60'}>
              <label className="label">{language === 'ar' ? 'تاريخ العودة' : 'Return Date'}</label>
              <input type="date" {...register('returnDate')} className="input" disabled={!hasReturnDate} />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'التوقف / الإقامة' : 'Layover / Stay'}</label>
              <input {...register('layoverStay')} className="input" />
            </div>

            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {language === 'ar' ? 'المجموع' : 'Subtotal'}
                  <CurrencySymbol currency={tenantCurrency} />
                </span>
              </label>
              <input type="number" step="0.01" {...register('subtotal', { valueAsNumber: true })} className="input" />
            </div>

            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {language === 'ar' ? 'الضريبة' : 'Tax'}
                  <CurrencySymbol currency={tenantCurrency} />
                </span>
              </label>
              <input type="number" step="0.01" {...register('totalTax', { valueAsNumber: true })} className="input" />
            </div>

            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {language === 'ar' ? 'الإجمالي' : 'Total'}
                  <CurrencySymbol currency={tenantCurrency} />
                </span>
              </label>
              <input type="number" step="0.01" {...register('grandTotal', { valueAsNumber: true })} className="input" readOnly />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <label className="label mb-0">{language === 'ar' ? 'مسار الرحلة' : 'Route Segments'}</label>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'أضف أكثر من مقطع مثل الدمام → دبي ثم دبي → لاهور' : 'Add multiple legs like Dammam → Dubai then Dubai → Lahore'}</p>
                </div>
                <button type="button" onClick={() => appendSegment({ from: '', to: '' })} className="btn btn-secondary">
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'إضافة مقطع' : 'Add Segment'}
                </button>
              </div>
              <div className="space-y-3">
                {segmentFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] dark:border-dark-600">
                    <div>
                      <label className="label">{language === 'ar' ? 'من' : 'From'}</label>
                      <input {...register(`segments.${index}.from`)} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'إلى' : 'To'}</label>
                      <input {...register(`segments.${index}.to`)} className="input" />
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={() => removeSegment(index)} disabled={segmentFields.length === 1} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-900/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
              <textarea {...register('notes')} className="input" rows={3} />
            </div>
          </div>

          <input type="hidden" {...register('routeFrom')} />
          <input type="hidden" {...register('routeTo')} />
        </motion.div>

        <div className="flex justify-end gap-3">
          {isEdit && (
            <button
              type="button"
              onClick={() => createInvoiceMutation.mutate()}
              disabled={createInvoiceMutation.isPending}
              className="btn btn-secondary"
            >
              {createInvoiceMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {language === 'ar' ? 'إنشاء فاتورة' : 'Create Invoice'}
            </button>
          )}
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
      </form>
    </div>
  )
}

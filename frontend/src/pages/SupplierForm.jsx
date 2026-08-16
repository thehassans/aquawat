import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Building2, MapPin, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { useLiveTranslation } from '../lib/liveTranslation'

export default function SupplierForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const { register, handleSubmit, reset, setValue, watch, control } = useForm({
    defaultValues: {
      type: 'company',
      paymentTerms: { term: 'net_30' },
      address: { country: 'SA' },
    },
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameEn',
    targetField: 'nameAr',
    sourceLang: 'en',
    targetLang: 'ar'
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameAr',
    targetField: 'nameEn',
    sourceLang: 'ar',
    targetLang: 'en'
  })

  const { isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get(`/suppliers/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      reset({
        ...data,
        paymentTerms: data?.paymentTerms || { term: 'net_30' },
        address: data?.address || { country: 'SA' },
        bank: data?.bank || {},
      })
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/suppliers/${id}`, data) : api.post('/suppliers', data)),
    onSuccess: () => {
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث المورد'
            : 'Supplier updated'
          : language === 'ar'
            ? 'تم إضافة المورد'
            : 'Supplier added'
      )
      queryClient.invalidateQueries(['suppliers'])
      queryClient.invalidateQueries(['suppliers-stats'])
      navigate('/suppliers')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

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
        <button onClick={() => navigate(returnTo || '/app/dashboard/suppliers')} className="btn btn-ghost btn-icon shrink-0">
          <ArrowLeft className={`h-5 w-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? (language === 'ar' ? 'تعديل مورد' : 'Edit Supplier') : language === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Building2 className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات المورد' : 'Supplier Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الرمز' : 'Code'} *</label>
              <input {...register('code', { required: true })} className="input" placeholder="SUP-001" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'النوع' : 'Type'}</label>
              <select {...register('type')} className="select">
                <option value="company">{language === 'ar' ? 'شركة' : 'Company'}</option>
                <option value="individual">{language === 'ar' ? 'فرد' : 'Individual'}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}</label>
              <input {...register('vatNumber')} className="input" placeholder="300000000000003" />
            </div>

            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4" dir="ltr">
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Name (EN) *</span>
                  <span dir="rtl" className="font-medium text-gray-500">الاسم بالإنجليزية</span>
                </label>
                <input {...register('nameEn', { required: true })} className="input" />
              </div>
              <div>
                <label className="label flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Name (AR)</span>
                  <span dir="rtl" className="font-medium text-gray-500">الاسم بالعربية</span>
                </label>
                <input {...register('nameAr')} className="input" dir="rtl" />
              </div>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'الشخص المسؤول' : 'Contact Person'}</label>
              <input {...register('contactPerson')} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
              <input {...register('phone')} className="input" placeholder="+9665xxxxxxxx" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" {...register('email')} className="input" placeholder="supplier@email.com" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'العنوان' : 'Address'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'الشارع' : 'Street'}</label>
              <input {...register('address.street')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الحي' : 'District'}</label>
              <input {...register('address.district')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'المدينة' : 'City'}</label>
              <input {...register('address.city')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label>
              <input {...register('address.postalCode')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الدولة' : 'Country'}</label>
              <input {...register('address.country')} className="input" placeholder="SA" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'الدفع والبنك' : 'Payment & Banking'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'شروط الدفع' : 'Payment Terms'}</label>
              <select {...register('paymentTerms.term')} className="select">
                <option value="immediate">{language === 'ar' ? 'فوري' : 'Immediate'}</option>
                <option value="net_7">{language === 'ar' ? '7 أيام' : 'Net 7'}</option>
                <option value="net_15">{language === 'ar' ? '15 يوم' : 'Net 15'}</option>
                <option value="net_30">{language === 'ar' ? '30 يوم' : 'Net 30'}</option>
                <option value="net_60">{language === 'ar' ? '60 يوم' : 'Net 60'}</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'IBAN' : 'IBAN'}</label>
              <input {...register('bank.iban')} className="input" placeholder="SA0000000000000000000000" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'البنك' : 'Bank Name'}</label>
              <input {...register('bank.bankName')} className="input" />
            </div>

            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'اسم المستفيد' : 'Beneficiary Name'}</label>
              <input {...register('bank.beneficiaryName')} className="input" />
            </div>

            <div className="md:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
              <textarea {...register('notes')} className="input" rows={3} />
            </div>
          </div>
        </motion.div>

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
      </form>
    </div>
  )
}

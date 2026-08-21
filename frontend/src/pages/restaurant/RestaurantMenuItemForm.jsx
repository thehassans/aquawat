import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, UtensilsCrossed, ImagePlus, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import SarIcon from '../../components/ui/SarIcon'
import Money from '../../components/ui/Money'
import { useLiveTranslation } from '../../lib/liveTranslation'
import { showArabicFields, getDefaultTaxRate, getTaxRateOptions } from '../../lib/saudiTenant'
import { CURRENCY_CODE } from '../../lib/currency'

export default function RestaurantMenuItemForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isRtl = language === 'ar'
  const bilingualAr = showArabicFields(tenant)
  const currencyCode = String(tenant?.settings?.currency || CURRENCY_CODE).toUpperCase()
  const taxRateOptions = getTaxRateOptions(tenant, language)

  const [imageUrl, setImageUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const { register, handleSubmit, reset, setValue, watch, control } = useForm({
    defaultValues: {
      sellingPrice: 0,
      taxRate: getDefaultTaxRate(tenant),
      isActive: true,
      hasHalfPlate: false,
      halfPlatePrice: 0,
      calories: 0,
      prepTime: 0
    },
  })

  const hasHalfPlate = watch('hasHalfPlate')

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameEn',
    targetField: 'nameAr',
    sourceLang: 'en',
    targetLang: 'ar',
    enabled: bilingualAr,
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'descriptionEn',
    targetField: 'descriptionAr',
    sourceLang: 'en',
    targetLang: 'ar',
    enabled: bilingualAr,
  })

  const { data: itemData, isLoading } = useQuery({
    queryKey: ['restaurant-menu-item', id],
    queryFn: () => api.get(`/restaurant/menu-items/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (itemData) {
      reset(itemData)
      if (itemData.imageUrl) setImageUrl(itemData.imageUrl)
    }
  }, [itemData, reset])

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    setIsUploading(true)
    try {
      const { data } = await api.post('/restaurant/menu-items/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImageUrl(data.imageUrl)
      toast.success(isRtl ? 'تم رفع الصورة' : 'Image uploaded successfully')
    } catch (error) {
      toast.error(isRtl ? 'فشل رفع الصورة' : 'Image upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, imageUrl }
      if (!bilingualAr) {
        payload.nameAr = payload.nameAr || payload.nameEn || ''
        payload.descriptionAr = payload.descriptionAr || payload.descriptionEn || ''
      }
      payload.sellingPrice = Number(payload.sellingPrice) || 0
      payload.halfPlatePrice = Number(payload.halfPlatePrice) || 0
      payload.taxRate = Number(payload.taxRate) || 0
      payload.calories = Number(payload.calories) || 0
      payload.prepTime = Number(payload.prepTime) || 0
      payload.isActive = payload.isActive !== false
      return isEdit ? api.put(`/restaurant/menu-items/${id}`, payload) : api.post('/restaurant/menu-items', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? (isRtl ? 'تم تحديث الصنف' : 'Item updated') : isRtl ? 'تم إضافة الصنف' : 'Item added')
      queryClient.invalidateQueries(['restaurant-menu-items'])
      navigate('/app/dashboard/restaurant/menu-items')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon hover:bg-gray-100 dark:hover:bg-dark-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            {isEdit ? (isRtl ? 'تعديل صنف' : 'Edit Item') : isRtl ? 'إضافة صنف' : 'Add Menu Item'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        
        {/* Image Upload Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-dark-800 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImageUpload} 
              accept="image/jpeg, image/png, image/webp" 
              className="hidden" 
            />
            
            <div className="relative group w-48 h-48 rounded-3xl overflow-hidden bg-gray-50 dark:bg-dark-900 border-2 border-dashed border-gray-300 dark:border-dark-700 flex flex-col items-center justify-center transition-colors hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer"
                 onClick={() => !isUploading && fileInputRef.current?.click()}>
              
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="Menu Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white font-semibold text-sm">{isRtl ? 'تغيير الصورة' : 'Change Image'}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setImageUrl(''); }}
                    className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded-full shadow-md hover:bg-rose-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : isUploading ? (
                <div className="flex flex-col items-center text-amber-600">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span className="text-xs font-semibold">{isRtl ? 'جاري التحويل (WebP)...' : 'Converting to WebP...'}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-400 group-hover:text-amber-500 transition-colors">
                  <ImagePlus className="w-10 h-10 mb-2" />
                  <span className="text-xs font-semibold px-4 text-center">
                    {isRtl ? 'انقر لرفع صورة (JPG, PNG) سيتم تحويلها تلقائياً' : 'Click to upload (JPG, PNG) auto-converted to WebP'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Details Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-dark-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-dark-700 pb-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <UtensilsCrossed className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{isRtl ? 'تفاصيل الصنف' : 'Item Details'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={bilingualAr ? '' : 'md:col-span-2'}>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {isRtl ? 'الاسم (EN) *' : (bilingualAr ? 'Name (EN) *' : 'Name *')}
              </label>
              <input {...register('nameEn', { required: true })} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl" placeholder="e.g. Hummus" />
            </div>

            {bilingualAr && (
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{isRtl ? 'الاسم (AR)' : 'Name (AR)'}</label>
                <input {...register('nameAr')} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl" dir="rtl" placeholder="e.g. الحمص" />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {isRtl ? 'الوصف (EN)' : (bilingualAr ? 'Description (EN)' : 'Description')}
              </label>
              <textarea {...register('descriptionEn')} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl min-h-[80px]" placeholder="Describe the dish..."></textarea>
            </div>

            {bilingualAr && (
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{isRtl ? 'الوصف (AR)' : 'Description (AR)'}</label>
                <textarea {...register('descriptionAr')} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl min-h-[80px]" dir="rtl" placeholder="وصف الطبق..."></textarea>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{isRtl ? 'التصنيف' : 'Category'}</label>
              <input {...register('category')} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl" placeholder="e.g. Appetizers, Main Course" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{isRtl ? 'SKU' : 'SKU'}</label>
              <input {...register('sku')} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl font-mono text-sm" placeholder="ITEM-001" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{isRtl ? 'السعرات الحرارية' : 'Calories (kcal)'}</label>
                <input type="number" {...register('calories', { valueAsNumber: true })} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl" placeholder="e.g. 350" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{isRtl ? 'وقت التحضير (دقيقة)' : 'Prep Time (min)'}</label>
                <input type="number" {...register('prepTime', { valueAsNumber: true })} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl" placeholder="e.g. 15" />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-900/40 p-4 rounded-2xl border border-gray-100 dark:border-dark-700">
              <label className="block text-sm font-bold text-amber-700 dark:text-amber-500 mb-3 border-b border-amber-200/50 pb-2">
                {isRtl ? 'التسعير' : 'Pricing'}
              </label>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                    {isRtl ? 'السعر الأساسي' : 'Base Price'}{' '}
                    {currencyCode === 'SAR' ? <SarIcon className="inline w-3 h-3 ml-1" /> : <span className="ml-1">({currencyCode})</span>}
                  </label>
                  <input type="number" step="0.01" {...register('sellingPrice', { valueAsNumber: true, required: true })} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl font-bold text-lg" />
                </div>
                
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mt-2 mb-2">
                    <input type="checkbox" {...register('hasHalfPlate')} className="toggle toggle-sm toggle-warning" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{isRtl ? 'تفعيل نصف حصة' : 'Enable Half Plate Option'}</span>
                  </label>
                  
                  {hasHalfPlate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        {isRtl ? 'سعر نصف حصة' : 'Half Plate Price'}{' '}
                        {currencyCode === 'SAR' ? <SarIcon className="inline w-3 h-3 ml-1" /> : <span className="ml-1">({currencyCode})</span>}
                      </label>
                      <input type="number" step="0.01" {...register('halfPlatePrice', { valueAsNumber: true })} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl font-bold text-lg text-indigo-600" />
                    </motion.div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{isRtl ? 'الضريبة %' : 'Tax %'}</label>
                  <select {...register('taxRate', { valueAsNumber: true })} className="w-full input border-gray-200 focus:border-amber-500 rounded-xl">
                    {taxRateOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <input type="checkbox" {...register('isActive')} className="checkbox checkbox-sm checkbox-success" />
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">{isRtl ? 'المنتج متاح' : 'Item is Active'}</span>
              </label>
            </div>

          </div>
        </motion.div>

        <div className="flex justify-end gap-3 pb-10">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary rounded-xl px-6">
            {t('cancel')}
          </button>
          <button type="submit" disabled={mutation.isPending || isUploading} className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-8 border-none shadow-lg shadow-amber-500/30">
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

import { useRef, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, UtensilsCrossed, Edit, Trash2, Sparkles, Camera, Loader2, Image as ImageIcon } from 'lucide-react'
import api, { getImageUrl } from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import toast from 'react-hot-toast'
import SarIcon from '../../components/ui/SarIcon'
import RestaurantMenuOCRModal from './RestaurantMenuOCRModal'
import RestaurantMenuBulkImagesModal from './RestaurantMenuBulkImagesModal'

export default function RestaurantMenuItems() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const basePath = location.pathname.includes('/super-admin') 
    ? location.pathname 
    : '/app/dashboard/restaurant/menu-items'
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const fileInputRef = useRef(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false)
  const [isBulkImagesOpen, setIsBulkImagesOpen] = useState(false)
  const [uploadingItemId, setUploadingItemId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-menu-items', page, search],
    queryFn: () =>
      api
        .get('/restaurant/menu-items', { params: { page, limit: 50, search, isActive: 'all' } })
        .then((res) => res.data),
  })

  const items = data?.items || []
  const pagination = data?.pagination

  const seedMutation = useMutation({
    mutationFn: () => api.post('/restaurant/menu-items/seed-drinks'),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إنشاء المشروبات بنجاح' : 'Drinks seeded successfully')
      queryClient.invalidateQueries(['restaurant-menu-items'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to seed drinks')
    }
  })

  const seedFoodMutation = useMutation({
    mutationFn: () => api.post('/restaurant/menu-items/seed-food'),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إنشاء المأكولات بنجاح' : 'Food categories seeded successfully')
      queryClient.invalidateQueries(['restaurant-menu-items'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to seed food')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/restaurant/menu-items/${id}`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حذف الصنف' : 'Menu item deleted')
      queryClient.invalidateQueries(['restaurant-menu-items'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete item')
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/restaurant/menu-items/${id}`, { isActive }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث حالة الصنف' : 'Item status updated')
      queryClient.invalidateQueries(['restaurant-menu-items'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update status')
    }
  })

  const imageUploadMutation = useMutation({
    mutationFn: async ({ id, file }) => {
      const formData = new FormData()
      formData.append('image', file)
      const { data: { imageUrl } } = await api.post('/restaurant/menu-items/upload-image', formData)
      await api.put(`/restaurant/menu-items/${id}`, { imageUrl })
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الصورة' : 'Image updated successfully')
      queryClient.invalidateQueries(['restaurant-menu-items'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to upload image')
    },
    onSettled: () => {
      setUploadingItemId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  })

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file && uploadingItemId) {
      imageUploadMutation.mutate({ id: uploadingItemId, file })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'قائمة الطعام' : 'Menu Items'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة أصناف قائمة الطعام' : 'Manage restaurant menu items'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => seedFoodMutation.mutate()}
            disabled={seedFoodMutation.isPending}
            className="btn btn-secondary bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 border-transparent"
          >
            {seedFoodMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UtensilsCrossed className="w-4 h-4" />
            )}
            {language === 'ar' ? 'توليد مأكولات' : 'Seed Food'}
          </button>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="btn btn-secondary bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 border-transparent"
          >
            {seedMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UtensilsCrossed className="w-4 h-4" />
            )}
            {language === 'ar' ? 'توليد مشروبات' : 'Seed Drinks'}
          </button>
          <button
            onClick={() => setIsBulkImagesOpen(true)}
            className="btn btn-secondary bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 border-transparent hidden sm:flex"
          >
            <ImageIcon className="w-4 h-4" />
            {language === 'ar' ? 'إضافة صور' : 'Add Images'}
          </button>
          <button
            onClick={() => setIsOCRModalOpen(true)}
            className="btn btn-secondary bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40 border-transparent"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            {language === 'ar' ? 'استخراج (OCR)' : 'Scan Menu (OCR)'}
          </button>
          <Link to={`${basePath}/new`} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة صنف' : 'Add Item'}
          </Link>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث بالاسم / SKU...' : 'Search by name / SKU...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="input ps-10"
            />
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'SKU' : 'SKU'}</th>
                  <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                  <th>{language === 'ar' ? 'التصنيف' : 'Category'}</th>
                  <th>{language === 'ar' ? 'السعر' : 'Price'}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it._id}>
                    <td className="font-mono text-sm">{it.sku || '-'}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div 
                          className="relative cursor-pointer group"
                          onClick={() => {
                            if (!imageUploadMutation.isPending) {
                              setUploadingItemId(it._id);
                              fileInputRef.current?.click();
                            }
                          }}
                        >
                          {uploadingItemId === it._id ? (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                            </div>
                          ) : it.imageUrl ? (
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                              <img src={getImageUrl(it.imageUrl)} alt={it.nameEn} loading="lazy" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="relative w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center overflow-hidden">
                              <UtensilsCrossed className="w-5 h-5 text-gray-400 group-hover:opacity-0 transition-opacity" />
                              <div className="absolute inset-0 bg-gray-200 dark:bg-dark-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {language === 'ar' ? it.nameAr || it.nameEn : it.nameEn || it.nameAr}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{it.category || '-'}</td>
                    <td className="font-semibold">
                      <Money value={it.sellingPrice || 0} />
                    </td>
                    <td>
                      <select
                        value={it.isActive ? 'active' : 'inactive'}
                        onChange={(e) => toggleMutation.mutate({ id: it._id, isActive: e.target.value === 'active' })}
                        disabled={toggleMutation.isPending}
                        className={`text-xs font-semibold rounded-lg border border-transparent py-1.5 px-3 outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer appearance-none ${
                          it.isActive 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-400'
                        }`}
                      >
                        <option value="active" className="bg-white dark:bg-dark-800 text-gray-900 dark:text-white">{language === 'ar' ? 'نشط' : 'Active'}</option>
                        <option value="inactive" className="bg-white dark:bg-dark-800 text-gray-900 dark:text-white">{language === 'ar' ? 'غير نشط' : 'Inactive'}</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`${basePath}/${it._id}`}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                        >
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الصنف؟' : 'Are you sure you want to delete this item?')) {
                              deleteMutation.mutate(it._id)
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      {language === 'ar' ? 'لا توجد أصناف' : 'No items found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-sm text-gray-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      <RestaurantMenuOCRModal
        isOpen={isOCRModalOpen}
        onClose={() => setIsOCRModalOpen(false)}
        onSaved={() => queryClient.invalidateQueries(['restaurant-menu-items'])}
      />

      <RestaurantMenuBulkImagesModal
        isOpen={isBulkImagesOpen}
        onClose={() => setIsBulkImagesOpen(false)}
        onSaved={() => queryClient.invalidateQueries(['restaurant-menu-items'])}
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  )
}



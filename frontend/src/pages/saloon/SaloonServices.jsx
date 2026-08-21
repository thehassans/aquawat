import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, Search, Wand2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import CurrencySymbol from '../../components/ui/CurrencySymbol'

export default function SaloonServices() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const isRtl = language === 'ar'
  const queryClient = useQueryClient()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['saloon-services'],
    queryFn: () => api.get('/saloon/services').then(res => res.data)
  })
  
  const seedMutation = useMutation({
    mutationFn: () => api.post('/saloon/services/seed'),
    onSuccess: (data) => {
      toast.success(isRtl ? `تم إضافة ${data.count} خدمات ديمو` : `Seeded ${data.count} demo services`)
      queryClient.invalidateQueries(['saloon-services'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error seeding services')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/saloon/services/${id}`),
    onSuccess: () => {
      toast.success(isRtl ? 'تم الحذف' : 'Service deleted')
      queryClient.invalidateQueries(['saloon-services'])
    }
  })

  const filteredServices = services.filter(s => 
    (s.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.nameAr?.includes(searchTerm))
  )

  const ServiceCard = ({ service }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden group hover:shadow-lg transition-all"
    >
      <div className="h-48 bg-gray-100 dark:bg-dark-700 relative overflow-hidden">
        {service.imageUrl ? (
          <img src={service.imageUrl.startsWith('http') ? service.imageUrl : api.defaults.baseURL.replace('/api', '') + service.imageUrl} alt={service.nameEn} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Package className="w-12 h-12" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => { setEditingService(service); setIsFormOpen(true); }}
            className="p-2 bg-white dark:bg-dark-800 rounded-lg shadow hover:text-primary-600"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              if (window.confirm('Delete this service?')) {
                deleteMutation.mutate(service._id)
              }
            }}
            className="p-2 bg-white dark:bg-dark-800 rounded-lg shadow hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg">{isRtl ? service.nameAr : service.nameEn}</h3>
            <p className="text-sm text-gray-500">{service.category}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-primary-600 flex items-center justify-end gap-1">
              {service.price} <CurrencySymbol currency={tenant?.settings?.currency} className="w-4 h-4" />
            </p>
            <p className="text-xs text-gray-400">{service.durationMinutes} min</p>
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isRtl ? 'قائمة خدمات الصالون' : 'Saloon Services Catalog'}</h1>
          <p className="text-gray-500">{isRtl ? 'إدارة خدمات الحلاقة والأسعار' : 'Manage your barber services and pricing'}</p>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="btn btn-secondary flex items-center gap-2"
            >
              {seedMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {isRtl ? 'توليد خدمات تجريبية' : 'Seed Demo Services'}
            </button>
          )}
          <button 
            onClick={() => { setEditingService(null); setIsFormOpen(true); }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {isRtl ? 'إضافة خدمة' : 'Add Service'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white dark:bg-dark-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700 w-full md:w-96">
        <Search className="w-5 h-5 text-gray-400 ml-2" />
        <input
          type="text"
          placeholder={isRtl ? 'ابحث عن خدمة...' : 'Search services...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none focus:ring-0 w-full"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 dark:bg-dark-700 rounded-xl"></div>
          ))}
        </div>
      ) : filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredServices.map(service => (
            <ServiceCard key={service._id} service={service} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-dark-800 rounded-2xl border border-dashed border-gray-200 dark:border-dark-700">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {isRtl ? 'لا توجد خدمات' : 'No services found'}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {isRtl ? 'لم تقم بإضافة أي خدمات للصالون بعد. انقر على الزر أعلاه لإضافة خدمتك الأولى أو توليد خدمات تجريبية.' : 'You haven\'t added any saloon services yet. Click the button above to add your first service or seed demo services.'}
          </p>
        </div>
      )}

      {/* Basic form modal logic would go here. For now it triggers alerts. */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-lg p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4">{editingService ? (isRtl ? 'تعديل الخدمة' : 'Edit Service') : (isRtl ? 'إضافة خدمة' : 'Add Service')}</h2>
             <p className="text-gray-500 mb-6">{isRtl ? 'لإضافة خدمة جديدة يمكنك استخدام واجهة برمجة التطبيقات أو لوحة التحكم الكاملة لاحقاً.' : 'For demo purposes, the form logic is abbreviated. Please use Seed Demo Services to populate.'}</p>
             <div className="flex justify-end gap-3">
               <button onClick={() => setIsFormOpen(false)} className="btn btn-ghost">{isRtl ? 'إغلاق' : 'Close'}</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

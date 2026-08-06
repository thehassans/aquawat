import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '../../lib/translations'
import api from '../../lib/api'
import PageLoader from '../../components/ui/PageLoader'
import { motion, AnimatePresence } from 'framer-motion'
import { Scissors, Globe, Search, Info, Clock } from 'lucide-react'

export default function PublicServices() {
  const [searchParams] = useSearchParams()
  const tenantId = searchParams.get('tenant')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [activeCategory, setActiveCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [language, setLanguage] = useState('ar')
  const { t } = useTranslation(language)
  const isRtl = language === 'ar'

  useEffect(() => {
    if (!tenantId) {
      setError('Invalid Catalog Link')
      setLoading(false)
      return
    }

    api.get(`/public/tenant/${tenantId}/services`)
      .then(res => {
        setData(res.data)
        const defaultLang = res.data?.tenant?.settings?.saloon?.qrServices?.defaultLanguage || 'ar'
        setLanguage(defaultLang)
        setLoading(false)
        
        // set active category initially
        if (res.data?.services?.length) {
          const cats = [...new Set(res.data.services.map(item => item.category))].filter(Boolean).sort()
          if (cats.length) setActiveCategory(cats[0])
        }
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load services')
        setLoading(false)
      })
  }, [tenantId])

  const categories = useMemo(() => {
    if (!data?.services) return []
    const cats = [...new Set(data.services.map(item => item.category))].filter(Boolean)
    return cats.sort()
  }, [data])

  const filteredItems = useMemo(() => {
    if (!data?.services) return []
    return data.services.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (item.nameEn?.toLowerCase().includes(q) || item.nameAr?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q))
      }
      return item.category === activeCategory
    })
  }, [data, activeCategory, searchQuery])

  if (loading) return <div className="p-6 max-w-4xl mx-auto"><PageLoader /></div>

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Scissors className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">{isRtl ? 'عذراً' : 'Oops'}</h1>
          <p className="text-gray-500 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  const { tenant } = data
  const businessName = isRtl ? (tenant.business?.legalNameAr || tenant.name) : (tenant.business?.legalNameEn || tenant.name)
  const heroImage = tenant.settings?.saloon?.qrServices?.heroImage
  
  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-24">
      
      {/* Hero Section */}
      <div className="relative h-[40vh] min-h-[300px] max-h-[500px] w-full bg-gray-900 overflow-hidden">
        {heroImage ? (
          <img src={heroImage} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-900" />
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        
        {/* Top Actions */}
        <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-start z-10">
          <div className="bg-black/20 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10">
            {tenant.branding?.logoUrl ? (
              <img src={tenant.branding.logoUrl} alt="Logo" className="h-6 w-auto object-contain" />
            ) : (
              <Scissors className="w-5 h-5 text-white" />
            )}
            <span className="text-white font-bold text-sm truncate max-w-[120px]">{businessName}</span>
          </div>
          
          <button 
            onClick={() => setLanguage(lang => lang === 'ar' ? 'en' : 'ar')}
            className="bg-black/20 backdrop-blur-md border border-white/10 text-white p-2.5 rounded-full hover:bg-white/20 transition-all"
          >
            <Globe className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 inset-x-0 p-6 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2 drop-shadow-lg tracking-tight">
              {businessName}
            </h1>
            <p className="text-white/80 font-medium text-lg max-w-lg">
              {isRtl ? 'اكتشف خدماتنا المميزة واهتم بجمالك وأناقتك.' : 'Discover our premium services and treat yourself to the best care.'}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Search & Categories Bar (Sticky) */}
        <div className="sticky top-0 z-20 bg-[#FDFDFD]/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400`} />
              <input 
                type="text" 
                placeholder={isRtl ? 'ابحث في الخدمات...' : 'Search services...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-gray-100/80 border-none rounded-2xl py-3.5 ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900 placeholder-gray-500 transition-all`}
              />
            </div>
          </div>
          
          {!searchQuery && (
            <div className="px-4 py-3 overflow-x-auto no-scrollbar flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${
                    activeCategory === cat 
                      ? 'bg-gray-900 text-white shadow-md scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Services List */}
        <div className="p-4 sm:p-6 mt-2">
          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                {isRtl ? 'نتائج البحث' : 'Search Results'} ({filteredItems.length})
              </h2>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filteredItems.map(item => (
                <motion.div 
                  key={item._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group bg-white rounded-3xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 transition-all flex gap-4 overflow-hidden relative cursor-pointer"
                >
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                        {isRtl ? (item.nameAr || item.nameEn) : (item.nameEn || item.nameAr)}
                      </h3>
                      
                      {item.durationMinutes && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-3">
                          <Clock className="w-3.5 h-3.5" />
                          {item.durationMinutes} {isRtl ? 'دقيقة' : 'min'}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-auto pt-2">
                      <span className="font-black text-lg text-gray-900">
                        {item.price} <span className="text-sm font-bold text-indigo-600">{isRtl ? 'ر.س' : 'SAR'}</span>
                      </span>
                    </div>
                  </div>
                  
                  {item.imageUrl && (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-2xl overflow-hidden bg-gray-50 relative shadow-inner">
                      <img 
                        src={api.defaults.baseURL.replace('/api', '') + item.imageUrl} 
                        alt={item.nameEn} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredItems.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{isRtl ? 'لا توجد نتائج' : 'No Results Found'}</h3>
                <p className="text-gray-500">{isRtl ? 'حاول البحث بكلمات أخرى' : 'Try searching with different keywords'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Powered By */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full border border-gray-200">
          <span className="text-xs font-medium text-gray-500">{isRtl ? 'مشغل بواسطة' : 'Powered by'}</span>
          <span className="font-black text-gray-900 tracking-tight text-sm">Maqder</span>
        </div>
      </div>
    </div>
  )
}

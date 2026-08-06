import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { Plus, Search, Edit2, Trash2, UtensilsCrossed, Users, Hash, Settings2, Save, Map, LayoutGrid, CheckCircle2, AlertCircle, Clock, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import api from '../../lib/api'

export default function RestaurantTables() {
  const { language } = useSelector(state => state.ui)
  const isRtl = language === 'ar'

  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'floorplan'
  const [editMode, setEditMode] = useState(false)
  const containerRef = useRef(null)
  
  // Form Modal
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    tableNumber: '',
    name: '',
    seats: 4,
    status: 'available',
    shape: 'rectangle',
    width: 120,
    height: 80
  })
  const [editingId, setEditingId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

  useEffect(() => {
    fetchTables()
  }, [])

  const fetchTables = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/restaurant/tables')
      setTables(data || [])
    } catch (error) {
      toast.error('Failed to load tables')
    } finally {
      setLoading(false)
    }
  }

  const seedTables = async () => {
    try {
      setIsSeeding(true)
      await api.post('/restaurant/tables/seed')
      toast.success(isRtl ? 'تم إضافة الطاولات الافتراضية' : 'Default tables added')
      fetchTables()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to seed tables')
    } finally {
      setIsSeeding(false)
    }
  }

  const handleOpenModal = (table = null) => {
    if (table) {
      setFormData({
        tableNumber: table.tableNumber,
        name: table.name || '',
        seats: table.seats || 4,
        status: table.status,
        shape: table.shape || 'rectangle',
        width: table.width || 120,
        height: table.height || 80
      })
      setEditingId(table._id)
    } else {
      setFormData({ tableNumber: '', name: '', seats: 4, status: 'available', shape: 'rectangle', width: 120, height: 80 })
      setEditingId(null)
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      if (editingId) {
        await api.put(`/restaurant/tables/${editingId}`, formData)
        toast.success(isRtl ? 'تم تحديث الطاولة' : 'Table updated')
      } else {
        await api.post('/restaurant/tables', { ...formData, positionX: 50, positionY: 50 })
        toast.success(isRtl ? 'تمت إضافة الطاولة' : 'Table added')
      }
      setShowModal(false)
      fetchTables()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save table')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (tableId, newStatus) => {
    // Optimistic UI update
    setTables(prev => prev.map(t => t._id === tableId ? { ...t, status: newStatus } : t))
    try {
      await api.put(`/restaurant/tables/${tableId}`, { status: newStatus })
      toast.success(isRtl ? 'تم تحديث الحالة' : 'Status updated')
    } catch (error) {
      toast.error('Failed to update status')
      fetchTables()
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد من حذف هذه الطاولة؟' : 'Are you sure you want to delete this table?')) return
    try {
      await api.delete(`/restaurant/tables/${id}`)
      toast.success(isRtl ? 'تم حذف الطاولة' : 'Table deleted')
      fetchTables()
    } catch (error) {
      toast.error('Failed to delete table')
    }
  }

  const updateTablePosition = async (id, x, y) => {
    try {
      await api.put(`/restaurant/tables/${id}`, { positionX: x, positionY: y })
    } catch (error) {
      console.error('Failed to update position', error)
    }
  }

  const filteredTables = tables.filter(t => {
    const matchesSearch = !searchQuery || 
      t.tableNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'available': return 'bg-emerald-500 shadow-emerald-500/50'
      case 'occupied': return 'bg-rose-500 shadow-rose-500/50'
      case 'reserved': return 'bg-amber-500 shadow-amber-500/50'
      default: return 'bg-gray-500 shadow-gray-500/50'
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-700">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <UtensilsCrossed className="w-7 h-7 text-amber-600" />
            {isRtl ? 'إدارة الطاولات' : 'Tables Management'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? 'تحكم في طاولات المطعم وحالاتها ومخطط الجلوس بكل بساطة' : 'Manage restaurant tables, live availability, and seating layout effortlessly'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-dark-900 p-1 rounded-2xl border border-gray-200 dark:border-dark-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isRtl ? 'شبكة الطاولات' : 'Grid'}</span>
            </button>
            <button
              onClick={() => setViewMode('floorplan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'floorplan'
                  ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>{isRtl ? 'مخطط الصالة' : 'Floor Plan'}</span>
            </button>
          </div>

          {tables.length === 0 && !loading && (
            <button
              onClick={seedTables}
              disabled={isSeeding}
              className="btn bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-dark-700 dark:hover:bg-dark-600 dark:text-gray-300 rounded-2xl px-4 py-2.5 text-xs font-bold"
            >
              {isSeeding ? '...' : (isRtl ? 'إضافة طاولات افتراضية' : 'Seed Default')}
            </button>
          )}

          {viewMode === 'floorplan' && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`btn rounded-2xl px-4 py-2.5 text-xs flex items-center gap-2 font-bold transition-all ${
                editMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-dark-700 dark:hover:bg-dark-600 dark:text-gray-300'
              }`}
            >
              {editMode ? <Save className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
              {editMode ? (isRtl ? 'حفظ التخطيط' : 'Save Layout') : (isRtl ? 'تعديل التخطيط' : 'Edit Layout')}
            </button>
          )}

          <button
            onClick={() => handleOpenModal()}
            className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white rounded-2xl px-5 py-2.5 text-xs flex items-center gap-2 font-bold shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            {isRtl ? 'إضافة طاولة' : 'Add Table'}
          </button>
        </div>
      </div>

      {/* Ultra-Minimalistic Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{isRtl ? 'إجمالي الطاولات' : 'Total Tables'}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{stats.total}</p>
          </div>
          <div className="p-2.5 bg-gray-100 dark:bg-dark-700 rounded-xl text-gray-600 dark:text-gray-300">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-950/40 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{isRtl ? 'متاحة' : 'Available'}</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.available}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-rose-100 dark:border-rose-950/40 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{isRtl ? 'مشغولة' : 'Occupied'}</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{stats.occupied}</p>
          </div>
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-blue-100 dark:border-blue-950/40 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{isRtl ? 'محجوزة' : 'Reserved'}</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{stats.reserved}</p>
          </div>
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-dark-800 p-3 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute top-2.5 left-3 rtl:left-auto rtl:right-3 text-gray-400" />
          <input
            type="text"
            placeholder={isRtl ? 'بحث عن طاولة...' : 'Search table...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl py-2 pl-9 pr-4 rtl:pl-4 rtl:pr-9 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          {[
            { id: 'all', label: isRtl ? 'الكل' : 'All', count: stats.total },
            { id: 'available', label: isRtl ? 'متاحة' : 'Available', count: stats.available, color: 'text-emerald-600' },
            { id: 'occupied', label: isRtl ? 'مشغولة' : 'Occupied', count: stats.occupied, color: 'text-rose-600' },
            { id: 'reserved', label: isRtl ? 'محجوزة' : 'Reserved', count: stats.reserved, color: 'text-blue-600' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] opacity-90 ${statusFilter === tab.id ? 'text-white' : tab.color || ''}`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'grid' ? (
        /* Ultra-Minimalistic Table Grid Cards */
        loading ? (
          <div className="text-center py-20 text-gray-400 font-bold">{isRtl ? 'جاري تحميل الطاولات...' : 'Loading tables...'}</div>
        ) : filteredTables.length === 0 ? (
          <div className="bg-white dark:bg-dark-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-dark-700">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-dark-600" />
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">{isRtl ? 'لا توجد طاولات' : 'No Tables Found'}</h3>
            <p className="text-xs text-gray-400 mt-1">{isRtl ? 'أضف طاولات جديدة أو استخدم التهيئة الافتراضية' : 'Add new tables or seed default tables'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filteredTables.map(table => {
              return (
                <div
                  key={table._id}
                  className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-gray-900 dark:text-white">
                          T{table.tableNumber}
                        </span>
                        <span className="text-[10px] font-semibold bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                          {table.shape || 'rect'}
                        </span>
                      </div>
                      {table.name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5 max-w-[120px]">
                          {table.name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(table)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                        title={isRtl ? 'تعديل' : 'Edit'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(table._id)}
                        className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title={isRtl ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Capacity */}
                  <div className="my-3 flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{table.seats || 4} {isRtl ? 'مقاعد' : 'Seats'}</span>
                  </div>

                  {/* Card Footer: 1-Click Status Pill Switcher */}
                  <div className="pt-3 border-t border-gray-100 dark:border-dark-700/60">
                    <div className="flex bg-gray-50 dark:bg-dark-900 p-0.5 rounded-xl gap-0.5">
                      {[
                        { id: 'available', label: isRtl ? 'متاحة' : 'Free', dot: 'bg-emerald-500' },
                        { id: 'occupied', label: isRtl ? 'مشغولة' : 'Busy', dot: 'bg-rose-500' },
                        { id: 'reserved', label: isRtl ? 'حجز' : 'Res', dot: 'bg-blue-500' },
                      ].map(st => {
                        const isCurrent = table.status === st.id
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleStatusChange(table._id, st.id)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                              isCurrent
                                ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-xs'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${isCurrent ? 'ring-2 ring-current/20' : 'opacity-40'}`} />
                            <span>{st.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Floor Plan View */
        <div 
          className="relative w-full h-[650px] bg-gray-100 dark:bg-dark-900 rounded-3xl overflow-hidden border-4 border-gray-200 dark:border-dark-800 shadow-inner"
          style={{
            backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
          ref={containerRef}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-bold text-lg">Loading floor plan...</div>
          ) : (
            filteredTables.map(table => (
              <motion.div
                key={table._id}
                drag={editMode}
                dragConstraints={containerRef}
                dragElastic={0}
                dragMomentum={false}
                onDragEnd={(e, info) => {
                  const x = Math.max(0, (table.positionX || 0) + info.offset.x)
                  const y = Math.max(0, (table.positionY || 0) + info.offset.y)
                  updateTablePosition(table._id, x, y)
                  setTables(tables.map(t => t._id === table._id ? { ...t, positionX: x, positionY: y } : t))
                }}
                initial={{ x: table.positionX || 0, y: table.positionY || 0 }}
                animate={{ x: table.positionX || 0, y: table.positionY || 0 }}
                style={{
                  width: table.width || 120,
                  height: table.height || 80,
                  position: 'absolute'
                }}
                className={`absolute cursor-${editMode ? 'grab active:cursor-grabbing' : 'pointer'} flex items-center justify-center group`}
              >
                {/* 3D Table Visual */}
                <div 
                  className={`relative w-full h-full flex flex-col items-center justify-center
                    ${table.shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}
                    bg-gradient-to-b from-[#3a2c20] to-[#251b12] shadow-xl border border-[#4a3a2d]
                    transition-transform ${!editMode && 'hover:scale-[1.02]'}
                  `}
                  style={{
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {/* Wood texture overlay */}
                  <div 
                    className={`absolute inset-0 opacity-20 pointer-events-none ${table.shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, #000 0px, #000 2px, transparent 2px, transparent 8px)'
                    }}
                  />

                  {/* Status Indicator */}
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getStatusColor(table.status)}`} />

                  {/* Content */}
                  <span className="relative z-10 text-white font-black text-2xl drop-shadow-md">
                    {table.tableNumber}
                  </span>
                  
                  {/* Edit Controls (Only visible in edit mode) */}
                  {editMode && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-dark-800 p-1.5 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(table); }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-600 dark:text-gray-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(table._id); }}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 dark:border-dark-700"
          >
            <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex justify-between items-center bg-gray-50/50 dark:bg-dark-900/50">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                {editingId 
                  ? (isRtl ? 'تعديل الطاولة' : 'Edit Table') 
                  : (isRtl ? 'إضافة طاولة جديدة' : 'Add New Table')}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-amber-500" />
                    {isRtl ? 'رقم الطاولة *' : 'Table Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.tableNumber}
                    onChange={(e) => setFormData({...formData, tableNumber: e.target.value})}
                    className="w-full input border-gray-200 dark:border-dark-700 focus:border-amber-500 rounded-xl text-sm"
                    placeholder="e.g. 1, 2, VIP"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-gray-400" />
                    {isRtl ? 'اسم الطاولة (اختياري)' : 'Table Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full input border-gray-200 dark:border-dark-700 focus:border-amber-500 rounded-xl text-sm"
                    placeholder="e.g. Window 1, Family Booth"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    {isRtl ? 'عدد المقاعد' : 'Seats'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.seats}
                    onChange={(e) => setFormData({...formData, seats: parseInt(e.target.value) || 1})}
                    className="w-full input border-gray-200 dark:border-dark-700 focus:border-amber-500 rounded-xl text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'الحالة' : 'Status'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full input border-gray-200 dark:border-dark-700 focus:border-amber-500 rounded-xl text-sm font-semibold"
                  >
                    <option value="available">{isRtl ? 'متاحة' : 'Available'}</option>
                    <option value="occupied">{isRtl ? 'مشغولة' : 'Occupied'}</option>
                    <option value="reserved">{isRtl ? 'محجوزة' : 'Reserved'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  {isRtl ? 'شكل الطاولة' : 'Table Shape'}
                </label>
                <div className="flex gap-2">
                  {['rectangle', 'circle', 'square'].map(shp => (
                    <button
                      key={shp}
                      type="button"
                      onClick={() => setFormData({...formData, shape: shp})}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        formData.shape === shp
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                          : 'border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {shp === 'rectangle' ? (isRtl ? 'مستطيل' : 'Rectangle') :
                       shp === 'circle' ? (isRtl ? 'دائري' : 'Circle') :
                       (isRtl ? 'مربع' : 'Square')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 btn btn-secondary rounded-xl py-2.5 text-xs font-bold"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn btn-primary bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-2.5 text-xs font-bold border-none disabled:opacity-50"
                >
                  {isSubmitting ? '...' : (isRtl ? 'حفظ الطاولة' : 'Save Table')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

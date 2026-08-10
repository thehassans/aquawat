import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Plus, Search, Edit2, Trash2, PackageOpen, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import { showArabicFields } from '../../lib/saudiTenant'

export default function RestaurantInventory() {
  const { language } = useSelector(state => state.ui)
  const { tenant } = useSelector(state => state.auth)
  const isRtl = language === 'ar'
  const bilingualAr = showArabicFields(tenant)

  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form Modal
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    category: '',
    unit: 'kg',
    quantity: 0,
    minimumStock: 0,
    costPerUnit: 0
  })
  const [editingId, setEditingId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/restaurant/inventory')
      setInventory(data || [])
    } catch (error) {
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = inventory.filter(i => 
    i.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.nameAr?.includes(searchQuery) ||
    i.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleOpenModal = (item = null) => {
    if (item) {
      setFormData({
        nameEn: item.nameEn,
        nameAr: item.nameAr || '',
        category: item.category || '',
        unit: item.unit || 'kg',
        quantity: item.quantity || 0,
        minimumStock: item.minimumStock || 0,
        costPerUnit: item.costPerUnit || 0
      })
      setEditingId(item._id)
    } else {
      setFormData({ 
        nameEn: '', nameAr: '', category: '', unit: 'kg', 
        quantity: 0, minimumStock: 0, costPerUnit: 0 
      })
      setEditingId(null)
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      if (editingId) {
        await api.put(`/restaurant/inventory/${editingId}`, formData)
        toast.success(isRtl ? 'تم تحديث العنصر' : 'Item updated')
      } else {
        await api.post('/restaurant/inventory', formData)
        toast.success(isRtl ? 'تمت إضافة العنصر' : 'Item added')
      }
      setShowModal(false)
      fetchInventory()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد؟' : 'Are you sure?')) return
    try {
      await api.delete(`/restaurant/inventory/${id}`)
      toast.success(isRtl ? 'تم الحذف' : 'Item deleted')
      fetchInventory()
    } catch (error) {
      toast.error('Failed to delete item')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <PackageOpen className="w-8 h-8 text-amber-600" />
            {isRtl ? 'إدارة المخزون' : 'Inventory Management'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? 'إدارة المواد الخام وتتبع الكميات' : 'Manage raw materials and track quantities'}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-6 py-2.5 flex items-center gap-2 font-bold shadow-md shadow-amber-500/20"
        >
          <Plus className="w-5 h-5" />
          {isRtl ? 'إضافة عنصر' : 'Add Item'}
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-4' : 'left-4'}`} />
          <input
            type="text"
            placeholder={isRtl ? "البحث في المخزون..." : "Search inventory..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-gray-50 dark:bg-dark-900 border-none rounded-xl py-3 focus:ring-2 focus:ring-amber-500 ${isRtl ? 'pr-12' : 'pl-12'}`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-dark-900/50 border-b border-gray-100 dark:border-dark-700">
                <th className={`p-4 font-semibold text-gray-500 dark:text-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'الاسم' : 'Name'}
                </th>
                <th className={`p-4 font-semibold text-gray-500 dark:text-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'الفئة' : 'Category'}
                </th>
                <th className={`p-4 font-semibold text-gray-500 dark:text-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'الكمية' : 'Quantity'}
                </th>
                <th className={`p-4 font-semibold text-gray-500 dark:text-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'التكلفة' : 'Cost'}
                </th>
                <th className={`p-4 font-semibold text-gray-500 dark:text-gray-400 text-center w-24`}>
                  {isRtl ? 'إجراءات' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center p-8 text-gray-500">Loading...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8 text-gray-500">
                    {isRtl ? 'لا توجد عناصر.' : 'No items found.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isLowStock = item.quantity <= item.minimumStock
                  return (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={item._id} 
                      className="border-b border-gray-50 dark:border-dark-700/50 hover:bg-gray-50/50 dark:hover:bg-dark-700/50 transition-colors"
                    >
                      <td className={`p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {isRtl ? (item.nameAr || item.nameEn) : item.nameEn}
                        </div>
                        {isLowStock && (
                          <div className="flex items-center gap-1 text-xs text-rose-500 font-semibold mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            {isRtl ? 'انخفاض المخزون' : 'Low Stock'}
                          </div>
                        )}
                      </td>
                      <td className={`p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {item.category || '-'}
                        </span>
                      </td>
                      <td className={`p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {item.quantity} <span className="text-gray-500 font-medium text-sm">{item.unit}</span>
                        </div>
                      </td>
                      <td className={`p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          <Money value={item.costPerUnit} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleOpenModal(item)}
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item._id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-8"
          >
            <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex justify-between items-center bg-gray-50/50 dark:bg-dark-900/50">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId 
                  ? (isRtl ? 'تعديل العنصر' : 'Edit Item') 
                  : (isRtl ? 'إضافة عنصر جديد' : 'Add New Item')}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className={`grid gap-4 ${bilingualAr ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isRtl ? 'الاسم (EN) *' : 'Name (EN) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nameEn}
                    onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                    className="w-full input border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                  />
                </div>
                {bilingualAr && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      {isRtl ? 'الاسم (AR)' : 'Name (AR)'}
                    </label>
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => setFormData({...formData, nameAr: e.target.value})}
                      className="w-full input border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isRtl ? 'الفئة' : 'Category'}
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full input border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                    placeholder="e.g. Meat, Vegetables"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isRtl ? 'الوحدة *' : 'Unit *'}
                  </label>
                  <select
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="w-full input border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                  >
                    <option value="kg">KG</option>
                    <option value="gram">Gram</option>
                    <option value="liter">Liter</option>
                    <option value="ml">ML</option>
                    <option value="piece">Piece</option>
                    <option value="box">Box</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isRtl ? 'الكمية' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full input border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 whitespace-nowrap">
                    {isRtl ? 'الحد الأدنى' : 'Min Stock'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minimumStock}
                    onChange={(e) => setFormData({...formData, minimumStock: parseFloat(e.target.value) || 0})}
                    className="w-full input border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isRtl ? 'التكلفة' : 'Cost'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData({...formData, costPerUnit: parseFloat(e.target.value) || 0})}
                    className="w-full input border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl text-center"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 btn btn-secondary rounded-xl py-3"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn btn-primary bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-3 border-none disabled:opacity-50"
                >
                  {isSubmitting ? '...' : (isRtl ? 'حفظ' : 'Save Item')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Loader2, Tag, Trash2, Edit3, Clock,
  TrendingDown, Gift, Calendar, Percent,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

const COMBO_TYPES = [
  { value: 'combo', label: 'Combo Meal', icon: Tag },
  { value: 'happy_hour', label: 'Happy Hour', icon: Clock },
  { value: 'bogo', label: 'Buy One Get One', icon: Gift },
  { value: 'family_package', label: 'Family Package', icon: Tag },
  { value: 'seasonal', label: 'Seasonal', icon: Calendar },
  { value: 'early_bird', label: 'Early Bird', icon: Clock },
]

const TYPE_CONFIG = {
  combo: { label: 'Combo', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  happy_hour: { label: 'Happy Hour', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  bogo: { label: 'BOGO', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  family_package: { label: 'Family', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  seasonal: { label: 'Seasonal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  early_bird: { label: 'Early Bird', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
}

function ComboModal({ menuItems, onClose, editCombo }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: editCombo?.name || '',
    nameAr: editCombo?.nameAr || '',
    description: editCombo?.description || '',
    type: editCombo?.type || 'combo',
    comboPrice: editCombo?.comboPrice || 0,
    isTimeLimited: editCombo?.isTimeLimited || false,
    startDate: editCombo?.startDate?.split('T')[0] || '',
    endDate: editCombo?.endDate?.split('T')[0] || '',
    maxPerDay: editCombo?.maxPerDay || 0,
    totalQuantityLimit: editCombo?.totalQuantityLimit || 0,
    badgeText: editCombo?.badgeText || '',
    items: editCombo?.items?.map(i => ({ menuItemId: i.menuItemId?._id || i.menuItemId, name: i.name, nameAr: i.nameAr, quantity: i.quantity, unitPrice: i.unitPrice, isOptional: i.isOptional })) || [],
  })

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { menuItemId: '', name: '', quantity: 1, isOptional: false }] }))
  
  const calculateNewTotal = (itemsList) => {
    return itemsList.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 1), 0)
  }

  const removeItem = (idx) => setForm(f => {
    const newItems = f.items.filter((_, i) => i !== idx)
    return { ...f, items: newItems, comboPrice: calculateNewTotal(newItems) }
  })

  const updateItem = (idx, patch) => setForm(f => {
    const newItems = f.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
    return { ...f, items: newItems, comboPrice: calculateNewTotal(newItems) }
  })

  const onMenuSelect = (idx, menuItemId) => {
    const m = menuItems.find(x => String(x._id) === String(menuItemId))
    if (m) updateItem(idx, { menuItemId: m._id, name: m.nameEn, nameAr: m.nameAr, unitPrice: m.sellingPrice })
    else updateItem(idx, { menuItemId })
  }

  const mutation = useMutation({
    mutationFn: (data) => editCombo
      ? api.put(`/restaurant/combos/${editCombo._id}`, data)
      : api.post('/restaurant/combos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-combos'] })
      toast.success(editCombo ? 'Combo updated' : 'Combo created')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const handleSubmit = () => {
    if (!form.name) return toast.error('Name required')
    if (form.items.length === 0) return toast.error('At least one item required')
    mutation.mutate({
      ...form,
      comboPrice: Number(form.comboPrice) || 0,
      maxPerDay: Number(form.maxPerDay) || 0,
      totalQuantityLimit: Number(form.totalQuantityLimit) || 0,
    })
  }

  const computedOriginal = form.items.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 1), 0)
  const savings = Math.max(0, computedOriginal - (Number(form.comboPrice) || 0))

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700 sticky top-0 bg-white dark:bg-dark-800 z-10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{editCombo ? 'Edit Combo/Deal' : 'New Combo/Deal'}</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g., Lunch Combo" />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" dir="rtl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="select">
                  {COMBO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Combo Price (SAR) *</label>
                <input type="number" step="0.01" min="0" value={form.comboPrice} onChange={(e) => setForm({ ...form, comboPrice: e.target.value })} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={2} />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Items</label>
                <button type="button" onClick={addItem} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add Item</button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
                    <select value={item.menuItemId} onChange={(e) => onMenuSelect(idx, e.target.value)} className="select flex-1 text-sm">
                      <option value="">Select item...</option>
                      {menuItems.map(m => <option key={m._id} value={m._id}>{m.nameEn}</option>)}
                    </select>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} className="input w-16 text-sm" placeholder="Qty" />
                    <span className="text-xs text-gray-400 w-16 text-right">{item.unitPrice || 0} SAR</span>
                    <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {form.items.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No items added</p>}
              </div>
              {computedOriginal > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Original total: {computedOriginal.toFixed(2)} SAR</span>
                  <span className="text-emerald-600 dark:text-emerald-400">Savings: {savings.toFixed(2)} SAR ({computedOriginal > 0 ? Math.round((savings / computedOriginal) * 100) : 0}%)</span>
                </div>
              )}
            </div>

            {/* Time-limited */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isTimeLimited} onChange={(e) => setForm({ ...form, isTimeLimited: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Time-limited (Happy Hour, Early Bird, etc.)</span>
            </label>

            {/* Date range for seasonal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Max Per Day (0=unlimited)</label>
                <input type="number" min="0" value={form.maxPerDay} onChange={(e) => setForm({ ...form, maxPerDay: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Total Limit (0=unlimited)</label>
                <input type="number" min="0" value={form.totalQuantityLimit} onChange={(e) => setForm({ ...form, totalQuantityLimit: e.target.value })} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Badge Text</label>
              <input value={form.badgeText} onChange={(e) => setForm({ ...form, badgeText: e.target.value })} className="input" placeholder="e.g., Save 20%" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-dark-700 sticky bottom-0 bg-white dark:bg-dark-800">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={mutation.isPending} className="btn btn-action-dark flex items-center gap-1.5">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editCombo ? 'Update' : 'Create'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function RestaurantCombos() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editCombo, setEditCombo] = useState(null)
  const [filterType, setFilterType] = useState('')
  
  const hasCombosAddon = tenant?.subscription?.hasCombosAddon;

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-combos', filterType],
    queryFn: () => api.get('/restaurant/combos', { params: { isActive: 'all', type: filterType || undefined, limit: 100 } }).then(res => res.data),
  })

  const { data: menuItems = [] } = useQuery({
    queryKey: ['restaurant-menu-items-lookup'],
    queryFn: () => api.get('/restaurant/menu-items', { params: { page: 1, limit: 200 } }).then(res => res.data.items || []),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/restaurant/combos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-combos'] })
      toast.success('Combo deactivated')
    },
  })

  const combos = data?.combos || []

  if (!hasCombosAddon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-gradient-to-b from-gray-50 to-white dark:from-dark-900 dark:to-dark-800 rounded-3xl border border-gray-100 dark:border-dark-700 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative w-24 h-24 mb-6 rounded-full bg-white dark:bg-dark-800 shadow-2xl flex items-center justify-center border border-gray-100 dark:border-dark-600">
           <div className="absolute inset-0 rounded-full border-2 border-pink-500 border-dashed animate-[spin_10s_linear_infinite] opacity-20" />
           <Gift className="w-10 h-10 text-pink-500" />
        </div>
        
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
          {language === 'ar' ? 'إضافة العروض والباقات' : 'Combos & Deals Add-on'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
          {language === 'ar'
            ? 'أنشئ وجبات مجمعة، وعروض وقت سعيد، وباقات عائلية لزيادة المبيعات وجذب المزيد من العملاء.' 
            : 'Create combo meals, happy hours, BOGOs, and family packages to boost sales and attract more customers.'}
        </p>
        
        <a href="mailto:support@maqder.com" className="btn btn-primary bg-pink-600 hover:bg-pink-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-pink-500/30 flex items-center gap-2 transition-all hover:scale-105">
           <Tag className="w-5 h-5" />
           {language === 'ar' ? 'تواصل معنا للتفعيل' : 'Contact Sales to Enable'}
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'العروض والباقات' : 'Combos & Deals'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة الوجبات المجمعة والعروض' : 'Manage combo meals and promotional deals'}
          </p>
        </div>
        <button onClick={() => { setEditCombo(null); setShowModal(true) }} className="btn btn-action-dark flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> {language === 'ar' ? 'عرض جديد' : 'New Deal'}
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilterType('')} className={`px-3 py-1.5 rounded-lg text-sm ${!filterType ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 dark:bg-dark-700 text-gray-500'}`}>All</button>
        {COMBO_TYPES.map(t => (
          <button key={t.value} onClick={() => setFilterType(t.value)} className={`px-3 py-1.5 rounded-lg text-sm ${filterType === t.value ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 dark:bg-dark-700 text-gray-500'}`}>{t.label}</button>
        ))}
      </div>

      {/* Combos Grid */}
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : combos.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No combos or deals yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {combos.map(c => {
            const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.combo
            return (
              <motion.div key={c._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                      {c.nameAr && <p className="text-xs text-gray-400" dir="rtl">{c.nameAr}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>

                  {c.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{c.description}</p>}

                  {/* Items */}
                  <div className="space-y-1 mb-3">
                    {c.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{item.quantity}x {item.name}</span>
                        <span className="text-gray-400">{item.unitPrice || 0} SAR</span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing */}
                  <div className="flex items-end justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900 dark:text-white"><Money value={c.comboPrice} /></span>
                        {c.originalTotal > c.comboPrice && <span className="text-xs text-gray-400 line-through">{c.originalTotal.toFixed(2)}</span>}
                      </div>
                      {c.discountPercent > 0 && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" /> Save {c.discountPercent}%
                        </span>
                      )}
                    </div>
                    {c.badgeText && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-medium">{c.badgeText}</span>}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    {c.isTimeLimited && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Time-limited</span>}
                    {c.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(c.startDate).toLocaleDateString()}</span>}
                    {c.usedCount > 0 && <span>Used: {c.usedCount}</span>}
                    {!c.isActive && <span className="text-red-500">Inactive</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                    <button onClick={() => { setEditCombo(c); setShowModal(true) }} className="btn btn-secondary btn-sm flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => { if (confirm('Deactivate this combo?')) deleteMutation.mutate(c._id) }} className="text-xs text-red-500 hover:underline flex items-center gap-1 ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Deactivate
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {showModal && <ComboModal menuItems={menuItems} onClose={() => { setShowModal(false); setEditCombo(null) }} editCombo={editCombo} />}
    </div>
  )
}

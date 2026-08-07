import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { getSocket } from '../../lib/socket'
import {
  Loader2, Flame, CheckCircle, Clock, AlertTriangle,
  UtensilsCrossed, Settings, X, Plus, Trash2,
  ChevronRight, Volume2, VolumeX, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const URGENCY_CONFIG = {
  normal: { border: 'border-l-blue-500', bg: 'bg-white dark:bg-dark-800', text: 'text-blue-600', timer: 'text-blue-600' },
  warning: { border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-600', timer: 'text-amber-600' },
  critical: { border: 'border-l-red-500', bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-600', timer: 'text-red-600 animate-pulse' },
  ready: { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-600', timer: 'text-emerald-600' },
}

const STATION_COLORS = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  pink: 'bg-pink-500',
}

function StationModal({ onClose, editStation }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: editStation?.name || '',
    nameAr: editStation?.nameAr || '',
    color: editStation?.color || 'blue',
    categories: editStation?.categories?.join(', ') || '',
    prepTargetMinutes: editStation?.prepTargetMinutes || 15,
    prepWarningMinutes: editStation?.prepWarningMinutes || 10,
    prepCriticalMinutes: editStation?.prepCriticalMinutes || 20,
  })

  const mutation = useMutation({
    mutationFn: (data) => editStation
      ? api.put(`/restaurant/kds/stations/${editStation._id}`, data)
      : api.post('/restaurant/kds/stations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] })
      toast.success(editStation ? 'Station updated' : 'Station created')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const handleSubmit = () => {
    if (!form.name) return toast.error('Name required')
    mutation.mutate({
      ...form,
      categories: form.categories.split(',').map(c => c.trim()).filter(Boolean),
      prepTargetMinutes: Number(form.prepTargetMinutes) || 15,
      prepWarningMinutes: Number(form.prepWarningMinutes) || 10,
      prepCriticalMinutes: Number(form.prepCriticalMinutes) || 20,
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">{editStation ? 'Edit Station' : 'New Station'}</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g., Grill Station" />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" dir="rtl" />
              </div>
            </div>
            <div>
              <label className="label">Color</label>
              <div className="flex gap-2">
                {Object.entries(STATION_COLORS).map(([color, cls]) => (
                  <button key={color} onClick={() => setForm({ ...form, color })} className={`w-8 h-8 rounded-lg ${cls} ${form.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} />
                ))}
              </div>
            </div>
            <div>
              <label className="label">Categories (comma-separated)</label>
              <input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} className="input" placeholder="Arabic, Indian, Continental" />
              <p className="text-xs text-gray-400 mt-1">Menu items in these categories will route to this station</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Warning (min)</label>
                <input type="number" min="1" value={form.prepWarningMinutes} onChange={(e) => setForm({ ...form, prepWarningMinutes: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Target (min)</label>
                <input type="number" min="1" value={form.prepTargetMinutes} onChange={(e) => setForm({ ...form, prepTargetMinutes: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Critical (min)</label>
                <input type="number" min="1" value={form.prepCriticalMinutes} onChange={(e) => setForm({ ...form, prepCriticalMinutes: e.target.value })} className="input" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-dark-700">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={mutation.isPending} className="btn btn-action-dark flex items-center gap-1.5">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editStation ? 'Update' : 'Create'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function OrderCard({ order, onStatusChange, isRtl }) {
  const cfg = URGENCY_CONFIG[order.urgency] || URGENCY_CONFIG.normal
  const typeDisplay = {
    dine_in: isRtl ? 'محلي' : 'Dine In',
    takeaway: isRtl ? 'سفري' : 'Takeaway',
    delivery: isRtl ? 'توصيل' : 'Delivery',
  }[order.orderType] || order.orderType

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`rounded-xl shadow-sm border-l-4 ${cfg.border} ${cfg.bg} border-y border-r border-gray-200 dark:border-dark-700 overflow-hidden`}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div>
          <span className="font-bold text-sm text-gray-900 dark:text-white">{order.orderNumber}</span>
          {order.tableNumber && <span className="text-xs text-gray-500 ml-2">· {isRtl ? 'طاولة' : 'Table'} {order.tableNumber}</span>}
        </div>
        <div className={`text-sm font-mono font-bold ${cfg.timer}`}>{order.elapsedDisplay}</div>
      </div>

      {/* Meta */}
      <div className="px-3 pb-1 flex items-center gap-2 text-xs text-gray-400">
        <span className="capitalize">{typeDisplay}</span>
        {order.customerName && <span>· {order.customerName}</span>}
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-1">
        {order.lineItems?.map((li, i) => (
          <div key={i} className="flex items-start justify-between text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold text-gray-900 dark:text-white">{li.quantity}x</span>
              <div>
                <span className="text-gray-700 dark:text-gray-300">{isRtl ? li.nameAr || li.name : li.name}</span>
                {li.category && <span className="text-[10px] text-gray-400 ml-1">({li.category})</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && typeof order.notes === 'string' && (
        <div className="px-3 pb-2 text-xs text-amber-600 dark:text-amber-400 italic">
          {order.notes}
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-dark-700 flex items-center gap-1.5">
        {order.kitchenStatus === 'new' && (
          <button
            onClick={() => onStatusChange(order._id, 'preparing')}
            className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-1"
          >
            <Flame className="w-3.5 h-3.5" /> {isRtl ? 'تحضير' : 'Start'}
          </button>
        )}
        {order.kitchenStatus === 'preparing' && (
          <button
            onClick={() => onStatusChange(order._id, 'ready')}
            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" /> {isRtl ? 'جاهز' : 'Ready'}
          </button>
        )}
        {order.kitchenStatus === 'ready' && (
          <button
            onClick={() => onStatusChange(order._id, 'served')}
            className="flex-1 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" /> {isRtl ? 'تم التقديم' : 'Bump'}
          </button>
        )}
        {order.kitchenStatus !== 'ready' && order.kitchenStatus !== 'served' && (
          <button
            onClick={() => onStatusChange(order._id, 'ready')}
            className="px-2 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium flex items-center gap-1"
            title="Mark ready"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function RestaurantKDS() {
  const { language } = useSelector((state) => state.ui)
  const queryClient = useQueryClient()
  const isRtl = language === 'ar'
  const [selectedStation, setSelectedStation] = useState('')
  const [showStationModal, setShowStationModal] = useState(false)
  const [editStation, setEditStation] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('kdsSound') !== 'false')
  const [lastNewCount, setLastNewCount] = useState(0)
  const audioRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['kds-board', selectedStation],
    queryFn: () => api.get('/restaurant/kds/board', { params: { stationId: selectedStation || undefined } }).then(res => res.data),
  })

  // Listen to WebSocket for live updates instead of polling
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleUpdate = () => {
      queryClient.invalidateQueries(['kds-board'])
    }

    // Must join the 'kitchen' room to get KDS updates
    socket.emit('join_room', 'kitchen')
    socket.on('new_order', handleUpdate)
    socket.on('order_updated', handleUpdate)

    return () => {
      socket.off('new_order', handleUpdate)
      socket.off('order_updated', handleUpdate)
      socket.emit('leave_room', 'kitchen')
    }
  }, [queryClient])

  const { data: stations = [] } = useQuery({
    queryKey: ['kds-stations'],
    queryFn: () => api.get('/restaurant/kds/stations').then(res => res.data),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, kitchenStatus }) => api.put(`/restaurant/kds/orders/${id}/status`, { kitchenStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-board'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const bumpAllMutation = useMutation({
    mutationFn: () => api.put('/restaurant/kds/orders/bump-all-ready'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-board'] })
      toast.success('All ready orders bumped')
    },
  })

  const deleteStationMutation = useMutation({
    mutationFn: (id) => api.delete(`/restaurant/kds/stations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] })
      toast.success('Station removed')
    },
  })

  // Sound alert for new orders
  useEffect(() => {
    const newCount = data?.summary?.new || 0
    if (soundEnabled && newCount > lastNewCount && lastNewCount !== 0) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 800
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.5)
      } catch {}
    }
    setLastNewCount(newCount)
  }, [data?.summary?.new, soundEnabled])

  useEffect(() => {
    localStorage.setItem('kdsSound', soundEnabled)
  }, [soundEnabled])

  const board = data?.board || { new: [], preparing: [], ready: [] }
  const summary = data?.summary || {}

  const columns = [
    { key: 'new', label: isRtl ? 'جديد' : 'New', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10', orders: board.new || [] },
    { key: 'preparing', label: isRtl ? 'قيد التحضير' : 'Preparing', icon: Flame, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10', orders: board.preparing || [] },
    { key: 'ready', label: isRtl ? 'جاهز' : 'Ready', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10', orders: board.ready || [] },
  ]

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isRtl ? 'نظام عرض المطبخ' : 'Kitchen Display System'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isRtl ? 'لوحة التحضير الرقمية' : 'Digital order preparation board'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`btn btn-secondary btn-sm ${soundEnabled ? 'text-blue-600' : 'text-gray-400'}`}
            title={soundEnabled ? 'Sound on' : 'Sound off'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {/* Bump all ready */}
          {(board.ready || []).length > 0 && (
            <button
              onClick={() => bumpAllMutation.mutate()}
              disabled={bumpAllMutation.isPending}
              className="btn btn-secondary btn-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border-transparent"
            >
              <CheckCircle className="w-4 h-4" />
              {isRtl ? 'إنهاء الكل' : `Bump All (${(board.ready || []).length})`}
            </button>
          )}
          {/* Station settings */}
          <button
            onClick={() => { setEditStation(null); setShowStationModal(true) }}
            className="btn btn-secondary btn-sm"
          >
            <Settings className="w-4 h-4" />
            {isRtl ? 'المحطات' : 'Stations'}
          </button>
        </div>
      </div>

      {/* Station Filters + Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setSelectedStation('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!selectedStation ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 dark:bg-dark-700 text-gray-500'}`}
        >
          {isRtl ? 'الكل' : 'All Stations'}
        </button>
        {stations.map(s => (
          <button
            key={s._id}
            onClick={() => setSelectedStation(s._id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${selectedStation === s._id ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 dark:bg-dark-700 text-gray-500'}`}
          >
            <span className={`w-2 h-2 rounded-full ${STATION_COLORS[s.color] || 'bg-gray-400'}`} />
            {isRtl ? s.nameAr || s.name : s.name}
            <span className="text-xs opacity-60" onClick={(e) => { e.stopPropagation(); setEditStation(s); setShowStationModal(true) }}>
              <Settings className="w-3 h-3" />
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-gray-500">{isRtl ? 'الإجمالي' : 'Total'}: <strong className="text-gray-900 dark:text-white">{summary.total || 0}</strong></span>
          {summary.critical > 0 && (
            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {summary.critical} {isRtl ? 'حرج' : 'critical'}
            </span>
          )}
          <span className="text-gray-500">{isRtl ? 'متوسط الانتظار' : 'Avg wait'}: <strong className="text-gray-900 dark:text-white">{summary.avgWaitTime || 0}m</strong></span>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
          {columns.map(col => (
            <div key={col.key} className={`rounded-xl ${col.bg} border border-gray-200 dark:border-dark-700 flex flex-col`}>
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <col.icon className={`w-4 h-4 ${col.color}`} />
                  <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${col.color} bg-white dark:bg-dark-800`}>
                  {col.orders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                <AnimatePresence>
                  {col.orders.map(order => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onStatusChange={(id, status) => statusMutation.mutate({ id, kitchenStatus: status })}
                      isRtl={isRtl}
                    />
                  ))}
                </AnimatePresence>
                {col.orders.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    {isRtl ? 'لا توجد طلبات' : 'No orders'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Station list with delete for admin */}
      {stations.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{isRtl ? 'إدارة المحطات' : 'Station Management'}</h3>
          <div className="flex flex-wrap gap-2">
            {stations.map(s => (
              <div key={s._id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-dark-700 rounded-lg">
                <span className={`w-2 h-2 rounded-full ${STATION_COLORS[s.color] || 'bg-gray-400'}`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
                <span className="text-xs text-gray-400">({s.categories?.length || 0} categories)</span>
                <button onClick={() => { setEditStation(s); setShowStationModal(true) }} className="p-1 text-gray-400 hover:text-gray-600"><Settings className="w-3 h-3" /></button>
                <button onClick={() => { if (confirm('Remove this station?')) deleteStationMutation.mutate(s._id) }} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showStationModal && <StationModal onClose={() => { setShowStationModal(false); setEditStation(null) }} editStation={editStation} />}
    </div>
  )
}

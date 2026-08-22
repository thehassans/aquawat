import { useMemo, useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { getSocket } from '../../lib/socket'
import {
  ClipboardList,
  RefreshCw,
  Receipt,
  CheckCircle,
  Clock,
  Printer,
  X,
  Plus,
  Trash2,
  Settings,
  LayoutGrid,
  LayoutList,
  Volume2,
  VolumeX,
  Flame,
  AlertTriangle,
  Zap,
  Loader2,
  Utensils,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getImageUrl } from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import { getThermalPrinterSettings, getPaperWidth } from '../../lib/thermalPrinter'

function formatTime(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

function printHtml(html) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) return

  doc.open()
  doc.write(html)
  doc.close()

  const win = iframe.contentWindow
  if (!win) return

  win.focus()
  win.print()

  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 500)
}

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
    mutationFn: (data) =>
      editStation
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
      categories: form.categories.split(',').map((c) => c.trim()).filter(Boolean),
      prepTargetMinutes: Number(form.prepTargetMinutes) || 15,
      prepWarningMinutes: Number(form.prepWarningMinutes) || 10,
      prepCriticalMinutes: Number(form.prepCriticalMinutes) || 20,
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {editStation ? 'Edit Station' : 'New Station'}
            </h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Grill Station"
                />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  className="input"
                  dir="rtl"
                />
              </div>
            </div>
            <div>
              <label className="label">Color</label>
              <div className="flex gap-2">
                {Object.entries(STATION_COLORS).map(([color, cls]) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-lg ${cls} ${
                      form.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="label">Categories (comma-separated)</label>
              <input
                value={form.categories}
                onChange={(e) => setForm({ ...form, categories: e.target.value })}
                className="input"
                placeholder="Arabic, Indian, Continental"
              />
              <p className="text-xs text-gray-400 mt-1">Menu items in these categories will route to this station</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Warning (min)</label>
                <input
                  type="number"
                  min="1"
                  value={form.prepWarningMinutes}
                  onChange={(e) => setForm({ ...form, prepWarningMinutes: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Target (min)</label>
                <input
                  type="number"
                  min="1"
                  value={form.prepTargetMinutes}
                  onChange={(e) => setForm({ ...form, prepTargetMinutes: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Critical (min)</label>
                <input
                  type="number"
                  min="1"
                  value={form.prepCriticalMinutes}
                  onChange={(e) => setForm({ ...form, prepCriticalMinutes: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-dark-700">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="btn btn-primary flex items-center gap-1.5"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editStation ? 'Update' : 'Create'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function KdsOrderCard({ order, onStatusChange, onPrintKitchenTicket, isRtl }) {
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
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 dark:border-dark-700/60">
        <div>
          <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{order.orderNumber}</span>
          {order.tableNumber && (
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 ml-2 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
              {isRtl ? 'طاولة' : 'Table'} {order.tableNumber}
            </span>
          )}
        </div>
        <div className={`text-sm font-mono font-bold ${cfg.timer}`}>{order.elapsedDisplay}</div>
      </div>

      {/* Meta */}
      <div className="px-3 py-1 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50 dark:bg-dark-900/40">
        <span className="capitalize font-medium">{typeDisplay}</span>
        {order.customerName && <span>{order.customerName}</span>}
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-1.5">
        {order.lineItems?.map((li, i) => (
          <div key={i} className="flex items-start justify-between text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold text-gray-900 dark:text-white bg-slate-100 dark:bg-dark-700 px-1.5 py-0.5 rounded text-xs">
                {li.quantity}x
              </span>
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {isRtl ? li.nameAr || li.name : li.name}
                </span>
                {li.category && <span className="text-[10px] text-gray-400 ml-1">({li.category})</span>}
                {li.notes && <p className="text-xs text-amber-600 dark:text-amber-400 italic">📌 {li.notes}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Order Notes */}
      {order.notes && typeof order.notes === 'string' && (
        <div className="px-3 pb-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2 mx-2 rounded mb-2 font-medium">
          ⚠️ {order.notes}
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-dark-700 flex items-center gap-1.5 bg-gray-50/30 dark:bg-dark-900/20">
        <button
          type="button"
          onClick={() => onPrintKitchenTicket(order)}
          className="p-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
          title={isRtl ? 'طباعة إيصال المطبخ' : 'Print Kitchen Receipt'}
        >
          <Printer className="w-4 h-4 text-amber-600" />
        </button>

        {order.kitchenStatus === 'new' && (
          <button
            onClick={() => onStatusChange(order._id, 'preparing')}
            className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
          >
            <Flame className="w-3.5 h-3.5" /> {isRtl ? 'تحضير' : 'Start Prep'}
          </button>
        )}

        {order.kitchenStatus === 'preparing' && (
          <button
            onClick={() => onStatusChange(order._id, 'ready')}
            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" /> {isRtl ? 'جاهز' : 'Mark Ready'}
          </button>
        )}

        {order.kitchenStatus === 'ready' && (
          <button
            onClick={() => onStatusChange(order._id, 'served')}
            className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" /> {isRtl ? 'تم التقديم' : 'Served / Bump'}
          </button>
        )}

        {order.kitchenStatus !== 'ready' && order.kitchenStatus !== 'served' && (
          <button
            onClick={() => onStatusChange(order._id, 'ready')}
            className="px-2 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1"
            title="Fast mark ready"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function RestaurantKitchen({ defaultView = 'table' }) {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isRtl = language === 'ar'

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('kitchenViewMode') || defaultView)
  const [statuses, setStatuses] = useState(['new', 'preparing', 'ready'])
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('kitchenAutoPrint') === 'true')
  const [printingIds, setPrintingIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const firstLoadDoneRef = useRef(false)
  const seenOrderIdsRef = useRef(new Set())

  // KDS Board specific state
  const [selectedStation, setSelectedStation] = useState('')
  const [showStationModal, setShowStationModal] = useState(false)
  const [editStation, setEditStation] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('kdsSound') !== 'false')
  const [lastNewCount, setLastNewCount] = useState(0)

  // Query table orders
  const { data: tableData, isLoading: isTableLoading, refetch: refetchTable, isFetching: isTableFetching } = useQuery({
    queryKey: ['restaurant-kitchen', statuses],
    queryFn: () =>
      api
        .get('/restaurant/orders/kitchen', { params: { statuses: statuses.join(',') } })
        .then((res) => res.data),
  })

  // Query KDS board
  const { data: kdsData, isLoading: isKdsLoading, refetch: refetchKds, isFetching: isKdsFetching } = useQuery({
    queryKey: ['kds-board', selectedStation],
    queryFn: () =>
      api
        .get('/restaurant/kds/board', { params: { stationId: selectedStation || undefined } })
        .then((res) => res.data),
  })

  // Query stations
  const { data: stations = [] } = useQuery({
    queryKey: ['kds-stations'],
    queryFn: () => api.get('/restaurant/kds/stations').then((res) => res.data),
  })

  // WebSocket live updates for both views
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleUpdate = () => {
      queryClient.invalidateQueries(['restaurant-kitchen'])
      queryClient.invalidateQueries(['kds-board'])
    }

    socket.emit('join_room', 'kitchen')
    socket.on('new_order', handleUpdate)
    socket.on('order_updated', handleUpdate)

    return () => {
      socket.off('new_order', handleUpdate)
      socket.off('order_updated', handleUpdate)
      socket.emit('leave_room', 'kitchen')
    }
  }, [queryClient])

  const orders = tableData?.orders || []

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, kitchenStatus }) =>
      api.put(`/restaurant/orders/${id}/kitchen-status`, { kitchenStatus }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurant-kitchen'])
      queryClient.invalidateQueries(['kds-board'])
      queryClient.invalidateQueries(['restaurant-orders'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const markPrintedMutation = useMutation({
    mutationFn: (id) => api.post(`/restaurant/orders/${id}/kitchen-ticket/printed`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurant-kitchen'])
      queryClient.invalidateQueries(['kds-board'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const bumpAllMutation = useMutation({
    mutationFn: () => api.put('/restaurant/kds/orders/bump-all-ready'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-board'] })
      queryClient.invalidateQueries({ queryKey: ['restaurant-kitchen'] })
      toast.success(isRtl ? 'تم إنهاء جميع الطلبات الجاهزة' : 'All ready orders bumped')
    },
  })

  const deleteStationMutation = useMutation({
    mutationFn: (id) => api.delete(`/restaurant/kds/stations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] })
      toast.success(isRtl ? 'تم حذف المحطة' : 'Station removed')
    },
  })

  useEffect(() => {
    localStorage.setItem('kitchenAutoPrint', autoPrint)
  }, [autoPrint])

  useEffect(() => {
    localStorage.setItem('kitchenViewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('kdsSound', soundEnabled)
  }, [soundEnabled])

  // Sound chime for new incoming orders
  useEffect(() => {
    const newCount = kdsData?.summary?.new || orders.filter((o) => o.kitchenStatus === 'new').length || 0
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
  }, [kdsData?.summary?.new, orders, soundEnabled, lastNewCount])

  // Auto-print logic for newly incoming orders
  useEffect(() => {
    if (!isTableLoading && !firstLoadDoneRef.current) {
      firstLoadDoneRef.current = true
      orders.forEach((o) => seenOrderIdsRef.current.add(o._id))
    }
  }, [isTableLoading, orders])

  useEffect(() => {
    if (!autoPrint) return
    const unprinted = orders.filter(
      (o) =>
        o.kitchenStatus === 'new' &&
        !o.kitchenPrintedAt &&
        !printingIds.has(o._id) &&
        !seenOrderIdsRef.current.has(o._id)
    )
    if (unprinted.length > 0) {
      unprinted.forEach((o) => {
        seenOrderIdsRef.current.add(o._id)
        setPrintingIds((prev) => new Set([...prev, o._id]))
        try {
          printHtml(buildKitchenTicketHtml(o))
          markPrintedMutation.mutate(o._id, {
            onSettled: () => {
              setPrintingIds((prev) => {
                const next = new Set(prev)
                next.delete(o._id)
                return next
              })
            },
          })
        } catch (err) {
          console.error('Auto print error', err)
          setPrintingIds((prev) => {
            const next = new Set(prev)
            next.delete(o._id)
            return next
          })
        }
      })
    }
  }, [orders, autoPrint, printingIds])

  const statusOptions = useMemo(
    () => [
      { key: 'new', labelEn: 'New', labelAr: 'جديد' },
      { key: 'preparing', labelEn: 'Preparing', labelAr: 'قيد التحضير' },
      { key: 'ready', labelEn: 'Ready', labelAr: 'جاهز' },
      { key: 'served', labelEn: 'Served', labelAr: 'تم التقديم' },
    ],
    []
  )

  const buildKitchenTicketHtml = (order) => {
    const isAr = language === 'ar'

    const items = (order?.lineItems || [])
      .map((li) => {
        const name = isAr ? li?.nameAr || li?.name : li?.name
        const notes = li?.notes ? `<div style="font-size:12px;color:#d97706;margin-top:2px;">📌 ${li.notes}</div>` : ''
        return `<tr>
          <td style="padding:8px 0;border-bottom:1px dashed #bbb;">
            <div style="font-size:16px;font-weight:bold;">${String(name || '')}</div>
            ${notes}
          </td>
          <td style="padding:8px 0;text-align:end;border-bottom:1px dashed #bbb;font-size:18px;font-weight:900;">
            ${Number(li?.quantity || 0)}
          </td>
        </tr>`
      })
      .join('')

    const title = isAr ? 'إيصال المطبخ' : 'KITCHEN RECEIPT'
    const tableLabel = isAr ? 'الطاولة' : 'Table'
    const orderLabel = isAr ? 'رقم الطلب' : 'Order #'
    const timeLabel = isAr ? 'الوقت' : 'Time'
    const typeLabel = isAr ? 'نوع الطلب' : 'Order Type'
    const customerLabel = isAr ? 'العميل' : 'Customer'

    const typeDisplay = {
      dine_in: isAr ? 'محلي (صالة)' : 'DINE IN',
      takeaway: isAr ? 'سفري' : 'TAKEAWAY',
      delivery: isAr ? 'توصيل' : 'DELIVERY',
    }[order?.orderType] || order?.orderType?.toUpperCase()

    const logoSrc = getImageUrl(tenant?.branding?.logoUrl || '')
    const _thermal = getThermalPrinterSettings(tenant)
    const _pw = getPaperWidth(_thermal)

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
@media print {
  @page { margin: 0; size: ${_pw} auto; }
  body { width: ${_pw}; margin: 0 auto; padding: 10px; }
}
body{font-family:'Courier New', Courier, monospace, Arial, sans-serif; margin:0; padding:12px; max-width:${_pw}; margin: 0 auto;}
.header{text-align:center; margin-bottom:10px; border-bottom:2px solid #000; padding-bottom:8px;}
.logo{max-width:70px; max-height:70px; margin-bottom:6px; filter:grayscale(100%);}
.k{font-size:20px; font-weight:900; letter-spacing:1px;}
.order-box{border:2px solid #000; padding:8px; text-align:center; margin:10px 0; border-radius:4px;}
.order-num{font-size:26px; font-weight:900; margin:2px 0;}
.order-label{font-size:12px; font-weight:bold; text-transform:uppercase;}
.meta{font-size:13px; color:#000; margin-bottom:10px;}
.meta-row{display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted #ccc;}
table{width:100%; border-collapse:collapse; margin-top:8px;}
th{font-size:14px; text-align:start; border-bottom:2px solid #000; padding-bottom:6px; font-weight:900;}
.notes-box{border:1px dashed #d97706; background:#fffbeb; padding:6px; margin:10px 0; font-size:13px; font-weight:bold;}
.footer{text-align:center; margin-top:14px; font-size:11px; border-top:1px dashed #000; padding-top:6px;}
</style>
</head>
<body dir="${isAr ? 'rtl' : 'ltr'}">
  <div class="header">
    ${logoSrc ? `<img src="${logoSrc}" class="logo" />` : ''}
    <div class="k">${title}</div>
  </div>
  
  <div class="order-box">
    <div class="order-label">${orderLabel}</div>
    <div class="order-num">${order?.orderNumber || ''}</div>
  </div>

  <div class="meta">
    <div class="meta-row">
      <strong>${typeLabel}:</strong>
      <span style="font-weight:900;">${typeDisplay}</span>
    </div>
    ${
      order?.orderType === 'dine_in'
        ? `<div class="meta-row">
            <strong>${tableLabel}:</strong>
            <span style="font-weight:900;font-size:16px;">${order?.tableNumber || '-'}</span>
          </div>`
        : ''
    }
    <div class="meta-row">
      <strong>${timeLabel}:</strong>
      <span>${formatTime(order?.createdAt)}</span>
    </div>
    ${
      order?.customerName
        ? `<div class="meta-row">
            <strong>${customerLabel}:</strong>
            <span>${order?.customerName} ${order?.customerPhone ? '(' + order?.customerPhone + ')' : ''}</span>
          </div>`
        : ''
    }
  </div>

  ${order?.notes ? `<div class="notes-box">⚠️ ${order.notes}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>${isAr ? 'الصنف والملاحظات' : 'ITEM & NOTES'}</th>
        <th style="text-align:end;">${isAr ? 'الكمية' : 'QTY'}</th>
      </tr>
    </thead>
    <tbody>
      ${items}
    </tbody>
  </table>

  <div class="footer">
    *** ${isAr ? 'نهاية تذكرة المطبخ' : 'END OF KITCHEN TICKET'} ***
  </div>

  <script>window.onafterprint = () => window.close && window.close();</script>
</body>
</html>`
  }

  const buildReceiptHtml = (order) => {
    const isAr = language === 'ar'

    const items = (order?.lineItems || [])
      .map((li) => {
        const name = isAr ? li?.nameAr || li?.name : li?.name
        const qty = Number(li?.quantity || 0)
        const unitPrice = Number(li?.unitPrice || 0)
        const total = qty * unitPrice
        return `<tr><td style="padding:6px 0;">${String(name || '')}</td><td style="padding:6px 0;text-align:end;">${qty}</td><td style="padding:6px 0;text-align:end;">${unitPrice.toFixed(2)}</td><td style="padding:6px 0;text-align:end;">${total.toFixed(2)}</td></tr>`
      })
      .join('')

    const title = isAr ? 'إيصال العميل' : 'Customer Receipt'
    const logoSrc = tenant?.branding?.logoUrl || ''
    const _thermal2 = getThermalPrinterSettings(tenant)
    const _pw2 = getPaperWidth(_thermal2)

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
@media print {
  @page { margin: 0; size: ${_pw2} auto; }
  body { width: ${_pw2}; margin: 0 auto; padding: 10px; }
}
body{font-family:Arial, sans-serif; margin:0; padding:14px; max-width:${_pw2}; margin: 0 auto;}
.header{text-align:center; margin-bottom:12px;}
.logo{max-width:80px; max-height:80px; margin-bottom:8px; filter:grayscale(100%);}
.k{font-size:18px; font-weight:700;}
.meta{font-size:12px; color:#111;}
table{width:100%; border-collapse:collapse; margin-top:12px;}
th{font-size:12px; text-align:start; border-bottom:1px solid #ddd; padding-bottom:6px;}
.tot{margin-top:10px; display:flex; justify-content:flex-end;}
.tot div{width:220px; font-size:12px;}
.row{display:flex; justify-content:space-between; padding:4px 0;}
.bold{font-weight:700;}
</style>
</head>
<body dir="${isAr ? 'rtl' : 'ltr'}">
  <div class="header">
    ${logoSrc ? `<img src="${logoSrc}" class="logo" />` : ''}
    <div class="k">${title}</div>
  </div>
  <div class="meta">
    <div>${isAr ? 'الطلب' : 'Order'}: <strong>${order?.orderNumber || ''}</strong></div>
    ${order?.orderType === 'dine_in' ? `<div>${isAr ? 'الطاولة' : 'Table'}: <strong>${order?.tableNumber || '-'}</strong></div>` : ''}
    <div>${isAr ? 'الوقت' : 'Time'}: ${formatTime(order?.createdAt)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${isAr ? 'الصنف' : 'Item'}</th>
        <th style="text-align:end;">${isAr ? 'الكمية' : 'Qty'}</th>
        <th style="text-align:end;">${isAr ? 'السعر' : 'Price'}</th>
        <th style="text-align:end;">${isAr ? 'الإجمالي' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>
      ${items}
    </tbody>
  </table>

  <div class="tot">
    <div>
      <div class="row"><span>${isAr ? 'المجموع' : 'Subtotal'}</span><span>${Number(order?.subtotal || 0).toFixed(2)}</span></div>
      <div class="row"><span>${isAr ? 'الضريبة' : 'Tax'}</span><span>${Number(order?.totalTax || 0).toFixed(2)}</span></div>
      <div class="row bold"><span>${isAr ? 'الإجمالي' : 'Total'}</span><span>${Number(order?.grandTotal || 0).toFixed(2)}</span></div>
    </div>
  </div>

  <script>window.onafterprint = () => window.close && window.close();</script>
</body>
</html>`
  }

  const statusLabel = (s) => {
    const found = statusOptions.find((x) => x.key === s)
    if (!found) return s || '-'
    return language === 'ar' ? found.labelAr : found.labelEn
  }

  const filteredTableOrders = useMemo(() => {
    if (!searchQuery) return orders
    const q = searchQuery.toLowerCase()
    return orders.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.tableNumber?.toLowerCase().includes(q) ||
        o.lineItems?.some((li) => li.name?.toLowerCase().includes(q) || li.nameAr?.includes(q))
    )
  }, [orders, searchQuery])

  const kdsBoard = kdsData?.board || { new: [], preparing: [], ready: [] }
  const kdsSummary = kdsData?.summary || {}

  const kdsColumns = [
    {
      key: 'new',
      label: isRtl ? 'طلبات جديدة' : 'New Orders',
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50/70 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40',
      orders: kdsBoard.new || [],
    },
    {
      key: 'preparing',
      label: isRtl ? 'قيد التحضير' : 'In Preparation',
      icon: Flame,
      color: 'text-amber-600',
      bg: 'bg-amber-50/70 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40',
      orders: kdsBoard.preparing || [],
    },
    {
      key: 'ready',
      label: isRtl ? 'جاهز للتسليم' : 'Ready to Serve',
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/70 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40',
      orders: kdsBoard.ready || [],
    },
  ]

  const isRefreshing = isTableFetching || isKdsFetching

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-dark-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                {isRtl ? 'شاشة المطبخ ونظام KDS' : 'Kitchen Screen & KDS Board'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isRtl
                  ? 'إدارة تجهيز طلبات المطبخ، وتوجيه المحطات، وطباعة الفواتير الحرارية'
                  : 'Real-time order preparation, station routing, and kitchen receipt printing'}
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Switcher Tab */}
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-dark-900 p-1 border border-gray-200 dark:border-dark-700">
            <button
              type="button"
              onClick={() => setViewMode('kds')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kds'
                  ? 'bg-white dark:bg-dark-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isRtl ? 'شاشة KDS' : 'KDS Board'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-dark-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>{isRtl ? 'جدول الطلبات' : 'Orders Table'}</span>
            </button>
          </div>

          {/* Sound Alert Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`btn btn-secondary btn-sm p-2 rounded-xl ${
              soundEnabled ? 'text-amber-600 border-amber-200' : 'text-gray-400'
            }`}
            title={soundEnabled ? (isRtl ? 'تنبيهات صوتية مفعلة' : 'Sound Alerts On') : isRtl ? 'كتم الصوت' : 'Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Auto Print Toggle */}
          <button
            type="button"
            onClick={() => setAutoPrint(!autoPrint)}
            className={`btn btn-sm rounded-xl font-bold flex items-center gap-1.5 ${
              autoPrint
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : 'btn-secondary text-gray-600 dark:text-gray-300'
            }`}
            title={isRtl ? 'طباعة تلقائية للطلبات الجديدة' : 'Auto print incoming orders'}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{isRtl ? 'طباعة تلقائية' : 'Auto Print'}</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => {
              refetchTable()
              refetchKds()
            }}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ─── KDS KANBAN BOARD VIEW ─────────────────────────────────────────────── */}
      {/* ========================================================================= */}
      {viewMode === 'kds' && (
        <div className="space-y-4">
          {/* Station Filters + Quick Actions */}
          <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedStation('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  !selectedStation
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {isRtl ? 'كافة المحطات' : 'All Stations'}
              </button>
              {stations.map((s) => (
                <button
                  key={s._id}
                  onClick={() => setSelectedStation(s._id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                    selectedStation === s._id
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${STATION_COLORS[s.color] || 'bg-gray-400'}`} />
                  {isRtl ? s.nameAr || s.name : s.name}
                  <span
                    className="opacity-70 hover:opacity-100 ml-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditStation(s)
                      setShowStationModal(true)
                    }}
                  >
                    <Settings className="w-3 h-3" />
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setEditStation(null)
                  setShowStationModal(true)
                }}
                className="btn btn-secondary btn-sm text-xs rounded-xl flex items-center gap-1 ml-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRtl ? 'محطة جديدة' : 'Add Station'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500 font-medium">
                {isRtl ? 'إجمالي الطلبات' : 'Total'}:{' '}
                <strong className="text-gray-900 dark:text-white">{kdsSummary.total || 0}</strong>
              </span>
              {kdsSummary.critical > 0 && (
                <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md">
                  <AlertTriangle className="w-3.5 h-3.5 animate-pulse" /> {kdsSummary.critical}{' '}
                  {isRtl ? 'متأخر' : 'critical'}
                </span>
              )}
              <span className="text-gray-500 font-medium">
                {isRtl ? 'متوسط الانتظار' : 'Avg wait'}:{' '}
                <strong className="text-gray-900 dark:text-white">{kdsSummary.avgWaitTime || 0}m</strong>
              </span>

              {(kdsBoard.ready || []).length > 0 && (
                <button
                  onClick={() => bumpAllMutation.mutate()}
                  disabled={bumpAllMutation.isPending}
                  className="btn btn-secondary btn-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 text-xs rounded-xl font-bold"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {isRtl ? 'إنهاء الكل' : `Bump All Ready (${(kdsBoard.ready || []).length})`}
                </button>
              )}
            </div>
          </div>

          {/* Kanban Columns */}
          {isKdsLoading ? (
            <div className="flex justify-center p-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[480px]">
              {kdsColumns.map((col) => (
                <div
                  key={col.key}
                  className={`rounded-2xl ${col.bg} border flex flex-col p-3 shadow-sm`}
                >
                  {/* Column Header */}
                  <div className="px-2 py-2 flex items-center justify-between border-b border-gray-200/80 dark:border-dark-700 mb-3">
                    <div className="flex items-center gap-2">
                      <col.icon className={`w-4 h-4 ${col.color}`} />
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{col.label}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black ${col.color} bg-white dark:bg-dark-800 shadow-sm`}
                    >
                      {col.orders.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                    <AnimatePresence>
                      {col.orders.map((order) => (
                        <KdsOrderCard
                          key={order._id}
                          order={order}
                          onStatusChange={(id, status) =>
                            updateStatusMutation.mutate({ id, kitchenStatus: status })
                          }
                          onPrintKitchenTicket={(o) => {
                            try {
                              printHtml(buildKitchenTicketHtml(o))
                              markPrintedMutation.mutate(o._id)
                            } catch {
                              toast.error(isRtl ? 'فشل الطباعة' : 'Print failed')
                            }
                          }}
                          isRtl={isRtl}
                        />
                      ))}
                    </AnimatePresence>
                    {col.orders.length === 0 && (
                      <div className="text-center py-16 text-gray-400 text-xs font-medium">
                        {isRtl ? 'لا توجد طلبات في هذه الحالة' : 'No orders in this queue'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ─── ORDERS TABLE VIEW ─────────────────────────────────────────────────── */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Status Filters & Search */}
          <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-gray-500">{isRtl ? 'الحالات:' : 'Statuses:'}</span>
              {['new', 'preparing', 'ready', 'served'].map((s) => {
                const active = statuses.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatuses((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : prev.concat(s)
                      )
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      active
                        ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                        : 'bg-white dark:bg-dark-850 border-gray-200 dark:border-dark-650 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {statusLabel(s)}
                  </button>
                )
              })}
            </div>

            <div className="relative w-full md:w-72">
              <Search
                className={`absolute top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 ${
                  isRtl ? 'right-3' : 'left-3'
                }`}
              />
              <input
                type="text"
                placeholder={isRtl ? 'بحث برقم الطلب، الطاولة، العميل...' : 'Search order, table, customer...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl py-2 text-xs focus:ring-2 focus:ring-amber-500 ${
                  isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>
          </div>

          {/* Table Container */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden"
          >
            {isTableLoading ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 text-amber-600 animate-spin inline-block" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-dark-900/60 border-b border-gray-100 dark:border-dark-700">
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'رقم الطلب' : 'Order #'}
                      </th>
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'النوع / العميل' : 'Type / Customer'}
                      </th>
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'الطاولة' : 'Table'}
                      </th>
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'الأصناف' : 'Items'}
                      </th>
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'الوقت' : 'Time'}
                      </th>
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'الحالة' : 'Status'}
                      </th>
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'المجموع' : 'Total'}
                      </th>
                      <th className={`p-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-center`}>
                        {isRtl ? 'الإجراءات والطباعة' : 'Actions & Printing'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                    {filteredTableOrders.map((o) => (
                      <tr key={o._id} className="hover:bg-gray-50/60 dark:hover:bg-dark-750 transition">
                        <td className="p-4 font-mono font-bold text-sm text-gray-900 dark:text-white">
                          {o.orderNumber}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-sm capitalize text-gray-900 dark:text-white">
                            {o.orderType === 'dine_in'
                              ? isRtl
                                ? 'محلي'
                                : 'Dine In'
                              : o.orderType === 'takeaway'
                              ? isRtl
                                ? 'سفري'
                                : 'Takeaway'
                              : isRtl
                              ? 'توصيل'
                              : 'Delivery'}
                          </div>
                          {o.customerName && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {o.customerName} {o.customerPhone ? `(${o.customerPhone})` : ''}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {o.orderType === 'dine_in' && o.tableNumber ? (
                            <span className="font-bold text-xs px-2 py-1 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-700">
                              {isRtl ? 'طاولة' : 'Table'} {o.tableNumber}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-xs space-y-0.5 max-w-xs">
                            {(o.lineItems || []).map((li, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                <span className="font-bold text-amber-700 dark:text-amber-400">{li.quantity}x</span>
                                <span className="truncate">{isRtl ? li.nameAr || li.name : li.name}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-xs font-mono text-gray-500">{formatTime(o.createdAt)}</td>
                        <td className="p-4">
                          <span
                            className={`badge inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg ${
                              o.kitchenStatus === 'ready'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : o.kitchenStatus === 'preparing'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                : o.kitchenStatus === 'served'
                                ? 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-300'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}
                          >
                            {o.kitchenStatus === 'ready' ? (
                              <CheckCircle className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            {statusLabel(o.kitchenStatus)}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-sm text-gray-900 dark:text-white">
                          <Money value={o.grandTotal || 0} />
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {/* Prominent Print Kitchen Receipt Button */}
                            <button
                              type="button"
                              className="btn btn-sm flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm px-3 py-1.5"
                              onClick={() => {
                                try {
                                  printHtml(buildKitchenTicketHtml(o))
                                  markPrintedMutation.mutate(o._id)
                                } catch {
                                  toast.error(isRtl ? 'فشل الطباعة' : 'Print failed')
                                }
                              }}
                              title={isRtl ? 'طباعة إيصال المطبخ' : 'Print Kitchen Receipt'}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{isRtl ? 'إيصال المطبخ' : 'Kitchen Receipt'}</span>
                            </button>

                            {/* Customer Receipt Button */}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm flex items-center gap-1 text-xs rounded-xl px-2.5 py-1.5"
                              onClick={() => {
                                try {
                                  printHtml(buildReceiptHtml(o))
                                } catch {
                                  toast.error(isRtl ? 'فشل الطباعة' : 'Print failed')
                                }
                              }}
                              title={isRtl ? 'إيصال العميل' : 'Customer Receipt'}
                            >
                              <Receipt className="w-3.5 h-3.5 text-gray-500" />
                              <span>{isRtl ? 'إيصال' : 'Bill'}</span>
                            </button>

                            {/* Status transitions */}
                            {o.kitchenStatus === 'new' && (
                              <button
                                type="button"
                                className="btn btn-sm flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl font-bold px-2.5 py-1.5"
                                onClick={() =>
                                  updateStatusMutation.mutate({ id: o._id, kitchenStatus: 'preparing' })
                                }
                                disabled={updateStatusMutation.isPending}
                              >
                                <Flame className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'تحضير' : 'Start'}</span>
                              </button>
                            )}

                            {o.kitchenStatus === 'preparing' && (
                              <button
                                type="button"
                                className="btn btn-sm flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-bold px-2.5 py-1.5"
                                onClick={() =>
                                  updateStatusMutation.mutate({ id: o._id, kitchenStatus: 'ready' })
                                }
                                disabled={updateStatusMutation.isPending}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'جاهز' : 'Ready'}</span>
                              </button>
                            )}

                            {o.kitchenStatus === 'ready' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm flex items-center gap-1 text-xs rounded-xl font-bold px-2.5 py-1.5 text-gray-700 dark:text-gray-300"
                                onClick={() =>
                                  updateStatusMutation.mutate({ id: o._id, kitchenStatus: 'served' })
                                }
                                disabled={updateStatusMutation.isPending}
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{isRtl ? 'تم التقديم' : 'Bump'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredTableOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-gray-400 text-sm font-medium">
                          {isRtl ? 'لا توجد طلبات مطبخ مطابقة' : 'No kitchen orders found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {showStationModal && (
        <StationModal
          onClose={() => {
            setShowStationModal(false)
            setEditStation(null)
          }}
          editStation={editStation}
        />
      )}
    </div>
  )
}

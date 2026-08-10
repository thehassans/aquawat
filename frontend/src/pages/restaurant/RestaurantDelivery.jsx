import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Loader2, Bike, Store, CheckCircle, XCircle,
  Clock, Package, DollarSign, TrendingUp, RefreshCw,
  Settings, Zap, AlertTriangle, ExternalLink, Truck,
  MapPin, Phone, User, ChevronRight, Activity,
  Wallet, Receipt, ArrowUpRight, ArrowDownRight,
  Sparkles, Eye, Timer, Navigation2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import PlatformLogo from '../../components/delivery/PlatformLogo'

const PLATFORMS = [
  { id: 'jahez', name: 'Jahez', gradient: 'from-orange-400 to-orange-600', ring: 'ring-orange-500/20', text: 'text-orange-600', bg: 'bg-orange-500', bgSoft: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-900/50', url: 'jahez.net' },
  { id: 'hungerstation', name: 'HungerStation', gradient: 'from-pink-400 to-pink-600', ring: 'ring-pink-500/20', text: 'text-pink-600', bg: 'bg-pink-500', bgSoft: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-900/50', url: 'hungerstation.com' },
  { id: 'ninja', name: 'Ninja', gradient: 'from-violet-400 to-violet-600', ring: 'ring-violet-500/20', text: 'text-violet-600', bg: 'bg-violet-500', bgSoft: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-900/50', url: 'ninja.com.sa' },
  { id: 'keeta', name: 'Keeta', gradient: 'from-emerald-400 to-emerald-600', ring: 'ring-emerald-500/20', text: 'text-emerald-600', bg: 'bg-emerald-500', bgSoft: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900/50', url: 'keeta.com' },
  { id: 'mrsool', name: 'Mrsool', gradient: 'from-blue-400 to-blue-600', ring: 'ring-blue-500/20', text: 'text-blue-600', bg: 'bg-blue-500', bgSoft: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900/50', url: 'mrsool.com' },
  { id: 'jumlaty', name: 'Jumlaty', gradient: 'from-amber-400 to-amber-600', ring: 'ring-amber-500/20', text: 'text-amber-600', bg: 'bg-amber-500', bgSoft: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900/50', url: 'jumlaty.com' },
  { id: 'direct', name: 'Direct Delivery', gradient: 'from-gray-400 to-gray-600', ring: 'ring-gray-500/20', text: 'text-gray-600', bg: 'bg-gray-500', bgSoft: 'bg-gray-50 dark:bg-gray-950/30', border: 'border-gray-200 dark:border-gray-900/50', url: 'in-house' },
]

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, gradient: 'from-amber-400 to-orange-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-800', glow: 'shadow-amber-500/20' },
  accepted: { label: 'Accepted', icon: CheckCircle, gradient: 'from-blue-400 to-blue-600', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800', glow: 'shadow-blue-500/20' },
  preparing: { label: 'Preparing', icon: Package, gradient: 'from-violet-400 to-purple-600', text: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-300 dark:border-violet-800', glow: 'shadow-violet-500/20' },
  ready: { label: 'Ready', icon: CheckCircle, gradient: 'from-cyan-400 to-teal-500', text: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-300 dark:border-cyan-800', glow: 'shadow-cyan-500/20' },
  picked_up: { label: 'On the Way', icon: Truck, gradient: 'from-indigo-400 to-indigo-600', text: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-300 dark:border-indigo-800', glow: 'shadow-indigo-500/20' },
  delivered: { label: 'Delivered', icon: CheckCircle, gradient: 'from-emerald-400 to-green-600', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300 dark:border-emerald-800', glow: 'shadow-emerald-500/20' },
  cancelled: { label: 'Cancelled', icon: XCircle, gradient: 'from-red-400 to-red-600', text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', glow: 'shadow-red-500/20' },
  rejected: { label: 'Rejected', icon: XCircle, gradient: 'from-red-400 to-rose-600', text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', glow: 'shadow-red-500/20' },
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'platforms', label: 'Platforms', icon: Store },
  { id: 'payouts', label: 'Payouts', icon: Wallet },
]

function StatCard({ icon: Icon, label, value, gradient, delay = 0, trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
      className="relative group"
    >
      <div className="relative bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-5 rounded-full -translate-y-8 translate-x-8`} />
        <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg mb-3`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="flex items-end justify-between mt-1">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <span className={`text-xs font-medium flex items-center gap-0.5 ${trend.up ? 'text-emerald-500' : 'text-red-400'}`}>
              {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      <cfg.icon className="w-3 h-3" /> {cfg.label}
    </span>
  )
}

function PlatformModal({ onClose, editConfig }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    platform: editConfig?.platform || 'jahez',
    displayName: editConfig?.displayName || '',
    credentials: {
      apiKey: editConfig?.credentials?.apiKey || '',
      apiSecret: editConfig?.credentials?.apiSecret || '',
      merchantId: editConfig?.credentials?.merchantId || '',
      branchId: editConfig?.credentials?.branchId || '',
      webhookSecret: editConfig?.credentials?.webhookSecret || '',
    },
    autoAcceptOrders: editConfig?.autoAcceptOrders || false,
    autoSyncMenu: editConfig?.autoSyncMenu || false,
    commissionPercent: editConfig?.commissionPercent || 0,
    commissionFixed: editConfig?.commissionFixed || 0,
    deliveryFeeChargedTo: editConfig?.deliveryFeeChargedTo || 'customer',
  })

  const mutation = useMutation({
    mutationFn: (data) => editConfig
      ? api.put(`/restaurant/delivery/platforms/${editConfig._id}`, data)
      : api.post('/restaurant/delivery/platforms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-platforms'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-dashboard'] })
      toast.success(editConfig ? 'Platform updated' : 'Platform connected')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const handleSubmit = () => {
    mutation.mutate({
      ...form,
      commissionPercent: Number(form.commissionPercent) || 0,
      commissionFixed: Number(form.commissionFixed) || 0,
    })
  }

  const selectedPlatform = PLATFORMS.find(p => p.id === form.platform)

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
          <div className={`relative px-6 py-5 bg-gradient-to-br ${selectedPlatform?.gradient} overflow-hidden`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlatformLogo platform={form.platform} className="w-12 h-12" />
                <div>
                  <h3 className="font-bold text-white text-lg">{editConfig ? 'Edit Platform' : 'Connect Platform'}</h3>
                  <p className="text-white/70 text-xs">{selectedPlatform?.name} · {selectedPlatform?.url}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><X className="w-4 h-4 text-white" /></button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {!editConfig && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Select Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => setForm({ ...form, platform: p.id })}
                      className={`p-3 rounded-2xl border-2 text-sm font-medium flex items-center gap-2.5 transition-all ${form.platform === p.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/20' : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'}`}>
                      <PlatformLogo platform={p.id} className="w-7 h-7" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Display Name</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="input" placeholder={`${selectedPlatform?.name} - Main Branch`} />
            </div>

            <div className="space-y-3 p-4 bg-gray-50 dark:bg-dark-700/50 rounded-2xl border border-gray-100 dark:border-dark-600">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> API Credentials
              </p>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">API Key</label>
                <input value={form.credentials.apiKey} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, apiKey: e.target.value } })} className="input text-sm" placeholder="Enter API key" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">API Secret</label>
                <input type="password" value={form.credentials.apiSecret} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, apiSecret: e.target.value } })} className="input text-sm" placeholder="Enter API secret" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Merchant ID</label>
                  <input value={form.credentials.merchantId} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, merchantId: e.target.value } })} className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Branch ID</label>
                  <input value={form.credentials.branchId} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, branchId: e.target.value } })} className="input text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Webhook Secret</label>
                <input value={form.credentials.webhookSecret} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, webhookSecret: e.target.value } })} className="input text-sm" placeholder="For verifying webhooks" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Commission %</label>
                <input type="number" step="0.1" min="0" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Fixed Commission</label>
                <input type="number" step="0.01" min="0" value={form.commissionFixed} onChange={(e) => setForm({ ...form, commissionFixed: e.target.value })} className="input text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Delivery Fee Paid By</label>
              <select value={form.deliveryFeeChargedTo} onChange={(e) => setForm({ ...form, deliveryFeeChargedTo: e.target.value })} className="select text-sm">
                <option value="customer">Customer</option>
                <option value="restaurant">Restaurant</option>
                <option value="split">Split</option>
              </select>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                <input type="checkbox" checked={form.autoAcceptOrders} onChange={(e) => setForm({ ...form, autoAcceptOrders: e.target.checked })} className="w-4 h-4 rounded accent-primary-500" />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-accept incoming orders</span>
                  <p className="text-xs text-gray-400">Automatically accept all new orders from this platform</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                <input type="checkbox" checked={form.autoSyncMenu} onChange={(e) => setForm({ ...form, autoSyncMenu: e.target.checked })} className="w-4 h-4 rounded accent-primary-500" />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-sync menu changes</span>
                  <p className="text-xs text-gray-400">Push menu updates to platform automatically</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-dark-700 sticky bottom-0 bg-white dark:bg-dark-800 rounded-b-3xl">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={mutation.isPending} className="btn btn-action-dark flex items-center gap-1.5">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editConfig ? 'Update' : 'Connect'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function OrderCard({ order, onStatusChange }) {
  const platform = PLATFORMS.find(p => p.id === order.platform) || PLATFORMS[0]
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!order.placedAt) return
    const update = () => {
      const diff = Date.now() - new Date(order.placedAt).getTime()
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsed(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [order.placedAt])

  const isUrgent = order.status === 'pending' && elapsed && parseInt(elapsed.split(':')[0]) >= 5

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden ${isUrgent ? 'ring-2 ring-red-500/40' : ''}`}
    >
      <div className={`h-1 bg-gradient-to-r ${platform.gradient}`} />

      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PlatformLogo platform={order.platform} className="w-8 h-8" />
          <div>
            <p className="font-bold text-sm text-gray-900 dark:text-white">#{order.platformOrderNumber || order.platformOrderId}</p>
            <p className="text-[10px] text-gray-400">{platform.name}</p>
          </div>
        </div>
        <StatusPill status={order.status} />
      </div>

      {order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'rejected' && (
        <div className="px-4 pb-2">
          <div className={`inline-flex items-center gap-1 text-xs font-mono ${isUrgent ? 'text-red-500' : 'text-gray-400'}`}>
            <Timer className="w-3 h-3" /> {elapsed}
            {isUrgent && <span className="ml-1 text-red-500 font-bold animate-pulse">URGENT</span>}
          </div>
        </div>
      )}

      <div className="px-4 py-2 space-y-1.5 border-t border-gray-50 dark:border-dark-700/50">
        {order.customerName && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="p-1 rounded-md bg-gray-100 dark:bg-dark-700"><User className="w-3 h-3" /></div>
            {order.customerName}
          </div>
        )}
        {order.customerPhone && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="p-1 rounded-md bg-gray-100 dark:bg-dark-700"><Phone className="w-3 h-3" /></div>
            {order.customerPhone}
          </div>
        )}
        {order.deliveryAddress?.district && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="p-1 rounded-md bg-gray-100 dark:bg-dark-700"><MapPin className="w-3 h-3" /></div>
            {order.deliveryAddress.district}{order.deliveryAddress.city ? `, ${order.deliveryAddress.city}` : ''}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-50 dark:border-dark-700/50 bg-gray-50/50 dark:bg-dark-900/30">
        {order.items?.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1">
            <span className="text-gray-700 dark:text-gray-300">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold mr-1.5">{item.quantity}</span>
              {item.name}
            </span>
            <span className="text-xs text-gray-400 font-mono">{item.unitPrice?.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-700 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Total</span>
          <span className="font-semibold text-gray-900 dark:text-white"><Money value={order.total} /></span>
        </div>
        {order.commissionAmount > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Commission</span>
            <span className="text-red-400 font-medium">-<Money value={order.commissionAmount} /></span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-dark-700">
          <span className="text-gray-400 font-medium">Net Payout</span>
          <span className="font-bold text-emerald-600"><Money value={order.netPayout} /></span>
        </div>
      </div>

      {order.driver?.name && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-dark-700 flex items-center gap-2 text-xs text-gray-500">
          <div className="p-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30"><Bike className="w-3 h-3 text-indigo-500" /></div>
          <span className="font-medium text-gray-700 dark:text-gray-300">{order.driver.name}</span>
          {order.driver.phone && <span className="text-gray-400">· {order.driver.phone}</span>}
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-700">
        {order.status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={() => onStatusChange(order._id, 'accepted')}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all">
              <CheckCircle className="w-4 h-4" /> Accept
            </button>
            <button onClick={() => onStatusChange(order._id, 'rejected')}
              className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        )}
        {order.status === 'accepted' && (
          <button onClick={() => onStatusChange(order._id, 'preparing')}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all">
            <Package className="w-4 h-4" /> Start Preparing
          </button>
        )}
        {order.status === 'preparing' && (
          <button onClick={() => onStatusChange(order._id, 'ready')}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all">
            <CheckCircle className="w-4 h-4" /> Mark Ready
          </button>
        )}
        {order.status === 'ready' && (
          <button onClick={() => onStatusChange(order._id, 'picked_up')}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all">
            <Truck className="w-4 h-4" /> Picked Up
          </button>
        )}
        {order.status === 'picked_up' && (
          <button onClick={() => onStatusChange(order._id, 'delivered')}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all">
            <CheckCircle className="w-4 h-4" /> Delivered
          </button>
        )}
        {(order.status === 'delivered' || order.status === 'cancelled' || order.status === 'rejected') && (
          <div className="text-center text-xs text-gray-400 py-1">Order {order.status}</div>
        )}
      </div>
    </motion.div>
  )
}

function PlatformCard({ platform, config, onConnect, onEdit, onTest, onSync, onDisconnect, testLoading, syncLoading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl bg-white dark:bg-dark-800 border ${platform.border} shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${platform.gradient} opacity-5 rounded-full -translate-y-12 translate-x-12 group-hover:opacity-10 transition-opacity`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform.id} className="w-12 h-12" />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{platform.name}</h3>
              <a href={`https://${platform.url}`} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:underline flex items-center gap-1">
                {platform.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          {config?.isConnected ? (
            <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-400 dark:bg-dark-700 dark:text-gray-500 border border-gray-200 dark:border-dark-600 font-medium">
              Not Connected
            </span>
          )}
        </div>

        {config ? (
          <>
            <div className="space-y-2 text-xs mb-4 p-3 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
              {config.displayName ? (
                <div className="flex justify-between"><span className="text-gray-400">Name</span><span className="font-medium text-gray-700 dark:text-gray-300">{config.displayName}</span></div>
              ) : null}
              <div className="flex justify-between"><span className="text-gray-400">Commission</span><span className="font-medium text-gray-700 dark:text-gray-300">{config.commissionPercent}%{config.commissionFixed > 0 ? ' + ' + config.commissionFixed : ''}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Auto-accept</span><span className={`font-medium ${config.autoAcceptOrders ? 'text-emerald-500' : 'text-gray-400'}`}>{config.autoAcceptOrders ? 'Enabled' : 'Disabled'}</span></div>
              {config.lastOrderAt ? (
                <div className="flex justify-between"><span className="text-gray-400">Last order</span><span className="font-medium text-gray-700 dark:text-gray-300">{new Date(config.lastOrderAt).toLocaleDateString()}</span></div>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onTest(config._id)} disabled={testLoading}
                className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-all">
                {testLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Test
              </button>
              <button onClick={() => onSync(config._id)} disabled={syncLoading}
                className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-all">
                {syncLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Menu
              </button>
              <button onClick={() => onEdit(config)} className="py-2 px-3 rounded-xl bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 transition-all">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { if (confirm('Disconnect this platform?')) onDisconnect(config._id) }} className="py-2 px-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/50 transition-all">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">Connect to start receiving and managing orders from {platform.name} directly in your dashboard.</p>
            <button onClick={onConnect}
              className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${platform.gradient} hover:shadow-lg text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-all`}>
              <Plus className="w-4 h-4" /> Connect {platform.name}
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default function RestaurantDelivery() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()
  const isRtl = language === 'ar'
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [editConfig, setEditConfig] = useState(null)
  const [orderFilter, setOrderFilter] = useState({ platform: '', status: '' })

  const hasDeliveryAddon = tenant?.subscription?.hasDeliveryAddon;

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['delivery-dashboard'],
    queryFn: () => api.get('/restaurant/delivery/dashboard').then(res => res.data),
    enabled: activeTab === 'dashboard',
  })

  const { data: platforms = [] } = useQuery({
    queryKey: ['delivery-platforms'],
    queryFn: () => api.get('/restaurant/delivery/platforms').then(res => res.data),
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['delivery-orders', orderFilter],
    queryFn: () => api.get('/restaurant/delivery/orders', { params: { ...orderFilter, limit: 100 } }).then(res => res.data),
    enabled: activeTab === 'orders',
    refetchInterval: 10000,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/restaurant/delivery/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-dashboard'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const testConnectionMutation = useMutation({
    mutationFn: (id) => api.post(`/restaurant/delivery/platforms/${id}/test-connection`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-platforms'] })
      toast.success(res.data?.message || 'Connection verified')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Connection failed'),
  })

  const syncMenuMutation = useMutation({
    mutationFn: (id) => api.post(`/restaurant/delivery/platforms/${id}/sync-menu`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-platforms'] })
      toast.success(res.data?.message || 'Menu synced')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Sync failed'),
  })

  const deletePlatformMutation = useMutation({
    mutationFn: (id) => api.delete(`/restaurant/delivery/platforms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-platforms'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-dashboard'] })
      toast.success('Platform disconnected')
    },
  })

  const summary = dashData?.summary || {}
  const dashPlatforms = dashData?.platforms || []
  const statusBreakdown = dashData?.statusBreakdown || {}
  const pendingPayouts = dashData?.pendingPayouts || []
  const dailyTrend = dashData?.dailyTrend || []
  const orders = ordersData?.orders || []

  if (!hasDeliveryAddon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-gradient-to-b from-gray-50 to-white dark:from-dark-900 dark:to-dark-800 rounded-3xl border border-gray-100 dark:border-dark-700 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative w-24 h-24 mb-6 rounded-full bg-white dark:bg-dark-800 shadow-2xl flex items-center justify-center border border-gray-100 dark:border-dark-600">
           <div className="absolute inset-0 rounded-full border-2 border-primary-500 border-dashed animate-[spin_10s_linear_infinite] opacity-20" />
           <Bike className="w-10 h-10 text-primary-500" />
        </div>
        
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
          {isRtl ? 'إضافة منصات التوصيل' : 'Delivery Platforms Add-on'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
          {isRtl 
            ? 'احصل على تكامل سلس مع جاهز، هنقرستيشن، نينجا، كيتا والمزيد. أدر جميع طلبات التوصيل من لوحة تحكم واحدة مركزية.' 
            : 'Unlock seamless integration with Jahez, HungerStation, Ninja, Keeta, and more. Manage all your delivery orders from one centralized dashboard.'}
        </p>
        
        <a href="mailto:support@maqder.com" className="btn btn-primary bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary-500/30 flex items-center gap-2 transition-all hover:scale-105">
           <Sparkles className="w-5 h-5" />
           {isRtl ? 'تواصل معنا للتفعيل' : 'Contact Sales to Enable'}
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-dark-800 dark:from-dark-700 dark:via-dark-800 dark:to-dark-900 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/20 to-transparent rounded-full -translate-y-20 translate-x-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-violet-500/10 to-transparent rounded-full translate-y-16 -translate-x-16 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-2">
                {PLATFORMS.slice(0, 5).map(p => (
                  <div key={p.id} className="ring-2 ring-gray-900 dark:ring-dark-800 rounded-xl overflow-hidden">
                    <PlatformLogo platform={p.id} className="w-7 h-7" />
                  </div>
                ))}
              </div>
              <span className="text-xs text-gray-400 font-medium">{PLATFORMS.length - 1}+ platforms</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {isRtl ? 'تكامل منصات التوصيل' : 'Delivery Platforms'}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {isRtl ? 'إدارة الطلبات من جاهز، هنقرستيشن، نينجا، كيتا والمزيد' : 'Manage orders from Jahez, HungerStation, Ninja, Keeta & more'}
            </p>
          </div>
          {summary.pendingOrders > 0 && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl"
            >
              <div className="relative">
                <Clock className="w-6 h-6 text-amber-400" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-amber-400 font-bold text-lg leading-none">{summary.pendingOrders}</p>
                <p className="text-amber-400/70 text-xs">Pending orders</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Premium tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-xl transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
            {tab.id === 'orders' && summary.pendingOrders > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{summary.pendingOrders}</span>
            )}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          {dashLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard icon={Package} label="Total Orders" value={summary.totalOrders || 0} gradient="from-blue-500 to-blue-600" delay={0} />
                <StatCard icon={DollarSign} label="Total Revenue" value={<Money value={summary.totalRevenue || 0} />} gradient="from-emerald-500 to-emerald-600" delay={0.05} />
                <StatCard icon={TrendingUp} label="Commission" value={<Money value={summary.totalCommission || 0} />} gradient="from-red-500 to-rose-600" delay={0.1} />
                <StatCard icon={Wallet} label="Net Payout" value={<Money value={summary.totalNetPayout || 0} />} gradient="from-violet-500 to-purple-600" delay={0.15} />
                <StatCard icon={Clock} label="Pending" value={summary.pendingOrders || 0} gradient="from-amber-500 to-orange-600" delay={0.2} />
              </div>

              <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary-500" /> Platform Performance
                </h3>
                <div className="space-y-3">
                  {dashPlatforms.map((p, i) => {
                    const platform = PLATFORMS.find(pl => pl.id === p.platform) || PLATFORMS[0]
                    const stats = p.stats || {}
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <PlatformLogo platform={p.platform} className="w-10 h-10" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{platform.name}</p>
                            <p className="text-xs text-gray-400">{stats.count || 0} orders</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase">Revenue</p>
                            <p className="font-bold text-gray-900 dark:text-white"><Money value={stats.revenue || 0} /></p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase">Commission</p>
                            <p className="font-bold text-red-500"><Money value={stats.commission || 0} /></p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase">Net</p>
                            <p className="font-bold text-emerald-600"><Money value={stats.netPayout || 0} /></p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                  {dashPlatforms.length === 0 && (
                    <div className="text-center py-8">
                      <Store className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-dark-600" />
                      <p className="text-sm text-gray-400">No platforms connected yet</p>
                      <button onClick={() => { setEditConfig(null); setShowModal(true) }} className="mt-3 text-sm text-primary-500 hover:underline font-medium">Connect your first platform</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['pending', 'preparing', 'ready', 'delivered'].map((s, i) => {
                  const cfg = STATUS_CONFIG[s]
                  return (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-gray-100 dark:border-dark-700 shadow-sm flex items-center gap-3"
                    >
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${cfg.gradient} shadow-sm`}>
                        <cfg.icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{cfg.label}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{statusBreakdown[s] || 0}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <>
          <div className="flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 uppercase">Platform</span>
              <select value={orderFilter.platform} onChange={(e) => setOrderFilter(f => ({ ...f, platform: e.target.value }))} className="select w-auto text-sm py-1.5">
                <option value="">All Platforms</option>
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 uppercase">Status</span>
              <select value={orderFilter.status} onChange={(e) => setOrderFilter(f => ({ ...f, status: e.target.value }))} className="select w-auto text-sm py-1.5">
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-gray-400">Auto-refresh 10s</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">{orders.length} orders</span>
            </div>
          </div>

          {ordersLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
          ) : orders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {orders.map(order => (
                  <OrderCard key={order._id} order={order} onStatusChange={(id, status) => statusMutation.mutate({ id, status })} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex p-4 rounded-2xl bg-gray-100 dark:bg-dark-700 mb-3">
                <Package className="w-8 h-8 text-gray-300 dark:text-dark-600" />
              </div>
              <p className="text-gray-400 font-medium">No delivery orders</p>
              <p className="text-gray-400 text-xs mt-1">Orders from connected platforms will appear here</p>
            </div>
          )}
        </>
      )}

      {/* Platforms Tab */}
      {activeTab === 'platforms' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Connected Platforms</h3>
              <p className="text-xs text-gray-400 mt-0.5">{platforms.filter(p => p.isConnected).length} of {PLATFORMS.length} platforms connected</p>
            </div>
            <button onClick={() => { setEditConfig(null); setShowModal(true) }} className="btn btn-action-dark flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Connect Platform
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.map(p => {
              const config = platforms.find(c => c.platform === p.id)
              return (
                <PlatformCard
                  key={p.id}
                  platform={p}
                  config={config}
                  onConnect={() => { setEditConfig(null); setShowModal(true) }}
                  onEdit={(c) => { setEditConfig(c); setShowModal(true) }}
                  onTest={(id) => testConnectionMutation.mutate(id)}
                  onSync={(id) => syncMenuMutation.mutate(id)}
                  onDisconnect={(id) => deletePlatformMutation.mutate(id)}
                  testLoading={testConnectionMutation.isPending && testConnectionMutation.variables === config?._id}
                  syncLoading={syncMenuMutation.isPending && syncMenuMutation.variables === config?._id}
                />
              )
            })}
          </div>
        </>
      )}

      {/* Payouts Tab */}
      {activeTab === 'payouts' && (
        <>
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" /> Pending Payouts by Platform
            </h3>
            {pendingPayouts.length > 0 ? (
              <div className="space-y-3">
                {pendingPayouts.map((p, i) => {
                  const platform = PLATFORMS.find(pl => pl.id === p._id) || PLATFORMS[0]
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-800/30"
                    >
                      <div className="flex items-center gap-3">
                        <PlatformLogo platform={p._id} className="w-10 h-10" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{platform.name}</p>
                          <p className="text-xs text-gray-400">{p.count} orders pending settlement</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase">Net Payout</p>
                        <p className="font-bold text-amber-600 text-lg"><Money value={p.amount} /></p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-300 dark:text-emerald-700" />
                <p className="text-sm text-gray-400">All payouts settled</p>
              </div>
            )}
          </div>

          {dailyTrend.length > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Daily Delivery Revenue
              </h3>
              <div className="flex items-end gap-1.5 h-40">
                {dailyTrend.map((d, i) => {
                  const max = Math.max(...dailyTrend.map(x => x.revenue), 1)
                  const h = Math.max(4, (d.revenue / max) * 100)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 text-xs bg-gray-800 text-white px-2 py-1 rounded-lg whitespace-nowrap z-10 transition-opacity font-medium">
                        <Money value={d.revenue} />
                      </div>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: i * 0.02, type: 'spring', stiffness: 100 }}
                        className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500 transition-colors"
                      />
                      <span className="text-[10px] text-gray-400 mt-1.5">{d.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && <PlatformModal onClose={() => { setShowModal(false); setEditConfig(null) }} editConfig={editConfig} />}
    </div>
  )
}

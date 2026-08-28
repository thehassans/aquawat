import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Search, Send, Plus, X,
  FileText, Briefcase, ShoppingCart, CheckSquare, Globe,
  Edit3, Lock, ChevronRight, MoreVertical, Check, CheckCheck,
  Circle, Inbox, Tag, RefreshCw, Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { contactToCustomer, fetchContactsList } from '../lib/contactMappers'

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr, isAr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return isAr ? 'الآن' : 'Just now'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return isAr ? `${m}د` : `${m}m`
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    return isAr ? `${h}س` : `${h}h`
  }
  const d = Math.floor(diff / 86400)
  if (d < 7) return isAr ? `${d}ي` : `${d}d`
  return new Date(dateStr).toLocaleDateString()
}

function getInitials(name = '') {
  return (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function getAvatarColor(name = '') {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-rose-600',
    'from-pink-500 to-fuchsia-600',
    'from-indigo-500 to-blue-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-green-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const TAG_TYPES = [
  { value: 'invoice', label: 'Invoice', labelAr: 'فاتورة', icon: FileText, color: 'blue' },
  { value: 'project', label: 'Project', labelAr: 'مشروع', icon: Briefcase, color: 'purple' },
  { value: 'order', label: 'Order', labelAr: 'طلب', icon: ShoppingCart, color: 'orange' },
  { value: 'task', label: 'Task', labelAr: 'مهمة', icon: CheckSquare, color: 'green' },
  { value: 'general', label: 'General', labelAr: 'عام', icon: Globe, color: 'gray' },
]

const TAG_COLOR_MAP = {
  invoice: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  project: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  order: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  task: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  general: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400',
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 'md', online = false }) {
  const sz = size === 'xs' ? 'w-7 h-7 text-[10px]' :
             size === 'sm' ? 'w-9 h-9 text-xs' :
             size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  const dotSz = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sz} rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center text-white font-semibold`}>
        {getInitials(name)}
      </div>
      {online && (
        <span className={`absolute bottom-0 right-0 ${dotSz} bg-emerald-500 border-2 border-white dark:border-dark-900 rounded-full`} />
      )}
    </div>
  )
}

function TagBadge({ tag }) {
  const def = TAG_TYPES.find(t => t.value === tag?.type) || TAG_TYPES[4]
  const Icon = def.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${TAG_COLOR_MAP[def.value]}`}>
      <Icon className="w-2.5 h-2.5" />
      {def.label}{tag?.refId ? ` #${tag.refId}` : ''}
    </span>
  )
}

// ─── Smart Record Search ──────────────────────────────────────────────────────

const SEARCHABLE_TAG_TYPES = ['invoice', 'project', 'order', 'task']

function useRecordSearch(tagType, query) {
  return useQuery({
    queryKey: ['communicate-ref-search', tagType, query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const q = encodeURIComponent(query)
      if (tagType === 'invoice') {
        const res = await api.get(`/invoices?search=${q}&limit=8`)
        return (res.data?.invoices || []).map(inv => ({
          id: inv.invoiceNumber,
          label: inv.invoiceNumber,
          sub: `${inv.buyer?.name || 'Cash Customer'} · ${inv.buyer?.contactPhone || ''}`.trim().replace(/\s·\s$/, ''),
          detail: `${inv.grandTotal?.toLocaleString() || 0} SAR · ${inv.status}`,
          _id: inv._id,
        }))
      }
      if (tagType === 'project') {
        const res = await api.get(`/projects?search=${q}&limit=8`)
        return (res.data?.projects || res.data || []).map(p => ({
          id: p._id,
          label: p.name || p.title,
          sub: p.clientName || p.description || '',
          detail: p.status || '',
          _id: p._id,
        }))
      }
      if (tagType === 'task') {
        const res = await api.get(`/tasks?search=${q}&limit=8`)
        return (res.data?.tasks || res.data || []).map(t => ({
          id: t._id,
          label: t.title || t.name,
          sub: t.assignee?.name || t.projectName || '',
          detail: t.status || t.priority || '',
          _id: t._id,
        }))
      }
      if (tagType === 'order') {
        const { contacts } = await fetchContactsList(api, {
          types: 'customer',
          search: query,
          limit: 8,
          isActive: 'all',
        })
        return contacts
          .filter((c) => c.entityType === 'customer')
          .map(contactToCustomer)
          .map((c) => ({
            id: c._id,
            label: c.name,
            sub: c.phone || c.email || '',
            detail: c.type || '',
            _id: c._id,
          }))
      }
      return []
    },
    enabled: !!query && query.length >= 2 && tagType !== 'general',
    staleTime: 10000,
  })
}

// ─── New Message Modal ────────────────────────────────────────────────────────

function NewMessageModal({ users, onClose, isAr, currentUser }) {
  const [recipient, setRecipient] = useState('')
  const [body, setBody] = useState('')
  const [tagType, setTagType] = useState('general')
  const [refQuery, setRefQuery] = useState('')
  const [selectedRef, setSelectedRef] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [step, setStep] = useState(1) // 1=pick user, 2=write
  const qc = useQueryClient()
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin'

  const filteredUsers = (users || []).filter(u =>
    u._id !== currentUser?._id &&
    (u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
     u.email?.toLowerCase().includes(userSearch.toLowerCase()))
  )

  const selectedRecipient = (users || []).find(u => u._id === recipient)

  // Smart search for linked record
  const { data: refResults = [], isFetching: refSearching } = useRecordSearch(tagType, refQuery)

  // Reset ref when tag type changes
  const handleTagChange = (type) => {
    setTagType(type)
    setRefQuery('')
    setSelectedRef(null)
  }

  const { mutate: sendMsg, isPending } = useMutation({
    mutationFn: (data) => api.post('/communicate', data),
    onSuccess: () => {
      toast.success(isAr ? 'تم إرسال الرسالة' : 'Message sent')
      qc.invalidateQueries({ queryKey: ['communicate-messages'] })
      onClose()
    },
    onError: (err) => toast.error(err.userMessage || 'Failed to send'),
  })

  const handleSend = () => {
    if (!recipient || !body.trim()) return toast.error(isAr ? 'يرجى التحديد والكتابة' : 'Select recipient and write a message')
    const refId = selectedRef?.id || refQuery.trim() || undefined
    sendMsg({
      toUser: recipient,
      body: body.trim(),
      tags: isAdmin && tagType !== 'general' ? [{ type: tagType, refId }] : []
    })
  }

  // Placeholder text per tag type
  const refPlaceholder = {
    invoice: isAr ? 'ابحث بالرقم أو الهاتف أو اسم العميل...' : 'Search by invoice #, phone or customer name...',
    project: isAr ? 'ابحث باسم المشروع...' : 'Search by project name...',
    task: isAr ? 'ابحث باسم المهمة...' : 'Search by task title...',
    order: isAr ? 'ابحث باسم العميل أو الهاتف...' : 'Search by customer name or phone...',
    general: '',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-dark-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-800">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
              </button>
            )}
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {step === 1 ? (isAr ? 'اختر مستلماً' : 'Select Recipient') : (isAr ? 'رسالة جديدة' : 'New Message')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {step === 1 ? (
          <div className="flex flex-col" style={{ maxHeight: '60vh' }}>
            {/* Search */}
            <div className="p-4 border-b border-gray-50 dark:border-dark-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder={isAr ? 'ابحث عن مستخدم...' : 'Search users...'}
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>
            {/* User List */}
            <div className="overflow-y-auto p-2">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">{isAr ? 'لا يوجد مستخدمون' : 'No users found'}</div>
              ) : filteredUsers.map(u => (
                <button
                  key={u._id}
                  onClick={() => { setRecipient(u._id); setStep(2) }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-xl transition-colors text-left"
                >
                  <Avatar name={u.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.role} · {u.email}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* To */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl">
              <Avatar name={selectedRecipient?.name} size="sm" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedRecipient?.name}</p>
                <p className="text-xs text-gray-400">{selectedRecipient?.role}</p>
              </div>
            </div>

            {/* Tag type picker (admin only) */}
            {isAdmin && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {isAr ? 'نوع الرسالة' : 'Message Type'}
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {TAG_TYPES.map(tag => (
                    <button
                      key={tag.value}
                      onClick={() => handleTagChange(tag.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-[11px] font-medium transition-all border ${
                        tagType === tag.value
                          ? `${TAG_COLOR_MAP[tag.value]} border-current shadow-sm`
                          : 'bg-gray-50 dark:bg-dark-800 text-gray-500 border-transparent hover:bg-gray-100 dark:hover:bg-dark-700'
                      }`}
                    >
                      <tag.icon className="w-4 h-4" />
                      {isAr ? tag.labelAr : tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Smart record search — only when not "general" */}
            {isAdmin && tagType !== 'general' && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {isAr ? 'ربط بسجل' : 'Link a Record'} <span className="text-gray-400 normal-case font-normal">({isAr ? 'اختياري' : 'optional'})</span>
                </p>

                {selectedRef ? (
                  /* Selected record chip */
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedRef.label}</p>
                      {selectedRef.sub && <p className="text-xs text-gray-400 truncate">{selectedRef.sub}</p>}
                    </div>
                    <button
                      onClick={() => { setSelectedRef(null); setRefQuery('') }}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg text-gray-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {refSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    <input
                      type="text"
                      placeholder={refPlaceholder[tagType]}
                      value={refQuery}
                      onChange={e => setRefQuery(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 transition-colors"
                    />

                    {/* Results dropdown */}
                    {refResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-lg z-10 overflow-hidden max-h-52 overflow-y-auto">
                        {refResults.map(rec => (
                          <button
                            key={rec._id || rec.id}
                            onClick={() => { setSelectedRef(rec); setRefQuery('') }}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-left border-b border-gray-50 dark:border-dark-700 last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{rec.label}</p>
                              {rec.sub && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{rec.sub}</p>}
                            </div>
                            {rec.detail && (
                              <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{rec.detail}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No results */}
                    {refQuery.length >= 2 && !refSearching && refResults.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-lg z-10 px-4 py-3 text-sm text-gray-400">
                        {isAr ? 'لا توجد نتائج' : 'No results found'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-dark-800" />

            {/* Message area */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {isAr ? 'الرسالة' : 'Message'}
              </p>
              <textarea
                autoFocus
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none placeholder-gray-400"
                placeholder={isAr ? 'اكتب رسالتك...' : 'Write your message...'}
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend() }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={isPending || !body.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
              {isPending ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : (isAr ? 'إرسال' : 'Send Message')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Communicate() {
  const { language } = useSelector(s => s.ui)
  const { user } = useSelector(s => s.auth)
  const isAr = language === 'ar'
  const t = (en, ar) => isAr ? ar : en

  const [activeTab, setActiveTab] = useState('inbox') // inbox | tickets
  const [selectedMsg, setSelectedMsg] = useState(null)
  const [search, setSearch] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [showMobileThread, setShowMobileThread] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const qc = useQueryClient()

  const { data: usersData } = useQuery({
    queryKey: ['communicate-users'],
    queryFn: () => api.get('/communicate/users').then(r => r.data),
    staleTime: 30000,
  })

  const { data: messagesData, isLoading, refetch } = useQuery({
    queryKey: ['communicate-messages'],
    queryFn: () => api.get('/communicate').then(r => r.data),
    refetchInterval: 8000,
  })

  const { data: threadData } = useQuery({
    queryKey: ['communicate-thread', selectedMsg?._id],
    queryFn: () => api.get(`/communicate/threads/${selectedMsg?._id}`).then(r => r.data),
    enabled: !!selectedMsg?._id,
    refetchInterval: 5000,
  })

  const { mutate: sendReply, isPending: sending } = useMutation({
    mutationFn: (data) => api.post('/communicate', data),
    onSuccess: () => {
      setReplyBody('')
      qc.invalidateQueries({ queryKey: ['communicate-thread', selectedMsg?._id] })
      qc.invalidateQueries({ queryKey: ['communicate-messages'] })
    },
    onError: (err) => toast.error(err.userMessage || t('Failed to send', 'فشل الإرسال')),
  })

  const { mutate: markRead } = useMutation({
    mutationFn: (id) => api.patch(`/communicate/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communicate-messages'] }),
  })

  const { mutate: closeThread } = useMutation({
    mutationFn: (id) => api.patch(`/communicate/${id}/close`),
    onSuccess: () => {
      toast.success(t('Thread closed', 'تم إغلاق المحادثة'))
      qc.invalidateQueries({ queryKey: ['communicate-thread', selectedMsg?._id] })
      qc.invalidateQueries({ queryKey: ['communicate-messages'] })
    },
  })

  const users = Array.isArray(usersData) ? usersData : (usersData?.users || [])
  const allMessages = messagesData?.messages || []
  const unreadCount = messagesData?.unreadCount || 0

  const filteredMessages = allMessages.filter(m => {
    const matchTab = activeTab === 'tickets' ? m.tags?.length > 0 : true
    const senderName = m.fromUser?.name || ''
    const preview = m.body || ''
    const matchSearch = !search || senderName.toLowerCase().includes(search.toLowerCase()) || preview.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const thread = threadData
  const parent = thread?.parent || selectedMsg
  const replies = thread?.replies || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  // mark as read when opening
  useEffect(() => {
    if (selectedMsg?._id && !selectedMsg.isRead && selectedMsg.toUser?._id === user?.id) {
      markRead(selectedMsg._id)
    }
  }, [selectedMsg?._id])

  const handleSelectMsg = (msg) => {
    setSelectedMsg(msg)
    setShowMobileThread(true)
  }

  const handleSendReply = () => {
    if (!replyBody.trim()) return
    const toUserId = parent?.fromUser?._id === (user?.id || user?._id)
      ? parent?.toUser?._id
      : parent?.fromUser?._id
    sendReply({ body: replyBody.trim(), thread: selectedMsg?._id, toUser: toUserId })
  }

  const getOtherPerson = (msg) => {
    const myId = user?.id || user?._id
    if (msg.fromUser?._id === myId || msg.fromUser?.id === myId) return msg.toUser
    return msg.fromUser
  }

  return (
    <div className={`h-[calc(100vh-7rem)] flex rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 ${isAr ? 'rtl' : 'ltr'}`}>

      {/* ── LEFT PANEL: Conversation List ── */}
      <div className={`w-full sm:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-gray-100 dark:border-dark-800 ${showMobileThread ? 'hidden sm:flex' : 'flex'}`}>
        
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('Messages', 'الرسائل')}</h1>
              {unreadCount > 0 && (
                <span className="w-5 h-5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => refetch()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                title={t('Refresh', 'تحديث')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowNewMsg(true)}
                className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-primary-600 transition-colors"
                title={t('New Message', 'رسالة جديدة')}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
            <input
              type="text"
              placeholder={t('Search messages...', 'ابحث في الرسائل...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full ${isAr ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 transition-colors`}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-xl">
            {[
              { id: 'inbox', label: t('Inbox', 'البريد'), icon: Inbox },
              { id: 'tickets', label: t('Tickets', 'التذاكر'), icon: Tag },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">{t('Loading...', 'جارٍ التحميل...')}</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-center px-6">
              <div className="w-14 h-14 bg-gray-100 dark:bg-dark-800 rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {search ? t('No results found', 'لا توجد نتائج') : t('No messages yet', 'لا توجد رسائل بعد')}
                </p>
                {!search && (
                  <button
                    onClick={() => setShowNewMsg(true)}
                    className="mt-3 text-sm text-primary-600 font-medium hover:underline"
                  >
                    {t('Send your first message', 'أرسل أول رسالة')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredMessages.map(msg => {
                const isSelected = selectedMsg?._id === msg._id
                const myId = user?.id || user?._id
                const isUnread = !msg.isRead && (msg.toUser?._id === myId || msg.toUser?.id === myId)
                const other = getOtherPerson(msg)
                const isMine = msg.fromUser?._id === myId || msg.fromUser?.id === myId
                const preview = msg.body || ''
                const replyCount = msg.replyCount || 0

                return (
                  <motion.button
                    key={msg._id}
                    layout
                    onClick={() => handleSelectMsg(msg)}
                    className={`w-full text-left p-3 rounded-xl transition-all group ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-dark-800'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="relative">
                        <Avatar name={other?.name || '?'} size="md" />
                        {isUnread && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary-500 border-2 border-white dark:border-dark-900 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                            {other?.name || t('Unknown User', 'مستخدم غير معروف')}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelative(msg.createdAt, isAr)}</span>
                        </div>
                        <p className={`text-xs leading-relaxed line-clamp-2 ${isUnread ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                          {isMine && <span className="text-gray-400">{t('You: ', 'أنت: ')}</span>}
                          {preview}
                        </p>
                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-1.5">
                          {msg.isClosed && (
                            <span className="flex items-center gap-0.5 text-[10px] text-rose-500">
                              <Lock className="w-2.5 h-2.5" />{t('Closed', 'مغلق')}
                            </span>
                          )}
                          {replyCount > 0 && (
                            <span className="text-[10px] text-gray-400">{replyCount} {t('replies', 'ردود')}</span>
                          )}
                          {msg.tags?.length > 0 && msg.tags.map((tag, i) => <TagBadge key={i} tag={tag} />)}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Thread View ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${showMobileThread ? 'flex' : 'hidden sm:flex'}`}>
        {!selectedMsg ? (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <MessageSquare className="w-9 h-9 text-primary-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('Your Messages', 'رسائلك')}</h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                {t('Select a conversation from the left to read and reply, or start a new one.', 'اختر محادثة من اليسار للقراءة والرد، أو ابدأ محادثة جديدة.')}
              </p>
              <button
                onClick={() => setShowNewMsg(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                {t('New Message', 'رسالة جديدة')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-800 bg-white dark:bg-dark-900">
              <div className="flex items-center gap-3">
                {/* Mobile back */}
                <button
                  onClick={() => { setShowMobileThread(false); setSelectedMsg(null) }}
                  className="sm:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
                </button>
                <Avatar name={getOtherPerson(parent)?.name || '?'} size="sm" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {getOtherPerson(parent)?.name || t('Unknown', 'غير معروف')}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">
                      {getOtherPerson(parent)?.role}
                    </p>
                    {parent?.isClosed && (
                      <span className="flex items-center gap-1 text-[10px] font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" />{t('Closed', 'مغلق')}
                      </span>
                    )}
                    {parent?.tags?.map((tag, i) => <TagBadge key={i} tag={tag} />)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!parent?.isClosed && (
                  <button
                    onClick={() => closeThread(parent._id)}
                    className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    {t('Close', 'إغلاق')}
                  </button>
                )}
                <button
                  onClick={() => { setSelectedMsg(null); setShowMobileThread(false) }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50 dark:bg-dark-900/50">
              {/* Parent message */}
              {(() => {
                const myId = user?.id || user?._id
                const isMine = parent?.fromUser?._id === myId || parent?.fromUser?.id === myId
                return (
                  <div className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <Avatar name={parent?.fromUser?.name || '?'} size="xs" />
                    <div className={`max-w-[72%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-primary-600 text-white rounded-tr-sm'
                          : 'bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
                      }`}>
                        {parent?.body}
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">{formatRelative(parent?.createdAt, isAr)}</span>
                    </div>
                  </div>
                )
              })()}

              {/* Replies */}
              {replies.map(reply => {
                const myId = user?.id || user?._id
                const isMine = reply.fromUser?._id === myId || reply.fromUser?.id === myId
                return (
                  <motion.div
                    key={reply._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar name={reply.fromUser?.name || '?'} size="xs" />
                    <div className={`max-w-[72%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-primary-600 text-white rounded-tr-sm'
                          : 'bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
                      }`}>
                        {reply.body}
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">{formatRelative(reply.createdAt, isAr)}</span>
                    </div>
                  </motion.div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            {parent?.isClosed ? (
              <div className="px-5 py-4 bg-white dark:bg-dark-900 border-t border-gray-100 dark:border-dark-800">
                <div className="flex items-center justify-center gap-2 py-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-sm text-rose-600 dark:text-rose-400">
                  <Lock className="w-4 h-4" />
                  {t('This conversation is closed', 'هذه المحادثة مغلقة')}
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 bg-white dark:bg-dark-900 border-t border-gray-100 dark:border-dark-800">
                <div className="flex items-end gap-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl p-2 focus-within:border-primary-400 dark:focus-within:border-primary-500 transition-colors">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    className="flex-1 bg-transparent border-none text-sm resize-none py-2 px-3 focus:ring-0 placeholder-gray-400 min-h-[36px] max-h-32"
                    placeholder={t('Type a reply... (Enter to send)', 'اكتب رداً... (Enter للإرسال)')}
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendReply()
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sending || !replyBody.trim()}
                    className="w-9 h-9 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 px-1">{t('Shift+Enter for new line', 'Shift+Enter لسطر جديد')}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Message Modal */}
      <AnimatePresence>
        {showNewMsg && (
          <NewMessageModal
            users={users}
            onClose={() => setShowNewMsg(false)}
            isAr={isAr}
            currentUser={user}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

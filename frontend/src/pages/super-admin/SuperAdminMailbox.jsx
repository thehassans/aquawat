import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, Mail, MailOpen, Paperclip, PenSquare, RefreshCw,
  Reply, Save, Search, Send, Settings2, X, ChevronDown, Clock, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

/* ── helpers ─────────────────────────────────────────────── */
const parseAddressList = (v) =>
  String(v || '').split(/[;,\n]+/).map((s) => s.trim()).filter(Boolean)

const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const plainTextToHtml = (v) => escapeHtml(v).replace(/\r?\n/g, '<br />')

const formatDate = (v, language) => {
  const d = v ? new Date(v) : null
  if (!d || isNaN(d)) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatDateLong = (v, language) => {
  const d = v ? new Date(v) : null
  if (!d || isNaN(d)) return ''
  return d.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    resolve(result.includes(',') ? result.split(',').pop() : result)
  }
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const buildComposeState = (message = null, defaultFrom = '') => ({
  to: Array.isArray(message?.to) ? message.to.join(', ') : '',
  cc: Array.isArray(message?.cc) ? message.cc.join(', ') : '',
  bcc: Array.isArray(message?.bcc) ? message.bcc.join(', ') : '',
  from: defaultFrom,
  subject: message?.subject || '',
  bodyText: message?.bodyText || '',
  attachments: Array.isArray(message?.attachments)
    ? message.attachments.map((a) => ({ name: a.name, type: a.type, size: a.size, contentBase64: a.contentBase64 || '', contentId: a.contentId || '' }))
    : [],
})

const folderOptions = (language) => [
  { key: 'all',    label: language === 'ar' ? 'الكل'     : 'All',    icon: Mail   },
  { key: 'inbox',  label: language === 'ar' ? 'الوارد'   : 'Inbox',  icon: Inbox  },
  { key: 'sent',   label: language === 'ar' ? 'المرسل'   : 'Sent',   icon: Send   },
  { key: 'draft',  label: language === 'ar' ? 'المسودات' : 'Drafts', icon: Save   },
]

function avatarProps(str) {
  const s = String(str || '?')
  const initials = s.split(/[\s@<>]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  const hue = ((hash % 360) + 360) % 360
  return { initials: initials || '?', hue }
}

function MailAvatar({ address, size = 36 }) {
  const { initials, hue } = avatarProps(address)
  return (
    <div
      style={{
        width: size, height: size, minWidth: size, borderRadius: size * 0.35,
        background: `hsl(${hue},55%,48%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em',
        boxShadow: `0 2px 8px hsl(${hue},55%,40%,0.35)`,
      }}
    >
      {initials}
    </div>
  )
}

export default function SuperAdminMailbox() {
  const queryClient = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const isArabic = language === 'ar'

  const [activeFolder, setActiveFolder] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState('')
  const [composeState, setComposeState] = useState(null)
  const [showCcBcc, setShowCcBcc] = useState(false)

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(h)
  }, [search])

  const emailSettingsQuery = useQuery({
    queryKey: ['super-admin-email-settings'],
    queryFn: () => api.get('/super-admin/settings/email').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const messagesQuery = useQuery({
    queryKey: ['super-admin-email-messages', activeFolder, debouncedSearch],
    queryFn: () => api.get('/super-admin/mailbox/messages', { params: { folder: activeFolder, search: debouncedSearch } }).then((r) => r.data),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  })

  const selectedMessageQuery = useQuery({
    queryKey: ['super-admin-email-message', selectedMessageId],
    queryFn: () => api.get(`/super-admin/mailbox/messages/${selectedMessageId}`).then((r) => r.data),
    enabled: !!selectedMessageId && !composeState,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const messages = messagesQuery.data?.messages || []
  const counts = messagesQuery.data?.counts || { all: {}, inbox: {}, sent: {}, draft: {} }
  const selectedMessage = selectedMessageQuery.data || messages.find((m) => m._id === selectedMessageId) || null

  const currentEmailSettings = emailSettingsQuery.data?.email || {}
  const senderName = currentEmailSettings?.fromName || 'Maqder ERP'
  const defaultFromEmail = currentEmailSettings?.fromEmail || ''
  
  const aliases = useMemo(() => {
    const arr = [defaultFromEmail]
    if (currentEmailSettings.salesEmail && !arr.includes(currentEmailSettings.salesEmail)) arr.push(currentEmailSettings.salesEmail)
    if (currentEmailSettings.supportEmail && !arr.includes(currentEmailSettings.supportEmail)) arr.push(currentEmailSettings.supportEmail)
    if (currentEmailSettings.billingEmail && !arr.includes(currentEmailSettings.billingEmail)) arr.push(currentEmailSettings.billingEmail)
    return arr.filter(Boolean)
  }, [currentEmailSettings])

  useEffect(() => {
    if (composeState) return
    if (!messages.length) { setSelectedMessageId(''); return }
    if (!selectedMessageId || !messages.some((m) => m._id === selectedMessageId)) {
      setSelectedMessageId(messages[0]._id)
    }
  }, [messages, selectedMessageId, composeState])

  const sendMutation = useMutation({
    mutationFn: (payload) => api.post('/super-admin/mailbox/messages/send', payload).then((r) => r.data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-email-messages'] })
      if (variables.saveAsDraft) {
        toast.success(isArabic ? 'تم حفظ المسودة' : 'Draft saved')
        setActiveFolder('draft')
      } else {
        toast.success(isArabic ? 'تم إرسال البريد' : 'Email sent successfully')
        setActiveFolder('sent')
      }
      setComposeState(null)
      setSelectedMessageId(response?.draft?._id || response?.delivery?.message?._id || '')
    },
    onError: (err) => toast.error(err.userMessage || err.response?.data?.error || 'Failed to send'),
  })

  const handleOpenMessage = async (message) => {
    if (!message) return
    if (message.type === 'draft') { setComposeState(buildComposeState(message, message.from || defaultFromEmail)); setSelectedMessageId(message._id); return }
    if (message.type === 'inbox' && !message.isRead) {
      try { await api.patch(`/super-admin/mailbox/messages/${message._id}/read`, { isRead: true }) } catch {}
      queryClient.invalidateQueries({ queryKey: ['super-admin-email-messages'] })
    }
    setComposeState(null)
    setSelectedMessageId(message._id)
  }

  const handleReply = () => {
    if (!selectedMessage) return
    setComposeState({
      to: selectedMessage.from || '',
      cc: '', bcc: '',
      from: selectedMessage.to?.[0] || defaultFromEmail,
      subject: selectedMessage.subject?.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject || ''}`,
      bodyText: `\n\n─────────────────────\n${selectedMessage.bodyText || ''}`,
      attachments: [],
    })
  }

  const handleAttachmentChange = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length || !composeState) return
    try {
      const nextAttachments = await Promise.all(files.map(async (f) => ({
        name: f.name, type: f.type || 'application/octet-stream', size: f.size,
        contentBase64: await readFileAsBase64(f),
      })))
      setComposeState((cur) => ({ ...(cur || buildComposeState(null, defaultFromEmail)), attachments: [...(cur?.attachments || []), ...nextAttachments] }))
      event.target.value = ''
    } catch { toast.error(isArabic ? 'تعذر تحميل المرفق' : 'Failed to load attachment') }
  }

  const handleRemoveAttachment = (index) =>
    setComposeState((cur) => ({ ...(cur || buildComposeState(null, defaultFromEmail)), attachments: (cur?.attachments || []).filter((_, i) => i !== index) }))

  const handleDownloadAttachment = (attachment) => {
    if (!attachment) return
    if (attachment.contentBase64) {
      const bytes = atob(attachment.contentBase64)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob = new Blob([arr], { type: attachment.type || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = attachment.name || 'attachment'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      return
    }
    if (attachment.url) window.open(attachment.url, '_blank', 'noopener,noreferrer')
  }

  const submitCompose = (saveAsDraft = false) => {
    sendMutation.mutate({
      saveAsDraft,
      to: parseAddressList(composeState?.to),
      cc: parseAddressList(composeState?.cc),
      bcc: parseAddressList(composeState?.bcc),
      from: composeState?.from || defaultFromEmail,
      subject: String(composeState?.subject || '').trim(),
      bodyText: String(composeState?.bodyText || '').trim(),
      bodyHtml: plainTextToHtml(composeState?.bodyText || ''),
      attachments: (composeState?.attachments || []).map((a) => ({
        filename: a.name, contentType: a.type, size: a.size,
        contentBase64: a.contentBase64, contentId: a.contentId,
      })),
    })
  }

  const folders = useMemo(() => folderOptions(language), [language])

  return (
    <div className="flex flex-col h-full gap-0" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-none">
              {isArabic ? 'صندوق البريد' : 'Mailbox'}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{isArabic ? 'إدارة بريد المنصة' : 'Platform Email Management'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => messagesQuery.refetch()}
            className="p-2 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-all hover:shadow-sm"
            title={isArabic ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${messagesQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setComposeState(buildComposeState(null, defaultFromEmail)); setShowCcBcc(false) }}
            className="btn btn-primary"
          >
            <PenSquare className="w-4 h-4" />
            {isArabic ? 'إنشاء' : 'Compose'}
          </button>
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div className="grid gap-4 flex-1" style={{ gridTemplateColumns: '200px 300px 1fr', minHeight: 0 }}>

        {/* ── Col 1: Sidebar ── */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-3 flex flex-col gap-1 overflow-hidden"
        >
          {/* Sender identity */}
          <div className="flex items-center gap-2.5 px-2 py-3 border-b border-gray-100 dark:border-dark-700 mb-2">
            <MailAvatar address={senderName} size={34} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{senderName}</p>
              <p className="text-[10px] text-gray-400 truncate">{defaultFromEmail || (isArabic ? 'غير مُعدّ' : 'Not configured')}</p>
            </div>
          </div>

          {folders.map((folder) => {
            const Icon = folder.icon
            const meta = counts?.[folder.key] || {}
            const count = folder.key === 'inbox' ? (meta.unread || 0) : (meta.count || 0)
            const isActive = activeFolder === folder.key
            return (
              <button
                key={folder.key}
                type="button"
                onClick={() => { setActiveFolder(folder.key); setComposeState(null) }}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-500/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {folder.label}
                </span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-dark-600 text-gray-600 dark:text-gray-300'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </motion.div>

        {/* ── Col 2: Message list ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card overflow-hidden flex flex-col"
        >
          {/* Search */}
          <div className="p-3 border-b border-gray-100 dark:border-dark-700 flex-shrink-0">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-gray-400 transition-all"
                placeholder={isArabic ? 'بحث...' : 'Search…'}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {messagesQuery.isLoading ? (
              <div className="divide-y divide-gray-100 dark:divide-dark-700/50">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="px-4 py-3.5 flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-dark-600 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 bg-gray-200 dark:bg-dark-600 rounded-lg" />
                      <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-dark-700 rounded-lg" />
                      <div className="h-2.5 w-4/5 bg-gray-100 dark:bg-dark-700 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messagesQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-gray-500">{isArabic ? 'تعذر تحميل الرسائل' : 'Failed to load messages'}</p>
                <button onClick={() => messagesQuery.refetch()} className="btn btn-secondary text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isArabic ? 'إعادة المحاولة' : 'Retry'}
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 p-12 text-center h-full">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                  <Mail className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-sm text-gray-400">{isArabic ? 'لا توجد رسائل' : 'No messages'}</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  const addr = msg.type === 'sent' ? (Array.isArray(msg.to) ? msg.to[0] : '') : msg.from
                  const isSelected = selectedMessageId === msg._id && !composeState
                  return (
                    <motion.button
                      key={msg._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      type="button"
                      onClick={() => handleOpenMessage(msg)}
                      className={`w-full px-3 py-3 text-start border-b border-gray-100 dark:border-dark-700/50 last:border-b-0 transition-all ${
                        isSelected
                          ? 'bg-primary-50/70 dark:bg-primary-900/15'
                          : 'hover:bg-gray-50 dark:hover:bg-dark-700/40'
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        <MailAvatar address={addr} size={36} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-sm truncate ${msg.isRead ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white'}`}>
                              {msg.subject || (isArabic ? 'بدون موضوع' : 'No subject')}
                            </p>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(msg.createdAt, language)}</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{addr}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1 leading-relaxed">
                            {msg.previewText || msg.bodyText || ''}
                          </p>
                        </div>
                        {!msg.isRead && msg.type === 'inbox' && (
                          <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* ── Col 3: Reading pane / Compose ── */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="card overflow-hidden flex flex-col"
        >
          <AnimatePresence mode="wait">
            {/* COMPOSE */}
            {composeState ? (
              <motion.div
                key="compose"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex flex-col h-full"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-700 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <PenSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h2 className="font-bold text-gray-900 dark:text-white text-sm">{isArabic ? 'رسالة جديدة' : 'New Message'}</h2>
                  </div>
                  <button onClick={() => setComposeState(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Fields */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {/* From */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-700">
                    <span className="text-xs font-semibold text-gray-400 w-8 flex-shrink-0">{isArabic ? 'من' : 'From'}</span>
                    {aliases.length > 1 ? (
                      <select
                        value={composeState.from}
                        onChange={(e) => setComposeState((c) => ({ ...c, from: e.target.value }))}
                        className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
                      >
                        {aliases.map((alias) => (
                          <option key={alias} value={alias}>{alias}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-900 dark:text-white">{composeState.from || defaultFromEmail}</span>
                    )}
                  </div>

                  {/* To */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-700">
                    <span className="text-xs font-semibold text-gray-400 w-8 flex-shrink-0">{isArabic ? 'إلى' : 'To'}</span>
                    <input
                      value={composeState.to}
                      onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState(null, defaultFromEmail)), to: e.target.value }))}
                      className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                      placeholder="recipient@example.com"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCcBcc((v) => !v)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
                    >
                      CC/BCC <ChevronDown className={`w-3 h-3 transition-transform ${showCcBcc ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* CC/BCC */}
                  {showCcBcc && (
                    <>
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-700">
                        <span className="text-xs font-semibold text-gray-400 w-8 flex-shrink-0">CC</span>
                        <input
                          value={composeState.cc}
                          onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState(null, defaultFromEmail)), cc: e.target.value }))}
                          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                          placeholder="cc@example.com"
                        />
                      </div>
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-700">
                        <span className="text-xs font-semibold text-gray-400 w-8 flex-shrink-0">BCC</span>
                        <input
                          value={composeState.bcc}
                          onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState(null, defaultFromEmail)), bcc: e.target.value }))}
                          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                          placeholder="bcc@example.com"
                        />
                      </div>
                    </>
                  )}

                  {/* Subject */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-700">
                    <span className="text-xs font-semibold text-gray-400 w-8 flex-shrink-0">{isArabic ? 'موضوع' : 'Sub'}</span>
                    <input
                      value={composeState.subject}
                      onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState(null, defaultFromEmail)), subject: e.target.value }))}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                      placeholder={isArabic ? 'موضوع الرسالة' : 'Subject'}
                    />
                  </div>

                  {/* Body */}
                  <div className="px-5 pt-4 pb-2">
                    <textarea
                      value={composeState.bodyText}
                      onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState(null, defaultFromEmail)), bodyText: e.target.value }))}
                      rows={14}
                      className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none resize-none leading-7"
                      placeholder={isArabic ? 'اكتب رسالتك هنا...' : 'Write your message here…'}
                    />
                  </div>

                  {/* Attachments */}
                  {composeState.attachments?.length > 0 && (
                    <div className="px-5 pb-4 space-y-2">
                      {composeState.attachments.map((a, idx) => (
                        <div key={`${a.name}-${idx}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-700 text-sm">
                          <div className="min-w-0 flex items-center gap-2">
                            <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate text-gray-700 dark:text-gray-200">{a.name}</span>
                            <span className="text-xs text-gray-400">{a.size ? `${Math.max(1, Math.round(a.size / 1024))} KB` : ''}</span>
                          </div>
                          <button type="button" onClick={() => handleRemoveAttachment(idx)} className="text-red-500 hover:text-red-600 transition-colors p-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-dark-700 flex-shrink-0">
                  <label className="cursor-pointer p-2 rounded-xl border border-gray-200 dark:border-dark-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:border-gray-300 transition-all" title={isArabic ? 'إرفاق ملف' : 'Attach file'}>
                    <Paperclip className="w-4 h-4" />
                    <input type="file" multiple className="hidden" onChange={handleAttachmentChange} />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => submitCompose(true)}
                      disabled={sendMutation.isPending}
                      className="btn btn-secondary text-sm"
                    >
                      {sendMutation.isPending ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{isArabic ? 'مسودة' : 'Draft'}</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitCompose(false)}
                      disabled={sendMutation.isPending}
                      className="btn btn-primary text-sm"
                    >
                      {sendMutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" />{isArabic ? 'إرسال' : 'Send'}</>}
                    </button>
                  </div>
                </div>
              </motion.div>

            ) : selectedMessage ? (
              /* READ VIEW */
              <motion.div
                key={selectedMessage._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                {/* Message header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-dark-700 flex-shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-gray-900 dark:text-white text-lg leading-snug">
                        {selectedMessage.subject || (isArabic ? 'بدون موضوع' : 'No subject')}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {selectedMessage.type !== 'draft' && (
                        <button type="button" onClick={handleReply} className="btn btn-secondary text-xs">
                          <Reply className="w-3.5 h-3.5" />
                          {isArabic ? 'رد' : 'Reply'}
                        </button>
                      )}
                      {selectedMessage.type === 'draft' && (
                        <button type="button" onClick={() => setComposeState(buildComposeState(selectedMessage, selectedMessage.from || defaultFromEmail))} className="btn btn-primary text-xs">
                          <PenSquare className="w-3.5 h-3.5" />
                          {isArabic ? 'تحرير' : 'Edit'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sender meta */}
                  <div className="flex items-center gap-3 mt-4">
                    <MailAvatar address={selectedMessage.type === 'sent' ? (selectedMessage.to?.[0] || '') : selectedMessage.from} size={38} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedMessage.type === 'sent'
                          ? (Array.isArray(selectedMessage.to) ? selectedMessage.to.join(', ') : selectedMessage.to)
                          : selectedMessage.from}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatDateLong(selectedMessage.createdAt, language)}
                        {selectedMessage.type === 'inbox' && selectedMessage.isRead && (
                          <>
                            <MailOpen className="w-3 h-3 ms-1" />
                            <span>{isArabic ? 'مقروء' : 'Read'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden p-0 relative bg-white dark:bg-white rounded-b-xl border-t border-gray-100 dark:border-dark-700">
                  {selectedMessage.bodyHtml ? (
                    <iframe
                      srcDoc={selectedMessage.bodyHtml}
                      className="w-full h-full border-0"
                      title="Email Content"
                      sandbox="allow-same-origin allow-popups"
                    />
                  ) : (
                    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">{selectedMessage.bodyText || ''}</pre>
                    </div>
                  )}
                </div>

                  {/* Attachments */}
                  {selectedMessage.attachments?.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-dark-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        {isArabic ? 'المرفقات' : 'Attachments'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {selectedMessage.attachments.map((a, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700/50">
                            <div className="min-w-0 flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-dark-600 flex items-center justify-center flex-shrink-0">
                                <Paperclip className="w-4 h-4 text-gray-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.name}</p>
                                <p className="text-[10px] text-gray-500">{a.size ? `${Math.max(1, Math.round(a.size / 1024))} KB` : ''}</p>
                              </div>
                            </div>
                            {(a.url || a.contentBase64) && (
                              <button
                                onClick={() => handleDownloadAttachment(a)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
                                title={isArabic ? 'تحميل' : 'Download'}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-dark-700/50 flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-gray-900 dark:text-white font-medium mb-1">
                  {isArabic ? 'اختر رسالة' : 'Select a message'}
                </h3>
                <p className="text-sm text-gray-500">
                  {isArabic ? 'اختر رسالة من القائمة لعرض محتواها' : 'Choose a message from the list to view its contents'}
                </p>
              </div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  )
}

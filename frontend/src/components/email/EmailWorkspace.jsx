import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, Mail, MailOpen, Paperclip, PenSquare, RefreshCw,
  Reply, Save, Search, Send, Settings2, ShieldCheck,
  Sparkles, X, ChevronDown, AtSign, Clock, Download,
  AlertCircle, Zap, Users
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { usePublicWebsiteSettings } from '../../lib/website'
import { updateTenant } from '../../store/slices/authSlice'
import { tenantHasEmailAddon } from '../../lib/emailAddon'
import EmailSettingsModal from './EmailSettingsModal'

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
  return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short' })
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

const buildComposeState = (message = null) => ({
  to: Array.isArray(message?.to) ? message.to.join(', ') : '',
  cc: Array.isArray(message?.cc) ? message.cc.join(', ') : '',
  bcc: Array.isArray(message?.bcc) ? message.bcc.join(', ') : '',
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

/** Derive initials + deterministic hue from any string */
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

/* ─────────────────────────────────────────────────────────── */
export default function EmailWorkspace() {
  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isArabic = language === 'ar'
  const { data: websiteSettings } = usePublicWebsiteSettings()

  const hasEmailAddon = tenantHasEmailAddon(tenant)

  const [activeFolder, setActiveFolder] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [composeState, setComposeState] = useState(null)
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [showEmployeeEmail, setShowEmployeeEmail] = useState(false)
  const [empEmailForm, setEmpEmailForm] = useState({ employeeId: '', subject: '', body: '' })

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(h)
  }, [search])

  const salesEmail = websiteSettings?.contactEmail || 'info@maqder.com'
  const contactSalesSubject = encodeURIComponent('Email Marketing')

  const emailSettingsQuery = useQuery({
    queryKey: ['tenant-email-settings'],
    queryFn: () => api.get('/email/settings').then((r) => r.data),
    enabled: hasEmailAddon,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const messagesQuery = useQuery({
    queryKey: ['tenant-email-messages', activeFolder, debouncedSearch],
    queryFn: () => api.get('/email/messages', { params: { folder: activeFolder, search: debouncedSearch } }).then((r) => r.data),
    enabled: hasEmailAddon,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1, retryDelay: 1500,
    placeholderData: (prev) => prev,
  })

  const employeesForEmailQuery = useQuery({
    queryKey: ['employees-for-email-compose'],
    queryFn: () => api.get('/employees', { params: { limit: 200 } }).then((r) => r.data),
    enabled: hasEmailAddon && showEmployeeEmail,
    staleTime: 5 * 60 * 1000,
  })

  const selectedMessageQuery = useQuery({
    queryKey: ['tenant-email-message', selectedMessageId],
    queryFn: () => api.get(`/email/messages/${selectedMessageId}`).then((r) => r.data),
    enabled: hasEmailAddon && !!selectedMessageId && !composeState,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const messages = messagesQuery.data?.messages || []
  const counts = messagesQuery.data?.counts || { all: {}, inbox: {}, sent: {}, draft: {} }
  const selectedMessage = selectedMessageQuery.data || messages.find((m) => m._id === selectedMessageId) || null

  useEffect(() => {
    if (composeState) return
    if (!messages.length) { setSelectedMessageId(''); return }
    if (!selectedMessageId || !messages.some((m) => m._id === selectedMessageId)) {
      setSelectedMessageId(messages[0]._id)
    }
  }, [messages, selectedMessageId, composeState])

  const settingsMutation = useMutation({
    mutationFn: (payload) => api.put('/email/settings', { email: payload }).then((r) => r.data),
    onSuccess: (response) => {
      const nextTenant = { ...tenant, settings: { ...(tenant?.settings || {}), communication: { ...(tenant?.settings?.communication || {}), email: response.email } } }
      dispatch(updateTenant(nextTenant))
      queryClient.setQueryData(['tenant-email-settings'], response)
      queryClient.setQueryData(['tenant-current'], nextTenant)
      toast.success(isArabic ? 'تم حفظ إعدادات البريد' : 'Email settings saved')
      setShowSettings(false)
    },
    onError: (err) => toast.error(err.userMessage || err.response?.data?.error || 'Failed to save'),
  })

  const sendMutation = useMutation({
    mutationFn: (payload) => api.post('/email/send', payload).then((r) => r.data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-email-messages'] })
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

  const sendEmployeeEmailMutation = useMutation({
    mutationFn: ({ employeeId, subject, body }) =>
      api.post(`/employees/${employeeId}/send-email`, {
        subject,
        bodyText: body,
        bodyHtml: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(
        isArabic
          ? `تم الإرسال إلى ${data.recipientEmail}`
          : `Email sent to ${data.recipientEmail}`
      )
      setShowEmployeeEmail(false)
      setEmpEmailForm({ employeeId: '', subject: '', body: '' })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to send employee email'),
  })

  const handleOpenMessage = async (message) => {
    if (!message) return
    if (message.type === 'draft') { setComposeState(buildComposeState(message)); setSelectedMessageId(message._id); return }
    if (message.type === 'inbox' && !message.isRead) {
      try { await api.patch(`/email/messages/${message._id}/read`, { isRead: true }) } catch {}
      queryClient.invalidateQueries({ queryKey: ['tenant-email-messages'] })
    }
    setComposeState(null)
    setSelectedMessageId(message._id)
  }

  const handleReply = () => {
    if (!selectedMessage) return
    setComposeState({
      to: selectedMessage.from || '',
      cc: '', bcc: '',
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
      setComposeState((cur) => ({ ...(cur || buildComposeState()), attachments: [...(cur?.attachments || []), ...nextAttachments] }))
      event.target.value = ''
    } catch { toast.error(isArabic ? 'تعذر تحميل المرفق' : 'Failed to load attachment') }
  }

  const handleRemoveAttachment = (index) =>
    setComposeState((cur) => ({ ...(cur || buildComposeState()), attachments: (cur?.attachments || []).filter((_, i) => i !== index) }))

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
      subject: String(composeState?.subject || '').trim(),
      bodyText: String(composeState?.bodyText || '').trim(),
      bodyHtml: plainTextToHtml(composeState?.bodyText || ''),
      attachments: (composeState?.attachments || []).map((a) => ({
        filename: a.name, contentType: a.type, size: a.size,
        contentBase64: a.contentBase64, contentId: a.contentId,
      })),
    })
  }

  const currentEmailSettings = emailSettingsQuery.data?.email || tenant?.settings?.communication?.email || {}
  const folders = useMemo(() => folderOptions(language), [language])

  /* ── UPSELL (no addon) ────────────────────────────────────── */
  if (!hasEmailAddon) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-teal-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isArabic ? 'التسويق عبر البريد' : 'Email Marketing'}
              </h1>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {isArabic ? 'إدارة الوارد والمرسل وإرسال الفواتير تلقائياً' : 'Inbox, sent mail, and automated invoice delivery'}
              </p>
            </div>
          </div>
        </div>

        {/* Upsell card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1f14] via-[#0d2a1a] to-[#071610] border border-primary-500/20 p-8 md:p-12"
        >
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(20,184,166,0.8) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(20,184,166,0.4) 0%, transparent 50%)',
          }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(rgba(20,184,166,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.4) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />

          <div className="relative flex flex-col lg:flex-row items-center gap-12">
            {/* Icon blob */}
            <div className="relative flex-shrink-0">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary-500/30 to-teal-500/10 border border-primary-500/30 flex items-center justify-center">
                <Mail className="w-14 h-14 text-primary-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-primary-400 to-teal-500 flex items-center justify-center shadow-lg shadow-primary-500/40">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1 text-center lg:text-start">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/15 border border-primary-500/25 text-primary-300 text-xs font-semibold mb-5 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" />
                {isArabic ? 'ثبّت من المتجر' : 'Install from App Store'}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
                {isArabic ? 'التسويق عبر البريد الإلكتروني' : 'Email Marketing'}
              </h2>
              <p className="text-gray-400 mb-8 max-w-xl text-sm leading-7">
                {isArabic
                  ? 'ثبّت تطبيق التسويق عبر البريد من متجر التطبيقات لإنشاء الرسائل، وضبط SMTP، والإرسال التلقائي للفواتير والعروض.'
                  : 'Install Email Marketing from the App Store to compose, configure SMTP, and auto-send invoices and quotations.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                {[
                  { icon: Inbox,       en: 'Full Inbox',     ar: 'صندوق وارد كامل',   desc_en: 'Read, reply & manage', desc_ar: 'قراءة، رد وإدارة' },
                  { icon: Send,        en: 'Auto Delivery',  ar: 'تسليم تلقائي',       desc_en: 'Invoices sent instantly', desc_ar: 'فواتير ترسل فوراً' },
                  { icon: ShieldCheck, en: 'Verified Sender',ar: 'مرسل موثق',           desc_en: 'Platform & SMTP', desc_ar: 'منصة وSMTP' },
                ].map((f) => (
                  <div key={f.en} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center mb-3">
                      <f.icon className="w-4 h-4 text-primary-400" />
                    </div>
                    <p className="font-semibold text-white text-sm">{isArabic ? f.ar : f.en}</p>
                    <p className="text-xs text-gray-500 mt-1">{isArabic ? f.desc_ar : f.desc_en}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center lg:items-start">
                <Link
                  to="/app/dashboard/app-store"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/30"
                >
                  {isArabic ? 'فتح متجر التطبيقات' : 'Open App Store'}
                </Link>
                <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-primary-400" />
                  <a href={`mailto:${salesEmail}?subject=${contactSalesSubject}`} className="text-primary-300 hover:text-primary-200 transition-colors">
                    {salesEmail}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  /* ── FULL WORKSPACE ──────────────────────────────────────── */
  const senderName = currentEmailSettings?.senderName || tenant?.business?.legalNameEn || tenant?.name || '—'
  const senderEmail = currentEmailSettings?.fromEmail || currentEmailSettings?.requestedSenderEmail || tenant?.business?.contactEmail || ''

  return (
    <div className="flex flex-col h-full gap-0" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-teal-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-none">
              {isArabic ? 'التسويق عبر البريد' : 'Email Marketing'}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{senderEmail || senderName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isArabic ? 'مفعّل' : 'Active'}
          </span>
          <button
            onClick={() => messagesQuery.refetch()}
            className="p-2 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-all hover:shadow-sm"
            title={isArabic ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${messagesQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-all hover:shadow-sm"
            title={isArabic ? 'الإعدادات' : 'Settings'}
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setComposeState(buildComposeState()); setShowCcBcc(false) }}
            className="btn btn-secondary"
          >
            <PenSquare className="w-4 h-4" />
            {isArabic ? 'إنشاء' : 'Compose'}
          </button>
          <button
            onClick={() => setShowEmployeeEmail(true)}
            className="btn btn-primary"
          >
            <Users className="w-4 h-4" />
            {isArabic ? 'مراسلة موظف' : 'Email Employee'}
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
            <MailAvatar address={senderEmail || senderName} size={34} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{senderName}</p>
              <p className="text-[10px] text-gray-400 truncate">{senderEmail || (isArabic ? 'غير مُعدّ' : 'Not configured')}</p>
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
                  {/* To */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-700">
                    <span className="text-xs font-semibold text-gray-400 w-8 flex-shrink-0">{isArabic ? 'إلى' : 'To'}</span>
                    <input
                      value={composeState.to}
                      onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState()), to: e.target.value }))}
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
                          onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState()), cc: e.target.value }))}
                          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                          placeholder="cc@example.com"
                        />
                      </div>
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-700">
                        <span className="text-xs font-semibold text-gray-400 w-8 flex-shrink-0">BCC</span>
                        <input
                          value={composeState.bcc}
                          onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState()), bcc: e.target.value }))}
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
                      onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState()), subject: e.target.value }))}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                      placeholder={isArabic ? 'موضوع الرسالة' : 'Subject'}
                    />
                  </div>

                  {/* Body */}
                  <div className="px-5 pt-4 pb-2">
                    <textarea
                      value={composeState.bodyText}
                      onChange={(e) => setComposeState((c) => ({ ...(c || buildComposeState()), bodyText: e.target.value }))}
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
                        <button type="button" onClick={() => setComposeState(buildComposeState(selectedMessage))} className="btn btn-primary text-xs">
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
                <div className="flex-1 overflow-hidden p-0 relative bg-white dark:bg-white border-t border-gray-100 dark:border-dark-700">
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
                      <div className="flex items-center gap-2 mb-3">
                        <Paperclip className="w-4 h-4 text-gray-400" />
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {isArabic ? 'المرفقات' : 'Attachments'}
                          <span className="ms-1.5 text-xs text-gray-400">({selectedMessage.attachments.length})</span>
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedMessage.attachments.map((a, idx) => (
                          <button
                            key={`${a.name}-${idx}`}
                            type="button"
                            onClick={() => handleDownloadAttachment(a)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:border-primary-200 dark:hover:border-primary-800/40 transition-all text-start group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 flex items-center justify-center flex-shrink-0">
                              <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{a.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{a.type || 'file'}</p>
                            </div>
                            <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </motion.div>

            ) : (
              /* EMPTY STATE */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-5 p-12 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/10 to-teal-500/5 border border-primary-500/15 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{isArabic ? 'اختر رسالة' : 'Select a message'}</h3>
                  <p className="text-sm text-gray-400 mt-1">{isArabic ? 'أو قم بإنشاء رسالة جديدة' : 'Or compose a new one'}</p>
                </div>
                <button onClick={() => { setComposeState(buildComposeState()); setShowCcBcc(false) }} className="btn btn-primary">
                  <PenSquare className="w-4 h-4" />
                  {isArabic ? 'إنشاء رسالة' : 'Compose'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Settings modal */}
      <EmailSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(values) => settingsMutation.mutate(values)}
        isSaving={settingsMutation.isPending}
        language={language}
        initialSettings={currentEmailSettings}
        tenant={tenant}
      />

      {/* ── Email Employee Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showEmployeeEmail && (
          <>
            {/* Backdrop */}
            <motion.div
              key="emp-email-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowEmployeeEmail(false)}
            />
            {/* Slide-in panel */}
            <motion.div
              key="emp-email-panel"
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-dark-900 border-l border-gray-200 dark:border-dark-700 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-teal-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white text-sm leading-none">
                      {isArabic ? 'مراسلة موظف' : 'Email Employee'}
                    </h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {isArabic ? 'أرسل بريداً مباشراً لأي موظف' : 'Send a direct email to any employee'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmployeeEmail(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Employee selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                    {isArabic ? 'الموظف' : 'Employee'}
                  </label>
                  {employeesForEmailQuery.isLoading ? (
                    <div className="h-10 rounded-xl bg-gray-100 dark:bg-dark-700 animate-pulse" />
                  ) : (
                    <select
                      value={empEmailForm.employeeId}
                      onChange={(e) => setEmpEmailForm((f) => ({ ...f, employeeId: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                    >
                      <option value="">{isArabic ? '-- اختر موظفاً --' : '-- Select employee --'}</option>
                      {(employeesForEmailQuery.data?.employees || []).map((emp) => {
                        const name = isArabic
                          ? ([emp.firstNameAr, emp.lastNameAr].filter(Boolean).join(' ') || [emp.firstNameEn, emp.lastNameEn].filter(Boolean).join(' '))
                          : ([emp.firstNameEn, emp.lastNameEn].filter(Boolean).join(' ') || [emp.firstNameAr, emp.lastNameAr].filter(Boolean).join(' '))
                        return (
                          <option key={emp._id} value={emp._id} disabled={!emp.email}>
                            {name || emp.employeeId}{emp.email ? ` — ${emp.email}` : isArabic ? ' (لا بريد)' : ' (no email)'}
                          </option>
                        )
                      })}
                    </select>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                    {isArabic ? 'الموضوع' : 'Subject'}
                  </label>
                  <input
                    type="text"
                    value={empEmailForm.subject}
                    onChange={(e) => setEmpEmailForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder={isArabic ? 'موضوع الرسالة...' : 'Email subject...'}
                    className="w-full rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40 placeholder-gray-400"
                  />
                </div>

                {/* Body */}
                <div className="flex-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                    {isArabic ? 'نص الرسالة' : 'Message'}
                  </label>
                  <textarea
                    rows={10}
                    value={empEmailForm.body}
                    onChange={(e) => setEmpEmailForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder={isArabic ? 'اكتب رسالتك هنا...' : 'Type your message here...'}
                    className="w-full rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40 placeholder-gray-400 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-gray-200 dark:border-dark-700 flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowEmployeeEmail(false)}
                  className="btn btn-secondary flex-1"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    if (!empEmailForm.employeeId) { toast.error(isArabic ? 'اختر موظفاً' : 'Select an employee'); return }
                    if (!empEmailForm.subject.trim()) { toast.error(isArabic ? 'أدخل موضوع الرسالة' : 'Enter a subject'); return }
                    if (!empEmailForm.body.trim()) { toast.error(isArabic ? 'أدخل نص الرسالة' : 'Enter a message'); return }
                    sendEmployeeEmailMutation.mutate(empEmailForm)
                  }}
                  disabled={sendEmployeeEmailMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {sendEmployeeEmailMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isArabic ? 'إرسال' : 'Send'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

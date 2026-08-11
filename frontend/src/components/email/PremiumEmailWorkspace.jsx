import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Crown, Inbox, Mail, MailOpen, Paperclip, PenSquare, RefreshCw, Reply, Save, Search, Send, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { usePublicWebsiteSettings } from '../../lib/website'
import { sanitizeHtml } from '../../lib/sanitizeHtml'

const parseAddressList = (value) => String(value || '')
  .split(/[;,\n]+/)
  .map((item) => item.trim())
  .filter(Boolean)

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const plainTextToHtml = (value) => escapeHtml(value).replace(/\r?\n/g, '<br />')

const formatDateTime = (value, language) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    const base64 = result.includes(',') ? result.split(',').pop() : result
    resolve(base64 || '')
  }
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const folderOptions = (language) => ([
  { key: 'inbox', label: language === 'ar' ? 'الوارد' : 'Inbox', icon: Inbox },
  { key: 'sent', label: language === 'ar' ? 'المرسل' : 'Sent', icon: Send },
  { key: 'draft', label: language === 'ar' ? 'المسودات' : 'Drafts', icon: Save },
])

const buildComposeState = (message = null) => ({
  to: Array.isArray(message?.to) ? message.to.join(', ') : '',
  cc: Array.isArray(message?.cc) ? message.cc.join(', ') : '',
  bcc: Array.isArray(message?.bcc) ? message.bcc.join(', ') : '',
  subject: message?.subject || '',
  bodyText: message?.bodyText || '',
  attachments: Array.isArray(message?.attachments) ? message.attachments.map((attachment) => ({
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    contentBase64: attachment.contentBase64 || '',
    contentId: attachment.contentId || '',
  })) : [],
})

const statusPillClass = {
  platform: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200',
  custom_smtp: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200',
}

export default function PremiumEmailWorkspace() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { data: websiteSettings } = usePublicWebsiteSettings()
  const isArabic = language === 'ar'
  const hasEmailAddon = tenant?.subscription?.hasEmailAddon === true || (Array.isArray(tenant?.subscription?.features) && tenant.subscription.features.includes('email_automation'))

  const [activeFolder, setActiveFolder] = useState('inbox')
  const [search, setSearch] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState('')
  const [composeState, setComposeState] = useState(null)

  const salesPhone = websiteSettings?.contactPhone || '+966596775485'
  const salesEmail = websiteSettings?.contactEmail || 'info@maqder.com'
  const contactSalesSubject = encodeURIComponent('Email Automation Add-on')

  const emailSettingsQuery = useQuery({
    queryKey: ['tenant-email-settings'],
    queryFn: () => api.get('/email/settings').then((res) => res.data),
    enabled: hasEmailAddon,
  })

  const messagesQuery = useQuery({
    queryKey: ['tenant-email-messages', activeFolder, search],
    queryFn: () => api.get('/email/messages', { params: { folder: activeFolder, search } }).then((res) => res.data),
    enabled: hasEmailAddon,
  })

  const selectedMessageQuery = useQuery({
    queryKey: ['tenant-email-message', selectedMessageId],
    queryFn: () => api.get(`/email/messages/${selectedMessageId}`).then((res) => res.data),
    enabled: hasEmailAddon && !!selectedMessageId && !composeState,
  })

  const messages = messagesQuery.data?.messages || []
  const counts = messagesQuery.data?.counts || { inbox: { count: 0, unread: 0 }, sent: { count: 0, unread: 0 }, draft: { count: 0, unread: 0 } }
  const selectedMessage = selectedMessageQuery.data || messages.find((message) => message._id === selectedMessageId) || null
  const currentEmailSettings = emailSettingsQuery.data?.email || tenant?.settings?.communication?.email || {}

  useEffect(() => {
    if (composeState) return
    if (!messages.length) {
      setSelectedMessageId('')
      return
    }
    if (!selectedMessageId || !messages.some((message) => message._id === selectedMessageId)) {
      setSelectedMessageId(messages[0]._id)
    }
  }, [messages, selectedMessageId, composeState])

  const sendMutation = useMutation({
    mutationFn: (payload) => api.post('/email/send', payload).then((res) => res.data),
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
    onError: (error) => toast.error(error.userMessage || error.response?.data?.error || 'Failed to send email'),
  })

  const handleOpenMessage = async (message) => {
    if (!message) return
    if (message.type === 'draft') {
      setComposeState(buildComposeState(message))
      setSelectedMessageId(message._id)
      return
    }

    if (message.type === 'inbox' && !message.isRead) {
      try {
        await api.patch(`/email/messages/${message._id}/read`, { isRead: true })
      } catch {
      }
      queryClient.invalidateQueries({ queryKey: ['tenant-email-messages'] })
    }

    setComposeState(null)
    setSelectedMessageId(message._id)
  }

  const handleReply = () => {
    if (!selectedMessage) return
    setComposeState({
      to: selectedMessage.from || '',
      cc: '',
      bcc: '',
      subject: selectedMessage.subject?.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject || ''}`,
      bodyText: `\n\n----\n${selectedMessage.bodyText || ''}`,
      attachments: [],
    })
  }

  const handleAttachmentChange = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length || !composeState) return

    try {
      const nextAttachments = await Promise.all(files.map(async (file) => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        contentBase64: await readFileAsBase64(file),
      })))
      setComposeState((current) => ({
        ...(current || buildComposeState()),
        attachments: [...(current?.attachments || []), ...nextAttachments],
      }))
      event.target.value = ''
    } catch {
      toast.error(isArabic ? 'تعذر تحميل المرفق' : 'Failed to load attachment')
    }
  }

  const handleRemoveAttachment = (index) => {
    setComposeState((current) => ({
      ...(current || buildComposeState()),
      attachments: (current?.attachments || []).filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const handleDownloadAttachment = (attachment) => {
    if (!attachment) return
    if (attachment.contentBase64) {
      const byteCharacters = atob(attachment.contentBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let index = 0; index < byteCharacters.length; index += 1) {
        byteNumbers[index] = byteCharacters.charCodeAt(index)
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: attachment.type || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.name || 'attachment'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }

    if (attachment.url) {
      window.open(attachment.url, '_blank', 'noopener,noreferrer')
    }
  }

  const submitCompose = (saveAsDraft = false) => {
    const payload = {
      saveAsDraft,
      to: parseAddressList(composeState?.to),
      cc: parseAddressList(composeState?.cc),
      bcc: parseAddressList(composeState?.bcc),
      subject: String(composeState?.subject || '').trim(),
      bodyText: String(composeState?.bodyText || '').trim(),
      bodyHtml: plainTextToHtml(composeState?.bodyText || ''),
      attachments: (composeState?.attachments || []).map((attachment) => ({
        filename: attachment.name,
        contentType: attachment.type,
        size: attachment.size,
        contentBase64: attachment.contentBase64,
        contentId: attachment.contentId,
      })),
    }
    sendMutation.mutate(payload)
  }

  const folders = useMemo(() => folderOptions(language), [language])
  const folderStats = [
    { label: isArabic ? 'غير مقروءة' : 'Unread', value: counts.inbox?.unread || 0 },
    { label: isArabic ? 'مرسلة' : 'Sent', value: counts.sent?.count || 0 },
    { label: isArabic ? 'مسودات' : 'Drafts', value: counts.draft?.count || 0 },
  ]
  const providerKey = currentEmailSettings?.identityType === 'custom_smtp' ? 'custom_smtp' : 'platform'
  const providerLabel = providerKey === 'custom_smtp'
    ? (isArabic ? 'SMTP مخصص' : 'Custom SMTP')
    : (isArabic ? 'هوية مستضافة من المنصة' : 'Platform Identity')

  if (!hasEmailAddon) {
    return (
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[32px] border border-amber-200/70 bg-gradient-to-br from-[#1b3d2a] via-[#234c35] to-[#102416] p-8 text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.65)]">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
                <Crown className="h-4 w-4" />
                {isArabic ? 'تجربة بريد احترافية' : 'Premium Mail Experience'}
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight lg:text-4xl">{isArabic ? 'التواصل عبر البريد الإلكتروني' : 'Email Communication'}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 lg:text-base">{isArabic ? 'صندوق بريد احترافي مع إرسال تلقائي للفواتير، تتبع الرسائل، وهويات بريدية تدار مركزياً من قبل المشرف العام.' : 'A premium mailbox for your tenant with automated invoice delivery, message tracking, and centrally managed sender identities handled by super admin.'}</p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">{isArabic ? 'الوارد الكامل' : 'Full Inbox'}</p>
                  <p className="mt-2 text-sm text-white/85">{isArabic ? 'عرض الرسائل الواردة والمرسلة والمسودات في تجربة فاخرة.' : 'View inbox, sent mail, and drafts in a refined client experience.'}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">{isArabic ? 'فواتير ذكية' : 'Smart Invoices'}</p>
                  <p className="mt-2 text-sm text-white/85">{isArabic ? 'إرسال تلقائي للفواتير بقوالب ثنائية اللغة وهوية مرسل موثقة.' : 'Automatic invoice delivery with bilingual templates and verified sender identity.'}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">{isArabic ? 'مُدار مركزياً' : 'Centrally Managed'}</p>
                  <p className="mt-2 text-sm text-white/85">{isArabic ? 'يتم تفعيل وإعداد الهوية البريدية من لوحة المشرف العام فقط.' : 'Activation and email identity settings are managed only from the super-admin panel.'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                <Sparkles className="h-3.5 w-3.5" />
                {isArabic ? 'إضافة مطلوبة' : 'Add-on Required'}
              </div>
              <p className="mt-4 text-lg font-semibold">{isArabic ? 'قم بترقية اشتراك هذا المستأجر لتفعيل البريد' : 'Upgrade this tenant to activate premium email'}</p>
              <div className="mt-6 space-y-3 text-sm text-white/75">
                <p>{salesPhone}</p>
                <a href={`mailto:${salesEmail}?subject=${contactSalesSubject}`} className="inline-flex items-center gap-2 text-amber-100 transition hover:text-white">{salesEmail}</a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[34px] border border-emerald-100 bg-gradient-to-br from-[#143524] via-[#1d4830] to-[#0f2518] p-8 text-white shadow-[0_45px_120px_-50px_rgba(15,23,42,0.9)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.15),transparent_32%)]" />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md">
              <Crown className="h-4 w-4" />
              {isArabic ? 'صندوق بريد فاخر للمستأجر' : 'Premium Tenant Mailbox'}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">{isArabic ? 'التواصل عبر البريد' : 'Email Communication'}</h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isArabic ? 'الإضافة مفعلة' : 'Add-on Active'}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 lg:text-base">{isArabic ? 'واجهة بريد راقية للإرسال والمتابعة، بينما يتم ضبط الهوية والقوالب وSMTP حصرياً من المشرف العام للحفاظ على الاتساق والحماية.' : 'A refined email experience for reading and sending mail, while identity, templates, and SMTP are controlled exclusively by super admin for consistency and security.'}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {folderStats.map((item) => (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/55">{isArabic ? 'هوية المرسل' : 'Sender Identity'}</p>
                <h2 className="mt-2 text-xl font-semibold">{currentEmailSettings?.senderName || tenant?.business?.legalNameEn || tenant?.name}</h2>
                <p className="mt-2 text-sm text-white/70">{currentEmailSettings?.fromEmail || currentEmailSettings?.requestedSenderEmail || tenant?.business?.contactEmail || (isArabic ? 'غير محدد' : 'Not configured')}</p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass[providerKey] || statusPillClass.platform}`}>
                <Star className="h-3.5 w-3.5" />
                {providerLabel}
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">{isArabic ? 'الإدارة' : 'Management'}</p>
                <p className="mt-1 text-sm text-white/80">{isArabic ? 'يتم تعديل الإعدادات من لوحة المشرف العام فقط.' : 'Settings are managed from the super-admin panel only.'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">{isArabic ? 'العنوان الوارد' : 'Inbound Address'}</p>
                  <p className="mt-1 truncate text-sm text-white/80">{currentEmailSettings?.inboundAddress || `${tenant?.slug || 'tenant'}@inbound.maqder.local`}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">{isArabic ? 'الإرسال التلقائي' : 'Auto Send'}</p>
                  <p className="mt-1 text-sm text-white/80">{currentEmailSettings?.autoSendInvoices ? (isArabic ? 'مفعّل' : 'Enabled') : (isArabic ? 'غير مفعّل' : 'Disabled')}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="button" onClick={() => messagesQuery.refetch()} className="btn btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15 dark:text-white">
                  <RefreshCw className={`h-4 w-4 ${messagesQuery.isFetching ? 'animate-spin' : ''}`} />
                  {isArabic ? 'تحديث' : 'Refresh'}
                </button>
                <button type="button" onClick={() => setComposeState(buildComposeState())} className="btn btn-action-dark border-0 bg-white text-[#143524] hover:bg-emerald-50">
                  <PenSquare className="h-4 w-4" />
                  {isArabic ? 'رسالة جديدة' : 'Compose'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[290px_360px_minmax(0,1fr)]">
        <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} className="overflow-hidden rounded-[30px] border border-gray-200/70 bg-white/90 p-5 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur dark:border-dark-700 dark:bg-dark-900/85">
          <div className="rounded-[28px] bg-gradient-to-br from-[#163b27] to-[#245138] p-5 text-white shadow-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <Mail className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{currentEmailSettings?.senderName || tenant?.business?.legalNameEn || tenant?.name}</p>
                <p className="truncate text-sm text-white/70">{currentEmailSettings?.fromEmail || currentEmailSettings?.requestedSenderEmail || tenant?.business?.contactEmail || (isArabic ? 'غير محدد' : 'Not configured')}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {folders.map((folder) => {
              const Icon = folder.icon
              const folderMeta = counts?.[folder.key] || { count: 0, unread: 0 }
              const isActive = activeFolder === folder.key
              return (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => {
                    setActiveFolder(folder.key)
                    setComposeState(null)
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-start transition-all ${isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200' : 'border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:hover:border-dark-700 dark:hover:bg-dark-800'}`}
                >
                  <span className="flex items-center gap-3 font-medium">
                    <Icon className="h-4 w-4" />
                    {folder.label}
                  </span>
                  <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm dark:bg-dark-700 dark:text-gray-200">{folder.key === 'inbox' ? folderMeta.unread : folderMeta.count}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50/80 p-4 dark:border-dark-700 dark:bg-dark-800/70">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <Zap className="h-4 w-4 text-amber-500" />
              {isArabic ? 'ملاحظة إدارية' : 'Admin Notice'}
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{isArabic ? 'يمكنك استخدام البريد وإرسال الرسائل، لكن أي تعديل على الهوية أو SMTP أو القوالب يتم من قبل المشرف العام فقط.' : 'You can use the mailbox and send messages, but any changes to identity, SMTP, or templates are controlled by super admin only.'}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[30px] border border-gray-200/70 bg-white/90 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur dark:border-dark-700 dark:bg-dark-900/85">
          <div className="border-b border-gray-200/80 p-4 dark:border-dark-700">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-10" placeholder={isArabic ? 'ابحث في الرسائل...' : 'Search emails...'} />
            </div>
          </div>
          <div className="max-h-[760px] overflow-y-auto">
            {messagesQuery.isLoading ? (
              <div className="flex justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center px-8 py-12 text-center">
                <div className="rounded-3xl bg-emerald-50 p-4 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"><Mail className="h-8 w-8" /></div>
                <p className="mt-5 text-base font-semibold text-gray-900 dark:text-white">{isArabic ? 'لا توجد رسائل في هذا المجلد' : 'No messages in this folder yet'}</p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'استخدم زر إنشاء رسالة لبدء أول محادثة.' : 'Use compose to start the first conversation.'}</p>
              </div>
            ) : messages.map((message) => (
              <button
                key={message._id}
                type="button"
                onClick={() => handleOpenMessage(message)}
                className={`w-full border-b border-gray-100 px-5 py-4 text-start transition-colors last:border-b-0 dark:border-dark-800 ${selectedMessageId === message._id && !composeState ? 'bg-emerald-50/60 dark:bg-emerald-950/15' : 'hover:bg-gray-50 dark:hover:bg-dark-800/70'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {message.isRead ? <MailOpen className="h-4 w-4 text-gray-400" /> : <Mail className="h-4 w-4 text-emerald-600" />}
                      <p className={`truncate text-sm ${message.isRead ? 'font-medium text-gray-700 dark:text-gray-200' : 'font-semibold text-gray-900 dark:text-white'}`}>{message.subject || (isArabic ? 'بدون موضوع' : 'No subject')}</p>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{message.type === 'sent' ? (Array.isArray(message.to) ? message.to.join(', ') : '') : message.from}</p>
                    <p className="mt-2 max-h-10 overflow-hidden text-sm text-gray-500 dark:text-gray-400">{message.previewText || message.bodyText || ''}</p>
                  </div>
                  <div className="shrink-0 text-xs text-gray-400">{formatDateTime(message.createdAt, language)}</div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="overflow-hidden rounded-[30px] border border-gray-200/70 bg-white/90 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur dark:border-dark-700 dark:bg-dark-900/85">
          {composeState ? (
            <div className="flex h-full min-h-[760px] flex-col">
              <div className="border-b border-gray-200/80 bg-gradient-to-r from-emerald-50 to-white px-6 py-5 dark:border-dark-700 dark:from-emerald-950/10 dark:to-dark-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{isArabic ? 'إنشاء رسالة راقية' : 'Compose Premium Email'}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'الإرسال والتتبع متاحان، أما الإعدادات فتُدار من المشرف العام.' : 'Delivery and tracking are available here, while settings are managed by super admin.'}</p>
                  </div>
                  <button type="button" onClick={() => setComposeState(null)} className="btn btn-secondary">{isArabic ? 'إغلاق' : 'Close'}</button>
                </div>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div>
                  <label className="label">{isArabic ? 'إلى' : 'To'}</label>
                  <input value={composeState.to} onChange={(event) => setComposeState((current) => ({ ...(current || buildComposeState()), to: event.target.value }))} className="input" placeholder="customer@example.com" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">CC</label>
                    <input value={composeState.cc} onChange={(event) => setComposeState((current) => ({ ...(current || buildComposeState()), cc: event.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">BCC</label>
                    <input value={composeState.bcc} onChange={(event) => setComposeState((current) => ({ ...(current || buildComposeState()), bcc: event.target.value }))} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">{isArabic ? 'الموضوع' : 'Subject'}</label>
                  <input value={composeState.subject} onChange={(event) => setComposeState((current) => ({ ...(current || buildComposeState()), subject: event.target.value }))} className="input" placeholder={isArabic ? 'اكتب موضوع الرسالة' : 'Write the subject'} />
                </div>
                <div>
                  <label className="label">{isArabic ? 'الرسالة' : 'Message'}</label>
                  <textarea value={composeState.bodyText} onChange={(event) => setComposeState((current) => ({ ...(current || buildComposeState()), bodyText: event.target.value }))} rows={16} className="input min-h-[340px]" placeholder={isArabic ? 'اكتب محتوى البريد هنا...' : 'Write your email here...'} />
                </div>
                <div className="rounded-[26px] border border-dashed border-gray-300 bg-gray-50/70 p-5 dark:border-dark-600 dark:bg-dark-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{isArabic ? 'المرفقات' : 'Attachments'}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'أضف ملفات ليتم إرسالها مع الرسالة.' : 'Add files to send along with the email.'}</p>
                    </div>
                    <label className="btn btn-secondary cursor-pointer">
                      <Paperclip className="h-4 w-4" />
                      {isArabic ? 'إرفاق ملفات' : 'Attach Files'}
                      <input type="file" multiple className="hidden" onChange={handleAttachmentChange} />
                    </label>
                  </div>
                  {composeState.attachments?.length ? (
                    <div className="mt-4 space-y-2">
                      {composeState.attachments.map((attachment, index) => (
                        <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-dark-900">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900 dark:text-white">{attachment.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{attachment.size ? `${Math.max(1, Math.round(attachment.size / 1024))} KB` : attachment.type}</p>
                          </div>
                          <button type="button" onClick={() => handleRemoveAttachment(index)} className="text-sm font-medium text-red-600">{isArabic ? 'إزالة' : 'Remove'}</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-dark-700">
                <button type="button" onClick={() => submitCompose(true)} disabled={sendMutation.isPending} className="btn btn-secondary">
                  {sendMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" /> : <><Save className="h-4 w-4" />{isArabic ? 'حفظ كمسودة' : 'Save Draft'}</>}
                </button>
                <button type="button" onClick={() => submitCompose(false)} disabled={sendMutation.isPending} className="btn btn-action-dark">
                  {sendMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Send className="h-4 w-4" />{isArabic ? 'إرسال' : 'Send Email'}</>}
                </button>
              </div>
            </div>
          ) : selectedMessage ? (
            <div className="flex h-full min-h-[760px] flex-col">
              <div className="border-b border-gray-200/80 bg-gradient-to-r from-emerald-50 to-white px-6 py-5 dark:border-dark-700 dark:from-emerald-950/10 dark:to-dark-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedMessage.subject || (isArabic ? 'بدون موضوع' : 'No subject')}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>{selectedMessage.type === 'sent' ? `${isArabic ? 'إلى' : 'To'}: ${(selectedMessage.to || []).join(', ')}` : `${isArabic ? 'من' : 'From'}: ${selectedMessage.from}`}</span>
                      <span>{formatDateTime(selectedMessage.createdAt, language)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedMessage.type !== 'draft' ? (
                      <button type="button" onClick={handleReply} className="btn btn-secondary">
                        <Reply className="h-4 w-4" />
                        {isArabic ? 'رد' : 'Reply'}
                      </button>
                    ) : null}
                    {selectedMessage.type === 'draft' ? (
                      <button type="button" onClick={() => setComposeState(buildComposeState(selectedMessage))} className="btn btn-action-dark">
                        <PenSquare className="h-4 w-4" />
                        {isArabic ? 'تحرير' : 'Edit Draft'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="rounded-[28px] border border-gray-200 bg-white p-6 text-sm leading-7 text-gray-700 shadow-sm dark:border-dark-700 dark:bg-dark-900 dark:text-gray-200">
                  {selectedMessage.bodyHtml ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.bodyHtml) }} /> : <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-200">{selectedMessage.bodyText || ''}</pre>}
                </div>

                {selectedMessage.attachments?.length ? (
                  <div className="mt-6 rounded-[28px] border border-gray-200 bg-gray-50/80 p-5 dark:border-dark-700 dark:bg-dark-800/60">
                    <div className="mb-3 flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-emerald-600" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">{isArabic ? 'المرفقات' : 'Attachments'}</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedMessage.attachments.map((attachment, index) => (
                        <button key={`${attachment.name}-${index}`} type="button" onClick={() => handleDownloadAttachment(attachment)} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-start shadow-sm transition hover:bg-emerald-50 dark:bg-dark-900 dark:hover:bg-dark-700">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{attachment.name}</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{attachment.type || 'attachment'}</p>
                          </div>
                          <Paperclip className="h-4 w-4 text-emerald-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[760px] flex-col items-center justify-center gap-5 p-10 text-center">
              <div className="rounded-[28px] bg-emerald-50 p-5 text-emerald-700 shadow-inner dark:bg-emerald-950/30 dark:text-emerald-200">
                <Mail className="h-10 w-10" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{isArabic ? 'اختر رسالة لعرضها' : 'Select an email to view'}</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'يمكنك أيضاً إنشاء رسالة جديدة من الشريط العلوي.' : 'You can also start a new message from the top premium action bar.'}</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

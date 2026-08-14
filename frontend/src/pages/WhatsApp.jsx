import { useState, useEffect, useRef, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from '../lib/translations'
import { motion, AnimatePresence } from 'framer-motion'
import { Popover, Transition } from '@headlessui/react'
import {
  MessageCircle, Search, Send, Paperclip, Smile, MoreVertical,
  Phone, Video, Star, Archive, Trash2, Users, Settings, Plus,
  FileText, Zap, Radio, ChevronLeft, Check, CheckCheck, Clock,
  Image, File, MapPin, X, RefreshCw, Copy, Edit2, AlertCircle, Download
} from 'lucide-react'
import api from '../lib/api'
import WhatsAppCloudSetup from './components/WhatsAppCloudSetup'
import { isAppGateOpen } from '../lib/appStorePartners'

export default function WhatsApp() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState('chats')
  const [selectedContact, setSelectedContact] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showCloudSetup, setShowCloudSetup] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Fetch contacts
  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['whatsapp-contacts', searchQuery],
    queryFn: () => api.get('/whatsapp/contacts', { params: { search: searchQuery } }).then(r => r.data)
  })

  // Fetch messages for selected contact
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['whatsapp-messages', selectedContact?._id],
    queryFn: () => api.get(`/whatsapp/messages/${selectedContact._id}`).then(r => r.data),
    enabled: !!selectedContact?._id,
    refetchInterval: 5000
  })

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => api.get('/whatsapp/templates').then(r => r.data)
  })

  // Fetch quick replies
  const { data: quickReplies = [] } = useQuery({
    queryKey: ['whatsapp-quick-replies'],
    queryFn: () => api.get('/whatsapp/quick-replies').then(r => r.data)
  })

  // Fetch config
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => api.get('/whatsapp/config').then(r => r.data)
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['whatsapp-stats'],
    queryFn: () => api.get('/whatsapp/stats').then(r => r.data)
  })

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: (data) => api.post('/whatsapp/messages/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['whatsapp-messages', selectedContact?._id])
      queryClient.invalidateQueries(['whatsapp-contacts'])
      setMessageText('')
    }
  })

  // Star contact mutation
  const toggleStar = useMutation({
    mutationFn: (id) => api.post(`/whatsapp/contacts/${id}/star`),
    onSuccess: () => queryClient.invalidateQueries(['whatsapp-contacts'])
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesData])

  const refreshWhatsApp = () => {
    queryClient.invalidateQueries(['whatsapp-contacts'])
    queryClient.invalidateQueries(['whatsapp-messages', selectedContact?._id])
    queryClient.invalidateQueries(['whatsapp-templates'])
    queryClient.invalidateQueries(['whatsapp-quick-replies'])
    queryClient.invalidateQueries(['whatsapp-config'])
    queryClient.invalidateQueries(['whatsapp-stats'])
  }

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedContact) return
    sendMessage.mutate({ contactId: selectedContact._id, text: messageText })
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-SA', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return language === 'ar' ? 'اليوم' : 'Today'
    if (d.toDateString() === yesterday.toDateString()) return language === 'ar' ? 'أمس' : 'Yesterday'
    return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-SA')
  }

  const MessageStatus = ({ status }) => {
    switch (status) {
      case 'sent': return <Check className="w-3 h-3 text-gray-400" />
      case 'delivered': return <CheckCheck className="w-3 h-3 text-gray-400" />
      case 'read': return <CheckCheck className="w-3 h-3 text-blue-500" />
      case 'failed': return <AlertCircle className="w-3 h-3 text-red-500" />
      default: return <Clock className="w-3 h-3 text-gray-400" />
    }
  }

  const tabs = [
    { id: 'chats', label: language === 'ar' ? 'المحادثات' : 'Chats', icon: MessageCircle },
    { id: 'templates', label: language === 'ar' ? 'القوالب' : 'Templates', icon: FileText },
    { id: 'quick-replies', label: language === 'ar' ? 'الردود السريعة' : 'Quick Replies', icon: Zap },
    { id: 'broadcasts', label: language === 'ar' ? 'البث' : 'Broadcasts', icon: Radio }
  ]

  if (!isAppGateOpen(tenant, { requireApp: 'whatsapp_cloud_auto' })) {
    return (
      <div className="relative overflow-hidden rounded-[28px] bg-[#06140f] px-8 py-16 text-center text-white ring-1 ring-emerald-500/15">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#25D366] to-[#075E54]">
          <MessageCircle className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {language === 'ar' ? 'واتساب للأعمال — Cloud API' : 'WhatsApp Business Cloud API'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/55">
          {language === 'ar'
            ? 'ثبّت تطبيق واتساب من متجر التطبيقات لربط الرقم الرسمي وإرسال الفواتير تلقائياً.'
            : 'Install WhatsApp Business from the App Store to connect the official Cloud API and auto-send invoices.'}
        </p>
        <Link
          to="/app/dashboard/app-store"
          className="mt-8 inline-flex rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-emerald-950"
        >
          {language === 'ar' ? 'فتح متجر التطبيقات' : 'Open App Store'}
        </Link>
      </div>
    )
  }

  if (loadingConfig) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-3xl bg-[#06140f]">
        <RefreshCw className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    )
  }

  if (!config?.connected || showCloudSetup) {
    return (
      <WhatsAppCloudSetup
        language={language}
        onOpenInbox={config?.connected ? () => setShowCloudSetup(false) : undefined}
      />
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-gray-100 dark:bg-dark-900 rounded-2xl overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-dark-800 border-r border-gray-200 dark:border-dark-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              WhatsApp
            </h1>
            <div className="flex items-center gap-2">
              <Popover className="relative">
                <Popover.Button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/40">
                  <Plus className="w-5 h-5" />
                </Popover.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-150"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-100"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Popover.Panel className="absolute end-0 mt-2 w-72 origin-top-right rounded-2xl bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden z-50">
                    {({ close }) => (
                      <div>
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-700">
                          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {language === 'ar' ? 'إنشاء' : 'Create'}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {language === 'ar' ? 'إجراء سريع' : 'Quick actions'}
                          </p>
                        </div>
                        <div className="p-2">
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              setShowNewChatModal(true)
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <Users className="w-4 h-4 text-green-600" />
                            {language === 'ar' ? 'محادثة جديدة' : 'New Chat'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              setShowTemplateModal(true)
                              setActiveTab('templates')
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <FileText className="w-4 h-4 text-emerald-600" />
                            {language === 'ar' ? 'قالب جديد' : 'New Template'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              setShowQuickReplyModal(true)
                              setActiveTab('quick-replies')
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <Zap className="w-4 h-4 text-green-600" />
                            {language === 'ar' ? 'رد سريع جديد' : 'New Quick Reply'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              setShowBroadcastModal(true)
                              setActiveTab('broadcasts')
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <Radio className="w-4 h-4 text-green-600" />
                            {language === 'ar' ? 'بث جديد' : 'New Broadcast'}
                          </button>
                        </div>
                      </div>
                    )}
                  </Popover.Panel>
                </Transition>
              </Popover>

              <Popover className="relative">
                <Popover.Button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/40">
                  <Settings className="w-5 h-5" />
                </Popover.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-150"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-100"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Popover.Panel className="absolute end-0 mt-2 w-64 origin-top-right rounded-2xl bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden z-50">
                    {({ close }) => (
                      <div>
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-700">
                          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {language === 'ar' ? 'واتساب' : 'WhatsApp'}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {language === 'ar' ? 'الإعدادات والمزامنة' : 'Settings & sync'}
                          </p>
                        </div>
                        <div className="p-2">
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              setShowCloudSetup(true)
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <Settings className="w-4 h-4 text-green-600" />
                            {language === 'ar' ? 'إعداد Cloud API' : 'Cloud API setup'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              setShowSettings(true)
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <Settings className="w-4 h-4 text-emerald-600" />
                            {language === 'ar' ? 'الرد التلقائي' : 'Inbox auto-reply'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              refreshWhatsApp()
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <RefreshCw className="w-4 h-4 text-emerald-600" />
                            {language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close()
                              const link = document.createElement('a')
                              link.href = '/whatsapp/contacts/export?format=csv&type=all'
                              link.download = 'whatsapp-contacts.csv'
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm text-gray-800 dark:text-gray-200"
                          >
                            <Download className="w-4 h-4 text-blue-600" />
                            {language === 'ar' ? 'تصدير جهات الاتصال' : 'Export Contacts'}
                          </button>
                        </div>
                      </div>
                    )}
                  </Popover.Panel>
                </Transition>
              </Popover>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-600">{stats?.totalContacts || 0}</div>
              <div className="text-xs text-gray-500">{language === 'ar' ? 'جهات اتصال' : 'Contacts'}</div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-purple-600">{stats?.totalGroups || 0}</div>
              <div className="text-xs text-gray-500">{language === 'ar' ? 'مجموعات' : 'Groups'}</div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">{stats?.totalMessages || 0}</div>
              <div className="text-xs text-gray-500">{language === 'ar' ? 'رسائل' : 'Messages'}</div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-orange-600">{stats?.unreadMessages || 0}</div>
              <div className="text-xs text-gray-500">{language === 'ar' ? 'غير مقروء' : 'Unread'}</div>
            </div>
          </div>

          {config?.connected ? (
            <button
              type="button"
              onClick={() => setShowCloudSetup(true)}
              className="mb-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left dark:border-emerald-800 dark:bg-emerald-950/40"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {language === 'ar' ? 'Cloud API متصل' : 'Cloud API connected'}
              </p>
              <p className="truncate text-sm font-medium text-emerald-950 dark:text-emerald-50">
                {config.displayPhoneNumber || config.verifiedName || 'WhatsApp Business'}
              </p>
              {config.autoSendInvoices !== false ? (
                <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                  {language === 'ar' ? 'إرسال الفواتير التلقائي مفعّل' : 'Auto invoice send is on'}
                </p>
              ) : null}
            </button>
          ) : null}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ar' ? 'بحث في المحادثات...' : 'Search chats...'}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
                activeTab === tab.id
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content based on tab */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            <div className="divide-y divide-gray-100 dark:divide-dark-700">
              {loadingContacts ? (
                <div className="p-8 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                </div>
              ) : contactsData?.contacts?.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{language === 'ar' ? 'لا توجد محادثات' : 'No conversations yet'}</p>
                </div>
              ) : (
                contactsData?.contacts?.map((contact) => (
                  <button
                    key={contact._id}
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors ${
                      selectedContact?._id === contact._id ? 'bg-green-50 dark:bg-green-900/20' : ''
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${contact.isGroup ? 'bg-gradient-to-br from-purple-400 to-purple-600' : 'bg-gradient-to-br from-green-400 to-green-600'}`}>
                        {contact.isGroup ? <Users className="w-5 h-5" /> : (contact.name?.[0]?.toUpperCase() || contact.phoneNumber?.[0])}
                      </div>
                      {contact.isStarred && (
                        <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate flex items-center gap-1.5">
                          {contact.name || contact.formattedPhone}
                          {contact.isGroup && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">{language === 'ar' ? 'مجموعة' : 'Group'}</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400">
                          {contact.lastMessageAt && formatTime(contact.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 truncate">{contact.isGroup ? (contact.groupId || '') : (contact.formattedPhone || '')}</span>
                        {contact.unreadCount > 0 && (
                          <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {contact.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="p-4 space-y-3">
              <button
                onClick={() => setShowTemplateModal(true)}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {language === 'ar' ? 'قالب جديد' : 'New Template'}
              </button>
              {templates.map((template) => (
                <div key={template._id} className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{template.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      template.status === 'approved' ? 'bg-green-100 text-green-700' :
                      template.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {template.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{template.body}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'quick-replies' && (
            <div className="p-4 space-y-3">
              <button
                onClick={() => setShowQuickReplyModal(true)}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {language === 'ar' ? 'رد سريع جديد' : 'New Quick Reply'}
              </button>
              {quickReplies.map((reply) => (
                <div key={reply._id} className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-green-600">/{reply.shortcut}</span>
                    <span className="text-xs text-gray-500">{reply.usageCount} uses</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{reply.message}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'broadcasts' && (
            <div className="p-4 space-y-3">
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {language === 'ar' ? 'بث جديد' : 'New Broadcast'}
              </button>
              <div className="text-center text-gray-500 py-8">
                <Radio className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{language === 'ar' ? 'أنشئ بثاً للوصول للعديد من جهات الاتصال' : 'Create a broadcast to reach multiple contacts'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#e5ddd5] dark:bg-dark-900">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-dark-800 px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${selectedContact.isGroup ? 'bg-gradient-to-br from-purple-400 to-purple-600' : 'bg-gradient-to-br from-green-400 to-green-600'}`}>
                  {selectedContact.isGroup ? <Users className="w-5 h-5" /> : (selectedContact.name?.[0]?.toUpperCase() || selectedContact.phoneNumber?.[0])}
                </div>
                <div>
                  <h3 className="font-medium">{selectedContact.name || selectedContact.formattedPhone}</h3>
                  <p className="text-sm text-gray-500">{selectedContact.isGroup ? (selectedContact.groupId || '') : (selectedContact.formattedPhone || '')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStar.mutate(selectedContact._id)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                >
                  <Star className={`w-5 h-5 ${selectedContact.isStarred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}>
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {messagesData?.map((msg, idx) => {
                    const showDate = idx === 0 || 
                      new Date(msg.timestamp).toDateString() !== new Date(messagesData[idx - 1]?.timestamp).toDateString()
                    
                    return (
                      <div key={msg._id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="bg-white dark:bg-dark-700 px-3 py-1 rounded-lg text-xs text-gray-500 shadow-sm">
                              {formatDate(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                              msg.direction === 'outbound'
                                ? 'bg-[#dcf8c6] dark:bg-green-800 rounded-br-none'
                                : 'bg-white dark:bg-dark-700 rounded-bl-none'
                            }`}
                          >
                            {msg.type === 'image' && msg.mediaUrl && (
                              <img src={msg.mediaUrl} alt="" className="rounded-lg max-w-full mb-1" />
                            )}
                            {msg.type === 'document' && (
                              <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-600 rounded-lg p-2 mb-1">
                                <File className="w-8 h-8 text-gray-500" />
                                <span className="text-sm truncate">{msg.fileName}</span>
                              </div>
                            )}
                            {msg.type === 'location' && (
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-4 h-4" />
                                <span className="text-sm">{msg.location?.name || 'Location'}</span>
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.text || msg.caption}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] text-gray-500">{formatTime(msg.timestamp)}</span>
                              {msg.direction === 'outbound' && <MessageStatus status={msg.status} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-dark-800 p-3 border-t border-gray-200 dark:border-dark-700">
              <div className="flex items-end gap-2">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full">
                  <Smile className="w-6 h-6 text-gray-500" />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full">
                  <Paperclip className="w-6 h-6 text-gray-500" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={language === 'ar' ? 'اكتب رسالة...' : 'Type a message...'}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows={1}
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sendMessage.isPending}
                  className="p-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-full transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {language === 'ar' ? 'مرحباً بك في واتساب' : 'Welcome to WhatsApp'}
              </h2>
              <p className="text-gray-500 max-w-md">
                {language === 'ar' 
                  ? 'اختر محادثة من القائمة أو ابدأ محادثة جديدة'
                  : 'Select a conversation from the list or start a new chat'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal 
            config={config} 
            onClose={() => setShowSettings(false)} 
            language={language}
          />
        )}
      </AnimatePresence>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <NewChatModal
            onClose={() => setShowNewChatModal(false)}
            onSelect={(contact) => {
              setSelectedContact(contact)
              setShowNewChatModal(false)
            }}
            language={language}
          />
        )}
      </AnimatePresence>

      {/* Template Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <TemplateModal
            onClose={() => setShowTemplateModal(false)}
            language={language}
          />
        )}
      </AnimatePresence>

      {/* Quick Reply Modal */}
      <AnimatePresence>
        {showQuickReplyModal && (
          <QuickReplyModal
            onClose={() => setShowQuickReplyModal(false)}
            language={language}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Settings Modal Component
function SettingsModal({ config, onClose, language }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    phoneNumberId: config?.phoneNumberId || '',
    businessAccountId: config?.businessAccountId || '',
    accessToken: '',
    businessName: config?.businessName || '',
    autoReply: config?.autoReply || false,
    autoReplyMessage: config?.autoReplyMessage || '',
    isActive: config?.isActive || false
  })

  const updateConfig = useMutation({
    mutationFn: (data) => api.put('/whatsapp/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['whatsapp-config'])
      onClose()
    }
  })

  const testConnection = useMutation({
    mutationFn: () => api.post('/whatsapp/config/test')
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-[5%] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl bg-white dark:bg-dark-800 rounded-3xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden z-50"
      >
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 text-white">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'إعدادات واتساب' : 'WhatsApp Settings'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label">{language === 'ar' ? 'معرف رقم الهاتف' : 'Phone Number ID'}</label>
            <input
              type="text"
              value={formData.phoneNumberId}
              onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
              className="input"
              placeholder="123456789"
            />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'معرف حساب الأعمال' : 'Business Account ID'}</label>
            <input
              type="text"
              value={formData.businessAccountId}
              onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })}
              className="input"
              placeholder="123456789"
            />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'رمز الوصول' : 'Access Token'}</label>
            <input
              type="password"
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'اسم النشاط التجاري' : 'Business Name'}</label>
            <input
              type="text"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="input"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoReply"
              checked={formData.autoReply}
              onChange={(e) => setFormData({ ...formData, autoReply: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="autoReply" className="text-sm">
              {language === 'ar' ? 'تفعيل الرد التلقائي' : 'Enable Auto Reply'}
            </label>
          </div>
          {formData.autoReply && (
            <div>
              <label className="label">{language === 'ar' ? 'رسالة الرد التلقائي' : 'Auto Reply Message'}</label>
              <textarea
                value={formData.autoReplyMessage}
                onChange={(e) => setFormData({ ...formData, autoReplyMessage: e.target.value })}
                className="input"
                rows={3}
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="isActive" className="text-sm">
              {language === 'ar' ? 'تفعيل التكامل' : 'Enable Integration'}
            </label>
          </div>
        </div>
        <div className="flex justify-between gap-3 p-4 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={() => testConnection.mutate()}
            disabled={testConnection.isPending}
            className="btn btn-secondary"
          >
            {testConnection.isPending ? 'Testing...' : (language === 'ar' ? 'اختبار الاتصال' : 'Test Connection')}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary">{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button
              onClick={() => updateConfig.mutate(formData)}
              disabled={updateConfig.isPending}
              className="btn btn-primary"
            >
              {language === 'ar' ? 'حفظ' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// New Chat Modal Component
function NewChatModal({ onClose, onSelect, language }) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [name, setName] = useState('')
  const queryClient = useQueryClient()

  const createContact = useMutation({
    mutationFn: (data) => api.post('/whatsapp/contacts', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['whatsapp-contacts'])
      onSelect(response.data)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createContact.mutate({ phoneNumber, name })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-[5%] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-white dark:bg-dark-800 rounded-2xl shadow-xl z-50"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'محادثة جديدة' : 'New Chat'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'} *</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="input"
              placeholder="+966501234567"
              required
            />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'الاسم' : 'Name'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder={language === 'ar' ? 'اسم جهة الاتصال' : 'Contact name'}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={createContact.isPending} className="btn btn-primary">
              {language === 'ar' ? 'بدء المحادثة' : 'Start Chat'}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  )
}

// Template Modal Component
function TemplateModal({ onClose, language }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    language: 'en',
    category: 'utility',
    body: ''
  })

  const createTemplate = useMutation({
    mutationFn: (data) => api.post('/whatsapp/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['whatsapp-templates'])
      onClose()
    }
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-[5%] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-white dark:bg-dark-800 rounded-2xl shadow-xl z-50"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'قالب جديد' : 'New Template'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label">{language === 'ar' ? 'اسم القالب' : 'Template Name'} *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="order_confirmation"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'اللغة' : 'Language'}</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="select"
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الفئة' : 'Category'}</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="select"
              >
                <option value="utility">Utility</option>
                <option value="marketing">Marketing</option>
                <option value="authentication">Authentication</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'محتوى الرسالة' : 'Message Body'} *</label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="input"
              rows={4}
              placeholder={language === 'ar' ? 'مرحباً {{1}}، طلبك {{2}} جاهز للشحن.' : 'Hello {{1}}, your order {{2}} is ready for shipping.'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {language === 'ar' ? 'استخدم {{1}}, {{2}} للمتغيرات' : 'Use {{1}}, {{2}} for variables'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-dark-700">
          <button onClick={onClose} className="btn btn-secondary">{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
          <button
            onClick={() => createTemplate.mutate(formData)}
            disabled={createTemplate.isPending || !formData.name || !formData.body}
            className="btn btn-primary"
          >
            {language === 'ar' ? 'إنشاء' : 'Create'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// Quick Reply Modal Component
function QuickReplyModal({ onClose, language }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    shortcut: '',
    title: '',
    message: '',
    messageAr: ''
  })

  const createReply = useMutation({
    mutationFn: (data) => api.post('/whatsapp/quick-replies', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['whatsapp-quick-replies'])
      onClose()
    }
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-[5%] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-white dark:bg-dark-800 rounded-2xl shadow-xl z-50"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'رد سريع جديد' : 'New Quick Reply'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الاختصار' : 'Shortcut'} *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">/</span>
                <input
                  type="text"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.replace(/\s/g, '') })}
                  className="input pl-7"
                  placeholder="hello"
                />
              </div>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'العنوان' : 'Title'} *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                placeholder={language === 'ar' ? 'ترحيب' : 'Greeting'}
              />
            </div>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'الرسالة (EN)' : 'Message (EN)'} *</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="input"
              rows={3}
            />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'الرسالة (AR)' : 'Message (AR)'}</label>
            <textarea
              value={formData.messageAr}
              onChange={(e) => setFormData({ ...formData, messageAr: e.target.value })}
              className="input"
              rows={3}
              dir="rtl"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-dark-700">
          <button onClick={onClose} className="btn btn-secondary">{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
          <button
            onClick={() => createReply.mutate(formData)}
            disabled={createReply.isPending || !formData.shortcut || !formData.title || !formData.message}
            className="btn btn-primary"
          >
            {language === 'ar' ? 'إنشاء' : 'Create'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

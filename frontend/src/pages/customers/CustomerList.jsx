import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Building2,
  Users,
  Mail,
  Phone,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Receipt,
  CheckCircle2,
  Copy,
  Check,
  ArrowUpRight,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  MapPin,
  X,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import { getTenantBusinessTypes } from '../../lib/businessTypes'

export default function CustomerList() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const hasKhayyat = tenantBusinessTypes.includes('khayyat')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [copiedVat, setCopiedVat] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, type: typeFilter, isActive: statusFilter, page }],
    queryFn: () =>
      api
        .get('/customers', {
          params: {
            search: search.trim() || undefined,
            type: typeFilter || undefined,
            isActive: statusFilter || undefined,
            page,
            limit: 25,
          },
        })
        .then((res) => res.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: () => api.get('/customers/stats').then((res) => res.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['customer-stats'])
    },
  })

  const handleDelete = (id, name) => {
    if (
      window.confirm(
        isAr ? `هل أنت متأكد من حذف العميل "${name}"؟` : `Are you sure you want to deactivate customer "${name}"?`
      )
    ) {
      deleteMutation.mutate(id)
    }
  }

  const handleCopyVat = (e, vat) => {
    e.stopPropagation()
    if (!vat) return
    navigator.clipboard.writeText(vat)
    setCopiedVat(vat)
    setTimeout(() => setCopiedVat(null), 2000)
  }

  const exportColumns = [
    {
      key: 'customerCode',
      label: isAr ? 'رقم العميل' : 'Customer ID',
      value: (r) => r?.customerCode || '',
    },
    {
      key: 'name',
      label: isAr ? 'العميل' : 'Customer Name',
      value: (r) => (isAr ? r?.nameAr || r?.name : r?.name || r?.nameAr) || '',
    },
    {
      key: 'type',
      label: isAr ? 'النوع' : 'Type',
      value: (r) => (r?.type === 'business' ? (isAr ? 'شركة' : 'Business') : (isAr ? 'فرد' : 'Individual')),
    },
    {
      key: 'phone',
      label: isAr ? 'الهاتف' : 'Phone',
      value: (r) => r?.phone || r?.mobile || '',
    },
    {
      key: 'email',
      label: isAr ? 'البريد' : 'Email',
      value: (r) => r?.email || '',
    },
    {
      key: 'vatNumber',
      label: isAr ? 'الرقم الضريبي' : 'VAT Number',
      value: (r) => r?.vatNumber || r?.taxNumber || '',
    },
    {
      key: 'city',
      label: isAr ? 'المدينة' : 'City',
      value: (r) => r?.address?.city || '',
    },
    {
      key: 'totalInvoices',
      label: isAr ? 'الفواتير' : 'Invoices Count',
      value: (r) => r?.totalInvoices ?? 0,
    },
    {
      key: 'totalRevenue',
      label: isAr ? 'إجمالي الإيرادات' : 'Total Revenue',
      value: (r) => r?.totalRevenue ?? 0,
    },
    {
      key: 'status',
      label: isAr ? 'الحالة' : 'Status',
      value: (r) => (r?.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')),
    },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/customers', {
        params: {
          search: search.trim() || undefined,
          type: typeFilter || undefined,
          isActive: statusFilter || undefined,
          page: currentPage,
          limit,
        },
      })
      const batch = res.data?.customers || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  // Calculate live stats summary fallback
  const totalCount = stats?.total ?? data?.pagination?.total ?? 0
  const businessCount =
    stats?.byType?.find((t) => t._id === 'business')?.count ??
    data?.customers?.filter((c) => c.type === 'business').length ??
    0
  const individualCount =
    stats?.byType?.find((t) => t._id === 'individual')?.count ??
    data?.customers?.filter((c) => c.type === 'individual').length ??
    0
  const activeCount = stats?.active ?? data?.customers?.filter((c) => c.isActive !== false).length ?? totalCount
  const totalRevenue = stats?.totalRevenue ?? 0

  return (
    <div className="space-y-7 pb-12">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'إدارة العملاء والحسابات' : 'Customers & Accounts'}
            </h1>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300">
              {totalCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'دليل العملاء الشامل، السجلات الضريبية، كشوف الحسابات ومتابعة الإيرادات الفورية.'
              : 'Enterprise customer directory, ZATCA tax records, statements, and live trade history.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <ExportMenu
            language={language}
            t={t}
            rows={data?.customers || []}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={isAr ? 'دليل_العملاء' : 'Customers_Registry'}
            title={isAr ? 'تصدير دليل العملاء' : 'Export Customer Directory'}
            disabled={isLoading || (data?.customers || []).length === 0}
          />

          <Link
            to="/customers/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{isAr ? 'إضافة عميل جديد' : 'New Customer'}</span>
          </Link>
        </div>
      </div>

      {/* Ultra-Premium Bento Metric KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Directory */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-md dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Users className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {isAr ? 'الدليل الشامل' : 'Total Directory'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'إجمالي العملاء المسجلين' : 'Total Registered'}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {totalCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {isAr ? `${activeCount} عميل نشط في النظام` : `${activeCount} active client accounts`}
            </p>
          </div>
        </motion.div>

        {/* Corporate / B2B */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-md dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
              <Building2 className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              B2B
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'الشركات والمؤسسات' : 'Corporate Clients'}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {businessCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {isAr
                ? `${stats?.withVat || businessCount} شركة بسجل ضريبي معتمد`
                : `${stats?.withVat || businessCount} verified tax accounts`}
            </p>
          </div>
        </motion.div>

        {/* Individuals / Retail */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-md dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-sm">
              <Users className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
              B2C
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'الأفراد والعملاء المباشرين' : 'Retail Individuals'}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {individualCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {isAr ? 'فواتير مبسطة ونقاط بيع' : 'Simplified & POS billing'}
            </p>
          </div>
        </motion.div>

        {/* Trade Volume / Active */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-md dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
              <TrendingUp className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {isAr ? 'حجم التعاملات' : 'Trade Volume'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'إجمالي المبيعات المحققة' : 'Cumulative Sales'}
            </p>
            <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              <Money value={totalRevenue} />
            </div>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {isAr
                ? `${stats?.totalInvoices || 0} فاتورة مصدرة عبر النظام`
                : `${stats?.totalInvoices || 0} total invoices processed`}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Search, Filter Toolbar & Category Selector */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isAr ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder={
                isAr
                  ? 'بحث سريع بالاسم، رقم العميل، الرقم الضريبي، الهاتف، أو المدينة...'
                  : 'Search by client name, ID #, VAT number, phone, or city...'
              }
              className={`h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-slate-900 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800/60 dark:text-white dark:focus:border-white ${
                isAr ? 'pr-10 pl-9' : 'pl-10 pr-9'
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white ${
                  isAr ? 'left-3.5' : 'right-3.5'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Segmented Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter Buttons */}
            <div className="inline-flex rounded-2xl border border-slate-200/90 bg-slate-100/70 p-1 dark:border-white/10 dark:bg-dark-800">
              {[
                { id: '', en: 'All', ar: 'الكل' },
                { id: 'business', en: 'Companies (B2B)', ar: 'شركات' },
                { id: 'individual', en: 'Individuals (B2C)', ar: 'أفراد' },
              ].map((btn) => {
                const active = typeFilter === btn.id
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => {
                      setTypeFilter(btn.id)
                      setPage(1)
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      active
                        ? 'bg-white text-slate-950 shadow-2xs dark:bg-white/15 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {isAr ? btn.ar : btn.en}
                  </button>
                )
              })}
            </div>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 text-xs font-bold text-slate-700 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
            >
              <option value="">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="true">{isAr ? 'العملاء النشطين' : 'Active Only'}</option>
              <option value="false">{isAr ? 'العملاء المعطلين' : 'Inactive Only'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Customers List & Table View */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-[#0c111a]"
      >
        {isLoading ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-700 dark:border-t-white" />
            <p className="text-xs text-slate-400">{isAr ? 'جاري تحميل دليل العملاء...' : 'Loading customer directory...'}</p>
          </div>
        ) : data?.customers?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-dark-800 dark:text-slate-500">
              <Users className="h-8 w-8 stroke-[1.8]" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'لم يتم العثور على أي عملاء' : 'No Customers Found'}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              {search || typeFilter || statusFilter
                ? isAr
                  ? 'لا توجد نتائج تطابق معايير البحث والفلترة المحددة. جرب كلمة بحث أخرى.'
                  : 'No customer records match your filter criteria. Try resetting filters.'
                : isAr
                ? 'ابدأ بإضافة أول عميل إلى نظام الفوترة وسجلات الحسابات.'
                : 'Start building your directory by adding your first enterprise client.'}
            </p>
            <div className="mt-6 flex gap-3">
              {(search || typeFilter || statusFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setTypeFilter('')
                    setStatusFilter('')
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-dark-800"
                >
                  {isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                </button>
              )}
              <Link
                to="/customers/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>{isAr ? 'إضافة عميل' : 'Add Customer'}</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                    <th className="py-3.5 px-5 text-start">{isAr ? 'العميل والسجل' : 'Customer & Identity'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'التصنيف' : 'Type'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'قنوات الاتصال' : 'Contact & WhatsApp'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الرقم الضريبي (ZATCA)' : 'VAT Number'}</th>
                    {hasKhayyat ? (
                      <>
                        <th className="py-3.5 px-4 text-center">{isAr ? 'الثياب' : 'Thawbs'}</th>
                        <th className="py-3.5 px-4 text-end">{isAr ? 'المدفوع' : 'Paid'}</th>
                        <th className="py-3.5 px-4 text-end">{isAr ? 'المتبقي' : 'Pending'}</th>
                      </>
                    ) : (
                      <th className="py-3.5 px-4 text-end">{isAr ? 'الفواتير والإيراد' : 'Invoices & Revenue'}</th>
                    )}
                    <th className="py-3.5 px-5 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {data?.customers?.map((customer) => {
                    const name = isAr ? customer.nameAr || customer.name : customer.name || customer.nameAr
                    const isBiz = customer.type === 'business'
                    const vat = customer.vatNumber || customer.taxNumber

                    return (
                      <tr
                        key={customer._id}
                        onClick={() => navigate(`/customers/${customer._id}`)}
                        className="group cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                      >
                        {/* Customer & Avatar */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black uppercase text-white shadow-2xs ${
                                isBiz
                                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                                  : 'bg-gradient-to-br from-emerald-600 to-teal-600'
                              }`}
                            >
                              {isBiz ? (
                                <Building2 className="h-5 w-5 stroke-[2.2]" />
                              ) : (
                                <Users className="h-5 w-5 stroke-[2.2]" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400 transition-colors">
                                  {name}
                                </span>
                                {customer.customerCode && (
                                  <span className="font-mono text-[10.5px] font-bold text-slate-500 bg-slate-100 dark:bg-white/5 dark:text-slate-400 px-1.5 py-0.5 rounded-md">
                                    #{customer.customerCode}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                                {customer.address?.city && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <MapPin className="h-3 w-3" />
                                    {customer.address.city}
                                  </span>
                                )}
                                {customer.crNumber && (
                                  <span>
                                    {isAr ? 'س.ت: ' : 'CR: '}
                                    <span className="font-mono">{customer.crNumber}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                              isBiz
                                ? 'border-blue-500/20 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                                : 'border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            }`}
                          >
                            {isBiz ? (isAr ? 'شركة' : 'Business') : (isAr ? 'فرد' : 'Individual')}
                          </span>
                        </td>

                        {/* Contact Channels */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-1">
                            {customer.phone ? (
                              <div className="flex items-center gap-2">
                                <a
                                  href={`tel:${customer.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-mono text-slate-700 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                                >
                                  {customer.phone}
                                </a>
                                <a
                                  href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title={isAr ? 'محادثة واتساب مباشرة' : 'Direct WhatsApp chat'}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-500/10 dark:text-emerald-400 transition-colors"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            ) : customer.email ? (
                              <a
                                href={`mailto:${customer.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-600 hover:text-emerald-600 dark:text-slate-400"
                              >
                                {customer.email}
                              </a>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </div>
                        </td>

                        {/* VAT Number & Copy */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {vat ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {vat}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyVat(e, vat)}
                                title={isAr ? 'نسخ الرقم الضريبي' : 'Copy VAT Number'}
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white transition"
                              >
                                {copiedVat === vat ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[3]" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">{isAr ? 'غير مسجل' : 'No VAT'}</span>
                          )}
                        </td>

                        {/* Khayyat or Revenue */}
                        {hasKhayyat ? (
                          <>
                            <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                              {customer.totalThawb || 0}
                            </td>
                            <td className="py-3.5 px-4 text-end font-bold text-emerald-600 dark:text-emerald-400">
                              <Money value={customer.khayyatPaidAmount || 0} minimumFractionDigits={0} />
                            </td>
                            <td className="py-3.5 px-4 text-end font-bold text-rose-600 dark:text-rose-400">
                              <Money value={customer.khayyatPendingAmount || 0} minimumFractionDigits={0} />
                            </td>
                          </>
                        ) : (
                          <td className="py-3.5 px-4 text-end whitespace-nowrap">
                            <p className="font-mono font-bold text-slate-900 dark:text-white">
                              <Money value={customer.totalRevenue || 0} minimumFractionDigits={0} />
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {customer.totalInvoices || 0} {isAr ? 'فاتورة' : 'invoices'}
                            </p>
                          </td>
                        )}

                        {/* Row Actions Menu */}
                        <td className="py-3.5 px-5 text-end whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Fast Action: Create Invoice */}
                            <Link
                              to={`/app/dashboard/invoices/new/sell?customerId=${customer._id}`}
                              title={isAr ? 'إنشاء فاتورة لهذا العميل' : 'Create Sales Invoice'}
                              className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300 dark:hover:bg-dark-700"
                            >
                              <Plus className="h-3 w-3" />
                              <span>{isAr ? 'فاتورة' : 'Invoice'}</span>
                            </Link>

                            {/* Dropdown Menu */}
                            <Menu as="div" className="relative">
                              <Menu.Button className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white transition">
                                <MoreVertical className="h-4 w-4" />
                              </Menu.Button>

                              <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                              >
                                <Menu.Items className="absolute end-0 mt-1 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 focus:outline-none dark:border-white/10 dark:bg-dark-800 z-20 text-start">
                                  <Menu.Item>
                                    {({ active }) => (
                                      <Link
                                        to={`/customers/${customer._id}`}
                                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                                          active ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        <span>{isAr ? 'عرض الملف' : 'View Profile'}</span>
                                      </Link>
                                    )}
                                  </Menu.Item>

                                  <Menu.Item>
                                    {({ active }) => (
                                      <Link
                                        to={`/app/dashboard/customers/${customer._id}/statement`}
                                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                                          active ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
                                        <span>{isAr ? 'كشف الحساب' : 'Account Statement'}</span>
                                      </Link>
                                    )}
                                  </Menu.Item>

                                  <Menu.Item>
                                    {({ active }) => (
                                      <Link
                                        to={`/customers/${customer._id}/edit`}
                                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                                          active ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        <Edit className="h-3.5 w-3.5 text-amber-500" />
                                        <span>{isAr ? 'تعديل البيانات' : 'Edit Customer'}</span>
                                      </Link>
                                    )}
                                  </Menu.Item>

                                  <div className="my-1 border-t border-slate-100 dark:border-white/5" />

                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(customer._id, name)}
                                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 ${
                                          active ? 'bg-rose-50 dark:bg-rose-500/10' : ''
                                        }`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>{isAr ? 'تعطيل / حذف' : 'Deactivate'}</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                </Menu.Items>
                              </Transition>
                            </Menu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data?.pagination?.pages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                <p>
                  {isAr
                    ? `عرض ${(page - 1) * 25 + 1} إلى ${Math.min(page * 25, data.pagination.total)} من أصل ${data.pagination.total} عميل`
                    : `Showing ${(page - 1) * 25 + 1} to ${Math.min(page * 25, data.pagination.total)} of ${data.pagination.total} customers`}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                  >
                    {isAr ? 'السابق' : 'Previous'}
                  </button>
                  <span className="font-bold text-slate-700 dark:text-white">
                    {page} / {data.pagination.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                    disabled={page === data.pagination.pages}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                  >
                    {isAr ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}

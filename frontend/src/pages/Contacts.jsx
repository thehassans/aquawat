import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Users, Building2, Briefcase, Phone, Mail, Hash, MessageCircle, MessageSquare, ArrowUpRight, UserRound, Plus, ChevronDown } from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import ExportMenu from '../components/ui/ExportMenu'
import QuickCreateContactModal from '../components/inventory/QuickCreateContactModal'

const typeMeta = {
  customer: { en: 'Customer', ar: 'عميل', icon: Building2, tint: 'bg-sky-50 text-sky-700', ring: 'ring-sky-100' },
  supplier: { en: 'Supplier', ar: 'مورد', icon: Briefcase, tint: 'bg-amber-50 text-amber-800', ring: 'ring-amber-100' },
  employee: { en: 'Employee', ar: 'موظف', icon: Users, tint: 'bg-emerald-50 text-emerald-800', ring: 'ring-emerald-100' },
  whatsapp: { en: 'WhatsApp', ar: 'واتساب', icon: MessageCircle, tint: 'bg-green-50 text-green-800', ring: 'ring-green-100' },
  whatsapp_group: { en: 'Group', ar: 'مجموعة', icon: MessageSquare, tint: 'bg-violet-50 text-violet-800', ring: 'ring-violet-100' },
}

const getEntityRoute = (contact) => {
  if (contact?.entityType === 'customer') return `/app/dashboard/customers/${contact.entityId}`
  if (contact?.entityType === 'supplier') return `/app/dashboard/suppliers/${contact.entityId}`
  if (contact?.entityType === 'employee') return `/app/dashboard/employees/${contact.entityId}`
  return null
}

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '•'

export default function Contacts() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const typesParam = searchParams.get('types') || ''
  const initialType = typesParam.includes(',') ? '' : (typesParam || '')

  const [search, setSearch] = useState('')
  const [type, setType] = useState(initialType)
  const [isActive, setIsActive] = useState('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [createRole, setCreateRole] = useState('customer')
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

  useEffect(() => {
    if (!typesParam) return
    if (typesParam.includes(',')) {
      setType('')
    } else if (['customer', 'supplier', 'employee', 'whatsapp'].includes(typesParam)) {
      setType(typesParam)
    }
  }, [typesParam])

  const queryTypes = type || (typesParam.includes(',') ? typesParam : undefined)
  const partnerHub = typesParam.includes('customer') && typesParam.includes('supplier')

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', { search, type: queryTypes, isActive, page }],
    queryFn: () =>
      api
        .get('/contacts', {
          params: { search, types: queryTypes || undefined, isActive, page, limit: 25 },
        })
        .then((res) => res.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['contacts-stats', { isActive }],
    queryFn: () => api.get('/contacts/stats', { params: { isActive } }).then((res) => res.data),
  })

  const contacts = data?.contacts || []
  const pagination = data?.pagination
  const totals = stats?.byType || { customers: 0, suppliers: 0, employees: 0, whatsapp: 0, whatsappGroups: 0 }
  const totalContacts = stats?.total || 0

  const rows = useMemo(() => {
    return contacts.map((c) => {
      const meta = typeMeta[c.entityType] || { en: c.entityType, ar: c.entityType, icon: UserRound, tint: 'bg-slate-50 text-slate-700' }
      return {
        ...c,
        meta,
        name: isAr ? c.displayNameAr || c.displayName : c.displayName,
        route: getEntityRoute(c),
        Icon: meta.icon,
      }
    })
  }, [contacts, isAr])

  const exportColumns = [
    { key: 'name', label: isAr ? 'الاسم' : 'Name', value: (r) => r?.name || '' },
    { key: 'type', label: isAr ? 'النوع' : 'Type', value: (r) => (isAr ? r?.meta?.ar : r?.meta?.en) || r?.entityType || '' },
    { key: 'phone', label: isAr ? 'الهاتف' : 'Phone', value: (r) => r?.phone || '' },
    { key: 'email', label: isAr ? 'البريد' : 'Email', value: (r) => r?.email || '' },
    { key: 'code', label: isAr ? 'الرمز' : 'Code', value: (r) => r?.code || '' },
    { key: 'vatNumber', label: isAr ? 'الرقم الضريبي' : 'VAT', value: (r) => r?.vatNumber || '' },
    { key: 'status', label: t('status'), value: (r) => (r?.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')) },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []
    while (true) {
      const res = await api.get('/contacts', { params: { search, types: queryTypes || undefined, isActive, page: currentPage, limit } })
      const batch = res.data?.contacts || []
      all = all.concat(batch.map((c) => {
        const meta = typeMeta[c.entityType] || { en: c.entityType, ar: c.entityType }
        return { ...c, meta, name: isAr ? c.displayNameAr || c.displayName : c.displayName }
      }))
      if (currentPage >= (res.data?.pagination?.pages || 1) || all.length >= 10000) break
      currentPage += 1
    }
    return all
  }

  const setTypeFilter = (next) => {
    setType((cur) => (cur === next ? '' : next))
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('types', next)
    else if (partnerHub) params.set('types', 'customer,supplier')
    else params.delete('types')
    setSearchParams(params, { replace: true })
  }

  const openCreate = (role) => {
    setCreateRole(role)
    setCreateMenuOpen(false)
    setCreateOpen(true)
  }

  const tiles = [
    { key: '', label: isAr ? 'الكل' : 'All', value: partnerHub ? (totals.partners || totals.customers || 0) : totalContacts, icon: Users, active: type === '' },
    { key: 'customer', label: isAr ? 'العملاء' : 'Customers', value: totals.customers || 0, icon: Building2, active: type === 'customer' },
    { key: 'supplier', label: isAr ? 'الموردون' : 'Suppliers', value: totals.suppliers || 0, icon: Briefcase, active: type === 'supplier' },
    ...(!partnerHub ? [
      { key: 'employee', label: isAr ? 'الموظفون' : 'Employees', value: totals.employees || 0, icon: Users, active: type === 'employee' },
      { key: 'whatsapp', label: 'WhatsApp', value: (totals.whatsapp || 0) + (totals.whatsappGroups || 0), icon: MessageCircle, active: type === 'whatsapp' },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            {partnerHub ? (isAr ? 'الشركاء' : 'Partners') : (isAr ? 'الدليل' : 'Directory')}
          </p>
          <h1 className="mt-1 font-[Outfit,sans-serif] text-3xl font-semibold tracking-tight text-slate-800 dark:text-white">
            {partnerHub
              ? (isAr ? 'جهات الاتصال — عملاء وموردون' : 'Contacts — customers & suppliers')
              : (isAr ? 'جهات الاتصال' : 'Contacts')}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {partnerHub
              ? (isAr
                ? 'دليل موحّد للعملاء والموردين. يُضبط نوع المحاسبة تلقائياً حسب سياق الإنشاء.'
                : 'Unified partner book. Accounting flags are set automatically from create context.')
              : (isAr ? 'دليل موحّد للعملاء والموردين والموظفين.' : 'One book for customers, suppliers, employees, and WhatsApp.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className="btn btn-action-dark"
              onClick={() => setCreateMenuOpen((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              {isAr ? 'إنشاء' : 'Create'}
              <ChevronDown className={`h-4 w-4 transition ${createMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {createMenuOpen && (
              <div className="absolute end-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-start hover:bg-slate-50 dark:hover:bg-dark-700"
                  onClick={() => openCreate('customer')}
                >
                  <Building2 className="mt-0.5 h-4 w-4 text-sky-700" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{isAr ? 'عميل' : 'Customer'}</span>
                    <span className="block text-xs text-slate-400">{isAr ? 'يُعلَّم كعميل تلقائياً' : 'Sets is_customer automatically'}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-start hover:bg-slate-50 dark:hover:bg-dark-700"
                  onClick={() => openCreate('vendor')}
                >
                  <Briefcase className="mt-0.5 h-4 w-4 text-amber-700" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{isAr ? 'مورد' : 'Supplier'}</span>
                    <span className="block text-xs text-slate-400">{isAr ? 'يُعلَّم كمورد تلقائياً' : 'Sets is_vendor automatically'}</span>
                  </span>
                </button>
                <Link
                  to="/app/dashboard/customers/new"
                  className="block border-t border-slate-100 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 dark:border-dark-600"
                  onClick={() => setCreateMenuOpen(false)}
                >
                  {isAr ? 'إنشاء عميل متقدم…' : 'Advanced customer form…'}
                </Link>
                <Link
                  to="/app/dashboard/suppliers/new"
                  className="block px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
                  onClick={() => setCreateMenuOpen(false)}
                >
                  {isAr ? 'إنشاء مورد متقدم…' : 'Advanced supplier form…'}
                </Link>
              </div>
            )}
          </div>
          <ExportMenu
            language={language}
            t={t}
            rows={rows}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={isAr ? 'جهات_الاتصال' : 'Contacts'}
            title={isAr ? 'جهات الاتصال' : 'Contacts'}
            disabled={isLoading || rows.length === 0}
          />
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${partnerHub ? 'lg:grid-cols-3' : 'lg:grid-cols-5'}`}>
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <button
              key={tile.key || 'all'}
              type="button"
              onClick={() => setTypeFilter(tile.key)}
              className={`rounded-2xl border p-4 text-start transition ${
                tile.active
                  ? 'border-slate-200 bg-white shadow-sm ring-1 ring-slate-100'
                  : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-[Outfit,sans-serif] text-2xl font-semibold tabular-nums text-slate-800">{Number(tile.value).toLocaleString()}</span>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{tile.label}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isAr ? 'بحث بالاسم أو الهاتف أو الرقم الضريبي' : 'Search name, phone, email, or VAT'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 ps-10 pe-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-700/10"
            />
          </div>
          <select
            value={isActive}
            onChange={(e) => { setIsActive(e.target.value); setPage(1) }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm sm:w-44"
          >
            <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
            <option value="true">{isAr ? 'نشط فقط' : 'Active only'}</option>
            <option value="false">{isAr ? 'غير نشط' : 'Inactive'}</option>
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto rounded-[28px] border border-slate-100 bg-white">
        {isLoading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <UserRound className="h-6 w-6" />
            </div>
            <p className="mt-4 font-[Outfit,sans-serif] text-lg font-semibold text-slate-800">{isAr ? 'لا توجد جهات في هذا العرض' : 'No contacts in this view'}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              {isAr ? 'أنشئ عميلاً أو مورداً من زر الإنشاء أعلاه.' : 'Create a customer or supplier with the Create button above.'}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-start text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <th className="min-w-[150px] px-5 py-3 font-semibold">{isAr ? 'الاسم' : 'Name'}</th>
                <th className="min-w-[120px] px-3 py-3 font-semibold">{isAr ? 'النوع' : 'Type'}</th>
                <th className="min-w-[150px] px-3 py-3 font-semibold">{isAr ? 'التواصل' : 'Reach'}</th>
                <th className="min-w-[140px] px-3 py-3 font-semibold">{isAr ? 'الرمز / الضريبة' : 'Code / VAT'}</th>
                <th className="min-w-[100px] px-3 py-3 font-semibold">{t('status')}</th>
                <th className="min-w-[80px] px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={`${c.entityType}-${c.entityId}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                  <td className="min-w-[150px] px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${c.meta.tint}`}>
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{c.name || '—'}</p>
                        {c.displayNameAr && !isAr && <p className="truncate text-xs text-slate-400" dir="rtl">{c.displayNameAr}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="min-w-[120px] px-3 py-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap gap-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.meta.tint}`}>
                          <c.Icon className="h-3.5 w-3.5" />
                          {isAr ? c.meta.ar : c.meta.en}
                        </span>
                        {c.isCustomer && c.isVendor ? (
                          <>
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                              {isAr ? 'مورد' : 'Vendor'}
                            </span>
                            <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-800">
                              {isAr ? 'عميل' : 'Customer'}
                            </span>
                          </>
                        ) : null}
                      </div>
                      {c.isCustomer && c.isVendor ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/app/dashboard/customers/${c.entityId}`}
                            className="text-[10px] font-medium text-sky-700 hover:underline"
                          >
                            {isAr ? 'فتح كعميل' : 'Open as customer'}
                          </Link>
                          <Link
                            to={`/app/dashboard/suppliers/${c.entityId}`}
                            className="text-[10px] font-medium text-amber-700 hover:underline"
                          >
                            {isAr ? 'فتح كمورد' : 'Open as supplier'}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="min-w-[150px] px-3 py-3.5">
                    <div className="space-y-0.5">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}
                        </a>
                      ) : null}
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />{c.email}
                        </a>
                      ) : null}
                      {!c.phone && !c.email && <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="min-w-[140px] px-3 py-3.5 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1">{c.code ? <><Hash className="h-3 w-3" />{c.code}</> : '—'}</div>
                    <div>{c.vatNumber || ''}</div>
                  </td>
                  <td className="min-w-[100px] px-3 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {c.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                    </span>
                  </td>
                  <td className="min-w-[80px] px-5 py-3.5 text-end">
                    {c.route ? (
                      <Link to={c.route} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800">
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    ) : c.entityType?.startsWith('whatsapp') ? (
                      <Link to={`/app/dashboard/whatsapp?contact=${c.entityId}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-green-600 hover:bg-green-50">
                        <MessageCircle className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {isAr ? 'السابق' : 'Previous'}
          </button>
          <span>{isAr ? 'صفحة' : 'Page'} {page} / {pagination.pages}</span>
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" disabled={page >= pagination.pages} onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}>
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      <QuickCreateContactModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        role={createRole}
        ar={isAr}
        language={language}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['contacts'] })
          qc.invalidateQueries({ queryKey: ['contacts-stats'] })
        }}
      />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Users, Building2, Briefcase, Phone, Mail, Hash, MessageCircle, MessageSquare, ArrowUpRight, UserRound, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { buildDefaultFileName, exportToCsv } from '../lib/export'
import ExportMenu from '../components/ui/ExportMenu'
import ContactsCreateMenu from '../components/contacts/ContactsCreateMenu'
import {
  avatarClass,
  contactTabClass,
  contactsEyebrowClass,
  contactsSubtitleClass,
  contactsTableClass,
  contactsTdClass,
  contactsThClass,
  contactsTitleClass,
  contactsTrClass,
  emptyStateClass,
  filterBarClass,
  ghostActionClass,
  listShellClass,
  outlinedBtnClass,
  paginationBarClass,
  rowActionPrimaryClass,
  rowActionsWrapClass,
  searchInputClass,
  statusActiveClass,
  statusInactiveClass,
  typeChipClass,
} from './contacts/contactsUi'

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
  if (contact?.entityType === 'employee') {
    if (contact?.isPartnerEmployee) return `/app/dashboard/customers/${contact.entityId}`
    return `/app/dashboard/employees/${contact.entityId}`
  }
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
  const [searchParams, setSearchParams] = useSearchParams()

  const typesParam = searchParams.get('types') || ''
  const initialType = typesParam.includes(',') ? '' : (typesParam || '')

  const [search, setSearch] = useState('')
  const [type, setType] = useState(initialType)
  const [isActive, setIsActive] = useState('all')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!typesParam) return
    if (typesParam.includes(',')) {
      setType('')
    } else if (['customer', 'supplier', 'employee', 'whatsapp'].includes(typesParam)) {
      setType(typesParam)
    }
  }, [typesParam])

  const [selected, setSelected] = useState(() => new Set())

  const queryTypes = type || (typesParam.includes(',') ? typesParam : undefined)
  const partnerHub = typesParam.includes('customer') && typesParam.includes('supplier')

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(searchParams)
    if (!params.get('types') && partnerHub) params.set('types', 'customer,supplier')
    const q = params.toString()
    return `/app/dashboard/contacts${q ? `?${q}` : ''}`
  }, [searchParams, partnerHub])

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

  const selectableRows = useMemo(
    () => rows.filter((r) => r.entityType === 'customer' || r.entityType === 'supplier' || r.isPartnerEmployee),
    [rows],
  )
  const pageIds = useMemo(() => selectableRows.map((r) => r.entityId), [selectableRows])
  const selectedIds = useMemo(() => [...selected], [selected])
  const selectedOnPageCount = useMemo(
    () => pageIds.filter((id) => selected.has(id)).length,
    [pageIds, selected],
  )
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const somePageSelected = selectedOnPageCount > 0 && !allPageSelected

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  const exportColumns = [
    { key: 'name', label: isAr ? 'الاسم' : 'Name', value: (r) => r?.name || '' },
    { key: 'type', label: isAr ? 'النوع' : 'Type', value: (r) => (isAr ? r?.meta?.ar : r?.meta?.en) || r?.entityType || '' },
    { key: 'phone', label: isAr ? 'الهاتف' : 'Phone', value: (r) => r?.phone || '' },
    { key: 'email', label: isAr ? 'البريد' : 'Email', value: (r) => r?.email || '' },
    { key: 'internalRef', label: isAr ? 'المرجع الداخلي' : 'Internal Ref', value: (r) => r?.internalRef || r?.customerCode || r?.supplierCode || r?.code || '' },
    { key: 'vatNumber', label: isAr ? 'الرقم الضريبي' : 'Tax ID / VAT', value: (r) => r?.vatNumber || '' },
    { key: 'status', label: t('status'), value: (r) => (r?.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')) },
  ]

  const mapPartnerExportRow = (p) => ({
    name: isAr ? p.nameAr || p.nameEn || p.name : p.nameEn || p.name,
    meta: { en: 'Partner', ar: 'شريك' },
    entityType: p.isCustomer ? 'customer' : 'supplier',
    phone: p.phone || p.mobile,
    email: p.email,
    internalRef: p.internalRef || p.customerCode || p.supplierCode,
    customerCode: p.customerCode,
    supplierCode: p.supplierCode,
    vatNumber: p.vatNumber,
    isActive: p.isActive !== false,
  })

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

  const handlePartnerExport = async () => {
    setExporting(true)
    try {
      let exportRows
      if (selectedIds.length > 0) {
        const res = await api.post('/partners/export', { ids: selectedIds })
        exportRows = (res.data?.partners || []).map(mapPartnerExportRow)
      } else {
        exportRows = await getExportRows()
      }
      exportToCsv({
        fileName: buildDefaultFileName(isAr ? 'جهات_الاتصال' : 'Contacts'),
        rows: exportRows,
        columns: exportColumns,
      })
      toast.success(isAr ? `تم تصدير ${exportRows.length} صف` : `Exported ${exportRows.length} rows`)
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed')
    } finally {
      setExporting(false)
    }
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

  const tabs = [
    { key: '', label: isAr ? 'الكل' : 'All', value: partnerHub ? (totals.partners || 0) : totalContacts },
    { key: 'customer', label: isAr ? 'العملاء' : 'Customers', value: totals.customers || 0 },
    { key: 'supplier', label: isAr ? 'الموردون' : 'Suppliers', value: totals.suppliers || 0 },
    ...(partnerHub ? [
      { key: 'employee', label: isAr ? 'الموظفون' : 'Employees', value: totals.partnerEmployees || 0 },
    ] : !partnerHub ? [
      { key: 'employee', label: isAr ? 'الموظفون' : 'Employees', value: totals.employees || 0 },
      { key: 'whatsapp', label: 'WhatsApp', value: (totals.whatsapp || 0) + (totals.whatsappGroups || 0) },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={contactsEyebrowClass}>
            {partnerHub ? (isAr ? 'الشركاء' : 'Partners') : (isAr ? 'الدليل' : 'Directory')}
          </p>
          <h1 className={contactsTitleClass}>
            {isAr ? 'جهات الاتصال' : 'Contacts'}
          </h1>
          <p className={contactsSubtitleClass}>
            {partnerHub
              ? (isAr
                ? 'دليل موحّد للعملاء والموردين والموظفين — محاسبة وضريبة وزاتكا'
                : 'Unified partners registry — accounting, tax, and ZATCA-ready addresses')
              : (isAr ? 'دليل موحّد للعملاء والموردين والموظفين.' : 'One book for customers, suppliers, employees, and WhatsApp.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ContactsCreateMenu
            language={language}
            returnTo={returnTo}
            showEmployee={partnerHub || !typesParam}
          />
          {partnerHub ? (
            <>
              <button
                type="button"
                className={outlinedBtnClass}
                disabled={isLoading || exporting || (!selectedIds.length && !rows.length)}
                onClick={handlePartnerExport}
              >
                <Download className="h-4 w-4" />
                {exporting
                  ? (isAr ? 'جاري التصدير…' : 'Exporting…')
                  : selectedIds.length
                    ? (isAr ? `تصدير (${selectedIds.length})` : `Export (${selectedIds.length})`)
                    : (isAr ? 'تصدير' : 'Export')}
              </button>
              {selectedIds.length > 0 && (
                <button type="button" className={ghostActionClass} onClick={() => setSelected(new Set())}>
                  {isAr ? `مسح (${selectedIds.length})` : `Clear (${selectedIds.length})`}
                </button>
              )}
            </>
          ) : (
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
          )}
        </div>
      </div>

      <div className="border-b border-slate-200/90 dark:border-dark-600">
        <nav className="-mb-px flex flex-wrap items-center gap-1">
          {tabs.map((tab) => {
            const active = type === tab.key
            return (
              <button
                key={tab.key || 'all'}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`${contactTabClass(active)} inline-flex items-center gap-2`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                  active
                    ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200'
                    : 'bg-slate-100 text-slate-500 dark:bg-dark-700 dark:text-slate-400'
                }`}
                >
                  {Number(tab.value).toLocaleString()}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className={filterBarClass}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isAr ? 'بحث بالاسم أو الهاتف أو الرقم الضريبي' : 'Search name, phone, email, or VAT'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className={searchInputClass}
            />
          </div>
          <select
            value={isActive}
            onChange={(e) => { setIsActive(e.target.value); setPage(1) }}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none sm:w-44 dark:border-dark-500 dark:bg-dark-800 dark:text-white"
          >
            <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
            <option value="true">{isAr ? 'نشط فقط' : 'Active only'}</option>
            <option value="false">{isAr ? 'غير نشط' : 'Inactive'}</option>
          </select>
        </div>
        {selectedIds.length > 0 && partnerHub && (
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            {isAr ? `${selectedIds.length} محدد للتصدير` : `${selectedIds.length} selected for export`}
          </p>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={listShellClass}>
        {isLoading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className={emptyStateClass}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
              <UserRound className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-white">{isAr ? 'لا توجد جهات في هذا العرض' : 'No contacts in this view'}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              {isAr ? 'أنشئ عميلاً أو مورداً من زر الإنشاء أعلاه.' : 'Create a customer or supplier with the Create button above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className={contactsTableClass}>
            <thead>
              <tr>
                {partnerHub && (
                  <th className={`${contactsThClass} w-10`}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-600/20"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected }}
                      onChange={toggleAllPage}
                      aria-label={isAr ? 'تحديد الكل' : 'Select all'}
                    />
                  </th>
                )}
                <th className={contactsThClass}>{isAr ? 'الاسم' : 'Name'}</th>
                <th className={contactsThClass}>{isAr ? 'النوع' : 'Type'}</th>
                <th className={contactsThClass}>{isAr ? 'التواصل' : 'Reach'}</th>
                <th className={contactsThClass}>{isAr ? 'المرجع الداخلي' : 'Internal Ref'}</th>
                <th className={contactsThClass}>{isAr ? 'الرقم الضريبي' : 'Tax ID / VAT'}</th>
                <th className={contactsThClass}>{t('status')}</th>
                <th className={`${contactsThClass} w-16`} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isSelectable = c.entityType === 'customer' || c.entityType === 'supplier' || c.isPartnerEmployee
                const rowId = c.entityId
                return (
                <tr key={`${c.entityType}-${c.entityId}`} className={contactsTrClass}>
                  {partnerHub && (
                    <td className={contactsTdClass}>
                      {isSelectable ? (
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-600/20"
                          checked={selected.has(rowId)}
                          onChange={() => toggleRow(rowId)}
                          aria-label={isAr ? 'تحديد الصف' : 'Select row'}
                        />
                      ) : null}
                    </td>
                  )}
                  <td className={contactsTdClass}>
                    <div className="flex items-center gap-3">
                      <div className={avatarClass(c.meta.tint)}>
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{c.name || '—'}</p>
                        {c.displayNameAr && !isAr && <p className="truncate text-xs text-slate-500" dir="rtl">{c.displayNameAr}</p>}
                      </div>
                    </div>
                  </td>
                  <td className={contactsTdClass}>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap gap-1">
                        <span className={typeChipClass(c.meta.tint)}>
                          <c.Icon className="h-3.5 w-3.5" />
                          {isAr ? c.meta.ar : c.meta.en}
                        </span>
                        {c.isCustomer && c.isVendor ? (
                          <>
                            <span className={typeChipClass('bg-amber-50 text-amber-800')}>{isAr ? 'مورد' : 'Vendor'}</span>
                            <span className={typeChipClass('bg-sky-50 text-sky-800')}>{isAr ? 'عميل' : 'Customer'}</span>
                          </>
                        ) : null}
                      </div>
                      {c.isCustomer && c.isVendor ? (
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/app/dashboard/customers/${c.entityId}`} className="text-[10px] font-semibold text-teal-700 hover:underline dark:text-teal-300">
                            {isAr ? 'فتح كعميل' : 'Open as customer'}
                          </Link>
                          <Link to={`/app/dashboard/suppliers/${c.entityId}`} className="text-[10px] font-semibold text-amber-700 hover:underline">
                            {isAr ? 'فتح كمورد' : 'Open as vendor'}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className={contactsTdClass}>
                    <div className="space-y-1">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 dark:text-slate-300">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}
                        </a>
                      ) : null}
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />{c.email}
                        </a>
                      ) : null}
                      {!c.phone && !c.email && <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className={`${contactsTdClass} font-mono text-xs text-slate-600 dark:text-slate-400`}>
                    {(c.internalRef || c.customerCode || c.supplierCode || c.code) ? (
                      <span className="inline-flex items-center gap-1">
                        <Hash className="h-3 w-3 opacity-60" />
                        {c.internalRef || c.customerCode || c.supplierCode || c.code}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={`${contactsTdClass} font-mono text-xs text-slate-600 dark:text-slate-400`}>
                    {c.vatNumber || '—'}
                  </td>
                  <td className={contactsTdClass}>
                    <span className={c.isActive ? statusActiveClass : statusInactiveClass}>
                      {c.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                    </span>
                  </td>
                  <td className={contactsTdClass}>
                    {c.route ? (
                      <div className={rowActionsWrapClass}>
                        <Link to={c.route} className={rowActionPrimaryClass} title={isAr ? 'فتح' : 'Open'}>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    ) : c.entityType?.startsWith('whatsapp') ? (
                      <div className={rowActionsWrapClass}>
                        <Link to={`/app/dashboard/whatsapp?contact=${c.entityId}`} className={rowActionPrimaryClass}>
                          <MessageCircle className="h-4 w-4" />
                        </Link>
                      </div>
                    ) : null}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          </div>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className={paginationBarClass}>
          <button type="button" className={outlinedBtnClass} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
            {isAr ? 'السابق' : 'Previous'}
          </button>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {isAr ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </span>
          <button type="button" className={outlinedBtnClass} disabled={page >= pagination.pages} onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}>
            {isAr ? 'التالي' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

    </div>
  )
}

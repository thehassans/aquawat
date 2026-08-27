import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AsyncCombobox from '../ui/AsyncCombobox'
import QuickCreateContactModal from './QuickCreateContactModal'
import api from '../../lib/api'

/**
 * Partner AsyncCombobox with Quick Create + Advanced Create (View More).
 * role: 'customer' | 'vendor'
 */
export default function PartnerCombobox({
  role = 'customer',
  value,
  selectedOption,
  onChange,
  ar = false,
  language = 'en',
  disabled = false,
  placeholder,
  queryKeyPrefix,
}) {
  const isVendor = role === 'vendor'
  const navigate = useNavigate()
  const location = useLocation()
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickName, setQuickName] = useState('')

  const fetchOptions = useCallback(async (q) => {
    if (isVendor) {
      const data = await api.get('/suppliers', {
        params: { search: q, limit: 15, isActive: true },
      }).then((r) => r.data)
      const list = data?.suppliers || data?.data || (Array.isArray(data) ? data : [])
      return (list || []).map((s) => ({
        ...s,
        name: s.nameEn || s.name || s.nameAr || '—',
      }))
    }
    const rows = await api.get('/customers/search', { params: { q } }).then((r) => r.data || [])
    return Array.isArray(rows) ? rows : []
  }, [isVendor])

  const goAdvanced = (term) => {
    const returnTo = `${location.pathname}${location.search}`
    const params = new URLSearchParams()
    if (term) params.set('name', term)
    params.set('returnTo', returnTo)
    if (isVendor) {
      navigate(`/app/dashboard/suppliers/new?${params.toString()}`)
    } else {
      navigate(`/app/dashboard/customers/new?${params.toString()}`)
    }
  }

  return (
    <>
      <AsyncCombobox
        value={value}
        selectedOption={selectedOption}
        disabled={disabled}
        debounceMs={300}
        minChars={2}
        queryKeyPrefix={queryKeyPrefix || (isVendor ? 'vendor-search' : 'customer-search')}
        fetchOptions={fetchOptions}
        placeholder={placeholder || (ar
          ? (isVendor ? 'ابحث عن جهة اتصال (مورد)…' : 'ابحث عن جهة اتصال (عميل)…')
          : (isVendor ? 'Search contact (vendor)…' : 'Search contact (customer)…'))}
        noResultsText={ar ? 'لا توجد نتائج' : 'No results found'}
        getOptionLabel={(c) => (ar && c.nameAr ? c.nameAr : c.name || c.nameEn) || c.customerCode || c.code || '—'}
        getOptionSub={(c) => [c.customerCode || c.code, c.vatNumber || c.taxNumber, c.phone || c.mobile, c.email]
          .filter(Boolean)
          .join(' · ')}
        onChange={onChange}
        emptyActions={({ query, close }) => (
          <div className="border-t border-slate-100 dark:border-dark-600">
            <button
              type="button"
              className="flex w-full px-3 py-2.5 text-start text-sm font-medium text-sky-800 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                close?.()
                setQuickName(query || '')
                setQuickOpen(true)
              }}
            >
              {ar
                ? `+ إنشاء سريع «${query || '…'}»`
                : `+ Quick Create "${query || '…'}"`}
            </button>
            <button
              type="button"
              className="flex w-full px-3 py-2.5 text-start text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-dark-700"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                close?.()
                goAdvanced(query)
              }}
            >
              {ar ? 'المزيد / إنشاء متقدم…' : 'View More / Advanced Create…'}
            </button>
          </div>
        )}
      />
      <QuickCreateContactModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        role={role}
        defaultName={quickName}
        ar={ar}
        language={language}
        onCreated={(created) => {
          onChange?.(created._id, created)
        }}
      />
    </>
  )
}

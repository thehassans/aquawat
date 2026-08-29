import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
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
  /** Show a compact "+ New" button that opens the create popout */
  showNewButton = true,
}) {
  const isVendor = role === 'vendor'
  const navigate = useNavigate()
  const location = useLocation()
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickName, setQuickName] = useState('')

  const fetchOptions = useCallback(async (q) => {
    const types = isVendor ? 'supplier' : 'customer'
    const data = await api.get('/contacts', {
      params: { search: q, types, limit: 15, isActive: true },
    }).then((r) => r.data)
    const list = data?.contacts || []
    return list
      .filter((c) => c.entityType === (isVendor ? 'supplier' : 'customer'))
      .map((c) => ({
        _id: c.entityId,
        name: c.displayName || '—',
        nameEn: c.displayName,
        nameAr: c.displayNameAr,
        customerCode: isVendor ? undefined : c.code,
        code: c.code,
        vatNumber: c.vatNumber,
        taxNumber: c.vatNumber,
        phone: c.phone,
        mobile: c.phone,
        email: c.email,
        crNumber: c.crNumber,
        address: c.address,
      }))
  }, [isVendor])

  const goAdvanced = (term) => {
    const returnTo = `${location.pathname}${location.search}`
    const params = new URLSearchParams()
    if (term) params.set('name', term)
    params.set('returnTo', returnTo)
    params.set('role', isVendor ? 'vendor' : 'customer')
    if (isVendor) {
      navigate(`/app/dashboard/suppliers/new?${params.toString()}`)
    } else {
      navigate(`/app/dashboard/customers/new?${params.toString()}`)
    }
  }

  const openQuick = (term = '') => {
    setQuickName(term)
    setQuickOpen(true)
  }

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <AsyncCombobox
            value={value}
            selectedOption={selectedOption}
            disabled={disabled}
            debounceMs={300}
            minChars={2}
            queryKeyPrefix={queryKeyPrefix || (isVendor ? 'vendor-search' : 'customer-search')}
            fetchOptions={fetchOptions}
            placeholder={placeholder || (ar
              ? (isVendor ? 'ابحث عن مورد…' : 'ابحث عن عميل…')
              : (isVendor ? 'Search vendor…' : 'Search customer…'))}
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
                    openQuick(query || '')
                  }}
                >
                  {ar
                    ? `+ إنشاء سريع «${query || '…'}»`
                    : `+ Create new "${query || '…'}"`}
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
                  {ar ? 'المزيد / إنشاء متقدم…' : 'Advanced create…'}
                </button>
              </div>
            )}
          />
        </div>
        {showNewButton ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => openQuick('')}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
            title={ar ? (isVendor ? 'مورد جديد' : 'عميل جديد') : (isVendor ? 'New vendor' : 'New customer')}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            {ar ? 'جديد' : 'New'}
          </button>
        ) : null}
      </div>
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

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, Building2, User, ArrowRight, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatInvError } from '../../lib/invError'
import AsyncCombobox from '../ui/AsyncCombobox'
import {
  buildFullFormUrl,
  fetchDefaultPayableAccountId,
  fetchDefaultReceivableAccountId,
} from '../../lib/partnerDefaults'

/**
 * Minimal quick-create contact popout (portaled above SalesComposerChrome).
 * Address & extras stay optional / collapsed. role: 'vendor' | 'customer'
 */
export default function QuickCreateContactModal({
  open,
  onClose,
  onCreated,
  role = 'customer',
  defaultName = '',
  defaultContactType,
  ar = false,
  language = 'en',
}) {
  const isVendor = role === 'vendor'
  const navigate = useNavigate()
  const location = useLocation()

  const resolveType = () => {
    if (defaultContactType === 'individual' || defaultContactType === 'company') return defaultContactType
    return 'company'
  }

  const empty = () => ({
    name: '',
    nameAr: '',
    contactType: resolveType(),
    email: '',
    phone: '',
    vatNumber: '',
    crNumber: '',
    street: '',
    city: '',
    district: '',
    postalCode: '',
    country: 'SA',
    buildingNumber: '',
    additionalNumber: '',
    shortAddress: '',
    parentCompanyId: '',
    parentCompany: null,
  })

  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [showFullFormCta, setShowFullFormCta] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (!open) return
    setForm({ ...empty(), name: defaultName || '', contactType: resolveType() })
    setFormError('')
    setShowFullFormCta(false)
    setShowMore(false)
  }, [open, defaultName, isVendor, defaultContactType])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onClose])

  const fetchCompanies = async (q) => {
    const data = await api.get('/contacts', {
      params: { search: q, types: isVendor ? 'supplier' : 'customer', limit: 15, isActive: true },
    }).then((r) => r.data)
    const list = data?.contacts || []
    return list
      .filter((c) => c.entityType === (isVendor ? 'supplier' : 'customer'))
      .map((c) => ({
        _id: c.entityId,
        name: c.displayName || '—',
        nameEn: c.displayName,
        nameAr: c.displayNameAr,
        type: 'company',
        code: c.code,
      }))
  }

  const goFullForm = () => {
    const returnTo = `${location.pathname}${location.search}`
    const url = buildFullFormUrl({
      role: isVendor ? 'vendor' : 'customer',
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      entity: form.contactType,
      returnTo,
    })
    onClose?.()
    navigate(url)
  }

  if (!open || typeof document === 'undefined') return null

  const addressPayload = {
    street: form.street.trim() || undefined,
    city: form.city.trim() || undefined,
    district: form.district.trim() || undefined,
    postalCode: form.postalCode.trim() || undefined,
    country: form.country.trim() || 'SA',
    buildingNumber: form.buildingNumber.trim() || undefined,
    additionalNumber: form.additionalNumber.trim() || undefined,
    shortAddress: form.shortAddress.trim() || undefined,
  }

  const hasAnyAddress = Object.values(addressPayload).some((v) => v && v !== 'SA')

  const submit = async (e) => {
    e?.preventDefault?.()
    const trimmed = form.name.trim()
    setFormError('')
    setShowFullFormCta(false)
    if (!trimmed) {
      setFormError(ar ? 'الاسم مطلوب' : 'Name is required')
      return
    }
    setBusy(true)
    try {
      const [receivableAccountId, payableAccountId] = await Promise.all([
        fetchDefaultReceivableAccountId(),
        fetchDefaultPayableAccountId(),
      ])

      let created
      if (isVendor) {
        const code = `S${Date.now().toString().slice(-7)}`
        const payload = {
          code,
          nameEn: trimmed,
          nameAr: form.nameAr.trim() || trimmed,
          type: form.contactType === 'individual' ? 'individual' : 'company',
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          vatNumber: form.vatNumber.trim() || undefined,
          crNumber: form.crNumber.trim() || undefined,
          address: hasAnyAddress ? addressPayload : undefined,
          parentCompanyId: form.contactType === 'individual' && form.parentCompanyId ? form.parentCompanyId : undefined,
          payableAccountId: payableAccountId || undefined,
          isVendor: true,
          isCustomer: false,
          isActive: true,
        }
        created = await api.post('/suppliers', payload).then((r) => r.data)
        created = {
          ...created,
          name: created.nameEn || created.name || trimmed,
        }
      } else {
        const payload = {
          type: form.contactType === 'company' ? 'business' : 'individual',
          name: trimmed,
          nameAr: form.nameAr.trim() || trimmed,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          vatNumber: form.vatNumber.trim() || undefined,
          crNumber: form.crNumber.trim() || undefined,
          address: hasAnyAddress ? addressPayload : undefined,
          parentCompanyId: form.contactType === 'individual' && form.parentCompanyId ? form.parentCompanyId : undefined,
          receivableAccountId: receivableAccountId || undefined,
          isCustomer: true,
          isVendor: false,
          isActive: true,
        }
        created = await api.post('/customers', payload).then((r) => r.data)
      }
      toast.success(ar ? 'تم إنشاء جهة الاتصال' : 'Contact created')
      onCreated?.(created)
      onClose?.()
    } catch (err) {
      const msg = formatInvError(err, language)
      setFormError(msg)
      setShowFullFormCta(true)
    } finally {
      setBusy(false)
    }
  }

  const fieldClass = 'w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 dark:border-white/10 dark:bg-dark-900 dark:text-white'
  const labelClass = 'mb-1 block text-[11px] font-medium text-slate-500'

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => !busy && onClose?.()} />
      <form
        onSubmit={submit}
        className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-dark-600 dark:bg-dark-800 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">
              {ar ? (isVendor ? 'مورد جديد' : 'عميل جديد') : (isVendor ? 'New vendor' : 'New customer')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {ar ? 'الاسم كافٍ — الباقي اختياري' : 'Name is enough — rest is optional'}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-dark-700"
            onClick={() => !busy && onClose?.()}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          {formError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
              {formError}
              {showFullFormCta ? (
                <button
                  type="button"
                  onClick={goFullForm}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-900 underline-offset-2 hover:underline dark:text-rose-100"
                >
                  {ar ? 'المتابعة في النموذج الكامل' : 'Continue in Full Form'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-dark-700" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={form.contactType === 'individual'}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                form.contactType === 'individual'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-dark-800 dark:text-white'
                  : 'text-slate-500'
              }`}
              onClick={() => set('contactType', 'individual')}
            >
              <User className="h-3.5 w-3.5" />
              {ar ? 'فرد' : 'Individual'}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.contactType === 'company'}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                form.contactType === 'company'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-dark-800 dark:text-white'
                  : 'text-slate-500'
              }`}
              onClick={() => {
                set('contactType', 'company')
                set('parentCompanyId', '')
                set('parentCompany', null)
              }}
            >
              <Building2 className="h-3.5 w-3.5" />
              {ar ? 'شركة' : 'Company'}
            </button>
          </div>

          <label className="block text-sm">
            <span className={labelClass}>{ar ? 'الاسم' : 'Name'} <span className="text-rose-500">*</span></span>
            <input
              className={fieldClass}
              autoFocus
              value={form.name}
              onChange={(e) => {
                set('name', e.target.value)
                if (formError) setFormError('')
              }}
              placeholder={ar ? 'الاسم / الشركة' : 'Name / company'}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={labelClass}>{ar ? 'البريد' : 'Email'}</span>
              <input type="email" className={fieldClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{ar ? 'الهاتف' : 'Phone'}</span>
              <input className={fieldClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-dark-900/50 dark:text-slate-300"
          >
            <span>{ar ? 'المزيد (اختياري)' : 'More details (optional)'}</span>
            <ChevronDown className={`h-4 w-4 transition ${showMore ? 'rotate-180' : ''}`} />
          </button>

          {showMore ? (
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-white/5 dark:bg-dark-900/30">
              <label className="block text-sm">
                <span className={labelClass}>{ar ? 'الاسم بالعربية' : 'Name (Arabic)'}</span>
                <input className={fieldClass} dir="rtl" value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className={labelClass}>{ar ? 'الرقم الضريبي' : 'VAT / Tax ID'}</span>
                  <input className={fieldClass} value={form.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelClass}>{ar ? 'السجل التجاري' : 'CR Number'}</span>
                  <input className={fieldClass} value={form.crNumber} onChange={(e) => set('crNumber', e.target.value)} />
                </label>
              </div>

              {form.contactType === 'individual' ? (
                <div className="block text-sm">
                  <span className={labelClass}>{ar ? 'الشركة المرتبطة' : 'Related company'}</span>
                  <AsyncCombobox
                    value={form.parentCompanyId}
                    selectedOption={form.parentCompany}
                    debounceMs={300}
                    minChars={1}
                    queryKeyPrefix={isVendor ? 'vendor-parent-co' : 'customer-parent-co'}
                    fetchOptions={fetchCompanies}
                    placeholder={ar ? 'ابحث عن شركة…' : 'Search company…'}
                    noResultsText={ar ? 'لا توجد نتائج' : 'No results found'}
                    getOptionLabel={(c) => (ar && c.nameAr ? c.nameAr : c.name || c.nameEn) || '—'}
                    getOptionSub={(c) => [c.customerCode || c.code, c.vatNumber].filter(Boolean).join(' · ')}
                    onChange={(id, opt) => {
                      set('parentCompanyId', id || '')
                      set('parentCompany', opt || null)
                    }}
                  />
                </div>
              ) : null}

              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {ar ? 'العنوان (اختياري)' : 'Address (optional)'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className={labelClass}>{ar ? 'الشارع' : 'Street'}</span>
                  <input className={fieldClass} value={form.street} onChange={(e) => set('street', e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelClass}>{ar ? 'المدينة' : 'City'}</span>
                  <input className={fieldClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelClass}>{ar ? 'الدولة' : 'Country'}</span>
                  <input className={fieldClass} value={form.country} onChange={(e) => set('country', e.target.value)} />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-dark-600">
          <button
            type="button"
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            disabled={busy}
            onClick={goFullForm}
          >
            {ar ? 'نموذج كامل…' : 'Full form…'}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary text-sm" disabled={busy} onClick={() => onClose?.()}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary text-sm" disabled={busy}>
              {busy ? '…' : (ar ? 'إنشاء' : 'Create')}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  )
}

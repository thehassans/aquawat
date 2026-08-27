import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, Building2, User, ArrowRight } from 'lucide-react'
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
 * Unified contact quick-create.
 * role: 'vendor' (receipt) injects default payable; 'customer' (delivery) injects receivable.
 */
export default function QuickCreateContactModal({
  open,
  onClose,
  onCreated,
  role = 'customer',
  defaultName = '',
  ar = false,
  language = 'en',
}) {
  const isVendor = role === 'vendor'
  const navigate = useNavigate()
  const location = useLocation()

  const [name, setName] = useState('')
  const [contactType, setContactType] = useState(isVendor ? 'company' : 'individual')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [parentCompanyId, setParentCompanyId] = useState('')
  const [parentCompany, setParentCompany] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [showFullFormCta, setShowFullFormCta] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(defaultName || '')
    setContactType(isVendor ? 'company' : 'individual')
    setEmail('')
    setPhone('')
    setParentCompanyId('')
    setParentCompany(null)
    setFormError('')
    setShowFullFormCta(false)
  }, [open, defaultName, isVendor])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  const fetchCompanies = async (q) => {
    if (isVendor) {
      const data = await api.get('/suppliers', {
        params: { search: q, limit: 15, isActive: true },
      }).then((r) => r.data)
      const list = data?.suppliers || data?.data || (Array.isArray(data) ? data : [])
      return (list || [])
        .filter((s) => (s.type || 'company') !== 'individual')
        .map((s) => ({
          ...s,
          name: s.nameEn || s.name || s.nameAr || '—',
        }))
    }
    const rows = await api.get('/customers/search', { params: { q } }).then((r) => r.data || [])
    return (Array.isArray(rows) ? rows : []).filter((c) => (c.type || 'business') !== 'individual')
  }

  const goFullForm = () => {
    const returnTo = `${location.pathname}${location.search}`
    const url = buildFullFormUrl({
      role: isVendor ? 'vendor' : 'customer',
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      entity: contactType,
      returnTo,
    })
    onClose?.()
    navigate(url)
  }

  if (!open) return null

  const submit = async (e) => {
    e?.preventDefault?.()
    const trimmed = name.trim()
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
          nameAr: trimmed,
          type: contactType === 'individual' ? 'individual' : 'company',
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          parentCompanyId: contactType === 'individual' && parentCompanyId ? parentCompanyId : undefined,
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
          type: contactType === 'company' ? 'business' : 'individual',
          name: trimmed,
          nameAr: trimmed,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          parentCompanyId: contactType === 'individual' && parentCompanyId ? parentCompanyId : undefined,
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

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => !busy && onClose?.()} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white shadow-xl dark:border-dark-600 dark:bg-dark-800 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">
              {ar ? 'إنشاء جهة اتصال' : 'Create contact'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isVendor
                ? (ar ? 'سيُعلَّم كمورد تلقائياً من سياق الاستلام' : 'Marked as vendor from receipt context')
                : (ar ? 'سيُعلَّم كعميل تلقائياً من سياق التسليم' : 'Marked as customer from delivery context')}
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

        <div className="space-y-4 px-5 py-4">
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

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {ar ? 'الكيان' : 'Entity'}
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100/80 p-1 dark:bg-dark-700" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={contactType === 'individual'}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  contactType === 'individual'
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-dark-800 dark:text-white'
                    : 'text-slate-500'
                }`}
                onClick={() => setContactType('individual')}
              >
                <User className="h-3.5 w-3.5" />
                {ar ? 'فرد' : 'Individual'}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={contactType === 'company'}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  contactType === 'company'
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-dark-800 dark:text-white'
                    : 'text-slate-500'
                }`}
                onClick={() => {
                  setContactType('company')
                  setParentCompanyId('')
                  setParentCompany(null)
                }}
              >
                <Building2 className="h-3.5 w-3.5" />
                {ar ? 'شركة' : 'Company'}
              </button>
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {ar ? 'الاسم' : 'Name'}
              <span className="text-rose-500"> *</span>
            </span>
            <input
              className="input w-full"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (formError) setFormError('')
              }}
              placeholder={ar ? 'اسم جهة الاتصال' : 'Contact name'}
            />
          </label>

          {contactType === 'individual' && (
            <div className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {ar ? 'الشركة المرتبطة' : 'Related company'}
              </span>
              <AsyncCombobox
                value={parentCompanyId}
                selectedOption={parentCompany}
                debounceMs={300}
                minChars={1}
                queryKeyPrefix={isVendor ? 'vendor-parent-co' : 'customer-parent-co'}
                fetchOptions={fetchCompanies}
                placeholder={ar ? 'ابحث عن شركة…' : 'Search company…'}
                noResultsText={ar ? 'لا توجد نتائج' : 'No results found'}
                getOptionLabel={(c) => (ar && c.nameAr ? c.nameAr : c.name || c.nameEn) || '—'}
                getOptionSub={(c) => [c.customerCode || c.code, c.vatNumber].filter(Boolean).join(' · ')}
                onChange={(id, opt) => {
                  setParentCompanyId(id || '')
                  setParentCompany(opt || null)
                }}
              />
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {ar ? 'البريد' : 'Email'}
            </span>
            <input
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {ar ? 'الهاتف' : 'Phone'}
            </span>
            <input
              className="input w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-dark-600">
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
    </div>
  )
}

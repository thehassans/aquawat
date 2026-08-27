import { useEffect, useState } from 'react'
import { X, Building2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatInvError } from '../../lib/invError'

/**
 * Lightweight contact create modal for inventory partner fields.
 * role: 'customer' | 'vendor'
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
  const [name, setName] = useState('')
  const [contactType, setContactType] = useState(isVendor ? 'company' : 'individual')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(defaultName || '')
    setContactType(isVendor ? 'company' : 'individual')
    setEmail('')
    setPhone('')
  }, [open, defaultName, isVendor])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const submit = async (e) => {
    e?.preventDefault?.()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(ar ? 'الاسم مطلوب' : 'Name is required')
      return
    }
    setBusy(true)
    try {
      let created
      if (isVendor) {
        const code = `S${Date.now().toString().slice(-7)}`
        created = await api.post('/suppliers', {
          code,
          nameEn: trimmed,
          nameAr: trimmed,
          type: contactType === 'individual' ? 'individual' : 'company',
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          isActive: true,
        }).then((r) => r.data)
        // Normalize shape for combobox (Receipts expect name)
        created = {
          ...created,
          name: created.nameEn || created.name || trimmed,
        }
      } else {
        created = await api.post('/customers', {
          type: contactType === 'company' ? 'business' : 'individual',
          name: trimmed,
          nameAr: trimmed,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          isActive: true,
        }).then((r) => r.data)
      }
      toast.success(ar ? 'تم إنشاء جهة الاتصال' : 'Contact created')
      onCreated?.(created)
      onClose?.()
    } catch (err) {
      toast.error(formatInvError(err, language))
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
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {isVendor
                ? (ar ? 'إنشاء مورد سريع' : 'Quick Create Vendor')
                : (ar ? 'إنشاء عميل سريع' : 'Quick Create Customer')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {ar ? 'أدخل البيانات الأساسية فقط' : 'Enter basic details only'}
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
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'الاسم' : 'Name'}
              <span className="text-rose-500"> *</span>
            </span>
            <input
              className="input w-full"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ar ? 'اسم جهة الاتصال' : 'Contact name'}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'نوع الاتصال' : 'Contact Type'}
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100/80 p-1 dark:bg-dark-700">
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  contactType === 'individual'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                    : 'text-slate-500'
                }`}
                onClick={() => setContactType('individual')}
              >
                <User className="h-3.5 w-3.5" />
                {ar ? 'فرد' : 'Individual'}
              </button>
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  contactType === 'company'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                    : 'text-slate-500'
                }`}
                onClick={() => setContactType('company')}
              >
                <Building2 className="h-3.5 w-3.5" />
                {ar ? (isVendor ? 'مورد / شركة' : 'شركة') : (isVendor ? 'Company / Vendor' : 'Company')}
              </button>
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
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
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'الهاتف' : 'Phone'}
            </span>
            <input
              className="input w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-dark-600">
          <button type="button" className="btn btn-secondary text-sm" disabled={busy} onClick={() => onClose?.()}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="submit" className="btn btn-primary text-sm" disabled={busy}>
            {busy ? '…' : (ar ? 'إنشاء' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  )
}

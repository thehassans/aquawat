export const PURCHASES_PATH = {
  root: '/app/dashboard/purchases',
  orders: '/app/dashboard/purchases/orders',
  suppliers: '/app/dashboard/purchases/suppliers',
  reports: '/app/dashboard/purchases/reports',
  grn: '/app/dashboard/purchases/grn',
  returns: '/app/dashboard/purchases/returns',
  landed: '/app/dashboard/purchases/landed-costs',
}

export const fieldControlClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-400'

export const shell =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'

export const ghostBtn =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20'

export const primaryBtn =
  'inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_12px_24px_-16px_rgba(15,118,110,0.85)] transition hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400'

export const dangerBtn =
  'inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-300'

export const STATUS_PILL = {
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  refunded: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  posted: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  billed: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  partially_received: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  calculated: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  delayed: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  approved: 'bg-teal-50 text-teal-800 ring-teal-200/80 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20',
  sent: 'bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
}

export function statusLabel(status, language) {
  const ar = {
    draft: 'مسودة',
    sent: 'مرسل',
    approved: 'معتمد',
    partially_received: 'مستلم جزئياً',
    received: 'مستلم',
    refunded: 'مسترد',
    billed: 'مفوتر',
    completed: 'مكتمل',
    calculated: 'محسوب',
    posted: 'مرحّل',
    cancelled: 'ملغي',
    delayed: 'متأخر',
    upcoming: 'قادم',
  }
  if (language === 'ar') return ar[status] || status
  if (status === 'partially_received') return 'Partially received'
  if (status === 'refunded') return 'Refunded'
  return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : status
}

export function partyName(party, language) {
  if (!party) return '—'
  if (typeof party === 'string') return party
  return language === 'ar'
    ? party.nameAr || party.nameEn || party.code || '—'
    : party.nameEn || party.nameAr || party.code || '—'
}

export function warehouseName(wh, language) {
  if (!wh) return '—'
  if (typeof wh === 'string') return wh
  return language === 'ar' ? wh.nameAr || wh.nameEn || wh.code : wh.nameEn || wh.nameAr || wh.code
}

export function formatDay(value, language) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function toDateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function isFutureDate(value) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return date > today
}

export function earliestDelayedUntil(lines) {
  const dates = (Array.isArray(lines) ? lines : [])
    .map((line) => line?.delayedUntil)
    .filter(Boolean)
    .map((value) => String(value).slice(0, 10))
    .sort()
  return dates[0] || null
}

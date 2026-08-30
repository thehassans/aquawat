import { motion } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { LogOut, MessageCircle } from 'lucide-react'
import { logout } from '../../store/slices/authSlice'
import { formatSubscriptionDate, getSubscriptionState } from '../../lib/subscriptionState'
import { HighlightText } from '../ui/highlight-text'

const CONTACTS = [
  { name: 'Hassan', phone: '+966596775485', wa: '966596775485' },
  { name: 'Ahtisham', phone: '+966593914916', wa: '966593914916' },
]

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

/** Paid (non-trial) subscription past end — hard gate with renew contacts. */
export function shouldBlockExpiredSubscription(tenant) {
  if (!tenant) return false
  if (tenant.isActive === false) return false
  if (tenant.subscription?.status === 'terminated') return false
  const state = getSubscriptionState(tenant)
  return Boolean(state.isExpired && !state.isTrialPlan)
}

export default function SubscriptionEndedBlocker() {
  const dispatch = useDispatch()
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const state = getSubscriptionState(tenant)
  const cycle = state.billingCycle === 'yearly' ? 'yearly' : 'monthly'
  const company = tenant?.business?.legalNameEn || tenant?.name || 'Maqder'
  const logo = tenant?.branding?.logo
  const monogram = String(company).trim().charAt(0).toUpperCase() || 'M'
  const endedOn = formatSubscriptionDate(state.endDate, language)

  const handleLogout = () => {
    dispatch(logout())
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const titleCycle = isAr
    ? (cycle === 'yearly' ? 'السنوي' : 'الشهري')
    : cycle

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-ended-title"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(#0f172a 1px,transparent 1px),linear-gradient(90deg,#0f172a 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-[100px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-teal-300/20 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-10 left-0 h-48 w-48 rounded-full bg-amber-200/25 blur-[80px]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[2.25rem] border border-slate-200/90 bg-white/95 p-8 text-center shadow-[0_32px_100px_-24px_rgba(15,23,42,0.22)] backdrop-blur-2xl sm:p-10"
      >
        <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[70px]" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 rounded-full bg-teal-400/10 blur-[60px]" />

        <div className="relative">
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.15)] ring-1 ring-black/[0.04]"
          >
            {logo ? (
              <img src={logo} alt="" className="h-14 w-14 rounded-2xl bg-white object-contain p-1" />
            ) : (
              <span className="font-display text-3xl font-extrabold text-emerald-700">{monogram}</span>
            )}
          </motion.div>

          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {isAr ? 'انتهى الاشتراك' : 'Subscription ended'}
            </span>
          </div>

          <h1
            id="subscription-ended-title"
            className="font-display text-[1.85rem] font-bold leading-[1.2] tracking-[-0.03em] text-slate-950 sm:text-4xl"
          >
            {isAr ? (
              <>
                انتهى اشتراكك <HighlightText variant="yellow">{titleCycle}</HighlightText>
              </>
            ) : (
              <>
                Your <HighlightText variant="yellow">{titleCycle}</HighlightText> subscription ended
              </>
            )}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500 sm:text-base">
            {isAr
              ? 'يرجى التواصل عبر واتساب لتجديد الاشتراك أو لأي استفسار — فريقنا جاهز لمساعدتك.'
              : 'Kindly contact us on WhatsApp to renew your plan or for any queries — we are ready to help.'}
          </p>

          {endedOn && endedOn !== '—' ? (
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {isAr ? `تاريخ الانتهاء: ${endedOn}` : `Ended on ${endedOn}`}
            </p>
          ) : null}

          <div className="mt-8 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {isAr ? 'تواصل عبر واتساب' : 'WhatsApp contacts'}
            </p>
            {CONTACTS.map((c, i) => (
              <motion.a
                key={c.wa}
                href={`https://wa.me/${c.wa}`}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.08 }}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/12 text-[#1da851] ring-1 ring-[#25D366]/25 transition group-hover:bg-[#25D366] group-hover:text-white">
                  <WhatsAppIcon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold text-slate-900">{c.name}</span>
                  <span className="mt-0.5 block font-semibold tabular-nums text-emerald-700" dir="ltr">
                    {c.phone}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {isAr ? 'واتساب' : 'Chat'}
                </span>
              </motion.a>
            ))}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            {isAr ? 'تسجيل الخروج' : 'Sign out'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

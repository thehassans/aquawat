import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BarChart3, FileText, Users } from 'lucide-react'
import { getBusinessTypeOptions, getPrimaryBusinessType } from '../../lib/businessTypes'
import { markDemoWelcomeSeen, shouldShowDemoWelcome } from '../../lib/demoWelcome'
import { HighlightText } from '../ui/highlight-text'

export default function DemoWelcome() {
  const navigate = useNavigate()
  const { tenant, user, isAuthenticated } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const isArabic = language === 'ar'
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !tenant?._id) return
    setOpen(shouldShowDemoWelcome(tenant))
  }, [isAuthenticated, tenant?._id, tenant?.isDemo, tenant?.demoUpgraded])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        markDemoWelcomeSeen(tenant?._id)
        setOpen(false)
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open, tenant?._id])

  const company = tenant?.business?.legalNameEn || tenant?.name || 'your company'
  const logo = tenant?.branding?.logo
  const monogram = String(company).trim().charAt(0).toUpperCase() || 'M'
  const businessLabel = useMemo(() => {
    const id = getPrimaryBusinessType(tenant)
    return getBusinessTypeOptions(language).find((o) => o.id === id)?.label || ''
  }, [tenant, language])

  const dismiss = (path) => {
    markDemoWelcomeSeen(tenant?._id)
    setOpen(false)
    if (path) navigate(path)
  }

  const actions = [
    {
      icon: FileText,
      title: isArabic ? 'أول فاتورة' : 'First invoice',
      body: isArabic ? 'أنشئ فاتورة ضريبية خلال ثوانٍ.' : 'Create a tax-ready invoice in seconds.',
      to: '/app/dashboard/invoices/new',
    },
    {
      icon: Users,
      title: isArabic ? 'الشركاء' : 'Partners',
      body: isArabic ? 'أضف عملاء وموردين من دليل موحّد.' : 'Add customers and suppliers from one partner book.',
      to: '/app/dashboard/customers/new?role=customer&returnTo=/app/dashboard/contacts?types=customer,supplier',
    },
    {
      icon: BarChart3,
      title: isArabic ? 'التقارير' : 'Reports',
      body: isArabic ? 'شاهد الإيرادات والتكاليف بوضوح.' : 'See revenue and costs with clarity.',
      to: '/app/dashboard/reports',
    },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/40 backdrop-blur-md px-4 py-8 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-welcome-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[2.25rem] border border-slate-200/90 bg-white/95 p-8 text-center shadow-[0_32px_100px_-20px_rgba(15,23,42,0.25)] backdrop-blur-2xl sm:p-10"
          >
            {/* Ambient subtle light glows */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[80px]" />
            <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-teal-400/10 blur-[70px]" />

            <div className="relative">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.15)] ring-1 ring-black/[0.04]"
              >
                {logo ? (
                  <img src={logo} alt="" className="h-14 w-14 rounded-2xl object-contain bg-white p-1" />
                ) : (
                  <span className="font-display text-3xl font-extrabold text-emerald-700">{monogram}</span>
                )}
              </motion.div>

              <div className="mb-4 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isArabic ? 'مساحتك أصبحت جاهزة' : 'Your workspace is live'}
                </span>
              </div>

              <h1 id="demo-welcome-title" className="font-display text-[2rem] font-bold leading-[1.2] tracking-[-0.03em] text-slate-950 sm:text-4xl">
                {isArabic ? (
                  <>
                    مرحباً بك في <HighlightText variant="lime">{company}</HighlightText>{' '}
                    <span className="inline-block">— <HighlightText variant="yellow">مساحتك الحية</HighlightText></span>
                  </>
                ) : (
                  <>
                    Welcome to <HighlightText variant="lime">{company}</HighlightText>{' '}
                    <span className="inline-block">— <HighlightText variant="yellow">Live Workspace</HighlightText></span>
                  </>
                )}
              </h1>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-500 sm:text-base">
                {isArabic
                  ? 'تجربة كاملة لسبعة أيام — الفوترة والعملاء والتقارير مهيأة لعملتك ودولتك.'
                  : 'A live 7-day workspace — invoicing, customers, and reporting ready for your business.'}
              </p>

              {(user?.email || businessLabel) && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {[user?.email, businessLabel, tenant?.settings?.currency].filter(Boolean).map((meta) => (
                    <span key={meta} className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-0.5 text-xs font-semibold text-slate-600">
                      {meta}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {actions.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <motion.button
                      key={item.to}
                      type="button"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22 + i * 0.07 }}
                      onClick={() => dismiss(item.to)}
                      className="group rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                    >
                      <span className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="font-display text-xs font-bold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.body}</p>
                    </motion.button>
                  )
                })}
              </div>

              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                onClick={() => dismiss()}
                className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-[0_10px_28px_-10px_rgba(5,150,105,0.6)] transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                {isArabic ? 'ادخل لوحة التحكم' : 'Enter dashboard'}
                <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isArabic ? 'rotate-180' : ''}`} />
              </motion.button>

              <p className="mt-3 text-xs text-slate-400">
                {isArabic ? 'اضغط Enter أو Esc للمتابعة' : 'Press Enter or Esc to continue'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

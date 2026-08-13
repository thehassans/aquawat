import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BarChart3, FileText, Sparkles, Users } from 'lucide-react'
import { getBusinessTypeOptions, getPrimaryBusinessType } from '../../lib/businessTypes'
import { markDemoWelcomeSeen, shouldShowDemoWelcome } from '../../lib/demoWelcome'

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
      title: isArabic ? 'العملاء' : 'Customers',
      body: isArabic ? 'أضف دفترك وابدأ العلاقات.' : 'Add your ledger and start relationships.',
      to: '/app/dashboard/customers/new',
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
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto px-4 py-8 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-welcome-title"
        >
          <div className="absolute inset-0 bg-[#06140f]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
              backgroundSize: '56px 56px',
            }}
          />
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/25 blur-[140px]" />
          <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-teal-400/15 blur-[120px]" />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="relative w-full max-w-3xl text-center"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 260, damping: 18 }}
              className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-white/15 bg-white/10 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.55)] backdrop-blur-xl"
            >
              {logo ? (
                <img src={logo} alt="" className="h-16 w-16 rounded-2xl object-contain bg-white p-1.5" />
              ) : (
                <span className="font-display text-4xl font-bold text-white">{monogram}</span>
              )}
            </motion.div>

            <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.32em] text-emerald-300/90">
              <Sparkles className="h-3.5 w-3.5" />
              {isArabic ? 'مساحتك أصبحت جاهزة' : 'Your workspace is live'}
            </p>

            <h1 id="demo-welcome-title" className="font-display text-[2.15rem] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-5xl">
              {isArabic ? (
                <>مرحباً بك في <span className="text-emerald-300">{company}</span></>
              ) : (
                <>Welcome to <span className="text-emerald-300">{company}</span></>
              )}
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
              {isArabic
                ? 'تجربة مباشرة لسبعة أيام — الفوترة، العملاء، والتقارير في مكان واحد. بلا بطاقة ائتمان.'
                : 'A live 7-day workspace — invoicing, customers, and reporting in one place. No credit card.'}
            </p>

            {(user?.email || businessLabel) && (
              <p className="mt-3 text-sm text-white/40">
                {[user?.email, businessLabel, tenant?.settings?.currency].filter(Boolean).join('  ·  ')}
              </p>
            )}

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {actions.map((item, i) => {
                const Icon = item.icon
                return (
                  <motion.button
                    key={item.to}
                    type="button"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 + i * 0.08 }}
                    onClick={() => dismiss(item.to)}
                    className="group rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-left backdrop-blur-md transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:bg-white/[0.09]"
                  >
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="font-display text-sm font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/45">{item.body}</p>
                  </motion.button>
                )
              })}
            </div>

            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              onClick={() => dismiss()}
              className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-emerald-500 px-8 py-4 text-base font-bold text-white shadow-[0_12px_40px_-12px_rgba(16,185,129,0.7)] transition hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              {isArabic ? 'ادخل لوحة التحكم' : 'Enter dashboard'}
              <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 ${isArabic ? 'rotate-180' : ''}`} />
            </motion.button>

            <p className="mt-4 text-xs text-white/30">
              {isArabic ? 'اضغط Enter للمتابعة' : 'Press Enter to continue'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

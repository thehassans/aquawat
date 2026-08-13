import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BarChart3, FileText, Users } from 'lucide-react'
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
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#f7f7f5] px-4 py-8 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-welcome-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl text-center"
          >
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              {logo ? (
                <img src={logo} alt="" className="h-12 w-12 object-contain p-1" />
              ) : (
                <span className="font-display text-2xl font-semibold tracking-tight text-slate-900">{monogram}</span>
              )}
            </div>

            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
              {isArabic ? 'مساحتك أصبحت جاهزة' : 'Your workspace is live'}
            </p>

            <h1 id="demo-welcome-title" className="font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-950 sm:text-[2.75rem]">
              {isArabic ? (
                <>مرحباً بك في {company}</>
              ) : (
                <>Welcome to {company}</>
              )}
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-slate-500">
              {isArabic
                ? 'تجربة مباشرة لسبعة أيام — الفوترة، العملاء، والتقارير في مكان واحد.'
                : 'A live 7-day workspace — invoicing, customers, and reporting in one place.'}
            </p>

            {(user?.email || businessLabel) && (
              <p className="mt-3 text-sm text-slate-400">
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.05, duration: 0.3 }}
                    onClick={() => dismiss(item.to)}
                    className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.body}</p>
                  </motion.button>
                )
              })}
            </div>

            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28 }}
              onClick={() => dismiss()}
              className="group mt-10 inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {isArabic ? 'ادخل لوحة التحكم' : 'Enter dashboard'}
              <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isArabic ? 'rotate-180' : ''}`} />
            </motion.button>

            <p className="mt-4 text-xs text-slate-400">
              {isArabic ? 'اضغط Enter للمتابعة' : 'Press Enter to continue'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Globe,
  ShieldCheck,
  Sparkles,
  Users,
  Check,
  ArrowRight,
  X,
  Layers,
} from 'lucide-react'
import { HighlightText } from '../../components/ui/highlight-text'
import TrialSignup from '../../components/marketing/TrialSignup'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export default function MarketingAbout() {
  const { language } = useSelector((state) => state.ui)
  const isArabic = false
  const dir = 'ltr'
  const [trialOpen, setTrialOpen] = useState(false)

  useEffect(() => {
    if (!trialOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setTrialOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [trialOpen])

  const openTrialModal = (e) => {
    e?.preventDefault?.()
    setTrialOpen(true)
  }

  const platformPillars = [
    {
      icon: ShieldCheck,
      color: '#059669',
      bgColor: '#05966918',
      title: isArabic ? 'امتثال حسب الدولة' : 'Country-Aware Compliance',
      description: isArabic
        ? 'تم تصميم المنصة لتخدم الأعمال من اليوم الأول مع جاهزية الفوترة الإلكترونية، الامتثال الضريبي حسب الدولة، والتشغيل ثنائي اللغة.'
        : 'Built for multi-country operations from day one — including ZATCA Phase 2 e-invoicing, regional tax rules, and native bilingual execution.',
    },
    {
      icon: Sparkles,
      color: '#d97706',
      bgColor: '#d9770618',
      title: isArabic ? 'تجربة راقية وواضحة' : 'Premium & Modern Experience',
      description: isArabic
        ? 'نقلل الضوضاء في الواجهة ونركز على السرعة والوضوح حتى تتحرك الفرق بسرعة وتفهم ما يحدث فوراً.'
        : 'We eliminate ERP interface clutter and emphasize lightning speed so your staff moves faster with zero training friction.',
    },
    {
      icon: BarChart3,
      color: '#2563eb',
      bgColor: '#2563eb18',
      title: isArabic ? 'قرار أسرع' : 'Real-Time Financial Clarity',
      description: isArabic
        ? 'لوحات معلومات حية وتقارير مترابطة تمنح الإدارة صورة أوضح عن الإيرادات والمخزون والرواتب والمصروفات.'
        : 'Live dashboards and connected ledgers give founders and CFOs an instantaneous pulse on margin, revenue, payroll, and stock.',
    },
  ]

  const capabilities = [
    'ZATCA Phase 2 E-Invoicing with XML cryptographic signing & QR codes',
    'HR, Payroll, GOSI contributions, and bank-ready WPS files',
    'Multi-warehouse inventory, SKU barcodes, and supplier landed costs',
    'Double-entry general ledger, expense claims, and P&L statements',
    'Bilingual English & Arabic with native right-to-left UI support',
    'Modular architecture that scales from single branch to enterprise',
  ]

  const outcomes = [
    {
      value: 'Unified Operations',
      label: 'From first invoice to final financial close',
    },
    {
      value: 'Executive Clarity',
      label: 'Instant visibility into real performance & compliance',
    },
    {
      value: 'Calmer Teams',
      label: 'Frictionless day-to-day data entry and workflows',
    },
    {
      value: 'Built for Growth',
      label: 'Modular architecture tuned to your business vertical',
    },
  ]

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-body">
      {/* ── HERO WITH COLORFUL HIGHLIGHT TEXT ── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="pointer-events-none absolute top-60 -right-20 h-[400px] w-[400px] rounded-full bg-teal-400/10 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              {isArabic ? 'رؤيتنا ورسالتنا' : 'Our Story & Philosophy'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65 }}
            className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl leading-[1.12] text-balance max-w-4xl mx-auto"
          >
            {isArabic ? (
              <>المنصة التي تجمع <HighlightText variant="lime">الأناقة</HighlightText> و<HighlightText variant="yellow">الوضوح</HighlightText></>
            ) : (
              <>Operating with <HighlightText variant="lime">Elegance</HighlightText>, <HighlightText variant="yellow">Clarity</HighlightText>, and <HighlightText variant="pink">Compliance</HighlightText></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl"
          >
            {isArabic
              ? 'صممنا Maqder ERP لتقليل الفجوة بين التعقيد اليومي وبين حاجة الإدارة للسرعة والوضوح.'
              : 'Maqder is a complete business operating layer engineered for growing enterprises — unifying e-invoicing, HR, inventory, purchasing, and reporting in one refined workspace.'}
          </motion.p>

          {/* Highlight Text Feature */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6 mx-auto max-w-3xl text-center"
          >
            <p className="text-center text-base sm:text-lg font-semibold text-slate-700">
              A modern cloud ERP built to feel <HighlightText variant="lime">EFFORTLESS</HighlightText> and stay{' '}
              <HighlightText variant="yellow">DELIGHTFUL</HighlightText> for every{' '}
              <HighlightText variant="pink">TEAM</HighlightText>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── VISION & OUTCOMES ── */}
      <section className="bg-slate-50/70 py-24 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 shadow-sm">
                <Building2 className="h-3.5 w-3.5" />
                Why We Built Maqder
              </span>
              <h2 className="mt-5 font-display text-3xl font-black text-slate-950 sm:text-4xl lg:text-5xl leading-tight">
                Because modern businesses need an ERP that feels <HighlightText variant="lime">weightless</HighlightText> and{' '}
                <HighlightText variant="yellow">intelligent</HighlightText>.
              </h2>
              <p className="mt-6 text-base text-slate-600 leading-relaxed">
                In legacy ERP systems, operations are scattered across dozens of disjointed screens, data is constantly out of sync, and teams waste countless hours on repetitive manual entry.
              </p>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                We designed Maqder as a single, harmonious operating system: e-invoicing talks to inventory, payroll connects directly to attendance, and sales flow seamlessly into financial statements.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {capabilities.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-xs sm:text-sm font-medium text-slate-700 leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Outcomes Card */}
            <div className="rounded-[2.5rem] border border-slate-200/90 bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/60">
              <div className="border-b border-slate-100 pb-6 mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">
                  Platform Vision
                </p>
                <h3 className="text-2xl font-black text-slate-950 mt-1">
                  Every team. Every process. Total clarity.
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {outcomes.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 transition hover:bg-emerald-50/30 hover:border-emerald-200"
                  >
                    <div className="text-base font-black text-slate-950">{item.value}</div>
                    <div className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 CORE PILLARS ── */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 shadow-sm">
              <Layers className="h-3.5 w-3.5" />
              Core Architecture
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Engineered for <HighlightText variant="lime">Velocity</HighlightText> &{' '}
              <HighlightText variant="yellow">Precision</HighlightText>
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-3 items-stretch">
            {platformPillars.map((pillar, idx) => (
              <motion.div
                key={idx}
                custom={idx}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-slate-200/80 hover:border-emerald-300"
              >
                <div>
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110"
                    style={{ background: pillar.bgColor }}
                  >
                    <pillar.icon className="h-7 w-7" style={{ color: pillar.color }} />
                  </div>
                  <h4 className="mt-6 text-xl font-black text-slate-950 group-hover:text-emerald-700 transition">
                    {pillar.title}
                  </h4>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{pillar.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION (OPEN, COLOURFUL & NOT IN BLOCK) ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/20 to-slate-50 py-24 border-t border-slate-100">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-emerald-500/10 blur-[130px]" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-1/4 h-[350px] w-[350px] rounded-full bg-teal-400/10 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {isArabic ? 'ابدأ اليوم مجاناً' : 'Start Today Free'}
          </span>

          <h2 className="mt-6 font-display text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl text-balance">
            Start your <HighlightText variant="lime">7-DAY FREE TRIAL</HighlightText> today
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 leading-relaxed">
            No credit card required. Pick your country and currency — your workspace is live in{' '}
            <HighlightText variant="pink">UNDER A MINUTE</HighlightText>.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openTrialModal}
              className="inline-flex items-center gap-2.5 rounded-full bg-emerald-600 px-9 py-4 text-sm sm:text-base font-black text-white shadow-xl shadow-emerald-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-emerald-600/40"
            >
              <span>{isArabic ? 'ابدأ مجاناً' : 'Start Free Trial'}</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-4 text-sm font-bold text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:text-emerald-700"
            >
              <span>{isArabic ? 'تواصل معنا' : 'Contact Us'}</span>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-semibold text-slate-500">
            <span>✓ All 20+ Modules Unlocked</span>
            <span>✓ Instant Setup in 60s</span>
            <span>✓ Zero Locked-In Contracts</span>
          </div>
        </div>
      </section>

      {/* ── TRIAL SIGNUP MODAL ── */}
      <AnimatePresence>
        {trialOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-[#06140f]/70 p-3 backdrop-blur-xl sm:items-center sm:p-6"
            onClick={() => setTrialOpen(false)}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative flex w-full max-w-[980px] overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white shadow-[0_32px_96px_-24px_rgba(15,23,42,0.24)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative hidden w-[38%] shrink-0 flex-col justify-between overflow-hidden border-r border-slate-100 bg-[#f8faf9] px-8 py-10 text-slate-900 lg:flex">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-teal-400/10 blur-[80px]"
                />
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Free trial
                  </span>
                  <h3 className="mt-5 font-display text-[1.85rem] font-bold leading-[1.2] tracking-[-0.03em] text-slate-950">
                    Your <HighlightText variant="lime">Workspace</HighlightText> in{' '}
                    <span className="inline-block"><HighlightText variant="yellow">under a minute</HighlightText></span>
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    Pick country, company, and currency — then land in a live dashboard.
                  </p>
                </div>
                <ul className="relative mt-10 space-y-4 text-sm">
                  {[
                    '7 full days — every app included',
                    'No credit card required',
                    'Invoices, customers, and reports from first login',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-3 text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="font-medium leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="relative mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Maqder · Live ERP
                </p>
              </div>

              <div className="relative min-w-0 flex-1 bg-white">
                <button
                  type="button"
                  onClick={() => setTrialOpen(false)}
                  className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="border-b border-slate-100 px-6 pb-4 pt-7 lg:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Free trial
                  </span>
                  <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-950">
                    Your <HighlightText variant="lime">Workspace</HighlightText> in{' '}
                    <HighlightText variant="yellow">under a minute</HighlightText>
                  </h3>
                </div>
                <div className="max-h-[min(78vh,720px)] overflow-y-auto px-6 py-6 sm:px-8">
                  <TrialSignup variant="light" embedded />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

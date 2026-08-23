import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ArrowRight,
  Search,
  Building2,
  Sparkles,
  ShieldCheck,
  Check,
  MessageCircle,
  X,
  Layers,
  Zap,
} from 'lucide-react'
import { HighlightText } from '../../components/ui/highlight-text'
import TrialSignup from '../../components/marketing/TrialSignup'
import { INDUSTRIES } from '../../lib/industriesContent'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const SECTOR_GROUPS = [
  { id: 'all', label: 'All Industries' },
  { id: 'hospitality', label: 'Hospitality & F&B' },
  { id: 'retail', label: 'Wholesale & Retail' },
  { id: 'services', label: 'Services & Lifestyle' },
  { id: 'contracting', label: 'Contracting & Heavy' },
]

export default function MarketingIndustries() {
  const { language } = useSelector((s) => s.ui)
  const isArabic = false
  const dir = 'ltr'

  const [activeGroup, setActiveGroup] = useState('all')
  const [query, setQuery] = useState('')
  const [trialOpen, setTrialOpen] = useState(false)

  useEffect(() => {
    document.title = 'Industry ERP Solutions Saudi Arabia & GCC | Maqder'
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content =
      'Explore unified cloud ERP and POS solutions purpose-built for hospitality, wholesale, restaurants, retail, contracting, salons, and travel in Saudi Arabia with ZATCA Phase 2 compliance.'
  }, [])

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

  const filtered = INDUSTRIES.filter((item) => {
    const q = query.toLowerCase()
    const matchesQuery =
      !q ||
      item.nameEn.toLowerCase().includes(q) ||
      item.nameAr.includes(q) ||
      item.headline.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q))

    if (activeGroup === 'all') return matchesQuery
    if (activeGroup === 'hospitality') {
      return matchesQuery && (item.slug === 'hospitality-resorts' || item.slug === 'restaurants-cafes')
    }
    if (activeGroup === 'retail') {
      return matchesQuery && (item.slug === 'wholesale-distribution' || item.slug === 'retail-supermarkets')
    }
    if (activeGroup === 'services') {
      return matchesQuery && (item.slug === 'salons-spas' || item.slug === 'laundry-drycleaning' || item.slug === 'travel-tourism' || item.slug === 'tailoring-boutiques')
    }
    if (activeGroup === 'contracting') {
      return matchesQuery && item.slug === 'construction-contracting'
    }
    return matchesQuery
  })

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-body">
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-16 border-b border-slate-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-r from-emerald-400/10 via-teal-300/10 to-yellow-300/10 blur-[130px]" />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-800 shadow-sm">
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            <span>Saudi Arabia & GCC Industry Architecture</span>
          </div>

          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl leading-[1.12] text-balance max-w-4xl mx-auto">
            Deep ERP Blueprints for <HighlightText variant="lime">Every Industry</HighlightText>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg sm:text-xl text-slate-600 leading-relaxed">
            From direct booking engines for luxury resorts to multi-warehouse FMCG distribution and bespoke tailoring, Maqder provides zero-compromise domain execution with native ZATCA Phase 2 compliance.
          </p>

          {/* Search & Filter Bar */}
          <div className="mt-12 mx-auto max-w-2xl">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-4.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by industry, sector, or keyword (e.g. Hotel, Wholesale, POS, Barcode, Salon)..."
                className="w-full rounded-full border border-slate-200 bg-white py-4 pl-12 pr-6 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-4 rounded-full p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {SECTOR_GROUPS.map((grp) => (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setActiveGroup(grp.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    activeGroup === grp.id
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES GRID ── */}
      <section className="py-20 sm:py-28 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {filtered.map((item, idx) => (
              <motion.div
                key={item.slug}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
                custom={idx}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-sm transition-all duration-300 hover:border-emerald-300 hover:shadow-xl"
              >
                <div>
                  {/* Top Sector Meta */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-md border border-amber-200/70">
                      {item.sectorCode}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.sectorName}
                    </span>
                  </div>

                  {/* Headline & Subtitle */}
                  <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-slate-950 group-hover:text-emerald-700 transition">
                    {item.nameEn}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {item.headline}
                  </p>
                  <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {item.subtitle}
                  </p>

                  {/* Tags */}
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="inline-flex rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Key KPI Highlight */}
                  <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Primary Benchmark</div>
                      <div className="text-xs font-bold text-slate-900">{item.kpis[0]?.label}</div>
                    </div>
                    <div className="font-display text-2xl font-black text-emerald-600">
                      {item.kpis[0]?.value}
                    </div>
                  </div>
                </div>

                {/* Bottom Link Action */}
                <div className="mt-8 border-t border-slate-100 pt-6 flex items-center justify-between">
                  <Link
                    to={`/industries/${item.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 group-hover:text-emerald-800"
                  >
                    <span>Explore Deep Industry Blueprint</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <button
                    type="button"
                    onClick={openTrialModal}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Try Live
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 p-12">
              <p className="text-lg font-bold text-slate-900">No matching industries found</p>
              <p className="text-sm text-slate-500 mt-1">Try clearing your search query or view all industries.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveGroup('all')
                }}
                className="mt-4 inline-flex items-center rounded-full bg-emerald-600 px-6 py-2 text-xs font-bold text-white"
              >
                Reset Search
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── UNBOXED COLORFUL CTA SECTION ── */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-32 border-t border-slate-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[550px] w-[950px] rounded-full bg-gradient-to-r from-emerald-400/15 via-teal-300/15 to-yellow-300/15 blur-[130px]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-800 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>7-Day Free Trial · All 20+ Modules Unlocked</span>
          </div>

          <h2 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl leading-[1.12] text-balance max-w-4xl mx-auto">
            Ready to configure Maqder for your <HighlightText variant="lime">industry</HighlightText>?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-slate-600 leading-relaxed">
            Pick your country, currency, and sector — your live workspace with custom workflows and ZATCA compliance is ready in 60 seconds.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openTrialModal}
              className="inline-flex items-center gap-3 rounded-full bg-emerald-600 px-9 py-4 text-base font-black text-white shadow-[0_12px_32px_-8px_rgba(5,150,105,0.5)] transition hover:bg-emerald-700 hover:-translate-y-1"
            >
              <span>Start 7-Day Free Trial</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <a
              href="https://wa.me/966593914916"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200/90 bg-emerald-50/80 px-7 py-4 text-base font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100 hover:-translate-y-0.5"
            >
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              <span>WhatsApp: +966 59 391 4916</span>
            </a>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
            >
              <span>Contact Sales</span>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-y-3 gap-x-8 text-xs sm:text-sm font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
              Instant workspace setup in 60s
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
              ZATCA Phase 2 tax certified
            </span>
          </div>
        </div>
      </section>

      {/* ── 7-DAY FREE TRIAL MODAL ── */}
      <AnimatePresence>
        {trialOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTrialOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setTrialOpen(false)}
                className="absolute top-4 right-4 z-20 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
              <TrialSignup variant="light" embedded onSuccess={() => setTrialOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}

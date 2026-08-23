import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  MessageCircle,
  Phone,
  Check,
  ChevronDown,
  Building2,
  Layers,
  Zap,
  HelpCircle,
  Lock,
  Landmark,
  X,
} from 'lucide-react'
import { HighlightText } from '../../components/ui/highlight-text'
import TrialSignup from '../../components/marketing/TrialSignup'
import { getIndustry, INDUSTRIES } from '../../lib/industriesContent'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export default function IndustryDetail() {
  const { slug } = useParams()
  const { language } = useSelector((s) => s.ui)
  const isArabic = false
  const dir = 'ltr'

  const industry = getIndustry(slug)
  const [trialOpen, setTrialOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  // Dynamic SEO Tags & Schema Injection
  useEffect(() => {
    if (!industry) return
    document.title = `${industry.nameEn} ERP & ZATCA Phase 2 | Maqder`

    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content = industry.metaDescription

    let metaKw = document.querySelector('meta[name="keywords"]')
    if (!metaKw) {
      metaKw = document.createElement('meta')
      metaKw.name = 'keywords'
      document.head.appendChild(metaKw)
    }
    metaKw.content = industry.keywords

    // JSON-LD Structured Data for SEO
    const schemaData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: `Maqder ${industry.nameEn} ERP`,
          operatingSystem: 'Web, Cloud, iOS, Android',
          applicationCategory: 'BusinessApplication',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'SAR',
            description: '7-Day Free Trial with all modules unlocked',
          },
          description: industry.metaDescription,
        },
        {
          '@type': 'FAQPage',
          mainEntity: industry.faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.a,
            },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: 'https://maqder.com',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Industries',
              item: 'https://maqder.com/industries',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: industry.nameEn,
              item: `https://maqder.com/industries/${industry.slug}`,
            },
          ],
        },
      ],
    }

    let scriptTag = document.getElementById('industry-seo-schema')
    if (!scriptTag) {
      scriptTag = document.createElement('script')
      scriptTag.id = 'industry-seo-schema'
      scriptTag.type = 'application/ld+json'
      document.head.appendChild(scriptTag)
    }
    scriptTag.textContent = JSON.stringify(schemaData)

    return () => {
      if (scriptTag) scriptTag.remove()
    }
  }, [industry])

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

  if (!industry) {
    return <Navigate to="/industries" replace />
  }

  const otherIndustries = INDUSTRIES.filter((item) => item.slug !== industry.slug).slice(0, 3)

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-body">
      {/* ── TOP SECTION (MATCHING SCREENSHOT) ── */}
      <section className="relative overflow-hidden bg-white pt-10 pb-16 border-b border-slate-100">
        {/* Subtle Ambient Background Mesh */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="pointer-events-none absolute -top-32 right-10 h-[500px] w-[500px] rounded-full bg-emerald-400/10 blur-[130px]" />
        <div className="pointer-events-none absolute top-40 -left-20 h-[400px] w-[400px] rounded-full bg-teal-400/10 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb & Sector Badges Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/industries"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition hover:text-emerald-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to all industries</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-mono font-bold tracking-wider text-amber-800">
                {industry.sectorCode}
              </span>
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                {industry.sectorName}
              </span>
            </div>
          </div>

          {/* Domain Category Eyebrow */}
          <div className="mt-10">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-700">
              {industry.categoryTag}
            </span>
          </div>

          {/* Main Huge Headline */}
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl leading-[1.12]">
            {industry.headline}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-4xl text-lg sm:text-xl text-slate-600 leading-relaxed">
            {industry.subtitle}
          </p>

          {/* Hashtag Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {industry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 3 High-Impact KPI Metric Cards */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {industry.kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm transition hover:shadow-md hover:border-emerald-200"
              >
                <div className="font-display text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">
                  {kpi.value}
                </div>
                <div className="mt-2 text-sm font-bold text-slate-900">
                  {kpi.label}
                </div>
                <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {kpi.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={openTrialModal}
              className="inline-flex items-center gap-3 rounded-full bg-emerald-600 px-8 py-4 text-base font-black text-white shadow-[0_8px_24px_-4px_rgba(5,150,105,0.5)] transition hover:bg-emerald-700 hover:-translate-y-0.5"
            >
              <span>Launch Live {industry.nameEn} Demo</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <a
              href="https://wa.me/966593914916"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-7 py-4 text-base font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100 hover:-translate-y-0.5"
            >
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              <span>WhatsApp Consultation (+966 59 391 4916)</span>
            </a>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
            >
              <span>Talk to Solutions Engineer</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE & CAPABILITY PILLARS ── */}
      <section className="py-20 sm:py-28 bg-slate-50/60 border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5" />
              <span>Architectural Blueprint</span>
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Engineered specifically for <HighlightText variant="lime">{industry.nameEn}</HighlightText>
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              No generic ERP bloat. Every workflow, data schema, and tax calculation is configured from day one for your exact sector.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {industry.architecture.map((arch, idx) => (
              <div
                key={idx}
                className="relative rounded-3xl border border-slate-200/90 bg-white p-8 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-mono font-bold text-sm">
                  0{idx + 1}
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-950">
                  {arch.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {arch.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CORE MODULES BREAKDOWN ── */}
      <section className="py-20 sm:py-28 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1 text-xs font-bold text-teal-800 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" />
              <span>Unified System Stack</span>
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              All tools connected in <HighlightText variant="yellow">one live workspace</HighlightText>
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Eliminate disjointed software and expensive middleware. Everything runs on a single high-performance database.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {industry.modules.map((mod, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 transition hover:bg-white hover:shadow-md hover:border-emerald-300"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm">
                  {idx + 1}
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-950">
                  {mod.name}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {mod.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STEP-BY-STEP OPERATIONAL WORKFLOW ── */}
      <section className="py-20 sm:py-28 bg-slate-50/60 border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span>Operational Blueprint</span>
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              How operations run with <HighlightText variant="lime">Maqder</HighlightText>
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {industry.workflow.map((wf, idx) => (
              <div
                key={idx}
                className="relative rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm"
              >
                <span className="font-mono text-2xl font-black text-emerald-600">
                  {wf.step}
                </span>
                <h3 className="mt-3 text-base font-bold text-slate-950">
                  {wf.title}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {wf.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SAUDI COMPLIANCE & ZATCA PHASE 2 BANNER ── */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white p-8 sm:p-12 shadow-sm">
            <div className="grid lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Saudi Arabia & GCC Compliance Certified</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                  100% ZATCA Phase 2 E-Invoicing & Saudi Tax Regulatory Ready
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                  Compliant cryptographic UBL 2.1 XML signing, Phase 2 security tokens (CSID), QR codes, and automated submission for standard and simplified tax invoices. Built for Saudi Vision 2030 standards.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700 pt-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                    Cryptographic XML Generation
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                    Phase 2 QR Codes
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                    Mada / Apple Pay Ready
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                    256-Bit Bank Encryption
                  </span>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col items-center lg:items-end justify-center">
                <button
                  type="button"
                  onClick={openTrialModal}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-7 py-4 text-sm font-bold text-white shadow-md transition hover:bg-slate-800"
                >
                  <span>Verify Compliance</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RICH FAQ SECTION (SEO OPTIMIZED SCHEMA) ── */}
      <section className="py-20 sm:py-28 bg-slate-50/50 border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Frequently Asked Questions</span>
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Questions regarding <HighlightText variant="yellow">{industry.nameEn}</HighlightText>
            </h2>
          </div>

          <div className="mt-12 space-y-4">
            {industry.faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="flex w-full items-center justify-between gap-4 p-6 text-start font-bold text-slate-950 hover:text-emerald-700 transition"
                  >
                    <span className="text-base sm:text-lg">{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── EXPLORE OTHER INDUSTRY BLUEPRINTS ── */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-950">
                Explore More Industry Blueprints
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Discover specialized features tailored for complementary business sectors.
              </p>
            </div>
            <Link
              to="/industries"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              <span>View all sectors</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {otherIndustries.map((item) => (
              <Link
                key={item.slug}
                to={`/industries/${item.slug}`}
                className="group rounded-2xl border border-slate-200 p-5 transition hover:border-emerald-300 hover:bg-slate-50/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                    {item.sectorCode}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-1" />
                </div>
                <h4 className="mt-3 font-bold text-slate-900 group-hover:text-emerald-700 transition text-sm">
                  {item.nameEn}
                </h4>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {item.headline}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── UNBOXED COLORFUL CTA SECTION (NO SOLID BLOCK) ── */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-32">
        {/* Ambient Glowing Orbs */}
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
        <div className="pointer-events-none absolute -bottom-20 right-10 h-[350px] w-[350px] rounded-full bg-pink-400/10 blur-[110px]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-800 shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Instant Setup in 60s · 7-Day Free Trial</span>
          </div>

          <h2 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl leading-[1.12] text-balance max-w-4xl mx-auto">
            Ready to upgrade your <HighlightText variant="lime">{industry.nameEn}</HighlightText> operations{' '}
            <span className="inline-block"><HighlightText variant="yellow">today</HighlightText></span>?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-slate-600 leading-relaxed">
            No credit card required. Experience live point-of-sale, multi-warehouse stock, and instant ZATCA Phase 2 invoicing tailored for {industry.nameEn}.
          </p>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openTrialModal}
              className="inline-flex items-center gap-3 rounded-full bg-emerald-600 px-9 py-4 text-base font-black text-white shadow-[0_12px_32px_-8px_rgba(5,150,105,0.5)] transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-700 hover:shadow-[0_16px_40px_-6px_rgba(5,150,105,0.6)]"
            >
              <span>Start 7-Day Free Trial</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <a
              href="https://wa.me/966593914916"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200/90 bg-emerald-50/80 px-7 py-4 text-base font-bold text-emerald-800 shadow-sm transition-all hover:bg-emerald-100 hover:border-emerald-300 hover:-translate-y-0.5"
            >
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              <span>WhatsApp: +966 59 391 4916</span>
            </a>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-slate-50 hover:text-slate-950 hover:-translate-y-0.5"
            >
              <span>Contact Sales</span>
            </Link>
          </div>

          {/* Trust points */}
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
              ZATCA Phase 2 certified
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
              Zero locked-in contracts
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

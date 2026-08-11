import { motion } from 'framer-motion'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ArrowRight, ShieldCheck, CheckCircle2, PlayCircle,
  Building2, UtensilsCrossed, Sparkles, Scissors, Globe, Truck, Landmark,
  Package, FileText, BarChart3, Coffee, CreditCard, Receipt, Zap, ClipboardList,
  Calculator, Users,
} from 'lucide-react'
import { getSolution, SOLUTIONS } from '../../lib/solutionsContent'

const ICONS = {
  Building2, UtensilsCrossed, Sparkles, Scissors, Globe, Truck, Landmark,
  Package, FileText, BarChart3, Coffee, CreditCard, Receipt, Zap, ClipboardList,
  Calculator, Users, CheckCircle2,
}

const fade = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } }

export default function SolutionDetail() {
  const { slug } = useParams()
  const { language } = useSelector((state) => state.ui)
  const isArabic = false
  const solution = getSolution(slug)

  if (!solution) return <Navigate to="/solutions" replace />

  const Icon = ICONS[solution.icon] || Building2
  const others = SOLUTIONS.filter((s) => s.slug !== solution.slug).slice(0, 3)

  return (
    <main className="bg-white text-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#030c06] text-white">
        <div className={`pointer-events-none absolute -top-32 -left-20 h-[600px] w-[600px] rounded-full ${solution.glow} blur-[130px]`} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <Link to="/solutions" className="inline-flex items-center gap-2 text-sm text-emerald-300/80 transition hover:text-emerald-200">
                <ArrowRight className={`h-4 w-4 ${isArabic ? '' : 'rotate-180'}`} />
                {isArabic ? 'كل الحلول' : 'All solutions'}
              </Link>
              <div className={`mt-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${solution.accent} shadow-lg`}>
                <Icon className="h-8 w-8 text-white" />
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
                {isArabic ? solution.nameAr : solution.nameEn}
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/60">
                {isArabic ? solution.heroAr : solution.heroEn}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  state={{ email: solution.demoEmail, password: 'password123' }}
                  className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-7 py-4 font-semibold text-white shadow-[0_8px_32px_-8px_rgba(52,211,153,0.45)] transition-all hover:shadow-[0_12px_40px_-8px_rgba(52,211,153,0.6)]"
                >
                  <PlayCircle className="h-5 w-5" />
                  {isArabic ? 'جرب النسخة الحية' : 'Launch live demo'}
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.06] px-7 py-4 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
                >
                  {isArabic ? 'تواصل معنا' : 'Talk to sales'}
                  <ArrowRight className={`h-5 w-5 ${isArabic ? 'rotate-180' : ''}`} />
                </Link>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                {isArabic ? 'متوافق مع ZATCA المرحلة الثانية' : 'ZATCA Phase 2 compliant'}
              </div>
            </motion.div>

            {/* Image Preview */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative lg:col-span-6">
              <div className={`pointer-events-none absolute inset-0 scale-110 rounded-3xl ${solution.glow} blur-3xl`} />
              <div className="relative rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-2 backdrop-blur-sm shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_40px_100px_-20px_rgba(0,0,0,0.9)] group">
                <div className="overflow-hidden rounded-[1.5rem] border border-white/[0.05] bg-[#071209]">
                  <img src={solution.image} alt={isArabic ? solution.nameAr : solution.nameEn} loading="lazy" className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Saudi Compliance Section */}
      <section className="bg-white py-24 border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full font-medium text-sm mb-6 border border-emerald-100`}>
                <ShieldCheck className="w-4 h-4" />
                {isArabic ? 'جاهز للمرحلة الثانية' : 'Phase 2 Ready'}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                {isArabic ? 'متوافق بالكامل مع متطلبات ZATCA' : 'Fully Compliant with ZATCA Requirements'}
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                {isArabic 
                  ? `أدر نشاط ${solution.nameAr} الخاص بك باطمئنان. يقوم نظامنا تلقائياً بإنشاء رموز QR وتوقيع ملفات XML وإرسال الفواتير إلى بوابة هيئة الزكاة والضريبة والجمارك (ZATCA) في الوقت الفعلي.` 
                  : `Run your ${solution.nameEn} operations with peace of mind. Our system automatically generates QR codes, signs XML files, and submits invoices to the ZATCA portal in real-time.`}
              </p>
              <ul className="space-y-4">
                {[
                  { en: 'Instant XML generation and signing', ar: 'إنشاء وتوقيع XML فوري' },
                  { en: 'Compliant QR codes for all receipts', ar: 'رموز QR متوافقة لجميع الإيصالات' },
                  { en: 'Seamless B2B & B2C tax handling', ar: 'معالجة سلسة لضرائب B2B و B2C' },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-gray-700 font-medium">{isArabic ? item.ar : item.en}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full" />
              <div className="relative bg-white rounded-3xl p-8 border border-gray-100 shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">{isArabic ? 'رقم الفاتورة الضريبية' : 'Tax Invoice Number'}</p>
                    <p className="font-bold text-gray-900">INV-2024-001</p>
                  </div>
                  <div className="w-16 h-16 bg-gray-100 rounded-lg p-2 border border-gray-200">
                    {/* Placeholder for QR Code */}
                    <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMgM2g2djZIM3oiLz48cGF0aCBkPSJNMTEgM2gydjZIMTExeiIvPjxwYXRoIGQ9Ik0xNyAzSDIxdjZoLTR6Ii8+PHBhdGggZD0iTTMgMTVoNnY2SDN6Ii8+PHBhdGggZD0iTTExIDE1aDJ2NkgxMXoiLz48cGF0aCBkPSJNMTcgMTVoNHY2aC00eiIvPjxwYXRoIGQ9Ik0zIDExaDIydjJIM3oiLz48L3N2Zz4=')] bg-cover opacity-60" />
                  </div>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{isArabic ? 'المبلغ' : 'Amount'}</span>
                    <span className="font-medium text-gray-900">SAR 1,000.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{isArabic ? 'الضريبة (15%)' : 'VAT (15%)'}</span>
                    <span className="font-medium text-gray-900">SAR 150.00</span>
                  </div>
                  <div className="flex justify-between font-bold pt-3 border-t border-gray-100">
                    <span className="text-gray-900">{isArabic ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-emerald-600 text-lg">SAR 1,150.00</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5" />
                  {isArabic ? 'تم اعتماد الفاتورة من ZATCA' : 'Invoice Approved by ZATCA'}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features detail */}
      <section className="bg-slate-50/70 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'كل ما تحتاجه لإدارة نشاطك' : 'Everything you need to run it'}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">{isArabic ? solution.taglineAr : solution.taglineEn}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {solution.features.map((f, i) => {
              const FIcon = ICONS[f.icon] || CheckCircle2
              return (
                <motion.div key={i} variants={fade} initial="initial" whileInView="animate" viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300/60 hover:shadow-xl">
                  <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${solution.accent} text-white shadow-md`}>
                    <FIcon className="h-5 w-5" />
                  </div>
                  <p className="font-bold text-slate-950">{isArabic ? f.titleAr : f.titleEn}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{isArabic ? f.descAr : f.descEn}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-slate-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{isArabic ? 'كيف يعمل' : 'How it works'}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {solution.workflow.map((step, i) => (
              <motion.div key={i} variants={fade} initial="initial" whileInView="animate" viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7">
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${solution.accent} text-lg font-bold text-white`}>
                  {i + 1}
                </div>
                <p className="text-lg font-bold text-white">{isArabic ? step.titleAr : step.titleEn}</p>
                <p className="mt-2 text-sm text-white/45">{isArabic ? step.descAr : step.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Other solutions */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{isArabic ? 'حلول أخرى' : 'Other solutions'}</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {others.map((s) => {
              const OIcon = ICONS[s.icon] || Building2
              return (
                <Link key={s.slug} to={`/solutions/${s.slug}`}
                  className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${s.accent} text-white shadow-md`}>
                    <OIcon className="h-6 w-6" />
                  </div>
                  <p className="font-bold text-slate-900">{isArabic ? s.nameAr : s.nameEn}</p>
                  <p className="mt-2 flex-grow text-sm text-slate-500">{isArabic ? s.taglineAr : s.taglineEn}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    {isArabic ? 'اكتشف' : 'Explore'}
                    <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${isArabic ? 'rotate-180' : ''}`} />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#030c06] p-10 text-white shadow-2xl lg:p-16">
            <div className={`pointer-events-none absolute -top-24 left-1/3 h-96 w-96 rounded-full ${solution.glow} blur-[100px]`} />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
                  {isArabic ? `جاهز لتجربة ${solution.nameAr}؟` : `Ready to try ${solution.nameEn}?`}
                </h2>
                <p className="mt-4 text-lg text-white/55">
                  {isArabic ? 'افتح النسخة التجريبية الآن وشاهدها تعمل ببياناتك.' : 'Open the live demo and see it in action with sample data.'}
                </p>
              </div>
              <Link
                to="/login"
                state={{ email: solution.demoEmail, password: 'password123' }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-4 font-semibold text-white shadow-[0_0_40px_-8px_rgba(52,211,153,0.4)] transition-all hover:shadow-[0_0_50px_-8px_rgba(52,211,153,0.6)]"
              >
                <PlayCircle className="h-5 w-5" />
                {isArabic ? 'ابدأ التجربة' : 'Launch demo'}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

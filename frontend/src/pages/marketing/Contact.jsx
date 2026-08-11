import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSelector } from 'react-redux'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react'
import { usePublicWebsiteSettings } from '../../lib/website'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10'
const labelCls = 'mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500'

export default function MarketingContact() {
  const { language } = useSelector((s) => s.ui)
  const { data } = usePublicWebsiteSettings()
  const isArabic = language === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'

  const [sent, setSent] = useState(false)

  const phone   = data?.contactPhone   || '+966596775485'
  const email   = data?.contactEmail   || 'info@maqder.com'
  const address = isArabic
    ? (data?.contactAddressAr || 'الدمام، حي مدينة العمال 18، المملكة العربية السعودية')
    : (data?.contactAddressEn || 'Dammam, Madinat Al Ummal Dist. 18, Saudi Arabia')

  const handleSubmit = (e) => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => setSent(false), 5000)
  }

  const CHANNELS = [
    {
      icon: Phone,
      color: '#059669', bgColor: '#05966918',
      labelEn: 'Phone', labelAr: 'الهاتف',
      value: phone,
      href: `tel:${phone.replace(/\s+/g, '')}`,
      actionEn: 'Call now', actionAr: 'اتصل الآن',
    },
    {
      icon: MessageCircle,
      color: '#25d366', bgColor: '#25d36618',
      labelEn: 'WhatsApp', labelAr: 'واتساب',
      value: phone,
      href: `https://wa.me/${phone.replace(/[^0-9]/g, '')}`,
      actionEn: 'Chat now', actionAr: 'ابدأ محادثة',
      external: true,
    },
    {
      icon: Mail,
      color: '#2563eb', bgColor: '#2563eb18',
      labelEn: 'Email', labelAr: 'البريد',
      value: email,
      href: `mailto:${email}`,
      actionEn: 'Send email', actionAr: 'أرسل بريداً',
    },
  ]

  const WHY = [
    { en: 'Fast onboarding within 24 hours',     ar: 'إعداد سريع خلال 24 ساعة' },
    { en: 'Free team training included',         ar: 'تدريب مجاني للفريق مشمول' },
    { en: 'Country-aware tax compliance',        ar: 'امتثال ضريبي حسب الدولة' },
    { en: 'Arabic & English bilingual support',  ar: 'دعم بالعربية والإنجليزية' },
  ]

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-slate-950 pb-0 pt-24 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #05966922 0%, transparent 60%), radial-gradient(circle at 75% 20%, #05966920 0%, transparent 50%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '64px 64px' }}
        />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {isArabic ? 'نحن هنا لمساعدتك' : "We're here to help"}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.65 }}
            className="mt-5 text-5xl font-black tracking-[-0.03em] sm:text-6xl lg:text-[4.5rem]"
          >
            {isArabic ? (
              <><span className="text-emerald-400">تواصل</span>{' معنا'}</>
            ) : (
              <>Let's <span className="text-emerald-400">talk</span></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto mt-5 max-w-xl text-lg text-white/55"
          >
            {isArabic
              ? 'فريقنا جاهز لمساعدتك في البدء مع Maqder أو الحصول على عرض أسعار أو جدولة عرض مباشر.'
              : 'Our team is ready to help you get started, get a quote, or schedule a live demo tailored to your business.'}
          </motion.p>
        </div>
        <div className="pointer-events-none h-16 bg-gradient-to-b from-slate-950 to-white" />
      </section>

      {/* ── CHANNEL CARDS ── */}
      <section className="bg-white pt-8 pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {CHANNELS.map((ch, idx) => (
              <motion.a
                key={idx}
                href={ch.href}
                target={ch.external ? '_blank' : undefined}
                rel={ch.external ? 'noreferrer' : undefined}
                custom={idx}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300/60 hover:shadow-xl hover:shadow-emerald-100/60"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                  style={{ background: ch.bgColor }}
                >
                  <ch.icon className="h-5 w-5" style={{ color: ch.color }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{isArabic ? ch.labelAr : ch.labelEn}</p>
                  <p className="mt-1 font-bold text-slate-900" dir="ltr">{ch.value}</p>
                </div>
                <div className={`flex items-center gap-1.5 text-sm font-bold transition-all ${isArabic ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
                  style={{ color: ch.color }}>
                  {isArabic ? ch.actionAr : ch.actionEn}
                  <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM + SIDEBAR ── */}
      <section className="bg-slate-50/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-5">

            {/* Form — 3 cols */}
            <motion.div
              custom={0} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="lg:col-span-3"
            >
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_48px_-12px_rgba(0,0,0,0.10)]">
                {/* Header bar */}
                <div className="border-b border-slate-100 px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                      <Send className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-950">
                        {isArabic ? 'أرسل لنا رسالة' : 'Send us a message'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {isArabic ? 'سنرد خلال 24 ساعة' : "We'll reply within 24 hours"}
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-8">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>{isArabic ? 'الاسم' : 'Name'}</label>
                      <input type="text" required className={inputCls} placeholder={isArabic ? 'أدخل اسمك' : 'Your full name'} />
                    </div>
                    <div>
                      <label className={labelCls}>{isArabic ? 'البريد الإلكتروني' : 'Email'}</label>
                      <input type="email" required className={inputCls} placeholder={isArabic ? 'بريدك الإلكتروني' : 'you@company.com'} />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>{isArabic ? 'الشركة' : 'Company'}</label>
                      <input type="text" className={inputCls} placeholder={isArabic ? 'اسم الشركة' : 'Company name'} />
                    </div>
                    <div>
                      <label className={labelCls}>{isArabic ? 'رقم الجوال' : 'Phone'}</label>
                      <input type="tel" className={inputCls} placeholder="05XXXXXXXX" dir="ltr" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{isArabic ? 'الرسالة' : 'Message'}</label>
                    <textarea
                      rows={5}
                      required
                      className={`${inputCls} resize-none`}
                      placeholder={isArabic ? 'اكتب رسالتك هنا...' : 'Tell us what you need...'}
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full rounded-2xl py-4 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 ${
                      sent
                        ? 'bg-emerald-600 text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.5)]'
                        : 'bg-emerald-600 text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.5)] hover:bg-emerald-700 hover:shadow-[0_6px_24px_-4px_rgba(5,150,105,0.55)]'
                    } flex items-center justify-center gap-2.5`}
                  >
                    {sent ? (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        {isArabic ? 'تم الإرسال بنجاح!' : 'Message sent!'}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        {isArabic ? 'إرسال الرسالة' : 'Send message'}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>

            {/* Sidebar — 2 cols */}
            <motion.div
              custom={1} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="lg:col-span-2 flex flex-col gap-5"
            >
              {/* Address */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
                  <MapPin className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{isArabic ? 'العنوان' : 'Address'}</p>
                <p className="mt-2 text-base font-semibold leading-relaxed text-slate-900">{address}</p>
              </div>

              {/* Hours */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{isArabic ? 'ساعات العمل' : 'Business hours'}</p>
                <div className="mt-3 space-y-2.5">
                  {[
                    { dayEn: 'Sunday – Thursday', dayAr: 'الأحد – الخميس', time: '9:00 – 18:00' },
                    { dayEn: 'Friday', dayAr: 'الجمعة', time: '14:00 – 18:00' },
                    { dayEn: 'Saturday', dayAr: 'السبت', timeEn: 'Closed', timeAr: 'مغلق' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{isArabic ? row.dayAr : row.dayEn}</span>
                      <span className="font-bold text-slate-900">{row.timeEn && isArabic ? row.timeAr : row.timeAr && !isArabic ? (row.timeEn || row.time) : row.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why Maqder dark card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-900 p-6 text-white shadow-lg">
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-wider text-white/70">{isArabic ? 'لماذا Maqder' : 'Why Maqder?'}</p>
                  <ul className="mt-4 space-y-3">
                    {WHY.map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-white/80">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                        {isArabic ? item.ar : item.en}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-10 text-white shadow-[0_40px_100px_-30px_rgba(5,150,105,0.4)] lg:p-16">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-3xl font-black lg:text-4xl">
                  {isArabic ? 'جاهز للبدء؟' : 'Ready to get started?'}
                </h2>
                <p className="mt-3 text-lg text-white/65">
                  {isArabic ? 'جرّب Maqder مجاناً — النظام جاهز في أقل من دقيقة.' : 'Try Maqder free — your workspace is live in under a minute.'}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <a
                  href="/#trial"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-black text-emerald-700 shadow-lg transition-all hover:-translate-y-0.5"
                >
                  {isArabic ? 'ابدأ مجاناً' : 'Start for free'}
                  <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
                </a>
                <a
                  href="https://wa.me/966596775485"
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}

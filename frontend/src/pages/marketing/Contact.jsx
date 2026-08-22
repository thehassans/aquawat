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
  Check,
} from 'lucide-react'
import { usePublicWebsiteSettings } from '../../lib/website'
import { HighlightText } from '../../components/ui/highlight-text'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const inputCls =
  'w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15'
const labelCls = 'mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500'

export default function MarketingContact() {
  const { language } = useSelector((s) => s.ui)
  const { data } = usePublicWebsiteSettings()
  const isArabic = false
  const dir = 'ltr'

  const [sent, setSent] = useState(false)

  const phone = data?.contactPhone || '+966593914916'
  const email = data?.contactEmail || 'info@maqder.com'
  const address = isArabic
    ? data?.contactAddressAr || 'الدمام، حي مدينة العمال 18، المملكة العربية السعودية'
    : data?.contactAddressEn || 'Dammam, Madinat Al Ummal Dist. 18, Saudi Arabia'

  const handleSubmit = (e) => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => setSent(false), 5000)
  }

  const CHANNELS = [
    {
      icon: Phone,
      color: '#059669',
      bgColor: '#05966918',
      labelEn: 'Direct Phone',
      labelAr: 'الهاتف المباشر',
      value: phone,
      href: `tel:${phone.replace(/\s+/g, '')}`,
      actionEn: 'Call now',
      actionAr: 'اتصل الآن',
    },
    {
      icon: MessageCircle,
      color: '#25d366',
      bgColor: '#25d36618',
      labelEn: 'WhatsApp Support',
      labelAr: 'واتساب الدعم',
      value: phone,
      href: `https://wa.me/${phone.replace(/[^0-9]/g, '')}`,
      actionEn: 'Chat on WhatsApp',
      actionAr: 'ابدأ محادثة',
      external: true,
    },
    {
      icon: Mail,
      color: '#2563eb',
      bgColor: '#2563eb18',
      labelEn: 'Email Inquiries',
      labelAr: 'البريد الإلكتروني',
      value: email,
      href: `mailto:${email}`,
      actionEn: 'Send email',
      actionAr: 'أرسل بريداً',
    },
  ]

  const WHY = [
    { en: 'Instant workspace activation in 60s', ar: 'تفعيل فوري لمساحة العمل خلال 60 ثانية' },
    { en: 'Dedicated account onboarding manager', ar: 'مدير تهيئة وتدريب مخصص لحسابك' },
    { en: 'Country-aware tax & ZATCA Phase 2 readiness', ar: 'امتثال ضريبي وجاهزية تامة لـ ZATCA' },
    { en: 'Arabic & English 24/7 bilingual support', ar: 'دعم فني بالعربية والإنجليزية على مدار الساعة' },
  ]

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-body">
      {/* ── HERO WITH COLORFUL HIGHLIGHT TEXT ── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-14">
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
              {isArabic ? 'نحن هنا لمساعدتك' : "We're here to help you grow"}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65 }}
            className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl leading-[1.12] text-balance max-w-4xl mx-auto"
          >
            {isArabic ? (
              <>تواصل مع فريق <HighlightText variant="lime">Maqder</HighlightText></>
            ) : (
              <>Let's build something <HighlightText variant="lime">Extraordinary</HighlightText></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl"
          >
            {isArabic
              ? 'فريقنا جاهز لمساعدتك في البدء مع Maqder، وتقديم العروض المخصصة، والإجابة عن أي استفسار.'
              : 'Our team is ready to help you get started, explore enterprise customization, or schedule a personalized live demo.'}
          </motion.p>

          {/* Highlight Feature Banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8 mx-auto max-w-3xl flex items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-md px-6 py-4 shadow-sm"
          >
            <p className="text-center text-sm sm:text-base font-semibold text-slate-800">
              Direct channels for <HighlightText variant="lime">instant help</HighlightText>,{' '}
              <HighlightText variant="yellow">live demos</HighlightText>, and{' '}
              <HighlightText variant="pink">custom solutions</HighlightText>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── CHANNEL CARDS ── */}
      <section className="bg-slate-50/70 pt-8 pb-16 border-y border-slate-100">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
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
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-400/60 hover:shadow-xl hover:shadow-emerald-100/70"
              >
                <div>
                  <div
                    className="flex h-13 w-13 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 shadow-sm"
                    style={{ background: ch.bgColor }}
                  >
                    <ch.icon className="h-6 w-6" style={{ color: ch.color }} />
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                      {isArabic ? ch.labelAr : ch.labelEn}
                    </p>
                    <p className="mt-1 font-bold text-base text-slate-900" dir="ltr">
                      {ch.value}
                    </p>
                  </div>
                </div>
                <div
                  className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold transition-all"
                  style={{ color: ch.color }}
                >
                  <span>{isArabic ? ch.actionAr : ch.actionEn}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM + SIDEBAR ── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-5 items-start">
            {/* Form — 3 cols */}
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="lg:col-span-3"
            >
              <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/60">
                {/* Header bar */}
                <div className="border-b border-slate-100 px-8 py-6 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                      <Send className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-950">
                        {isArabic ? 'أرسل لنا رسالة' : 'Send us a message'}
                      </h2>
                      <p className="text-xs text-slate-400 font-medium">
                        {isArabic ? 'سنرد عليك في أقرب وقت' : "We'll get back to you within 24 hours"}
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-8">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>{isArabic ? 'الاسم بالكامل' : 'Full Name *'}</label>
                      <input
                        type="text"
                        required
                        className={inputCls}
                        placeholder={isArabic ? 'أدخل اسمك' : 'e.g. John Doe'}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{isArabic ? 'البريد الإلكتروني' : 'Work Email *'}</label>
                      <input
                        type="email"
                        required
                        className={inputCls}
                        placeholder={isArabic ? 'بريدك الإلكتروني' : 'you@company.com'}
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>{isArabic ? 'اسم الشركة' : 'Company Name'}</label>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder={isArabic ? 'اسم الشركة' : 'Company or brand name'}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{isArabic ? 'رقم الهاتف' : 'Phone / Mobile'}</label>
                      <input
                        type="tel"
                        className={inputCls}
                        placeholder="+966 5X XXX XXXX"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>{isArabic ? 'كيف يمكننا مساعدتك؟' : 'Message or Request *'}</label>
                    <textarea
                      rows={5}
                      required
                      className={inputCls}
                      placeholder={
                        isArabic
                          ? 'أخبرنا عن عملك وما الذي تبحث عنه...'
                          : 'Tell us about your team size, modules needed, or question...'
                      }
                    />
                  </div>

                  {sent ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      <span>
                        {isArabic
                          ? 'شكراً لك! تم استلام رسالتك وسنتواصل معك قريباً.'
                          : 'Thank you! Your message has been received. Our team will contact you shortly.'}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/30 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
                    >
                      <Send className="h-4 w-4" />
                      <span>{isArabic ? 'إرسال الرسالة' : 'Send Message'}</span>
                    </button>
                  )}
                </form>
              </div>
            </motion.div>

            {/* Sidebar — 2 cols */}
            <motion.div
              custom={1}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="space-y-6 lg:col-span-2"
            >
              {/* Address card */}
              <div className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-sm">
                  <MapPin className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-base font-black text-slate-950">{isArabic ? 'مقرنا' : 'Headquarters'}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{address}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span>Sunday – Thursday: 9:00 AM – 6:00 PM</span>
                </div>
              </div>

              {/* Why choose card */}
              <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 p-7 shadow-sm">
                <h3 className="text-base font-black text-emerald-950">
                  {isArabic ? 'لماذا تختار Maqder؟' : 'Why Growing Businesses Choose Maqder'}
                </h3>
                <ul className="mt-5 space-y-3.5">
                  {WHY.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                      <span>{isArabic ? item.ar : item.en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  )
}

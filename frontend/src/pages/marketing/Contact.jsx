import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Phone, Mail, MapPin, MessageCircle, Clock, Send, Building2, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePublicWebsiteSettings } from '../../lib/website'

export default function MarketingContact() {
  const { language } = useSelector((state) => state.ui)
  const { data } = usePublicWebsiteSettings()
  const isArabic = language === 'ar'
  const [formSent, setFormSent] = useState(false)

  const phone = data?.contactPhone || '+966596775485'
  const email = data?.contactEmail || 'info@maqder.com'
  const address = isArabic
    ? (data?.contactAddressAr || '\u0627\u0644\u062F\u0645\u0627\u0645\u060C \u062D\u064A \u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0639\u0645\u0627\u0644 18\u060C \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629')
    : (data?.contactAddressEn || 'DAMMAM, Madinat Al Ummal Dist. 18, Saudi Arabia')

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormSent(true)
    setTimeout(() => setFormSent(false), 4000)
  }

  const contactCards = [
    {
      icon: Phone,
      label: isArabic ? '\u0627\u0644\u0647\u0627\u062A\u0641' : 'Phone',
      value: phone,
      href: `tel:${phone.replace(/\s+/g, '')}`,
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-500',
      textColor: 'text-emerald-700',
    },
    {
      icon: Mail,
      label: isArabic ? '\u0627\u0644\u0628\u0631\u064A\u062F' : 'Email',
      value: email,
      href: `mailto:${email}`,
      gradient: 'from-sky-500 to-blue-600',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      iconBg: 'bg-sky-500',
      textColor: 'text-sky-700',
    },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: phone,
      href: `https://wa.me/${phone.replace(/[^0-9]/g, '')}`,
      gradient: 'from-green-500 to-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconBg: 'bg-green-500',
      textColor: 'text-green-700',
    },
  ]

  return (
    <main className="relative overflow-hidden">
      {/* Hero Background */}
      <div className="relative bg-gradient-to-br from-slate-900 via-primary-900 to-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-20 w-96 h-96 bg-primary-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -right-20 w-96 h-96 bg-emerald-500 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNGgtMnYtNGgydjR6bTAtNmgtMnYtNGgydjR6bS02IDZoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0eiIgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white/90 text-sm font-medium mb-6 border border-white/20">
              <Sparkles className="w-4 h-4 text-primary-300" />
              {isArabic ? '\u0646\u062D\u0646 \u0647\u0646\u0627 \u0644\u0645\u0633\u0627\u0639\u062F\u062A\u0643' : 'We\u2019re here to help you'}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-6">
              {isArabic ? '\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627' : 'Get in Touch'}
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {isArabic
                ? '\u0641\u0631\u064A\u0642\u0646\u0627 \u062C\u0627\u0647\u0632 \u0644\u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0641\u064A \u0627\u0644\u0628\u062F\u0621 \u0645\u0639 Maqder ERP\u060C \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0639\u0631\u0636 \u0623\u0633\u0639\u0627\u0631\u060C \u0623\u0648 \u062A\u0631\u062A\u064A\u0628 \u0639\u0631\u0636 \u0645\u0628\u0627\u0634\u0631'
                : 'Our team is ready to help you get started with Maqder ERP, get a quote, or schedule a live demo tailored to your business.'}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-20">
        {/* Contact Cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-12">
          {contactCards.map((card, idx) => (
            <motion.a
              key={idx}
              href={card.href}
              target={card.icon === MessageCircle ? '_blank' : undefined}
              rel={card.icon === MessageCircle ? 'noreferrer' : undefined}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className={`group relative ${card.bg} ${card.border} border-2 rounded-3xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
            >
              <div className={`w-14 h-14 ${card.iconBg} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                <card.icon className="w-7 h-7 text-white" />
              </div>
              <div className="text-sm text-slate-500 mb-1">{card.label}</div>
              <div className="font-bold text-slate-900 text-lg" dir="ltr">{card.value}</div>
              <div className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${card.textColor} group-hover:gap-2 transition-all`}>
                {isArabic ? '\u062A\u0648\u0627\u0635\u0644' : 'Contact'}
                <ArrowRight className="w-4 h-4" />
              </div>
            </motion.a>
          ))}
        </div>

        {/* Main Grid: Form + Info */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-3"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-6">
                <h2 className="text-2xl font-bold text-white">
                  {isArabic ? '\u0623\u0631\u0633\u0644 \u0644\u0646\u0627 \u0631\u0633\u0627\u0644\u0629' : 'Send us a message'}
                </h2>
                <p className="text-primary-100 text-sm mt-1">
                  {isArabic ? '\u0633\u0646\u0631\u062F \u0639\u0644\u064A\u0643 \u062E\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629' : 'We\u2019ll get back to you within 24 hours'}
                </p>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {isArabic ? '\u0627\u0644\u0627\u0633\u0645' : 'Name'}
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition text-slate-900"
                      placeholder={isArabic ? '\u0623\u062F\u062E\u0644 \u0627\u0633\u0645\u0643' : 'Enter your name'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {isArabic ? '\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A' : 'Email'}
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition text-slate-900"
                      placeholder={isArabic ? '\u0623\u062F\u062E\u0644 \u0628\u0631\u064A\u062F\u0643' : 'Enter your email'}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {isArabic ? '\u0627\u0644\u0634\u0631\u0643\u0629' : 'Company'}
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition text-slate-900"
                      placeholder={isArabic ? '\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629' : 'Company name'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {isArabic ? '\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644' : 'Phone'}
                    </label>
                    <input
                      type="tel"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition text-slate-900"
                      placeholder="05XXXXXXXX"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {isArabic ? '\u0627\u0644\u0631\u0633\u0627\u0644\u0629' : 'Message'}
                  </label>
                  <textarea
                    rows={5}
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition resize-none text-slate-900"
                    placeholder={isArabic ? '\u0627\u0643\u062A\u0628 \u0631\u0633\u0627\u0644\u062A\u0643 \u0647\u0646\u0627...' : 'Write your message here...'}
                  />
                </div>
                <button
                  type="submit"
                  className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                    formSent
                      ? 'bg-emerald-600 shadow-emerald-200'
                      : 'bg-gradient-to-r from-primary-600 to-primary-700 shadow-primary-500/30 hover:shadow-xl hover:-translate-y-0.5'
                  }`}
                >
                  {formSent ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      {isArabic ? '\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644' : 'Message sent!'}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {isArabic ? '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629' : 'Send Message'}
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Info Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2 space-y-5"
          >
            {/* Address Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <div className="text-sm text-amber-700 font-medium mb-1">
                {isArabic ? '\u0627\u0644\u0639\u0646\u0648\u0627\u0646' : 'Address'}
              </div>
              <div className="font-bold text-slate-900 text-lg leading-relaxed">{address}</div>
            </div>

            {/* Business Hours */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-3xl p-6">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div className="text-sm text-violet-700 font-medium mb-1">
                {isArabic ? '\u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0639\u0645\u0644' : 'Business Hours'}
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{isArabic ? '\u0627\u0644\u0623\u062D\u062F - \u0627\u0644\u062E\u0645\u064A\u0633' : 'Sun - Thu'}</span>
                  <span className="font-semibold text-slate-900">9:00 - 18:00</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{isArabic ? '\u0627\u0644\u062C\u0645\u0639\u0629' : 'Friday'}</span>
                  <span className="font-semibold text-slate-900">14:00 - 18:00</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{isArabic ? '\u0627\u0644\u0633\u0628\u062A' : 'Saturday'}</span>
                  <span className="font-semibold text-slate-900">{isArabic ? '\u0645\u063A\u0644\u0642' : 'Closed'}</span>
                </div>
              </div>
            </div>

            {/* Why Choose Us */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-2xl" />
              <div className="relative">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/20">
                  <Building2 className="w-7 h-7 text-primary-300" />
                </div>
                <div className="text-lg font-bold mb-3">
                  {isArabic ? '\u0644\u0645\u0627\u0630\u0627 Maqder\u061F' : 'Why Maqder?'}
                </div>
                <ul className="space-y-3">
                  {[
                    isArabic ? '\u0625\u0639\u062F\u0627\u062F \u0633\u0631\u064A\u0639 \u062E\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629' : 'Fast onboarding within 24 hours',
                    isArabic ? '\u062A\u062F\u0631\u064A\u0628 \u0645\u062C\u0627\u0646\u064A \u0644\u0644\u0641\u0631\u064A\u0642' : 'Free team training included',
                    isArabic ? 'امتثال ضريبي حسب الدولة' : 'Country-aware tax compliance',
                    isArabic ? '\u062F\u0639\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629' : 'Arabic & English support',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  )
}

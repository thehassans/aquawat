import { useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  UtensilsCrossed, Sparkles, Clock, MapPin, Phone,
  CheckCircle2, Wifi, Calendar, Heart, Share2, Info,
  MessageSquare, ChevronDown, Check, Users, DollarSign
} from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

const CATEGORY_NAMES = {
  wedding: 'Wedding (Baraat / Zafah)',
  reception: 'Reception (Valima)',
  mehndi: 'Mehndi / Henna Night',
  engagement: 'Engagement / Nikah',
  corporate: 'Corporate Gala / Event',
  birthday: 'Birthday / Celebration',
  qawwali_dinner: 'Musical Night & Qawwali',
  exhibition: 'Exhibition & Expo',
  other: 'Custom Event Package',
}

const ITEM_CATEGORY_LABELS = {
  welcome_drinks: 'Welcome Drinks & Juices',
  starters: 'Starters & Finger Food',
  bbq: 'Live BBQ & Grills',
  main_course: 'Main Course & Curries',
  rice_dishes: 'Rice & Biryani Special',
  breads: 'Tandoori Breads & Naan',
  salads_sauces: 'Fresh Salads & Sauces',
  desserts: 'Desserts & Sweets',
  beverages: 'Chai, Coffee & Drinks',
  stage_decor: 'Stage & Floral Decor',
  lighting_sound: 'Sound & Ambient Lighting',
  hall_services: 'Valet & Banquet Services',
  bridal_services: 'Bridal Room & VIP Lounge',
  photography: 'Photography & Media',
  other: 'Additional Inclusions',
}

export default function PublicMarqueeMenu() {
  const { tenantSlug } = useParams()
  const [searchParams] = useSearchParams()
  const table = searchParams.get('table') || 'Guest Area'

  const [selectedCategory, setSelectedCategory] = useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-marquee-menu', tenantSlug],
    queryFn: () => api.get(`/marquee/public/menu/${tenantSlug}`).then((r) => r.data),
  })

  const packages = data?.packages || []
  const qrMenu = data?.qrMenu || {}
  const currency = data?.currency || 'PKR'
  const marqueeName = data?.marqueeName || 'Grand Palace Marquee'

  const showPricing = qrMenu.showPricing !== false

  const categories = useMemo(() => {
    const set = new Set(packages.map((p) => p.category).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [packages])

  const filteredPackages = useMemo(() => {
    if (selectedCategory === 'all') return packages
    return packages.filter((p) => p.category === selectedCategory)
  }, [packages, selectedCategory])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-400 selection:text-slate-950 font-sans pb-24">
      {/* ─── Hero Cover Banner ─── */}
      <div className="relative overflow-hidden border-b border-white/10">
        {qrMenu.heroImage ? (
          <div className="relative h-64 md:h-80 w-full">
            <img src={qrMenu.heroImage} alt={marqueeName} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/30" />
          </div>
        ) : (
          <div className="h-44 md:h-52 w-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950" />
        )}

        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 backdrop-blur-md px-3.5 py-1 text-xs font-black text-amber-300 border border-amber-400/30 w-fit mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{table}</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white">
            {qrMenu.welcomeTitle || marqueeName}
          </h1>

          <p className="text-xs md:text-sm text-slate-300 max-w-xl mt-1.5 leading-relaxed">
            {qrMenu.welcomeSubtitle ||
              'Honored guests, explore our curated banquet packages, live culinary counters, and venue hospitality.'}
          </p>

          {/* Quick Contacts */}
          {(qrMenu.whatsappNumber || qrMenu.contactPhone) && (
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {qrMenu.whatsappNumber && (
                <a
                  href={`https://wa.me/${qrMenu.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Inquiry</span>
                </a>
              )}
              {qrMenu.contactPhone && (
                <a
                  href={`tel:${qrMenu.contactPhone}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-bold text-slate-200 border border-white/10 hover:bg-white/20 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{qrMenu.contactPhone}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Content Container ─── */}
      <div className="mx-auto max-w-4xl px-4 pt-6 space-y-6">
        {/* Category Pills Filter */}
        {categories.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-2xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {cat === 'all' ? 'All Packages' : CATEGORY_NAMES[cat] || cat}
              </button>
            ))}
          </div>
        )}

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-xs text-slate-400">Loading Event Packages & Menu...</p>
          </div>
        ) : error || packages.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-slate-500 mb-2" />
            <h3 className="text-base font-bold text-white">Menu is Being Prepared</h3>
            <p className="mt-1 text-xs text-slate-400">
              The catering management team is finalizing packages for this celebration.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredPackages.map((pkg) => {
              // Group items by category
              const groupedItems = {}
              if (Array.isArray(pkg.items)) {
                pkg.items.forEach((item) => {
                  const cat = item.category || 'other'
                  if (!groupedItems[cat]) groupedItems[cat] = []
                  groupedItems[cat].push(item)
                })
              }

              return (
                <motion.div
                  key={pkg._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl transition hover:border-amber-400/30"
                >
                  {/* Package Photo (if uploaded) */}
                  {pkg.bannerImage && (
                    <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-slate-900">
                      <img src={pkg.bannerImage} alt={pkg.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                      <span className="absolute top-4 left-4 rounded-full bg-slate-950/80 backdrop-blur px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-300 border border-amber-400/30">
                        {CATEGORY_NAMES[pkg.category] || pkg.category}
                      </span>
                    </div>
                  )}

                  <div className="p-6 md:p-8 space-y-6">
                    {/* Header: Title & Pricing */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-white/10 pb-5">
                      <div>
                        {!pkg.bannerImage && (
                          <span className="inline-block rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 border border-amber-400/20 mb-2">
                            {CATEGORY_NAMES[pkg.category] || pkg.category}
                          </span>
                        )}
                        <h2 className="text-xl md:text-2xl font-black text-white">{pkg.name}</h2>
                        {pkg.description && (
                          <p className="mt-1 text-xs md:text-sm text-slate-400">{pkg.description}</p>
                        )}
                      </div>

                      {showPricing && (
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-right sm:shrink-0">
                          <div className="text-xs text-slate-400 font-medium">Rate Per Head:</div>
                          <div className="text-xl font-black text-amber-300 font-mono">
                            <Money amount={pkg.ratePerHead} currency={pkg.currency || currency} />
                          </div>
                          {pkg.hallBaseRent > 0 && (
                            <div className="text-[10.5px] text-slate-400 mt-0.5">
                              + Base Rent: <Money amount={pkg.hallBaseRent} currency={pkg.currency || currency} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Guest Capacity Badge */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span>Capacity: <strong className="text-slate-200">{pkg.minGuests} to {pkg.maxGuests} Guests</strong></span>
                    </div>

                    {/* Grouped Included Items */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-400/90">
                        Included Banquet Menu & Event Services:
                      </h4>

                      <div className="space-y-4">
                        {Object.entries(groupedItems).map(([catKey, catItems]) => (
                          <div key={catKey} className="space-y-2">
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5 pb-1">
                              {ITEM_CATEGORY_LABELS[catKey] || catKey}:
                            </h5>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {catItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs hover:bg-white/[0.04] transition"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                                    <span className="font-semibold text-slate-200">{item.itemName}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400">{item.portionSize}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Book / WhatsApp Button */}
                    {qrMenu.whatsappNumber && (
                      <div className="pt-2 border-t border-white/5">
                        <a
                          href={`https://wa.me/${qrMenu.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Hello, I would like to inquire about booking the "${pkg.name}" package.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-lg hover:bg-emerald-500 transition"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Inquire about this Package on WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="pt-8 text-center text-xs text-slate-500 space-y-1">
          <p>Managed by {marqueeName}</p>
          <p className="text-[10px] text-slate-600">Enjoy your celebration • Powered by Maqder ERP</p>
        </div>
      </div>
    </div>
  )
}

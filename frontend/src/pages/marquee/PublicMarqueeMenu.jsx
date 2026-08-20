import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  UtensilsCrossed, Sparkles, Clock, MapPin, Phone,
  CheckCircle2, Wifi, Calendar, Heart, Share2, Info
} from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

export default function PublicMarqueeMenu() {
  const { tenantSlug } = useParams()
  const [searchParams] = useSearchParams()
  const table = searchParams.get('table') || 'Guest Table'

  const [activeCategory, setActiveCategory] = useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-marquee-menu', tenantSlug],
    queryFn: () => api.get(`/marquee/public/menu/${tenantSlug}`).then((r) => r.data),
  })

  const packages = data?.packages || []
  const currency = data?.currency || 'SAR'

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-amber-400 selection:text-slate-950 font-sans pb-16">
      {/* Top Banner Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 px-6 pt-12 pb-8 text-center border-b border-white/10">
        <div className="mx-auto max-w-lg space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20 shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            {data?.marqueeName || 'Grand Palace Marquee & Banquets'}
          </h1>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-amber-300">
            <span>✨ Welcome to the Celebration</span>
            <span>•</span>
            <span>{table}</span>
          </div>

          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Honored guests, please enjoy our hospitality and culinary selections prepared with utmost care.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-xs text-slate-400">Loading Banquet Menu...</p>
          </div>
        ) : error || packages.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <UtensilsCrossed className="mx-auto h-8 w-8 text-slate-500" />
            <h3 className="mt-3 text-sm font-bold text-white">Menu is Being Prepared</h3>
            <p className="mt-1 text-xs text-slate-400">
              The catering team is finalizing the menu selections for this occasion.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {packages.map((pkg) => (
              <motion.div
                key={pkg._id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md shadow-xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <span className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/20">
                      {pkg.category}
                    </span>
                    <h2 className="mt-2 text-lg font-black text-white">{pkg.name}</h2>
                    {pkg.nameAr && <p className="text-xs text-slate-400">{pkg.nameAr}</p>}
                  </div>
                </div>

                {/* Items List */}
                <div className="mt-4 space-y-2.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Menu & Buffet Selections:
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {pkg.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="font-bold text-slate-200">{item.itemName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{item.portionSize}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer info */}
        <div className="pt-6 text-center text-xs text-slate-500 space-y-1">
          <p>Managed by {data?.marqueeName || 'Maqder Marquee Management'}</p>
          <p className="text-[10px] text-slate-600">Enjoy your evening • Powered by Maqder ERP</p>
        </div>
      </div>
    </div>
  )
}

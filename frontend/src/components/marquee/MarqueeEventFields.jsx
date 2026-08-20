import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes, Calendar, Clock, Users, DollarSign,
  Sparkles, CheckCircle2, AlertTriangle, Building, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../ui/Money'

const SHIFTS = [
  { id: 'lunch', en: 'Lunch (12:00 PM – 4:00 PM)', ar: 'فترة الغداء (12:00 م – 4:00 م)' },
  { id: 'dinner', en: 'Dinner (7:00 PM – 11:30 PM)', ar: 'فترة العشاء (7:00 م – 11:30 م)' },
  { id: 'morning', en: 'Morning Event', ar: 'الفترة الصباحية' },
  { id: 'night', en: 'Late Night Gala', ar: 'سهرة مسائية' },
  { id: 'full_day', en: 'Full Day (Exclusive)', ar: 'يوم كامل (حجز حصري)' },
]

export default function MarqueeEventFields({
  values = {},
  setValue,
  register,
  currency = 'SAR',
  language = 'en',
  onApplyPackageItems,
}) {
  const isAr = language === 'ar'
  const [selectedPkgId, setSelectedPkgId] = useState(values.marqueePackageId || '')

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['marquee-packages-composer'],
    queryFn: () => api.get('/marquee/packages', { params: { isActive: true } }).then((r) => r.data),
  })

  const guestCount = Number(values.guestCount || values.personCount || 100)
  const advancePaid = Number(values.advancePaid || 0)
  const totalAmount = Number(values.grandTotal || values.subtotal || 0)
  const remaining = Math.max(0, totalAmount - advancePaid)

  const handleSelectPackage = (pkgId) => {
    setSelectedPkgId(pkgId)
    setValue('marqueePackageId', pkgId, { shouldDirty: true })

    const pkg = packages.find((p) => String(p._id) === String(pkgId))
    if (!pkg) return

    setValue('packageName', pkg.name, { shouldDirty: true })
    setValue('ratePerHead', pkg.ratePerHead, { shouldDirty: true })
    setValue('hallBaseRent', pkg.hallBaseRent || 0, { shouldDirty: true })

    if (typeof onApplyPackageItems === 'function') {
      onApplyPackageItems(pkg)
      toast.success(
        isAr
          ? `تم تطبيق باقة (${pkg.nameAr || pkg.name}) وتعبئة بنود القائمة بنجاح`
          : `Applied package (${pkg.name}) & auto-filled line items!`
      )
    }
  }

  return (
    <div className="rounded-3xl border border-amber-500/30 bg-amber-50/20 p-5 dark:border-amber-500/20 dark:bg-amber-500/5 space-y-4">
      {/* Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              {isAr ? 'بيانات حفل وقاعة المناسبات (Marquee Event Details)' : 'Marquee & Banquet Event Details'}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'اختيار الباقة يعبئ بنود الفاتورة والوجبات تلقائياً، ويسجل الموعد بالتقويم فور الحفظ.'
                : 'Select package to auto-populate items & guest pricing. Automatically syncs to Bookings Calendar.'}
            </p>
          </div>
        </div>

        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
          {isAr ? 'قاعات ومناسبات' : 'Marquee App'}
        </span>
      </div>

      {/* Package Selector & Auto-fill Trigger */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-8">
          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            {isAr ? 'اختر باقة المناسبة لتعبئة الأصناف تلقائياً' : 'Choose Package to Auto-fill Menu Items'}
          </label>
          <select
            value={selectedPkgId}
            onChange={(e) => handleSelectPackage(e.target.value)}
            className="w-full rounded-2xl border border-amber-500/30 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs focus:border-amber-600 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
          >
            <option value="">{isAr ? '— اختر باقة من الباقات المسجلة —' : '— Select a Marquee Package —'}</option>
            {packages.map((p) => (
              <option key={p._id} value={p._id}>
                {isAr ? p.nameAr || p.name : p.name} — ({p.ratePerHead} {currency} / {isAr ? 'شخص' : 'head'}) [{p.items?.length || 0} {isAr ? 'أصناف' : 'items'}]
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-4 flex items-end">
          {selectedPkgId && (
            <button
              type="button"
              onClick={() => {
                const pkg = packages.find((p) => String(p._id) === String(selectedPkgId))
                if (pkg) handleSelectPackage(pkg._id)
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-amber-500 px-3.5 py-2.5 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-400"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{isAr ? 'إعادة تعبئة الأصناف' : 'Re-fill Package Items'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Date, Shift, Persons, Hall & Advance Paid Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {isAr ? 'تاريخ الفعالية' : 'Event Date'} *
          </label>
          <input
            type="date"
            {...register('eventDate')}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {isAr ? 'فترة الحفل' : 'Event Shift'}
          </label>
          <select
            {...register('eventShift')}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
          >
            {SHIFTS.map((s) => (
              <option key={s.id} value={s.id}>
                {isAr ? s.ar : s.en}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {isAr ? 'عدد الأشخاص / الضيوف' : 'Guest Count (Persons)'} *
          </label>
          <input
            type="number"
            min="1"
            {...register('guestCount')}
            placeholder="250"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {isAr ? 'اسم القاعة' : 'Hall / Venue'}
          </label>
          <input
            type="text"
            {...register('hallName')}
            placeholder="Grand Ballroom"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {isAr ? 'الدفعة المقدمة' : 'Advance Paid'} ({currency})
          </label>
          <input
            type="number"
            min="0"
            {...register('advancePaid')}
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
          />
        </div>
      </div>

      {/* Hidden inputs for sync */}
      <input type="hidden" {...register('marqueePackageId')} />
      <input type="hidden" {...register('packageName')} />
      <input type="hidden" {...register('ratePerHead')} />
      <input type="hidden" {...register('hallBaseRent')} />
    </div>
  )
}

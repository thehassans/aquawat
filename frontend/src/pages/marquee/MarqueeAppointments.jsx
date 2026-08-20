import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays, Plus, Search, Filter, AlertTriangle,
  Clock, Users, CheckCircle2, X, Sparkles, Building,
  DollarSign, FileText, Phone, Mail, ChevronRight,
  ArrowRight, RefreshCw, Calendar as CalendarIcon, Eye, Edit
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

const SHIFTS = [
  { id: 'lunch', en: 'Lunch (12:00 PM – 4:00 PM)', ar: 'فترة الغداء (12:00 م – 4:00 م)' },
  { id: 'dinner', en: 'Dinner (7:00 PM – 11:30 PM)', ar: 'فترة العشاء (7:00 م – 11:30 م)' },
  { id: 'morning', en: 'Morning / Breakfast', ar: 'الفترة الصباحية' },
  { id: 'night', en: 'Late Night Reception', ar: 'سهرة مسائية' },
  { id: 'full_day', en: 'Full Day (Exclusive)', ar: 'يوم كامل (حجز حصري)' },
]

const STATUSES = [
  { id: 'confirmed', en: 'Confirmed', ar: 'مؤكد', tone: 'emerald' },
  { id: 'tentative', en: 'Tentative / Hold', ar: 'حجز مبدئي معلق', tone: 'amber' },
  { id: 'inquiry', en: 'Inquiry', ar: 'استفسار', tone: 'blue' },
  { id: 'in_progress', en: 'In Progress', ar: 'قيد التنفيذ', tone: 'purple' },
  { id: 'completed', en: 'Completed', ar: 'مكتمل', tone: 'slate' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغي', tone: 'rose' },
]

export default function MarqueeAppointments() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'

  const currency = tenant?.settings?.currency || 'SAR'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [shiftFilter, setShiftFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState(null)

  // Booking Form State
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState('wedding')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [eventShift, setEventShift] = useState('dinner')
  const [hallName, setHallName] = useState('Grand Ballroom')
  const [guestCount, setGuestCount] = useState(250)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [ratePerHead, setRatePerHead] = useState(0)
  const [hallBaseRent, setHallBaseRent] = useState(0)
  const [advancePaid, setAdvancePaid] = useState(0)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('confirmed')

  // Fetch bookings
  const { data, isLoading } = useQuery({
    queryKey: ['marquee-appointments', search, statusFilter, shiftFilter],
    queryFn: () =>
      api
        .get('/marquee/appointments', {
          params: {
            search: search || undefined,
            status: statusFilter || undefined,
            eventShift: shiftFilter || undefined,
          },
        })
        .then((r) => r.data),
  })

  // Fetch active packages for the dropdown selector
  const { data: packages = [] } = useQuery({
    queryKey: ['marquee-packages-active'],
    queryFn: () => api.get('/marquee/packages', { params: { isActive: true } }).then((r) => r.data),
  })

  // Check double-booking conflict
  const { data: conflictData } = useQuery({
    queryKey: ['marquee-conflict-check', eventDate, eventShift, hallName, editingBooking?._id],
    queryFn: () =>
      api
        .get('/marquee/appointments/check-conflict', {
          params: {
            eventDate,
            eventShift,
            hallName,
            excludeBookingId: editingBooking?._id || undefined,
          },
        })
        .then((r) => r.data),
    enabled: Boolean(eventDate && eventShift && drawerOpen),
  })

  const bookings = data?.bookings || []

  // Calculated totals
  const totalAmount = useMemo(() => {
    return (Number(guestCount) || 0) * (Number(ratePerHead) || 0) + (Number(hallBaseRent) || 0)
  }, [guestCount, ratePerHead, hallBaseRent])

  const remainingAmount = useMemo(() => {
    return Math.max(0, totalAmount - (Number(advancePaid) || 0))
  }, [totalAmount, advancePaid])

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingBooking
        ? api.put(`/marquee/appointments/${editingBooking._id}`, payload)
        : api.post('/marquee/appointments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['marquee-appointments'])
      toast.success(
        editingBooking
          ? isAr ? 'تم تحديث الحجز بنجاح' : 'Booking updated successfully'
          : isAr ? 'تم تسجيل الحجز بنجاح' : 'Booking created successfully'
      )
      closeDrawer()
    },
    onError: (err) =>
      toast.error(err.response?.data?.error || (isAr ? 'تعذر حفظ الحجز' : 'Failed to save booking')),
  })

  const handlePackageChange = (pkgId) => {
    setSelectedPackageId(pkgId)
    const pkg = packages.find((p) => String(p._id) === String(pkgId))
    if (pkg) {
      setRatePerHead(pkg.ratePerHead || 0)
      setHallBaseRent(pkg.hallBaseRent || 0)
    }
  }

  const openDrawer = (b = null) => {
    if (b) {
      setEditingBooking(b)
      setTitle(b.title || '')
      setEventType(b.eventType || 'wedding')
      setEventDate(b.eventDate ? new Date(b.eventDate).toISOString().split('T')[0] : '')
      setEventShift(b.eventShift || 'dinner')
      setHallName(b.hallName || 'Grand Ballroom')
      setGuestCount(b.guestCount || 100)
      setClientName(b.clientName || '')
      setClientPhone(b.clientPhone || '')
      setClientEmail(b.clientEmail || '')
      setSelectedPackageId(b.packageId?._id || b.packageId || '')
      setRatePerHead(b.ratePerHead || 0)
      setHallBaseRent(b.hallBaseRent || 0)
      setAdvancePaid(b.advancePaid || 0)
      setNotes(b.notes || '')
      setStatus(b.status || 'confirmed')
    } else {
      setEditingBooking(null)
      setTitle('')
      setEventType('wedding')
      setEventDate(new Date().toISOString().split('T')[0])
      setEventShift('dinner')
      setHallName('Grand Ballroom')
      setGuestCount(250)
      setClientName('')
      setClientPhone('')
      setClientEmail('')
      setSelectedPackageId(packages[0]?._id || '')
      setRatePerHead(packages[0]?.ratePerHead || 0)
      setHallBaseRent(packages[0]?.hallBaseRent || 0)
      setAdvancePaid(0)
      setNotes('')
      setStatus('confirmed')
    }
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingBooking(null)
  }

  const handleSave = () => {
    if (!title.trim() || !clientName.trim() || !clientPhone.trim()) {
      toast.error(isAr ? 'يرجى إدخال عنوان المناسبة وبيانات العميل' : 'Please fill required event details')
      return
    }

    const selectedPkg = packages.find((p) => String(p._id) === String(selectedPackageId))

    saveMutation.mutate({
      title,
      eventType,
      eventDate,
      eventShift,
      hallName,
      guestCount: Number(guestCount) || 100,
      clientName,
      clientPhone,
      clientEmail,
      packageId: selectedPackageId || undefined,
      packageName: selectedPkg?.name,
      ratePerHead: Number(ratePerHead) || 0,
      hallBaseRent: Number(hallBaseRent) || 0,
      selectedItems: selectedPkg?.items || [],
      subtotal: totalAmount,
      totalAmount,
      advancePaid: Number(advancePaid) || 0,
      remainingAmount,
      notes,
      status,
      currency,
    })
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'حجوزات القاعات والمواعيد' : 'Marquee Bookings & Calendar'}
            </h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              {bookings.length} {isAr ? 'حجز' : 'Events'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'إدارة حجوزات القاعات والمناسبات، منع تعارض المواعيد، وتتبع الدفعات المقدمة والمتبقية.'
              : 'Real-time wedding and banquet bookings schedule, hall slot conflict detection, and payment tracking.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openDrawer(null)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{isAr ? 'تسجيل حجز جديد' : 'New Booking'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isAr ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث برقم الحجز، اسم العميل، أو القاعة...' : 'Search booking number, client, or hall...'}
              className={`h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-slate-900 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800/60 dark:text-white ${
                isAr ? 'pr-10 pl-9' : 'pl-10 pr-9'
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
            >
              <option value="">{isAr ? 'جميع الفترات' : 'All Shifts'}</option>
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {isAr ? s.ar : s.en}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
            >
              <option value="">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {isAr ? s.ar : s.en}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table / Stream */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-700 dark:border-t-white" />
            <p className="text-xs text-slate-400">{isAr ? 'جاري تحميل الحجوزات...' : 'Loading bookings...'}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-dark-800">
              <CalendarDays className="h-8 w-8 stroke-[1.8]" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'لا توجد حجوزات مسجلة' : 'No Bookings Found'}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'ابدأ بتسجيل أول حجز لمناسبة أو زفاف في قاعتك.'
                : 'Get started by booking your first event or wedding.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                  <th className="py-3.5 px-5 text-start">{isAr ? 'رقم الحجز والمناسبة' : 'Booking / Event'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'التاريخ والفترة' : 'Date & Shift'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'العميل والضيوف' : 'Client & Guests'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الباقة والإجمالي' : 'Package & Total'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المقدم / المتبقي' : 'Advance / Balance'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-5 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {bookings.map((b) => {
                  const statusMeta = STATUSES.find((s) => s.id === b.status) || { en: b.status, ar: b.status, tone: 'slate' }
                  const shiftMeta = SHIFTS.find((s) => s.id === b.eventShift) || { en: b.eventShift, ar: b.eventShift }

                  return (
                    <tr
                      key={b._id}
                      onClick={() => openDrawer(b)}
                      className="group cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-3.5 px-5">
                        <div>
                          <span className="font-mono text-[11px] font-bold text-slate-400">
                            {b.bookingNumber}
                          </span>
                          <p className="font-bold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400 transition-colors">
                            {b.title}
                          </p>
                          <span className="text-[11px] text-slate-500">{b.hallName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {new Date(b.eventDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <span className="text-[11px] text-slate-400">
                            {isAr ? shiftMeta.ar : shiftMeta.en}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{b.clientName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{b.clientPhone}</p>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <Users className="h-3 w-3" /> {b.guestCount} {isAr ? 'شخص' : 'guests'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            <Money amount={b.totalAmount} currency={b.currency || currency} />
                          </p>
                          <span className="text-[11px] text-slate-400 truncate max-w-[140px] block">
                            {b.packageName || (isAr ? 'حجز مخصص' : 'Custom')}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="text-[11px] text-emerald-600 font-bold">
                            {isAr ? 'مقدم:' : 'Adv:'} <Money amount={b.advancePaid} currency={b.currency || currency} />
                          </div>
                          <div className="text-[11px] text-rose-600 font-bold">
                            {isAr ? 'متبقي:' : 'Bal:'} <Money amount={b.remainingAmount} currency={b.currency || currency} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                            b.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : b.status === 'tentative'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-dark-800 dark:text-slate-300'
                          }`}
                        >
                          {isAr ? statusMeta.ar : statusMeta.en}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDrawer(b)}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                          >
                            {isAr ? 'تفاصيل' : 'Details'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── BOOKING DRAWER ─── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: isAr ? -640 : 640 }}
              animate={{ x: 0 }}
              exit={{ x: isAr ? -640 : 640 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className={`fixed top-0 bottom-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#0c111a] ${
                isAr ? 'left-0 border-r border-slate-200 dark:border-white/10' : 'right-0 border-l border-slate-200 dark:border-white/10'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/10">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingBooking
                      ? isAr ? `تعديل الحجز: ${editingBooking.bookingNumber}` : `Edit Booking: ${editingBooking.bookingNumber}`
                      : isAr ? 'تسجيل حجز قاعة جديد' : 'New Marquee Booking'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {isAr
                      ? 'حدد موعد المناسبة، القاعة، الباقة المختارة والدفعة المقدمة.'
                      : 'Schedule wedding or event, select package, and track deposit.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Conflict Alert Banner */}
              {conflictData?.isConflict && (
                <div className="flex items-center gap-3 border-b border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                  <div>
                    <p>{isAr ? 'تنبيه تعارض مواعيد!' : 'Double-Booking Warning!'}</p>
                    <p className="font-normal text-[11px] text-rose-700/80 dark:text-rose-400">
                      {isAr
                        ? `هذه القاعة محجوزة مسبقاً لنفس التاريخ والفترة للحجز (${conflictData.conflictingBooking?.title}).`
                        : `This hall already has a confirmed event (${conflictData.conflictingBooking?.title}) on this date/shift.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Event Name & Client Info */}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'عنوان المناسبة / الحجز' : 'Event Title / Occasion'} *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={isAr ? 'مثال: حفل زفاف آل أحمد وآل خالد' : 'e.g. Ahmed & Fatima Wedding Reception'}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'اسم العميل / المستضيف' : 'Client / Host Name'} *
                      </label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'رقم الهاتف' : 'Phone Number'} *
                      </label>
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="+9665xxxxxxxx / 03xxxxxxxxx"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Date, Shift & Hall */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'تاريخ المناسبة' : 'Event Date'} *
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'الفترة' : 'Shift'}
                    </label>
                    <select
                      value={eventShift}
                      onChange={(e) => setEventShift(e.target.value)}
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
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'اسم القاعة' : 'Hall / Pavilion'}
                    </label>
                    <input
                      type="text"
                      value={hallName}
                      onChange={(e) => setHallName(e.target.value)}
                      placeholder="Grand Ballroom"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Package Selection & Pricing Calculator */}
                <div className="rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-dark-800/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {isAr ? 'الباقة وحساب التكلفة' : 'Package & Pricing'}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600">
                      {currency}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'اختيار باقة المناسبة' : 'Select Package'}
                      </label>
                      <select
                        value={selectedPackageId}
                        onChange={(e) => handlePackageChange(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                      >
                        <option value="">{isAr ? '— باقة مخصصة —' : '— Custom Package —'}</option>
                        {packages.map((p) => (
                          <option key={p._id} value={p._id}>
                            {isAr ? p.nameAr || p.name : p.name} ({p.ratePerHead} {currency}/head)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'عدد الضيوف / الأشخاص' : 'Guest Count (Persons)'} *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={guestCount}
                        onChange={(e) => setGuestCount(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'سعر الشخص' : 'Rate / Head'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={ratePerHead}
                        onChange={(e) => setRatePerHead(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'إيجار القاعة' : 'Hall Rent'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={hallBaseRent}
                        onChange={(e) => setHallBaseRent(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'الدفعة المقدمة' : 'Advance Paid'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={advancePaid}
                        onChange={(e) => setAdvancePaid(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-dark-800 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>{isAr ? 'إجمالي الحجز:' : 'Total Amount:'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        <Money amount={totalAmount} currency={currency} />
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>{isAr ? 'الدفعة المقدمة المستلمة:' : 'Advance Received:'}</span>
                      <span><Money amount={advancePaid} currency={currency} /></span>
                    </div>
                    <div className="flex justify-between text-rose-600 font-black border-t border-slate-100 pt-1.5 dark:border-white/5">
                      <span>{isAr ? 'المبلغ المتبقي المستحق:' : 'Remaining Balance:'}</span>
                      <span><Money amount={remainingAmount} currency={currency} /></span>
                    </div>
                  </div>
                </div>

                {/* Status & Notes */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'حالة الحجز' : 'Booking Status'}
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {isAr ? s.ar : s.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'ملاحظات إضافية' : 'Special Notes'}
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Stage color, sound preferences..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 p-6 dark:border-white/10">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                  {saveMutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-950" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>{editingBooking ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : isAr ? 'تسجيل الحجز' : 'Confirm Booking'}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

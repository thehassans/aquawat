import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes, Plus, Search, Edit, Trash2, CheckCircle2,
  X, Sparkles, UtensilsCrossed, Users, Calendar, DollarSign,
  Layers, Tag, Info, ArrowRight, Printer, Copy, Check, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

const ITEM_CATEGORIES = [
  { id: 'welcome_drinks', en: 'Welcome Drinks & Juices', ar: 'المشروبات الترحيبية والعصائر' },
  { id: 'starters', en: 'Starters & Finger Food', ar: 'المقبلات والوجبات الخفيفة' },
  { id: 'bbq', en: 'Live BBQ & Grills', ar: 'المشاوي والباربكيو الحي' },
  { id: 'main_course', en: 'Main Course & Curries', ar: 'الأطباق الرئيسية والإدامات' },
  { id: 'rice_dishes', en: 'Rice Dishes & Biryani / Mandi', ar: 'أطباق الأرز والبرياني والمندي' },
  { id: 'breads', en: 'Breads, Naan & Rotis', ar: 'المخبوزات والخبز والنان' },
  { id: 'salads_sauces', en: 'Salads, Raita & Sauces', ar: 'السلطات والمقبلات والصلصات' },
  { id: 'desserts', en: 'Desserts & Sweets', ar: 'الحلويات الشرقية والغربية' },
  { id: 'beverages', en: 'Tea, Coffee & Water', ar: 'الشاي والقهوة والمياه' },
  { id: 'stage_decor', en: 'Stage & Floral Decor', ar: 'ديكور المسرح والورود' },
  { id: 'lighting_sound', en: 'Sound System & DJ / Lighting', ar: 'الصوتيات والإضاءة' },
  { id: 'hall_services', en: 'Hall Services & Valet Parking', ar: 'خدمات القاعة وصف السيارات' },
  { id: 'bridal_services', en: 'Bridal Room & VIP Lounge', ar: 'جناح العروس واستراحة VIP' },
  { id: 'photography', en: 'Photography & Media', ar: 'التصوير والتوثيق' },
  { id: 'other', en: 'Additional Services', ar: 'خدمات إضافية' },
]

const PACKAGE_CATEGORIES = [
  { id: 'wedding', en: 'Wedding (Baraat / Zafah)', ar: 'حفل زفاف رئيسي' },
  { id: 'reception', en: 'Reception (Valima)', ar: 'حفل استقبال وعشاء' },
  { id: 'mehndi', en: 'Mehndi / Henna Night', ar: 'ليلة حناء وموسيقى' },
  { id: 'engagement', en: 'Engagement / Nikah', ar: 'عقد قران وخطوبة' },
  { id: 'corporate', en: 'Corporate Gala / Conference', ar: 'مؤتمر وفعالية شركات' },
  { id: 'birthday', en: 'Birthday / Anniversary', ar: 'حفل خاص وذكرى' },
  { id: 'qawwali_dinner', en: 'Musical Night & Qawwali', ar: 'أمسية طربية وموسيقية' },
  { id: 'exhibition', en: 'Exhibition & Expo', ar: 'معرض وفعالية تجارية' },
  { id: 'other', en: 'Custom Banquet Event', ar: 'مناسبة خاصة مخصصة' },
]

const PRESET_PACKAGES = [
  {
    name: 'Royal Diamond Banquet & Live BBQ',
    nameAr: 'باقة الماسة الملكية مع مشاوي حية وبوفيه فاخر',
    category: 'wedding',
    ratePerHead: 3200,
    hallBaseRent: 50000,
    minGuests: 150,
    maxGuests: 1200,
    items: [
      { itemName: 'Fresh Mint Lemonade & Welcome Mojito', itemNameAr: 'عصير ليمون بالنعناع ومشروب ترحيبي', category: 'welcome_drinks', portionSize: '1 glass' },
      { itemName: 'Mutton Seekh Kabab & Malai Boti Live Station', itemNameAr: 'مشاوي كباب لحم وشيش طاووق حي', category: 'bbq', portionSize: '2 skewers' },
      { itemName: 'Special Mutton Dum Biryani / Mandi', itemNameAr: 'برياني لحم ضأن فاخر / مندي ملكي', category: 'rice_dishes', portionSize: '1 portion' },
      { itemName: 'Chicken Karahi / White Handi', itemNameAr: 'دجاج كراهي / هاندي أبيض فاخر', category: 'main_course', portionSize: '1 portion' },
      { itemName: 'Assorted Fresh Tandoori Naan & Roghani Naan', itemNameAr: 'تشكيلة خبز تنور طازج ونان روغني', category: 'breads', portionSize: 'Unlimited' },
      { itemName: 'Fresh Greek Salad, Hummus & Mint Raita', itemNameAr: 'سلطة يونانية، حمص، وسلطة روب بالنعناع', category: 'salads_sauces', portionSize: 'Buffet' },
      { itemName: 'Hot Gulab Jamun & Shahi Tukray with Ice Cream', itemNameAr: 'حلوى جولاب جامون وشاهي توكرا مع آيس كريم', category: 'desserts', portionSize: '1 serving' },
      { itemName: 'Kashmiri Chai & Cardamom Tea', itemNameAr: 'شاي كشميري وشاي بالهيل', category: 'beverages', portionSize: '1 cup' },
      { itemName: 'Royal Stage Floral Setup with LED Backdrop', itemNameAr: 'ديكور مسرح ملكي بالورود وشاشة LED', category: 'stage_decor', portionSize: 'Complete' },
      { itemName: 'Concert Sound System & Mood Lighting', itemNameAr: 'نظام صوتيات متكامل وإضاءة سينمائية', category: 'lighting_sound', portionSize: 'Complete' },
      { itemName: 'Valet Parking & Uniformed Waiters Team', itemNameAr: 'خدمة صف سيارات وطاقم ضيافة متميز', category: 'hall_services', portionSize: 'Included' },
    ],
  },
  {
    name: 'Executive Corporate Conference & Dinner',
    nameAr: 'باقة المؤتمرات والشركات والعشاء التنفيذي',
    category: 'corporate',
    ratePerHead: 1800,
    hallBaseRent: 35000,
    minGuests: 80,
    maxGuests: 600,
    items: [
      { itemName: 'Hi-Tea Snacks & Coffee Break', itemNameAr: 'استراحة قهوة وشاي ومقبلات خفيفة', category: 'welcome_drinks', portionSize: '1 set' },
      { itemName: 'Grilled Chicken Steaks with Herb Sauce', itemNameAr: 'ستيك دجاج مشوي مع صوص الأعشاب', category: 'main_course', portionSize: '1 portion' },
      { itemName: 'Arabic Fragrant Rice with Roasted Nuts', itemNameAr: 'أرز شرقي بالمكسرات المحمصة', category: 'rice_dishes', portionSize: '1 portion' },
      { itemName: 'Creamy Mushroom Soup & Caesar Salad', itemNameAr: 'شوربة الفطر بالكريمة وسلطة سيزر', category: 'starters', portionSize: '1 bowl' },
      { itemName: 'Tiramisu & Fresh Fruit Tart', itemNameAr: 'تيراميسو وتارت الفواكه الطازجة', category: 'desserts', portionSize: '1 serving' },
      { itemName: 'HD Multimedia Projectors & Wireless Microphones', itemNameAr: 'أجهزة عرض بروجيكتور ومايكات لاسلكية', category: 'lighting_sound', portionSize: 'Full Set' },
    ],
  },
]

export default function MarqueePackages() {
  const queryClient = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'

  const currency = tenant?.settings?.currency || 'SAR'

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPkg, setEditingPkg] = useState(null)

  // Form State
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [category, setCategory] = useState('wedding')
  const [description, setDescription] = useState('')
  const [ratePerHead, setRatePerHead] = useState(2500)
  const [hallBaseRent, setHallBaseRent] = useState(0)
  const [minGuests, setMinGuests] = useState(100)
  const [maxGuests, setMaxGuests] = useState(1000)
  const [items, setItems] = useState([])

  // Item addition state
  const [newItemName, setNewItemName] = useState('')
  const [newItemNameAr, setNewItemNameAr] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('main_course')
  const [newItemPortion, setNewItemPortion] = useState('1 per head')

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['marquee-packages', search, categoryFilter],
    queryFn: () =>
      api
        .get('/marquee/packages', {
          params: { search: search || undefined, category: categoryFilter || undefined },
        })
        .then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingPkg ? api.put(`/marquee/packages/${editingPkg._id}`, payload) : api.post('/marquee/packages', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['marquee-packages'])
      toast.success(
        editingPkg
          ? isAr ? 'تم تحديث باقة المناسبات بنجاح' : 'Package updated successfully'
          : isAr ? 'تم إنشاء الباقة بنجاح' : 'Package created successfully'
      )
      closeDrawer()
    },
    onError: (err) =>
      toast.error(err.response?.data?.error || (isAr ? 'تعذر حفظ الباقة' : 'Failed to save package')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/marquee/packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['marquee-packages'])
      toast.success(isAr ? 'تم حذف الباقة' : 'Package deleted')
    },
    onError: (err) =>
      toast.error(err.response?.data?.error || (isAr ? 'تعذر حذف الباقة' : 'Failed to delete package')),
  })

  const openDrawer = (pkg = null) => {
    if (pkg) {
      setEditingPkg(pkg)
      setName(pkg.name || '')
      setNameAr(pkg.nameAr || '')
      setCategory(pkg.category || 'wedding')
      setDescription(pkg.description || '')
      setRatePerHead(pkg.ratePerHead || 0)
      setHallBaseRent(pkg.hallBaseRent || 0)
      setMinGuests(pkg.minGuests || 50)
      setMaxGuests(pkg.maxGuests || 1000)
      setItems(Array.isArray(pkg.items) ? [...pkg.items] : [])
    } else {
      setEditingPkg(null)
      setName('')
      setNameAr('')
      setCategory('wedding')
      setDescription('')
      setRatePerHead(2500)
      setHallBaseRent(0)
      setMinGuests(100)
      setMaxGuests(1000)
      setItems([])
    }
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingPkg(null)
  }

  const handleAddItem = (e) => {
    e.preventDefault()
    if (!newItemName.trim()) return
    setItems([
      ...items,
      {
        itemName: newItemName.trim(),
        itemNameAr: newItemNameAr.trim() || undefined,
        category: newItemCategory,
        portionSize: newItemPortion || '1 per head',
      },
    ])
    setNewItemName('')
    setNewItemNameAr('')
  }

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const applyPreset = (preset) => {
    setName(preset.name)
    setNameAr(preset.nameAr)
    setCategory(preset.category)
    setRatePerHead(preset.ratePerHead)
    setHallBaseRent(preset.hallBaseRent)
    setMinGuests(preset.minGuests)
    setMaxGuests(preset.maxGuests)
    setItems([...preset.items])
    toast.success(isAr ? 'تم تطبيق القالب المقترح' : 'Preset template applied')
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error(isAr ? 'يرجى إدخال اسم الباقة' : 'Please enter package name')
      return
    }
    saveMutation.mutate({
      name,
      nameAr,
      category,
      description,
      ratePerHead: Number(ratePerHead) || 0,
      hallBaseRent: Number(hallBaseRent) || 0,
      minGuests: Number(minGuests) || 1,
      maxGuests: Number(maxGuests) || 2000,
      items,
      currency,
    })
  }

  // Example total calculation preview
  const previewGuests = 250
  const previewTotal = previewGuests * (Number(ratePerHead) || 0) + (Number(hallBaseRent) || 0)

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'باقات قاعات الأفراح والمناسبات' : 'Marquee & Banquet Packages'}
            </h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {packages.length} {isAr ? 'باقة متاحة' : 'Packages'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'إنشاء باقات المناسبات مع تسعير للشخص الواحد، وإدراج قائمة الأطعمة والديكور مع الربط التلقائي بالفواتير وعروض الأسعار.'
              : 'Design customizable event packages with per-head rates, menu items & stage services. Auto-fills into invoices and quotations.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openDrawer(null)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{isAr ? 'إنشاء باقة جديدة' : 'Create Package'}</span>
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
              placeholder={isAr ? 'بحث باسم الباقة أو الأصناف...' : 'Search package name, items or category...'}
              className={`h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-slate-900 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800/60 dark:text-white ${
                isAr ? 'pr-10 pl-9' : 'pl-10 pr-9'
              }`}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
          >
            <option value="">{isAr ? 'جميع الفئات' : 'All Categories'}</option>
            {PACKAGE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {isAr ? c.ar : c.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Packages Grid */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-700 dark:border-t-white" />
          <p className="text-xs text-slate-400">{isAr ? 'جاري تحميل الباقات...' : 'Loading packages...'}</p>
        </div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-[#0c111a]">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-dark-800">
            <Boxes className="h-8 w-8 stroke-[1.8]" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            {isAr ? 'لا توجد باقات مناسبات مسجلة' : 'No Marquee Packages Yet'}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'أنشئ أول باقة مناسبات وقم بإضافة قائمة الأطعمة والديكور مع سعر الشخص الواحد.'
              : 'Create your first event package with per-head pricing, menu items, and stage services.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => openDrawer(null)}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white dark:bg-white dark:text-slate-950"
            >
              {isAr ? 'إنشاء باقة الآن' : 'Create Package'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const catMeta = PACKAGE_CATEGORIES.find((c) => c.id === pkg.category) || { en: pkg.category, ar: pkg.category }
            const itemCount = pkg.items?.length || 0

            return (
              <motion.div
                key={pkg._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-[#0c111a]"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-slate-700 dark:bg-white/10 dark:text-slate-300">
                      {isAr ? catMeta.ar : catMeta.en}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {pkg.minGuests} – {pkg.maxGuests} {isAr ? 'ضيف' : 'Guests'}
                    </span>
                  </div>

                  {/* Title & Rates */}
                  <div className="mt-4">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {isAr ? pkg.nameAr || pkg.name : pkg.name}
                    </h3>
                    {pkg.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {pkg.description}
                      </p>
                    )}
                  </div>

                  {/* Pricing Bento */}
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/5 dark:bg-dark-800/60">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isAr ? 'سعر الشخص الواحد' : 'Per-Head Rate'}:
                      </span>
                      <div className="text-base font-black text-slate-950 dark:text-white">
                        <Money amount={pkg.ratePerHead} currency={pkg.currency || currency} />
                        <span className="text-[10px] font-normal text-slate-400"> / {isAr ? 'شخص' : 'person'}</span>
                      </div>
                    </div>

                    {pkg.hallBaseRent > 0 && (
                      <div className="mt-1.5 flex items-baseline justify-between border-t border-slate-200/50 pt-1.5 dark:border-white/5 text-xs text-slate-500">
                        <span>{isAr ? 'إيجار القاعة الأساسي' : 'Base Hall Rent'}:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          <Money amount={pkg.hallBaseRent} currency={pkg.currency || currency} />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Included Items Preview */}
                  <div className="mt-4 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {isAr ? `الأصناف المشمولة (${itemCount})` : `Included Items (${itemCount})`}:
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {pkg.items?.slice(0, 6).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="truncate">{isAr ? item.itemNameAr || item.itemName : item.itemName}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.portionSize}</span>
                        </div>
                      ))}
                      {itemCount > 6 && (
                        <p className="text-[10px] font-bold text-slate-400">
                          +{itemCount - 6} {isAr ? 'أصناف إضافية...' : 'more items...'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => openDrawer(pkg)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>{isAr ? 'تعديل' : 'Edit'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الباقة؟' : 'Delete this package?')) {
                        deleteMutation.mutate(pkg._id)
                      }
                    }}
                    className="rounded-xl border border-rose-200 bg-rose-50/50 p-1.5 text-rose-600 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ─── PACKAGE BUILDER SLIDE-OVER DRAWER ─── */}
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
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/10">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingPkg
                      ? isAr ? `تعديل الباقة: ${editingPkg.name}` : `Edit Package: ${editingPkg.name}`
                      : isAr ? 'إنشاء باقة مناسبات جديدة' : 'Create Event Package'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {isAr
                      ? 'حدد بنود القائمة وتسعير الشخص الواحد والحد الأدنى للضيوف.'
                      : 'Define menu items, per-head price, and hall base rental.'}
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

              {/* Quick Template Presets (if creating new) */}
              {!editingPkg && (
                <div className="border-b border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-dark-800/40">
                  <span className="block text-[11px] font-bold uppercase text-slate-500 mb-2">
                    {isAr ? 'قوالب جاهزة سريعة التحميل:' : 'Quick Presets:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_PACKAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
                      >
                        {isAr ? preset.nameAr : preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Drawer Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Basic Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'اسم الباقة (En)' : 'Package Name (En)'} *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Royal Wedding Diamond Package"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'اسم الباقة (عربي)' : 'Package Name (Arabic)'}
                      </label>
                      <input
                        type="text"
                        value={nameAr}
                        onChange={(e) => setNameAr(e.target.value)}
                        placeholder="مثال: باقة الزفاف الملكية الماسية"
                        dir="rtl"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'نوع المناسبة / الفئة' : 'Event Category'}
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                      >
                        {PACKAGE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {isAr ? c.ar : c.en}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'وصف موجز' : 'Description'}
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Buffet, BBQ, sound and luxury decor..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Rates & Capacity Bento */}
                <div className="rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-dark-800/40 space-y-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    {isAr ? 'التسعير وسعة الضيوف' : 'Pricing & Guest Capacity'}
                  </span>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'سعر الشخص الواحد' : 'Rate Per Head'} ({currency}) *
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
                        {isAr ? 'إيجار القاعة الثابت' : 'Base Hall Rent'} ({currency})
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
                        {isAr ? 'الحد الأدنى للضيوف' : 'Min Guests'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={minGuests}
                        onChange={(e) => setMinGuests(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'الحد الأقصى للضيوف' : 'Max Guests'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={maxGuests}
                        onChange={(e) => setMaxGuests(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Realtime Estimate Preview */}
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-3 dark:bg-emerald-500/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-emerald-800 dark:text-emerald-300">
                        {isAr ? `تقدير تجريبي لـ ${previewGuests} ضيف:` : `Sample Calculation for ${previewGuests} Guests:`}
                      </span>
                      <span className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                        <Money amount={previewTotal} currency={currency} />
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-emerald-700/80 dark:text-emerald-400">
                      ({previewGuests} × {ratePerHead} {currency}) + {hallBaseRent} {currency} {isAr ? 'إيجار قاعة' : 'base rent'}
                    </p>
                  </div>
                </div>

                {/* 3. Items & Menu Builder */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {isAr ? `قائمة الأطعمة والخدمات المشمولة (${items.length})` : `Included Menu & Services (${items.length})`}
                    </span>
                  </div>

                  {/* Add Item Form */}
                  <form onSubmit={handleAddItem} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-dark-800 space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder={isAr ? 'اسم الصنف (En)...' : 'Item name (En)... e.g. Mutton Dum Biryani'}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={newItemNameAr}
                        onChange={(e) => setNewItemNameAr(e.target.value)}
                        placeholder={isAr ? 'اسم الصنف (عربي)...' : 'Item name (Arabic)...'}
                        dir="rtl"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-900 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value)}
                        className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-dark-900 dark:text-slate-300"
                      >
                        {ITEM_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {isAr ? c.ar : c.en}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={newItemPortion}
                        onChange={(e) => setNewItemPortion(e.target.value)}
                        placeholder="Portion (e.g. 1 per head, Unlimited)"
                        className="h-9 w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-900 dark:text-white"
                      />

                      <button
                        type="submit"
                        disabled={!newItemName.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isAr ? 'إضافة صنف' : 'Add Item'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Items List */}
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-white/10">
                      {isAr ? 'لم تتم إضافة أي أصناف حتى الآن. أضف الأصناف أعلاه.' : 'No items added yet. Use the form above to add items.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {items.map((item, idx) => {
                        const catMeta = ITEM_CATEGORIES.find((c) => c.id === item.category) || { en: item.category, ar: item.category }
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3 shadow-2xs dark:border-white/5 dark:bg-dark-800"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                  {isAr ? catMeta.ar : catMeta.en}
                                </span>
                                <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                  {isAr ? item.itemNameAr || item.itemName : item.itemName}
                                </p>
                              </div>
                              <p className="mt-0.5 text-[10.5px] text-slate-400 font-mono">
                                {item.portionSize}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
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
                    <Check className="h-4 w-4" />
                  )}
                  <span>{editingPkg ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : isAr ? 'إنشاء الباقة' : 'Create Package'}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

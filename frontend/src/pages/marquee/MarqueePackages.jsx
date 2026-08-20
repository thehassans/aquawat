import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes, Plus, Search, Edit, Trash2, CheckCircle2,
  X, Sparkles, UtensilsCrossed, Users, Calendar, DollarSign,
  Layers, Tag, Info, ArrowRight, ArrowLeft, Printer, Copy, Check, Eye,
  Upload, Image as ImageIcon, Loader2, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import { showArabicFields, isPakistanTenant, getTaxLabel } from '../../lib/saudiTenant'

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
  
  const showArabic = showArabicFields(tenant)
  const isAr = showArabic && language === 'ar'
  const isPk = isPakistanTenant(tenant)
  const taxLabel = getTaxLabel(tenant)

  const currency = tenant?.settings?.currency || (isPk ? 'PKR' : 'SAR')

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPkg, setEditingPkg] = useState(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef(null)

  // Form State
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [category, setCategory] = useState('wedding')
  const [description, setDescription] = useState('')
  const [ratePerHead, setRatePerHead] = useState(2500)
  const [hallBaseRent, setHallBaseRent] = useState(0)
  const [minGuests, setMinGuests] = useState(100)
  const [maxGuests, setMaxGuests] = useState(1000)
  const [bannerImage, setBannerImage] = useState('')
  const [isActive, setIsActive] = useState(true)
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
      closeForm()
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

  const openForm = (pkg = null) => {
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
      setBannerImage(pkg.bannerImage || '')
      setIsActive(pkg.isActive !== false)
      setItems(Array.isArray(pkg.items) ? [...pkg.items] : [])
    } else {
      setEditingPkg(null)
      setName('')
      setNameAr('')
      setCategory('wedding')
      setDescription('')
      setRatePerHead(isPk ? 2800 : 250)
      setHallBaseRent(0)
      setMinGuests(100)
      setMaxGuests(1000)
      setBannerImage('')
      setIsActive(true)
      setItems([])
    }
    setIsFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingPkg(null)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    setIsUploadingImage(true)
    try {
      const res = await api.post('/marquee/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setBannerImage(res.data.imageUrl)
      toast.success(isAr ? 'تم رفع صورة الباقة' : 'Package photo uploaded successfully')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload photo')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleAddItem = (e) => {
    e.preventDefault()
    if (!newItemName.trim()) return
    setItems([
      ...items,
      {
        itemName: newItemName.trim(),
        itemNameAr: showArabic ? (newItemNameAr.trim() || undefined) : undefined,
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

  const handleApplyPreset = (preset) => {
    setName(preset.name)
    setNameAr(showArabic ? preset.nameAr : '')
    setCategory(preset.category)
    setRatePerHead(preset.ratePerHead)
    setHallBaseRent(preset.hallBaseRent)
    setMinGuests(preset.minGuests)
    setMaxGuests(preset.maxGuests)
    setItems([...preset.items])
    toast.success(isAr ? 'تم تطبيق القالب الجاهز' : `Loaded preset: ${preset.name}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(isAr ? 'يرجى إدخال اسم الباقة' : 'Please enter package name')
      return
    }

    saveMutation.mutate({
      name: name.trim(),
      nameAr: showArabic ? (nameAr.trim() || undefined) : undefined,
      category,
      description: description.trim() || undefined,
      ratePerHead: Number(ratePerHead) || 0,
      hallBaseRent: Number(hallBaseRent) || 0,
      minGuests: Number(minGuests) || 1,
      maxGuests: Number(maxGuests) || 1000,
      bannerImage: bannerImage || undefined,
      isActive,
      items,
      currency,
    })
  }

  // Example total calculation preview
  const previewGuests = 250
  const previewTotal = previewGuests * (Number(ratePerHead) || 0) + (Number(hallBaseRent) || 0)

  // ─── FULL PAGE PACKAGE CREATOR / EDITOR VIEW ────────────────────────────────
  if (isFormOpen) {
    return (
      <div className="space-y-6 pb-20 max-w-6xl mx-auto">
        {/* Top Sticky Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm hover:bg-slate-50 transition dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {editingPkg
                    ? isAr ? `تعديل الباقة: ${editingPkg.name}` : `Edit Package: ${editingPkg.name}`
                    : isAr ? 'إنشاء باقة مناسبات جديدة' : 'Create Event Package'}
                </h1>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  {isAr ? 'قاعات ومناسبات' : 'Marquee Management'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'حدد بنود القائمة وتسعير الشخص الواحد والحد الأدنى للضيوف وصور الباقة.'
                  : 'Define menu items, per-head rates, hall rental, and showcase banner.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Check className="h-4 w-4 stroke-[2.5]" />
              )}
              <span>{editingPkg ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : isAr ? 'إنشاء الباقة' : 'Create Package'}</span>
            </button>
          </div>
        </div>

        {/* Quick Presets Bar (when creating new) */}
        {!editingPkg && (
          <div className="rounded-3xl border border-amber-200/80 bg-amber-50/50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                {isAr ? 'قوالب جاهزة سريعة التحميل:' : 'Quick Presets (1-Click Auto Fill):'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_PACKAGES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="rounded-xl border border-amber-300/80 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs hover:bg-amber-100/50 transition dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
                >
                  {isAr ? preset.nameAr : preset.name} ({preset.ratePerHead} {currency}/head)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2-Column Full-Page Form Layout */}
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
          {/* Left Column: Basic Info, Photo, Pricing (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Package Photo Upload Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0c111a] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isAr ? 'صورة / غلاف الباقة' : 'Package Showcase Banner'}
                </h3>
                {bannerImage && (
                  <button
                    type="button"
                    onClick={() => setBannerImage('')}
                    className="text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    {isAr ? 'إزالة الصورة' : 'Remove Photo'}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {bannerImage ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10">
                  <img src={bannerImage} alt="Package banner" className="h-44 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur shadow hover:bg-slate-950"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تغيير الصورة' : 'Change Photo'}</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 transition dark:border-white/10 dark:hover:border-emerald-500/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                    {isUploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-800 dark:text-white">
                    {isUploadingImage ? (isAr ? 'جاري الرفع...' : 'Uploading photo...') : (isAr ? 'اضغط لرفع صورة الباقة' : 'Click to Upload Package Photo')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WEBP up to 10MB</p>
                </div>
              )}
            </div>

            {/* Basic Info Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0c111a] space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isAr ? 'البيانات الأساسية للباقة' : 'Package Identification'}
              </h3>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'اسم الباقة (En)' : 'Package Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Royal Diamond Banquet & Live BBQ"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                />
              </div>

              {showArabic && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    اسم الباقة (عربي)
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: باقة الماسة الملكية مع بوفيه فاخر"
                    dir="rtl"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'نوع المناسبة / الفئة' : 'Event Category'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                >
                  {PACKAGE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isAr ? c.ar : c.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'وصف موجز' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Buffet, BBQ, sound and luxury decor..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'حالة الباقة (نشطة / مرئية)' : 'Package Active Status'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Pricing & Capacity Bento Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0c111a] space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isAr ? 'التسعير وسعة الضيوف' : 'Pricing & Guest Capacity'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'سعر الشخص الواحد' : 'Rate Per Head'} ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ratePerHead}
                    onChange={(e) => setRatePerHead(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-black text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-black text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Realtime Estimate Preview */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/60 p-4 dark:bg-emerald-500/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    {isAr ? `تقدير تجريبي لـ ${previewGuests} ضيف:` : `Sample Calculation for ${previewGuests} Guests:`}
                  </span>
                  <span className="text-base font-black text-emerald-950 dark:text-emerald-200">
                    <Money amount={previewTotal} currency={currency} />
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-700/90 dark:text-emerald-400">
                  ({previewGuests} × {ratePerHead} {currency}) + {hallBaseRent} {currency} {isAr ? 'إيجار قاعة' : 'base rent'}
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Included Menu Items & Event Services Manager (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-7 shadow-sm dark:border-white/10 dark:bg-[#0c111a] space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isAr ? `قائمة الأطعمة والخدمات المشمولة (${items.length})` : `Included Menu & Event Services (${items.length})`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isAr
                      ? 'أضف الوجبات والمقبلات والحلويات وديكور المسرح المشمول في هذه الباقة.'
                      : 'Add welcome drinks, live BBQ stations, main courses, desserts, sound & stage decor included in this package.'}
                  </p>
                </div>
                <span className="rounded-2xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {items.length} {isAr ? 'عنصر' : 'Items'}
                </span>
              </div>

              {/* Add Item Form */}
              <form onSubmit={handleAddItem} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-dark-800/60 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className={showArabic ? 'sm:col-span-6' : 'sm:col-span-12'}>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'اسم الصنف / الخدمة (En)' : 'Item or Service Name'} *
                    </label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g. Mutton Dum Biryani / Live BBQ Malai Boti"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-dark-900 dark:text-white"
                    />
                  </div>

                  {showArabic && (
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        اسم الصنف (عربي)
                      </label>
                      <input
                        type="text"
                        value={newItemNameAr}
                        onChange={(e) => setNewItemNameAr(e.target.value)}
                        placeholder="مثال: برياني لحم ضأن فاخر"
                        dir="rtl"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-dark-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'التصنيف' : 'Category'}
                    </label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-dark-900 dark:text-slate-300"
                    >
                      {ITEM_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {isAr ? c.ar : c.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'الحصة' : 'Portion / Quantity'}
                    </label>
                    <input
                      type="text"
                      value={newItemPortion}
                      onChange={(e) => setNewItemPortion(e.target.value)}
                      placeholder="1 per head, Unlimited"
                      className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-dark-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={!newItemName.trim()}
                      className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-xl bg-slate-900 px-3.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{isAr ? 'إضافة' : 'Add Item'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Items List */}
              {items.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-xs text-slate-400 dark:border-white/10">
                  <UtensilsCrossed className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'لم تتم إضافة أي أصناف حتى الآن' : 'No Items Added Yet'}
                  </p>
                  <p className="mt-1 text-slate-400">
                    {isAr ? 'استخدم النموذج أعلاه لإضافة أطباق وخدمات الباقة.' : 'Use the form above or pick a quick preset to populate items.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const catMeta = ITEM_CATEGORIES.find((c) => c.id === item.category) || { en: item.category, ar: item.category }
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-slate-300 dark:border-white/5 dark:bg-dark-800"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 border border-emerald-100 dark:bg-white/10 dark:text-slate-300">
                              {isAr ? catMeta.ar : catMeta.en}
                            </span>
                            <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                              {isAr ? item.itemNameAr || item.itemName : item.itemName}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[10.5px] text-slate-400 font-mono">
                            Portion: {item.portionSize}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── MAIN PACKAGE LISTING VIEW ──────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
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
            onClick={() => openForm(null)}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700"
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
              className={`h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800/60 dark:text-white ${
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
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
              onClick={() => openForm(null)}
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700"
            >
              {isAr ? 'إنشاء باقة الآن' : 'Create Package'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const catMeta = PACKAGE_CATEGORIES.find((c) => c.id === pkg.category) || { en: pkg.category, ar: pkg.category }
            const itemCount = pkg.items?.length || 0

            return (
              <motion.div
                key={pkg._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs transition-all hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-[#0c111a]"
              >
                {/* Package Banner Image (if available) */}
                {pkg.bannerImage && (
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                    <img src={pkg.bannerImage} alt={pkg.name} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-800 backdrop-blur shadow-xs">
                      {isAr ? catMeta.ar : catMeta.en}
                    </span>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Top Badges if no image */}
                    {!pkg.bannerImage && (
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-slate-700 dark:bg-white/10 dark:text-slate-300">
                          {isAr ? catMeta.ar : catMeta.en}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {pkg.minGuests} – {pkg.maxGuests} {isAr ? 'ضيف' : 'Guests'}
                        </span>
                      </div>
                    )}

                    {/* Title & Rates */}
                    <div>
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
                          <span className="text-[10px] font-normal text-slate-400"> / {isAr ? 'شخص' : 'head'}</span>
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
                        {pkg.items?.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span className="truncate">{isAr ? item.itemNameAr || item.itemName : item.itemName}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.portionSize}</span>
                          </div>
                        ))}
                        {itemCount > 5 && (
                          <p className="text-[10px] font-bold text-slate-400">
                            +{itemCount - 5} {isAr ? 'أصناف إضافية...' : 'more items...'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => openForm(pkg)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
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
                      className="rounded-xl border border-rose-200 bg-rose-50/50 p-1.5 text-rose-600 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '../../lib/translations'
import api, { getImageUrl } from '../../lib/api'
import LoadingScreen from '../../components/ui/LoadingScreen'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UtensilsCrossed,
  Globe,
  Search,
  Info,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Banknote,
  MapPin,
  User,
  Phone,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function PublicMenu() {
  const [searchParams] = useSearchParams()
  const tenantId = searchParams.get('tenant')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [activeCategory, setActiveCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Language state
  const [language, setLanguage] = useState('ar')
  const { t } = useTranslation(language)
  const isRtl = language === 'ar'

  // Cart State
  const [cart, setCart] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Order Form State
  const [orderType, setOrderType] = useState('dine_in') // dine_in, takeaway, delivery
  const [tableNumber, setTableNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash') // cash, apple_pay, stc_pay, visa, mada
  const [notes, setNotes] = useState('')

  // Order Submission State
  const [submitting, setSubmitting] = useState(false)
  const [placedOrder, setPlacedOrder] = useState(null)
  const [orderSuccessModal, setOrderSuccessModal] = useState(false)

  useEffect(() => {
    if (!tenantId) {
      setError('Invalid Menu Link')
      setLoading(false)
      return
    }

    api
      .get(`/public/tenant/${tenantId}/menu`)
      .then((res) => {
        setData(res.data)
        const defaultLang = res.data?.tenant?.settings?.restaurant?.qrMenu?.defaultLanguage || 'ar'
        setLanguage(defaultLang)
        setLoading(false)

        if (res.data?.items?.length) {
          const cats = [...new Set(res.data.items.map((item) => item.category))].filter(Boolean).sort()
          if (cats.length) setActiveCategory(cats[0])
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load menu')
        setLoading(false)
      })
  }, [tenantId])

  const categories = useMemo(() => {
    if (!data?.items) return []
    const cats = [...new Set(data.items.map((item) => item.category))].filter(Boolean)
    return cats.sort()
  }, [data])

  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    return data.items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          item.nameEn?.toLowerCase().includes(q) ||
          item.nameAr?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q)
        )
      }
      return item.category === activeCategory
    })
  }, [data, activeCategory, searchQuery])

  // Cart operations
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item._id)
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item._id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          menuItemId: item._id,
          nameEn: item.nameEn || item.nameAr || 'Item',
          nameAr: item.nameAr || item.nameEn || 'عنصر',
          unitPrice: parseFloat(item.sellingPrice) || 0,
          quantity: 1,
          taxRate: item.taxRate || 15,
          imageUrl: item.imageUrl || null
        }
      ]
    })
  }

  const updateQuantity = (menuItemId, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.menuItemId === menuItemId) {
            const newQty = i.quantity + delta
            return newQty > 0 ? { ...i, quantity: newQty } : null
          }
          return i
        })
        .filter(Boolean)
    )
  }

  const getItemQuantityInCart = (menuItemId) => {
    const item = cart.find((i) => i.menuItemId === menuItemId)
    return item ? item.quantity : 0
  }

  // Totals calculation
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)
  }, [cart])

  const cartVat = useMemo(() => {
    return cartSubtotal * 0.15
  }, [cartSubtotal])

  const cartGrandTotal = useMemo(() => {
    return cartSubtotal + cartVat
  }, [cartSubtotal, cartVat])

  const cartTotalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0)
  }, [cart])

  // Handle Order Submit
  const handlePlaceOrder = async (e) => {
    e.preventDefault()

    if (cart.length === 0) return

    if (!customerName.trim() || !customerPhone.trim()) {
      alert(isRtl ? 'يرجى إدخال الإسم ورقم الجوال' : 'Please enter your name and phone number')
      return
    }

    if (orderType === 'dine_in' && !tableNumber.trim()) {
      alert(isRtl ? 'يرجى إدخال رقم الطاولة' : 'Please enter table number')
      return
    }

    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      alert(isRtl ? 'يرجى إدخال عنوان التوصيل' : 'Please enter delivery address')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        customerName,
        customerPhone,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : '',
        orderType,
        tableNumber: orderType === 'dine_in' ? tableNumber : '',
        paymentMethod,
        notes,
        lineItems: cart.map((item) => ({
          menuItemId: item.menuItemId,
          nameEn: item.nameEn,
          nameAr: item.nameAr,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate
        }))
      }

      const res = await api.post(`/public/tenant/${tenantId}/order`, payload)

      if (res.data?.success) {
        setPlacedOrder(res.data.order)
        setCart([])
        setIsCartOpen(false)
        setOrderSuccessModal(true)
      }
    } catch (err) {
      alert(err.response?.data?.error || (isRtl ? 'فشل إرسال الطلب، حاول مرة أخرى' : 'Failed to place order'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen />

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <UtensilsCrossed className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">{isRtl ? 'عذراً' : 'Oops'}</h1>
          <p className="text-gray-500 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  const { tenant } = data
  const businessName = isRtl
    ? tenant.business?.legalNameAr || tenant.name
    : tenant.business?.legalNameEn || tenant.name
  const heroImage = tenant.settings?.restaurant?.qrMenu?.heroImage
  const qrMenuSettings = tenant.settings?.restaurant?.qrMenu || {}
  const menuMode = qrMenuSettings.mode || 'digital'
  const menuImages = qrMenuSettings.menuImages || []
  const hasOrderingAddon = tenant.subscription?.hasQrOrderingAddon === true

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-amber-100 selection:text-amber-900 pb-32"
    >
      {/* Hero Section */}
      {menuMode !== 'image_only' && (
        <div className="relative h-[35vh] min-h-[260px] max-h-[420px] w-full bg-gray-900 overflow-hidden">
          {heroImage ? (
            <img src={heroImage} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-orange-800 to-gray-900" />
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />

          {/* Top Navbar */}
          <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-10 max-w-4xl mx-auto">
            <div className="bg-black/30 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2.5 border border-white/15 shadow-lg">
              {tenant.branding?.logoUrl ? (
                <img src={tenant.branding.logoUrl} alt="Logo" className="h-6 w-auto object-contain" />
              ) : (
                <UtensilsCrossed className="w-5 h-5 text-amber-400" />
              )}
              <span className="text-white font-bold text-sm truncate max-w-[140px]">
                {businessName}
              </span>
            </div>

            <button
              onClick={() => setLanguage((lang) => (lang === 'ar' ? 'en' : 'ar'))}
              className="bg-black/30 backdrop-blur-md border border-white/15 text-white p-2.5 rounded-full hover:bg-white/20 transition-all flex items-center gap-1.5 px-3 text-xs font-bold"
            >
              <Globe className="w-4 h-4" />
              <span>{isRtl ? 'English' : 'عربي'}</span>
            </button>
          </div>

          {/* Hero Content */}
          <div className="absolute bottom-0 inset-x-0 p-6 z-10 max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-amber-300 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isRtl ? 'قائمة الطعام الرقمية' : 'Smart Digital Menu'}</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white mb-1.5 drop-shadow-md">
                {businessName}
              </h1>
              <p className="text-white/80 font-medium text-sm md:text-base max-w-md">
                {isRtl
                  ? 'اختر وجباتك المفضلة وأطلب مباشرة من جولك بسهولة.'
                  : 'Select your favorite items and order directly from your mobile.'}
              </p>
            </motion.div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className={menuMode === 'image_only' ? 'w-full mx-auto' : 'max-w-4xl mx-auto'}>
        {menuMode === 'image_only' ? (
          <div className="flex flex-col w-full bg-white">
            {menuImages.length > 0 ? (
              menuImages.map((imgUrl, idx) => (
                <img
                  key={idx}
                  src={getImageUrl(imgUrl)}
                  alt={`Menu page ${idx + 1}`}
                  className="w-full h-auto object-contain block"
                />
              ))
            ) : (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {isRtl ? 'لا توجد صور' : 'No Images'}
                </h3>
                <p className="text-gray-500">
                  {isRtl ? 'لم يتم رفع صور القائمة بعد' : 'No menu images have been uploaded yet'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Sticky Search & Category Bar */}
            <div className="sticky top-0 z-20 bg-[#FDFDFD]/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
              <div className="px-4 pt-3.5 pb-2">
                <div className="relative">
                  <Search
                    className={`absolute ${
                      isRtl ? 'right-4' : 'left-4'
                    } top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`}
                  />
                  <input
                    type="text"
                    placeholder={isRtl ? 'ابحث في القائمة...' : 'Search menu...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full bg-gray-100/90 border-none rounded-2xl py-3 ${
                      isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'
                    } focus:ring-2 focus:ring-amber-500 font-medium text-sm text-gray-900 placeholder-gray-400 transition-all`}
                  />
                </div>
              </div>

              {!searchQuery && (
                <div className="px-4 py-2.5 overflow-x-auto no-scrollbar flex gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`whitespace-nowrap px-5 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                        activeCategory === cat
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 scale-[1.02]'
                          : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menu Items Grid */}
            <div className="p-4 sm:p-6">
              {searchQuery && (
                <div className="mb-4">
                  <h2 className="text-base font-bold text-gray-900">
                    {isRtl ? 'نتائج البحث' : 'Search Results'} ({filteredItems.length})
                  </h2>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => {
                    const qtyInCart = getItemQuantityInCart(item._id)
                    const title = isRtl ? item.nameAr || item.nameEn : item.nameEn || item.nameAr
                    const desc = isRtl
                      ? item.descriptionAr || item.descriptionEn
                      : item.descriptionEn || item.descriptionAr

                    return (
                      <motion.div
                        key={item._id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2 }}
                        className="group bg-white rounded-3xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 transition-all flex gap-3.5 overflow-hidden relative"
                      >
                        {/* Left Details */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-amber-600 transition-colors">
                            {title}
                          </h3>

                          {desc && (
                            <p className="text-xs text-gray-400 line-clamp-2 mb-2 leading-relaxed">
                              {desc}
                            </p>
                          )}

                          <div className="mt-auto flex items-center justify-between pt-2">
                            <div className="flex items-baseline gap-1">
                              <span className="font-black text-lg text-gray-900">
                                {item.sellingPrice}
                              </span>
                              <span className="text-xs font-bold text-amber-600">
                                {isRtl ? 'ر.س' : 'SAR'}
                              </span>
                            </div>

                            {/* Add / Qty Control */}
                            {hasOrderingAddon && (
                              qtyInCart === 0 ? (
                                <button
                                  onClick={() => addToCart(item)}
                                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-md shadow-amber-500/20 transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isRtl ? 'إضافة' : 'Add'}</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl px-2 py-1">
                                  <button
                                    onClick={() => updateQuantity(item._id, -1)}
                                    className="w-6 h-6 rounded-lg bg-white text-amber-700 shadow-sm flex items-center justify-center hover:bg-amber-100 active:scale-90 transition"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="font-black text-amber-900 dark:text-amber-200 text-sm px-1">
                                    {qtyInCart}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(item._id, 1)}
                                    className="w-6 h-6 rounded-lg bg-amber-500 text-white shadow-sm flex items-center justify-center hover:bg-amber-600 active:scale-90 transition"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        {/* Image */}
                        {item.imageUrl && (
                          <div className="w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden bg-gray-50 relative shadow-inner">
                            <img
                              src={item.imageUrl}
                              alt={title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {filteredItems.length === 0 && (
                  <div className="col-span-full py-16 text-center">
                    <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Info className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">
                      {isRtl ? 'لا توجد نتائج' : 'No Results Found'}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {isRtl ? 'حاول البحث بكلمات أخرى' : 'Try searching with different keywords'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-30 max-w-lg mx-auto">
          <motion.button
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 text-white p-4 rounded-2xl shadow-2xl shadow-black/30 border border-white/10 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-md">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-gray-900">
                  {cartTotalItemsCount}
                </span>
              </div>
              <div className="text-start leading-tight">
                <p className="text-xs font-medium text-gray-400">
                  {isRtl ? 'سلة الطلبات' : 'Your Order Cart'}
                </p>
                <p className="text-sm font-bold text-white">
                  {cartTotalItemsCount} {isRtl ? 'عناصر مختارة' : 'items selected'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-end leading-tight">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  {isRtl ? 'الإجمالي شامل الضريبة' : 'TOTAL (INCL. VAT)'}
                </p>
                <p className="text-base font-black text-white">
                  {cartGrandTotal.toFixed(2)}{' '}
                  <span className="text-xs font-bold text-amber-400">{isRtl ? 'ر.س' : 'SAR'}</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </motion.button>
        </div>
      )}

      {/* Cart & Checkout Modal Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                className="relative w-full max-w-xl bg-white dark:bg-dark-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between bg-gray-50/50 dark:bg-dark-700/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight">
                        {isRtl ? 'إتمام الطلب' : 'Complete Your Order'}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {businessName} • {cartTotalItemsCount} {isRtl ? 'عناصر' : 'items'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handlePlaceOrder} className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
                  {/* Selected Line Items */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {isRtl ? 'محتويات السلة' : 'ORDER ITEMS'}
                    </h4>

                    <div className="divide-y divide-gray-100 dark:divide-dark-700 max-h-48 overflow-y-auto pr-1">
                      {cart.map((item) => (
                        <div key={item.menuItemId} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              {isRtl ? item.nameAr : item.nameEn}
                            </p>
                            <p className="text-xs text-gray-400">
                              {item.unitPrice} × {item.quantity} ={' '}
                              <span className="font-bold text-gray-700 dark:text-gray-300">
                                {(item.unitPrice * item.quantity).toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, -1)}
                              className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, 1)}
                              className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Type Selection */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {isRtl ? 'نوع الطلب' : 'ORDER TYPE'}
                    </h4>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setOrderType('dine_in')}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          orderType === 'dine_in'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 font-bold'
                            : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="block text-base mb-0.5">🍽️</span>
                        <span className="text-xs font-bold">{isRtl ? 'محلي' : 'Dine-In'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderType('takeaway')}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          orderType === 'takeaway'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 font-bold'
                            : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="block text-base mb-0.5">🥡</span>
                        <span className="text-xs font-bold">{isRtl ? 'سفري' : 'Takeaway'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderType('delivery')}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          orderType === 'delivery'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 font-bold'
                            : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="block text-base mb-0.5">🚗</span>
                        <span className="text-xs font-bold">{isRtl ? 'توصيل' : 'Delivery'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer Information Inputs */}
                  <div className="space-y-3 pt-1">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {isRtl ? 'بيانات العميل' : 'CUSTOMER INFORMATION'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          {isRtl ? 'الاسم الكريم *' : 'Full Name *'}
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute inset-y-0 my-auto right-3 left-auto text-gray-400" />
                          <input
                            type="text"
                            required
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder={isRtl ? 'مثال: محمد علي' : 'e.g. John Doe'}
                            className="w-full bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl py-2.5 px-9 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          {isRtl ? 'رقم الجوال *' : 'Phone Number *'}
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute inset-y-0 my-auto right-3 left-auto text-gray-400" />
                          <input
                            type="tel"
                            required
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="05XXXXXXXX"
                            className="w-full bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl py-2.5 px-9 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {orderType === 'dine_in' && (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                            {isRtl ? 'رقم الطاولة *' : 'Table Number *'}
                          </label>
                          <input
                            type="text"
                            required
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            placeholder={isRtl ? 'مثال: طاولة 5' : 'e.g. Table 5'}
                            className="w-full bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl py-2.5 px-3 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}

                      {orderType === 'delivery' && (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                            {isRtl ? 'عنوان التوصيل التفصيلي *' : 'Detailed Delivery Address *'}
                          </label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 absolute inset-y-0 my-auto right-3 left-auto text-gray-400" />
                            <input
                              type="text"
                              required
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              placeholder={isRtl ? 'الحي، الشارع، رقم العمارة' : 'District, Street, Building'}
                              className="w-full bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl py-2.5 px-9 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          {isRtl ? 'ملاحظات خاصة على الطلب' : 'Special Notes'}
                        </label>
                        <div className="relative">
                          <MessageSquare className="w-4 h-4 absolute top-3 right-3 left-auto text-gray-400" />
                          <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={isRtl ? 'بدون كاتشب، صلصة إضافية...' : 'No onions, extra sauce...'}
                            className="w-full bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl py-2 px-9 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2.5 pt-1">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {isRtl ? 'طريقة الدفع' : 'PAYMENT METHOD'}
                    </h4>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Cash */}
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                          paymentMethod === 'cash'
                            ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                            : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={() => setPaymentMethod('cash')}
                          className="sr-only"
                        />
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            {isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery'}
                          </p>
                          <p className="text-[10px] text-gray-400">{isRtl ? 'نقداً أو عند الطاولة' : 'Cash or Counter'}</p>
                        </div>
                      </label>

                      {/* Apple Pay */}
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                          paymentMethod === 'apple_pay'
                            ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                            : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value="apple_pay"
                          checked={paymentMethod === 'apple_pay'}
                          onChange={() => setPaymentMethod('apple_pay')}
                          className="sr-only"
                        />
                        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xs">
                          
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">Apple Pay</p>
                          <p className="text-[10px] text-gray-400">{isRtl ? 'دفع إلكتروني سريع' : 'Instant Checkout'}</p>
                        </div>
                      </label>

                      {/* STC Pay */}
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                          paymentMethod === 'stc_pay'
                            ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                            : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value="stc_pay"
                          checked={paymentMethod === 'stc_pay'}
                          onChange={() => setPaymentMethod('stc_pay')}
                          className="sr-only"
                        />
                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-extrabold text-[10px]">
                          STC
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">STC Pay</p>
                          <p className="text-[10px] text-gray-400">{isRtl ? 'المحفظة الرقمية' : 'Digital Wallet'}</p>
                        </div>
                      </label>

                      {/* Card / Mada / Visa */}
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                          ['visa', 'mada', 'card'].includes(paymentMethod)
                            ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                            : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value="mada"
                          checked={['visa', 'mada', 'card'].includes(paymentMethod)}
                          onChange={() => setPaymentMethod('mada')}
                          className="sr-only"
                        />
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            {isRtl ? 'بطاقة مدى / فيزا' : 'Mada / Visa / Master'}
                          </p>
                          <p className="text-[10px] text-gray-400">{isRtl ? 'بطاقة البنك' : 'Debit & Credit'}</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Summary Breakdown */}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-700 space-y-2">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {cartSubtotal.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{isRtl ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {cartVat.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
                      </span>
                    </div>

                    <div className="border-t border-gray-200 dark:border-dark-600 pt-2 flex justify-between items-center">
                      <span className="text-sm font-black text-gray-900 dark:text-white">
                        {isRtl ? 'الإجمالي النهائي' : 'Grand Total'}
                      </span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                        {cartGrandTotal.toFixed(2)} <span className="text-xs">{isRtl ? 'ر.س' : 'SAR'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Submit Order Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white py-3.5 rounded-2xl font-black text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>{isRtl ? 'إرسال الطلب للمطبخ الآن' : 'Place Order Now'}</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Placed Success Modal */}
      <AnimatePresence>
        {orderSuccessModal && placedOrder && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md"
            />

            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative w-full max-w-sm bg-white dark:bg-dark-800 rounded-3xl p-6 shadow-2xl text-center space-y-5 z-10 border border-gray-100 dark:border-dark-700"
              >
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">
                    {isRtl ? 'تم إرسال طلبك بنجاح! 🎉' : 'Order Placed Successfully! 🎉'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {isRtl ? 'جاري تحضير طلبك في المطبخ الآن.' : 'Your order is being sent to the kitchen.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-dark-600 text-center space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {isRtl ? 'رقم الطلب' : 'ORDER NUMBER'}
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {placedOrder.orderNumber}
                  </p>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold mt-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'الحالة: جديد بالمطبخ' : 'Status: New in Kitchen'}</span>
                  </div>
                </div>

                <button
                  onClick={() => setOrderSuccessModal(false)}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl font-bold text-sm shadow-md"
                >
                  {isRtl ? 'العودة للقائمة' : 'Back to Menu'}
                </button>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Powered By */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-full border border-gray-200 dark:border-dark-600">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {isRtl ? 'مشغل بواسطة' : 'Powered by'}
          </span>
          <span className="font-black text-gray-900 dark:text-white tracking-tight text-sm">Maqder</span>
        </div>
      </div>
    </div>
  )
}

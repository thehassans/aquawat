import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ShoppingBag,
  User,
  Phone,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Package,
  CheckCircle2,
  Printer
} from 'lucide-react'
import api from '../../lib/api'
import { autoTranslateText } from '../../lib/builtInTranslator'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview'
import { printInvoiceSnapshot, downloadInvoicePdf } from '../../lib/invoicePdf'

/**
 * Furniture POS 
 * Ultra-premium, minimalist POS counter interface for selecting furniture,
 * processing checkout with thermal receipt print and handling open-priced items.
 */

export default function FurniturePOS() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const tenant = useSelector((state) => state.auth.tenant)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // ─── UI State ───
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [cart, setCart] = useState([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)

  // ─── Customer & Checkout ───
  const [customerName, setCustomerName] = useState('')
  const [customerNameAr, setCustomerNameAr] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerIdType, setCustomerIdType] = useState('iqama')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [vatApplicable, setVatApplicable] = useState(true)

  // ─── Product Fetch ───
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['furniture-products', searchQuery, selectedCategory],
    queryFn: () =>
      api
        .get('/furniture/products', {
          params: {
            search: searchQuery || undefined,
            category: selectedCategory || undefined,
            isActive: true,
            limit: 100,
          },
        })
        .then((res) => res.data.products || []),
  })

  const products = productsData || []

  // ─── Categories ───
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]

  // ─── Helpers ───
  const isArabic = language === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'
  const label = (en, ar) => (isArabic ? ar : en)

  const translateCategory = (cat) => {
    if (!cat) return label('General', 'عام')
    const map = {
      'Sofa': label('Sofa', 'كنب'),
      'Bed': label('Bed', 'سرير'),
      'Carpet': label('Carpet', 'سجاد'),
      'Majlis': label('Majlis', 'مجالس'),
      'Dining': label('Dining', 'طعام')
    }
    return map[cat] || cat
  }

  // ─── Cart Logic ───
  const handleProductClick = (product) => {
    addToCart(product, product.salePrice || 0)
  }

  const addToCart = (product, price) => {
    const existing = cart.find((item) => item.productId === product._id)
    if (existing) {
      updateCartItem(product._id, 'quantity', existing.quantity + 1)
      return
    }

    setCart((prev) => [
      ...prev,
      {
        productId: product._id,
        sku: product.sku,
        name: product.name,
        nameAr: product.nameAr,
        size: product.size,
        color: product.color,
        image: product.primaryImage || product.images?.[0],
        unitPrice: Number(price),
        quantity: 1,
      },
    ])
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  const updateCartItem = (productId, field, value) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, [field]: value } : item
      )
    )
  }

  // ─── Pricing Logic ───
  const cartTotals = (() => {
    const lines = cart.map((item) => {
      const lineTotal = (item.unitPrice || 0) * (item.quantity || 1)
      return { ...item, lineTotal }
    })
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
    const taxableBase = Math.max(0, subtotal - discountAmount)
    const totalTax = vatApplicable ? Math.round(taxableBase * 0.15 * 100) / 100 : 0
    const grandTotal = Math.round((taxableBase + totalTax) * 100) / 100
    return { lines, subtotal, totalTax, grandTotal, discountAmount }
  })()

  // ─── Auto-translate customer name between EN/AR (Instant Built-in) ───
  const autoTranslateName = (text, fromLang) => {
    if (!text || !text.trim()) return
    const toLang = fromLang === 'ar' ? 'en' : 'ar'
    const targetSetter = fromLang === 'ar' ? setCustomerName : setCustomerNameAr
    try {
      const translated = autoTranslateText(text.trim(), fromLang, toLang)
      if (translated) targetSetter(translated)
    } catch (err) {
      console.warn('Auto-translate name failed', err)
    }
  }

  // ─── A4 PDF Print Helper ───
  const printA4Invoice = async (invoice) => {
    try {
      await printInvoiceSnapshot({ invoice, language: 'en', tenant, documentType: 'invoice' })
    } catch (err) {
      console.error('Failed to print A4 invoice', err)
    }
  }

  // ─── Checkout Mutation ───
  const checkoutMutation = useMutation({
    mutationFn: (payload) => api.post('/furniture/orders', payload).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['furniture-orders'] })
      setReceiptData(data)
      setShowCheckout(false)
      setShowReceipt(true)
      setCart([])
      // Auto-print A4 PDF after invoice is created
      if (data?.invoice) {
        setTimeout(() => printA4Invoice(data.invoice), 800)
      }
    },
    onError: (err) => {
      console.error('Checkout failed', err)
      const msg = err?.response?.data?.error || err?.message || label('Checkout failed', 'فشل إتمام الطلب')
      setCheckoutError(msg)
    },
  })

  const handleCheckout = () => {
    if (!customerName || !customerPhone || cart.length === 0) {
      setCheckoutError(label('Please fill in required customer details', 'يرجى تعبئة بيانات العميل المطلوبة'))
      return
    }
    const payload = {
      customerName,
      customerNameAr,
      customerPhone,
      customerIdNumber: customerId,
      customerIdType,
      paymentMethod,
      amountPaid: cartTotals.grandTotal,
      discount: discountAmount || 0,
      vatApplicable,
      lineItems: cart.map((item) => ({
        productId: item.productId,
        productName: item.name,
        productNameAr: item.nameAr,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }
    checkoutMutation.mutate(payload)
  }

  // ─── Helpers ───
  return (
    <div className="h-full flex flex-col bg-[#F8F9FC] font-sans" dir={dir}>
      {/* ─── Header ─── */}
      <div className="flex-none px-8 py-5 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              {label('Furniture POS', 'نقطة بيع الأثاث')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={label('Search products...', 'ابحث عن المنتجات...')}
                className="pl-10 pr-4 py-3 rounded-2xl border-none bg-slate-100 text-sm w-72 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white outline-none transition-all shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Category Chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                !selectedCategory ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label('All Collections', 'كل المجموعات')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {translateCategory(cat)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Package className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">{label('No furniture found', 'لم يتم العثور على أثاث')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-6">
              {products.map((product) => {
                const isInCart = cart.some((item) => item.productId === product._id)
                return (
                  <motion.div
                    key={product._id}
                    layoutId={product._id}
                    onClick={() => handleProductClick(product)}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group cursor-pointer bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-xl ${
                      isInCart
                        ? 'border-indigo-300 ring-2 ring-indigo-500/20'
                        : 'border-slate-100'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                      {product.primaryImage ? (
                        <img
                          src={product.primaryImage}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ShoppingBag className="w-10 h-10" />
                        </div>
                      )}
                      
                      {/* Price Tag Overlay */}
                      <div className="absolute top-3 left-3">
                        <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl text-xs font-black text-slate-800 shadow-sm border border-slate-100/50">
                          {product.salePrice > 0 ? `SAR ${product.salePrice}` : label('Open Price', 'سعر مفتوح')}
                        </div>
                      </div>
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <button className="w-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold py-2.5 rounded-xl hover:bg-white/30 transition-colors">
                          {label('Add to Cart', 'أضف للسلة')}
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-white">
                      <h3 className="text-sm font-black text-slate-800 truncate">{isArabic ? product.nameAr || product.name : product.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] font-medium text-slate-400">{product.sku}</p>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {translateCategory(product.category)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── Ultra Premium Cart Sidebar ─── */}
        <motion.div 
          className="w-[540px] bg-white/80 backdrop-blur-2xl border-l border-slate-100 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)] z-20"
          initial={false}
        >
          <div className="p-6 border-b border-slate-100/50">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              {label('Current Order', 'الطلب الحالي')}
              <span className="ml-auto bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">
                {cart.length} {label('items', 'عناصر')}
              </span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            <AnimatePresence>
              {cart.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-64 text-slate-400"
                >
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBag className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="font-medium text-slate-500">{label('Your cart is empty', 'سلة المشتريات فارغة')}</p>
                  <p className="text-xs text-slate-400 mt-1">{label('Select items from the catalog', 'اختر المنتجات من المعرض')}</p>
                </motion.div>
              ) : (
                cart.map((item) => (
                  <motion.div
                    key={item.productId}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                    className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex gap-4 group"
                  >
                    <div className="w-20 h-20 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100/50">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 py-1 flex flex-col justify-between min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-800 truncate">{isArabic ? item.nameAr || item.name : item.name}</h4>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">{label('Quantity', 'الكمية')}</span>
                          <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                            <button
                              onClick={() => updateCartItem(item.productId, 'quantity', Math.max(1, item.quantity - 1))}
                              className="w-6 h-6 rounded-md bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 shadow-sm"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-black w-8 text-center text-slate-800">{item.quantity}</span>
                            <button
                              onClick={() => updateCartItem(item.productId, 'quantity', item.quantity + 1)}
                              className="w-6 h-6 rounded-md bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 shadow-sm"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-bold text-slate-500">{label('Total Price', 'السعر الإجمالي')}</span>
                          <div className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 flex-1 ml-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all">
                            <span className="text-[10px] font-bold text-slate-400">SAR</span>
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice * item.quantity === 0 ? '' : item.unitPrice * item.quantity}
                              placeholder="0.00"
                              onChange={(e) => {
                                const newTotal = Number(e.target.value);
                                const newUnitPrice = item.quantity > 0 ? newTotal / item.quantity : 0;
                                updateCartItem(item.productId, 'unitPrice', Number(newUnitPrice));
                              }}
                              className="w-full text-sm font-black text-emerald-600 bg-transparent outline-none text-right"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Cart Footer Summary */}
          {cart.length > 0 && (
            <div className="bg-white border-t border-slate-100 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
              {!showCheckout ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm font-medium text-slate-500">
                      <span>{label('Subtotal', 'المجموع الفرعي')}</span>
                      <Money value={cartTotals.subtotal} />
                    </div>
                    {cartTotals.discountAmount > 0 && (
                      <div className="flex justify-between text-sm font-medium text-rose-500">
                        <span>{label('Discount', 'الخصم')}</span>
                        <span className="flex items-center">-<Money value={cartTotals.discountAmount} /></span>
                      </div>
                    )}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between mt-1 mb-1">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{label('Value Added Tax (VAT)', 'ضريبة القيمة المضافة')}</span>
                        <span className="text-[10px] font-medium text-slate-500">{label('Standard 15% rate', 'النسبة الأساسية 15%')}</span>
                      </div>
                      <div className="flex bg-slate-200/60 p-1 rounded-lg">
                        <button
                          onClick={() => setVatApplicable(true)}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${vatApplicable ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          15%
                        </button>
                        <button
                          onClick={() => setVatApplicable(false)}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${!vatApplicable ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          0%
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-xl font-black text-slate-900 pt-3 border-t border-slate-100">
                      <span>{label('Total', 'الإجمالي')}</span>
                      <Money value={cartTotals.grandTotal} />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5"
                  >
                    {label('Proceed to Checkout', 'متابعة الدفع')}
                    <ArrowRight className={`w-4 h-4 ${isArabic ? 'rotate-180' : ''}`} />
                  </button>
                </motion.div>
              ) : (
                /* ── Inline Checkout Form ── */
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5 max-h-[60vh] overflow-y-auto scrollbar-hide pr-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowCheckout(false)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 px-3 py-1.5 rounded-full"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 ${isArabic ? 'rotate-180' : ''}`} />
                      {label('Back', 'رجوع')}
                    </button>
                    <span className="text-sm font-black text-slate-800">SAR {cartTotals.grandTotal.toFixed(2)}</span>
                  </div>

                  {checkoutError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {checkoutError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <User className={`absolute ${isArabic ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                        <input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          onBlur={(e) => {
                            const hasArabic = /[\u0600-\u06FF]/.test(e.target.value)
                            if (!customerNameAr && !hasArabic) autoTranslateName(e.target.value, 'en')
                            if (!customerNameAr && hasArabic) {
                              // If they typed Arabic in the English field, swap it and translate to English
                              setCustomerNameAr(e.target.value)
                              setCustomerName('')
                              autoTranslateName(e.target.value, 'ar')
                            }
                          }}
                          className={`w-full ${isArabic ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all`}
                          placeholder={label('Name (English)', 'الاسم (إنجليزي)')}
                        />
                      </div>
                      <div className="relative flex-1">
                        <User className={`absolute ${isArabic ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                        <input
                          dir="rtl"
                          value={customerNameAr}
                          onChange={(e) => setCustomerNameAr(e.target.value)}
                          onBlur={(e) => {
                            if (!customerName) autoTranslateName(e.target.value, 'ar')
                          }}
                          className={`w-full ${isArabic ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all`}
                          placeholder={label('Name (Arabic)', 'الاسم (عربي)')}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <Phone className={`absolute ${isArabic ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                      <input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className={`w-full ${isArabic ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all`}
                        placeholder="05xxxxxxxx"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-0.5 block">{label('ID / Iqama / VAT Number', 'الهوية / الإقامة / الرقم الضريبي')}</label>
                      <input
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        placeholder="1xxxxxxxx"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-0.5 block">{label('Discount Amount', 'قيمة الخصم')}</label>
                      <div className="relative">
                        <span className={`absolute ${isArabic ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400`}>SAR</span>
                        <input
                          type="number"
                          min="0"
                          value={discountAmount || ''}
                          onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                          className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>


                    
                    {/* Payment Method Toggle */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 border-2 transition-all ${
                          paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        {label('Cash', 'نقدي')}
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={`py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 border-2 transition-all ${
                          paymentMethod === 'card' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        {label('Card', 'بطاقة')}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={checkoutMutation.isPending}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                  >
                    {checkoutMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        {label('Confirm Order', 'تأكيد الطلب')}
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Receipt Modal ─── */}
      <AnimatePresence>
        {showReceipt && receiptData?.invoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  {label('Order Completed', 'اكتمل الطلب')}
                </h3>
                <button onClick={() => setShowReceipt(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
                <div className="w-full max-w-[800px] shadow-lg">
                  <InvoiceLivePreview
                    invoice={receiptData.invoice}
                    qrDataUrl={receiptData.qrDataUrl}
                    language={language}
                    tenant={tenant}
                    documentType="invoice"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button
                  onClick={() => setShowReceipt(false)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {label('Close', 'إغلاق')}
                </button>
                <button
                  onClick={() => printA4Invoice(receiptData.invoice)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-600/30"
                >
                  <Printer className="w-4 h-4" />
                  {label('Print Receipt', 'طباعة الفاتورة')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

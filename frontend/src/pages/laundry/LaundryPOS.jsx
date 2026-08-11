import { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, Search, User, Phone, X, Zap } from 'lucide-react'
import api from '../../lib/api'
import { 
  addItem, 
  updateItemQuantity, 
  updateItemPrice, 
  updateItemTreatment, 
  updateItemCustomizations, 
  removeItem, 
  clearCart, 
  setIsUrgent, 
  setUrgentPrice, 
  setCustomerName, 
  setCustomerPhone 
} from '../../store/slices/laundryCartSlice'
import { toast } from 'react-hot-toast'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import CardPaymentModal from '../../components/pos/CardPaymentModal'
import { getThermalPrinterSettings, printThermalElement } from '../../lib/thermalPrinter'

export default function LaundryPOS() {
  const dispatch = useDispatch()
  const { language } = useSelector(state => state.ui)
  const { tenant } = useSelector(state => state.auth)
  const thermalSettings = getThermalPrinterSettings(tenant)
  const cart = useSelector(state => state.laundryCart)
  const isRtl = language === 'ar'
  const cardTerminalEnabled = Boolean(tenant?.settings?.posTerminal?.enabled)
  const terminalLabel = tenant?.settings?.posTerminal?.terminalLabel || ''
  const [showCardModal, setShowCardModal] = useState(false)
  const [pendingCardOrder, setPendingCardOrder] = useState(null)

  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all') // 'all', 'services', 'products', or laundry categories

  // Checkout states
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedOrder, setCompletedOrder] = useState(null)
  const receiptRef = useRef(null)

  const CATEGORIES = {
    clothes: isRtl ? 'ملابس' : 'Clothes',
    carpets: isRtl ? 'سجاد' : 'Carpets',
    bedding: isRtl ? 'مفروشات' : 'Bedding',
    accessories: isRtl ? 'إكسسوارات' : 'Accessories'
  }

  const ALL_CUSTOMIZATIONS = [
    { id: 'folded', labelEn: 'Folded', labelAr: 'مطوي' },
    { id: 'hanger', labelEn: 'On Hanger', labelAr: 'على الشماعة' },
    { id: 'starch', labelEn: 'Starch', labelAr: 'نشاء' },
    { id: 'perfume', labelEn: 'Perfume', labelAr: 'تعطير' },
    { id: 'no_crease', labelEn: 'No Crease', labelAr: 'بدون كسرة' }
  ]

  const handlePrint = () => {
    if (receiptRef.current) {
      printThermalElement(receiptRef.current, thermalSettings)
    }
  }

  const handleCloseReceipt = () => {
    setCompletedOrder(null)
    dispatch(clearCart())
  }
  
  useEffect(() => {
    fetchServicesAndProducts()
  }, [])

  const fetchServicesAndProducts = async () => {
    try {
      setLoading(true)
      const servicesRes = await api.get('/laundry/services?isActive=true')
      setServices(servicesRes.data)
      
      try {
        const productsRes = await api.get('/products?limit=100')
        setProducts(productsRes.data.products || [])
      } catch (err) {
        console.warn('Products could not be loaded for laundry tenant:', err)
        setProducts([])
      }
    } catch (error) {
      toast.error('Failed to load services or products')
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = [
    ...services.map(s => ({ ...s, itemType: 'service' })),
    ...products.map(p => ({ ...p, itemType: 'product' }))
  ].filter(item => {
    const nameMatches = item.itemType === 'service'
      ? (item.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) || item.nameAr?.includes(searchQuery))
      : (item.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) || item.nameAr?.includes(searchQuery) || item.sku?.toLowerCase().includes(searchQuery.toLowerCase()));
      
    let categoryMatches = false;
    if (selectedCategory === 'all') {
      categoryMatches = true;
    } else if (selectedCategory === 'services') {
      categoryMatches = item.itemType === 'service';
    } else if (selectedCategory === 'products') {
      categoryMatches = item.itemType === 'product';
    } else {
      categoryMatches = item.itemType === 'service' && item.category === selectedCategory;
    }
    
    return nameMatches && categoryMatches;
  })

  const handleAddToCartDirectly = (item, type = 'service') => {
    if (type === 'service') {
      dispatch(addItem({
        service: item,
        quantity: item.billingType === 'per_sqm' ? 1.0 : 1,
        treatment: item.treatments?.[0]?.nameEn || 'Wash & Fold',
        customizations: [],
        unitPrice: item.treatments?.[0]?.price || item.basePrice || 0
      }))
      toast.success(isRtl ? `تمت إضافة ${item.nameAr || item.nameEn} إلى السلة` : `Added ${item.nameEn} to cart`)
    } else {
      dispatch(addItem({
        product: item,
        quantity: 1,
        treatment: 'None',
        customizations: [],
        unitPrice: item.sellingPrice || 0
      }))
      toast.success(isRtl ? `تمت إضافة ${item.nameAr || item.nameEn} إلى السلة` : `Added ${item.nameEn} to cart`)
    }
  }

  const handleCheckout = async (paymentMethod = 'cash') => {
    if (cart.items.length === 0) return toast.error('Cart is empty')
    
    setIsProcessing(true)
    try {
      const payload = {
        paymentMethod,
        customer: cart.customer?._id,
        customerName: cart.customerName || (cart.customer ? cart.customer.fullName : undefined),
        customerPhone: cart.customerPhone || (cart.customer ? cart.customer.mobile : undefined),
        items: cart.items.map(item => ({
          service: item.product ? undefined : item.service?._id,
          product: item.product?._id,
          nameEn: item.nameEn,
          nameAr: item.nameAr,
          billingType: item.billingType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.product ? (item.product.taxRate || 15) : (item.service?.taxRate || 15),
          subtotal: item.subtotal,
          taxAmount: item.taxAmount,
          total: item.total,
          treatment: item.treatment || 'None',
          customizations: item.customizations || []
        })),
        isUrgent: cart.isUrgent,
        deliveryType: cart.deliveryType,
        notes: cart.notes,
        subtotal: cart.items.reduce((s, i) => s + i.subtotal, 0),
        totalVat: cart.items.reduce((s, i) => s + i.taxAmount, 0),
        urgentFee: cart.isUrgent ? cart.urgentPrice : 0,
        grandTotal: cart.items.reduce((s, i) => s + i.total, 0) + (cart.isUrgent ? cart.urgentPrice : 0),
        amountPaid: cart.items.reduce((s, i) => s + i.total, 0) + (cart.isUrgent ? cart.urgentPrice : 0), 
      }
      
      const { data } = await api.post('/laundry/orders/checkout', payload)
      toast.success(isRtl ? `تم إنشاء الطلب: ${data.orderNumber}` : `Order created: ${data.orderNumber}`)
      setCompletedOrder(data)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Checkout failed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-6">
      
      {/* Left: Service & Product Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Search Bar */}
        <div className="mb-4 relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-4' : 'left-4'}`} />
          <input
            type="text"
            placeholder={isRtl ? "البحث عن خدمة أو منتج..." : "Search services or products..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-white dark:bg-dark-800 border-none rounded-2xl shadow-sm py-3 focus:ring-2 focus:ring-teal-500 ${isRtl ? 'pr-12' : 'pl-12'}`}
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 custom-scrollbar whitespace-nowrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
            }`}
          >
            {isRtl ? 'الكل' : 'All'}
          </button>
          
          <button
            onClick={() => setSelectedCategory('services')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              selectedCategory === 'services'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
            }`}
          >
            {isRtl ? 'الخدمات' : 'Services Only'}
          </button>
          
          <button
            onClick={() => setSelectedCategory('products')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              selectedCategory === 'products'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
            }`}
          >
            {isRtl ? 'المنتجات' : 'Products Only'}
          </button>
          
          <div className="w-[1px] h-6 bg-gray-200 dark:bg-dark-700 self-center mx-1"></div>
          
          {Object.entries(CATEGORIES).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectedCategory === key
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-200">
              {filteredItems.map(item => {
                const isProd = item.itemType === 'product'
                return (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={item._id}
                    onClick={() => handleAddToCartDirectly(item, item.itemType)}
                    className={`bg-white dark:bg-dark-800 rounded-2xl shadow-sm border-2 border-transparent text-left flex flex-col overflow-hidden group transition-all duration-200 ${
                      isProd 
                        ? 'hover:border-indigo-500 hover:shadow-indigo-500/10' 
                        : 'hover:border-teal-500 hover:shadow-teal-500/10'
                    }`}
                  >
                    <div className="h-32 w-full bg-gray-100 dark:bg-dark-700 relative">
                      {isProd ? (
                        item.images?.[0]?.url ? (
                          <img src={item.images[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <ShoppingBag className="w-8 h-8 opacity-40 mb-1" />
                            <span className="text-xs">{isRtl ? 'لا توجد صورة' : 'No Image'}</span>
                          </div>
                        )
                      ) : (
                        item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <Zap className="w-8 h-8 opacity-40 mb-1" />
                            <span className="text-xs">{isRtl ? 'لا توجد صورة' : 'No Image'}</span>
                          </div>
                        )
                      )}
                      
                      {/* Badges to distinguish Service vs Product */}
                      <div className={`absolute top-2 left-2 backdrop-blur-md text-white text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        isProd ? 'bg-indigo-600/90' : 'bg-teal-600/90'
                      }`}>
                        {isProd ? (isRtl ? 'منتج' : 'Product') : (isRtl ? 'قطعة غسيل' : 'Garment')}
                      </div>
                      
                      {!isProd && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded-full font-semibold">
                          {CATEGORIES[item.category] || item.category?.toUpperCase()}
                        </div>
                      )}
                      {isProd && item.sku && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded-full font-mono">
                          {item.sku}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div className="font-bold text-gray-900 dark:text-white mb-1 line-clamp-2 min-h-[2.5rem]">
                        {isRtl ? (item.nameAr || item.nameEn) : item.nameEn}
                      </div>
                      <div className={`text-sm font-bold ${isProd ? 'text-indigo-600' : 'text-teal-600'}`}>
                        SAR {isProd ? item.sellingPrice.toFixed(2) : (item.treatments?.[0]?.price || item.basePrice || 0).toFixed(2)} / {isProd ? (isRtl ? 'حبة' : 'PC') : (item.billingType === 'per_kg' ? 'KG' : (item.billingType === 'per_sqm' ? 'SQM' : 'PC'))}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart Sidebar */}
      <div className="w-full lg:w-96 bg-white dark:bg-dark-800 rounded-2xl shadow-sm flex flex-col flex-shrink-0 border border-gray-200 dark:border-dark-700">
        <div className="p-4 border-b border-gray-100 dark:border-dark-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-teal-600" />
            {isRtl ? 'سلة الطلبات' : 'Current Order'}
          </h2>
        </div>

        {/* Customer Quick Inputs */}
        <div className="p-4 border-b border-gray-100 dark:border-dark-700 space-y-3 bg-gray-50 dark:bg-dark-900/30">
          <div className="relative">
            <User className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              placeholder={isRtl ? "اسم العميل" : "Customer Name"}
              value={cart.customerName}
              onChange={(e) => dispatch(setCustomerName(e.target.value))}
              className={`w-full bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl py-2 text-sm focus:ring-2 focus:ring-teal-500 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
            />
          </div>
          <div className="relative">
            <Phone className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              placeholder={isRtl ? "رقم الهاتف" : "Phone Number"}
              value={cart.customerPhone}
              onChange={(e) => dispatch(setCustomerPhone(e.target.value))}
              className={`w-full bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl py-2 text-sm focus:ring-2 focus:ring-teal-500 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
            />
          </div>
        </div>

        {/* Order Urgency Toggle */}
        <div className="p-4 border-b border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/30">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Zap className={`w-5 h-5 ${cart.isUrgent ? 'text-amber-500' : 'text-gray-400'}`} />
              <span className={`font-semibold ${cart.isUrgent ? 'text-amber-600 dark:text-amber-500' : 'text-gray-600 dark:text-gray-300'}`}>
                {isRtl ? 'طلب عاجل' : 'Urgent Order'}
              </span>
            </label>
            <input 
              type="checkbox" 
              className="toggle toggle-warning" 
              checked={cart.isUrgent} 
              onChange={(e) => dispatch(setIsUrgent(e.target.checked))} 
            />
          </div>
          
          {cart.isUrgent && (
            <div className="flex items-center justify-between gap-3 mt-3 animate-in fade-in slide-in-from-top-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {isRtl ? 'رسوم العاجل:' : 'Urgent Fee:'}
              </span>
              <div className="relative w-32">
                <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 text-sm ${isRtl ? 'right-3' : 'left-3'}`}>SAR</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cart.urgentPrice}
                  onChange={(e) => dispatch(setUrgentPrice(e.target.value))}
                  className={`w-full bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg py-1.5 text-sm focus:ring-2 focus:ring-amber-500 font-bold ${isRtl ? 'pr-12 pl-2' : 'pl-12 pr-2'}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {cart.items.length === 0 ? (
            <div className="text-center text-gray-500 py-10 flex flex-col items-center">
              <ShoppingBag className="w-12 h-12 mb-3 opacity-20" />
              {isRtl ? 'السلة فارغة' : 'Cart is empty'}
            </div>
          ) : (
            cart.items.map(item => (
              <div key={item.cartItemId} className="flex flex-col gap-2 border-b border-gray-100 dark:border-dark-700 pb-3 last:border-0 animate-in fade-in">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                      {item.product ? (
                        <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                          {isRtl ? 'منتج' : 'Prod'}
                        </span>
                      ) : (
                        <span className="bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                          {isRtl ? 'خدمة' : 'Serv'}
                        </span>
                      )}
                      <span className="font-semibold text-sm">{isRtl ? item.nameAr : item.nameEn}</span>
                    </div>

                    {/* Changeable Price input */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-gray-400">SAR</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => dispatch(updateItemPrice({ cartItemId: item.cartItemId, unitPrice: parseFloat(e.target.value) || 0 }))}
                        className={`w-16 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded px-1.5 py-0.5 text-xs font-bold text-center focus:ring-1 focus:outline-none ${
                          item.product ? 'text-indigo-600 focus:ring-indigo-500' : 'text-teal-600 focus:ring-teal-500'
                        }`}
                      />
                      <span className="text-[10px] text-gray-400">/ {item.billingType === 'per_sqm' ? (isRtl ? 'متر' : 'SQM') : (item.billingType === 'per_kg' ? 'KG' : 'PC')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-right min-w-[4rem] font-bold text-gray-900 dark:text-white">
                      {item.total.toFixed(2)}
                    </div>

                    {/* Quantity Edit Counter */}
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                      <button 
                        onClick={() => dispatch(updateItemQuantity({ cartItemId: item.cartItemId, quantity: item.quantity - (item.billingType === 'per_kg' ? 0.5 : 1) }))}
                        className="p-1 hover:bg-white dark:hover:bg-dark-600 rounded text-gray-600 dark:text-gray-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        step={item.billingType === 'per_kg' ? '0.1' : (item.billingType === 'per_sqm' ? '0.01' : '1')}
                        min="0"
                        value={item.quantity}
                        onChange={(e) => dispatch(updateItemQuantity({ cartItemId: item.cartItemId, quantity: parseFloat(e.target.value) || 0 }))}
                        className="w-10 bg-transparent border-none text-center text-xs font-bold focus:ring-0 p-0 focus:outline-none"
                      />
                      <button 
                        onClick={() => dispatch(updateItemQuantity({ cartItemId: item.cartItemId, quantity: item.quantity + (item.billingType === 'per_kg' ? 0.5 : 1) }))}
                        className="p-1 hover:bg-white dark:hover:bg-dark-600 rounded text-gray-600 dark:text-gray-300"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Service/Treatment and Customization Selector (Services Only) */}
                {!item.product && (
                  <div className="bg-gray-50 dark:bg-dark-900/40 p-2 rounded-xl border border-gray-100 dark:border-dark-700/50 mt-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-500 font-semibold">{isRtl ? 'نوع الخدمة' : 'Service Type'}:</span>
                      <select
                        value={item.treatment}
                        onChange={(e) => {
                          const selectedTreatmentName = e.target.value;
                          const selectedTreatmentObj = item.service.treatments?.find(t => t.nameEn === selectedTreatmentName);
                          const price = selectedTreatmentObj ? selectedTreatmentObj.price : item.unitPrice;
                          dispatch(updateItemTreatment({
                            cartItemId: item.cartItemId,
                            treatmentName: selectedTreatmentName,
                            unitPrice: price
                          }));
                        }}
                        className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg px-2 py-0.5 text-xs text-teal-600 font-semibold focus:ring-1 focus:ring-teal-500"
                      >
                        {item.service.treatments?.map(t => (
                          <option key={t.nameEn} value={t.nameEn}>
                            {isRtl ? t.nameAr : t.nameEn} (SAR {t.price})
                          </option>
                        )) || (
                          <option value="Wash & Fold">Wash & Fold</option>
                        )}
                      </select>
                    </div>

                    {/* Customization Pills inside Cart */}
                    <div className="flex flex-wrap gap-1">
                      {ALL_CUSTOMIZATIONS.map(opt => {
                        const isSelected = item.customizations?.includes(opt.id)
                        return (
                          <button
                            key={opt.id}
                            onClick={() => {
                              const newCusts = isSelected 
                                ? item.customizations.filter(c => c !== opt.id)
                                : [...(item.customizations || []), opt.id];
                              dispatch(updateItemCustomizations({ cartItemId: item.cartItemId, customizations: newCusts }));
                            }}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-colors ${
                              isSelected
                                ? 'border-teal-500 bg-teal-500 text-white'
                                : 'border-gray-200 dark:border-dark-700 text-gray-500 dark:text-gray-400 hover:border-teal-500'
                            }`}
                          >
                            {isRtl ? opt.labelAr : opt.labelEn}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-b-2xl border-t border-gray-100 dark:border-dark-700 space-y-3">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
            <span>SAR {cart.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{isRtl ? 'ضريبة القيمة المضافة' : 'VAT (15%)'}</span>
            <span>SAR {cart.items.reduce((s, i) => s + i.taxAmount, 0).toFixed(2)}</span>
          </div>
          {cart.isUrgent && (
            <div className="flex justify-between text-sm text-amber-600 dark:text-amber-500 font-medium">
              <span>{isRtl ? 'رسوم العاجل' : 'Urgent Fee'}</span>
              <span>SAR {cart.urgentPrice.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-dark-600">
            <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
            <span>SAR {(cart.items.reduce((s, i) => s + i.total, 0) + (cart.isUrgent ? cart.urgentPrice : 0)).toFixed(2)}</span>
          </div>
          
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleCheckout('cash')}
              disabled={cart.items.length === 0 || isProcessing}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 px-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (isRtl ? 'جاري المعالجة...' : 'Processing...') : (
                <>{isRtl ? 'نقداً / الدفع' : 'Cash / Checkout'}</>
              )}
            </button>
            {cardTerminalEnabled && (
              <button
                onClick={async () => {
                  if (cart.items.length === 0) return toast.error('Cart is empty')
                  // Pre-create the order as pending_card so we have an ID after approval
                  setIsProcessing(true)
                  try {
                    const payload = {
                      paymentMethod: 'pending_card',
                      customer: cart.customer?._id,
                      customerName: cart.customerName || (cart.customer ? cart.customer.fullName : undefined),
                      customerPhone: cart.customerPhone || (cart.customer ? cart.customer.mobile : undefined),
                      items: cart.items.map(item => ({
                        service: item.product ? undefined : item.service?._id,
                        product: item.product?._id,
                        nameEn: item.nameEn,
                        nameAr: item.nameAr,
                        billingType: item.billingType,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        taxRate: item.product ? (item.product.taxRate || 15) : (item.service?.taxRate || 15),
                        subtotal: item.subtotal,
                        taxAmount: item.taxAmount,
                        total: item.total,
                        treatment: item.treatment || 'None',
                        customizations: item.customizations || []
                      })),
                      isUrgent: cart.isUrgent,
                      deliveryType: cart.deliveryType,
                      notes: cart.notes,
                      subtotal: cart.items.reduce((s, i) => s + i.subtotal, 0),
                      totalVat: cart.items.reduce((s, i) => s + i.taxAmount, 0),
                      urgentFee: cart.isUrgent ? cart.urgentPrice : 0,
                      grandTotal: cart.items.reduce((s, i) => s + i.total, 0) + (cart.isUrgent ? cart.urgentPrice : 0),
                      amountPaid: 0,
                    }
                    const { data } = await api.post('/laundry/orders/checkout', payload)
                    setPendingCardOrder(data)
                    setShowCardModal(true)
                  } catch (error) {
                    toast.error(error.response?.data?.error || 'Failed to initiate card payment')
                  } finally {
                    setIsProcessing(false)
                  }
                }}
                disabled={cart.items.length === 0 || isProcessing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CreditCard className="w-5 h-5" />
                {isRtl ? 'بطاقة' : 'Card'}
              </button>
            )}
          </div>
        </div>
      </div>

      <CardPaymentModal
        open={showCardModal}
        amount={cart.items.reduce((s, i) => s + i.total, 0) + (cart.isUrgent ? cart.urgentPrice : 0)}
        currency="SAR"
        source="laundry"
        orderType="laundry"
        orderNumber={pendingCardOrder?.orderNumber || ''}
        terminalLabel={terminalLabel}
        onApproved={async (posPayment) => {
          try {
            if (pendingCardOrder?._id) {
              await api.patch(`/laundry/orders/${pendingCardOrder._id}/payment`, {
                paymentMethod: 'card',
                posPaymentId: posPayment._id,
                status: 'paid',
              })
            }
          } catch {
            // best-effort patch
          }
          setShowCardModal(false)
          setPendingCardOrder(null)
          setCompletedOrder(pendingCardOrder)
          toast.success(isRtl ? `تم الدفع بالبطاقة: ${pendingCardOrder?.orderNumber || ''}` : `Card payment approved: ${pendingCardOrder?.orderNumber || ''}`)
        }}
        onDeclined={() => { setShowCardModal(false); setPendingCardOrder(null) }}
        onFailed={() => { setShowCardModal(false); setPendingCardOrder(null) }}
        onExpired={() => { setShowCardModal(false); setPendingCardOrder(null) }}
        onClose={() => { setShowCardModal(false); setPendingCardOrder(null) }}
      />

      {/* Print Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[400px] mx-4 max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-lg font-bold">{isRtl ? 'إيصال الطلب' : 'Order Receipt'}</h3>
              <button onClick={handleCloseReceipt} className="text-gray-500 hover:text-gray-700">
                <Minus className="w-5 h-5" />
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-2 print:border-none print:p-0 flex justify-center">
              <ThermalReceipt ref={receiptRef} order={completedOrder} type="laundry" />
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <button onClick={handleCloseReceipt} className="btn btn-secondary flex-1">
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
              <button onClick={handlePrint} className="btn btn-primary flex-1 bg-teal-600">
                {isRtl ? 'طباعة' : 'Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

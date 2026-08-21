import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, Search, Coffee, Truck, UtensilsCrossed, Gift, Receipt, Sparkles, Printer, X, Check, Users, Phone, User, MapPin, Grid, ChevronRight, Percent, Tag } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api, { getImageUrl } from '../../lib/api'
import { toast } from 'react-hot-toast'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import CardPaymentModal from '../../components/pos/CardPaymentModal'
import Money from '../../components/ui/Money'
import { CURRENCY_CODE } from '../../lib/currency'
import { getThermalPrinterSettings, printThermalElement } from '../../lib/thermalPrinter'
import { tenantHasEntitlement } from '../../lib/appEntitlements'

export default function RestaurantPOS() {
  const { language } = useSelector(state => state.ui)
  const { tenant } = useSelector(state => state.auth)
  const hasCombosAddon = tenantHasEntitlement(tenant, { appId: 'restaurant_combos', flag: 'hasCombosAddon' })
  const isRtl = language === 'ar'
  const currency = String(tenant?.settings?.currency || CURRENCY_CODE).toUpperCase()
  const thermalSettings = getThermalPrinterSettings(tenant)
  const cardTerminalEnabled = Boolean(tenant?.settings?.posTerminal?.enabled)
  const terminalLabel = tenant?.settings?.posTerminal?.terminalLabel || ''
  const printKitchenReceipt = tenant?.settings?.restaurant?.printKitchenReceipt !== false

  const [searchParams] = useSearchParams()
  const editOrderId = searchParams.get('orderId')
  const [editingOrder, setEditingOrder] = useState(null)

  const [menuItems, setMenuItems] = useState([])
  const [combos, setCombos] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [orderType, setOrderType] = useState('dine_in') // dine_in, takeaway, delivery
  const [selectedTable, setSelectedTable] = useState('')
  const [showTableModal, setShowTableModal] = useState(false)
  const [tableModalFilter, setTableModalFilter] = useState('all')
  const [tableSearchQuery, setTableSearchQuery] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [applyVat, setApplyVat] = useState(false)
  
  // Discount states
  const [discountType, setDiscountType] = useState('percentage') // 'percentage' | 'fixed'
  const [discountValue, setDiscountValue] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [showDiscountModal, setShowDiscountModal] = useState(false)

  // Checkout states
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedOrder, setCompletedOrder] = useState(null)
  const [receiptType, setReceiptType] = useState('customer') // 'customer' or 'kitchen'
  const [showCardModal, setShowCardModal] = useState(false)
  const receiptRef = useRef(null)
  const kitchenRef = useRef(null)
  const containerRef = useRef(null)
  const [containerHeight, setContainerHeight] = useState('calc(100vh - 180px)')

  // Half plate modal state
  const [selectedHalfPlateItem, setSelectedHalfPlateItem] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // Calculate remaining height on screen: window height - top offset - bottom padding (24px)
        const remaining = window.innerHeight - rect.top - 24
        setContainerHeight(`${remaining}px`)
      }
    }
    
    // Slight delay to ensure DOM is fully rendered (including banners)
    setTimeout(updateHeight, 100)
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [menuRes, tablesRes, combosRes] = await Promise.all([
        api.get('/restaurant/menu-items?limit=200'),
        api.get('/restaurant/tables?isActive=true'),
        hasCombosAddon ? api.get('/restaurant/combos?isActive=true') : Promise.resolve({ data: { combos: [] } })
      ])
      const loadedMenuItems = menuRes.data.items || []
      setMenuItems(loadedMenuItems)
      setCombos(combosRes.data.combos || [])
      setTables(tablesRes.data || [])

      if (editOrderId) {
        try {
          const orderRes = await api.get(`/restaurant/orders/${editOrderId}`)
          const order = orderRes.data
          if (order) {
            setEditingOrder(order)
            setCustomerName(order.customerName || '')
            setCustomerPhone(order.customerPhone || '')
            setDeliveryAddress(order.deliveryAddress || '')
            setOrderType(order.orderType || 'dine_in')
            if (order.tableId) setSelectedTable(order.tableId)
            if (order.paymentMethod) setPaymentMethod(order.paymentMethod)
            
            if (order.discountValue !== undefined) setDiscountValue(order.discountValue)
            else if (order.discount) setDiscountValue(order.discount)
            if (order.discountType) setDiscountType(order.discountType)
            if (order.discountReason) setDiscountReason(order.discountReason)

            // Reconstruct cart
            const reconstructedCart = (order.lineItems || []).map(li => {
              const mItem = loadedMenuItems.find(m => String(m._id) === String(li.menuItemId)) || { _id: li.menuItemId }
              const isHalfPlate = li.nameEn?.includes('Half Plate') || li.name?.includes('Half Plate')
              return {
                cartItemId: `${li.menuItemId}-${isHalfPlate ? 'half' : 'full'}`,
                menuItem: mItem,
                isHalfPlate,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                taxRate: li.taxRate,
                nameEn: li.name || li.nameEn,
                nameAr: li.nameAr || li.name,
                isCombo: li.isCombo,
                comboId: li.comboId,
              }
            })
            setCart(reconstructedCart)
          }
        } catch (err) {
          toast.error('Failed to load existing order')
        }
      }
    } catch (error) {
      toast.error('Failed to load POS data')
    } finally {
      setLoading(false)
    }
  }

  const categories = ['all', ...new Set(menuItems.map(m => m.category).filter(Boolean))]
  if (hasCombosAddon && combos.length > 0) {
    categories.push('combos')
  }

  const filteredItems = menuItems.filter(m => {
    const matchesSearch = (m.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) || m.nameAr?.includes(searchQuery))
    const matchesCat = activeCategory === 'all' || m.category === activeCategory
    return matchesSearch && matchesCat
  })
  
  const displayCombos = (hasCombosAddon && (activeCategory === 'all' || activeCategory === 'combos'))
    ? combos.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.nameAr?.includes(searchQuery))
    : []

  const handleItemClick = (menuItem) => {
    if (menuItem.hasHalfPlate) {
      setSelectedHalfPlateItem(menuItem)
    } else {
      addToCart(menuItem, false)
    }
  }

  const addToCart = (menuItem, isHalfPlate) => {
    const price = isHalfPlate ? menuItem.halfPlatePrice : menuItem.sellingPrice
    const nameSuffixEn = isHalfPlate ? ' (Half Plate)' : ''
    const nameSuffixAr = isHalfPlate ? ' (نصف)' : ''
    
    // Unique ID combining item ID and plate type
    const cartItemId = `${menuItem._id}-${isHalfPlate ? 'half' : 'full'}`

    setCart(prev => {
      const existing = prev.find(item => item.cartItemId === cartItemId)
      if (existing) {
        return prev.map(item => 
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { 
        cartItemId,
        menuItem, 
        isHalfPlate,
        quantity: 1, 
        unitPrice: price || 0, 
        taxRate: menuItem.taxRate || 15,
        nameEn: `${menuItem.nameEn}${nameSuffixEn}`,
        nameAr: `${menuItem.nameAr || menuItem.nameEn}${nameSuffixAr}`
      }]
    })
    
    setSelectedHalfPlateItem(null)
  }

  const addComboToCart = (combo) => {
    const cartItemId = `combo-${combo._id}`
    setCart(prev => {
      const existing = prev.find(item => item.cartItemId === cartItemId)
      if (existing) {
        return prev.map(item => 
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { 
        cartItemId,
        menuItem: { _id: combo._id }, 
        isCombo: true,
        comboId: combo._id,
        quantity: 1, 
        unitPrice: combo.comboPrice || 0, 
        taxRate: 15,
        nameEn: `${combo.name} (Combo)`,
        nameAr: `${combo.nameAr || combo.name} (عرض)`
      }]
    })
  }

  const updateQuantity = (cartItemId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQ = Math.max(0, item.quantity + delta)
        return { ...item, quantity: newQ }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const clearCart = () => {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setDeliveryAddress('')
    setSelectedTable('')
    setDiscountValue(0)
    setDiscountReason('')
    setDiscountType('percentage')
  }

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const discountNum = Math.max(0, Number(discountValue) || 0)
  const appliedDiscount = discountType === 'percentage'
    ? Math.round((cartSubtotal * Math.min(100, discountNum) / 100) * 100) / 100
    : Math.min(cartSubtotal, discountNum)
  const discountedSubtotal = Math.max(0, cartSubtotal - appliedDiscount)
  const cartTax = applyVat 
    ? cart.reduce((sum, item) => {
        const itemSub = item.quantity * item.unitPrice
        const ratio = cartSubtotal > 0 ? discountedSubtotal / cartSubtotal : 1
        return sum + (itemSub * ratio * (item.taxRate / 100))
      }, 0)
    : 0
  const cartTotal = Math.round((discountedSubtotal + cartTax) * 100) / 100

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty')
    // Route card payments through the physical terminal when configured.
    if (paymentMethod === 'card' && cardTerminalEnabled) {
      setShowCardModal(true)
      return
    }

    await submitOrder()
  }

  const submitOrder = async (targetStatus = 'paid') => {
    setIsProcessing(true)
    try {
      const payload = {
        status: targetStatus,
        kitchenStatus: 'new', // Send to kitchen
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod: targetStatus === 'paid' ? paymentMethod : undefined,
        currency,
        discount: appliedDiscount,
        discountType,
        discountValue: discountNum,
        discountReason: discountReason.trim(),
        lineItems: cart.map(item => ({
          menuItemId: item.menuItem._id,
          name: item.nameEn,
          nameAr: item.nameAr,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: applyVat ? item.taxRate : 0,
          isCombo: item.isCombo,
          comboId: item.comboId,
        }))
      }
      
      if (orderType === 'dine_in') {
        const table = tables.find(t => t._id === selectedTable)
        if (table) {
          payload.tableId = table._id
          payload.tableNumber = table.tableNumber
        }
      }
      
      let data;
      if (editOrderId) {
        const res = await api.put(`/restaurant/orders/${editOrderId}`, payload)
        data = res.data
        toast.success(isRtl ? `تم تحديث الطلب: ${data.orderNumber}` : `Order updated: ${data.orderNumber}`)
      } else {
        const res = await api.post('/restaurant/orders', payload)
        data = res.data
        toast.success(isRtl ? `تم إنشاء الطلب: ${data.orderNumber}` : `Order created: ${data.orderNumber}`)
      }
      
      setReceiptType('customer')
      setCompletedOrder(data)
      clearCart()

      // Auto-open print dialog for thermal receipt ONLY if autoPrint is enabled in settings
      const shouldAutoPrint = thermalSettings?.autoPrint === true || tenant?.settings?.restaurant?.autoPrintReceipt === true
      if (shouldAutoPrint) {
        setTimeout(() => {
          if (receiptRef.current) {
            printThermalElement(receiptRef.current, thermalSettings)
          }
        }, 400)
      }

      // Refresh tables if dine in to update status
      if (orderType === 'dine_in') {
        fetchData()
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Checkout failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendToKitchen = async () => {
    if (cart.length === 0) return toast.error('Cart is empty')
    setIsProcessing(true)
    try {
      const payload = {
        status: 'open',
        kitchenStatus: 'new', // Send to kitchen
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
        currency,
        discount: appliedDiscount,
        discountType,
        discountValue: discountNum,
        discountReason: discountReason.trim(),
        lineItems: cart.map(item => ({
          menuItemId: item.menuItem._id,
          name: item.nameEn,
          nameAr: item.nameAr,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: applyVat ? item.taxRate : 0,
          isCombo: item.isCombo,
          comboId: item.comboId,
        }))
      }
      if (orderType === 'dine_in') {
        const table = tables.find(t => t._id === selectedTable)
        if (table) { payload.tableId = table._id; payload.tableNumber = table.tableNumber }
      }
      
      let data;
      if (editOrderId) {
        const res = await api.put(`/restaurant/orders/${editOrderId}`, payload)
        data = res.data
        toast.success(isRtl ? `تم التحديث للمطبخ: ${data.orderNumber}` : `Updated to kitchen: ${data.orderNumber}`)
      } else {
        const res = await api.post('/restaurant/orders', payload)
        data = res.data
        toast.success(isRtl ? `تم الإرسال للمطبخ: ${data.orderNumber}` : `Sent to kitchen: ${data.orderNumber}`)
      }
      
      setReceiptType('kitchen')
      setCompletedOrder(data)
      clearCart()

      // Auto-print kitchen ticket ONLY if setting enabled
      const shouldAutoPrintKitchen = printKitchenReceipt && (thermalSettings?.autoPrint === true || tenant?.settings?.restaurant?.autoPrintKitchen === true)
      if (shouldAutoPrintKitchen) {
        setTimeout(() => {
          if (receiptRef.current) {
            printThermalElement(receiptRef.current, thermalSettings)
          }
        }, 400)
      }

      if (orderType === 'dine_in') fetchData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kitchen dispatch failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCardApproved = async (posPayment) => {
    setShowCardModal(false)
    // Submit the restaurant order with card payment
    setIsProcessing(true)
    try {
      const payload = {
        status: 'paid',
        kitchenStatus: 'new',
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod: 'card',
        currency,
        discount: appliedDiscount,
        discountType,
        discountValue: discountNum,
        discountReason: discountReason.trim(),
        lineItems: cart.map(item => ({
          menuItemId: item.menuItem._id,
          name: item.nameEn,
          nameAr: item.nameAr,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: applyVat ? item.taxRate : 0,
          isCombo: item.isCombo,
          comboId: item.comboId,
        }))
      }
      if (orderType === 'dine_in') {
        const table = tables.find(t => t._id === selectedTable)
        if (table) { payload.tableId = table._id; payload.tableNumber = table.tableNumber }
      }
      
      let data;
      if (editOrderId) {
        const res = await api.put(`/restaurant/orders/${editOrderId}`, payload)
        data = res.data
      } else {
        const res = await api.post('/restaurant/orders', payload)
        data = res.data
      }

      // Best-effort PATCH to record the POS payment
      try {
        await api.patch(`/restaurant/orders/${data._id}/payment`, {
          paymentMethod: 'card',
          posPaymentId: posPayment._id,
          status: 'paid',
        })
      } catch {
        // ignore
      }
      
      if (editOrderId) {
        toast.success(isRtl ? `تم تحديث الطلب: ${data.orderNumber}` : `Order updated: ${data.orderNumber}`)
      } else {
        toast.success(isRtl ? `تم إنشاء الطلب: ${data.orderNumber}` : `Order created: ${data.orderNumber}`)
      }
      
      setReceiptType('customer')
      setCompletedOrder(data)
      clearCart()

      const shouldAutoPrint = thermalSettings?.autoPrint === true || tenant?.settings?.restaurant?.autoPrintReceipt === true
      if (shouldAutoPrint) {
        setTimeout(() => {
          if (receiptRef.current) {
            printThermalElement(receiptRef.current, thermalSettings)
          }
        }, 400)
      }

      if (orderType === 'dine_in') fetchData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Checkout failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrint = () => {
    if (receiptRef.current) {
      printThermalElement(receiptRef.current, thermalSettings)
    }
  }

  const handleCloseReceipt = () => {
    setCompletedOrder(null)
  }

  return (
    <div 
      ref={containerRef}
      style={{ height: containerHeight }}
      className="flex flex-col md:flex-row min-h-[500px] w-full max-w-full gap-3 md:gap-4 lg:gap-6 overflow-hidden bg-transparent"
    >
      
      {/* Left: Menu Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-dark-900 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 dark:border-dark-800 overflow-hidden relative">
        
        <div className="p-4 sm:p-5 flex flex-col gap-4 flex-shrink-0 z-10 border-b border-gray-50 dark:border-dark-800">
          <div className="relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-4' : 'left-4'}`} />
            <input
              type="text"
              placeholder={isRtl ? "البحث عن صنف..." : "Search menu..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-gray-50 dark:bg-dark-800 border-none rounded-xl py-3 focus:ring-1 focus:ring-gray-300 dark:focus:ring-dark-600 transition-all text-sm font-medium ${isRtl ? 'pr-11' : 'pl-11'}`}
            />
          </div>
          
          {/* Categories Pill Bar */}
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 min-w-0 w-full">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2.5 rounded-xl whitespace-nowrap font-bold text-xs transition-all duration-200 relative flex-shrink-0 ${
                  activeCategory === cat 
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' 
                    : 'bg-gray-50 dark:bg-dark-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="relative z-10">
                  {cat === 'all' ? (isRtl ? 'الكل' : 'All') : cat}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 pt-2 z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span className="font-semibold text-sm">Loading Menu...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {displayCombos.map(combo => (
                <motion.button
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  key={`combo-${combo._id}`}
                  onClick={() => addComboToCart(combo)}
                  className="bg-white/80 dark:bg-dark-900/80 backdrop-blur-sm rounded-3xl shadow-sm hover:shadow-xl border border-pink-100 dark:border-pink-900/30 text-left flex flex-col relative overflow-hidden group transition-all duration-300"
                >
                  <div className="h-36 w-full bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-indigo-500/10 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent dark:from-white/5 opacity-50" />
                    <Gift className="w-14 h-14 text-pink-500 drop-shadow-md group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500" />
                    
                    {combo.badgeText && (
                      <div className="absolute top-3 left-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider shadow-md">
                        {combo.badgeText}
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between bg-gradient-to-b from-transparent to-pink-50/30 dark:to-pink-900/10">
                    <div className="font-black text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight">
                      {isRtl ? (combo.nameAr || combo.name) : combo.name}
                    </div>
                    <div className="text-base font-black text-pink-600 flex items-center justify-between">
                      <Money value={combo.comboPrice || 0} />
                      <div className="w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
              
              {filteredItems.map(item => (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  key={item._id}
                  onClick={() => handleItemClick(item)}
                  className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 text-left flex flex-col overflow-hidden group transition-all duration-200 hover:shadow-md hover:border-gray-200 dark:hover:border-dark-600"
                >
                  <div className="h-32 w-full bg-gray-50 dark:bg-dark-900 relative overflow-hidden flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={getImageUrl(item.imageUrl)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="w-8 h-8 text-gray-300 dark:text-dark-600" />
                      </div>
                    )}
                    
                    {item.hasHalfPlate && (
                      <div className="absolute top-2 left-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm text-gray-900 dark:text-white text-[9px] px-2 py-0.5 rounded-lg font-bold shadow-sm border border-gray-100 dark:border-dark-700">
                        {isRtl ? 'نصف و كامل' : 'Half/Full'}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 flex-1 flex flex-col justify-between border-t border-gray-50 dark:border-dark-800">
                    <div className="font-bold text-gray-900 dark:text-white mb-2 text-sm line-clamp-2 leading-tight">
                      {isRtl ? (item.nameAr || item.nameEn) : item.nameEn}
                    </div>
                    <div className="text-sm font-black text-gray-900 dark:text-white flex items-center justify-between">
                      <Money value={item.sellingPrice || 0} />
                      <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Ultra-Minimalistic Cart Sidebar */}
      <div className="w-full md:w-[300px] lg:w-[340px] xl:w-[380px] bg-white dark:bg-dark-900 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] border-l border-gray-100 dark:border-dark-800 flex flex-col flex-shrink-0 min-h-0 h-full relative z-20">
        
        {/* Order Type Selector */}
        <div className="p-4 pb-2 flex-shrink-0 border-b border-gray-50 dark:border-dark-800">
          <div className="flex rounded-xl bg-gray-50 dark:bg-dark-800 p-1">
            <button
              onClick={() => setOrderType('dine_in')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                orderType === 'dine_in'
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              {isRtl ? 'محلي' : 'Dine In'}
            </button>
            <button
              onClick={() => setOrderType('takeaway')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                orderType === 'takeaway'
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              {isRtl ? 'سفري' : 'Takeaway'}
            </button>
            <button
              onClick={() => setOrderType('delivery')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                orderType === 'delivery'
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {isRtl ? 'توصيل' : 'Delivery'}
            </button>
          </div>
        </div>

        {/* Customer & Table Inputs */}
        <div className="px-4 py-3 flex-shrink-0 space-y-3 border-b border-gray-50 dark:border-dark-800">
          {orderType === 'dine_in' && (
            <div className="space-y-2">
              {selectedTable ? (
                (() => {
                  const curT = tables.find(t => String(t._id) === String(selectedTable) || String(t.tableNumber) === String(selectedTable))
                  return (
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-800 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          curT?.status === 'occupied' ? 'bg-rose-500' :
                          curT?.status === 'reserved' ? 'bg-blue-500' : 'bg-emerald-500'
                        }`} />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {isRtl ? 'طاولة' : 'Table'} {curT?.tableNumber || selectedTable}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowTableModal(true)}
                          className="text-[11px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        >
                          {isRtl ? 'تغيير' : 'Change'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedTable('')}
                          className="text-gray-400 hover:text-rose-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTableModal(true)}
                  className="w-full flex items-center justify-between border border-gray-200 dark:border-dark-700 hover:border-gray-900 dark:hover:border-white rounded-xl px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {isRtl ? 'اختيار طاولة' : 'Select Table'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={isRtl ? 'العميل' : 'Customer Name'} 
              className="w-full bg-gray-50 dark:bg-dark-800 border-none rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-gray-300 dark:focus:ring-dark-600 font-medium"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
            <input 
              type="tel" 
              placeholder={isRtl ? 'الهاتف' : 'Phone'} 
              className="w-full bg-gray-50 dark:bg-dark-800 border-none rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-gray-300 dark:focus:ring-dark-600 font-medium"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
            />
          </div>

          {orderType === 'delivery' && (
            <input 
              type="text" 
              placeholder={isRtl ? 'عنوان التوصيل' : 'Delivery Address'} 
              className="w-full bg-gray-50 dark:bg-dark-800 border-none rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-gray-300 dark:focus:ring-dark-600 font-medium"
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
            />
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingBag className="w-10 h-10 mb-3 opacity-20" />
              <span className="text-sm font-medium">{isRtl ? 'الطلب فارغ' : 'Order is empty'}</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-dark-800">
              <AnimatePresence initial={false}>
                {cart.map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={item.cartItemId} 
                    className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="font-bold text-gray-900 dark:text-white text-sm truncate">
                        {isRtl ? item.nameAr : item.nameEn}
                      </div>
                      <div className="text-xs font-semibold text-gray-500 mt-0.5">
                        <Money value={item.unitPrice} />
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-sm font-black text-gray-900 dark:text-white">
                        {(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                      <div className="flex items-center gap-2 border border-gray-200 dark:border-dark-700 rounded-lg p-0.5">
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, -1)}
                          className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded text-gray-600 dark:text-gray-300"
                        >
                          {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3" />}
                        </button>
                        <span className="w-4 text-center text-xs font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, 1)}
                          className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded text-gray-600 dark:text-gray-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Totals & Checkout Panel */}
        <div className="p-4 border-t border-gray-100 dark:border-dark-800 bg-white dark:bg-dark-900 flex-shrink-0">
          
          <div className="flex gap-2 mb-4 bg-gray-50 dark:bg-dark-800 p-1 rounded-xl">
            {['cash', 'card'].map(pm => (
              <button
                key={pm}
                onClick={() => setPaymentMethod(pm)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === pm
                    ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {pm === 'cash' ? <Receipt className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                {pm === 'cash' ? (isRtl ? 'نقدي' : 'Cash') : (isRtl ? 'بطاقة' : 'Card')}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-xs font-medium text-gray-500">
              <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <Money value={cartSubtotal} />
            </div>

            {/* Discount Row */}
            <div className="flex justify-between items-center text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className={appliedDiscount > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-500'}>
                  {isRtl ? 'الخصم' : 'Discount'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(true)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                    appliedDiscount > 0
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200'
                      : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <Percent className="w-3 h-3" />
                  {appliedDiscount > 0 
                    ? (discountType === 'percentage' ? `${discountNum}%` : <Money value={discountNum} />) 
                    : (isRtl ? 'إضافة' : '+ Add')}
                </button>
              </div>
              {appliedDiscount > 0 ? (
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  - <Money value={appliedDiscount} />
                </span>
              ) : (
                <span className="text-gray-400 text-xs">-</span>
              )}
            </div>

            <div className="flex justify-between text-xs font-medium text-gray-500">
              <div className="flex items-center gap-1.5">
                <span>{isRtl ? 'الضريبة' : (currency === 'SAR' ? 'VAT' : 'Tax')}</span>
                <button
                  onClick={() => setApplyVat(!applyVat)}
                  className="bg-gray-100 dark:bg-dark-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-900 dark:text-gray-300"
                >
                  {applyVat ? '15%' : '0%'}
                </button>
              </div>
              <Money value={cartTax} />
            </div>
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100 dark:border-dark-800">
              <span className="text-xs font-bold text-gray-900 dark:text-white tracking-wide">{isRtl ? 'الإجمالي' : 'TOTAL'}</span>
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                <Money value={cartTotal} />
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSendToKitchen}
              disabled={cart.length === 0 || isProcessing}
              className="flex-1 bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-900 dark:text-white py-3 px-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UtensilsCrossed className="w-4 h-4" />
              {isRtl ? 'مطبخ' : 'Kitchen'}
            </button>
            
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="flex-[2] bg-black hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black py-3 px-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (
                <>
                  {isRtl ? 'دفع' : 'Checkout'}
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Half Plate Selector Modal */}
      <AnimatePresence>
        {selectedHalfPlateItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white/90 dark:bg-dark-800/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 dark:border-white/5"
            >
              <div className="p-6 pb-4 border-b border-gray-100/50 dark:border-dark-700/50 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-900/10 text-center">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <h3 className="font-black text-xl text-gray-900 dark:text-white">
                  {isRtl ? (selectedHalfPlateItem.nameAr || selectedHalfPlateItem.nameEn) : selectedHalfPlateItem.nameEn}
                </h3>
                <p className="text-sm font-bold text-amber-600 mt-1">
                  {isRtl ? 'اختر حجم الحصة' : 'Select Portion Size'}
                </p>
              </div>
              <div className="p-6 flex gap-4">
                <button
                  onClick={() => addToCart(selectedHalfPlateItem, true)}
                  className="flex-1 flex flex-col items-center justify-center p-5 rounded-2xl bg-gray-50 hover:bg-indigo-50 dark:bg-dark-900 dark:hover:bg-indigo-900/20 border-2 border-transparent hover:border-indigo-500 transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="text-lg font-black text-gray-900 dark:text-white group-hover:text-indigo-600 mb-1">
                    {isRtl ? 'نصف' : 'Half'}
                  </div>
                  <div className="text-sm font-bold text-gray-500 group-hover:text-indigo-500">
                    <Money value={selectedHalfPlateItem.halfPlatePrice || 0} />
                  </div>
                </button>
                <button
                  onClick={() => addToCart(selectedHalfPlateItem, false)}
                  className="flex-1 flex flex-col items-center justify-center p-5 rounded-2xl bg-gray-50 hover:bg-amber-50 dark:bg-dark-900 dark:hover:bg-amber-900/20 border-2 border-transparent hover:border-amber-500 transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="text-lg font-black text-gray-900 dark:text-white group-hover:text-amber-600 mb-1">
                    {isRtl ? 'كامل' : 'Full'}
                  </div>
                  <div className="text-sm font-bold text-gray-500 group-hover:text-amber-500">
                    <Money value={selectedHalfPlateItem.sellingPrice || 0} />
                  </div>
                </button>
              </div>
              <div className="p-4 bg-gray-50/50 dark:bg-dark-900/50">
                <button 
                  onClick={() => setSelectedHalfPlateItem(null)}
                  className="w-full py-3.5 rounded-xl text-gray-600 font-bold hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-dark-700 transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thermal Receipt Print Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[420px] mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  {receiptType === 'kitchen' 
                    ? (isRtl ? 'تذكرة المطبخ' : 'Kitchen Ticket') 
                    : (isRtl ? 'فاتورة الطلب الحرارية' : 'Thermal Order Receipt')}
                </h3>
              </div>
              <button 
                onClick={handleCloseReceipt} 
                className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Toggle between Customer Receipt and Kitchen Ticket */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setReceiptType('customer')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${receiptType === 'customer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {isRtl ? 'فاتورة العميل' : 'Customer Receipt'}
              </button>
              <button
                type="button"
                onClick={() => setReceiptType('kitchen')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${receiptType === 'kitchen' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {isRtl ? 'تذكرة المطبخ' : 'Kitchen Ticket'}
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl p-3 flex justify-center bg-gray-50 overflow-hidden">
              <ThermalReceipt
                ref={receiptRef}
                order={completedOrder}
                type="restaurant"
                isKitchen={receiptType === 'kitchen'}
                isUpdated={!!editOrderId}
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button 
                onClick={handleCloseReceipt} 
                className="flex-1 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 text-gray-700 transition-colors"
              >
                {isRtl ? 'طلب جديد / إغلاق' : 'New Order / Close'}
              </button>
              <button 
                onClick={handlePrint} 
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all"
              >
                <Printer className="w-5 h-5"/>
                {isRtl ? 'طباعة' : 'Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ultra-Minimalistic Table Selection Modal */}
      <AnimatePresence>
        {showTableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-dark-700"
            >
              <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      {isRtl ? 'اختيار طاولة' : 'Select Table'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isRtl ? 'حدد الطاولة لطلب المحلي' : 'Choose a table for dine-in order'}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter & Search Bar */}
              <div className="p-4 bg-gray-50/70 dark:bg-dark-900/50 border-b border-gray-100 dark:border-dark-700 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute top-2.5 left-3 rtl:left-auto rtl:right-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder={isRtl ? 'بحث برقم أو اسم الطاولة...' : 'Search table number or name...'}
                    value={tableSearchQuery}
                    onChange={e => setTableSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl py-2 pl-9 pr-4 rtl:pl-4 rtl:pr-9 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 text-gray-800 dark:text-gray-200"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'all', label: isRtl ? 'الكل' : 'All', count: tables.length },
                    { id: 'available', label: isRtl ? 'متاحة' : 'Available', count: tables.filter(t => t.status === 'available').length, color: 'text-emerald-600' },
                    { id: 'occupied', label: isRtl ? 'مشغولة' : 'Occupied', count: tables.filter(t => t.status === 'occupied').length, color: 'text-rose-600' },
                    { id: 'reserved', label: isRtl ? 'محجوزة' : 'Reserved', count: tables.filter(t => t.status === 'reserved').length, color: 'text-blue-600' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTableModalFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        tableModalFilter === tab.id
                          ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-dark-700'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] font-semibold opacity-80 ${tab.color || ''}`}>({tab.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tables Grid */}
              <div className="p-4 max-h-[340px] overflow-y-auto custom-scrollbar">
                {tables.filter(t => {
                  const matchesFilter = tableModalFilter === 'all' || t.status === tableModalFilter
                  const matchesSearch = !tableSearchQuery || 
                    t.tableNumber?.toLowerCase().includes(tableSearchQuery.toLowerCase()) || 
                    t.name?.toLowerCase().includes(tableSearchQuery.toLowerCase())
                  return matchesFilter && matchesSearch
                }).length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold">{isRtl ? 'لا توجد طاولات مطابقة' : 'No matching tables found'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {tables
                      .filter(t => {
                        const matchesFilter = tableModalFilter === 'all' || t.status === tableModalFilter
                        const matchesSearch = !tableSearchQuery || 
                          t.tableNumber?.toLowerCase().includes(tableSearchQuery.toLowerCase()) || 
                          t.name?.toLowerCase().includes(tableSearchQuery.toLowerCase())
                        return matchesFilter && matchesSearch
                      })
                      .map(t => {
                        const isSelected = String(selectedTable) === String(t._id)
                        const isAvail = t.status === 'available'
                        return (
                          <button
                            key={t._id}
                            type="button"
                            onClick={() => {
                              setSelectedTable(t._id)
                              setShowTableModal(false)
                            }}
                            className={`p-3 rounded-2xl border text-left rtl:text-right transition-all flex flex-col justify-between h-24 relative overflow-hidden group ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 shadow-md ring-2 ring-amber-500/30'
                                : isAvail
                                ? 'border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-amber-400 hover:shadow-sm'
                                : 'border-gray-200/60 dark:border-dark-700/60 bg-gray-50 dark:bg-dark-900/60 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-start justify-between w-full">
                              <span className="text-sm font-black text-gray-900 dark:text-white">
                                T{t.tableNumber}
                              </span>
                              <div className={`w-2.5 h-2.5 rounded-full ${
                                t.status === 'occupied' ? 'bg-rose-500' :
                                t.status === 'reserved' ? 'bg-blue-500' : 'bg-emerald-500'
                              }`} />
                            </div>

                            {t.name && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full font-medium">
                                {t.name}
                              </p>
                            )}

                            <div className="flex items-center justify-between w-full pt-1 border-t border-gray-100 dark:border-dark-700/50">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 font-semibold">
                                <Users className="w-3 h-3" />
                                {t.seats || 4}
                              </span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                t.status === 'occupied' ? 'text-rose-600 dark:text-rose-400' :
                                t.status === 'reserved' ? 'text-blue-600 dark:text-blue-400' :
                                'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {t.status === 'available' ? (isRtl ? 'متاحة' : 'Avail') :
                                 t.status === 'occupied' ? (isRtl ? 'مشغولة' : 'Occ') :
                                 (isRtl ? 'محجوزة' : 'Res')}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50/70 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTable('')
                    setShowTableModal(false)
                  }}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3 py-2 rounded-xl transition-colors"
                >
                  {isRtl ? 'إلغاء تعيين الطاولة' : 'Clear Table'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="btn btn-secondary text-xs px-4 py-2 rounded-xl font-bold"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Discount Modal */}
      <AnimatePresence>
        {showDiscountModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-dark-700"
            >
              <div className="p-5 pb-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      {isRtl ? 'إضافة خصم للطلب' : 'Order Discount'}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      {isRtl ? 'اختر النسبة أو أدخل قيمة ثابتة' : 'Choose percentage or fixed amount'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Discount Type Selector */}
                <div className="flex rounded-xl bg-gray-100 dark:bg-dark-900 p-1">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      discountType === 'percentage'
                        ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    {isRtl ? 'نسبة مئوية (%)' : 'Percentage (%)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      discountType === 'fixed'
                        ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {isRtl ? `قيمة ثابتة (${currency})` : `Fixed (${currency})`}
                  </button>
                </div>

                {/* Quick Percentage Presets */}
                {discountType === 'percentage' && (
                  <div className="grid grid-cols-5 gap-1.5">
                    {[5, 10, 15, 20, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountValue(pct)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          Number(discountValue) === pct
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                            : 'bg-gray-50 dark:bg-dark-900 hover:bg-gray-100 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}

                {/* Discount Value Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {discountType === 'percentage' 
                      ? (isRtl ? 'نسبة الخصم (%)' : 'Discount Percentage (%)')
                      : (isRtl ? `مبلغ الخصم (${currency})` : `Discount Amount (${currency})`)}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percentage' ? 100 : cartSubtotal}
                      step={discountType === 'percentage' ? '1' : '0.5'}
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl py-2.5 px-3 text-lg font-black focus:ring-2 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {discountType === 'percentage' ? '%' : currency}
                    </span>
                  </div>
                </div>

                {/* Discount Reason / Note */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'سبب الخصم (اختياري)' : 'Reason / Note (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder={isRtl ? 'مثال: موظف، عميل مميز، عرض ترويجي' : 'e.g. VIP, Staff, Promo, Special deal'}
                    className="w-full bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['Staff', 'VIP', 'Promo', 'Manager'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setDiscountReason(r)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400 hover:bg-amber-50 hover:text-amber-700"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Discount Preview */}
                {appliedDiscount > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3 text-xs flex justify-between items-center text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">{isRtl ? 'قيمة الخصم الفعلي:' : 'Applied Discount:'}</span>
                    <span className="font-black text-sm text-amber-700 dark:text-amber-400">
                      - <Money value={appliedDiscount} />
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 bg-gray-50 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700 flex gap-2">
                {discountValue > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountValue(0)
                      setDiscountReason('')
                      setShowDiscountModal(false)
                    }}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    {isRtl ? 'إزالة' : 'Remove'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold hover:bg-gray-800 transition-colors shadow-sm"
                >
                  {isRtl ? 'تطبيق الخصم' : 'Apply Discount'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CardPaymentModal
        open={showCardModal}
        amount={cartTotal}
        currency={currency}
        source="restaurant"
        orderType="restaurant"
        orderNumber={''}
        terminalLabel={terminalLabel}
        onApproved={handleCardApproved}
        onDeclined={() => setShowCardModal(false)}
        onFailed={() => setShowCardModal(false)}
        onExpired={() => setShowCardModal(false)}
        onClose={() => setShowCardModal(false)}
      />
    </div>
  )
}

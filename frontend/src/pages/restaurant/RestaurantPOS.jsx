import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, Search, Coffee, Truck, UtensilsCrossed, Gift, Receipt, Sparkles } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api, { getImageUrl } from '../../lib/api'
import { toast } from 'react-hot-toast'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import KitchenTicket from '../../components/restaurant/KitchenTicket'
import OrderReceipt from '../../components/restaurant/OrderReceipt'
import CardPaymentModal from '../../components/pos/CardPaymentModal'

export default function RestaurantPOS() {
  const { language } = useSelector(state => state.ui)
  const { tenant } = useSelector(state => state.auth)
  const isRtl = language === 'ar'
  const cardTerminalEnabled = Boolean(tenant?.settings?.posTerminal?.enabled)
  const terminalLabel = tenant?.settings?.posTerminal?.terminalLabel || ''

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
  const [orderType, setOrderType] = useState('dine_in') // dine_in, takeaway, delivery
  const [selectedTable, setSelectedTable] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [applyVat, setApplyVat] = useState(false)
  
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
        api.get('/restaurant/tables?status=available'),
        tenant?.subscription?.hasCombosAddon ? api.get('/restaurant/combos?isActive=true') : Promise.resolve({ data: { combos: [] } })
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
            setOrderType(order.orderType || 'dine_in')
            if (order.tableId) setSelectedTable(order.tableId)
            if (order.paymentMethod) setPaymentMethod(order.paymentMethod)
            
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
  if (tenant?.subscription?.hasCombosAddon && combos.length > 0) {
    categories.push('combos')
  }

  const filteredItems = menuItems.filter(m => {
    const matchesSearch = (m.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) || m.nameAr?.includes(searchQuery))
    const matchesCat = activeCategory === 'all' || m.category === activeCategory
    return matchesSearch && matchesCat
  })
  
  const displayCombos = (tenant?.subscription?.hasCombosAddon && (activeCategory === 'all' || activeCategory === 'combos'))
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
    setSelectedTable('')
  }

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const cartTax = applyVat ? cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.taxRate / 100)), 0) : 0
  const cartTotal = cartSubtotal + cartTax

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
        paymentMethod: targetStatus === 'paid' ? paymentMethod : undefined,
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

      // Auto-print customer receipt + kitchen ticket
      setTimeout(() => {
        // Print customer receipt first
        if (receiptRef.current) window.print()
      }, 500)

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

      // Auto-print kitchen ticket first, then customer receipt
      setTimeout(() => {
        if (kitchenRef.current) window.print()
        // After kitchen print, switch to customer receipt and print
        setTimeout(() => {
          setReceiptType('customer')
          setTimeout(() => {
            if (receiptRef.current) window.print()
          }, 300)
        }, 800)
      }, 500)

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
        paymentMethod: 'card',
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
      if (orderType === 'dine_in') fetchData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Checkout failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrint = () => {
    const activeRef = receiptType === 'kitchen' ? kitchenRef : receiptRef
    if (activeRef.current) {
      window.print()
    }
  }

  const handleCloseReceipt = () => {
    setCompletedOrder(null)
    clearCart()
  }

  return (
    <div 
      ref={containerRef}
      style={{ height: containerHeight }}
      className="flex flex-col lg:flex-row min-h-[500px] w-full max-w-full gap-4 lg:gap-6 overflow-hidden bg-transparent"
    >
      
      {/* Left: Menu Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/5 overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="p-4 sm:p-5 flex flex-col gap-4 flex-shrink-0 z-10 border-b border-gray-100 dark:border-dark-700/50">
          <div className="relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-4' : 'left-4'}`} />
            <input
              type="text"
              placeholder={isRtl ? "البحث عن صنف..." : "Search menu..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-white/80 dark:bg-dark-900/80 backdrop-blur-md border border-gray-200/80 dark:border-dark-700 rounded-2xl shadow-sm py-3.5 focus:ring-2 focus:ring-amber-500/50 transition-all ${isRtl ? 'pr-12' : 'pl-12'}`}
            />
          </div>
          
          {/* Categories Pill Bar */}
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 pt-1 -mx-2 px-2 mask-linear-fade min-w-0 w-full">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-2xl whitespace-nowrap font-bold text-sm transition-all duration-300 relative overflow-hidden flex-shrink-0 ${
                  activeCategory === cat 
                    ? 'text-white shadow-md shadow-amber-500/20' 
                    : 'bg-white/50 dark:bg-dark-900/50 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-700 border border-transparent hover:border-gray-200 dark:hover:border-dark-600'
                }`}
              >
                {activeCategory === cat && (
                  <motion.div 
                    layoutId="activeCategory"
                    className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
                      <span>SAR {(combo.comboPrice || 0).toFixed(2)}</span>
                      <div className="w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
              
              {filteredItems.map(item => (
                <motion.button
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  key={item._id}
                  onClick={() => handleItemClick(item)}
                  className="bg-white/80 dark:bg-dark-900/80 backdrop-blur-sm rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 dark:border-dark-700/50 text-left flex flex-col relative overflow-hidden group transition-all duration-300"
                >
                  <div className="h-36 w-full bg-gray-50/50 dark:bg-dark-800/50 relative overflow-hidden flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={getImageUrl(item.imageUrl)} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 dark:from-dark-800 dark:to-dark-700">
                        <UtensilsCrossed className="w-10 h-10 text-gray-300 dark:text-dark-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {item.hasHalfPlate && (
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-bold shadow-md">
                        {isRtl ? 'نصف و كامل' : 'Half/Full'}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight">
                      {isRtl ? (item.nameAr || item.nameEn) : item.nameEn}
                    </div>
                    <div className="text-base font-black text-amber-600 flex items-center justify-between">
                      <span>SAR {(item.sellingPrice || 0).toFixed(2)}</span>
                      <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Premium Cart Sidebar */}
      <div className="w-full lg:w-[400px] xl:w-[440px] bg-white/70 dark:bg-dark-800/70 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/50 dark:border-white/5 flex flex-col flex-shrink-0 min-h-0 h-full relative overflow-hidden">
        {/* Subtle inner glow */}
        <div className="absolute top-0 right-0 w-[80%] h-[20%] bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
        
        {/* Order Type Selector */}
        <div className="p-4 sm:p-5 pb-0 flex-shrink-0 z-10">
          <div className="bg-gray-100/80 dark:bg-dark-900/80 backdrop-blur-sm p-1.5 rounded-2xl flex gap-1">
            <button
              onClick={() => setOrderType('dine_in')}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 relative ${
                orderType === 'dine_in'
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {orderType === 'dine_in' && (
                <motion.div layoutId="orderType" className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-lg" />
              )}
              <UtensilsCrossed className="w-5 h-5 mb-1 relative z-10" />
              <span className="text-[10px] font-black uppercase tracking-wider relative z-10">{isRtl ? 'محلي' : 'Dine In'}</span>
            </button>
            <button
              onClick={() => setOrderType('takeaway')}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 relative ${
                orderType === 'takeaway'
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {orderType === 'takeaway' && (
                <motion.div layoutId="orderType" className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-lg" />
              )}
              <Coffee className="w-5 h-5 mb-1 relative z-10" />
              <span className="text-[10px] font-black uppercase tracking-wider relative z-10">{isRtl ? 'سفري' : 'Takeaway'}</span>
            </button>
            <button
              onClick={() => setOrderType('delivery')}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 relative ${
                orderType === 'delivery'
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {orderType === 'delivery' && (
                <motion.div layoutId="orderType" className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-lg" />
              )}
              <Truck className="w-5 h-5 mb-1 relative z-10" />
              <span className="text-[10px] font-black uppercase tracking-wider relative z-10">{isRtl ? 'توصيل' : 'Delivery'}</span>
            </button>
          </div>
        </div>

        {/* Customer & Table Inputs */}
        <div className="px-4 sm:px-5 py-4 flex-shrink-0 z-10 space-y-3">
          {orderType === 'dine_in' && (
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-500 font-bold text-gray-800 dark:text-gray-200 shadow-sm appearance-none cursor-pointer"
            >
              <option value="">{isRtl ? 'اختر الطاولة...' : 'Select Table...'}</option>
              {tables.map(t => (
                <option key={t._id} value={t._id}>
                  {isRtl ? 'طاولة' : 'Table'} {t.tableNumber} ({t.seats} {isRtl ? 'مقاعد' : 'seats'})
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-3">
            <input 
              type="text" 
              placeholder={isRtl ? 'اسم العميل (اختياري)' : 'Customer Name'} 
              className="w-full bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-500 font-medium shadow-sm transition-shadow"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
            {(orderType === 'delivery' || orderType === 'takeaway') && (
              <input 
                type="text" 
                placeholder={isRtl ? 'رقم الهاتف' : 'Phone'} 
                className="w-full bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-500 font-medium shadow-sm transition-shadow"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 space-y-3 custom-scrollbar z-10 pb-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
              <ShoppingBag className="w-16 h-16 mb-4 drop-shadow-md" />
              <span className="font-bold text-lg">{isRtl ? 'الطلب فارغ' : 'Order is empty'}</span>
              <span className="text-sm mt-1">{isRtl ? 'أضف عناصر من القائمة' : 'Add items from menu'}</span>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map(item => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={item.cartItemId} 
                  className="bg-white/80 dark:bg-dark-900/80 border border-gray-100 dark:border-dark-700/50 p-3 rounded-2xl shadow-sm flex items-center gap-3 backdrop-blur-sm group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 dark:text-white truncate text-sm">
                      {isRtl ? item.nameAr : item.nameEn}
                    </div>
                    <div className="text-xs text-amber-600 font-black mt-1">
                      SAR {item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-dark-800 p-1 rounded-xl shadow-inner border border-gray-200/50 dark:border-dark-700">
                    <button 
                      onClick={() => updateQuantity(item.cartItemId, -1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-white dark:hover:bg-dark-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors shadow-sm"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-6 text-center text-sm font-black">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.cartItemId, 1)}
                      className="w-7 h-7 flex items-center justify-center bg-white dark:bg-dark-700 rounded-lg text-gray-800 dark:text-gray-200 hover:text-amber-600 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="text-right min-w-[4rem] font-black text-gray-900 dark:text-white text-base">
                    {(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Totals & Checkout Panel */}
        <div className="p-5 bg-gradient-to-b from-gray-50/90 to-gray-100 dark:from-dark-900/90 dark:to-dark-950 backdrop-blur-xl border-t border-gray-200/50 dark:border-dark-700 flex-shrink-0 z-20">
          
          <div className="flex gap-2 mb-4 bg-gray-200/50 dark:bg-dark-800/50 p-1.5 rounded-2xl">
            {['cash', 'card'].map(pm => (
              <button
                key={pm}
                onClick={() => setPaymentMethod(pm)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                  paymentMethod === pm
                    ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {pm === 'cash' ? <Receipt className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                {pm === 'cash' ? (isRtl ? 'نقداً' : 'Cash') : (isRtl ? 'بطاقة' : 'Card')}
              </button>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm font-semibold text-gray-500 dark:text-gray-400">
              <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span>SAR {cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-gray-500 dark:text-gray-400 items-center">
              <div className="flex items-center gap-2">
                <span>{isRtl ? 'الضريبة' : 'VAT'}</span>
                <button
                  onClick={() => setApplyVat(!applyVat)}
                  className={`text-xs px-2 py-0.5 rounded-md font-bold transition-colors ${applyVat ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-gray-200 text-gray-500 dark:bg-dark-700'}`}
                >
                  {applyVat ? '15%' : '0%'}
                </button>
              </div>
              <span>SAR {cartTax.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-end pt-3 border-t border-gray-200/80 dark:border-dark-700/80 mb-5">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{isRtl ? 'الإجمالي' : 'Total'}</span>
            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500">
              SAR {cartTotal.toFixed(2)}
            </span>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleSendToKitchen}
              disabled={cart.length === 0 || isProcessing}
              className="flex-1 bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white py-4 px-2 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                <>
                  <UtensilsCrossed className="w-5 h-5" />
                  {isRtl ? 'مطبخ' : 'Kitchen'}
                </>
              )}
            </button>
            
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="flex-[2] bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-4 px-2 rounded-2xl font-black text-base lg:text-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transform hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              {isProcessing ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" /> : (
                <div className="flex items-center gap-2 relative z-10">
                  {isRtl ? 'دفع' : 'Checkout'}
                  <Sparkles className="w-5 h-5 opacity-80" />
                </div>
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
                    SAR {(selectedHalfPlateItem.halfPlatePrice || 0).toFixed(2)}
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
                    SAR {(selectedHalfPlateItem.sellingPrice || 0).toFixed(2)}
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

      {/* Print Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:bg-white print:static print:inset-auto p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-[400px] max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-xl font-black">{isRtl ? 'إيصال الطلب' : 'Order Receipt'}</h3>
              <button onClick={handleCloseReceipt} className="text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors">
                <Minus className="w-5 h-5" />
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-2xl p-2 print:border-none print:p-0 flex justify-center bg-gray-50">
              {receiptType === 'kitchen' ? (
                <KitchenTicket ref={kitchenRef} order={completedOrder} isUpdated={!!editOrderId} />
              ) : (
                <OrderReceipt ref={receiptRef} order={completedOrder} isUpdated={!!editOrderId} />
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
              <button onClick={handleCloseReceipt} className="flex-1 min-w-[120px] py-3.5 rounded-xl border-2 border-gray-200 font-black text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:hover:bg-dark-700 transition-colors">
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
              {receiptType === 'customer' && (
                <button
                  onClick={() => { setReceiptType('kitchen'); setTimeout(() => window.print(), 300) }}
                  className="flex-1 min-w-[120px] py-3.5 rounded-xl border-2 border-indigo-200 text-indigo-600 font-black hover:bg-indigo-50 transition-colors"
                >
                  {isRtl ? 'للمطبخ' : 'Print Kitchen'}
                </button>
              )}
              {receiptType === 'kitchen' && (
                <button
                  onClick={() => { setReceiptType('customer'); setTimeout(() => window.print(), 300) }}
                  className="flex-1 min-w-[120px] py-3.5 rounded-xl border-2 border-amber-200 text-amber-600 font-black hover:bg-amber-50 transition-colors"
                >
                  {isRtl ? 'الفاتورة' : 'Print Receipt'}
                </button>
              )}
              <button onClick={handlePrint} className="w-full py-4 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white font-black hover:from-gray-900 hover:to-black shadow-lg transition-all transform hover:-translate-y-0.5">
                {isRtl ? 'طباعة' : 'Print'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CardPaymentModal
        open={showCardModal}
        amount={cartTotal}
        currency="SAR"
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

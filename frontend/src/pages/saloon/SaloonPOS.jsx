import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Scissors, CheckCircle, Package, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import SarIcon from '../../components/ui/SarIcon'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import CardPaymentModal from '../../components/pos/CardPaymentModal'
import { printThermalElement, getThermalPrinterSettings } from '../../lib/thermalPrinter'

export default function SaloonPOS() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const isRtl = language === 'ar'
  const cardTerminalEnabled = Boolean(tenant?.settings?.posTerminal?.enabled)
  const terminalLabel = tenant?.settings?.posTerminal?.terminalLabel || ''
  const [showCardModal, setShowCardModal] = useState(false)
  const [pendingCardOrder, setPendingCardOrder] = useState(null)
  const queryClient = useQueryClient()
  const receiptRef = useRef(null)
  
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [globalStaff, setGlobalStaff] = useState('')
  const [applyVat, setApplyVat] = useState(true)
  const [printedOrder, setPrintedOrder] = useState(null)
  
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['saloon-services-active'],
    queryFn: () => api.get('/saloon/services?isActive=true').then(res => res.data)
  })

  const { data: staffList = [] } = useQuery({
    queryKey: ['saloon-staff'],
    queryFn: () => api.get('/saloon/staff').then(res => res.data)
  })

  const createStaffMutation = useMutation({
    mutationFn: (payload) => api.post('/saloon/staff', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['saloon-staff'])
      toast.success(isRtl ? 'تم إضافة الحلاق بنجاح' : 'Barber added successfully')
      setShowAddStaff(false)
      setNewStaffName('')
    }
  })
  
  const filteredServices = services.filter(s => 
    (s.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.nameAr?.includes(searchTerm))
  )

  const addToCart = (service) => {
    setCart(prev => {
      const existing = prev.find(item => item.serviceId === service._id)
      if (existing) {
        return prev.map(item => item.serviceId === service._id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        serviceId: service._id,
        nameEn: service.nameEn,
        nameAr: service.nameAr,
        unitPrice: service.price,
        taxRate: service.taxRate,
        quantity: 1,
        staff: ''
      }]
    })
  }

  const updateQuantity = (serviceId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.serviceId === serviceId) {
        const newQ = item.quantity + delta
        if (newQ < 1) return null
        return { ...item, quantity: newQ }
      }
      return item
    }).filter(Boolean))
  }

  const removeFromCart = (serviceId) => {
    setCart(prev => prev.filter(item => item.serviceId !== serviceId))
  }
  
  const updateStaff = (serviceId, staffName) => {
    setCart(prev => prev.map(item => item.serviceId === serviceId ? { ...item, staff: staffName } : item))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  const totalTax = applyVat ? cart.reduce((sum, item) => sum + ((item.unitPrice * item.quantity) * (item.taxRate / 100)), 0) : 0
  const grandTotal = subtotal + totalTax

  const checkoutMutation = useMutation({
    mutationFn: (payload) => api.post('/saloon/orders/checkout', payload),
    onSuccess: (res) => {
      toast.success(isRtl ? 'تم إصدار التذكرة بنجاح' : 'Ticket issued successfully')
      setPrintedOrder(res?.data)
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setGlobalStaff('')
      queryClient.invalidateQueries(['saloon-kanban'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Checkout failed')
    }
  })

  const submitCheckout = (paymentMethod) => {
    const amountPaid = paymentMethod === 'none' ? 0 : grandTotal

    const finalCart = cart.map(item => ({
      ...item,
      staff: item.staff || globalStaff,
      taxRate: applyVat ? item.taxRate : 0
    }))

    checkoutMutation.mutate({
      items: finalCart,
      customerName,
      customerPhone,
      paymentMethod,
      amountPaid
    })
  }

  const handleCheckout = (paymentMethod) => {
    if (cart.length === 0) {
      toast.error(isRtl ? 'السلة فارغة' : 'Cart is empty')
      return
    }

    if (paymentMethod === 'card' && cardTerminalEnabled) {
      checkoutMutation.mutate(
        { items: cart, customerName, customerPhone, paymentMethod: 'pending_card', amountPaid: 0 },
        {
          onSuccess: (res) => {
            setPendingCardOrder(res?.data)
            setShowCardModal(true)
          },
        }
      )
      return
    }

    submitCheckout(paymentMethod)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Services Grid */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`} />
            <input
              type="text"
              placeholder={isRtl ? 'البحث عن خدمات الحلاقة...' : 'Search saloon services...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full bg-gray-50 dark:bg-dark-700 border-none rounded-xl h-12 focus:ring-2 focus:ring-amber-500/20 ${isRtl ? 'pr-10' : 'pl-10'}`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredServices.map(service => (
              <motion.button
                key={service._id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => addToCart(service)}
                className="card overflow-hidden group text-left relative flex flex-col h-48 border-2 border-transparent hover:border-amber-500 transition-colors"
              >
                <div className="h-28 bg-gray-100 dark:bg-dark-700 relative overflow-hidden">
                  {service.imageUrl ? (
                    <img src={service.imageUrl.startsWith('http') ? service.imageUrl : api.defaults.baseURL.replace('/api', '') + service.imageUrl} alt={service.nameEn} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Scissors className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                </div>
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                    {isRtl ? service.nameAr : service.nameEn}
                  </h3>
                  <div className="flex justify-between items-center mt-2">
                    <p className="font-bold text-amber-600 dark:text-amber-500 text-sm flex items-center gap-1">
                      {service.price} <SarIcon className="w-3 h-3" />
                    </p>
                    <span className="text-[10px] text-gray-400">{service.durationMinutes}m</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Panel */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 h-full">
        <div className="p-4 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50">
          <h2 className="font-bold text-lg mb-3">{isRtl ? 'التذكرة الحالية' : 'Current Ticket'}</h2>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder={isRtl ? 'اسم العميل (اختياري)' : 'Customer Name (Optional)'}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input text-sm"
            />
            <div className="flex items-center gap-2">
              <select
                value={globalStaff}
                onChange={(e) => setGlobalStaff(e.target.value)}
                className="input text-sm flex-1"
              >
                <option value="">{isRtl ? 'تعيين حلاق (اختياري)' : 'Assign Barber (Optional)'}</option>
                {staffList.map(s => (
                  <option key={s._id} value={s.nameEn}>{isRtl && s.nameAr ? s.nameAr : s.nameEn}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowAddStaff(true)}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600 rounded-lg text-gray-600 dark:text-gray-300 transition-colors shrink-0"
                title={isRtl ? 'إضافة حلاق جديد' : 'Add new barber'}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <Package className="w-12 h-12 text-gray-300" />
                <p>{isRtl ? 'لم يتم تحديد خدمات' : 'No services selected'}</p>
              </div>
            ) : (
              cart.map((item) => (
                <motion.div
                  key={item.serviceId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-3 bg-gray-50 dark:bg-dark-700/50 rounded-xl border border-gray-100 dark:border-dark-600"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 pr-2">
                      <h4 className="font-medium text-sm">{isRtl ? item.nameAr : item.nameEn}</h4>
                      <p className="text-amber-600 text-sm font-bold flex items-center gap-1">
                        {item.unitPrice} <SarIcon className="w-3 h-3" />
                      </p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.serviceId)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <select
                      value={item.staff}
                      onChange={(e) => updateStaff(item.serviceId, e.target.value)}
                      className="input py-1 px-2 text-xs flex-1 min-w-0"
                    >
                      <option value="">{isRtl ? 'حلاق' : 'Barber'}</option>
                      {staffList.map(s => (
                        <option key={s._id} value={s.nameEn}>{isRtl && s.nameAr ? s.nameAr : s.nameEn}</option>
                      ))}
                    </select>
                    
                    <div className="flex items-center bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-600">
                      <button onClick={() => updateQuantity(item.serviceId, -1)} className="p-1.5 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-l-lg">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.serviceId, 1)} className="p-1.5 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-r-lg">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800">
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span className="flex items-center gap-1">{subtotal.toFixed(2)} <SarIcon className="w-3 h-3" /></span>
            </div>
            <div className="flex justify-between items-center text-gray-500">
              <div className="flex items-center gap-2">
                <span>{isRtl ? 'الضريبة' : 'VAT'}</span>
                <button
                  onClick={() => setApplyVat(!applyVat)}
                  className={`text-xs px-2 py-0.5 rounded border ${applyVat ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:border-amber-500/30' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-dark-700'}`}
                >
                  {applyVat ? '15%' : '0%'}
                </button>
              </div>
              <span className="flex items-center gap-1">{totalTax.toFixed(2)} <SarIcon className="w-3 h-3" /></span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100 dark:border-dark-700">
              <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
              <span className="text-amber-600 flex items-center gap-1">
                {grandTotal.toFixed(2)} <SarIcon className="w-4 h-4" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button 
              onClick={() => handleCheckout('none')}
              disabled={checkoutMutation.isPending || cart.length === 0}
              className="btn bg-amber-500 hover:bg-amber-600 text-white flex flex-col items-center justify-center gap-1 py-4 h-auto"
            >
              <CheckCircle className="w-6 h-6" />
              <span className="text-base font-medium">{isRtl ? 'إنشاء الطلب' : 'Create Order'}</span>
            </button>
          </div>
        </div>
      </div>

      <CardPaymentModal
        open={showCardModal}
        amount={grandTotal}
        currency="SAR"
        source="saloon"
        orderType="saloon"
        orderNumber={pendingCardOrder?.orderNumber || ''}
        terminalLabel={terminalLabel}
        onApproved={async (posPayment) => {
          try {
            if (pendingCardOrder?._id) {
              await api.patch(`/saloon/orders/${pendingCardOrder._id}/payment`, {
                paymentMethod: 'card',
                posPaymentId: posPayment._id,
                status: 'paid',
              })
            }
          } catch {
          }
          setShowCardModal(false)
          setPendingCardOrder(null)
          setCart([])
          setCustomerName('')
          setCustomerPhone('')
          queryClient.invalidateQueries(['saloon-kanban'])
          toast.success(isRtl ? 'تمت الموافقة على الدفع بالبطاقة' : 'Card payment approved')
        }}
        onDeclined={() => { setShowCardModal(false); setPendingCardOrder(null) }}
        onFailed={() => { setShowCardModal(false); setPendingCardOrder(null) }}
        onExpired={() => { setShowCardModal(false); setPendingCardOrder(null) }}
        onClose={() => { setShowCardModal(false); setPendingCardOrder(null) }}
      />

      {/* Print Ticket Modal */}
      {printedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-sm p-8 text-center shadow-xl border border-gray-100 dark:border-dark-700 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
              {printedOrder.queueNumber ? `Q-${printedOrder.queueNumber}` : `#${printedOrder.orderNumber.split('-')[1]?.slice(-4)}`}
            </h3>
            <p className="text-gray-500 mb-8">{isRtl ? 'تم إنشاء التذكرة بنجاح' : 'Ticket created successfully.'}</p>
            <div className="flex gap-3">
              <button onClick={() => { if (receiptRef.current) printThermalElement(receiptRef.current, getThermalPrinterSettings(tenant)) }} className="btn bg-amber-500 hover:bg-amber-600 text-white flex-1 flex items-center justify-center gap-2 py-3">
                <Printer className="w-5 h-5" />
                {isRtl ? 'طباعة' : 'Print'}
              </button>
              <button onClick={() => setPrintedOrder(null)} className="btn bg-gray-100 hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-200 flex-1 py-3">
                {isRtl ? 'متابعة' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Receipt for Print Extraction */}
      <div style={{ position: 'fixed', top: -9999, left: -9999, pointerEvents: 'none', opacity: 0 }}>
        {printedOrder && <ThermalReceipt ref={receiptRef} order={printedOrder} type="saloon" />}
      </div>

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-sm p-6 shadow-xl border border-gray-100 dark:border-dark-700">
            <h3 className="text-xl font-bold mb-4">{isRtl ? 'إضافة حلاق جديد' : 'Add New Barber'}</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={isRtl ? 'اسم الحلاق' : 'Barber Name'}
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newStaffName) {
                    createStaffMutation.mutate({ nameEn: newStaffName })
                  }
                }}
              />
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => createStaffMutation.mutate({ nameEn: newStaffName })}
                  disabled={!newStaffName || createStaffMutation.isPending}
                  className="btn bg-amber-500 hover:bg-amber-600 text-white flex-1"
                >
                  {createStaffMutation.isPending ? '...' : (isRtl ? 'إضافة' : 'Add')}
                </button>
                <button 
                  onClick={() => { setShowAddStaff(false); setNewStaffName('') }}
                  className="btn bg-gray-100 hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-200 flex-1"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

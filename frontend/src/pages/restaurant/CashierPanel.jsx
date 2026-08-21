import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { Receipt, RefreshCw, CreditCard, Banknote, User, UtensilsCrossed, Truck, Coffee, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import CardPaymentModal from '../../components/pos/CardPaymentModal'
import { getThermalPrinterSettings, printThermalElement } from '../../lib/thermalPrinter'
import { CURRENCY_CODE } from '../../lib/currency'

export default function CashierPanel() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const currency = String(tenant?.settings?.currency || CURRENCY_CODE).toUpperCase()
  const { t } = useTranslation(language)
  const isRtl = language === 'ar'
  const thermalSettings = getThermalPrinterSettings(tenant)
  const cardTerminalEnabled = Boolean(tenant?.settings?.posTerminal?.enabled)
  const terminalLabel = tenant?.settings?.posTerminal?.terminalLabel || ''

  const receiptRef = useRef(null)

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [showCardModal, setShowCardModal] = useState(false)
  const [completedOrder, setCompletedOrder] = useState(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['restaurant-orders', 'open'],
    queryFn: () => api.get('/restaurant/orders', { params: { limit: 100, status: 'open' } }).then((res) => res.data),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  })

  const orders = data?.orders || []

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/restaurant/orders/${id}`, payload).then((res) => res.data),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries(['restaurant-orders', 'open'])
      toast.success(isRtl ? 'تم الدفع بنجاح' : 'Payment successful')
      setCompletedOrder(updatedOrder)
      setSelectedOrder(null)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const handleCheckout = () => {
    if (!selectedOrder) return

    if (paymentMethod === 'card' && cardTerminalEnabled) {
      setShowCardModal(true)
      return
    }

    processPayment(paymentMethod)
  }

  const processPayment = (method, posPaymentId = null) => {
    if (!selectedOrder) return
    const payload = {
      status: 'paid',
      paymentMethod: method,
      ...(posPaymentId && { posPaymentId })
    }
    updateStatusMutation.mutate({ id: selectedOrder._id, payload })
  }

  const handleCardApproved = async (posPayment) => {
    setShowCardModal(false)
    processPayment('card', posPayment._id)
  }

  const handlePrint = () => {
    if (receiptRef.current) {
      printThermalElement(receiptRef.current, thermalSettings)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isRtl ? 'لوحة الكاشير' : 'Cashier Panel'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? 'إدارة الطلبات المفتوحة والدفع' : 'Manage open orders and payments'}
          </p>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isRtl ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-gray-500">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-12 text-center text-gray-500 flex flex-col items-center">
              <Receipt className="w-12 h-12 mb-3 opacity-20" />
              {isRtl ? 'لا توجد طلبات مفتوحة' : 'No open orders'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {orders.map((o) => (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  key={o._id}
                  onClick={() => setSelectedOrder(o)}
                  className={`bg-white dark:bg-dark-800 rounded-2xl shadow-sm border-2 cursor-pointer transition-colors p-4 ${
                    selectedOrder?._id === o._id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                      : 'border-transparent hover:border-primary-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-lg text-gray-900 dark:text-white">
                        {o.orderNumber}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        {o.orderType === 'dine_in' ? (
                          <><UtensilsCrossed className="w-3 h-3"/> {isRtl ? 'محلي' : 'Dine In'} - {o.tableNumber}</>
                        ) : o.orderType === 'takeaway' ? (
                          <><Coffee className="w-3 h-3"/> {isRtl ? 'سفري' : 'Takeaway'}</>
                        ) : (
                          <><Truck className="w-3 h-3"/> {isRtl ? 'توصيل' : 'Delivery'}</>
                        )}
                      </div>
                    </div>
                    <div className="font-black text-primary-600 text-lg">
                      <Money value={o.grandTotal} />
                    </div>
                  </div>
                  
                  {o.customerName && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-dark-700 p-2 rounded-lg mt-3">
                      <User className="w-4 h-4" />
                      <span className="font-semibold">{o.customerName}</span>
                      {o.customerPhone && <span className="opacity-75">({o.customerPhone})</span>}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                    <span>{o.lineItems?.length || 0} {isRtl ? 'أصناف' : 'items'}</span>
                    <span>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm sticky top-6 overflow-hidden flex flex-col max-h-[calc(100vh-6rem)]">
            <div className="p-4 border-b border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                {isRtl ? 'تفاصيل السداد' : 'Checkout Details'}
              </h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col">
              {selectedOrder ? (
                <>
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">{isRtl ? 'الطلب' : 'Order'}</div>
                    <div className="font-bold text-xl">{selectedOrder.orderNumber}</div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900 dark:text-white mb-2">{isRtl ? 'الأصناف' : 'Items'}</div>
                    <div className="space-y-2">
                      {selectedOrder.lineItems?.map((li, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">
                            {li.quantity}x {isRtl ? (li.nameAr || li.name) : (li.name)}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            <Money value={li.lineTotal || (li.quantity * li.unitPrice)} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-6 border-t border-dashed border-gray-200 dark:border-dark-700 pt-4 space-y-2">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
                      <span><Money value={selectedOrder.subtotal} /></span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>{isRtl ? 'الضريبة' : 'VAT (15%)'}</span>
                      <span><Money value={selectedOrder.totalTax} /></span>
                    </div>
                    <div className="flex justify-between text-xl font-black text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-dark-600">
                      <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
                      <span><Money value={selectedOrder.grandTotal} /></span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-6">
                    {['cash', 'card'].map(pm => (
                      <button
                        key={pm}
                        onClick={() => setPaymentMethod(pm)}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                          paymentMethod === pm
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                            : 'border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-500 hover:border-primary-300'
                        }`}
                      >
                        {pm === 'cash' ? <Banknote className="w-5 h-5"/> : <CreditCard className="w-5 h-5"/>}
                        {pm === 'cash' ? (isRtl ? 'نقداً' : 'Cash') : (isRtl ? 'بطاقة' : 'Card')}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={updateStatusMutation.isPending}
                    className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {updateStatusMutation.isPending ? (isRtl ? 'جاري المعالجة...' : 'Processing...') : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        {isRtl ? 'سداد' : 'Pay Now'}
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-gray-400">
                  {isRtl ? 'اختر طلباً للسداد' : 'Select an order to checkout'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[400px] mx-4 max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-lg font-bold">{isRtl ? 'إيصال الطلب' : 'Order Receipt'}</h3>
              <button onClick={() => setCompletedOrder(null)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                ✕
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-2 print:border-none print:p-0 flex justify-center">
              <ThermalReceipt ref={receiptRef} order={completedOrder} type="restaurant" />
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <button onClick={() => setCompletedOrder(null)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 dark:border-dark-600 dark:hover:bg-dark-700">
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
              <button onClick={handlePrint} className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 flex items-center justify-center gap-2">
                <Printer className="w-5 h-5"/>
                {isRtl ? 'طباعة' : 'Print'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CardPaymentModal
        open={showCardModal}
        amount={selectedOrder?.grandTotal || 0}
        currency={currency}
        source="restaurant"
        orderType="restaurant"
        orderNumber={selectedOrder?.orderNumber || ''}
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

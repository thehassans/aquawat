import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { 
  Search, ClipboardList, Clock, CheckCircle, 
  DollarSign, Zap, ArrowRight, Check, Printer, 
  TrendingUp, RefreshCw, User, Calendar, Tag, ShieldAlert
} from 'lucide-react'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import { getThermalPrinterSettings, printThermalElement } from '../../lib/thermalPrinter'

export default function LaundryKanban() {
  const { language } = useSelector(state => state.ui)
  const { tenant } = useSelector(state => state.auth)
  const isRtl = language === 'ar'
  const thermalSettings = getThermalPrinterSettings(tenant)
  
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('active') // 'active' (Kanban) or 'all' (History List)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // History pagination
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotalCount, setHistoryTotalCount] = useState(0)

  // Receipt Modal
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null)
  const receiptRef = useRef(null)

  const STAGES = [
    { id: 'received', labelEn: 'Received', labelAr: 'مستلم', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30' },
    { id: 'processing', labelEn: 'Processing', labelAr: 'قيد التنفيذ', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' },
    { id: 'ready', labelEn: 'Ready', labelAr: 'جاهز للاستلام', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' },
    { id: 'out_for_delivery', labelEn: 'Delivery', labelAr: 'توصيل', color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-100 dark:border-violet-900/30' }
  ]

  useEffect(() => {
    fetchActiveOrders()
    fetchHistoryOrders()
  }, [historyPage, statusFilter])

  const fetchActiveOrders = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/laundry/orders/kanban')
      setOrders(data)
    } catch (error) {
      toast.error(isRtl ? 'فشل تحميل الطلبات النشطة' : 'Failed to load active orders')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistoryOrders = async () => {
    try {
      const url = `/laundry/orders?page=${historyPage}&limit=10${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`
      const { data } = await api.get(url)
      setHistoryOrders(data.orders || [])
      setHistoryTotalPages(data.pages || 1)
      setHistoryTotalCount(data.total || 0)
    } catch (error) {
      console.error('Failed to load order history:', error)
    }
  }

  const updateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/laundry/orders/${orderId}/status`, { status: newStatus })
      toast.success(isRtl ? 'تم تحديث حالة الطلب بنجاح' : 'Order status updated')
      fetchActiveOrders()
      fetchHistoryOrders()
    } catch (error) {
      toast.error(isRtl ? 'فشل تحديث الحالة' : 'Failed to update status')
    }
  }

  const handlePrint = () => {
    if (receiptRef.current) {
      printThermalElement(receiptRef.current, thermalSettings)
    }
  }

  // Calculate high-end metrics for the dashboard
  const activeCount = orders.length
  const readyCount = orders.filter(o => o.status === 'ready').length
  const completedCount = historyOrders.filter(o => o.status === 'delivered').length
  const totalSales = historyOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.grandTotal || 0), 0)

  const filteredHistory = historyOrders.filter(order => {
    const term = searchQuery.toLowerCase()
    return (
      order.orderNumber?.toLowerCase().includes(term) ||
      order.customerName?.toLowerCase().includes(term) ||
      order.customerPhone?.includes(term) ||
      (order.customer?.fullName && order.customer.fullName.toLowerCase().includes(term))
    )
  })

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Upper Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
        
        {/* Metric 1 */}
        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isRtl ? 'الطلبات النشطة' : 'Active Orders'}</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{activeCount}</div>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-gray-400 group-hover:scale-105 transition-transform">
            <Clock className="w-16 h-16" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isRtl ? 'جاهز للاستلام' : 'Ready for Pickup'}</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{readyCount}</div>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-gray-400 group-hover:scale-105 transition-transform">
            <CheckCircle className="w-16 h-16" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
            <ClipboardList className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isRtl ? 'الطلبات المنجزة' : 'Delivered Orders'}</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{historyTotalCount}</div>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-gray-400 group-hover:scale-105 transition-transform">
            <ClipboardList className="w-16 h-16" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isRtl ? 'المبيعات التقريبية' : 'Approx. Sales'}</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">SAR {totalSales.toFixed(2)}</div>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-gray-400 group-hover:scale-105 transition-transform">
            <DollarSign className="w-16 h-16" />
          </div>
        </div>
      </div>

      {/* Header and Toggle Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/60 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-teal-500" />
            {isRtl ? 'لوحة تحكم وإدارة الطلبات' : 'Order Management & Control'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{isRtl ? 'تتبع حالات الطلبات النشطة وسجل المعاملات بالكامل' : 'Track live laundry pipeline and transaction history'}</p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex gap-1.5 bg-gray-100 dark:bg-dark-900 p-1.5 rounded-xl self-stretch sm:self-auto">
          <button
            onClick={() => setViewMode('active')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'active'
                ? 'bg-white dark:bg-dark-800 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            {isRtl ? 'اللوحة النشطة' : 'Active Board'}
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'all'
                ? 'bg-white dark:bg-dark-800 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            {isRtl ? 'كل الطلبات والسجل' : 'All Orders History'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
            <span className="text-xs font-semibold">{isRtl ? 'جاري التحميل...' : 'Syncing data pipeline...'}</span>
          </div>
        ) : viewMode === 'active' ? (
          
          /* Active Kanban Board View */
          <div className="h-full overflow-x-auto custom-scrollbar pb-3">
            <div className="flex gap-6 min-w-max h-[calc(100vh-22rem)]">
              {STAGES.map(stage => {
                const stageOrders = orders.filter(o => o.status === stage.id)
                return (
                  <div 
                    key={stage.id} 
                    className="w-80 flex flex-col bg-gray-50/50 dark:bg-dark-900/20 rounded-2xl p-4 border border-gray-100 dark:border-dark-700/60"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-dark-700/40">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          stage.id === 'received' ? 'bg-blue-500' :
                          stage.id === 'processing' ? 'bg-amber-500' :
                          stage.id === 'ready' ? 'bg-emerald-500' : 'bg-violet-500'
                        }`}></span>
                        <h3 className="font-extrabold text-sm text-gray-800 dark:text-gray-200">
                          {isRtl ? stage.labelAr : stage.labelEn}
                        </h3>
                      </div>
                      <span className="bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 px-2 py-0.5 rounded-lg text-xs font-bold text-gray-500">
                        {stageOrders.length}
                      </span>
                    </div>

                    {/* Column Items */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                      {stageOrders.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-dark-800 rounded-xl text-gray-400 select-none">
                          <ClipboardList className="w-6 h-6 opacity-30 mb-1" />
                          <span className="text-[10px]">{isRtl ? 'لا توجد طلبات هنا' : 'No orders in this stage'}</span>
                        </div>
                      ) : (
                        stageOrders.map(order => (
                          <div 
                            key={order._id} 
                            className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/60 shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-extrabold text-xs text-gray-900 dark:text-white tracking-tight">{order.orderNumber}</span>
                              <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-teal-500" />
                                {format(new Date(order.createdAt), 'HH:mm')}
                              </span>
                            </div>
                            
                            <div className="space-y-2 mb-3">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate">{order.customerName || (order.customer ? order.customer.fullName : (isRtl ? 'عميل نقدي' : 'Walk-in Customer'))}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-gray-500">
                                <span className="font-medium bg-gray-50 dark:bg-dark-900 px-2 py-0.5 rounded border border-gray-100 dark:border-dark-700">
                                  {order.items?.length || 0} {isRtl ? 'قطع' : 'items'}
                                </span>
                                <span className="font-extrabold text-teal-600 dark:text-teal-400">
                                  SAR {order.grandTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Status controls and re-print receipt shortcut */}
                            <div className="flex items-center justify-between gap-2 border-t border-gray-50 dark:border-dark-700/40 pt-2.5">
                              <button 
                                onClick={() => setSelectedOrderForReceipt(order)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 dark:text-gray-400 rounded-lg transition-all"
                                title="Print Receipt"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              
                              <div className="flex-1 flex justify-end">
                                {stage.id === 'received' && (
                                  <button 
                                    onClick={() => updateStatus(order._id, 'processing')} 
                                    className="flex items-center gap-1 text-[10px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    {isRtl ? 'ابدأ العمل' : 'Start'}
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                                {stage.id === 'processing' && (
                                  <button 
                                    onClick={() => updateStatus(order._id, 'ready')} 
                                    className="flex items-center gap-1 text-[10px] font-extrabold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    <Check className="w-3 h-3" />
                                    {isRtl ? 'جاهز' : 'Ready'}
                                  </button>
                                )}
                                {stage.id === 'ready' && (
                                  <button 
                                    onClick={() => updateStatus(order._id, 'delivered')} 
                                    className="flex items-center gap-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    {isRtl ? 'تسليم' : 'Deliver'}
                                  </button>
                                )}
                                {stage.id === 'out_for_delivery' && (
                                  <button 
                                    onClick={() => updateStatus(order._id, 'delivered')} 
                                    className="flex items-center gap-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    {isRtl ? 'تم التوصيل' : 'Completed'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          
          /* Detailed Order History with Filters and Search */
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700/60 shadow-sm p-5 space-y-4 animate-in fade-in duration-200">
            
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch justify-between">
              
              <div className="relative flex-1">
                <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
                <input
                  type="text"
                  placeholder={isRtl ? "البحث برقم الفاتورة، اسم العميل، الهاتف..." : "Search by invoice #, customer name, phone..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full bg-gray-50 dark:bg-dark-900 border-none rounded-xl text-xs py-3 focus:ring-2 focus:ring-teal-500 ${isRtl ? 'pr-10' : 'pl-10'}`}
                />
              </div>

              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 whitespace-nowrap">{isRtl ? 'تصفية الحالة:' : 'Filter Status:'}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setHistoryPage(1)
                  }}
                  className="bg-gray-50 dark:bg-dark-900 border-none rounded-xl text-xs py-2 px-3 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-teal-500 font-semibold"
                >
                  <option value="all">{isRtl ? 'الكل' : 'All Orders'}</option>
                  <option value="received">{isRtl ? 'مستلم' : 'Received'}</option>
                  <option value="processing">{isRtl ? 'قيد التنفيذ' : 'Processing'}</option>
                  <option value="ready">{isRtl ? 'جاهز' : 'Ready'}</option>
                  <option value="delivered">{isRtl ? 'تم التسليم' : 'Delivered'}</option>
                  <option value="cancelled">{isRtl ? 'ملغي' : 'Cancelled'}</option>
                </select>
              </div>
            </div>

            {/* Premium Table List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-dark-700/60 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
                    <th className="py-3 px-4">{isRtl ? 'العميل' : 'Customer'}</th>
                    <th className="py-3 px-4">{isRtl ? 'تاريخ الإنشاء' : 'Date Created'}</th>
                    <th className="py-3 px-4">{isRtl ? 'العدد' : 'Items'}</th>
                    <th className="py-3 px-4 text-center">{isRtl ? 'حالة الطلب' : 'Status'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'الإجمالي' : 'Total'}</th>
                    <th className="py-3 px-4 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700/40">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        <ClipboardList className="w-10 h-10 mx-auto opacity-20 mb-2" />
                        {isRtl ? 'لا توجد فواتير مطابقة للبحث' : 'No records found matching search filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(order => (
                      <tr 
                        key={order._id} 
                        className="hover:bg-gray-50/50 dark:hover:bg-dark-900/20 transition-colors"
                      >
                        <td className="py-4 px-4 font-extrabold text-gray-900 dark:text-white">{order.orderNumber || order._id?.slice(-8)}</td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {order.customerName || (order.customer ? order.customer.fullName : (isRtl ? 'عميل نقدي' : 'Cash Customer'))}
                          </div>
                          {order.customerPhone && (
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{order.customerPhone}</div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {format(new Date(order.createdAt), 'dd MMM yyyy, HH:mm')}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-gray-50 dark:bg-dark-900 px-2 py-0.5 rounded font-bold border border-gray-100 dark:border-dark-700 text-gray-500">
                            {order.items?.length || 0} {isRtl ? 'قطع' : 'pcs'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border leading-none uppercase ${
                            order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' :
                            order.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30' :
                            order.status === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' :
                            'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'
                          }`}>
                            {isRtl 
                              ? (order.status === 'delivered' ? 'تم التسليم' : order.status === 'cancelled' ? 'ملغي' : order.status === 'ready' ? 'جاهز' : 'نشط')
                              : order.status
                            }
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-extrabold text-gray-900 dark:text-white">SAR {order.grandTotal.toFixed(2)}</td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => setSelectedOrderForReceipt(order)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 text-teal-600 dark:text-teal-400 rounded-lg transition-all"
                            title="Re-print receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {historyTotalPages > 1 && (
              <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-dark-700/60 text-xs">
                <span className="text-gray-400">
                  {isRtl 
                    ? `إجمالي السجلات: ${historyTotalCount}` 
                    : `Total Records: ${historyTotalCount}`}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-dark-900 dark:hover:bg-dark-800 text-gray-500 rounded-lg disabled:opacity-50"
                  >
                    {isRtl ? 'السابق' : 'Previous'}
                  </button>
                  <span className="px-3 py-1.5 font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-lg">
                    {historyPage} / {historyTotalPages}
                  </span>
                  <button
                    disabled={historyPage === historyTotalPages}
                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-dark-900 dark:hover:bg-dark-800 text-gray-500 rounded-lg disabled:opacity-50"
                  >
                    {isRtl ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reprint Receipt Modal */}
      {selectedOrderForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[400px] max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-base font-extrabold text-gray-900">{isRtl ? 'إيصال الطلب' : 'Order Receipt'}</h3>
              <button 
                onClick={() => setSelectedOrderForReceipt(null)} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-xl p-2 print:border-none print:p-0 flex justify-center bg-gray-50">
              <ThermalReceipt ref={receiptRef} order={selectedOrderForReceipt} type="laundry" />
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <button 
                onClick={() => setSelectedOrderForReceipt(null)} 
                className="btn btn-secondary flex-1 border border-gray-200"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
              <button 
                onClick={handlePrint} 
                className="btn btn-primary flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold border-none"
              >
                {isRtl ? 'طباعة' : 'Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

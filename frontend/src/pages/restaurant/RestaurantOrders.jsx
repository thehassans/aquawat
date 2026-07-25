import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Receipt, Edit, Printer, Utensils, History, Clock, Calendar, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import api from '../../lib/api'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

export default function RestaurantOrders() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '' })
  const [page, setPage] = useState(1)
  const [printOrder, setPrintOrder] = useState(null)
  const [receiptType, setReceiptType] = useState('customer')
  const [kitchenNote, setKitchenNote] = useState('')
  const [historyOrder, setHistoryOrder] = useState(null)
  const receiptRef = useRef(null)

  const handlePrint = () => {
    if (receiptRef.current) window.print()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-orders', page, search, filters],
    queryFn: () =>
      api
        .get('/restaurant/orders', { params: { page, limit: 25, search, ...filters } })
        .then((res) => res.data),
  })

  const orders = data?.orders || []
  const pagination = data?.pagination

  const getStatusConfig = (status) => {
    switch(status?.toLowerCase()) {
      case 'paid':
        return { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
      case 'cancelled':
        return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: <XCircle className="w-3.5 h-3.5" /> }
      case 'open':
      default:
        return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', icon: <AlertCircle className="w-3.5 h-3.5" /> }
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight">
            {language === 'ar' ? 'طلبات المطعم' : 'Restaurant Orders'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
            {language === 'ar' ? 'إدارة الطلبات والمدفوعات' : 'Manage orders and payments seamlessly'}
          </p>
        </div>
        <Link to="/app/dashboard/restaurant/orders/new" className="relative z-10 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0">
          <Plus className="w-5 h-5" />
          {language === 'ar' ? 'طلب جديد' : 'New Order'}
        </Link>
      </div>

      <div className="bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-white/50 dark:border-white/5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث برقم الطلب / الطاولة...' : 'Search by order / table...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl py-3.5 ps-11 pe-4 text-sm font-medium focus:ring-2 focus:ring-amber-500/50 outline-none transition-shadow shadow-sm"
            />
          </div>

          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters((p) => ({ ...p, status: e.target.value }))
                setPage(1)
              }}
              className="w-full sm:w-56 bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl py-3.5 px-4 text-sm font-bold focus:ring-2 focus:ring-amber-500/50 outline-none transition-shadow shadow-sm appearance-none text-gray-700 dark:text-gray-200 cursor-pointer"
            >
              <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
              <option value="open">{language === 'ar' ? 'مفتوح' : 'Open'}</option>
              <option value="paid">{language === 'ar' ? 'مدفوع' : 'Paid'}</option>
              <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
            </select>
            <div className="absolute end-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-2xl rounded-3xl shadow-lg border border-white/50 dark:border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-gray-400">
            <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <span className="font-semibold">{language === 'ar' ? 'جاري التحميل...' : 'Loading orders...'}</span>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-dark-900/50 border-b border-gray-100 dark:border-dark-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-black">
                  <th className="px-6 py-4 rounded-tl-3xl">{language === 'ar' ? 'الرقم' : 'Order No.'}</th>
                  <th className="px-6 py-4">{language === 'ar' ? 'الوقت' : 'Date & Time'}</th>
                  <th className="px-6 py-4">{language === 'ar' ? 'الطاولة' : 'Table'}</th>
                  <th className="px-6 py-4">{language === 'ar' ? 'العميل' : 'Customer'}</th>
                  <th className="px-6 py-4">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                  <th className="px-6 py-4">{t('status')}</th>
                  <th className="px-6 py-4 text-right rounded-tr-3xl">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-dark-700/50">
                <AnimatePresence>
                  {orders.map((o) => {
                    const statusUI = getStatusConfig(o.status);
                    const orderDate = new Date(o.createdAt);
                    const dateStr = orderDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = orderDate.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <motion.tr 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        key={o._id} 
                        className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 px-2.5 py-1 rounded-lg">
                            {o.orderNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" /> {dateStr}
                            </span>
                            <span className="text-xs font-semibold text-gray-500 mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-gray-400" /> {timeStr}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {o.tableNumber ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                              {o.tableNumber}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center shadow-sm">
                              <Receipt className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white text-sm">{o.customerName || 'Walk-in Customer'}</div>
                              {o.customerPhone && <div className="text-xs font-medium text-gray-500 mt-0.5">{o.customerPhone}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-gray-900 dark:text-white text-base">
                            <Money value={o.grandTotal || 0} />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${statusUI.bg} ${statusUI.color}`}>
                            {statusUI.icon}
                            <span className="text-xs font-bold uppercase tracking-wider">{o.status || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            {(o.updateHistory?.length > 0 || (o.updatedAt && o.createdAt && new Date(o.updatedAt).getTime() > new Date(o.createdAt).getTime() + 5000)) && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100/80 text-amber-700 whitespace-nowrap" title={language === 'ar' ? 'تم التحديث' : 'Updated'}>
                                <Clock className="w-3 h-3" />
                                {language === 'ar' ? 'محدث' : 'UPDATED'}
                              </span>
                            )}
                            <button
                              onClick={() => { setPrintOrder(o); setReceiptType('customer'); setKitchenNote(''); }}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-600 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors shadow-sm"
                              title={language === 'ar' ? 'طباعة إيصال' : 'Print Receipt'}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setPrintOrder(o); setReceiptType('kitchen'); setKitchenNote(''); }}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-colors shadow-sm"
                              title={language === 'ar' ? 'طباعة للمطبخ' : 'Print for Kitchen'}
                            >
                              <Utensils className="w-4 h-4" />
                            </button>
                            <Link
                              to={`/app/dashboard/restaurant/pos?orderId=${o._id}`}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-dark-600 transition-colors shadow-sm"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => setHistoryOrder(o)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors shadow-sm"
                              title={language === 'ar' ? 'سجل التحديثات' : 'Update History'}
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Receipt className="w-12 h-12 mb-3 opacity-20" />
                        <span className="font-semibold">{language === 'ar' ? 'لا توجد طلبات' : 'No orders found'}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-sm text-gray-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[400px] max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-lg font-bold">
                {receiptType === 'kitchen' 
                  ? (language === 'ar' ? 'إيصال المطبخ' : 'Kitchen Receipt')
                  : (language === 'ar' ? 'إيصال الطلب' : 'Order Receipt')}
              </h3>
              <button onClick={() => setPrintOrder(null)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">
                ×
              </button>
            </div>
             
            {receiptType === 'kitchen' && (
              <div className="mb-4 print:hidden">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'ar' ? 'ملاحظة مخصصة للمطبخ' : 'Custom Kitchen Note'}
                </label>
                <input 
                  type="text" 
                  value={kitchenNote}
                  onChange={e => setKitchenNote(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder={language === 'ar' ? 'مثال: بدون بصل' : 'e.g. No onions'}
                />
              </div>
            )}
            
            <div className="border border-gray-200 rounded-lg p-2 print:border-none print:p-0 flex justify-center">
              <ThermalReceipt
                ref={receiptRef}
                order={receiptType === 'kitchen' && kitchenNote ? { ...printOrder, kitchenNote } : printOrder}
                type="restaurant"
                isKitchen={receiptType === 'kitchen'}
                isUpdated={(printOrder.updateHistory?.length > 0 || (printOrder.updatedAt && printOrder.createdAt && new Date(printOrder.updatedAt).getTime() > new Date(printOrder.createdAt).getTime() + 5000)) && receiptType !== 'kitchen'}
              />
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <button onClick={() => setPrintOrder(null)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 text-gray-700">
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
              <button onClick={handlePrint} className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700">
                {language === 'ar' ? 'طباعة' : 'Print'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {language === 'ar' ? 'سجل التحديثات' : 'Update History'}
              </h3>
              <button onClick={() => setHistoryOrder(null)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">
                ×
              </button>
            </div>
            <div className="space-y-3">
              {historyOrder.updateHistory?.length > 0 ? (
                historyOrder.updateHistory.map((entry, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">
                        {new Date(entry.updatedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </span>
                    </div>
                    {entry.changes && (
                      <div className="text-gray-700">
                        <span className="font-medium">{language === 'ar' ? 'التغييرات:' : 'Changes:'}</span> {entry.changes}
                      </div>
                    )}
                    {entry.reason && (
                      <div className="text-gray-700 mt-1">
                        <span className="font-medium">{language === 'ar' ? 'السبب:' : 'Reason:'}</span> {entry.reason}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-6">
                  {language === 'ar' ? 'لا يوجد سجل تحديثات مسجل' : 'No update history recorded'}
                </div>
              )}
            </div>
            <div className="mt-6">
              <button onClick={() => setHistoryOrder(null)} className="w-full py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 text-gray-700">
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

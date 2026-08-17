import { useMemo, useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { getSocket } from '../../lib/socket'
import { ClipboardList, RefreshCw, Receipt, CheckCircle, Clock, Printer, X, Filter, LayoutGrid, LayoutList, Bell, Volume2, VolumeX, Zap, Maximize, FileText, Loader2, Maximize2, Minimize2, Edit, Save, Trash2, Edit2, Play, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getImageUrl } from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import { getThermalPrinterSettings, getPaperWidth, printThermalElement } from '../../lib/thermalPrinter'

function formatTime(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

export default function RestaurantKitchen() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isRtl = language === 'ar'

  const [statuses, setStatuses] = useState(['new', 'preparing', 'ready'])
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('kitchenAutoPrint') === 'true')
  const [printingIds, setPrintingIds] = useState(new Set())
  const firstLoadDoneRef = useRef(false)
  const seenOrderIdsRef = useRef(new Set())

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['restaurant-kitchen', statuses],
    queryFn: () => api.get('/restaurant/orders/kitchen', { params: { statuses: statuses.join(',') } }).then((res) => res.data),
  })

  // Listen to WebSocket for live updates instead of polling
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleUpdate = () => {
      queryClient.invalidateQueries(['restaurant-kitchen'])
    }

    socket.emit('join_room', 'kitchen')
    socket.on('new_order', handleUpdate)
    socket.on('order_updated', handleUpdate)

    return () => {
      socket.off('new_order', handleUpdate)
      socket.off('order_updated', handleUpdate)
      socket.emit('leave_room', 'kitchen')
    }
  }, [queryClient])

  const orders = data?.orders || []

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, kitchenStatus }) => api.put(`/restaurant/orders/${id}/kitchen-status`, { kitchenStatus }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurant-kitchen'])
      queryClient.invalidateQueries(['restaurant-orders'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const markPrintedMutation = useMutation({
    mutationFn: (id) => api.post(`/restaurant/orders/${id}/kitchen-ticket/printed`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurant-kitchen'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  useEffect(() => {
    localStorage.setItem('kitchenAutoPrint', autoPrint)
  }, [autoPrint])

  // Mark all orders present on the first load as "already seen" so they are not auto-printed again.
  useEffect(() => {
    if (!isLoading && !firstLoadDoneRef.current) {
      firstLoadDoneRef.current = true
      orders.forEach(o => seenOrderIdsRef.current.add(o._id))
    }
  }, [isLoading, orders])

  // Auto-print only new orders that arrive while this page is open, not orders that existed on load.
  useEffect(() => {
    if (!autoPrint) return
    const unprinted = orders.filter(o =>
      o.kitchenStatus === 'new' &&
      !o.kitchenPrintedAt &&
      !printingIds.has(o._id) &&
      !seenOrderIdsRef.current.has(o._id)
    )
    if (unprinted.length > 0) {
      unprinted.forEach(o => {
        seenOrderIdsRef.current.add(o._id)
        setPrintingIds(prev => new Set([...prev, o._id]))
        try {
          printThermalElement(buildKitchenTicketHtml(o), getThermalPrinterSettings(tenant))
          markPrintedMutation.mutate(o._id, {
            onSettled: () => {
              setPrintingIds(prev => {
                const next = new Set(prev)
                next.delete(o._id)
                return next
              })
            }
          })
        } catch (err) {
          console.error('Auto print error', err)
          setPrintingIds(prev => {
            const next = new Set(prev)
            next.delete(o._id)
            return next
          })
        }
      })
    }
  }, [orders, autoPrint, printingIds])

  const statusOptions = useMemo(
    () => [
      { key: 'new', labelEn: 'New', labelAr: 'جديد' },
      { key: 'preparing', labelEn: 'Preparing', labelAr: 'قيد التحضير' },
      { key: 'ready', labelEn: 'Ready', labelAr: 'جاهز' },
      { key: 'served', labelEn: 'Served', labelAr: 'تم التقديم' },
    ],
    []
  )

  const buildKitchenTicketHtml = (order) => {
    const isAr = language === 'ar'

    const items = (order?.lineItems || [])
      .map((li) => {
        const name = isAr ? li?.nameAr || li?.name : li?.name
        return `<tr><td style="padding:6px 0;">${String(name || '')}</td><td style="padding:6px 0;text-align:end;">${Number(li?.quantity || 0)}</td></tr>`
      })
      .join('')

    const title = isAr ? 'تذكرة المطبخ' : 'Kitchen Ticket'
    const tableLabel = isAr ? 'الطاولة' : 'Table'
    const orderLabel = isAr ? 'الطلب' : 'Order'
    const timeLabel = isAr ? 'الوقت' : 'Time'
    const typeLabel = isAr ? 'النوع' : 'Type'
    const customerLabel = isAr ? 'العميل' : 'Customer'

    const typeDisplay = {
      dine_in: isAr ? 'محلي' : 'Dine In',
      takeaway: isAr ? 'سفري' : 'Takeaway',
      delivery: isAr ? 'توصيل' : 'Delivery'
    }[order?.orderType] || order?.orderType

    const logoSrc = getImageUrl(tenant?.branding?.logoUrl || '')
    const _thermal = getThermalPrinterSettings(tenant)
    const _pw = getPaperWidth(_thermal)
    
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
@media print {
  @page { margin: 0; size: ${_pw} auto; }
  body { width: ${_pw}; margin: 0 auto; padding: 10px; }
}
body{font-family:Arial, sans-serif; margin:0; padding:14px; max-width:${_pw}; margin: 0 auto;}
.header{text-align:center; margin-bottom:12px;}
.logo{max-width:80px; max-height:80px; margin-bottom:8px; filter:grayscale(100%);}
.order-block{border:2px solid #000; padding:8px; text-align:center; margin-bottom:12px; border-radius:4px;}
.order-num{font-size:24px; font-weight:900; margin:4px 0;}
.order-label{font-size:12px; font-weight:bold; text-transform:uppercase;}
.k{font-size:18px; font-weight:900; text-align:center; margin-bottom:8px;}
.meta{font-size:12px; color:#111; margin-bottom:12px;}
.meta-grid{display:grid; grid-template-columns:1fr 1fr; gap:6px;}
table{width:100%; border-collapse:collapse; margin-top:8px;}
th{font-size:14px; text-align:start; border-bottom:1px dashed #000; padding-bottom:6px; font-weight:bold;}
td{font-size:14px; padding:8px 0; font-weight:bold; border-bottom:1px dashed #ddd;}
</style>
</head>
<body dir="${isAr ? 'rtl' : 'ltr'}">
  <div class="header">
    ${logoSrc ? `<img src="${logoSrc}" class="logo" />` : ''}
    <div class="k">${title}</div>
  </div>
  
  <div class="order-block">
    <div class="order-label">${orderLabel}</div>
    <div class="order-num">${order?.orderNumber || ''}</div>
  </div>

  <div class="meta">
    <div class="meta-grid">
      <div><strong>${typeLabel}:</strong> ${typeDisplay}</div>
      ${order?.orderType === 'dine_in' ? `<div><strong>${tableLabel}:</strong> ${order?.tableNumber || '-'}</div>` : ''}
    </div>
    <div style="margin-top:6px;"><strong>${timeLabel}:</strong> ${formatTime(order?.createdAt)}</div>
    ${order?.customerName ? `<div style="margin-top:6px;"><strong>${customerLabel}:</strong> ${order?.customerName} ${order?.customerPhone ? '(' + order?.customerPhone + ')' : ''}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>${isAr ? 'الصنف' : 'Item'}</th>
        <th style="text-align:end;">${isAr ? 'الكمية' : 'Qty'}</th>
      </tr>
    </thead>
    <tbody>
      ${items}
    </tbody>
  </table>

  <script>window.onafterprint = () => window.close && window.close();</script>
</body>
</html>`
  }

  const buildReceiptHtml = (order) => {
    const isAr = language === 'ar'

    const items = (order?.lineItems || [])
      .map((li) => {
        const name = isAr ? li?.nameAr || li?.name : li?.name
        const qty = Number(li?.quantity || 0)
        const unitPrice = Number(li?.unitPrice || 0)
        const total = qty * unitPrice
        return `<tr><td style="padding:6px 0;">${String(name || '')}</td><td style="padding:6px 0;text-align:end;">${qty}</td><td style="padding:6px 0;text-align:end;">${unitPrice.toFixed(2)}</td><td style="padding:6px 0;text-align:end;">${total.toFixed(2)}</td></tr>`
      })
      .join('')

    const title = isAr ? 'إيصال' : 'Receipt'

    const logoSrc = tenant?.branding?.logoUrl || ''
    const _thermal2 = getThermalPrinterSettings(tenant)
    const _pw2 = getPaperWidth(_thermal2)

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
@media print {
  @page { margin: 0; size: ${_pw2} auto; }
  body { width: ${_pw2}; margin: 0 auto; padding: 10px; }
}
body{font-family:Arial, sans-serif; margin:0; padding:14px; max-width:${_pw2}; margin: 0 auto;}
.header{text-align:center; margin-bottom:12px;}
.logo{max-width:80px; max-height:80px; margin-bottom:8px; filter:grayscale(100%);}
.k{font-size:18px; font-weight:700;}
.meta{font-size:12px; color:#111;}
table{width:100%; border-collapse:collapse; margin-top:12px;}
th{font-size:12px; text-align:start; border-bottom:1px solid #ddd; padding-bottom:6px;}
.tot{margin-top:10px; display:flex; justify-content:flex-end;}
.tot div{width:220px; font-size:12px;}
.row{display:flex; justify-content:space-between; padding:4px 0;}
.bold{font-weight:700;}
</style>
</head>
<body dir="${isAr ? 'rtl' : 'ltr'}">
  <div class="header">
    ${logoSrc ? `<img src="${logoSrc}" class="logo" />` : ''}
    <div class="k">${title}</div>
  </div>
  <div class="meta">
    <div>${isAr ? 'الطلب' : 'Order'}: <strong>${order?.orderNumber || ''}</strong></div>
    ${order?.orderType === 'dine_in' ? `<div>${isAr ? 'الطاولة' : 'Table'}: <strong>${order?.tableNumber || '-'}</strong></div>` : ''}
    <div>${isAr ? 'الوقت' : 'Time'}: ${formatTime(order?.createdAt)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${isAr ? 'الصنف' : 'Item'}</th>
        <th style="text-align:end;">${isAr ? 'الكمية' : 'Qty'}</th>
        <th style="text-align:end;">${isAr ? 'السعر' : 'Price'}</th>
        <th style="text-align:end;">${isAr ? 'الإجمالي' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>
      ${items}
    </tbody>
  </table>

  <div class="tot">
    <div>
      <div class="row"><span>${isAr ? 'المجموع' : 'Subtotal'}</span><span>${Number(order?.subtotal || 0).toFixed(2)}</span></div>
      <div class="row"><span>${isAr ? 'الضريبة' : 'Tax'}</span><span>${Number(order?.totalTax || 0).toFixed(2)}</span></div>
      <div class="row bold"><span>${isAr ? 'الإجمالي' : 'Total'}</span><span>${Number(order?.grandTotal || 0).toFixed(2)}</span></div>
    </div>
  </div>

  <script>window.onafterprint = () => window.close && window.close();</script>
</body>
</html>`
  }

  const statusLabel = (s) => {
    const found = statusOptions.find((x) => x.key === s)
    if (!found) return s || '-'
    return language === 'ar' ? found.labelAr : found.labelEn
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'شاشة المطبخ' : 'Kitchen Screen'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{language === 'ar' ? 'إدارة تجهيز الطلبات' : 'Manage order preparation'}</p>
        </div>

        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={() => setAutoPrint(!autoPrint)} 
            className={`btn ${autoPrint ? 'btn-primary' : 'btn-secondary'} hidden sm:flex`}
          >
            <Printer className="w-4 h-4" />
            {isRtl ? 'طباعة تلقائية' : 'Auto Print'}
          </button>
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {language === 'ar' ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="text-sm text-gray-500 mb-2">{language === 'ar' ? 'الحالات' : 'Statuses'}</div>
            <div className="flex flex-wrap gap-2">
              {['new', 'preparing', 'ready'].map((s) => {
                const active = statuses.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : prev.concat(s)))
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                      active
                        ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                        : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {statusLabel(s)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sm:w-64">
            <div className="text-sm text-gray-500 mb-2">{language === 'ar' ? 'عدد الطلبات' : 'Orders'}</div>
            <div className="text-2xl font-bold">{orders.length}</div>
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'الطلب' : 'Order'}</th>
                  <th>{language === 'ar' ? 'النوع/العميل' : 'Type/Customer'}</th>
                  <th>{language === 'ar' ? 'الطاولة' : 'Table'}</th>
                  <th>{language === 'ar' ? 'الوقت' : 'Time'}</th>
                  <th>{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th>{language === 'ar' ? 'المجموع' : 'Total'}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id}>
                    <td className="font-mono text-sm">{o.orderNumber}</td>
                    <td>
                      <div className="font-semibold capitalize text-sm">
                        {o.orderType === 'dine_in' ? (language === 'ar' ? 'محلي' : 'Dine In') : 
                         o.orderType === 'takeaway' ? (language === 'ar' ? 'سفري' : 'Takeaway') : 
                         (language === 'ar' ? 'توصيل' : 'Delivery')}
                      </div>
                      {o.customerName && <div className="text-xs text-gray-500 mt-1">{o.customerName}</div>}
                      {o.customerPhone && <div className="text-xs text-gray-500">{o.customerPhone}</div>}
                    </td>
                    <td>{o.orderType === 'dine_in' ? o.tableNumber || '-' : '-'}</td>
                    <td className="text-gray-500">{formatTime(o.createdAt)}</td>
                    <td>
                      <span className="badge badge-neutral capitalize inline-flex items-center gap-1">
                        {o.kitchenStatus === 'ready' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {statusLabel(o.kitchenStatus)}
                      </span>
                    </td>
                    <td className="font-semibold">
                      <Money value={o.grandTotal || 0} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            try {
                              printThermalElement(buildKitchenTicketHtml(o), getThermalPrinterSettings(tenant))
                              markPrintedMutation.mutate(o._id)
                            } catch {
                              toast.error(language === 'ar' ? 'فشل الطباعة' : 'Print failed')
                            }
                          }}
                        >
                          <Receipt className="w-4 h-4" />
                          {language === 'ar' ? 'تذكرة' : 'Ticket'}
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            try {
                              printThermalElement(buildReceiptHtml(o), getThermalPrinterSettings(tenant))
                            } catch {
                              toast.error(language === 'ar' ? 'فشل الطباعة' : 'Print failed')
                            }
                          }}
                        >
                          <Receipt className="w-4 h-4" />
                          {language === 'ar' ? 'إيصال' : 'Receipt'}
                        </button>

                        {o.kitchenStatus !== 'preparing' && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => updateStatusMutation.mutate({ id: o._id, kitchenStatus: 'preparing' })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <ClipboardList className="w-4 h-4" />
                            {language === 'ar' ? 'تحضير' : 'Preparing'}
                          </button>
                        )}

                        {o.kitchenStatus !== 'ready' && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => updateStatusMutation.mutate({ id: o._id, kitchenStatus: 'ready' })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4" />
                            {language === 'ar' ? 'جاهز' : 'Ready'}
                          </button>
                        )}

                        {o.kitchenStatus !== 'served' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => updateStatusMutation.mutate({ id: o._id, kitchenStatus: 'served' })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4" />
                            {language === 'ar' ? 'تم' : 'Served'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      {language === 'ar' ? 'لا توجد طلبات في المطبخ' : 'No kitchen orders'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}

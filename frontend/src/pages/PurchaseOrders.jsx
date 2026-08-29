import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus,
  Search,
  Edit,
  Printer,
  Download,
  Loader2,
  ShoppingCart,
  PackageCheck,
  CircleDot,
  Wallet,
  MessageCircle,
  Mail,
  Send,
  X,
  Eye,
  CreditCard,
} from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import PartnerCombobox from '../components/inventory/PartnerCombobox'
import ExportMenu from '../components/ui/ExportMenu'
import { downloadPurchaseOrderPdf, printPurchaseOrderPdf } from '../lib/invoicePdfActions'
import RecordPoPaymentModal from '../components/purchases/RecordPoPaymentModal'
import toast from 'react-hot-toast'

const STATUS_PILL = {
  billed: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  refunded: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  partially_received: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  approved: 'bg-teal-50 text-teal-800 ring-teal-200/80 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20',
  sent: 'bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
}

const PAYMENT_STATUS_PILL = {
  pending: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
}

const STATUS_KEYS = ['draft', 'sent', 'approved', 'partially_received', 'received', 'refunded', 'billed', 'cancelled']

export default function PurchaseOrders() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ status: '', supplierId: '', warehouseId: '' })
  const [filterSupplier, setFilterSupplier] = useState(null)
  const [pdfBusyId, setPdfBusyId] = useState(null)
  const [whatsAppModalPo, setWhatsAppModalPo] = useState(null)
  const [emailModalPo, setEmailModalPo] = useState(null)
  const [whatsAppPhone, setWhatsAppPhone] = useState('')
  const [whatsAppText, setWhatsAppText] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [selectedPoForPayment, setSelectedPoForPayment] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => clearTimeout(h)
  }, [search])

  const generatePoShareText = (po) => {
    if (!po) return ''
    const tenantName = tenant?.business?.legalNameEn || tenant?.name || 'Company'
    const suppName = supplierName(po.supplierId)
    const items = (po.lineItems || [])
      .map((li, idx) => {
        const pName = li.productId?.nameEn || li.productId?.nameAr || li.manualName || li.description || `Item ${idx + 1}`
        const qty = Number(li.quantityOrdered || 0)
        const unit = Number(li.unitCost || 0)
        return `• ${pName}: ${qty} ${li.uom || 'PCE'} x ${unit} = ${(qty * unit).toFixed(2)} SAR`
      })
      .join('\n')

    return (
      `*طلب شراء / PURCHASE ORDER*\n` +
      `🏢 *${tenantName}*\n\n` +
      `📄 رقم الطلب / PO Number: *${po.poNumber || ''}*\n` +
      `👤 المورد / Supplier: *${suppName}*\n` +
      `📅 التاريخ / Date: *${po.orderDate ? new Date(po.orderDate).toLocaleDateString() : ''}*\n\n` +
      (items ? `*البنود / Items:*\n${items}\n\n` : '') +
      `⭐ *الإجمالي / Total: ${Number(po.grandTotal || 0).toFixed(2)} SAR*\n\n` +
      `شكراً لتعاملكم معنا / Thank you for your business.`
    )
  }

  const openWhatsAppModal = async (po) => {
    let full = po
    if (!po.lineItems || !po.supplierId?.phone) {
      try {
        full = await fetchFullOrder(po)
      } catch (e) {
        console.error(e)
      }
    }
    const phone = full?.supplierId?.phone || full?.supplierId?.mobile || ''
    setWhatsAppPhone(phone)
    setWhatsAppText(generatePoShareText(full))
    setWhatsAppModalPo(full)
  }

  const sendWhatsApp = () => {
    const cleanPhone = whatsAppPhone.replace(/[^0-9]/g, '')
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsAppText)}`
    window.open(url, '_blank')
    setWhatsAppModalPo(null)
    toast.success(language === 'ar' ? 'تم فتح تطبيق واتساب' : 'Opening WhatsApp')
  }

  const openEmailModal = async (po) => {
    let full = po
    if (!po.lineItems || !po.supplierId?.email) {
      try {
        full = await fetchFullOrder(po)
      } catch (e) {
        console.error(e)
      }
    }
    const email = full?.supplierId?.email || ''
    const tenantName = tenant?.business?.legalNameEn || tenant?.name || 'Company'
    setEmailTo(email)
    setEmailSubject(`[Purchase Order ${full?.poNumber || ''}] from ${tenantName}`)
    setEmailBody(generatePoShareText(full))
    setEmailModalPo(full)
  }

  const sendEmail = () => {
    if (!emailTo) {
      toast.error(language === 'ar' ? 'أدخل البريد الإلكتروني للمورد' : 'Please enter supplier email')
      return
    }
    const mailto = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    window.location.href = mailto
    setEmailModalPo(null)
    toast.success(language === 'ar' ? 'تم فتح برنامج البريد' : 'Opening email')
  }

  const statusLabel = (status) => {
    const ar = {
      draft: 'مسودة',
      sent: 'مرسل',
      approved: 'معتمد',
      partially_received: 'مستلم جزئياً',
      received: 'مستلم',
      refunded: 'مسترد',
      billed: 'مفوتر',
      cancelled: 'ملغي',
    }
    if (language === 'ar') return ar[status] || status
    if (status === 'partially_received') return 'Partially received'
    if (status === 'refunded') return 'Refunded'
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : status
  }

  const paymentStatusLabel = (status) => {
    const ar = { pending: 'قيد الانتظار', partial: 'مدفوع جزئياً', paid: 'مدفوع', overdue: 'متأخر' }
    return language === 'ar' ? (ar[status] || status) : (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending')
  }

  const supplierName = (s) => {
    if (!s) return '—'
    return language === 'ar' ? s.nameAr || s.nameEn || s.code : s.nameEn || s.nameAr || s.code
  }

  const formatDay = (value) => {
    if (!value) return '—'
    return new Date(value).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const exportColumns = [
    { key: 'poNumber', label: language === 'ar' ? 'رقم الطلب' : 'PO Number', value: (r) => r?.poNumber || '' },
    { key: 'supplier', label: language === 'ar' ? 'المورد' : 'Supplier', value: (r) => supplierName(r?.supplierId) },
    {
      key: 'orderDate',
      label: language === 'ar' ? 'تاريخ الطلب' : 'Order Date',
      value: (r) => (r?.orderDate ? new Date(r.orderDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''),
    },
    { key: 'status', label: t('status'), value: (r) => r?.status || '' },
    { key: 'paymentStatus', label: language === 'ar' ? 'حالة الدفع' : 'Payment', value: (r) => r?.paymentStatus || 'pending' },
    { key: 'balanceDue', label: language === 'ar' ? 'المتبقي' : 'Balance', value: (r) => r?.balanceDue ?? '' },
    { key: 'grandTotal', label: t('total'), value: (r) => r?.grandTotal ?? '' },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []
    while (true) {
      const res = await api.get('/purchase-orders', {
            params: { page: currentPage, limit, flow: 'purchase', search: debouncedSearch, status: filters.status, supplierId: filters.supplierId, warehouseId: filters.warehouseId },
      })
      const batch = res.data?.purchaseOrders || []
      all = all.concat(batch)
      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages || all.length >= 10000) break
      currentPage += 1
    }
    return all
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['purchase-orders', 'purchase', page, debouncedSearch, filters],
    queryFn: () =>
      api
        .get('/purchase-orders', {
          params: { page, limit: 25, flow: 'purchase', search: debouncedSearch, status: filters.status, supplierId: filters.supplierId, warehouseId: filters.warehouseId },
        })
        .then((res) => res.data),
    placeholderData: (prev) => prev,
  })

  const { data: stats } = useQuery({
    queryKey: ['purchase-orders-stats', 'purchase'],
    queryFn: () => api.get('/purchase-orders/stats', { params: { flow: 'purchase' } }).then((res) => res.data),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      try {
        const res = await api.get('/warehouses')
        return Array.isArray(res.data) ? res.data : []
      } catch {
        return []
      }
    },
  })

  const totals = stats?.totals?.[0]
  const totalOrders = totals?.count || 0
  const openOrders = totals?.openCount || 0
  const totalValue = totals?.totalValue || 0
  const receivedCount = stats?.byStatus?.find((x) => x._id === 'received')?.count || 0
  const statusCounts = useMemo(() => {
    const map = Object.fromEntries((stats?.byStatus || []).map((row) => [row._id, row.count]))
    return map
  }, [stats?.byStatus])

  const orders = data?.purchaseOrders || []
  const pagination = data?.pagination

  const fetchFullOrder = async (po) => {
    const res = await api.get(`/purchase-orders/${po._id}`)
    const payload = res?.data
    const order = payload?.purchaseOrder || payload?.order || payload
    if (!order?._id && !order?.poNumber) throw new Error('Purchase order not found')
    return order
  }

  const handleDownloadPdf = async (po) => {
    const toastId = toast.loading(language === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...')
    setPdfBusyId(`${po._id}:download`)
    try {
      const full = await fetchFullOrder(po)
      await downloadPurchaseOrderPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'تم تنزيل ملف PDF' : 'PDF downloaded', { id: toastId })
    } catch (error) {
      console.error('[PurchaseOrders] PDF download failed', error)
      toast.error(error?.response?.data?.error || error?.message || (language === 'ar' ? 'فشل التنزيل' : 'Download failed'), { id: toastId })
    } finally {
      setPdfBusyId(null)
    }
  }

  const handlePrintPdf = async (po) => {
    const toastId = toast.loading(language === 'ar' ? 'جاري التحضير للطباعة...' : 'Preparing print...')
    setPdfBusyId(`${po._id}:print`)
    try {
      const full = await fetchFullOrder(po)
      await printPurchaseOrderPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'جاهز للطباعة' : 'Ready to print', { id: toastId })
    } catch (error) {
      console.error('[PurchaseOrders] PDF print failed', error)
      toast.error(language === 'ar' ? 'فشل الطباعة' : 'Print failed', { id: toastId })
    } finally {
      setPdfBusyId(null)
    }
  }

  const setStatusFilter = (status) => {
    setFilters((f) => ({ ...f, status: f.status === status ? '' : status }))
    setPage(1)
  }

  const shell =
    'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
  const ghostBtn =
    'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {language === 'ar' ? 'طلبات الشراء' : 'Purchase orders'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'أصدر، اعتمد، اطبع، واستلم أوامر الشراء'
              : 'Issue, approve, print, and receive purchase orders'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={orders}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'طلبات_الشراء' : 'PurchaseOrders'}
            title={language === 'ar' ? 'طلبات الشراء' : 'Purchase Orders'}
            disabled={isLoading || orders.length === 0}
          />
          <Link
            to="/app/dashboard/purchases/orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 opacity-80" />
            {language === 'ar' ? 'طلب شراء جديد' : 'New purchase order'}
          </Link>
        </div>
      </div>

      <div className={shell}>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 dark:bg-white/[0.08]">
          {[
            {
              label: language === 'ar' ? 'الإجمالي' : 'Total',
              value: totalOrders,
              icon: ShoppingCart,
              onClick: () => setStatusFilter(''),
              active: !filters.status,
            },
            {
              label: language === 'ar' ? 'مفتوحة' : 'Open',
              value: openOrders,
              icon: CircleDot,
              onClick: () => setFilters((f) => ({ ...f, status: '' })),
            },
            {
              label: language === 'ar' ? 'القيمة' : 'Committed value',
              value: <Money value={totalValue} />,
              icon: Wallet,
            },
            {
              label: language === 'ar' ? 'مستلمة' : 'Received',
              value: receivedCount,
              icon: PackageCheck,
              accent: true,
              onClick: () => setStatusFilter('received'),
              active: filters.status === 'received',
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              disabled={!item.onClick}
              className={`bg-white px-4 py-4 text-start transition sm:px-5 sm:py-5 dark:bg-[#0c111a] ${
                item.onClick ? 'hover:bg-slate-50 dark:hover:bg-white/[0.03]' : 'cursor-default'
              } ${item.active ? 'ring-1 ring-inset ring-teal-600/20' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {item.label}
                </p>
                <item.icon className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              </div>
              <p
                className={`mt-2 text-[22px] font-semibold tabular-nums tracking-tight ${
                  item.accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-950 dark:text-white'
                }`}
              >
                {item.value}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className={`${shell} p-4 sm:p-5`}>
        <div className="flex flex-wrap gap-1.5 pb-4">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-inset transition ${
              !filters.status
                ? 'bg-slate-950 text-white ring-slate-950 dark:bg-white dark:text-slate-950 dark:ring-white'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300 dark:ring-white/10'
            }`}
          >
            {language === 'ar' ? 'الكل' : 'All'} · {totalOrders}
          </button>
          {STATUS_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-inset transition ${
                filters.status === key
                  ? STATUS_PILL[key]
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300 dark:ring-white/10'
              }`}
            >
              {statusLabel(key)}
              {statusCounts[key] != null ? ` · ${statusCounts[key]}` : ''}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث برقم الطلب أو المورد...' : 'Search PO number or supplier...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="input ps-10"
            />
          </div>
          <div className="w-full lg:w-72">
            <PartnerCombobox
              role="vendor"
              value={filters.supplierId}
              selectedOption={filterSupplier}
              ar={language === 'ar'}
              language={language}
              placeholder={language === 'ar' ? 'كل الموردين / ابحث…' : 'All suppliers / search…'}
              onChange={(id, opt) => {
                setFilters((f) => ({ ...f, supplierId: id || '' }))
                setFilterSupplier(opt || null)
                setPage(1)
              }}
            />
          </div>
          <select
            value={filters.warehouseId}
            onChange={(e) => {
              setFilters((f) => ({ ...f, warehouseId: e.target.value }))
              setPage(1)
            }}
            className="select w-full lg:w-64"
          >
            <option value="">{language === 'ar' ? 'كل المستودعات' : 'All warehouses'}</option>
            {(warehouses || []).map((w) => (
              <option key={w._id} value={w._id}>
                {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
              </option>
            ))}
          </select>
          {isFetching && !isLoading && (
            <span className="inline-flex items-center gap-1.5 self-center text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {language === 'ar' ? 'تحديث...' : 'Updating'}
            </span>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={shell}>
        {isLoading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-600 dark:border-t-white" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/[0.04]">
              <ShoppingCart className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'لا توجد طلبات شراء' : 'No purchase orders yet'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-400">
              {language === 'ar'
                ? 'أنشئ أول أمر شراء للمورد وابدأ الاستلام إلى المخزون.'
                : 'Create the first supplier order and start receiving into stock.'}
            </p>
            <Link
              to="/app/dashboard/purchases/orders/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-medium text-white dark:bg-white dark:text-slate-950"
            >
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'طلب شراء جديد' : 'New purchase order'}
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.08]">
                  <th className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {language === 'ar' ? 'رقم الطلب' : 'PO'}
                  </th>
                  <th className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {language === 'ar' ? 'المورد' : 'Supplier'}
                  </th>
                  <th className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:table-cell">
                    {language === 'ar' ? 'المستودع' : 'Warehouse'}
                  </th>
                  <th className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {language === 'ar' ? 'تاريخ الطلب' : 'Ordered'}
                  </th>
                  <th className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:table-cell">
                    {language === 'ar' ? 'متوقع' : 'Expected'}
                  </th>
                  <th className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{t('status')}</th>
                  <th className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 xl:table-cell">
                    {language === 'ar' ? 'الدفع' : 'Payment'}
                  </th>
                  <th className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{t('total')}</th>
                  <th className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => {
                  const busyDownload = pdfBusyId === `${po._id}:download`
                  const busyPrint = pdfBusyId === `${po._id}:print`
                  const anyBusy = Boolean(pdfBusyId)
                  return (
                    <tr
                      key={po._id}
                      onClick={() => navigate(`/app/dashboard/purchases/orders/${po._id}`)}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                    >
                      <td>
                        <p className="font-mono text-[13px] font-semibold tracking-tight text-slate-950 dark:text-white">
                          {po.poNumber}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {(po.lineItems || []).length
                            ? language === 'ar'
                              ? `${po.lineItems.length} بنود`
                              : `${po.lineItems.length} lines`
                            : ''}
                        </p>
                      </td>
                      <td>
                        <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                          {supplierName(po.supplierId)}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-[13px] text-slate-600 dark:text-slate-300">
                          {language === 'ar'
                            ? po.warehouseId?.nameAr || po.warehouseId?.nameEn || '—'
                            : po.warehouseId?.nameEn || po.warehouseId?.nameAr || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-[13px] tabular-nums text-slate-600 dark:text-slate-300">
                          {formatDay(po.orderDate)}
                        </span>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-[13px] tabular-nums text-slate-600 dark:text-slate-300">
                          {formatDay(po.expectedDate)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                            STATUS_PILL[po.status] || STATUS_PILL.draft
                          }`}
                        >
                          {statusLabel(po.status)}
                        </span>
                      </td>
                      <td className="hidden xl:table-cell">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                            PAYMENT_STATUS_PILL[po.paymentStatus || 'pending']
                          }`}
                        >
                          {paymentStatusLabel(po.paymentStatus || 'pending')}
                        </span>
                      </td>
                      <td>
                        <p className="text-[13px] font-semibold tabular-nums text-slate-950 dark:text-white">
                          <Money value={po.grandTotal} />
                        </p>
                        {(po.balanceDue ?? po.grandTotal) !== po.grandTotal && (
                          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                            {language === 'ar' ? 'المتبقي' : 'Bal'}: <Money value={po.balanceDue} />
                          </p>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openWhatsAppModal(po)}
                            className={ghostBtn.replace('px-3.5 py-2.5', 'h-8 w-8 justify-center px-0 py-0 text-emerald-600 dark:text-emerald-400')}
                            title={language === 'ar' ? 'إرسال عبر الواتساب' : 'Send via WhatsApp'}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEmailModal(po)}
                            className={ghostBtn.replace('px-3.5 py-2.5', 'h-8 w-8 justify-center px-0 py-0 text-blue-600 dark:text-blue-400')}
                            title={language === 'ar' ? 'إرسال بالبريد' : 'Send via Email'}
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                          {['approved', 'partially_received', 'received', 'billed'].includes(po.status) && (po.balanceDue > 0 || po.paymentStatus !== 'paid') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPoForPayment(po)
                                setShowPaymentModal(true)
                              }}
                              className={ghostBtn.replace('px-3.5 py-2.5', 'h-8 w-8 justify-center px-0 py-0 text-emerald-600 dark:text-emerald-400')}
                              title={language === 'ar' ? 'تسجيل دفعة لهذا الطلب' : 'Record payment'}
                            >
                              <CreditCard className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrintPdf(po)}
                            disabled={anyBusy}
                            className={ghostBtn.replace('px-3.5 py-2.5', 'h-8 w-8 justify-center px-0 py-0')}
                            title={language === 'ar' ? 'طباعة' : 'Print'}
                          >
                            {busyPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(po)}
                            disabled={anyBusy}
                            className={ghostBtn.replace('px-3.5 py-2.5', 'h-8 w-8 justify-center px-0 py-0')}
                            title={language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
                          >
                            {busyDownload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                          {['approved', 'partially_received'].includes(po.status) && (
                            <Link
                              to={`/app/dashboard/purchases/orders/${po._id}`}
                              className={ghostBtn.replace('px-3.5 py-2.5', 'h-8 w-8 justify-center px-0 py-0')}
                              title={language === 'ar' ? 'استلام البضاعة (GRN)' : 'Receive Goods (GRN)'}
                            >
                              <PackageCheck className="h-4 w-4" />
                            </Link>
                          )}
                          <Link
                            to={`/app/dashboard/purchases/orders/${po._id}`}
                            className={ghostBtn.replace('px-3.5 py-2.5', 'h-8 w-8 justify-center px-0 py-0')}
                            title={language === 'ar' ? 'عرض الطلب' : 'View order'}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={ghostBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-[12px] tabular-nums text-slate-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            type="button"
            className={ghostBtn}
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      {/* WHATSAPP MODAL */}
      {whatsAppModalPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={`${shell} w-full max-w-md p-6 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إرسال طلب الشراء عبر الواتساب' : 'Send PO via WhatsApp'}
                </h3>
              </div>
              <button type="button" onClick={() => setWhatsAppModalPo(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label">{language === 'ar' ? 'رقم جوال المورد' : 'Supplier Phone'} *</label>
                <input
                  type="text"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                  placeholder="9665xxxxxxxx"
                  className="input !py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'نص الرسالة' : 'Message'}</label>
                <textarea
                  rows={6}
                  value={whatsAppText}
                  onChange={(e) => setWhatsAppText(e.target.value)}
                  className="input font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.08]">
              <button type="button" onClick={() => setWhatsAppModalPo(null)} className={ghostBtn}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={sendWhatsApp}
                disabled={!whatsAppPhone}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {language === 'ar' ? 'إرسال عبر الواتساب' : 'Send via WhatsApp'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {emailModalPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={`${shell} w-full max-w-md p-6 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <Mail className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إرسال طلب الشراء بالبريد' : 'Send PO via Email'}
                </h3>
              </div>
              <button type="button" onClick={() => setEmailModalPo(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'} *</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="supplier@example.com"
                  className="input !py-2 text-xs"
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الموضوع' : 'Subject'}</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="input !py-2 text-xs"
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'المحتوى' : 'Content'}</label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="input font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.08]">
              <button type="button" onClick={() => setEmailModalPo(null)} className={ghostBtn}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={sendEmail}
                disabled={!emailTo}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {language === 'ar' ? 'إرسال بالبريد' : 'Send via Email'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedPoForPayment && (
        <RecordPoPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedPoForPayment(null)
          }}
          order={selectedPoForPayment}
          isAr={language === 'ar'}
          onSuccess={() => {
            refetch()
          }}
        />
      )}
    </div>
  )
}

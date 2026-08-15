import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Download,
  Eye,
  Edit,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
  X,
  PenLine,
  ShieldCheck,
  ShieldOff,
  Layers,
  MessageCircle,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import toast from 'react-hot-toast'
import { downloadInvoicePdf, buildInvoicePdfBlob, isThermalInvoice } from '../../lib/invoicePdf'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import { printThermalElement, getThermalPrinterSettings } from '../../lib/thermalPrinter'
import { getZatcaStatusMeta, isEditableInvoice } from '../../lib/zatcaStatus'
import { getTravelInvoiceLabelMeta, isTravelAgencyInvoice } from '../../lib/travelInvoiceStatus'

const trimPartyName = (value) => String(value || '').trim()

const getInvoiceParty = (invoice) => (
  invoice?.flow === 'purchase' ? invoice?.seller : invoice?.buyer
)

const formatPartyNames = (party, { fallback = '', joiner = ' / ' } = {}) => {
  const en = trimPartyName(party?.name)
  const ar = trimPartyName(party?.nameAr)
  if (en && ar && en !== ar) return `${en}${joiner}${ar}`
  return en || ar || fallback
}

function PartyNames({ party, fallback = '-' }) {
  const en = trimPartyName(party?.name)
  const ar = trimPartyName(party?.nameAr)
  if (en && ar && en !== ar) {
    return (
      <>
        <span className="block">{en}</span>
        <span className="block" dir="rtl">{ar}</span>
      </>
    )
  }
  return <>{en || ar || fallback}</>
}

const getInvoiceContextLabel = (invoice, language = 'en') => {
  const context = String(invoice?.businessContext || '').trim()
  const labels = {
    trading: language === 'ar' ? 'فاتورة تجارة' : 'Trading Invoice',
    construction: language === 'ar' ? 'فاتورة مقاولات' : 'Construction Invoice',
    travel_agency: language === 'ar' ? 'فاتورة وكالة سفر' : 'Travel Agency Invoice',
    restaurant: language === 'ar' ? 'فاتورة مطعم' : 'Restaurant Invoice',
    boutique: language === 'ar' ? 'فاتورة بوتيك' : 'Boutique Invoice',
  }

  if (labels[context]) return labels[context]
  return language === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice'
}

const getTransactionTypeLabel = (transactionType, language = 'en', t) => {
  if (transactionType === 'B2B') return t('b2bInvoice')
  if (transactionType === 'B2C') return t('b2cInvoice')
  return transactionType || (language === 'ar' ? 'غير محدد' : 'Unknown')
}

const toNumber = (value) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

const getInvoiceVatAmount = (invoice = {}) => {
  const effectiveVat = toNumber(invoice?.effectiveVat)
  if (effectiveVat > 0) return effectiveVat

  const storedTax = toNumber(invoice?.totalTax)
  if (storedTax > 0) return storedTax

  const lines = Array.isArray(invoice?.lineItems) ? invoice.lineItems : []
  return lines.reduce((sum, line) => {
    if (line?.isTravelMargin) {
      const taxCategory = String(line?.taxCategory || '').trim().toUpperCase()
      if (taxCategory === 'S') {
        return sum + (toNumber(line?.marginTaxable) * 0.15)
      }
    }

    return sum + toNumber(line?.taxAmount)
  }, 0)
}

export default function Invoices() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', paymentStatus: '', businessContext: '', flow: '' })
  const [zatcaFilter, setZatcaFilter] = useState('')
  const [cursor, setCursor] = useState('')
  const [cursorStack, setCursorStack] = useState([])
  const [knownTotal, setKnownTotal] = useState(null)
  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const [signModalInvoice, setSignModalInvoice] = useState(null)
  const [waModalInvoice, setWaModalInvoice] = useState(null)
  const [printModalInvoice, setPrintModalInvoice] = useState(null)
  const printModalRef = useRef(null)
  const [waPhone, setWaPhone] = useState('')
  const [waLoadingId, setWaLoadingId] = useState(null)
  const [waMessageLang, setWaMessageLang] = useState('en')
  const [waMessage, setWaMessage] = useState('')
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const hasTravel = tenantBusinessTypes.includes('travel_agency')
  const posTenants = ['bakala', 'super market', 'khayyat', 'saloon', 'laundry', 'boutique']
  const showNewInvoiceBtn = true
  const isPosInvoice = (inv) => isThermalInvoice(inv)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(handle)
  }, [search])

  const resetPaging = () => {
    setCursor('')
    setCursorStack([])
    setKnownTotal(null)
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['invoices', cursor, debouncedSearch, filters, zatcaFilter],
    queryFn: () => api.get('/invoices', {
      params: {
        search: debouncedSearch,
        ...filters,
        zatcaFilter,
        ...(cursor ? { cursor } : {}),
      }
    }).then(res => res.data),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    if (data?.pagination?.total != null) setKnownTotal(data.pagination.total)
  }, [data])

  const deleteMutation = useMutation({
    mutationFn: (invoiceId) => api.delete(`/invoices/${invoiceId}`).then((res) => res.data),
    onSuccess: (result) => {
      toast.success(
        language === 'ar'
          ? `تم حذف الفاتورة ${result?.invoiceNumber || ''} بنجاح`
          : `Invoice ${result?.invoiceNumber || ''} deleted`
      )
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['dashboard'])
      queryClient.invalidateQueries(['dashboard-revenue'])
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['travel-bookings'])
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || (language === 'ar' ? 'فشل حذف الفاتورة' : 'Failed to delete invoice'))
    },
  })

  const handleDeleteInvoice = (invoice) => {
    const label = invoice.invoiceNumber || ''
    const buyer = formatPartyNames(getInvoiceParty(invoice))
    const msg = language === 'ar'
      ? `هل أنت متأكد من حذف الفاتورة "${label}" للعميل "${buyer}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Permanently delete invoice "${label}" for "${buyer}"? This cannot be undone.`
    if (!window.confirm(msg)) return
    deleteMutation.mutate(invoice._id)
  }

  const signMutation = useMutation({
    mutationFn: (invoiceId) => api.post(`/invoices/${invoiceId}/sign`, undefined, { timeout: 120000 }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم توقيع الفاتورة بنجاح' : 'Invoice signed successfully')
      setSignModalInvoice(null)
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['dashboard'])
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || (language === 'ar' ? 'فشل توقيع الفاتورة' : 'Failed to sign invoice'))
    },
  })

  const handleWaClick = async (invoice) => {
    try {
      setWaLoadingId(invoice._id)
      const status = await api.get('/whatsapp/client/status').then(r => r.data)
      if (status?.status !== 'READY') {
        toast.error(language === 'ar' ? 'الرجاء ربط واتساب أولاً من صفحة واتساب' : 'Please connect WhatsApp first from the WhatsApp page')
        return
      }
      let phone = invoice.buyer?.contactPhone || invoice.buyer?.phone || ''
      let cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
        cleanPhone = '966' + cleanPhone.substring(1)
      }
      setWaPhone(cleanPhone)
      
      const tNameAr = tenant?.nameAr || tenant?.name || ''
      const tNameEn = tenant?.name || tenant?.nameAr || ''
      const total = invoice.totalAmount + ' SAR'
      
      let initialLang = language === 'ar' ? 'ar' : 'en'
      setWaMessageLang(initialLang)
      if (initialLang === 'ar') {
        setWaMessage(`شكراً لتسوقكم من ${tNameAr}. إجمالي الفاتورة ${total}.`)
      } else {
        setWaMessage(`Thank you for shopping from ${tNameEn}. Your total bill is ${total}.`)
      }
      
      setWaModalInvoice(invoice)
    } catch (err) {
      toast.error(language === 'ar' ? 'الرجاء ربط واتساب أولاً من صفحة واتساب' : 'Please connect WhatsApp first from the WhatsApp page')
    } finally {
      setWaLoadingId(null)
    }
  }

  const sendWaMutation = useMutation({
    mutationFn: async ({ invoice, phone }) => {
      const full = await api.get(`/invoices/${invoice._id}`).then(r => r.data)
      const blob = await buildInvoicePdfBlob({ invoice: full, language, tenant })
      if (!blob) throw new Error('Failed to generate PDF')
      
      const formData = new window.FormData()
      formData.append('pdf', blob, `${full.invoiceNumber}.pdf`)
      formData.append('phoneNumber', phone)
      formData.append('fileName', `${full.invoiceNumber}.pdf`)
      formData.append('caption', waMessage)
      
      return api.post('/whatsapp/client/send-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      })
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال الفاتورة عبر واتساب' : 'Invoice sent via WhatsApp')
      setWaModalInvoice(null)
      setWaPhone('')
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || (language === 'ar' ? 'فشل إرسال الفاتورة' : 'Failed to send invoice'))
    }
  })

  const getStatusBadge = useCallback((invoice) => {
    const phase = tenant?.zatca?.phase || 1
    const meta = getZatcaStatusMeta(invoice, language, phase)
    const badgeClass = meta.tone === 'success'
      ? 'badge-success'
      : meta.tone === 'info'
        ? 'badge-info'
        : meta.tone === 'danger'
          ? 'badge-danger'
          : meta.tone === 'warning'
            ? 'badge-warning'
            : 'badge-neutral'

    const icon = meta.tone === 'success'
      ? <CheckCircle className="w-3 h-3 me-1" />
      : meta.tone === 'danger'
        ? <XCircle className="w-3 h-3 me-1" />
        : meta.tone === 'warning'
          ? <AlertTriangle className="w-3 h-3 me-1" />
          : <Clock className="w-3 h-3 me-1" />

    return <span className={`badge ${badgeClass}`}>{icon}{meta.label}</span>
  }, [tenant?.zatca?.phase, language])

  const getPaymentBadge = useCallback((invoice) => {
    const status = String(invoice?.paymentStatus || 'pending')
    const labels = {
      paid: language === 'ar' ? 'مدفوعة' : 'Paid',
      partial: language === 'ar' ? 'جزئي' : 'Partial',
      overdue: language === 'ar' ? 'متأخرة' : 'Overdue',
      pending: language === 'ar' ? 'غير مدفوعة' : 'Unpaid',
      cancelled: language === 'ar' ? 'ملغاة' : 'Cancelled',
    }
    const tone = status === 'paid'
      ? 'badge-success'
      : status === 'overdue'
        ? 'badge-danger'
        : status === 'partial'
          ? 'badge-warning'
          : 'badge-neutral'
    return <span className={`badge ${tone}`}>{labels[status] || status}</span>
  }, [language])

  const exportColumns = useMemo(() => [
    {
      key: 'invoiceNumber',
      label: t('invoiceNumber'),
      value: (r) => r?.invoiceNumber || ''
    },
    {
      key: 'buyerName',
      label: t('customer'),
      value: (r) => formatPartyNames(getInvoiceParty(r))
    },
    {
      label: language === 'ar' ? 'النوع' : 'Type',
      value: (r) => getInvoiceContextLabel(r, language)
    },
    {
      key: 'issueDate',
      label: t('date'),
      value: (r) => (r?.issueDate ? new Date(r.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '')
    },
    ...(hasTravel ? [{
      key: 'customerPriceTotal',
      label: language === 'ar' ? 'سعر العميل' : 'Customer Price',
      value: (r) => isTravelAgencyInvoice(r) ? (r?.customerPriceTotal ?? '') : ''
    }] : []),
    {
      key: 'grandTotal',
      label: t('total'),
      value: (r) => r?.grandTotal ?? ''
    },
    {
      key: 'totalTax',
      label: language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT',
      value: (r) => getInvoiceVatAmount(r)
    },
    {
      key: 'zatcaStatus',
      label: tenant?.zatca?.phase === 1 ? (language === 'ar' ? 'حالة التجهيز' : 'Status') : t('zatcaStatus'),
      value: (r) => getZatcaStatusMeta(r, language, tenant?.zatca?.phase || 1).label
    },
  ], [t, language, hasTravel, tenant?.zatca?.phase])

  const getExportRows = useCallback(async () => {
    const limit = 200
    let nextCursor = ''
    let all = []

    while (true) {
      const res = await api.get('/invoices', {
        params: { limit, search, ...filters, ...(nextCursor ? { cursor: nextCursor } : {}) }
      })
      const batch = res.data?.invoices || []
      all = all.concat(batch)

      nextCursor = res.data?.nextCursor || ''
      if (!nextCursor || batch.length === 0) break
      if (all.length >= 10000) break
    }

    return all
  }, [search, filters])

  const zatcaFilterOptions = useMemo(() => [
    { value: '', label: language === 'ar' ? 'الكل' : 'All', icon: <Layers className="w-3.5 h-3.5" /> },
    { value: 'unsigned', label: language === 'ar' ? 'بانتظار التوقيع' : 'Pending Sign', icon: <ShieldOff className="w-3.5 h-3.5" /> },
    { value: 'signed', label: language === 'ar' ? 'موقّعة' : 'Signed', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { value: 'submitted', label: language === 'ar' ? 'مُرسَلة' : 'Submitted', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ], [language])

  return (
    <div className="space-y-6">
      {/* Sign Modal */}
      <AnimatePresence>
        {signModalInvoice && (
          <motion.div
            key="sign-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setSignModalInvoice(null) }}
          >
            <motion.div
              key="sign-modal-panel"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-dark-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
                    <PenLine className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'توقيع الفاتورة' : 'Sign Invoice'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{signModalInvoice.invoiceNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSignModalInvoice(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3">
                    <p className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'العميل / المورد' : 'Customer / Supplier'}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      <PartyNames party={getInvoiceParty(signModalInvoice)} fallback="—" />
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3">
                    <p className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'الإجمالي' : 'Total'}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      <Money value={signModalInvoice.grandTotal} />
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3">
                    <p className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      {new Date(signModalInvoice.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3">
                    <p className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                    {getStatusBadge(signModalInvoice)}
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  {tenant?.zatca?.phase === 1
                    ? (language === 'ar' ? 'سيتم تجهيز الفاتورة وإنشاء رمز الاستجابة السريعة (QR) بصيغة نهائية' : 'The invoice will be finalized and the QR code will be generated')
                    : (language === 'ar' ? 'سيتم توقيع الفاتورة وإرسالها إلى هيئة الزكاة والضريبة والجمارك' : 'The invoice will be cryptographically signed and submitted to ZATCA')}
                </p>
              </div>
              <div className="flex gap-3 p-5 pt-0">
                <button
                  type="button"
                  onClick={() => setSignModalInvoice(null)}
                  className="flex-1 btn btn-secondary"
                  disabled={signMutation.isPending}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => signMutation.mutate(signModalInvoice._id)}
                  disabled={signMutation.isPending}
                  className="flex-1 btn btn-primary"
                >
                  {signMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {tenant?.zatca?.phase === 1
                    ? (language === 'ar' ? 'تجهيز' : 'Finalize')
                    : (language === 'ar' ? 'توقيع وإرسال' : 'Sign & Submit')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp Send Modal */}
      <AnimatePresence>
        {waModalInvoice && (
          <motion.div
            key="wa-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setWaModalInvoice(null) }}
          >
            <motion.div
              key="wa-modal-panel"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-dark-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{waModalInvoice.invoiceNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWaModalInvoice(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="label">{language === 'ar' ? 'رقم الهاتف (مع رمز الدولة)' : 'Phone Number (with country code)'}</label>
                  <input
                    type="text"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="9665XXXXXXXX"
                    className="input"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'ar' ? 'مثال: 9665XXXXXXXX' : 'Example: 9665XXXXXXXX'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">{language === 'ar' ? 'رسالة الفاتورة' : 'Invoice Message'}</label>
                    <select
                      value={waMessageLang}
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setWaMessageLang(newLang);
                        const tNameAr = tenant?.nameAr || tenant?.name || '';
                        const tNameEn = tenant?.name || tenant?.nameAr || '';
                        const total = waModalInvoice?.totalAmount + ' SAR';
                        const msgAr = `شكراً لتسوقكم من ${tNameAr}. إجمالي الفاتورة ${total}.`;
                        const msgEn = `Thank you for shopping from ${tNameEn}. Your total bill is ${total}.`;
                        if (newLang === 'ar') setWaMessage(msgAr);
                        else if (newLang === 'en') setWaMessage(msgEn);
                        else setWaMessage(`${msgAr}\n\n${msgEn}`);
                      }}
                      className="text-xs bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600 rounded-md py-1 px-2 text-gray-700 dark:text-gray-300 outline-none"
                    >
                      <option value="both">{language === 'ar' ? 'عربي وإنجليزي' : 'Arabic & English'}</option>
                      <option value="ar">عربي</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <textarea
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    className="input min-h-[80px]"
                    dir={waMessageLang === 'ar' ? 'rtl' : 'ltr'}
                  />
                </div>
              </div>
              <div className="flex gap-3 p-5 pt-0">
                <button
                  type="button"
                  onClick={() => setWaModalInvoice(null)}
                  className="flex-1 btn btn-secondary"
                  disabled={sendWaMutation.isPending}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => sendWaMutation.mutate({ invoice: waModalInvoice, phone: waPhone })}
                  disabled={!waPhone || sendWaMutation.isPending}
                  className="flex-1 btn bg-green-600 hover:bg-green-700 text-white"
                >
                  {sendWaMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {language === 'ar' ? 'إرسال' : 'Send'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('invoices')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة الفواتير الضريبية والمبسطة' : 'Manage tax and simplified invoices'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={data?.invoices || []}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'فواتير' : 'Invoices'}
            title={language === 'ar' ? 'الفواتير' : 'Invoices'}
            disabled={isLoading || (data?.invoices || []).length === 0}
          />
          {showNewInvoiceBtn && (
            <Link to="/app/dashboard/invoices/new" className="btn btn-action-dark">
              <Plus className="w-4 h-4" />
              {t('newInvoice')}
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'ar'
                ? (hasTravel ? 'بحث بالرقم، الاسم، PNR، الهاتف، البريد، رقم التذكرة...' : 'بحث بالرقم، الاسم، الهاتف، البريد...')
                : (hasTravel ? 'Search by number, name, PNR, phone, email, ticket number...' : 'Search by number, name, phone, email...')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetPaging()
              }}
              className="input ps-10"
            />
          </div>
          <select
            value={filters.flow}
            onChange={(e) => {
              setFilters({ ...filters, flow: e.target.value })
              resetPaging()
            }}
            className="select w-full sm:w-52"
          >
            <option value="">{language === 'ar' ? 'كل الأقسام (مبيعات ومشتريات)' : 'All (Sales & Purchases)'}</option>
            <option value="sell">{language === 'ar' ? 'فواتير مبيعات' : 'Sales Invoices'}</option>
            <option value="purchase">{language === 'ar' ? 'فواتير مشتريات' : 'Purchase Invoices'}</option>
          </select>
          <select
            value={filters.businessContext}
            onChange={(e) => {
              setFilters({ ...filters, businessContext: e.target.value })
              resetPaging()
            }}
            className="select w-full sm:w-52"
          >
            <option value="">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
            {tenantBusinessTypes.map((businessType) => (
              <option key={businessType} value={businessType}>{getInvoiceContextLabel({ businessContext: businessType }, language)}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value })
              resetPaging()
            }}
            className="select w-full sm:w-40"
          >
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
            <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
            <option value="pending">{t('pending')}</option>
            <option value="approved">{language === 'ar' ? 'معتمدة' : 'Approved'}</option>
          </select>
          <select
            value={filters.paymentStatus}
            onChange={(e) => {
              setFilters({ ...filters, paymentStatus: e.target.value })
              resetPaging()
            }}
            className="select w-full sm:w-40"
          >
            <option value="">{language === 'ar' ? 'كل حالات الدفع' : 'All payments'}</option>
            <option value="pending">{language === 'ar' ? 'غير مدفوعة' : 'Unpaid'}</option>
            <option value="partial">{language === 'ar' ? 'جزئي' : 'Partial'}</option>
            <option value="paid">{language === 'ar' ? 'مدفوعة' : 'Paid'}</option>
            <option value="overdue">{language === 'ar' ? 'متأخرة' : 'Overdue'}</option>
          </select>
        </div>
        {/* ZATCA status quick-filter chips */}
        {tenant?.zatca?.phase !== 1 && (
        <div className="flex flex-wrap gap-2">
          {zatcaFilterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setZatcaFilter(opt.value); resetPaging() }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                zatcaFilter === opt.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-dark-600 hover:border-primary-400'
              }`}
            >
              {opt.icon}{opt.label}
            </button>
          ))}
          {(isFetching && !isLoading) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              {language === 'ar' ? 'جارٍ التحديث...' : 'Updating...'}
            </span>
          )}
        </div>
        )}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card"
      >
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <ResponsiveDataList
              items={data?.invoices || []}
              empty={<p className="p-6 text-center text-sm text-gray-500">{language === 'ar' ? 'لا توجد فواتير' : 'No invoices'}</p>}
              renderCard={(invoice) => {
                const party = getInvoiceParty(invoice)
                return (
                  <div key={invoice._id} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => navigate(`/app/dashboard/invoices/${invoice._id}`)} className="text-start min-w-0">
                        <p className="font-semibold text-primary-700 dark:text-primary-400 truncate">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-gray-900 dark:text-white"><PartyNames party={party} /></p>
                        <p className="text-xs text-gray-500 mt-0.5">{new Date(invoice.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</p>
                      </button>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {getStatusBadge(invoice)}
                        {getPaymentBadge(invoice)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white"><Money value={invoice.grandTotal} /></span>
                      <div className="flex items-center gap-1">
                        <Link to={`/app/dashboard/invoices/${invoice._id}`} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                          <Eye className="w-4 h-4 text-gray-600" />
                        </Link>
                        {isEditableInvoice(invoice, tenant?.zatca?.phase || 2) && (
                          <Link to={`/app/dashboard/invoices/${invoice._id}/edit`} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                            <Edit className="w-4 h-4 text-gray-600" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }}
            >
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('invoiceNumber')}</th>
                    <th>{language === 'ar' ? 'العميل / المورد' : 'Customer / Supplier'}</th>
                    <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                    <th>{t('date')}</th>
                    <th>{language === 'ar' ? 'تم الإنشاء بواسطة' : 'Created By'}</th>
                    {hasTravel && <th>{language === 'ar' ? 'سعر العميل' : 'Customer Price'}</th>}
                    <th>{t('total')}</th>
                    <th>{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</th>
                    <th>{tenant?.zatca?.phase === 1 ? (language === 'ar' ? 'الحالة' : 'Status') : t('zatcaStatus')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.invoices?.map((invoice) => (
                    <tr key={invoice._id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/app/dashboard/invoices/${invoice._id}`)}
                          className="flex items-center gap-3 group text-start"
                        >
                          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors">
                            <FileText className="w-4 h-4 text-primary-600" />
                          </div>
                          <span className="font-medium text-primary-700 dark:text-primary-400 group-hover:underline underline-offset-2">
                            {invoice.invoiceNumber}
                          </span>
                        </button>
                      </td>
                      <td>
                        <p className="font-medium text-gray-900 dark:text-white">
                          <PartyNames party={getInvoiceParty(invoice)} />
                        </p>
                        {(invoice.flow === 'purchase' ? invoice.seller?.vatNumber : invoice.buyer?.vatNumber) && (
                          <p className="text-xs text-gray-500">{invoice.flow === 'purchase' ? invoice.seller.vatNumber : invoice.buyer.vatNumber}</p>
                        )}
                      </td>
                      <td>
                        <div>
                          {isTravelAgencyInvoice(invoice) ? (
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getTravelInvoiceLabelMeta(invoice, language).className}`}>
                              {getInvoiceContextLabel(invoice, language)}
                            </span>
                          ) : (
                            <>
                              <span className={`badge ${invoice.flow === 'purchase' ? 'badge-info' : 'badge-neutral'} me-1`}>
                                {invoice.flow === 'purchase' ? (language === 'ar' ? 'مشتريات' : 'Purchase') : (language === 'ar' ? 'مبيعات' : 'Sales')}
                              </span>
                              <span className="badge badge-neutral">
                                {getInvoiceContextLabel(invoice, language)}
                              </span>
                            </>
                          )}
                          <p className="mt-1 text-xs text-gray-500">{getTransactionTypeLabel(invoice.transactionType, language, t)}</p>
                          {isTravelAgencyInvoice(invoice) && (
                            <p className={`mt-1 text-[11px] font-medium ${getTravelInvoiceLabelMeta(invoice, language).textClassName}`}>
                              {getTravelInvoiceLabelMeta(invoice, language).description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-gray-600 dark:text-gray-400">
                        <div>{new Date(invoice.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{new Date(invoice.issueDate).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="text-gray-600 dark:text-gray-400 text-sm">
                        {(() => {
                          const en = [invoice?.createdBy?.firstName, invoice?.createdBy?.lastName].filter(Boolean).join(' ')
                          const ar = [invoice?.createdBy?.firstNameAr, invoice?.createdBy?.lastNameAr].filter(Boolean).join(' ')
                          return (language === 'ar'
                            ? (invoice.createdByNameAr || ar || invoice.createdByName || en)
                            : (invoice.createdByName || en || invoice.createdByNameAr || ar)) || '—'
                        })()}
                      </td>
                      {hasTravel && (
                        <td className="font-medium text-gray-700 dark:text-gray-300">
                          {isTravelAgencyInvoice(invoice) && invoice.customerPriceTotal > 0
                            ? <Money value={invoice.customerPriceTotal} />
                            : '—'}
                        </td>
                      )}
                      <td className="font-semibold"><Money value={invoice.grandTotal} /></td>
                      <td className="text-gray-600 dark:text-gray-400">
                        {getInvoiceVatAmount(invoice) > 0
                          ? <Money value={getInvoiceVatAmount(invoice)} />
                          : <span className="text-gray-400 text-sm">—</span>}
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          {getStatusBadge(invoice)}
                          {getPaymentBadge(invoice)}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {['draft', 'pending'].includes(invoice?.status) && !invoice?.zatca?.invoiceHash && invoice?.flow !== 'purchase' && (
                            <button
                              type="button"
                              onClick={() => setSignModalInvoice(invoice)}
                              className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title={tenant?.zatca?.phase === 1 ? (language === 'ar' ? 'تجهيز الفاتورة' : 'Finalize') : (language === 'ar' ? 'توقيع وإرسال' : 'Sign & Submit')}
                            >
                              <Send className="w-4 h-4 text-primary-600" />
                            </button>
                          )}
                          {isEditableInvoice(invoice, tenant?.zatca?.phase || 2) && (
                            <Link
                              to={`/app/dashboard/invoices/${invoice._id}/edit`}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                              title={language === 'ar' ? 'تعديل' : 'Edit'}
                            >
                              <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </Link>
                          )}
                          <Link
                            to={`/app/dashboard/invoices/${invoice._id}`}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleWaClick(invoice)}
                            disabled={waLoadingId === invoice._id}
                            className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title={language === 'ar' ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
                          >
                            {waLoadingId === invoice._id ? (
                              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                setPdfLoadingId(invoice._id)
                                if (isPosInvoice(invoice)) {
                                  setPrintModalInvoice(invoice)
                                  return
                                }
                                const full = await api.get(`/invoices/${invoice._id}`).then((res) => res.data)
                                await downloadInvoicePdf({ invoice: full, language, tenant })
                              } catch (e) {
                                toast.error(language === 'ar' ? 'فشل تحميل PDF' : 'Failed to download PDF')
                              } finally {
                                setPdfLoadingId(null)
                              }
                            }}
                            disabled={pdfLoadingId === invoice._id}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                            title={language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                          >
                            {pdfLoadingId === invoice._id ? (
                              <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(invoice)}
                            disabled={deleteMutation.isPending}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title={language === 'ar' ? 'حذف الفاتورة' : 'Delete invoice'}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </ResponsiveDataList>

            {/* Pagination */}
            {(data?.nextCursor || cursor || cursorStack.length > 0) && (
                <div className="p-4 border-t border-gray-100 dark:border-dark-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">
                    {language === 'ar'
                      ? `${knownTotal != null ? knownTotal : (data?.invoices?.length || 0)} نتيجة`
                      : `${knownTotal != null ? knownTotal : (data?.invoices?.length || 0)} results`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!cursor && cursorStack.length === 0}
                      onClick={() => {
                        setCursorStack((stack) => {
                          const next = [...stack]
                          setCursor(next.pop() || '')
                          return next
                        })
                      }}
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!data?.nextCursor}
                      onClick={() => {
                        if (!data?.nextCursor) return
                        setCursorStack((stack) => [...stack, cursor])
                        setCursor(data.nextCursor)
                      }}
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
            )}
          </>
        )}
      </motion.div>

      {printModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[400px] mx-4 max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-lg font-bold">
                {language === 'ar' ? 'إيصال الفاتورة' : 'Invoice Receipt'}
              </h3>
              <button onClick={() => setPrintModalInvoice(null)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">
                ×
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-2 print:border-none print:p-0 flex justify-center">
              <ThermalReceipt
                ref={printModalRef}
                order={{
                  ...printModalInvoice,
                  receiptNumber: printModalInvoice.invoiceNumber,
                  customerName: printModalInvoice.buyer?.name || printModalInvoice.buyer?.nameAr,
                  customerPhone: printModalInvoice.buyer?.phone,
                  grandTotal: printModalInvoice.grandTotal,
                  totalVat: printModalInvoice.totalTax,
                  subtotal: printModalInvoice.subTotal || (printModalInvoice.grandTotal - printModalInvoice.totalTax),
                  zatcaQrCode: printModalInvoice.zatca?.qrCodeData,
                  items: printModalInvoice.lineItems?.map(item => ({
                    nameEn: item.productName || item.name,
                    nameAr: item.productNameAr || item.nameAr,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.taxableAmount || (item.quantity * item.unitPrice)
                  }))
                }}
                type={printModalInvoice.businessContext || 'restaurant'}
              />
            </div>
            <div className="mt-6 flex gap-3 print:hidden">
              <button onClick={() => setPrintModalInvoice(null)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 text-gray-700">
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
              <button onClick={() => { if (printModalRef.current) printThermalElement(printModalRef.current, getThermalPrinterSettings(tenant)) }} className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700">
                {language === 'ar' ? 'طباعة' : 'Print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

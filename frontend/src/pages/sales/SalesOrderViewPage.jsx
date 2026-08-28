import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Banknote, CheckCircle2, Lock, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import SalesOrderSmartButtons from '../../components/sales/SalesOrderSmartButtons'
import DownPaymentModal from '../../components/sales/DownPaymentModal'
import {
  actionBarClass,
  backBtnClass,
  ghostActionClass,
  listShellClass,
  metaRowClass,
  metaValueClass,
  pageSubtitleClass,
  pageTitleClass,
  primaryActionClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  sectionCardClass,
  sectionEyebrowClass,
  softChipClass,
  soStatusChipClass,
  soStatusLabel,
} from './salesUi'

const PIPELINE = [
  { id: 'draft', en: 'Draft', ar: 'مسودة' },
  { id: 'sent', en: 'Sent', ar: 'مُرسل' },
  { id: 'approved', en: 'Confirmed', ar: 'مؤكد' },
  { id: 'locked', en: 'Locked', ar: 'مقفل' },
]

function pipelineStep(order) {
  if (order?.status === 'cancelled') return -1
  if (order?.isLocked || order?.status === 'delivered' || order?.status === 'partially_delivered') return 3
  if (order?.status === 'approved') return 2
  if (order?.status === 'sent') return 1
  return 0
}

export default function SalesOrderViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const [downPaymentOpen, setDownPaymentOpen] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: async () => (await api.get(`/purchase-orders/${id}`)).data,
    enabled: Boolean(id),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/send`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إرسال أمر البيع' : 'Sales order marked as sent')
      qc.invalidateQueries({ queryKey: ['sales-order', id] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/approve`),
    onSuccess: () => {
      toast.success(isAr ? 'تم تأكيد أمر البيع — جارٍ إنشاء التسليم' : 'Confirmed — delivery allocation started')
      qc.invalidateQueries({ queryKey: ['sales-order', id] })
      qc.invalidateQueries({ queryKey: ['sales-smart-buttons', id] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const createInvoice = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/invoices', {
        flow: 'sell',
        sourcePurchaseOrderId: id,
        customerId: order.customerId?._id || order.customerId,
        lineItems: (order.lineItems || []).map((li) => ({
          productId: li.productId?._id || li.productId,
          variantId: li.variantId || undefined,
          productName: li.manualName || li.description || 'Item',
          quantity: li.quantityOrdered,
          unitPrice: li.unitCost,
          productType: li.productType || 'goods',
          taxRate: li.taxRate ?? 15,
        })),
      })
      return data
    },
    onSuccess: (inv) => {
      toast.success(isAr ? 'تم إنشاء الفاتورة' : 'Invoice created')
      navigate(`/app/dashboard/invoices/${inv._id || inv.invoice?._id}`)
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const step = useMemo(() => pipelineStep(order), [order])

  if (isLoading) return <div className="p-8 text-sm text-slate-500">…</div>
  if (!order) return <div className="p-8 text-sm text-red-600">Not found</div>

  const canSend = order.status === 'draft'
  const canConfirm = ['draft', 'sent'].includes(order.status)
  const isConfirmed = order.status === 'approved' || order.isLocked || ['partially_delivered', 'delivered'].includes(order.status)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" className={backBtnClass} onClick={() => navigate('/app/dashboard/sales/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className={sectionEyebrowClass}>{isAr ? 'أمر بيع' : 'Sales order'}</p>
            <h1 className={pageTitleClass}>{order.poNumber}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={soStatusChipClass(order.status, order.isLocked)}>
                {soStatusLabel(order.status, order.isLocked, isAr)}
              </span>
              {order.incoterm ? <span className={softChipClass}>{order.incoterm}</span> : null}
              {order.isLocked ? (
                <span className={`${softChipClass} gap-1`}>
                  <Lock className="h-3 w-3" /> {isAr ? 'مقفل للتدقيق' : 'Audit locked'}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className={`${actionBarClass} justify-end`}>
          <SalesOrderSmartButtons purchaseOrderId={id} language={language} />
          {canSend ? (
            <button type="button" className={ghostActionClass} onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              <Send className="h-3.5 w-3.5" />
              {isAr ? 'إرسال' : 'Mark sent'}
            </button>
          ) : null}
          {canConfirm ? (
            <button type="button" className={primaryActionClass} onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isAr ? 'تأكيد' : 'Confirm'}
            </button>
          ) : null}
          {isConfirmed ? (
            <>
              <button type="button" className={ghostActionClass} onClick={() => setDownPaymentOpen(true)}>
                <Banknote className="h-3.5 w-3.5" />
                {isAr ? 'دفعة مقدمة' : 'Down payment'}
              </button>
              <button type="button" className={primaryActionClass} onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending}>
                {isAr ? 'إنشاء فاتورة' : 'Create Invoice'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {order.status !== 'cancelled' ? (
        <div className={`${sectionCardClass} !py-4`}>
          <div className="flex flex-wrap items-center gap-2">
            {PIPELINE.map((p, idx) => {
              const done = step >= idx
              const current = step === idx
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                      done
                        ? current
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'border-slate-200 bg-white text-slate-400 dark:border-dark-600 dark:bg-dark-800'
                    }`}
                  >
                    {isAr ? p.ar : p.en}
                  </span>
                  {idx < PIPELINE.length - 1 ? <span className="hidden text-slate-300 sm:inline">→</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className={`${sectionCardClass} grid gap-3 sm:grid-cols-2`}>
        <div className={metaRowClass}>
          <span>{isAr ? 'العميل' : 'Customer'}</span>
          <span className={metaValueClass}>
            {order.customerId?.nameEn || order.customerId?.name || order.customerName || '—'}
          </span>
        </div>
        <div className={metaRowClass}><span>{isAr ? 'العملة' : 'Currency'}</span><span className={metaValueClass}>{order.currency || 'SAR'}</span></div>
        <div className={metaRowClass}><span>{isAr ? 'الإجمالي' : 'Grand total'}</span><span className={metaValueClass}>{Number(order.grandTotal || 0).toFixed(2)}</span></div>
        <div className={metaRowClass}><span>{isAr ? 'التوقيع' : 'Signed'}</span><span className={metaValueClass}>{order.signedAt ? new Date(order.signedAt).toLocaleString() : '—'}</span></div>
        <div className={metaRowClass}><span>{isAr ? 'تأكيد الدفع' : 'Payment confirmed'}</span><span className={metaValueClass}>{order.paymentConfirmedAt ? new Date(order.paymentConfirmedAt).toLocaleString() : '—'}</span></div>
        {order.draftDelivery?.dnNumber ? (
          <div className={metaRowClass}>
            <span>{isAr ? 'التسليم' : 'Delivery'}</span>
            <Link className="font-semibold text-teal-700 dark:text-teal-300" to={`/app/dashboard/delivery-notes/${order.draftDelivery._id}`}>
              {order.draftDelivery.dnNumber}
            </Link>
          </div>
        ) : null}
      </div>

      <div className={listShellClass}>
        <div className="overflow-x-auto">
          <table className={salesTableClass}>
            <thead>
              <tr>
                <th className={salesThClass}>{isAr ? 'الصنف' : 'Item'}</th>
                <th className={salesThClass}>{isAr ? 'مطلوب' : 'Ordered'}</th>
                <th className={salesThClass}>{isAr ? 'مسلم' : 'Delivered'}</th>
                <th className={salesThClass}>{isAr ? 'مفوتر' : 'Invoiced'}</th>
                <th className={`${salesThClass} text-end`}>{isAr ? 'السعر' : 'Price'}</th>
              </tr>
            </thead>
            <tbody>
              {(order.lineItems || []).map((li, idx) => (
                <tr key={idx} className={salesTrClass}>
                  <td className={salesTdClass}>{li.manualName || li.description || li.productId?.nameEn || '—'}</td>
                  <td className={salesTdClass}>{li.quantityOrdered}</td>
                  <td className={salesTdClass}>{li.quantityDelivered || 0}</td>
                  <td className={salesTdClass}>{li.quantityInvoiced || 0}</td>
                  <td className={`${salesTdClass} text-end tabular-nums`}>{Number(li.unitCost || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DownPaymentModal
        open={downPaymentOpen}
        onClose={() => setDownPaymentOpen(false)}
        purchaseOrderId={id}
        grandTotal={order.grandTotal}
        language={language}
        onCreated={(data) => {
          const invId = data?.invoice?._id
          if (invId) navigate(`/app/dashboard/invoices/${invId}`)
        }}
      />
    </div>
  )
}

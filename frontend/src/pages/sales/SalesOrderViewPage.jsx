import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Banknote, CheckCircle2, Lock, Send, ShieldAlert, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import SalesOrderSmartButtons from '../../components/sales/SalesOrderSmartButtons'
import DownPaymentModal from '../../components/sales/DownPaymentModal'
import DocumentChatter from '../../components/sales/DocumentChatter'
import { useSalesSettings } from '../../context/SalesSettingsContext'
import {
  actionBarClass,
  backBtnClass,
  ghostActionClass,
  metaRowClass,
  metaValueClass,
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
  { id: 'draft', en: 'Draft', ar: 'مسودة', action: null },
  { id: 'sent', en: 'Sent', ar: 'مُرسل', action: 'send' },
  { id: 'approved', en: 'Confirmed', ar: 'مؤكد', action: 'confirm' },
  { id: 'locked', en: 'Locked', ar: 'مقفل', action: null },
]

function pipelineStep(order) {
  if (order?.status === 'cancelled') return -1
  if (order?.status === 'pending_approval') return 1.5
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
  const { defaultInvoicingPolicy } = useSalesSettings()

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: async () => (await api.get(`/purchase-orders/${id}`)).data,
    enabled: Boolean(id),
  })

  const { data: smart } = useQuery({
    queryKey: ['sales-smart-buttons', id],
    queryFn: async () => (await api.get(`/sales/orders/${id}/smart-buttons`)).data,
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
    onSuccess: (res) => {
      const data = res?.data || res
      if (data?.status === 'pending_approval' || data?.code === 'CREDIT_LIMIT_EXCEEDED' || data?.code === 'MARGIN_BELOW_THRESHOLD') {
        toast.error(data.error || (isAr ? 'بانتظار موافقة المالية' : 'Pending finance approval'))
      } else {
        toast.success(isAr ? 'تم تأكيد أمر البيع — جارٍ إنشاء التسليم' : 'Confirmed — delivery allocation started')
        if (data?.oversellWarning) toast(data.oversellWarning, { icon: '⚠️' })
        if (data?.draftDelivery?.reserveError) {
          toast.error(
            isAr
              ? `تحذير الحجز: ${data.draftDelivery.reserveError}`
              : `Reservation warning: ${data.draftDelivery.reserveError}`,
          )
        }
      }
      qc.invalidateQueries({ queryKey: ['sales-order', id] })
      qc.invalidateQueries({ queryKey: ['sales-smart-buttons', id] })
      qc.invalidateQueries({ queryKey: ['sales-chatter', 'sales_order', id] })
    },
    onError: (e) => {
      const data = e?.response?.data
      if (data?.status === 'pending_approval') {
        toast.error(data.error || (isAr ? 'بانتظار الموافقة' : 'Pending approval'))
        qc.invalidateQueries({ queryKey: ['sales-order', id] })
        return
      }
      if (data?.code === 'OVERSELL_BLOCKED') {
        toast.error(data.error || (isAr ? 'المخزون غير كافٍ' : 'Insufficient stock'))
        return
      }
      toast.error(data?.error || e.message)
    },
  })

  const releaseMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/release-approval`),
    onSuccess: () => {
      toast.success(isAr ? 'تم رفع الحجز وتأكيد الأمر' : 'Hold released — order confirmed')
      qc.invalidateQueries({ queryKey: ['sales-order', id] })
      qc.invalidateQueries({ queryKey: ['sales-smart-buttons', id] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/reject-approval`, { reason: 'Rejected by approver' }),
    onSuccess: () => {
      toast.success(isAr ? 'تم رفض الاعتماد' : 'Approval rejected')
      qc.invalidateQueries({ queryKey: ['sales-order', id] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const createInvoice = useMutation({
    mutationFn: async () => {
      const policy = defaultInvoicingPolicy || 'ordered'
      const lines = (order.lineItems || [])
        .map((li) => {
          const ordered = Number(li.quantityOrdered || 0)
          const delivered = Number(li.quantityDelivered || 0)
          const invoiced = Number(li.quantityInvoiced || 0)
          const qty = policy === 'delivered'
            ? Math.max(0, delivered - invoiced)
            : Math.max(0, ordered - invoiced)
          return {
            productId: li.productId?._id || li.productId,
            variantId: li.variantId || undefined,
            productName: li.manualName || li.description || 'Item',
            quantity: qty,
            unitPrice: li.unitCost,
            productType: li.productType || 'goods',
            taxRate: li.taxRate ?? 15,
            sourcePoItemId: li._id,
          }
        })
        .filter((li) => li.quantity > 0)

      if (!lines.length) {
        throw new Error(isAr ? 'لا كميات قابلة للفوترة' : 'Nothing left to invoice')
      }

      const { data } = await api.post('/invoices', {
        flow: 'sell',
        sourcePurchaseOrderId: id,
        customerId: order.customerId?._id || order.customerId,
        transactionType: order.customerId?.entityType === 'business' || order.customerId?.vatNumber ? 'B2B' : 'B2C',
        lineItems: lines,
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

  const onPipelineClick = (action) => {
    if (action === 'send' && order.status === 'draft') sendMutation.mutate()
    if (action === 'confirm' && ['draft', 'sent'].includes(order.status)) approveMutation.mutate()
  }

  if (isLoading) return <div className="p-8 text-sm text-slate-500">…</div>
  if (!order) return <div className="p-8 text-sm text-red-600">Not found</div>

  const canSend = order.status === 'draft'
  const canConfirm = ['draft', 'sent'].includes(order.status)
  const isPendingApproval = order.status === 'pending_approval'
  const isConfirmed = order.status === 'approved' || order.isLocked || ['partially_delivered', 'delivered'].includes(order.status)
  const deliveredPolicy = (defaultInvoicingPolicy || 'ordered') === 'delivered'
  const hasDeliveredQty = (order.lineItems || []).some((li) => Number(li.quantityDelivered || 0) > Number(li.quantityInvoiced || 0))
  const dnDone = Boolean(
    smart?.deliveryNotes?.some?.((d) => {
      const st = String(d.status || d.transferState || '').toLowerCase()
      return ['done', 'delivered', 'fully_invoiced', 'partially_invoiced'].includes(st)
    }),
  ) || ['delivered', 'partially_delivered'].includes(String(order.status || ''))
  const canInvoice = isConfirmed && (
    !deliveredPolicy
      ? true
      : (hasDeliveredQty && dnDone)
  )

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
          {isPendingApproval ? (
            <>
              <button type="button" className={primaryActionClass} onClick={() => releaseMutation.mutate()} disabled={releaseMutation.isPending}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isAr ? 'اعتماد ورفع الحجز' : 'Release & confirm'}
              </button>
              <button type="button" className={ghostActionClass} onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                <XCircle className="h-3.5 w-3.5" />
                {isAr ? 'رفض' : 'Reject'}
              </button>
            </>
          ) : null}
          {isConfirmed ? (
            <>
              <button type="button" className={ghostActionClass} onClick={() => setDownPaymentOpen(true)}>
                <Banknote className="h-3.5 w-3.5" />
                {isAr ? 'دفعة مقدمة' : 'Down payment'}
              </button>
              <button
                type="button"
                className={primaryActionClass}
                onClick={() => createInvoice.mutate()}
                disabled={createInvoice.isPending || !canInvoice}
                title={!canInvoice && deliveredPolicy ? (isAr ? 'انتظر اكتمال التسليم' : 'Wait until delivery is done') : undefined}
              >
                {isAr ? 'إنشاء فاتورة' : 'Create Invoice'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {isPendingApproval ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{isAr ? 'بانتظار الموافقة' : 'Pending approval'}</p>
            <p className="mt-0.5 text-xs opacity-90">{order.approvalReason || order.approvalCode || '—'}</p>
          </div>
        </div>
      ) : null}

      {smart?.deliveryNotes?.some?.((d) => d.hasBackorder || d.transferState === 'waiting' || d.backorderOfId) ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-100">
          <p className="font-semibold">{isAr ? 'يوجد أمر متبقٍ (Backorder)' : 'Backorder in progress'}</p>
          <p className="mt-0.5 text-xs opacity-90">
            {isAr
              ? 'التسليم الجزئي أنشأ أمراً متبقياً — راجع مستند التسليم للمخزون.'
              : 'Partial delivery created a backorder — open the delivery transfer to validate remainder.'}
          </p>
          {smart?.deliveryNotes?.[0]?.inventoryTransferId ? (
            <Link
              className="mt-2 inline-block text-xs font-semibold underline"
              to={`/app/dashboard/inventory/transfers/${smart.deliveryNotes[0].inventoryTransferId}`}
            >
              {isAr ? 'فتح التحويل' : 'Open transfer'}
            </Link>
          ) : null}
        </div>
      ) : null}

      {order.status !== 'cancelled' ? (
        <div className={`${sectionCardClass} !py-4`}>
          <div className="flex flex-wrap items-center gap-2">
            {PIPELINE.map((p, idx) => {
              const done = step >= idx
              const current = Math.floor(step) === idx
              const clickable = Boolean(p.action) && (
                (p.action === 'send' && canSend) || (p.action === 'confirm' && canConfirm)
              )
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onPipelineClick(p.action)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      done
                        ? current
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'border-slate-200 bg-white text-slate-400 dark:border-dark-600 dark:bg-dark-800'
                    } ${clickable ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                  >
                    {isAr ? p.ar : p.en}
                  </button>
                  {idx < PIPELINE.length - 1 ? <span className="hidden text-slate-300 sm:inline">→</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
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
          </div>

          <div className={sectionCardClass}>
            <table className={salesTableClass}>
              <thead>
                <tr>
                  <th className={salesThClass}>{isAr ? 'الصنف' : 'Item'}</th>
                  <th className={salesThClass}>{isAr ? 'الكمية' : 'Qty'}</th>
                  <th className={salesThClass}>{isAr ? 'مُسلّم' : 'Delivered'}</th>
                  <th className={salesThClass}>{isAr ? 'مفوتر' : 'Invoiced'}</th>
                  <th className={salesThClass}>{isAr ? 'السعر' : 'Price'}</th>
                  <th className={salesThClass}>{isAr ? 'المسار' : 'Route'}</th>
                </tr>
              </thead>
              <tbody>
                {(order.lineItems || []).map((li, idx) => (
                  <tr key={li._id || idx} className={salesTrClass}>
                    <td className={salesTdClass}>{li.manualName || li.description || li.productId?.nameEn || '—'}</td>
                    <td className={salesTdClass}>{li.quantityOrdered || 0}</td>
                    <td className={salesTdClass}>{li.quantityDelivered || 0}</td>
                    <td className={salesTdClass}>{li.quantityInvoiced || 0}</td>
                    <td className={salesTdClass}>{Number(li.unitCost || 0).toFixed(2)}</td>
                    <td className={salesTdClass}>{li.procurementRoute || 'mts'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DocumentChatter docType="sales_order" docId={id} language={language} />
      </div>

      {downPaymentOpen ? (
        <DownPaymentModal
          open={downPaymentOpen}
          onClose={() => setDownPaymentOpen(false)}
          purchaseOrderId={id}
          grandTotal={order.grandTotal}
          language={language}
        />
      ) : null}
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Banknote, CheckCircle2 } from 'lucide-react'
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
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  sectionCardClass,
} from './salesUi'

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

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/approve`),
    onSuccess: () => {
      toast.success(isAr ? 'تم تأكيد أمر البيع' : 'Sales order confirmed')
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

  if (isLoading) return <div className="p-8 text-sm text-slate-500">…</div>
  if (!order) return <div className="p-8 text-sm text-red-600">Not found</div>

  const canConfirm = ['draft', 'sent'].includes(order.status)
  const isConfirmed = order.status === 'approved' || order.isLocked

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" className={backBtnClass} onClick={() => navigate('/app/dashboard/sales/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className={pageTitleClass}>{order.poNumber}</h1>
            <p className={pageSubtitleClass}>{order.status} · {order.incoterm || '—'}</p>
          </div>
        </div>
        <div className={`${actionBarClass} justify-end`}>
          <SalesOrderSmartButtons purchaseOrderId={id} language={language} />
          {canConfirm ? (
            <button type="button" className={ghostActionClass} onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
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
              <button type="button" className={ghostActionClass} onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending}>
                {isAr ? 'إنشاء فاتورة' : 'Create Invoice'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className={`${sectionCardClass} grid gap-3 sm:grid-cols-2`}>
        <div className={metaRowClass}><span>Currency</span><span className={metaValueClass}>{order.currency || 'SAR'}</span></div>
        <div className={metaRowClass}><span>Grand total</span><span className={metaValueClass}>{Number(order.grandTotal || 0).toFixed(2)}</span></div>
        <div className={metaRowClass}><span>Signed</span><span className={metaValueClass}>{order.signedAt ? new Date(order.signedAt).toLocaleString() : '—'}</span></div>
        <div className={metaRowClass}><span>Payment confirmed</span><span className={metaValueClass}>{order.paymentConfirmedAt ? new Date(order.paymentConfirmedAt).toLocaleString() : '—'}</span></div>
        {order.draftDelivery?.dnNumber ? (
          <div className={metaRowClass}>
            <span>Delivery</span>
            <Link className="text-teal-700" to={`/app/dashboard/delivery-notes/${order.draftDelivery._id}`}>
              {order.draftDelivery.dnNumber}
            </Link>
          </div>
        ) : null}
      </div>

      <div className={listShellClass}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>{isAr ? 'الصنف' : 'Item'}</th>
              <th className={salesThClass}>{isAr ? 'مطلوب' : 'Ordered'}</th>
              <th className={salesThClass}>{isAr ? 'مسلم' : 'Delivered'}</th>
              <th className={salesThClass}>{isAr ? 'مفوتر' : 'Invoiced'}</th>
              <th className={salesThClass}>{isAr ? 'السعر' : 'Price'}</th>
            </tr>
          </thead>
          <tbody>
            {(order.lineItems || []).map((li, idx) => (
              <tr key={idx} className={salesTrClass}>
                <td className={salesTdClass}>{li.manualName || li.description || li.productId?.nameEn || '—'}</td>
                <td className={salesTdClass}>{li.quantityOrdered}</td>
                <td className={salesTdClass}>{li.quantityDelivered || 0}</td>
                <td className={salesTdClass}>{li.quantityInvoiced || 0}</td>
                <td className={salesTdClass}>{Number(li.unitCost || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

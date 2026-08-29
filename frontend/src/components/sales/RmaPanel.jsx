import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, fieldLabelClass, ghostActionClass, primaryActionClass, sectionCardClass } from '../../pages/sales/salesUi'

/**
 * RMA panel for a done delivery note: return transfer + optional draft credit note.
 */
export default function RmaPanel({ deliveryNote, language = 'en', invoiceId = '' }) {
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const done = ['delivered', 'done', 'fully_invoiced', 'partially_invoiced'].includes(
    String(deliveryNote?.status || '').toLowerCase(),
  )
  const [createCreditNote, setCreateCreditNote] = useState(true)
  const [linkedInvoiceId, setLinkedInvoiceId] = useState(invoiceId || '')
  const [qtys, setQtys] = useState(() => {
    const init = {}
    for (const li of deliveryNote?.lineItems || []) {
      init[String(li._id || li.productId)] = ''
    }
    return init
  })

  const poId = deliveryNote?.purchaseOrderId?._id || deliveryNote?.purchaseOrderId
  const { data: linkedInvoices } = useQuery({
    queryKey: ['rma-invoices', poId],
    queryFn: async () => {
      const { data } = await api.get('/invoices', {
        params: { purchaseOrderId: poId, flow: 'sell', limit: 10 },
      })
      return data?.invoices || data?.items || data || []
    },
    enabled: Boolean(poId) && done && !invoiceId,
  })

  useEffect(() => {
    if (invoiceId) {
      setLinkedInvoiceId(invoiceId)
      return
    }
    const list = Array.isArray(linkedInvoices) ? linkedInvoices : []
    const first = list.find((inv) => inv.invoiceType !== 'credit_note' && inv.status !== 'cancelled')
    if (first?._id && !linkedInvoiceId) setLinkedInvoiceId(String(first._id))
  }, [invoiceId, linkedInvoices, linkedInvoiceId])

  const linesPayload = useMemo(() => {
    return (deliveryNote?.lineItems || [])
      .map((li) => {
        const key = String(li._id || li.productId)
        const qty = Number(qtys[key] || 0)
        if (qty <= 0) return null
        return {
          productId: li.productId?._id || li.productId,
          quantity: qty,
          sourcePoItemId: li.poItemId,
        }
      })
      .filter(Boolean)
  }, [deliveryNote, qtys])

  const submit = useMutation({
    mutationFn: () =>
      api.post('/sales/rma', {
        deliveryNoteId: deliveryNote._id,
        invoiceId: createCreditNote ? linkedInvoiceId || undefined : undefined,
        createCreditNote: Boolean(createCreditNote),
        lines: linesPayload,
      }),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم إنشاء مرتجع المبيعات' : 'RMA created')
      qc.invalidateQueries({ queryKey: ['delivery-note', deliveryNote._id] })
      qc.invalidateQueries({ queryKey: ['sales-chatter'] })
      if (res?.data?.creditNote?._id) {
        toast.success(isAr ? 'تم إنشاء إشعار دائن مسودة' : 'Draft credit note created')
      }
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  if (!deliveryNote?._id || !done) return null

  const invoiceOptions = Array.isArray(linkedInvoices) ? linkedInvoices : []

  return (
    <div className={`${sectionCardClass} space-y-3`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {isAr ? 'مرتجع مبيعات (RMA)' : 'Sales return (RMA)'}
      </h3>
      <p className="text-xs text-slate-500">
        {isAr
          ? 'أدخل كميات الإرجاع. عند التحقق يُنشأ تحويل وارد ويمكن إصدار إشعار دائن.'
          : 'Enter return quantities. Creates an inbound return transfer and optional draft credit note.'}
      </p>
      <div className="space-y-2">
        {(deliveryNote.lineItems || []).map((li) => {
          const key = String(li._id || li.productId)
          const max = Number(li.quantityDelivered || li.quantity || 0)
          return (
            <div key={key} className="grid grid-cols-[1fr_100px] items-center gap-2">
              <div className="text-sm text-slate-700 dark:text-slate-200">
                {li.productName || li.manualName || li.productId?.nameEn || 'Item'}
                <span className="ms-2 text-xs text-slate-400">max {max}</span>
              </div>
              <input
                type="number"
                min={0}
                max={max}
                className={fieldControlClass}
                value={qtys[key] ?? ''}
                onChange={(e) => setQtys((p) => ({ ...p, [key]: e.target.value }))}
                placeholder="0"
              />
            </div>
          )
        })}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={createCreditNote} onChange={(e) => setCreateCreditNote(e.target.checked)} />
        {isAr ? 'إنشاء إشعار دائن مسودة' : 'Create draft credit note'}
      </label>
      {createCreditNote ? (
        <div>
          <label className={fieldLabelClass}>{isAr ? 'الفاتورة المرتبطة' : 'Linked invoice'}</label>
          {invoiceOptions.length ? (
            <select
              className={fieldControlClass}
              value={linkedInvoiceId}
              onChange={(e) => setLinkedInvoiceId(e.target.value)}
            >
              <option value="">{isAr ? 'تلقائي / أحدث فاتورة' : 'Auto / latest invoice'}</option>
              {invoiceOptions.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.invoiceNumber || inv._id}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={fieldControlClass}
              value={linkedInvoiceId}
              onChange={(e) => setLinkedInvoiceId(e.target.value)}
              placeholder={isAr ? 'اختياري — يُكتشف تلقائياً' : 'Optional — auto-detected from SO'}
            />
          )}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className={primaryActionClass}
          disabled={!linesPayload.length || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? '…' : (isAr ? 'تأكيد المرتجع' : 'Submit RMA')}
        </button>
        <button type="button" className={ghostActionClass} onClick={() => setQtys({})}>
          {isAr ? 'مسح' : 'Clear'}
        </button>
      </div>
    </div>
  )
}

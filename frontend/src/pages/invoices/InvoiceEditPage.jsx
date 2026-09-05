import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft } from 'lucide-react'
import api from '../../lib/api'
import InvoiceSellComposer from '../../components/invoices/InvoiceSellComposer'
import InvoicePurchaseComposer from '../../components/invoices/InvoicePurchaseComposer'
import { isEditableInvoice } from '../../lib/zatcaStatus'
import { canResetInvoiceToDraft } from '../../lib/accountingDocumentStatus'

export default function InvoiceEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then((res) => res.data),
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/dashboard/accounting/invoices')} className="btn btn-ghost btn-icon">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'تعذر تحميل الفاتورة' : 'Unable to load invoice'}</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تحقق من الفاتورة ثم حاول مرة أخرى.' : 'Please verify the invoice and try again.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const phase = tenant?.zatca?.phase || 2
  const canEdit = isEditableInvoice(invoice, phase)
  const canReset = canResetInvoiceToDraft(invoice, phase)

  // Posted invoices open in locked composer so Reset to draft (and type overrides) stay available.
  if (!canEdit && !canReset) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/app/dashboard/accounting/invoices/${id}`)} className="btn btn-ghost btn-icon">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'لا يمكن تعديل هذه الفاتورة' : 'This invoice cannot be edited'}</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {language === 'ar'
                ? 'الفواتير المصفّاة لدى هيئة الزكاة أو الملغاة لا يمكن إعادتها إلى مسودة من هنا.'
                : 'ZATCA-cleared or cancelled invoices cannot be reset to draft here.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (invoice?.flow === 'purchase') {
    return <InvoicePurchaseComposer invoiceId={id} initialInvoice={invoice} />
  }

  return <InvoiceSellComposer invoiceId={id} initialInvoice={invoice} />
}

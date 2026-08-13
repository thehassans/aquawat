import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Download, Mail, Printer, Edit, FileSpreadsheet, FileText, CheckCircle, XCircle, PenLine } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview'
import { resolveQuotationTemplateId } from '../../lib/invoiceTemplates'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'
import { buildQuotationPdfBlob, downloadQuotationPdf, printQuotationSnapshot } from '../../lib/invoicePdf'
import { exportToExcel } from '../../lib/export'
import { tenantHasEmailAddon } from '../../lib/emailAddon'

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    const parts = result.split(',', 2)
    resolve(parts[1] || '')
  }
  reader.onerror = () => reject(reader.error || new Error('Failed to read PDF attachment'))
  reader.readAsDataURL(blob)
})

const sanitizeAttachmentFileName = (value) => {
  const normalized = String(value || 'quotation')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || 'quotation'
}

const isEditableQuotation = (quotation) => ['draft', 'sent'].includes(String(quotation?.status || '').toLowerCase())
const canApproveQuotation = (quotation) => ['draft', 'sent', 'accepted', 'rejected'].includes(String(quotation?.status || '').toLowerCase()) && !quotation?.convertedInvoiceId
const canRejectQuotation = (quotation) => ['draft', 'sent', 'accepted', 'approved'].includes(String(quotation?.status || '').toLowerCase()) && !quotation?.convertedInvoiceId
const canConvertQuotation = (quotation) => String(quotation?.status || '').toLowerCase() === 'approved' && !quotation?.convertedInvoiceId

export default function QuotationView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const previewRef = useRef(null)
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => api.get(`/quotations/${id}`).then((res) => res.data),
  })

  const hasEmailAddon = tenantHasEmailAddon(tenant)
  const convertedInvoiceId = quotation?.convertedInvoiceId?._id || quotation?.convertedInvoiceId || ''
  const convertedInvoiceNumber = quotation?.convertedInvoiceId?.invoiceNumber || ''
  const templateId = resolveQuotationTemplateId(quotation?.pdfTemplateId)

  const excelRows = useMemo(() => (Array.isArray(quotation?.lineItems) ? quotation.lineItems : []).map((line, index) => ({
    no: index + 1,
    item: language === 'ar' ? (line?.productNameAr || line?.productName || '') : (line?.productName || line?.productNameAr || ''),
    description: language === 'ar' ? (line?.descriptionAr || line?.description || '') : (line?.description || line?.descriptionAr || ''),
    quantity: Number(line?.quantity || 0),
    unitPrice: Number(line?.unitPrice || 0),
    taxRate: Number(line?.taxRate || 0),
    taxAmount: Number(line?.taxAmount || 0),
    total: Number(line?.lineTotalWithTax || 0),
  })), [language, quotation?.lineItems])

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!quotation) throw new Error(language === 'ar' ? 'عرض السعر غير متاح' : 'Quotation is unavailable')
      const attachmentBlob = await buildQuotationPdfBlob({ quotation, language, tenant, sourceElement: previewRef.current })
      if (!(attachmentBlob instanceof Blob)) {
        throw new Error(language === 'ar' ? 'تعذر تجهيز ملف PDF' : 'Unable to prepare PDF attachment')
      }
      const contentBase64 = await blobToBase64(attachmentBlob)
      return await api.post(`/quotations/${id}/send-email`, {
        language,
        attachment: {
          filename: `${sanitizeAttachmentFileName(quotation?.quotationNumber)}.pdf`,
          contentBase64,
          contentType: 'application/pdf',
          size: attachmentBlob.size,
        },
      }, { timeout: 120000 })
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال عرض السعر عبر البريد' : 'Quotation email sent successfully')
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to send quotation email')
    },
  })

  const approveMutation = useMutation({
    mutationFn: async () => await api.post(`/quotations/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      toast.success(language === 'ar' ? 'تم اعتماد عرض السعر' : 'Quotation approved successfully')
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.message || (language === 'ar' ? 'تعذر اعتماد عرض السعر' : 'Unable to approve quotation'))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => await api.post(`/quotations/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      toast.success(language === 'ar' ? 'تم رفض عرض السعر' : 'Quotation rejected successfully')
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.message || (language === 'ar' ? 'تعذر رفض عرض السعر' : 'Unable to reject quotation'))
    },
  })

  const convertMutation = useMutation({
    mutationFn: async () => await api.post(`/quotations/${id}/convert-to-invoice`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(language === 'ar' ? 'تم تحويل عرض السعر إلى فاتورة بنجاح' : 'Quotation converted to invoice successfully')
      const invoiceId = response?.data?.invoiceId
      if (invoiceId) {
        navigate(`/app/dashboard/invoices/${invoiceId}`)
      }
    },
    onError: (error) => {
      const existingInvoiceId = error?.response?.data?.invoiceId
      if (existingInvoiceId) {
        toast.success(language === 'ar' ? 'تم تحويل عرض السعر مسبقاً' : 'This quotation was already converted')
        navigate(`/app/dashboard/invoices/${existingInvoiceId}`)
        return
      }
      toast.error(error?.response?.data?.error || error?.message || (language === 'ar' ? 'تعذر تحويل عرض السعر إلى فاتورة' : 'Unable to convert quotation to invoice'))
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quotation) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quotation?.quotationNumber}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{quotation?.issueDate ? new Date(quotation.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {canApproveQuotation(quotation) ? (
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="btn btn-primary"
            >
              {approveMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {language === 'ar' ? 'اعتماد' : 'Approve'}
            </button>
          ) : null}
          {canRejectQuotation(quotation) ? (
            <button
              type="button"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="btn btn-secondary"
            >
              {rejectMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {language === 'ar' ? 'رفض' : 'Reject'}
            </button>
          ) : null}
          {convertedInvoiceId ? (
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/invoices/${convertedInvoiceId}`)}
              className="btn btn-secondary"
            >
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'عرض الفاتورة' : 'View Invoice'}
            </button>
          ) : canConvertQuotation(quotation) ? (
            <button
              type="button"
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
              className="btn btn-primary"
            >
              {convertMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {language === 'ar' ? 'تحويل إلى فاتورة' : 'Convert to Invoice'}
            </button>
          ) : !convertedInvoiceId ? (
            <button type="button" className="btn btn-secondary" disabled>
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'يتطلب الاعتماد للتحويل' : 'Approval Required to Convert'}
            </button>
          ) : null}
          {isEditableQuotation(quotation) ? (
            <button type="button" onClick={() => navigate(`/app/dashboard/quotations/${id}/edit`)} className="btn btn-secondary">
              <Edit className="w-4 h-4" />
              {language === 'ar' ? 'تعديل' : 'Edit'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              try {
                const printed = await printQuotationSnapshot({ quotation, language, tenant, sourceElement: previewRef.current })
                if (!printed) {
                  toast.error(language === 'ar' ? 'تعذر تجهيز الطباعة' : 'Unable to prepare print view')
                }
              } catch {
                toast.error(language === 'ar' ? 'تعذر تجهيز الطباعة' : 'Unable to prepare print view')
              }
            }}
            className="btn btn-secondary"
          >
            <Printer className="w-4 h-4" />
            {language === 'ar' ? 'طباعة' : 'Print'}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                setDownloadingPdf(true)
                await downloadQuotationPdf({ quotation, language, tenant, sourceElement: previewRef.current })
              } catch {
                toast.error(language === 'ar' ? 'فشل تحميل PDF' : 'Failed to download PDF')
              } finally {
                setDownloadingPdf(false)
              }
            }}
            className="btn btn-secondary"
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PDF
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                setDownloadingPdf(true)
                await downloadQuotationPdf({ quotation, language, tenant, editable: true })
                toast.success(language === 'ar' ? 'تم تنزيل PDF قابل للتعديل' : 'Editable PDF downloaded — open in Foxit or Adobe to edit text')
              } catch {
                toast.error(language === 'ar' ? 'فشل تحميل PDF' : 'Failed to download PDF')
              } finally {
                setDownloadingPdf(false)
              }
            }}
            className="btn btn-secondary"
            disabled={downloadingPdf}
          >
            <PenLine className="w-4 h-4" />
            {language === 'ar' ? 'PDF للتعديل' : 'Editable PDF'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await exportToExcel({
                  fileName: sanitizeAttachmentFileName(quotation?.quotationNumber || 'quotation'),
                  sheetName: 'Quotation',
                  rows: excelRows,
                  columns: [
                    { key: 'no', label: '#' },
                    { key: 'item', label: language === 'ar' ? 'البند' : 'Item' },
                    { key: 'description', label: language === 'ar' ? 'الوصف' : 'Description' },
                    { key: 'quantity', label: language === 'ar' ? 'الكمية' : 'Qty' },
                    { key: 'unitPrice', label: language === 'ar' ? 'سعر الوحدة' : 'Unit Price' },
                    { key: 'taxRate', label: language === 'ar' ? 'الضريبة %' : 'Tax %' },
                    { key: 'taxAmount', label: language === 'ar' ? 'الضريبة' : 'Tax' },
                    { key: 'total', label: language === 'ar' ? 'الإجمالي' : 'Total' },
                  ],
                })
              } catch {
                toast.error(language === 'ar' ? 'فشل تصدير Excel' : 'Failed to export Excel')
              }
            }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          {hasEmailAddon && (
            <button type="button" onClick={() => sendEmailMutation.mutate()} disabled={sendEmailMutation.isPending} className="btn btn-secondary">
              {sendEmailMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {language === 'ar' ? 'إرسال بالبريد' : 'Send Email'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_300px]">
        <div ref={previewRef}>
          <InvoiceLivePreview
            invoice={quotation}
            tenant={tenant}
            language={language}
            templateId={templateId}
            bilingual={resolveInvoiceBilingual(tenant, true)}
            secondaryLanguage={getInvoiceSecondaryLanguage(tenant) || undefined}
            documentType="quotation"
          />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'ملخص عرض السعر' : 'Quotation Summary'}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>{language === 'ar' ? 'الحالة' : 'Status'}</span><span className="font-semibold">{quotation?.status || 'draft'}</span></div>
              <div className="flex items-center justify-between"><span>{language === 'ar' ? 'العميل' : 'Customer'}</span><span className="font-semibold text-end">{language === 'ar' ? (quotation?.buyer?.nameAr || quotation?.buyer?.name || '—') : (quotation?.buyer?.name || quotation?.buyer?.nameAr || '—')}</span></div>
              <div className="flex items-center justify-between"><span>{language === 'ar' ? 'صالح حتى' : 'Valid Until'}</span><span className="font-semibold">{quotation?.validUntil ? new Date(quotation.validUntil).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}</span></div>
              {quotation?.approvedAt ? (
                <div className="flex items-center justify-between"><span>{language === 'ar' ? 'اعتمد في' : 'Approved At'}</span><span className="font-semibold">{new Date(quotation.approvedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span></div>
              ) : null}
              {quotation?.approvedByName || quotation?.approvedByNameAr ? (
                <div className="flex items-center justify-between"><span>{language === 'ar' ? 'اعتمد بواسطة' : 'Approved By'}</span><span className="font-semibold text-end">{language === 'ar' ? (quotation?.approvedByNameAr || quotation?.approvedByName || '—') : (quotation?.approvedByName || quotation?.approvedByNameAr || '—')}</span></div>
              ) : null}
              {quotation?.rejectedAt ? (
                <div className="flex items-center justify-between"><span>{language === 'ar' ? 'رُفض في' : 'Rejected At'}</span><span className="font-semibold">{new Date(quotation.rejectedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span></div>
              ) : null}
              {quotation?.rejectedByName || quotation?.rejectedByNameAr ? (
                <div className="flex items-center justify-between"><span>{language === 'ar' ? 'رُفض بواسطة' : 'Rejected By'}</span><span className="font-semibold text-end">{language === 'ar' ? (quotation?.rejectedByNameAr || quotation?.rejectedByName || '—') : (quotation?.rejectedByName || quotation?.rejectedByNameAr || '—')}</span></div>
              ) : null}
              {convertedInvoiceId ? (
                <button
                  type="button"
                  onClick={() => navigate(`/app/dashboard/invoices/${convertedInvoiceId}`)}
                  className="flex w-full items-center justify-between border-t border-gray-200 dark:border-dark-600 pt-3 text-start text-primary-600 hover:underline"
                >
                  <span>{language === 'ar' ? 'الفاتورة الناتجة' : 'Converted Invoice'}</span>
                  <span className="font-semibold">{convertedInvoiceNumber || (language === 'ar' ? 'عرض' : 'Open')}</span>
                </button>
              ) : null}
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-dark-600 pt-3"><span>{language === 'ar' ? 'الإجمالي النهائي' : 'Grand Total'}</span><span className="font-bold">{Number(quotation?.grandTotal || 0).toFixed(2)} {quotation?.currency || 'SAR'}</span></div>
            </div>
          </div>
          {quotation?.notes ? (
            <div className="card p-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'ملاحظات' : 'Notes'}</h3>
              <p className="mt-3 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{quotation.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Download, Mail, Printer, Edit, FileSpreadsheet, CheckCircle, XCircle, PenLine, MessageCircle, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview'
import { resolveQuotationTemplateId } from '../../lib/invoiceTemplates'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'
import { buildQuotationPdfBlob, downloadQuotationPdf, printQuotationSnapshot } from '../../lib/invoicePdf'
import { exportToExcel } from '../../lib/export'
import { tenantHasEmailAddon } from '../../lib/emailAddon'
import {
  actionBarClass,
  backBtnClass,
  ghostActionClass,
  metaRowClass,
  metaValueClass,
  pageSubtitleClass,
  pageTitleClass,
  sectionCardClass,
  sectionEyebrowClass,
} from '../sales/salesUi'

const trimPartyName = (value) => String(value || '').trim()

function PartyNames({ party, fallback = '—' }) {
  const en = trimPartyName(party?.name)
  const ar = trimPartyName(party?.nameAr)
  if (en && ar && en !== ar) {
    return (
      <span className="block leading-snug text-end">
        <span className="block font-semibold text-gray-900 dark:text-white">{en}</span>
        <span className="block font-medium text-gray-800 dark:text-slate-100" dir="rtl">{ar}</span>
      </span>
    )
  }
  return <span className="font-semibold text-gray-900 dark:text-white">{en || ar || fallback}</span>
}

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
const isConverted = (quotation) => Boolean(quotation?.convertedOrderId || quotation?.convertedInvoiceId)
const canApproveQuotation = (quotation) => ['draft', 'sent', 'accepted', 'rejected'].includes(String(quotation?.status || '').toLowerCase()) && !isConverted(quotation)
const canRejectQuotation = (quotation) => ['draft', 'sent', 'accepted', 'approved'].includes(String(quotation?.status || '').toLowerCase()) && !isConverted(quotation)

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
  const convertedOrderId = quotation?.convertedOrderId?._id || quotation?.convertedOrderId || ''
  const convertedOrderNumber = quotation?.convertedOrderId?.poNumber || ''
  const templateId = resolveQuotationTemplateId(quotation?.pdfTemplateId)

  const excelRows = useMemo(() => (Array.isArray(quotation?.lineItems) ? quotation.lineItems : []).map((line, index) => ({
    no: index + 1,
    item: language === 'ar' ? (line?.productNameAr || line?.productName || '') : (line?.productName || line?.productNameAr || ''),
    productType: language === 'ar' ? (line?.productType === 'service' ? 'خدمة' : 'بضاعة') : (line?.productType === 'service' ? 'Service' : 'Goods'),
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

  const sendWhatsAppMutation = useMutation({
    mutationFn: async () => {
      if (!quotation) throw new Error(language === 'ar' ? 'عرض السعر غير متاح' : 'Quotation is unavailable')
      return await api.post(`/quotations/${id}/send-whatsapp`, { language })
    },
    onSuccess: (res) => {
      const data = res?.data || {}
      if (data?.channel === 'direct_whatsapp') {
        toast.success(language === 'ar' ? 'تم إرسال عرض السعر عبر واتساب بنجاح' : 'Quotation sent via WhatsApp successfully')
      } else if (data?.waLink) {
        window.open(data.waLink, '_blank')
        toast.success(language === 'ar' ? 'جاري فتح واتساب لإرسال عرض السعر...' : 'Opening WhatsApp...')
      } else {
        toast.success(language === 'ar' ? 'تم إرسال عرض السعر عبر واتساب' : 'Quotation sent via WhatsApp')
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.message || (language === 'ar' ? 'فشل إرسال واتساب' : 'Failed to send WhatsApp'))
    }
  })

  const approveMutation = useMutation({
    mutationFn: async () => await api.post(`/quotations/${id}/approve`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      const orderId = response?.data?.orderId
      toast.success(
        language === 'ar'
          ? 'تم الاعتماد وإنشاء أمر البيع'
          : 'Quotation approved — sales order created',
      )
      if (orderId) {
        navigate(`/app/dashboard/sales/orders/${orderId}`)
      }
    },
    onError: (error) => {
      const existingOrderId = error?.response?.data?.orderId
      if (existingOrderId) {
        navigate(`/app/dashboard/sales/orders/${existingOrderId}`)
        return
      }
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => navigate(-1)} className={backBtnClass}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className={sectionEyebrowClass}>
              {language === 'ar' ? 'عرض سعر' : 'Quotation'}
            </p>
            <h1 className={pageTitleClass}>{quotation?.quotationNumber}</h1>
            <p className={pageSubtitleClass}>
              {quotation?.issueDate ? new Date(quotation.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}
            </p>
          </div>
        </div>

        <div className={`${actionBarClass} max-w-3xl justify-start lg:justify-end`}>
          {canApproveQuotation(quotation) ? (
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="btn btn-action-dark btn-sm"
            >
              {approveMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {language === 'ar' ? 'اعتماد وإنشاء أمر بيع' : 'Approve → Sales order'}
            </button>
          ) : null}
          {canRejectQuotation(quotation) ? (
            <button
              type="button"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className={ghostActionClass}
            >
              {rejectMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {language === 'ar' ? 'رفض' : 'Reject'}
            </button>
          ) : null}
          {convertedOrderId ? (
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/sales/orders/${convertedOrderId}`)}
              className={ghostActionClass}
            >
              <ShoppingCart className="w-4 h-4" />
              {language === 'ar' ? `أمر البيع ${convertedOrderNumber || ''}`.trim() : `Sales order ${convertedOrderNumber || ''}`.trim()}
            </button>
          ) : null}

          {isEditableQuotation(quotation) ? (
            <button type="button" onClick={() => navigate(`/app/dashboard/quotations/${id}/edit`)} className={ghostActionClass}>
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
            className={ghostActionClass}
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
            className={ghostActionClass}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
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
            className={ghostActionClass}
            disabled={downloadingPdf}
          >
            <PenLine className="w-4 h-4" />
            {language === 'ar' ? 'PDF للتعديل' : 'Editable PDF'}
          </button>
          <button
            type="button"
            className={ghostActionClass}
            onClick={async () => {
              try {
                await exportToExcel({
                  fileName: sanitizeAttachmentFileName(quotation?.quotationNumber || 'quotation'),
                  sheetName: 'Quotation',
                  rows: excelRows,
                  columns: [
                    { key: 'no', label: '#' },
                    { key: 'item', label: language === 'ar' ? 'البند' : 'Item' },
                    { key: 'productType', label: language === 'ar' ? 'النوع' : 'Type' },
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
            <button type="button" onClick={() => sendEmailMutation.mutate()} disabled={sendEmailMutation.isPending} className={ghostActionClass}>
              {sendEmailMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {language === 'ar' ? 'بريد' : 'Email'}
            </button>
          )}
          <button
            type="button"
            onClick={() => sendWhatsAppMutation.mutate()}
            disabled={sendWhatsAppMutation.isPending}
            className={ghostActionClass}
            title={language === 'ar' ? 'إرسال عرض السعر عبر واتساب' : 'Send quotation via WhatsApp'}
          >
            {sendWhatsAppMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            WhatsApp
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_300px]">
        <div ref={previewRef} className={sectionCardClass}>
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
          <div className={sectionCardClass}>
            <p className={sectionEyebrowClass}>{language === 'ar' ? 'الملخص' : 'Summary'}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'ملخص عرض السعر' : 'Quotation summary'}
            </h3>
            <div className="mt-4 space-y-3">
              <div className={metaRowClass}><span>{language === 'ar' ? 'الحالة' : 'Status'}</span><span className={metaValueClass}>{quotation?.status || 'draft'}</span></div>
              <div className={metaRowClass}><span>{language === 'ar' ? 'العميل' : 'Customer'}</span><PartyNames party={quotation?.buyer} /></div>
              <div className={metaRowClass}><span>{language === 'ar' ? 'صالح حتى' : 'Valid Until'}</span><span className={metaValueClass}>{quotation?.validUntil ? new Date(quotation.validUntil).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}</span></div>
              {quotation?.approvedAt ? (
                <div className={metaRowClass}><span>{language === 'ar' ? 'اعتمد في' : 'Approved At'}</span><span className={metaValueClass}>{new Date(quotation.approvedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span></div>
              ) : null}
              {quotation?.approvedByName || quotation?.approvedByNameAr ? (
                <div className={metaRowClass}><span>{language === 'ar' ? 'اعتمد بواسطة' : 'Approved By'}</span><span className={metaValueClass}>{language === 'ar' ? (quotation?.approvedByNameAr || quotation?.approvedByName || '—') : (quotation?.approvedByName || quotation?.approvedByNameAr || '—')}</span></div>
              ) : null}
              {quotation?.rejectedAt ? (
                <div className={metaRowClass}><span>{language === 'ar' ? 'رُفض في' : 'Rejected At'}</span><span className={metaValueClass}>{new Date(quotation.rejectedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span></div>
              ) : null}
              {quotation?.rejectedByName || quotation?.rejectedByNameAr ? (
                <div className={metaRowClass}><span>{language === 'ar' ? 'رُفض بواسطة' : 'Rejected By'}</span><span className={metaValueClass}>{language === 'ar' ? (quotation?.rejectedByNameAr || quotation?.rejectedByName || '—') : (quotation?.rejectedByName || quotation?.rejectedByNameAr || '—')}</span></div>
              ) : null}
              {convertedOrderId ? (
                <button
                  type="button"
                  onClick={() => navigate(`/app/dashboard/sales/orders/${convertedOrderId}`)}
                  className="flex w-full items-center justify-between border-t border-slate-100 pt-3 text-start text-teal-700 hover:underline dark:border-white/10 dark:text-teal-300"
                >
                  <span>{language === 'ar' ? 'أمر البيع' : 'Sales order'}</span>
                  <span className="font-semibold">{convertedOrderNumber || (language === 'ar' ? 'عرض' : 'Open')}</span>
                </button>
              ) : null}
              <div className={`${metaRowClass} border-t border-slate-100 pt-3 dark:border-white/10`}>
                <span>{language === 'ar' ? 'الإجمالي النهائي' : 'Grand Total'}</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{Number(quotation?.grandTotal || 0).toFixed(2)} {quotation?.currency || 'SAR'}</span>
              </div>
            </div>
          </div>
          {quotation?.notes ? (
            <div className={sectionCardClass}>
              <p className={sectionEyebrowClass}>{language === 'ar' ? 'ملاحظات' : 'Notes'}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'ملاحظات' : 'Notes'}
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{quotation.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

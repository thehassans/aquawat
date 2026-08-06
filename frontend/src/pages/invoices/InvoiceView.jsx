import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Download, Send, CheckCircle, Clock, QrCode, Printer, Mail, Edit, RefreshCw, Undo2, Trash2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { buildInvoicePdfBlob, downloadInvoicePdf, printInvoiceSnapshot } from '../../lib/invoicePdf'
import { getZatcaStatusMeta, isEditableInvoice } from '../../lib/zatcaStatus'
import { getTravelInvoiceLabelMeta, isTravelAgencyInvoice } from '../../lib/travelInvoiceStatus'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { printThermalElement, getThermalPrinterSettings } from '../../lib/thermalPrinter'

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
  const normalized = String(value || 'invoice')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || 'invoice'
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

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const invoicePreviewRef = useRef(null)
  const printModalRef = useRef(null)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then(res => res.data)
  })

  const templateId = getInvoiceTemplateId(tenant, invoice?.businessContext, invoice?.pdfTemplateId)
  const invoiceTypeLabel = invoice?.transactionType === 'B2B' ? t('b2bInvoice') : t('b2cInvoice')
  const zatcaStatusMeta = getZatcaStatusMeta(invoice, language, tenant?.zatca?.phase || 2)
  const travelInvoiceLabelMeta = isTravelAgencyInvoice(invoice) ? getTravelInvoiceLabelMeta(invoice, language) : null
  const isBilingualInvoice = invoice?.invoiceSubtype === 'travel_ticket' || ['travel_agency', 'trading', 'construction', 'boutique'].includes(invoice?.businessContext)
  const hasEmailAddon = tenant?.subscription?.hasEmailAddon === true || (Array.isArray(tenant?.subscription?.features) && tenant.subscription.features.includes('email_automation'))
  
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const posTenants = ['bakala', 'super market', 'khayyat', 'saloon', 'laundry', 'restaurant']
  const isPosTenant = tenantBusinessTypes.some(t => posTenants.includes(t))
  const isPosInvoice = ['restaurant', 'bakala', 'saloon', 'laundry', 'khayyat'].includes(invoice?.businessContext)
  // Trading context always uses A4 — never thermal regardless of tenant type
  const isTradingInvoice = invoice?.businessContext === 'trading'
  const showThermal = !isTradingInvoice && (isPosTenant || isPosInvoice)

  const signMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/sign`, undefined, { timeout: 120000 }),
    onSuccess: (response) => {
      toast.success(language === 'ar' ? 'تم توقيع الفاتورة بنجاح' : 'Invoice signed successfully')
      if (response?.data?.emailDelivery?.sent) {
        toast.success(language === 'ar' ? 'تم إرسال الفاتورة إلى البريد الإلكتروني' : 'Invoice emailed successfully')
      }
      queryClient.invalidateQueries(['invoice', id])
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['dashboard'])
      queryClient.invalidateQueries(['dashboard-revenue'])
      queryClient.invalidateQueries(['travel-bookings'])
      queryClient.invalidateQueries(['customers'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to sign invoice')
    }
  })

  const convertProformaMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/convert-proforma`),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم تحويل الفاتورة المبدئية بنجاح' : 'Proforma converted to invoice successfully')
      queryClient.invalidateQueries(['invoices'])
      navigate(`/app/dashboard/invoices/${res.data._id}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to convert proforma')
    }
  })

  const creditNoteMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/credit-note`),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إصدار إشعار دائن بنجاح' : 'Credit note issued successfully')
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['invoice', id])
      navigate(`/app/dashboard/invoices/${res.data._id}/edit`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to issue credit note')
    }
  })

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error(language === 'ar' ? 'الفاتورة غير متاحة' : 'Invoice is unavailable')
      }

      const attachmentBlob = await buildInvoicePdfBlob({
        invoice,
        language,
        tenant,
        sourceElement: invoicePreviewRef.current,
      })

      if (!(attachmentBlob instanceof Blob)) {
        throw new Error(language === 'ar' ? 'تعذر تجهيز ملف PDF' : 'Unable to prepare PDF attachment')
      }

      const contentBase64 = await blobToBase64(attachmentBlob)
      return await api.post(`/invoices/${id}/send-email`, {
        language,
        attachment: {
          filename: `${sanitizeAttachmentFileName(invoice?.invoiceNumber)}.pdf`,
          contentBase64,
          contentType: 'application/pdf',
          size: attachmentBlob.size,
        },
      }, { timeout: 120000 })
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال الفاتورة عبر البريد' : 'Invoice email sent successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to send invoice email')
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{invoice?.invoiceNumber}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {new Date(invoice?.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
              {' '}
              <span className="text-gray-400 text-sm">{new Date(invoice?.issueDate).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
            {(() => {
              const createdByEn = [invoice?.createdBy?.firstName, invoice?.createdBy?.lastName].filter(Boolean).join(' ')
              const createdByAr = [invoice?.createdBy?.firstNameAr, invoice?.createdBy?.lastNameAr].filter(Boolean).join(' ')
              const creator = language === 'ar'
                ? (invoice?.createdByNameAr || createdByAr || invoice?.createdByName || createdByEn)
                : (invoice?.createdByName || createdByEn || invoice?.createdByNameAr || createdByAr)
              return creator ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {language === 'ar' ? 'تم الإنشاء بواسطة' : 'Created by'}: <span className="font-medium text-gray-700 dark:text-gray-300">{creator}</span>
                </p>
              ) : null
            })()}
          </div>
        </div>
        <div className="flex gap-3">
          {isEditableInvoice(invoice, tenant?.zatca?.phase || 2) && (
            <button
              type="button"
              onClick={() => navigate(`/app/dashboard/invoices/${id}/edit`)}
              className="btn btn-secondary"
            >
              <Edit className="w-4 h-4" />
              {language === 'ar' ? 'تعديل' : 'Edit'}
            </button>
          )}
          {!isEditableInvoice(invoice, tenant?.zatca?.phase || 2) && 
           invoice?.invoiceSubtype !== 'proforma' && 
           !['cancelled', 'credited'].includes(invoice?.status) && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(language === 'ar' ? 'هل أنت متأكد من إصدار إشعار دائن لهذه الفاتورة؟ هذا الإجراء لا يمكن التراجع عنه وسيتم إنشاء فاتورة جديدة.' : 'Are you sure you want to issue a credit note for this invoice? This action cannot be undone and a new draft invoice will be created.')) {
                  creditNoteMutation.mutate()
                }
              }}
              disabled={creditNoteMutation.isPending}
              className="btn btn-secondary border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {creditNoteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              {language === 'ar' ? 'إصدار إشعار دائن (تعديل)' : 'Issue Credit Note (Edit)'}
            </button>
          )}
          {invoice?.invoiceSubtype === 'proforma' && invoice?.status !== 'cancelled' && invoice?.status !== 'sent' && (
            <button
              type="button"
              onClick={() => convertProformaMutation.mutate()}
              disabled={convertProformaMutation.isPending}
              className="btn btn-primary"
            >
              {convertProformaMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {language === 'ar' ? 'تحويل لفاتورة' : 'Convert to Invoice'}
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (showThermal) {
                setPrintModalOpen(true)
                return
              }
              try {
                const printed = await printInvoiceSnapshot({ invoice, language, tenant, sourceElement: invoicePreviewRef.current })
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
              if (showThermal) {
                setPrintModalOpen(true)
                return
              }
              try {
                setDownloadingPdf(true)
                await downloadInvoicePdf({ invoice, language, tenant, sourceElement: invoicePreviewRef.current })
              } catch (e) {
                toast.error(language === 'ar' ? 'فشل تحميل PDF' : 'Failed to download PDF')
              } finally {
                setDownloadingPdf(false)
              }
            }}
            disabled={!invoice || downloadingPdf}
            className="btn btn-secondary"
          >
            {downloadingPdf ? (
              <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {language === 'ar' ? 'PDF' : 'PDF'}
          </button>
          {invoice?.flow !== 'purchase' && hasEmailAddon && (
            <button
              type="button"
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending}
              className="btn btn-secondary"
            >
              {sendEmailMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {language === 'ar' ? 'إرسال بالبريد' : 'Send Email'}
            </button>
          )}
          {['draft', 'pending'].includes(invoice?.status) && !invoice?.zatca?.signedXml && invoice?.flow !== 'purchase' && invoice?.invoiceSubtype !== 'proforma' && (
            <button
              onClick={() => signMutation.mutate()}
              disabled={signMutation.isPending}
              className="btn btn-primary"
            >
              {signMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {tenant?.zatca?.phase === 1 ? (language === 'ar' ? 'تجهيز الفاتورة' : 'Finalize') : t('signInvoice')}
                </>
              )}
            </button>
          )}
          {invoice?.zatca?.signedXml && (
            <a
              href={`/api/invoices/${id}/xml`}
              target="_blank"
              className="btn btn-secondary"
            >
              <Download className="w-4 h-4" />
              {t('viewXml')}
            </a>
          )}
          {['admin', 'super_admin'].includes(tenant?.role) || ['draft', 'pending'].includes(invoice?.status) ? (
            <button
              type="button"
              onClick={async () => {
                const confirmed = window.confirm(
                  language === 'ar'
                    ? 'هل أنت متأكد من حذف هذه الفاتورة؟ هذا الإجراء لا يمكن التراجع عنه وسيتم حذف الفاتورة من قاعدة البيانات نهائياً.'
                    : 'Are you sure you want to permanently delete this invoice? This action cannot be undone.'
                )
                if (!confirmed) return
                try {
                  await api.delete(`/invoices/${id}`)
                  toast.success(language === 'ar' ? 'تم حذف الفاتورة بنجاح' : 'Invoice deleted successfully')
                  queryClient.invalidateQueries(['invoices'])
                  queryClient.invalidateQueries(['dashboard'])
                  navigate('/app/dashboard/invoices')
                } catch (error) {
                  toast.error(error?.response?.data?.error || (language === 'ar' ? 'فشل حذف الفاتورة' : 'Failed to delete invoice'))
                }
              }}
              className="btn btn-secondary border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
              {language === 'ar' ? 'حذف' : 'Delete'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'نوع الفاتورة' : 'Invoice Type'}</p>
                  {isTravelAgencyInvoice(invoice) ? (
                    <>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${travelInvoiceLabelMeta?.className}`}>
                        {getInvoiceContextLabel(invoice, language)}
                      </span>
                      <p className="mt-2 font-semibold text-gray-900 dark:text-white">{invoiceTypeLabel}</p>
                      <p className={`mt-1 text-xs font-medium ${travelInvoiceLabelMeta?.textClassName}`}>{travelInvoiceLabelMeta?.description}</p>
                    </>
                  ) : (
                    <p className="font-semibold text-gray-900 dark:text-white">{invoiceTypeLabel}</p>
                  )}
                </div>
              </div>
              
              {invoice?.invoiceSubtype === 'proforma' ? (
                <span className="badge badge-info text-sm">
                  {language === 'ar' ? 'فاتورة مبدئية (Proforma)' : 'Proforma Invoice'}
                </span>
              ) : (
                <span className={`badge ${
                  zatcaStatusMeta.tone === 'success' ? 'badge-success' :
                  zatcaStatusMeta.tone === 'info' ? 'badge-info' :
                  zatcaStatusMeta.tone === 'danger' ? 'badge-danger' :
                  zatcaStatusMeta.tone === 'warning' ? 'badge-warning' :
                  'badge-neutral'
                }`}>
                  {zatcaStatusMeta.tone === 'success' && <CheckCircle className="w-3 h-3 me-1" />}
                  {zatcaStatusMeta.tone !== 'success' && <Clock className="w-3 h-3 me-1" />}
                  {zatcaStatusMeta.label}
                </span>
              )}
            </div>

            <div ref={invoicePreviewRef} className={showThermal ? 'flex justify-center bg-gray-50 p-6 rounded-2xl border border-gray-100' : ''}>
              {showThermal ? (
                <ThermalReceipt
                  order={{
                    ...invoice,
                    receiptNumber: invoice.invoiceNumber,
                    customerName: invoice.buyer?.name || invoice.buyer?.nameAr,
                    customerPhone: invoice.buyer?.phone,
                    grandTotal: invoice.grandTotal,
                    totalVat: invoice.totalTax,
                    subtotal: invoice.subTotal || (invoice.grandTotal - invoice.totalTax),
                    zatcaQrCode: invoice.zatca?.qrCodeData,
                    items: invoice.lineItems?.map(item => ({
                      nameEn: item.productName || item.name,
                      nameAr: item.productNameAr || item.nameAr,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      total: item.taxableAmount || (item.quantity * item.unitPrice)
                    }))
                  }}
                  type={invoice?.businessContext || tenantBusinessTypes[0] || 'bakala'}
                />
              ) : (
                <InvoiceLivePreview
                  invoice={invoice}
                  tenant={tenant}
                  language={language}
                  templateId={templateId}
                  bilingual={isBilingualInvoice}
                  currencyRenderMode="icon"
                />
              )}
            </div>
          </motion.div>

          {(invoice?.restaurantOrderId || invoice?.travelBookingId || invoice?.contractNumber || invoice?.sourceQuotationId) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-6"
            >
              <p className="text-sm font-medium text-gray-500 mb-3">{language === 'ar' ? 'المرجع' : 'Reference'}</p>
              <div className="space-y-2 text-sm">
                {invoice?.restaurantOrderId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/app/dashboard/restaurant/orders/${invoice.restaurantOrderId}`)}
                    className="text-primary-600 hover:underline text-start"
                  >
                    {language === 'ar' ? 'طلب مطعم' : 'Restaurant Order'}: {String(invoice.restaurantOrderId).slice(-6)}
                  </button>
                )}
                {invoice?.travelBookingId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/app/dashboard/travel-bookings/${invoice.travelBookingId}`)}
                    className="text-primary-600 hover:underline text-start"
                  >
                    {language === 'ar' ? 'حجز سفر' : 'Travel Booking'}: {String(invoice.travelBookingId).slice(-6)}
                  </button>
                )}
                {invoice?.contractNumber && (
                  <div className="text-gray-700 dark:text-gray-200">
                    {language === 'ar' ? 'رقم العقد/المرجع' : 'Contract/Ref'}: {invoice.contractNumber}
                  </div>
                )}
                {invoice?.sourceQuotationId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/app/dashboard/quotations/${invoice?.sourceQuotationId?._id || invoice?.sourceQuotationId}`)}
                    className="flex items-center gap-2 text-primary-600 hover:underline text-start"
                  >
                    <FileText className="w-4 h-4" />
                    {language === 'ar' ? 'عرض السعر المصدر' : 'Source Quotation'}: {invoice?.sourceQuotationId?.quotationNumber || String(invoice?.sourceQuotationId).slice(-6)}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* QR Code — hidden on travel agency invoices */}
          {invoice?.zatca?.qrCodeData && invoice?.invoiceSubtype !== 'travel_ticket' && invoice?.businessContext !== 'travel_agency' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                {t('viewQr')}
              </h3>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <QRCodeSVG value={invoice.zatca.qrCodeData} size={180} />
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                {language === 'ar' ? 'رمز QR للفاتورة الإلكترونية' : 'E-Invoice QR Code'}
              </p>
            </motion.div>
          )}

          {/* ZATCA Info */}
          {invoice?.invoiceSubtype !== 'proforma' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {tenant?.zatca?.phase === 1 ? (language === 'ar' ? 'معلومات الفاتورة الإلكترونية' : 'E-Invoice Information') : (language === 'ar' ? 'معلومات هيئة الزكاة' : 'ZATCA Information')}
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">UUID</p>
                  <p className="text-sm font-mono break-all">{invoice?.zatca?.uuid || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{language === 'ar' ? 'رقم التسلسل' : 'Counter'}</p>
                  <p className="text-sm">{invoice?.zatca?.invoiceCounter || '-'}</p>
                </div>
                {invoice?.zatca?.submittedAt && (
                  <div>
                    <p className="text-xs text-gray-500">{language === 'ar' ? 'تاريخ الإرسال' : 'Submitted At'}</p>
                    <p className="text-sm">{new Date(invoice.zatca.submittedAt).toLocaleString()}</p>
                  </div>
                )}
                {invoice?.zatca?.invoiceHash && (
                  <div>
                    <p className="text-xs text-gray-500">{language === 'ar' ? 'تجزئة الفاتورة' : 'Invoice Hash'}</p>
                    <p className="text-xs font-mono break-all bg-gray-50 dark:bg-dark-700 p-2 rounded">
                      {invoice.zatca.invoiceHash}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {printModalOpen && showThermal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[400px] max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-lg font-bold">
                {language === 'ar' ? 'إيصال الفاتورة' : 'Invoice Receipt'}
              </h3>
              <button onClick={() => setPrintModalOpen(false)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">
                ×
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-2 print:border-none print:p-0 flex justify-center">
              <ThermalReceipt
                ref={printModalRef}
                order={{
                  ...invoice,
                  receiptNumber: invoice.invoiceNumber,
                  customerName: invoice.buyer?.name || invoice.buyer?.nameAr,
                  customerPhone: invoice.buyer?.phone,
                  grandTotal: invoice.grandTotal,
                  totalVat: invoice.totalTax,
                  subtotal: invoice.subTotal || (invoice.grandTotal - invoice.totalTax),
                  zatcaQrCode: invoice.zatca?.qrCodeData,
                  items: invoice.lineItems?.map(item => ({
                    nameEn: item.productName || item.name,
                    nameAr: item.productNameAr || item.nameAr,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.taxableAmount || (item.quantity * item.unitPrice)
                  }))
                }}
                type={invoice?.businessContext || tenantBusinessTypes[0] || 'bakala'}
                isUpdated={invoice?.updatedAt && invoice?.createdAt && new Date(invoice.updatedAt).getTime() > new Date(invoice.createdAt).getTime() + 5000}
              />
            </div>
            <div className="mt-6 flex gap-3 print:hidden">
              <button onClick={() => setPrintModalOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 text-gray-700">
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

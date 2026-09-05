import { useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { FileText, Download, Send, CheckCircle, Clock, QrCode, Printer, Mail, Edit, RefreshCw, Undo2, Trash2, Banknote, MessageCircle, Ban, RotateCcw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview'
import { getInvoiceTemplateId } from '../../lib/invoiceBranding'
import { buildInvoicePdfBlob, downloadInvoicePdf, printInvoiceSnapshot, isThermalInvoice } from '../../lib/invoicePdf'
import { getZatcaStatusMeta, isEditableInvoice } from '../../lib/zatcaStatus'
import { getTravelInvoiceLabelMeta, isTravelAgencyInvoice } from '../../lib/travelInvoiceStatus'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'
import ThermalReceipt from '../../components/ui/ThermalReceipt'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { tenantHasEmailAddon } from '../../lib/emailAddon'
import { tenantHasSmsAddon } from '../../lib/smsAddon'
import { printThermalElement, getThermalPrinterSettings } from '../../lib/thermalPrinter'
import { getTaxQrLabel, isSaudiTenant } from '../../lib/saudiTenant'
import DocumentChatter from '../../components/sales/DocumentChatter'
import AccountingDocumentShell from '../../components/accounting/AccountingDocumentShell'
import RegisterPaymentModal from '../../components/accounting/RegisterPaymentModal'
import CreditNoteFromInvoiceModal from '../../components/accounting/CreditNoteFromInvoiceModal'
import VendorRefundFromBillModal from '../../components/accounting/VendorRefundFromBillModal'
import CancelInvoiceModal from '../../components/accounting/CancelInvoiceModal'
import {
  BILL_STATUS_STEPS,
  canCancelInvoice,
  canResetInvoiceToDraft,
  canRegisterPaymentOnBill,
  canRegisterPaymentOnInvoice,
  CREDIT_NOTE_STATUS_STEPS,
  INVOICE_STATUS_STEPS,
  invoiceRemainingBalance,
  isVendorBill,
  isVendorRefund,
  resolveInvoiceRibbonStep,
  VENDOR_REFUND_STATUS_STEPS,
} from '../../lib/accountingDocumentStatus'
import {
  dangerActionClass,
  ghostActionClass,
  metaRowClass,
  metaValueClass,
  sectionCardClass,
  sectionEyebrowClass,
} from '../sales/salesUi'
import { getZatcaDocumentTitle, resolveInvoiceListNumber } from '../../lib/commercialDocumentLabels'

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
  return getZatcaDocumentTitle(invoice, language)
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
  const [payOpen, setPayOpen] = useState(false)
  const [cnModalOpen, setCnModalOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const invoicePreviewRef = useRef(null)
  const printModalRef = useRef(null)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then(res => res.data)
  })

  const { data: invoiceLots } = useQuery({
    queryKey: ['invoice-lots', id],
    queryFn: () => api.get(`/stock/invoices/${id}/lots`).then((res) => res.data),
    enabled: Boolean(id),
  })

  const { data: adjacentInvoices } = useQuery({
    queryKey: ['invoice-adjacent', id],
    queryFn: () => api.get(`/invoices/${id}/adjacent`).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 30000,
  })

  const invoiceForDisplay = useMemo(() => {
    if (!invoice) return invoice
    if (!invoiceLots?.enabled || !invoiceLots?.byProduct) return invoice
    const byProduct = invoiceLots.byProduct
    return {
      ...invoice,
      lineItems: (invoice.lineItems || []).map((item) => {
        const pid = String(item.productId?._id || item.productId || '')
        const hint = byProduct[pid]
        if (!hint) return item
        const lotLabel = language === 'ar' ? `دفعة: ${hint}` : `Lot: ${hint}`
        const description = item.description
          ? `${item.description}\n${lotLabel}`
          : lotLabel
        return { ...item, description, lotHint: hint }
      }),
    }
  }, [invoice, invoiceLots, language])

  const thermalItems = useMemo(() => {
    const src = invoiceForDisplay || invoice
    if (!src?.lineItems) return []
    return src.lineItems.map((item) => {
      const baseEn = item.productName || item.name || ''
      const baseAr = item.productNameAr || item.nameAr || ''
      const lot = item.lotHint
      return {
        nameEn: lot ? `${baseEn} (${lot})` : baseEn,
        nameAr: lot ? `${baseAr || baseEn} (${lot})` : baseAr,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.taxableAmount || (item.quantity * item.unitPrice),
      }
    })
  }, [invoiceForDisplay, invoice])

  const isSarTenant = isSaudiTenant(tenant) || String(invoice?.currency || tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'
  const templateId = getInvoiceTemplateId(tenant, invoice?.businessContext, invoice?.pdfTemplateId)
  const invoiceTypeLabel = invoice?.transactionType === 'B2B' ? t('b2bInvoice') : t('b2cInvoice')
  const zatcaStatusMeta = getZatcaStatusMeta(invoice, language, tenant?.zatca?.phase || 2)
  const standardStatusMeta = useMemo(() => {
    const invStatus = String(invoice?.status || 'draft').toLowerCase()
    const labels = {
      draft: language === 'ar' ? 'مسودة' : 'Draft',
      issued: language === 'ar' ? 'صادرة' : 'Issued',
      paid: language === 'ar' ? 'مدفوعة' : 'Paid',
      partially_paid: language === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
      approved: language === 'ar' ? 'معتمدة' : 'Approved',
      cancelled: language === 'ar' ? 'ملغاة' : 'Cancelled',
      overdue: language === 'ar' ? 'متأخرة' : 'Overdue',
    }
    const toneMap = {
      paid: 'badge-success',
      issued: 'badge-info',
      approved: 'badge-info',
      partially_paid: 'badge-warning',
      cancelled: 'badge-neutral',
      draft: 'badge-neutral',
      overdue: 'badge-danger',
    }
    return {
      label: labels[invStatus] || (language === 'ar' ? 'صادرة' : 'Issued'),
      badgeClass: toneMap[invStatus] || 'badge-neutral',
      isSuccess: invStatus === 'paid'
    }
  }, [invoice?.status, language])
  const travelInvoiceLabelMeta = isTravelAgencyInvoice(invoice) ? getTravelInvoiceLabelMeta(invoice, language) : null
  const isBilingualInvoiceContext = invoice?.invoiceSubtype === 'travel_ticket' || ['travel_agency', 'trading', 'construction', 'boutique'].includes(invoice?.businessContext)
  const isBilingualInvoice = resolveInvoiceBilingual(tenant, isBilingualInvoiceContext)
  const invoiceSecondaryLanguage = getInvoiceSecondaryLanguage(tenant) || undefined
  const hasEmailAddon = tenantHasEmailAddon(tenant)
  const hasSmsAddon = tenantHasSmsAddon(tenant)
  
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const showThermal = isThermalInvoice(invoice)

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
      navigate(`/app/dashboard/accounting/invoices/${res.data._id}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to convert proforma')
    }
  })

  const creditNoteMutation = useMutation({
    mutationFn: (payload) => api.post(`/invoices/${id}/credit-note`, payload),
    onSuccess: (res) => {
      const creditNote = res.data?.creditNote || res.data
      const draftBill = res.data?.draftBill
      toast.success(
        draftBill
          ? (language === 'ar' ? 'تم إنشاء المرتجع وفاتورة مسودة جديدة' : 'Refund and draft bill created')
          : (language === 'ar' ? 'تم إصدار إشعار دائن بنجاح' : 'Credit note issued successfully'),
      )
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['invoice', id])
      queryClient.invalidateQueries(['vendor-bills'])
      queryClient.invalidateQueries(['vendor-refunds'])
      setCnModalOpen(false)
      if (creditNote?._id) {
        navigate(`/app/dashboard/accounting/invoices/${creditNote._id}`)
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to issue credit note')
    }
  })

  const debitNoteMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/debit-note`),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إصدار إشعار مدين بنجاح' : 'Debit note issued successfully')
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['invoice', id])
      navigate(`/app/dashboard/accounting/invoices/${res.data._id}/edit`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to issue debit note')
    }
  })

  const cancelMutation = useMutation({
    mutationFn: (reason) => api.post(`/invoices/${id}/cancel`, { reason }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إلغاء الفاتورة' : 'Invoice cancelled')
      setCancelOpen(false)
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['invoice', id])
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['vendor-bills'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || (language === 'ar' ? 'فشل الإلغاء' : 'Cancel failed'))
    },
  })

  const resetDraftMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/reset-to-draft`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'أُعيدت إلى مسودة' : 'Reset to draft')
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['invoice', id])
      queryClient.invalidateQueries(['vendor-bills'])
      queryClient.invalidateQueries(['customer-payments'])
      queryClient.invalidateQueries(['vendor-payments'])
      navigate(`/app/dashboard/accounting/invoices/${id}/edit`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || (language === 'ar' ? 'فشلت إعادة المسودة' : 'Reset to draft failed'))
    },
  })

  const remainingBalance = invoiceRemainingBalance(invoice)
  const isPurchaseBill = isVendorBill(invoice)
  const isPurchaseRefund = isVendorRefund(invoice)
  const canRecordPayment = isPurchaseBill
    ? canRegisterPaymentOnBill(invoice)
    : canRegisterPaymentOnInvoice(invoice)
  const canCancel = canCancelInvoice(invoice, tenant?.zatca?.phase || 2)
  const canResetDraft = canResetInvoiceToDraft(invoice, tenant?.zatca?.phase || 2)
  const canOpenEditor = isEditableInvoice(invoice, tenant?.zatca?.phase || 2) || canResetDraft
  const isCreditNote = String(invoice?.invoiceType || '') === '381' && !isPurchaseBill
  const ribbonStep = resolveInvoiceRibbonStep(invoice)
  const statusSteps = isPurchaseRefund
    ? VENDOR_REFUND_STATUS_STEPS
    : (isCreditNote ? CREDIT_NOTE_STATUS_STEPS : (isPurchaseBill ? BILL_STATUS_STEPS : INVOICE_STATUS_STEPS))
  const paymentCount = Array.isArray(invoice?.payments) ? invoice.payments.length : 0

  const recordPaymentMutation = useMutation({
    mutationFn: (payload) => api.post(`/invoices/${id}/payments`, {
      amount: Number(payload?.amount),
      method: payload?.method,
      memo: payload?.memo,
      differenceMode: payload?.differenceMode,
      differenceAccountId: payload?.differenceAccountId,
      confirmNegativeCash: payload?.confirmNegativeCash === true,
    }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تسجيل الدفعة' : 'Payment recorded')
      setPayOpen(false)
      queryClient.invalidateQueries(['invoice', id])
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['vendor-bills'])
      queryClient.invalidateQueries(['vendor-payments'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || (language === 'ar' ? 'فشل تسجيل الدفعة' : 'Failed to record payment'))
    }
  })

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error(language === 'ar' ? 'الفاتورة غير متاحة' : 'Invoice is unavailable')
      }

      const attachmentBlob = await buildInvoicePdfBlob({
        invoice: invoiceForDisplay || invoice,
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

  const sendSmsMutation = useMutation({
    mutationFn: () => api.post(`/sms/invoices/${id}/send`, { language }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال الفاتورة عبر الرسائل' : 'Invoice SMS sent successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || (language === 'ar' ? 'فشل إرسال الرسالة' : 'Failed to send invoice SMS'))
    }
  })

  const sendWhatsAppMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error(language === 'ar' ? 'الفاتورة غير متاحة' : 'Invoice is unavailable')
      return await api.post(`/invoices/${id}/send-whatsapp`, { language })
    },
    onSuccess: (res) => {
      const data = res?.data || {}
      if (data?.channel === 'cloud_api' || data?.channel === 'qr_session') {
        toast.success(language === 'ar' ? 'تم إرسال الفاتورة عبر واتساب بنجاح' : 'Invoice sent via WhatsApp successfully')
      } else if (data?.waLink) {
        window.open(data.waLink, '_blank')
        toast.success(language === 'ar' ? 'جاري فتح واتساب لإرسال الفاتورة...' : 'Opening WhatsApp...')
      } else {
        toast.success(language === 'ar' ? 'تم إرسال الفاتورة عبر واتساب' : 'Invoice sent via WhatsApp')
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.message || (language === 'ar' ? 'فشل إرسال واتساب' : 'Failed to send WhatsApp'))
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
      <AccountingDocumentShell
        language={language}
        onBack={() => navigate(-1)}
        prevHref={adjacentInvoices?.prev?._id ? `/app/dashboard/accounting/invoices/${adjacentInvoices.prev._id}` : undefined}
        nextHref={adjacentInvoices?.next?._id ? `/app/dashboard/accounting/invoices/${adjacentInvoices.next._id}` : undefined}
        prevLabel={adjacentInvoices?.prev ? resolveInvoiceListNumber(adjacentInvoices.prev, language).label : undefined}
        nextLabel={adjacentInvoices?.next ? resolveInvoiceListNumber(adjacentInvoices.next, language).label : undefined}
        eyebrow={
          isPurchaseRefund
            ? (language === 'ar' ? 'مرتجع مورد' : 'Vendor refund')
            : isPurchaseBill
              ? (language === 'ar' ? 'فاتورة مورد' : 'Vendor bill')
              : isCreditNote
                ? (language === 'ar' ? 'إشعار دائن' : 'Credit note')
                : invoice?.flow === 'purchase'
                  ? (language === 'ar' ? 'فاتورة مشتريات' : 'Purchase invoice')
                  : (language === 'ar' ? 'فاتورة مبيعات' : 'Customer invoice')
        }
        title={resolveInvoiceListNumber(invoice, language).label}
        subtitle={`${new Date(invoice?.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')}${remainingBalance > 0.005 ? ` · ${language === 'ar' ? 'المتبقي' : 'Due'} ${remainingBalance.toFixed(2)}` : ''}`}
        statusSteps={statusSteps}
        activeStatusStep={ribbonStep}
        statusCancelled={['cancelled', 'credited'].includes(String(invoice?.status || '').toLowerCase()) && ribbonStep === 'cancelled'}
        smartButtons={[
          ...(invoice?.originalInvoiceId ? [{
            id: 'reversed-doc',
            label: (lang) => (lang === 'ar' ? 'الفاتورة الأصلية' : 'Reversed document'),
            href: `/app/dashboard/accounting/invoices/${invoice.originalInvoiceId?._id || invoice.originalInvoiceId}`,
            icon: <FileText className="h-3.5 w-3.5" />,
          }] : []),
          ...((invoice?.sourcePurchaseOrderId || invoice?.purchaseOrderId) && invoice?.flow === 'sell' ? [{
            id: 'sales-order',
            label: (lang) => (lang === 'ar' ? '1 أمر بيع' : '1 Sales Order'),
            href: `/app/dashboard/sales/orders/${invoice.sourcePurchaseOrderId || invoice.purchaseOrderId}`,
            icon: <FileText className="h-3.5 w-3.5" />,
          }] : []),
          ...((invoice?.sourcePurchaseOrderId) && invoice?.flow === 'purchase' ? [{
            id: 'purchase-order',
            label: (lang) => (lang === 'ar' ? '1 أمر شراء' : '1 Purchase Order'),
            href: `/app/dashboard/purchases/orders/${invoice.sourcePurchaseOrderId?._id || invoice.sourcePurchaseOrderId}`,
            icon: <FileText className="h-3.5 w-3.5" />,
          }] : []),
          ...(paymentCount > 0 ? [{
            id: 'payments',
            label: (lang) => (lang === 'ar' ? `${paymentCount} مدفوعات` : `${paymentCount} Payments`),
            onClick: () => setPayOpen(true),
            icon: <Banknote className="h-3.5 w-3.5" />,
          }] : []),
        ]}
        actionBar={(
          <>
            {canRecordPayment && (
              <button type="button" onClick={() => setPayOpen(true)} className="btn btn-action-dark btn-sm">
                <Banknote className="w-4 h-4" />
                {language === 'ar' ? 'تسجيل دفعة' : (isPurchaseBill ? 'Register payment' : 'Register payment')}
              </button>
            )}
            {canOpenEditor && String(invoice?.status || '').toLowerCase() === 'draft' ? (
              <button
                type="button"
                onClick={() => navigate(`/app/dashboard/accounting/invoices/${id}/edit`)}
                className="btn btn-action-dark btn-sm"
              >
                <Send className="w-4 h-4" />
                {language === 'ar' ? 'ترحيل' : 'Post'}
              </button>
            ) : null}
            {canOpenEditor && (
              <button type="button" onClick={() => navigate(`/app/dashboard/accounting/invoices/${id}/edit`)} className={ghostActionClass}>
                <Edit className="w-4 h-4" />
                {language === 'ar' ? 'تعديل' : 'Edit'}
              </button>
            )}
            {!canOpenEditor
              && invoice?.invoiceSubtype !== 'proforma'
              && invoice?.invoiceType === '388'
              && !['cancelled', 'credited'].includes(invoice?.status) && (
                <>
                  <button
                    type="button"
                    onClick={() => setCnModalOpen(true)}
                    disabled={creditNoteMutation.isPending || debitNoteMutation.isPending}
                    className={dangerActionClass}
                  >
                    {creditNoteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                    {isPurchaseBill
                      ? (language === 'ar' ? 'مرتجع مورد' : 'Add credit note')
                      : (language === 'ar' ? 'إشعار دائن' : 'Add credit note')}
                  </button>
                  {!isPurchaseBill ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(language === 'ar' ? 'إصدار إشعار مدين؟' : 'Issue a debit note?')) {
                        debitNoteMutation.mutate()
                      }
                    }}
                    disabled={creditNoteMutation.isPending || debitNoteMutation.isPending}
                    className={ghostActionClass}
                  >
                    {debitNoteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {language === 'ar' ? 'إشعار مدين' : 'Debit note'}
                  </button>
                  ) : null}
                </>
            )}
            {invoice?.invoiceSubtype === 'proforma' && invoice?.status !== 'cancelled' && invoice?.status !== 'sent' && (
              <button type="button" onClick={() => convertProformaMutation.mutate()} disabled={convertProformaMutation.isPending} className="btn btn-action-dark btn-sm">
                {convertProformaMutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {language === 'ar' ? 'تحويل لفاتورة' : 'Convert to Invoice'}
              </button>
            )}
            {canResetDraft && (
              <button
                type="button"
                onClick={() => {
                  const paid = Number(invoice?.paidAmount || 0) > 0.005
                    || (Array.isArray(invoice?.payments) && invoice.payments.length > 0)
                  const ok = window.confirm(
                    language === 'ar'
                      ? (paid
                        ? 'إعادة الفاتورة إلى مسودة؟ سيتم عكس القيود والمدفوعات المرتبطة.'
                        : 'إعادة الفاتورة إلى مسودة؟ سيتم عكس القيود المرتبطة.')
                      : (paid
                        ? 'Reset this invoice to draft? Linked journal entries and payments will be reversed.'
                        : 'Reset this invoice to draft? Linked journal entries will be reversed.'),
                  )
                  if (!ok) return
                  resetDraftMutation.mutate()
                }}
                disabled={resetDraftMutation.isPending}
                className={ghostActionClass}
              >
                {resetDraftMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {language === 'ar' ? 'إعادة إلى مسودة' : 'Reset to draft'}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                disabled={cancelMutation.isPending}
                className={dangerActionClass}
              >
                {cancelMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                if (showThermal) { setPrintModalOpen(true); return }
                try {
                  const printed = await printInvoiceSnapshot({ invoice: invoiceForDisplay || invoice, language, tenant, sourceElement: invoicePreviewRef.current })
                  if (!printed) toast.error(language === 'ar' ? 'تعذر تجهيز الطباعة' : 'Unable to prepare print view')
                } catch {
                  toast.error(language === 'ar' ? 'تعذر تجهيز الطباعة' : 'Unable to prepare print view')
                }
              }}
              className={ghostActionClass}
            >
              <Printer className="w-4 h-4" />
              {language === 'ar' ? 'معاينة' : 'Preview'}
            </button>
            {String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR' && ['draft', 'pending'].includes(invoice?.status) && !invoice?.zatca?.signedXml && invoice?.flow !== 'purchase' && invoice?.invoiceSubtype !== 'proforma' && (
              <button onClick={() => signMutation.mutate()} disabled={signMutation.isPending} className="btn btn-action-dark btn-sm">
                {signMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" />{tenant?.zatca?.phase === 1 ? (language === 'ar' ? 'تأكيد' : 'Confirm') : t('signInvoice')}</>}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                if (showThermal) { setPrintModalOpen(true); return }
                try {
                  setDownloadingPdf(true)
                  await downloadInvoicePdf({ invoice: invoiceForDisplay || invoice, language, tenant, sourceElement: invoicePreviewRef.current })
                } catch {
                  toast.error(language === 'ar' ? 'فشل تحميل PDF' : 'Failed to download PDF')
                } finally {
                  setDownloadingPdf(false)
                }
              }}
              disabled={!invoice || downloadingPdf}
              className={ghostActionClass}
            >
              {downloadingPdf ? <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
              PDF
            </button>
            {invoice?.flow !== 'purchase' && hasEmailAddon && (
              <button type="button" onClick={() => sendEmailMutation.mutate()} disabled={sendEmailMutation.isPending} className={ghostActionClass}>
                {sendEmailMutation.isPending ? <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
                {language === 'ar' ? 'إرسال' : 'Send'}
              </button>
            )}
            {invoice?.flow !== 'purchase' && (
              <button type="button" onClick={() => sendWhatsAppMutation.mutate()} disabled={sendWhatsAppMutation.isPending} className={ghostActionClass}>
                {sendWhatsAppMutation.isPending ? <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                WhatsApp
              </button>
            )}
            {invoice?.zatca?.signedXml && (
              <a href={`/api/invoices/${id}/xml`} target="_blank" rel="noreferrer" className={ghostActionClass}>
                <Download className="w-4 h-4" />
                {t('viewXml')}
              </a>
            )}
            {(['admin', 'super_admin'].includes(tenant?.role) || ['draft', 'pending'].includes(invoice?.status)) && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(language === 'ar' ? 'حذف هذه الفاتورة نهائياً؟' : 'Permanently delete this invoice?')) return
                  try {
                    await api.delete(`/invoices/${id}`)
                    toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted')
                    queryClient.invalidateQueries(['invoices'])
                    queryClient.invalidateQueries(['vendor-bills'])
                    queryClient.invalidateQueries(['customer-invoices'])
                    navigate(
                      invoice?.flow === 'purchase'
                        ? '/app/dashboard/accounting/invoices?tab=purchase'
                        : '/app/dashboard/accounting/invoices',
                    )
                  } catch (error) {
                    toast.error(error?.response?.data?.error || (language === 'ar' ? 'فشل الحذف' : 'Delete failed'))
                  }
                }}
                className={dangerActionClass}
              >
                <Trash2 className="w-4 h-4" />
                {language === 'ar' ? 'حذف' : 'Delete'}
              </button>
            )}
          </>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={sectionCardClass}
          >
            {String(invoice?.status || '').toLowerCase() === 'cancelled' && invoice?.cancelReason ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                <p className="font-semibold">{language === 'ar' ? 'فاتورة ملغاة' : 'Cancelled invoice'}</p>
                <p className="mt-1 opacity-90">{invoice.cancelReason}</p>
              </div>
            ) : null}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  <FileText className="h-5 w-5" strokeWidth={1.75} />
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
              ) : !isSarTenant ? (
                <span className={`badge ${standardStatusMeta.badgeClass}`}>
                  {standardStatusMeta.isSuccess && <CheckCircle className="w-3 h-3 me-1" />}
                  {!standardStatusMeta.isSuccess && <Clock className="w-3 h-3 me-1" />}
                  {standardStatusMeta.label}
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
                    items: thermalItems,
                  }}
                  type={invoice?.businessContext || tenantBusinessTypes[0] || 'bakala'}
                />
              ) : (
                <InvoiceLivePreview
                  invoice={invoiceForDisplay || invoice}
                  tenant={tenant}
                  language={language}
                  templateId={templateId}
                  bilingual={isBilingualInvoice}
                  secondaryLanguage={invoiceSecondaryLanguage}
                  currencyRenderMode="icon"
                />
              )}
            </div>
          </motion.div>

          {invoiceLots?.enabled && invoiceLots?.items?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={sectionCardClass}
            >
              <p className="text-sm font-medium text-gray-500 mb-3">
                {language === 'ar' ? 'دفعات المخزون' : 'Stock lots'}
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2 pe-3 font-medium">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th className="py-2 pe-3 font-medium">{language === 'ar' ? 'الدفعة' : 'Lot'}</th>
                      <th className="py-2 pe-3 font-medium">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLots.items.map((row, idx) => (
                      <tr key={`${row.lotId}-${idx}`} className="border-b border-gray-50">
                        <td className="py-2 pe-3">
                          {language === 'ar' ? (row.productNameAr || row.productName) : row.productName}
                        </td>
                        <td className="py-2 pe-3 font-mono text-xs">{row.lotName}</td>
                        <td className="py-2 pe-3">{row.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {(invoice?.restaurantOrderId || invoice?.travelBookingId || invoice?.contractNumber || invoice?.sourceQuotationId) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={sectionCardClass}
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
          {/* QR Code — hidden on travel agency invoices; voided when cancelled */}
          {(invoice?.zatca?.qrCodeData || invoice?.fbr?.qrCode || invoice?.countryCompliance?.qrCode)
            && invoice?.invoiceSubtype !== 'travel_ticket'
            && invoice?.businessContext !== 'travel_agency'
            && String(invoice?.status || '').toLowerCase() !== 'cancelled' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={sectionCardClass}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                {t('viewQr')}
              </h3>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <QRCodeSVG value={invoice.zatca?.qrCodeData || invoice.countryCompliance?.qrCode || invoice.fbr?.qrCode} size={180} />
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                {getTaxQrLabel(tenant, invoice?.currency || tenant?.settings?.currency, language === 'ar')}
              </p>
            </motion.div>
          )}
          {String(invoice?.status || '').toLowerCase() === 'cancelled'
            && invoice?.invoiceSubtype !== 'travel_ticket'
            && invoice?.businessContext !== 'travel_agency' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={sectionCardClass}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                {t('viewQr')}
              </h3>
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-center dark:border-rose-900/40 dark:bg-rose-950/30">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  {language === 'ar' ? 'رمز QR ملغى' : 'QR code voided'}
                </p>
                <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-400">
                  {language === 'ar'
                    ? 'الفاتورة ملغاة — لا يوجد رمز ضريبي صالح للمسح.'
                    : 'This invoice is cancelled — no valid tax QR to scan.'}
                </p>
              </div>
            </motion.div>
          )}

          {/* ZATCA Info — only relevant for SAR-denominated invoices */}
          {String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR' && invoice?.invoiceSubtype !== 'proforma' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={sectionCardClass}
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

          {String(tenant?.settings?.currency || '').toUpperCase() === 'PKR' && invoice?.invoiceSubtype !== 'proforma' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={sectionCardClass}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'معلومات FBR' : 'FBR Digital Invoicing'}
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">{language === 'ar' ? 'رقم فاتورة FBR' : 'FBR Invoice No'}</p>
                  <p className="text-sm font-mono break-all">{invoice?.fbr?.fbrInvoiceNo || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{language === 'ar' ? 'حالة الإرسال' : 'Submission'}</p>
                  <p className="text-sm capitalize">{invoice?.fbr?.submissionStatus || 'pending'}</p>
                </div>
                {invoice?.fbr?.submittedAt && (
                  <div>
                    <p className="text-xs text-gray-500">{language === 'ar' ? 'تاريخ الإرسال' : 'Submitted At'}</p>
                    <p className="text-sm">{new Date(invoice.fbr.submittedAt).toLocaleString()}</p>
                  </div>
                )}
                {invoice?.fbr?.lastError && (
                  <div>
                    <p className="text-xs text-gray-500">{language === 'ar' ? 'آخر خطأ' : 'Last error'}</p>
                    <p className="text-xs text-red-600">{invoice.fbr.lastError}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {id ? (
        <div className="mt-6">
          <DocumentChatter docType="invoice" docId={id} language={language} />
        </div>
      ) : null}

      {printModalOpen && showThermal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[400px] mx-4 max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
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
                  items: thermalItems,
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
      {payOpen && (
        <RegisterPaymentModal
          isOpen={payOpen}
          onClose={() => setPayOpen(false)}
          invoice={invoice}
          language={language}
          isPending={recordPaymentMutation.isPending}
          onSubmit={(payload) => recordPaymentMutation.mutate(payload)}
        />
      )}
      <CreditNoteFromInvoiceModal
        isOpen={cnModalOpen && !isPurchaseBill}
        onClose={() => setCnModalOpen(false)}
        invoice={invoice}
        language={language}
        isPending={creditNoteMutation.isPending}
        onSubmit={(payload) => creditNoteMutation.mutate(payload)}
      />
      <CancelInvoiceModal
        isOpen={cancelOpen}
        onClose={() => { if (!cancelMutation.isPending) setCancelOpen(false) }}
        invoice={invoice}
        language={language}
        isPending={cancelMutation.isPending}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
      />
      <VendorRefundFromBillModal
        isOpen={cnModalOpen && isPurchaseBill}
        onClose={() => setCnModalOpen(false)}
        invoice={invoice}
        language={language}
        isPending={creditNoteMutation.isPending}
        onSubmit={(payload) => creditNoteMutation.mutate(payload)}
      />
    </div>
  )
}

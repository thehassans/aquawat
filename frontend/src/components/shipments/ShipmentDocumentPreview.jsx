import { Fragment } from 'react'
import { getInvoiceBranding } from '../../lib/invoiceBranding'

const formatDate = (value, language = 'en') => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const joinAddress = (address = {}) => {
  return [
    address?.buildingNumber,
    address?.additionalNumber,
    address?.street,
    address?.district,
    address?.city,
    address?.postalCode,
    address?.country,
  ].filter(Boolean)
}

const resolveCompanyName = (tenant = {}, language = 'en') => {
  if (language === 'ar') {
    return tenant?.business?.legalNameAr || tenant?.business?.legalNameEn || '—'
  }
  return tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || '—'
}

const resolveWarehouseName = (shipment = {}, language = 'en') => {
  const warehouse = shipment?.warehouseId || {}
  if (language === 'ar') {
    return warehouse?.nameAr || warehouse?.nameEn || '—'
  }
  return warehouse?.nameEn || warehouse?.nameAr || '—'
}

const getRecipientName = (shipment = {}, language = 'en') => {
  const recipient = shipment?.deliveryRecipient || {}
  if (language === 'ar') {
    return recipient?.nameAr || recipient?.name || recipient?.company || '—'
  }
  return recipient?.name || recipient?.nameAr || recipient?.company || '—'
}

const getRecipientCompany = (shipment = {}, language = 'en') => {
  const recipient = shipment?.deliveryRecipient || {}
  if (language === 'ar') {
    return recipient?.company || recipient?.nameAr || recipient?.name || '—'
  }
  return recipient?.company || recipient?.name || recipient?.nameAr || '—'
}

export default function ShipmentDocumentPreview({ shipment, tenant, language = 'en', documentType = 'delivery-note' }) {
  const isLabel = documentType === 'shipping-label'
  const branding = getInvoiceBranding(tenant, language, 'trading')
  const logoSrc = branding?.logoSrc || tenant?.business?.logoUrl || tenant?.branding?.logo || '/maqdernewlogo.webp'
  const companyName = resolveCompanyName(tenant, language)
  const companyNameEn = tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || '—'
  const companyNameAr = tenant?.business?.legalNameAr || tenant?.business?.legalNameEn || '—'
  const warehouseName = resolveWarehouseName(shipment, language)
  const recipient = shipment?.deliveryRecipient || {}
  const recipientAddressLines = joinAddress(recipient?.address || {})
  const itemCount = Array.isArray(shipment?.lineItems) ? shipment.lineItems.length : 0
  const totalQty = (shipment?.lineItems || []).reduce((sum, line) => sum + Number(line?.quantity || 0), 0)
  const lineItems = Array.isArray(shipment?.lineItems) ? shipment.lineItems : []
  const documentTitle = isLabel
    ? (language === 'ar' ? 'ملصق الشحن' : 'Shipping Label')
    : (language === 'ar' ? 'إذن تسليم' : 'Delivery Note')
  const eyebrow = isLabel
    ? (language === 'ar' ? 'جاهز للتسليم' : 'Ready for Dispatch')
    : (language === 'ar' ? 'وثيقة تسليم احترافية' : 'Premium Delivery Document')

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.32)] ${isLabel ? 'p-5' : 'p-6'}`}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-slate-900" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {logoSrc ? (
          <img src={logoSrc} alt="" className={`${isLabel ? 'h-32 w-32' : 'h-48 w-48'} object-contain opacity-[0.05]`} />
        ) : null}
      </div>

      <div className="relative">
        <div className={`grid gap-4 ${isLabel ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px]'}`}>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{eyebrow}</p>
            <div className="mt-3 flex items-start gap-4">
              <div className={`${isLabel ? 'h-16 w-16 rounded-2xl' : 'h-20 w-20 rounded-[1.5rem]'} flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3`}>
                {logoSrc ? (
                  <img src={logoSrc} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center text-xs font-semibold tracking-[0.3em] text-slate-500">{companyName.slice(0, 2)}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={`${isLabel ? 'text-2xl' : 'text-3xl'} font-semibold text-slate-950`}>{documentTitle}</h2>
                <p className="mt-2 text-base font-semibold text-slate-900">{companyName}</p>
                {!isLabel ? (
                  <div className="mt-2 space-y-1 text-sm text-slate-500">
                    <p>{companyNameEn}</p>
                    <p dir="rtl">{companyNameAr}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{language === 'ar' ? 'مرجع المستند' : 'Document Ref'}</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{shipment?.shipmentNumber || '—'}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                <p className="mt-1 font-medium text-slate-900">{shipment?.status || 'draft'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(shipment?.shippedAt || shipment?.createdAt, language)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{language === 'ar' ? 'التتبع' : 'Tracking'}</p>
                <p className="mt-1 font-medium text-slate-900 break-words">{shipment?.trackingNumber || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{language === 'ar' ? 'الناقل' : 'Carrier'}</p>
                <p className="mt-1 font-medium text-slate-900 break-words">{shipment?.carrier || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {isLabel ? (
          <div className="mt-5 grid grid-cols-1 gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{language === 'ar' ? 'من' : 'From'}</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{companyName}</p>
                <p className="mt-1 text-sm text-slate-600">{warehouseName}</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-950 p-4 text-white">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">{language === 'ar' ? 'إلى' : 'To'}</p>
                <p className="mt-2 text-xl font-semibold">{getRecipientName(shipment, language)}</p>
                <p className="mt-1 text-sm text-slate-200">{getRecipientCompany(shipment, language)}</p>
                {recipient?.phone ? <p className="mt-2 text-sm text-slate-200">{recipient.phone}</p> : null}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-dashed border-slate-300 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{language === 'ar' ? 'عنوان التسليم' : 'Delivery Address'}</p>
              <div className="mt-2 space-y-1 text-sm font-medium text-slate-900">
                {recipientAddressLines.length > 0 ? recipientAddressLines.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                )) : <p>—</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-[1.25rem] bg-slate-50 p-4 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{language === 'ar' ? 'البنود' : 'Items'}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{itemCount}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{language === 'ar' ? 'الكمية' : 'Qty'}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{totalQty}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{language === 'ar' ? 'المرجع' : 'Reference'}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{recipient?.referenceNumber || '—'}</p>
              </div>
            </div>
          </div>
        ) : (
          <Fragment>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{language === 'ar' ? 'منشأ الإرسال' : 'Dispatch Origin'}</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{companyName}</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>{language === 'ar' ? 'المستودع' : 'Warehouse'}: <span className="font-medium text-slate-900">{warehouseName}</span></p>
                  <p>{language === 'ar' ? 'الناقل' : 'Carrier'}: <span className="font-medium text-slate-900">{shipment?.carrier || '—'}</span></p>
                  <p>{language === 'ar' ? 'رقم التتبع' : 'Tracking'}: <span className="font-medium text-slate-900">{shipment?.trackingNumber || '—'}</span></p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{language === 'ar' ? 'وجهة التسليم' : 'Delivery Destination'}</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{getRecipientName(shipment, language)}</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>{language === 'ar' ? 'الشركة' : 'Company'}: <span className="font-medium text-slate-900">{getRecipientCompany(shipment, language)}</span></p>
                  <p>{language === 'ar' ? 'الهاتف' : 'Phone'}: <span className="font-medium text-slate-900">{recipient?.phone || '—'}</span></p>
                  <p>{language === 'ar' ? 'المرجع' : 'Reference'}: <span className="font-medium text-slate-900">{recipient?.referenceNumber || '—'}</span></p>
                </div>
                <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-300 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{language === 'ar' ? 'العنوان' : 'Address'}</p>
                  <div className="mt-2 space-y-1 text-sm font-medium text-slate-900">
                    {recipientAddressLines.length > 0 ? recipientAddressLines.map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    )) : <p>—</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">#</th>
                    <th className="px-4 py-3 text-start font-medium">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-3 text-start font-medium">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                    <th className="px-4 py-3 text-end font-medium">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                  {lineItems.length > 0 ? lineItems.map((line, index) => {
                    const productName = language === 'ar'
                      ? (line?.productId?.nameAr || line?.productId?.nameEn || '—')
                      : (line?.productId?.nameEn || line?.productId?.nameAr || '—')
                    return (
                      <tr key={`${line?._id || index}`}>
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{productName}</td>
                        <td className="px-4 py-3">{line?.description || '—'}</td>
                        <td className="px-4 py-3 text-end font-semibold text-slate-900">{Number(line?.quantity || 0)}</td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan="4">{language === 'ar' ? 'لا توجد بنود' : 'No line items'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{language === 'ar' ? 'تعليمات التسليم' : 'Delivery Instructions'}</p>
                <p className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-slate-900">{recipient?.instructions || shipment?.notes || '—'}</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{language === 'ar' ? 'إجمالي البنود' : 'Total Items'}</span>
                  <span className="font-semibold text-slate-900">{itemCount}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>{language === 'ar' ? 'إجمالي الكمية' : 'Total Quantity'}</span>
                  <span className="font-semibold text-slate-900">{totalQty}</span>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{language === 'ar' ? 'توقيع المستلم' : 'Receiver Signature'}</p>
                  <div className="mt-6 h-16 rounded-xl border border-dashed border-slate-300 bg-white" />
                </div>
              </div>
            </div>
          </Fragment>
        )}
      </div>
    </div>
  )
}

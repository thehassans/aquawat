import React, { forwardRef } from 'react'
import { useSelector } from 'react-redux'
import { QRCodeSVG } from 'qrcode.react'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { generateNbrQrValue } from '../../lib/nbrQr'
import { getThermalPrinterSettings, getReceiptStyle, getPageCss } from '../../lib/thermalPrinter'
import { CURRENCY_CODE } from '../../lib/currency'
import { isSaudiTenant, isBangladeshTenant, isPakistanTenant } from '../../lib/saudiTenant'
import { generateFbrQrValue } from '../../lib/fbrQr'

function formatReceiptDate(dateVal) {
  try {
    const d = new Date(dateVal || Date.now())
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
  } catch {
    return new Date().toLocaleDateString()
  }
}

const ThermalReceipt = forwardRef(({ order, type = 'restaurant', isKitchen = false, isUpdated = false }, ref) => {
  const { tenant } = useSelector(state => state.auth)
  const { language } = useSelector(state => state.ui)
  const isRtl = language === 'ar'
  const thermalSettings = getThermalPrinterSettings(tenant)
  const currency = String(tenant?.settings?.currency || order?.currency || CURRENCY_CODE).trim().toUpperCase()
  const bilingualAr = isSaudiTenant(tenant)
  const isZatcaApplicable = bilingualAr
  const isBangladesh = isBangladeshTenant(tenant) || currency === 'BDT'
  const isPakistan = isPakistanTenant(tenant) || currency === 'PKR'
  const vatRate = isBangladesh
    ? (Number(tenant?.nbr?.defaultVatRate) || 15)
    : isPakistan
      ? (Number(tenant?.fbr?.defaultSalesTaxRate) || 18)
      : (bilingualAr ? 15 : null)

  const money = (value) => `${(Number(value) || 0).toFixed(2)} ${currency}`

  if (!order) return null

  const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Foody Silver Establishment'
  const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مؤسسة فودي الفضي التجارية'
  const vatNumber = tenant?.business?.vatNumber || ''
  const crNumber = tenant?.business?.crNumber || ''
  const binNumber = tenant?.nbr?.binNumber || tenant?.business?.binNumber || ''
  const mushakForm = tenant?.nbr?.mushakForm || '6.3'

  const grandTotal = Number(order.grandTotal || order.total || order.price || 0)
  const totalTax = Number(order.totalVat || order.totalTax || (vatRate === 15 ? (grandTotal - grandTotal / 1.15) : 0))
  const subtotal = Number(order.subtotal || (grandTotal - totalTax))

  const dateStr = formatReceiptDate(order.createdAt)
  const orderNumber = order.receiptNumber || order.orderNumber || order._id?.slice(-8) || 'N/A'
  const customerName = order.customerId?.nameI18n?.[isRtl ? 'ar' : 'en'] || order.customerName || order.customer?.fullName || order.customerId?.name || (bilingualAr ? 'Cash Customer' : 'Cash Customer')

  let items = order.items || order.lineItems || []
  if (type === 'khayyat') {
    items = [{
      nameEn: `Tailoring Order${order.orderFor ? ` (${order.orderFor})` : ''}`,
      nameAr: `طلب خياطة${order.orderForAr ? ` (${order.orderForAr})` : (order.orderFor ? ` (${order.orderFor})` : '')}`,
      quantity: order.quantity || 1,
      unitPrice: order.price || 0,
      total: order.price || 0
    }]
  }

  const formatAddress = (address) => {
    if (!address) return ''
    if (typeof address === 'string') return address
    const parts = [
      address.buildingNumber,
      address.street,
      address.district,
      address.city,
      address.country
    ].filter(Boolean)
    return parts.join(', ')
  }

  const addressText = formatAddress(tenant?.business?.address)

  const logoSrc = tenant?.branding?.logo || tenant?.branding?.logoUrl || tenant?.settings?.invoiceBranding?.logo

  let zatcaQrPayload = isZatcaApplicable ? order.zatcaQrCode : null
  if (isZatcaApplicable && !zatcaQrPayload) {
    try {
      zatcaQrPayload = generateZatcaQrValue({
        sellerName: businessNameAr || businessNameEn,
        vatNumber: vatNumber,
        timestamp: new Date(order.createdAt || Date.now()).toISOString(),
        totalWithVat: grandTotal,
        vatTotal: totalTax
      })
    } catch (err) {
      console.error('Failed to generate ZATCA QR code value dynamically:', err)
    }
  }

  let nbrQrPayload = null
  if (isBangladesh && tenant?.nbr?.autoGenerateQr !== false) {
    try {
      nbrQrPayload = generateNbrQrValue({
        sellerName: businessNameEn,
        binNumber: binNumber || vatNumber,
        invoiceNumber: orderNumber,
        timestamp: new Date(order.createdAt || Date.now()).toISOString(),
        totalWithVat: grandTotal,
        vatTotal: totalTax,
        mushakForm,
      })
    } catch (err) {
      console.error('Failed to generate NBR QR code value:', err)
    }
  }

  let fbrQrPayload = null
  if (isPakistan && tenant?.fbr?.autoGenerateQr !== false) {
    try {
      fbrQrPayload = generateFbrQrValue({
        sellerName: businessNameEn,
        ntn: tenant?.fbr?.ntn || vatNumber,
        strn: tenant?.fbr?.strn || '',
        invoiceNumber: orderNumber,
        fbrInvoiceNo: order?.fbr?.fbrInvoiceNo || '',
        timestamp: new Date(order.createdAt || Date.now()).toISOString(),
        totalWithTax: grandTotal,
        salesTax: totalTax,
      })
    } catch (err) {
      console.error('Failed to generate FBR QR code value:', err)
    }
  }

  const receiptStyle = getReceiptStyle(thermalSettings)
  const pageCss = getPageCss(thermalSettings)

  const orderTypeDisplay = (() => {
    if (order.orderType === 'dine_in') {
      const tbl = order.tableNumber ? ` (Table ${order.tableNumber})` : ''
      return bilingualAr ? `Dine In / محلي${tbl}` : `Dine In${tbl}`
    }
    if (order.orderType === 'takeaway') return bilingualAr ? 'Takeaway / سفري' : 'Takeaway'
    if (order.orderType === 'delivery') return bilingualAr ? 'Delivery / توصيل' : 'Delivery'
    return order.orderType || ''
  })()

  const paymentDisplay = (() => {
    const pm = (order.paymentMethod || 'cash').toLowerCase()
    if (pm === 'cash') return bilingualAr ? 'Cash / نقدي' : 'Cash'
    if (pm === 'card') return bilingualAr ? 'Card / بطاقة مدى' : 'Card'
    if (pm === 'split') return bilingualAr ? 'Split / مقسم' : 'Split'
    if (pm === 'khata') return bilingualAr ? 'Credit / آجل' : 'Credit'
    return order.paymentMethod
  })()

  return (
    <div 
      ref={ref} 
      className="thermal-receipt bg-white text-black mx-auto select-none"
      style={{
        ...receiptStyle,
        maxWidth: '100%',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Tajawal', 'Helvetica Neue', Arial, sans-serif",
        color: '#000000',
        backgroundColor: '#ffffff'
      }}
    >
      <style type="text/css" media="print">
        {`
          ${pageCss}
          @page { margin: 0; size: auto; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Tajawal', 'Helvetica Neue', Arial, sans-serif !important;
          }
          .thermal-receipt {
            width: 100% !important;
            max-width: 100% !important;
            padding: 2mm 3mm !important;
            margin: 0 auto !important;
            border: none !important;
            box-shadow: none !important;
            visibility: visible !important;
            display: block !important;
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
          }
          .thermal-receipt * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
            visibility: visible !important;
          }
          table { width: 100% !important; border-collapse: collapse !important; }
        `}
      </style>

      {/* ─── Header: Brand, Tax & Legal Registration ──────────────────────── */}
      {!isKitchen ? (
        <div className="text-center mb-2.5">
          {thermalSettings.showLogo && logoSrc && (
            <div className="flex justify-center mb-1.5">
              <img 
                src={logoSrc} 
                alt="Logo" 
                className="max-h-12 max-w-[110px] object-contain filter grayscale" 
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          )}

          <div className="font-extrabold text-[13px] tracking-tight text-black leading-tight uppercase">
            {businessNameEn}
          </div>
          {bilingualAr && businessNameAr && (
            <div className="font-bold text-[13px] text-black leading-tight mt-0.5" dir="rtl">
              {businessNameAr}
            </div>
          )}
          
          {addressText && (
            <div className="text-[8.5px] text-black leading-tight mt-1 px-2">
              {addressText}
            </div>
          )}

          <div className="text-[9px] text-black font-semibold mt-1 space-y-0.5">
            {vatNumber && (
              <div>
                <span>VAT / الرقم الضريبي: </span>
                <span className="font-bold">{vatNumber}</span>
              </div>
            )}
            {crNumber && (
              <div>
                <span>CR / السجل التجاري: </span>
                <span className="font-bold">{crNumber}</span>
              </div>
            )}
            {binNumber && isBangladesh && (
              <div className="font-bold">BIN: {binNumber}</div>
            )}
          </div>

          {/* Tax Invoice Badge */}
          <div className="mt-2 py-1 border-t border-b border-black text-center">
            <div className="font-bold text-[11px] text-black uppercase tracking-wide">
              {bilingualAr
                ? 'فاتورة ضريبية مبسطة | SIMPLIFIED TAX INVOICE'
                : (isBangladesh ? `MUSHAK ${mushakForm} — VAT INVOICE` : 'TAX INVOICE')}
            </div>
            {isUpdated && (
              <div className="font-extrabold text-[9.5px] text-black uppercase mt-0.5">
                *** UPDATED / معدلة ***
              </div>
            )}
          </div>

          {/* Prominent Order Number Box */}
          {order.orderNumber && (
            <div className="mt-2 py-1 px-2 border-2 border-black rounded text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-black">
                ORDER / رقم الطلب
              </div>
              <div className="font-extrabold text-base text-black tracking-wider">
                {order.orderNumber}
              </div>
              {orderTypeDisplay && (
                <div className="text-[9.5px] font-bold text-black border-t border-black/30 mt-0.5 pt-0.5">
                  {orderTypeDisplay}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Kitchen Header */
        <div className="text-center mb-3">
          <div className="font-black text-lg text-black uppercase tracking-wider border-b-2 border-black pb-1">
            KITCHEN TICKET / طلب مطبخ
          </div>
          {isUpdated && (
            <div className="font-bold text-xs text-black uppercase mt-1">
              *** MODIFIED / معدل ***
            </div>
          )}
          {order.orderNumber && (
            <div className="my-2 py-1 border-2 border-black text-center font-extrabold text-xl text-black">
              {order.orderNumber}
            </div>
          )}
          {order.kitchenNote && (
            <div className="border border-dashed border-black p-2 my-2 text-center font-bold text-xs">
              ⚠️ {order.kitchenNote}
            </div>
          )}
        </div>
      )}

      {/* ─── Metadata Key-Value List ─────────────────────────────────────── */}
      <div className="border-b border-dashed border-black pb-1.5 mb-2 text-[9.5px]">
        <table className="w-full">
          <tbody>
            <tr>
              <td className="text-black font-semibold py-0.5 text-left w-[45%]">
                Invoice / الفاتورة:
              </td>
              <td className="font-bold text-black py-0.5 text-right w-[55%]" dir="ltr">
                {orderNumber}
              </td>
            </tr>
            <tr>
              <td className="text-black font-semibold py-0.5 text-left w-[45%]">
                Date / التاريخ:
              </td>
              <td className="font-medium text-black py-0.5 text-right w-[55%]" dir="ltr">
                {dateStr}
              </td>
            </tr>
            <tr>
              <td className="text-black font-semibold py-0.5 text-left w-[45%]">
                Customer / العميل:
              </td>
              <td className="font-semibold text-black py-0.5 text-right w-[55%]">
                {customerName}
              </td>
            </tr>
            {(order.customerPhone || order.customer?.phone || order.customerId?.phone) && (
              <tr>
                <td className="text-black font-semibold py-0.5 text-left w-[45%]">
                  Phone / الهاتف:
                </td>
                <td className="font-medium text-black py-0.5 text-right w-[55%]" dir="ltr">
                  {order.customerPhone || order.customer?.phone || order.customerId?.phone}
                </td>
              </tr>
            )}
            {!isKitchen && (
              <tr>
                <td className="text-black font-semibold py-0.5 text-left w-[45%]">
                  Payment / طريقة الدفع:
                </td>
                <td className="font-bold text-black py-0.5 text-right w-[55%]">
                  {paymentDisplay}
                </td>
              </tr>
            )}
            {order.notes && (
              <tr>
                <td className="text-black font-semibold py-0.5 text-left w-[45%]">
                  Notes / ملاحظات:
                </td>
                <td className="font-semibold text-black py-0.5 text-right w-[55%]">
                  {order.notes}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Line Items Table ────────────────────────────────────────────── */}
      <table className="w-full text-[9.5px] mb-2 border-collapse">
        <thead>
          <tr className="border-b border-black text-black font-bold">
            <th className={`py-1 text-left ${isKitchen ? 'w-[75%]' : 'w-[52%]'}`}>
              Item / الصنف
            </th>
            <th className={`py-1 text-center ${isKitchen ? 'w-[25%]' : 'w-[16%]'}`}>
              Qty / الكمية
            </th>
            {!isKitchen && (
              <th className="py-1 text-right w-[32%]">
                Total / المجموع
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const nameEn = item.nameEn || item.productName || item.name || ''
            const nameAr = item.nameAr || item.productNameAr || ''
            const showArabic = bilingualAr && nameAr && nameAr.trim().toLowerCase() !== nameEn.trim().toLowerCase()
            const qty = Number(item.quantity || 1)
            const unitPrice = Number(item.unitPrice || item.price || 0)
            const total = Number(item.total || item.lineTotal || item.lineTotalWithTax || (unitPrice * qty))

            return (
              <tr key={idx} className="border-b border-dashed border-gray-300 last:border-b-0">
                <td className="py-1 pr-1 text-left align-top">
                  <div className={`font-bold text-black leading-tight ${isKitchen ? 'text-xs font-black' : 'text-[10px]'}`}>
                    {nameEn}
                  </div>
                  {showArabic && (
                    <div className="font-semibold text-black text-[9px] leading-tight mt-0.5" dir="rtl">
                      {nameAr}
                    </div>
                  )}
                  {!isKitchen && (
                    <div className="text-[8.5px] text-black font-medium mt-0.5">
                      {unitPrice.toFixed(2)} × {qty}
                    </div>
                  )}
                </td>
                <td className={`py-1 text-center align-top font-bold text-black ${isKitchen ? 'text-sm font-black' : 'text-[10px]'}`}>
                  {qty}
                </td>
                {!isKitchen && (
                  <td className="py-1 text-right align-top font-bold text-black text-[10px]" dir="ltr">
                    {total.toFixed(2)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ─── Financial Totals Summary ────────────────────────────────────── */}
      {!isKitchen && (
        <div className="border-t border-black pt-1 text-[9.5px] space-y-0.5">
          <div className="flex justify-between items-center py-0.5">
            <span className="font-semibold text-black">Subtotal (Excl. VAT) / المجموع:</span>
            <span className="font-bold text-black" dir="ltr">
              {money(subtotal)}
            </span>
          </div>

          {totalTax > 0 && (
            <div className="flex justify-between items-center py-0.5">
              <span className="font-semibold text-black">
                {bilingualAr ? `VAT (${vatRate || 15}%) / ضريبة القيمة المضافة:` : 'VAT Tax:'}
              </span>
              <span className="font-bold text-black" dir="ltr">
                {money(totalTax)}
              </span>
            </div>
          )}

          {Number(order.discount || order.discountAmount || 0) > 0 && (
            <div className="flex justify-between items-center py-0.5 text-black">
              <span className="font-semibold">Discount / الخصم:</span>
              <span className="font-bold" dir="ltr">
                - {money(order.discount || order.discountAmount || 0)}
              </span>
            </div>
          )}

          {/* Grand Total Highlight */}
          <div className="border-t-2 border-b-2 border-black py-1.5 my-1 flex justify-between items-center">
            <span className="font-extrabold text-xs uppercase tracking-wider text-black">
              TOTAL / الإجمالي النهائي:
            </span>
            <span className="font-extrabold text-sm text-black" dir="ltr">
              {money(grandTotal)}
            </span>
          </div>

          {/* Payment & Balance */}
          {Number(order.paidAmount || 0) > 0 && (
            <div className="flex justify-between items-center py-0.5">
              <span className="font-semibold text-black">Amount Paid / المدفوع:</span>
              <span className="font-bold text-black" dir="ltr">
                {money(order.paidAmount)}
              </span>
            </div>
          )}

          {Number(order.changeAmount || 0) > 0 && (
            <div className="flex justify-between items-center py-0.5">
              <span className="font-semibold text-black">Change Due / المتبقي:</span>
              <span className="font-bold text-black" dir="ltr">
                {money(order.changeAmount)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── ZATCA / Regulatory QR Code ──────────────────────────────────── */}
      {!isKitchen && (
        <div className="mt-3 pt-2 border-t border-dashed border-black text-center flex flex-col items-center">
          {thermalSettings.showQrCode && zatcaQrPayload && (
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-1 border border-black inline-block rounded mb-1">
                <QRCodeSVG 
                  value={zatcaQrPayload} 
                  size={100} 
                  level="M" 
                  includeMargin={false}
                />
              </div>
              <div className="text-[8px] font-bold text-black uppercase">
                هيئة الزكاة والضريبة والجمارك | ZATCA
              </div>
            </div>
          )}

          {thermalSettings.showQrCode && nbrQrPayload && (
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-1 border border-black inline-block rounded mb-1">
                <QRCodeSVG value={nbrQrPayload} size={100} level="M" includeMargin={false} />
              </div>
              <div className="text-[8px] font-bold text-black uppercase">
                NBR MUSHAK {mushakForm}
              </div>
            </div>
          )}

          {thermalSettings.showQrCode && fbrQrPayload && (
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-1 border border-black inline-block rounded mb-1">
                <QRCodeSVG value={fbrQrPayload} size={100} level="M" includeMargin={false} />
              </div>
              <div className="text-[8px] font-bold text-black uppercase">
                FBR DIGITAL INVOICE
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Footer Notes & Powered By ────────────────────────────────────── */}
      {!isKitchen && thermalSettings.showFooter && (
        <div className="text-center text-[8.5px] mt-2.5 pt-2 border-t border-dashed border-black text-black space-y-0.5">
          <p className="font-bold text-[9px]">
            {isRtl ? thermalSettings.footerTextAr : thermalSettings.footerTextEn}
          </p>
          <p className="text-black">
            {isRtl ? 'جميع الأسعار تشمل ضريبة القيمة المضافة 15%' : 'All prices include 15% VAT'}
          </p>
          <p className="text-[7.5px] text-gray-700 font-semibold mt-1">
            Maqder POS System
          </p>
        </div>
      )}
    </div>
  )
})

ThermalReceipt.displayName = 'ThermalReceipt'
export default ThermalReceipt

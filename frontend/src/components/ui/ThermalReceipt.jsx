import React, { forwardRef } from 'react'
import { useSelector } from 'react-redux'
import { QRCodeSVG } from 'qrcode.react'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { generateNbrQrValue } from '../../lib/nbrQr'
import { getThermalPrinterSettings, getReceiptStyle, getPrintCss, getPageCss } from '../../lib/thermalPrinter'
import { CURRENCY_CODE } from '../../lib/currency'
import { isSaudiTenant, isBangladeshTenant, isPakistanTenant } from '../../lib/saudiTenant'
import { generateFbrQrValue } from '../../lib/fbrQr'

const ThermalReceipt = forwardRef(({ order, type = 'laundry', isKitchen = false, isUpdated = false }, ref) => {
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

  const lbl = (en, ar) => (bilingualAr ? `${en} / ${ar}` : en)
  const money = (value) => `${currency} ${(Number(value) || 0).toFixed(2)}`

  if (!order) return null

  const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS'
  const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مقدر نقاط البيع'
  const vatNumber = tenant?.business?.vatNumber || ''
  const binNumber = tenant?.nbr?.binNumber || tenant?.business?.binNumber || ''
  const mushakForm = tenant?.nbr?.mushakForm || '6.3'

  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString(isRtl ? 'ar-SA' : 'en-US')
  const orderNumber = order.receiptNumber || order.orderNumber || order._id?.slice(-8) || 'N/A'
  const customerName = order.customerId?.nameI18n?.[isRtl ? 'ar' : 'en'] || order.customerName || order.customer?.fullName || order.customerId?.name || (isRtl ? 'عميل نقدي' : 'Cash Customer')

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
      address.postalCode,
      address.country
    ].filter(Boolean)
    return parts.join(', ')
  }

  const addressText = formatAddress(tenant?.business?.address)

  const treatmentMap = {
    'Wash & Fold': 'غسيل وطي',
    'Dry Clean': 'تنظيف جاف',
    'Wash & Iron': 'غسيل وكوي',
    'Iron Only': 'كوي فقط',
    'Pressing': 'كبس فقط',
    'Wash': 'غسيل سجاد',
    'None': 'بدون'
  }

  const customizationMap = {
    folded: 'مطوي',
    hanger: 'على الشماعة',
    starch: 'نشاء',
    perfume: 'تعطير',
    no_crease: 'بدون كسرة'
  }

  const deliveryTypeMap = {
    walk_in: { en: 'Walk-In', ar: 'سفري / استلام من الفرع' },
    delivery: { en: 'Delivery', ar: 'توصيل للمنزل' }
  }

  const logoSrc = tenant?.branding?.logo || tenant?.branding?.logoUrl || tenant?.settings?.invoiceBranding?.logo

  let zatcaQrPayload = isZatcaApplicable ? order.zatcaQrCode : null
  if (isZatcaApplicable && !zatcaQrPayload) {
    try {
      zatcaQrPayload = generateZatcaQrValue({
        sellerName: businessNameAr || businessNameEn,
        vatNumber: vatNumber,
        timestamp: new Date(order.createdAt || Date.now()).toISOString(),
        totalWithVat: order.grandTotal || order.total || 0,
        vatTotal: order.totalVat || order.totalTax || 0
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
        totalWithVat: order.grandTotal || order.total || 0,
        vatTotal: order.totalVat || order.totalTax || 0,
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
        totalWithTax: order.grandTotal || order.total || 0,
        salesTax: order.totalVat || order.totalTax || 0,
      })
    } catch (err) {
      console.error('Failed to generate FBR QR code value:', err)
    }
  }

  const receiptStyle = getReceiptStyle(thermalSettings)
  const printCss = getPrintCss('print-section', thermalSettings)
  const pageCss = getPageCss(thermalSettings)

  const orderTypeLabel = (() => {
    if (order.orderType === 'dine_in') return bilingualAr ? 'Dine In | محلي' : 'Dine In'
    if (order.orderType === 'takeaway') return bilingualAr ? 'Takeaway | سفري' : 'Takeaway'
    if (order.orderType === 'delivery') return bilingualAr ? 'Delivery | توصيل' : 'Delivery'
    return order.orderType || ''
  })()

  return (
    <div 
      ref={ref} 
      className="print-section bg-white text-black mx-auto font-mono select-none border border-gray-100"
      style={{ ...receiptStyle, maxWidth: '100%' }}
    >
      <style type="text/css" media="print">
        {`
          ${pageCss}
          @page { margin: 0; }
          body { margin: 0; padding: 0; background: white; color: black; }
          .print-section {
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            visibility: visible !important;
          }
          .print-section * {
            visibility: visible !important;
          }
          ${printCss}
          .print-section, .print-section * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
          }
          ::-webkit-scrollbar { display: none; }
        `}
      </style>

      {!isKitchen ? (
        <div className="text-center mb-4 flex flex-col items-center">
          {thermalSettings.showLogo && logoSrc && (
            <img 
              src={logoSrc} 
              alt="Logo" 
              style={{
                maxHeight: '40px',
                maxWidth: '85px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                margin: '0 auto 6px auto',
                display: 'block',
                filter: 'grayscale(100%) contrast(120%)'
              }}
              className="max-h-10 max-w-[85px] mb-2 object-contain filter grayscale mx-auto" 
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          <h2 className="font-extrabold text-sm text-gray-900 leading-snug">{businessNameEn}</h2>
          {bilingualAr && businessNameAr && businessNameAr !== businessNameEn && (
            <h2 className="font-extrabold text-sm text-gray-900 leading-snug mt-0.5">{businessNameAr}</h2>
          )}

          {type === 'restaurant' && order.orderNumber && (
            <div className="mt-3 mb-1 w-full flex flex-col items-center">
              <div className="text-[9px] text-black font-bold uppercase tracking-widest mb-1">{lbl('Order No', 'رقم الطلب')}</div>
              <div
                className="w-full text-center font-extrabold text-lg tracking-wide py-1 px-3 rounded"
                style={{ background: '#fff', color: '#111', border: '2px solid #111', letterSpacing: '0.05em' }}
              >
                {order.orderNumber}
              </div>
            </div>
          )}

          <div className="border-t border-dashed border-gray-300 w-full my-2"></div>
          
          <div className="text-[10px] font-extrabold text-black tracking-wider">
            {bilingualAr
              ? 'SIMPLIFIED TAX INVOICE | فاتورة ضريبية مبسطة'
              : isBangladesh
                ? `MUSHAK ${mushakForm} — VAT TAX INVOICE`
                : 'SALES RECEIPT'}
            {isUpdated && (
              <div className="mt-0.5 text-black font-extrabold">
                {bilingualAr ? 'UPDATED | محدثة' : 'UPDATED'}
              </div>
            )}
          </div>
          
          <div className="text-[10px] mt-1 text-black font-semibold">
            {isBangladesh && binNumber && (
              <div>BIN: <span className="font-bold">{binNumber}</span></div>
            )}
            {vatNumber && (
              <div>{lbl(bilingualAr ? 'VAT' : (isBangladesh ? 'VAT Reg.' : 'Tax No'), 'الرقم الضريبي')}: <span className="font-bold">{vatNumber}</span></div>
            )}
            {addressText && <div className="mt-0.5 leading-tight">{addressText}</div>}
          </div>
        </div>
      ) : (
        <div className="text-center mb-4 flex flex-col items-center">
          <h2 className="font-extrabold text-xl text-gray-900 leading-snug">
            KITCHEN TICKET{isUpdated ? ' (UPDATED)' : ''}
          </h2>
          {bilingualAr && (
            <h2 className="font-extrabold text-xl text-gray-900 leading-snug mt-1">
              طلب مطبخ{isUpdated ? ' (محدث)' : ''}
            </h2>
          )}
          <div className="border-t border-solid border-gray-900 border-[2px] w-full my-2"></div>
          {order.kitchenNote && (
            <div className="border border-black p-2 my-2 w-full text-center font-bold text-lg border-dashed">
              {order.kitchenNote}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-b border-dashed border-black py-2 mb-3 text-[10px] space-y-1">
        <div className="flex justify-between">
          <span className="text-black font-bold">{lbl('Invoice No', 'رقم الفاتورة')}:</span>
          <span className="font-bold">{orderNumber}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-black font-bold">{lbl('Date', 'التاريخ')}:</span>
          <span>{dateStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-black font-bold">{lbl('Customer', 'العميل')}:</span>
          <span className="font-semibold">{customerName}</span>
        </div>
        {type === 'laundry' && order.deliveryType && (
          <div className="flex justify-between">
            <span className="text-black font-bold">{lbl('Delivery', 'التوصيل')}:</span>
            <span className="font-semibold">
              {bilingualAr
                ? `${deliveryTypeMap[order.deliveryType]?.en} | ${deliveryTypeMap[order.deliveryType]?.ar}`
                : deliveryTypeMap[order.deliveryType]?.en}
            </span>
          </div>
        )}
        {(order.customerPhone || order.customer?.phone || order.customerId?.phone) && (
          <div className="flex justify-between">
            <span className="text-black font-bold">{lbl('Phone', 'رقم الهاتف')}:</span>
            <span className="font-semibold">{order.customerPhone || order.customer?.phone || order.customerId?.phone}</span>
          </div>
        )}
        {type === 'restaurant' && order.orderType && (
          <div className="flex justify-between">
            <span className="text-black font-bold">{lbl('Type', 'نوع الطلب')}:</span>
            <span className="font-bold">{orderTypeLabel}</span>
          </div>
        )}
        {type === 'restaurant' && order.tableNumber && (
          <div className="flex justify-between">
            <span className="text-black font-bold">{lbl('Table', 'الطاولة')}:</span>
            <span className="font-bold">{order.tableNumber}</span>
          </div>
        )}
        {order.paymentMethod && (
          <div className="flex justify-between">
            <span className="text-black font-bold">{lbl('Payment', 'طريقة الدفع')}:</span>
            <span className="font-semibold">
              {order.paymentMethod === 'cash'
                ? (bilingualAr ? (isRtl ? 'نقدي (Cash)' : 'Cash / نقدي') : 'Cash')
                : order.paymentMethod === 'card'
                  ? (bilingualAr ? (isRtl ? 'بطاقة (Card)' : 'Card / بطاقة') : 'Card')
                  : order.paymentMethod}
            </span>
          </div>
        )}
        {order.notes && (
          <div className="flex justify-between">
            <span className="text-black font-bold">{lbl('Notes', 'ملاحظات')}:</span>
            <span className="font-bold text-black">{order.notes}</span>
          </div>
        )}
        {type === 'khayyat' && (
          <>
            {order.dueDate && (
              <div className="flex justify-between">
                <span className="text-black font-bold">{lbl('Due', 'تاريخ التسليم')}:</span>
                <span className="font-bold">{new Date(order.dueDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}</span>
              </div>
            )}
            <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-gray-300">
              <span className="text-black font-bold">{lbl('Paid', 'المدفوع')}:</span>
              <span className="font-bold">{money(order.paidAmount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black font-bold">{lbl('Balance', 'المتبقي')}:</span>
              <span className="font-bold text-black">{money(Math.max(0, Number(order.price || 0) - Number(order.paidAmount || 0)))}</span>
            </div>
          </>
        )}
      </div>

      <table className="w-full text-[10px] mb-3 border-collapse">
        <thead>
          <tr className="border-b border-dashed border-black text-black font-bold">
            <th className={`text-left py-1 ${isKitchen ? 'w-[80%]' : 'w-[55%]'}`}>{lbl('Item', 'الصنف')}</th>
            <th className={`text-center py-1 ${isKitchen ? 'w-[20%]' : 'w-[15%]'}`}>{lbl('Qty', 'الكمية')}</th>
            {!isKitchen && <th className="text-right py-1 w-[30%]">{lbl('Total', 'المجموع')}</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className={`border-b border-dashed border-gray-200 last:border-0 ${isKitchen ? 'text-[11px]' : ''}`}>
              <td className="py-2 pr-1">
                <div className={`${isKitchen ? 'font-black text-sm' : 'font-bold'} text-gray-900 leading-tight`}>
                  {item.nameEn || item.productName || item.name || ''}
                </div>
                {bilingualAr && (item.nameAr || item.productNameAr) && (item.nameAr !== item.nameEn || item.productNameAr !== item.productName) && (
                  <div className={`${isKitchen ? 'text-black font-bold text-sm mt-1' : 'text-black font-bold mt-0.5'} leading-tight`}>
                    {item.nameAr || item.productNameAr}
                  </div>
                )}
                
                {type === 'laundry' && item.treatment && (
                  <div className="text-[9px] text-black mt-1 font-bold leading-none flex flex-wrap gap-1">
                    <span>
                      {bilingualAr
                        ? `[${item.treatment} | ${treatmentMap[item.treatment] || item.treatment}]`
                        : `[${item.treatment}]`}
                    </span>
                    {item.customizations?.length > 0 && (
                      <span className="text-black font-bold">
                        ({item.customizations.map(c => (bilingualAr ? (customizationMap[c] || c) : c)).join(', ')})
                      </span>
                    )}
                  </div>
                )}
                
                {!isKitchen && (
                  <div className="text-[10px] text-black font-bold mt-0.5">
                    {money(item.unitPrice)} x {item.quantity}
                  </div>
                )}
              </td>
              <td className={`text-center py-2 align-top font-bold text-gray-900 ${isKitchen ? 'text-lg' : ''}`}>{item.quantity}</td>
              {!isKitchen && (
                <td className="text-right py-2 align-top font-bold text-gray-900">
                  {money(item.total || item.lineTotal || (item.unitPrice * item.quantity))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!isKitchen && (
        <>
          <div className="border-t border-dashed border-black pt-2 text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-black font-bold">{lbl('Subtotal', 'المجموع الفرعي')}:</span>
              <span>{money(order.subtotal || order.price || 0)}</span>
            </div>
            {order.isUrgent && (
              <div className="flex justify-between font-bold text-black">
                <span>{lbl('Urgent Fee', 'رسوم العاجل')}:</span>
                <span>{money(order.urgentFee || 0)}</span>
              </div>
            )}
            {type !== 'khayyat' && Number(order.totalVat || order.totalTax || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-black font-bold">
                  {lbl(
                    bilingualAr
                      ? 'VAT (15%)'
                      : (isBangladesh ? `VAT (${vatRate}%)` : 'Tax'),
                    'ضريبة القيمة المضافة'
                  )}:
                </span>
                <span>{money(order.totalVat || order.totalTax || 0)}</span>
              </div>
            )}
            <div className="flex justify-between mt-2 pt-2 border-t border-dashed border-black font-extrabold text-sm text-black">
              <span>{lbl('Total', 'الإجمالي النهائي')}:</span>
              <span>{money(order.grandTotal || order.total || order.price || 0)}</span>
            </div>
          </div>

          <div className="my-5 flex flex-row items-center justify-center gap-4">
            {thermalSettings.showQrCode && zatcaQrPayload && (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-[8px] text-black mb-1 font-extrabold whitespace-nowrap">
                  ZATCA | هيئة الزكاة
                </div>
                <div className="bg-white p-1 border border-gray-200 rounded-lg">
                  <QRCodeSVG 
                    value={zatcaQrPayload} 
                    size={80} 
                    level="M" 
                    includeMargin={false}
                  />
                </div>
              </div>
            )}

            {thermalSettings.showQrCode && nbrQrPayload && (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-[8px] text-black mb-1 font-extrabold whitespace-nowrap">
                  NBR | MUSHAK {mushakForm}
                </div>
                <div className="bg-white p-1 border border-gray-200 rounded-lg">
                  <QRCodeSVG
                    value={nbrQrPayload}
                    size={80}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>
            )}

            {thermalSettings.showQrCode && fbrQrPayload && (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-[8px] text-black mb-1 font-extrabold whitespace-nowrap">
                  FBR | DIGITAL INVOICE
                </div>
                <div className="bg-white p-1 border border-gray-200 rounded-lg">
                  <QRCodeSVG
                    value={fbrQrPayload}
                    size={80}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>
            )}

            {type === 'khayyat' && order._id && (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-[8px] text-black mb-1 font-extrabold whitespace-nowrap">
                  {bilingualAr ? 'TRACK | تتبع الطلب' : 'TRACK ORDER'}
                </div>
                <div className="bg-white p-1 border border-gray-200 rounded-lg">
                  <QRCodeSVG 
                    value={`${window.location.origin}/track-order?id=${order._id}`}
                    size={80} 
                    level="M" 
                    includeMargin={false}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {thermalSettings.showFooter && (
        <div className="text-center text-[10px] mt-4 pt-3 border-t border-dashed border-black text-black space-y-0.5">
          <p className="font-extrabold text-black text-[11px]">{isRtl ? thermalSettings.footerTextAr : thermalSettings.footerTextEn}</p>
          <p className="font-bold">{isRtl ? 'يرجى الاحتفاظ بالإيصال.' : 'Please keep this receipt.'}</p>
          <p className="text-[9px] text-black font-bold mt-2">Maqder POS powered by Advanced Solutions</p>
        </div>
      )}
    </div>
  )
})

ThermalReceipt.displayName = 'ThermalReceipt'
export default ThermalReceipt

import React, { forwardRef } from 'react'
import { useSelector } from 'react-redux'
import { QRCodeSVG } from 'qrcode.react'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { getThermalPrinterSettings, getReceiptStyle, getPrintCss, getPageCss } from '../../lib/thermalPrinter'
import { CURRENCY_CODE } from '../../lib/currency'
import { isSaudiTenant } from '../../lib/saudiTenant'

const ThermalReceipt = forwardRef(({ order, type = 'laundry', isKitchen = false, isUpdated = false }, ref) => {
  const { tenant } = useSelector(state => state.auth)
  const { language } = useSelector(state => state.ui)
  const isRtl = language === 'ar'
  const thermalSettings = getThermalPrinterSettings(tenant)
  const currency = String(tenant?.settings?.currency || order?.currency || CURRENCY_CODE).trim().toUpperCase()
  const bilingualAr = isSaudiTenant(tenant)
  const isZatcaApplicable = bilingualAr

  const lbl = (en, ar) => (bilingualAr ? `${en} / ${ar}` : en)
  const money = (value) => `${currency} ${(Number(value) || 0).toFixed(2)}`

  if (!order) return null

  const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS'
  const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مقدر نقاط البيع'
  const vatNumber = tenant?.business?.vatNumber || ''

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
          ::-webkit-scrollbar { display: none; }
        `}
      </style>

      {!isKitchen ? (
        <div className="text-center mb-4 flex flex-col items-center">
          {thermalSettings.showLogo && logoSrc && (
            <img 
              src={logoSrc} 
              alt="Logo" 
              className="w-20 h-20 mb-2 object-contain filter grayscale" 
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          <h2 className="font-extrabold text-sm text-gray-900 leading-snug">{businessNameEn}</h2>
          {bilingualAr && businessNameAr && businessNameAr !== businessNameEn && (
            <h2 className="font-extrabold text-sm text-gray-900 leading-snug mt-0.5">{businessNameAr}</h2>
          )}

          {type === 'restaurant' && order.orderNumber && (
            <div className="mt-3 mb-1 w-full flex flex-col items-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">{lbl('Order No', 'رقم الطلب')}</div>
              <div
                className="w-full text-center font-extrabold text-lg tracking-wide py-1 px-3 rounded"
                style={{ background: '#fff', color: '#111', border: '2px solid #111', letterSpacing: '0.05em' }}
              >
                {order.orderNumber}
              </div>
            </div>
          )}

          <div className="border-t border-dashed border-gray-300 w-full my-2"></div>
          
          <div className="text-[10px] font-bold text-gray-700 tracking-wider">
            {bilingualAr ? 'SIMPLIFIED TAX INVOICE | فاتورة ضريبية مبسطة' : 'SALES RECEIPT'}
            {isUpdated && (
              <div className="mt-0.5 text-amber-600 font-extrabold">
                {bilingualAr ? 'UPDATED | محدثة' : 'UPDATED'}
              </div>
            )}
          </div>
          
          <div className="text-[9px] mt-1 text-gray-600">
            {vatNumber && (
              <div>{lbl(bilingualAr ? 'VAT' : 'Tax No', 'الرقم الضريبي')}: <span className="font-bold">{vatNumber}</span></div>
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

      <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3 text-[9px] space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-600">{lbl('Invoice No', 'رقم الفاتورة')}:</span>
          <span className="font-bold">{orderNumber}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">{lbl('Date', 'التاريخ')}:</span>
          <span>{dateStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">{lbl('Customer', 'العميل')}:</span>
          <span className="font-semibold">{customerName}</span>
        </div>
        {type === 'laundry' && order.deliveryType && (
          <div className="flex justify-between">
            <span className="text-gray-600">{lbl('Delivery', 'التوصيل')}:</span>
            <span className="font-semibold">
              {bilingualAr
                ? `${deliveryTypeMap[order.deliveryType]?.en} | ${deliveryTypeMap[order.deliveryType]?.ar}`
                : deliveryTypeMap[order.deliveryType]?.en}
            </span>
          </div>
        )}
        {(order.customerPhone || order.customer?.phone || order.customerId?.phone) && (
          <div className="flex justify-between">
            <span className="text-gray-600">{lbl('Phone', 'رقم الهاتف')}:</span>
            <span className="font-semibold">{order.customerPhone || order.customer?.phone || order.customerId?.phone}</span>
          </div>
        )}
        {type === 'restaurant' && order.orderType && (
          <div className="flex justify-between">
            <span className="text-gray-600">{lbl('Type', 'نوع الطلب')}:</span>
            <span className="font-bold">{orderTypeLabel}</span>
          </div>
        )}
        {type === 'restaurant' && order.tableNumber && (
          <div className="flex justify-between">
            <span className="text-gray-600">{lbl('Table', 'الطاولة')}:</span>
            <span className="font-bold">{order.tableNumber}</span>
          </div>
        )}
        {order.paymentMethod && (
          <div className="flex justify-between">
            <span className="text-gray-600">{lbl('Payment', 'طريقة الدفع')}:</span>
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
            <span className="text-gray-600">{lbl('Notes', 'ملاحظات')}:</span>
            <span className="font-semibold text-amber-700">{order.notes}</span>
          </div>
        )}
        {type === 'khayyat' && (
          <>
            {order.dueDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">{lbl('Due', 'تاريخ التسليم')}:</span>
                <span className="font-bold">{new Date(order.dueDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}</span>
              </div>
            )}
            <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-gray-300">
              <span className="text-gray-600">{lbl('Paid', 'المدفوع')}:</span>
              <span className="font-bold">{money(order.paidAmount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{lbl('Balance', 'المتبقي')}:</span>
              <span className="font-bold text-red-600">{money(Math.max(0, Number(order.price || 0) - Number(order.paidAmount || 0)))}</span>
            </div>
          </>
        )}
      </div>

      <table className="w-full text-[9px] mb-3 border-collapse">
        <thead>
          <tr className="border-b border-dashed border-gray-400 text-gray-700">
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
                  <div className={`${isKitchen ? 'text-gray-900 font-bold text-sm mt-1' : 'text-gray-600 mt-0.5'} leading-tight`}>
                    {item.nameAr || item.productNameAr}
                  </div>
                )}
                
                {type === 'laundry' && item.treatment && (
                  <div className="text-[8px] text-teal-700 mt-1 font-semibold leading-none flex flex-wrap gap-1">
                    <span>
                      {bilingualAr
                        ? `[${item.treatment} | ${treatmentMap[item.treatment] || item.treatment}]`
                        : `[${item.treatment}]`}
                    </span>
                    {item.customizations?.length > 0 && (
                      <span className="text-gray-500 font-normal">
                        ({item.customizations.map(c => (bilingualAr ? (customizationMap[c] || c) : c)).join(', ')})
                      </span>
                    )}
                  </div>
                )}
                
                {!isKitchen && (
                  <div className="text-[8px] text-gray-400 mt-0.5">
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
          <div className="border-t border-dashed border-gray-400 pt-2 text-[9px] space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">{lbl('Subtotal', 'المجموع الفرعي')}:</span>
              <span>{money(order.subtotal || order.price || 0)}</span>
            </div>
            {order.isUrgent && (
              <div className="flex justify-between font-semibold text-amber-700">
                <span>{lbl('Urgent Fee', 'رسوم العاجل')}:</span>
                <span>{money(order.urgentFee || 0)}</span>
              </div>
            )}
            {type !== 'khayyat' && Number(order.totalVat || order.totalTax || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">{lbl(bilingualAr ? 'VAT (15%)' : 'Tax', 'ضريبة القيمة المضافة')}:</span>
                <span>{money(order.totalVat || order.totalTax || 0)}</span>
              </div>
            )}
            <div className="flex justify-between mt-2 pt-2 border-t border-dashed border-gray-300 font-extrabold text-sm text-gray-900">
              <span>{lbl('Total', 'الإجمالي النهائي')}:</span>
              <span>{money(order.grandTotal || order.total || order.price || 0)}</span>
            </div>
          </div>

          <div className="my-5 flex flex-row items-center justify-center gap-4">
            {thermalSettings.showQrCode && zatcaQrPayload && (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-[7px] text-gray-500 mb-1 font-bold whitespace-nowrap">
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

            {type === 'khayyat' && order._id && (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-[7px] text-gray-500 mb-1 font-bold whitespace-nowrap">
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
        <div className="text-center text-[9px] mt-4 pt-3 border-t border-dashed border-gray-400 text-gray-600 space-y-0.5">
          <p className="font-extrabold text-gray-900 text-[10px]">{isRtl ? thermalSettings.footerTextAr : thermalSettings.footerTextEn}</p>
          <p>{isRtl ? 'يرجى الاحتفاظ بالإيصال.' : 'Please keep this receipt.'}</p>
          <p className="text-[8px] text-gray-400 mt-2">Maqder POS powered by Advanced Solutions</p>
        </div>
      )}
    </div>
  )
})

ThermalReceipt.displayName = 'ThermalReceipt'
export default ThermalReceipt

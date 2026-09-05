import { forwardRef } from 'react';
import { getThermalPrinterSettings, getReceiptStyle, getPrintCss, getPageCss } from '../../lib/thermalPrinter';
import { getTaxQrLabel } from '../../lib/saudiTenant'
import { getZatcaDocumentTitle } from '../../lib/commercialDocumentLabels';

/**
 * BoutiqueThermalReceipt
 * ZATCA Phase 2 compliant 80mm thermal receipt for Ladies Boutique & Dress Rental.
 * Supports both sale and rental transactions with bilingual EN/AR display.
 *
 * Print-optimized CSS:
 *  - @page { size: auto; margin: 0; } ensures the browser prints on continuous roll paper.
 *  - The receipt container is fixed to 80mm width.
 *  - All web UI chrome is hidden via print:hidden utilities.
 */

const BoutiqueThermalReceipt = forwardRef(({ rental, tenant, invoice, qrDataUrl }, ref) => {
  if (!rental) return null;

  const thermalSettings = getThermalPrinterSettings(tenant);

  const isSale = rental.transactionType === 'sale';
  const logoUrl = tenant?.settings?.invoiceBranding?.logo || tenant?.logo || '';
  const businessName = tenant?.business?.legalNameEn || tenant?.name || 'Boutique';
  const businessNameAr = tenant?.business?.legalNameAr || 'بوتيك';
  const vatNumber = tenant?.business?.vatNumber || '000000000000000';
  const address = [tenant?.business?.address?.street, tenant?.business?.address?.city]
    .filter(Boolean)
    .join(', ');

  const receiptNumber = rental.rentalNumber || '---';
  const titleInvoice = invoice || {
    transactionType: 'B2C',
    invoiceTypeCode: '0200000',
    zatca: { invoiceType: 'simplified' },
  }
  const titleEn = getZatcaDocumentTitle(titleInvoice, 'en')
  const titleAr = getZatcaDocumentTitle(titleInvoice, 'ar')
  const customerName = rental.customerName || '';
  const customerNameAr = rental.customerNameAr || '';
  const customerPhone = rental.customerPhone || '---';
  const startDate = rental.startDate ? new Date(rental.startDate).toLocaleDateString('en-GB') : '---';
  const endDate = rental.endDate ? new Date(rental.endDate).toLocaleDateString('en-GB') : '---';
  const issueDate = rental.createdAt ? new Date(rental.createdAt).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');

  const lineItems = rental.lineItems || [];
  const rentalSubtotal = rental.rentalSubtotal || 0;
  const discount = rental.discount || 0;
  const totalDeposit = rental.totalDeposit || 0;
  const totalTax = rental.totalTax || 0;
  const grandTotal = rental.grandTotal || 0;

  // Use backend-generated QR data URL if available, otherwise fall back to raw QR data
  const qrImageSrc = qrDataUrl || '';
  const qrRawData = invoice?.zatca?.qrCodeData || rental.invoiceId?.zatca?.qrCodeData || '';

  // Helper: detect if text is Arabic
  const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || '');

  const receiptStyle = getReceiptStyle(thermalSettings);
  const printCss = getPrintCss('thermal-receipt', thermalSettings);
  const pageCss = getPageCss(thermalSettings);

  return (
    <div
      ref={ref}
      className="thermal-receipt bg-white text-black font-mono"
      style={receiptStyle}
    >
      <style>{`
        ${pageCss}
        ${printCss}
      `}</style>

      {/* Logo */}
      {logoUrl && (
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <img
            src={logoUrl}
            alt=""
            style={{ maxHeight: '16mm', maxWidth: '60mm', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Header — Bilingual */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
          {businessName}
        </div>
        {businessNameAr && (
          <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            {businessNameAr}
          </div>
        )}
        {address && (
          <div style={{ fontSize: '8px', marginTop: '3px', color: '#444' }}>{address}</div>
        )}
        <div style={{ fontSize: '8px', marginTop: '2px' }}>
          VAT / الرقم الضريبي: <b>{vatNumber}</b>
        </div>
        <div style={{ fontSize: '9px', marginTop: '6px', fontWeight: 'bold' }}>
          {String(titleEn || '').toUpperCase()}
        </div>
        <div style={{ fontSize: '9px', fontWeight: 'bold' }}>
          {titleAr}
        </div>
        {isSale && (
          <div style={{ fontSize: '8px', marginTop: '2px', color: '#10B981' }}>
            SALE / بيع
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

      {/* Meta — Bilingual */}
      <div style={{ marginBottom: '8px', fontSize: '9px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Receipt No / رقم الإيصال:</span>
          <b>{receiptNumber}</b>
        </div>
        {invoice?.invoiceNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Invoice No / رقم الفاتورة:</span>
            <b>{invoice.invoiceNumber}</b>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date / التاريخ:</span>
          <span>{issueDate}</span>
        </div>
        {customerName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer / العميل:</span>
            <b style={{ textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word' }}>
              {customerName}
              {customerNameAr && <div style={{ fontSize: '8px', color: '#555' }}>{customerNameAr}</div>}
            </b>
          </div>
        )}
        {!customerName && customerNameAr && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer / العميل:</span>
            <b>{customerNameAr}</b>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Phone / الجوال:</span>
          <span>{customerPhone}</span>
        </div>
        {!isSale && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pickup / الاستلام:</span>
              <span>{startDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Return / الإرجاع:</span>
              <span>{endDate}</span>
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr style={{ borderBottom: '1px dashed #999' }}>
            <th style={{ textAlign: 'left', padding: '2px 0', fontWeight: 'bold' }}>Item / البند</th>
            {!isSale && (
              <th style={{ textAlign: 'center', padding: '2px 0', fontWeight: 'bold' }}>Days / أيام</th>
            )}
            <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold' }}>Total / المجموع</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px dashed #ddd' }}>
              <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold' }}>
                  {item.productName || item.name}
                </div>
                {(item.productNameAr || item.nameAr) && (
                  <div style={{ fontSize: '8px', color: '#555', direction: 'rtl', textAlign: 'right' }}>
                    {item.productNameAr || item.nameAr}
                  </div>
                )}
                <div style={{ fontSize: '8px', color: '#555' }}>
                  {item.sku} {item.size ? `· ${item.size}` : ''}
                </div>
              </td>
              {!isSale && (
                <td style={{ textAlign: 'center', padding: '3px 0', verticalAlign: 'top' }}>
                  {item.rentalDays || 1}
                </td>
              )}
              <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold', verticalAlign: 'top' }}>
                SAR {(item.rentalSubtotal || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

      {/* Totals */}
      <div style={{ fontSize: '9px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Subtotal / الإجمالي الفرعي:</span>
          <span>SAR {rentalSubtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Discount / خصم:</span>
            <span style={{ color: '#059669' }}>-SAR {discount.toFixed(2)}</span>
          </div>
        )}
        {totalDeposit > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Security Deposit / التأمين:</span>
            <span>SAR {totalDeposit.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>VAT 15% / ضريبة القيمة المضافة:</span>
          <span>SAR {totalTax.toFixed(2)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            paddingTop: '4px',
            borderTop: '1px dashed #ccc',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          <span>Total / الإجمالي:</span>
          <span>SAR {grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

      {/* Tax QR */}
      {qrImageSrc ? (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <img
            src={qrImageSrc}
            alt="Tax QR"
            style={{ width: '45mm', height: '45mm', imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
          />
          <div style={{ fontSize: '7px', color: '#666', marginTop: '4px' }}>
            {getTaxQrLabel(tenant, tenant?.settings?.currency)}
          </div>
        </div>
      ) : qrRawData ? (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrRawData)}`}
            alt="Tax QR"
            style={{ width: '45mm', height: '45mm', imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
          />
          <div style={{ fontSize: '7px', color: '#666', marginTop: '4px' }}>
            {getTaxQrLabel(tenant, tenant?.settings?.currency)}
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '8px', color: '#555' }}>
        <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#000', marginBottom: '3px' }}>
          Thank you for choosing us!
        </div>
        <div>شكراً لاختياركم</div>
        {!isSale && (
          <>
            <div style={{ marginTop: '4px' }}>Please keep this receipt for returns.</div>
            <div>يرجى الاحتفاظ بهذا الإيصال عند الإرجاع</div>
          </>
        )}
      </div>

      {/* Spacer for cutter */}
      <div style={{ height: '4mm' }} />
    </div>
  );
});

BoutiqueThermalReceipt.displayName = 'BoutiqueThermalReceipt';
export default BoutiqueThermalReceipt;

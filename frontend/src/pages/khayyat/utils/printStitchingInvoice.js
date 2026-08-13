const t = (key) => key;
import QRCode from 'qrcode';
import { formatSaudiRiyal } from './saudi';

const buildTlv = (fields) => {
  const result = [];
  fields.forEach((field) => {
    const value = String(field.value ?? '');
    const valueBytes = new TextEncoder().encode(value);
    result.push(field.tag, valueBytes.length, ...valueBytes);
  });
  return btoa(String.fromCharCode(...result));
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeInvoiceLanguage = (value) => (value === 'ar' ? 'ar' : 'en');

const formatDisplayDate = (value, labelLang) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(labelLang === 'ar' ? 'ar-SA' : 'en-GB').format(date);
};

export const printStitchingInvoice = async ({ stitch, user, resolveUploadsUrl }) => {
  if (!stitch || !user) return;

  const labelLang = normalizeInvoiceLanguage(user?.invoiceLanguage);
  const isArabic = labelLang === 'ar';

  const logoBase = user?.logo && user.logo !== 'null' && user.logo !== 'undefined'
    ? (typeof resolveUploadsUrl === 'function' ? resolveUploadsUrl(user.logo) : user.logo)
    : '';
  const logoSrc = logoBase || '';

  const customerNameEn = stitch.customerId?.nameI18n?.en || stitch.customerId?.name || '-';
  const customerNameAr = stitch.customerId?.nameI18n?.ar || stitch.customerId?.name || customerNameEn || '-';
  const customerDisplayName = isArabic ? customerNameAr : customerNameEn;
  
  // Shop name based on invoice language setting
  const shopName = isArabic
    ? (user?.businessNameAr || user?.businessName || '')
    : (user?.businessName || user?.businessNameAr || '');
  
  // Strip + from phone for display (show 966XXXXXXXXX format without +)
  const rawPhone = stitch.customerId?.phone || '';
  const displayPhone = rawPhone.replace(/^\+/, '');

  const labels = {
    customer: { en: 'Customer', ar: 'العميل' },
    phone: { en: 'Phone', ar: 'الهاتف' },
    fabric: { en: 'Fabric', ar: 'القماش' },
    quantity: { en: 'Quantity', ar: 'الكمية' },
    price: { en: 'Price', ar: 'السعر' },
    paid: { en: 'Paid', ar: 'المدفوع' },
    balance: { en: 'Pending', ar: 'المتبقي' },
    dueDate: { en: 'Due Date', ar: 'تاريخ التسليم' },
    status: { en: 'Status', ar: 'الحالة' },
    oldInvoice: { en: 'Old Invoice', ar: 'رقم فاتورة سابق' },
    notes: { en: 'Notes', ar: 'ملاحظات' },
    measurementImage: { en: 'Measurement Image', ar: 'صورة المقاس' },
    scanToTrack: { en: 'Scan to track order', ar: 'امسح لتتبع الطلب' }
  };

  const statusLabels = {
    pending: { en: 'Pending', ar: 'قيد الانتظار' },
    assigned: { en: 'Assigned', ar: 'تم التعيين' },
    in_progress: { en: 'In Progress', ar: 'جاري العمل' },
    completed: { en: 'Completed', ar: 'مكتمل' },
    delivered: { en: 'Delivered', ar: 'تم التسليم' },
    stitching: { en: 'Stitching', ar: 'الخياطة' },
    finishing: { en: 'Finishing', ar: 'التشطيب' },
    laundry: { en: 'Laundry', ar: 'الغسيل' },
    done: { en: 'Done', ar: 'جاهز' }
  };

  const getLabel = (key) => (labelLang === 'ar' ? labels[key]?.ar || key : labels[key]?.en || key);

  const getStatusLabel = (status) => {
    const resolved = statusLabels[status] || { en: status || 'Pending', ar: status || 'Pending' };
    return labelLang === 'ar' ? resolved.ar : resolved.en;
  };

  const sarSvg = `<svg viewBox="0 0 1124.14 1256.39" width="14" height="14" style="display:inline;vertical-align:middle;margin-${isArabic ? 'left' : 'right'}:4px;" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z" /><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z" /></svg>`;

  let qrCodeUrl = '';
  let zatcaQrUrl = '';
  const zatcaEnabled = user?.zatcaSettings?.enabled && user?.zatcaSettings?.showOnInvoice;

  try {
    qrCodeUrl = await QRCode.toDataURL(`${window.location.origin}/track-order?id=${stitch.trackToken || stitch._id}`, { width: 120, margin: 1 });

    if (zatcaEnabled && user?.zatcaSettings?.vatNumber) {
      const vatRate = 0.15;
      const total = parseFloat(stitch.price) || 0;
      const vatAmount = (total * vatRate / (1 + vatRate)).toFixed(2);
      const timestamp = new Date().toISOString();
      const tlvData = buildTlv([
        { tag: 1, value: user?.businessName || '' },
        { tag: 2, value: user?.zatcaSettings?.vatNumber || '' },
        { tag: 3, value: timestamp },
        { tag: 4, value: total.toFixed(2) },
        { tag: 5, value: vatAmount }
      ]);
      zatcaQrUrl = await QRCode.toDataURL(tlvData, { width: 120, margin: 1 });
    }
  } catch (error) {
    console.error('QR generation error:', error);
  }

  const balance = (parseFloat(stitch.price) || 0) - (parseFloat(stitch.paidAmount) || 0);
  const formattedPrice = formatSaudiRiyal(stitch.price || 0);
  const formattedPaid = formatSaudiRiyal(stitch.paidAmount || 0);
  const formattedBalance = formatSaudiRiyal(balance);
  const formattedDueDate = formatDisplayDate(stitch.dueDate, labelLang);
  const fabricDisplay = stitch.fabricId?.name || stitch.customFabricName || '-';
  const measurementImageBase = stitch.measurementImage
    ? (typeof resolveUploadsUrl === 'function' ? resolveUploadsUrl(stitch.measurementImage) : stitch.measurementImage)
    : '';
  const measurementImageSrc = measurementImageBase
    ? `${measurementImageBase}${stitch.measurementImageUpdatedAt ? `${measurementImageBase.includes('?') ? '&' : '?'}v=${stitch.measurementImageUpdatedAt}` : ''}`
    : '';

  const notesHtml = stitch.notes ? escapeHtml(stitch.notes).replace(/\n/g, '<br />') : '';

  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="${labelLang === 'ar' ? 'rtl' : 'ltr'}">
    <head>
      <title>Print Invoice</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-weight: bold !important; }
        html, body { width: 80mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 4mm 3mm; font-weight: bold !important; word-break: break-word; overflow-wrap: break-word; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 8px; }
        .logo { width: 60px; height: 60px; object-fit: contain; margin: 0 auto 8px; display: block; border-radius: 8px; }
        .shop-name { font-size: 13px; font-weight: bold !important; margin: 0 0 4px; text-align: center; white-space: normal; overflow-wrap: anywhere; line-height: 1.35; }
        .invoice-box { border: 1.5px solid #333; margin: 8px 0; width: 100%; }
        .invoice-number { font-size: 15px; font-weight: bold !important; text-align: center; padding: 8px 4px; border-bottom: 1.5px solid #333; white-space: normal; overflow-wrap: anywhere; line-height: 1.35; }
        .details-table { border-top: 2px solid #333; }
        .info-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; padding: 6px 5px; border-bottom: 1px solid #333; }
        .info-row:last-child { border-bottom: 0; }
        .label { color: #333; font-weight: bold !important; flex: 0 0 42%; }
        .value { font-weight: bold !important; word-break: break-word; overflow-wrap: anywhere; text-align: ${labelLang === 'ar' ? 'left' : 'right'}; flex: 1 1 58%; min-width: 0; }
        .notes-block { margin-top: 12px; padding-top: 12px; border-top: 2px dashed #333; }
        .notes-label { font-size: 9px; color: #333; margin-bottom: 6px; font-weight: bold !important; }
        .notes-value { font-size: 10px; line-height: 1.5; color: #111827; font-weight: bold !important; white-space: normal; word-break: break-word; overflow-wrap: break-word; }
        .qr-container { display: flex; justify-content: center; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 2px dashed #333; }
        .qr-box { flex: 1; text-align: center; max-width: 100px; }
        .qr-box img { width: 70px; height: 70px; border: 2px solid #e5e7eb; border-radius: 8px; padding: 4px; background: #fff; }
        .qr-label { font-size: 8px; color: #374151; margin-top: 6px; font-weight: bold !important; line-height: 1.2; }
        .qr-sublabel { font-size: 7px; color: #333; font-weight: bold !important; margin-top: 2px; }
        .single-qr { text-align: center; margin-top: 12px; padding-top: 12px; border-top: 2px dashed #333; }
        .single-qr img { width: 80px; height: 80px; border: 2px solid #e5e7eb; border-radius: 8px; padding: 4px; background: #fff; }
        .measurement-photo { margin-top: 12px; padding-top: 12px; border-top: 2px dashed #333; }
        .measurement-photo img { width: 100%; max-height: 220px; object-fit: cover; border: 2px solid #e5e7eb; border-radius: 10px; display: block; }
        .measurement-photo-label { font-size: 9px; color: #333; margin-bottom: 6px; font-weight: bold !important; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" class="logo" />` : ''}
      </div>
      ${shopName ? `<div class="shop-name">${escapeHtml(shopName)}</div>` : ''}
      <div class="invoice-box">
        <div class="invoice-number">${escapeHtml(stitch.receiptNumber || stitch._id?.slice(-6) || 'N/A')}</div>
        <div class="details-table">
          <div class="info-row"><span class="label">${escapeHtml(getLabel('customer'))}</span><span class="value">${escapeHtml(customerDisplayName)}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('phone'))}</span><span class="value">${escapeHtml(displayPhone || '-')}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('fabric'))}</span><span class="value">${escapeHtml(fabricDisplay)}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('quantity'))}</span><span class="value">${escapeHtml(String(stitch.quantity || 1))}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('price'))}</span><span class="value">${formattedPrice} ${sarSvg}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('paid'))}</span><span class="value">${formattedPaid} ${sarSvg}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('balance'))}</span><span class="value" style="color: ${balance > 0 ? '#dc2626' : '#16a34a'}">${formattedBalance} ${sarSvg}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('dueDate'))}</span><span class="value">${escapeHtml(formattedDueDate)}</span></div>
          <div class="info-row"><span class="label">${escapeHtml(getLabel('status'))}</span><span class="value">${escapeHtml(getStatusLabel(stitch.status))}</span></div>
          ${stitch.oldInvoiceNumber ? `<div class="info-row"><span class="label">${escapeHtml(getLabel('oldInvoice'))}</span><span class="value">${escapeHtml(stitch.oldInvoiceNumber)}</span></div>` : ''}
        </div>
      </div>
      ${notesHtml ? `
      <div class="notes-block">
        <div class="notes-label">${escapeHtml(getLabel('notes'))}</div>
        <div class="notes-value">${notesHtml}</div>
      </div>
      ` : ''}
      ${measurementImageSrc ? `<div class="measurement-photo"><div class="measurement-photo-label">${escapeHtml(getLabel('measurementImage'))}</div><img src="${escapeHtml(measurementImageSrc)}" alt="Measurement" /></div>` : ''}
      ${zatcaQrUrl && qrCodeUrl ? `
      <div class="qr-container">
        <div class="qr-box">
          <img src="${zatcaQrUrl}" alt="ZATCA QR" />
          <div class="qr-label">${labelLang === 'ar' ? 'الفاتورة الإلكترونية' : 'Electronic Invoice'}</div>
          <div class="qr-sublabel">ZATCA</div>
        </div>
        <div class="qr-box">
          <img src="${qrCodeUrl}" alt="Track QR" />
          <div class="qr-label">${labelLang === 'ar' ? 'تتبع الطلب' : 'Track Order'}</div>
          <div class="qr-sublabel">${escapeHtml(getLabel('scanToTrack'))}</div>
        </div>
      </div>
      ` : qrCodeUrl ? `
      <div class="single-qr">
        <img src="${qrCodeUrl}" alt="QR Code" />
        <div class="qr-label" style="font-size: 9px; margin-top: 6px;">${escapeHtml(getLabel('scanToTrack'))}</div>
      </div>
      ` : ''}
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `);

  printWindow.document.close();
};

export default printStitchingInvoice;

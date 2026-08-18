import jsPDF from 'jspdf'
import 'jspdf-autotable'
import toast from 'react-hot-toast'
import { getUomLabel } from './uomOptions'
import { getDeliveryWindowLabel } from './deliveryWindows'

const safeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/[\u200e\u200f\u061c]/g, '')
    .trim()
}

export async function downloadDeliveryNotePdf({ deliveryNote, tenant, language = 'en' }) {
  if (!deliveryNote) {
    toast.error(language === 'ar' ? 'بيانات سند التسليم غير متوفرة' : 'Delivery note data unavailable')
    return
  }

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const isAr = language === 'ar'

    const dnNumber = deliveryNote.dnNumber || 'DN-DRAFT'
    const companyEn = tenant?.business?.legalNameEn || tenant?.name || 'Company'
    const companyAr = tenant?.business?.legalNameAr || ''
    const crNumber = tenant?.business?.crNumber || tenant?.business?.commercialRegistration?.crNumber || ''
    const vatNumber = tenant?.business?.vatNumber || tenant?.business?.vatCertificate?.vatNumber || ''

    const branding = tenant?.settings?.invoiceBranding || {}
    const logoUrl = branding.logoUrl || tenant?.logo || null

    const customerName =
      deliveryNote.customerName ||
      (isAr
        ? deliveryNote.customerId?.nameAr || deliveryNote.customerId?.nameEn
        : deliveryNote.customerId?.nameEn || deliveryNote.customerId?.nameAr) ||
      '—'

    const recipientName = deliveryNote.recipientName || customerName
    const recipientPhone = deliveryNote.recipientPhone || deliveryNote.customerId?.phone || '—'
    const destinationAddress = deliveryNote.shippingAddress || (typeof deliveryNote.customerId?.address === 'string' ? deliveryNote.customerId.address : '') || '—'
    const destinationCity = deliveryNote.destinationCity || deliveryNote.customerId?.city || ''

    const dispatchDateStr = deliveryNote.dispatchDate
      ? new Date(deliveryNote.dispatchDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')
      : (deliveryNote.deliveryDate ? new Date(deliveryNote.deliveryDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '—')
    const dispatchTimeStr = deliveryNote.dispatchTime || '—'

    const estDeliveredDateStr = deliveryNote.estimatedDeliveryDate
      ? new Date(deliveryNote.estimatedDeliveryDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')
      : dispatchDateStr
    const estDeliveryTimeStr = deliveryNote.estimatedDeliveryTime || '—'
    const deliveryWindowLabel = getDeliveryWindowLabel(deliveryNote.deliveryWindow, language)

    const driverName = deliveryNote.driverName || '—'
    const driverPhone = deliveryNote.driverPhone || '—'
    const vehicleNumber = deliveryNote.vehicleNumber || '—'
    const carrier = deliveryNote.carrier || '—'
    const trackingNumber = deliveryNote.trackingNumber || '—'

    const sourceRef =
      deliveryNote.quotationId?.quotationNumber ||
      (typeof deliveryNote.quotationId === 'string' ? deliveryNote.quotationId : '') ||
      deliveryNote.purchaseOrderId?.poNumber ||
      (typeof deliveryNote.purchaseOrderId === 'string' ? deliveryNote.purchaseOrderId : '') ||
      (isAr ? 'مباشر / يدوي' : 'Direct Entry')

    // ─── HEADER BANNER ──────────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42) // Slate 900
    doc.rect(0, 0, 210, 32, 'F')

    // Header Titles
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(safeText(companyEn), 14, 12)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(203, 213, 225)
    const crVatLine = [
      crNumber ? `C.R: ${crNumber}` : '',
      vatNumber ? `VAT: ${vatNumber}` : ''
    ].filter(Boolean).join('  |  ')
    doc.text(safeText(crVatLine), 14, 18)

    // Document Type Banner Right Side
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(16, 185, 129) // Emerald 500
    doc.text('DELIVERY NOTE / PROOF OF DELIVERY', 196, 12, { align: 'right' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(safeText(dnNumber), 196, 18, { align: 'right' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(203, 213, 225)
    doc.text(`Status: ${safeText(deliveryNote.status || 'Delivered').toUpperCase()}`, 196, 24, { align: 'right' })

    let currentY = 38

    // ─── LOGISTICS, DISPATCH & TIMING CARDS ───────────────────────────────────────
    // Left Box: Customer & Destination
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(14, currentY, 89, 44, 2, 2, 'FD')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('CONSIGNEE / DELIVERED TO:', 18, currentY + 6)

    doc.setFontSize(9.5)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text(safeText(customerName), 18, currentY + 12, { maxWidth: 81 })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    if (recipientName && recipientName !== customerName) {
      doc.text(`Attn: ${safeText(recipientName)}`, 18, currentY + 18, { maxWidth: 81 })
    }
    doc.text(`Phone: ${safeText(recipientPhone)}`, 18, currentY + 24)
    const addrFull = [destinationCity, destinationAddress].filter(Boolean).join(' - ')
    doc.text(`Address: ${safeText(addrFull)}`, 18, currentY + 30, { maxWidth: 81 })
    if (deliveryNote.customerId?.vatNumber) {
      doc.text(`VAT No: ${safeText(deliveryNote.customerId.vatNumber)}`, 18, currentY + 36)
    }

    // Right Box: Dispatch & Estimated Delivery Schedule
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(107, currentY, 89, 44, 2, 2, 'FD')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('DISPATCH & DELIVERY SCHEDULE:', 111, currentY + 6)

    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text(`Dispatch Date & Time:`, 111, currentY + 12)
    doc.setFont('helvetica', 'normal')
    doc.text(`${dispatchDateStr} (${dispatchTimeStr})`, 155, currentY + 12)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(5, 150, 105) // Emerald text
    doc.text(`Est. Delivered Date:`, 111, currentY + 18)
    doc.setFont('helvetica', 'normal')
    doc.text(`${estDeliveredDateStr} (${estDeliveryTimeStr})`, 155, currentY + 18)

    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text(`Delivery Window:`, 111, currentY + 24)
    doc.setFont('helvetica', 'normal')
    doc.text(safeText(deliveryWindowLabel), 155, currentY + 24, { maxWidth: 39 })

    doc.setFont('helvetica', 'bold')
    doc.text(`Source Document Ref:`, 111, currentY + 31)
    doc.setFont('helvetica', 'normal')
    doc.text(safeText(sourceRef), 155, currentY + 31, { maxWidth: 39 })

    doc.setFont('helvetica', 'bold')
    doc.text(`Carrier / AWB Track:`, 111, currentY + 38)
    doc.setFont('helvetica', 'normal')
    const trackStr = [carrier !== '—' ? carrier : '', trackingNumber !== '—' ? trackingNumber : ''].filter(Boolean).join(' - ') || 'Direct Fleet'
    doc.text(safeText(trackStr), 155, currentY + 38, { maxWidth: 39 })

    currentY += 49

    // ─── DRIVER & VEHICLE STRIP ──────────────────────────────────────────────────
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(203, 213, 225)
    doc.roundedRect(14, currentY, 182, 12, 1.5, 1.5, 'FD')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(51, 65, 85)
    doc.text('Assigned Driver:', 18, currentY + 7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`${safeText(driverName)} (Tel: ${safeText(driverPhone)})`, 45, currentY + 7.5)

    doc.setFont('helvetica', 'bold')
    doc.text('Vehicle / Plate No:', 120, currentY + 7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(safeText(vehicleNumber), 155, currentY + 7.5)

    currentY += 17

    // ─── LINE ITEMS TABLE ────────────────────────────────────────────────────────
    const tableHeaders = [['#', 'Item Description / Specification', 'UOM', 'Delivered Qty']]
    const tableBody = (deliveryNote.lineItems || []).map((item, idx) => {
      const desc = item.description || item.productName || item.productNameAr || 'Item'
      const uom = getUomLabel(item.unitCode || 'PCE', 'en')
      const qty = String(item.quantityDelivered || 0)
      return [String(idx + 1), desc, uom, qty]
    })

    doc.autoTable({
      head: tableHeaders,
      body: tableBody,
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: (data) => {
        currentY = data.cursor.y
      }
    })

    currentY += 8

    // ─── NOTES BOX ───────────────────────────────────────────────────────────────
    if (deliveryNote.notes) {
      doc.setFillColor(254, 252, 232) // Amber 50
      doc.setDrawColor(254, 240, 138) // Amber 200
      doc.roundedRect(14, currentY, 182, 14, 1.5, 1.5, 'FD')

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(161, 98, 7)
      doc.text('Delivery Instructions / Gate Pass Notes:', 18, currentY + 5.5)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(113, 63, 18)
      doc.text(safeText(deliveryNote.notes), 18, currentY + 10, { maxWidth: 174 })

      currentY += 19
    }

    // Check if we have room for signatures, else add page
    if (currentY > 235) {
      doc.addPage()
      currentY = 25
    } else {
      currentY = Math.max(currentY, 230)
    }

    // ─── SIGNATURES & ACKNOWLEDGMENT ─────────────────────────────────────────────
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)

    // Sender / Dispatched Box
    doc.roundedRect(14, currentY, 87, 45, 2, 2, 'D')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text('DISPATCHED BY (Sender / Warehouse):', 18, currentY + 6)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Authorized Signatory & Official Stamp', 18, currentY + 11)

    doc.setDrawColor(203, 213, 225)
    doc.line(18, currentY + 34, 95, currentY + 34)
    doc.setFontSize(7)
    doc.text('Signature & Date / التوقيع والتاريخ', 18, currentY + 38)

    // Receiver / Consignee Box
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(109, currentY, 87, 45, 2, 2, 'D')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text('RECEIVED BY (Consignee / Customer):', 113, currentY + 6)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Received above goods in good order and condition', 113, currentY + 11)

    doc.setDrawColor(203, 213, 225)
    doc.line(113, currentY + 34, 190, currentY + 34)
    doc.setFontSize(7)
    doc.text('Receiver Name, Signature & Stamp / اسم وتوقيع المستلم والختم', 113, currentY + 38)

    // ─── FOOTER ──────────────────────────────────────────────────────────────────
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`Generated electronically by MAQDER Enterprise Delivery Platform | ${dnNumber} | Page 1 of 1`, 105, 290, { align: 'center' })

    const fileName = `Delivery_Note_${dnNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
    doc.save(fileName)
    toast.success(language === 'ar' ? 'تم تنزيل ملف PDF لسند التسليم بنجاح' : 'Delivery Note PDF downloaded successfully')
  } catch (err) {
    console.error('Failed to generate Delivery Note PDF:', err)
    toast.error(language === 'ar' ? 'فشل إنشاء ملف PDF' : 'Failed to generate Delivery Note PDF')
  }
}

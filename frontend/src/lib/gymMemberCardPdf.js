import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'

const safeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[\u200e\u200f\u061c]/g, '').trim()
}

/**
 * Generates an ultra-premium CR80 wallet-sized Member ID Pass or A4 Printable sheet.
 */
export async function downloadGymMemberCardPdf({ member, subscription, tenant, language = 'en' }) {
  if (!member) {
    toast.error(language === 'ar' ? 'بيانات العضو غير متوفرة' : 'Member data is unavailable')
    return
  }

  try {
    // CR80 Card Dimensions: 85.6mm x 54mm (landscape)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })
    const isAr = language === 'ar'

    const gymName = tenant?.business?.legalNameEn || tenant?.name || 'FITNESS & GYM CLUB'
    const memberNameEn = safeText(member.nameEn || `${member.firstName || ''} ${member.lastName || ''}`)
    const memberNameAr = safeText(member.nameAr || `${member.firstNameAr || ''} ${member.lastNameAr || ''}`)
    const memberName = isAr ? (memberNameAr || memberNameEn) : (memberNameEn || memberNameAr)
    const memberNumber = member.memberNumber || 'GYM-0000'
    const phone = member.phone || '—'
    const bloodType = member.bloodType || '—'
    const planName = subscription?.planId?.nameEn || subscription?.planName || (isAr ? 'عضوية نشطة' : 'Active Member')
    const expiryDate = subscription?.endDate
      ? new Date(subscription.endDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')
      : (isAr ? 'غير محدد' : 'Ongoing')

    // 1. Generate QR Code Data URL (Turnstile / Kiosk Access String)
    const qrData = member.qrCode || member.memberNumber || member._id || 'GYM-ID'
    let qrDataUrl = ''
    try {
      qrDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 256,
        color: { dark: '#0f172a', light: '#ffffff' }
      })
    } catch {
      // ignore qr generation error
    }

    // 2. Background Gradient & Header Tile
    doc.setFillColor(15, 23, 42) // Deep Slate / Navy
    doc.roundedRect(0, 0, 85.6, 54, 0, 0, 'F')

    // Accent Gradient Bar (Energetic Orange + Emerald line)
    doc.setFillColor(249, 115, 22)
    doc.rect(0, 0, 4, 54, 'F')
    doc.setFillColor(16, 185, 129)
    doc.rect(4, 0, 1.5, 54, 'F')

    // 3. Header Text
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(gymName.toUpperCase(), 9, 8)

    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(isAr ? 'بطاقة عضوية رقمية موحدة' : 'OFFICIAL MEMBERSHIP PASS', 9, 12)

    // Divider Line
    doc.setDrawColor(51, 65, 85)
    doc.setLineWidth(0.3)
    doc.line(9, 14, 78, 14)

    // 4. Member Details Box
    doc.setFontSize(5.5)
    doc.setTextColor(148, 163, 184)
    doc.text(isAr ? 'اسم العضو / MEMBER' : 'MEMBER NAME', 9, 18)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(memberName.substring(0, 24) || 'MEMBER', 9, 22)

    // Member ID & Phone
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(isAr ? 'رقم العضوية' : 'MEMBER ID', 9, 27)
    doc.text(isAr ? 'الجوال' : 'PHONE', 34, 27)

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(251, 146, 60)
    doc.text(memberNumber, 9, 31)
    doc.setTextColor(255, 255, 255)
    doc.text(phone, 34, 31)

    // Plan & Expiry
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(isAr ? 'نوع الباقة' : 'PLAN TYPE', 9, 36)
    doc.text(isAr ? 'تاريخ الانتهاء' : 'EXPIRY DATE', 34, 36)

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(52, 211, 153)
    doc.text(planName.substring(0, 18), 9, 40)
    doc.setTextColor(255, 255, 255)
    doc.text(expiryDate, 34, 40)

    // Blood Type & Status
    if (bloodType && bloodType !== '—') {
      doc.setFontSize(5.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(isAr ? 'فصيلة الدم' : 'BLOOD', 9, 45)
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(244, 63, 94)
      doc.text(bloodType, 9, 49)
    }

    // 5. Draw QR Code Frame on the Right
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(56, 17, 24, 24, 2, 2, 'F')

    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 57.5, 18.5, 21, 21)
    }

    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(148, 163, 184)
    doc.text(isAr ? 'امسح للدخول' : 'SCAN AT GATE', 68, 44, { align: 'center' })

    // 6. Security Hologram Mockup Line
    doc.setDrawColor(249, 115, 22)
    doc.setLineWidth(0.2)
    doc.line(9, 51.5, 78, 51.5)

    doc.save(`Gym_Pass_${memberNumber}.pdf`)
    toast.success(isAr ? 'تم تنزيل بطاقة العضوية بنجاح' : 'Membership Pass downloaded successfully')
  } catch (err) {
    console.error('Member Card PDF Error:', err)
    toast.error(isAr ? 'فشل إنشاء بطاقة العضوية' : 'Failed to generate membership pass')
  }
}

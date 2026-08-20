import MarqueeAppointment from '../models/MarqueeAppointment.js';
import MarqueePackage from '../models/MarqueePackage.js';

export async function syncMarqueeBookingFromDocument({
  tenant,
  user,
  documentType = 'invoice', // 'invoice' | 'quotation'
  document, // Invoice or Quotation document
  body = {},
}) {
  try {
    const eventDate =
      body.eventDate ||
      body.marqueeEventDate ||
      document?.marqueeDetails?.eventDate ||
      document?.eventDate;

    if (!eventDate) return null; // No marquee event info on this doc

    const tenantId = tenant?._id || user?.tenantId;
    if (!tenantId) return null;

    const isInvoice = documentType === 'invoice';
    const isQuotation = documentType === 'quotation';

    // Find if a booking is already linked to this document
    const query = { tenantId };
    if (isInvoice && document._id) query.invoiceId = document._id;
    else if (isQuotation && document._id) query.quotationId = document._id;

    let booking = (isInvoice || isQuotation) && document._id
      ? await MarqueeAppointment.findOne(query)
      : null;

    const clientName =
      document.buyer?.name ||
      document.buyer?.nameAr ||
      body.clientName ||
      body.buyer?.name ||
      'Valued Guest';
    const clientPhone =
      document.buyer?.contactPhone ||
      body.clientPhone ||
      body.buyer?.contactPhone ||
      '—';
    const clientEmail =
      document.buyer?.contactEmail ||
      body.clientEmail ||
      '';

    const guestCount = Number(
      body.guestCount ||
      body.personCount ||
      document.marqueeDetails?.guestCount ||
      100
    );
    const eventShift =
      body.eventShift ||
      document.marqueeDetails?.eventShift ||
      'dinner';
    const hallName =
      body.hallName ||
      document.marqueeDetails?.hallName ||
      'Grand Ballroom';
    const eventStartTime =
      body.eventStartTime ||
      document.marqueeDetails?.eventStartTime ||
      '19:00';
    const eventEndTime =
      body.eventEndTime ||
      document.marqueeDetails?.eventEndTime ||
      '23:30';

    const advancePaid = Number(
      typeof body.advancePaid !== 'undefined'
        ? body.advancePaid
        : isInvoice
        ? document.paidAmount || 0
        : 0
    );
    const totalAmount = Number(
      document.grandTotal ||
      document.total ||
      body.totalAmount ||
      0
    );
    const remainingAmount = Math.max(0, totalAmount - advancePaid);

    const packageId =
      body.marqueePackageId ||
      body.packageId ||
      document.marqueeDetails?.packageId;
    let packageName =
      body.packageName ||
      document.marqueeDetails?.packageName;
    let ratePerHead = Number(
      body.ratePerHead ||
      document.marqueeDetails?.ratePerHead ||
      0
    );

    if (packageId && !packageName) {
      const pkg = await MarqueePackage.findById(packageId).lean();
      if (pkg) {
        packageName = pkg.name;
        if (!ratePerHead) ratePerHead = pkg.ratePerHead;
      }
    }

    const title =
      body.eventTitle ||
      body.title ||
      `${clientName} Event (${packageName || 'Hall Booking'})`;

    if (!booking) {
      // Create new booking
      const lastBooking = await MarqueeAppointment.findOne({ tenantId })
        .sort({ createdAt: -1 })
        .select('bookingNumber');

      const nextSeq = lastBooking?.bookingNumber
        ? parseInt(String(lastBooking.bookingNumber).split('-').pop() || '0', 10) + 1
        : 1;

      const year = new Date(eventDate).getFullYear() || new Date().getFullYear();
      const bookingNumber = `MQ-${year}-${String(nextSeq).padStart(5, '0')}`;

      booking = await MarqueeAppointment.create({
        tenantId,
        bookingNumber,
        title,
        eventType: body.eventType || 'wedding',
        eventDate: new Date(eventDate),
        eventShift,
        eventStartTime,
        eventEndTime,
        hallName,
        guestCount,
        customerId: document.buyer?.customerId || document.customerId,
        clientName,
        clientPhone,
        clientEmail,
        packageId: packageId || undefined,
        packageName,
        ratePerHead,
        hallBaseRent: Number(body.hallBaseRent || 0),
        subtotal: document.subtotal || totalAmount,
        taxAmount: document.taxAmount || 0,
        totalAmount,
        advancePaid,
        remainingAmount,
        currency: tenant?.settings?.currency || document.currency || 'SAR',
        invoiceId: isInvoice ? document._id : undefined,
        quotationId: isQuotation ? document._id : undefined,
        status: isInvoice ? 'confirmed' : 'tentative',
        notes: body.notes || document.notes,
        createdBy: user?._id,
      });
    } else {
      // Update existing booking
      booking.title = title;
      booking.eventDate = new Date(eventDate);
      booking.eventShift = eventShift;
      booking.hallName = hallName;
      booking.guestCount = guestCount;
      booking.totalAmount = totalAmount;
      booking.advancePaid = advancePaid;
      booking.remainingAmount = remainingAmount;
      if (packageId) booking.packageId = packageId;
      if (packageName) booking.packageName = packageName;
      if (isInvoice) booking.status = 'confirmed';
      await booking.save();
    }

    return booking;
  } catch (error) {
    console.warn('[MarqueeSync] Non-blocking booking sync error:', error.message);
    return null;
  }
}

export default { syncMarqueeBookingFromDocument };

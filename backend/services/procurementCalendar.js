import PurchaseOrder from '../models/PurchaseOrder.js';
import GRN from '../models/GRN.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import DeliveryNote from '../models/DeliveryNote.js';

export const PROCUREMENT_EVENT_TYPES = [
  'purchase_order',
  'purchase_order_expected',
  'grn',
  'grn_delay',
  'purchase_return',
  'delivery_note',
];

const COLORS = {
  purchase_order: '#0F766E',
  purchase_order_expected: '#0369A1',
  grn: '#7C3AED',
  grn_delay: '#D97706',
  purchase_return: '#BE123C',
  delivery_note: '#4F46E5',
};

function inRange(date, start, end) {
  if (!date) return false;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return false;
  return value >= start && value <= end;
}

function syntheticEvent({ id, title, titleAr, type, startDate, href, description = '' }) {
  return {
    _id: id,
    title,
    titleAr: titleAr || title,
    description,
    type,
    startDate,
    endDate: startDate,
    allDay: true,
    color: COLORS[type] || '#0F766E',
    relatedHref: href,
    source: 'procurement',
    readOnly: true,
    isCompleted: false,
    priority: 'medium',
    status: 'pending',
  };
}

export async function fetchProcurementCalendarEvents({
  tenantId,
  start,
  end,
  type = 'all',
  search = '',
} = {}) {
  if (!tenantId || !start || !end) return [];

  const typeList = typeof type === 'string' && type.includes(',')
    ? type.split(',').map((item) => item.trim()).filter(Boolean)
    : (type && type !== 'all' ? [type] : []);
  const wantsProcurement = typeList.length === 0
    || typeList.some((item) => PROCUREMENT_EVENT_TYPES.includes(item));
  if (!wantsProcurement) return [];

  const include = (eventType) => typeList.length === 0 || typeList.includes(eventType)
    || (eventType === 'purchase_order_expected' && typeList.includes('purchase_order'));

  const range = { $gte: start, $lte: end };
  const tenantFilter = { tenantId, status: { $ne: 'cancelled' } };

  const [orders, grns, returns, notes] = await Promise.all([
    include('purchase_order') || include('purchase_order_expected')
      ? PurchaseOrder.find({
          ...tenantFilter,
          $or: [{ orderDate: range }, { expectedDate: range }],
        }).select('poNumber orderDate expectedDate notes').lean()
      : [],
    include('grn') || include('grn_delay')
      ? GRN.find({
          ...tenantFilter,
          $or: [{ dateReceived: range }, { 'lines.delayedUntil': range }],
        }).select('grnNumber dateReceived lines.delayedUntil lines.isDelayed lines.productName lines.delayReason').lean()
      : [],
    include('purchase_return')
      ? PurchaseReturn.find({ ...tenantFilter, dateReturned: range }).select('returnNumber dateReturned notes').lean()
      : [],
    include('delivery_note')
      ? DeliveryNote.find({ ...tenantFilter, deliveryDate: range }).select('dnNumber deliveryDate notes').lean()
      : [],
  ]);

  const events = [];

  for (const po of orders) {
    if (include('purchase_order') && inRange(po.orderDate, start, end)) {
      events.push(syntheticEvent({
        id: `po-order-${po._id}`,
        title: `PO ${po.poNumber}`,
        titleAr: `طلب شراء ${po.poNumber}`,
        type: 'purchase_order',
        startDate: po.orderDate,
        href: `/app/dashboard/purchases/orders/${po._id}`,
        description: po.notes || '',
      }));
    }
    if (include('purchase_order_expected') && inRange(po.expectedDate, start, end)) {
      events.push(syntheticEvent({
        id: `po-expected-${po._id}`,
        title: `PO ${po.poNumber} · expected`,
        titleAr: `طلب شراء ${po.poNumber} · متوقع`,
        type: 'purchase_order_expected',
        startDate: po.expectedDate,
        href: `/app/dashboard/purchases/orders/${po._id}`,
        description: po.notes || '',
      }));
    }
  }

  for (const grn of grns) {
    if (include('grn') && inRange(grn.dateReceived, start, end)) {
      events.push(syntheticEvent({
        id: `grn-${grn._id}`,
        title: `GRN ${grn.grnNumber}`,
        titleAr: `إشعار استلام ${grn.grnNumber}`,
        type: 'grn',
        startDate: grn.dateReceived,
        href: `/app/dashboard/purchases/grn/${grn._id}`,
      }));
    }
    if (include('grn_delay')) {
      (grn.lines || []).forEach((line, index) => {
        if (!line?.isDelayed && !line?.delayedUntil) return;
        if (!inRange(line.delayedUntil, start, end)) return;
        const product = line.productName || `#${index + 1}`;
        events.push(syntheticEvent({
          id: `grn-delay-${grn._id}-${index}`,
          title: `GRN delay · ${grn.grnNumber} · ${product}`,
          titleAr: `تأخير استلام · ${grn.grnNumber} · ${product}`,
          type: 'grn_delay',
          startDate: line.delayedUntil,
          href: `/app/dashboard/purchases/grn/${grn._id}`,
          description: line.delayReason || '',
        }));
      });
    }
  }

  for (const doc of returns) {
    events.push(syntheticEvent({
      id: `pr-${doc._id}`,
      title: `Return ${doc.returnNumber}`,
      titleAr: `مرتجع ${doc.returnNumber}`,
      type: 'purchase_return',
      startDate: doc.dateReturned,
      href: `/app/dashboard/purchases/returns/${doc._id}`,
      description: doc.notes || '',
    }));
  }

  for (const note of notes) {
    events.push(syntheticEvent({
      id: `dn-${note._id}`,
      title: `DN ${note.dnNumber}`,
      titleAr: `سند تسليم ${note.dnNumber}`,
      type: 'delivery_note',
      startDate: note.deliveryDate,
      href: `/app/dashboard/delivery-notes/${note._id}`,
      description: note.notes || '',
    }));
  }

  const query = String(search || '').trim();
  if (!query) return events;
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return events.filter((event) => regex.test(event.title) || regex.test(event.titleAr || '') || regex.test(event.description || ''));
}

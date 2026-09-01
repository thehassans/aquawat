/** ZATCA QR + invoice timestamps in Asia/Riyadh (UTC+3, no DST). */

export const RIYADH_TZ = 'Asia/Riyadh';
export const RIYADH_OFFSET = '+03:00';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function pickPart(parts, type) {
  return parts.find((p) => p.type === type)?.value || '';
}

export function formatRiyadhParts(date, timeZone = RIYADH_TZ) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  return {
    year: pickPart(dateParts, 'year'),
    month: pickPart(dateParts, 'month'),
    day: pickPart(dateParts, 'day'),
    hour: pickPart(timeParts, 'hour'),
    minute: pickPart(timeParts, 'minute'),
    second: pickPart(timeParts, 'second'),
  };
}

/**
 * Combine issue date + optional HH:mm:ss into a Date interpreted as Riyadh wall time.
 */
export function resolveInvoiceDateTime(issueDate, issueTime, timeZone = RIYADH_TZ) {
  const raw = issueDate instanceof Date ? issueDate : new Date(issueDate);
  if (Number.isNaN(raw.getTime())) return new Date();

  const time = String(issueTime || '').trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
    const parts = formatRiyadhParts(raw, timeZone);
    if (!parts) return raw;
    const [hh, mm, ss = '00'] = time.split(':');
    const iso = `${parts.year}-${parts.month}-${parts.day}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${RIYADH_OFFSET}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const rawStr = String(issueDate || '').trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawStr);
  if (dateOnly) {
    const now = formatRiyadhParts(new Date(), timeZone);
    const iso = `${rawStr}T${now.hour}:${now.minute}:${now.second}${RIYADH_OFFSET}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return raw;
}

/** ZATCA TLV tag 3 — local Saudi time with +03:00 offset. */
export function formatZatcaQrTimestamp(issueDate, issueTime, timeZone = RIYADH_TZ) {
  const dt = resolveInvoiceDateTime(issueDate, issueTime, timeZone);
  const parts = formatRiyadhParts(dt, timeZone);
  if (!parts) return new Date().toISOString();
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${RIYADH_OFFSET}`;
}

/** HH:mm:ss in Riyadh for invoice.issueTime field. */
export function formatRiyadhTimeFromDate(issueDate, timeZone = RIYADH_TZ) {
  const parts = formatRiyadhParts(resolveInvoiceDateTime(issueDate, null, timeZone), timeZone);
  if (!parts) return '00:00:00';
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Keep issueTime in sync when saving invoices. */
export function syncIssueTimeFromDate(issueDate, issueTime) {
  const rawStr = String(issueDate || '').trim();
  const hasClock = /T\d{2}:\d{2}/.test(rawStr);
  if (hasClock) {
    const parts = formatRiyadhParts(new Date(issueDate), RIYADH_TZ);
    if (parts) {
      return { issueTime: `${parts.hour}:${parts.minute}:${parts.second}` };
    }
  }
  const time = String(issueTime || '').trim();
  if (time) return { issueTime: time };
  return { issueTime: formatRiyadhTimeFromDate(issueDate) };
}

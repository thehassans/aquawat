/** Asia/Riyadh is UTC+3 year-round (no DST). */

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDayInRiyadh(date = new Date()) {
  const shifted = new Date(date.getTime() + RIYADH_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  return new Date(Date.UTC(y, m, d) - RIYADH_OFFSET_MS);
}

export function isPastDueInRiyadh(dueDate, now = new Date()) {
  if (!dueDate) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < startOfDayInRiyadh(now).getTime();
}

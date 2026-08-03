export const REPORT_SCHEDULE_TYPES = ['vat', 'business', 'internal_audit', 'external_audit'];
export const REPORT_SCHEDULE_PRESETS = ['this_month', 'last_month', 'this_week', 'last_7_days'];
export const REPORT_SCHEDULE_FREQUENCIES = ['daily', 'weekly', 'monthly'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const setTime = (value, hour = 8, minute = 0) => {
  const date = new Date(value);
  date.setHours(clamp(Number(hour) || 0, 0, 23), clamp(Number(minute) || 0, 0, 59), 0, 0);
  return date;
};

export const normalizeRecipients = (input) => {
  const values = Array.isArray(input) ? input : String(input || '').split(/[\n,;]+/g);
  const seen = new Set();
  return values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => {
      if (!value || !value.includes('@')) return false;
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

export const resolveScheduledRange = ({ rangePreset = 'this_month', now = new Date() } = {}) => {
  const current = new Date(now);
  const todayStart = startOfDay(current);
  const todayEnd = endOfDay(current);

  if (rangePreset === 'last_month') {
    const startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const endDate = endOfDay(new Date(current.getFullYear(), current.getMonth(), 0));
    return { startDate, endDate };
  }

  if (rangePreset === 'this_week') {
    const day = current.getDay();
    const diffFromMonday = day === 0 ? 6 : day - 1;
    const startDate = startOfDay(new Date(current.getFullYear(), current.getMonth(), current.getDate() - diffFromMonday));
    return { startDate, endDate: todayEnd };
  }

  if (rangePreset === 'last_7_days') {
    const startDate = startOfDay(new Date(current.getFullYear(), current.getMonth(), current.getDate() - 6));
    return { startDate, endDate: todayEnd };
  }

  return {
    startDate: new Date(current.getFullYear(), current.getMonth(), 1),
    endDate: todayEnd,
  };
};

export const computeNextRunAt = (schedule, now = new Date()) => {
  if (!schedule?.enabled) return null;

  const frequency = REPORT_SCHEDULE_FREQUENCIES.includes(String(schedule?.frequency || '').trim())
    ? String(schedule.frequency).trim()
    : 'weekly';
  const sendAtHour = clamp(Number(schedule?.sendAtHour) || 0, 0, 23);
  const sendAtMinute = clamp(Number(schedule?.sendAtMinute) || 0, 0, 59);
  const current = new Date(now);

  if (frequency === 'daily') {
    const candidate = setTime(current, sendAtHour, sendAtMinute);
    if (candidate > current) return candidate;
    const next = new Date(candidate);
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === 'monthly') {
    const dayOfMonth = clamp(Number(schedule?.dayOfMonth) || 1, 1, 28);
    let candidate = setTime(new Date(current.getFullYear(), current.getMonth(), dayOfMonth), sendAtHour, sendAtMinute);
    if (candidate > current) return candidate;
    candidate = setTime(new Date(current.getFullYear(), current.getMonth() + 1, dayOfMonth), sendAtHour, sendAtMinute);
    return candidate;
  }

  const dayOfWeek = clamp(Number(schedule?.dayOfWeek) || 0, 0, 6);
  const candidate = setTime(current, sendAtHour, sendAtMinute);
  const currentDay = current.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && candidate <= current)) {
    daysUntil += 7;
  }
  const next = setTime(new Date(current.getFullYear(), current.getMonth(), current.getDate() + daysUntil), sendAtHour, sendAtMinute);
  return next;
};

export const serializeReportSchedule = (schedule) => {
  const value = schedule?.toObject?.() || schedule || {};
  return {
    _id: value._id,
    tenantId: value.tenantId,
    name: String(value.name || '').trim(),
    reportType: value.reportType || 'vat',
    rangePreset: value.rangePreset || 'this_month',
    frequency: value.frequency || 'weekly',
    dayOfWeek: Number(value.dayOfWeek || 0),
    dayOfMonth: Number(value.dayOfMonth || 1),
    sendAtHour: Number(value.sendAtHour || 0),
    sendAtMinute: Number(value.sendAtMinute || 0),
    recipients: normalizeRecipients(value.recipients || []),
    language: value.language === 'ar' ? 'ar' : 'en',
    enabled: value.enabled === true,
    nextRunAt: value.nextRunAt || null,
    lastRunAt: value.lastRunAt || null,
    lastStatus: value.lastStatus || 'pending',
    lastError: String(value.lastError || ''),
    lastReportPeriod: {
      startDate: value?.lastReportPeriod?.startDate || null,
      endDate: value?.lastReportPeriod?.endDate || null,
    },
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  };
};

/** Client-side access check — keep in sync with backend/utils/appTrial.js */

export function isPaidOrGranted(record) {
  const status = String(record?.billing?.status || '').toLowerCase();
  if (status === 'paid' || status === 'granted' || status === 'comped') return true;
  return Boolean(record?.billing?.paidAt || record?.billing?.paymentId);
}

export function isAppAccessValid(record, now = new Date()) {
  if (!record || record.isInstalled !== true || record.isEnabled === false) return false;
  if (isPaidOrGranted(record)) return true;
  if (!record.trialEndsAt) return true;
  const ends = new Date(record.trialEndsAt);
  if (Number.isNaN(ends.getTime())) return true;
  return ends.getTime() > now.getTime();
}

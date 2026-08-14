const MS_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_TRIAL_DAYS = 7;
export const MAX_TRIAL_DAYS = 90;

export function normalizeTrialDays(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_TRIAL_DAYS;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TRIAL_DAYS;
  return Math.min(MAX_TRIAL_DAYS, Math.floor(n));
}

export function isPaidOrGranted(record) {
  const status = String(record?.billing?.status || '').toLowerCase();
  if (status === 'paid' || status === 'granted' || status === 'comped') return true;
  return Boolean(record?.billing?.paidAt || record?.billing?.paymentId);
}

export function getTrialEndsAt(record) {
  if (!record?.trialEndsAt) return null;
  const date = new Date(record.trialEndsAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** One trial per tenant per app. Uninstall does not reset it. */
export function hasConsumedTrial(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.trialUsed === true) return true;
  if (record.trialStartedAt || record.trialEndsAt) return true;
  if (record.uninstalledAt) return true;
  if (record.installedAt) return true;
  if (record.isInstalled === true) return true;
  return false;
}

export function canStartAppTrial(appDef, record) {
  if (normalizeTrialDays(appDef?.trialDays) <= 0) return false;
  return !hasConsumedTrial(record);
}

export function isTrialCurrentlyActive(record, now = new Date()) {
  if (!record || record.isInstalled !== true || record.isEnabled === false) return false;
  if (isPaidOrGranted(record)) return false;
  const ends = getTrialEndsAt(record);
  if (!ends) return false;
  return ends.getTime() > now.getTime();
}

export function isTrialExpired(record, now = new Date()) {
  if (isPaidOrGranted(record)) return false;
  const ends = getTrialEndsAt(record);
  if (!ends) return false;
  return ends.getTime() <= now.getTime();
}

export function isAppAccessValid(record, now = new Date()) {
  if (!record || record.isInstalled !== true || record.isEnabled === false) return false;
  if (isPaidOrGranted(record)) return true;
  const ends = getTrialEndsAt(record);
  if (ends) return ends.getTime() > now.getTime();
  return true;
}

export function trialDaysRemaining(record, now = new Date()) {
  const ends = getTrialEndsAt(record);
  if (!ends) return 0;
  return Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / MS_DAY));
}

export function describeAppTrial({ appDef, record, isPaid, includedInPlan, now = new Date() } = {}) {
  const trialDays = normalizeTrialDays(appDef?.trialDays);
  const used = hasConsumedTrial(record);
  if (includedInPlan || !isPaid) {
    return {
      trialDays,
      trialEligible: false,
      trialActive: false,
      trialExpired: false,
      trialUsed: used,
      trialEndsAt: getTrialEndsAt(record),
      trialDaysRemaining: 0,
    };
  }

  const active = isTrialCurrentlyActive(record, now);
  const expired = isTrialExpired(record, now);

  return {
    trialDays,
    trialEligible: !used && trialDays > 0,
    trialActive: active,
    trialExpired: expired,
    trialUsed: used,
    trialEndsAt: getTrialEndsAt(record),
    trialDaysRemaining: trialDaysRemaining(record, now),
  };
}

export function expireStaleAppTrials(tenant, now = new Date()) {
  if (!tenant?.settings?.installedApps || typeof tenant.settings.installedApps !== 'object') {
    return false;
  }

  let changed = false;
  for (const record of Object.values(tenant.settings.installedApps)) {
    if (!record || record.isInstalled !== true) continue;
    if (isPaidOrGranted(record)) continue;
    if (!isTrialExpired(record, now)) continue;
    if (record.isEnabled === false && record.billing?.status === 'expired') continue;
    record.isEnabled = false;
    record.billing = { ...(record.billing || {}), status: 'expired' };
    record.trialExpiredAt = record.trialExpiredAt || now;
    changed = true;
  }

  if (changed) {
    tenant.markModified?.('settings.installedApps');
    tenant.markModified?.('settings');
  }
  return changed;
}

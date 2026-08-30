import Tenant from '../models/Tenant.js';
import TenantPayment from '../models/TenantPayment.js';
import { getPlanEntitlements } from '../utils/planEntitlements.js';
import { addBillingCycles, isPaidPlanId } from '../utils/subscriptionPeriod.js';
import { invalidateAuthCache } from '../middleware/auth.js';
import { emitPlatformEvent } from '../utils/platformEvents.js';

const startOfLocalDay = (value = new Date()) => {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  d.setHours(12, 0, 0, 0);
  return d;
};

/**
 * Period starts from remaining paid time if still active, otherwise from today.
 * Avoids stacking from a future end while payment date looks earlier (confusing ledger).
 */
export const resolvePaymentPeriod = ({
  priorEnd,
  now = new Date(),
  billingCycle = 'monthly',
  cycles = 1,
  forceFromPaymentDate = false,
}) => {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const cycleCount = Math.max(1, Math.min(36, Number(cycles) || 1));
  const paymentDay = startOfLocalDay(now);
  const prior = priorEnd ? new Date(priorEnd) : null;
  const priorValid = prior && !Number.isNaN(prior.getTime());
  const priorStillActive = priorValid && prior.getTime() > now.getTime();

  const periodStart = !forceFromPaymentDate && priorStillActive
    ? startOfLocalDay(prior)
    : paymentDay;
  const periodEnd = addBillingCycles(periodStart, cycle, cycleCount);
  return { periodStart, periodEnd, cycle, cycleCount };
};

export const applySubscriptionFromPayment = async (tenant, {
  plan,
  billingCycle,
  unitPrice,
  periodStart,
  periodEnd,
  now = new Date(),
}) => {
  const entitlements = getPlanEntitlements(plan, billingCycle);
  const paidPrior = isPaidPlanId(tenant.subscription?.plan);
  if (!tenant.subscription) tenant.subscription = {};
  tenant.subscription.plan = plan;
  tenant.subscription.status = 'active';
  tenant.subscription.billingCycle = billingCycle;
  tenant.subscription.endDate = periodEnd;
  if (!paidPrior || !tenant.subscription.startDate) {
    tenant.subscription.startDate = now;
  }
  tenant.subscription.price = unitPrice;
  tenant.subscription.maxUsers = entitlements.maxUsers;
  tenant.subscription.maxInvoices = entitlements.maxInvoices;
  tenant.subscription.maxQuotations = entitlements.maxQuotations;
  // Legacy embedded history is retired — TenantPayment collection is source of truth.
  tenant.subscription.paymentHistory = [];
  tenant.isActive = true;
  tenant.isDemo = false;
  tenant.demoUpgraded = true;
  tenant.terminationNotice = undefined;
  tenant.markModified('subscription.paymentHistory');
  return { paidPrior };
};

export const recalculateTenantEndDateFromPayments = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return null;

  const latest = await TenantPayment.findOne({
    tenantId,
    status: 'recorded',
  }).sort({ periodEnd: -1 }).lean();

  if (!tenant.subscription) tenant.subscription = {};
  if (latest?.periodEnd) {
    tenant.subscription.endDate = latest.periodEnd;
    if (latest.plan) tenant.subscription.plan = latest.plan;
    if (latest.billingCycle) tenant.subscription.billingCycle = latest.billingCycle;
    if (Number.isFinite(Number(latest.unitPrice))) {
      tenant.subscription.price = Number(latest.unitPrice);
    }
    if (new Date(latest.periodEnd).getTime() > Date.now()) {
      tenant.subscription.status = 'active';
      tenant.isActive = true;
    }
  } else {
    // No remaining payments — leave end date as-is but clear stale status if needed
    const end = tenant.subscription.endDate ? new Date(tenant.subscription.endDate) : null;
    if (end && end.getTime() < Date.now() && tenant.subscription.status === 'active') {
      tenant.subscription.status = 'expired';
    }
  }

  tenant.subscription.paymentHistory = [];
  tenant.markModified('subscription.paymentHistory');
  await tenant.save();
  invalidateAuthCache(null, tenant._id);
  return tenant;
};

export const clearAllLegacyPaymentHistory = async () => {
  const result = await Tenant.updateMany(
    {},
    { $set: { 'subscription.paymentHistory': [] } },
  );
  return {
    matched: result?.matchedCount ?? result?.n ?? 0,
    modified: result?.modifiedCount ?? result?.nModified ?? 0,
  };
};

export const shouldForcePeriodFromPaymentDate = (tenant) => {
  const status = String(tenant?.subscription?.status || '').toLowerCase();
  if (['expired', 'trial_ended', 'canceled', 'cancelled', 'suspended'].includes(status)) return true;
  if (tenant?.isDemo === true) return true;
  if (!isPaidPlanId(tenant?.subscription?.plan)) return true;
  const end = tenant?.subscription?.endDate ? new Date(tenant.subscription.endDate) : null;
  if (!end || Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) return true;
  return false;
};

export const recordTenantPayment = async ({
  tenant,
  amount,
  unitPrice,
  currency = 'SAR',
  method = 'bank_transfer',
  reference = '',
  note = '',
  plan,
  billingCycle,
  cycles = 1,
  recordedBy,
  forceFromPaymentDate,
}) => {
  const nextPlan = String(plan || tenant.subscription?.plan || 'starter').toLowerCase();
  const nextCycle = String(billingCycle || tenant.subscription?.billingCycle || 'monthly').toLowerCase() === 'yearly'
    ? 'yearly'
    : 'monthly';

  if (nextPlan === 'trial') {
    const err = new Error('Select a paid plan when accepting payment');
    err.status = 400;
    throw err;
  }

  const paidPrior = isPaidPlanId(tenant.subscription?.plan);
  const wasTrial = String(tenant.subscription?.plan || '').toLowerCase() === 'trial'
    || tenant.isDemo === true
    || !paidPrior;

  const resolvedUnit = Number.isFinite(Number(unitPrice)) && Number(unitPrice) >= 0
    ? Number(unitPrice)
    : (Number.isFinite(Number(amount)) ? Number(amount) : 0);
  const cycleCount = Math.max(1, Math.min(36, Number(cycles) || 1));
  const totalPaid = Math.round(resolvedUnit * cycleCount * 100) / 100;
  const payCurrency = String(currency || tenant.settings?.currency || 'SAR').toUpperCase();

  const now = new Date();
  const force = forceFromPaymentDate !== false;

  const { periodStart, periodEnd } = resolvePaymentPeriod({
    priorEnd: tenant.subscription?.endDate,
    now,
    billingCycle: nextCycle,
    cycles: cycleCount,
    forceFromPaymentDate: force,
  });

  await applySubscriptionFromPayment(tenant, {
    plan: nextPlan,
    billingCycle: nextCycle,
    unitPrice: resolvedUnit,
    periodStart,
    periodEnd,
    now,
  });

  await tenant.save();
  invalidateAuthCache(null, tenant._id);

  const payment = await TenantPayment.create({
    tenantId: tenant._id,
    amount: totalPaid,
    unitPrice: resolvedUnit,
    currency: payCurrency,
    method: String(method || 'bank_transfer'),
    reference: String(reference || ''),
    note: String(note || ''),
    plan: nextPlan,
    billingCycle: nextCycle,
    cycles: cycleCount,
    periodStart,
    periodEnd,
    recordedBy: recordedBy || undefined,
    recordedAt: now,
    status: 'recorded',
  });

  emitPlatformEvent(paidPrior ? 'subscription_renewed' : 'subscription_started', {
    tenantId: String(tenant._id),
    plan: nextPlan,
    billingCycle: nextCycle,
    amount: totalPaid,
    currency: payCurrency,
    paymentId: reference || String(payment._id),
  });

  if (!paidPrior && wasTrial) {
    emitPlatformEvent('trial_converted', {
      tenantId: String(tenant._id),
      plan: nextPlan,
      billingCycle: nextCycle,
    });
  }

  return { tenant, payment };
};

export const voidTenantPayment = async (paymentId) => {
  const payment = await TenantPayment.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  if (payment.status === 'voided') return payment;

  payment.status = 'voided';
  await payment.save();
  await recalculateTenantEndDateFromPayments(payment.tenantId);
  return payment;
};

export const deleteTenantPayment = async (paymentId) => {
  const payment = await TenantPayment.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  const tenantId = payment.tenantId;
  await payment.deleteOne();
  await recalculateTenantEndDateFromPayments(tenantId);
  return { tenantId, deletedId: paymentId };
};

const parseDay = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfLocalDay(value);
  }
  const raw = String(value).trim();
  // Accept yyyy-mm-dd from date inputs
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoDay) {
    const d = new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
};

export const updateTenantPaymentPeriod = async (paymentId, { periodStart, periodEnd }) => {
  const payment = await TenantPayment.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  if (payment.status === 'voided') {
    const err = new Error('Cannot edit a voided payment');
    err.status = 400;
    throw err;
  }

  const start = parseDay(periodStart);
  const end = parseDay(periodEnd);
  if (!start || !end) {
    const err = new Error('Valid period start and end dates are required');
    err.status = 400;
    throw err;
  }
  if (end.getTime() <= start.getTime()) {
    const err = new Error('Period end must be after period start');
    err.status = 400;
    throw err;
  }

  payment.periodStart = start;
  payment.periodEnd = end;
  await payment.save();
  await recalculateTenantEndDateFromPayments(payment.tenantId);
  return payment;
};

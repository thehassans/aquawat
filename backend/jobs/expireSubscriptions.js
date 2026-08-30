import Tenant from '../models/Tenant.js';
import logger from '../utils/logger.js';

/**
 * Mark tenants past subscription.endDate as expired / trial_ended.
 * Skips terminated tenants. Keeps isActive as-is (frontend blocks on expiry).
 */
export async function expireEndedSubscriptions() {
  const now = new Date();
  const filter = {
    'subscription.endDate': { $lt: now },
    'subscription.status': { $in: ['active', 'suspended'] },
  };

  const tenants = await Tenant.find(filter)
    .select('_id subscription.plan subscription.status name')
    .lean();

  let expired = 0;
  let trialEnded = 0;

  for (const t of tenants) {
    const plan = String(t.subscription?.plan || '').toLowerCase();
    const isTrial = plan === 'trial';
    const nextStatus = isTrial ? 'trial_ended' : 'expired';
    await Tenant.updateOne(
      { _id: t._id, 'subscription.status': { $in: ['active', 'suspended'] } },
      { $set: { 'subscription.status': nextStatus } },
    );
    if (isTrial) trialEnded += 1;
    else expired += 1;
  }

  if (expired || trialEnded) {
    logger.info(`[subscriptions] expired=${expired} trial_ended=${trialEnded}`);
  }

  return { scanned: tenants.length, expired, trialEnded };
}

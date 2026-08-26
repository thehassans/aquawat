import InvWebhookSubscription from '../../models/inventory/InvWebhookSubscription.js';
import crypto from 'crypto';

export async function dispatchInventoryWebhook(tenantId, event, payload) {
  const subs = await InvWebhookSubscription.find({
    tenantId,
    event,
    active: true,
  }).select('+secret').lean();
  if (!subs.length) return { delivered: 0 };

  let delivered = 0;
  for (const sub of subs) {
    try {
      const body = JSON.stringify({ event, tenantId: String(tenantId), payload, at: new Date().toISOString() });
      const sig = crypto.createHmac('sha256', sub.secret).update(body).digest('hex');
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Maqder-Signature': sig,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        delivered += 1;
        await InvWebhookSubscription.updateOne({ _id: sub._id }, {
          $set: { lastDeliveryAt: new Date(), failureCount: 0 },
        });
      } else {
        await InvWebhookSubscription.updateOne({ _id: sub._id }, {
          $inc: { failureCount: 1 },
        });
      }
    } catch {
      await InvWebhookSubscription.updateOne({ _id: sub._id }, { $inc: { failureCount: 1 } });
    }
  }
  return { delivered, attempted: subs.length };
}

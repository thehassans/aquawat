import logger from '../utils/logger.js';
import { sloSnapshot, sloBreached } from '../utils/sloMetrics.js';

let lastAlertAt = 0;
const COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS || 10 * 60 * 1000);

export function alertWebhookUrl() {
  return String(process.env.ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || '').trim();
}

export async function postOpsAlert(payload) {
  const url = alertWebhookUrl();
  if (!url) return { sent: false, reason: 'no_webhook' };
  const now = Date.now();
  if (now - lastAlertAt < COOLDOWN_MS) return { sent: false, reason: 'cooldown' };
  lastAlertAt = now;

  const body = {
    text: payload.text || `[maqder] ${payload.type || 'alert'}`,
    ...payload,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      logger.warn(`[sloAlert] webhook ${res.status}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    logger.warn({ message: 'ops_alert_sent', type: payload.type });
    return { sent: true };
  } catch (error) {
    logger.warn(`[sloAlert] ${error.message}`);
    return { sent: false, reason: error.message };
  }
}

export async function evaluateSloAndAlert({ dbReady = true, redisReady = true, redisRequired = false } = {}) {
  if (!dbReady || (redisRequired && !redisReady)) {
    return postOpsAlert({
      type: 'not_ready',
      text: `[maqder] /ready failed (db=${dbReady} redis=${redisReady})`,
      dbReady,
      redisReady,
    });
  }

  const snap = sloSnapshot();
  const p95Ms = Number(process.env.SLO_P95_MS || 2000);
  const errorRate = Number(process.env.SLO_ERROR_RATE || 0.05);
  const breach = sloBreached(snap, { p95Ms, errorRate });
  if (!breach) return { sent: false, reason: 'ok', snap };

  return postOpsAlert({
    type: 'slo_breach',
    text: `[maqder] SLO ${breach} (p95=${Math.round(snap.p95Ms)}ms, 5xx=${(snap.errorRate * 100).toFixed(1)}%, n=${snap.count})`,
    breach,
    snap,
  });
}

export function resetAlertCooldown() {
  lastAlertAt = 0;
}

export default { evaluateSloAndAlert, postOpsAlert };

import SystemSettings from '../models/SystemSettings.js';

const envAuthMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 300);
const envApiMax = Number(process.env.API_RATE_LIMIT_MAX || 15000);
/** Values below this are treated as the old schema default (200) that breaks normal ERP use. */
const API_LEGACY_LOW_CAP = 1000;

const defaultAuth = Number.isFinite(envAuthMax) && envAuthMax > 0 ? envAuthMax : 300;
const defaultApi = Number.isFinite(envApiMax) && envApiMax > 0 ? envApiMax : 15000;

let cached = {
  authMaxRequests: defaultAuth,
  apiMaxRequests: defaultApi,
};

export function getRateLimitConfig() {
  return cached;
}

export async function loadRateLimitConfig() {
  try {
    const settings = await SystemSettings.findOne({ key: 'global' }).select('rateLimiting').lean();
    const next = settings?.rateLimiting || {};
    if (Number(next.authMaxRequests) > 0) cached.authMaxRequests = Number(next.authMaxRequests);

    if (Number(next.apiMaxRequests) > 0) {
      const fromDb = Number(next.apiMaxRequests);
      if (fromDb < API_LEGACY_LOW_CAP) {
        // Heal legacy default (200 / 1 min) so report browsing does not 429 after ~15 clicks.
        cached.apiMaxRequests = defaultApi;
        SystemSettings.updateOne(
          { key: 'global' },
          {
            $set: {
              'rateLimiting.apiMaxRequests': defaultApi,
              'rateLimiting.apiWindowMinutes': 15,
            },
          },
        ).catch(() => {});
      } else {
        cached.apiMaxRequests = fromDb;
      }
    }
  } catch {
    // keep env defaults
  }
  return cached;
}

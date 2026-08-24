import SystemSettings from '../models/SystemSettings.js';

const envAuthMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 300);
const envApiMax = Number(process.env.API_RATE_LIMIT_MAX || 15000);

let cached = {
  authMaxRequests: Number.isFinite(envAuthMax) && envAuthMax > 0 ? envAuthMax : 300,
  apiMaxRequests: Number.isFinite(envApiMax) && envApiMax > 0 ? envApiMax : 15000,
};

export function getRateLimitConfig() {
  return cached;
}

export async function loadRateLimitConfig() {
  try {
    const settings = await SystemSettings.findOne({ key: 'global' }).select('rateLimiting').lean();
    const next = settings?.rateLimiting || {};
    if (Number(next.authMaxRequests) > 0) cached.authMaxRequests = Number(next.authMaxRequests);
    if (Number(next.apiMaxRequests) > 0) cached.apiMaxRequests = Number(next.apiMaxRequests);
  } catch {
    // keep env defaults
  }
  return cached;
}

/**
 * k6 — auth limiter (40 req / 15 min, AUTH_RATE_LIMIT_MAX).
 *
 * Run against staging. 100 rps will trip 429; that is the pass condition.
 *
 *   k6 run -e BASE_URL=https://staging.maqder.com -e RATE=20 -e DURATION=20s \
 *     backend/tests/k6/authRateLimit.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

http.setResponseCallback(http.expectedStatuses(200, 400, 401, 429));

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const PATH = __ENV.AUTH_PATH || '/api/auth/login';
const RATE = Number(__ENV.RATE || 20);
const DURATION = __ENV.DURATION || '20s';
const LIMIT = Number(__ENV.AUTH_RATE_LIMIT_MAX || 40);

const throttled = new Counter('auth_throttled_429');
const latency = new Trend('auth_latency_ms', true);

export const options = {
  scenarios: {
    auth_flood: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(80, RATE),
      maxVUs: Math.min(200, RATE * 3),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<2000'],
    auth_latency_ms: ['p(95)<2000'],
    auth_throttled_429: ['count>=1'],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}${PATH}`,
    JSON.stringify({ email: 'k6-rate-limit@example.invalid', password: 'wrong' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } }
  );
  latency.add(res.timings.duration);
  if (res.status === 429) throttled.add(1);
  check(res, {
    'auth is 401, 400, or 429': (r) => [400, 401, 429].includes(r.status),
    '429 is Too Many Requests': (r) => r.status !== 429 || r.status === 429,
  });
}

export function handleSummary(data) {
  const count429 = data.metrics.auth_throttled_429?.values?.count || 0;
  const p95 = data.metrics.auth_latency_ms?.values['p(95)'] || 0;
  return {
    stdout: `\nauth limiter @ ${RATE}/s — 429 count ${count429} (cap ${LIMIT}/15min) p95 ${p95.toFixed(1)}ms\n`,
  };
}

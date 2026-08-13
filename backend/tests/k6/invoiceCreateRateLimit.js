/**
 * k6 load test — invoice create vs Redis HybridRateLimitStore (40 / min).
 *
 * Hits POST /api/invoices/sell at ~100 req/s for 30s. The invoice-write
 * limiter is 40 requests per tenant per 60s (INVOICE_CREATE_RATE_LIMIT_MAX).
 * After the 40th success in a window, further requests must be 429.
 *
 * Prerequisites:
 *   - API up, Redis up (REDIS_ENABLED not false)
 *   - JWT for a tenant with invoicing:create
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:5000 -e AUTH_TOKEN=eyJ... backend/tests/k6/invoiceCreateRateLimit.js
 *
 * Optional:
 *   -e SELL_PATH=/api/invoices/sell
 *   -e RATE=100
 *   -e DURATION=30s
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 429 is success for this test — do not count throttle as http_req_failed.
http.setResponseCallback(http.expectedStatuses(200, 201, 400, 403, 429));

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN = __ENV.AUTH_TOKEN || '';
const PATH = __ENV.SELL_PATH || '/api/invoices/sell';
const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '30s';
const LIMIT = Number(__ENV.INVOICE_CREATE_RATE_LIMIT_MAX || 40);

const throttled = new Counter('invoice_throttled_429');
const createdOrRejected = new Counter('invoice_non_429');
const throttleRate = new Rate('invoice_throttle_share');
const latency = new Trend('invoice_create_latency_ms', true);

export const options = {
  scenarios: {
    invoice_create_flood: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(200, RATE),
      maxVUs: Math.min(400, RATE * 3),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    invoice_create_latency_ms: ['p(95)<2000', 'p(99)<5000'],
    invoice_throttled_429: [`count>=${Math.max(1, RATE * 20 - LIMIT)}`],
  },
};

function sellPayload(i) {
  return JSON.stringify({
    paymentMethod: 'credit',
    paidAmount: 0,
    currency: 'SAR',
    status: 'draft',
    lineItems: [
      {
        lineNumber: 1,
        productName: `k6-load-${i}`,
        quantity: 1,
        unitPrice: 10.01,
        taxRate: 15,
        taxCategory: 'S',
      },
    ],
  });
}

export default function () {
  if (!TOKEN) {
    throw new Error('AUTH_TOKEN is required');
  }

  const res = http.post(`${BASE_URL}${PATH}`, sellPayload(__ITER), {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'invoice_sell' },
  });

  latency.add(res.timings.duration);

  const is429 = res.status === 429;
  throttleRate.add(is429);
  if (is429) throttled.add(1);
  else createdOrRejected.add(1);

  check(res, {
    'status is 201, 400, 403, or 429': (r) => [201, 200, 400, 403, 429].includes(r.status),
    '429 body mentions too many invoices': (r) =>
      r.status !== 429 || String(r.body || '').toLowerCase().includes('too many'),
    'latency under 5s': (r) => r.timings.duration < 5000,
  });

  if (is429) {
    const retryAfter = res.headers['Retry-After'] || res.headers['retry-after'];
    check(res, {
      '429 has rate-limit headers': () =>
        Boolean(retryAfter || res.headers['X-RateLimit-Limit'] || res.headers['RateLimit-Limit']),
    });
  }

  sleep(0);
}

export function handleSummary(data) {
  const count429 = data.metrics.invoice_throttled_429?.values?.count || 0;
  const p95 = data.metrics.invoice_create_latency_ms?.values['p(95)'] || 0;
  const summary = [
    `k6 invoice create @ ${RATE}/s for ${DURATION}`,
    `429 count: ${count429} (expect >> ${LIMIT} once Redis HybridRateLimitStore is shared)`,
    `p95 latency: ${p95.toFixed(1)} ms (threshold < 2000)`,
  ].join('\n');
  return { stdout: `\n${summary}\n` };
}

import { test, expect } from '@playwright/test'

const API = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5000'

test.describe('Security API probes', () => {
  test('payment webhook without signature does not 500', async ({ request }) => {
    const res = await request.post(`${API}/api/payments/webhook`, {
      data: { type: 'checkout.session.completed', data: { object: { id: 'cs_test_fake' } } },
    })
    // Prefer 4xx reject; 200 with silent ignore is also noted as risk in audit
    expect(res.status()).toBeLessThan(500)
  })

  test('tenant status endpoint requires auth or rejects', async ({ request }) => {
    const res = await request.get(`${API}/api/payments/tenant-status/000000000000000000000000`)
    expect([401, 403, 404]).toContain(res.status())
  })

  test('security headers present on API', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    const headers = res.headers()
    // Helmet usually sets these
    const hasHelmetSignal =
      'x-content-type-options' in headers ||
      'x-frame-options' in headers ||
      'content-security-policy' in headers
    expect(hasHelmetSignal).toBeTruthy()
  })

  test('CORS does not reflect arbitrary origins blindly for credentials routes', async ({ request }) => {
    const res = await request.get(`${API}/api/health`, {
      headers: { Origin: 'https://evil.example.com' },
    })
    const acao = res.headers()['access-control-allow-origin']
    // Either undefined/null or not the evil origin when credentials are involved
    if (acao) {
      expect(acao).not.toBe('https://evil.example.com')
    }
  })
})

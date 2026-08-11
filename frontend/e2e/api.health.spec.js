import { test, expect } from '@playwright/test'

const API = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5000'

test.describe('API health & hardening smoke', () => {
  test('GET /api/health responds', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.status()).toBeLessThan(500)
    const body = await res.json().catch(() => ({}))
    expect(body).toBeTruthy()
  })

  test('GET /api/health/live responds', async ({ request }) => {
    const res = await request.get(`${API}/api/health/live`)
    expect([200, 204].includes(res.status()) || res.ok()).toBeTruthy()
  })

  test('protected API rejects unauthenticated access', async ({ request }) => {
    const res = await request.get(`${API}/api/app-store/apps`)
    expect([401, 403]).toContain(res.status())
  })

  test('login with invalid credentials fails safely', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: 'nobody-e2e@maqder.invalid', password: 'wrong-password-xyz' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

import { test, expect } from '@playwright/test'

const E2E_EMAIL = process.env.E2E_EMAIL || 'trading@test.com'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'password123'
const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5000'

async function ensureLoggedIn(page, request) {
  const existing = await page.evaluate(() => localStorage.getItem('token')).catch(() => null)
  if (existing) return true

  let token = null
  let user = null
  let tenant = null

  try {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
      failOnStatusCode: false,
    })
    if (res.ok()) {
      const data = await res.json()
      token = data.token
      user = data.user
      tenant = data.tenant
    }
  } catch {
    // ignore
  }

  if (!token) {
    await page.goto('/login')
    const email = page.locator('input[type="email"], input[name="email"]').first()
    const visible = await email.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)
    if (!visible) return false
    await email.fill(E2E_EMAIL)
    await page.locator('input[type="password"]').first().fill(E2E_PASSWORD)
    await page.getByRole('button', { name: /login|تسجيل|sign in/i }).first().click()
    await page.waitForTimeout(2500)
    token = await page.evaluate(() => localStorage.getItem('token'))
    return Boolean(token)
  }

  await page.goto('/')
  await page.evaluate(
    ({ token: t, user: u, tenant: ten }) => {
      localStorage.setItem('token', t)
      if (u) localStorage.setItem('auth_user', JSON.stringify(u))
      if (ten) localStorage.setItem('auth_tenant', JSON.stringify(ten))
    },
    { token, user, tenant }
  )
  return true
}

test.describe('Authenticated mobile smoke', () => {
  test('dashboard has no horizontal overflow on mobile', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile project only')

    const loggedIn = await ensureLoggedIn(page, request)
    if (!loggedIn) {
      test.skip(true, `E2E login failed for ${E2E_EMAIL}`)
      return
    }

    await page.goto('/app/dashboard')
    await page.waitForTimeout(1500)

    if (/login/i.test(page.url())) {
      test.skip(true, 'Redirected to login — credentials or ALLOW_DEMO_LOGIN unavailable')
      return
    }

    const main = page.locator('main, [role="main"], #root').first()
    await expect(main).toBeVisible({ timeout: 15000 })

    const overflowOk = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth <= doc.clientWidth + 8
    })
    expect(overflowOk).toBeTruthy()
  })
})

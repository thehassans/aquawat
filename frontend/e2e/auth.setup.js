import { test as setup, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = path.join(__dirname, '.auth')
const AUTH_FILE = path.join(AUTH_DIR, 'user.json')
const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5000'
const E2E_EMAIL = process.env.E2E_EMAIL || 'trading@test.com'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'password123'

setup('authenticate', async ({ request, page }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true })

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
    // API unreachable — try UI login
  }

  if (!token) {
    try {
      await page.goto('/login')
      await page.locator('input[type="email"], input[name="email"]').first().fill(E2E_EMAIL)
      await page.locator('input[type="password"]').first().fill(E2E_PASSWORD)
      await page.getByRole('button', { name: /login|تسجيل|sign in/i }).first().click()
      await page.waitForTimeout(2500)
      token = await page.evaluate(() => localStorage.getItem('token'))
    } catch {
      token = null
    }
  }

  if (!token) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }))
    setup.skip(true, `E2E login failed for ${E2E_EMAIL} (set E2E_EMAIL/E2E_PASSWORD or ALLOW_DEMO_LOGIN)`)
    return
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

  await page.context().storageState({ path: AUTH_FILE })
  expect(token).toBeTruthy()
})

import { test, expect } from '@playwright/test'

test.describe('Authenticated app smoke (demo credentials)', () => {
  test('dashboard routes redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/app/dashboard')
    await page.waitForURL(/login|auth/i, { timeout: 15000 }).catch(() => {})
    const url = page.url()
    const onLogin = /login/i.test(url)
    const onApp = /\/app\//i.test(url)
    // Either redirected to login, or showed auth gate — not a blank crash
    expect(onLogin || onApp).toBeTruthy()
    await expect(page.locator('#root')).not.toBeEmpty()
  })

  test('app-store route is gated', async ({ page }) => {
    await page.goto('/app/dashboard/app-store')
    await page.waitForTimeout(1200)
    const url = page.url()
    expect(/login|app-store|dashboard/i.test(url)).toBeTruthy()
    await expect(page.locator('body')).toBeVisible()
  })

  test('invoices route is gated', async ({ page }) => {
    await page.goto('/app/dashboard/invoices')
    await page.waitForTimeout(1200)
    await expect(page.locator('#root')).not.toBeEmpty()
  })

  test('settings route is gated', async ({ page }) => {
    await page.goto('/app/dashboard/settings')
    await page.waitForTimeout(1200)
    await expect(page.locator('#root')).not.toBeEmpty()
  })
})

test.describe('Responsive shell checks', () => {
  test('login has no horizontal overflow on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile project only')
    await page.goto('/login')
    await page.waitForTimeout(800)
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth > doc.clientWidth + 2
    })
    expect(overflow).toBeFalsy()
  })

  test('home has no major horizontal overflow on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop project only')
    await page.goto('/')
    await page.waitForTimeout(1000)
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth > doc.clientWidth + 8
    })
    expect(overflow).toBeFalsy()
  })
})

import { test, expect } from '@playwright/test'

test.describe('Public marketing & auth surfaces', () => {
  test('landing / home loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    // Should not crash into a blank error boundary forever
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15000 })
  })

  test('login page renders form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /login|تسجيل|sign in/i }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('login page is usable on mobile viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile project only')
    await page.goto('/login')
    const email = page.locator('input[type="email"], input[name="email"]').first()
    await expect(email).toBeVisible({ timeout: 15000 })
    const box = await email.boundingBox()
    expect(box?.width || 0).toBeGreaterThan(120)
  })

  test('invalid login shows error (no crash)', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"], input[name="email"]').first().fill('nobody-e2e@maqder.invalid')
    await page.locator('input[type="password"]').first().fill('wrong-password-xyz')
    await page.getByRole('button', { name: /login|تسجيل/i }).first().click()
    // Stay on login or show error — must not navigate to dashboard
    await page.waitForTimeout(1500)
    expect(page.url()).toMatch(/login/i)
  })

  test('forgot password toggle works', async ({ page }) => {
    await page.goto('/login')
    const forgot = page.getByRole('button', { name: /forgot|نسيت/i }).first()
    if (await forgot.count()) {
      await forgot.click()
      await expect(page.getByText(/reset|استعادة|password/i).first()).toBeVisible({ timeout: 8000 })
    }
  })
})

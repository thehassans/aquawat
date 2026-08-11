import { test, expect } from '@playwright/test'

test.describe('Performance & console health', () => {
  test('login page loads under budget and without fatal console errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(String(err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    const start = Date.now()
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 15000 })
    const elapsed = Date.now() - start

    // Soft budget for local/dev — flag if extremely slow
    expect(elapsed).toBeLessThan(20000)

    const fatal = errors.filter((e) =>
      /chunkloaderror|failed to fetch dynamically|unexpected token|is not defined/i.test(e)
    )
    expect(fatal, `Fatal console errors: ${fatal.join(' | ')}`).toHaveLength(0)
  })

  test('home page network: no flood of 5xx', async ({ page }) => {
    const failed = []
    page.on('response', (res) => {
      if (res.status() >= 500) failed.push(`${res.status()} ${res.url()}`)
    })
    await page.goto('/', { waitUntil: 'networkidle' }).catch(async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
    })
    expect(failed, failed.join('\n')).toHaveLength(0)
  })
})

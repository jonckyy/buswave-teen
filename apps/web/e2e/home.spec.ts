import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('shows debug status widget', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('System status')).toBeVisible({ timeout: 10_000 })
  })

  test('debug widget shows Railway API online', async ({ page }) => {
    await page.goto('/')
    // wait for the API check to resolve
    await expect(page.getByText('Railway API')).toBeVisible()
    await expect(page.locator('text=commit')).toBeVisible({ timeout: 15_000 })
  })

  test('debug widget shows live bus count', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Live buses')).toBeVisible({ timeout: 15_000 })
    // The bus count link should be visible (rendered as a Link to /live)
    const liveLink = page.locator('a[href="/live"]').first()
    await expect(liveLink).toBeVisible({ timeout: 15_000 })
    const text = await liveLink.textContent()
    expect(Number(text?.trim())).toBeGreaterThan(0)
  })

  test('no AlertsBanner on home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[class*="slight-delay"]')).toHaveCount(0)
  })

  test('navbar has Alertes link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /alertes/i })).toBeVisible()
  })
})

test.describe('Alerts page', () => {
  test('shows heading', async ({ page }) => {
    await page.goto('/alerts')
    await expect(page.getByRole('heading', { name: 'Alertes réseau' })).toBeVisible()
  })

  test('shows alert list or empty state', async ({ page }) => {
    await page.goto('/alerts')
    await page.waitForLoadState('networkidle')
    const hasAlerts = await page.locator('[class*="slight-delay"]').count()
    const hasEmpty = await page.getByText('Aucune alerte en cours').isVisible().catch(() => false)
    expect(hasAlerts > 0 || hasEmpty).toBeTruthy()
  })
})

import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads with dark background and nav links', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Dark background
    const bg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    )
    expect(bg).not.toBe('rgb(255, 255, 255)')

    // Nav links present
    await expect(page.getByRole('link', { name: /carte|map/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /alertes/i })).toBeVisible()
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

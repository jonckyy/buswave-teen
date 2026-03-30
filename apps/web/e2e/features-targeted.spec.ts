import { test, expect } from '@playwright/test'

// ─── 1. Search state persistence ─────────────────────────────────────────────
test.describe('Search state persistence', () => {
  test('typing a query pushes ?q=<value> into the URL via router.replace', async ({ page }) => {
    await page.goto('/search?mode=ligne')
    const input = page.locator('input[placeholder*="ligne"]').first()
    await expect(input).toBeVisible({ timeout: 15_000 })
    await input.fill('12')
    await page.waitForFunction(
      () => window.location.search.includes('q=12'),
      { timeout: 5_000 }
    )
    expect(page.url()).toContain('q=12')
  })

  test('navigating to /search?q=12 pre-fills the input', async ({ page }) => {
    await page.goto('/search?mode=ligne&q=12')
    const input = page.locator('input[placeholder*="ligne"]').first()
    await expect(input).toBeVisible({ timeout: 15_000 })
    await expect(input).toHaveValue('12', { timeout: 10_000 })
  })

  test('results appear when pre-filled query is present', async ({ page }) => {
    await page.goto('/search?mode=ligne&q=12')
    await expect(page.locator('button').filter({ hasText: /Ligne TEC/i }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('navigating away and back preserves the query in the input', async ({ page }) => {
    await page.goto('/search?mode=ligne&q=12')
    const input = page.locator('input[placeholder*="ligne"]').first()
    await expect(input).toHaveValue('12', { timeout: 10_000 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goBack()
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('q=12')
    const inputBack = page.locator('input[placeholder*="ligne"]').first()
    await expect(inputBack).toHaveValue('12', { timeout: 10_000 })
  })
})

// ─── 2. Favorite → map navigation ────────────────────────────────────────────
test.describe('Favorite card navigates to map', () => {
  test('clicking a favorite BusCard navigates to /map with stopId and routeId params', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem(
        'buswave-favorites',
        JSON.stringify({
          state: {
            favoriteIds: ['150:10'],
            favorites: [
              {
                id: 'fav1',
                stopId: '150',
                routeId: '10',
                userId: null,
                label: 'Test Stop',
              },
            ],
          },
          version: 0,
        })
      )
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    const card = page.locator('a[href*="stopId=150"]').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    const href = await card.getAttribute('href')
    expect(href).toContain('stopId=150')
    expect(href).toContain('routeId=10')
    await card.click()
    await page.waitForURL(/\/map/, { timeout: 10_000 })
    const url = page.url()
    expect(url).toContain('/map')
    expect(url).toContain('stopId=150')
    expect(url).toContain('routeId=10')
  })

  test('the X button does NOT trigger navigation (only removes the favorite)', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem(
        'buswave-favorites',
        JSON.stringify({
          state: {
            favoriteIds: ['150:10'],
            favorites: [
              {
                id: 'fav1',
                stopId: '150',
                routeId: '10',
                userId: null,
                label: 'Test Stop',
              },
            ],
          },
          version: 0,
        })
      )
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    const card = page.locator('a[href*="stopId=150"]').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    const xBtn = card.locator('button[aria-label="Retirer des favoris"]').first()
    await expect(xBtn).toBeVisible()
    await xBtn.click()
    await page.waitForTimeout(500)
    expect(page.url()).not.toContain('/map')
    await expect(card).not.toBeVisible({ timeout: 5_000 })
  })
})

// ─── 3. Live buses page ───────────────────────────────────────────────────────
test.describe('Live buses page', () => {
  test('/live route exists and renders content (not 404)', async ({ page }) => {
    await page.goto('/live')
    await page.waitForLoadState('networkidle')
    const is404 = await page.locator('h2:has-text("This page could not be found")').isVisible().catch(() => false)
    if (is404) {
      throw new Error('/live returned 404 — the page route has not been deployed yet')
    }
    const mainContent = page.locator('main, h1, h2')
    await expect(mainContent.first()).toBeVisible({ timeout: 15_000 })
  })
})

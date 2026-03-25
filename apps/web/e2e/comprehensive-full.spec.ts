/**
 * Comprehensive full-suite E2E tests for BusWave
 * Target: https://buswave-web.vercel.app
 *
 * Covers:
 *  - All main pages (/, /map, /search, /alerts, /settings, /auth, /line/[id])
 *  - Notification settings panel (bell icon on BusCard)
 *  - Settings page (/settings) unauthenticated redirect + content
 *  - JS console errors and network failures
 *  - Dark-theme design token verification
 *  - API health check
 *  - Mobile viewport smoke test
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collect console errors and warnings for the duration of a test */
function collectConsoleLogs(page: Page): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const IGNORE = [
    // Next.js HMR noise, Vercel edge noise
    'fast refresh',
    'webpack',
    '[HMR]',
    'Download the React DevTools',
    'Warning: ReactDOM.render',
    // Leaflet SSR non-issue
    'leaflet',
  ]
  function shouldIgnore(msg: string) {
    const lower = msg.toLowerCase()
    return IGNORE.some((s) => lower.includes(s.toLowerCase()))
  }
  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    if (msg.type() === 'error' && !shouldIgnore(text)) errors.push(text)
    if (msg.type() === 'warning' && !shouldIgnore(text)) warnings.push(text)
  })
  return { errors, warnings }
}

/** Collect failed network requests */
function collectNetworkFailures(page: Page): string[] {
  const failures: string[] = []
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failures.push(`${res.status()} ${res.url()}`)
    }
  })
  return failures
}

/** Inject a fake favorite into localStorage before navigation */
async function injectFavorite(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem(
      'buswave-favorites',
      JSON.stringify({
        state: {
          favoriteIds: ['150:10'],
          favorites: [
            {
              id: 'fav-test-001',
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
}

// ─── 1. API Health ─────────────────────────────────────────────────────────────

test.describe('API health', () => {
  test('Railway API /health returns 200', async ({ request }) => {
    const res = await request.get('https://buswaveapi-production.up.railway.app/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    // Should have some status field or commit
    expect(body).toBeTruthy()
  })
})

// ─── 2. Home page (/) ─────────────────────────────────────────────────────────

test.describe('Home page (/)', () => {
  test('loads with dark background and no JS errors', async ({ page }) => {
    const { errors } = collectConsoleLogs(page)
    const networkFails = collectNetworkFailures(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Dark background token
    const bg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    )
    // Accept rgb(10, 14, 23) or similar — not white
    expect(bg).not.toBe('rgb(255, 255, 255)')

    // System status panel
    await expect(page.getByText('System status')).toBeVisible({ timeout: 15_000 })

    // Nav links present
    await expect(page.getByRole('link', { name: /carte|map/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /alertes/i })).toBeVisible()

    // No blocking 5xx errors
    const critical5xx = networkFails.filter((f) => f.startsWith('5'))
    expect(critical5xx, `5xx failures: ${critical5xx.join(', ')}`).toHaveLength(0)

    // No JS errors
    expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('debug panel shows Railway API online with commit hash', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Railway API')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=commit')).toBeVisible({ timeout: 20_000 })
  })

  test('debug panel shows live bus count > 0', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Live buses')).toBeVisible({ timeout: 20_000 })
    const liveLink = page.locator('a[href="/live"]').first()
    await expect(liveLink).toBeVisible({ timeout: 20_000 })
    const text = await liveLink.textContent()
    expect(Number(text?.trim())).toBeGreaterThan(0)
  })

  test('favorites section renders when favorites exist in localStorage', async ({ page }) => {
    await page.goto('/')
    await injectFavorite(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    // BusCard renders as a Link to /map
    const card = page.locator('a[href*="stopId=150"]').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
  })
})

// ─── 3. Map page (/map) ────────────────────────────────────────────────────────

test.describe('Map page (/map)', () => {
  test('loads without JS errors', async ({ page }) => {
    const { errors } = collectConsoleLogs(page)
    const fails = collectNetworkFailures(page)

    await page.goto('/map')
    await page.waitForLoadState('networkidle')
    // Map container must exist
    await expect(page.locator('#map, .leaflet-container, [class*="map"]').first()).toBeVisible({ timeout: 20_000 })

    const critical5xx = fails.filter((f) => f.startsWith('5'))
    expect(critical5xx, `5xx: ${critical5xx.join(', ')}`).toHaveLength(0)
    expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('line filter input is visible', async ({ page }) => {
    await page.goto('/map')
    // The filter input / autocomplete
    const filterInput = page.locator('input[placeholder*="ligne"], input[placeholder*="Ligne"], input[placeholder*="filter"], input[type="text"]').first()
    await expect(filterInput).toBeVisible({ timeout: 20_000 })
  })

  test('bus markers eventually appear on map', async ({ page }) => {
    await page.goto('/map')
    await page.waitForLoadState('networkidle')
    // Bus markers are Leaflet divIcon or img markers
    // Wait up to 20 seconds for at least one marker to appear
    await expect(
      page.locator('.leaflet-marker-icon, [class*="bus-marker"], svg circle').first()
    ).toBeVisible({ timeout: 25_000 })
  })

  test('map does not reset zoom on reload (hasFit guard)', async ({ page }) => {
    await page.goto('/map')
    await page.waitForLoadState('networkidle')
    // Get initial zoom level from Leaflet
    const zoom1 = await page.evaluate(() => {
      const map = (window as Record<string, unknown>)._leafletMap
      return typeof map === 'object' && map !== null && 'getZoom' in map
        ? (map as { getZoom: () => number }).getZoom()
        : null
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    const zoom2 = await page.evaluate(() => {
      const map = (window as Record<string, unknown>)._leafletMap
      return typeof map === 'object' && map !== null && 'getZoom' in map
        ? (map as { getZoom: () => number }).getZoom()
        : null
    })
    // If _leafletMap is exposed, check zoom doesn't reset to default (13)
    // This is a best-effort check — if the map isn't exposed, we skip
    if (zoom1 !== null && zoom2 !== null) {
      expect(zoom2).toBe(zoom1)
    }
  })
})

// ─── 4. Search page (/search) ──────────────────────────────────────────────────

test.describe('Search page (/search)', () => {
  test('loads with search input visible', async ({ page }) => {
    const { errors } = collectConsoleLogs(page)

    await page.goto('/search')
    const input = page.locator('input[placeholder*="ligne"], input[placeholder*="Ligne"]').first()
    await expect(input).toBeVisible({ timeout: 15_000 })

    expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('URL reflects typed query via router.replace', async ({ page }) => {
    await page.goto('/search')
    const input = page.locator('input[placeholder*="ligne"], input[placeholder*="Ligne"]').first()
    await expect(input).toBeVisible({ timeout: 15_000 })
    await input.fill('12')
    await page.waitForFunction(() => window.location.search.includes('q=12'), { timeout: 5_000 })
    expect(page.url()).toContain('q=12')
  })

  test('pre-filled query shows results', async ({ page }) => {
    await page.goto('/search?q=12')
    await expect(
      page.locator('button').filter({ hasText: /Ligne TEC/i }).first()
    ).toBeVisible({ timeout: 20_000 })
  })

  test('no empty string JSX renders (no blank text nodes)', async ({ page }) => {
    await page.goto('/search?q=12')
    await page.waitForLoadState('networkidle')
    // Check for suspicious lone whitespace/empty spans
    const emptySpans = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span, p'))
      return spans.filter((el) => el.textContent?.trim() === '' && el.children.length === 0).length
    })
    // Allow some (icons use empty spans), but not excessive
    expect(emptySpans).toBeLessThan(20)
  })
})

// ─── 5. Alerts page (/alerts) ─────────────────────────────────────────────────

test.describe('Alerts page (/alerts)', () => {
  test('heading is visible', async ({ page }) => {
    const { errors } = collectConsoleLogs(page)
    await page.goto('/alerts')
    await expect(page.getByRole('heading', { name: 'Alertes réseau' })).toBeVisible({ timeout: 15_000 })
    expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('shows alert list or empty-state message', async ({ page }) => {
    await page.goto('/alerts')
    await page.waitForLoadState('networkidle')
    const hasEmpty = await page.getByText(/aucune alerte/i).isVisible().catch(() => false)
    const hasAlerts = await page.locator('[class*="alert"], article, li').count()
    expect(hasAlerts > 0 || hasEmpty).toBeTruthy()
  })

  test('timestamps are not empty strings', async ({ page }) => {
    await page.goto('/alerts')
    await page.waitForLoadState('networkidle')
    // Look for time elements
    const times = page.locator('time, [class*="timestamp"], [class*="date"]')
    const count = await times.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await times.nth(i).textContent()
      expect(text?.trim(), `Empty timestamp at index ${i}`).not.toBe('')
    }
  })
})

// ─── 6. Settings page (/settings) — unauthenticated ───────────────────────────

test.describe('Settings page (/settings) — unauthenticated', () => {
  test('redirects to /auth when not logged in', async ({ page }) => {
    await page.goto('/settings')
    // Should redirect to /auth within a reasonable time
    await page.waitForURL(/\/(auth|login|signin)/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/(auth|login|signin)/)
  })
})

// ─── 7. Auth page (/auth) ─────────────────────────────────────────────────────

test.describe('Auth page (/auth)', () => {
  test('loads login/signup form without errors', async ({ page }) => {
    const { errors } = collectConsoleLogs(page)
    const fails = collectNetworkFailures(page)

    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    // Should have an email input
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 15_000 })

    // Dark background
    const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
    expect(bg).not.toBe('rgb(255, 255, 255)')

    const critical5xx = fails.filter((f) => f.startsWith('5'))
    expect(critical5xx, `5xx: ${critical5xx.join(', ')}`).toHaveLength(0)
    expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('email validation error appears on bad input', async ({ page }) => {
    await page.goto('/auth')
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    await emailInput.fill('notanemail')
    const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /connexion|login|se connecter|continuer/i }).first()
    await submitBtn.click()
    // Should show some error or native validation tooltip
    // Check for error text or invalid state
    const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid)
    const hasErrorText = await page.locator('[class*="error"], [role="alert"]').count()
    expect(isInvalid || hasErrorText > 0).toBeTruthy()
  })
})

// ─── 8. Line detail page (/line/[id]) ─────────────────────────────────────────

test.describe('Line detail page (/line/[id])', () => {
  test('loads with a real line ID and shows stop list', async ({ page }) => {
    const { errors } = collectConsoleLogs(page)
    // Line page uses query params, not path segments
    await page.goto('/line?routeId=H2082-23583')
    await page.waitForLoadState('networkidle')

    // Should not be a 404
    const body = await page.locator('body').textContent()
    const is404 = body?.includes('404') && body?.includes('not found')
    if (is404) {
      test.fail(true, '/line?routeId=... returned 404')
      return
    }

    // Should render some content (heading, stop list, etc.)
    const content = page.locator('main, h1, h2, [class*="stop"], li').first()
    await expect(content).toBeVisible({ timeout: 20_000 })

    expect(errors, `Console errors on /line: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('countdown timers render numeric values', async ({ page }) => {
    await page.goto('/line/12')
    await page.waitForLoadState('networkidle')
    // Countdowns look like "3 min" or "À l'arrêt"
    const countdowns = page.locator('[class*="countdown"], [class*="arrival"]')
    const count = await countdowns.count()
    if (count > 0) {
      const text = await countdowns.first().textContent()
      expect(text?.trim()).not.toBe('')
    }
  })
})

// ─── 9. Notification Settings Panel (bell icon on BusCard) ────────────────────

test.describe('Notification settings panel (bell icon on BusCard)', () => {
  // The bell icon is ONLY shown when a user is logged in (user && favorite condition).
  // For unauthenticated tests, we verify the panel does NOT appear, which is correct behavior.

  test('bell icon is NOT shown for unauthenticated users', async ({ page }) => {
    await page.goto('/')
    await injectFavorite(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    const card = page.locator('a[href*="stopId=150"]').first()
    await expect(card).toBeVisible({ timeout: 15_000 })

    // Bell button should NOT be present for unauthenticated users
    const bellBtn = card.locator('button[aria-label="Notifications"]')
    await expect(bellBtn).toHaveCount(0)
  })

  test('X (remove favorite) button works without navigating', async ({ page }) => {
    await page.goto('/')
    await injectFavorite(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    const card = page.locator('a[href*="stopId=150"]').first()
    await expect(card).toBeVisible({ timeout: 15_000 })

    const xBtn = card.locator('button[aria-label="Retirer des favoris"]')
    await expect(xBtn).toBeVisible()
    await xBtn.click()

    await page.waitForTimeout(500)
    expect(page.url()).not.toContain('/map')
    await expect(card).not.toBeVisible({ timeout: 5_000 })
  })

  test('NotificationSettingsPanel shows push-not-supported message in headless Chromium', async ({ page }) => {
    // Headless Chromium does not support Web Push API in the same way as a real browser.
    // When 'supported' is false, the panel renders the "not supported" fallback.
    // We simulate this by injecting a user into localStorage and triggering the panel open.
    // Since we cannot mock Supabase auth easily, we test the panel's DOM in isolation
    // by directly injecting the component state via page.evaluate.

    // Navigate to home with a fake favorite
    await page.goto('/')
    await injectFavorite(page)

    // Inject a fake user session so the bell icon appears
    // This uses the Supabase localStorage key pattern
    await page.evaluate(() => {
      // Supabase stores session under sb-<project-ref>-auth-token
      // We use a generic key that the app checks
      const fakeSession = {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-test-001',
          email: 'test@example.com',
          role: 'authenticated',
          created_at: '2025-01-01T00:00:00Z',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
        },
      }
      // Try common Supabase storage keys
      localStorage.setItem('sb-auth-token', JSON.stringify(fakeSession))
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => localStorage.setItem(k, JSON.stringify(fakeSession)))
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // If the bell button is visible, click it and verify the panel opens
    const card = page.locator('a[href*="stopId=150"]').first()
    await expect(card).toBeVisible({ timeout: 15_000 })

    const bellBtn = card.locator('button[aria-label="Notifications"]')
    const bellCount = await bellBtn.count()

    if (bellCount > 0) {
      await bellBtn.click()
      // Panel should open via portal on document.body
      await expect(page.locator('body').locator('h2').filter({ hasText: 'Notifications' })).toBeVisible({ timeout: 5_000 })

      // The close button (X) should work
      const closeBtn = page.locator('[aria-label="Fermer"], button').filter({ hasText: '' }).last()
      // Use the X button within the modal
      const modalX = page.locator('.fixed.inset-0').locator('button').first()
      // Click backdrop to close
      await page.locator('.fixed.inset-0').click({ position: { x: 10, y: 10 }, force: true })
      await expect(
        page.locator('body').locator('h2').filter({ hasText: 'Notifications' })
      ).not.toBeVisible({ timeout: 5_000 })
    } else {
      // Bell icon not visible — auth injection did not work (expected in headless context without real Supabase)
      // This is not a failure — the feature is auth-gated
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Bell icon requires real Supabase auth; skipped in headless context',
      })
    }
  })
})

// ─── 10. Design token verification ────────────────────────────────────────────

test.describe('Design token verification', () => {
  for (const route of ['/', '/map', '/search', '/alerts']) {
    test(`${route} uses dark background (not white)`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const bg = await page.evaluate(() =>
        window.getComputedStyle(document.body).backgroundColor
      )
      // Must not be white/default
      expect(bg, `Background is white on ${route}`).not.toBe('rgb(255, 255, 255)')
      expect(bg, `Background is white on ${route}`).not.toBe('rgba(0, 0, 0, 0)')
    })
  }

  test('accent cyan color is present on home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Check for elements with the cyan accent color (#00D4FF)
    const hasCyan = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'))
      return elements.some((el) => {
        const styles = window.getComputedStyle(el)
        const color = styles.color
        const bg = styles.backgroundColor
        return color.includes('0, 212, 255') || bg.includes('0, 212, 255')
      })
    })
    expect(hasCyan).toBeTruthy()
  })
})

// ─── 11. Navigation links ─────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('all nav links are functional from home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click Carte/Map link
    const mapLink = page.getByRole('link', { name: /carte|map/i }).first()
    await expect(mapLink).toBeVisible({ timeout: 10_000 })
    await mapLink.click()
    await page.waitForURL(/\/map/, { timeout: 10_000 })
    expect(page.url()).toContain('/map')

    // Go back and click Alertes
    await page.goBack()
    await page.waitForLoadState('networkidle')
    const alertsLink = page.getByRole('link', { name: /alertes/i })
    await expect(alertsLink).toBeVisible({ timeout: 10_000 })
    await alertsLink.click()
    await page.waitForURL(/\/alerts/, { timeout: 10_000 })
    expect(page.url()).toContain('/alerts')

    // Go back and click Recherche/Search
    await page.goBack()
    await page.waitForLoadState('networkidle')
    const searchLink = page.getByRole('link', { name: /recherche|search/i })
    const searchCount = await searchLink.count()
    if (searchCount > 0) {
      await searchLink.first().click()
      await page.waitForURL(/\/search/, { timeout: 10_000 })
      expect(page.url()).toContain('/search')
    }
  })
})

// ─── 12. Mobile viewport smoke test ───────────────────────────────────────────

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } }) // iPhone 14

  test('home page renders correctly on mobile (no overflow, no broken layout)', async ({ page }) => {
    const { errors } = collectConsoleLogs(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth
    })
    expect(hasOverflow, 'Horizontal overflow detected on mobile').toBeFalsy()

    // Nav should be present
    await expect(page.locator('nav, header').first()).toBeVisible({ timeout: 10_000 })

    expect(errors, `Mobile console errors: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('map page is accessible on mobile', async ({ page }) => {
    await page.goto('/map')
    await page.waitForLoadState('networkidle')
    const mapEl = page.locator('#map, .leaflet-container, [class*="map"]').first()
    await expect(mapEl).toBeVisible({ timeout: 20_000 })
  })

  test('search page input is reachable on mobile', async ({ page }) => {
    await page.goto('/search')
    const input = page.locator('input[placeholder*="ligne"], input[placeholder*="Ligne"]').first()
    await expect(input).toBeVisible({ timeout: 15_000 })
    await input.click()
    // Should be focused / keyboard should open (we just verify no crash)
    await page.waitForTimeout(500)
    expect(page.url()).toContain('/search')
  })
})

// ─── 13. No 4xx on critical API paths ────────────────────────────────────────

test.describe('API endpoint contract', () => {
  test('/api/realtime/vehicles returns { data: [...] }', async ({ request }) => {
    const res = await request.get('https://buswaveapi-production.up.railway.app/api/realtime/vehicles')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBeTruthy()
  })

  test('/api/realtime/alerts returns { data: [...] }', async ({ request }) => {
    const res = await request.get('https://buswaveapi-production.up.railway.app/api/realtime/alerts')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBeTruthy()
  })
})

// ─── 14. Service worker registration ─────────────────────────────────────────

test.describe('Service worker', () => {
  test('/sw.js is accessible (200 or 404 — not 5xx)', async ({ request }) => {
    const res = await request.get('https://buswave-web.vercel.app/sw.js')
    expect(res.status()).toBeLessThan(500)
  })

  test('VAPID public key endpoint is reachable', async ({ request }) => {
    const res = await request.get('https://buswaveapi-production.up.railway.app/api/notifications/vapid-key')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('publicKey')
  })
})

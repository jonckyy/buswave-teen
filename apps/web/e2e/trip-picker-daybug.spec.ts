/**
 * Bug reproduction: Day picker in TimetablePanel / TripPickerPanel
 * Target: https://buswave-teen.vercel.app
 *
 * Two-pronged test:
 *  A) TimetablePanel (no auth needed — Clock button on FavoriteCard)
 *     - Has the SAME day picker (Lu Ma Me Je Ve Sa Di)
 *     - Its backdrop uses onClick={onClose} only (no onTouchEnd) — TimetablePanel.tsx line 67
 *     - Day picker buttons use only onClick — so desktop should be fine
 *     - But on mobile/touch: onClick fires after touchstart+touchend, so backdrop ALSO fires
 *       unless stopPropagation is called. TimetablePanel's inner div has onClick stopProp but
 *       NO onTouchEnd stopProp → touch events on day buttons bubble to backdrop and close it!
 *
 *  B) NotificationSettingsPanel → TripPickerPanel (auth required)
 *     - NotificationSettingsPanel.tsx: backdrop has BOTH onClick AND onTouchEnd={handleBackdrop}
 *     - Inner panel content div has BOTH onClick and onTouchEnd={stopProp}
 *     - TripPickerPanel: rendered as React child, backdrop has onClick={onClose} only
 *     - TripPickerPanel inner div has only onClick stopProp, no onTouchEnd stopProp
 *     - On mobile touch: touching a day button in TripPickerPanel →
 *       touch event bubbles through React tree → hits NotificationSettingsPanel backdrop
 *       onTouchEnd={handleBackdrop} → CLOSES the NotificationSettingsPanel
 *       AND the TripPickerPanel disappears with it
 *
 * Static analysis findings confirmed via code review:
 *   - TimetablePanel.tsx line 66-71: backdrop onClick=onClose, inner div onClick=stopProp
 *     but NO onTouchEnd on inner div → touch events leak through
 *   - TripPickerPanel.tsx line 130-135: backdrop onClick=onClose, inner div onClick=stopProp
 *     but NO onTouchEnd on inner div → combined with parent NotificationSettingsPanel's
 *     onTouchEnd={handleBackdrop} → guaranteed close on any touch
 */

import { test, expect, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const BASE = 'https://buswave-teen.vercel.app'
const SS_DIR = path.join(__dirname, 'screenshots', 'trip-picker-bug')

// Real TEC stop + route from production API
const FAKE_FAVORITE = {
  id: 'test-playwright-fav-001',
  stopId: 'L1Tmare1',
  routeId: 'L1000-23082',
  userId: null,
  label: 'T1 · LIEGE Marengo (Tram)',
  createdAt: new Date().toISOString(),
}

function ensureDir() {
  fs.mkdirSync(SS_DIR, { recursive: true })
}

async function ss(page: Page, name: string) {
  const p = path.join(SS_DIR, `${name}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`[screenshot] ${name}.png`)
  return p
}

async function injectFavorite(page: Page) {
  await page.addInitScript((fav) => {
    const key = `${fav.stopId}:${fav.routeId}`
    localStorage.setItem('buswave-favorites', JSON.stringify({
      state: { favorites: [fav], favoriteIds: [key] },
      version: 0,
    }))
  }, FAKE_FAVORITE)
}

// ── Smoke test ───────────────────────────────────────────────────────────────
test.describe('Smoke', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test.setTimeout(30_000)

  test('homepage loads — title and no JS errors', async ({ page }) => {
    ensureDir()
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

    await page.goto(BASE, { waitUntil: 'networkidle' })
    await ss(page, '00-homepage-smoke')

    const title = await page.title()
    console.log(`[info] title: ${title}`)
    expect(title).toContain('BusWave')

    const relevant = errors.filter(e => !e.includes('favicon') && !e.includes('sw.js'))
    if (relevant.length) console.log('[console errors]', relevant)
    expect(relevant, 'No JS errors on homepage').toHaveLength(0)
  })
})

// ── TimetablePanel: desktop mouse ────────────────────────────────────────────
test.describe('TimetablePanel day picker — desktop mouse', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false })
  test.setTimeout(120_000)

  test('day buttons stay active and panel stays open', async ({ page }) => {
    ensureDir()
    await runTimetableDayTest(page, 'desktop')
  })
})

// ── TimetablePanel: mobile touch ─────────────────────────────────────────────
test.describe('TimetablePanel day picker — mobile touch (bug target)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test.setTimeout(120_000)

  test('day buttons stay active and panel stays open [TOUCH]', async ({ page }) => {
    ensureDir()
    await runTimetableDayTest(page, 'mobile')
  })
})

// ── Shared timetable day picker test ─────────────────────────────────────────
async function runTimetableDayTest(page: Page, mode: 'desktop' | 'mobile') {
  const p = mode
  const errors: string[] = []
  const netErrors: string[] = []

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon')) {
      netErrors.push(`${r.status()} ${r.url()}`)
    }
  })

  // Inject favorite and navigate home
  await injectFavorite(page)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await ss(page, `${p}-01-homepage`)

  // Confirm favorite card rendered
  const hasEmpty = await page.locator('text=Commence ici').isVisible().catch(() => false)
  if (hasEmpty) {
    console.log('[warn] Favorites not loaded from localStorage — possible SSR issue')
    await ss(page, `${p}-01b-empty-state`)
    test.skip()
    return
  }

  const stopVisible = await page.locator('text=LIEGE Marengo').isVisible().catch(() => false)
    || await page.locator('text=Marengo').isVisible().catch(() => false)
  console.log(`[info] Favorite card visible: ${stopVisible}`)

  // Scroll down to ensure card is fully visible
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(300)
  await ss(page, `${p}-01c-scrolled`)

  // Find the Clock (timetable) button — cyan IconButton, no auth guard
  // aria-label="Horaires" from IconButton component
  let clockBtn = page.locator('button[aria-label="Horaires"]')
  let clockCount = await clockBtn.count()
  console.log(`[info] Clock button (aria-label=Horaires): ${clockCount}`)

  if (clockCount === 0) {
    // Fallback: find by SVG content
    const allBtns = await page.locator('button').all()
    for (const btn of allBtns) {
      const html = await btn.innerHTML().catch(() => '')
      if (html.includes('clock') || html.includes('Clock')) {
        const vis = await btn.isVisible().catch(() => false)
        if (vis) {
          clockBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(
            allBtns.indexOf(btn)
          )
          clockCount = 1
          console.log('[info] Found clock button by SVG content')
          break
        }
      }
    }
  }

  if (clockCount === 0) {
    console.log('[warn] Clock button not found — cannot open TimetablePanel')
    await ss(page, `${p}-02-no-clock-btn`)
    return
  }

  // Click Clock button to open TimetablePanel
  if (mode === 'mobile') {
    await clockBtn.first().tap()
  } else {
    await clockBtn.first().click()
  }
  await page.waitForTimeout(700)
  await ss(page, `${p}-02-timetable-panel-open`)

  // Verify TimetablePanel opened
  // TimetablePanel has a day picker row and timetable content
  const panelOverlay = page.locator('.fixed.inset-0').first()
  const panelVisible = await panelOverlay.isVisible().catch(() => false)
  console.log(`[info] Modal overlay visible: ${panelVisible}`)

  // Look for the day picker row: buttons Lu Ma Me Je Ve Sa Di
  const luBtn = page.locator('button').filter({ hasText: /^Lu$/ })
  const luCount = await luBtn.count()
  console.log(`[info] "Lu" day button count: ${luCount}`)

  if (luCount === 0) {
    console.log('[error] TimetablePanel did not open (no day picker buttons)')
    await ss(page, `${p}-02b-no-day-picker`)
    expect(luCount, 'TimetablePanel should show day picker').toBeGreaterThan(0)
    return
  }

  console.log(`[info] TimetablePanel open with day picker. Testing days (${mode})...`)

  // ── Test each day button ──────────────────────────────────────────────────
  const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
  const results: {
    label: string
    classChanged: boolean
    panelStillOpen: boolean
    tabularError?: string
  }[] = []

  // Determine initial selected day (should be today)
  const firstDayBtn = page.locator('button').filter({ hasText: /^Lu$/ }).first()
  const initClass = await firstDayBtn.getAttribute('class') ?? ''
  console.log(`[info] Lu initial class contains bg-btn-primary: ${initClass.includes('bg-btn-primary')}`)

  for (const label of DAYS) {
    const dayBtn = page.locator('button').filter({ hasText: new RegExp(`^${label}$`) }).first()
    const classBefore = await dayBtn.getAttribute('class') ?? ''
    const wasActive = classBefore.includes('bg-btn-primary')

    // Click (or tap on mobile)
    try {
      if (mode === 'mobile') {
        await dayBtn.tap()
      } else {
        await dayBtn.click()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`[error] Day "${label}" click failed: ${msg}`)
      results.push({ label, classChanged: false, panelStillOpen: true, tabularError: msg })
      continue
    }

    await page.waitForTimeout(500)

    // Is panel still open?
    const luStillThere = await page.locator('button').filter({ hasText: /^Lu$/ }).first().isVisible().catch(() => false)
    console.log(`[info] Day "${label}": day picker still visible: ${luStillThere}`)

    if (!luStillThere) {
      console.log(`[BUG] Day "${label}" click CLOSED the timetable panel! (${mode})`)
      await ss(page, `${p}-BUG-day-${label}-closed-panel`)
      results.push({ label, classChanged: false, panelStillOpen: false })
      break
    }

    // Check class changed
    const classAfter = await dayBtn.getAttribute('class') ?? ''
    const isActive = classAfter.includes('bg-btn-primary')
    const changed = wasActive !== isActive

    console.log(`[info] Day "${label}": was active=${wasActive}, now active=${isActive}, changed=${changed}`)
    if (!changed && !wasActive) {
      console.log(`[WARN] Day "${label}": should have become active but class did not change`)
    }

    await ss(page, `${p}-03-day-${label}`)
    results.push({ label, classChanged: changed || isActive, panelStillOpen: true })
  }

  await ss(page, `${p}-04-final`)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n[=== ${mode.toUpperCase()} TIMETABLE DAY PICKER RESULTS ===]`)
  for (const r of results) {
    const status = !r.panelStillOpen
      ? 'BUG: CLOSED PANEL'
      : !r.classChanged ? 'WARN: no visual change'
      : r.tabularError ? `ERROR: ${r.tabularError}`
      : 'OK'
    console.log(`  ${r.label}: ${status}`)
  }

  const closedBugs = results.filter(r => !r.panelStillOpen)
  if (closedBugs.length > 0) {
    console.log(`\n[CONFIRMED BUG — ${mode}] ${closedBugs.length} day click(s) closed the panel: ${closedBugs.map(r => r.label).join(', ')}`)
  }

  const relevantErrors = errors.filter(e => !e.includes('favicon') && !e.includes('sw.js') && !e.includes('gtag'))
  if (relevantErrors.length) console.log('[console errors]:', relevantErrors)
  if (netErrors.length) console.log('[network errors]:', netErrors)

  // Assertions
  expect(closedBugs, `[${mode}] Day button click should NOT close timetable panel`).toHaveLength(0)
  expect(relevantErrors, `[${mode}] No JS console errors`).toHaveLength(0)
}

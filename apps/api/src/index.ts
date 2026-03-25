import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { vehiclesRouter } from './routes/vehicles.js'
import { stopsRouter } from './routes/stops.js'
import { routesRouter } from './routes/routes.js'
import { alertsRouter } from './routes/alerts.js'
import { notificationsRouter } from './routes/notifications.js'
import { startNotificationScheduler } from './lib/notification-scheduler.js'

const app = new Hono()

// Global error handler — catch crashes instead of killing the process
app.onError((err, c) => {
  console.error('[hono] Unhandled error:', err.message, err.stack)
  return c.json({ error: `Internal error: ${err.message}` }, 500)
})

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env['CORS_ORIGIN'] ?? '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
)

// Health check — version helps confirm Railway deployed latest code
app.get('/health', async (c) => {
  const { isConfigured, getVapidPublicKey, validateVapidKeys } = await import('./lib/web-push.js')
  const pubKey = getVapidPublicKey()
  const vapidError = validateVapidKeys()
  return c.json({
    ok: true,
    commit: 'dbtest03',
    vapid: isConfigured(),
    vapidKeyLen: pubKey.length,
    vapidValid: vapidError === null,
    vapidError: vapidError ?? undefined,
  })
})

// Debug: surface vehicle fetch errors
app.get('/debug/vehicles', async (c) => {
  try {
    const { getVehiclePositions } = await import('./lib/gtfs-rt.js')
    const feed = await getVehiclePositions()
    return c.json({ ok: true, entityCount: feed.entity?.length ?? 0 })
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500)
  }
})

// Debug: inspect raw trip update structure
app.get('/debug/trips', async (c) => {
  try {
    const { getTripUpdates } = await import('./lib/gtfs-rt.js')
    const feed = await getTripUpdates()
    const entities = feed?.entity ?? []
    const sample = entities.slice(0, 2)
    return c.json({ ok: true, entityCount: entities.length, sample })
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500)
  }
})

// Debug: step-by-step DB test mirroring PUT settings handler (no auth required)
app.get('/debug/db-test', async (c) => {
  const steps: string[] = []
  try {
    const { supabase } = await import('./lib/supabase.js')
    const sbUrl = process.env['SUPABASE_URL'] ?? 'MISSING'
    const sbKey = process.env['SUPABASE_SERVICE_KEY'] ?? 'MISSING'
    steps.push(`url=${sbUrl.slice(0, 30)}...`)
    steps.push(`key_role=${sbKey.includes('service_role') ? 'service_role' : sbKey.slice(0, 20)}...`)

    // Test: raw favorites count to check if service_role bypasses RLS
    const { count: favCount, error: favCountErr } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
    steps.push(`favorites_count=${favCount} err=${favCountErr?.message ?? 'none'}`)

    // Find first user's first favorite to test with real data
    const { data: favRow, error: favErr } = await supabase
      .from('favorites')
      .select('id, user_id')
      .limit(1)
      .maybeSingle()
    if (!favRow) return c.json({ steps, error: `No favorites found: ${favErr?.message}` })
    const userId = favRow.user_id
    const favoriteId = favRow.id
    steps.push(`user=${userId} fav=${favoriteId}`)

    // Step 1: select with maybeSingle (same as GET settings — should work)
    try {
      const { data: existing, error: selErr } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('favorite_id', favoriteId)
        .maybeSingle()
      steps.push(`select: existing=${existing?.id ?? 'null'} err=${selErr?.message ?? 'none'}`)
    } catch (e) {
      steps.push(`select THREW: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Step 2: count query (push limit check)
    try {
      const { count, error: cntErr } = await supabase
        .from('notification_settings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      steps.push(`count: ${count} err=${cntErr?.message ?? 'none'}`)
    } catch (e) {
      steps.push(`count THREW: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Step 3: insert (the suspected crasher)
    try {
      const { error: insErr } = await supabase
        .from('notification_settings')
        .insert({
          favorite_id: favoriteId,
          user_id: userId,
          time_enabled: false,
          time_minutes: 5,
          distance_enabled: false,
          distance_meters: 500,
          offroute_enabled: false,
          offroute_meters: 150,
        })
      steps.push(`insert: err=${insErr?.message ?? 'none'}`)
    } catch (e) {
      steps.push(`insert THREW: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Step 4: cleanup — delete what we just inserted
    try {
      await supabase
        .from('notification_settings')
        .delete()
        .eq('favorite_id', favoriteId)
        .eq('user_id', userId)
      steps.push('cleanup: done')
    } catch (e) {
      steps.push(`cleanup THREW: ${e instanceof Error ? e.message : String(e)}`)
    }

    return c.json({ ok: true, steps })
  } catch (e) {
    steps.push(`outer crash: ${e instanceof Error ? e.message : String(e)}`)
    return c.json({ ok: false, steps, error: String(e) }, 500)
  }
})

// Routes — one mount per router, sub-paths live inside each router
app.route('/api/realtime/vehicles', vehiclesRouter)
app.route('/api/realtime/stops', stopsRouter)
app.route('/api/realtime/routes', routesRouter)
app.route('/api/realtime/alerts', alertsRouter)
app.route('/api/notifications', notificationsRouter)

// Start the push notification scheduler (30s interval)
try {
  startNotificationScheduler()
} catch (err) {
  console.error('[startup] Scheduler failed to start:', err)
}

const port = Number(process.env['PORT'] ?? 3001)
console.log(`BusWave API listening on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}

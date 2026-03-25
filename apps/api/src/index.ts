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
    commit: 'debug01',
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

// Debug: test auth flow step by step
app.put('/debug/auth-test', async (c) => {
  const steps: string[] = []
  try {
    const authHeader = c.req.header('Authorization')
    steps.push(`header: ${authHeader ? 'present' : 'missing'}`)
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ steps, error: 'No bearer token' }, 401)
    }
    const token = authHeader.slice(7)
    steps.push(`token: ${token.length} chars`)

    const { supabase } = await import('./lib/supabase.js')
    steps.push('supabase: imported')

    const { data: { user }, error } = await supabase.auth.getUser(token)
    steps.push(`getUser: ${user ? user.id : 'null'} error=${error?.message ?? 'none'}`)
    if (!user) return c.json({ steps, error: 'Invalid token' }, 401)

    let role = 'user'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role) role = profile.role
      steps.push(`profile: role=${role}`)
    } catch (e) {
      steps.push(`profile: error=${e}`)
    }

    const body = await c.req.json()
    steps.push(`body: ${JSON.stringify(body).slice(0, 100)}`)

    return c.json({ ok: true, steps, userId: user.id, role })
  } catch (e) {
    steps.push(`crash: ${e instanceof Error ? e.message : String(e)}`)
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

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { vehiclesRouter } from './routes/vehicles.js'
import { stopsRouter } from './routes/stops.js'
import { routesRouter } from './routes/routes.js'
import { alertsRouter } from './routes/alerts.js'
import { notificationsRouter } from './routes/notifications.js'
import { adminRouter } from './routes/admin.js'
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
    commit: 'daily-limits01',
    vapid: isConfigured(),
    vapidKeyLen: pubKey.length,
    vapidValid: vapidError === null,
    vapidError: vapidError ?? undefined,
  })
})

// Routes — one mount per router, sub-paths live inside each router
app.route('/api/realtime/vehicles', vehiclesRouter)
app.route('/api/realtime/stops', stopsRouter)
app.route('/api/realtime/routes', routesRouter)
app.route('/api/realtime/alerts', alertsRouter)
app.route('/api/notifications', notificationsRouter)
app.route('/api/admin', adminRouter)

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

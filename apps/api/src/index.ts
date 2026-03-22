import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { vehiclesRouter } from './routes/vehicles.js'
import { stopsRouter } from './routes/stops.js'
import { routesRouter } from './routes/routes.js'
import { alertsRouter } from './routes/alerts.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env['CORS_ORIGIN'] ?? '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
)

// Health check
app.get('/health', (c) => c.json({ ok: true }))

// Routes
app.route('/api/realtime/vehicles', vehiclesRouter)
app.route('/api/realtime/stops', stopsRouter)
app.route('/api/realtime/routes', routesRouter)
app.route('/api/realtime/route-live', routesRouter)
app.route('/api/realtime/route-shape', routesRouter)
app.route('/api/realtime/alerts', alertsRouter)

const port = Number(process.env['PORT'] ?? 3001)
console.log(`BusWave API listening on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}

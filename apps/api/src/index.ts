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

// Health check — version helps confirm Railway deployed latest code
app.get('/health', (c) => c.json({ ok: true, commit: '7ff85e8' }))

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

// Routes — one mount per router, sub-paths live inside each router
app.route('/api/realtime/vehicles', vehiclesRouter)
app.route('/api/realtime/stops', stopsRouter)
app.route('/api/realtime/routes', routesRouter)
app.route('/api/realtime/alerts', alertsRouter)

const port = Number(process.env['PORT'] ?? 3001)
console.log(`BusWave API listening on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}

import { Hono } from 'hono'
import { getRouteLive } from '../lib/gtfs-rt.js'
import { getCachedShapeData } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import type { ApiResponse, GtfsRoute, RouteWithLiveVehicles, VehiclePosition } from '@buswave/shared'

export const routesRouter = new Hono()

/** GET /api/realtime/routes?q=XXX — full-text search */
routesRouter.get('/', async (c) => {
  const q = c.req.query('q')
  if (!q) {
    return c.json({ error: 'q param required', status: 400 }, 400)
  }

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .textSearch('fts', q, { type: 'websearch', config: 'french' })
    .limit(20)

  if (error) {
    return c.json({ error: error.message, status: 500 }, 500)
  }

  return c.json({ data: (data ?? []) as GtfsRoute[] } satisfies ApiResponse<GtfsRoute[]>)
})

/** GET /api/realtime/route-live?routeId=XXX */
routesRouter.get('/route-live', async (c) => {
  const routeId = c.req.query('routeId')
  if (!routeId) {
    return c.json({ error: 'routeId param required', status: 400 }, 400)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feed: any = await getRouteLive(routeId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  const vehicles: VehiclePosition[] = entities
    .filter((e: any) => e.vehicle?.position)
    .map((e: any) => ({
      vehicleId: e.vehicle.vehicle?.id ?? e.id,
      routeId: e.vehicle?.trip?.routeId ?? routeId,
      tripId: e.vehicle?.trip?.tripId ?? '',
      lat: e.vehicle.position.latitude,
      lon: e.vehicle.position.longitude,
      bearing: e.vehicle.position.bearing ?? undefined,
      speed: e.vehicle.position.speed ?? undefined,
      timestamp: e.vehicle.timestamp ?? Math.floor(Date.now() / 1000),
    }))

  // Get route info from Supabase
  const { data: routeRow } = await supabase
    .from('routes')
    .select('*')
    .eq('route_id', routeId)
    .maybeSingle()

  if (!routeRow) {
    return c.json({ error: 'Route not found', status: 404 }, 404)
  }

  // Get shape for first trip on this route
  const { data: tripRow } = await supabase
    .from('trips')
    .select('shape_id')
    .eq('route_id', routeId)
    .not('shape_id', 'is', null)
    .limit(1)
    .maybeSingle()

  const shapePoints = tripRow?.shape_id
    ? await getCachedShapeData(tripRow.shape_id, async () => {
        const { data: shapes } = await supabase
          .from('shapes')
          .select('shape_pt_lat, shape_pt_lon, shape_pt_sequence')
          .eq('shape_id', tripRow.shape_id)
          .order('shape_pt_sequence', { ascending: true })
        return (shapes ?? []).map((s: any) => ({ lat: s.shape_pt_lat, lon: s.shape_pt_lon }))
      })
    : []

  const result: RouteWithLiveVehicles = {
    route: routeRow as GtfsRoute,
    vehicles,
    shapePoints,
  }

  return c.json({ data: result } satisfies ApiResponse<RouteWithLiveVehicles>)
})

/** GET /api/realtime/route-shape?routeId=XXX */
routesRouter.get('/route-shape', async (c) => {
  const routeId = c.req.query('routeId')
  if (!routeId) {
    return c.json({ error: 'routeId param required', status: 400 }, 400)
  }

  const { data: tripRow } = await supabase
    .from('trips')
    .select('shape_id')
    .eq('route_id', routeId)
    .not('shape_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!tripRow?.shape_id) {
    return c.json({ data: [] } satisfies ApiResponse<Array<{ lat: number; lon: number }>>)
  }

  const points = await getCachedShapeData(tripRow.shape_id, async () => {
    const { data: shapes } = await supabase
      .from('shapes')
      .select('shape_pt_lat, shape_pt_lon, shape_pt_sequence')
      .eq('shape_id', tripRow.shape_id)
      .order('shape_pt_sequence', { ascending: true })
    return (shapes ?? []).map((s: any) => ({ lat: s.shape_pt_lat, lon: s.shape_pt_lon }))
  })

  return c.json({ data: points } satisfies ApiResponse<Array<{ lat: number; lon: number }>>)
})

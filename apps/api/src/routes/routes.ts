import { Hono } from 'hono'
import { getVehiclePositions, getCachedShapeData } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import type { ApiResponse, GtfsRoute, RouteDirection, RouteWithLiveVehicles, VehiclePosition } from '@buswave/shared'

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
  const feed: any = await getVehiclePositions()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  const vehicles: VehiclePosition[] = entities
    .filter((e: any) => e.vehicle?.position && e.vehicle?.trip?.routeId === routeId)
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

  // Get one trip per direction to fetch both direction shapes
  const { data: dirTripRows } = await supabase
    .from('trips')
    .select('shape_id, direction_id')
    .eq('route_id', routeId)
    .not('shape_id', 'is', null)
    .in('direction_id', [0, 1])

  // One unique shape_id per direction, sorted by direction_id
  const dirShapeIds = new Map<number, string>()
  for (const t of dirTripRows ?? []) {
    const dir = (t as any).direction_id ?? 0
    if (!dirShapeIds.has(dir)) dirShapeIds.set(dir, (t as any).shape_id)
  }

  const shapeSegments: Array<Array<{ lat: number; lon: number }>> = []
  for (const [, shapeId] of [...dirShapeIds.entries()].sort((a, b) => a[0] - b[0])) {
    const pts = await getCachedShapeData(shapeId, async () => {
      const { data: shapes } = await supabase
        .from('shapes')
        .select('shape_pt_lat, shape_pt_lon, shape_pt_sequence')
        .eq('shape_id', shapeId)
        .order('shape_pt_sequence', { ascending: true })
      return (shapes ?? []).map((s: any) => ({ lat: s.shape_pt_lat, lon: s.shape_pt_lon }))
    })
    if (pts.length > 0) shapeSegments.push(pts)
  }

  const shapePoints = shapeSegments[0] ?? []

  const result: RouteWithLiveVehicles = {
    route: routeRow as GtfsRoute,
    vehicles,
    shapePoints,
    shapeSegments,
  }

  return c.json({ data: result } satisfies ApiResponse<RouteWithLiveVehicles>)
})

/** GET /api/realtime/route-stops?routeId=XXX — stops per direction */
routesRouter.get('/route-stops', async (c) => {
  const routeId = c.req.query('routeId')
  if (!routeId) {
    return c.json({ error: 'routeId param required', status: 400 }, 400)
  }

  // One representative trip per direction
  const { data: trips } = await supabase
    .from('trips')
    .select('trip_id, direction_id, trip_headsign')
    .eq('route_id', routeId)
    .in('direction_id', [0, 1])

  if (!trips?.length) {
    return c.json({ data: [] } satisfies ApiResponse<RouteDirection[]>)
  }

  // Pick one trip per direction
  const dirMap = new Map<number, { tripId: string; headsign: string }>()
  for (const t of trips) {
    const dir = t.direction_id ?? 0
    if (!dirMap.has(dir)) {
      dirMap.set(dir, { tripId: t.trip_id, headsign: t.trip_headsign ?? '' })
    }
  }

  const directions: RouteDirection[] = []

  for (const [directionId, { tripId, headsign }] of dirMap.entries()) {
    // Get stop_times in order for this trip
    const { data: stopTimes } = await supabase
      .from('stop_times')
      .select('stop_id, stop_sequence')
      .eq('trip_id', tripId)
      .order('stop_sequence', { ascending: true })

    if (!stopTimes?.length) continue

    const stopIds = stopTimes.map((s: any) => s.stop_id as string)

    const { data: stops } = await supabase
      .from('stops')
      .select('stop_id, stop_name, stop_lat, stop_lon, stop_code')
      .in('stop_id', stopIds)

    // Reorder stops to match sequence
    const stopMap = new Map((stops ?? []).map((s: any) => [s.stop_id, s]))
    const orderedStops = stopIds
      .map((id) => stopMap.get(id))
      .filter(Boolean)

    // Use last stop name when trip_headsign is empty
    const resolvedHeadsign = headsign || (orderedStops[orderedStops.length - 1] as any)?.stop_name || ''

    directions.push({
      directionId: directionId as 0 | 1,
      headsign: resolvedHeadsign,
      stops: orderedStops,
    })
  }

  // Sort by directionId
  directions.sort((a, b) => a.directionId - b.directionId)

  return c.json({ data: directions } satisfies ApiResponse<RouteDirection[]>)
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

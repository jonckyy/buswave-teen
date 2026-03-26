import { Hono } from 'hono'
import { getVehiclePositions, getCachedShapeData } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import { getRouteSiblings } from '../lib/route-siblings.js'
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

  // Deduplicate route variants (same short_name + long_name = same physical line)
  const seen = new Map<string, GtfsRoute>()
  for (const route of (data ?? []) as GtfsRoute[]) {
    const key = `${route.route_short_name}|${route.route_long_name}`
    if (!seen.has(key)) seen.set(key, route)
  }

  return c.json({ data: [...seen.values()] } satisfies ApiResponse<GtfsRoute[]>)
})

/** GET /api/realtime/routes/names?ids=A,B,C — names for a list of route IDs */
routesRouter.get('/names', async (c) => {
  const ids = c.req.query('ids')?.split(',').filter(Boolean) ?? []
  if (!ids.length) return c.json({ data: [] } satisfies ApiResponse<GtfsRoute[]>)

  const { data, error } = await supabase
    .from('routes')
    .select('route_id, route_short_name, route_long_name')
    .in('route_id', ids)

  if (error) return c.json({ data: [] } satisfies ApiResponse<GtfsRoute[]>)
  return c.json({ data: (data ?? []) as GtfsRoute[] } satisfies ApiResponse<GtfsRoute[]>)
})

/** GET /api/realtime/route-live?routeId=XXX */
routesRouter.get('/route-live', async (c) => {
  const routeId = c.req.query('routeId')
  if (!routeId) {
    return c.json({ error: 'routeId param required', status: 400 }, 400)
  }

  const siblingSet = await getRouteSiblings(routeId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feed: any = await getVehiclePositions()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  const vehicles: VehiclePosition[] = entities
    .filter((e: any) => e.vehicle?.position && siblingSet.has(e.vehicle?.trip?.routeId))
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

  // Get one trip per direction to fetch both direction shapes (check all siblings)
  const { data: dirTripRows } = await supabase
    .from('trips')
    .select('shape_id, direction_id')
    .in('route_id', [...siblingSet])
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

  // Fetch trips across all siblings for maximum stop coverage
  const siblingSet = await getRouteSiblings(routeId)
  const { data: trips } = await supabase
    .from('trips')
    .select('trip_id, direction_id, trip_headsign, service_id')
    .in('route_id', [...siblingSet])
    .in('direction_id', [0, 1])

  if (!trips?.length) {
    return c.json({ data: [] } satisfies ApiResponse<RouteDirection[]>)
  }

  // Pick up to 5 trips per direction with distinct service_ids for max coverage
  const dirTrips = new Map<number, Array<{ tripId: string; headsign: string }>>()
  const dirServices = new Map<number, Set<string>>()
  for (const t of trips) {
    const dir = (t.direction_id ?? 0) as number
    if (!dirTrips.has(dir)) { dirTrips.set(dir, []); dirServices.set(dir, new Set()) }
    const svc = (t as any).service_id as string
    const arr = dirTrips.get(dir)!
    const seen = dirServices.get(dir)!
    if (arr.length < 5 && !seen.has(svc)) {
      arr.push({ tripId: t.trip_id, headsign: t.trip_headsign ?? '' })
      seen.add(svc)
    }
  }

  const directions: RouteDirection[] = []

  for (const [directionId, tripSamples] of dirTrips.entries()) {
    // Fetch stop_times for all sampled trips in parallel
    const allStopTimes = await Promise.all(
      tripSamples.map(({ tripId }) =>
        supabase
          .from('stop_times')
          .select('stop_id, stop_sequence')
          .eq('trip_id', tripId)
          .order('stop_sequence', { ascending: true })
          .then(({ data }) => (data ?? []) as Array<{ stop_id: string; stop_sequence: number }>)
      )
    )

    // Count how many trips serve each stop, and find the longest trip as base
    const stopTripCount = new Map<string, number>()
    let longestIdx = 0
    for (let i = 0; i < allStopTimes.length; i++) {
      if (allStopTimes[i].length > allStopTimes[longestIdx].length) longestIdx = i
      for (const st of allStopTimes[i]) {
        stopTripCount.set(st.stop_id, (stopTripCount.get(st.stop_id) ?? 0) + 1)
      }
    }
    const totalTrips = allStopTimes.length

    // Build unified stop list: start from longest trip, insert extras at their sequence
    const baseStops = allStopTimes[longestIdx]
    const seenIds = new Set(baseStops.map((s) => s.stop_id))
    // Collect extra stops from other trips
    const extras: Array<{ stop_id: string; stop_sequence: number }> = []
    for (let i = 0; i < allStopTimes.length; i++) {
      if (i === longestIdx) continue
      for (const st of allStopTimes[i]) {
        if (!seenIds.has(st.stop_id)) {
          extras.push(st)
          seenIds.add(st.stop_id)
        }
      }
    }

    // Merge extras into base by sequence position
    const merged = [...baseStops]
    for (const extra of extras) {
      // Insert after the last stop with sequence <= extra.stop_sequence
      let insertIdx = merged.length
      for (let i = merged.length - 1; i >= 0; i--) {
        if (merged[i].stop_sequence <= extra.stop_sequence) {
          insertIdx = i + 1
          break
        }
      }
      merged.splice(insertIdx, 0, extra)
    }

    // Fetch stop details
    const allStopIds = merged.map((s) => s.stop_id)
    const { data: stops } = await supabase
      .from('stops')
      .select('stop_id, stop_name, stop_lat, stop_lon, stop_code')
      .in('stop_id', allStopIds)

    const stopMap = new Map((stops ?? []).map((s: any) => [s.stop_id, s]))

    const orderedStops = merged
      .map((st) => {
        const s = stopMap.get(st.stop_id)
        if (!s) return null
        const count = stopTripCount.get(st.stop_id) ?? 0
        return {
          ...s,
          stopSequence: st.stop_sequence,
          ...(count < totalTrips ? { partial: true } : {}),
        }
      })
      .filter(Boolean)

    // Resolve headsign: prefer non-empty, fallback to last stop name
    const headsign = tripSamples.find((t) => t.headsign)?.headsign
      || (orderedStops[orderedStops.length - 1] as any)?.stop_name || ''

    directions.push({
      directionId: directionId as 0 | 1,
      headsign,
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

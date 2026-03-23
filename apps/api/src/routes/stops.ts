import { Hono } from 'hono'
import { getTripUpdates } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import type { StopArrival, ApiResponse, GtfsStop } from '@buswave/shared'

export const stopsRouter = new Hono()

/** GET /api/realtime/stops/:stopId/arrivals?routeId=XXX */
stopsRouter.get('/:stopId/arrivals', async (c) => {
  const stopId = c.req.param('stopId')
  const routeId = c.req.query('routeId')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feed: any = await getTripUpdates()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  const arrivals: StopArrival[] = []

  for (const entity of entities) {
    const tu = entity.tripUpdate
    if (!tu) continue
    if (routeId && tu.trip?.routeId !== routeId) continue

    const stopTimeUpdates: any[] = tu.stopTimeUpdate ?? []
    const stu = stopTimeUpdates.find((s: any) => s.stopId === stopId)
    if (!stu) continue

    const scheduled =
      stu.arrival?.time ?? stu.departure?.time ?? null
    const predicted =
      stu.arrival?.time ?? stu.departure?.time ?? null
    if (!scheduled || !predicted) continue

    // Fetch route short name from Supabase for display
    const { data: routeRow } = await supabase
      .from('routes')
      .select('route_short_name')
      .eq('route_id', tu.trip?.routeId ?? '')
      .maybeSingle()

    arrivals.push({
      tripId: tu.trip?.tripId ?? '',
      routeId: tu.trip?.routeId ?? '',
      routeShortName: routeRow?.route_short_name ?? tu.trip?.routeId ?? '',
      headsign: tu.trip?.tripHeadsign ?? '',
      scheduledArrivalUnix: Number(scheduled),
      predictedArrivalUnix: Number(predicted),
      delaySeconds: (stu.arrival?.delay ?? stu.departure?.delay ?? 0),
      stopSequence: stu.stopSequence ?? 0,
    })
  }

  // Sort by predicted arrival
  arrivals.sort((a, b) => a.predictedArrivalUnix - b.predictedArrivalUnix)

  return c.json({ data: arrivals } satisfies ApiResponse<StopArrival[]>)
})

/** GET /api/realtime/stops/search?q=XXX — search stops by name */
stopsRouter.get('/search', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q || q.length < 2) {
    return c.json({ data: [] } satisfies ApiResponse<GtfsStop[]>)
  }

  const { data, error } = await supabase
    .from('stops')
    .select('stop_id, stop_name, stop_lat, stop_lon, stop_code')
    .ilike('stop_name', `%${q}%`)
    .limit(30)

  if (error) return c.json({ data: [] } satisfies ApiResponse<GtfsStop[]>)

  return c.json({ data: (data ?? []) as GtfsStop[] } satisfies ApiResponse<GtfsStop[]>)
})

/** GET /api/realtime/stops/:stopId/info */
stopsRouter.get('/:stopId/info', async (c) => {
  const stopId = c.req.param('stopId')

  const { data, error } = await supabase
    .from('stops')
    .select('*')
    .eq('stop_id', stopId)
    .maybeSingle()

  if (error || !data) {
    return c.json({ error: 'Stop not found', status: 404 }, 404)
  }

  return c.json({ data: data as GtfsStop } satisfies ApiResponse<GtfsStop>)
})

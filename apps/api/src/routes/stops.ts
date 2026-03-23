import { Hono } from 'hono'
import { getTripUpdates } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import type { StopArrival, ApiResponse, GtfsStop } from '@buswave/shared'

export const stopsRouter = new Hono()

/**
 * Returns the Europe/Brussels UTC offset in seconds for a given date
 * (e.g. +3600 for CET, +7200 for CEST). Uses noon to safely straddle DST.
 */
function brusselsOffsetSec(dateStr: string): number {
  const year = parseInt(dateStr.slice(0, 4))
  const month = parseInt(dateStr.slice(4, 6)) - 1
  const day = parseInt(dateStr.slice(6, 8))
  const noon = new Date(Date.UTC(year, month, day, 12))
  const utcStr = noon.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = noon.toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
  return (new Date(localStr).getTime() - new Date(utcStr).getTime()) / 1000
}

/**
 * Convert GTFS time string ("HH:MM:SS", may exceed 24h) + date string ("YYYYMMDD")
 * to a Unix timestamp (seconds).
 * TEC stores arrival_time in local Belgian time (Europe/Brussels) — subtract the
 * UTC offset so the result is a correct UTC Unix timestamp.
 */
function gtfsTimeToUnix(timeStr: string, dateStr: string): number {
  const [h, m, s] = timeStr.split(':').map(Number)
  const year = parseInt(dateStr.slice(0, 4))
  const month = parseInt(dateStr.slice(4, 6)) - 1
  const day = parseInt(dateStr.slice(6, 8))
  const base = Date.UTC(year, month, day) / 1000
  return base + h * 3600 + m * 60 + s - brusselsOffsetSec(dateStr)
}

/** GET /api/realtime/stops/:stopId/arrivals?routeId=XXX */
stopsRouter.get('/:stopId/arrivals', async (c) => {
  const stopId = c.req.param('stopId')
  const routeId = c.req.query('routeId')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feed: any = await getTripUpdates()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  // Collect candidate trip updates that include this stop
  type Candidate = {
    tripId: string
    routeId: string
    startDate: string
    stopSequence: number
    delaySeconds: number
  }
  const candidates: Candidate[] = []

  for (const entity of entities) {
    const tu = entity.tripUpdate
    if (!tu) continue
    // CANCELED trips (scheduleRelationship=3) — skip
    if (tu.trip?.scheduleRelationship === 3) continue
    if (routeId && tu.trip?.routeId !== routeId) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stopTimeUpdates: any[] = tu.stopTimeUpdate ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stu = stopTimeUpdates.find((s: any) => s.stopId === stopId)
    if (!stu) continue

    const rawDelay = stu.arrival?.delay ?? stu.departure?.delay ?? 0
    // TEC GTFS-RT emits delay=-60 as a systematic default for all trips.
    // Treat |delay| ≤ 60s as "on schedule" to avoid a spurious 1-minute offset.
    const delaySeconds = Math.abs(rawDelay) <= 60 ? 0 : rawDelay

    candidates.push({
      tripId: tu.trip?.tripId ?? '',
      routeId: tu.trip?.routeId ?? '',
      startDate: tu.trip?.startDate ?? '',
      stopSequence: stu.stopSequence ?? 0,
      delaySeconds,
    })
  }

  if (candidates.length === 0) {
    return c.json({ data: [] } satisfies ApiResponse<StopArrival[]>)
  }

  // Batch fetch scheduled times + route names from Supabase
  const tripIds = [...new Set(candidates.map((c) => c.tripId))]
  const routeIds = [...new Set(candidates.map((c) => c.routeId))]

  const [stopTimesRes, routesRes, tripsRes] = await Promise.all([
    supabase
      .from('stop_times')
      .select('trip_id, stop_sequence, arrival_time')
      .in('trip_id', tripIds)
      .eq('stop_id', stopId),
    supabase
      .from('routes')
      .select('route_id, route_short_name')
      .in('route_id', routeIds),
    supabase
      .from('trips')
      .select('trip_id, trip_headsign')
      .in('trip_id', tripIds),
  ])

  // Build lookup maps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduledMap = new Map<string, string>() // tripId → arrival_time
  for (const row of stopTimesRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scheduledMap.set((row as any).trip_id, (row as any).arrival_time)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeNameMap = new Map<string, string>()
  for (const row of routesRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    routeNameMap.set((row as any).route_id, (row as any).route_short_name)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headsignMap = new Map<string, string>()
  for (const row of tripsRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headsignMap.set((row as any).trip_id, (row as any).trip_headsign ?? '')
  }

  // For trips with empty headsign, fetch the last stop name as fallback
  const emptyHeadsignTripIds = tripIds.filter((id) => !headsignMap.get(id))
  if (emptyHeadsignTripIds.length > 0) {
    // Get last stop_id per trip (max stop_sequence)
    // Supabase doesn't support GROUP BY directly, so fetch all and reduce
    const { data: lastStopTimes } = await supabase
      .from('stop_times')
      .select('trip_id, stop_id, stop_sequence')
      .in('trip_id', emptyHeadsignTripIds)
      .order('stop_sequence', { ascending: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastStopIdMap = new Map<string, string>()
    for (const row of lastStopTimes ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any
      if (!lastStopIdMap.has(r.trip_id)) lastStopIdMap.set(r.trip_id, r.stop_id)
    }

    const lastStopIds = [...new Set(lastStopIdMap.values())]
    if (lastStopIds.length > 0) {
      const { data: lastStops } = await supabase
        .from('stops')
        .select('stop_id, stop_name')
        .in('stop_id', lastStopIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stopNameMap = new Map((lastStops ?? []).map((s: any) => [s.stop_id, s.stop_name]))
      for (const [tripId, stopId] of lastStopIdMap.entries()) {
        const name = stopNameMap.get(stopId)
        if (name) headsignMap.set(tripId, name)
      }
    }
  }

  const nowUnix = Math.floor(Date.now() / 1000)
  const arrivals: StopArrival[] = []

  for (const cand of candidates) {
    const arrivalTimeStr = scheduledMap.get(cand.tripId)
    if (!arrivalTimeStr || !cand.startDate) continue

    const scheduledUnix = gtfsTimeToUnix(arrivalTimeStr, cand.startDate)
    const predictedUnix = scheduledUnix + cand.delaySeconds

    // Skip already-passed arrivals
    if (predictedUnix < nowUnix - 60) continue

    arrivals.push({
      tripId: cand.tripId,
      routeId: cand.routeId,
      routeShortName: routeNameMap.get(cand.routeId) ?? cand.routeId,
      headsign: headsignMap.get(cand.tripId) ?? '',
      scheduledArrivalUnix: scheduledUnix,
      predictedArrivalUnix: predictedUnix,
      delaySeconds: cand.delaySeconds,
      stopSequence: cand.stopSequence,
    })
  }

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

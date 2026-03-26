import { Hono } from 'hono'
import { getTripUpdates } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import type { StopArrival, ApiResponse, GtfsStop, StopRoute, StopWithHeadsigns } from '@buswave/shared'

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
  // Trips with RT data but no direct stopTimeUpdate for this stop — we'll estimate their arrival
  type EstimatedTripInfo = {
    tripId: string
    routeId: string
    startDate: string
    bestDelay: number
    minRTSequence: number  // minimum stop_sequence in RT updates (bus is at/near this)
  }

  const candidates: Candidate[] = []
  const estimatedInfos: EstimatedTripInfo[] = []

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

    if (stu) {
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
    } else if (stopTimeUpdates.length > 0) {
      // No direct match — bus may not have reached this stop yet.
      // Estimate arrival using the trip's current delay + scheduled time from GTFS static.
      const sequences = stopTimeUpdates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => s.stopSequence as number)
        .filter((n) => n > 0)
      const minRTSequence = sequences.length > 0 ? Math.min(...sequences) : 0

      // Use delay from the last (highest-sequence) stopTimeUpdate as best estimate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastSTU = stopTimeUpdates.reduce((best: any, s: any) =>
        (s.stopSequence ?? 0) > (best.stopSequence ?? 0) ? s : best,
        stopTimeUpdates[0]
      )
      const rawDelay = lastSTU.arrival?.delay ?? lastSTU.departure?.delay ?? 0
      const bestDelay = Math.abs(rawDelay) <= 60 ? 0 : rawDelay

      estimatedInfos.push({
        tripId: tu.trip?.tripId ?? '',
        routeId: tu.trip?.routeId ?? '',
        startDate: tu.trip?.startDate ?? '',
        bestDelay,
        minRTSequence,
      })
    }
  }

  // For estimated trips: check if they serve this stop AND bus hasn't passed it yet
  if (estimatedInfos.length > 0) {
    const estTripIds = [...new Set(estimatedInfos.map((e) => e.tripId))]
    const { data: estStopTimes } = await supabase
      .from('stop_times')
      .select('trip_id, stop_sequence')
      .in('trip_id', estTripIds)
      .eq('stop_id', stopId)

    for (const st of estStopTimes ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = st as any
      const info = estimatedInfos.find((e) => e.tripId === r.trip_id)
      if (!info) continue
      // Skip if bus has already passed this stop (RT sequence > target sequence)
      if (info.minRTSequence > 0 && r.stop_sequence < info.minRTSequence) continue
      candidates.push({
        tripId: info.tripId,
        routeId: info.routeId,
        startDate: info.startDate,
        stopSequence: r.stop_sequence,
        delaySeconds: info.bestDelay,
      })
    }
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

/** GET /api/realtime/stops/nearby?lat=X&lon=Y&limit=N — nearest stops by distance */
stopsRouter.get('/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') ?? '')
  const lon = parseFloat(c.req.query('lon') ?? '')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '10', 10), 30)

  if (isNaN(lat) || isNaN(lon)) {
    return c.json({ data: [] } satisfies ApiResponse<GtfsStop[]>)
  }

  // Approximate distance using Euclidean on lat/lon (good enough for nearby stops in Belgium)
  // 1 degree lat ≈ 111km, 1 degree lon ≈ 67km at 50°N
  const { data, error } = await supabase
    .rpc('nearby_stops', { user_lat: lat, user_lon: lon, max_results: limit })

  if (error) {
    // Fallback: simple query sorted by rough distance
    const { data: fallback } = await supabase
      .from('stops')
      .select('stop_id, stop_name, stop_lat, stop_lon, stop_code')
      .not('stop_lat', 'is', null)
      .not('stop_lon', 'is', null)
      .limit(200)

    if (!fallback) return c.json({ data: [] } satisfies ApiResponse<GtfsStop[]>)

    const sorted = fallback
      .map((s) => ({
        ...s,
        dist: Math.pow((s.stop_lat - lat) * 111, 2) + Math.pow((s.stop_lon - lon) * 67, 2),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)

    return c.json({ data: sorted as GtfsStop[] } satisfies ApiResponse<GtfsStop[]>)
  }

  return c.json({ data: (data ?? []) as GtfsStop[] } satisfies ApiResponse<GtfsStop[]>)
})

/** GET /api/realtime/stops/search?q=XXX — search stops by name, enriched with direction headsigns */
stopsRouter.get('/search', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q || q.length < 2) {
    return c.json({ data: [] } satisfies ApiResponse<StopWithHeadsigns[]>)
  }

  const { data, error } = await supabase
    .from('stops')
    .select('stop_id, stop_name, stop_lat, stop_lon, stop_code')
    .ilike('stop_name', `%${q}%`)
    .limit(30)

  if (error || !data || data.length === 0) {
    return c.json({ data: [] } satisfies ApiResponse<StopWithHeadsigns[]>)
  }

  // Batch-fetch distinct destination names per stop.
  // TEC GTFS has mostly empty trip_headsign, so we use the last stop name
  // of each trip (same fallback pattern as the arrivals endpoint).
  const stopIds = data.map((s) => s.stop_id)

  // Step 1: Get a sample of trip_ids per stop (query each stop individually to
  // guarantee coverage — batched IN queries starve less-popular stops)
  const tripsByStop = new Map<string, Set<string>>()
  const perStopResults = await Promise.all(
    stopIds.map((sid) =>
      supabase
        .from('stop_times')
        .select('trip_id')
        .eq('stop_id', sid)
        .limit(30)
        .then(({ data: rows }) => ({ sid, tripIds: (rows ?? []).map((r) => (r as { trip_id: string }).trip_id) }))
    )
  )
  for (const { sid, tripIds: tids } of perStopResults) {
    if (tids.length > 0) tripsByStop.set(sid, new Set(tids))
  }

  const allTripIds = [...new Set([...tripsByStop.values()].flatMap((s) => [...s]))]
  if (allTripIds.length === 0) {
    const enriched: StopWithHeadsigns[] = (data as GtfsStop[]).map((s) => ({ ...s, headsigns: [] }))
    return c.json({ data: enriched } satisfies ApiResponse<StopWithHeadsigns[]>)
  }

  // Step 2: For each trip, find the last stop (max stop_sequence) → terminal stop name
  // Batch trip IDs to avoid hitting Supabase default row limit (1000)
  const lastStopTimes: Array<{ trip_id: string; stop_id: string; stop_sequence: number }> = []
  const tripBatchSize = 50
  for (let i = 0; i < allTripIds.length; i += tripBatchSize) {
    const batch = allTripIds.slice(i, i + tripBatchSize)
    const { data: batchRows } = await supabase
      .from('stop_times')
      .select('trip_id, stop_id, stop_sequence')
      .in('trip_id', batch)
      .order('stop_sequence', { ascending: false })
      .limit(5000)
    if (batchRows) lastStopTimes.push(...(batchRows as Array<{ trip_id: string; stop_id: string; stop_sequence: number }>))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tripTerminalMap = new Map<string, string>() // tripId → last stop_id
  for (const row of lastStopTimes) {
    if (!tripTerminalMap.has(row.trip_id)) tripTerminalMap.set(row.trip_id, row.stop_id)
  }

  // Step 3: Fetch terminal stop names
  const terminalStopIds = [...new Set(tripTerminalMap.values())]
  const { data: terminalStops } = await supabase
    .from('stops')
    .select('stop_id, stop_name')
    .in('stop_id', terminalStopIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const termNameMap = new Map((terminalStops ?? []).map((s: any) => [s.stop_id, s.stop_name as string]))

  // Step 4: Build headsign map: stopId → unique terminal names (max 4)
  const hsMap = new Map<string, Set<string>>()
  for (const [sid, tripIds2] of tripsByStop.entries()) {
    const names = new Set<string>()
    for (const tid of tripIds2) {
      const termStopId = tripTerminalMap.get(tid)
      if (!termStopId) continue
      const name = termNameMap.get(termStopId)
      if (name) names.add(name)
    }
    if (names.size > 0) hsMap.set(sid, names)
  }

  const enriched: StopWithHeadsigns[] = (data as GtfsStop[]).map((s) => ({
    ...s,
    headsigns: [...(hsMap.get(s.stop_id) ?? [])].slice(0, 4),
  }))

  return c.json({ data: enriched } satisfies ApiResponse<StopWithHeadsigns[]>)
})

/** GET /api/realtime/stops/:stopId/routes — lines serving this stop */
stopsRouter.get('/:stopId/routes', async (c) => {
  const stopId = c.req.param('stopId')

  // Fetch a sample of trips serving this stop with nested route info
  const { data, error } = await supabase
    .from('stop_times')
    .select('trips!inner(route_id, direction_id, trip_headsign, routes!inner(route_short_name, route_long_name))')
    .eq('stop_id', stopId)
    .limit(300)

  if (error || !data) return c.json({ data: [] } satisfies ApiResponse<StopRoute[]>)

  // One entry per route_short_name — direction is not relevant here (favorites track stop+line, not direction)
  const seen = new Map<string, StopRoute>()
  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (row as any).trips
    if (!t) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (t as any).routes
    if (!r) continue
    const shortName = r.route_short_name ?? t.route_id
    if (!seen.has(shortName)) {
      seen.set(shortName, {
        route_id: t.route_id,
        route_short_name: shortName,
        route_long_name: r.route_long_name ?? '',
        direction_id: t.direction_id ?? 0,
        headsign: t.trip_headsign ?? '',
      })
    }
  }

  const routes = [...seen.values()].sort((a, b) =>
    a.route_short_name.localeCompare(b.route_short_name, undefined, { numeric: true })
  )

  return c.json({ data: routes } satisfies ApiResponse<StopRoute[]>)
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

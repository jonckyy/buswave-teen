/**
 * Extracted arrival computation — reused by HTTP handler and notification scheduler.
 */
import { getTripUpdates } from './gtfs-rt.js'
import { supabase } from './supabase.js'
import type { StopArrival } from '@buswave/shared'

function brusselsOffsetSec(dateStr: string): number {
  const year = parseInt(dateStr.slice(0, 4))
  const month = parseInt(dateStr.slice(4, 6)) - 1
  const day = parseInt(dateStr.slice(6, 8))
  const noon = new Date(Date.UTC(year, month, day, 12))
  const utcStr = noon.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = noon.toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
  return (new Date(localStr).getTime() - new Date(utcStr).getTime()) / 1000
}

function gtfsTimeToUnix(timeStr: string, dateStr: string): number {
  const [h, m, s] = timeStr.split(':').map(Number)
  const year = parseInt(dateStr.slice(0, 4))
  const month = parseInt(dateStr.slice(4, 6)) - 1
  const day = parseInt(dateStr.slice(6, 8))
  const base = Date.UTC(year, month, day) / 1000
  return base + h! * 3600 + m! * 60 + (s ?? 0) - brusselsOffsetSec(dateStr)
}

export async function getArrivalsForStop(stopId: string, routeId?: string): Promise<StopArrival[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feed: any = await getTripUpdates()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  type Candidate = {
    tripId: string
    routeId: string
    startDate: string
    stopSequence: number
    delaySeconds: number
  }
  type EstimatedTripInfo = {
    tripId: string
    routeId: string
    startDate: string
    bestDelay: number
    minRTSequence: number
  }

  const candidates: Candidate[] = []
  const estimatedInfos: EstimatedTripInfo[] = []

  for (const entity of entities) {
    const tu = entity.tripUpdate
    if (!tu) continue
    if (tu.trip?.scheduleRelationship === 3) continue
    if (routeId && tu.trip?.routeId !== routeId) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stopTimeUpdates: any[] = tu.stopTimeUpdate ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stu = stopTimeUpdates.find((s: any) => s.stopId === stopId)

    if (stu) {
      const rawDelay = stu.arrival?.delay ?? stu.departure?.delay ?? 0
      const delaySeconds = Math.abs(rawDelay) <= 60 ? 0 : rawDelay
      candidates.push({
        tripId: tu.trip?.tripId ?? '',
        routeId: tu.trip?.routeId ?? '',
        startDate: tu.trip?.startDate ?? '',
        stopSequence: stu.stopSequence ?? 0,
        delaySeconds,
      })
    } else if (stopTimeUpdates.length > 0) {
      const sequences = stopTimeUpdates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => s.stopSequence as number)
        .filter((n) => n > 0)
      const minRTSequence = sequences.length > 0 ? Math.min(...sequences) : 0

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

  if (candidates.length === 0) return []

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduledMap = new Map<string, string>()
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

  const emptyHeadsignTripIds = tripIds.filter((id) => !headsignMap.get(id))
  if (emptyHeadsignTripIds.length > 0) {
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
      for (const [tripId, sId] of lastStopIdMap.entries()) {
        const name = stopNameMap.get(sId)
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
  return arrivals
}

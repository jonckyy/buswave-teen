/**
 * Background recorder: saves vehicle positions every 10s for selected bus lines.
 * Data is stored in `vehicle_positions_log` and purged after 7 days.
 */

import { supabase } from './supabase.js'
import { getVehiclePositions, getTripUpdates } from './gtfs-rt.js'

// Lines to record (route_short_name values)
const TARGET_LINES = new Set([
  '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
  '50', '366',
])

const RECORD_INTERVAL = 10_000   // 10 seconds
const CLEANUP_INTERVAL = 3_600_000 // 1 hour
const RETENTION_DAYS = 7

// Cache: route_id → route_short_name
let routeMap: Map<string, string> | null = null
// Cache: trip_id → direction_id (loaded on-demand in batches)
const directionCache = new Map<string, number>()

async function loadRouteMap(): Promise<Map<string, string>> {
  if (routeMap) return routeMap

  const { data } = await supabase
    .from('routes')
    .select('route_id, route_short_name')

  routeMap = new Map()
  for (const row of data ?? []) {
    const r = row as { route_id: string; route_short_name: string }
    routeMap.set(r.route_id, r.route_short_name)
  }
  console.log(`[recorder] Loaded ${routeMap.size} routes`)

  // Refresh every 24h
  setTimeout(() => { routeMap = null }, 86_400_000)

  return routeMap
}

/** Batch-fetch direction_id for trip IDs not yet in cache */
async function resolveDirections(tripIds: string[]): Promise<void> {
  const missing = tripIds.filter((id) => id && !directionCache.has(id))
  if (missing.length === 0) return

  // Supabase .in() supports up to ~300 items safely
  for (let i = 0; i < missing.length; i += 200) {
    const batch = missing.slice(i, i + 200)
    const { data } = await supabase
      .from('trips')
      .select('trip_id, direction_id')
      .in('trip_id', batch)

    for (const row of data ?? []) {
      const r = row as { trip_id: string; direction_id: number }
      directionCache.set(r.trip_id, r.direction_id)
    }
  }
}

async function recordTick() {
  try {
    const [vehicleFeed, tripFeed, routes] = await Promise.all([
      getVehiclePositions(),
      getTripUpdates(),
      loadRouteMap(),
    ])

    // Build delay map from trip updates: tripId → delay in seconds
    const delayMap = new Map<string, number>()
    for (const entity of tripFeed.entity ?? []) {
      const tu = entity.tripUpdate
      if (!tu?.trip?.tripId || !tu.stopTimeUpdate?.length) continue
      // Use the last stop time update's arrival delay as the current delay
      const lastUpdate = tu.stopTimeUpdate[tu.stopTimeUpdate.length - 1]
      const delay = lastUpdate?.arrival?.delay ?? lastUpdate?.departure?.delay ?? 0
      // TEC dead band: |delay| <= 60 → treat as 0
      delayMap.set(tu.trip.tripId, Math.abs(delay) <= 60 ? 0 : delay)
    }

    // Filter vehicles to target lines, collect trip IDs for direction lookup
    const filtered: Array<{ entity: any; routeShort: string }> = []
    for (const entity of vehicleFeed.entity ?? []) {
      const v = entity.vehicle
      if (!v?.position || !v.trip?.routeId) continue
      const routeShort = routes.get(v.trip.routeId)
      if (!routeShort || !TARGET_LINES.has(routeShort)) continue
      filtered.push({ entity, routeShort })
    }

    // Batch-resolve directions for all trip IDs in this tick
    const tripIds = filtered.map((f) => f.entity.vehicle.trip?.tripId).filter(Boolean) as string[]
    await resolveDirections(tripIds)

    const rows: Array<Record<string, unknown>> = []
    for (const { entity, routeShort } of filtered) {
      const v = entity.vehicle

      const tripId = v.trip.tripId ?? ''
      rows.push({
        vehicle_id: String(v.vehicle?.id ?? entity.id),
        route_id: v.trip.routeId,
        route_short: routeShort,
        trip_id: tripId,
        lat: v.position.latitude,
        lon: v.position.longitude,
        bearing: v.position.bearing != null ? Math.round(v.position.bearing) : null,
        speed: v.position.speed != null ? Math.round(v.position.speed) : null,
        delay_seconds: delayMap.get(tripId) ?? null,
        stop_id: v.stopId ?? null,
        stop_sequence: v.currentStopSequence ?? null,
        vehicle_timestamp: v.timestamp != null ? Number(v.timestamp) : null,
        direction_id: directionCache.get(tripId) ?? null,
        schedule_relationship: v.trip.scheduleRelationship ?? null,
        congestion_level: v.congestionLevel ?? null,
        occupancy_status: v.occupancyStatus ?? null,
      })
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from('vehicle_positions_log')
        .insert(rows)

      if (error) {
        console.error('[recorder] Insert error:', error.message)
      }
    }
  } catch (err) {
    console.error('[recorder] Tick error:', err instanceof Error ? err.message : err)
  }
}

async function cleanup() {
  try {
    const { error, count } = await supabase
      .from('vehicle_positions_log')
      .delete({ count: 'exact' })
      .lt('recorded_at', new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString())

    if (error) {
      console.error('[recorder] Cleanup error:', error.message)
    } else if (count && count > 0) {
      console.log(`[recorder] Purged ${count} records older than ${RETENTION_DAYS} days`)
    }
  } catch (err) {
    console.error('[recorder] Cleanup error:', err instanceof Error ? err.message : err)
  }
}

export function startPositionRecorder() {
  console.log(`[recorder] Starting — recording lines: ${[...TARGET_LINES].join(', ')} every ${RECORD_INTERVAL / 1000}s`)
  setInterval(recordTick, RECORD_INTERVAL)
  setInterval(cleanup, CLEANUP_INTERVAL)
  // Run first tick after a short delay (let the API warm up)
  setTimeout(recordTick, 5_000)
}

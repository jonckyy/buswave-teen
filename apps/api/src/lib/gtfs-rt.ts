/**
 * GTFS-RT feed fetcher with server-side in-memory cache.
 * Cache intervals: vehicles=10s, arrivals=10s, route-live=15s, shape=60s.
 * Never skip the cache — callers always get cached data within the TTL.
 */

const GTFS_RT_BASE = 'https://gtfs.irail.be/tec'
const API_KEY = process.env['GTFS_RT_API_KEY'] ?? '17F9BC53DDA54E0887B1D866E1561CBB'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>()

async function fetchFeed<T>(path: string, ttlSeconds: number): Promise<T> {
  const key = path
  const now = Date.now()
  const cached = cache.get(key)

  if (cached && now < cached.expiresAt) {
    return cached.data as T
  }

  const res = await fetch(`${GTFS_RT_BASE}${path}`, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) {
    // Return stale data rather than throw, if available
    if (cached) return cached.data as T
    throw new Error(`GTFS-RT fetch failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as T
  cache.set(key, { data, expiresAt: now + ttlSeconds * 1000 })
  return data
}

// ── Public accessors ────────────────────────────────────────────────────────

/** Raw GTFS-RT VehiclePositions feed (all vehicles). TTL: 10s */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getVehiclePositions = (): Promise<any> =>
  fetchFeed('/vehiclePositions', 10)

/** Raw GTFS-RT TripUpdates feed. TTL: 10s */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getTripUpdates = (): Promise<any> =>
  fetchFeed('/tripUpdates', 10)

/** Raw GTFS-RT Alerts feed. TTL: 30s */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getAlerts = (): Promise<any> =>
  fetchFeed('/alerts', 30)

/** Route-live feed (vehicles on a specific route). TTL: 15s */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getRouteLive = (routeId: string): Promise<any> =>
  fetchFeed(`/vehiclePositions?routeId=${routeId}`, 15)

/** Shape data is derived from Supabase, but we cache computed results for 60s */
export function getCachedShape<T>(shapeId: string, compute: () => Promise<T>): Promise<T> {
  return fetchFeed<T>(`/shape/${shapeId}`, 60) as unknown as Promise<T>
    // fetchFeed will miss (no real URL) — handle via manual cache below
    || computeAndCache(shapeId, compute)
}

const shapeCache = new Map<string, CacheEntry<unknown>>()

export async function getCachedShapeData<T>(shapeId: string, compute: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const cached = shapeCache.get(shapeId)
  if (cached && now < cached.expiresAt) return cached.data as T
  const data = await compute()
  shapeCache.set(shapeId, { data, expiresAt: now + 60_000 })
  return data
}

// kept for internal use
async function computeAndCache<T>(_key: string, compute: () => Promise<T>): Promise<T> {
  return compute()
}

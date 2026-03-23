/**
 * GTFS-RT feed fetcher with server-side in-memory cache.
 * Cache intervals: vehicles=10s, tripUpdates=10s, alerts=30s, shape=60s.
 * Never skip the cache — callers always get cached data within the TTL.
 *
 * TEC GTFS-RT: https://gtfsrt.tectime.be/proto/RealTime
 * Auth: ?key=<API_KEY> query param
 * Format: protobuf
 */

// gtfs-realtime-bindings is CJS: module.exports = $root (protobufjs root)
// In Bun/Node ESM, default import gives module.exports directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GtfsRT = require('gtfs-realtime-bindings') as { transit_realtime: { FeedMessage: { decode: (buf: Uint8Array) => unknown; toObject: (msg: unknown, opts: object) => { entity?: unknown[] } } } }
const { FeedMessage } = GtfsRT.transit_realtime

const GTFS_RT_BASE = 'https://gtfsrt.tectime.be/proto/RealTime'
const API_KEY = process.env['GTFS_RT_API_KEY'] ?? '17F9BC53DDA54E0887B1D866E1561CBB'

interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFeed(path: string, ttlSeconds: number): Promise<any> {
  const now = Date.now()
  const cached = cache.get(path)
  if (cached && now < cached.expiresAt) return cached.data

  const res = await fetch(`${GTFS_RT_BASE}${path}?key=${API_KEY}`)
  if (!res.ok) {
    if (cached) return cached.data
    throw new Error(`GTFS-RT fetch failed: ${res.status} ${res.statusText}`)
  }

  const buffer = await res.arrayBuffer()
  const msg = FeedMessage.decode(new Uint8Array(buffer))
  const data = FeedMessage.toObject(msg, { longs: Number, defaults: false })
  cache.set(path, { data, expiresAt: now + ttlSeconds * 1000 })
  return data
}

// ── Public accessors ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getVehiclePositions = (): Promise<any> => fetchFeed('/vehicles', 10)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getTripUpdates = (): Promise<any> => fetchFeed('/trips', 10)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getAlerts = (): Promise<any> => fetchFeed('/Alerts', 30)

// ── Shape cache (Supabase-derived, not GTFS-RT) ──────────────────────────────

interface ShapeCacheEntry<T> { data: T; expiresAt: number }
const shapeCache = new Map<string, ShapeCacheEntry<unknown>>()

export async function getCachedShapeData<T>(shapeId: string, compute: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const cached = shapeCache.get(shapeId)
  if (cached && now < cached.expiresAt) return cached.data as T
  const data = await compute()
  shapeCache.set(shapeId, { data, expiresAt: now + 60_000 })
  return data
}

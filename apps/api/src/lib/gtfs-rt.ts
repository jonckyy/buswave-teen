/**
 * GTFS-RT feed fetcher with server-side in-memory cache.
 * Cache intervals: vehicles=10s, tripUpdates=10s, alerts=30s, shape=60s.
 * Never skip the cache — callers always get cached data within the TTL.
 *
 * TEC GTFS-RT: https://gtfsrt.tectime.be/proto/RealTime
 * Auth: ?key=<API_KEY> query param
 * Format: protobuf (gtfs-realtime-bindings)
 */

import { transit_realtime } from 'gtfs-realtime-bindings'

const GTFS_RT_BASE = 'https://gtfsrt.tectime.be/proto/RealTime'
const API_KEY = process.env['GTFS_RT_API_KEY'] ?? '17F9BC53DDA54E0887B1D866E1561CBB'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>()

async function fetchFeed(path: string, ttlSeconds: number): Promise<transit_realtime.FeedMessage> {
  const key = path
  const now = Date.now()
  const cached = cache.get(key)

  if (cached && now < cached.expiresAt) {
    return cached.data as transit_realtime.FeedMessage
  }

  const res = await fetch(`${GTFS_RT_BASE}${path}?key=${API_KEY}`)

  if (!res.ok) {
    if (cached) return cached.data as transit_realtime.FeedMessage
    throw new Error(`GTFS-RT fetch failed: ${res.status} ${res.statusText}`)
  }

  const buffer = await res.arrayBuffer()
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer))
  cache.set(key, { data: feed, expiresAt: now + ttlSeconds * 1000 })
  return feed
}

// ── Public accessors ────────────────────────────────────────────────────────

/** All vehicle positions. TTL: 10s */
export const getVehiclePositions = (): Promise<transit_realtime.FeedMessage> =>
  fetchFeed('/vehicles', 10)

/** Trip updates. TTL: 10s */
export const getTripUpdates = (): Promise<transit_realtime.FeedMessage> =>
  fetchFeed('/trips', 10)

/** Service alerts. TTL: 30s */
export const getAlerts = (): Promise<transit_realtime.FeedMessage> =>
  fetchFeed('/Alerts', 30)

// ── Shape cache (Supabase-derived, not GTFS-RT) ──────────────────────────────

const shapeCache = new Map<string, CacheEntry<unknown>>()

export async function getCachedShapeData<T>(shapeId: string, compute: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const cached = shapeCache.get(shapeId)
  if (cached && now < cached.expiresAt) return cached.data as T
  const data = await compute()
  shapeCache.set(shapeId, { data, expiresAt: now + 60_000 })
  return data
}

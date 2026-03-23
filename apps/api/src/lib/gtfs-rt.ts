/**
 * GTFS-RT feed fetcher with server-side in-memory cache.
 * Cache intervals: vehicles=10s, tripUpdates=10s, alerts=30s, shape=60s.
 * Never skip the cache — callers always get cached data within the TTL.
 *
 * TEC GTFS-RT: https://gtfsrt.tectime.be/proto/RealTime
 * Auth: ?key=<API_KEY> query param
 * Format: protobuf — parsed via protobufjs inline root
 */

import protobuf from 'protobufjs'

// Minimal GTFS-RT proto definition (only fields we use)
const root = protobuf.parse(`
  syntax = "proto2";
  package transit_realtime;

  message FeedMessage {
    required FeedHeader header = 1;
    repeated FeedEntity entity = 2;
  }
  message FeedHeader {
    required string gtfs_realtime_version = 1;
    optional uint64 timestamp = 2;
  }
  message FeedEntity {
    required string id = 1;
    optional bool is_deleted = 2;
    optional VehiclePosition vehicle = 3;
    optional Alert alert = 5;
  }
  message VehiclePosition {
    optional TripDescriptor trip = 1;
    optional VehicleDescriptor vehicle = 2;
    optional Position position = 3;
    optional uint32 current_stop_sequence = 4;
    optional string stop_id = 5;
    optional uint64 timestamp = 7;
  }
  message TripDescriptor {
    optional string trip_id = 1;
    optional string route_id = 5;
  }
  message VehicleDescriptor {
    optional string id = 1;
    optional string label = 2;
  }
  message Position {
    required float latitude = 1;
    required float longitude = 2;
    optional float bearing = 3;
    optional float speed = 5;
  }
  message Alert {
    repeated TimeRange active_period = 1;
    repeated EntitySelector informed_entity = 5;
    optional TranslatedString header_text = 10;
    optional TranslatedString description_text = 11;
  }
  message TimeRange {
    optional uint64 start = 1;
    optional uint64 end = 2;
  }
  message EntitySelector {
    optional string route_id = 2;
    optional string stop_id = 4;
  }
  message TranslatedString {
    repeated Translation translation = 1;
    message Translation {
      required string text = 1;
      optional string language = 2;
    }
  }
`).root

const FeedMessage = root.lookupType('transit_realtime.FeedMessage')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GtfsFeed = any

const GTFS_RT_BASE = 'https://gtfsrt.tectime.be/proto/RealTime'
const API_KEY = process.env['GTFS_RT_API_KEY'] ?? '17F9BC53DDA54E0887B1D866E1561CBB'

interface CacheEntry {
  data: GtfsFeed
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

async function fetchFeed(path: string, ttlSeconds: number): Promise<GtfsFeed> {
  const now = Date.now()
  const cached = cache.get(path)
  if (cached && now < cached.expiresAt) return cached.data

  const res = await fetch(`${GTFS_RT_BASE}${path}?key=${API_KEY}`)
  if (!res.ok) {
    if (cached) return cached.data
    throw new Error(`GTFS-RT fetch failed: ${res.status} ${res.statusText}`)
  }

  const buffer = await res.arrayBuffer()
  const feed = FeedMessage.decode(new Uint8Array(buffer))
  const data = FeedMessage.toObject(feed, { longs: Number, defaults: false })
  cache.set(path, { data, expiresAt: now + ttlSeconds * 1000 })
  return data
}

// ── Public accessors ────────────────────────────────────────────────────────

/** All vehicle positions. TTL: 10s */
export const getVehiclePositions = (): Promise<GtfsFeed> => fetchFeed('/vehicles', 10)

/** Trip updates. TTL: 10s */
export const getTripUpdates = (): Promise<GtfsFeed> => fetchFeed('/trips', 10)

/** Service alerts. TTL: 30s */
export const getAlerts = (): Promise<GtfsFeed> => fetchFeed('/Alerts', 30)

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

// ── Push notification types ──────────────────────────────────────────────────

export type NotificationTrigger =
  | 'time'
  | 'distance'
  | 'offroute'
  | 'cancellation'
  | 'lost'
  | 'rematched'
  | 'stale'

/** A subscription to a SPECIFIC scheduled trip (not just any bus on the route). */
export interface TripSubscription {
  id: string
  favoriteId: string
  userId: string
  /** Current GTFS trip_id (may change after rematch) */
  tripId: string
  /** Audit trail of previous trip_ids if the system rematched this subscription */
  previousTripIds: string[]
  /** Semantic attributes for rematching after GTFS reimport */
  routeShortName: string
  directionId: 0 | 1
  headsign: string
  /** GTFS HH:MM:SS local Brussels time at the favorite stop (may exceed 24h) */
  arrivalTime: string
  /** Boolean array [Mon, Tue, Wed, Thu, Fri, Sat, Sun] */
  serviceDays: boolean[]
  /** True if no current trip matches the semantic attributes — user must reconfigure */
  isStale: boolean
  staleReason: 'no_match' | 'multiple_matches' | 'time_drift' | null
  lastRematchedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TripSubscriptionInsert {
  tripId: string
  routeShortName: string
  directionId: 0 | 1
  headsign: string
  arrivalTime: string
  serviceDays: boolean[]
}

export interface NotificationSettings {
  id: string
  favoriteId: string
  userId: string
  timeEnabled: boolean
  timeMinutes: number[]
  distanceEnabled: boolean
  distanceMeters: number
  offrouteEnabled: boolean
  offrouteMeters: number
}

export interface NotificationSettingsUpsert {
  timeEnabled?: boolean
  timeMinutes?: number[]
  distanceEnabled?: boolean
  distanceMeters?: number
  offrouteEnabled?: boolean
  offrouteMeters?: number
}

export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
  userAgent?: string
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag: string
  data: {
    trigger: NotificationTrigger
    stopId: string
    routeId: string | null
    tripId: string
    url: string
  }
}

/** Max favorites with push per role */
export const PUSH_LIMITS: Record<string, number> = {
  admin: 20,
  editor: 20,
  user: 3,
}

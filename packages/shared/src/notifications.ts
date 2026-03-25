// ── Push notification types ──────────────────────────────────────────────────

export type NotificationTrigger = 'time' | 'distance' | 'offroute'

export interface NotificationSettings {
  id: string
  favoriteId: string
  userId: string
  timeEnabled: boolean
  timeMinutes: number
  distanceEnabled: boolean
  distanceMeters: number
  offrouteEnabled: boolean
  offrouteMeters: number
}

export interface NotificationSettingsUpsert {
  timeEnabled?: boolean
  timeMinutes?: number
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

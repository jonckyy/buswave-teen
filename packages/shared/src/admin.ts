/** Role-based configuration and admin types */

export type UserRole = 'admin' | 'editor' | 'user'

/** Display labels for roles */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  editor: 'Medium',
  user: 'Standard',
}

/** Mirrors the `role_config` DB table (camelCase) */
export interface RoleConfig {
  role: UserRole
  maxFavorites: number
  maxPushFavorites: number
  maxPushNotifications: number
  showDebugPanel: boolean
  showTechnicalData: boolean
  showDistanceMetrics: boolean
  showDelayBadges: boolean
  showLivePage: boolean
  showAlertsPage: boolean
  arrivalsPerCard: number
  allowedTriggerTypes: string[]
  themeId: string
  updatedAt: string
}

/** Partial update payload for PUT /role-config/:role */
export type RoleConfigUpdate = Partial<Omit<RoleConfig, 'role' | 'updatedAt'>>

/** Theme definition stored in Supabase */
export interface Theme {
  id: string
  label: string
  tokens: Record<string, string>
  isBuiltin: boolean
  createdAt: string
  updatedAt: string
}

/** User row returned by GET /admin/users */
export interface AdminUserRow {
  id: string
  email: string
  role: UserRole
  createdAt: string
  favoritesCount: number
  pushSubscriptionsCount: number
  notificationsReceivedCount: number
}

/** Detailed user info for admin user drill-down */
export interface AdminUserDetail {
  id: string
  email: string
  role: UserRole
  createdAt: string
  quietStart: string
  quietEnd: string
  favorites: AdminUserFavorite[]
  pushSubscriptions: AdminPushSubscription[]
  recentNotifications: AdminNotificationLog[]
}

export interface AdminUserFavorite {
  id: string
  stopId: string
  stopName: string
  routeId: string | null
  routeShortName: string | null
  label: string | null
  createdAt: string
  notifications: {
    timeEnabled: boolean
    timeMinutes: number[]
    distanceEnabled: boolean
    distanceMeters: number
    offrouteEnabled: boolean
    offrouteMeters: number
  } | null
}

export interface AdminPushSubscription {
  id: string
  endpoint: string
  userAgent: string | null
  browser: string
  createdAt: string
  lastUsed: string | null
}

export interface AdminNotificationLog {
  id: string
  favoriteId: string
  triggerType: string
  tripId: string
  sentAt: string
  stopName: string | null
  routeShortName: string | null
}

/** Hardcoded fallback if DB is unreachable */
export const DEFAULT_ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  admin: {
    role: 'admin',
    maxFavorites: 999,
    maxPushFavorites: 20,
    maxPushNotifications: 999,
    showDebugPanel: true,
    showTechnicalData: true,
    showDistanceMetrics: true,
    showDelayBadges: true,
    showLivePage: true,
    showAlertsPage: true,
    arrivalsPerCard: 10,
    allowedTriggerTypes: ['time', 'distance', 'offroute'],
    themeId: 'midnight',
    updatedAt: '',
  },
  editor: {
    role: 'editor',
    maxFavorites: 100,
    maxPushFavorites: 20,
    maxPushNotifications: 100,
    showDebugPanel: false,
    showTechnicalData: true,
    showDistanceMetrics: true,
    showDelayBadges: true,
    showLivePage: true,
    showAlertsPage: true,
    arrivalsPerCard: 5,
    allowedTriggerTypes: ['time', 'distance', 'offroute'],
    themeId: 'midnight',
    updatedAt: '',
  },
  user: {
    role: 'user',
    maxFavorites: 20,
    maxPushFavorites: 3,
    maxPushNotifications: 50,
    showDebugPanel: false,
    showTechnicalData: false,
    showDistanceMetrics: false,
    showDelayBadges: true,
    showLivePage: false,
    showAlertsPage: true,
    arrivalsPerCard: 3,
    allowedTriggerTypes: ['time'],
    themeId: 'midnight',
    updatedAt: '',
  },
}

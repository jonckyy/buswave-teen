/**
 * API client — wraps all calls to the BusWave Hono backend.
 * All endpoints return { data: T }.
 */

import type {
  VehiclePosition,
  VehicleDetails,
  StopArrival,
  Alert,
  RouteWithLiveVehicles,
  RouteDirection,
  GtfsRoute,
  GtfsStop,
  StopRoute,
  NotificationSettings,
  NotificationSettingsUpsert,
  PushSubscriptionPayload,
  RoleConfig,
  RoleConfigUpdate,
  AdminUserRow,
} from '@buswave/shared'

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  const json = (await res.json()) as { data: T }
  return json.data
}

async function rawFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

/**
 * Authenticated fetch — routes through same-origin Next.js proxy to avoid
 * cross-origin blocks from Brave Shields / Safari ITP.
 * Path must start with /api/notifications/ (the proxy only handles that prefix).
 */
async function authFetch<T>(path: string, options: RequestInit & { token: string }): Promise<T> {
  const { token, ...init } = options
  // Same-origin proxy: /api/notifications/* → Railway /api/notifications/*
  const url = `${path}`
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const target = res.headers.get('x-proxy-target') ?? ''
    const detail = (body as { error?: string }).error ?? ''
    throw new Error(detail || `API ${res.status} [${target}] ${path}`)
  }
  const json = (await res.json()) as { data: T }
  return json.data
}

export const api = {
  health: () =>
    rawFetch<{ ok: boolean; commit: string }>('/health'),

  vehicleDetails: (routeId: string, tripId: string, stopId?: string) =>
    apiFetch<VehicleDetails>(
      `/api/realtime/vehicles/details?routeId=${encodeURIComponent(routeId)}&tripId=${encodeURIComponent(tripId)}${stopId ? `&stopId=${encodeURIComponent(stopId)}` : ''}`
    ),


  allVehicles: () =>
    apiFetch<VehiclePosition[]>('/api/realtime/vehicles'),

  vehicles: (routeId: string) =>
    apiFetch<VehiclePosition[]>(`/api/realtime/vehicles?routeId=${encodeURIComponent(routeId)}`),

  arrivals: (stopId: string, routeId?: string) =>
    apiFetch<StopArrival[]>(
      `/api/realtime/stops/${encodeURIComponent(stopId)}/arrivals${routeId ? `?routeId=${encodeURIComponent(routeId)}` : ''}`
    ),

  stopInfo: (stopId: string) =>
    apiFetch<GtfsStop>(`/api/realtime/stops/${encodeURIComponent(stopId)}/info`),

  routeLive: (routeId: string) =>
    apiFetch<RouteWithLiveVehicles>(`/api/realtime/routes/route-live?routeId=${encodeURIComponent(routeId)}`),

  routeShape: (routeId: string) =>
    apiFetch<Array<{ lat: number; lon: number }>>(
      `/api/realtime/routes/route-shape?routeId=${encodeURIComponent(routeId)}`
    ),

  searchRoutes: (q: string) =>
    apiFetch<GtfsRoute[]>(`/api/realtime/routes?q=${encodeURIComponent(q)}`),

  routeNames: (ids: string[]) =>
    apiFetch<GtfsRoute[]>(`/api/realtime/routes/names?ids=${ids.map(encodeURIComponent).join(',')}`),

  routeStops: (routeId: string) =>
    apiFetch<RouteDirection[]>(`/api/realtime/routes/route-stops?routeId=${encodeURIComponent(routeId)}`),

  searchStops: (q: string) =>
    apiFetch<GtfsStop[]>(`/api/realtime/stops/search?q=${encodeURIComponent(q)}`),

  stopRoutes: (stopId: string) =>
    apiFetch<StopRoute[]>(`/api/realtime/stops/${encodeURIComponent(stopId)}/routes`),

  alerts: () => apiFetch<Alert[]>('/api/realtime/alerts'),

  // ── Notifications ──────────────────────────────────────────────────────────
  getVapidKey: () => apiFetch<{ publicKey: string }>('/api/notifications/vapid-key'),

  subscribeToNotifications: (payload: PushSubscriptionPayload, token: string) =>
    authFetch<{ ok: true }>('/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    }),

  unsubscribeFromNotifications: (endpoint: string, token: string) =>
    authFetch<{ ok: true }>('/api/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
      token,
    }),

  getNotificationSettings: (favoriteId: string, token: string) =>
    authFetch<NotificationSettings | null>(`/api/notifications/settings/${encodeURIComponent(favoriteId)}`, {
      method: 'GET',
      token,
    }),

  updateNotificationSettings: (favoriteId: string, settings: NotificationSettingsUpsert, token: string) =>
    authFetch<{ ok: true }>(`/api/notifications/settings/${encodeURIComponent(favoriteId)}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
      token,
    }),

  getQuietHours: (token: string) =>
    authFetch<{ quietStart: string; quietEnd: string }>('/api/notifications/quiet-hours', {
      method: 'GET',
      token,
    }),

  updateQuietHours: (quietStart: string, quietEnd: string, token: string) =>
    authFetch<{ ok: true }>('/api/notifications/quiet-hours', {
      method: 'PUT',
      body: JSON.stringify({ quietStart, quietEnd }),
      token,
    }),

  // ── Admin ──────────────────────────────────────────────────────────────────
  getRoleConfig: () =>
    apiFetch<RoleConfig[]>('/api/admin/role-config'),

  getAdminUsers: (token: string) =>
    authFetch<AdminUserRow[]>('/api/admin/users', { method: 'GET', token }),

  updateRoleConfig: (role: string, update: RoleConfigUpdate, token: string) =>
    authFetch<{ ok: true }>(`/api/admin/role-config/${encodeURIComponent(role)}`, {
      method: 'PUT',
      body: JSON.stringify(update),
      token,
    }),

  updateUserRole: (userId: string, role: string, token: string) =>
    authFetch<{ ok: true }>(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
      token,
    }),
}

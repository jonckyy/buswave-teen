/**
 * API client — wraps all calls to the BusWave Hono backend.
 * All endpoints return { data: T }.
 */

import type {
  VehiclePosition,
  StopArrival,
  Alert,
  RouteWithLiveVehicles,
  RouteDirection,
  GtfsRoute,
  GtfsStop,
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

export const api = {
  health: () =>
    rawFetch<{ ok: boolean; commit: string }>('/health'),

  debugVehicles: () =>
    rawFetch<{ ok: boolean; entityCount: number }>('/debug/vehicles'),

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
    apiFetch<RouteWithLiveVehicles>(`/api/realtime/route-live?routeId=${encodeURIComponent(routeId)}`),

  routeShape: (routeId: string) =>
    apiFetch<Array<{ lat: number; lon: number }>>(
      `/api/realtime/route-shape?routeId=${encodeURIComponent(routeId)}`
    ),

  searchRoutes: (q: string) =>
    apiFetch<GtfsRoute[]>(`/api/realtime/routes?q=${encodeURIComponent(q)}`),

  routeStops: (routeId: string) =>
    apiFetch<RouteDirection[]>(`/api/realtime/route-stops?routeId=${encodeURIComponent(routeId)}`),

  alerts: () => apiFetch<Alert[]>('/api/realtime/alerts'),
}

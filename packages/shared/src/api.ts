// ── API response envelope ──────────────────────────────────────────────────

/** All API responses are wrapped in this envelope */
export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: string
  status: number
}

// ── Query param shapes ─────────────────────────────────────────────────────

export interface VehiclesQuery {
  routeId: string
}

export interface ArrivalsQuery {
  routeId?: string
}

export interface RoutesQuery {
  q: string
}

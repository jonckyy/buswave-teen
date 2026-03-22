// ── Favorites ──────────────────────────────────────────────────────────────

export interface Favorite {
  id: string
  userId: string | null // null = localStorage-only (unauthenticated)
  stopId: string
  routeId: string | null // null = favorite the stop itself, not a specific route
  label?: string // custom user label
  createdAt: string
}

export type FavoriteInsert = Omit<Favorite, 'id' | 'createdAt'>

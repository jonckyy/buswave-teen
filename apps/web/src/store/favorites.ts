'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Favorite, FavoriteInsert } from '@buswave/shared'

interface FavoritesState {
  // Primitives for selectors — never return objects directly
  favoriteIds: string[] // "stopId:routeId" composite keys
  favorites: Favorite[]
  // Actions
  addFavorite: (fav: FavoriteInsert, id?: string) => void
  removeFavorite: (stopId: string, routeId: string | null) => void
  isFavorite: (stopId: string, routeId: string | null) => boolean
  setFavorites: (favs: Favorite[]) => void
  clearFavorites: () => void
}

function compositeKey(stopId: string, routeId: string | null) {
  return `${stopId}:${routeId ?? ''}`
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],
      favorites: [],

      addFavorite(fav, providedId?) {
        const id = providedId ?? crypto.randomUUID()
        const newFav: Favorite = {
          ...fav,
          id,
          userId: null, // set by Supabase sync layer when authed
          createdAt: new Date().toISOString(),
        }
        const key = compositeKey(fav.stopId, fav.routeId ?? null)
        set((s) => ({
          favorites: [...s.favorites, newFav],
          favoriteIds: [...s.favoriteIds, key],
        }))
      },

      removeFavorite(stopId, routeId) {
        const key = compositeKey(stopId, routeId)
        set((s) => ({
          favorites: s.favorites.filter(
            (f) => compositeKey(f.stopId, f.routeId ?? null) !== key
          ),
          favoriteIds: s.favoriteIds.filter((k) => k !== key),
        }))
      },

      isFavorite(stopId, routeId) {
        return get().favoriteIds.includes(compositeKey(stopId, routeId))
      },

      setFavorites(favs) {
        set({
          favorites: favs,
          favoriteIds: favs.map((f) => compositeKey(f.stopId, f.routeId ?? null)),
        })
      },

      clearFavorites() {
        set({ favorites: [], favoriteIds: [] })
      },
    }),
    {
      name: 'buswave-favorites',
      // Only persist primitives — no functions
      partialize: (s) => ({ favoriteIds: s.favoriteIds, favorites: s.favorites }),
    }
  )
)

// ── Primitive selectors (never select objects in components) ────────────────
export const selectFavoriteIds = (s: FavoritesState) => s.favoriteIds
export const selectFavorites = (s: FavoritesState) => s.favorites

'use client'

import { useMemo } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { useFavoritesStore } from '@/store/favorites'
import type { FavoriteInsert } from '@buswave/shared'

/**
 * Wraps the favorites store add/remove with Supabase DB sync for logged-in users.
 * Use this hook everywhere instead of accessing the store directly for mutations.
 */
export function useFavoritesActions() {
  const { user } = useUser()
  const addToStore = useFavoritesStore((s) => s.addFavorite)
  const removeFromStore = useFavoritesStore((s) => s.removeFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)
  const supabase = useMemo(() => createSupabaseClient(), [])

  async function addFavorite(fav: FavoriteInsert) {
    addToStore(fav)
    if (user) {
      await supabase.from('favorites').insert({
        user_id: user.id,
        stop_id: fav.stopId,
        route_id: fav.routeId ?? null,
        label: fav.label ?? null,
      })
    }
  }

  async function removeFavorite(stopId: string, routeId: string | null) {
    removeFromStore(stopId, routeId)
    if (user) {
      let query = supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('stop_id', stopId)
      if (routeId !== null) {
        query = query.eq('route_id', routeId)
      } else {
        query = query.is('route_id', null)
      }
      await query
    }
  }

  return { addFavorite, removeFavorite, isFavorite }
}

'use client'

import { useMemo } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useFavoritesStore } from '@/store/favorites'
import type { FavoriteInsert } from '@buswave/shared'

/**
 * Wraps the favorites store add/remove with Supabase DB sync for logged-in users.
 * Uses supabase.auth.getUser() directly at call-time to avoid React state timing issues.
 */
export function useFavoritesActions() {
  const addToStore = useFavoritesStore((s) => s.addFavorite)
  const removeFromStore = useFavoritesStore((s) => s.removeFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)
  const supabase = useMemo(() => createSupabaseClient(), [])

  async function addFavorite(fav: FavoriteInsert) {
    addToStore(fav)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('favorites').insert({
        user_id: user.id,
        stop_id: fav.stopId,
        route_id: fav.routeId ?? null,
        label: fav.label ?? null,
      })
      if (error) console.error('[favorites] insert error:', error.message)
    }
  }

  async function removeFavorite(stopId: string, routeId: string | null) {
    removeFromStore(stopId, routeId)
    const { data: { user } } = await supabase.auth.getUser()
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
      const { error } = await query
      if (error) console.error('[favorites] delete error:', error.message)
    }
  }

  return { addFavorite, removeFavorite, isFavorite }
}

'use client'

import { useMemo } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useFavoritesStore } from '@/store/favorites'
import { api } from '@/lib/api'
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
    // Generate UUID here so store and Supabase share the same ID
    const id = crypto.randomUUID()
    addToStore(fav, id)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('favorites').insert({
        id,
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

      // If no favorites left, unsubscribe from push notifications
      const remaining = useFavoritesStore.getState().favorites
      if (remaining.length === 0) {
        try {
          const reg = await navigator.serviceWorker?.getRegistration()
          const sub = await reg?.pushManager?.getSubscription()
          if (sub) {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              await api.unsubscribeFromNotifications(sub.endpoint, session.access_token).catch(() => {})
            }
            await sub.unsubscribe()
          }
        } catch { /* push cleanup is best-effort */ }
      }
    }
  }

  return { addFavorite, removeFavorite, isFavorite }
}

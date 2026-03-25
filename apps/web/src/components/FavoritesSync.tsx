'use client'

import { useEffect, useMemo, useRef, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useFavoritesStore } from '@/store/favorites'
import type { Favorite } from '@buswave/shared'

/**
 * Null component — place in Providers.
 * On sign-in: loads favorites from Supabase and replaces local store.
 * On sign-out: clears the store.
 */
export function FavoritesSync() {
  const setFavorites = useFavoritesStore((s) => s.setFavorites)
  const clearFavorites = useFavoritesStore((s) => s.clearFavorites)
  const supabase = useMemo(() => createSupabaseClient(), [])
  const lastUserId = useRef<string | null>(null)

  const loadFavoritesForUser = useCallback(async (userId: string) => {
    if (userId === lastUserId.current) return
    lastUserId.current = userId
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[FavoritesSync] load error:', error.message)
      return
    }
    const favs: Favorite[] = (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      stopId: row.stop_id,
      routeId: row.route_id ?? null,
      label: row.label ?? undefined,
      createdAt: row.created_at,
    }))
    setFavorites(favs)
  }, [supabase, setFavorites])

  useEffect(() => {
    // Check immediately for an existing session (handles page refresh while signed in)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) loadFavoritesForUser(user.id)
    })

    // Also subscribe to future sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      if (u) {
        loadFavoritesForUser(u.id)
      } else if (lastUserId.current !== null) {
        lastUserId.current = null
        clearFavorites()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, loadFavoritesForUser, clearFavorites])

  return null
}

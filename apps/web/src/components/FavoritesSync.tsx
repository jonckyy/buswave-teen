'use client'

import { useEffect, useMemo, useRef } from 'react'
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

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null

      if (u && u.id !== lastUserId.current) {
        lastUserId.current = u.id
        const { data } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', u.id)
          .order('created_at', { ascending: true })

        if (data) {
          const favs: Favorite[] = data.map((row) => ({
            id: row.id,
            userId: row.user_id,
            stopId: row.stop_id,
            routeId: row.route_id ?? null,
            label: row.label ?? undefined,
            createdAt: row.created_at,
          }))
          setFavorites(favs)
        }
      } else if (!u && lastUserId.current !== null) {
        lastUserId.current = null
        clearFavorites()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, setFavorites, clearFavorites])

  return null
}

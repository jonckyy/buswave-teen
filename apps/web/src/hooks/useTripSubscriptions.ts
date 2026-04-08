'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/lib/api'
import { createSupabaseClient } from '@/lib/supabase'
import type { TripSubscriptionInsert } from '@buswave/shared'

/**
 * Manage trip-specific notification subscriptions for a favorite.
 *
 * Each subscription pins notifications to a SPECIFIC scheduled trip
 * (e.g., the 8h30 weekday bus on line 42), instead of every bus on the route.
 */
export function useTripSubscriptions(favoriteId: string | null) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createSupabaseClient(), [])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const queryKey = ['trip-subscriptions', favoriteId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!favoriteId) return []
      const token = await getToken()
      if (!token) return []
      return api.getTripSubscriptions(favoriteId, token)
    },
    enabled: !!favoriteId,
    staleTime: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: async (payload: TripSubscriptionInsert) => {
      if (!favoriteId) throw new Error('No favoriteId')
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return api.addTripSubscription(favoriteId, payload, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (subId: string) => {
      if (!favoriteId) throw new Error('No favoriteId')
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return api.removeTripSubscription(favoriteId, subId, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateDaysMutation = useMutation({
    mutationFn: async ({ subId, selectedDays }: { subId: string; selectedDays: boolean[] }) => {
      if (!favoriteId) throw new Error('No favoriteId')
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return api.updateTripSubscriptionDays(favoriteId, subId, selectedDays, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    subscriptions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addSubscription: addMutation.mutateAsync,
    removeSubscription: removeMutation.mutateAsync,
    updateDays: updateDaysMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isUpdating: updateDaysMutation.isPending,
  }
}

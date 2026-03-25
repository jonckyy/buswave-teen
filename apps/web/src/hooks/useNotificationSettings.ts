'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { createSupabaseClient } from '@/lib/supabase'
import type { NotificationSettingsUpsert } from '@buswave/shared'

export function useNotificationSettings(favoriteId: string | null) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createSupabaseClient(), [])

  const getToken = async (): Promise<string> => {
    // Use getUser() to trigger token refresh if expired, then read the fresh session
    let user, error
    try {
      const res = await supabase.auth.getUser()
      user = res.data.user
      error = res.error
    } catch (e) {
      throw new Error(`Auth getUser failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (error || !user) throw new Error(`Not authenticated: ${error?.message ?? 'no user'}`)
    let session
    try {
      const res = await supabase.auth.getSession()
      session = res.data.session
    } catch (e) {
      throw new Error(`Auth getSession failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!session?.access_token) throw new Error('No session token')
    return session.access_token
  }

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', favoriteId],
    queryFn: async () => {
      if (!favoriteId) return null
      const token = await getToken()
      return api.getNotificationSettings(favoriteId, token)
    },
    enabled: !!favoriteId,
    staleTime: 5_000,
  })

  const mutation = useMutation({
    mutationFn: async (update: NotificationSettingsUpsert) => {
      if (!favoriteId) throw new Error('No favorite ID')
      const token = await getToken()
      return api.updateNotificationSettings(favoriteId, update, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings', favoriteId] })
    },
  })

  return {
    settings: settings ?? null,
    isLoading,
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  }
}

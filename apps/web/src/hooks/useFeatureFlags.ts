'use client'

import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/hooks/useUser'
import { api } from '@/lib/api'
import { DEFAULT_ROLE_CONFIG } from '@buswave/shared'
import type { RoleConfig, UserRole } from '@buswave/shared'

/**
 * Returns feature flags and limits for the current user's role.
 * Fetches role_config from the API (public endpoint, cached 5min).
 * Falls back to DEFAULT_ROLE_CONFIG if fetch fails.
 */
export function useFeatureFlags() {
  const { role, loading: userLoading } = useUser()

  const { data: configs } = useQuery({
    queryKey: ['role-config'],
    queryFn: () => api.getRoleConfig(),
    staleTime: 5 * 60_000,
  })

  const effectiveRole: UserRole = role ?? 'user'

  const config: RoleConfig = configs?.find((c) => c.role === effectiveRole)
    ?? DEFAULT_ROLE_CONFIG[effectiveRole]

  return {
    ...config,
    loading: userLoading,
  }
}

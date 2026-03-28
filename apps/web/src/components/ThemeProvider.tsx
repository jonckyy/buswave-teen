'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { api } from '@/lib/api'
import type { Theme } from '@buswave/shared'

const STORAGE_KEY = 'buswave-theme'

/**
 * Applies theme CSS variables on <html> based on the user's role config.
 * - Reads themeId from role config (via useFeatureFlags)
 * - Fetches theme tokens from API (cached 5min)
 * - Sets CSS custom properties on document.documentElement
 * - Caches last theme in localStorage for instant apply on reload
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeId, loading: flagsLoading } = useFeatureFlags()
  const appliedRef = useRef<string | null>(null)

  const { data: themes } = useQuery({
    queryKey: ['themes'],
    queryFn: () => api.getThemes(),
    staleTime: 5 * 60_000,
  })

  // Apply theme from localStorage immediately on mount (prevent flash)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as { id: string; tokens: Record<string, string> }
        applyTokens(parsed.tokens)
        document.documentElement.setAttribute('data-theme', parsed.id)
        appliedRef.current = parsed.id
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // Apply theme when themeId or themes data changes
  useEffect(() => {
    if (flagsLoading || !themes) return

    const effectiveId = themeId ?? 'midnight'
    const theme = themes.find((t: Theme) => t.id === effectiveId) ?? themes.find((t: Theme) => t.id === 'midnight')
    if (!theme) return

    // Skip if already applied
    if (appliedRef.current === theme.id) return

    applyTokens(theme.tokens)
    document.documentElement.setAttribute('data-theme', theme.id)
    appliedRef.current = theme.id

    // Cache for next page load
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: theme.id, tokens: theme.tokens }))
    } catch {
      // localStorage full or unavailable
    }
  }, [themeId, themes, flagsLoading])

  return <>{children}</>
}

/** Set CSS custom properties on :root from theme tokens */
function applyTokens(tokens: Record<string, string>) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value)
  }
}

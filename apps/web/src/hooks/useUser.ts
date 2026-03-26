'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'editor' | 'user'

export interface AuthUser {
  user: User | null
  role: UserRole | null
  isAdmin: boolean
  isEditor: boolean
  loading: boolean
  signOut: () => Promise<void>
}

export function useUser(): AuthUser {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const initDone = useRef(false)

  const supabase = useMemo(() => createSupabaseClient(), [])

  useEffect(() => {
    let mounted = true

    async function fetchRole(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      return (data?.role as UserRole) ?? 'user'
    }

    // 1. Setup onAuthStateChange FIRST — passive during init to avoid deadlock
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      const u = session?.user ?? null

      if (!initDone.current) {
        // During init: only set session, NEVER fetch profile (avoids deadlock)
        setUser(u)
        return
      }

      // After init: normal behavior
      setUser(u)
      if (u && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
        const r = await fetchRole(u.id)
        if (mounted) {
          setRole(r)
          setLoading(false)
        }
      } else {
        if (!u) setRole(null)
        setLoading(false)
      }
    })

    // 2. Then init
    async function init() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!mounted) return
        if (u) {
          setUser(u)
          const r = await fetchRole(u.id)
          if (mounted) setRole(r)
        }
      } catch (err) {
        console.error('[useUser] init error:', err)
      } finally {
        if (mounted) {
          initDone.current = true
          setLoading(false)
        }
      }
    }
    init()

    // Safety timeout — never leave loading=true for more than 5s
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        initDone.current = true
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      // Even if API call fails, continue with cleanup
    }
    // Clear Supabase cookies/localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key)
    })
    router.push('/')
    router.refresh()
  }

  return {
    user,
    role,
    isAdmin: role === 'admin',
    isEditor: role === 'admin' || role === 'editor',
    loading,
    signOut,
  }
}

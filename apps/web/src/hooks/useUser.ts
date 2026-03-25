'use client'

import { useEffect, useMemo, useState } from 'react'
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

  // Stable client reference — createBrowserClient is a singleton per URL+key
  const supabase = useMemo(() => createSupabaseClient(), [])

  useEffect(() => {
    // Check for existing session immediately (handles page refresh while signed in)
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (u) {
        setUser(u)
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', u.id)
          .single()
        setRole((data?.role as UserRole) ?? 'user')
      }
      setLoading(false)
    })

    // Also subscribe to future sign-in / sign-out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', u.id)
          .single()
        setRole((data?.role as UserRole) ?? 'user')
      } else {
        setRole(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  async function signOut() {
    await supabase.auth.signOut()
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

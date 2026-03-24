'use client'

import { useEffect, useState } from 'react'
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

  const supabase = createSupabaseClient()

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    setRole((data?.role as UserRole) ?? 'user')
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        await fetchRole(u.id)
      } else {
        setRole(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
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

import type { Context, Next } from 'hono'
import { supabase } from '../lib/supabase.js'

/**
 * Hono middleware: verify Supabase JWT from Authorization header.
 * Sets c.set('userId', ...) and c.set('userRole', ...) on success.
 */
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.slice(7)

  // Verify the JWT by getting the user from Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // Fetch role from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  c.set('userId', user.id)
  c.set('userRole', profile?.role ?? 'user')

  await next()
}

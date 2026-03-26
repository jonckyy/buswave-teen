import type { Context, Next } from 'hono'
import { requireAuth } from './auth.js'

/**
 * Hono middleware: requires authenticated admin user.
 * Chains requireAuth first, then checks role.
 */
export async function requireAdmin(c: Context, next: Next) {
  // First run auth middleware
  const authResult = await requireAuth(c, async () => {})
  if (authResult) return authResult // 401 response

  const role = c.get('userRole') as string
  if (role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  await next()
}

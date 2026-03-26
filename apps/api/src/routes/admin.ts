import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { supabase } from '../lib/supabase.js'
import type { ApiResponse, RoleConfig, AdminUserRow, UserRole } from '@buswave/shared'

export const adminRouter = new Hono()

/** Helper: convert snake_case DB row to camelCase RoleConfig */
function toRoleConfig(row: Record<string, unknown>): RoleConfig {
  return {
    role: row.role as UserRole,
    maxFavorites: row.max_favorites as number,
    maxPushFavorites: row.max_push_favorites as number,
    maxPushNotifications: row.max_push_notifications as number,
    showDebugPanel: row.show_debug_panel as boolean,
    showTechnicalData: row.show_technical_data as boolean,
    showDistanceMetrics: row.show_distance_metrics as boolean,
    showDelayBadges: row.show_delay_badges as boolean,
    showLivePage: row.show_live_page as boolean,
    showAlertsPage: row.show_alerts_page as boolean,
    arrivalsPerCard: row.arrivals_per_card as number,
    allowedTriggerTypes: row.allowed_trigger_types as string[],
    updatedAt: row.updated_at as string,
  }
}

/** GET /role-config — public, returns all 3 role configs */
adminRouter.get('/role-config', async (c) => {
  const { data, error } = await supabase
    .from('role_config')
    .select('*')
    .order('role')

  if (error) {
    console.error('[admin] role-config fetch error:', error.message)
    return c.json({ error: 'Failed to fetch role config' }, 500)
  }

  const configs = (data ?? []).map(toRoleConfig)
  return c.json({ data: configs } satisfies ApiResponse<RoleConfig[]>)
})

/** PUT /role-config/:role — admin only, update one role's config */
adminRouter.put('/role-config/:role', requireAdmin, async (c) => {
  const role = c.req.param('role') as string

  if (!['editor', 'user'].includes(role)) {
    return c.json({ error: 'Cannot modify admin config via API' }, 403)
  }

  const body = await c.req.json()

  // Map camelCase to snake_case for DB update
  const update: Record<string, unknown> = {}
  if (body.maxFavorites !== undefined) update.max_favorites = body.maxFavorites
  if (body.maxPushFavorites !== undefined) update.max_push_favorites = body.maxPushFavorites
  if (body.maxPushNotifications !== undefined) update.max_push_notifications = body.maxPushNotifications
  if (body.showDebugPanel !== undefined) update.show_debug_panel = body.showDebugPanel
  if (body.showTechnicalData !== undefined) update.show_technical_data = body.showTechnicalData
  if (body.showDistanceMetrics !== undefined) update.show_distance_metrics = body.showDistanceMetrics
  if (body.showDelayBadges !== undefined) update.show_delay_badges = body.showDelayBadges
  if (body.showLivePage !== undefined) update.show_live_page = body.showLivePage
  if (body.showAlertsPage !== undefined) update.show_alerts_page = body.showAlertsPage
  if (body.arrivalsPerCard !== undefined) update.arrivals_per_card = body.arrivalsPerCard
  if (body.allowedTriggerTypes !== undefined) update.allowed_trigger_types = body.allowedTriggerTypes

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const { error } = await supabase
    .from('role_config')
    .update(update)
    .eq('role', role)

  if (error) {
    console.error('[admin] role-config update error:', error.message)
    return c.json({ error: `Failed to update: ${error.message}` }, 500)
  }

  return c.json({ data: { ok: true } })
})

/** GET /users — admin only, user list with aggregate stats */
adminRouter.get('/users', requireAdmin, async (c) => {
  const { data, error } = await supabase.rpc('get_admin_users')

  if (error) {
    // Fallback: simple query without aggregates if RPC doesn't exist
    console.error('[admin] get_admin_users RPC error:', error.message)
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })

    if (profErr) {
      return c.json({ error: 'Failed to fetch users' }, 500)
    }

    const users: AdminUserRow[] = (profiles ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      email: p.email as string,
      role: (p.role as UserRole) ?? 'user',
      createdAt: p.created_at as string,
      favoritesCount: 0,
      pushSubscriptionsCount: 0,
      notificationsReceivedCount: 0,
    }))

    return c.json({ data: users } satisfies ApiResponse<AdminUserRow[]>)
  }

  const users: AdminUserRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    email: r.email as string,
    role: (r.role as UserRole) ?? 'user',
    createdAt: r.created_at as string,
    favoritesCount: Number(r.favorites_count ?? 0),
    pushSubscriptionsCount: Number(r.push_subscriptions_count ?? 0),
    notificationsReceivedCount: Number(r.notifications_received_count ?? 0),
  }))

  return c.json({ data: users } satisfies ApiResponse<AdminUserRow[]>)
})

/** PUT /users/:userId/role — admin only, change a user's role */
adminRouter.put('/users/:userId/role', requireAdmin, async (c) => {
  const adminId = c.get('userId') as string
  const targetUserId = c.req.param('userId')
  const body = await c.req.json<{ role: string }>()

  if (targetUserId === adminId) {
    return c.json({ error: 'Cannot change your own role' }, 403)
  }

  if (!['editor', 'user'].includes(body.role)) {
    return c.json({ error: 'Role must be "editor" or "user"' }, 400)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: body.role })
    .eq('id', targetUserId)

  if (error) {
    console.error('[admin] role update error:', error.message)
    return c.json({ error: `Failed to update role: ${error.message}` }, 500)
  }

  return c.json({ data: { ok: true } })
})

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { supabase } from '../lib/supabase.js'
import type { ApiResponse, RoleConfig, AdminUserRow, AdminUserDetail, AdminUserFavorite, AdminPushSubscription, AdminNotificationLog, UserRole, Theme } from '@buswave/shared'

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
    themeId: (row.theme_id as string) ?? 'midnight',
    mapTileStyle: (row.map_tile_style as string) ?? 'osm-standard',
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
  if (body.themeId !== undefined) update.theme_id = body.themeId
  if (body.mapTileStyle !== undefined) update.map_tile_style = body.mapTileStyle

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

/** Parse browser name from user-agent string */
function parseBrowser(ua: string | null): string {
  if (!ua) return 'Inconnu'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera'
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
  return 'Autre'
}

/** GET /users/:userId/details — admin only, detailed user info for debugging */
adminRouter.get('/users/:userId/details', requireAdmin, async (c) => {
  const userId = c.req.param('userId')

  // Fetch profile, favorites, subscriptions, notification log in parallel
  const [profileRes, favsRes, subsRes, logsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('favorites')
      .select('id, stop_id, route_id, label, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('push_subscriptions')
      .select('id, endpoint, user_agent, created_at, last_used')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('notification_log')
      .select('id, favorite_id, trigger_type, trip_id, sent_at')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(50),
  ])

  if (profileRes.error || !profileRes.data) {
    return c.json({ error: 'User not found' }, 404)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileRes.data as any

  // Collect stop/route IDs for name lookups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const favs = (favsRes.data ?? []) as any[]
  const stopIds = [...new Set(favs.map((f) => f.stop_id as string))]
  const routeIds = [...new Set(favs.map((f) => f.route_id as string).filter(Boolean))]
  const favIds = favs.map((f) => f.id as string)

  // Also collect stop/route IDs from notification logs via favorites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (logsRes.data ?? []) as any[]
  const logFavIds = [...new Set(logs.map((l) => l.favorite_id as string))]
  const allFavIds = [...new Set([...favIds, ...logFavIds])]

  // Batch fetch related data
  const [stopsRes, routesRes, settingsRes, logFavsRes] = await Promise.all([
    stopIds.length > 0
      ? supabase.from('stops').select('stop_id, stop_name').in('stop_id', stopIds)
      : { data: [] },
    routeIds.length > 0
      ? supabase.from('routes').select('route_id, route_short_name').in('route_id', routeIds)
      : { data: [] },
    favIds.length > 0
      ? supabase.from('notification_settings').select('*').in('favorite_id', favIds)
      : { data: [] },
    // Get favorites referenced by logs that the user may have deleted
    logFavIds.length > 0
      ? supabase.from('favorites').select('id, stop_id, route_id').in('id', logFavIds)
      : { data: [] },
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stopNameMap = new Map((stopsRes.data ?? []).map((s: any) => [s.stop_id, s.stop_name]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeNameMap = new Map((routesRes.data ?? []).map((r: any) => [r.route_id, r.route_short_name]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsMap = new Map((settingsRes.data ?? []).map((s: any) => [s.favorite_id, s]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logFavMap = new Map((logFavsRes.data ?? []).map((f: any) => [f.id, f]))

  // Fetch extra stop/route names for log favorites not in current favorites
  const extraStopIds = [...new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logFavsRes.data ?? []).filter((f: any) => !stopNameMap.has(f.stop_id)).map((f: any) => f.stop_id as string)
  )]
  const extraRouteIds = [...new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logFavsRes.data ?? []).filter((f: any) => f.route_id && !routeNameMap.has(f.route_id)).map((f: any) => f.route_id as string)
  )]

  if (extraStopIds.length > 0) {
    const { data } = await supabase.from('stops').select('stop_id, stop_name').in('stop_id', extraStopIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (data ?? []) as any[]) stopNameMap.set(s.stop_id, s.stop_name)
  }
  if (extraRouteIds.length > 0) {
    const { data } = await supabase.from('routes').select('route_id, route_short_name').in('route_id', extraRouteIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? []) as any[]) routeNameMap.set(r.route_id, r.route_short_name)
  }

  // Build favorites
  const favorites: AdminUserFavorite[] = favs.map((f) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ns = settingsMap.get(f.id) as any
    return {
      id: f.id,
      stopId: f.stop_id,
      stopName: stopNameMap.get(f.stop_id) ?? f.stop_id,
      routeId: f.route_id,
      routeShortName: f.route_id ? (routeNameMap.get(f.route_id) ?? f.route_id) : null,
      label: f.label,
      createdAt: f.created_at,
      notifications: ns ? {
        timeEnabled: ns.time_enabled,
        timeMinutes: ns.time_minutes,
        distanceEnabled: ns.distance_enabled,
        distanceMeters: ns.distance_meters,
        offrouteEnabled: ns.offroute_enabled,
        offrouteMeters: ns.offroute_meters,
      } : null,
    }
  })

  // Build push subscriptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subs = (subsRes.data ?? []) as any[]
  const pushSubscriptions: AdminPushSubscription[] = subs.map((s) => ({
    id: s.id,
    endpoint: s.endpoint,
    userAgent: s.user_agent,
    browser: parseBrowser(s.user_agent),
    createdAt: s.created_at,
    lastUsed: s.last_used,
  }))

  // Build notification log
  const recentNotifications: AdminNotificationLog[] = logs.map((l) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fav = logFavMap.get(l.favorite_id) as any
    return {
      id: l.id,
      favoriteId: l.favorite_id,
      triggerType: l.trigger_type,
      tripId: l.trip_id,
      sentAt: l.sent_at,
      stopName: fav ? (stopNameMap.get(fav.stop_id) ?? null) : null,
      routeShortName: fav?.route_id ? (routeNameMap.get(fav.route_id) ?? null) : null,
    }
  })

  const detail: AdminUserDetail = {
    id: profile.id,
    email: profile.email,
    role: profile.role ?? 'user',
    createdAt: profile.created_at,
    quietStart: profile.quiet_start ?? '22:00',
    quietEnd: profile.quiet_end ?? '07:00',
    favorites,
    pushSubscriptions,
    recentNotifications,
  }

  return c.json({ data: detail } satisfies ApiResponse<AdminUserDetail>)
})

// ─── Theme endpoints ───────────────────────────────────────────────

/** Helper: convert snake_case DB row to camelCase Theme */
function toTheme(row: Record<string, unknown>): Theme {
  return {
    id: row.id as string,
    label: row.label as string,
    tokens: row.tokens as Record<string, string>,
    isBuiltin: row.is_builtin as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

/** GET /themes — public, returns all themes */
adminRouter.get('/themes', async (c) => {
  const { data, error } = await supabase
    .from('themes')
    .select('*')
    .order('id')

  if (error) {
    console.error('[admin] themes fetch error:', error.message)
    return c.json({ error: 'Failed to fetch themes' }, 500)
  }

  return c.json({ data: (data ?? []).map(toTheme) } satisfies ApiResponse<Theme[]>)
})

/** POST /themes — admin only, create a new theme */
adminRouter.post('/themes', requireAdmin, async (c) => {
  const body = await c.req.json<{ id: string; label: string; tokens: Record<string, string> }>()

  if (!body.id || !body.label || !body.tokens) {
    return c.json({ error: 'id, label, and tokens are required' }, 400)
  }

  const { error } = await supabase.from('themes').insert({
    id: body.id,
    label: body.label,
    tokens: body.tokens,
    is_builtin: false,
  })

  if (error) {
    console.error('[admin] theme create error:', error.message)
    return c.json({ error: `Failed to create theme: ${error.message}` }, 500)
  }

  return c.json({ data: { ok: true } })
})

/** PUT /themes/:id — admin only, update a theme */
adminRouter.put('/themes/:id', requireAdmin, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ label?: string; tokens?: Record<string, string> }>()

  const update: Record<string, unknown> = {}
  if (body.label !== undefined) update.label = body.label
  if (body.tokens !== undefined) update.tokens = body.tokens

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const { error } = await supabase.from('themes').update(update).eq('id', id)

  if (error) {
    console.error('[admin] theme update error:', error.message)
    return c.json({ error: `Failed to update theme: ${error.message}` }, 500)
  }

  return c.json({ data: { ok: true } })
})

/** DELETE /themes/:id — admin only, delete non-builtin themes */
adminRouter.delete('/themes/:id', requireAdmin, async (c) => {
  const id = c.req.param('id')

  // Check if builtin
  const { data: theme } = await supabase.from('themes').select('is_builtin').eq('id', id).single()
  if (theme?.is_builtin) {
    return c.json({ error: 'Cannot delete built-in themes' }, 403)
  }

  const { error } = await supabase.from('themes').delete().eq('id', id)

  if (error) {
    console.error('[admin] theme delete error:', error.message)
    return c.json({ error: `Failed to delete theme: ${error.message}` }, 500)
  }

  return c.json({ data: { ok: true } })
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

/** GET /admin/analytics — query vehicle_positions_log with filters */
adminRouter.get('/analytics', requireAdmin, async (c) => {
  const routeShort = c.req.query('route_short')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const vehicleId = c.req.query('vehicle_id')

  if (!routeShort || !from || !to) {
    return c.json({ error: 'route_short, from, and to are required' }, 400)
  }

  let query = supabase
    .from('vehicle_positions_log')
    .select('*')
    .eq('route_short', routeShort)
    .gte('recorded_at', from)
    .lte('recorded_at', to)
    .order('recorded_at', { ascending: true })
    .limit(10000)

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin] analytics query error:', error.message)
    return c.json({ error: `Query failed: ${error.message}` }, 500)
  }

  return c.json({ data: data ?? [] })
})

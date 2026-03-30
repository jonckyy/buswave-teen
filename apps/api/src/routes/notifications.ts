import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'
import { getVapidPublicKey } from '../lib/web-push.js'
import type { ApiResponse, NotificationSettings } from '@buswave/shared'

export const notificationsRouter = new Hono()

/** GET /vapid-key — public, returns the VAPID public key */
notificationsRouter.get('/vapid-key', (c) => {
  return c.json({ data: { publicKey: getVapidPublicKey() } } satisfies ApiResponse<{ publicKey: string }>)
})

/** POST /subscribe — register a push subscription (auth required) */
notificationsRouter.post('/subscribe', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{
    endpoint: string
    keys: { p256dh: string; auth: string }
    userAgent?: string
  }>()

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: 'Missing required fields: endpoint, keys.p256dh, keys.auth' }, 400)
  }

  // Check if subscription already exists (avoid .upsert which crashes Bun)
  const { data: existing } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', body.endpoint)
    .maybeSingle()

  let error
  if (existing) {
    ;({ error } = await supabase
      .from('push_subscriptions')
      .update({
        user_id: userId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.userAgent ?? null,
      })
      .eq('endpoint', body.endpoint))
  } else {
    ;({ error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.userAgent ?? null,
      }))
  }

  if (error) {
    console.error('[notifications] subscribe error:', error.message)
    return c.json({ error: 'Failed to save subscription' }, 500)
  }

  return c.json({ data: { ok: true } })
})

/** DELETE /subscribe — unregister a push subscription */
notificationsRouter.delete('/subscribe', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ endpoint: string }>()

  if (!body.endpoint) {
    return c.json({ error: 'Missing endpoint' }, 400)
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', userId)

  return c.json({ data: { ok: true } })
})

/** GET /settings/:favoriteId — get notification settings for a favorite */
notificationsRouter.get('/settings/:favoriteId', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const favoriteId = c.req.param('favoriteId')

  const { data } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('favorite_id', favoriteId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return c.json({ data: null } satisfies ApiResponse<NotificationSettings | null>)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  const settings: NotificationSettings = {
    id: row.id,
    favoriteId: row.favorite_id,
    userId: row.user_id,
    timeEnabled: row.time_enabled,
    timeMinutes: row.time_minutes,
    distanceEnabled: row.distance_enabled,
    distanceMeters: row.distance_meters,
    offrouteEnabled: row.offroute_enabled,
    offrouteMeters: row.offroute_meters,
  }

  return c.json({ data: settings } satisfies ApiResponse<NotificationSettings>)
})

/** PUT /settings/:favoriteId — upsert notification settings */
notificationsRouter.put('/settings/:favoriteId', requireAuth, async (c) => {
  try {
    const userId = c.get('userId') as string
    const userRole = (c.get('userRole') as string) ?? 'user'
    const favoriteId = c.req.param('favoriteId')
    console.log(`[notifications] PUT settings: user=${userId} role=${userRole} fav=${favoriteId}`)

    const body = await c.req.json()
    console.log(`[notifications] body:`, JSON.stringify(body))

    // Check push limit: count favorites with any active trigger (excluding this one)
    const hasAnyTrigger = body.timeEnabled || body.distanceEnabled || body.offrouteEnabled
    if (hasAnyTrigger) {
      console.log(`[notifications] checking push limit...`)
      const { count, error: countErr } = await supabase
        .from('notification_settings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('favorite_id', favoriteId)
        .or('time_enabled.eq.true,distance_enabled.eq.true,offroute_enabled.eq.true')

      // Fetch limit from role_config DB table (fallback to 3)
      let limit = 3
      const { data: rc } = await supabase
        .from('role_config')
        .select('max_push_favorites')
        .eq('role', userRole)
        .maybeSingle()
      if (rc) limit = rc.max_push_favorites
      console.log(`[notifications] limit check: count=${count} limit=${limit} error=${countErr?.message}`)
      if ((count ?? 0) >= limit) {
        return c.json(
          { error: `Limite atteinte : ${limit} favoris avec notifications maximum.` },
          403
        )
      }
    }

    // Validate timeMinutes array
    const timeMinutes: number[] = Array.isArray(body.timeMinutes) ? body.timeMinutes : [5]
    if (timeMinutes.length > 5 || timeMinutes.some((m: number) => m < 1 || m > 30 || !Number.isInteger(m))) {
      return c.json({ error: 'timeMinutes must be 1–5 integers between 1 and 30' }, 400)
    }

    console.log(`[notifications] saving settings...`)
    // Check if settings already exist (avoid .upsert which crashes Bun)
    const { data: existing } = await supabase
      .from('notification_settings')
      .select('id')
      .eq('favorite_id', favoriteId)
      .eq('user_id', userId)
      .maybeSingle()

    const payload = {
      time_enabled: body.timeEnabled ?? false,
      time_minutes: timeMinutes,
      distance_enabled: body.distanceEnabled ?? false,
      distance_meters: body.distanceMeters ?? 500,
      offroute_enabled: body.offrouteEnabled ?? false,
      offroute_meters: body.offrouteMeters ?? 150,
    }

    let error
    if (existing) {
      ;({ error } = await supabase
        .from('notification_settings')
        .update(payload)
        .eq('id', existing.id))
    } else {
      ;({ error } = await supabase
        .from('notification_settings')
        .insert({
          favorite_id: favoriteId,
          user_id: userId,
          ...payload,
        }))
    }

    if (error) {
      console.error('[notifications] upsert error:', error.message, error.details, error.hint)
      return c.json({ error: `Failed to save: ${error.message}` }, 500)
    }

    console.log(`[notifications] saved OK`)
    return c.json({ data: { ok: true } })
  } catch (err) {
    console.error('[notifications] PUT crash:', err)
    return c.json({ error: `Handler crash: ${err instanceof Error ? err.message : String(err)}` }, 500)
  }
})

/** GET /quiet-hours — get user's quiet hours */
notificationsRouter.get('/quiet-hours', requireAuth, async (c) => {
  const userId = c.get('userId') as string

  const { data } = await supabase
    .from('profiles')
    .select('quiet_start, quiet_end')
    .eq('id', userId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  return c.json({ data: { quietStart: row?.quiet_start ?? '22:00', quietEnd: row?.quiet_end ?? '07:00' } })
})

/** PUT /quiet-hours — update user's quiet hours */
notificationsRouter.put('/quiet-hours', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ quietStart: string; quietEnd: string }>()

  await supabase
    .from('profiles')
    .update({ quiet_start: body.quietStart, quiet_end: body.quietEnd })
    .eq('id', userId)

  return c.json({ data: { ok: true } })
})

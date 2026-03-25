/**
 * Notification scheduler — runs every 30s on Railway.
 * Checks all active notification triggers and sends Web Push messages.
 */
import { supabase } from './supabase.js'
import { getVehiclePositions } from './gtfs-rt.js'
import { getArrivalsForStop } from './arrivals.js'
import { sendPush, isConfigured } from './web-push.js'
import { haversineKm, pointToPolylineDistanceM } from '@buswave/shared'
import type { NotificationTrigger } from '@buswave/shared'

const INTERVAL_MS = 30_000

// Cooldowns per trigger type (ms)
const COOLDOWNS: Record<NotificationTrigger, number> = {
  time: 10 * 60 * 1000,     // 10 min
  distance: 5 * 60 * 1000,  // 5 min
  offroute: 5 * 60 * 1000,  // 5 min
}

// In-memory dedup: key → timestamp
const recentlySent = new Map<string, number>()

// Off-route debounce: key → consecutive off-route count
const offrouteDebounce = new Map<string, number>()

function dedupKey(userId: string, favoriteId: string, trigger: NotificationTrigger, tripId: string): string {
  return `${userId}:${favoriteId}:${trigger}:${tripId}`
}

function isRecentlySent(key: string, trigger: NotificationTrigger): boolean {
  const ts = recentlySent.get(key)
  if (!ts) return false
  return Date.now() - ts < COOLDOWNS[trigger]
}

function markSent(key: string) {
  recentlySent.set(key, Date.now())
}

/** Prune old entries from dedup map */
function pruneDedup() {
  const now = Date.now()
  for (const [key, ts] of recentlySent.entries()) {
    if (now - ts > 15 * 60 * 1000) recentlySent.delete(key)
  }
  for (const [key] of offrouteDebounce.entries()) {
    // Clean debounce entries not seen in 5 min
    if (!recentlySent.has(key.replace(':offroute:', ':offroute-seen:'))) {
      offrouteDebounce.delete(key)
    }
  }
}

/** Check if current time in Brussels is within quiet hours */
function isQuietHours(quietStart: string, quietEnd: string): boolean {
  const now = new Date()
  const brusselsTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Brussels' }))
  const hhmm = brusselsTime.getHours() * 100 + brusselsTime.getMinutes()
  const start = parseInt(quietStart.replace(':', '')) || 2200
  const end = parseInt(quietEnd.replace(':', '')) || 700

  if (start > end) {
    // Overnight: e.g., 22:00 - 07:00
    return hhmm >= start || hhmm < end
  }
  return hhmm >= start && hhmm < end
}

interface ActiveSetting {
  settingId: string
  favoriteId: string
  userId: string
  stopId: string
  routeId: string | null
  stopName: string
  timeEnabled: boolean
  timeMinutes: number
  distanceEnabled: boolean
  distanceMeters: number
  offrouteEnabled: boolean
  offrouteMeters: number
  quietStart: string
  quietEnd: string
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>
}

async function getActiveSettings(): Promise<ActiveSetting[]> {
  // Get all notification_settings with at least one trigger enabled
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .or('time_enabled.eq.true,distance_enabled.eq.true,offroute_enabled.eq.true')

  if (!settings?.length) return []

  // Collect unique user IDs and favorite IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set(settings.map((s: any) => s.user_id as string))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const favoriteIds = [...new Set(settings.map((s: any) => s.favorite_id as string))]

  // Batch fetch favorites, profiles, and subscriptions
  const [favRes, profileRes, subRes] = await Promise.all([
    supabase.from('favorites').select('id, stop_id, route_id, label').in('id', favoriteIds),
    supabase.from('profiles').select('id, quiet_start, quiet_end').in('id', userIds),
    supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', userIds),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const favMap = new Map((favRes.data ?? []).map((f: any) => [f.id, f]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileMap = new Map((profileRes.data ?? []).map((p: any) => [p.id, p]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subsByUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>()
  for (const sub of subRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = sub as any
    const list = subsByUser.get(s.user_id) ?? []
    list.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    subsByUser.set(s.user_id, list)
  }

  // Collect stop IDs for name lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stopIds = [...new Set((favRes.data ?? []).map((f: any) => f.stop_id as string))]
  const { data: stops } = await supabase
    .from('stops')
    .select('stop_id, stop_name')
    .in('stop_id', stopIds)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stopNameMap = new Map((stops ?? []).map((s: any) => [s.stop_id, s.stop_name]))

  const result: ActiveSetting[] = []
  for (const s of settings) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = s as any
    const fav = favMap.get(row.favorite_id)
    const profile = profileMap.get(row.user_id)
    const subs = subsByUser.get(row.user_id)
    if (!fav || !subs?.length) continue

    result.push({
      settingId: row.id,
      favoriteId: row.favorite_id,
      userId: row.user_id,
      stopId: fav.stop_id,
      routeId: fav.route_id,
      stopName: stopNameMap.get(fav.stop_id) ?? fav.stop_id,
      timeEnabled: row.time_enabled,
      timeMinutes: row.time_minutes,
      distanceEnabled: row.distance_enabled,
      distanceMeters: row.distance_meters,
      offrouteEnabled: row.offroute_enabled,
      offrouteMeters: row.offroute_meters,
      quietStart: profile?.quiet_start ?? '22:00',
      quietEnd: profile?.quiet_end ?? '07:00',
      subscriptions: subs,
    })
  }

  return result
}

async function sendToUser(
  setting: ActiveSetting,
  trigger: NotificationTrigger,
  tripId: string,
  title: string,
  body: string
) {
  const key = dedupKey(setting.userId, setting.favoriteId, trigger, tripId)
  if (isRecentlySent(key, trigger)) return

  const payload = {
    title,
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `${trigger}:${setting.favoriteId}:${tripId}`,
    data: {
      trigger,
      stopId: setting.stopId,
      routeId: setting.routeId,
      tripId,
      url: `/map?stopId=${setting.stopId}${setting.routeId ? `&routeId=${setting.routeId}` : ''}`,
    },
  }

  let sent = false
  for (const sub of setting.subscriptions) {
    const ok = await sendPush(sub, payload)
    if (ok) sent = true
  }

  if (sent) {
    markSent(key)
    // Log to DB for persistent dedup
    await supabase.from('notification_log').insert({
      user_id: setting.userId,
      favorite_id: setting.favoriteId,
      trigger_type: trigger,
      trip_id: tripId,
    })
  }
}

async function checkAndNotify() {
  try {
    const activeSettings = await getActiveSettings()
    if (activeSettings.length === 0) return

    // Fetch vehicle positions once (shared across all checks)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vehicleFeed: any = await getVehiclePositions()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allVehicles: any[] = vehicleFeed?.entity ?? []

    for (const setting of activeSettings) {
      // Skip if quiet hours
      if (isQuietHours(setting.quietStart, setting.quietEnd)) continue

      // TIME trigger
      if (setting.timeEnabled) {
        try {
          const arrivals = await getArrivalsForStop(setting.stopId, setting.routeId ?? undefined)
          const nowUnix = Math.floor(Date.now() / 1000)

          for (const arrival of arrivals) {
            const minutesAway = (arrival.predictedArrivalUnix - nowUnix) / 60
            if (minutesAway > 0 && minutesAway <= setting.timeMinutes) {
              const mins = Math.round(minutesAway)
              await sendToUser(
                setting, 'time', arrival.tripId,
                `Bus ${arrival.routeShortName} dans ${mins} min`,
                `Ligne ${arrival.routeShortName} → ${arrival.headsign} arrive à ${setting.stopName} dans ${mins} min`
              )
            }
          }
        } catch (err) {
          console.error(`[scheduler] time check error for ${setting.stopId}:`, err)
        }
      }

      // DISTANCE trigger
      if (setting.distanceEnabled && setting.routeId) {
        try {
          // Find vehicles on this route
          for (const entity of allVehicles) {
            const vp = entity.vehicle
            if (!vp?.trip?.routeId || vp.trip.routeId !== setting.routeId) continue
            if (!vp.position?.latitude || !vp.position?.longitude) continue

            // Get stop coordinates
            const { data: stop } = await supabase
              .from('stops')
              .select('stop_lat, stop_lon')
              .eq('stop_id', setting.stopId)
              .single()
            if (!stop) continue

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = stop as any
            const distKm = haversineKm(
              vp.position.latitude, vp.position.longitude,
              s.stop_lat, s.stop_lon
            )
            const distM = distKm * 1000
            const tripId = vp.trip?.tripId ?? 'unknown'

            if (distM <= setting.distanceMeters) {
              const label = distM < 100 ? 'moins de 100m' : `${Math.round(distM)}m`
              await sendToUser(
                setting, 'distance', tripId,
                `Bus ${setting.routeId} à ${label}`,
                `Ligne ${setting.routeId} est à ${label} de ${setting.stopName} (à vol d'oiseau)`
              )
            }
          }
        } catch (err) {
          console.error(`[scheduler] distance check error for ${setting.stopId}:`, err)
        }
      }

      // OFF-ROUTE trigger
      if (setting.offrouteEnabled && setting.routeId) {
        try {
          // Get shape for this route
          const { data: trips } = await supabase
            .from('trips')
            .select('shape_id')
            .eq('route_id', setting.routeId)
            .limit(1)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const shapeId = (trips?.[0] as any)?.shape_id
          if (!shapeId) continue

          const { data: shapePoints } = await supabase
            .from('shapes')
            .select('shape_pt_lat, shape_pt_lon')
            .eq('shape_id', shapeId)
            .order('shape_pt_sequence', { ascending: true })

          if (!shapePoints?.length) continue

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const polyline = shapePoints.map((p: any) => ({ lat: p.shape_pt_lat, lon: p.shape_pt_lon }))

          for (const entity of allVehicles) {
            const vp = entity.vehicle
            if (!vp?.trip?.routeId || vp.trip.routeId !== setting.routeId) continue
            if (!vp.position?.latitude || !vp.position?.longitude) continue

            const deviationM = pointToPolylineDistanceM(
              vp.position.latitude, vp.position.longitude,
              polyline
            )
            const tripId = vp.trip?.tripId ?? 'unknown'

            if (deviationM > setting.offrouteMeters) {
              // Debounce: require 2 consecutive readings
              const debounceKey = dedupKey(setting.userId, setting.favoriteId, 'offroute', tripId)
              const count = (offrouteDebounce.get(debounceKey) ?? 0) + 1
              offrouteDebounce.set(debounceKey, count)

              if (count >= 2) {
                await sendToUser(
                  setting, 'offroute', tripId,
                  `Bus ${setting.routeId} hors itinéraire`,
                  `Ligne ${setting.routeId} est à ${Math.round(deviationM)}m de son trajet prévu, près de ${setting.stopName}`
                )
                offrouteDebounce.delete(debounceKey)
              }
            } else {
              // Back on route — reset debounce
              const debounceKey = dedupKey(setting.userId, setting.favoriteId, 'offroute', tripId)
              offrouteDebounce.delete(debounceKey)
            }
          }
        } catch (err) {
          console.error(`[scheduler] offroute check error for ${setting.routeId}:`, err)
        }
      }
    }
  } catch (err) {
    console.error('[scheduler] tick error:', err)
  }
}

export function startNotificationScheduler() {
  if (!isConfigured()) {
    console.warn('[scheduler] VAPID not configured — scheduler disabled')
    return
  }

  console.log(`[scheduler] Starting notification scheduler (${INTERVAL_MS / 1000}s interval)`)

  // Repopulate dedup map from recent DB logs on startup
  supabase
    .from('notification_log')
    .select('user_id, favorite_id, trigger_type, trip_id, sent_at')
    .gte('sent_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .then(({ data }) => {
      for (const row of data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any
        const key = dedupKey(r.user_id, r.favorite_id, r.trigger_type, r.trip_id)
        recentlySent.set(key, new Date(r.sent_at).getTime())
      }
      console.log(`[scheduler] Loaded ${data?.length ?? 0} recent notification logs for dedup`)
    })

  // Run immediately, then every INTERVAL_MS
  checkAndNotify()
  setInterval(checkAndNotify, INTERVAL_MS)

  // Prune dedup map every 60s
  setInterval(pruneDedup, 60_000)
}

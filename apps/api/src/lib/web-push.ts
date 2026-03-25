import webpush from 'web-push'
import { supabase } from './supabase.js'

const VAPID_PUBLIC = process.env['VAPID_PUBLIC_KEY'] ?? ''
const VAPID_PRIVATE = process.env['VAPID_PRIVATE_KEY'] ?? ''
const VAPID_SUBJECT = process.env['VAPID_SUBJECT'] ?? 'mailto:john@blur.be'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  console.log('[web-push] VAPID configured')
} else {
  console.warn('[web-push] VAPID keys not set — push notifications disabled')
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC
}

export function isConfigured(): boolean {
  return !!(VAPID_PUBLIC && VAPID_PRIVATE)
}

/** Validate VAPID key pair by generating VAPID JWT headers — returns null if valid, error string if not */
export function validateVapidKeys(): string | null {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 'Keys not set'
  try {
    // getVapidHeaders signs a JWT using the VAPID private key — if keys don't match, this fails
    const headers = webpush.getVapidHeaders(
      'https://fcm.googleapis.com',
      VAPID_SUBJECT,
      VAPID_PUBLIC,
      VAPID_PRIVATE,
      'aesgcm'
    )
    return headers.Authorization ? null : 'No authorization header generated'
  } catch (err) {
    return String(err)
  }
}

/**
 * Send a push notification. Returns true if successful.
 * Handles 410 Gone (subscription expired) by deleting from DB.
 */
export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  if (!isConfigured()) return false

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    )
    // Update last_used timestamp
    await supabase
      .from('push_subscriptions')
      .update({ last_used: new Date().toISOString() })
      .eq('endpoint', subscription.endpoint)
    return true
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or invalid — clean up
      console.log(`[web-push] Removing expired subscription: ${subscription.endpoint.slice(0, 60)}...`)
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    } else {
      console.error('[web-push] Send error:', err)
    }
    return false
  }
}

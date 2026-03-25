'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { createSupabaseClient } from '@/lib/supabase'

type Permission = 'default' | 'granted' | 'denied'

export function usePushNotifications() {
  const [permission, setPermission] = useState<Permission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const vapidKeyRef = useRef<string | null>(null)
  const supabase = useMemo(() => createSupabaseClient(), [])

  const supported = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  // Check current state on mount
  useEffect(() => {
    if (!supported) return
    setPermission(Notification.permission as Permission)

    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    })
  }, [supported])

  const getToken = useCallback(async (): Promise<string | null> => {
    // Use getUser() to trigger token refresh if expired, then read fresh session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [supabase])

  const getVapidKey = useCallback(async (): Promise<string> => {
    if (vapidKeyRef.current) return vapidKeyRef.current
    const { publicKey } = await api.getVapidKey()
    vapidKeyRef.current = publicKey
    return publicKey
  }, [])

  const subscribe = useCallback(async () => {
    if (!supported) throw new Error('Push notifications not supported on this browser')

    const perm = await Notification.requestPermission()
    setPermission(perm as Permission)
    if (perm !== 'granted') throw new Error('Notification permission denied')

    const token = await getToken()
    if (!token) throw new Error('Not authenticated')

    const vapidKey = await getVapidKey()
    if (!vapidKey) throw new Error('VAPID key not configured on server')
    const appServerKey = urlBase64ToUint8Array(vapidKey)

    // Force-update service worker to ensure latest version
    const existingReg = await navigator.serviceWorker.getRegistration()
    if (existingReg) {
      await existingReg.update()
    }
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    const sw = await navigator.serviceWorker.ready

    // Unsubscribe any existing push subscription (required when VAPID key changes)
    const existingSub = await sw.pushManager.getSubscription()
    if (existingSub) {
      await existingSub.unsubscribe()
    }

    // Subscribe to push — try ArrayBuffer first, fall back to Uint8Array
    let sub: PushSubscription
    try {
      sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      })
    } catch (firstErr) {
      // Some browsers prefer Uint8Array directly
      sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as BufferSource,
      })
    }

    const json = sub.toJSON()
    await api.subscribeToNotifications(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
        },
        userAgent: navigator.userAgent,
      },
      token
    )

    setIsSubscribed(true)
  }, [supported, getToken, getVapidKey])

  const unsubscribe = useCallback(async () => {
    const token = await getToken()

    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        if (token) {
          await api.unsubscribeFromNotifications(sub.endpoint, token).catch(() => {})
        }
        await sub.unsubscribe()
      }
    }

    setIsSubscribed(false)
  }, [getToken])

  return { supported, permission, isSubscribed, subscribe, unsubscribe }
}

/** Convert URL-safe base64 to Uint8Array (needed for applicationServerKey) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

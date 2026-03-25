'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Clock, MapPin, AlertTriangle, X, Loader2 } from 'lucide-react'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface Props {
  favoriteId: string
  stopName: string
  routeId: string | null
  onClose: () => void
}

export function NotificationSettingsPanel({ favoriteId, stopName, routeId, onClose }: Props) {
  const { settings, isLoading, updateSettings, isUpdating, error } = useNotificationSettings(favoriteId)
  const { supported, permission, isSubscribed, subscribe } = usePushNotifications()

  const [timeEnabled, setTimeEnabled] = useState(false)
  const [timeMinutes, setTimeMinutes] = useState(5)
  const [distanceEnabled, setDistanceEnabled] = useState(false)
  const [distanceMeters, setDistanceMeters] = useState(500)
  const [offrouteEnabled, setOffrouteEnabled] = useState(false)
  const [offrouteMeters, setOffrouteMeters] = useState(150)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync local state from fetched settings
  useEffect(() => {
    if (settings) {
      setTimeEnabled(settings.timeEnabled)
      setTimeMinutes(settings.timeMinutes)
      setDistanceEnabled(settings.distanceEnabled)
      setDistanceMeters(settings.distanceMeters)
      setOffrouteEnabled(settings.offrouteEnabled)
      setOffrouteMeters(settings.offrouteMeters)
    }
  }, [settings])

  async function handleSave() {
    setSaveError(null)

    // Ensure push is subscribed
    if (!isSubscribed && (timeEnabled || distanceEnabled || offrouteEnabled)) {
      try {
        await subscribe()
      } catch (err) {
        setSaveError(`Push subscription failed: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    }

    try {
      await updateSettings({
        timeEnabled,
        timeMinutes,
        distanceEnabled,
        distanceMeters,
        offrouteEnabled,
        offrouteMeters,
      })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  // Block events from reaching elements underneath the modal
  function stopProp(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation()
  }

  function handleBackdrop(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  if (!supported) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" onClick={handleBackdrop} onTouchEnd={handleBackdrop}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131A2B] p-6" onClick={stopProp} onTouchEnd={stopProp}>
          <p className="text-sm text-[#8892B0]">Les notifications push ne sont pas supportées sur ce navigateur.</p>
          <button onClick={(e) => { stopProp(e); onClose() }} className="mt-4 text-sm text-[#00D4FF]">Fermer</button>
        </div>
      </div>,
      document.body
    )
  }

  if (permission === 'denied') {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" onClick={handleBackdrop} onTouchEnd={handleBackdrop}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131A2B] p-6" onClick={stopProp} onTouchEnd={stopProp}>
          <p className="text-sm text-[#8892B0]">Les notifications sont bloquées. Autorisez-les dans les paramètres de votre navigateur.</p>
          <button onClick={(e) => { stopProp(e); onClose() }} className="mt-4 text-sm text-[#00D4FF]">Fermer</button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={handleBackdrop} onTouchEnd={handleBackdrop}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131A2B] p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={stopProp}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#00D4FF]" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <button onClick={(e) => { stopProp(e); onClose() }} className="text-[#8892B0] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-[#8892B0]">
          {stopName}{routeId ? ` — Ligne ${routeId}` : ''}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#8892B0]" />
          </div>
        ) : (
          <>
            {/* Time alert */}
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#0A0E17] p-4">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#00D4FF]" />
                  <span className="text-sm font-medium text-white">Alerte temps</span>
                </div>
                <input
                  type="checkbox"
                  checked={timeEnabled}
                  onChange={(e) => setTimeEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#00D4FF]"
                />
              </label>
              {timeEnabled && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#8892B0]">
                    <span>Notifier quand le bus arrive dans</span>
                    <span className="font-semibold text-white">{timeMinutes} min</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(Number(e.target.value))}
                    className="w-full accent-[#00D4FF]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8892B0]">
                    <span>1 min</span>
                    <span>30 min</span>
                  </div>
                </div>
              )}
            </div>

            {/* Distance alert */}
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#0A0E17] p-4">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#00E676]" />
                  <span className="text-sm font-medium text-white">Alerte distance</span>
                </div>
                <input
                  type="checkbox"
                  checked={distanceEnabled}
                  onChange={(e) => setDistanceEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#00E676]"
                />
              </label>
              {distanceEnabled && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#8892B0]">
                    <span>Notifier quand le bus est à</span>
                    <span className="font-semibold text-white">{distanceMeters}m</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={2000}
                    step={100}
                    value={distanceMeters}
                    onChange={(e) => setDistanceMeters(Number(e.target.value))}
                    className="w-full accent-[#00E676]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8892B0]">
                    <span>100m</span>
                    <span>2000m</span>
                  </div>
                </div>
              )}
            </div>

            {/* Off-route alert */}
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#0A0E17] p-4">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#FF9100]" />
                  <span className="text-sm font-medium text-white">Alerte hors itinéraire</span>
                </div>
                <input
                  type="checkbox"
                  checked={offrouteEnabled}
                  onChange={(e) => setOffrouteEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#FF9100]"
                />
              </label>
              {offrouteEnabled && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#8892B0]">
                    <span>Seuil de déviation</span>
                    <span className="font-semibold text-white">{offrouteMeters}m</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={50}
                    value={offrouteMeters}
                    onChange={(e) => setOffrouteMeters(Number(e.target.value))}
                    className="w-full accent-[#FF9100]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8892B0]">
                    <span>50m</span>
                    <span>500m</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {(saveError || error) && (
              <p className="text-sm text-red-400">{saveError ?? error?.message}</p>
            )}

            {/* Save */}
            <button
              onClick={(e) => { stopProp(e); handleSave() }}
              disabled={isUpdating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D4FF] py-2.5 text-sm font-semibold text-[#0A0E17] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

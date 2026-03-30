'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Clock, MapPin, AlertTriangle, X, Loader2, Plus } from 'lucide-react'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

interface Props {
  favoriteId: string
  stopName: string
  routeId: string | null
  onClose: () => void
}

export function NotificationSettingsPanel({ favoriteId, stopName, routeId, onClose }: Props) {
  const { settings, isLoading, updateSettings, isUpdating, error } = useNotificationSettings(favoriteId)
  const { supported, permission, isSubscribed, subscribe } = usePushNotifications()
  const flags = useFeatureFlags()
  const triggers = flags.allowedTriggerTypes

  const [timeEnabled, setTimeEnabled] = useState(false)
  const [timeMinutes, setTimeMinutes] = useState<number[]>([5])
  const [addingTime, setAddingTime] = useState(false)
  const [newTimeValue, setNewTimeValue] = useState(5)
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
    let pushWarning = ''

    // Try to subscribe to push (non-blocking — settings are saved regardless)
    if (!isSubscribed && (timeEnabled || distanceEnabled || offrouteEnabled)) {
      try {
        await subscribe()
      } catch (err) {
        pushWarning = `Push: ${err instanceof Error ? err.message : String(err)}`
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
      if (pushWarning) {
        setSaveError(`Paramètres enregistrés, mais l'activation push a échoué. ${pushWarning}`)
      } else {
        onClose()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[NotificationSettings] Save error:', msg, err)
      setSaveError(msg)
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
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6" onClick={stopProp} onTouchEnd={stopProp}>
          <p className="text-sm text-muted">Les notifications push ne sont pas supportées sur ce navigateur.</p>
          <button onClick={(e) => { stopProp(e); onClose() }} className="mt-4 text-sm text-accent-cyan">Fermer</button>
        </div>
      </div>,
      document.body
    )
  }

  if (permission === 'denied') {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" onClick={handleBackdrop} onTouchEnd={handleBackdrop}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6" onClick={stopProp} onTouchEnd={stopProp}>
          <p className="text-sm text-muted">Les notifications sont bloquées. Autorisez-les dans les paramètres de votre navigateur.</p>
          <button onClick={(e) => { stopProp(e); onClose() }} className="mt-4 text-sm text-accent-cyan">Fermer</button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={handleBackdrop} onTouchEnd={handleBackdrop}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={stopProp}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-accent-cyan" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <button onClick={(e) => { stopProp(e); onClose() }} className="text-muted hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted">
          {stopName}{routeId ? ` — Ligne ${routeId}` : ''}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <>
            {/* Time alert */}
            <div className="space-y-3 rounded-xl border border-white/5 bg-background p-4">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent-cyan" />
                  <span className="text-sm font-medium text-white">Alerte temps</span>
                </div>
                <input
                  type="checkbox"
                  checked={timeEnabled}
                  onChange={(e) => setTimeEnabled(e.target.checked)}
                  className="h-4 w-4 accent-accent-cyan"
                />
              </label>
              {timeEnabled && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">Notifier quand le bus arrive dans</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {timeMinutes
                      .slice()
                      .sort((a, b) => b - a)
                      .map((m) => (
                        <span
                          key={m}
                          className="inline-flex items-center gap-1 rounded-full bg-accent-cyan/20 text-accent-cyan px-2.5 py-1 text-xs font-semibold"
                        >
                          {m} min
                          <button
                            type="button"
                            onClick={(e) => {
                              stopProp(e)
                              setTimeMinutes((prev) => prev.filter((v) => v !== m))
                            }}
                            className="ml-0.5 rounded-full hover:bg-accent-cyan/30 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    {timeMinutes.length < 5 && !addingTime && (
                      <button
                        type="button"
                        onClick={(e) => { stopProp(e); setAddingTime(true) }}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 text-muted hover:text-white px-2.5 py-1 text-xs"
                      >
                        <Plus className="h-3 w-3" /> Ajouter
                      </button>
                    )}
                  </div>
                  {addingTime && (
                    <div className="space-y-1 rounded-lg border border-white/10 bg-card p-3">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>Nouvelle alerte</span>
                        <span className="font-semibold text-white">{newTimeValue} min</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={newTimeValue}
                        onChange={(e) => setNewTimeValue(Number(e.target.value))}
                        className="w-full accent-accent-cyan"
                      />
                      <div className="flex justify-between text-[10px] text-muted">
                        <span>1 min</span>
                        <span>30 min</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            stopProp(e)
                            if (!timeMinutes.includes(newTimeValue)) {
                              setTimeMinutes((prev) => [...prev, newTimeValue])
                            }
                            setAddingTime(false)
                            setNewTimeValue(5)
                          }}
                          className="rounded bg-accent-cyan/20 text-accent-cyan px-3 py-1 text-xs font-medium hover:bg-accent-cyan/30"
                        >
                          Ajouter {newTimeValue} min
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { stopProp(e); setAddingTime(false) }}
                          className="text-xs text-muted hover:text-white"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Distance alert */}
            {triggers.includes('distance') && (
            <div className="space-y-3 rounded-xl border border-white/5 bg-background p-4">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-on-time" />
                  <span className="text-sm font-medium text-white">Alerte distance</span>
                </div>
                <input
                  type="checkbox"
                  checked={distanceEnabled}
                  onChange={(e) => setDistanceEnabled(e.target.checked)}
                  className="h-4 w-4 accent-on-time"
                />
              </label>
              {distanceEnabled && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted">
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
                    className="w-full accent-on-time"
                  />
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>100m</span>
                    <span>2000m</span>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Off-route alert */}
            {triggers.includes('offroute') && (
            <div className="space-y-3 rounded-xl border border-white/5 bg-background p-4">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-slight-delay" />
                  <span className="text-sm font-medium text-white">Alerte hors itinéraire</span>
                </div>
                <input
                  type="checkbox"
                  checked={offrouteEnabled}
                  onChange={(e) => setOffrouteEnabled(e.target.checked)}
                  className="h-4 w-4 accent-slight-delay"
                />
              </label>
              {offrouteEnabled && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted">
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
                    className="w-full accent-slight-delay"
                  />
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>50m</span>
                    <span>500m</span>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Error */}
            {(saveError || error) && (
              <p className="text-sm text-red-400">{saveError ?? error?.message}</p>
            )}

            {/* Save */}
            <button
              onClick={(e) => { stopProp(e); handleSave() }}
              disabled={isUpdating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-cyan py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
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

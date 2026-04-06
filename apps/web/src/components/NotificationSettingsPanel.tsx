'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Clock, MapPin, AlertTriangle, X, Loader2, Plus } from 'lucide-react'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'

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
    let warning = ''
    if (!isSubscribed && (timeEnabled || distanceEnabled || offrouteEnabled)) {
      try {
        await subscribe()
      } catch (err) {
        warning = err instanceof Error ? err.message : String(err)
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
      if (warning) {
        setSaveError(`Enregistré, mais push a échoué : ${warning}`)
      } else {
        onClose()
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  const stopProp = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation()
  const handleBackdrop = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-ink/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdrop}
      onTouchEnd={handleBackdrop}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border-2 border-line bg-surface p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-pop animate-slide-up"
        onClick={stopProp}
        onTouchEnd={stopProp}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shrink-0">
              <Bell className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-ink">Notifications</h2>
              <p className="text-sm text-ink2 font-medium truncate">{stopName}</p>
            </div>
          </div>
          <button
            onClick={(e) => { stopProp(e); onClose() }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-coral-50 text-rose-600 hover:bg-coral-100 active:scale-90 transition-transform shrink-0"
          >
            <X className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>

        {/* Unsupported / denied */}
        {!supported ? (
          <div className="rounded-2xl bg-coral-50 border-2 border-coral-400 p-4">
            <p className="text-sm font-bold text-rose-600">Les notifications push ne sont pas supportées sur ce navigateur.</p>
          </div>
        ) : permission === 'denied' ? (
          <div className="rounded-2xl bg-coral-50 border-2 border-coral-400 p-4">
            <p className="text-sm font-bold text-rose-600">Notifications bloquées — autorise-les dans les paramètres du navigateur.</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Time alert */}
            <ToggleCard
              icon={<Clock className="h-5 w-5" strokeWidth={2.5} />}
              iconBg="bg-primary-100 text-primary-700"
              title="Alerte temps"
              subtitle="Me prévenir X minutes avant l'arrivée"
              enabled={timeEnabled}
              onToggle={setTimeEnabled}
            >
              {timeEnabled && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {timeMinutes.slice().sort((a, b) => b - a).map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 rounded-pill bg-primary-600 text-white px-3 py-1 text-xs font-extrabold"
                      >
                        {m} min
                        <button
                          type="button"
                          onClick={(e) => {
                            stopProp(e)
                            setTimeMinutes((prev) => prev.filter((v) => v !== m))
                          }}
                          className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 active:scale-90"
                        >
                          <X className="h-3 w-3" strokeWidth={3} />
                        </button>
                      </span>
                    ))}
                    {timeMinutes.length < 5 && !addingTime && (
                      <button
                        type="button"
                        onClick={(e) => { stopProp(e); setAddingTime(true) }}
                        className="inline-flex items-center gap-1 rounded-pill border-2 border-dashed border-primary-300 text-primary-600 px-3 py-1 text-xs font-extrabold hover:bg-primary-50 active:scale-95"
                      >
                        <Plus className="h-3 w-3" strokeWidth={3} /> Ajouter
                      </button>
                    )}
                  </div>
                  {addingTime && (
                    <div className="space-y-2 rounded-2xl border-2 border-primary-200 bg-primary-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink2">Nouvelle alerte</span>
                        <span className="text-lg font-extrabold text-primary-700">{newTimeValue} min</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={newTimeValue}
                        onChange={(e) => setNewTimeValue(Number(e.target.value))}
                        className="w-full accent-primary-600"
                      />
                      <div className="flex gap-2">
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
                          className="flex-1 rounded-pill bg-primary-600 text-white text-xs font-extrabold py-2 active:scale-95"
                        >
                          Ajouter {newTimeValue} min
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { stopProp(e); setAddingTime(false) }}
                          className="rounded-pill text-ink2 px-3 text-xs font-bold hover:text-ink"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ToggleCard>

            {/* Distance alert */}
            {triggers.includes('distance') && (
              <ToggleCard
                icon={<MapPin className="h-5 w-5" strokeWidth={2.5} />}
                iconBg="bg-lime-100 text-lime-600"
                title="Alerte distance"
                subtitle="Me prévenir quand le bus est à X mètres"
                enabled={distanceEnabled}
                onToggle={setDistanceEnabled}
              >
                {distanceEnabled && (
                  <SliderField
                    value={distanceMeters}
                    min={100}
                    max={2000}
                    step={100}
                    unit="m"
                    accent="lime"
                    onChange={setDistanceMeters}
                  />
                )}
              </ToggleCard>
            )}

            {/* Off-route alert */}
            {triggers.includes('offroute') && (
              <ToggleCard
                icon={<AlertTriangle className="h-5 w-5" strokeWidth={2.5} />}
                iconBg="bg-coral-50 text-rose-600"
                title="Alerte déviation"
                subtitle="Quand le bus s'écarte de son trajet"
                enabled={offrouteEnabled}
                onToggle={setOffrouteEnabled}
              >
                {offrouteEnabled && (
                  <SliderField
                    value={offrouteMeters}
                    min={50}
                    max={500}
                    step={50}
                    unit="m"
                    accent="rose"
                    onChange={setOffrouteMeters}
                  />
                )}
              </ToggleCard>
            )}

            {/* Error */}
            {(saveError || error) && (
              <div className="rounded-2xl bg-coral-50 border-2 border-coral-400 p-3">
                <p className="text-sm font-bold text-rose-600">{saveError ?? error?.message}</p>
              </div>
            )}

            {/* Save */}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isUpdating}
              onClick={handleSave}
              iconRight={isUpdating ? <Loader2 className="h-5 w-5 animate-spin" /> : undefined}
            >
              Enregistrer
            </Button>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function ToggleCard({
  icon,
  iconBg,
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  enabled: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border-2 p-4 transition-all',
        enabled ? 'border-primary-400 bg-primary-50' : 'border-line bg-surface'
      )}
    >
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shrink-0', iconBg)}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-ink truncate">{title}</p>
            <p className="text-xs text-ink2 font-medium truncate">{subtitle}</p>
          </div>
        </div>
        {/* iOS-style switch */}
        <div
          className={cn(
            'relative h-7 w-12 rounded-pill transition-colors shrink-0',
            enabled ? 'bg-primary-600' : 'bg-line'
          )}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="sr-only"
          />
          <div
            className={cn(
              'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
          />
        </div>
      </label>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

function SliderField({
  value,
  min,
  max,
  step,
  unit,
  accent,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  unit: string
  accent: 'lime' | 'rose'
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink2">Seuil</span>
        <Pill variant={accent === 'lime' ? 'lime' : 'rose'} size="md">
          {value}
          {unit}
        </Pill>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn('w-full', accent === 'lime' ? 'accent-lime-500' : 'accent-rose-500')}
      />
      <div className="flex justify-between text-[10px] text-ink3 font-bold">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

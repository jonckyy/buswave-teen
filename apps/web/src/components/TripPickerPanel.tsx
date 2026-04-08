'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, X, Loader2, Check, Save } from 'lucide-react'
import { api } from '@/lib/api'
import { useTripSubscriptions } from '@/hooks/useTripSubscriptions'
import { cn } from '@/lib/utils'
import { Pill } from '@/components/ui/Pill'

interface Props {
  favoriteId: string
  stopId: string
  routeId: string | null
  stopName: string
  onClose: () => void
}

const DAYS = [
  { key: 'monday', label: 'Lu', idx: 0 },
  { key: 'tuesday', label: 'Ma', idx: 1 },
  { key: 'wednesday', label: 'Me', idx: 2 },
  { key: 'thursday', label: 'Je', idx: 3 },
  { key: 'friday', label: 'Ve', idx: 4 },
  { key: 'saturday', label: 'Sa', idx: 5 },
  { key: 'sunday', label: 'Di', idx: 6 },
] as const

function getCurrentBrusselsDay() {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Europe/Brussels' })
    .toLowerCase()
}

function formatGtfsTime(time: string): { display: string; nextDay: boolean } {
  const [h, m] = time.split(':').map(Number)
  const nextDay = h >= 24
  const displayH = nextDay ? h - 24 : h
  return {
    display: `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    nextDay,
  }
}

interface TripMeta {
  arrivalTime: string
  routeShortName: string
  headsign: string
  directionId: 0 | 1
}

export function TripPickerPanel({ favoriteId, stopId, routeId, stopName, onClose }: Props) {
  const [day, setDay] = useState(getCurrentBrusselsDay)
  // Map<tripId, Set<dayIdx>> — selections persist across day navigations
  const [picks, setPicks] = useState<Map<string, Set<number>>>(new Map())
  const [tripMeta, setTripMeta] = useState<Map<string, TripMeta>>(new Map())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { subscriptions, addSubscription } = useTripSubscriptions(favoriteId)

  // Map of subscribed tripId → its selected_days (so the user sees them as already-selected)
  const subscribedDays = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const sub of subscriptions) {
      const set = new Set<number>()
      sub.selectedDays?.forEach((d, i) => {
        if (d) set.add(i)
      })
      map.set(sub.tripId, set)
    }
    return map
  }, [subscriptions])

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['timetable', stopId, routeId, day],
    queryFn: () => api.stopTimetable(stopId, day, routeId ?? undefined),
    staleTime: 5 * 60_000,
  })

  const currentDayIdx = DAYS.find((d) => d.key === day)?.idx ?? 0

  function toggleSelect(entry: typeof entries[number]) {
    setPicks((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(entry.tripId) ?? [])
      // Allow toggling: if currentDay already in set, remove; else add
      if (set.has(currentDayIdx)) {
        set.delete(currentDayIdx)
      } else {
        set.add(currentDayIdx)
      }
      if (set.size === 0) {
        next.delete(entry.tripId)
      } else {
        next.set(entry.tripId, set)
      }
      return next
    })
    setTripMeta((prev) => {
      const next = new Map(prev)
      next.set(entry.tripId, {
        arrivalTime: entry.arrivalTime,
        routeShortName: entry.routeShortName,
        headsign: entry.headsign || 'Terminus',
        directionId: (entry.directionId ?? 0) as 0 | 1,
      })
      return next
    })
  }

  const totalPicks = Array.from(picks.values()).reduce((sum, s) => sum + s.size, 0)

  async function handleSave() {
    if (picks.size === 0) {
      onClose()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      // For each picked trip, send ONE POST with selectedDays
      for (const [tripId, daySet] of picks.entries()) {
        const meta = tripMeta.get(tripId)
        if (!meta) continue
        const selectedDays = Array.from({ length: 7 }, (_, i) => daySet.has(i))
        await addSubscription({
          tripId,
          arrivalTime: meta.arrivalTime,
          routeShortName: meta.routeShortName,
          headsign: meta.headsign,
          directionId: meta.directionId,
          selectedDays,
        })
      }
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Group by hour
  const grouped = new Map<number, typeof entries>()
  for (const e of entries) {
    const hour = Number(e.arrivalTime.split(':')[0])
    if (!grouped.has(hour)) grouped.set(hour, [])
    grouped.get(hour)!.push(e)
  }

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-bg-deep/70 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] rounded-t-3xl sm:rounded-3xl glass-strong shadow-glass-lg overflow-hidden flex flex-col animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-line shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-btn-cyan text-white shadow-glow-cyan shrink-0">
              <Clock className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-ink">Choisir mes bus</h2>
              <p className="text-sm text-ink3 font-medium truncate">{stopName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl glass text-rose-light hover:shadow-glow-magenta active:scale-90 transition-all shrink-0"
          >
            <X className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>

        {/* Hint */}
        <div className="px-5 py-2 border-b border-line shrink-0">
          <p className="text-[11px] text-ink3 font-bold text-center">
            Coche un bus pour le jour affiché. Navigue entre les jours pour ajouter d'autres jours au même bus.
          </p>
        </div>

        {/* Day picker */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line shrink-0">
          {DAYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDay(key)}
              className={cn(
                'flex-1 rounded-2xl py-2 text-sm font-extrabold transition-all pressable',
                day === key
                  ? 'bg-btn-primary text-white shadow-glow'
                  : 'glass text-ink2 hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-ink2 text-center py-8 font-bold">Aucun passage ce jour</p>
          ) : (
            <div className="space-y-3">
              {[...grouped.entries()].map(([hour, items]) => {
                const { display: hourDisplay, nextDay } = formatGtfsTime(`${hour}:00:00`)
                return (
                  <div key={hour}>
                    <div className="sticky top-0 glass-deep py-1.5 flex items-center gap-2 mb-2 -mx-5 px-5 border-b border-line">
                      <span className="text-base font-extrabold text-cyan-light tabular-nums">
                        {hourDisplay.split(':')[0]}h
                      </span>
                      {nextDay && <Pill variant="cyan" size="sm">+1</Pill>}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((entry, i) => {
                        const subDays = subscribedDays.get(entry.tripId)
                        const pickedDays = picks.get(entry.tripId)
                        const isSubscribedToday = subDays?.has(currentDayIdx) ?? false
                        const isPickedToday = pickedDays?.has(currentDayIdx) ?? false
                        const checked = isSubscribedToday || isPickedToday
                        // Combine all selected days (existing + new picks) for this trip
                        const allDays = new Set([
                          ...(subDays ? Array.from(subDays) : []),
                          ...(pickedDays ? Array.from(pickedDays) : []),
                        ])
                        const { display, nextDay: nd } = formatGtfsTime(entry.arrivalTime)
                        return (
                          <button
                            key={`${entry.tripId}-${i}`}
                            onClick={() => toggleSelect(entry)}
                            className={cn(
                              'w-full flex items-center gap-3 rounded-2xl p-2.5 text-left transition-all pressable',
                              checked
                                ? 'glass-strong shadow-glow-lime'
                                : 'glass hover:shadow-glow-sm'
                            )}
                          >
                            <div
                              className={cn(
                                'h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
                                checked
                                  ? 'bg-btn-lime border-lime'
                                  : 'border-line'
                              )}
                            >
                              {checked && <Check className="h-4 w-4 text-bg-deep" strokeWidth={3} />}
                            </div>
                            <span className="tabular-nums text-base font-extrabold text-ink w-14 shrink-0">
                              {display}
                              {nd && <span className="text-[10px] text-ink3 ml-0.5">+1</span>}
                            </span>
                            <Pill variant="primary" size="sm" className="shrink-0">
                              {entry.routeShortName}
                            </Pill>
                            <span className="text-xs text-ink2 font-semibold truncate flex-1">
                              {entry.headsign || 'Terminus'}
                            </span>
                            {/* Days summary for this trip */}
                            {allDays.size > 0 && (
                              <span className="flex gap-0.5 shrink-0">
                                {DAYS.map(({ idx, label }) => (
                                  <span
                                    key={idx}
                                    className={cn(
                                      'text-[9px] font-extrabold w-4 text-center',
                                      allDays.has(idx) ? 'text-lime-light' : 'text-ink3/40'
                                    )}
                                  >
                                    {label[0]}
                                  </span>
                                ))}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line glass shrink-0 space-y-2">
          {saveError && <p className="text-xs text-rose-light font-bold">{saveError}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink3 font-bold">
              {totalPicks > 0
                ? `${totalPicks} jour${totalPicks > 1 ? 's' : ''} sélectionné${totalPicks > 1 ? 's' : ''}`
                : 'Coche les bus à suivre'}
            </p>
            <button
              onClick={handleSave}
              disabled={saving || totalPicks === 0}
              className="flex items-center gap-1.5 rounded-pill bg-btn-primary text-white px-4 py-2 text-xs font-extrabold shadow-glow disabled:opacity-40 disabled:saturate-50 active:scale-95 transition-all"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" strokeWidth={3} />}
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

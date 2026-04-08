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

/** Composite key that identifies "the same conceptual bus" across different
 *  GTFS trip_ids (TEC sometimes uses one trip_id per day for the same departure). */
function compositeKey(entry: {
  arrivalTime: string
  routeShortName: string
  headsign: string
  directionId?: number | null
}): string {
  return `${entry.arrivalTime}|${entry.routeShortName}|${entry.headsign || ''}|${entry.directionId ?? 0}`
}

interface PickedTripData {
  arrivalTime: string
  routeShortName: string
  headsign: string
  directionId: 0 | 1
  /** Map<dayIdx, tripId>: which actual GTFS trip_id was picked for which day */
  tripIdsByDay: Map<number, string>
}

export function TripPickerPanel({ favoriteId, stopId, routeId, stopName, onClose }: Props) {
  const [day, setDay] = useState(getCurrentBrusselsDay)
  // Map<compositeKey, PickedTripData>
  const [picks, setPicks] = useState<Map<string, PickedTripData>>(new Map())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { subscriptions, addSubscription } = useTripSubscriptions(favoriteId)

  // Build a map: compositeKey → Set<dayIdx> from EXISTING subscriptions
  const subscribedDaysByKey = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const sub of subscriptions) {
      const key = compositeKey({
        arrivalTime: sub.arrivalTime,
        routeShortName: sub.routeShortName,
        headsign: sub.headsign,
        directionId: sub.directionId,
      })
      const set = map.get(key) ?? new Set<number>()
      sub.selectedDays?.forEach((d, i) => {
        if (d) set.add(i)
      })
      map.set(key, set)
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
    const key = compositeKey(entry)
    setPicks((prev) => {
      const next = new Map(prev)
      const existing = next.get(key)
      if (existing) {
        const newDays = new Map(existing.tripIdsByDay)
        if (newDays.has(currentDayIdx)) {
          newDays.delete(currentDayIdx)
        } else {
          newDays.set(currentDayIdx, entry.tripId)
        }
        if (newDays.size === 0) {
          next.delete(key)
        } else {
          next.set(key, { ...existing, tripIdsByDay: newDays })
        }
      } else {
        next.set(key, {
          arrivalTime: entry.arrivalTime,
          routeShortName: entry.routeShortName,
          headsign: entry.headsign || 'Terminus',
          directionId: (entry.directionId ?? 0) as 0 | 1,
          tripIdsByDay: new Map([[currentDayIdx, entry.tripId]]),
        })
      }
      return next
    })
  }

  const totalPicks = Array.from(picks.values()).reduce((sum, p) => sum + p.tripIdsByDay.size, 0)

  async function handleSave() {
    if (picks.size === 0) {
      onClose()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      // For each composite key, group its tripIdsByDay by tripId
      // (one composite may map to multiple tripIds — one per day if TEC has separate trips per day)
      for (const data of picks.values()) {
        // Group days by tripId
        const daysByTripId = new Map<string, number[]>()
        for (const [dayIdx, tripId] of data.tripIdsByDay.entries()) {
          const list = daysByTripId.get(tripId) ?? []
          list.push(dayIdx)
          daysByTripId.set(tripId, list)
        }
        // Send one POST per unique tripId
        for (const [tripId, days] of daysByTripId.entries()) {
          const selectedDays = Array.from({ length: 7 }, (_, i) => days.includes(i))
          await addSubscription({
            tripId,
            arrivalTime: data.arrivalTime,
            routeShortName: data.routeShortName,
            headsign: data.headsign,
            directionId: data.directionId,
            selectedDays,
          })
        }
      }
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Group entries by hour
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
                        const key = compositeKey(entry)
                        const subDays = subscribedDaysByKey.get(key)
                        const pickedData = picks.get(key)
                        const pickedDays = pickedData
                          ? new Set(pickedData.tripIdsByDay.keys())
                          : null
                        const isCheckedToday =
                          (subDays?.has(currentDayIdx) ?? false) ||
                          (pickedDays?.has(currentDayIdx) ?? false)
                        // Combined days indicator (existing + new picks)
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
                              isCheckedToday
                                ? 'glass-strong shadow-glow-lime'
                                : 'glass hover:shadow-glow-sm'
                            )}
                          >
                            <div
                              className={cn(
                                'h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
                                isCheckedToday ? 'bg-btn-lime border-lime' : 'border-line'
                              )}
                            >
                              {isCheckedToday && (
                                <Check className="h-4 w-4 text-bg-deep" strokeWidth={3} />
                              )}
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
                            {/* Days indicator (all selected days for this composite) */}
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

'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, X, Loader2, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Pill } from '@/components/ui/Pill'

interface Props {
  stopId: string
  routeId: string | null
  stopName: string
  onClose: () => void
}

const DAYS = [
  { key: 'monday', label: 'Lu' },
  { key: 'tuesday', label: 'Ma' },
  { key: 'wednesday', label: 'Me' },
  { key: 'thursday', label: 'Je' },
  { key: 'friday', label: 'Ve' },
  { key: 'saturday', label: 'Sa' },
  { key: 'sunday', label: 'Di' },
] as const

function getCurrentBrusselsDay(): string {
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

function getHourKey(time: string): number {
  return Number(time.split(':')[0])
}

export function TimetablePanel({ stopId, routeId, stopName, onClose }: Props) {
  const [day, setDay] = useState(getCurrentBrusselsDay)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['timetable', stopId, routeId, day],
    queryFn: () => api.stopTimetable(stopId, day, routeId ?? undefined),
    staleTime: 5 * 60_000,
  })

  const grouped = new Map<number, typeof entries>()
  for (const entry of entries) {
    const hour = getHourKey(entry.arrivalTime)
    if (!grouped.has(hour)) grouped.set(hour, [])
    grouped.get(hour)!.push(entry)
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-bg-deep/70 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl glass-strong shadow-glass-lg overflow-hidden flex flex-col animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-btn-cyan text-white shadow-glow-cyan shrink-0">
              <Clock className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-ink">Horaires</h2>
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
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-btn-rose shadow-glow-magenta mb-3">
                <Clock className="h-8 w-8 text-white" strokeWidth={2} />
              </div>
              <p className="text-ink2 font-bold">Aucun passage ce jour</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...grouped.entries()].map(([hour, items]) => {
                const { display: hourDisplay, nextDay } = formatGtfsTime(`${hour}:00:00`)
                return (
                  <div key={hour}>
                    <div className="sticky top-0 glass-deep py-1.5 flex items-center gap-2 border-b border-line mb-2 -mx-5 px-5">
                      <span className="text-lg font-extrabold text-cyan-light tabular-nums">
                        {hourDisplay.split(':')[0]}h
                      </span>
                      {nextDay && (
                        <Pill variant="cyan" size="sm">+1</Pill>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((entry, i) => {
                        const { display, nextDay: nd } = formatGtfsTime(entry.arrivalTime)
                        return (
                          <div
                            key={`${entry.tripId}-${i}`}
                            className="flex items-center gap-3 rounded-2xl glass px-3 py-2"
                          >
                            <span className="tabular-nums text-base font-extrabold text-ink w-14 shrink-0">
                              {display}
                              {nd && <span className="text-[10px] text-ink3 ml-0.5">+1</span>}
                            </span>
                            {!routeId && (
                              <Pill variant="primary" size="sm" className="shrink-0">
                                {entry.routeShortName}
                              </Pill>
                            )}
                            <span className="text-sm text-ink2 font-semibold truncate flex-1">
                              → {entry.headsign || 'Terminus'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-5 py-3 border-t border-line glass shrink-0">
          <div className="flex items-center gap-2 text-xs text-ink3 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-sun" strokeWidth={2.5} />
            <span>Horaires planifiés — peuvent varier les jours fériés</span>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

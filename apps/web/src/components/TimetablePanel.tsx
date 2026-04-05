'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, X, Loader2, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

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
  const dayIndex = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Europe/Brussels',
  }).toLowerCase()
  return dayIndex
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
  const [h] = time.split(':').map(Number)
  return h
}

export function TimetablePanel({ stopId, routeId, stopName, onClose }: Props) {
  const [day, setDay] = useState(getCurrentBrusselsDay)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['timetable', stopId, routeId, day],
    queryFn: () => api.stopTimetable(stopId, day, routeId ?? undefined),
    staleTime: 5 * 60_000,
  })

  // Group by hour
  const grouped = new Map<number, typeof entries>()
  for (const entry of entries) {
    const hour = getHourKey(entry.arrivalTime)
    if (!grouped.has(hour)) grouped.set(hour, [])
    grouped.get(hour)!.push(entry)
  }

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-border bg-card overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent-cyan shrink-0" />
              <h2 className="text-base font-semibold text-white truncate">Horaires</h2>
            </div>
            <p className="text-xs text-muted mt-0.5 truncate">{stopName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Day picker */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-border shrink-0">
          {DAYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDay(key)}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                day === key
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'text-muted hover:text-white hover:bg-white/5'
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
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Aucun passage ce jour</p>
          ) : (
            <div className="space-y-1">
              {[...grouped.entries()].map(([hour, items]) => {
                const { display: hourDisplay, nextDay } = formatGtfsTime(`${hour}:00:00`)
                return (
                  <div key={hour}>
                    {/* Hour header */}
                    <div className="sticky top-0 bg-card py-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-accent-cyan tabular-nums">
                        {hourDisplay.split(':')[0]}h
                      </span>
                      {nextDay && (
                        <span className="text-[10px] text-muted">+1</span>
                      )}
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {/* Times */}
                    {items.map((entry, i) => {
                      const { display, nextDay: nd } = formatGtfsTime(entry.arrivalTime)
                      return (
                        <div
                          key={`${entry.tripId}-${i}`}
                          className="flex items-center gap-3 py-1 text-sm"
                        >
                          <span className="tabular-nums text-white font-medium w-12">
                            {display}
                            {nd && <span className="text-[10px] text-muted ml-0.5">+1</span>}
                          </span>
                          {!routeId && (
                            <span className="shrink-0 rounded bg-accent-cyan/10 px-1.5 py-0.5 text-[10px] font-bold text-accent-cyan">
                              {entry.routeShortName}
                            </span>
                          )}
                          <span className="text-xs text-muted truncate">{entry.headsign}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-5 py-2.5 border-t border-border bg-background shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>Horaires planifies — peuvent varier les jours feries</span>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

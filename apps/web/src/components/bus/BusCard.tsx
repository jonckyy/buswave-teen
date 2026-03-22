'use client'

import { useQuery } from '@tanstack/react-query'
import { Heart, MapPin, AlertCircle, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useCountdown, formatCountdown } from '@/hooks/useCountdown'
import { useFavoritesStore } from '@/store/favorites'
import { cn, delayColor, formatDelay } from '@/lib/utils'
import type { StopArrival, GtfsStop } from '@buswave/shared'

interface BusCardProps {
  stopId: string
  routeId: string | null
}

function ArrivalRow({ arrival }: { arrival: StopArrival }) {
  const countdown = useCountdown(arrival.predictedArrivalUnix)
  const color = delayColor(arrival.delaySeconds)

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <span className="min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-sm font-bold text-accent-cyan">
          {arrival.routeShortName}
        </span>
        <span className="text-sm text-white truncate max-w-[160px]">{arrival.headsign}</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Delay badge */}
        {Math.abs(arrival.delaySeconds) > 30 && (
          <span className={cn('flex items-center gap-1 text-xs', color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot')} />
            {formatDelay(arrival.delaySeconds)}
          </span>
        )}
        <span className="text-sm font-semibold text-white tabular-nums">
          {formatCountdown(countdown)}
        </span>
      </div>
    </div>
  )
}

export function BusCard({ stopId, routeId }: BusCardProps) {
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite)

  const { data: stopData } = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => api.stopInfo(stopId),
    staleTime: 60_000,
  })

  const { data: arrivals = [], isLoading } = useQuery({
    queryKey: ['arrivals', stopId, routeId],
    queryFn: () => api.arrivals(stopId, routeId ?? undefined),
    refetchInterval: 10_000,
  })

  const next3 = arrivals.slice(0, 3)

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent-cyan shrink-0" />
          <div>
            <p className="font-semibold text-white leading-tight">
              {stopData?.stop_name ?? stopId}
            </p>
            {routeId && (
              <p className="text-xs text-muted">Ligne {routeId}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => removeFavorite(stopId, routeId)}
          className="text-muted hover:text-large-delay transition-colors"
          aria-label="Retirer des favoris"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Arrivals */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded bg-border animate-pulse" />
          ))}
        </div>
      ) : next3.length > 0 ? (
        <div>
          {next3.map((a) => (
            <ArrivalRow key={`${a.tripId}-${a.stopSequence}`} arrival={a} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted text-center py-2">Aucun passage prévu</p>
      )}
    </div>
  )
}

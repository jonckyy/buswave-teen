'use client'

import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState, Suspense } from 'react'
import { ArrowLeftRight, MapPin, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { useCountdown, formatCountdown } from '@/hooks/useCountdown'
import { useFavoritesStore } from '@/store/favorites'
import { cn, delayColor, formatDelay } from '@/lib/utils'
import type { StopArrival } from '@buswave/shared'

function LinePageInner() {
  const params = useSearchParams()
  const routeId = params.get('routeId') ?? ''
  const stopId = params.get('stopId') ?? ''
  const [direction, setDirection] = useState<0 | 1>(0)
  const addFavorite = useFavoritesStore((s) => s.addFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)

  const { data: arrivals = [], isLoading } = useQuery({
    queryKey: ['arrivals', stopId, routeId],
    queryFn: () => api.arrivals(stopId, routeId),
    refetchInterval: 10_000,
    enabled: Boolean(stopId && routeId),
  })

  // Filter by direction
  // TODO: direction filtering requires trip direction_id from the feed
  const displayed = arrivals.slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">
          Ligne{' '}
          <span className="text-accent-cyan">{routeId || '—'}</span>
        </h1>
        <button
          onClick={() => setDirection((d) => (d === 0 ? 1 : 0))}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted hover:text-white transition-colors"
        >
          <ArrowLeftRight className="h-4 w-4" />
          {direction === 0 ? 'Aller' : 'Retour'}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-muted">Aucun passage prévu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((arrival, idx) => (
            <ArrivalTimelineRow
              key={`${arrival.tripId}-${arrival.stopSequence}`}
              arrival={arrival}
              isFirst={idx === 0}
              stopId={stopId}
              onFavorite={() =>
                addFavorite({ stopId, routeId: arrival.routeId, userId: null })
              }
              already={isFavorite(stopId, arrival.routeId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ArrivalTimelineRow({
  arrival,
  isFirst,
  stopId,
  onFavorite,
  already,
}: {
  arrival: StopArrival
  isFirst: boolean
  stopId: string
  onFavorite: () => void
  already: boolean
}) {
  const countdown = useCountdown(arrival.predictedArrivalUnix)
  const color = delayColor(arrival.delaySeconds)

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-card px-4 py-3',
        isFirst ? 'border-accent-cyan/50' : 'border-border'
      )}
    >
      {/* Bus-here indicator */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'h-3 w-3 rounded-full',
            isFirst ? 'bg-accent-cyan animate-pulse-dot' : 'bg-border'
          )}
        />
        {!isFirst && <div className="h-6 w-px bg-border mt-1" />}
      </div>

      <div className="flex flex-1 items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{arrival.headsign}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted">{arrival.routeShortName}</p>
            {Math.abs(arrival.delaySeconds) > 30 && (
              <span className={cn('text-xs', color)}>{formatDelay(arrival.delaySeconds)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white tabular-nums">
            {formatCountdown(countdown)}
          </span>
          <button
            onClick={onFavorite}
            disabled={already}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              already ? 'text-on-time' : 'text-muted hover:text-accent-cyan'
            )}
          >
            <MapPin className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LinePage() {
  return (
    <Suspense fallback={<div className="text-muted">Chargement…</div>}>
      <LinePageInner />
    </Suspense>
  )
}

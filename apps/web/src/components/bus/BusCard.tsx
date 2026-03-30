'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { MapPin, X, Map, Bell } from 'lucide-react'
import { api } from '@/lib/api'
import { useCountdown, formatCountdown } from '@/hooks/useCountdown'
import { useFavoritesActions } from '@/hooks/useFavoritesActions'
import { useUser } from '@/hooks/useUser'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { cn, delayColor, formatDelay } from '@/lib/utils'
import { NotificationSettingsPanel } from '@/components/NotificationSettingsPanel'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import type { StopArrival } from '@buswave/shared'

interface BusCardProps {
  stopId: string
  routeId: string | null
}

function formatClockTime(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function ArrivalRow({ arrival, showDelayBadges = true }: { arrival: StopArrival; showDelayBadges?: boolean }) {
  const countdown = useCountdown(arrival.predictedArrivalUnix)
  const color = delayColor(arrival.delaySeconds)

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0 min-w-0">
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        <span className="shrink-0 min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-sm font-bold text-accent-cyan">
          {arrival.routeShortName}
        </span>
        <span className="text-sm text-white truncate">{arrival.headsign}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Delay badge */}
        {showDelayBadges && Math.abs(arrival.delaySeconds) > 30 && (
          <span className={cn('flex items-center gap-1 text-xs', color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot')} />
            {formatDelay(arrival.delaySeconds)}
          </span>
        )}
        <span className="text-xs text-muted tabular-nums">
          {formatClockTime(arrival.predictedArrivalUnix)}
        </span>
        <span className="text-sm font-semibold text-white tabular-nums">
          {formatCountdown(countdown)}
        </span>
      </div>
    </div>
  )
}

export function BusCard({ stopId, routeId }: BusCardProps) {
  const { removeFavorite } = useFavoritesActions()
  const { user } = useUser()
  const favorites = useFavoritesStore(selectFavorites)
  const flags = useFeatureFlags()
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  const favorite = favorites.find(
    (f) => f.stopId === stopId && (f.routeId ?? null) === routeId
  )

  const mapParams = new URLSearchParams({ stopId })
  if (routeId) mapParams.set('routeId', routeId)
  const mapHref = `/map?${mapParams.toString()}`

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

  const next3 = arrivals.slice(0, flags.arrivalsPerCard)

  return (
    <Link
      href={mapHref}
      className="block min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-md cursor-pointer hover:border-accent-cyan/40 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-accent-cyan shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-white leading-tight truncate">
              {stopData?.stop_name ?? stopId}
            </p>
            {routeId && (
              <p className="text-xs text-muted">Ligne {routeId}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Map className="h-3.5 w-3.5 text-muted" />
          {user && favorite && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowNotifPanel(true) }}
              className="text-muted hover:text-accent-cyan transition-colors p-0.5"
              aria-label="Notifications"
              title="Configurer les notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFavorite(stopId, routeId) }}
            className="text-muted hover:text-large-delay transition-colors p-0.5"
            aria-label="Retirer des favoris"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
            <ArrivalRow key={`${a.tripId}-${a.stopSequence}`} arrival={a} showDelayBadges={flags.showDelayBadges} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted text-center py-2">Aucun passage prévu</p>
      )}

      {showNotifPanel && favorite && (
        <NotificationSettingsPanel
          favoriteId={favorite.id}
          stopName={stopData?.stop_name ?? stopId}
          routeId={routeId}
          onClose={() => setShowNotifPanel(false)}
        />
      )}
    </Link>
  )
}

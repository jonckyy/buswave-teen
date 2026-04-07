'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { MapPin, X, Bell, Clock, Bus, Map as MapIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { useCountdown } from '@/hooks/useCountdown'
import { useFavoritesActions } from '@/hooks/useFavoritesActions'
import { useUser } from '@/hooks/useUser'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { IconButton } from '@/components/ui/IconButton'
import { NotificationSettingsPanel } from '@/components/NotificationSettingsPanel'
import { TimetablePanel } from '@/components/TimetablePanel'

interface Props {
  stopId: string
  routeId: string | null
}

function formatClock(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('fr-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRemaining(sec: number): string {
  if (sec <= 0) return 'maintenant'
  const totalMin = Math.round(sec / 60)
  if (totalMin < 1) return '< 1 min'
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h} h` : `${h}h${m}`
}

function delayInfo(delaySec: number) {
  const abs = Math.abs(delaySec)
  if (abs <= 60) return { color: 'text-lime-light', label: null as string | null }
  const min = Math.round(delaySec / 60)
  if (delaySec > 0) {
    return {
      color: abs > 300 ? 'text-rose-light' : 'text-orange',
      label: `+${min}`,
    }
  }
  return { color: 'text-cyan-light', label: `${min}` }
}

export function FavoriteCard({ stopId, routeId }: Props) {
  const { removeFavorite } = useFavoritesActions()
  const { user } = useUser()
  const favorites = useFavoritesStore(selectFavorites)
  const [removing, setRemoving] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [showTimetable, setShowTimetable] = useState(false)

  const favorite = favorites.find(
    (f) => f.stopId === stopId && (f.routeId ?? null) === routeId
  )

  const { data: stopData } = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => api.stopInfo(stopId),
    staleTime: 60_000,
  })

  const { data: arrivals = [], isLoading } = useQuery({
    queryKey: ['arrivals', stopId, routeId],
    queryFn: () => api.arrivals(stopId, routeId ?? undefined),
    refetchInterval: 15_000,
  })

  const next = arrivals[0]
  const countdown = useCountdown(next?.predictedArrivalUnix ?? 0)
  const delay = next ? delayInfo(next.delaySeconds) : null

  const mapParams = new URLSearchParams({ stopId })
  if (routeId) mapParams.set('routeId', routeId)

  const stopName = stopData?.stop_name ?? stopId

  return (
    <Card
      variant="glass"
      className={cn(
        'animate-fade-up transition-all duration-300 hover:shadow-glow',
        'gradient-border',
        removing && 'opacity-0 scale-90'
      )}
    >
      {/* Header: stop name + line badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <MapPin className="h-4 w-4 text-primary-light shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold text-ink leading-tight truncate">{stopName}</h3>
            {next?.headsign && (
              <p className="text-[11px] text-ink3 font-medium truncate">→ {next.headsign}</p>
            )}
          </div>
        </div>
        {next?.routeShortName && (
          <Pill variant="primary" size="md" className="shrink-0">
            {next.routeShortName}
          </Pill>
        )}
      </div>

      {/* Main: arrival time + countdown */}
      {isLoading ? (
        <div className="space-y-2 mb-3">
          <div className="h-10 skeleton rounded-2xl" />
          <div className="h-4 skeleton rounded-xl w-1/2" />
        </div>
      ) : !next ? (
        <div className="flex items-center gap-2 py-3 mb-3 text-ink3">
          <Bus className="h-5 w-5" strokeWidth={2} />
          <span className="text-sm font-bold">Aucun bus en vue</span>
        </div>
      ) : (
        <Link
          href={`/favorite-map?${mapParams.toString()}`}
          className="block mb-3 pressable"
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={cn(
                'text-4xl font-extrabold tabular-nums leading-none tracking-tight',
                delay?.color ?? 'text-ink'
              )}
            >
              {formatClock(next.predictedArrivalUnix)}
            </span>
            {delay?.label && (
              <Pill
                variant={next.delaySeconds > 300 ? 'rose' : 'magenta'}
                size="sm"
              >
                {delay.label}
              </Pill>
            )}
          </div>
          <p className="text-base font-bold text-ink2 mt-1">
            dans <span className="text-gradient-cyan">{formatRemaining(countdown)}</span>
          </p>
        </Link>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        <Link href={`/favorite-map?${mapParams.toString()}`}>
          <IconButton
            variant="primary"
            size="sm"
            icon={<MapIcon className="h-4 w-4" strokeWidth={2.5} />}
            label="Voir sur la carte"
          />
        </Link>
        <IconButton
          variant="cyan"
          size="sm"
          icon={<Clock className="h-4 w-4" strokeWidth={2.5} />}
          label="Horaires"
          onClick={() => setShowTimetable(true)}
        />
        {user && favorite && (
          <IconButton
            variant="lime"
            size="sm"
            icon={<Bell className="h-4 w-4" strokeWidth={2.5} />}
            label="Notifications"
            onClick={() => setShowNotif(true)}
          />
        )}
        <div className="flex-1" />
        <IconButton
          variant="rose"
          size="sm"
          icon={<X className="h-4 w-4" strokeWidth={2.5} />}
          label="Retirer"
          onClick={() => {
            setRemoving(true)
            setTimeout(() => removeFavorite(stopId, routeId), 250)
          }}
        />
      </div>

      {/* Panels */}
      {showNotif && favorite && (
        <NotificationSettingsPanel
          favoriteId={favorite.id}
          stopName={stopName}
          routeId={routeId}
          onClose={() => setShowNotif(false)}
        />
      )}
      {showTimetable && (
        <TimetablePanel
          stopId={stopId}
          routeId={routeId}
          stopName={stopName}
          onClose={() => setShowTimetable(false)}
        />
      )}
    </Card>
  )
}

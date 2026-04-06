'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Map, X, Bell, Clock, Bus } from 'lucide-react'
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
  if (totalMin < 1) return 'dans moins d\'1 min'
  if (totalMin < 60) return `dans ${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `dans ${h} h` : `dans ${h}h ${m}min`
}

function delayInfo(delaySec: number): { color: string; label: string | null } {
  const absDelay = Math.abs(delaySec)
  if (absDelay <= 60) return { color: 'text-lime-600', label: null }
  const min = Math.round(delaySec / 60)
  if (delaySec > 0) {
    return {
      color: absDelay > 300 ? 'text-rose-600' : 'text-coral-500',
      label: `+${min} min`,
    }
  }
  return { color: 'text-secondary-600', label: `${min} min` }
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
    refetchInterval: 10_000,
  })

  const next = arrivals[0]
  const upcoming = arrivals.slice(1, 3)

  const countdown = useCountdown(next?.predictedArrivalUnix ?? 0)
  const delay = next ? delayInfo(next.delaySeconds) : null

  const mapParams = new URLSearchParams({ stopId })
  if (routeId) mapParams.set('routeId', routeId)

  const stopName = stopData?.stop_name ?? stopId

  return (
    <Card
      variant="pop"
      className={cn(
        'animate-bounce-in transition-all duration-300',
        removing && 'opacity-0 scale-90'
      )}
    >
      {/* Header: stop name + line badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold text-ink leading-tight truncate">{stopName}</h3>
          {next?.headsign && (
            <p className="text-sm text-ink2 mt-0.5 truncate">→ {next.headsign}</p>
          )}
        </div>
        {next?.routeShortName && (
          <Pill variant="primary" size="lg" className="shrink-0">
            {next.routeShortName}
          </Pill>
        )}
      </div>

      {/* Main: arrival time + countdown */}
      {isLoading ? (
        <div className="space-y-3 mb-5">
          <div className="h-16 skeleton rounded-2xl" />
          <div className="h-6 skeleton rounded-xl w-1/2" />
        </div>
      ) : !next ? (
        <div className="flex flex-col items-center justify-center py-6 mb-5">
          <Bus className="h-12 w-12 text-ink3 mb-2" strokeWidth={1.5} />
          <p className="text-ink2 font-semibold">Aucun bus en vue</p>
          <p className="text-ink3 text-sm">Reviens plus tard</p>
        </div>
      ) : (
        <div className="mb-5">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className={cn(
                'text-6xl font-extrabold tabular-nums leading-none',
                delay?.color ?? 'text-ink'
              )}
            >
              {formatClock(next.predictedArrivalUnix)}
            </span>
            {delay?.label && (
              <Pill variant={next.delaySeconds > 300 ? 'rose' : 'coral'} size="md">
                {delay.label}
              </Pill>
            )}
          </div>
          <p className="text-2xl font-bold text-ink2 mt-2">{formatRemaining(countdown)}</p>

          {/* Upcoming arrivals */}
          {upcoming.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t-2 border-line">
              <span className="text-xs font-bold text-ink3 uppercase">Suivants</span>
              {upcoming.map((a) => (
                <span
                  key={`${a.tripId}-${a.stopSequence}`}
                  className="text-sm font-bold text-ink2 tabular-nums"
                >
                  {formatClock(a.predictedArrivalUnix)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Link href={`/favorite-map?${mapParams.toString()}`} className="pressable">
          <IconButton
            variant="primary"
            icon={<Map className="h-5 w-5" strokeWidth={2.5} />}
            label="Voir sur la carte"
          />
        </Link>
        <IconButton
          variant="secondary"
          icon={<Clock className="h-5 w-5" strokeWidth={2.5} />}
          label="Horaires"
          onClick={() => setShowTimetable(true)}
        />
        {user && favorite && (
          <IconButton
            variant="lime"
            icon={<Bell className="h-5 w-5" strokeWidth={2.5} />}
            label="Notifications"
            onClick={() => setShowNotif(true)}
          />
        )}
        <IconButton
          variant="danger"
          icon={<X className="h-5 w-5" strokeWidth={2.5} />}
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
